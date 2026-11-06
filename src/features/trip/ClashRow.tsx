import type { Clash } from '../../lib/clash'
import { fmtRange } from '../../lib/dates'

export function ClashRow({ clash, canEdit, onAdjust }: { clash: Clash; canEdit: boolean; onAdjust: (c: Clash) => void }) {
  return (
    <div className="notice clash-row">
      <span className="notice-text">
        <strong>dates clash</strong>
        <span>{`${clash.a.name} and ${clash.b.name} · ${fmtRange(clash.from, clash.to)}`}</span>
      </span>
      <button type="button" className="btn ghost small" disabled={!canEdit} onClick={() => onAdjust(clash)}>adjust dates</button>
    </div>
  )
}
