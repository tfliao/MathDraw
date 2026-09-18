import { useEffect, useRef, useState } from 'react'
import { dimensionError } from './domain/dimensions'
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
  const rowsError = dimensionError(rows)
  const columnsError = dimensionError(columns)
  const { image, loading, error: imageError, selectFile } = useImageInput()
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

  useEffect(() => () => { request.current++ }, [])

  function changedInputs() {
    request.current++
    setRevision(value => value + 1)
    setGenerating(false)
    setGenerationError('')
  }

  async function generate() {
    if (!image || rowsError || columnsError) {
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
      const grid = processImage(image, Number(rows), Number(columns))
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
            <div className="dimension-fields">
              <div>
                <label htmlFor="columns">Columns</label>
                <input id="columns" type="number" min="4" max="24" step="1" disabled={printing} value={columns} onChange={event => { changedInputs(); setColumns(event.target.value) }} aria-invalid={Boolean(columnsError)} aria-describedby="grid-help columns-error" />
                <p className="field-error" id="columns-error">{columnsError}</p>
              </div>
              <span aria-hidden="true" className="dimension-cross">x</span>
              <div>
                <label htmlFor="rows">Rows</label>
                <input id="rows" type="number" min="4" max="24" step="1" disabled={printing} value={rows} onChange={event => { changedInputs(); setRows(event.target.value) }} aria-invalid={Boolean(rowsError)} aria-describedby="grid-help rows-error" />
                <p className="field-error" id="rows-error">{rowsError}</p>
              </div>
            </div>
            <p className="help" id="grid-help">4-24 in each direction. One page of possibilities.</p>
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
                <div className="worksheet-scroll" tabIndex={0} role="region" aria-label="Scrollable worksheet preview">
                  <Worksheet puzzle={snapshot.puzzle} mode={view} />
                </div>
                <p className="help">Colors are simplified to keep them distinct. Use the closest pencils or crayons you have.</p>
                <div className="print-actions">
                  <button disabled={!printReady || printing} onClick={() => void print('puzzle')}>Print puzzle</button>
                  <button disabled={!printReady || printing} onClick={() => void print('solution')}>Print answer key</button>
                </div>
                <p className="help print-help">One portrait A4 or Letter page. Print in color at 100% scale, with browser headers and footers off. Printer settings may change the layout and colors.</p>
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
