import type { Page } from '@playwright/test'

export async function imageFile(page: Page, options: { width?: number; height?: number; transparent?: boolean; type?: string; palette?: boolean; manyColors?: boolean } = {}) {
  const type = options.type ?? 'image/png'
  const base64 = await page.evaluate(({ width = 80, height = 40, transparent = false, type = 'image/png', palette = false, manyColors = false }) => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!
    if (manyColors) {
      for (let row = 0; row < 24; row++) {
        for (let column = 0; column < 64; column++) {
          const n = row * 64 + column
          ctx.fillStyle = `rgb(${n * 37 % 256} ${n * 71 % 256} ${n * 13 % 256})`
          ctx.fillRect(column * width / 64, row * height / 24, width / 64, height / 24)
        }
      }
    } else if (palette) {
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

export function rotateJpegClockwise(file: Awaited<ReturnType<typeof imageFile>>) {
  const exif = Buffer.from('ffe1002245786966000049492a0008000000010012010300010000000600000000000000', 'hex')
  return { ...file, buffer: Buffer.concat([file.buffer.subarray(0, 2), exif, file.buffer.subarray(2)]) }
}
