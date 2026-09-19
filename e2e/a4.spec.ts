import { expect, test } from '@playwright/test'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { catalogs } from '../src/i18n/locale'

for (const language of ['en', 'zh-TW'] as const) {
  for (const colors of [5, 8]) {
    for (const mode of ['puzzle', 'solution'] as const) {
      test(`A4 25 columns by 28 rows: ${language}, ${colors} colors, ${mode}`, async ({ page }, testInfo) => {
        await page.goto('/')
        await page.locator('#language').selectOption(language)
        const t = catalogs[language]
        const base64 = await page.evaluate(colors => {
          const canvas = document.createElement('canvas')
          canvas.width = 25
          canvas.height = 28
          const context = canvas.getContext('2d')!
          const palette = ['#ffffff', '#000000', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff']
          for (let index = 0; index < 700; index++) {
            context.fillStyle = palette[index % colors]
            context.fillRect(index % 25, Math.floor(index / 25), 1, 1)
          }
          return canvas.toDataURL().split(',')[1]
        }, colors)
        await page.getByLabel(t.choosePicture).setInputFiles({ name: 'a4.png', mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') })
        await expect(page.getByLabel(t.columns, { exact: true })).toHaveValue('25')
        await expect(page.getByLabel(t.rows, { exact: true })).toHaveValue('28')
        await expect(page.getByText(t.widerGrid)).toHaveCount(0)
        await expect(page.getByText(t.tallerGrid)).toHaveCount(0)
        await page.getByRole('button', { name: t.create, exact: true }).click()
        await expect(page.locator('.app-shell .math-grid td')).toHaveCount(700)
        await expect(page.locator('.app-shell .color-key td')).toHaveCount(colors)
        await expect(page.locator('.preview .stale-notice')).toHaveCount(0)
        await expect(page.getByText(t.onePage, { exact: false })).toBeVisible()
        const problems = await page.locator('.app-shell .math-grid td').allTextContents()
        await page.evaluate(() => { window.print = () => { document.documentElement.dataset.printCalled = 'yes' } })
        await page.getByRole('button', { name: mode === 'puzzle' ? t.printPuzzle : t.printAnswer, exact: true }).click()
        await expect(page.locator('html')).toHaveAttribute('data-print-called', 'yes')
        await page.emulateMedia({ media: 'print' })
        await page.evaluate(() => document.fonts.ready.then(() => undefined))
        const sheet = page.locator('.print-root .worksheet')
        const bounds = (await sheet.boundingBox())!
        expect(bounds.width * 25.4 / 96).toBeCloseTo(187.5, 1)
        expect(bounds.height * 25.4 / 96).toBeLessThanOrEqual(277)
        if (mode === 'puzzle') {
          const metrics = await sheet.locator('.math-grid td').evaluateAll(cells => cells.map(cell => ({
            width: cell.getBoundingClientRect().width, height: cell.getBoundingClientRect().height,
            font: Number.parseFloat(getComputedStyle(cell).fontSize),
          })))
          expect(metrics.every(cell => cell.width >= 28 && cell.font >= 13.33 && Math.abs(cell.width - cell.height) < .5)).toBe(true)
        } else await expect(sheet.locator('.color-preview rect')).toHaveCount(700)
        const expectedColors = await sheet.locator('.color-key td').evaluateAll(cells => cells.map(cell => cell.getAttribute('data-color')!))
        const bytes = await page.pdf({ format: 'A4', displayHeaderFooter: false, path: testInfo.outputPath('a4.pdf') })
        const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true })
        try {
          const pdf = await task.promise
          expect(pdf.numPages).toBe(1)
          const first = await pdf.getPage(1)
          const content = await first.getTextContent()
          const text = content.items.flatMap(item => 'str' in item ? [item.str] : []).join(' ')
          expect(text.match(/[1-9]\+[1-9]/g) ?? []).toEqual(mode === 'puzzle' ? problems : [])
          for (const color of expectedColors) expect(text).toContain(color)
          for (const item of content.items) {
            if ('str' in item && item.str.trim()) {
              expect(item.transform[4]).toBeGreaterThanOrEqual(0)
              expect(item.transform[5]).toBeGreaterThanOrEqual(0)
              expect(item.transform[4] + item.width).toBeLessThanOrEqual(first.view[2] + .5)
              expect(item.transform[5]).toBeLessThanOrEqual(first.view[3])
            }
          }
        } finally { await task.destroy() }
      })
    }
  }
}

test('A4 advisory warnings begin at 26 columns or 29 rows in both languages', async ({ page }) => {
  await page.goto('/')
  for (const language of ['en', 'zh-TW'] as const) {
    const t = catalogs[language]
    await page.locator('#language').selectOption(language)
    await page.getByLabel(t.autoSize).uncheck()
    await page.getByLabel(t.columns, { exact: true }).fill('25')
    await page.getByLabel(t.rows, { exact: true }).fill('28')
    await expect(page.getByText(t.widerGrid)).toHaveCount(0)
    await expect(page.getByText(t.tallerGrid)).toHaveCount(0)
    await page.getByLabel(t.columns, { exact: true }).fill('26')
    await page.getByLabel(t.rows, { exact: true }).fill('29')
    await expect(page.getByText(t.widerGrid)).toBeVisible()
    await expect(page.getByText(t.tallerGrid)).toBeVisible()
  }
})
