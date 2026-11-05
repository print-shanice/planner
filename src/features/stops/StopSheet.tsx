import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Stop, StopKind } from '../../lib/types'
import { useStops, useTrips } from '../../lib/queries'
import { newId } from '../../lib/id'
import { Sheet } from '../../components/Sheet'
import { StopForm } from './StopForm'
import { StopView } from './StopView'
import { stopTitle } from '../plan/StopRow'

type Api = { openStop: (id: string) => void; newStop: (kind: StopKind, tripId: string, defaults?: Partial<Stop>) => void }
const Ctx = createContext<Api | null>(null)
export const useStopSheet = () => useContext(Ctx)

type State = { n: number; mode: 'view' | 'edit'; id: string; draft?: Stop } | null

export function blankStop(kind: StopKind, tripId: string, defaults: Partial<Stop> = {}): Stop {
  return {
    id: newId(), trip_id: tripId, kind, title: '', day: null, position: 0, time: null, end_date: null, end_time: null,
    place: null, mode: kind === 'journey' ? 'train' : null, origin: null, destination: null, status: 'idea', saved: false,
    url: '', ref: '', notes: '', category: null, ...defaults,
  }
}

export function StopSheetProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(null)
  const stops = useStops().data
  const trips = useTrips().data

  const openStop = useCallback((id: string) => setState((s) => ({ n: (s?.n ?? 0) + 1, mode: 'view', id })), [])
  const newStop = useCallback((kind: StopKind, tripId: string, defaults?: Partial<Stop>) => {
    const draft = blankStop(kind, tripId, defaults)
    setState((s) => ({ n: (s?.n ?? 0) + 1, mode: 'edit', id: draft.id, draft }))
  }, [])
  const api = useMemo(() => ({ openStop, newStop }), [openStop, newStop])

  const close = () => setState(null)
  const saved = state?.draft ? undefined : stops?.find((s) => s.id === state?.id)
  const stop = state?.draft ?? saved
  const trip = trips?.find((t) => t.id === stop?.trip_id)
  const title = !stop ? '' : state?.draft ? `new ${stop.kind}` : state?.mode === 'edit' ? 'edit' : stopTitle(stop)

  return (
    <Ctx.Provider value={api}>
      {children}
      <Sheet open={!!state && !!stop} title={title} onClose={close}>
        {state && stop && (state.mode === 'edit'
          ? <StopForm key={`${state.n}-edit`} stop={stop} trip={trip} isNew={!!state.draft}
              onDone={() => (state.draft ? close() : setState({ ...state, mode: 'view' }))} />
          : <StopView key={`${state.n}-view`} stop={stop} onClose={close} onEdit={() => setState({ ...state, n: state.n + 1, mode: 'edit' })} />)}
      </Sheet>
    </Ctx.Provider>
  )
}
