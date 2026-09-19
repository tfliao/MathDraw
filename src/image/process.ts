import { assertDimensions } from '../domain/dimensions'
import { reducePalette } from '../domain/palette'
import type { ColorGrid } from '../domain/palette'
import { fitImage, sampleCells, SAMPLES_PER_CELL } from '../domain/sampling'
import { DEFAULT_MAX_COLORS } from '../domain/settings'
import { UserFacingError } from '../i18n/locale'

export const MAX_FILE_SIZE = 10 * 1024 * 1024
export const MAX_PIXELS = 40_000_000

export interface LoadedImage {
  readonly bitmap: ImageBitmap
  readonly previewUrl: string
  readonly name: string
  dispose(): void
}

export function validateFile(file: Pick<File, 'size' | 'type'>): void {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    throw new UserFacingError('unsupportedImage')
  }
  if (file.size === 0) throw new UserFacingError('emptyFile')
  if (file.size > MAX_FILE_SIZE) throw new UserFacingError('fileTooLarge')
}

export function validateImageDimensions(width: number, height: number): void {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new UserFacingError('invalidImageDimensions')
  }
  if (width * height > MAX_PIXELS) throw new UserFacingError('tooManyPixels')
}

function makeCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new UserFacingError('canvasFailed')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  return { canvas, context }
}

export async function loadImage(file: File): Promise<LoadedImage> {
  validateFile(file)
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new UserFacingError('decodeFailed')
  }
  try {
    validateImageDimensions(bitmap.width, bitmap.height)
    const scale = Math.min(1, 320 / Math.max(bitmap.width, bitmap.height))
    const { canvas, context } = makeCanvas(Math.max(1, Math.round(bitmap.width * scale)), Math.max(1, Math.round(bitmap.height * scale)))
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(value => value ? resolve(value) : reject(new UserFacingError('previewFailed')), 'image/png')
    })
    const previewUrl = URL.createObjectURL(blob)
    return {
      bitmap, previewUrl, name: file.name,
      dispose() { bitmap.close(); URL.revokeObjectURL(previewUrl) },
    }
  } catch (error) {
    bitmap.close()
    throw error
  }
}

export function processImage(image: LoadedImage, rows: number, columns: number, maximumColors = DEFAULT_MAX_COLORS): ColorGrid {
  assertDimensions(rows, columns)
  validateImageDimensions(image.bitmap.width, image.bitmap.height)
  const { canvas, context } = makeCanvas(columns * SAMPLES_PER_CELL, rows * SAMPLES_PER_CELL)
  const fit = fitImage(image.bitmap.width, image.bitmap.height, canvas.width, canvas.height)
  context.drawImage(image.bitmap, fit.x, fit.y, fit.width, fit.height)
  const colors = sampleCells(context.getImageData(0, 0, canvas.width, canvas.height).data, rows, columns)
  return { rows, columns, ...reducePalette(colors, maximumColors) }
}
