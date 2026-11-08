// yes or no, as an on/off switch instead of a row of pills
export function Switch({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" role="switch" className="switch-row" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}>
      <span>{label}</span>
      <span className="switch" aria-hidden="true" />
    </button>
  )
}
