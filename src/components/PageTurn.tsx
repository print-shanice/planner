import { Link } from 'react-router-dom'

// the foot of a page, like an index's "← 20 mini-buses · index · 22 →": the one before, the way back up, the one after
export type Turn = { kicker: string; name?: string; to?: string; onClick?: () => void }

function Side({ turn, dir }: { turn: Turn; dir: 'prev' | 'next' }) {
  const words = <>
    <span className="turn-kicker">{dir === 'prev' ? `← ${turn.kicker}` : `${turn.kicker} →`}</span>
    {turn.name && <span className="turn-name">{turn.name}</span>}
  </>
  const cls = `turn ${dir}`
  return turn.to ? <Link className={cls} to={turn.to}>{words}</Link> : <button type="button" className={cls} onClick={turn.onClick}>{words}</button>
}

export function PageTurn({ label, prev, next, up }: { label: string; prev?: Turn | null; next?: Turn | null; up?: { to: string; name: string } }) {
  if (!prev && !next) return null
  return (
    <nav className="page-turn" aria-label={label}>
      {prev ? <Side turn={prev} dir="prev" /> : <span />}
      {up ? <Link className="turn-up" to={up.to}>{up.name}</Link> : <span />}
      {next ? <Side turn={next} dir="next" /> : <span />}
    </nav>
  )
}
