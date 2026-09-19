import { expect, test } from '@playwright/test'
import { imageFile } from './fixtures'

test('advanced settings are collapsed and use the configured defaults', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByLabel('Maximum operand', { exact: true })).toBeHidden()
  await page.getByText('Advanced', { exact: true }).click()
  await expect(page.getByLabel('Allow zero operands')).not.toBeChecked()
  await expect(page.getByLabel('Maximum operand', { exact: true })).toHaveValue('9')
  await expect(page.getByLabel('Addition (+)', { exact: true })).toBeChecked()
  await expect(page.getByLabel('Subtraction (-)', { exact: true })).not.toBeChecked()
  await expect(page.getByLabel('Multiplication (\u00d7)', { exact: true })).not.toBeChecked()
  await expect(page.getByLabel('Multiple results per color')).toBeChecked()
  await expect(page.getByLabel('Maximum colors', { exact: true })).toHaveValue('8')
  await expect(page.getByLabel('Maximum result', { exact: true })).toHaveValue('99')
  await expect(page.getByLabel('Allow zero results')).not.toBeChecked()
})

test('advanced validation blocks generation, including when collapsed', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('1. Choose a picture').setInputFiles(await imageFile(page))
  await page.getByText('Advanced', { exact: true }).click()
  for (const value of ['1', '100', '2.5', '']) {
    await page.getByLabel('Maximum operand', { exact: true }).fill(value)
    await expect(page.getByRole('button', { name: 'Create puzzle' })).toBeDisabled()
    await expect(page.locator('#operand-error')).toBeVisible()
  }
  await page.getByLabel('Maximum operand', { exact: true }).fill('2')
  for (const value of ['0', '17', '1.5', '']) {
    await page.getByLabel('Maximum colors', { exact: true }).fill(value)
    await expect(page.getByRole('button', { name: 'Create puzzle' })).toBeDisabled()
  }
  await page.getByLabel('Maximum colors', { exact: true }).fill('16')
  for (const value of ['-1', '9802', '1.5', '']) {
    await page.getByLabel('Maximum result', { exact: true }).fill(value)
    await expect(page.locator('#result-error')).toHaveText('Enter a whole number from 0 to 9801.')
    await expect(page.getByRole('button', { name: 'Create puzzle' })).toBeDisabled()
  }
  await page.getByLabel('Maximum result', { exact: true }).fill('99')
  await page.getByLabel('Addition (+)', { exact: true }).uncheck()
  await expect(page.locator('#operator-error')).toBeVisible()
  await page.getByText('Advanced', { exact: true }).click()
  await expect(page.getByText('Check the invalid options in Advanced', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create puzzle' })).toBeDisabled()
})

test('subtraction caps colors by answer capacity and allows zero results without zero operands', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('1. Choose a picture').setInputFiles(await imageFile(page, { palette: true }))
  await page.getByText('Advanced', { exact: true }).click()
  await page.getByLabel('Addition (+)', { exact: true }).uncheck()
  await page.getByLabel('Subtraction (-)', { exact: true }).check()
  await page.getByLabel('Allow zero results').check()
  await page.getByLabel('Maximum operand', { exact: true }).fill('2')
  await page.getByLabel('Maximum colors', { exact: true }).fill('16')
  await expect(page.getByText('These math settings provide 2 distinct answers', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Create puzzle' }).click()
  await expect(page.getByRole('table', { name: '12 by 24 math puzzle' })).toBeVisible()
  await expect(page.locator('.app-shell .color-key td')).toHaveCount(2)
  const expressions = await page.locator('.app-shell .math-grid td').allTextContents()
  expect(expressions.every(text => /^[12]-[12]$/.test(text))).toBe(true)
  const results = expressions.map(text => Number(text[0]) - Number(text[2]))
  expect(new Set(results)).toEqual(new Set([0, 1]))
})

test('multiplication multi-map uses grouped results and survives view switching', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('1. Choose a picture').setInputFiles(await imageFile(page))
  await page.getByText('Advanced', { exact: true }).click()
  await page.getByLabel('Addition (+)', { exact: true }).uncheck()
  await page.getByLabel('Multiplication (\u00d7)', { exact: true }).check()
  await page.getByLabel('Maximum operand', { exact: true }).fill('99')
  await page.getByLabel('Multiple results per color').check()
  await page.getByRole('button', { name: 'Create puzzle' }).click()
  await expect(page.getByRole('table', { name: '12 by 24 math puzzle' })).toBeVisible()
  const problems = await page.locator('.app-shell .math-grid td').allTextContents()
  const entries = await page.locator('.app-shell .color-key td').evaluateAll(cells => cells.map(cell => ({
    results: cell.getAttribute('data-results')!.split(',').map(Number), color: cell.getAttribute('data-color'),
  })))
  expect(entries.every(entry => entry.results.length === 3)).toBe(true)
  expect(new Set(entries.flatMap(entry => entry.results)).size).toBe(entries.length * 3)
  const results = problems.map(text => {
    expect(text).toMatch(/^\d{1,2}\u00d7\d{1,2}$/)
    const [a, b] = text.split('\u00d7').map(Number)
    expect(a).toBeGreaterThan(0)
    expect(b).toBeGreaterThan(0)
    expect(a * b).toBeLessThanOrEqual(99)
    return a * b
  })
  expect(new Set(results)).toEqual(new Set(entries.flatMap(entry => entry.results)))
  await page.getByRole('button', { name: 'Solution', exact: true }).click()
  const colors = await page.locator('.app-shell .color-preview rect').evaluateAll(rectangles => rectangles.map(rect => rect.getAttribute('fill')))
  results.forEach((result, index) => expect(colors[index]).toBe(entries.find(entry => entry.results.includes(result))?.color))
  await page.getByRole('button', { name: 'Puzzle', exact: true }).click()
  expect(await page.locator('.app-shell .math-grid td').allTextContents()).toEqual(problems)
  await page.getByLabel('Allow zero operands').check()
  await expect(page.getByRole('button', { name: 'Print puzzle', exact: true })).toBeDisabled()
})

test('zero operands can actually appear and color limit one is honored', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('1. Choose a picture').setInputFiles(await imageFile(page, { transparent: true }))
  await page.getByText('Advanced', { exact: true }).click()
  await page.getByLabel('Maximum operand', { exact: true }).fill('2')
  await page.getByLabel('Allow zero operands').check()
  await page.getByLabel('Maximum colors', { exact: true }).fill('1')
  await page.getByLabel('Multiple results per color').check()
  await page.evaluate(() => { Math.random = () => .999 })
  await page.getByRole('button', { name: 'Create puzzle' }).click()
  await expect(page.locator('.app-shell .color-key td')).toHaveCount(1)
  const problems = await page.locator('.app-shell .math-grid td').allTextContents()
  expect(problems.some(text => text.startsWith('0+') || text.endsWith('+0'))).toBe(true)
  expect(problems.every(text => /^[0-2]\+[0-2]$/.test(text))).toBe(true)
})

test('all advanced changes invalidate old printouts and the expanded panel fits mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await page.goto('/')
  await page.getByLabel('1. Choose a picture').setInputFiles(await imageFile(page))
  await page.getByText('Advanced', { exact: true }).click()
  const edits = [
    () => page.getByLabel('Maximum operand', { exact: true }).fill('10'),
    () => page.getByLabel('Subtraction (-)', { exact: true }).check(),
    () => page.getByLabel('Multiple results per color').uncheck(),
    () => page.getByLabel('Maximum colors', { exact: true }).fill('3'),
    () => page.getByLabel('Allow zero operands').check(),
    () => page.getByLabel('Maximum result', { exact: true }).fill('5'),
    () => page.getByLabel('Allow zero results').check(),
  ]
  for (const edit of edits) {
    await page.getByRole('button', { name: 'Create puzzle' }).click()
    await expect(page.getByRole('button', { name: 'Print puzzle', exact: true })).toBeEnabled()
    const problems = await page.locator('.app-shell .math-grid td').allTextContents()
    await edit()
    await expect(page.getByRole('button', { name: 'Print puzzle', exact: true })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Print answer key', exact: true })).toBeDisabled()
    expect(await page.locator('.app-shell .math-grid td').allTextContents()).toEqual(problems)
  }
  expect(await page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(375)
})
