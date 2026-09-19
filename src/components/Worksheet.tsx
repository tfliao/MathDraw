import type { CSSProperties } from 'react'
import type { Puzzle } from '../domain/puzzle'
import { ColorPreview } from './ColorPreview'
import { worksheetLayout } from '../domain/layout'
import { problemText } from '../domain/settings'

export type ViewMode = 'puzzle' | 'solution'

interface GridStyle extends CSSProperties {
  '--columns': number
  '--rows': number
  '--print-width': string
  '--cell-mm': string
  '--cell-screen': string
}

export function Worksheet({ puzzle, mode }: { puzzle: Puzzle; mode: ViewMode }) {
  const layout = worksheetLayout(puzzle)
  const style: GridStyle = { '--columns': puzzle.columns, '--rows': puzzle.rows, '--print-width': `${layout.widthMm}mm`, '--cell-mm': `${layout.cellMm}mm`, '--cell-screen': layout.cellMm > 7.5 ? '48px' : '32px' }
  const additionOnly = puzzle.settings.operators.length === 1 && puzzle.settings.operators[0] === '+'
  const keyRows = Array.from({ length: Math.ceil(puzzle.key.length / 4) }, (_, row) => puzzle.key.slice(row * 4, row * 4 + 4))

  return (
    <article className={`worksheet ${mode}-sheet`} style={style} aria-label={mode === 'puzzle' ? 'Puzzle worksheet' : 'Answer key worksheet'}>
      <header className="worksheet-heading">
        <div><p className="worksheet-brand">MATHDRAW</p><h2>{mode === 'puzzle' ? additionOnly ? 'Color-by-addition' : 'Color-by-math' : 'Answer key'}</h2></div>
        {mode === 'puzzle' && <span className="name-line">Name: ____________________</span>}
      </header>
      <p className="worksheet-instructions">{mode === 'puzzle' ? `Solve each ${additionOnly ? 'sum' : 'problem'}. Match your answer to the color key. Color the square!${puzzle.settings.operators.includes('*') ? ' * means multiply.' : ''}` : 'The finished picture. Use the color key to check each answer.'}</p>
      <div className="worksheet-grid">
        {mode === 'puzzle' ? (
          <table className="math-grid" aria-label={`${puzzle.rows} by ${puzzle.columns} ${additionOnly ? 'addition' : 'math'} puzzle`}>
            <tbody>{Array.from({ length: puzzle.rows }, (_, row) => (
              <tr key={row}>{puzzle.cells.slice(row * puzzle.columns, (row + 1) * puzzle.columns).map((cell, column) => (
                <td key={column}><span>{problemText(cell)}</span></td>
              ))}</tr>
            ))}</tbody>
          </table>
        ) : <ColorPreview grid={puzzle} />}
      </div>
      <table className="color-key" aria-label="Shared answer to color key">
        <caption>Color key <span>Answer = color</span></caption>
        <tbody>{keyRows.map((entries, row) => (
          <tr key={row}>{entries.map(entry => (
            <td key={entry.colorIndex} data-results={entry.results.join(',')} data-color={entry.hex}>
              <div className="key-entry">
                <strong className={entry.results.some(result => result > 99) ? 'wide-results' : undefined}>{entry.results.map(result => <span key={result}>{result}</span>)}</strong>
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
