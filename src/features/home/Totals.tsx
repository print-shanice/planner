// the numbers along the bottom of the travels card, labelled by its heading
export function Totals({ countries, cities, trips, labelledBy }: { countries: number; cities: number; trips: number; labelledBy: string }) {
  const items: [number, string][] = [[countries, 'countries'], [cities, 'cities'], [trips, 'trips']]
  return (
    <dl className="totals" data-testid="totals" aria-labelledby={labelledBy}>
      {items.map(([n, label]) => (
        <div key={label}>
          <dt className="num head">{n}</dt>
          <dd className="muted">{label}</dd>
        </div>
      ))}
    </dl>
  )
}
