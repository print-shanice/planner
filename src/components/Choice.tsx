export type Tone = 'idle' | 'warn' | 'ok'
type Option<T> = { value: T; label: string; tone?: Tone }
type Props<T> = { label: string; options: Option<T>[]; value: T; onChange: (v: T) => void }

// one of a few states, each in its colour (grey idea / not paid, amber to book, green booked / paid), like the pills in the plan
export function Choice<T extends string | boolean>({ label, options, value, onChange }: Props<T>) {
  return (
    <div className="choice" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" className={`choice-chip ${o.tone ?? 'idle'}`} aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          <span className="dot" aria-hidden />{o.label}
        </button>
      ))}
    </div>
  )
}
