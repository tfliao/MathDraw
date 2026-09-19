import type { Rgb } from './color'
import { isNearWhite } from './color'
import { assertDimensions } from './dimensions'

export const SAMPLES_PER_CELL = 16

interface ColorSample {
  rgb: Rgb
  count: number
}

interface ColorBucket {
  count: number
  colors: Map<number, ColorSample>
}

function mostFrequent<T extends { count: number }>(entries: ReadonlyMap<number, T>): T {
  // Numeric RGB order makes equal-population ties independent of scan order.
  return [...entries].reduce((best, next) =>
    next[1].count > best[1].count || (next[1].count === best[1].count && next[0] < best[0]) ? next : best,
  )[1]
}

export function fitImage(width: number, height: number, targetWidth: number, targetHeight: number) {
  if (![width, height, targetWidth, targetHeight].every(value => Number.isFinite(value) && value > 0)) {
    throw new Error('Image dimensions must be positive finite numbers.')
  }
  const scale = Math.min(targetWidth / width, targetHeight / height)
  const fittedWidth = width * scale
  const fittedHeight = height * scale
  return { x: (targetWidth - fittedWidth) / 2, y: (targetHeight - fittedHeight) / 2, width: fittedWidth, height: fittedHeight }
}

export function sampleCells(data: Uint8ClampedArray, rows: number, columns: number, samples = SAMPLES_PER_CELL): Rgb[] {
  assertDimensions(rows, columns)
  if (!Number.isInteger(samples) || samples < 1 || samples > 32) throw new Error('Invalid cell sampling resolution.')
  const width = columns * samples
  if (data.length !== width * rows * samples * 4) throw new Error('Pixel data does not match grid dimensions.')
  const colors: Rgb[] = []
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const buckets = new Map<number, ColorBucket>()
      for (let y = 0; y < samples; y++) {
        for (let x = 0; x < samples; x++) {
          const offset = ((row * samples + y) * width + column * samples + x) * 4
          const rgb: Rgb = [data[offset], data[offset + 1], data[offset + 2]]
          if (isNearWhite(rgb)) continue
          const bucketKey = (rgb[0] >> 4) * 256 + (rgb[1] >> 4) * 16 + (rgb[2] >> 4)
          const colorKey = rgb[0] * 65536 + rgb[1] * 256 + rgb[2]
          let bucket = buckets.get(bucketKey)
          if (!bucket) {
            bucket = { count: 0, colors: new Map() }
            buckets.set(bucketKey, bucket)
          }
          bucket.count++
          const existing = bucket.colors.get(colorKey)
          if (existing) existing.count++
          else bucket.colors.set(colorKey, { rgb, count: 1 })
        }
      }
      colors.push(buckets.size === 0 ? [255, 255, 255] : mostFrequent(mostFrequent(buckets).colors).rgb)
    }
  }
  return colors
}
