import type { Puzzle } from './puzzle'
import { isProblemCell } from './puzzle'
import { problemText } from './settings'

export function worksheetLayout(puzzle: Puzzle) {
  const cellMm = puzzle.cells.some(cell => isProblemCell(cell) && problemText(cell).length > 3) ? 12 : 7.5
  const widthMm = Math.max(180, puzzle.columns * cellMm)
  const resultLines = Math.max(0, ...puzzle.key.map(entry => entry.results.length))
  const heightMm = puzzle.rows * cellMm + 40 + Math.ceil(puzzle.key.length / 4) * Math.max(10, resultLines * 5 + 2)
  return {
    cellMm,
    widthMm,
    heightMm,
    paperWidthMm: Math.ceil(widthMm + 20),
    paperHeightMm: Math.ceil(heightMm + 20),
    needsLargerPaper: puzzle.columns > 24 || widthMm > 180 || heightMm > 245,
  }
}
