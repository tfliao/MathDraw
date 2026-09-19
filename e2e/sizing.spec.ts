import { expect, test } from '@playwright/test'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { imageFile, rotateJpegClockwise } from './fixtures'

test('auto sizing follows image proportions and preserves manual settings', async ({ page }) => {
  await page.goto('/')
  const input = page.getByLabel('1. Choose a picture')
  await input.setInputFiles(await imageFile(page))
  await page.getByLabel('Auto size from picture').check()
  await expect(page.getByLabel('Columns', { exact: true })).toHaveValue('24')
  await expect(page.getByLabel('Rows', { exact: true })).toHaveValue('12')
  await expect(page.getByLabel('Rows', { exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Create puzzle' }).click()
  await expect(page.getByRole('table', { name: '12 by 24 addition puzzle' })).toBeVisible()
  await input.setInputFiles(rotateJpegClockwise(await imageFile(page, { type: 'image/jpeg' })))
  await expect(page.getByLabel('Columns', { exact: true })).toHaveValue('12')
  await expect(page.getByLabel('Rows', { exact: true })).toHaveValue('24')
  await expect(page.getByRole('button', { name: 'Print puzzle', exact: true })).toBeDisabled()
  await page.getByLabel('Auto size from picture').uncheck()
  await expect(page.getByLabel('Rows', { exact: true })).toHaveValue('20')
  await expect(page.getByLabel('Columns', { exact: true })).toHaveValue('16')
})

test('auto size can bypass invalid manual values but restores their errors', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Rows', { exact: true }).fill('')
  await page.getByLabel('Auto size from picture').check()
  await expect(page.getByRole('button', { name: 'Create puzzle' })).toBeDisabled()
  await page.getByLabel('1. Choose a picture').setInputFiles(await imageFile(page))
  await expect(page.getByRole('button', { name: 'Create puzzle' })).toBeEnabled()
  await page.getByLabel('Auto size from picture').uncheck()
  await expect(page.getByRole('button', { name: 'Create puzzle' })).toBeDisabled()
  await expect(page.locator('#rows-error')).toBeVisible()
})

test('64 columns retain readable cells on larger paper in both print modes', async ({ page }, testInfo) => {
  await page.goto('/')
  await page.evaluate(() => { window.print = () => { document.documentElement.dataset.printCalled = 'yes' } })
  await page.getByLabel('1. Choose a picture').setInputFiles(await imageFile(page))
  await page.getByLabel('Columns', { exact: true }).fill('65')
  await expect(page.locator('#columns-error')).toHaveText('Enter a whole number from 4 to 64.')
  await page.getByLabel('Columns', { exact: true }).fill('64')
  await page.getByLabel('Rows', { exact: true }).fill('24')
  await expect(page.getByText('24 columns best fits A4. Choose larger paper', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Create puzzle' }).click()
  await expect(page.getByRole('table', { name: '24 by 64 addition puzzle' }).locator('td')).toHaveCount(1536)
  await expect(page.getByText('Choose larger paper: this worksheet needs at least 500 mm', { exact: false })).toBeVisible()
  for (const mode of ['puzzle', 'answer key']) {
    await page.getByRole('button', { name: `Print ${mode}`, exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('data-print-called', 'yes')
    await page.emulateMedia({ media: 'print' })
    const grid = await page.locator('.print-root .worksheet-grid').boundingBox()
    expect(grid!.width).toBeCloseTo(480 * 96 / 25.4, 0)
    if (mode === 'puzzle') {
      const cell = await page.locator('.print-root .math-grid td').first().boundingBox()
      expect(cell!.width).toBeGreaterThan(28)
      expect(Math.abs(cell!.width - cell!.height)).toBeLessThan(.5)
    }
    const pdf = await page.pdf({ width: '520mm', height: '300mm', path: testInfo.outputPath(`${mode}.pdf`) })
    const task = getDocument({ data: new Uint8Array(pdf) })
    const pdfDocument = await task.promise
    try {
      expect(pdfDocument.numPages).toBe(1)
      const content = await (await pdfDocument.getPage(1)).getTextContent()
      const text = content.items.flatMap(item => 'str' in item ? [item.str] : []).join(' ')
      if (mode === 'puzzle') expect(text.match(/[1-9]\+[1-9]/g)).toHaveLength(1536)
      else expect(text).toContain('Answer key')
    } finally { await task.destroy() }
    await page.evaluate(() => { window.dispatchEvent(new Event('afterprint')); delete document.documentElement.dataset.printCalled })
    await page.emulateMedia({ media: 'screen' })
  }
})
