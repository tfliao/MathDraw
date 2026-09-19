import { describe, expect, it } from 'vitest'
import { toHex } from '../domain/color'
import type { Rgb } from '../domain/color'
import type { ColorGrid } from '../domain/palette'
import { createPuzzle } from '../domain/puzzle'
import { DEFAULT_SETTINGS } from '../domain/settings'
import { debugStats } from './debug'
import type { ImageDiagnostics } from './process'

const grid: ColorGrid = {
  rows: 4,
  columns: 4,
  palette: [[255, 255, 255], [250, 245, 240], [0, 0, 0], [255, 0, 0]],
  assignments: [
    0, 1, 2, 3,
    2, 2, 2, 2,
    2, 1, 2, 2,
    2, 2, 2, 2,
  ],
}

function diagnosticsFor(value: ColorGrid, sampledColors: readonly Rgb[] = value.assignments.map(index => value.palette[index])): ImageDiagnostics {
  return {
    pipelineVersion: '2',
    sourceWidth: value.columns,
    sourceHeight: value.rows,
    requestedAlgorithm: 'pica',
    appliedAlgorithm: 'identity',
    effectiveMaximumColors: 8,
    samplesPerCellSide: 1,
    fittedBounds: { x: 0, y: 0, width: value.columns, height: value.rows },
    sampledColors,
    sampledColorCount: new Set(sampledColors.map(toHex)).size,
    paletteChangedCells: sampledColors.filter((rgb, index) => toHex(rgb) !== toHex(value.palette[value.assignments[index]])).length,
  }
}

describe('debugging statistics', () => {
  it('separates palette changes from actual background whitening, retaining enclosed pale details', () => {
    const sampledColors = grid.assignments.map((index, cell): Rgb => cell === 4 ? [1, 2, 3] : grid.palette[index])
    const diagnostics = diagnosticsFor(grid, sampledColors)
    const puzzle = createPuzzle(grid, { ...DEFAULT_SETTINGS, skipBackground: true }, () => 0)
    expect(puzzle.cells.filter(cell => cell.kind === 'background')).toHaveLength(2)
    expect(puzzle.cells[9].kind).toBe('problem')
    expect(puzzle.key).toHaveLength(3)
    expect(debugStats(puzzle, diagnostics)).toEqual({
      sampledColorCount: 5,
      paletteColorCount: 4,
      paletteChangedCells: 1,
      backgroundWhitenedCells: 1,
    })
    expect(puzzle.palette).toEqual(grid.palette)
    expect(diagnostics.sampledColors).toEqual(sampledColors)
  })

  it('reports no whitening when background skipping is disabled', () => {
    const puzzle = createPuzzle(grid, DEFAULT_SETTINGS, () => 0)
    expect(debugStats(puzzle, diagnosticsFor(grid))).toEqual({
      sampledColorCount: 4,
      paletteColorCount: 4,
      paletteChangedCells: 0,
      backgroundWhitenedCells: 0,
    })
  })

  it.each([
    { rgb: [255, 255, 255] as Rgb, whitened: 0 },
    { rgb: [255, 255, 254] as Rgb, whitened: 16 },
    { rgb: [240, 250, 245] as Rgb, whitened: 16 },
  ])('counts only non-pure-white blank cells for $rgb', ({ rgb, whitened }) => {
    const background: ColorGrid = { rows: 4, columns: 4, palette: [rgb], assignments: Array(16).fill(0) }
    const puzzle = createPuzzle(background, { ...DEFAULT_SETTINGS, skipBackground: true }, () => 0)
    expect(puzzle.key).toHaveLength(0)
    expect(debugStats(puzzle, diagnosticsFor(background))).toEqual({
      sampledColorCount: 1,
      paletteColorCount: 1,
      paletteChangedCells: 0,
      backgroundWhitenedCells: whitened,
    })
  })
})
