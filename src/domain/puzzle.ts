import { isWhite, toHex } from './color'
import type { Rgb } from './color'
import { assertDimensions } from './dimensions'
import type { ColorGrid } from './palette'

export type OperandPair = readonly [number, number]
export interface PuzzleCell {
  readonly a: number
  readonly b: number
  readonly colorIndex: number
}
export interface KeyEntry {
  readonly color: Rgb
  readonly hex: string
  readonly label: string
  readonly result: number
  readonly colorIndex: number
}
export interface Puzzle extends ColorGrid {
  readonly cells: readonly PuzzleCell[]
  readonly key: readonly KeyEntry[]
}

export const OPERANDS: ReadonlyMap<number, readonly OperandPair[]> = new Map(
  Array.from({ length: 17 }, (_, index) => {
    const sum = index + 2
    const pairs: OperandPair[] = []
    for (let a = 1; a <= 9; a++) {
      if (sum - a >= 1 && sum - a <= 9) pairs.push(Object.freeze([a, sum - a]))
    }
    return [sum, Object.freeze(pairs)]
  }),
)

export function createPuzzle(grid: ColorGrid, random: () => number = Math.random): Puzzle {
  assertDimensions(grid.rows, grid.columns)
  if (grid.palette.length < 1 || grid.palette.length > 8 ||
      grid.assignments.length !== grid.rows * grid.columns ||
      grid.assignments.some(index => !Number.isInteger(index) || index < 0 || index >= grid.palette.length)) {
    throw new Error('The color grid is incomplete or invalid.')
  }
  if (new Set(grid.assignments).size !== grid.palette.length ||
      new Set(grid.palette.map(toHex)).size !== grid.palette.length ||
      grid.palette.some(rgb => rgb.some(channel => !Number.isInteger(channel) || channel < 0 || channel > 255))) {
    throw new Error('The palette must contain unique, used RGB colors.')
  }
  function pick(length: number) {
    const value = random()
    if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error('Random source must return a number from 0 up to, but not including, 1.')
    return Math.floor(value * length)
  }
  const sums = Array.from({ length: 17 }, (_, index) => index + 2)
  for (let index = sums.length - 1; index > 0; index--) {
    const other = pick(index + 1)
    ;[sums[index], sums[other]] = [sums[other], sums[index]]
  }
  const palette = Object.freeze(grid.palette.map(color => Object.freeze<Rgb>([...color])))
  const key = Object.freeze(palette.map((color, colorIndex) => Object.freeze({
    color, colorIndex, hex: toHex(color), result: sums[colorIndex],
    label: isWhite(color) ? 'Leave white' : `Color ${colorIndex + 1}`,
  })).sort((a, b) => a.result - b.result))
  const cells = Object.freeze(grid.assignments.map(colorIndex => {
    const pairs = OPERANDS.get(sums[colorIndex])!
    const [a, b] = pairs[pick(pairs.length)]
    return Object.freeze({ a, b, colorIndex })
  }))
  return Object.freeze({
    rows: grid.rows, columns: grid.columns, palette,
    assignments: Object.freeze([...grid.assignments]), key, cells,
  })
}
