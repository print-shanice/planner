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
  await userEvent.type(within(d).getByLabelText('amount'), '120')
  await userEvent.click(within(d).getByRole('button', { name: 'paid' }))
  await userEvent.selectOptions(within(d).getByLabelText('paid by'), 'u2')
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
  await userEvent.type(within(d).getByLabelText('amount'), '30')
  expect(within(d).getByRole('button', { name: 'not paid' })).toHaveClass('choice-chip', 'idle')
  expect(within(d).getByRole('button', { name: 'paid' })).toHaveClass('choice-chip', 'ok')
  expect(within(d).queryByLabelText('paid by')).toBeNull()
  await userEvent.click(within(d).getByRole('button', { name: 'paid' }))
  expect(within(d).getByLabelText('paid by')).toHaveValue('u1')
  await userEvent.click(within(d).getByRole('button', { name: 'not paid' }))
  await userEvent.click(within(d).getByRole('button', { name: 'save' }))
  expect(db.save).toHaveBeenCalledWith('costs', expect.objectContaining({ amount: 30, status: 'estimate', paid_by: null }))
})

it('an older paid cost with no payer asks who paid', async () => {
  db.costs = [cost({ id: 'c1', trip_id: 'lap', stop_id: 's1', amount: 50, status: 'paid', paid_by: null })]
  const d = await openEdit()
  expect(within(d).getByRole('button', { name: 'paid' })).toHaveAttribute('aria-pressed', 'true')
  await userEvent.click(within(d).getByRole('button', { name: 'save' }))
  expect(within(d).getByText('pick who paid')).toBeInTheDocument()
  expect(db.save).not.toHaveBeenCalled()
})

it('an older estimate with a payer saves as not paid with no payer', async () => {
  db.costs = [cost({ id: 'c1', trip_id: 'lap', stop_id: 's1', amount: 50, status: 'estimate', paid_by: 'u2' })]
  const d = await openEdit()
  expect(within(d).getByRole('button', { name: 'not paid' })).toHaveAttribute('aria-pressed', 'true')
  await userEvent.click(within(d).getByRole('button', { name: 'save' }))
  expect(db.save).toHaveBeenCalledWith('costs', expect.objectContaining({ id: 'c1', status: 'estimate', paid_by: null }))
})

it('the stop view says whether it is paid', async () => {
  db.costs = [cost({ id: 'c1', trip_id: 'lap', stop_id: 's1', amount: 50, status: 'estimate', paid_by: 'u2' })]
  show(<Opener id="s1" />)
  await userEvent.click(screen.getByRole('button', { name: 'open' }))
  expect(within(screen.getByRole('dialog')).getByText(/not paid/)).toBeInTheDocument()
})

it('a new journey shows its essentials and folds the rest, with save in the footer', async () => {
  show(<Opener kind="journey" />)
  await userEvent.click(screen.getByRole('button', { name: 'open' }))
  const d = screen.getByRole('dialog', { name: 'new journey' })
  for (const l of ['from', 'to', 'depart', 'depart time', 'arrive', 'arrive time']) expect(within(d).getByLabelText(l)).toBeInTheDocument()
  const folds = [...d.querySelectorAll('.fold-toggle')].map((x) => [x.textContent, x.getAttribute('aria-expanded')])
  expect(folds).toEqual([['cost', 'false'], ['notes & links', 'false']])
  expect(within(d).getByRole('button', { name: 'save' }).closest('.sheet-foot')).not.toBeNull()
})

it('booking status is a choice in its colours: idea grey, to book amber, booked green', async () => {
  show(<Opener kind="place" />)
  await userEvent.click(screen.getByRole('button', { name: 'open' }))
  const d = screen.getByRole('dialog')
  const status = within(d).getByRole('group', { name: 'status' })
  expect(within(status).getByRole('button', { name: 'idea' })).toHaveClass('choice-chip', 'idle')
  expect(within(status).getByRole('button', { name: 'idea' })).toHaveAttribute('aria-pressed', 'true')
  expect(within(status).getByRole('button', { name: 'to book' })).toHaveClass('warn')
  expect(within(status).getByRole('button', { name: 'booked' })).toHaveClass('ok')
})

it('the booking ref shows once booked, and a journey asks for its carrier once it is being booked', async () => {
  show(<Opener kind="journey" />)
  await userEvent.click(screen.getByRole('button', { name: 'open' }))
  const d = screen.getByRole('dialog')
  expect(within(d).queryByLabelText('booking ref')).toBeNull()
  expect(within(d).queryByLabelText('carrier / number')).toBeNull()
  await userEvent.click(within(d).getByRole('button', { name: 'to book' }))
  expect(within(d).getByLabelText('carrier / number')).toBeInTheDocument()
  expect(within(d).queryByLabelText('booking ref')).toBeNull()
  await userEvent.click(within(d).getByRole('button', { name: 'booked' }))
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

it('a cost problem opens the cost fold', async () => {
  const d = await openEdit()
  const fold = within(d).getByRole('button', { name: 'cost' })
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

it('booking status sits right under the name, before the place', async () => {
  show(<Opener kind="stay" />)
  await userEvent.click(screen.getByRole('button', { name: 'open' }))
  const d = screen.getByRole('dialog')
  const name = within(d).getByLabelText('name')
  const status = within(d).getByRole('group', { name: 'status' })
  const location = within(d).getByLabelText('location')
  expect(name.compareDocumentPosition(status) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(status.compareDocumentPosition(location) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

it('paid or not paid sits in the cost header, and paid opens the cost to say who paid', async () => {
  show(<Opener kind="place" />)
  await userEvent.click(screen.getByRole('button', { name: 'open' }))
  const d = screen.getByRole('dialog')
  const payment = within(d).getByRole('group', { name: 'payment' })
  expect(payment.closest('.fold-head')).toBe(within(d).getByRole('button', { name: 'cost' }).closest('.fold-head'))
  await userEvent.click(within(payment).getByRole('button', { name: 'paid' }))
  expect(within(d).getByRole('button', { name: 'cost' })).toHaveAttribute('aria-expanded', 'true')
  expect(within(d).getByLabelText('paid by')).toBeVisible()
})
