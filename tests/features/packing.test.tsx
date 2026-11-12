import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { trip } from '../factories'

const db = vi.hoisted(() => ({ packing: [] as any[], save: vi.fn(), remove: vi.fn(), packingQ: null as null | Record<string, unknown>, canEdit: true, me: 'u-s' as string | null,
  members: [{ email: 's@x.com', user_id: 'u-s', name: 'Shanice', color: 0 }, { email: 'k@x.com', user_id: 'u-k', name: 'Kiahna', color: 1 }] as any[] }))
vi.mock('../../src/lib/queries', () => ({
  usePacking: () => db.packingQ ?? ({ data: db.packing }),
  useMembers: () => ({ data: db.members }),
  useSave: () => ({ mutateAsync: db.save, mutate: db.save, isPending: false }),
  useRemove: () => ({ mutateAsync: db.remove, mutate: db.remove, isPending: false }),
}))
vi.mock('../../src/lib/offline', () => ({ useCanEdit: () => db.canEdit, useOnline: () => true }))
vi.mock('../../src/lib/auth', () => ({ useAuth: () => ({ userId: db.me }) }))

import { PackingTab } from '../../src/features/packing/PackingTab'
import { ToastProvider } from '../../src/components/Toast'
import { failSave, forgetPending } from '../../src/lib/pending'

it('packing: add, tick, count', async () => {
  db.packing = [
    { id: 'p1', trip_id: 'lap', text: 'thermal gloves', done: true, position: 0 },
    { id: 'p2', trip_id: 'lap', text: 'passport', done: false, position: 3 },
    { id: 'px', trip_id: 'other', text: 'sunscreen', done: false, position: 0 },
  ]
  db.save.mockReset().mockResolvedValue({})
  render(<PackingTab trip={trip({ id: 'lap' })} />)
  expect(screen.getByText('1 of 2 packed')).toBeInTheDocument()
  expect(screen.queryByText('sunscreen')).toBeNull()
  await userEvent.type(screen.getByRole('textbox', { name: 'add to pack' }), 'wool socks{Enter}')
  expect(db.save).toHaveBeenCalledWith({ trip_id: 'lap', text: 'wool socks', owner: 'u-s', packed_by: [], position: 4 })
  expect(screen.getByRole('textbox', { name: 'add to pack' })).toHaveValue('')
  await userEvent.click(screen.getByRole('checkbox', { name: 'passport' }))
  expect(db.save).toHaveBeenCalledWith({ id: 'p2', packed_by: ['u-s'] })
})

it('the add row has a visible add button that adds, like enter', async () => {
  db.packing = []
  db.save.mockReset().mockResolvedValue({})
  render(<PackingTab trip={trip({ id: 'lap' })} />)
  const add = screen.getByRole('button', { name: 'add to pack' })
  expect(add).toHaveTextContent('add')
  await userEvent.type(screen.getByRole('textbox', { name: 'add to pack' }), 'adapter')
  await userEvent.click(add)
  expect(db.save).toHaveBeenCalledWith(expect.objectContaining({ trip_id: 'lap', text: 'adapter' }))
  expect(screen.getByRole('textbox', { name: 'add to pack' })).toHaveValue('')
})

it('an empty list shows just the field', () => {
  db.packing = []
  render(<PackingTab trip={trip({ id: 'lap' })} />)
  expect(screen.getByRole('textbox', { name: 'add to pack' })).toBeInTheDocument()
  expect(screen.queryByText(/packed/)).toBeNull()
})

const loading = { data: undefined, status: 'pending', fetchStatus: 'fetching' }

beforeEach(() => { db.packingQ = null })

it('the list still loading shows grey rows and no add field yet', () => {
  db.packingQ = loading
  render(<PackingTab trip={trip({ id: 'lap' })} />)
  expect(screen.getByRole('status', { name: 'loading' })).toBeInTheDocument()
  expect(screen.queryByRole('textbox', { name: 'add to pack' })).toBeNull()
})

afterEach(() => forgetPending())

it('an item whose save failed says so, and retries', async () => {
  db.packing = [{ id: 'p2', trip_id: 'lap', text: 'passport', done: true, position: 0 }]
  db.save.mockReset().mockResolvedValue({})
  failSave('packing', 'p2', { done: true }, false)
  render(<PackingTab trip={trip({ id: 'lap' })} />)
  expect(screen.getByRole('alert')).toHaveTextContent("couldn't save")
  await userEvent.click(screen.getByRole('button', { name: 'retry' }))
  expect(db.save).toHaveBeenCalledWith({ id: 'p2', done: true })
})

it('removing an item can be undone', async () => {
  db.packing = [{ id: 'p1', trip_id: 'lap', text: 'thermal gloves', done: false, position: 0 }]
  db.remove.mockReset().mockResolvedValue(undefined)
  render(<ToastProvider><PackingTab trip={trip({ id: 'lap' })} /></ToastProvider>)
  await userEvent.click(screen.getByRole('button', { name: 'edit thermal gloves' }))
  await userEvent.click(screen.getByRole('button', { name: 'remove' }))
  expect(screen.getByRole('status')).toHaveTextContent('removed')
  await userEvent.click(screen.getByRole('button', { name: 'undo' }))
  expect(db.remove).not.toHaveBeenCalled()
})

it('edits a packing item without changing packed status', async () => {
  db.packing = [{ id: 'p1', trip_id: 'lap', text: 'gloves', done: true, position: 0 }]
  db.save.mockReset().mockResolvedValue({})
  render(<PackingTab trip={trip({ id: 'lap' })} />)
  await userEvent.click(screen.getByRole('button', { name: 'edit gloves' }))
  const input = screen.getByRole('textbox', { name: 'packing item' })
  await userEvent.clear(input)
  await userEvent.type(input, 'warm gloves')
  await userEvent.click(screen.getByRole('button', { name: 'save' }))
  expect(db.save).toHaveBeenCalledWith({ id: 'p1', text: 'warm gloves' })
})

beforeEach(() => { db.canEdit = true; db.me = 'u-s' })

it('a row is just the tick and the name; there is no select mode', () => {
  db.packing = [{ id: 'p1', trip_id: 'lap', text: 'gloves', done: false, position: 0 }]
  render(<PackingTab trip={trip({ id: 'lap' })} />)
  const row = within(screen.getByRole('list', { name: 'packing' }).querySelector('li') as HTMLElement)
  expect(row.getAllByRole('checkbox')).toHaveLength(1)
  expect(row.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['edit gloves'])
  expect(screen.queryByRole('button', { name: 'select' })).toBeNull()
})

it('packed things sink below what is still to pack', () => {
  db.packing = [{ id: 'a', trip_id: 'lap', text: 'passport', done: true, position: 0 }, { id: 'b', trip_id: 'lap', text: 'rain jacket', done: false, position: 1 }, { id: 'c', trip_id: 'lap', text: 'adapter', done: false, position: 2 }]
  render(<PackingTab trip={trip({ id: 'lap' })} />)
  expect(screen.getAllByRole('checkbox').map((c) => c.getAttribute('aria-label'))).toEqual(['rain jacket', 'adapter', 'passport'])
})

it('the count comes with a meter in ink', () => {
  db.packing = [{ id: 'a', trip_id: 'lap', text: 'passport', done: true, position: 0 }, { id: 'b', trip_id: 'lap', text: 'jacket', done: false, position: 1 }]
  render(<PackingTab trip={trip({ id: 'lap' })} />)
  expect(screen.getByText('1 of 2 packed')).toBeInTheDocument()
  expect((document.querySelector('.pack-meter > span') as HTMLElement).style.width).toBe('50%')
})

it('a long swipe left removes an item, with undo', async () => {
  db.packing = [{ id: 'p1', trip_id: 'lap', text: 'gloves', done: false, position: 0 }]
  db.remove.mockReset().mockResolvedValue(undefined)
  render(<ToastProvider><PackingTab trip={trip({ id: 'lap' })} /></ToastProvider>)
  const li = screen.getByRole('list', { name: 'packing' }).querySelector('li') as HTMLElement
  fireEvent.pointerDown(li, { clientX: 300, pointerId: 1 })
  fireEvent.pointerMove(li, { clientX: 200, pointerId: 1 })
  fireEvent.pointerUp(li, { clientX: 200, pointerId: 1 })
  expect(screen.getByRole('status')).toHaveTextContent('removed')
})

it('a short swipe does nothing', () => {
  db.packing = [{ id: 'p1', trip_id: 'lap', text: 'gloves', done: false, position: 0 }]
  render(<ToastProvider><PackingTab trip={trip({ id: 'lap' })} /></ToastProvider>)
  const li = screen.getByRole('list', { name: 'packing' }).querySelector('li') as HTMLElement
  fireEvent.pointerDown(li, { clientX: 300, pointerId: 1 })
  fireEvent.pointerUp(li, { clientX: 260, pointerId: 1 })
  expect(screen.getByRole('status')).not.toHaveTextContent('removed')
})

it('adding sits as the last row of the list', () => {
  db.packing = [{ id: 'p1', trip_id: 'lap', text: 'gloves', done: false, position: 0 }]
  render(<PackingTab trip={trip({ id: 'lap' })} />)
  const items = screen.getByRole('list', { name: 'packing' }).querySelectorAll('li')
  expect(within(items[items.length - 1]).getByRole('textbox', { name: 'add to pack' })).toBeInTheDocument()
})

it('offline nothing in packing can be changed', () => {
  db.canEdit = false
  db.packing = [{ id: 'p1', trip_id: 'lap', text: 'gloves', done: false, position: 0 }]
  render(<PackingTab trip={trip({ id: 'lap' })} />)
  expect(screen.getByRole('checkbox', { name: 'gloves' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'edit gloves' })).toBeDisabled()
  expect(screen.queryByRole('textbox', { name: 'add to pack' })).toBeNull()
})

// whose things: shanice's yellow shirt isn't on kiahna's list; shared things are on both
const S = 'u-s', K = 'u-k'
const mixed = () => [
  { id: 'a', trip_id: 'lap', text: 'yellow shirt', done: false, position: 0, owner: S, packed_by: [] },
  { id: 'b', trip_id: 'lap', text: 'hair dryer', done: false, position: 1, owner: K, packed_by: [] },
  { id: 'c', trip_id: 'lap', text: 'sunscreen', done: false, position: 2, owner: null, packed_by: [K] },
]
const names = () => screen.getAllByRole('checkbox').map((c) => c.getAttribute('aria-label'))

it('everything shows until a face is picked; a face shows their things and the shared ones', async () => {
  db.packing = mixed()
  render(<PackingTab trip={trip({ id: 'lap' })} />)
  const faces = screen.getByRole('group', { name: 'whose things' })
  expect(within(faces).getAllByRole('button').map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'false'])
  expect(names()).toEqual(['yellow shirt', 'hair dryer', 'sunscreen'])
  expect(screen.getByText('0 of 3 packed')).toBeInTheDocument()
  await userEvent.click(within(faces).getByRole('button', { name: 'kiahna' }))
  expect(within(faces).getByRole('button', { name: 'kiahna' })).toHaveAttribute('aria-pressed', 'true')
  expect(names()).toEqual(['hair dryer', 'sunscreen'])
  expect(screen.getByText('1 of 2 packed')).toBeInTheDocument()
  await userEvent.click(within(faces).getByRole('button', { name: 'kiahna' }))
  expect(names()).toEqual(['yellow shirt', 'hair dryer', 'sunscreen'])
})

it("a shared thing kiahna packed sinks on kiahna's list only", async () => {
  db.packing = mixed()
  render(<PackingTab trip={trip({ id: 'lap' })} />)
  expect(screen.getByRole('checkbox', { name: 'sunscreen' })).not.toBeChecked()
  await userEvent.click(screen.getByRole('button', { name: 'kiahna' }))
  expect(screen.getByRole('checkbox', { name: 'sunscreen' })).toBeChecked()
  expect(names()).toEqual(['hair dryer', 'sunscreen'])
  await userEvent.click(screen.getByRole('button', { name: 'shanice' }))
  expect(screen.getByRole('checkbox', { name: 'sunscreen' })).not.toBeChecked()
})

it('each row says whose it is, and who has packed a shared thing', () => {
  db.packing = mixed()
  render(<PackingTab trip={trip({ id: 'lap' })} />)
  const rows = [...screen.getByRole('list', { name: 'packing' }).querySelectorAll('li')]
  expect(rows[0]).toHaveTextContent('shanice')
  expect(rows[1]).toHaveTextContent('kiahna')
  expect(rows[2]).toHaveTextContent('both · kiahna packed')
})

it('with nobody picked, ticking a shared thing ticks it for me', async () => {
  db.packing = mixed()
  db.save.mockReset().mockResolvedValue({})
  render(<PackingTab trip={trip({ id: 'lap' })} />)
  await userEvent.click(screen.getByRole('checkbox', { name: 'sunscreen' }))
  expect(db.save).toHaveBeenCalledWith({ id: 'c', packed_by: [K, S] })
})

it("on kiahna's list a shared tick is kiahna's, and anyone can tick someone's own thing for them", async () => {
  db.packing = mixed()
  db.save.mockReset().mockResolvedValue({})
  render(<PackingTab trip={trip({ id: 'lap' })} />)
  await userEvent.click(screen.getByRole('checkbox', { name: 'hair dryer' }))
  expect(db.save).toHaveBeenCalledWith({ id: 'b', packed_by: [K] })
  await userEvent.click(screen.getByRole('button', { name: 'kiahna' }))
  await userEvent.click(screen.getByRole('checkbox', { name: 'sunscreen' }))
  expect(db.save).toHaveBeenCalledWith({ id: 'c', packed_by: [] })
})

it("adding goes to the face picked, else to me", async () => {
  db.packing = []
  db.save.mockReset().mockResolvedValue({})
  render(<PackingTab trip={trip({ id: 'lap' })} />)
  await userEvent.type(screen.getByRole('textbox', { name: 'add to pack' }), 'yellow shirt{Enter}')
  expect(db.save).toHaveBeenLastCalledWith(expect.objectContaining({ text: 'yellow shirt', owner: S }))
  await userEvent.click(screen.getByRole('button', { name: 'kiahna' }))
  await userEvent.type(screen.getByRole('textbox', { name: 'add to pack' }), 'hair dryer{Enter}')
  expect(db.save).toHaveBeenLastCalledWith(expect.objectContaining({ text: 'hair dryer', owner: K }))
})

it('editing a thing can change whose it is', async () => {
  db.packing = mixed()
  db.save.mockReset().mockResolvedValue({})
  render(<PackingTab trip={trip({ id: 'lap' })} />)
  await userEvent.click(screen.getByRole('button', { name: 'edit yellow shirt' }))
  const whose = screen.getByRole('group', { name: 'whose' })
  expect(within(whose).getAllByRole('button').map((b) => [b.getAttribute('aria-label'), b.getAttribute('aria-pressed')]))
    .toEqual([['for shanice', 'true'], ['for kiahna', 'false'], ['for both', 'false']])
  await userEvent.click(within(whose).getByRole('button', { name: 'for both' }))
  await userEvent.click(screen.getByRole('button', { name: 'save' }))
  expect(db.save).toHaveBeenCalledWith({ id: 'a', owner: null })
})

it('with only one person signed up there are no faces to pick', () => {
  db.members = [db.members[0]]
  db.packing = [{ id: 'p1', trip_id: 'lap', text: 'gloves', done: false, position: 0 }]
  render(<PackingTab trip={trip({ id: 'lap' })} />)
  expect(screen.queryByRole('group', { name: 'whose things' })).toBeNull()
  db.members = [{ email: 's@x.com', user_id: 'u-s', name: 'Shanice', color: 0 }, { email: 'k@x.com', user_id: 'u-k', name: 'Kiahna', color: 1 }]
})
