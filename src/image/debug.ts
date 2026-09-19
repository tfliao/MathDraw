import { isWhite } from '../domain/color'
import type { Rgb } from '../domain/color'
import { assertDimensions } from '../domain/dimensions'
import type { Puzzle } from '../domain/puzzle'
import { UserFacingError } from '../i18n/locale'
import type { ImageDiagnostics } from './process'

export function isLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '')
  return host === 'localhost' || host === '[::1]' ||
    (/^127(?:\.\d{1,3}){3}$/.test(host) && host.split('.').every(part => Number(part) <= 255))
}

export function debugStats(puzzle: Puzzle, diagnostics: ImageDiagnostics) {
  return {
    sampledColorCount: diagnostics.sampledColorCount,
    paletteColorCount: puzzle.palette.length,
    paletteChangedCells: diagnostics.paletteChangedCells,
    backgroundWhitenedCells: puzzle.cells.filter(cell => cell.kind === 'background' && !isWhite(puzzle.palette[cell.colorIndex])).length,
  }
}

function originalDataUrl(source: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new UserFacingError('debugFailed'))
    reader.onerror = () => reject(reader.error ?? new UserFacingError('debugFailed'))
    reader.onabort = () => reject(new UserFacingError('debugFailed'))
    reader.readAsDataURL(source)
  })
}

function stageDataUrl(rows: number, columns: number, colors: readonly Rgb[]): string {
  if (colors.length !== rows * columns) throw new UserFacingError('debugFailed')
  const canvas = document.createElement('canvas')
  canvas.width = columns
  canvas.height = rows
  const context = canvas.getContext('2d')
  if (!context) throw new UserFacingError('canvasFailed')
  const image = context.createImageData(columns, rows)
  colors.forEach((color, index) => {
    image.data.set([...color, 255], index * 4)
  })
  context.putImageData(image, 0, 0)
  const dataUrl = canvas.toDataURL('image/png')
  if (!dataUrl.startsWith('data:image/png;base64,')) throw new UserFacingError('debugFailed')
  return dataUrl
}

export async function createDebugBundle(source: File, puzzle: Puzzle, diagnostics: ImageDiagnostics): Promise<Blob> {
  assertDimensions(puzzle.rows, puzzle.columns)
  const dataUrl = await originalDataUrl(source)
  const quantized = puzzle.assignments.map(index => puzzle.palette[index])
  const solution = puzzle.cells.map((cell): Rgb => cell.kind === 'background' ? [255, 255, 255] : puzzle.palette[cell.colorIndex])
  const bundle = {
    schemaVersion: 1,
    pipelineVersion: diagnostics.pipelineVersion,
    source: {
      name: source.name, type: source.type, size: source.size,
      width: diagnostics.sourceWidth, height: diagnostics.sourceHeight, dataUrl,
    },
    diagnostics,
    settings: puzzle.settings,
    puzzle,
    stats: debugStats(puzzle, diagnostics),
    stages: {
      sampled: stageDataUrl(puzzle.rows, puzzle.columns, diagnostics.sampledColors),
      quantized: stageDataUrl(puzzle.rows, puzzle.columns, quantized),
      solution: stageDataUrl(puzzle.rows, puzzle.columns, solution),
    },
  }
  return new Blob([JSON.stringify(bundle)], { type: 'application/json' })
}
