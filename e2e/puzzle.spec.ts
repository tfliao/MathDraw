import { expect, test } from '@playwright/test'
import { imageFile } from './fixtures'

test('puzzle sums share a stable key and reveal the same picture', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('1. Choose a picture').setInputFiles(await imageFile(page))
  await page.getByRole('button', { name: 'Create puzzle' }).click()
  const grid = page.getByRole('table', { name: '20 by 16 addition puzzle' })
  await expect(grid).toBeVisible()
  const problems = await grid.locator('td').allTextContents()
  expect(problems).toHaveLength(320)
  const key = await page.locator('.color-key td').evaluateAll(cells => cells.map(cell => ({ result: Number(cell.getAttribute('data-result')), color: cell.getAttribute('data-color') })))
  for (const problem of problems) {
    expect(problem).toMatch(/^[1-9]\+[1-9]$/)
    expect(key.some(entry => entry.result === problem.split('+').reduce((sum, part) => sum + Number(part), 0))).toBe(true)
  }
  await page.getByRole('button', { name: 'Solution', exact: true }).click()
  const colors = await page.locator('.color-preview rect').evaluateAll(rectangles => rectangles.map(rect => rect.getAttribute('fill')))
  problems.forEach((problem, index) => {
    const sum = problem.split('+').reduce((sum, part) => sum + Number(part), 0)
    expect(colors[index]).toBe(key.find(entry => entry.result === sum)?.color)
  })
  await page.getByRole('button', { name: 'Puzzle', exact: true }).click()
  expect(await grid.locator('td').allTextContents()).toEqual(problems)
  await page.getByLabel('Columns', { exact: true }).fill('4')
  await page.getByLabel('Rows', { exact: true }).fill('24')
  await expect(page.getByText('Previous puzzle.', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Create puzzle' }).click()
  await expect(page.getByRole('table', { name: '24 by 4 addition puzzle' }).locator('td')).toHaveCount(96)
})

test('mobile worksheets scroll without squeezing arithmetic', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await page.goto('/')
  await page.getByLabel('1. Choose a picture').setInputFiles(await imageFile(page))
  await page.getByRole('button', { name: 'Create puzzle' }).click()
  const region = page.getByRole('region', { name: 'Scrollable worksheet preview' })
  await expect(region).toBeVisible()
  const sizes = await region.evaluate(element => ({ width: element.clientWidth, scroll: element.scrollWidth, body: document.body.scrollWidth }))
  expect(sizes.scroll).toBeGreaterThan(sizes.width)
  expect(sizes.body).toBeLessThanOrEqual(375)
  await region.focus()
  await expect(region).toBeFocused()
})
