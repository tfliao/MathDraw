import { toHex } from './color'
import type { Rgb } from './color'
import { assertDimensions } from './dimensions'
import type { ColorGrid } from './palette'
import { buildProblemPool, DEFAULT_SETTINGS } from './settings'
import type { MathProblem, PuzzleSettings } from './settings'
import { UserFacingError } from '../i18n/locale'
import { backgroundMask } from './background'

export interface ProblemCell extends MathProblem {
  readonly kind: 'problem'
  readonly colorIndex: number
}
export interface BackgroundCell {
  readonly kind: 'background'
  readonly colorIndex: number
}
export type PuzzleCell = ProblemCell | BackgroundCell
export function isProblemCell(cell: PuzzleCell): cell is ProblemCell {
  return cell.kind === 'problem'
}
export interface KeyEntry {
  readonly color: Rgb
  readonly hex: string
  readonly results: readonly number[]
  readonly colorIndex: number
}
export interface Puzzle extends ColorGrid {
  readonly cells: readonly PuzzleCell[]
  readonly key: readonly KeyEntry[]
  readonly settings: PuzzleSettings
}

export function createPuzzle(grid: ColorGrid, settings: PuzzleSettings = DEFAULT_SETTINGS, random: () => number = Math.random): Puzzle {
  assertDimensions(grid.rows, grid.columns)
  const pool = buildProblemPool(settings)
  if (pool.size === 0) throw new UserFacingError('noResults')
  if (grid.palette.length < 1 || grid.palette.length > settings.maxColors ||
      grid.assignments.length !== grid.rows * grid.columns ||
      grid.assignments.some(index => !Number.isInteger(index) || index < 0 || index >= grid.palette.length)) {
    throw new Error('The color grid is incomplete or invalid.')
  }
  if (new Set(grid.assignments).size !== grid.palette.length ||
      new Set(grid.palette.map(toHex)).size !== grid.palette.length ||
      grid.palette.some(rgb => rgb.some(channel => !Number.isInteger(channel) || channel < 0 || channel > 255))) {
    throw new Error('The palette must contain unique, used RGB colors.')
  }
  const skipped = settings.skipBackground ? backgroundMask(grid) : grid.assignments.map(() => false)
  const counts = grid.palette.map(() => 0)
  grid.assignments.forEach((color, index) => { if (!skipped[index]) counts[color]++ })
  const activeColors = counts.flatMap((count, color) => count > 0 ? [color] : [])
  if (activeColors.length > pool.size) throw new Error('These operators and operands cannot produce enough results for the palette. Reduce the color limit.')
  function pick(length: number) {
    const value = random()
    if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error('Random source must return a number from 0 up to, but not including, 1.')
    return Math.floor(value * length)
  }
  function shuffle<T>(values: T[]) {
    for (let index = values.length - 1; index > 0; index--) {
      const other = pick(index + 1)
      ;[values[index], values[other]] = [values[other], values[index]]
    }
    return values
  }
  const available = activeColors.length > 0 ? shuffle([...pool.keys()]) : []
  const results = grid.palette.map((_, color) => counts[color] > 0 ? [available.pop()!] : [])
  const allocationOrder = shuffle([...activeColors])
  if (settings.multiMap) {
    for (let pass = 1; pass < settings.maxResultsPerColor; pass++) {
      for (const color of allocationOrder) {
        if (available.length > 0 && counts[color] > pass) results[color].push(available.pop()!)
      }
    }
  }
  // Cycle through shuffled result schedules to use every key entry at least once.
  const schedules = results.map((values, color) => shuffle(Array.from({ length: counts[color] }, (_, index) => values[index % values.length])))
  const cursors = grid.palette.map(() => 0)
  const palette = Object.freeze(grid.palette.map(color => Object.freeze<Rgb>([...color])))
  const key = Object.freeze(activeColors.map(colorIndex => Object.freeze({
    color: palette[colorIndex], colorIndex, hex: toHex(palette[colorIndex]), results: Object.freeze(results[colorIndex].sort((a, b) => a - b)),
  })).sort((a, b) => a.results[0] - b.results[0]))
  const cells = Object.freeze(grid.assignments.map((colorIndex, index): PuzzleCell => {
    if (skipped[index]) return Object.freeze({ kind: 'background', colorIndex })
    const result = schedules[colorIndex][cursors[colorIndex]++]
    const problems = pool.get(result)!
    return Object.freeze({ ...problems[pick(problems.length)], kind: 'problem', colorIndex })
  }))
  return Object.freeze({
    rows: grid.rows, columns: grid.columns, palette,
    assignments: Object.freeze([...grid.assignments]), key, cells,
    settings: Object.freeze({ ...settings, operators: Object.freeze([...settings.operators]) }),
  })
}
