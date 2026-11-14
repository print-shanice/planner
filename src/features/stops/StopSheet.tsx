import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Stop, StopKind } from '../../lib/types'
import { useStops, useTrips } from '../../lib/queries'
import { blankStop } from '../../lib/stops'
import { Sheet } from '../../components/Sheet'
import { StopForm } from './StopForm'
import { CardName, StopView } from './StopView'
import { stopTitle } from '../plan/stopText'
import { flash } from '../itinerary/flash'

type Api = { openStop: (id: string, day?: string | null) => void; editStop: (id: string) => void; newStop: (kind: StopKind, tripId: string, defaults?: Partial<Stop>) => void }
const Ctx = createContext<Api | null>(null)
export const useStopSheet = () => useContext(Ctx)

type State = { n: number; mode: 'view' | 'edit'; id: string; draft?: Stop; day?: string | null } | null

export function StopSheetProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(null)
  // every sheet gets its own number, never reused, so a late save can tell whether its sheet is still the one open
  const seq = useRef(0)
  const stops = useStops().data
  const trips = useTrips().data
  const [, setParams] = useSearchParams()
  // a new stop takes you to its day and lights up there, so you can see it landed
  const landed = (added?: { id: string; day: string | null }) => {
    if (!added) return
    // on the plan (no ?tab=, or an old link's calendar or plan) the page goes to its day
    if (added.day) setParams((p) => {
      if (!['calendar', 'plan', null].includes(p.get('tab'))) return p
      const n = new URLSearchParams(p); n.set('day', added.day!); return n
    })
    flash(added.id)
  }

  const openStop = useCallback((id: string, day?: string | null) => setState({ n: ++seq.current, mode: 'view', id, day }), [])
  const editStop = useCallback((id: string) => setState({ n: ++seq.current, mode: 'edit', id }), [])
  const newStop = useCallback((kind: StopKind, tripId: string, defaults?: Partial<Stop>) => {
    const draft = blankStop(kind, tripId, defaults)
    setState({ n: ++seq.current, mode: 'edit', id: draft.id, draft })
  }, [])
  const api = useMemo(() => ({ openStop, editStop, newStop }), [openStop, editStop, newStop])

  const close = () => setState(null)
  const saved = state?.draft ? undefined : stops?.find((s) => s.id === state?.id)
  const stop = state?.draft ?? saved
  const trip = trips?.find((t) => t.id === stop?.trip_id)
  const title = !stop ? '' : state?.draft ? `new ${stop.kind}` : state?.mode === 'edit' ? 'edit' : stopTitle(stop)

  return (
    <Ctx.Provider value={api}>
      {children}
      <Sheet side open={!!state && !!stop} title={title} onClose={close} page={state?.mode === 'edit'}
        // a place's, stay's or note's name is the card's title, typed over right there
        heading={state?.mode === 'view' && stop && stop.kind !== 'journey' ? <CardName key={stop.id} stop={stop} /> : undefined}>
        {state && stop && (state.mode === 'edit'
          ? <StopForm key={`${state.n}-edit`} stop={stop} trip={trip} isNew={!!state.draft}
              // a save can land after its sheet was closed or another one opened; only touch this sheet
              onDone={(added) => { landed(added); setState((s) => (s?.n !== state.n ? s : state.draft ? null : { ...s, mode: 'view' })) }} />
          : <StopView key={`${state.n}-view`} stop={stop} onClose={close} onEdit={() => setState({ ...state, n: ++seq.current, mode: 'edit' })} />)}
      </Sheet>
    </Ctx.Provider>
  )
}
