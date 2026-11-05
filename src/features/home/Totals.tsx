export function Totals({ countries, cities, trips }: { countries: number; cities: number; trips: number }) {
  const items: [number, string][] = [[countries, 'countries'], [cities, 'cities'], [trips, 'trips']]
  return (
    <dl className="totals" data-testid="totals">
      {items.map(([n, label]) => (
        <div key={label}>
          <dt className="num head">{n}</dt>
          <dd className="muted">{label}</dd>
        </div>
      ))}
    </dl>
  )
}
