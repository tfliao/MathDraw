import type { CSSProperties } from 'react'
import type { Puzzle } from '../domain/puzzle'
import { isProblemCell } from '../domain/puzzle'
import { ColorPreview } from './ColorPreview'
import { worksheetLayout } from '../domain/layout'
import { problemText } from '../domain/settings'
import { isWhite } from '../domain/color'
import { useLanguage } from '../i18n/useLanguage'

export type ViewMode = 'puzzle' | 'solution'

interface GridStyle extends CSSProperties {
  '--columns': number
  '--rows': number
  '--print-width': string
  '--cell-mm': string
  '--cell-screen': string
}

export function Worksheet({ puzzle, mode }: { puzzle: Puzzle; mode: ViewMode }) {
  const { messages: t } = useLanguage()
  const layout = worksheetLayout(puzzle)
  const style: GridStyle = { '--columns': puzzle.columns, '--rows': puzzle.rows, '--print-width': `${layout.widthMm}mm`, '--cell-mm': `${layout.cellMm}mm`, '--cell-screen': layout.cellMm > 7.5 ? '48px' : '32px' }
  const additionOnly = puzzle.settings.operators.length === 1 && puzzle.settings.operators[0] === '+'
  const keyRows = Array.from({ length: Math.ceil(puzzle.key.length / 4) }, (_, row) => puzzle.key.slice(row * 4, row * 4 + 4))
  const backgroundCells = puzzle.cells.map(cell => !isProblemCell(cell))
  const instructions = puzzle.key.length === 0 ? t.allBackground : mode === 'puzzle'
    ? `${additionOnly ? t.sumInstructions : t.mathInstructions}${puzzle.settings.operators.includes('*') ? ` ${t.multiplyHelp}` : ''}`
    : t.answerInstructions

  return (
    <article className={`worksheet ${mode}-sheet`} style={style} aria-label={mode === 'puzzle' ? t.puzzleWorksheet : t.answerWorksheet}>
      <header className="worksheet-heading">
        <div><p className="worksheet-brand">MATHDRAW</p><h2>{mode === 'puzzle' ? additionOnly ? t.additionTitle : t.mathTitle : t.answerTitle}</h2></div>
        {mode === 'puzzle' && <span className="name-line">{t.nameLine}</span>}
      </header>
      <p className="worksheet-instructions">{instructions}{puzzle.key.length > 0 && backgroundCells.some(Boolean) ? ` ${t.backgroundInstructions}` : ''}</p>
      <div className="worksheet-grid">
        {mode === 'puzzle' ? (
          <table className="math-grid" aria-label={(additionOnly ? t.additionGrid : t.mathGrid)(puzzle.rows, puzzle.columns)}>
            <tbody>{Array.from({ length: puzzle.rows }, (_, row) => (
              <tr key={row}>{puzzle.cells.slice(row * puzzle.columns, (row + 1) * puzzle.columns).map((cell, column) => (
                <td key={column} data-background={!isProblemCell(cell) || undefined} aria-label={!isProblemCell(cell) ? t.backgroundCell : undefined}>{isProblemCell(cell) && <span>{problemText(cell)}</span>}</td>
              ))}</tr>
            ))}</tbody>
          </table>
        ) : <ColorPreview grid={puzzle} backgroundCells={backgroundCells} />}
      </div>
      {puzzle.key.length > 0 && <table className="color-key" aria-label={t.sharedKey}>
        <caption>{t.colorKey} <span>{t.answerColor}</span></caption>
        <tbody>{keyRows.map((entries, row) => (
          <tr key={row}>{entries.map(entry => (
            <td key={entry.colorIndex} data-results={entry.results.join(',')} data-color={entry.hex}>
              <div className="key-entry">
                <strong className={entry.results.some(result => result > 99) ? 'wide-results' : undefined}>{entry.results.map(result => <span key={result}>{result}</span>)}</strong>
                <svg className="key-swatch" viewBox="0 0 24 24" aria-hidden="true"><rect x=".5" y=".5" width="23" height="23" rx="2" fill={entry.hex} stroke="#697369" /></svg>
                <span>{isWhite(entry.color) ? t.leaveWhite : t.colorNumber(entry.colorIndex + 1)}<small>{entry.hex}</small></span>
              </div>
            </td>
          ))}</tr>
        ))}</tbody>
      </table>}
      <p className="worksheet-footer">{t.worksheetSize(puzzle.columns, puzzle.rows, puzzle.key.length)}<span>{t.tagline}</span></p>
    </article>
  )
}
