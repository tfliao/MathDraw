import type { Page } from '@playwright/test'

export async function imageFile(page: Page, options: { width?: number; height?: number; transparent?: boolean; type?: string; palette?: boolean } = {}) {
  const type = options.type ?? 'image/png'
  const base64 = await page.evaluate(({ width = 80, height = 40, transparent = false, type = 'image/png', palette = false }) => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!
    if (palette) {
      const colors = ['#ffffff', '#000000', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff']
      colors.forEach((color, index) => {
        ctx.fillStyle = color
        ctx.fillRect(index * width / 8, 0, width / 8, height)
      })
    } else if (!transparent) {
      ctx.fillStyle = '#e33632'
      ctx.fillRect(0, 0, width / 2, height)
      ctx.fillStyle = '#185ec9'
      ctx.fillRect(width / 2, 0, width / 2, height)
    }
    return canvas.toDataURL(type).split(',')[1]
  }, options)
  return { name: type === 'image/jpeg' ? 'picture.jpg' : type === 'image/webp' ? 'picture.webp' : 'picture.png', mimeType: type, buffer: Buffer.from(base64, 'base64') }
}
