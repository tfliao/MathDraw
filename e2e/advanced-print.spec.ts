import { expect, test } from '@playwright/test'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { imageFile } from './fixtures'

test('large advanced worksheets retain expressions, grouped keys and readable cells in PDFs', async ({ page }, testInfo) => {
  await page.goto('/')
  await page.evaluate(() => {
    let seed = 82541
    Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
    window.print = () => { document.documentElement.dataset.printCalled = 'yes' }
  })
  await page.getByLabel('1. Choose a picture').setInputFiles(await imageFile(page, { width: 512, height: 192, manyColors: true }))
  await page.getByLabel('Columns', { exact: true }).fill('64')
  await page.getByLabel('Rows', { exact: true }).fill('24')
  await page.getByText('Advanced', { exact: true }).click()
  await page.getByLabel('Maximum operand', { exact: true }).fill('99')
  await page.getByLabel('Maximum result', { exact: true }).fill('9801')
  await page.getByLabel('Maximum colors', { exact: true }).fill('16')
  await page.getByLabel('Subtraction (-)', { exact: true }).check()
  await page.getByLabel('Multiplication (\u00d7)', { exact: true }).check()
  await page.getByLabel('Multiple results per color').check()
  await page.getByRole('button', { name: 'Create puzzle' }).click()
  await expect(page.getByRole('table', { name: '24 by 64 math puzzle' })).toBeVisible()
  const problems = await page.locator('.app-shell .math-grid td').allTextContents()
  const key = await page.locator('.app-shell .color-key td').evaluateAll(cells => cells.map(cell => ({
    results: cell.getAttribute('data-results')!.split(',').map(Number), color: cell.getAttribute('data-color')!,
  })))
  expect(key.length).toBeGreaterThan(8)
  expect(key.length).toBeLessThanOrEqual(16)
  expect(key.some(entry => entry.results.some(result => result >= 1000))).toBe(true)
  expect(key.every(entry => entry.results.length === 3)).toBe(true)
  await expect(page.getByText('Choose larger paper: this worksheet needs at least 788 mm', { exact: false })).toBeVisible()

  for (const mode of ['puzzle', 'answer key']) {
    await page.getByRole('button', { name: `Print ${mode}`, exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('data-print-called', 'yes')
    await expect(page.getByLabel('Maximum operand', { exact: true })).toBeDisabled()
    await page.emulateMedia({ media: 'print' })
    const sheet = page.locator('.print-root .worksheet')
    const bounds = (await sheet.boundingBox())!
    expect(bounds.width).toBeCloseTo(768 * 96 / 25.4, 0)
    expect(bounds.height).toBeLessThan(396 * 96 / 25.4)
    if (mode === 'puzzle') {
      const cells = await sheet.locator('.math-grid td').evaluateAll(elements => elements.map(cell => ({
        width: cell.getBoundingClientRect().width, height: cell.getBoundingClientRect().height,
        font: parseFloat(getComputedStyle(cell).fontSize), text: cell.querySelector('span')!.getBoundingClientRect().width,
      })))
      // Chromium distributes fractional table widths into the final column (<1 CSS px).
      expect(cells.filter(cell => cell.font < 13.33 || cell.width <= 45 || Math.abs(cell.width - cell.height) >= 1 || cell.text >= cell.width - 1).slice(0, 3)).toEqual([])
    }
    const keyFits = await sheet.locator('.color-key td').evaluateAll(elements => elements.every(cell => cell.scrollWidth <= cell.clientWidth))
    expect(keyFits).toBe(true)
    const bytes = await page.pdf({ width: '800mm', height: '440mm', printBackground: false, path: testInfo.outputPath(`${mode}.pdf`) })
    const task = getDocument({ data: new Uint8Array(bytes) })
    const pdf = await task.promise
    try {
      expect(pdf.numPages).toBe(1)
      const first = await pdf.getPage(1)
      const content = await first.getTextContent()
      const text = content.items.flatMap(item => 'str' in item ? [item.str] : []).join(' ')
      for (const entry of key) {
        expect(text).toContain(entry.color)
        for (const result of entry.results) expect(text).toMatch(new RegExp(`\\b${result}\\b`))
      }
      if (mode === 'puzzle') {
        expect(text.match(/\d{1,2}[+\u00d7-]\d{1,2}/g)).toEqual(problems)
        expect(text).toContain('\u00d7')
        expect(text).not.toContain('*')
      }
      else {
        expect(text).toContain('Answer key')
        expect(text).not.toMatch(/\d{1,2}[+\u00d7-]\d{1,2}/)
      }
      for (const item of content.items) {
        if ('str' in item && item.str.trim()) {
          expect(item.transform[4]).toBeGreaterThanOrEqual(0)
          expect(item.transform[4] + item.width).toBeLessThan(first.view[2])
          expect(item.transform[5]).toBeGreaterThan(0)
          expect(item.transform[5]).toBeLessThan(first.view[3])
        }
      }
    } finally { await task.destroy() }
    await page.evaluate(() => { window.dispatchEvent(new Event('afterprint')); delete document.documentElement.dataset.printCalled })
    await page.emulateMedia({ media: 'screen' })
  }
})
