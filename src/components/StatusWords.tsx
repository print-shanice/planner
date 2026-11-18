import type { ReactNode } from 'react'

export type StatusWord<T extends string> = [value: T, word: string, tone?: 'ok' | 'warn']

// a status as the card says it: [idea] [to book] [booked], the one it is pressed (shanice, 18 nov: never a switch)
export function StatusWords<T extends string>({ label, value, options, onPick, disabled, help }: {
  label: string; value: T; options: StatusWord<T>[]; onPick: (v: T) => void; disabled?: boolean; help?: ReactNode
}) {
  return (
    <span className="status-words">
      <span className="card-options status" role="group" aria-label={label}>
        {options.map(([v, word, tone]) => (
          <button key={v} type="button" className={tone ?? ''} aria-pressed={value === v} disabled={disabled} onClick={() => onPick(v)}>{word}</button>
        ))}
      </span>
      {help}
    </span>
  )
}

// a place, stay or journey; a note is to do or done (tapping the pressed one makes it a plain note again)
export const STOP_WORDS: StatusWord<'idea' | 'to_book' | 'booked'>[] = [['idea', 'idea'], ['to_book', 'to book', 'warn'], ['booked', 'booked', 'ok']]
export const NOTE_WORDS: StatusWord<'idea' | 'to_book' | 'booked'>[] = [['to_book', 'to do', 'warn'], ['booked', 'done', 'ok']]
