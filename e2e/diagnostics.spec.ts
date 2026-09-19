import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import pica from 'pica'
import { catalogs } from '../src/i18n/locale'
import type { ImageDiagnostics } from '../src/image/process'
import type { Puzzle } from '../src/domain/puzzle'
import { imageFile } from './fixtures'

interface Bundle {
  schemaVersion: number
  source: { name: string; type: string; size: number; width: number; height: number; dataUrl: string }
  diagnostics: ImageDiagnostics
  settings: Puzzle['settings']
  puzzle: Puzzle
  stats: { sampledColorCount: number; paletteColorCount: number; paletteChangedCells: number; backgroundWhitenedCells: number }
  stages: { sampled: string; quantized: string; solution: string }
}

async function bundle(page: Page, label = catalogs.en.downloadDebug): Promise<Bundle> {
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: label, exact: true }).click()
  const download = await downloaded
  expect(download.suggestedFilename()).toBe('mathdraw-debug.json')
  return JSON.parse(await readFile((await download.path())!, 'utf8'))
}

async function pngPixels(page: Page, dataUrl: string) {
  return page.evaluate(async dataUrl => {
    const image = new Image()
    image.src = dataUrl
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const context = canvas.getContext('2d')!
    context.drawImage(image, 0, 0)
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
    return {
      width: canvas.width, height: canvas.height,
      colors: Array.from({ length: data.length / 4 }, (_, index) => [data[index * 4], data[index * 4 + 1], data[index * 4 + 2]]),
    }
  }, dataUrl)
}

test('preserves pale 22x24 artwork and exports the original plus exact processing stages', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel(catalogs.en.autoSize).uncheck()
  await page.getByLabel(catalogs.en.columns, { exact: true }).fill('22')
  await page.getByLabel(catalogs.en.rows, { exact: true }).fill('24')
  await page.getByText('Advanced', { exact: true }).click()
  await expect(page.getByLabel(catalogs.en.resizeAlgorithm)).toHaveValue('pica')
  await expect(page.getByLabel(catalogs.en.mergeSimilarColors, { exact: true })).not.toBeChecked()
  const fixture = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 22
    canvas.height = 24
    const context = canvas.getContext('2d')!
    const colors = ['#ffffff', '#e6e6e6', '#f0e1e1', '#f5f5f5']
    const expected = Array.from({ length: 528 }, (_, index) => colors[(Math.floor(index / 22) + index % 22) % colors.length])
    expected.forEach((color, index) => {
      context.fillStyle = color
      context.fillRect(index % 22, Math.floor(index / 22), 1, 1)
    })
    return { dataUrl: canvas.toDataURL(), expected }
  })
  const bytes = Buffer.from(fixture.dataUrl.split(',')[1], 'base64')
  await page.getByLabel(catalogs.en.choosePicture).setInputFiles({ name: 'pale.png', mimeType: 'image/png', buffer: bytes })
  await page.getByRole('button', { name: catalogs.en.create, exact: true }).click()
  await expect(page.locator('.app-shell .math-grid td')).toHaveCount(528)
  const problems = await page.locator('.app-shell .math-grid td').allTextContents()
  await page.getByRole('button', { name: 'Solution', exact: true }).click()
  expect(await page.locator('.app-shell .color-preview rect').evaluateAll(cells => cells.map(cell => cell.getAttribute('fill')))).toEqual(fixture.expected)
  await expect(page.locator('#debug-help')).toContainText('original image')
  const report = await bundle(page)
  expect(report.schemaVersion).toBe(1)
  expect(report.source).toMatchObject({ name: 'pale.png', type: 'image/png', size: bytes.length, width: 22, height: 24 })
  expect(Buffer.from(report.source.dataUrl.split(',')[1], 'base64')).toEqual(bytes)
  expect(report.diagnostics.appliedAlgorithm).toBe('identity')
  expect(report.stats).toEqual({ sampledColorCount: 4, paletteColorCount: 4, paletteChangedCells: 0, backgroundWhitenedCells: 0 })
  expect(report.puzzle.cells.map(cell => cell.kind === 'problem' ? `${cell.a}${cell.operator}${cell.b}` : '')).toEqual(problems)
  const sampled = await pngPixels(page, report.stages.sampled)
  expect(sampled).toEqual({ width: 22, height: 24, colors: report.diagnostics.sampledColors })
  expect(await pngPixels(page, report.stages.quantized)).toEqual(sampled)
  expect(await pngPixels(page, report.stages.solution)).toEqual(sampled)
  for (const algorithm of ['nearest', 'browser', 'foreground']) {
    await page.getByLabel(catalogs.en.resizeAlgorithm).selectOption(algorithm)
    await page.getByRole('button', { name: catalogs.en.create, exact: true }).click()
    const identity = await bundle(page)
    expect(identity.diagnostics.requestedAlgorithm).toBe(algorithm)
    expect(identity.diagnostics.appliedAlgorithm).toBe('identity')
    expect(identity.stats.paletteChangedCells).toBe(0)
    expect(identity.diagnostics.sampledColors).toEqual(report.diagnostics.sampledColors)
  }
  await page.getByLabel(catalogs.en.resizeAlgorithm).selectOption('pica')
  await page.getByLabel(catalogs.en.mergeSimilarColors, { exact: true }).check()
  await expect(page.getByRole('button', { name: catalogs.en.downloadDebug })).toBeDisabled()
  await page.getByRole('button', { name: catalogs.en.create, exact: true }).click()
  const merged = await bundle(page)
  expect(merged.settings.mergeSimilarColors).toBe(true)
  expect(merged.stats.paletteColorCount).toBe(1)
  expect(merged.stats.paletteChangedCells).toBe(396)
  expect(merged.diagnostics.sampledColors).toEqual(report.diagnostics.sampledColors)
  expect(merged.puzzle.palette).toEqual([[255, 255, 255]])
})

test('default Pica really applies MKS2013 directly to the grid, and alternatives retain their own sampling', async ({ page }) => {
  await page.goto('/')
  const fixture = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 16
    const context = canvas.getContext('2d')!
    const data = context.createImageData(16, 16)
    for (let index = 0; index < 256; index++) {
      const x = index % 16
      const y = Math.floor(index / 16)
      data.data.set([x * 15, y * 15, (x + y) * 7, 255], index * 4)
    }
    context.putImageData(data, 0, 0)
    return { dataUrl: canvas.toDataURL(), rgba: Array.from(data.data) }
  })
  await page.getByLabel(catalogs.en.autoSize).uncheck()
  await page.getByLabel(catalogs.en.rows, { exact: true }).fill('8')
  await page.getByLabel(catalogs.en.columns, { exact: true }).fill('8')
  await page.getByLabel(catalogs.en.choosePicture).setInputFiles({ name: 'gradient.png', mimeType: 'image/png', buffer: Buffer.from(fixture.dataUrl.split(',')[1], 'base64') })
  await page.getByRole('button', { name: catalogs.en.create, exact: true }).click()
  const report = await bundle(page)
  const expected = await pica({ features: ['js'] }).resizeBuffer({ src: new Uint8Array(fixture.rgba), width: 16, height: 16, toWidth: 8, toHeight: 8, filter: 'mks2013' })
  const rgb = Array.from({ length: 64 }, (_, index) => Array.from(expected.slice(index * 4, index * 4 + 3)))
  expect(report.diagnostics.appliedAlgorithm).toBe('pica')
  expect(report.diagnostics.sampledColors).toEqual(rgb)
  expect(report.puzzle.palette.length).toBeLessThanOrEqual(8)
  await page.getByText(catalogs.en.advanced, { exact: true }).click()
  for (const algorithm of ['nearest', 'browser', 'foreground']) {
    await page.getByLabel(catalogs.en.resizeAlgorithm).selectOption(algorithm)
    await expect(page.getByRole('button', { name: catalogs.en.printPuzzle })).toBeDisabled()
    await page.getByRole('button', { name: catalogs.en.create, exact: true }).click()
    const alternative = await bundle(page)
    expect(alternative.settings.resizeAlgorithm).toBe(algorithm)
    expect(alternative.diagnostics.appliedAlgorithm).toBe(algorithm)
    expect(alternative.diagnostics.sampledColors).toHaveLength(64)
    if (algorithm === 'nearest') expect(alternative.diagnostics.sampledColors).not.toEqual(rgb)
  }
})

test('Taiwan controls and bundle isolate background whitening and enforce math palette capacity', async ({ page }) => {
  await page.goto('/')
  await page.locator('#language').selectOption('zh-TW')
  const t = catalogs['zh-TW']
  await page.getByText(t.advanced, { exact: true }).click()
  await expect(page.getByLabel(t.resizeAlgorithm)).toHaveValue('pica')
  const nearWhite = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 4
    const context = canvas.getContext('2d')!
    context.fillStyle = '#f5f8fa'
    context.fillRect(0, 0, 4, 4)
    return canvas.toDataURL().split(',')[1]
  })
  await page.getByLabel(t.choosePicture).setInputFiles({ name: 'near-white.png', mimeType: 'image/png', buffer: Buffer.from(nearWhite, 'base64') })
  await page.getByLabel(t.skipBackground, { exact: true }).check()
  await page.getByRole('button', { name: t.create, exact: true }).click()
  const report = await bundle(page, t.downloadDebug)
  expect(report.stats.paletteChangedCells).toBe(0)
  expect(report.stats.backgroundWhitenedCells).toBe(625)
  expect((await pngPixels(page, report.stages.quantized)).colors.every(rgb => JSON.stringify(rgb) === '[245,248,250]')).toBe(true)
  expect((await pngPixels(page, report.stages.solution)).colors.every(rgb => JSON.stringify(rgb) === '[255,255,255]')).toBe(true)
  expect(report.puzzle.cells.every(cell => cell.kind === 'background')).toBe(true)
  await page.getByLabel(t.choosePicture).setInputFiles(await imageFile(page, { palette: true }))
  await expect(page.getByRole('button', { name: t.downloadDebug })).toBeDisabled()
  await page.getByLabel(t.maxOperand, { exact: true }).fill('2')
  await page.getByRole('button', { name: t.create, exact: true }).click()
  const limited = await bundle(page, t.downloadDebug)
  expect(limited.puzzle.palette.length).toBeLessThanOrEqual(3)
  expect(limited.diagnostics.effectiveMaximumColors).toBe(3)
  expect(limited.settings.maxColors).toBe(8)
  await page.getByLabel(t.choosePicture).setInputFiles([])
  await expect(page.getByRole('button', { name: t.downloadDebug })).toBeDisabled()
})

for (const rejectOld of [false, true]) {
  test(`replacing an image discards a stale asynchronous resize (failure=${rejectOld})`, async ({ page }) => {
    await page.addInitScript(rejectOld => {
      window.createImageBitmap = new Proxy(window.createImageBitmap, {
        apply(target, receiver, args) {
          const result: Promise<ImageBitmap> = Reflect.apply(target, receiver, args)
          if (!(args[0] instanceof ImageBitmap) || document.documentElement.dataset.clonePending) return result
          document.documentElement.dataset.clonePending = 'yes'
          return result.then(bitmap => new Promise<ImageBitmap>((resolve, reject) => {
            window.addEventListener('release-clone', () => {
              if (rejectOld) {
                bitmap.close()
                reject(new Error('Simulated old resize failure'))
              } else resolve(bitmap)
            }, { once: true })
          })).finally(() => { document.documentElement.dataset.cloneSettled = 'yes' })
        },
      })
    }, rejectOld)
    await page.goto('/')
    await page.getByLabel(catalogs.en.choosePicture).setInputFiles(await imageFile(page))
    await page.getByRole('button', { name: catalogs.en.create, exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('data-clone-pending', 'yes')
    await page.getByLabel(catalogs.en.choosePicture).setInputFiles(await imageFile(page, { transparent: true, width: 60, height: 60 }))
    await page.getByRole('button', { name: catalogs.en.create, exact: true }).click()
    await expect(page.locator('.app-shell .math-grid td')).toHaveCount(625)
    await page.evaluate(() => window.dispatchEvent(new Event('release-clone')))
    await expect(page.locator('html')).toHaveAttribute('data-clone-settled', 'yes')
    const report = await bundle(page)
    expect(report.source).toMatchObject({ width: 60, height: 60 })
    expect(report.puzzle.palette).toEqual([[255, 255, 255]])
    await expect(page.getByText(catalogs.en.generationFailed, { exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: catalogs.en.printPuzzle })).toBeEnabled()
  })
}

test('active resize and debug-encoding failures are visible and generation can recover', async ({ page }) => {
  await page.addInitScript(() => {
    window.createImageBitmap = new Proxy(window.createImageBitmap, {
      apply(target, receiver, args) {
        if (args[0] instanceof ImageBitmap && !document.documentElement.dataset.failedClone) {
          document.documentElement.dataset.failedClone = 'yes'
          return Promise.reject(new Error('Simulated active resize failure'))
        }
        return Reflect.apply(target, receiver, args)
      },
    })
  })
  await page.goto('/')
  await page.getByLabel(catalogs.en.choosePicture).setInputFiles(await imageFile(page))
  await page.getByRole('button', { name: catalogs.en.create, exact: true }).click()
  await expect(page.getByText(catalogs.en.generationFailed, { exact: true })).toBeVisible()
  await page.getByRole('button', { name: catalogs.en.create, exact: true }).click()
  await expect(page.getByRole('button', { name: catalogs.en.downloadDebug })).toBeEnabled()
  await page.evaluate(() => { HTMLCanvasElement.prototype.toDataURL = () => { throw new Error('Simulated PNG encoding failure') } })
  await page.getByRole('button', { name: catalogs.en.downloadDebug }).click()
  await expect(page.getByText(catalogs.en.debugFailed, { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: catalogs.en.downloadDebug })).toBeEnabled()
})

test('Pica handles transparent colored edges without dark fringes and processes tiled sources locally', async ({ page }) => {
  const external: string[] = []
  page.on('request', request => {
    if (/^https?:/.test(request.url()) && new URL(request.url()).hostname !== '127.0.0.1') external.push(request.url())
  })
  await page.goto('/')
  const transparent = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 64
    const context = canvas.getContext('2d')!
    context.fillStyle = '#ff0000'
    context.fillRect(16, 16, 32, 32)
    return canvas.toDataURL().split(',')[1]
  })
  await page.getByLabel(catalogs.en.choosePicture).setInputFiles({ name: 'transparent-red.png', mimeType: 'image/png', buffer: Buffer.from(transparent, 'base64') })
  await page.getByRole('button', { name: catalogs.en.create, exact: true }).click()
  const report = await bundle(page)
  expect(report.diagnostics.appliedAlgorithm).toBe('pica')
  expect(report.diagnostics.sampledColors.every(rgb => rgb[0] === 255)).toBe(true)
  expect(report.diagnostics.sampledColors).toContainEqual([255, 255, 255])
  expect(report.diagnostics.sampledColors).toContainEqual([255, 0, 0])
  expect(report.diagnostics.sampledColors.some(rgb => rgb[1] > 0 && rgb[1] < 255)).toBe(true)
  await page.getByLabel(catalogs.en.choosePicture).setInputFiles(await imageFile(page, { width: 2050, height: 1026 }))
  await page.getByRole('button', { name: catalogs.en.create, exact: true }).click()
  const large = await bundle(page)
  expect(large.source).toMatchObject({ width: 2050, height: 1026 })
  expect(large.diagnostics.sampledColors).toHaveLength(325)
  expect(large.diagnostics.appliedAlgorithm).toBe('pica')
  expect(large.diagnostics.sampledColors[0][0]).toBeGreaterThan(200)
  expect(large.diagnostics.sampledColors[24][2]).toBeGreaterThan(180)
  expect(external).toEqual([])
})

test('non-local hosting hides debug download and its help while puzzle generation still works', async ({ page }) => {
  await page.route('http://mathdraw.invalid/**', async route => {
    const url = new URL(route.request().url())
    url.host = '127.0.0.1:4173'
    await route.fulfill({ response: await route.fetch({ url: url.href }) })
  })
  await page.goto('http://mathdraw.invalid/')
  await page.getByLabel(catalogs.en.choosePicture).setInputFiles(await imageFile(page))
  await page.getByRole('button', { name: catalogs.en.create, exact: true }).click()
  await expect(page.getByRole('button', { name: catalogs.en.printPuzzle })).toBeEnabled()
  await expect(page.getByRole('button', { name: catalogs.en.downloadDebug })).toHaveCount(0)
  await expect(page.locator('#debug-help')).toHaveCount(0)
  await page.locator('#language').selectOption('zh-TW')
  await expect(page.getByRole('button', { name: catalogs['zh-TW'].downloadDebug })).toHaveCount(0)
  await expect(page.locator('#processing-summary')).toBeVisible()
})
