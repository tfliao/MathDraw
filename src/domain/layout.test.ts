import { describe, expect, it } from 'vitest'
import { worksheetLayout } from './layout'
import { createPuzzle } from './puzzle'
import { DEFAULT_SETTINGS } from './settings'
import type { Rgb } from './color'

describe('readable worksheet sizing', () => {
  it('preserves the default A4 layout', () => {
    const puzzle = createPuzzle({ rows: 24, columns: 24, palette: [[0, 0, 0]], assignments: Array(576).fill(0) })
    expect(worksheetLayout(puzzle)).toEqual({
      cellMm: 7.5, widthMm: 180, heightMm: 237, paperWidthMm: 200, paperHeightMm: 257, needsLargerPaper: false,
    })
  })
  it('expands cells for long problems even when there are only four columns', () => {
    const puzzle = createPuzzle({ rows: 24, columns: 4, palette: [[0, 0, 0]], assignments: Array(96).fill(0) }, { ...DEFAULT_SETTINGS, multiMap: false, maxOperand: 99, maxResult: 9801, operators: ['*'] }, () => 1 - Number.EPSILON)
    const layout = worksheetLayout(puzzle)
    expect(puzzle.cells[0]).toMatchObject({ a: 99, b: 99, operator: '*' })
    expect(layout.cellMm).toBe(12)
    expect(layout.widthMm).toBe(180)
    expect(layout.needsLargerPaper).toBe(true)
    expect(layout.paperHeightMm).toBeGreaterThan(297)
  })
  it('allows space for sixteen colors and three answers per key entry', () => {
    const palette: Rgb[] = Array.from({ length: 16 }, (_, n) => [n * 15, 100, 50])
    const puzzle = createPuzzle({ rows: 24, columns: 64, palette, assignments: Array.from({ length: 1536 }, (_, n) => n % 16) }, { ...DEFAULT_SETTINGS, maxOperand: 99, maxResult: 9801, operators: ['*'], maxColors: 16, multiMap: true }, () => .999)
    expect(worksheetLayout(puzzle)).toEqual({
      cellMm: 12, widthMm: 768, heightMm: 396, paperWidthMm: 788, paperHeightMm: 416, needsLargerPaper: true,
    })
  })
  it('gives all-background worksheets finite dimensions and no key space', () => {
    const puzzle = createPuzzle({
      rows: 24, columns: 24, palette: [[255, 255, 255]], assignments: Array(576).fill(0),
    }, { ...DEFAULT_SETTINGS, skipBackground: true })
    expect(worksheetLayout(puzzle)).toEqual({
      cellMm: 7.5, widthMm: 180, heightMm: 220, paperWidthMm: 200, paperHeightMm: 240, needsLargerPaper: false,
    })
  })
  it('expands sixteen-color keys to eight results without shrinking cells', () => {
    const palette: Rgb[] = Array.from({ length: 16 }, (_, n) => [n * 15, 100, 50])
    const puzzle = createPuzzle({
      rows: 24, columns: 64, palette, assignments: Array.from({ length: 1536 }, (_, n) => n % 16),
    }, { ...DEFAULT_SETTINGS, maxOperand: 99, maxResult: 9801, operators: ['*'], maxColors: 16, maxResultsPerColor: 8 }, () => .999)
    expect(puzzle.key.every(entry => entry.results.length === 8)).toBe(true)
    expect(worksheetLayout(puzzle)).toEqual({
      cellMm: 12, widthMm: 768, heightMm: 496, paperWidthMm: 788, paperHeightMm: 516, needsLargerPaper: true,
    })
  })
})
