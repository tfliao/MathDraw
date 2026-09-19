import { OPERATORS } from '../domain/settings'
import { settingsErrors } from '../domain/settings'
import { parseSettings } from './settingsDraft'
import type { SettingsDraft } from './settingsDraft'

export function AdvancedSettings({ value, onChange, disabled }: { value: SettingsDraft; onChange: (value: SettingsDraft) => void; disabled: boolean }) {
  const errors = settingsErrors(parseSettings(value))
  return (
    <details className="advanced-settings">
      <summary>Advanced</summary>
      <fieldset disabled={disabled}>
        <legend>Difficulty</legend>
        <label className="toggle-field"><input type="checkbox" checked={value.allowZero} onChange={event => onChange({ ...value, allowZero: event.target.checked })} />Allow zero operands</label>
        <label htmlFor="max-operand">Maximum operand</label>
        <input id="max-operand" type="number" min="2" max="99" step="1" value={value.maxOperand} onChange={event => onChange({ ...value, maxOperand: event.target.value })} aria-invalid={Boolean(errors.maxOperand)} aria-describedby="operand-help operand-error" />
        <p id="operand-help" className="help">Operands range from {value.allowZero ? '0' : '1'} to your maximum (2-99).</p>
        <p id="operand-error" className="field-error">{errors.maxOperand}</p>
        <fieldset className="operator-options" aria-describedby="operator-help operator-error">
          <legend>Operators</legend>
          {OPERATORS.map(operator => (
            <label key={operator}><input type="checkbox" checked={value.operators.includes(operator)} aria-invalid={Boolean(errors.operators)} onChange={event => onChange({ ...value, operators: event.target.checked ? OPERATORS.filter(candidate => candidate === operator || value.operators.includes(candidate)) : value.operators.filter(candidate => candidate !== operator) })} />{operator === '+' ? 'Addition (+)' : operator === '-' ? 'Subtraction (-)' : 'Multiplication (*)'}</label>
          ))}
        </fieldset>
        <p id="operator-error" className="field-error">{errors.operators}</p>
        <p id="operator-help" className="help">Select one or more. Subtraction answers are never negative, but can be zero.</p>
        <label className="toggle-field"><input type="checkbox" checked={value.multiMap} onChange={event => onChange({ ...value, multiMap: event.target.checked })} aria-describedby="multimap-help" />Multiple results per color</label>
        <p id="multimap-help" className="help">Use up to 3 answers per color. Every answer still has exactly one color.</p>
        <label htmlFor="max-colors">Maximum colors</label>
        <input id="max-colors" type="number" min="1" max="16" step="1" value={value.maxColors} onChange={event => onChange({ ...value, maxColors: event.target.value })} aria-invalid={Boolean(errors.maxColors)} aria-describedby="colors-help colors-error" />
        <p id="colors-error" className="field-error">{errors.maxColors}</p>
        <p id="colors-help" className="help">1-16 colors. Similar shades merge; available math answers may lower this limit.</p>
      </fieldset>
    </details>
  )
}
