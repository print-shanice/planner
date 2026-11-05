import { useEffect, useRef } from 'react'
import type { Link, Trip } from '../../lib/types'
import { useRemove, useSave } from '../../lib/queries'
import { useCanEdit } from '../../lib/offline'
import { embedFor, hostOf, safeUrl } from '../../lib/embed'
import { Icon } from '../../components/Icon'
import { TwoTapDelete } from '../../components/TwoTapDelete'
import { ItemMenu } from './ItemMenu'
import { runEmbeds } from './embedScripts'

export function LinkCard({ link, trips }: { link: Link; trips: Trip[] }) {
  const href = safeUrl(link.url) ?? undefined
  const e = href ? embedFor(href) : { kind: 'link' as const }
  const box = useRef<HTMLDivElement>(null)
  const save = useSave('links')
  const remove = useRemove('links')
  const canEdit = useCanEdit()
  const title = link.title || hostOf(link.url)

  useEffect(() => {
    if (e.kind === 'instagram' || e.kind === 'tiktok') runEmbeds(e.kind)
  }, [e.kind, link.url])

  return (
    <article className="link-card" data-testid="link-card" ref={box}>
      {e.kind === 'youtube' && (
        <div className="video">
          <iframe src={`https://www.youtube-nocookie.com/embed/${e.id}`} title={title} loading="lazy"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
        </div>
      )}
      {e.kind === 'instagram' && (
        <blockquote className="instagram-media" data-instgrm-permalink={link.url} data-instgrm-version="14">
          <a href={href} target="_blank" rel="noopener noreferrer">{title}</a>
        </blockquote>
      )}
      {e.kind === 'tiktok' && (
        <blockquote className="tiktok-embed" cite={link.url} data-video-id={e.id}>
          <section><a href={href} target="_blank" rel="noopener noreferrer">{title}</a></section>
        </blockquote>
      )}
      <div className="link-foot">
        <a href={href} target="_blank" rel="noopener noreferrer" className="link-text">
          {e.kind === 'link' && <Icon name="link" size={18} />}
          <span className="stack-xs">
            {link.title ? <span className="link-title">{link.title}</span> : null}
            <span className="muted">{hostOf(link.url)}</span>
            {link.note && <span className="muted link-note">{link.note}</span>}
          </span>
        </a>
        {canEdit && (
          <ItemMenu title={title}>
            {() => (<>
              <label className="field">
                <span className="label">move to trip</span>
                <select value={link.trip_id ?? ''} onChange={(ev) => save.mutate({ id: link.id, trip_id: ev.target.value || null })}>
                  {!link.trip_id && <option value="">unsorted</option>}
                  {[...trips].sort((a, b) => a.name.localeCompare(b.name)).map((t) => <option key={t.id} value={t.id}>{t.name.toLowerCase()}</option>)}
                </select>
              </label>
              <div className="row"><TwoTapDelete label="remove" onConfirm={() => remove.mutate(link.id)} /></div>
            </>)}
          </ItemMenu>
        )}
      </div>
    </article>
  )
}
