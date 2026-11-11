// yes or no, as an on/off switch instead of a row of pills
import { Help } from './Tooltip'

export function Switch({ label, checked, onChange, disabled, help }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; help?: string }) {
  const control = (
    <button type="button" role="switch" className="switch-row" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}>
      <span>{label}</span>
      <span className="switch" aria-hidden="true" />
    </button>
  )
  return help ? <div className="help-row">{control}<Help label={`about ${label}`}>{help}</Help></div> : control
}
