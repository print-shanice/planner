import { render, screen, within, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { trip, stop, place, cost } from '../factories'
import { directionsUrl } from '../../src/lib/gmaps'

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
    useReviews: () => ({ data: [] }),
    useRates: () => ({ data: { date: '2026-11-04', rates: { SGD: 1.5, GBP: 0.85, USD: 1.08, CHF: 0.94, JPY: 165 } } }),
    useSave: (t: string) => ({ mutateAsync: (r: any) => db.save(t, r), mutate: (r: any) => db.save(t, r), isPending: false }),
    useRemove: (t: string) => ({ mutateAsync: (id: string) => db.remove(t, id), isPending: false }),
  }
})
vi.mock('../../src/lib/id', () => ({ newId: () => 'new-id' }))
const photon = vi.hoisted(() => ({ search: vi.fn(() => Promise.resolve([] as unknown[])) }))
vi.mock('../../src/lib/photon', async (orig) => ({ ...(await orig<typeof import('../../src/lib/photon')>()), searchPlaces: photon.search }))
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
function NoDay() {
  const s = useStopSheet()!
  return <button onClick={() => s.newStop('place', 'lap')}>open blank</button>
}
function OtherTrip() {
  const s = useStopSheet()!
  return <button onClick={() => s.newStop('note', 'par')}>open paris</button>
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
  await userEvent.click(within(d).getByRole('button', { name: 'more' }))
  await userEvent.type(within(d).getByLabelText('amount'), '120')
  await userEvent.click(within(d).getByRole('switch', { name: 'paid already' }))
  await userEvent.click(within(d).getByRole('button', { name: 'kai' }))
  await userEvent.click(within(d).getByRole('button', { name: 'save' }))
  expect(db.save).toHaveBeenCalledWith('costs', expect.objectContaining({
    trip_id: 'lap', stop_id: 's1', amount: 120, currency: 'EUR', paid_by: 'u2', status: 'paid', split: 'even', category: 'activities',
  }))
  const saved = db.save.mock.calls.find(([t]) => t === 'costs')![1]
  expect(saved.id).toEqual(expect.any(String))

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
  expect(within(d).getByRole('link', { name: 'directions' })).toHaveAttribute('href', expect.stringContaining('google.com/maps/search'))
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
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'move' }))
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

function Editor({ id }: { id: string }) {
  const s = useStopSheet()!
  return <button onClick={() => s.editStop(id)}>edit it</button>
}

it('editStop opens a stop straight in its edit form', async () => {
  db.stops = [stop({ id: 'h1', trip_id: 'lap', kind: 'stay', title: 'aurora cabin', day: '2027-02-08', end_date: '2027-02-10' })]
  show(<Editor id="h1" />)
  await userEvent.click(screen.getByRole('button', { name: 'edit it' }))
  const sheet = screen.getByRole('dialog', { name: 'edit' })
  expect(within(sheet).getByDisplayValue('aurora cabin')).toBeInTheDocument()
})

it('saving a price again after it failed sends the same new cost, not a second one', async () => {
  const d = await openEdit()
  db.save.mockImplementation((t: string, r: any) => (t === 'costs' && !db.calls.includes('failed') ? (db.calls.push('failed'), Promise.reject(new Error('asleep'))) : Promise.resolve(r)))
  await userEvent.type(within(d).getByLabelText('amount'), '120')
  await userEvent.click(within(d).getByRole('button', { name: 'save' }))
  await userEvent.click(await within(screen.getByRole('dialog')).findByRole('button', { name: 'retry' }))
  const ids = db.save.mock.calls.filter(([t]) => t === 'costs').map(([, r]) => r.id)
  expect(ids).toHaveLength(2)
  expect(ids[0]).toEqual(expect.any(String))
  expect(ids[1]).toBe(ids[0])
})

it('not paid saves no payer, and paid presets a payer', async () => {
  const d = await openEdit()
  await userEvent.click(within(d).getByRole('button', { name: 'more' }))
  await userEvent.type(within(d).getByLabelText('amount'), '30')
  const paid = within(d).getByRole('switch', { name: 'paid already' })
  expect(paid).toHaveAttribute('aria-checked', 'false')
  expect(within(d).queryByRole('group', { name: 'paid by' })).toBeNull()
  await userEvent.click(paid)
  expect(within(d).getByRole('button', { name: 'shanice' })).toHaveAttribute('aria-pressed', 'true')
  await userEvent.click(paid)
  await userEvent.click(within(d).getByRole('button', { name: 'save' }))
  expect(db.save).toHaveBeenCalledWith('costs', expect.objectContaining({ amount: 30, status: 'estimate', paid_by: null }))
})

it('an older paid cost with no payer asks who paid', async () => {
  db.costs = [cost({ id: 'c1', trip_id: 'lap', stop_id: 's1', amount: 50, status: 'paid', paid_by: null })]
  const d = await openEdit()
  expect(within(d).getByRole('switch', { name: 'paid already' })).toHaveAttribute('aria-checked', 'true')
  await userEvent.click(within(d).getByRole('button', { name: 'save' }))
  expect(within(d).getByText('pick who paid')).toBeInTheDocument()
  expect(db.save).not.toHaveBeenCalled()
})

it('an older estimate with a payer saves as not paid with no payer', async () => {
  db.costs = [cost({ id: 'c1', trip_id: 'lap', stop_id: 's1', amount: 50, status: 'estimate', paid_by: 'u2' })]
  const d = await openEdit()
  expect(within(d).getByRole('switch', { name: 'paid already' })).toHaveAttribute('aria-checked', 'false')
  await userEvent.click(within(d).getByRole('button', { name: 'save' }))
  expect(db.save).toHaveBeenCalledWith('costs', expect.objectContaining({ id: 'c1', status: 'estimate', paid_by: null }))
})

it('the stop view says whether it is paid', async () => {
  db.costs = [cost({ id: 'c1', trip_id: 'lap', stop_id: 's1', amount: 50, status: 'estimate', paid_by: 'u2' })]
  show(<Opener id="s1" />)
  await userEvent.click(screen.getByRole('button', { name: 'open' }))
  expect(within(screen.getByRole('dialog')).getByText(/not paid/)).toBeInTheDocument()
})

it('a new journey shows its essentials and keeps the rest under "more", with save always there', async () => {
  show(<Opener kind="journey" />)
  await userEvent.click(screen.getByRole('button', { name: 'open' }))
  const d = screen.getByRole('dialog', { name: 'new journey' })
  for (const l of ['from', 'to', 'depart', 'depart time', 'arrive', 'arrive time']) expect(within(d).getByLabelText(l)).toBeInTheDocument()
  const folds = [...d.querySelectorAll('.fold-toggle')].map((x) => [x.textContent, x.getAttribute('aria-expanded')])
  expect(folds).toEqual([['more', 'false']])
  expect(within(d).getByRole('button', { name: 'save' }).closest('.sheet-foot')).not.toBeNull()
})

it('a place asks "needs booking", then "booked", as switches', async () => {
  show(<Opener kind="place" />)
  await userEvent.click(screen.getByRole('button', { name: 'open' }))
  const d = within(screen.getByRole('dialog'))
  const needs = d.getByRole('switch', { name: 'needs booking' })
  expect(needs).toHaveAttribute('aria-checked', 'false')
  expect(d.queryByRole('switch', { name: 'booked' })).toBeNull()
  await userEvent.click(needs)
  expect(d.getByRole('switch', { name: 'booked' })).toHaveAttribute('aria-checked', 'false')
  await userEvent.click(d.getByRole('switch', { name: 'booked' }))
  expect(d.getByLabelText('booking ref')).toBeInTheDocument()
})

it('once a journey is booked it asks for its carrier and ref', async () => {
  show(<Opener kind="journey" />)
  await userEvent.click(screen.getByRole('button', { name: 'open' }))
  const d = screen.getByRole('dialog')
  expect(within(d).queryByLabelText('booking ref')).toBeNull()
  expect(within(d).queryByLabelText('carrier / number')).toBeNull()
  await userEvent.click(within(d).getByRole('switch', { name: 'booked' }))
  expect(within(d).getByLabelText('carrier / number')).toBeInTheDocument()
  expect(within(d).getByLabelText('booking ref')).toBeInTheDocument()
})

it('a stop that already has a ref shows it whatever its status', async () => {
  const d = await openEdit()
  expect(within(d).getByLabelText('booking ref')).toHaveValue('AB12')
})

it('dates and times read like a calendar, and say date or time when empty', async () => {
  show(<Opener kind="journey" />)
  await userEvent.click(screen.getByRole('button', { name: 'open' }))
  const d = screen.getByRole('dialog')
  expect(within(d).getByLabelText('depart').closest('.pick')).toHaveTextContent('mon 8 feb')
  expect(within(d).getByLabelText('arrive').closest('.pick')).toHaveTextContent('date')
  expect(within(d).getByLabelText('depart time').closest('.pick')).toHaveTextContent('time')
  fireEvent.change(within(d).getByLabelText('depart time'), { target: { value: '07:20' } })
  expect(within(d).getByLabelText('depart time').closest('.pick')).toHaveTextContent('07:20')
})

it('a cost problem opens "more", where the cost is', async () => {
  const d = await openEdit()
  const fold = within(d).getByRole('button', { name: 'more' })
  await userEvent.click(fold)
  await userEvent.type(within(d).getByLabelText('amount'), 'abc')
  await userEvent.click(fold)
  expect(fold).toHaveAttribute('aria-expanded', 'false')
  await userEvent.click(within(d).getByRole('button', { name: 'save' }))
  expect(within(d).getByText('check the amount')).toBeInTheDocument()
  expect(fold).toHaveAttribute('aria-expanded', 'true')
})

it('closing a new note keeps its draft for that trip only', async () => {
  show(<><Opener kind="note" /><OtherTrip /></>)
  await userEvent.click(screen.getByRole('button', { name: 'open' }))
  await userEvent.type(within(screen.getByRole('dialog')).getByLabelText('title'), 'buy gloves')
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'close' }))
  await userEvent.click(screen.getByRole('button', { name: 'open' }))
  expect(within(screen.getByRole('dialog')).getByLabelText('title')).toHaveValue('buy gloves')
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'close' }))
  await userEvent.click(screen.getByRole('button', { name: 'open paris' }))
  expect(within(screen.getByRole('dialog')).getByLabelText('title')).toHaveValue('')
})

it('a failed save keeps the sheet with retry, and retry sends the same stop', async () => {
  db.save.mockRejectedValueOnce(new Error('asleep'))
  show(<Opener kind="note" />)
  await userEvent.click(screen.getByRole('button', { name: 'open' }))
  const d = screen.getByRole('dialog')
  await userEvent.type(within(d).getByLabelText('title'), 'buy gloves')
  await userEvent.click(within(d).getByRole('button', { name: 'save' }))
  expect(await within(d).findByText("couldn't save")).toBeInTheDocument()
  expect(within(d).getByLabelText('title')).toHaveValue('buy gloves')
  await userEvent.click(within(d).getByRole('button', { name: 'retry' }))
  const ids = db.save.mock.calls.filter(([t]) => t === 'stops').map(([, r]) => r.id)
  expect(ids).toEqual(['new-id', 'new-id'])
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('closing mid-save leaves no draft behind', async () => {
  let finish!: () => void
  db.save.mockImplementationOnce((_t: string, r: any) => new Promise((res) => { finish = () => res(r) }))
  show(<Opener kind="note" />)
  await userEvent.click(screen.getByRole('button', { name: 'open' }))
  let d = screen.getByRole('dialog')
  await userEvent.type(within(d).getByLabelText('title'), 'buy gloves')
  await userEvent.click(within(d).getByRole('button', { name: 'save' }))
  expect(within(d).getByRole('button', { name: 'saving…' })).toBeDisabled()
  await userEvent.click(within(d).getByRole('button', { name: 'close' }))
  await act(async () => { finish() })
  await userEvent.click(screen.getByRole('button', { name: 'open' }))
  d = screen.getByRole('dialog')
  expect(within(d).getByLabelText('title')).toHaveValue('')
})

it('closing an edit mid-save does not bring the sheet back when the save lands', async () => {
  let finish!: () => void
  db.save.mockImplementationOnce((_t: string, r: any) => new Promise((res) => { finish = () => res(r) }))
  const d = await openEdit()
  await userEvent.type(within(d).getByLabelText('name'), ' museum')
  await userEvent.click(within(d).getByRole('button', { name: 'save' }))
  await userEvent.click(within(d).getByRole('button', { name: 'close' }))
  await act(async () => { finish() })
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('a new item that lands after its sheet closed leaves the next sheet open', async () => {
  let finish!: () => void
  db.save.mockImplementationOnce((_t: string, r: any) => new Promise((res) => { finish = () => res(r) }))
  show(<><Opener kind="note" /><Opener id="s1" /></>)
  await userEvent.click(screen.getAllByRole('button', { name: 'open' })[0])
  let d = screen.getByRole('dialog')
  await userEvent.type(within(d).getByLabelText('title'), 'buy gloves')
  await userEvent.click(within(d).getByRole('button', { name: 'save' }))
  await userEvent.click(within(d).getByRole('button', { name: 'close' }))
  await userEvent.click(screen.getAllByRole('button', { name: 'open' })[1])
  await act(async () => { finish() })
  d = screen.getByRole('dialog', { name: 'arktikum' })
  expect(d).toBeInTheDocument()
})

it("the date picker opens on the trip's month, marks the trip's days and always shows six weeks", async () => {
  show(<NoDay />)
  await userEvent.click(screen.getByRole('button', { name: 'open blank' }))
  await userEvent.click(screen.getByRole('button', { name: 'choose day' }))
  const pick = screen.getByRole('dialog', { name: 'day' })
  expect(pick).toHaveTextContent('february 2027')
  expect(within(pick).getByRole('button', { name: 'sun 7 feb' })).toHaveAttribute('data-trip')
  expect(within(pick).getByRole('button', { name: 'thu 11 feb' })).toHaveAttribute('data-trip')
  expect(within(pick).getByRole('button', { name: 'fri 12 feb' })).not.toHaveAttribute('data-trip')
  expect(pick.querySelectorAll('.datepick-grid > :not(.datepick-wd)')).toHaveLength(42)
  await userEvent.click(within(pick).getByRole('button', { name: 'next month' }))
  expect(pick.querySelectorAll('.datepick-grid > :not(.datepick-wd)')).toHaveLength(42)
})

it('picking a found place keeps the name you typed; a short search takes the place name', async () => {
  photon.search.mockResolvedValue([place({ name: 'De Pelgrim', city: 'rotterdam' })])
  show(<Opener kind="place" />)
  await userEvent.click(screen.getByRole('button', { name: 'open' }))
  const name = screen.getByRole('textbox', { name: 'name' })
  await userEvent.type(name, 'cafe de pelgrim')
  await userEvent.click(await screen.findByRole('button', { name: /De Pelgrim/ }, { timeout: 2000 }))
  expect(name).toHaveValue('cafe de pelgrim')
  await userEvent.click(screen.getByRole('button', { name: 'clear location' }))
  await userEvent.clear(name)
  await userEvent.type(name, 'pelg')
  await userEvent.click(await screen.findByRole('button', { name: /De Pelgrim/ }, { timeout: 2000 }))
  expect(name).toHaveValue('De Pelgrim')
})

it('a stay has no separate location field: its name finds the place', async () => {
  show(<Opener kind="stay" />)
  await userEvent.click(screen.getByRole('button', { name: 'open' }))
  const d = screen.getByRole('dialog')
  expect(within(d).queryByLabelText('location')).toBeNull()
  expect(within(d).getByLabelText('name')).toBeInTheDocument()
})

it('paid already sits between the amount and who paid', async () => {
  show(<Opener kind="stay" />)
  await userEvent.click(screen.getByRole('button', { name: 'open' }))
  const d = screen.getByRole('dialog')
  const amount = within(d).getByLabelText('amount')
  const paid = within(d).getByRole('switch', { name: 'paid already' })
  await userEvent.click(paid)
  const faces = within(d).getByRole('group', { name: 'paid by' })
  expect(amount.compareDocumentPosition(paid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(paid.compareDocumentPosition(faces) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

describe('a stop reads like a place card', () => {
  function Where() { const l = useLocation(); return <output data-testid="loc">{l.pathname + l.search}</output> }
  beforeEach(() => {
    db.stops = [stop({ id: 's1', trip_id: 'lap', title: 'arktikum', day: '2027-02-08', time: '10:00', status: 'to_book', category: 'museum', place: place({ name: 'Arktikum', address: 'Pohjoisranta 4', city: 'rovaniemi' }) })]
  })
  const open = async () => {
    show(<><Opener id="s1" /><Where /></>)
    await userEvent.click(screen.getByRole('button', { name: 'open' }))
    return within(screen.getByRole('dialog', { name: 'arktikum' }))
  }

  it('status, what and where, then four round actions', async () => {
    const d = await open()
    expect(d.getByText('to book')).toHaveClass('pill', 'warn')
    expect(d.getByText('museum · rovaniemi')).toBeInTheDocument()
    const acts = within(d.getByRole('group', { name: 'actions' }))
    expect(acts.getAllByRole('button').concat(acts.getAllByRole('link')).map((a) => a.textContent).sort()).toEqual(['directions', 'map', 'move', 'ticket'])
    expect([...d.getByRole('group', { name: 'actions' }).children].map((a) => a.textContent)).toEqual(['map', 'directions', 'move', 'ticket'])
  })

  it('"map" closes the card and shows the place on that day\'s map', async () => {
    const d = await open()
    await userEvent.click(d.getByRole('button', { name: 'map' }))
    const u = new URL('http://x' + screen.getByTestId('loc').textContent)
    expect(u.pathname).toBe('/trip/lap')
    expect(Object.fromEntries(u.searchParams)).toEqual({ tab: 'map', day: '2027-02-08', pin: 's1' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('"move" opens in the same sheet, never a second one', async () => {
    const d = await open()
    const move = d.getByRole('button', { name: 'move' })
    expect(d.queryByLabelText('move to another day')).toBeNull()
    await userEvent.click(move)
    expect(move).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(d.getByLabelText('move to another day')).toHaveValue('2027-02-08')
    expect(d.getByLabelText('move to another trip')).toBeInTheDocument()
  })

  it('"ticket" opens the file picker', async () => {
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {})
    const d = await open()
    await userEvent.click(d.getByRole('button', { name: 'ticket' }))
    expect(click).toHaveBeenCalled()
    click.mockRestore()
  })

  it('when and where follow as rows', async () => {
    const d = await open()
    expect(d.getByText('mon 8 feb · 10:00')).toBeInTheDocument()
    expect(d.getByText('Arktikum, Pohjoisranta 4')).toBeInTheDocument()
  })

  it('offline, move and ticket are off', async () => {
    db.canEdit = false
    const d = await open()
    expect(d.getByRole('button', { name: 'move' })).toBeDisabled()
    expect(d.getByRole('button', { name: 'ticket' })).toBeDisabled()
    expect(d.getByRole('button', { name: 'map' })).toBeEnabled()
  })
})

it('files are added only from "ticket", with no second add button', async () => {
  show(<Opener id="s1" />)
  await userEvent.click(screen.getByRole('button', { name: 'open' }))
  expect(within(screen.getByRole('dialog')).queryByText('add file')).toBeNull()
})

it('opening a ticket says "opening…" until it shows', async () => {
  db.files = [{ id: 'f1', stop_id: 's1', path: 'lap/s1/b-qr.png', name: 'qr.png', mime: 'image/png' }]
  tickets.open.mockReturnValueOnce(new Promise(() => {}))
  show(<Opener id="s1" />)
  await userEvent.click(screen.getByRole('button', { name: 'open' }))
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'qr.png' }))
  expect(within(screen.getByRole('dialog')).getByText('opening…')).toBeInTheDocument()
})

it('uploading a ticket says so on the card', async () => {
  const { supabase } = await import('../../src/lib/supabase') as any
  supabase.storage.from = () => ({ remove: db.storageRemove, upload: () => new Promise(() => {}) })
  show(<Opener id="s1" />)
  await userEvent.click(screen.getByRole('button', { name: 'open' }))
  const d = screen.getByRole('dialog')
  await userEvent.upload(within(d).getByLabelText('add file'), new File(['x'], 'pass.pdf', { type: 'application/pdf' }))
  expect(within(d).getByText('uploading…')).toBeInTheDocument()
})

describe('forms are calm full pages', () => {
  async function newStay() {
    show(<Opener kind="stay" />)
    await userEvent.click(screen.getByRole('button', { name: 'open' }))
    return within(screen.getByRole('dialog', { name: 'new stay' }))
  }

  it('a form opens as a full page', async () => {
    await newStay()
    expect(screen.getByRole('dialog', { name: 'new stay' })).toHaveClass('page')
  })

  it('a stay asks only where, when, booking and cost, in that order, with no pills', async () => {
    const d = await newStay()
    expect([...screen.getByRole('dialog').querySelectorAll('.form-q')].map((q) => q.textContent)).toEqual(['where are you staying?', 'when', 'booking', 'cost'])
    expect(d.queryByRole('group', { name: 'status' })).toBeNull()
    expect(d.queryByRole('group', { name: 'payment' })).toBeNull()
    expect(screen.getByRole('dialog').querySelector('.choice-chip')).toBeNull()
  })

  it('"booked" is a switch; once on, the booking ref appears, and off means to book', async () => {
    const d = await newStay()
    const booked = d.getByRole('switch', { name: 'booked' })
    expect(booked).toHaveAttribute('aria-checked', 'false')
    expect(d.queryByLabelText('booking ref')).toBeNull()
    await userEvent.click(booked)
    expect(booked).toHaveAttribute('aria-checked', 'true')
    expect(d.getByLabelText('booking ref')).toBeInTheDocument()
    await userEvent.click(booked)
    await userEvent.type(d.getByLabelText('name'), 'glass igloo')
    await userEvent.click(screen.getByRole('button', { name: 'save' }))
    expect(db.save).toHaveBeenCalledWith('stops', expect.objectContaining({ status: 'to_book' }))
  })

  it('who paid is your faces, once it is paid', async () => {
    const d = await newStay()
    expect(d.queryByRole('group', { name: 'paid by' })).toBeNull()
    await userEvent.click(d.getByRole('switch', { name: 'paid already' }))
    const faces = within(d.getByRole('group', { name: 'paid by' }))
    expect(faces.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['shanice', 'kai'])
    await userEvent.click(faces.getByRole('button', { name: 'kai' }))
    expect(faces.getByRole('button', { name: 'kai' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('dates open the app\'s own calendar, and a tapped day is the date', async () => {
    const d = await newStay()
    await userEvent.click(d.getByRole('button', { name: /^choose check-out/ }))
    const cal = within(screen.getByRole('dialog', { name: 'check-out' }))
    await userEvent.click(cal.getByRole('button', { name: 'wed 10 feb' }))
    expect(screen.queryByRole('dialog', { name: 'check-out' })).toBeNull()
    expect(d.getByLabelText('check-out')).toHaveValue('2027-02-10')
  })
})

// the card's "next ·" row: directions to the next stop of its day
describe('next stop', () => {
  const at = (lat: number, lng: number, name: string) => place({ name, lat, lng })
  const A = at(66.5, 25.7, 'A'), B = at(66.52, 25.75, 'B'), C = at(66.6, 25.9, 'C'), H = at(66.55, 25.8, 'hostel')
  function OpenDay({ id, day }: { id: string; day?: string | null }) {
    const s = useStopSheet()!
    return <button onClick={() => s.openStop(id, day)}>open</button>
  }
  async function card(id: string, day?: string | null) {
    show(<OpenDay id={id} day={day} />)
    await userEvent.click(screen.getByRole('button', { name: 'open' }))
    return screen.getByRole('dialog')
  }
  const two = () => [
    stop({ id: 'a', trip_id: 'lap', title: 'a', day: '2027-02-08', time: '10:00', place: A }),
    stop({ id: 'b', trip_id: 'lap', title: 'b', day: '2027-02-08', time: '12:00', place: B }),
  ]
  const hostel = (o = {}) => stop({ id: 'h', trip_id: 'lap', kind: 'stay', title: 'hostel', day: '2027-02-07', end_date: '2027-02-09', place: H, ...o })

  it('a stop\'s card links to the next stop', async () => {
    db.stops = two()
    const d = await card('a')
    expect(within(d).getByRole('link', { name: 'next · b' })).toHaveAttribute('href', directionsUrl(A as any, B as any))
  })

  it('the last stop\'s next is tonight\'s bed', async () => {
    db.stops = [...two(), hostel()]
    const d = await card('b')
    expect(within(d).getByRole('link', { name: 'next · hostel' })).toBeInTheDocument()
  })

  it('a stay opened from a day starts that morning', async () => {
    db.stops = [...two(), hostel()]
    const d = await card('h', '2027-02-08')
    expect(within(d).getByRole('link', { name: 'next · a' })).toBeInTheDocument()
  })

  it('a stay opened without a day uses its check-in day', async () => {
    db.stops = [hostel({ time: '15:00' }), stop({ id: 'c', trip_id: 'lap', title: 'c', day: '2027-02-07', time: '18:00', place: C })]
    const d = await card('h')
    expect(within(d).getByRole('link', { name: 'next · c' })).toBeInTheDocument()
  })

  it('a stay with no day shows no next row', async () => {
    db.stops = [hostel({ day: null, end_date: null })]
    const d = await card('h')
    expect(within(d).queryByRole('link', { name: /^next/ })).toBeNull()
  })

  it('no next for an unlocated or last stop with no bed', async () => {
    db.stops = [...two(), stop({ id: 'n', trip_id: 'lap', title: 'n', day: '2027-02-08', place: null })]
    expect(within(await card('n')).queryByRole('link', { name: /^next/ })).toBeNull()
  })

  it('the next stop reads as the day lists it, its title over its place', async () => {
    db.stops = [two()[0], stop({ id: 'd', trip_id: 'lap', title: 'Dinner', day: '2027-02-08', time: '19:00', place: at(66.52, 25.75, 'restaurant olo') })]
    expect(within(await card('a')).getByRole('link', { name: 'next · dinner' })).toBeInTheDocument()
  })

  it('a journey next reads as where it starts', async () => {
    db.stops = [two()[0], stop({ id: 'j', trip_id: 'lap', kind: 'journey', title: 'night train', day: '2027-02-08', time: '20:00', origin: at(66.52, 25.75, 'Rovaniemi station'), destination: at(60.17, 24.94, 'helsinki') })]
    expect(within(await card('a')).getByRole('link', { name: 'next · rovaniemi station' })).toBeInTheDocument()
  })

  it('the last stop with no bed has no next', async () => {
    db.stops = two()
    expect(within(await card('b')).queryByRole('link', { name: /^next/ })).toBeNull()
  })

  it('a side trip\'s stop reads its day through the top trip', async () => {
    db.trips = [...db.trips, trip({ id: 'kid', name: 'kid', parent_id: 'lap', start_date: '2027-02-08', end_date: '2027-02-08' })]
    db.stops = [{ ...two()[0], trip_id: 'kid' }, { ...two()[1], trip_id: 'kid' }]
    expect(within(await card('a')).getByRole('link', { name: 'next · b' })).toBeInTheDocument()
  })
})
