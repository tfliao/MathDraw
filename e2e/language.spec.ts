import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { SAMPLES_PER_CELL } from '../src/domain/sampling'
import { en } from '../src/i18n/en'
import { zhTW } from '../src/i18n/zh-TW'
import { catalogs, LANGUAGE_STORAGE_KEY } from '../src/i18n/locale'
import type { Language } from '../src/i18n/locale'
import { imageFile } from './fixtures'

async function expectLanguage(page: Page, language: Language) {
  const messages = catalogs[language]
  await expect(page.locator('html')).toHaveAttribute('lang', language)
  await expect(page).toHaveTitle(messages.pageTitle)
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', messages.pageDescription)
  await expect(page.getByRole('combobox', { name: messages.language, exact: true })).toHaveValue(language)
  await expect(page.locator('label[for="language"]')).toBeVisible()
  await expect(page.locator('#language option')).toHaveText(['English', '繁體中文（台灣）'])
  await expect(page.getByRole('button', { name: messages.create, exact: true })).toBeVisible()
}

async function createManualPuzzle(page: Page, language: Language, rows = 8, columns = 8) {
  const messages = catalogs[language]
  await page.getByLabel(messages.autoSize, { exact: true }).uncheck()
  await page.getByLabel(messages.choosePicture, { exact: true }).setInputFiles(
    await imageFile(page, { width: columns * SAMPLES_PER_CELL, height: rows * SAMPLES_PER_CELL, palette: true }),
  )
  await page.getByLabel(messages.rows, { exact: true }).fill(String(rows))
  await page.getByLabel(messages.columns, { exact: true }).fill(String(columns))
  await page.getByRole('button', { name: messages.create, exact: true }).click()
  await expect(page.getByRole('button', { name: messages.printPuzzle, exact: true })).toBeEnabled()
}

async function keyData(page: Page, root = '.app-shell') {
  return page.locator(`${root} .color-key td`).evaluateAll(cells => cells.map(cell => ({
    results: cell.getAttribute('data-results'),
    color: cell.getAttribute('data-color'),
  })))
}

async function settingsData(page: Page) {
  return page.locator('.setup input').evaluateAll(inputs => inputs.map(element => {
    const input = element as HTMLInputElement
    return { id: input.id, type: input.type, value: input.value, checked: input.checked }
  }))
}

async function startPrint(page: Page, mode: 'puzzle' | 'solution') {
  await page.evaluate(() => {
    delete document.documentElement.dataset.printCalled
    window.print = () => { document.documentElement.dataset.printCalled = 'yes' }
  })
  await page.getByRole('button', { name: mode === 'puzzle' ? zhTW.printPuzzle : zhTW.printAnswer, exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-print-called', 'yes')
  await expect(page.locator('#language')).toBeDisabled()
}

async function finishPrint(page: Page) {
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')))
  await page.emulateMedia({ media: 'screen' })
  await expect(page.locator('#language')).toBeEnabled()
}

for (const { locale, expected } of [
  { locale: 'zh-TW', expected: 'zh-TW' as const },
  { locale: 'en-GB', expected: 'en' as const },
  { locale: 'fr-FR', expected: 'en' as const },
]) {
  test.describe(`browser preference ${locale}`, () => {
    test.use({ locale })
    test('detects the language without saving an implicit choice', async ({ page }) => {
      await page.goto('/')
      await expectLanguage(page, expected)
      expect(await page.evaluate(key => localStorage.getItem(key), LANGUAGE_STORAGE_KEY)).toBeNull()
    })
  })
}

test('uses the first supported navigator.languages entry before navigator.language', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'languages', { configurable: true, get: () => ['fr-FR', 'zh-HK', 'en-US'] })
    Object.defineProperty(navigator, 'language', { configurable: true, get: () => 'en-US' })
  })
  await page.goto('/')
  await expectLanguage(page, 'zh-TW')
})

test('uses navigator.language when navigator.languages is empty', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'languages', { configurable: true, get: () => [] })
    Object.defineProperty(navigator, 'language', { configurable: true, get: () => 'zh-TW' })
  })
  await page.goto('/')
  await expectLanguage(page, 'zh-TW')
})

test.describe('explicit language preference', () => {
  test.use({ locale: 'zh-TW' })

  test('persists both explicit choices across reloads and overrides the browser', async ({ page }) => {
    await page.goto('/')
    await expectLanguage(page, 'zh-TW')
    await page.locator('#language').selectOption('en')
    await expectLanguage(page, 'en')
    expect(await page.evaluate(key => localStorage.getItem(key), LANGUAGE_STORAGE_KEY)).toBe('en')
    await page.reload()
    await expectLanguage(page, 'en')
    await page.locator('#language').selectOption('zh-TW')
    expect(await page.evaluate(key => localStorage.getItem(key), LANGUAGE_STORAGE_KEY)).toBe('zh-TW')
    await page.reload()
    await expectLanguage(page, 'zh-TW')
  })

  test('ignores an unsupported stored preference', async ({ page }) => {
    await page.addInitScript(key => localStorage.setItem(key, 'fr-FR'), LANGUAGE_STORAGE_KEY)
    await page.goto('/')
    await expectLanguage(page, 'zh-TW')
  })
})

test('switching language preserves the generated puzzle, settings, image, view and print readiness', async ({ page }) => {
  await page.goto('/')
  await page.getByText(en.advanced, { exact: true }).click()
  await page.getByLabel(en.maxOperand, { exact: true }).fill('7')
  await page.getByLabel(en.maxResult, { exact: true }).fill('13')
  await page.getByLabel(en.multiMap, { exact: true }).uncheck()
  await page.getByLabel(en.allowZero, { exact: true }).check()
  await createManualPuzzle(page, 'en')
  const problems = await page.locator('.app-shell .math-grid td').allTextContents()
  const key = await keyData(page)
  const settings = await settingsData(page)
  const source = await page.locator('.source-preview').getAttribute('src')
  expect(problems).toHaveLength(64)
  expect(key).toHaveLength(8)
  await page.getByRole('button', { name: en.solution, exact: true }).click()
  const colors = await page.locator('.app-shell .color-preview rect').evaluateAll(rects => rects.map(rect => rect.getAttribute('fill')))
  await page.locator('#language').selectOption('zh-TW')
  await expectLanguage(page, 'zh-TW')
  await expect(page.getByRole('button', { name: zhTW.solution, exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('img', { name: zhTW.originalPicture('picture.png'), exact: true })).toHaveAttribute('src', source!)
  await expect(page.getByRole('img', { name: zhTW.pixelPicture(8, 8, 8), exact: true })).toBeVisible()
  expect(await settingsData(page)).toEqual(settings)
  expect(await keyData(page)).toEqual(key)
  expect(await page.locator('.app-shell .color-preview rect').evaluateAll(rects => rects.map(rect => rect.getAttribute('fill')))).toEqual(colors)
  await expect(page.locator('.app-shell .worksheet-instructions')).toHaveText(zhTW.answerInstructions)
  await expect(page.locator('.app-shell .color-key')).toContainText(zhTW.leaveWhite)
  await expect(page.locator('.app-shell .color-key')).toContainText(zhTW.colorNumber(2))
  await expect(page.locator('.app-shell .color-key')).not.toContainText(en.leaveWhite)
  await expect(page.getByText(zhTW.stale, { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: zhTW.printPuzzle, exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: zhTW.printAnswer, exact: true })).toBeEnabled()
  expect(await page.locator('.print-root .math-grid td').allTextContents()).toEqual(problems)

  await startPrint(page, 'solution')
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('.print-root .worksheet')).toHaveAttribute('aria-label', zhTW.answerWorksheet)
  await expect(page.locator('.print-root h2')).toHaveText(zhTW.answerTitle)
  await expect(page.locator('.print-root .worksheet-instructions')).toHaveText(zhTW.answerInstructions)
  expect(await keyData(page, '.print-root')).toEqual(key)
  expect(await page.locator('.print-root .color-preview rect').evaluateAll(rects => rects.map(rect => rect.getAttribute('fill')))).toEqual(colors)
  await finishPrint(page)

  await page.getByRole('button', { name: zhTW.puzzle, exact: true }).click()
  await expect(page.getByRole('table', { name: zhTW.additionGrid(8, 8), exact: true })).toBeVisible()
  expect(await page.locator('.app-shell .math-grid td').allTextContents()).toEqual(problems)
  await expect(page.locator('.app-shell .name-line')).toHaveText(zhTW.nameLine)
  await page.locator('#language').selectOption('en')
  await expect(page.getByRole('button', { name: en.puzzle, exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.app-shell .color-key')).toContainText(en.leaveWhite)
  expect(await page.locator('.app-shell .math-grid td').allTextContents()).toEqual(problems)
  expect(await keyData(page)).toEqual(key)
  await expect(page.getByRole('button', { name: en.printPuzzle, exact: true })).toBeEnabled()
})

test('mixed-operator worksheet instructions and accessible names translate without replacing arithmetic', async ({ page }) => {
  await page.goto('/')
  await page.getByText(en.advanced, { exact: true }).click()
  await page.getByLabel(en.multiplication, { exact: true }).check()
  await createManualPuzzle(page, 'en')
  const problems = await page.locator('.app-shell .math-grid td').allTextContents()
  await page.locator('#language').selectOption('zh-TW')
  await expect(page.getByRole('table', { name: zhTW.mathGrid(8, 8), exact: true })).toBeVisible()
  await expect(page.getByLabel(zhTW.multiplication, { exact: true })).toBeChecked()
  for (const root of ['.app-shell', '.print-root']) {
    await expect(page.locator(`${root} .worksheet h2`)).toHaveText(zhTW.mathTitle)
    await expect(page.locator(`${root} .worksheet-instructions`)).toHaveText(`${zhTW.mathInstructions} ${zhTW.multiplyHelp}`)
    expect(await page.locator(`${root} .math-grid td`).allTextContents()).toEqual(problems)
  }
})

test('existing validation errors translate without losing invalid settings or making a stale puzzle printable', async ({ page }) => {
  await page.goto('/')
  await createManualPuzzle(page, 'en')
  const problems = await page.locator('.app-shell .math-grid td').allTextContents()
  await page.getByLabel(en.rows, { exact: true }).fill('3')
  await page.getByText(en.advanced, { exact: true }).click()
  await page.getByLabel(en.maxOperand, { exact: true }).fill('1')
  await expect(page.locator('#rows-error')).toHaveText(en.wholeNumber(4, 64))
  await expect(page.getByText(en.wholeNumber(2, 99), { exact: true })).toBeVisible()
  await page.locator('#language').selectOption('zh-TW')
  await expect(page.locator('#rows-error')).toHaveText(zhTW.wholeNumber(4, 64))
  await expect(page.getByText(zhTW.wholeNumber(2, 99), { exact: true })).toBeVisible()
  await expect(page.getByLabel(zhTW.rows, { exact: true })).toHaveValue('3')
  await expect(page.getByLabel(zhTW.maxOperand, { exact: true })).toHaveValue('1')
  await expect(page.getByRole('button', { name: zhTW.create, exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: zhTW.printPuzzle, exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: zhTW.printAnswer, exact: true })).toBeDisabled()
  await expect(page.getByText(zhTW.stale, { exact: true })).toBeVisible()
  expect(await page.locator('.app-shell .math-grid td').allTextContents()).toEqual(problems)
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('.print-unavailable')).toHaveText(zhTW.printUnavailable)
  await expect(page.locator('.print-root .worksheet')).toHaveCount(0)
})

test('an existing corrupt-image error translates in both directions and recovers', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel(en.choosePicture, { exact: true }).setInputFiles({
    name: 'bad.png', mimeType: 'image/png', buffer: Buffer.from('not a picture'),
  })
  await expect(page.locator('#image-error')).toHaveText(en.decodeFailed)
  await page.locator('#language').selectOption('zh-TW')
  await expect(page.locator('#image-error')).toHaveText(zhTW.decodeFailed)
  await expect(page.getByRole('button', { name: zhTW.create, exact: true })).toBeDisabled()
  await page.locator('#language').selectOption('en')
  await expect(page.locator('#image-error')).toHaveText(en.decodeFailed)
  await page.getByLabel(en.choosePicture, { exact: true }).setInputFiles(await imageFile(page))
  await expect(page.locator('#image-error')).toBeEmpty()
  await expect(page.getByRole('button', { name: en.create, exact: true })).toBeEnabled()
})

for (const failure of ['read-and-write', 'write-only'] as const) {
  test(`unavailable localStorage (${failure}) keeps the app usable with a localized visible notification`, async ({ page }) => {
    const errors: string[] = []
    const warnings: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (message.type() === 'warning') warnings.push(message.text()) })
    await page.addInitScript(mode => {
      if (mode === 'read-and-write') {
        Object.defineProperty(window, 'localStorage', {
          get() { throw new DOMException('Storage disabled', 'SecurityError') },
        })
      } else {
        Storage.prototype.setItem = () => { throw new DOMException('Storage quota exceeded', 'QuotaExceededError') }
      }
    }, failure)
    await page.goto('/')
    await expectLanguage(page, 'en')
    if (failure === 'read-and-write') await expect(page.getByText(en.storageUnavailable, { exact: true })).toBeVisible()
    await page.locator('#language').selectOption('zh-TW')
    await expectLanguage(page, 'zh-TW')
    await expect(page.getByText(zhTW.storageUnavailable, { exact: true })).toBeVisible()
    await createManualPuzzle(page, 'zh-TW', 4, 8)
    await page.reload()
    await expectLanguage(page, 'en')
    expect(warnings.length).toBeGreaterThan(0)
    expect(errors).toEqual([])
  })
}

test.describe('Traditional Chinese worksheets', () => {
  test.use({ locale: 'zh-TW' })

  for (const mode of ['puzzle', 'solution'] as const) {
    test(`${mode} prints a localized, readable single-page A4 PDF`, async ({ page }, testInfo) => {
      await page.goto('/')
      await createManualPuzzle(page, 'zh-TW', 24, 24)
      const problems = await page.locator('.app-shell .math-grid td').allTextContents()
      const key = await keyData(page)
      await startPrint(page, mode)
      await page.emulateMedia({ media: 'print' })
      const sheet = page.locator('.print-root .worksheet')
      await expect(sheet).toBeVisible()
      await expect(sheet.locator('h2')).toHaveText(mode === 'puzzle' ? zhTW.additionTitle : zhTW.answerTitle)
      await expect(sheet.locator('.worksheet-instructions')).toHaveText(mode === 'puzzle' ? zhTW.sumInstructions : zhTW.answerInstructions)
      await expect(sheet.locator('.color-key')).toContainText(zhTW.leaveWhite)
      await expect(sheet.locator('.color-key')).toContainText(zhTW.colorNumber(2))
      const bounds = await sheet.boundingBox()
      expect(bounds!.width).toBeLessThanOrEqual(681)
      expect(bounds!.height).toBeLessThanOrEqual((297 - 20) * 96 / 25.4)
      expect(await sheet.locator('.color-key td').evaluateAll(cells => cells.every(cell => cell.scrollWidth <= cell.clientWidth))).toBe(true)
      if (mode === 'puzzle') {
        const metrics = await sheet.locator('.math-grid td').evaluateAll(cells => cells.map(cell => ({
          font: Number.parseFloat(getComputedStyle(cell).fontSize),
          width: cell.getBoundingClientRect().width,
          height: cell.getBoundingClientRect().height,
          text: cell.querySelector('span')!.getBoundingClientRect().width,
        })))
        expect(metrics.every(cell => cell.font >= 13.33 && Math.abs(cell.width - cell.height) < 0.5 && cell.text < cell.width - 1)).toBe(true)
      }
      await page.evaluate(() => document.fonts.ready.then(() => undefined))
      const pdf = await page.pdf({
        format: 'A4', printBackground: false, displayHeaderFooter: false,
        path: testInfo.outputPath(`zh-TW-${mode}.pdf`),
      })
      const loading = getDocument({ data: new Uint8Array(pdf), useSystemFonts: true })
      try {
        const document = await loading.promise
        expect(document.numPages).toBe(1)
        const first = await document.getPage(1)
        const content = await first.getTextContent()
        const text = content.items.flatMap(item => 'str' in item ? [item.str] : []).join(' ')
        // Font mappings can extract compatibility radicals and split CJK words.
        const compact = text.normalize('NFKC').replace(/\s+/g, '')
        expect(compact).toContain(mode === 'puzzle' ? zhTW.additionTitle : zhTW.answerTitle)
        expect(compact).toContain(zhTW.colorKey)
        expect(compact).toContain(zhTW.leaveWhite)
        expect(compact).not.toContain('Colorkey')
        expect(compact).not.toContain('Leavewhite')
        for (const entry of key) expect(text).toContain(entry.color!)
        if (mode === 'puzzle') {
          expect(text.match(/[1-9]\+[1-9]/g)).toEqual(problems)
        } else {
          expect(text).not.toMatch(/[1-9]\+[1-9]/)
        }
        for (const item of content.items) {
          if ('str' in item && item.str.trim()) {
            expect(item.transform[4]).toBeGreaterThanOrEqual(0)
            expect(item.transform[5]).toBeGreaterThanOrEqual(0)
            expect(item.transform[4] + item.width).toBeLessThanOrEqual(first.view[2] + 0.5)
            expect(item.transform[5]).toBeLessThanOrEqual(first.view[3])
          }
        }
      } finally {
        await loading.destroy()
      }
      await finishPrint(page)
    })
  }

  test('mobile Chinese controls and worksheets do not overflow the page', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 })
    await page.goto('/')
    await expectLanguage(page, 'zh-TW')
    await createManualPuzzle(page, 'zh-TW', 24, 24)
    await page.getByText(zhTW.advanced, { exact: true }).click()
    const region = page.getByRole('region', { name: zhTW.scrollPreview, exact: true })
    await expect(region).toBeVisible()
    const sizes = await region.evaluate(element => ({
      width: element.clientWidth,
      scroll: element.scrollWidth,
      page: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth),
      viewport: window.innerWidth,
    }))
    expect(sizes.scroll).toBeGreaterThan(sizes.width)
    expect(sizes.page).toBeLessThanOrEqual(sizes.viewport)
    await region.focus()
    await expect(region).toBeFocused()
    await page.getByRole('button', { name: zhTW.solution, exact: true }).click()
    expect(await page.evaluate(() => Math.max(document.body.scrollWidth, document.documentElement.scrollWidth))).toBeLessThanOrEqual(375)
  })
})
