import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { CRAYON_REFERENCE, CRAYON_SET_IDS, CRAYON_SETS } from '../src/domain/crayonSets'
import { colorDistance, rgbToLab, toHex } from '../src/domain/color'
import { worksheetLayout } from '../src/domain/layout'
import type { Puzzle } from '../src/domain/puzzle'
import type { ImageDiagnostics } from '../src/image/process'
import { catalogs } from '../src/i18n/locale'
import { imageFile } from './fixtures'

interface Report {
  puzzle: Puzzle
  diagnostics: ImageDiagnostics
  colorSet: typeof CRAYON_REFERENCE & { id: string; colors: readonly { id: string; name: string }[] }
  stages: { sampled: string; quantized: string; solution: string }
}

async function report(page: Page, label: string): Promise<Report> {
  const downloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: label, exact: true }).click()
  const download = await downloadEvent
  return JSON.parse(await readFile((await download.path())!, 'utf8'))
}

for (const set of CRAYON_SET_IDS) {
  test(`${set} constrains output through reduction and merging, and respects math capacity`, async ({ page }) => {
    const t = catalogs.en
    await page.goto('/')
    await page.getByText(t.advanced, { exact: true }).click()
    await expect(page.getByLabel(t.outputColorSet, { exact: true })).toHaveValue('image')
    await page.getByLabel(t.outputColorSet, { exact: true }).selectOption(set)
    await page.getByText(t.viewCrayonColors(CRAYON_SETS[set].colors.length), { exact: true }).click()
    await expect(page.locator('.crayon-colors li')).toHaveCount(CRAYON_SETS[set].colors.length)
    await page.getByLabel(t.maxColors, { exact: true }).fill('16')
    await page.getByLabel(t.choosePicture).setInputFiles(await imageFile(page, { manyColors: true }))
    const allowed = new Map(CRAYON_SETS[set].colors.map(color => [toHex(color.rgb), color.id]))
    for (const merge of [false, true]) {
      await page.getByLabel(t.mergeSimilarColors, { exact: true }).setChecked(merge)
      await page.getByRole('button', { name: t.create, exact: true }).click()
      await expect(page.getByRole('button', { name: t.downloadDebug })).toBeEnabled()
      const data = await report(page, t.downloadDebug)
      expect(data.puzzle.settings.outputColorSet).toBe(set)
      expect(data.puzzle.palette.length).toBeLessThanOrEqual(16)
      expect(new Set(data.puzzle.assignments).size).toBe(data.puzzle.palette.length)
      data.puzzle.palette.forEach((rgb, index) => {
        expect(allowed.has(toHex(rgb))).toBe(true)
        if (merge) data.puzzle.palette.slice(index + 1).forEach(other => {
          expect(colorDistance(rgbToLab(rgb), rgbToLab(other))).toBeGreaterThanOrEqual(25)
        })
      })
      data.puzzle.key.forEach(entry => expect(entry.crayonId).toBe(allowed.get(entry.hex)))
      expect(data.colorSet.id).toBe(set)
      expect(data.colorSet.membershipSource).toBe(CRAYON_REFERENCE.membershipSource)
      expect(data.diagnostics).toMatchObject({
        pipelineVersion: '3', outputColorSet: set, colorSetVersion: '1',
        paletteColorIds: data.puzzle.palette.map(rgb => allowed.get(toHex(rgb))),
      })
      expect(data.stages.sampled).not.toBe(data.stages.quantized)
      await page.getByRole('button', { name: t.solution, exact: true }).click()
      const visible = await page.locator('.app-shell .color-preview rect').evaluateAll(cells => cells.map(cell => cell.getAttribute('fill')))
      expect(visible).toEqual(data.puzzle.assignments.map(index => toHex(data.puzzle.palette[index])))
    }
    await page.getByLabel(t.maxOperand, { exact: true }).fill('2')
    await expect(page.getByRole('button', { name: t.printPuzzle })).toBeDisabled()
    await page.getByRole('button', { name: t.create, exact: true }).click()
    const limited = await report(page, t.downloadDebug)
    expect(limited.diagnostics.effectiveMaximumColors).toBe(3)
    expect(limited.puzzle.palette.length).toBeLessThanOrEqual(3)
    await page.getByLabel(t.maxResult, { exact: true }).fill('1')
    await expect(page.getByRole('button', { name: t.create, exact: true })).toBeDisabled()
    await expect(page.getByText(t.noResults, { exact: true })).toBeVisible()
  })
}

for (const language of ['en', 'zh-TW'] as const) {
  test(`${language} crayon labels survive language changes, stale settings, and both printed keys`, async ({ page }, testInfo) => {
    const t = catalogs[language]
    await page.goto('/')
    await page.locator('#language').selectOption(language)
    await page.getByText(t.advanced, { exact: true }).click()
    await page.getByLabel(t.outputColorSet, { exact: true }).selectOption('crayola-48')
    await page.getByLabel(t.autoSize, { exact: true }).uncheck()
    await page.getByLabel(t.columns, { exact: true }).fill('8')
    await page.getByLabel(t.rows, { exact: true }).fill('8')
    await page.getByLabel(t.maxColors, { exact: true }).fill('16')
    const colors = CRAYON_SETS['crayola-48'].colors.filter(color => [
      'purple-mountains-majesty', 'macaroni-and-cheese', 'granny-smith-apple', 'white',
    ].includes(color.id))
    const dataUrl = await page.evaluate(colors => {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 8
      const context = canvas.getContext('2d')!
      for (let index = 0; index < 64; index++) {
        context.fillStyle = colors[index % colors.length]
        context.fillRect(index % 8, Math.floor(index / 8), 1, 1)
      }
      return canvas.toDataURL()
    }, colors.map(color => toHex(color.rgb)))
    await page.getByLabel(t.choosePicture).setInputFiles({
      name: 'named-crayons.png', mimeType: 'image/png', buffer: Buffer.from(dataUrl.split(',')[1], 'base64'),
    })
    await page.getByRole('button', { name: t.create, exact: true }).click()
    const data = await report(page, t.downloadDebug)
    expect(data.diagnostics.appliedAlgorithm).toBe('identity')
    expect(data.puzzle.palette).toHaveLength(4)
    for (const color of colors.filter(color => color.id !== 'white')) {
      await expect(page.locator('.app-shell .color-key')).toContainText(color.name)
    }
    const problems = await page.locator('.app-shell .math-grid td').allTextContents()
    await page.locator('#language').selectOption(language === 'en' ? 'zh-TW' : 'en')
    await expect(page.getByRole('button', { name: catalogs[language === 'en' ? 'zh-TW' : 'en'].printPuzzle })).toBeEnabled()
    expect(await page.locator('.app-shell .math-grid td').allTextContents()).toEqual(problems)
    await page.locator('#language').selectOption(language)
    await page.getByLabel(t.outputColorSet, { exact: true }).selectOption('crayola-16')
    await expect(page.getByRole('button', { name: t.printPuzzle })).toBeDisabled()
    await expect(page.getByRole('button', { name: t.downloadDebug })).toBeDisabled()
    await page.getByLabel(t.outputColorSet, { exact: true }).selectOption('crayola-48')
    await page.getByRole('button', { name: t.create, exact: true }).click()
    await page.evaluate(() => { window.print = () => { document.documentElement.dataset.printCalled = 'yes' } })
    for (const [mode, label] of [['puzzle', t.printPuzzle], ['solution', t.printAnswer]] as const) {
      await page.getByRole('button', { name: label, exact: true }).click()
      await expect(page.locator('html')).toHaveAttribute('data-print-called', 'yes')
      await expect(page.getByLabel(t.outputColorSet, { exact: true })).toBeDisabled()
      await page.emulateMedia({ media: 'print' })
      const sheet = page.locator('.print-root .worksheet')
      expect(await sheet.locator('.color-key td').evaluateAll(cells => cells.every(cell => cell.scrollWidth <= cell.clientWidth))).toBe(true)
      expect(await sheet.locator('.key-entry > span').evaluateAll(labels => labels.every(label => label.scrollWidth <= label.clientWidth))).toBe(true)
      const layout = worksheetLayout(data.puzzle)
      expect((await sheet.boundingBox())!.height * 25.4 / 96).toBeLessThanOrEqual(layout.heightMm)
      const bytes = await page.pdf({ format: 'A4', path: testInfo.outputPath(`${mode}.pdf`) })
      const task = getDocument({ data: new Uint8Array(bytes) })
      const pdf = await task.promise
      try {
        expect(pdf.numPages).toBe(1)
        const first = await pdf.getPage(1)
        const content = await first.getTextContent()
        const text = content.items.flatMap(item => 'str' in item ? [item.str] : []).join(' ').normalize('NFKC').replace(/\s+/g, '')
        for (const color of colors.filter(color => color.id !== 'white')) expect(text).toContain(color.name.replace(/\s+/g, ''))
        expect(text).toContain('Crayola')
        expect(text).toContain(t.leaveWhite.normalize('NFKC').replace(/\s+/g, ''))
      } finally { await task.destroy() }
      await page.evaluate(() => { window.dispatchEvent(new Event('afterprint')); delete document.documentElement.dataset.printCalled })
      await page.emulateMedia({ media: 'screen' })
    }
    await page.getByLabel(t.outputColorSet, { exact: true }).selectOption('image')
    await page.getByRole('button', { name: t.create, exact: true }).click()
    await expect(page.locator('.app-shell .worksheet-crayon-set')).toHaveCount(0)
    const original = await report(page, t.downloadDebug)
    expect(original.diagnostics.pipelineVersion).toBe('2')
    expect(original.diagnostics.paletteChangedCells).toBe(0)
    expect(original.puzzle.key.every(entry => entry.crayonId === undefined)).toBe(true)
    await page.setViewportSize({ width: 375, height: 812 })
    const selector = page.getByLabel(t.outputColorSet, { exact: true })
    await selector.focus()
    await selector.press('ArrowDown')
    await expect(selector).toHaveValue('crayola-16')
    const disclosure = page.getByText(t.viewCrayonColors(16), { exact: true })
    await disclosure.focus()
    await disclosure.press('Enter')
    await expect(page.locator('.crayon-colors')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}

test('crayon matching does not turn pale foreground or enclosed white into skipped background', async ({ page }) => {
  const t = catalogs.en
  await page.goto('/')
  await page.getByText(t.advanced, { exact: true }).click()
  await page.getByLabel(t.outputColorSet, { exact: true }).selectOption('crayola-16')
  await page.getByLabel(t.autoSize, { exact: true }).uncheck()
  await page.getByLabel(t.columns, { exact: true }).fill('4')
  await page.getByLabel(t.rows, { exact: true }).fill('4')
  await page.getByLabel(t.skipBackground, { exact: true }).check()
  const source = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 4
    const context = canvas.getContext('2d')!
    context.fillStyle = '#232323'
    context.fillRect(0, 0, 4, 4)
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, 1, 1)
    context.fillRect(1, 1, 1, 1)
    context.fillStyle = '#efffff'
    context.fillRect(3, 0, 1, 1)
    return canvas.toDataURL()
  })
  await page.getByLabel(t.choosePicture).setInputFiles({
    name: 'background.png', mimeType: 'image/png', buffer: Buffer.from(source.split(',')[1], 'base64'),
  })
  await page.getByRole('button', { name: t.create, exact: true }).click()
  await expect(page.locator('.app-shell td[data-background]')).toHaveCount(1)
  const data = await report(page, t.downloadDebug)
  expect(data.puzzle.cells[3].kind).toBe('problem')
  expect(data.puzzle.cells[5].kind).toBe('problem')
  expect(data.puzzle.palette[data.puzzle.cells[3].colorIndex]).toEqual([255, 255, 255])
  expect(data.puzzle.backgroundCells?.filter(Boolean)).toHaveLength(1)
  await page.getByLabel(t.maxColors, { exact: true }).fill('1')
  await expect(page.getByText(t.oneCrayonHelp, { exact: true })).toBeVisible()
  await page.getByRole('button', { name: t.create, exact: true }).click()
  await expect(page.locator('.app-shell td[data-background]')).toHaveCount(1)
  const limited = await report(page, t.downloadDebug)
  expect(limited.puzzle.palette).toEqual([[255, 255, 255]])
  expect(limited.puzzle.cells.filter(cell => cell.kind === 'problem')).toHaveLength(15)
  await page.getByLabel(t.choosePicture).setInputFiles(await imageFile(page, { width: 4, height: 4, transparent: true }))
  await page.getByRole('button', { name: t.create, exact: true }).click()
  await expect(page.locator('.app-shell td[data-background]')).toHaveCount(16)
  await expect(page.locator('.app-shell .color-key')).toHaveCount(0)
})

test('sixteen named crayons with eight answers each fit the advised larger paper', async ({ page }, testInfo) => {
  const t = catalogs.en
  await page.goto('/')
  await page.getByText(t.advanced, { exact: true }).click()
  await page.getByLabel(t.outputColorSet, { exact: true }).selectOption('crayola-48')
  await page.getByLabel(t.autoSize, { exact: true }).uncheck()
  await page.getByLabel(t.columns, { exact: true }).fill('25')
  await page.getByLabel(t.rows, { exact: true }).fill('28')
  await page.getByLabel(t.maxColors, { exact: true }).fill('16')
  await page.getByLabel(t.maxOperand, { exact: true }).fill('99')
  await page.getByLabel(t.maxResult, { exact: true }).fill('198')
  await page.getByLabel(t.maxResultsPerColor, { exact: true }).fill('8')
  const source = await page.evaluate(colors => {
    const canvas = document.createElement('canvas')
    canvas.width = 25
    canvas.height = 28
    const context = canvas.getContext('2d')!
    for (let index = 0; index < 700; index++) {
      context.fillStyle = colors[index % colors.length]
      context.fillRect(index % 25, Math.floor(index / 25), 1, 1)
    }
    return canvas.toDataURL()
  }, CRAYON_SETS['crayola-48'].colors.slice(32).map(color => toHex(color.rgb)))
  await page.getByLabel(t.choosePicture).setInputFiles({
    name: 'large-key.png', mimeType: 'image/png', buffer: Buffer.from(source.split(',')[1], 'base64'),
  })
  await page.getByRole('button', { name: t.create, exact: true }).click()
  const data = await report(page, t.downloadDebug)
  expect(data.puzzle.key).toHaveLength(16)
  expect(data.puzzle.key.every(entry => entry.results.length === 8)).toBe(true)
  const layout = worksheetLayout(data.puzzle)
  expect(layout.needsLargerPaper).toBe(true)
  await expect(page.getByText(t.largerPaper(layout.paperWidthMm, layout.paperHeightMm), { exact: true })).toBeVisible()
  await page.evaluate(() => { window.print = () => { document.documentElement.dataset.printCalled = 'yes' } })
  await page.getByRole('button', { name: t.printPuzzle, exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-print-called', 'yes')
  await page.emulateMedia({ media: 'print' })
  const sheet = page.locator('.print-root .worksheet')
  expect(await sheet.locator('.color-key td').evaluateAll(cells => cells.every(cell => cell.scrollWidth <= cell.clientWidth))).toBe(true)
  expect((await sheet.boundingBox())!.height * 25.4 / 96).toBeLessThanOrEqual(layout.heightMm)
  const bytes = await page.pdf({
    width: `${layout.paperWidthMm}mm`, height: `${layout.paperHeightMm}mm`, path: testInfo.outputPath('large-key.pdf'),
  })
  const task = getDocument({ data: new Uint8Array(bytes) })
  const pdf = await task.promise
  try {
    expect(pdf.numPages).toBe(1)
    const content = await (await pdf.getPage(1)).getTextContent()
    const text = content.items.flatMap(item => 'str' in item ? [item.str] : []).join(' ')
    expect(text).toContain("Purple Mountains' Majesty")
    expect(text).toContain('Macaroni and Cheese')
    data.puzzle.key.forEach(entry => expect(text).toContain(entry.hex))
  } finally { await task.destroy() }
})
