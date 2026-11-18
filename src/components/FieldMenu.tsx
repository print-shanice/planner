import { ChoiceMenu, type Choice } from './ChoiceMenu'

// a form's pick-from-a-list: its label, then the planner's own dropdown showing what's picked (shanice, 18 nov: never a native select)
export function FieldMenu({ label, value, options, onPick, disabled, className = '' }: {
  label: string; value: string; options: Choice[]; onPick: (value: string) => void; disabled?: boolean; className?: string
}) {
  const shown = options.find((o) => o.value === value)?.label ?? value
  return (
    <div className={`field field-menu ${className}`.trim()}>
      <span className="label" aria-hidden="true">{label}</span>
      <ChoiceMenu label={shown} ariaLabel={label} options={options} selected={value} onPick={onPick} disabled={disabled} align="left" />
    </div>
  )
}
