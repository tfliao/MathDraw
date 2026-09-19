import { useEffect, useMemo, useRef, useState } from 'react'
import { autoDimensions, dimensionError, MAX_COLUMNS, MAX_ROWS } from './domain/dimensions'
import { worksheetLayout } from './domain/layout'
import { createPuzzle } from './domain/puzzle'
import type { Puzzle } from './domain/puzzle'
import { processImage } from './image/process'
import { useImageInput } from './image/useImageInput'
import { Worksheet } from './components/Worksheet'
import type { ViewMode } from './components/Worksheet'
import { usePrint } from './components/usePrint'
import { AdvancedSettings } from './components/AdvancedSettings'
import { DEFAULT_DRAFT, parseSettings } from './components/settingsDraft'
import { buildProblemPool, settingsErrors } from './domain/settings'
import { useLanguage } from './i18n/useLanguage'
import { isLanguage, UserFacingError, userFacingError } from './i18n/locale'
import './App.css'
import './print.css'

function App() {
  const { language, messages: t, setLanguage, storageUnavailable } = useLanguage()
  const [rows, setRows] = useState('20')
  const [columns, setColumns] = useState('16')
  const [autoSize, setAutoSize] = useState(true)
  const [settingsDraft, setSettingsDraft] = useState(DEFAULT_DRAFT)
  const settings = useMemo(() => parseSettings(settingsDraft), [settingsDraft])
  const invalidSettings = Object.values(settingsErrors(settings)).some(Boolean)
  const resultCapacity = useMemo(() => invalidSettings ? 0 : buildProblemPool(settings).size, [settings, invalidSettings])
  const effectiveColors = Math.min(settings.maxColors, resultCapacity)
  const noResults = !invalidSettings && resultCapacity === 0
  const rowsError = autoSize ? null : dimensionError(rows, 'rows', t)
  const columnsError = autoSize ? null : dimensionError(columns, 'columns', t)
  const { image, loading, error: imageError, selectFile } = useImageInput()
  const autoGrid = image ? autoDimensions(image.bitmap.width, image.bitmap.height) : null
  const gridRows = autoSize ? autoGrid?.rows : Number(rows)
  const gridColumns = autoSize ? autoGrid?.columns : Number(columns)
  const [snapshot, setSnapshot] = useState<{ puzzle: Puzzle; revision: number } | null>(null)
  const [view, setView] = useState<ViewMode>('puzzle')
  const [revision, setRevision] = useState(0)
  const [generating, setGenerating] = useState(false)
  const [generationError, setGenerationError] = useState<UserFacingError | null>(null)
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
    setGenerationError(null)
  }

  async function generate() {
    if (!image || rowsError || columnsError || invalidSettings || noResults || gridRows === undefined || gridColumns === undefined) {
      setGenerationError(new UserFacingError(noResults ? 'noResults' : 'invalidSetup'))
      return
    }
    const id = ++request.current
    setGenerating(true)
    setGenerationError(null)
    // Yield once so the busy state paints before bounded CPU/canvas work.
    await new Promise<void>(resolve => setTimeout(resolve, 30))
    if (id !== request.current) return
    try {
      const grid = processImage(image, gridRows, gridColumns, effectiveColors)
      setSnapshot({ puzzle: createPuzzle(grid, settings), revision })
      setView('puzzle')
    } catch (cause) {
      setGenerationError(userFacingError(cause, 'generationFailed'))
    } finally {
      if (id === request.current) setGenerating(false)
    }
  }

  return (
    <>
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="./"><span className="brand-icon" aria-hidden="true">+</span>MathDraw</a>
        <div className="header-tools">
          <span className="privacy-note">{t.privacy}</span>
          <label className="language-field" htmlFor="language">{t.language}
            <select id="language" value={language} disabled={printing} onChange={event => {
              if (isLanguage(event.target.value)) setLanguage(event.target.value)
            }}>
              <option value="en" lang="en">{t.english}</option>
              <option value="zh-TW" lang="zh-TW">{t.traditionalChinese}</option>
            </select>
          </label>
        </div>
      </header>
      {storageUnavailable && <p className="stale-notice" role="status">{t.storageUnavailable}</p>}
      <main>
        <section className="intro">
          <p className="eyebrow">{t.eyebrow}</p>
          <h1>{t.headingStart}<br /><span>{t.headingEnd}</span></h1>
          <p>{t.introduction}<br className="desktop-break" /> {t.introductionEnd}</p>
        </section>
        <div className="workspace">
          <section className="setup panel" aria-labelledby="setup-title">
            <h2 id="setup-title">{t.setup}</h2>
            <label className="field-label" htmlFor="image">{t.choosePicture}</label>
            <div className="upload-box">
              <span className="upload-icon" aria-hidden="true">+</span>
              <input id="image" type="file" accept="image/png,image/jpeg,image/webp" disabled={printing} aria-describedby="image-help image-error" aria-invalid={Boolean(imageError)} onChange={event => { changedInputs(); void selectFile(event.target.files?.[0]) }} />
              <p id="image-help">{t.imageHelp}<br />{t.simplePictures}</p>
              {image && <>
                <img className="source-preview" src={image.previewUrl} alt={t.originalPicture(image.name)} aria-describedby="image-dimensions" />
                <p id="image-dimensions" role="status">{t.imageDimensions(image.bitmap.width, image.bitmap.height)}</p>
              </>}
            </div>
            <p className="field-error" role="alert" id="image-error">{imageError && t[imageError.code]}</p>
            <p className="field-label">{t.pickGrid}</p>
            <label className="toggle-field"><input type="checkbox" checked={autoSize} disabled={printing} onChange={event => { changedInputs(); setAutoSize(event.target.checked) }} />{t.autoSize}</label>
            {autoSize && <p className="help" role="status">{autoGrid ? t.autoSizeValue(autoGrid.columns, autoGrid.rows) : t.chooseForSize} {t.autoSizeHelp}</p>}
            <div className="dimension-fields">
              <div>
                <label htmlFor="columns">{t.columns}</label>
                <input id="columns" type="number" min="4" max={MAX_COLUMNS} step="1" disabled={printing || autoSize} value={autoSize ? autoGrid?.columns ?? '' : columns} onChange={event => { changedInputs(); setColumns(event.target.value) }} aria-invalid={Boolean(columnsError)} aria-describedby="grid-help columns-error" />
                <p className="field-error" id="columns-error">{columnsError}</p>
              </div>
              <span aria-hidden="true" className="dimension-cross">x</span>
              <div>
                <label htmlFor="rows">{t.rows}</label>
                <input id="rows" type="number" min="4" max={MAX_ROWS} step="1" disabled={printing || autoSize} value={autoSize ? autoGrid?.rows ?? '' : rows} onChange={event => { changedInputs(); setRows(event.target.value) }} aria-invalid={Boolean(rowsError)} aria-describedby="grid-help rows-error" />
                <p className="field-error" id="rows-error">{rowsError}</p>
              </div>
            </div>
            <p className="help" id="grid-help">{t.gridHelp}</p>
            {!columnsError && gridColumns !== undefined && gridColumns > 24 && <p className="stale-notice" role="status">{t.widerGrid}</p>}
            {!rowsError && gridRows !== undefined && gridRows > 24 && <p className="stale-notice" role="status">{t.tallerGrid}</p>}
            <label className="toggle-field"><input type="checkbox" checked={settingsDraft.skipBackground} disabled={printing} aria-describedby="background-help" onChange={event => { changedInputs(); setSettingsDraft({ ...settingsDraft, skipBackground: event.target.checked }) }} />{t.skipBackground}</label>
            <p className="help" id="background-help">{t.backgroundHelp}</p>
            <AdvancedSettings value={settingsDraft} disabled={printing} onChange={value => { changedInputs(); setSettingsDraft(value) }} />
            {invalidSettings && <p className="field-error" role="alert">{t.invalidAdvanced}</p>}
            {noResults && <p className="field-error" role="alert">{t.noResults}</p>}
            {!invalidSettings && !noResults && effectiveColors < settings.maxColors && <p className="stale-notice" role="status">{t.reducedColors(resultCapacity, effectiveColors)}</p>}
            <button className="primary-button" disabled={busy || printing || invalidSettings || noResults || !image || Boolean(rowsError || columnsError)} onClick={() => void generate()}>{generating ? t.creating : t.create}</button>
            <p className="help status" role="status">{loading ? t.openingPicture : generating ? t.findingColors : ''}</p>
            <p className="field-error" role="alert">{generationError && t[generationError.code]}</p>
            <p className="local-note">{t.localNote}</p>
          </section>
          <section className="preview panel" aria-label={t.preview} aria-busy={busy}>
            {snapshot ? (
              <div className="generated-preview">
                {stale && <p className="stale-notice" role="status">{t.stale}</p>}
                <div className="preview-toolbar">
                  <div className="view-switch" role="group" aria-label={t.previewMode}>
                    <button aria-pressed={view === 'puzzle'} onClick={() => setView('puzzle')}>{t.puzzle}</button>
                    <button aria-pressed={view === 'solution'} onClick={() => setView('solution')}>{t.solution}</button>
                  </div>
                  <span className="preview-badge">{t.ready}</span>
                </div>
                <p id="worksheet-scroll-help" className="scroll-hint">{t.scrollHelp}</p>
                <div className="worksheet-scroll" tabIndex={0} role="region" aria-label={t.scrollPreview} aria-describedby="worksheet-scroll-help">
                  <Worksheet puzzle={snapshot.puzzle} mode={view} />
                </div>
                <p className="help">{t.colorHelp}</p>
                <div className="print-actions">
                  <button disabled={!printReady || printing} onClick={() => void print('puzzle')}>{t.printPuzzle}</button>
                  <button disabled={!printReady || printing} onClick={() => void print('solution')}>{t.printAnswer}</button>
                </div>
                {printLayout?.needsLargerPaper && <p className="stale-notice" role="status">{t.largerPaper(printLayout.paperWidthMm, printLayout.paperHeightMm)}</p>}
                <p className="help print-help">{printLayout?.needsLargerPaper ? t.selectPaper : t.onePage} {t.printHelp}</p>
                {printing && <p className="print-status" role="status">{t.printing}</p>}
                <p className="field-error" role="alert">{printError && t[printError.code]}</p>
              </div>
            ) : <div className="empty-state">
              <div className="pixel-flower" aria-hidden="true">
                {Array.from({ length: 25 }, (_, index) => <span key={index} className={[2, 6, 7, 8, 10, 11, 13, 14, 16, 17, 18, 22].includes(index) ? 'petal' : index === 12 ? 'center' : ''} />)}
              </div>
              <p className="eyebrow">{t.emptyEyebrow}</p>
              <h2>{t.emptyTitle}</h2>
              <p>{t.emptyStart}<br />{t.emptyHelp}</p>
              <div className="step-pills"><span>1 + 2</span><span>{t.pickColor}</span><span>{t.findPicture}</span></div>
            </div>}
          </section>
        </div>
        <section className="how-it-works" aria-label={t.howItWorks}>
          <p><strong>{t.makeStep}</strong> {t.makeHelp}</p>
          <p><strong>{t.solveStep}</strong> {t.solveHelp}</p>
          <p><strong>{t.colorStep}</strong> {t.colorStepHelp}</p>
        </section>
      </main>
      <footer>{t.footer}</footer>
    </div>
    <div className="print-root">
      {printReady && snapshot ? <Worksheet puzzle={snapshot.puzzle} mode={printMode} /> : <p className="print-unavailable">{t.printUnavailable}</p>}
    </div>
    </>
  )
}

export default App
