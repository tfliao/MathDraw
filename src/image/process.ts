import pica from 'pica'
import { assertDimensions } from '../domain/dimensions'
import { toHex } from '../domain/color'
import type { Rgb } from '../domain/color'
import { reducePalette } from '../domain/palette'
import type { ColorGrid } from '../domain/palette'
import { fitImage, sampleCells, SAMPLES_PER_CELL } from '../domain/sampling'
import { DEFAULT_MAX_COLORS, DEFAULT_SETTINGS, isResizeAlgorithm } from '../domain/settings'
import type { ResizeAlgorithm } from '../domain/settings'
import { UserFacingError } from '../i18n/locale'
import { findTrimBounds } from './trim'
import type { TrimBounds } from './trim'

export const MAX_FILE_SIZE = 10 * 1024 * 1024
export const MAX_PIXELS = 40_000_000

export interface LoadedImage {
  readonly bitmap: ImageBitmap
  readonly file: File
  readonly previewUrl: string
  readonly name: string
  readonly originalWidth: number
  readonly originalHeight: number
  readonly trim: {
    readonly enabled: boolean
    readonly bounds: TrimBounds
    readonly noForeground: boolean
  }
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

export async function loadImage(file: File, trimMargins = false, signal?: AbortSignal): Promise<LoadedImage> {
  signal?.throwIfAborted()
  validateFile(file)
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    signal?.throwIfAborted()
    throw new UserFacingError('decodeFailed')
  }
  let previewUrl: string | undefined
  try {
    signal?.throwIfAborted()
    validateImageDimensions(bitmap.width, bitmap.height)
    const originalWidth = bitmap.width
    const originalHeight = bitmap.height
    const trim: LoadedImage['trim'] = {
      enabled: trimMargins,
      ...(trimMargins ? await findTrimBounds(bitmap, signal) : {
        bounds: { x: 0, y: 0, width: originalWidth, height: originalHeight },
        noForeground: false,
      }),
    }
    signal?.throwIfAborted()
    const { x, y, width, height } = trim.bounds
    if (x !== 0 || y !== 0 || width !== originalWidth || height !== originalHeight) {
      const original = bitmap
      bitmap = await createImageBitmap(original, x, y, width, height)
      original.close()
      signal?.throwIfAborted()
    }
    const scale = Math.min(1, 320 / Math.max(bitmap.width, bitmap.height))
    const { canvas, context } = makeCanvas(Math.max(1, Math.round(bitmap.width * scale)), Math.max(1, Math.round(bitmap.height * scale)))
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(value => value ? resolve(value) : reject(new UserFacingError('previewFailed')), 'image/png')
    })
    signal?.throwIfAborted()
    previewUrl = URL.createObjectURL(blob)
    const ownedUrl = previewUrl
    let disposed = false
    return {
      bitmap, file, previewUrl, name: file.name, originalWidth, originalHeight, trim,
      dispose() {
        if (disposed) return
        disposed = true
        bitmap.close()
        URL.revokeObjectURL(ownedUrl)
      },
    }
  } catch (error) {
    bitmap.close()
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    signal?.throwIfAborted()
    throw error
  }
}

export interface ImageDiagnostics {
  readonly pipelineVersion: '2'
  readonly sourceWidth: number
  readonly sourceHeight: number
  readonly trim?: LoadedImage['trim']
  readonly inputWidth?: number
  readonly inputHeight?: number
  readonly requestedAlgorithm: ResizeAlgorithm
  readonly appliedAlgorithm: ResizeAlgorithm | 'identity'
  readonly effectiveMaximumColors: number
  readonly samplesPerCellSide: number
  readonly fittedBounds: ReturnType<typeof fitImage>
  readonly sampledColors: readonly Rgb[]
  readonly sampledColorCount: number
  readonly paletteChangedCells: number
}

export interface ProcessedImage extends ColorGrid {
  readonly diagnostics: ImageDiagnostics
}

const resizer = pica()

async function resizeWithPica(bitmap: ImageBitmap, canvas: HTMLCanvasElement, signal?: AbortSignal) {
  // Own a clone: replacing the upload can dispose the original while Pica awaits workers.
  const source = await createImageBitmap(bitmap)
  let cancel: (() => void) | undefined
  try {
    signal?.throwIfAborted()
    const cancelToken = signal && new Promise<never>((_, reject) => {
      cancel = () => reject(signal.reason)
      signal.addEventListener('abort', cancel, { once: true })
    })
    await resizer.resize(source, canvas, { filter: 'mks2013', cancelToken })
  } finally {
    if (cancel) signal?.removeEventListener('abort', cancel)
    source.close()
  }
}

export async function processImage(
  image: LoadedImage, rows: number, columns: number, maximumColors = DEFAULT_MAX_COLORS,
  algorithm: ResizeAlgorithm = DEFAULT_SETTINGS.resizeAlgorithm,
  mergeSimilarColors = DEFAULT_SETTINGS.mergeSimilarColors, signal?: AbortSignal,
): Promise<ProcessedImage> {
  assertDimensions(rows, columns)
  validateImageDimensions(image.bitmap.width, image.bitmap.height)
  if (!isResizeAlgorithm(algorithm)) throw new UserFacingError('invalidResizeAlgorithm')
  signal?.throwIfAborted()
  const sourceWidth = image.bitmap.width
  const sourceHeight = image.bitmap.height
  const sameSize = image.bitmap.width === columns && image.bitmap.height === rows
  const samples = !sameSize && algorithm === 'foreground' ? SAMPLES_PER_CELL : 1
  const { canvas, context } = makeCanvas(columns * samples, rows * samples)
  let fit = fitImage(sourceWidth, sourceHeight, canvas.width, canvas.height)
  if (!sameSize && algorithm !== 'foreground') {
    // Align fitted edges with cells rather than blending fractional padding into the picture.
    const width = Math.max(1, Math.round(fit.width))
    const height = Math.max(1, Math.round(fit.height))
    fit = { x: Math.floor((columns - width) / 2), y: Math.floor((rows - height) / 2), width, height }
  }
  if (!sameSize && algorithm === 'pica') {
    const target = makeCanvas(fit.width, fit.height).canvas
    await resizeWithPica(image.bitmap, target, signal)
    signal?.throwIfAborted()
    context.drawImage(target, fit.x, fit.y)
  } else {
    context.imageSmoothingEnabled = algorithm === 'browser' || (algorithm === 'foreground' && fit.width < sourceWidth)
    context.drawImage(image.bitmap, fit.x, fit.y, fit.width, fit.height)
  }
  const data = context.getImageData(0, 0, canvas.width, canvas.height).data
  const colors = samples === 1
    ? Array.from({ length: rows * columns }, (_, index): Rgb => [data[index * 4], data[index * 4 + 1], data[index * 4 + 2]])
    : sampleCells(data, rows, columns)
  const grid = reducePalette(colors, maximumColors, mergeSimilarColors)
  return {
    rows, columns, ...grid,
    diagnostics: {
      pipelineVersion: '2', sourceWidth: image.originalWidth, sourceHeight: image.originalHeight,
      ...(image.trim.enabled ? { trim: image.trim, inputWidth: sourceWidth, inputHeight: sourceHeight } : {}),
      requestedAlgorithm: algorithm,
      appliedAlgorithm: sameSize ? 'identity' : algorithm, fittedBounds: fit,
      effectiveMaximumColors: maximumColors, samplesPerCellSide: samples,
      sampledColors: colors, sampledColorCount: new Set(colors.map(toHex)).size,
      paletteChangedCells: colors.filter((rgb, index) => toHex(rgb) !== toHex(grid.palette[grid.assignments[index]])).length,
    },
  }
}
