import type { Page } from '@playwright/test'

export async function imageFile(page: Page, options: { width?: number; height?: number; transparent?: boolean; type?: string } = {}) {
  const type = options.type ?? 'image/png'
  const base64 = await page.evaluate(({ width = 80, height = 40, transparent = false, type = 'image/png' }) => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!
    if (!transparent) {
      ctx.fillStyle = '#e33632'
      ctx.fillRect(0, 0, width / 2, height)
      ctx.fillStyle = '#185ec9'
      ctx.fillRect(width / 2, 0, width / 2, height)
    }
    return canvas.toDataURL(type).split(',')[1]
  }, options)
  return { name: type === 'image/jpeg' ? 'picture.jpg' : type === 'image/webp' ? 'picture.webp' : 'picture.png', mimeType: type, buffer: Buffer.from(base64, 'base64') }
}
