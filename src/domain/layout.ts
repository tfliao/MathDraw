import type { Puzzle } from './puzzle'
import { isProblemCell } from './puzzle'
import { problemText } from './settings'
import { A4_COLUMNS, A4_ROWS } from './dimensions'

export function worksheetLayout(puzzle: Puzzle) {
  const cellMm = puzzle.cells.some(cell => isProblemCell(cell) && problemText(cell).length > 3) ? 12 : 7.5
  const widthMm = Math.max(180, puzzle.columns * cellMm)
  const resultLines = Math.max(0, ...puzzle.key.map(entry => entry.results.length))
  const backgroundHelpMm = puzzle.key.length > 0 && puzzle.cells.some(cell => !isProblemCell(cell)) ? 5 : 0
  const heightMm = puzzle.rows * cellMm + 34 + backgroundHelpMm + Math.ceil(puzzle.key.length / 4) * Math.max(9, resultLines * 5 + 1)
  return {
    cellMm,
    widthMm,
    heightMm,
    paperWidthMm: Math.ceil(widthMm + 20),
    paperHeightMm: Math.ceil(heightMm + 20),
    needsLargerPaper: puzzle.columns > A4_COLUMNS || puzzle.rows > A4_ROWS || widthMm > 190 || heightMm > 277,
  }
}
