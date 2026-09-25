import { isNearWhite } from '../domain/color'
import { UserFacingError } from '../i18n/locale'

export interface TrimBounds {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

// Pixels must already be composited over white; alpha is intentionally ignored.
export function foregroundBounds(
  data: Uint8ClampedArray, width: number, height: number, offsetX = 0, offsetY = 0,
): TrimBounds | null {
  let left = width
  let top = height
  let right = -1
  let bottom = -1
  const rgb: [number, number, number] = [0, 0, 0]
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4
      rgb[0] = data[index]
      rgb[1] = data[index + 1]
      rgb[2] = data[index + 2]
      if (isNearWhite(rgb)) continue
      left = Math.min(left, x)
      top = Math.min(top, y)
      right = Math.max(right, x)
      bottom = Math.max(bottom, y)
    }
  }
  return right < 0 ? null : {
    x: left + offsetX, y: top + offsetY, width: right - left + 1, height: bottom - top + 1,
  }
}

export function mergeBounds(a: TrimBounds | null, b: TrimBounds | null): TrimBounds | null {
  if (!a) return b
  if (!b) return a
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return {
    x, y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  }
}

export async function findTrimBounds(bitmap: ImageBitmap, signal?: AbortSignal): Promise<{
  bounds: TrimBounds
  noForeground: boolean
}> {
  signal?.throwIfAborted()
  const tileSize = 512
  const canvas = document.createElement('canvas')
  canvas.width = Math.min(tileSize, bitmap.width)
  canvas.height = Math.min(tileSize, bitmap.height)
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new UserFacingError('canvasFailed')
  context.imageSmoothingEnabled = false
  context.fillStyle = '#ffffff'
  let bounds: TrimBounds | null = null
  for (let y = 0; y < bitmap.height; y += tileSize) {
    for (let x = 0; x < bitmap.width; x += tileSize) {
      signal?.throwIfAborted()
      const width = Math.min(tileSize, bitmap.width - x)
      const height = Math.min(tileSize, bitmap.height - y)
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(bitmap, x, y, width, height, 0, 0, width, height)
      bounds = mergeBounds(bounds, foregroundBounds(
        context.getImageData(0, 0, width, height).data, width, height, x, y,
      ))
      // Yield between bounded tiles so newer uploads/toggles can cancel this scan.
      if (x + tileSize < bitmap.width || y + tileSize < bitmap.height) {
        await new Promise<void>(resolve => setTimeout(resolve, 0))
      }
    }
  }
  signal?.throwIfAborted()
  return {
    bounds: bounds ?? { x: 0, y: 0, width: bitmap.width, height: bitmap.height },
    noForeground: bounds === null,
  }
}
