import type { Puzzle } from './puzzle'

export function worksheetLayout(puzzle: Puzzle) {
  const cellMm = 7.5
  const widthMm = Math.max(180, puzzle.columns * cellMm)
  const heightMm = puzzle.rows * cellMm + 40 + Math.ceil(puzzle.key.length / 4) * 10
  return {
    cellMm,
    widthMm,
    heightMm,
    paperWidthMm: Math.ceil(widthMm + 20),
    paperHeightMm: Math.ceil(heightMm + 20),
    needsLargerPaper: puzzle.columns > 24 || widthMm > 180 || heightMm > 245,
  }
}
