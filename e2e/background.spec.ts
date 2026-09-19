import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { imageFile } from './fixtures'
import { catalogs } from '../src/i18n/locale'

async function ringImage(page: Page) {
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 112
    const context = canvas.getContext('2d')!
    context.fillStyle = '#f5f8fa'
    context.fillRect(0, 0, 112, 112)
    context.fillStyle = '#000000'
    context.fillRect(16, 16, 80, 80)
    context.fillStyle = '#f5f8fa'
    context.fillRect(32, 32, 48, 48)
    return canvas.toDataURL('image/png').split(',')[1]
  })
  return { name: 'ring.png', mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') }
}

for (const language of ['en', 'zh-TW'] as const) {
  test.describe(`background and result limits in ${language}`, () => {
    test.use({ locale: language })

    test('skips only the border, keeps eight used results per active color, and prints both views', async ({ page }, testInfo) => {
      const t = catalogs[language]
      await page.goto('/')
      await expect(page.getByLabel(t.skipBackground, { exact: true })).not.toBeChecked()
      await page.getByLabel(t.autoSize, { exact: true }).uncheck()
      await page.getByLabel(t.columns, { exact: true }).fill('7')
      await page.getByLabel(t.rows, { exact: true }).fill('7')
      await page.getByLabel(t.choosePicture).setInputFiles(await ringImage(page))
      await page.getByLabel(t.skipBackground, { exact: true }).check()
      await page.getByText(t.advanced, { exact: true }).click()
      await expect(page.getByLabel(t.maxResultsPerColor, { exact: true })).toHaveValue('3')
      await page.getByLabel(t.maxResultsPerColor, { exact: true }).fill('8')
      await page.getByRole('button', { name: t.create, exact: true }).click()
      const grid = page.locator('.app-shell .math-grid')
      await expect(grid.locator('td')).toHaveCount(49)
      await expect(grid.locator('td[data-background]')).toHaveCount(24)
      const problems = await grid.locator('td').allTextContents()
      problems.forEach((problem, index) => {
        const row = Math.floor(index / 7)
        const column = index % 7
        if (row === 0 || row === 6 || column === 0 || column === 6) expect(problem).toBe('')
        else expect(problem).toMatch(/^[1-9]\+[1-9]$/)
      })
      await expect(grid.locator('td').first()).toHaveAttribute('aria-label', t.backgroundCell)
      await expect(page.locator('.app-shell .worksheet-instructions')).toContainText(t.backgroundInstructions)
      const key = await page.locator('.app-shell .color-key td').evaluateAll(cells => cells.map(cell => ({
        results: cell.getAttribute('data-results')!.split(',').map(Number),
        color: cell.getAttribute('data-color')!,
      })))
      expect(key).toHaveLength(2)
      expect(key.every(entry => entry.results.length === 8)).toBe(true)
      expect(new Set(key.flatMap(entry => entry.results)).size).toBe(16)
      const used = problems.filter(Boolean).map(problem => problem.split('+').map(Number).reduce((a, b) => a + b))
      expect(new Set(used)).toEqual(new Set(key.flatMap(entry => entry.results)))

      await page.getByRole('button', { name: t.solution, exact: true }).click()
      const fills = await page.locator('.app-shell .color-preview rect').evaluateAll(cells => cells.map(cell => cell.getAttribute('fill')))
      problems.forEach((problem, index) => {
        if (!problem) expect(fills[index]).toBe('#ffffff')
        else {
          const result = problem.split('+').map(Number).reduce((a, b) => a + b)
          expect(fills[index]).toBe(key.find(entry => entry.results.includes(result))?.color)
        }
      })
      expect(fills[24]).toBe('#ffffff')
      await page.getByRole('button', { name: t.puzzle, exact: true }).click()
      expect(await grid.locator('td').allTextContents()).toEqual(problems)

      await page.evaluate(() => {
        window.print = () => { document.documentElement.dataset.printCalled = 'yes' }
      })
      for (const mode of ['puzzle', 'solution'] as const) {
        await page.getByRole('button', { name: mode === 'puzzle' ? t.printPuzzle : t.printAnswer, exact: true }).click()
        await expect(page.locator('html')).toHaveAttribute('data-print-called', 'yes')
        await expect(page.getByLabel(t.skipBackground, { exact: true })).toBeDisabled()
        await expect(page.getByLabel(t.maxResultsPerColor, { exact: true })).toBeDisabled()
        await page.emulateMedia({ media: 'print' })
        const sheet = page.locator('.print-root .worksheet')
        if (mode === 'puzzle') {
          expect(await sheet.locator('.math-grid td').allTextContents()).toEqual(problems)
          await expect(sheet.locator('td[data-background]')).toHaveCount(24)
        } else {
          expect(await sheet.locator('.color-preview rect').evaluateAll(cells => cells.map(cell => cell.getAttribute('fill')))).toEqual(fills)
        }
        expect(await sheet.locator('.color-key td').evaluateAll(cells => cells.every(cell => cell.scrollWidth <= cell.clientWidth))).toBe(true)
        const bytes = await page.pdf({ format: 'A4', printBackground: false, path: testInfo.outputPath(`${language}-${mode}-background.pdf`) })
        const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true })
        try {
          const pdf = await task.promise
          expect(pdf.numPages).toBe(1)
          const first = await pdf.getPage(1)
          const content = await first.getTextContent()
          const text = content.items.flatMap(item => 'str' in item ? [item.str] : []).join(' ')
          const compact = (value: string) => value.normalize('NFKC').replace(/\s+/g, '')
          expect(compact(text)).toContain(compact(t.backgroundInstructions))
          for (const entry of key) {
            expect(text).toContain(entry.color)
            for (const result of entry.results) expect(text).toMatch(new RegExp(`\\b${result}\\b`))
          }
          expect(text.match(/[1-9]\+[1-9]/g) ?? []).toEqual(mode === 'puzzle' ? problems.filter(Boolean) : [])
          for (const item of content.items) {
            if ('str' in item && item.str.trim()) {
              expect(item.transform[4]).toBeGreaterThanOrEqual(0)
              expect(item.transform[4] + item.width).toBeLessThanOrEqual(first.view[2] + .5)
              expect(item.transform[5]).toBeGreaterThanOrEqual(0)
              expect(item.transform[5]).toBeLessThanOrEqual(first.view[3])
            }
          }
        } finally { await task.destroy() }
        await page.evaluate(() => {
          window.dispatchEvent(new Event('afterprint'))
          delete document.documentElement.dataset.printCalled
        })
        await page.emulateMedia({ media: 'screen' })
      }
      await page.getByLabel(t.skipBackground, { exact: true }).uncheck()
      await expect(page.getByRole('button', { name: t.printPuzzle, exact: true })).toBeDisabled()
      expect(await grid.locator('td').allTextContents()).toEqual(problems)
      await page.getByRole('button', { name: t.create, exact: true }).click()
      await expect(grid.locator('td[data-background]')).toHaveCount(0)
      expect((await grid.locator('td').allTextContents()).every(Boolean)).toBe(true)
    })
  })
}

test('validates result caps, limits scarce answers, and preserves the cap when multi-map is off', async ({ page }) => {
  const t = catalogs.en
  await page.goto('/')
  await page.getByLabel(t.choosePicture).setInputFiles(await imageFile(page))
  await page.getByText(t.advanced, { exact: true }).click()
  const cap = page.getByLabel(t.maxResultsPerColor, { exact: true })
  for (const value of ['', '0', '9', '2.5']) {
    await cap.fill(value)
    await expect(page.getByRole('button', { name: t.create, exact: true })).toBeDisabled()
    await expect(page.locator('#results-per-color-error')).toHaveText(t.wholeNumber(1, 8))
  }
  await page.locator('#language').selectOption('zh-TW')
  await expect(page.locator('#results-per-color-error')).toHaveText(catalogs['zh-TW'].wholeNumber(1, 8))
  await page.locator('#language').selectOption('en')
  await cap.fill('8')
  await page.getByLabel(t.maxOperand, { exact: true }).fill('2')
  await page.getByRole('button', { name: t.create, exact: true }).click()
  const entries = page.locator('.app-shell .color-key td')
  await expect(entries).toHaveCount(2)
  const results = await entries.evaluateAll(cells => cells.flatMap(cell => cell.getAttribute('data-results')!.split(',').map(Number)))
  expect(results).toHaveLength(3)
  expect(new Set(results)).toEqual(new Set([2, 3, 4]))
  await page.getByLabel(t.multiMap, { exact: true }).uncheck()
  await expect(page.getByRole('button', { name: t.printPuzzle, exact: true })).toBeDisabled()
  await page.getByRole('button', { name: t.create, exact: true }).click()
  expect(await entries.evaluateAll(cells => cells.every(cell => cell.getAttribute('data-results')!.split(',').length === 1))).toBe(true)
  await expect(cap).toHaveValue('8')
  await page.getByLabel(t.multiMap, { exact: true }).check()
  await cap.fill('1')
  await page.getByRole('button', { name: t.create, exact: true }).click()
  expect(await entries.evaluateAll(cells => cells.every(cell => cell.getAttribute('data-results')!.split(',').length === 1))).toBe(true)
})

test('all-background grids omit unused keys, explain the empty activity, and print with finite dimensions', async ({ page }, testInfo) => {
  const t = catalogs.en
  await page.goto('/')
  await page.getByLabel(t.choosePicture).setInputFiles(await imageFile(page, { transparent: true, width: 80, height: 80 }))
  await page.getByLabel(t.skipBackground, { exact: true }).check()
  await page.getByRole('button', { name: t.create, exact: true }).click()
  await expect(page.locator('.app-shell .math-grid td[data-background]')).toHaveCount(576)
  await expect(page.locator('.app-shell .color-key')).toHaveCount(0)
  await expect(page.locator('.app-shell .worksheet-instructions')).toHaveText(t.allBackground)
  await page.locator('#language').selectOption('zh-TW')
  await expect(page.locator('.app-shell .worksheet-instructions')).toHaveText(catalogs['zh-TW'].allBackground)
  await page.locator('#language').selectOption('en')
  await page.emulateMedia({ media: 'print' })
  const sheet = page.locator('.print-root .worksheet')
  const bounds = (await sheet.boundingBox())!
  expect(Number.isFinite(bounds.width) && Number.isFinite(bounds.height)).toBe(true)
  expect(bounds.width).toBeCloseTo(180 * 96 / 25.4, 0)
  const bytes = await page.pdf({ format: 'A4', printBackground: false, path: testInfo.outputPath('all-background.pdf') })
  const task = getDocument({ data: new Uint8Array(bytes) })
  try {
    const pdf = await task.promise
    expect(pdf.numPages).toBe(1)
    const content = await (await pdf.getPage(1)).getTextContent()
    const text = content.items.flatMap(item => 'str' in item ? [item.str] : []).join(' ')
    expect(text).toContain('only near-white background')
    expect(text).not.toMatch(/[1-9]\+[1-9]/)
    expect(text).not.toContain('Color key')
  } finally { await task.destroy() }
  await page.emulateMedia({ media: 'screen' })
  await page.getByRole('button', { name: t.solution, exact: true }).click()
  expect(await page.locator('.app-shell .color-preview rect').evaluateAll(cells => cells.every(cell => cell.getAttribute('fill') === '#ffffff'))).toBe(true)
  await page.getByLabel(t.skipBackground, { exact: true }).uncheck()
  await page.getByRole('button', { name: t.create, exact: true }).click()
  await expect(page.locator('.app-shell .color-key td')).toHaveCount(1)
  await expect(page.locator('.app-shell .math-grid td[data-background]')).toHaveCount(0)
})
