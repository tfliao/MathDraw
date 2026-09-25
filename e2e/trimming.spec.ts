import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { catalogs } from '../src/i18n/locale'
import { rotateJpegClockwise } from './fixtures'

async function borderedImage(page: Page, options: { width?: number; height?: number; type?: string; transparent?: boolean; empty?: boolean } = {}) {
  const type = options.type ?? 'image/png'
  const data = await page.evaluate(({ width = 100, height = 80, type = 'image/png', transparent = false, empty = false }) => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')!
    if (!transparent) {
      context.fillStyle = '#f0f0f0'
      context.fillRect(0, 0, width, height)
    }
    if (!empty) {
      context.fillStyle = '#ff0000'
      context.fillRect(30, 10, 20, 40)
      context.fillStyle = '#0000ff'
      context.fillRect(35, 20, 10, 20)
    }
    return canvas.toDataURL(type).split(',')[1]
  }, options)
  return { name: type === 'image/jpeg' ? 'border.jpg' : 'border.png', mimeType: type, buffer: Buffer.from(data, 'base64') }
}

async function previewDimensions(page: Page) {
  return page.locator('.source-preview').evaluate(image => ({
    width: (image as HTMLImageElement).naturalWidth, height: (image as HTMLImageElement).naturalHeight,
  }))
}

for (const language of ['en', 'zh-TW'] as const) {
  test(`live trim preview, reversible dimensions and auto/manual sizing in ${language}`, async ({ page }) => {
    const t = catalogs[language]
    await page.goto('/')
    await page.locator('#language').selectOption(language)
    await expect(page.getByLabel(t.trimMargins, { exact: true })).not.toBeChecked()
    const file = await borderedImage(page)
    await page.getByLabel(t.choosePicture).setInputFiles(file)
    await expect(page.locator('#image-dimensions')).toHaveText(t.imageDimensions(100, 80))
    await expect(page.locator('#trimmed-dimensions')).toHaveCount(0)
    expect(await previewDimensions(page)).toEqual({ width: 100, height: 80 })
    await page.getByRole('button', { name: t.create, exact: true }).click()
    await expect(page.getByRole('button', { name: t.printPuzzle, exact: true })).toBeEnabled()
    await page.getByLabel(t.trimMargins, { exact: true }).check()
    await expect(page.getByRole('button', { name: t.printPuzzle, exact: true })).toBeDisabled()
    await expect(page.locator('#trimmed-dimensions')).toHaveText(t.trimmedDimensions(20, 40))
    await expect(page.locator('#image-dimensions')).toHaveText(t.imageDimensions(100, 80))
    expect(await previewDimensions(page)).toEqual({ width: 20, height: 40 })
    await expect(page.getByRole('img', { name: t.trimmedPicture(file.name), exact: true })).toBeVisible()
    await expect(page.getByLabel(t.columns, { exact: true })).toHaveValue('14')
    await expect(page.getByLabel(t.rows, { exact: true })).toHaveValue('28')
    await page.getByLabel(t.autoSize).uncheck()
    await page.getByLabel(t.columns, { exact: true }).fill('20')
    await page.getByLabel(t.rows, { exact: true }).fill('40')
    await page.getByRole('button', { name: t.create, exact: true }).click()
    await expect(page.locator('.app-shell .math-grid td')).toHaveCount(800)
    await page.getByRole('button', { name: t.solution, exact: true }).click()
    const fills = await page.locator('.app-shell .color-preview rect').evaluateAll(cells => cells.map(cell => cell.getAttribute('fill')))
    expect(fills).toEqual(Array.from({ length: 800 }, (_, i) => i % 20 >= 5 && i % 20 < 15 && Math.floor(i / 20) >= 10 && Math.floor(i / 20) < 30 ? '#0000ff' : '#ff0000'))
    const downloaded = page.waitForEvent('download')
    await page.getByRole('button', { name: t.downloadDebug, exact: true }).click()
    const report = JSON.parse(await readFile((await (await downloaded).path())!, 'utf8'))
    expect(Buffer.from(report.source.dataUrl.split(',')[1], 'base64')).toEqual(file.buffer)
    expect(report.source).toMatchObject({ width: 100, height: 80 })
    expect(report.diagnostics).toMatchObject({
      inputWidth: 20, inputHeight: 40, appliedAlgorithm: 'identity',
      trim: { enabled: true, noForeground: false, bounds: { x: 30, y: 10, width: 20, height: 40 } },
    })
    await page.evaluate(() => { window.print = () => { document.documentElement.dataset.printCalled = 'yes' } })
    await page.getByRole('button', { name: t.printAnswer, exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('data-print-called', 'yes')
    await expect(page.getByLabel(t.trimMargins, { exact: true })).toBeDisabled()
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')))
    await page.getByLabel(t.trimMargins, { exact: true }).uncheck()
    await expect(page.locator('#trimmed-dimensions')).toHaveCount(0)
    await expect(page.getByRole('img', { name: t.originalPicture(file.name), exact: true })).toBeVisible()
    expect(await previewDimensions(page)).toEqual({ width: 100, height: 80 })
    await expect(page.getByLabel(t.columns, { exact: true })).toHaveValue('20')
    await expect(page.getByLabel(t.rows, { exact: true })).toHaveValue('40')
    await expect(page.getByRole('button', { name: t.downloadDebug, exact: true })).toBeDisabled()
    await page.getByLabel(t.choosePicture).setInputFiles([])
    await expect(page.locator('.source-preview')).toHaveCount(0)
    await expect(page.locator('#image-dimensions')).toHaveCount(0)
  })
}

test('upload with trimming already enabled handles transparency, empty images, failure and recovery', async ({ page }) => {
  const t = catalogs.en
  await page.goto('/')
  await page.getByLabel(t.trimMargins, { exact: true }).check()
  await page.getByLabel(t.choosePicture).setInputFiles(await borderedImage(page, { transparent: true }))
  await expect(page.locator('#trimmed-dimensions')).toHaveText(t.trimmedDimensions(20, 40))
  for (const transparent of [true, false]) {
    await page.getByLabel(t.choosePicture).setInputFiles(await borderedImage(page, { transparent, empty: true }))
    await expect(page.locator('#trimmed-dimensions')).toHaveText(t.trimmedDimensions(100, 80))
    await expect(page.getByText(t.nothingToTrim, { exact: true })).toBeVisible()
    await page.getByRole('button', { name: t.create, exact: true }).click()
    await expect(page.getByRole('button', { name: t.printPuzzle, exact: true })).toBeEnabled()
  }
  await page.getByLabel(t.choosePicture).setInputFiles({ name: 'bad.png', mimeType: 'image/png', buffer: Buffer.from('invalid') })
  await expect(page.locator('#image-error')).toHaveText(t.decodeFailed)
  await expect(page.locator('#trimmed-dimensions')).toHaveCount(0)
  await expect(page.getByText(t.nothingToTrim, { exact: true })).toHaveCount(0)
  await page.getByLabel(t.choosePicture).setInputFiles(await borderedImage(page))
  await expect(page.locator('#trimmed-dimensions')).toHaveText(t.trimmedDimensions(20, 40))
  await expect(page.locator('#image-error')).toBeEmpty()
})

test('classifies alpha against white, keeps one-pixel subjects, and crosses tile boundaries exactly', async ({ page }) => {
  const t = catalogs.en
  await page.goto('/')
  await page.getByLabel(t.trimMargins, { exact: true }).check()
  for (const single of [true, false]) {
    const data = await page.evaluate(single => {
      const canvas = document.createElement('canvas')
      canvas.width = 1100
      canvas.height = 700
      const context = canvas.getContext('2d')!
      const pixels = context.createImageData(1100, 700)
      // Alpha 15 black composites to 240: background. Alpha 16 becomes 239: foreground.
      pixels.data.set([0, 0, 0, 15], 0)
      pixels.data.set([0, 0, 0, 16], (511 * 1100 + 510) * 4)
      if (!single) pixels.data.set([239, 255, 255, 255], (600 * 1100 + 1025) * 4)
      context.putImageData(pixels, 0, 0)
      return canvas.toDataURL().split(',')[1]
    }, single)
    await page.getByLabel(t.choosePicture).setInputFiles({ name: 'edges.png', mimeType: 'image/png', buffer: Buffer.from(data, 'base64') })
    await expect(page.locator('#trimmed-dimensions')).toHaveText(t.trimmedDimensions(single ? 1 : 516, single ? 1 : 90))
    if (single) {
      await expect(page.getByLabel(t.columns, { exact: true })).toHaveValue('25')
      await expect(page.getByLabel(t.rows, { exact: true })).toHaveValue('25')
      await page.getByRole('button', { name: t.create, exact: true }).click()
      await expect(page.getByRole('button', { name: t.printPuzzle, exact: true })).toBeEnabled()
    }
  }
})

test('trimming uses EXIF-oriented dimensions, not raw JPEG orientation', async ({ page }) => {
  const t = catalogs.en
  await page.goto('/')
  const file = rotateJpegClockwise(await borderedImage(page, { type: 'image/jpeg' }))
  // Lossy JPEG can alter boundary colors: derive the reference from the decoded bitmap.
  const reference = await page.evaluate(async base64 => {
    const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0))
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }), { imageOrientation: 'from-image' })
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext('2d')!
    context.fillStyle = 'white'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0)
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
    let left = canvas.width, right = -1, top = canvas.height, bottom = -1
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] >= 240 && data[i + 1] >= 240 && data[i + 2] >= 240) continue
      const x = i / 4 % canvas.width, y = Math.floor(i / 4 / canvas.width)
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y)
    }
    bitmap.close()
    return { width: right - left + 1, height: bottom - top + 1 }
  }, file.buffer.toString('base64'))
  await page.getByLabel(t.trimMargins, { exact: true }).check()
  await page.getByLabel(t.choosePicture).setInputFiles(file)
  await expect(page.locator('#image-dimensions')).toHaveText(t.imageDimensions(80, 100))
  await expect(page.locator('#trimmed-dimensions')).toHaveText(t.trimmedDimensions(reference.width, reference.height))
})

test('turning trimming off during a pending crop discards and disposes the stale crop', async ({ page }) => {
  const t = catalogs.en
  await page.goto('/')
  await page.evaluate(() => {
    const original = window.createImageBitmap
    window.createImageBitmap = new Proxy(original, {
      apply(target, receiver, args) {
        const result: Promise<ImageBitmap> = Reflect.apply(target, receiver, args)
        if (args.length < 5 || document.documentElement.dataset.cropPending) return result
        return result.then(bitmap => {
          const close = bitmap.close.bind(bitmap)
          bitmap.close = () => { close(); document.documentElement.dataset.cropClosed = 'yes' }
          document.documentElement.dataset.cropPending = 'yes'
          return new Promise<ImageBitmap>(resolve => document.addEventListener('finish-crop', () => resolve(bitmap), { once: true }))
        })
      },
    })
  })
  await page.getByLabel(t.trimMargins, { exact: true }).check()
  await page.getByLabel(t.choosePicture).setInputFiles(await borderedImage(page))
  await expect(page.locator('html')).toHaveAttribute('data-crop-pending', 'yes')
  await expect(page.getByRole('button', { name: t.create, exact: true })).toBeDisabled()
  await page.getByLabel(t.trimMargins, { exact: true }).uncheck()
  await expect(page.getByRole('img', { name: t.originalPicture('border.png'), exact: true })).toBeVisible()
  await page.evaluate(() => document.dispatchEvent(new Event('finish-crop')))
  await expect(page.locator('html')).toHaveAttribute('data-crop-closed', 'yes')
  await expect(page.locator('#trimmed-dimensions')).toHaveCount(0)
  await expect(page.locator('#image-dimensions')).toHaveText(t.imageDimensions(100, 80))
  await expect(page.locator('#image-error')).toBeEmpty()
  await page.getByLabel(t.trimMargins, { exact: true }).check()
  await expect(page.locator('#trimmed-dimensions')).toHaveText(t.trimmedDimensions(20, 40))
})

test('toggling during decode and replacing the upload use only the latest image and option', async ({ page }) => {
  const t = catalogs.en
  await page.goto('/')
  const file = await borderedImage(page)
  await page.evaluate(() => {
    window.createImageBitmap = new Proxy(window.createImageBitmap, {
      apply(target, receiver, args) {
        const result: Promise<ImageBitmap> = Reflect.apply(target, receiver, args)
        if (!(args[0] instanceof File) || document.documentElement.dataset.decodePending) return result
        document.documentElement.dataset.decodePending = 'yes'
        return result.then(bitmap => {
          const close = bitmap.close.bind(bitmap)
          bitmap.close = () => { close(); document.documentElement.dataset.oldClosed = 'yes' }
          return new Promise<ImageBitmap>(resolve => document.addEventListener('finish-decode', () => resolve(bitmap), { once: true }))
        })
      },
    })
  })
  await page.getByLabel(t.choosePicture).setInputFiles(file)
  await expect(page.locator('html')).toHaveAttribute('data-decode-pending', 'yes')
  await page.getByLabel(t.trimMargins, { exact: true }).check()
  await expect(page.locator('#trimmed-dimensions')).toHaveText(t.trimmedDimensions(20, 40))
  await page.getByLabel(t.choosePicture).setInputFiles({ ...await borderedImage(page, { width: 200, height: 120, empty: true }), name: 'latest.png' })
  await expect(page.locator('#trimmed-dimensions')).toHaveText(t.trimmedDimensions(200, 120))
  await page.evaluate(() => document.dispatchEvent(new Event('finish-decode')))
  await expect(page.locator('html')).toHaveAttribute('data-old-closed', 'yes')
  await expect(page.getByRole('img', { name: t.trimmedPicture('latest.png'), exact: true })).toBeVisible()
  await expect(page.locator('#image-error')).toBeEmpty()
})

test('all resizing modes use the crop and preserve aspect-fit margins for a mismatched manual grid', async ({ page }) => {
  const t = catalogs.en
  await page.setViewportSize({ width: 375, height: 800 })
  await page.goto('/')
  await page.getByLabel(t.trimMargins, { exact: true }).check()
  await page.getByLabel(t.choosePicture).setInputFiles(await borderedImage(page))
  await expect(page.locator('#trimmed-dimensions')).toHaveText(t.trimmedDimensions(20, 40))
  await page.getByLabel(t.autoSize).uncheck()
  await page.getByLabel(t.columns, { exact: true }).fill('20')
  await page.getByLabel(t.rows, { exact: true }).fill('20')
  await page.getByText(t.advanced, { exact: true }).click()
  for (const algorithm of ['pica', 'nearest', 'browser', 'foreground']) {
    await page.getByLabel(t.resizeAlgorithm).selectOption(algorithm)
    await page.getByRole('button', { name: t.create, exact: true }).click()
    await expect(page.locator('.app-shell .math-grid td')).toHaveCount(400)
    await page.getByRole('button', { name: t.solution, exact: true }).click()
    const fills = await page.locator('.app-shell .color-preview rect').evaluateAll(cells => cells.map(cell => cell.getAttribute('fill')))
    fills.forEach((fill, index) => {
      const column = index % 20
      if (column < 5 || column >= 15) expect(fill).toBe('#ffffff')
      else expect(fill).not.toBe('#ffffff')
    })
    await expect(page.getByLabel(t.columns, { exact: true })).toHaveValue('20')
    await expect(page.getByLabel(t.rows, { exact: true })).toHaveValue('20')
  }
  const preview = await page.locator('.source-preview').getAttribute('src')
  await page.locator('#language').selectOption('zh-TW')
  await expect(page.locator('.source-preview')).toHaveAttribute('src', preview!)
  await expect(page.locator('#trimmed-dimensions')).toHaveText(catalogs['zh-TW'].trimmedDimensions(20, 40))
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
})

test('crop errors do not silently use an untrimmed image and toggling off can recover', async ({ page }) => {
  const t = catalogs.en
  await page.goto('/')
  await page.getByLabel(t.choosePicture).setInputFiles(await borderedImage(page))
  await expect(page.locator('.source-preview')).toBeVisible()
  await page.evaluate(() => {
    window.createImageBitmap = new Proxy(window.createImageBitmap, {
      apply(target, receiver, args) {
        if (args.length >= 5) return Promise.reject(new Error('Simulated crop failure'))
        return Reflect.apply(target, receiver, args)
      },
    })
  })
  await page.getByLabel(t.trimMargins, { exact: true }).check()
  await expect(page.locator('#image-error')).toHaveText(t.loadFailed)
  await expect(page.locator('.source-preview')).toHaveCount(0)
  await expect(page.getByRole('button', { name: t.create, exact: true })).toBeDisabled()
  await page.getByLabel(t.trimMargins, { exact: true }).uncheck()
  await expect(page.locator('#image-dimensions')).toHaveText(t.imageDimensions(100, 80))
  await expect(page.getByRole('button', { name: t.create, exact: true })).toBeEnabled()
  await expect(page.locator('#image-error')).toBeEmpty()
})
