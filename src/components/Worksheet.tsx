import type { CSSProperties } from 'react'
import type { Puzzle } from '../domain/puzzle'
import { ColorPreview } from './ColorPreview'
import { worksheetLayout } from '../domain/layout'

export type ViewMode = 'puzzle' | 'solution'

interface GridStyle extends CSSProperties {
  '--columns': number
  '--rows': number
  '--print-width': string
  '--cell-mm': string
}

export function Worksheet({ puzzle, mode }: { puzzle: Puzzle; mode: ViewMode }) {
  const layout = worksheetLayout(puzzle)
  const style: GridStyle = { '--columns': puzzle.columns, '--rows': puzzle.rows, '--print-width': `${layout.widthMm}mm`, '--cell-mm': `${layout.cellMm}mm` }
  const keyRows = Array.from({ length: Math.ceil(puzzle.key.length / 4) }, (_, row) => puzzle.key.slice(row * 4, row * 4 + 4))

  return (
    <article className={`worksheet ${mode}-sheet`} style={style} aria-label={mode === 'puzzle' ? 'Puzzle worksheet' : 'Answer key worksheet'}>
      <header className="worksheet-heading">
        <div><p className="worksheet-brand">MATHDRAW</p><h2>{mode === 'puzzle' ? 'Color-by-addition' : 'Answer key'}</h2></div>
        {mode === 'puzzle' && <span className="name-line">Name: ____________________</span>}
      </header>
      <p className="worksheet-instructions">{mode === 'puzzle' ? 'Solve each sum. Match your answer to the color key. Color the square!' : 'The finished picture. Use the color key to check each answer.'}</p>
      <div className="worksheet-grid">
        {mode === 'puzzle' ? (
          <table className="math-grid" aria-label={`${puzzle.rows} by ${puzzle.columns} addition puzzle`}>
            <tbody>{Array.from({ length: puzzle.rows }, (_, row) => (
              <tr key={row}>{puzzle.cells.slice(row * puzzle.columns, (row + 1) * puzzle.columns).map((cell, column) => (
                <td key={column}><span>{cell.a}+{cell.b}</span></td>
              ))}</tr>
            ))}</tbody>
          </table>
        ) : <ColorPreview grid={puzzle} />}
      </div>
      <table className="color-key" aria-label="Shared answer to color key">
        <caption>Color key <span>Answer = color</span></caption>
        <tbody>{keyRows.map((entries, row) => (
          <tr key={row}>{entries.map(entry => (
            <td key={entry.result} data-result={entry.result} data-color={entry.hex}>
              <div className="key-entry">
                <strong>{entry.result}</strong>
                <svg className="key-swatch" viewBox="0 0 24 24" aria-hidden="true"><rect x=".5" y=".5" width="23" height="23" rx="2" fill={entry.hex} stroke="#697369" /></svg>
                <span>{entry.label}<small>{entry.hex}</small></span>
              </div>
            </td>
          ))}</tr>
        ))}</tbody>
      </table>
      <p className="worksheet-footer">{puzzle.columns} columns x {puzzle.rows} rows / {puzzle.key.length} {puzzle.key.length === 1 ? 'color' : 'colors'}<span>Little sums, big pictures.</span></p>
    </article>
  )
}
