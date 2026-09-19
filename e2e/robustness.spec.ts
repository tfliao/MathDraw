import { expect, test } from '@playwright/test'
import { imageFile } from './fixtures'

test('supported formats process entirely locally', async ({ page }) => {
  const external: string[] = []
  page.on('request', request => {
    const url = new URL(request.url())
    if (url.protocol.startsWith('http') && url.hostname !== '127.0.0.1') external.push(request.url())
  })
  await page.goto('/')
  for (const type of ['image/png', 'image/jpeg', 'image/webp']) {
    await page.getByLabel('1. Choose a picture').setInputFiles(await imageFile(page, { type }))
    await page.getByRole('button', { name: 'Create puzzle' }).click()
    await expect(page.getByRole('table', { name: '13 by 25 addition puzzle' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Print puzzle', exact: true })).toBeEnabled()
  }
  expect(external).toEqual([])
})

test('rejects unsupported, empty and oversized inputs with accessible errors', async ({ page }) => {
  await page.goto('/')
  const input = page.getByLabel('1. Choose a picture')
  for (const [name, mimeType, buffer, error] of [
    ['picture.svg', 'image/svg+xml', Buffer.from('<svg/>'), 'Choose a PNG, JPG, or WebP image.'],
    ['empty.png', 'image/png', Buffer.alloc(0), 'This file is empty.'],
    ['large.png', 'image/png', Buffer.alloc(10 * 1024 * 1024 + 1), 'This picture is too large.'],
  ] as const) {
    await input.setInputFiles({ name, mimeType, buffer })
    await expect(page.locator('#image-error')).toContainText(error)
    await expect(input).toHaveAttribute('aria-invalid', 'true')
    await expect(input).toHaveAttribute('aria-describedby', /image-error/)
    await expect(page.getByRole('button', { name: 'Create puzzle' })).toBeDisabled()
  }
})

test('rejects oversized decoded dimensions before creating processing canvases', async ({ page }) => {
  await page.goto('/')
  const file = await imageFile(page)
  await page.evaluate(() => {
    Object.defineProperty(window, 'createImageBitmap', {
      value: async () => ({
        width: 8001, height: 5000,
        close() { document.documentElement.dataset.bitmapClosed = 'yes' },
      }),
    })
    const original = document.createElement.bind(document)
    Object.defineProperty(document, 'createElement', {
      value: (name: string, options?: ElementCreationOptions) => {
        if (name === 'canvas') throw new Error('A processing canvas should not be allocated.')
        return original(name, options)
      },
    })
  })
  await page.getByLabel('1. Choose a picture').setInputFiles(file)
  await expect(page.locator('#image-error')).toContainText('exceeds 40 million pixels')
  await expect(page.locator('html')).toHaveAttribute('data-bitmap-closed', 'yes')
})

test('a late image decode cannot replace a newer selection and releases its bitmap', async ({ page }) => {
  await page.goto('/')
  const slow = { ...await imageFile(page), name: 'slow.png' }
  const latest = { ...await imageFile(page, { transparent: true }), name: 'latest.png' }
  await page.evaluate(() => {
    const original = window.createImageBitmap.bind(window)
    Object.defineProperty(window, 'createImageBitmap', {
      value: async (source: ImageBitmapSource, options?: ImageBitmapOptions) => {
        const bitmap = await original(source, options)
        if (source instanceof File && source.name === 'slow.png') {
          const close = bitmap.close.bind(bitmap)
          bitmap.close = () => { close(); document.documentElement.dataset.staleClosed = 'yes' }
          document.documentElement.dataset.slowReady = 'yes'
          await new Promise<void>(resolve => document.addEventListener('release-decode', () => resolve(), { once: true }))
        }
        return bitmap
      },
    })
  })
  const input = page.getByLabel('1. Choose a picture')
  await input.setInputFiles(slow)
  await expect(page.locator('html')).toHaveAttribute('data-slow-ready', 'yes')
  await expect(page.getByText('Opening your picture...')).toBeVisible()
  await input.setInputFiles(latest)
  await expect(page.getByRole('img', { name: 'Original picture: latest.png' })).toBeVisible()
  await page.evaluate(() => document.dispatchEvent(new Event('release-decode')))
  await expect(page.locator('html')).toHaveAttribute('data-stale-closed', 'yes')
  await expect(page.getByRole('img', { name: 'Original picture: latest.png' })).toBeVisible()
  await page.getByRole('button', { name: 'Create puzzle' }).click()
  await expect(page.locator('.app-shell .color-key td')).toHaveCount(1)
})

test('changing inputs cancels queued generation without overwriting a newer puzzle', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Auto size from picture').uncheck()
  await page.getByLabel('1. Choose a picture').setInputFiles(await imageFile(page))
  await page.evaluate(() => {
    const original = window.setTimeout.bind(window)
    let delayed = false
    Object.defineProperty(window, 'setTimeout', {
      value: (handler: TimerHandler, delay?: number, ...args: unknown[]) => {
        if (delay === 30 && !delayed) {
          delayed = true
          document.documentElement.dataset.generationQueued = 'yes'
          document.addEventListener('release-generation', () => { original(handler, 0, ...args) }, { once: true })
          return 0
        }
        return original(handler, delay, ...args)
      },
    })
  })
  await page.getByRole('button', { name: 'Create puzzle' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-generation-queued', 'yes')
  await expect(page.getByText('Finding colors and making your grid...')).toBeVisible()
  await page.getByLabel('Rows', { exact: true }).fill('4')
  await page.getByLabel('1. Choose a picture').setInputFiles(await imageFile(page, { transparent: true }))
  await page.getByRole('button', { name: 'Create puzzle' }).click()
  await expect(page.getByRole('table', { name: '4 by 16 addition puzzle' })).toBeVisible()
  const problems = await page.locator('.app-shell .math-grid td').allTextContents()
  await page.evaluate(() => document.dispatchEvent(new Event('release-generation')))
  await expect(page.locator('.app-shell .math-grid td')).toHaveText(problems)
  await expect(page.locator('.app-shell .color-key td')).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Print puzzle', exact: true })).toBeEnabled()
})

test('canvas failures are visible and generation can recover', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('1. Choose a picture').setInputFiles(await imageFile(page))
  await expect(page.getByRole('button', { name: 'Create puzzle' })).toBeEnabled()
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.getContext
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { configurable: true, value: () => null })
    document.addEventListener('restore-canvas', () => {
      Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { configurable: true, value: original })
    }, { once: true })
  })
  await page.getByRole('button', { name: 'Create puzzle' }).click()
  await expect(page.getByText('Your browser could not create a drawing canvas.')).toBeVisible()
  await page.evaluate(() => document.dispatchEvent(new Event('restore-canvas')))
  await page.getByRole('button', { name: 'Create puzzle' }).click()
  await expect(page.getByRole('table', { name: '13 by 25 addition puzzle' })).toBeVisible()
})

test('keyboard focus is visible and dimensions report invalid values', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Auto size from picture').uncheck()
  const rows = page.getByLabel('Rows', { exact: true })
  await rows.focus()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('region', { name: 'Scrollable worksheet preview' })).toHaveCount(0)
  await rows.focus()
  const outline = await rows.evaluate(element => getComputedStyle(element).outlineStyle)
  expect(outline).not.toBe('none')
  for (const value of ['', '3', '24.5']) {
    await rows.fill(value)
    await expect(rows).toHaveAttribute('aria-invalid', 'true')
    await expect(page.locator('#rows-error')).toHaveText('Enter a whole number from 4 to 64.')
  }
})
