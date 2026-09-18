import { linearToSrgb, srgbToLinear } from './color'
import type { Rgb } from './color'
import { assertDimensions } from './dimensions'

export const SAMPLES_PER_CELL = 16

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
      const total = [0, 0, 0]
      for (let y = 0; y < samples; y++) {
        for (let x = 0; x < samples; x++) {
          const offset = ((row * samples + y) * width + column * samples + x) * 4
          for (let channel = 0; channel < 3; channel++) total[channel] += srgbToLinear(data[offset + channel])
        }
      }
      colors.push([
        linearToSrgb(total[0] / samples ** 2),
        linearToSrgb(total[1] / samples ** 2),
        linearToSrgb(total[2] / samples ** 2),
      ])
    }
  }
  return colors
}
