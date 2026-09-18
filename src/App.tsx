import { useState } from 'react'
import { dimensionError } from './domain/dimensions'
import './App.css'

function App() {
  const [rows, setRows] = useState('20')
  const [columns, setColumns] = useState('16')
  const rowsError = dimensionError(rows)
  const columnsError = dimensionError(columns)

  return (
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
              <input id="image" type="file" accept="image/png,image/jpeg,image/webp" aria-describedby="image-help" />
              <p id="image-help">PNG, JPG, or WebP. Up to 10 MiB.<br />Simple pictures work best.</p>
            </div>
            <p className="field-label">2. Pick your grid</p>
            <div className="dimension-fields">
              <div>
                <label htmlFor="columns">Columns</label>
                <input id="columns" type="number" min="4" max="24" step="1" value={columns} onChange={event => setColumns(event.target.value)} aria-invalid={Boolean(columnsError)} aria-describedby="grid-help columns-error" />
                <p className="field-error" id="columns-error">{columnsError}</p>
              </div>
              <span aria-hidden="true" className="dimension-cross">x</span>
              <div>
                <label htmlFor="rows">Rows</label>
                <input id="rows" type="number" min="4" max="24" step="1" value={rows} onChange={event => setRows(event.target.value)} aria-invalid={Boolean(rowsError)} aria-describedby="grid-help rows-error" />
                <p className="field-error" id="rows-error">{rowsError}</p>
              </div>
            </div>
            <p className="help" id="grid-help">4-24 in each direction. One page of possibilities.</p>
            <button className="primary-button" disabled>Create puzzle</button>
            <p className="local-note">Your picture stays in this browser. No uploads, no accounts.</p>
          </section>
          <section className="preview panel" aria-label="Puzzle preview">
            <div className="empty-state">
              <div className="pixel-flower" aria-hidden="true">
                {Array.from({ length: 25 }, (_, index) => <span key={index} className={[2, 6, 7, 8, 10, 11, 13, 14, 16, 17, 18, 22].includes(index) ? 'petal' : index === 12 ? 'center' : ''} />)}
              </div>
              <p className="eyebrow">Picture it. Solve it. Color it.</p>
              <h2>Your next little masterpiece</h2>
              <p>Choose a picture to get started.<br />We will turn it into simple sums and up to 8 colors.</p>
              <div className="step-pills"><span>1 + 2</span><span>Pick a color</span><span>Find the picture</span></div>
            </div>
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
  )
}

export default App
