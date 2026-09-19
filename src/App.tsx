import { useEffect, useRef, useState } from 'react'
import { autoDimensions, dimensionError } from './domain/dimensions'
import { worksheetLayout } from './domain/layout'
import { createPuzzle } from './domain/puzzle'
import type { Puzzle } from './domain/puzzle'
import { processImage } from './image/process'
import { useImageInput } from './image/useImageInput'
import { Worksheet } from './components/Worksheet'
import type { ViewMode } from './components/Worksheet'
import { usePrint } from './components/usePrint'
import './App.css'
import './print.css'

function App() {
  const [rows, setRows] = useState('20')
  const [columns, setColumns] = useState('16')
  const [autoSize, setAutoSize] = useState(false)
  const rowsError = autoSize ? null : dimensionError(rows)
  const columnsError = autoSize ? null : dimensionError(columns, 'columns')
  const { image, loading, error: imageError, selectFile } = useImageInput()
  const autoGrid = image ? autoDimensions(image.bitmap.width, image.bitmap.height) : null
  const gridRows = autoSize ? autoGrid?.rows : Number(rows)
  const gridColumns = autoSize ? autoGrid?.columns : Number(columns)
  const [snapshot, setSnapshot] = useState<{ puzzle: Puzzle; revision: number } | null>(null)
  const [view, setView] = useState<ViewMode>('puzzle')
  const [revision, setRevision] = useState(0)
  const [generating, setGenerating] = useState(false)
  const [generationError, setGenerationError] = useState('')
  const request = useRef(0)
  const busy = loading || generating
  const stale = snapshot !== null && snapshot.revision !== revision
  const { mode: printMode, printing, error: printError, print } = usePrint()
  const printReady = snapshot !== null && !stale && !busy && !generationError
  const printLayout = snapshot ? worksheetLayout(snapshot.puzzle) : null

  useEffect(() => () => { request.current++ }, [])

  function changedInputs() {
    request.current++
    setRevision(value => value + 1)
    setGenerating(false)
    setGenerationError('')
  }

  async function generate() {
    if (!image || rowsError || columnsError || gridRows === undefined || gridColumns === undefined) {
      setGenerationError('Choose a picture and valid grid dimensions first.')
      return
    }
    const id = ++request.current
    setGenerating(true)
    setGenerationError('')
    // Yield once so the busy state paints before bounded CPU/canvas work.
    await new Promise<void>(resolve => setTimeout(resolve, 30))
    if (id !== request.current) return
    try {
      const grid = processImage(image, gridRows, gridColumns)
      setSnapshot({ puzzle: createPuzzle(grid), revision })
      setView('puzzle')
    } catch (cause) {
      setGenerationError(cause instanceof Error ? cause.message : 'Could not create the puzzle. Please try again.')
    } finally {
      if (id === request.current) setGenerating(false)
    }
  }

  return (
    <>
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="./"><span className="brand-icon" aria-hidden="true">+</span>MathDraw</a>
        <span className="privacy-note">Made on your device. Kept on your device.</span>
      </header>
      <main>
        <section className="intro">
          <p className="eyebrow">A little math. A little magic.</p>
          <h1>Little sums,<br /><span>big pictures.</span></h1>
          <p>Turn a favorite picture into a color-by-addition adventure.<br className="desktop-break" /> Just print, solve, and bring it to life.</p>
        </section>
        <div className="workspace">
          <section className="setup panel" aria-labelledby="setup-title">
            <h2 id="setup-title">Make it yours</h2>
            <label className="field-label" htmlFor="image">1. Choose a picture</label>
            <div className="upload-box">
              <span className="upload-icon" aria-hidden="true">+</span>
              <input id="image" type="file" accept="image/png,image/jpeg,image/webp" disabled={printing} aria-describedby="image-help image-error" aria-invalid={Boolean(imageError)} onChange={event => { changedInputs(); void selectFile(event.target.files?.[0]) }} />
              <p id="image-help">PNG, JPG, or WebP. Up to 10 MiB.<br />Simple pictures work best.</p>
              {image && <img className="source-preview" src={image.previewUrl} alt={`Original picture: ${image.name}`} />}
            </div>
            <p className="field-error" role="alert" id="image-error">{imageError}</p>
            <p className="field-label">2. Pick your grid</p>
            <label className="toggle-field"><input type="checkbox" checked={autoSize} disabled={printing} onChange={event => { changedInputs(); setAutoSize(event.target.checked) }} />Auto size from picture</label>
            {autoSize && <p className="help" role="status">{autoGrid ? `Auto size: ${autoGrid.columns} columns x ${autoGrid.rows} rows.` : 'Choose a picture to calculate the grid.'} Fits within 24 x 24 for A4.</p>}
            <div className="dimension-fields">
              <div>
                <label htmlFor="columns">Columns</label>
                <input id="columns" type="number" min="4" max="64" step="1" disabled={printing || autoSize} value={autoSize ? autoGrid?.columns ?? '' : columns} onChange={event => { changedInputs(); setColumns(event.target.value) }} aria-invalid={Boolean(columnsError)} aria-describedby="grid-help columns-error" />
                <p className="field-error" id="columns-error">{columnsError}</p>
              </div>
              <span aria-hidden="true" className="dimension-cross">x</span>
              <div>
                <label htmlFor="rows">Rows</label>
                <input id="rows" type="number" min="4" max="24" step="1" disabled={printing || autoSize} value={autoSize ? autoGrid?.rows ?? '' : rows} onChange={event => { changedInputs(); setRows(event.target.value) }} aria-invalid={Boolean(rowsError)} aria-describedby="grid-help rows-error" />
                <p className="field-error" id="rows-error">{rowsError}</p>
              </div>
            </div>
            <p className="help" id="grid-help">4-24 rows and 4-64 columns. 24 columns best fits A4.</p>
            {!columnsError && gridColumns !== undefined && gridColumns > 24 && <p className="stale-notice" role="status">24 columns best fits A4. Choose larger paper for this wider grid; cells will not be shrunk.</p>}
            <button className="primary-button" disabled={busy || printing || !image || Boolean(rowsError || columnsError)} onClick={() => void generate()}>{generating ? 'Creating your puzzle...' : 'Create puzzle'}</button>
            <p className="help status" role="status">{loading ? 'Opening your picture...' : generating ? 'Finding colors and making your grid...' : ''}</p>
            <p className="field-error" role="alert">{generationError}</p>
            <p className="local-note">Your picture stays in this browser. No uploads, no accounts.</p>
          </section>
          <section className="preview panel" aria-label="Puzzle preview" aria-busy={busy}>
            {snapshot ? (
              <div className="generated-preview">
                {stale && <p className="stale-notice" role="status">Previous puzzle. Create a new puzzle to apply your changes.</p>}
                <div className="preview-toolbar">
                  <div className="view-switch" role="group" aria-label="Preview mode">
                    <button aria-pressed={view === 'puzzle'} onClick={() => setView('puzzle')}>Puzzle</button>
                    <button aria-pressed={view === 'solution'} onClick={() => setView('solution')}>Solution</button>
                  </div>
                  <span className="preview-badge">Ready for little artists</span>
                </div>
                <p id="worksheet-scroll-help" className="scroll-hint">On a small screen? Scroll the worksheet sideways to see every square.</p>
                <div className="worksheet-scroll" tabIndex={0} role="region" aria-label="Scrollable worksheet preview" aria-describedby="worksheet-scroll-help">
                  <Worksheet puzzle={snapshot.puzzle} mode={view} />
                </div>
                <p className="help">Colors are simplified to keep them distinct. Use the closest pencils or crayons you have.</p>
                <div className="print-actions">
                  <button disabled={!printReady || printing} onClick={() => void print('puzzle')}>Print puzzle</button>
                  <button disabled={!printReady || printing} onClick={() => void print('solution')}>Print answer key</button>
                </div>
                {printLayout?.needsLargerPaper && <p className="stale-notice" role="status">Choose larger paper: this worksheet needs at least {printLayout.paperWidthMm} mm wide x {printLayout.paperHeightMm} mm tall, including margins. Keep 100% scale to preserve readable cells. Smaller paper may clip the puzzle.</p>}
                <p className="help print-help">{printLayout?.needsLargerPaper ? 'Select paper and orientation large enough for the worksheet.' : 'One portrait A4 or Letter page.'} Print in color at 100% scale, with browser headers and footers off. Printer settings may change the layout and colors.</p>
                {printing && <p className="print-status" role="status">Print dialog open or preparing. Close it to continue editing.</p>}
                <p className="field-error" role="alert">{printError}</p>
              </div>
            ) : <div className="empty-state">
              <div className="pixel-flower" aria-hidden="true">
                {Array.from({ length: 25 }, (_, index) => <span key={index} className={[2, 6, 7, 8, 10, 11, 13, 14, 16, 17, 18, 22].includes(index) ? 'petal' : index === 12 ? 'center' : ''} />)}
              </div>
              <p className="eyebrow">Picture it. Solve it. Color it.</p>
              <h2>Your next little masterpiece</h2>
              <p>Choose a picture to get started.<br />We will turn it into simple sums and up to 8 colors.</p>
              <div className="step-pills"><span>1 + 2</span><span>Pick a color</span><span>Find the picture</span></div>
            </div>}
          </section>
        </div>
        <section className="how-it-works" aria-label="How it works">
          <p><strong>01 / Make</strong> A favorite photo becomes a tiny pixel picture.</p>
          <p><strong>02 / Solve</strong> Every square has a sum using numbers 1-9.</p>
          <p><strong>03 / Color</strong> Match answers to colors and reveal the picture.</p>
        </section>
      </main>
      <footer>Less screen time. More pencil time.</footer>
    </div>
    <div className="print-root">
      {printReady && snapshot ? <Worksheet puzzle={snapshot.puzzle} mode={printMode} /> : <p className="print-unavailable">Create a puzzle with your current picture and grid settings before printing.</p>}
    </div>
    </>
  )
}

export default App
