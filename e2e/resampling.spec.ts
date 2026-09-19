import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function pixelArt(page: Page, solidNearWhite = false, transparent = false) {
  const fixture = await page.evaluate(({ solidNearWhite, transparent }) => {
    const canvas = document.createElement('canvas')
    canvas.width = 22
    canvas.height = 24
    const context = canvas.getContext('2d')!
    const pixels = context.createImageData(22, 24)
    const expected: string[] = []
    for (let y = 0; y < 24; y++) {
      for (let x = 0; x < 22; x++) {
        let rgb = solidNearWhite ? [245, 245, 245] : [255, 255, 255]
        if (!solidNearWhite) {
          if ((x === 4 && y > 2 && y < 21) || (y === 19 && x > 3 && x < 19)) rgb = [0, 0, 0]
          if (x === 15 && y === 5) rgb = [255, 0, 0]
          if (x >= 11 && x < 15 && y >= 11 && y < 15 && (x + y) % 2 === 0) rgb = [0, 0, 255]
        }
        const isWhite = rgb.every(channel => channel === 255)
        pixels.data.set([...rgb, transparent && isWhite ? 0 : 255], (y * 22 + x) * 4)
        expected.push(`#${rgb.map(channel => channel.toString(16).padStart(2, '0')).join('')}`)
      }
    }
    context.putImageData(pixels, 0, 0)
    return { base64: canvas.toDataURL('image/png').split(',')[1], expected }
  }, { solidNearWhite, transparent })
  return {
    file: { name: '22x24.png', mimeType: 'image/png', buffer: Buffer.from(fixture.base64, 'base64') },
    expected: fixture.expected,
  }
}

async function solution(page: Page, rows: number, columns: number, file: Awaited<ReturnType<typeof pixelArt>>['file']) {
  await page.getByLabel('Auto size from picture').uncheck()
  await page.getByLabel('Rows', { exact: true }).fill(String(rows))
  await page.getByLabel('Columns', { exact: true }).fill(String(columns))
  await page.getByLabel('1. Choose a picture').setInputFiles(file)
  await page.getByRole('button', { name: 'Create puzzle' }).click()
  await expect(page.locator('.app-shell .math-grid td')).toHaveCount(rows * columns)
  await page.getByRole('button', { name: 'Solution', exact: true }).click()
  const cells = page.locator('.app-shell .color-preview rect')
  await expect(cells).toHaveCount(rows * columns)
  return cells.evaluateAll(elements => elements.map(cell => cell.getAttribute('fill')))
}

for (const transparent of [false, true]) {
  test(`22x24 source to 22x24 grid preserves pixel locations and colors (transparent=${transparent})`, async ({ page }) => {
    await page.goto('/')
    const fixture = await pixelArt(page, false, transparent)
    const actual = await solution(page, 24, 22, fixture.file)
    const mismatches = actual.filter((color, index) => color !== fixture.expected[index]).length
    expect(mismatches, 'Pixels changed despite no requested resizing and four well-separated source colors').toBe(0)
  })
}

test('same-size sampling does not normalize a real near-white source color', async ({ page }) => {
  await page.goto('/')
  const fixture = await pixelArt(page, true)
  const actual = await solution(page, 24, 22, fixture.file)
  expect(actual.filter((color, index) => color !== fixture.expected[index]).length).toBe(0)
})

test('enlarging small pixel art does not invent edge colors or spread foreground into white pixels', async ({ page }) => {
  await page.goto('/')
  const fixture = await pixelArt(page)
  const actual = await solution(page, 48, 44, fixture.file)
  const expected = Array.from({ length: 44 * 48 }, (_, index) => fixture.expected[Math.floor(Math.floor(index / 44) / 2) * 22 + Math.floor(index % 44 / 2)])
  expect(actual.filter((color, index) => color !== expected[index]).length).toBe(0)
})

test('small pixel art fits into a wider grid with clean white margins', async ({ page }) => {
  await page.goto('/')
  const fixture = await pixelArt(page)
  const actual = await solution(page, 24, 24, fixture.file)
  const expected = Array.from({ length: 24 * 24 }, (_, index) => {
    const column = index % 24
    return column === 0 || column === 23 ? '#ffffff' : fixture.expected[Math.floor(index / 24) * 22 + column - 1]
  })
  expect(actual.filter((color, index) => color !== expected[index]).length).toBe(0)
})
