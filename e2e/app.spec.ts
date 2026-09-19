import { expect, test } from '@playwright/test'

test('setup is labeled and generation requires a picture', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Little sums, big pictures.' })).toBeVisible()
  await expect(page.getByLabel('Columns', { exact: true })).toHaveValue('16')
  await expect(page.getByLabel('Rows', { exact: true })).toHaveValue('20')
  await expect(page.getByRole('button', { name: 'Create puzzle' })).toBeDisabled()
  await page.getByLabel('Rows', { exact: true }).fill('65')
  await expect(page.getByText('Enter a whole number from 4 to 64.')).toBeVisible()
})
