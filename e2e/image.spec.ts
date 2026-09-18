import { expect, test } from '@playwright/test'
import { imageFile } from './fixtures'

test('fits the entire image, keeps white margins and limits the palette', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('1. Choose a picture').setInputFiles(await imageFile(page))
  await page.getByLabel('Rows', { exact: true }).fill('8')
  await page.getByLabel('Columns', { exact: true }).fill('8')
  await page.getByRole('button', { name: 'Create puzzle' }).click()
  await page.getByRole('button', { name: 'Solution', exact: true }).click()
  const grid = page.getByRole('img', { name: 'Pixel picture with 8 rows, 8 columns and 3 colors' })
  await expect(grid).toBeVisible()
  await expect(grid.locator('rect')).toHaveCount(64)
  await expect(grid.locator('rect').first()).toHaveAttribute('fill', '#ffffff')
  await expect(grid.locator('rect').nth(16)).toHaveAttribute('fill', '#e33632')
  await expect(grid.locator('rect').nth(20)).toHaveAttribute('fill', '#185ec9')
  await page.getByLabel('Rows', { exact: true }).fill('9')
  await expect(page.getByText('Previous puzzle.', { exact: false })).toBeVisible()
})

test('composites transparent pixels onto white', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('1. Choose a picture').setInputFiles(await imageFile(page, { transparent: true }))
  await page.getByRole('button', { name: 'Create puzzle' }).click()
  await page.getByRole('button', { name: 'Solution', exact: true }).click()
  const grid = page.getByRole('img', { name: /Pixel picture/ })
  await expect(grid).toHaveAttribute('aria-label', /1 colors/)
  await expect(grid.locator('rect').first()).toHaveAttribute('fill', '#ffffff')
})

test('reports corrupt input and recovers with a valid picture', async ({ page }) => {
  await page.goto('/')
  const input = page.getByLabel('1. Choose a picture')
  await input.setInputFiles({ name: 'bad.png', mimeType: 'image/png', buffer: Buffer.from('not a picture') })
  await expect(page.getByText('This picture could not be decoded.', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create puzzle' })).toBeDisabled()
  await input.setInputFiles(await imageFile(page))
  await expect(page.getByRole('button', { name: 'Create puzzle' })).toBeEnabled()
  await expect(page.locator('#image-error')).toBeEmpty()
})
