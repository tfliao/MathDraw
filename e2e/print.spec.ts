import { expect, test } from '@playwright/test'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { imageFile } from './fixtures'
import type { Page } from '@playwright/test'

async function setup(page: Page, rows = 20, columns = 16) {
  await page.goto('/')
  await page.evaluate(() => {
    window.print = () => { document.documentElement.dataset.printCalled = 'yes' }
  })
  await page.getByLabel('1. Choose a picture').setInputFiles(await imageFile(page, { width: 96, height: 96, palette: true }))
  await page.getByLabel('Rows', { exact: true }).fill(String(rows))
  await page.getByLabel('Columns', { exact: true }).fill(String(columns))
  await page.getByRole('button', { name: 'Create puzzle' }).click()
  await expect(page.getByRole('button', { name: 'Print puzzle', exact: true })).toBeEnabled()
}

async function startPrint(page: Page, mode: 'puzzle' | 'solution') {
  await page.evaluate(() => { delete document.documentElement.dataset.printCalled })
  await page.getByRole('button', { name: mode === 'puzzle' ? 'Print puzzle' : 'Print answer key', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-print-called', 'yes')
}

test('print modes are isolated, stable and reset after cancel', async ({ page }) => {
  await setup(page)
  const problems = await page.locator('.app-shell .math-grid td').allTextContents()
  await page.getByRole('button', { name: 'Solution', exact: true }).click()
  await startPrint(page, 'puzzle')
  expect(await page.locator('.print-root .math-grid td').allTextContents()).toEqual(problems)
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('.app-shell')).toBeHidden()
  await expect(page.locator('.print-root .puzzle-sheet')).toBeVisible()
  await expect(page.locator('.print-root .solution-sheet')).toHaveCount(0)
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')))
  await page.emulateMedia({ media: 'screen' })
  await expect(page.getByLabel('Rows', { exact: true })).toBeEnabled()
  await startPrint(page, 'solution')
  await expect(page.locator('.print-root .math-grid')).toHaveCount(0)
  await expect(page.locator('.print-root .color-preview rect')).toHaveCount(320)
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')))
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('.print-root .puzzle-sheet')).toBeVisible()
  expect(await page.locator('.print-root .math-grid td').allTextContents()).toEqual(problems)
})

test('stale inputs disable both print actions and never print the old puzzle', async ({ page }) => {
  await setup(page)
  await page.getByLabel('Columns', { exact: true }).fill('24')
  await expect(page.getByRole('button', { name: 'Print puzzle', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Print answer key', exact: true })).toBeDisabled()
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('.print-unavailable')).toBeVisible()
  await expect(page.locator('.print-root .worksheet')).toHaveCount(0)
})

test('print preparation failures are actionable and restore editing', async ({ page }) => {
  await setup(page)
  await page.evaluate(() => { window.print = () => { throw new Error('Printing unavailable') } })
  await page.getByRole('button', { name: 'Print answer key', exact: true }).click()
  await expect(page.getByText('Could not open printing: Printing unavailable')).toBeVisible()
  await expect(page.getByLabel('Rows', { exact: true })).toBeEnabled()
  await expect(page.locator('.print-root .solution-sheet')).toHaveCount(0)
})

for (const format of ['A4', 'Letter'] as const) {
  for (const [rows, columns] of [[4, 4], [20, 16], [24, 24], [4, 24], [24, 4]]) {
    for (const mode of ['puzzle', 'solution'] as const) {
      test(`${format} ${rows}x${columns} ${mode} fits one readable page`, async ({ page }, testInfo) => {
        await setup(page, rows, columns)
        await startPrint(page, mode)
        await page.emulateMedia({ media: 'print' })
        const sheet = page.locator('.print-root .worksheet')
        const bounds = await sheet.boundingBox()
        expect(bounds!.width).toBeLessThanOrEqual(681)
        expect(bounds!.height).toBeLessThanOrEqual(245 * 96 / 25.4)
        if (mode === 'puzzle') {
          const cell = await sheet.locator('.math-grid td').first().boundingBox()
          expect(Math.abs(cell!.width - cell!.height)).toBeLessThan(0.5)
          const metrics = await sheet.locator('.math-grid td').evaluateAll(cells => cells.map(cell => {
            const span = cell.querySelector('span')!
            return { font: Number.parseFloat(getComputedStyle(cell).fontSize), cell: cell.getBoundingClientRect().width, text: span.getBoundingClientRect().width }
          }))
          expect(metrics.every(value => value.font >= 13.33 && value.text < value.cell - 1)).toBe(true)
        }
        const keyFits = await sheet.locator('.color-key td').evaluateAll(cells => cells.every(cell => cell.scrollWidth <= cell.clientWidth))
        expect(keyFits).toBe(true)
        const expectedProblems = await sheet.locator('.math-grid td').allTextContents()
        const expectedColors = await sheet.locator('.color-key td').evaluateAll(cells => cells.map(cell => cell.getAttribute('data-color')!))
        if (rows === 24 && columns === 24) expect(expectedColors).toHaveLength(8)
        const pdf = await page.pdf({ format, printBackground: false, displayHeaderFooter: false, path: testInfo.outputPath('worksheet.pdf') })
        const loadingTask = getDocument({ data: new Uint8Array(pdf), useSystemFonts: true })
        const document = await loadingTask.promise
        try {
          expect(document.numPages).toBe(1)
          const first = await document.getPage(1)
          const expectedSize = format === 'A4' ? [595.28, 841.89] : [612, 792]
          expect(Math.abs(first.view[2] - expectedSize[0])).toBeLessThan(2)
          expect(Math.abs(first.view[3] - expectedSize[1])).toBeLessThan(2)
          const content = await first.getTextContent()
          const strings = content.items.flatMap(item => 'str' in item ? [item.str] : [])
          const text = strings.join(' ')
          expect(text).toContain('Color key')
          for (const color of expectedColors) expect(text).toContain(color)
          if (mode === 'puzzle') {
            expect(text).not.toContain('Answer key')
            expect(text.match(/[1-9]\+[1-9]/g)).toEqual(expectedProblems)
          } else {
            expect(text).toContain('Answer key')
            expect(text).not.toMatch(/[1-9]\+[1-9]/)
          }
          for (const item of content.items) {
            if ('str' in item && item.str.trim()) {
              expect(item.transform[4]).toBeGreaterThanOrEqual(0)
              expect(item.transform[5]).toBeGreaterThanOrEqual(0)
              expect(item.transform[4] + item.width).toBeLessThanOrEqual(first.view[2])
              expect(item.transform[5]).toBeLessThanOrEqual(first.view[3])
            }
          }
        } finally {
          await loadingTask.destroy()
        }
      })
    }
  }
}
