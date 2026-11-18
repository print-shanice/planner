import { useState } from 'react'
import type { Link, Trip } from '../../lib/types'
import { useRemove, useStops } from '../../lib/queries'
import { useCanEdit } from '../../lib/offline'
import { hostOf, safeUrl } from '../../lib/embed'
import { linkName } from '../../lib/capture'
import { Icon } from '../../components/Icon'
import { SaveFailed } from '../../components/SaveFailed'
import { Sheet } from '../../components/Sheet'
import { CaptureForm } from '../capture/CaptureForm'
import { stopTitle } from '../plan/stopText'
import { useStopSheet } from '../stops/StopSheet'

// the website's own icon, from its domain (google's icon service knows instagram; others sent a grey arrow); the plain link icon if it can't load
export function SiteIcon({ url }: { url: string }) {
  const host = hostOf(url)
  const [failed, setFailed] = useState(false)
  if (!host || failed) return <Icon name="link" size={18} />
  return <img className="site-icon" src={`https://www.google.com/s2/favicons?domain=${host}&sz=64`} alt="" width={20} height={20} loading="lazy" onError={() => setFailed(true)} />
}

export function LinkCard({ link, trips }: { link: Link; trips: Trip[] }) {
  const [editing, setEditing] = useState(false)
  const href = safeUrl(link.url) ?? undefined
  const remove = useRemove('links')
  const canEdit = useCanEdit()
  const name = linkName(link)
  const title = name.title
  const place = useStops().data?.find((s) => s.id === link.stop_id)
  const sheet = useStopSheet()

  return (
    <article className="link-card" data-testid="link-card">
      <div className="link-foot">
        <a href={href} target="_blank" rel="noopener noreferrer" className="link-text">
          <SiteIcon url={link.url} />
          <span className="stack-xs">
            <span className="link-title">{name.title}</span>
            {name.sub && <span className="muted">{name.sub}</span>}
          </span>
        </a>
        {place && <button type="button" className="text-select link-place" onClick={() => sheet?.openStop(place.id)}>{stopTitle(place).toLowerCase()}</button>}
        {/* a row's actions are one "edit" word, like packing (shanice, 18 nov): the form moves it to another trip or removes it */}
        {canEdit && <button type="button" className="row-edit" aria-label={`edit ${title}`} onClick={() => setEditing(true)}>edit</button>}
      </div>
      <Sheet page open={editing} title="edit link" onClose={() => setEditing(false)}>
        <CaptureForm initial={null} tripId={link.trip_id} link={link} onDone={() => setEditing(false)}
          onRemove={() => { setEditing(false); remove.mutate(link.id) }} />
      </Sheet>
      <SaveFailed table="links" id={link.id} />
    </article>
  )
}
