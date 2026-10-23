import { isResizeAlgorithm, MAX_RESULT, OPERATORS, RESIZE_ALGORITHMS, settingsErrors } from '../domain/settings'
import { parseSettings } from './settingsDraft'
import type { SettingsDraft } from './settingsDraft'
import { useLanguage } from '../i18n/useLanguage'
import { CRAYON_SET_IDS, CRAYON_SETS, isOutputColorSet } from '../domain/crayonSets'
import { toHex } from '../domain/color'

export function AdvancedSettings({ value, onChange, disabled }: { value: SettingsDraft; onChange: (value: SettingsDraft) => void; disabled: boolean }) {
  const { messages: t } = useLanguage()
  const errors = settingsErrors(parseSettings(value), t)
  const resizeLabels = { pica: t.resizePica, nearest: t.resizeNearest, browser: t.resizeBrowser, foreground: t.resizeForeground }
  const crayonSet = value.outputColorSet === 'image' ? null : CRAYON_SETS[value.outputColorSet]
  return (
    <details className="advanced-settings">
      <summary>{t.advanced}</summary>
      <fieldset disabled={disabled}>
        <legend>{t.difficulty}</legend>
        <label className="toggle-field"><input type="checkbox" checked={value.allowZero} onChange={event => onChange({ ...value, allowZero: event.target.checked })} />{t.allowZero}</label>
        <label htmlFor="max-operand">{t.maxOperand}</label>
        <input id="max-operand" type="number" min="2" max="99" step="1" value={value.maxOperand} onChange={event => onChange({ ...value, maxOperand: event.target.value })} aria-invalid={Boolean(errors.maxOperand)} aria-describedby="operand-help operand-error" />
        <p id="operand-help" className="help">{t.operandHelp(value.allowZero ? 0 : 1)}</p>
        <p id="operand-error" className="field-error">{errors.maxOperand}</p>
        <fieldset className="operator-options" aria-describedby="operator-help operator-error">
          <legend>{t.operators}</legend>
          {OPERATORS.map(operator => (
            <label key={operator}><input type="checkbox" checked={value.operators.includes(operator)} aria-invalid={Boolean(errors.operators)} onChange={event => onChange({ ...value, operators: event.target.checked ? OPERATORS.filter(candidate => candidate === operator || value.operators.includes(candidate)) : value.operators.filter(candidate => candidate !== operator) })} />{operator === '+' ? t.addition : operator === '-' ? t.subtraction : t.multiplication}</label>
          ))}
        </fieldset>
        <p id="operator-error" className="field-error">{errors.operators}</p>
        <p id="operator-help" className="help">{t.operatorHelp}</p>
        <label htmlFor="max-result">{t.maxResult}</label>
        <input id="max-result" type="number" min="0" max={MAX_RESULT} step="1" value={value.maxResult} onChange={event => onChange({ ...value, maxResult: event.target.value })} aria-invalid={Boolean(errors.maxResult)} aria-describedby="result-help result-error" />
        <p id="result-error" className="field-error">{errors.maxResult}</p>
        <p id="result-help" className="help">{t.resultHelp}</p>
        <label className="toggle-field"><input type="checkbox" checked={value.allowZeroResults} onChange={event => onChange({ ...value, allowZeroResults: event.target.checked })} aria-describedby="zero-result-help" />{t.allowZeroResults}</label>
        <p id="zero-result-help" className="help">{t.zeroResultHelp}</p>
        <label className="toggle-field"><input type="checkbox" checked={value.multiMap} onChange={event => onChange({ ...value, multiMap: event.target.checked })} aria-describedby="multimap-help" />{t.multiMap}</label>
        <p id="multimap-help" className="help">{t.multiMapHelp}</p>
        <label htmlFor="max-results-per-color">{t.maxResultsPerColor}</label>
        <input id="max-results-per-color" type="number" min="1" max="8" step="1" value={value.maxResultsPerColor} onChange={event => onChange({ ...value, maxResultsPerColor: event.target.value })} aria-invalid={Boolean(errors.maxResultsPerColor)} aria-describedby="results-per-color-help results-per-color-error" />
        <p id="results-per-color-error" className="field-error">{errors.maxResultsPerColor}</p>
        <p id="results-per-color-help" className="help">{t.resultsPerColorHelp}</p>
      </fieldset>
      <fieldset disabled={disabled}>
        <legend>{t.imageSettings}</legend>
        <label htmlFor="output-color-set">{t.outputColorSet}</label>
        <select id="output-color-set" value={value.outputColorSet} onChange={event => {
          const outputColorSet = event.target.value
          if (isOutputColorSet(outputColorSet)) onChange({ ...value, outputColorSet })
        }} aria-invalid={Boolean(errors.outputColorSet)} aria-describedby="color-set-help color-set-error">
          <option value="image">{t.imageColors}</option>
          {CRAYON_SET_IDS.map(id => <option key={id} value={id}>{t.crayonSetName(CRAYON_SETS[id].colors.length)}</option>)}
        </select>
        <p id="color-set-error" className="field-error">{errors.outputColorSet}</p>
        <p id="color-set-help" className="help">{t.colorSetHelp}</p>
        {crayonSet && <div className="crayon-preview">
          <p className="help">{t.crayonEdition}</p>
          <div className="crayon-strip" aria-hidden="true">{crayonSet.colors.map(color => <span key={color.id} style={{ backgroundColor: toHex(color.rgb) }} />)}</div>
          <details>
            <summary>{t.viewCrayonColors(crayonSet.colors.length)}</summary>
            <ul className="crayon-colors">{crayonSet.colors.map(color => <li key={color.id}>
              <span className="crayon-chip" style={{ backgroundColor: toHex(color.rgb) }} aria-hidden="true" />
              <span>{color.id === 'white' ? `${color.name} (${t.leaveWhite})` : color.name}<small>{toHex(color.rgb)}</small></span>
            </li>)}</ul>
          </details>
        </div>}
        <label htmlFor="resize-algorithm">{t.resizeAlgorithm}</label>
        <select id="resize-algorithm" value={value.resizeAlgorithm} onChange={event => {
          const resizeAlgorithm = event.target.value
          if (isResizeAlgorithm(resizeAlgorithm)) onChange({ ...value, resizeAlgorithm })
        }} aria-invalid={Boolean(errors.resizeAlgorithm)} aria-describedby="resize-help resize-error">
          {RESIZE_ALGORITHMS.map(algorithm => <option key={algorithm} value={algorithm}>{resizeLabels[algorithm]}</option>)}
        </select>
        <p id="resize-error" className="field-error">{errors.resizeAlgorithm}</p>
        <p id="resize-help" className="help">{t.resizeHelp}</p>
        <label className="toggle-field"><input type="checkbox" checked={value.mergeSimilarColors} onChange={event => onChange({ ...value, mergeSimilarColors: event.target.checked })} aria-describedby="merge-colors-help" />{t.mergeSimilarColors}</label>
        <p id="merge-colors-help" className="help">{crayonSet ? t.crayonMergeHelp : t.mergeSimilarColorsHelp}</p>
        <label htmlFor="max-colors">{t.maxColors}</label>
        <input id="max-colors" type="number" min="1" max="16" step="1" value={value.maxColors} onChange={event => onChange({ ...value, maxColors: event.target.value })} aria-invalid={Boolean(errors.maxColors)} aria-describedby="colors-help colors-error" />
        <p id="colors-error" className="field-error">{errors.maxColors}</p>
        <p id="colors-help" className="help">{crayonSet ? t.crayonColorsHelp : t.colorsHelp}</p>
      </fieldset>
    </details>
  )
}
