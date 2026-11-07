export type PlaceItem = { id: string; n: number; title: string; sub: string; color: string }

// the map's places as a list you pull up: the same places as the pins, for anyone who can't use the map itself
export function PlacesSheet({ items, title, open, onToggle, onPick }: {
  items: PlaceItem[]; title: string; open: boolean; onToggle: () => void; onPick: (id: string) => void
}) {
  return (
    <section className="places-sheet" aria-label="places">
      <button type="button" className="places-handle" aria-label="places list" aria-expanded={open} onClick={onToggle}>
        <span className="grab" aria-hidden="true" />
      </button>
      <p className="places-title head">{title}</p>
      {open && items.length > 0 && (
        <ul className="places-list">
          {items.map((p) => (
            <li key={p.id}>
              <button type="button" className="places-row" onClick={() => onPick(p.id)}>
                <span className="num-badge num" style={{ background: p.color }}>{p.n}</span>
                <span className="stack-xs"><span className="places-name">{p.title}</span>{p.sub && <span className="muted">{p.sub}</span>}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
