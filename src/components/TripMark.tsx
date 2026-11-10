import { CountryFlag } from './CountryFlag'

// what a trip looks like wherever it's named: the flags of where it goes, plain (Shanice: no colour ring).
// a trip with no country yet is just its colour
export function TripMark({ codes, max = 4 }: { codes: string[]; max?: number }) {
  if (!codes.length) return <span className="dot" aria-hidden="true" />
  return <span className="trip-mark">{codes.slice(0, max).map((c) => <CountryFlag key={c} code={c} />)}</span>
}
