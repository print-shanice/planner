// where the map would be, when it can't be: short words, and retry when trying again could help
export function MapNote({ title, detail, onRetry }: { title: string; detail?: string; onRetry?: () => void }) {
  return (
    <div className="map-note" role="status">
      <p className="map-note-title">{title}</p>
      {detail && <p className="muted">{detail}</p>}
      {onRetry && <button type="button" className="text-link" onClick={onRetry}>retry</button>}
    </div>
  )
}
