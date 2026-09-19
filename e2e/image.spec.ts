import { expect, test } from '@playwright/test'
import { imageFile, rotateJpegClockwise } from './fixtures'
import { catalogs } from '../src/i18n/locale'

test('fits the entire image, keeps white margins and limits the palette', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Auto size from picture').uncheck()
  await page.getByLabel('1. Choose a picture').setInputFiles(await imageFile(page))
  await page.getByLabel('Rows', { exact: true }).fill('8')
  await page.getByLabel('Columns', { exact: true }).fill('8')
  await page.getByRole('button', { name: 'Create puzzle' }).click()
  await page.getByRole('button', { name: 'Solution', exact: true }).click()
  const grid = page.getByRole('img', { name: 'Pixel picture with 8 rows, 8 columns and 3 colors' })
  await expect(grid).toBeVisible()
  await expect(grid.locator('rect')).toHaveCount(64)
  await expect(grid.locator('rect').first()).toHaveAttribute('fill', '#ffffff')
  await expect(grid.locator('rect').nth(16)).toHaveAttribute('fill', '#e33632')
  await expect(grid.locator('rect').nth(20)).toHaveAttribute('fill', '#185ec9')
  await page.getByLabel('Rows', { exact: true }).fill('9')
  await expect(page.getByText('Previous puzzle.', { exact: false })).toBeVisible()
})

test('composites transparent pixels onto white', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('1. Choose a picture').setInputFiles(await imageFile(page, { transparent: true }))
  await page.getByRole('button', { name: 'Create puzzle' }).click()
  await page.getByRole('button', { name: 'Solution', exact: true }).click()
  const grid = page.getByRole('img', { name: /Pixel picture/ })
  await expect(grid).toHaveAttribute('aria-label', /1 colors/)
  await expect(grid.locator('rect').first()).toHaveAttribute('fill', '#ffffff')
})

test('reports corrupt input and recovers with a valid picture', async ({ page }) => {
  await page.goto('/')
  const input = page.getByLabel('1. Choose a picture')
  await input.setInputFiles({ name: 'bad.png', mimeType: 'image/png', buffer: Buffer.from('not a picture') })
  await expect(page.getByText('This picture could not be decoded.', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create puzzle' })).toBeDisabled()
  await input.setInputFiles(await imageFile(page))
  await expect(page.getByRole('button', { name: 'Create puzzle' })).toBeEnabled()
  await expect(page.locator('#image-error')).toBeEmpty()
})

test('respects JPEG EXIF orientation before fitting and sampling', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Auto size from picture').uncheck()
  const image = rotateJpegClockwise(await imageFile(page, { type: 'image/jpeg' }))
  await page.getByLabel('1. Choose a picture').setInputFiles(image)
  const preview = page.getByRole('img', { name: 'Original picture: picture.jpg' })
  await expect(preview).toBeVisible()
  await expect(page.locator('#image-dimensions')).toHaveText(catalogs.en.imageDimensions(40, 80))
  expect(await preview.evaluate(element => ({ width: (element as HTMLImageElement).naturalWidth, height: (element as HTMLImageElement).naturalHeight }))).toEqual({ width: 40, height: 80 })
  await page.getByLabel('Rows', { exact: true }).fill('8')
  await page.getByLabel('Columns', { exact: true }).fill('8')
  await page.getByRole('button', { name: 'Create puzzle' }).click()
  await page.getByRole('button', { name: 'Solution', exact: true }).click()
  const cells = page.locator('.app-shell .color-preview rect')
  await expect(cells.first()).toHaveAttribute('fill', '#ffffff')
  const top = (await cells.nth(3).getAttribute('fill'))!
  const bottom = (await cells.nth(59).getAttribute('fill'))!
  expect(Number.parseInt(top.slice(1, 3), 16)).toBeGreaterThan(180)
  expect(Number.parseInt(top.slice(5, 7), 16)).toBeLessThan(100)
  expect(Number.parseInt(bottom.slice(1, 3), 16)).toBeLessThan(100)
  expect(Number.parseInt(bottom.slice(5, 7), 16)).toBeGreaterThan(150)
})

test('uses dominant foreground shades while ignoring near-white samples throughout the puzzle pipeline', async ({ page }) => {
  await page.goto('/')
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 64
    const context = canvas.getContext('2d')!
    const image = context.createImageData(64, 64)
    for (let row = 0; row < 4; row++) {
      for (let column = 0; column < 4; column++) {
        const kind = (row * 4 + column) % 3
        for (let y = 0; y < 16; y++) {
          for (let x = 0; x < 16; x++) {
            const shade = (y * 10 + x) % 4
            const rgb = row === 3 && column === 3 ? [245, 250, 255] : kind === 0
              ? x < 10 ? [224 + shade, 32 + shade, 32 + shade] : [0, 0, 255]
              : kind === 1
                ? x < 10 ? [16 + shade, 32 + shade, 224 + shade] : [255, 0, 0]
                : x < 12 ? [248, 250, 252] : [0, 0, 0]
            image.data.set([...rgb, 255], ((row * 16 + y) * 64 + column * 16 + x) * 4)
          }
        }
      }
    }
    context.putImageData(image, 0, 0)
    return canvas.toDataURL('image/png').split(',')[1]
  })
  await page.getByLabel('Auto size from picture').uncheck()
  await page.getByLabel('Columns', { exact: true }).fill('4')
  await page.getByLabel('Rows', { exact: true }).fill('4')
  await page.getByLabel('1. Choose a picture').setInputFiles({
    name: 'dominant-shades.png', mimeType: 'image/png', buffer: Buffer.from(base64, 'base64'),
  })
  await page.getByRole('button', { name: 'Create puzzle' }).click()
  await expect(page.locator('.app-shell .math-grid td')).toHaveCount(16)
  const problems = await page.locator('.app-shell .math-grid td').allTextContents()
  const key = await page.locator('.app-shell .color-key td').evaluateAll(cells => cells.map(cell => ({
    color: cell.getAttribute('data-color'),
    results: cell.getAttribute('data-results')!.split(',').map(Number),
  })))
  const expected = Array.from({ length: 16 }, (_, index) => index === 15 ? '#ffffff' : ['#e02020', '#1020e0', '#000000'][index % 3])
  expect(new Set(key.map(entry => entry.color))).toEqual(new Set(expected))
  problems.forEach((problem, index) => {
    const result = problem.split('+').map(Number).reduce((a, b) => a + b)
    expect(key.find(entry => entry.results.includes(result))?.color).toBe(expected[index])
  })
  await page.getByRole('button', { name: 'Solution', exact: true }).click()
  const fills = () => page.locator('.app-shell .color-preview rect').evaluateAll(cells => cells.map(cell => cell.getAttribute('fill')))
  expect(await fills()).toEqual(expected)
  await page.getByRole('button', { name: 'Create puzzle' }).click()
  await page.getByRole('button', { name: 'Solution', exact: true }).click()
  expect(await fills()).toEqual(expected)
  await page.getByLabel('Skip near-white background').check()
  await page.getByRole('button', { name: 'Create puzzle' }).click()
  await expect(page.locator('.app-shell .math-grid td[data-background]')).toHaveCount(1)
  await expect(page.locator('.app-shell .math-grid td').nth(5)).toHaveText(/^[1-9]\+[1-9]$/)
})

test('shows original dimensions in both languages and clears them with invalid or removed images', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await page.goto('/')
  const dimensions = page.locator('#image-dimensions')
  await expect(dimensions).toHaveCount(0)
  await page.getByLabel(catalogs.en.choosePicture).setInputFiles(await imageFile(page, { width: 640, height: 320 }))
  await expect(dimensions).toHaveText(catalogs.en.imageDimensions(640, 320))
  const preview = page.locator('.source-preview')
  expect(await preview.evaluate(image => ({ width: (image as HTMLImageElement).naturalWidth, height: (image as HTMLImageElement).naturalHeight }))).toEqual({ width: 320, height: 160 })
  await expect(preview).toHaveAttribute('aria-describedby', 'image-dimensions')
  await page.getByLabel(catalogs.en.autoSize).uncheck()
  await page.getByLabel(catalogs.en.columns, { exact: true }).fill('16')
  await page.getByLabel(catalogs.en.rows, { exact: true }).fill('8')
  await page.locator('#language').selectOption('zh-TW')
  const t = catalogs['zh-TW']
  await expect(dimensions).toHaveText(t.imageDimensions(640, 320))
  await page.getByRole('button', { name: t.create, exact: true }).click()
  await expect(page.getByRole('table', { name: t.additionGrid(8, 16) }).locator('td')).toHaveCount(128)
  await expect(dimensions).toHaveText(t.imageDimensions(640, 320))
  await page.getByLabel(t.choosePicture).setInputFiles(await imageFile(page, { width: 500, height: 1000 }))
  await expect(dimensions).toHaveText(t.imageDimensions(500, 1000))
  await expect(page.getByLabel(t.columns, { exact: true })).toHaveValue('16')
  await expect(page.getByLabel(t.rows, { exact: true })).toHaveValue('8')
  expect(await page.evaluate(() => Math.max(document.body.scrollWidth, document.documentElement.scrollWidth))).toBeLessThanOrEqual(375)
  await page.getByLabel(t.choosePicture).setInputFiles({ name: 'bad.png', mimeType: 'image/png', buffer: Buffer.from('not a picture') })
  await expect(page.locator('#image-error')).toHaveText(t.decodeFailed)
  await expect(dimensions).toHaveCount(0)
  await expect(preview).toHaveCount(0)
  await page.getByLabel(t.choosePicture).setInputFiles(await imageFile(page, { width: 320, height: 640 }))
  await expect(dimensions).toHaveText(t.imageDimensions(320, 640))
  await page.getByLabel(t.choosePicture).setInputFiles([])
  await expect(dimensions).toHaveCount(0)
  await expect(preview).toHaveCount(0)
})
