import { render, screen, within, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { trip, stop, place, cost } from '../factories'

const db = vi.hoisted(() => ({
  trips: [] as any[], stops: [] as any[], costs: [] as any[], files: [] as any[],
  members: [{ email: 'shanice@x.com', user_id: 'u1', name: 'shanice', color: 0 }, { email: 'k@x.com', user_id: 'u2', name: 'kai', color: 1 }],
  calls: [] as string[],
  save: vi.fn(), remove: vi.fn(), storageRemove: vi.fn(),
  canEdit: true,
}))
vi.mock('../../src/lib/queries', async () => {
  const rq = await import('@tanstack/react-query')
  const read = (k: string) => () => rq.useQuery({ queryKey: [k], queryFn: () => (db as any)[k], initialData: () => (db as any)[k], staleTime: Infinity })
  return {
    keys: { trips: ['trips'], stops: ['stops'], costs: ['costs'], files: ['files'] },
    useTrips: read('trips'), useStops: read('stops'), useCosts: read('costs'), useFiles: read('files'), useMembers: read('members'),
    useRates: () => ({ data: { date: '2026-11-04', rates: { SGD: 1.5, GBP: 0.85, USD: 1.08, CHF: 0.94, JPY: 165 } } }),
    useSave: (t: string) => ({ mutateAsync: (r: any) => db.save(t, r), mutate: (r: any) => db.save(t, r), isPending: false }),
    useRemove: (t: string) => ({ mutateAsync: (id: string) => db.remove(t, id), isPending: false }),
  }
})
vi.mock('../../src/lib/id', () => ({ newId: () => 'new-id' }))
const tickets = vi.hoisted(() => ({ open: vi.fn(), keep: vi.fn(() => Promise.resolve()) }))
vi.mock('../../src/lib/ticketCache', () => ({ openTicket: tickets.open, keepTickets: tickets.keep }))
vi.mock('../../src/lib/offline', () => ({ useCanEdit: () => db.canEdit, useOnline: () => db.canEdit }))
vi.mock('../../src/lib/supabase', () => ({
  supabase: { storage: { from: () => ({ remove: db.storageRemove, createSignedUrls: () => Promise.resolve({ data: [], error: null }), upload: vi.fn() }) } },
}))

import { StopSheetProvider, useStopSheet } from '../../src/features/stops/StopSheet'

let qc: QueryClient
function Opener({ id, kind }: { id?: string; kind?: 'stay' | 'place' | 'journey' | 'note' }) {
  const s = useStopSheet()!
  return <button onClick={() => (id ? s.openStop(id) : s.newStop(kind!, 'lap', { day: '2027-02-08' }))}>open</button>
}
function show(el: JSX.Element) {
  qc = new QueryClient()
  return render(<QueryClientProvider client={qc}><MemoryRouter><StopSheetProvider>{el}</StopSheetProvider></MemoryRouter></QueryClientProvider>)
}

beforeEach(() => {
  db.trips = [trip({ id: 'lap', name: 'lapland', start_date: '2027-02-07', end_date: '2027-02-11' }), trip({ id: 'par', name: 'paris' })]
  db.stops = [stop({ id: 's1', trip_id: 'lap', title: 'arktikum', day: '2027-02-08', place: place({ name: 'Arktikum', address: 'Pohjoisranta 4' }), ref: 'AB12' })]
  db.costs = []; db.files = []; db.calls = []; db.canEdit = true
  db.save.mockReset().mockImplementation((t: string, r: any) => { db.calls.push(`save:${t}`); return Promise.resolve(r) })
  db.remove.mockReset().mockImplementation((t: string) => { db.calls.push(`remove:${t}`); return Promise.resolve() })
  db.storageRemove.mockReset().mockImplementation(() => { db.calls.push('storage'); return Promise.resolve({ error: null }) })
})

async function openEdit() {
  show(<Opener id="s1" />)
  await userEvent.click(screen.getByRole('button', { name: 'open' }))
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'edit' }))
  return screen.getByRole('dialog')
}

it('typed values survive a realtime refresh while the sheet is open', async () => {
  const d = await openEdit()
  const name = within(d).getByLabelText('name')
  await userEvent.clear(name)
  await userEvent.type(name, 'café koti')
  act(() => { qc.setQueryData(['stops'], [{ ...db.stops[0], title: 'changed by kai', notes: 'x' }]) })
  expect(within(screen.getByRole('dialog')).getByLabelText('name')).toHaveValue('café koti')
})

it('stay with check-out before check-in is refused with the copy', async () => {
  show(<Opener kind="stay" />)
  await userEvent.click(screen.getByRole('button', { name: 'open' }))
  const d = screen.getByRole('dialog', { name: 'new stay' })
  await userEvent.type(within(d).getByLabelText('name'), 'arctic hostel')
  fireEvent.change(within(d).getByLabelText('check-in'), { target: { value: '2027-02-09' } })
  fireEvent.change(within(d).getByLabelText('check-out'), { target: { value: '2027-02-08' } })
  await userEvent.click(within(d).getByRole('button', { name: 'save' }))
  expect(within(d).getByText('check-out is before check-in')).toBeInTheDocument()
  expect(db.save).not.toHaveBeenCalled()
})

it('a new stop without a name asks for one', async () => {
  show(<Opener kind="place" />)
  await userEvent.click(screen.getByRole('button', { name: 'open' }))
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'save' }))
  expect(screen.getByText('add a name')).toBeInTheDocument()
})

it('a new stop lands at the end of its day', async () => {
  show(<Opener kind="note" />)
  await userEvent.click(screen.getByRole('button', { name: 'open' }))
  const d = screen.getByRole('dialog', { name: 'new note' })
  await userEvent.type(within(d).getByLabelText('title'), 'buy gloves')
  await userEvent.click(within(d).getByRole('button', { name: 'save' }))
  expect(db.save).toHaveBeenCalledWith('stops', expect.objectContaining({ id: 'new-id', trip_id: 'lap', kind: 'note', title: 'buy gloves', day: '2027-02-08', position: 1 }))
})

it('price writes one linked cost; clearing it removes the cost', async () => {
  let d = await openEdit()
  await userEvent.type(within(d).getByLabelText('amount'), '120')
  await userEvent.selectOptions(within(d).getByLabelText('paid by'), 'u2')
  await userEvent.click(within(d).getByRole('button', { name: 'save' }))
  expect(db.save).toHaveBeenCalledWith('costs', expect.objectContaining({
    trip_id: 'lap', stop_id: 's1', amount: 120, currency: 'EUR', paid_by: 'u2', status: 'paid', split: 'even', category: 'activities',
  }))
  const saved = db.save.mock.calls.find(([t]) => t === 'costs')![1]
  expect(saved.id).toBeUndefined()

  db.costs = [cost({ id: 'c1', trip_id: 'lap', stop_id: 's1', amount: 120 })]
  qc.setQueryData(['costs'], db.costs)
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'edit' }))
  d = screen.getByRole('dialog')
  await userEvent.clear(within(d).getByLabelText('amount'))
  await userEvent.click(within(d).getByRole('button', { name: 'save' }))
  expect(db.remove).toHaveBeenCalledWith('costs', 'c1')
})

it('another currency needs a 3-letter code', async () => {
  const d = await openEdit()
  await userEvent.type(within(d).getByLabelText('amount'), '50')
  await userEvent.selectOptions(within(d).getByLabelText('currency'), 'other')
  await userEvent.type(within(d).getByLabelText('currency code'), 'ab')
  await userEvent.click(within(d).getByRole('button', { name: 'save' }))
  expect(within(d).getByText('enter a 3-letter currency code')).toBeInTheDocument()
})

it('deleting a stop removes its files from storage first', async () => {
  db.files = [{ id: 'f1', stop_id: 's1', path: 'lap/s1/a-ticket.pdf', name: 'ticket.pdf', mime: 'application/pdf' }, { id: 'f2', stop_id: 's1', path: 'lap/s1/b-qr.png', name: 'qr.png', mime: 'image/png' }]
  show(<Opener id="s1" />)
  await userEvent.click(screen.getByRole('button', { name: 'open' }))
  const d = screen.getByRole('dialog')
  await userEvent.click(within(d).getByRole('button', { name: 'delete' }))
  await userEvent.click(within(d).getByRole('button', { name: 'tap again to delete' }))
  expect(db.storageRemove).toHaveBeenCalledWith(['lap/s1/a-ticket.pdf', 'lap/s1/b-qr.png'])
  expect(db.calls).toEqual(['storage', 'remove:stops'])
})

it('the view offers the maps link and copy for the ref', async () => {
  show(<Opener id="s1" />)
  await userEvent.click(screen.getByRole('button', { name: 'open' }))
  const d = screen.getByRole('dialog', { name: 'arktikum' })
  expect(within(d).getByRole('link', { name: 'open in google maps' })).toHaveAttribute('href', expect.stringContaining('google.com/maps/search'))
  expect(within(d).getByRole('button', { name: 'copy ref' })).toBeInTheDocument()
})

it('editing is disabled offline', async () => {
  db.canEdit = false
  show(<Opener id="s1" />)
  await userEvent.click(screen.getByRole('button', { name: 'open' }))
  const d = screen.getByRole('dialog')
  expect(within(d).getByRole('button', { name: 'edit' })).toBeDisabled()
  expect(within(d).getByRole('button', { name: 'delete' })).toBeDisabled()
})

it('a failed save keeps the sheet open with the reason', async () => {
  db.save.mockRejectedValueOnce({ code: '42501', message: 'denied' })
  const d = await openEdit()
  await userEvent.clear(within(d).getByLabelText('name'))
  await userEvent.type(within(d).getByLabelText('name'), 'arktikum museum')
  await userEvent.click(within(d).getByRole('button', { name: 'save' }))
  expect(await within(d).findByText("you're not on this planner")).toBeInTheDocument()
  expect(within(d).getByLabelText('name')).toHaveValue('arktikum museum')
})

it('moving to another trip moves its cost too', async () => {
  db.costs = [cost({ id: 'c1', trip_id: 'lap', stop_id: 's1' })]
  show(<Opener id="s1" />)
  await userEvent.click(screen.getByRole('button', { name: 'open' }))
  await userEvent.selectOptions(within(screen.getByRole('dialog')).getByLabelText('move to another trip'), 'par')
  expect(db.save).toHaveBeenCalledWith('stops', { id: 's1', trip_id: 'par' })
  expect(db.save).toHaveBeenCalledWith('costs', { id: 'c1', trip_id: 'par' })
})

it('a ticket not saved on this device says so', async () => {
  db.files = [{ id: 'f1', stop_id: 's1', path: 'lap/s1/a-ticket.pdf', name: 'ticket.pdf', mime: 'application/pdf' }]
  tickets.open.mockRejectedValueOnce(new Error('not saved offline'))
  show(<Opener id="s1" />)
  await userEvent.click(screen.getByRole('button', { name: 'open' }))
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'ticket.pdf' }))
  expect(await screen.findByText('not saved offline')).toHaveClass('warn-line')
})

it('opening a ticket shows it from the device copy', async () => {
  db.files = [{ id: 'f1', stop_id: 's1', path: 'lap/s1/b-qr.png', name: 'qr.png', mime: 'image/png' }]
  tickets.open.mockResolvedValueOnce('blob:qr')
  show(<Opener id="s1" />)
  await userEvent.click(screen.getByRole('button', { name: 'open' }))
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'qr.png' }))
  expect(await screen.findByRole('img', { name: 'qr.png' })).toHaveAttribute('src', 'blob:qr')
  expect(tickets.keep).toHaveBeenCalled()
})
