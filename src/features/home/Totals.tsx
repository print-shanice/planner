import { useId } from 'react'

export function Totals({ countries, cities, trips }: { countries: number; cities: number; trips: number }) {
  const id = useId()
  const items: [number, string][] = [[countries, 'countries'], [cities, 'cities'], [trips, 'trips']]
  return (
    <div className="totals-block">
      <p id={id} className="head totals-title">life well lived</p>
      <dl className="totals" data-testid="totals" aria-labelledby={id}>
        {items.map(([n, label]) => (
          <div key={label}>
            <dt className="num head">{n}</dt>
            <dd className="muted">{label}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
