import { MAX_RESULT, OPERATORS } from '../domain/settings'
import { settingsErrors } from '../domain/settings'
import { parseSettings } from './settingsDraft'
import type { SettingsDraft } from './settingsDraft'
import { useLanguage } from '../i18n/useLanguage'

export function AdvancedSettings({ value, onChange, disabled }: { value: SettingsDraft; onChange: (value: SettingsDraft) => void; disabled: boolean }) {
  const { messages: t } = useLanguage()
  const errors = settingsErrors(parseSettings(value), t)
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
        <label htmlFor="max-colors">{t.maxColors}</label>
        <input id="max-colors" type="number" min="1" max="16" step="1" value={value.maxColors} onChange={event => onChange({ ...value, maxColors: event.target.value })} aria-invalid={Boolean(errors.maxColors)} aria-describedby="colors-help colors-error" />
        <p id="colors-error" className="field-error">{errors.maxColors}</p>
        <p id="colors-help" className="help">{t.colorsHelp}</p>
      </fieldset>
    </details>
  )
}
