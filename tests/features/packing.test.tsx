import type { PackingItem } from '../../src/lib/types'
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
  // new things go to the top, under the add line
  expect(db.save).toHaveBeenCalledWith({ trip_id: 'lap', text: 'wool socks', owner: 'u-s', packed_by: [], position: -1 })
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

it('the add line has a bag dropdown beside it, and the picked bag stays for the next thing', async () => {
  db.packing = []
  db.save.mockReset().mockResolvedValue({})
  render(<PackingTab trip={trip({ id: 'lap' })} />)
  const field = screen.getByRole('textbox', { name: 'add to pack' })
  const which = screen.getByRole('button', { name: 'which bag' })
  // the planner's own dropdown, on the add line, not a row of words under it
  expect(which.closest('form')).toBe(field.closest('form'))
  expect(which).toHaveAttribute('aria-haspopup', 'listbox')
  expect(which).toHaveTextContent(/^no bag$/)
  expect(screen.queryByRole('group', { name: 'bag' })).toBeNull()
  await userEvent.type(field, 'adapter')
  expect(screen.queryByRole('group', { name: 'bag' })).toBeNull()
  await userEvent.click(which)
  expect(within(screen.getByRole('listbox', { name: 'which bag' })).getAllByRole('option').map((o) => o.textContent)).toEqual(['check-in', 'carry-on', 'wear', 'no bag'])
  expect(screen.getByRole('option', { name: 'no bag' })).toHaveAttribute('aria-selected', 'true')
  await userEvent.click(screen.getByRole('option', { name: 'carry-on' }))
  expect(which).toHaveTextContent(/^carry-on$/)
  // the field takes focus back, so enter adds
  expect(field).toHaveFocus()
  await userEvent.keyboard('{Enter}')
  expect(db.save).toHaveBeenLastCalledWith(expect.objectContaining({ text: 'adapter', bag: 'carry' }))
  expect(which).toHaveTextContent(/^carry-on$/)
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

it('a long swipe right does nothing (only left removes)', () => {
  db.packing = [{ id: 'p1', trip_id: 'lap', text: 'gloves', done: false, position: 0 }]
  render(<ToastProvider><PackingTab trip={trip({ id: 'lap' })} /></ToastProvider>)
  const li = screen.getByRole('list', { name: 'packing' }).querySelector('li') as HTMLElement
  fireEvent.pointerDown(li, { clientX: 100, pointerId: 1 })
  fireEvent.pointerMove(li, { clientX: 250, pointerId: 1 })
  expect(li.style.transform).toBe('')
  fireEvent.pointerUp(li, { clientX: 250, pointerId: 1 })
  expect(screen.getByRole('status')).not.toHaveTextContent('removed')
})

it('adding sits above the list, like links, not inside it', () => {
  db.packing = [{ id: 'p1', trip_id: 'lap', text: 'gloves', done: false, position: 0 }]
  render(<PackingTab trip={trip({ id: 'lap' })} />)
  const list = screen.getByRole('list', { name: 'packing' })
  const field = screen.getByRole('textbox', { name: 'add to pack' })
  expect(list).not.toContainElement(field)
  expect(field.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

it('offline nothing in packing can be changed', () => {
  db.canEdit = false
  db.packing = [{ id: 'p1', trip_id: 'lap', text: 'gloves', done: false, position: 0 }]
  render(<PackingTab trip={trip({ id: 'lap' })} />)
  expect(screen.getByRole('checkbox', { name: 'gloves' })).toBeDisabled()
  // nothing to edit offline, so no "edit" at all
  expect(screen.queryByRole('button', { name: 'edit gloves' })).toBeNull()
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

const tab = (name: string) => within(screen.getByRole('tablist', { name: 'whose list' })).getByRole('tab', { name })

it("the lists are mine and kiahna's, mine open first; shared things are on both", async () => {
  db.packing = mixed()
  render(<PackingTab trip={trip({ id: 'lap' })} />)
  expect(within(screen.getByRole('tablist', { name: 'whose list' })).getAllByRole('tab').map((t) => [t.textContent, t.getAttribute('aria-selected')]))
    .toEqual([['mine', 'true'], ["kiahna's", 'false']])
  expect(names()).toEqual(['yellow shirt', 'sunscreen'])
  expect(screen.getByText('0 of 2 packed')).toBeInTheDocument()
  await userEvent.click(tab("kiahna's"))
  expect(names()).toEqual(['hair dryer', 'sunscreen'])
  expect(screen.getByText('1 of 2 packed')).toBeInTheDocument()
})

it("a shared thing kiahna packed is packed on kiahna's list only", async () => {
  db.packing = mixed()
  render(<PackingTab trip={trip({ id: 'lap' })} />)
  expect(screen.getByRole('checkbox', { name: 'sunscreen' })).not.toBeChecked()
  await userEvent.click(tab("kiahna's"))
  expect(screen.getByRole('checkbox', { name: 'sunscreen' })).toBeChecked()
  expect(within(screen.getByRole('list', { name: 'packed' })).getByText('sunscreen')).toBeInTheDocument()
})

it('rows have no faces; the bag is a quiet word at the end', () => {
  db.packing = [{ ...mixed()[0], bag: 'carry' }, mixed()[2]]
  render(<PackingTab trip={trip({ id: 'lap' })} />)
  const rows = [...screen.getByRole('list', { name: 'packing' }).querySelectorAll('li')]
  expect(rows[0]).toHaveTextContent(/^yellow shirteditcarry-on$/)
  expect(rows[0].querySelector('.pack-bag')).toHaveTextContent(/^carry-on$/)
  expect(rows[1]).toHaveTextContent(/^sunscreenedit$/)
  expect(document.querySelector('.avatar')).toBeNull()
})

it("on kiahna's list a tick is kiahna's", async () => {
  db.packing = mixed()
  db.save.mockReset().mockResolvedValue({})
  render(<PackingTab trip={trip({ id: 'lap' })} />)
  await userEvent.click(tab("kiahna's"))
  await userEvent.click(screen.getByRole('checkbox', { name: 'hair dryer' }))
  expect(db.save).toHaveBeenCalledWith({ id: 'b', packed_by: [K] })
  await userEvent.click(screen.getByRole('checkbox', { name: 'sunscreen' }))
  expect(db.save).toHaveBeenCalledWith({ id: 'c', packed_by: [] })
})

it('adding goes on the open list', async () => {
  db.packing = []
  db.save.mockReset().mockResolvedValue({})
  render(<PackingTab trip={trip({ id: 'lap' })} />)
  await userEvent.type(screen.getByRole('textbox', { name: 'add to pack' }), 'yellow shirt{Enter}')
  expect(db.save).toHaveBeenLastCalledWith(expect.objectContaining({ text: 'yellow shirt', owner: S }))
  await userEvent.click(tab("kiahna's"))
  await userEvent.type(screen.getByRole('textbox', { name: 'add to pack' }), 'hair dryer{Enter}')
  expect(db.save).toHaveBeenLastCalledWith(expect.objectContaining({ text: 'hair dryer', owner: K }))
})

it('editing a thing can change whose it is and its bag', async () => {
  db.packing = mixed()
  db.save.mockReset().mockResolvedValue({})
  render(<PackingTab trip={trip({ id: 'lap' })} />)
  await userEvent.click(screen.getByRole('button', { name: 'edit yellow shirt' }))
  const whose = screen.getByRole('group', { name: 'whose' })
  expect(within(whose).getAllByRole('button').map((b) => [b.textContent, b.getAttribute('aria-pressed')]))
    .toEqual([['mine', 'true'], ["kiahna's", 'false'], ['both', 'false']])
  const bag = screen.getByRole('group', { name: 'bag' })
  expect(within(bag).getAllByRole('button').map((b) => b.textContent)).toEqual(['check-in', 'carry-on', 'wear', 'no bag'])
  await userEvent.click(within(whose).getByRole('button', { name: 'both' }))
  await userEvent.click(within(bag).getByRole('button', { name: 'wear' }))
  await userEvent.click(screen.getByRole('button', { name: 'save' }))
  expect(db.save).toHaveBeenCalledWith({ id: 'a', owner: null, bag: 'wear' })
})

it('one bag at a time: the filter sits under the meter, the count follows it, and adding puts things in it', async () => {
  db.packing = [
    { id: 'a', trip_id: 'lap', text: 'passport', position: 0, owner: S, packed_by: [S], bag: 'carry' },
    { id: 'b', trip_id: 'lap', text: 'boots', position: 1, owner: S, packed_by: [], bag: 'wear' },
    { id: 'c', trip_id: 'lap', text: 'charger', position: 2, owner: S, packed_by: [], bag: 'carry' },
  ]
  db.save.mockReset().mockResolvedValue({})
  render(<PackingTab trip={trip({ id: 'lap' })} />)
  const filter = screen.getByRole('group', { name: 'show bag' })
  expect(within(filter).getAllByRole('button').map((b) => b.textContent)).toEqual(['all', 'check-in', 'carry-on', 'wear'])
  expect(document.querySelector('.pack-meter')!.nextElementSibling).toBe(filter.closest('.pack-filter-row'))
  expect(names()).toEqual(['boots', 'charger', 'passport'])
  expect(screen.getByText('1 of 3 packed')).toBeInTheDocument()
  await userEvent.click(within(filter).getByRole('button', { name: 'carry-on' }))
  expect(names()).toEqual(['charger', 'passport'])
  expect(screen.getByText('1 of 2 packed')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'which bag' })).toHaveTextContent(/^carry-on$/)
  await userEvent.type(screen.getByRole('textbox', { name: 'add to pack' }), 'book')
  await userEvent.keyboard('{Enter}')
  expect(db.save).toHaveBeenLastCalledWith(expect.objectContaining({ text: 'book', owner: S, bag: 'carry' }))
})

it('copies the open list to another trip, unticked, with bags, and nothing twice', async () => {
  db.packing = [
    { id: 'a', trip_id: 'lap', text: 'passport', position: 0, owner: S, packed_by: [S], bag: 'carry' },
    { id: 'b', trip_id: 'lap', text: 'Sunscreen', position: 1, owner: null, packed_by: [] },
    { id: 'k', trip_id: 'lap', text: 'hair dryer', position: 2, owner: K, packed_by: [] },
    { id: 'x', trip_id: 'gr', text: 'sunscreen ', position: 5, owner: null, packed_by: [] },
  ]
  db.save.mockReset().mockResolvedValue({})
  render(<PackingTab trip={trip({ id: 'lap' })} dates="7 – 11 feb" copyTo={[trip({ id: 'gr', name: 'Greece' })]} />)
  await userEvent.click(screen.getByRole('button', { name: 'copy this list to…' }))
  await userEvent.click(within(screen.getByRole('group', { name: 'copy to' })).getByRole('button', { name: 'greece' }))
  expect(db.save).toHaveBeenCalledTimes(1)
  expect(db.save).toHaveBeenCalledWith({ id: expect.any(String), trip_id: 'gr', text: 'passport', owner: S, packed_by: [], position: 6, bag: 'carry' })
  expect(screen.getByRole('status')).toHaveTextContent('1 copied to greece')
})

it('dates and weather share one line; no copy without another trip', () => {
  db.packing = mixed()
  render(<PackingTab trip={trip({ id: 'lap' })} dates="7 – 11 feb · in 85 days" weather="usually −3° / −11° · snow most days" />)
  const weather = screen.getByLabelText('weather')
  expect(weather).toHaveTextContent('usually −3° / −11° · snow most days')
  expect(weather.closest('.pack-meta')).toHaveTextContent('7 – 11 feb · in 85 days · usually −3° / −11° · snow most days')
  expect(screen.queryByRole('button', { name: 'copy this list to…' })).toBeNull()
})

it('the count sits on the row of whose list, with the meter under it', () => {
  db.packing = mixed()
  render(<PackingTab trip={trip({ id: 'lap' })} />)
  const row = screen.getByRole('tablist', { name: 'whose list' }).closest('.pack-who')!
  expect(row).toHaveTextContent(/\d+ of \d+ packed/)
  expect(row.nextElementSibling).toHaveClass('pack-meter')
})

it('with one person the count and meter still show', () => {
  const both = db.members
  db.members = [both[0]]
  db.packing = mixed()
  render(<PackingTab trip={trip({ id: 'lap' })} />)
  expect(screen.queryByRole('tablist')).toBeNull()
  expect(screen.getByText(/\d+ of \d+ packed/)).toBeInTheDocument()
  expect(document.querySelector('.pack-meter')).not.toBeNull()
  db.members = both
})

it('copying the list sits after the lists', () => {
  db.packing = mixed()
  render(<PackingTab trip={trip({ id: 'lap' })} copyTo={[trip({ id: 'gr', name: 'Greece' })]} />)
  const copy = screen.getByRole('button', { name: 'copy this list to…' })
  expect(screen.getByRole('list', { name: 'packing' }).compareDocumentPosition(copy) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

it('with only one person signed up there are no faces to pick', () => {
  db.members = [db.members[0]]
  db.packing = [{ id: 'p1', trip_id: 'lap', text: 'gloves', done: false, position: 0 }]
  render(<PackingTab trip={trip({ id: 'lap' })} />)
  expect(screen.queryByRole('tablist', { name: 'whose list' })).toBeNull()
  db.members = [{ email: 's@x.com', user_id: 'u-s', name: 'Shanice', color: 0 }, { email: 'k@x.com', user_id: 'u-k', name: 'Kiahna', color: 1 }]
})

it("a copy that fails says so beside the copy link, at the end", async () => {
  db.packing = mixed()
  db.save.mockReset().mockRejectedValue(new Error('down'))
  render(<PackingTab trip={trip({ id: 'lap' })} copyTo={[trip({ id: 'gr', name: 'Greece' })]} />)
  await userEvent.click(screen.getByRole('button', { name: 'copy this list to…' }))
  await userEvent.click(within(screen.getByRole('group', { name: 'copy to' })).getByRole('button', { name: 'greece' }))
  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent("couldn't copy")
  expect(alert.closest('.pack-copy-wrap')).not.toBeNull()
})

describe('packs', () => {
  const pk = (over: Partial<PackingItem>): PackingItem => ({ id: 'x', text: 'x', position: 0, trip_id: 'lap', done: false, packed_by: [], owner: null, ...over })
  const packs = () => [
    pk({ id: 'sh', text: 'shirts', is_pack: true, position: 0, bag: 'check' }),
    pk({ id: 't1', text: 'white tee', parent_id: 'sh', position: 0 }),
    pk({ id: 't2', text: 'black tees', parent_id: 'sh', position: 1, qty: 3 }),
    pk({ id: 't3', text: 'striped shirt', parent_id: 'sh', position: 2, qty: 2, packed_by: [S, K] }),
    pk({ id: 'wa', text: 'toiletries bag', is_pack: true, position: 1, bag: 'carry' }),
    pk({ id: 'b1', text: 'toothbrush', parent_id: 'wa', position: 0 }),
    pk({ id: 's1', text: 'socks', position: 2, qty: 7, bag: 'check' }),
  ]
  const exactly = (name: string) => new RegExp(`^${name}$`)
  const head = (name: string) => screen.getByRole('button', { name: exactly(name) })

  it('packs start folded: name with a chevron, bag, count, and nothing of what is inside; loose things after them', () => {
    db.packing = packs()
    render(<PackingTab trip={trip({ id: 'lap' })} />)
    const shirts = head('shirts')
    const group = shirts.closest('.pack-group')!
    expect(shirts).toHaveAttribute('aria-expanded', 'false')
    expect(group.querySelector('.pack-meta-r')).toHaveTextContent('check-in2 of 6')
    expect(shirts.querySelector('svg')).not.toBeNull()
    expect(group).not.toHaveTextContent('white tee')
    expect(screen.queryByRole('checkbox', { name: 'white tee' })).toBeNull()
    const list = screen.getByRole('list', { name: 'packing' })
    expect([...list.children].map((li) => li.textContent?.split(/edit/)[0])).toEqual(['shirts×6', 'toiletries bag×1', 'socks×7'])
    // the count adds up how many: 6 shirts, a toothbrush and 7 socks; 2 striped shirts packed
    expect(screen.getByText('2 of 14 packed')).toBeInTheDocument()
  })

  it('a tap opens a pack, its things listed with packed ones last and its own add line; one pack open at a time', async () => {
    db.packing = packs()
    render(<PackingTab trip={trip({ id: 'lap' })} />)
    await userEvent.click(head('shirts'))
    expect(head('shirts')).toHaveAttribute('aria-expanded', 'true')
    const inside = screen.getByRole('list', { name: 'shirts' })
    expect(within(inside).getAllByRole('checkbox').map((c) => c.getAttribute('aria-label'))).toEqual(['white tee', 'black tees', 'striped shirt'])
    expect(within(inside).getByRole('textbox', { name: 'add to shirts' })).toBeInTheDocument()
    await userEvent.click(head('toiletries bag'))
    expect(head('shirts')).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('textbox', { name: 'add to shirts' })).toBeNull()
    expect(screen.getByRole('textbox', { name: 'add to toiletries bag' })).toBeInTheDocument()
    await userEvent.click(head('toiletries bag'))
    expect(screen.queryByRole('textbox', { name: 'add to toiletries bag' })).toBeNull()
  })

  it("adding into a pack puts it at the pack's end, whose the pack is, with how many", async () => {
    db.packing = packs()
    db.save.mockReset().mockResolvedValue({})
    render(<PackingTab trip={trip({ id: 'lap' })} />)
    await userEvent.click(head('shirts'))
    await userEvent.type(screen.getByRole('textbox', { name: 'add to shirts' }), '2 grey tees{Enter}')
    expect(db.save).toHaveBeenCalledWith({ trip_id: 'lap', text: 'grey tees', qty: 2, owner: null, packed_by: [], position: 3, parent_id: 'sh' })
    expect(screen.getByRole('textbox', { name: 'add to shirts' })).toHaveValue('')
  })

  it('the main add line reads how many too', async () => {
    db.packing = packs()
    db.save.mockReset().mockResolvedValue({})
    render(<PackingTab trip={trip({ id: 'lap' })} />)
    await userEvent.type(screen.getByRole('textbox', { name: 'add to pack' }), 'socks x5{Enter}')
    expect(db.save).toHaveBeenLastCalledWith(expect.objectContaining({ text: 'socks', qty: 5 }))
    expect(db.save.mock.calls.at(-1)![0]).not.toHaveProperty('parent_id')
  })

  it('a pack with everything packed sits under packed, folded', () => {
    db.packing = packs().map((p) => (p.parent_id === 'wa' ? { ...p, packed_by: [S, K] } : p))
    render(<PackingTab trip={trip({ id: 'lap' })} />)
    expect(within(screen.getByRole('list', { name: 'packed' })).getByRole('button', { name: exactly('toiletries bag') })).toHaveAttribute('aria-expanded', 'false')
    expect(within(screen.getByRole('list', { name: 'packing' })).queryByRole('button', { name: exactly('toiletries bag') })).toBeNull()
  })

  it("the bag filter shows packs in that bag with all they hold; things inside follow their pack's bag", async () => {
    db.packing = packs()
    render(<PackingTab trip={trip({ id: 'lap' })} />)
    await userEvent.click(within(screen.getByRole('group', { name: 'show bag' })).getByRole('button', { name: 'carry-on' }))
    expect(screen.queryByRole('button', { name: exactly('shirts') })).toBeNull()
    expect(head('toiletries bag')).toBeInTheDocument()
    expect(screen.getByText('0 of 1 packed')).toBeInTheDocument()
  })

  it("things inside an open pack show how many, their bag (the pack's unless their own) and their own edit", async () => {
    db.packing = packs()
    render(<PackingTab trip={trip({ id: 'lap' })} />)
    await userEvent.click(head('shirts'))
    const row = screen.getByRole('checkbox', { name: 'black tees' }).closest('li')!
    expect(row).toHaveTextContent(/^black tees×3editcheck-in$/)
    expect(within(row).getByRole('button', { name: 'edit black tees' })).toBeInTheDocument()
  })

  it('new pack: a named pack with its bag is made at the top and opens with the cursor in its add line', async () => {
    db.packing = packs()
    db.save.mockReset().mockResolvedValue({})
    render(<PackingTab trip={trip({ id: 'lap' })} />)
    const filterRow = document.querySelector('.pack-filter-row')!
    await userEvent.click(within(filterRow as HTMLElement).getByRole('button', { name: 'new pack' }))
    const name = screen.getByRole('textbox', { name: 'pack name' })
    expect(name).toHaveFocus()
    expect(screen.getByRole('list', { name: 'packing' }).firstElementChild).toContainElement(name)
    await userEvent.type(name, 'electronics')
    await userEvent.click(screen.getByRole('button', { name: 'which bag for the pack' }))
    await userEvent.click(screen.getByRole('option', { name: 'carry-on' }))
    await userEvent.click(screen.getByRole('button', { name: 'make pack' }))
    expect(db.save).toHaveBeenCalledWith({ id: expect.any(String), trip_id: 'lap', text: 'electronics', is_pack: true, owner: S, packed_by: [], position: -1, bag: 'carry' })
  })

  it('a new pack left without a name goes away on escape, and nothing is saved', async () => {
    db.packing = packs()
    db.save.mockReset().mockResolvedValue({})
    render(<PackingTab trip={trip({ id: 'lap' })} />)
    await userEvent.click(screen.getByRole('button', { name: 'new pack' }))
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('textbox', { name: 'pack name' })).toBeNull()
    expect(db.save).not.toHaveBeenCalled()
  })

  it("an open pack's edit renames it or changes its bag; removing it takes what's inside, with one undo", async () => {
    db.packing = packs()
    db.save.mockReset().mockResolvedValue({})
    render(<ToastProvider><PackingTab trip={trip({ id: 'lap' })} /></ToastProvider>)
    await userEvent.click(head('shirts'))
    await userEvent.click(screen.getByRole('button', { name: 'edit shirts' }))
    const field = screen.getByRole('textbox', { name: 'pack name' })
    expect(field).toHaveValue('shirts')
    expect(screen.queryByRole('group', { name: 'in' })).toBeNull()
    await userEvent.clear(field)
    await userEvent.type(field, 'tops')
    await userEvent.click(within(screen.getByRole('group', { name: 'bag' })).getByRole('button', { name: 'carry-on' }))
    await userEvent.click(screen.getByRole('button', { name: 'save' }))
    expect(db.save).toHaveBeenCalledWith({ id: 'sh', text: 'tops', bag: 'carry' })
    await userEvent.click(screen.getByRole('button', { name: 'edit shirts' }))
    await userEvent.click(screen.getByRole('button', { name: 'remove' }))
    expect(await screen.findByText('removed shirts')).toBeInTheDocument()
  })

  it('a loose thing moves into a pack from "in", keeping its own bag', async () => {
    db.packing = packs()
    db.save.mockReset().mockResolvedValue({})
    render(<PackingTab trip={trip({ id: 'lap' })} />)
    await userEvent.click(screen.getByRole('button', { name: 'edit socks' }))
    expect(screen.getByRole('textbox', { name: 'packing item' })).toHaveValue('7 socks')
    const into = screen.getByRole('group', { name: 'in' })
    expect(within(into).getAllByRole('button').map((b) => b.textContent)).toEqual(['no pack', 'shirts', 'toiletries bag'])
    expect(screen.getByRole('group', { name: 'bag' })).toBeInTheDocument()
    await userEvent.click(within(into).getByRole('button', { name: 'shirts' }))
    // inside a pack it can still go in its own bag (it depends), and it's whose the pack is
    expect(screen.getByRole('group', { name: 'bag' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'whose' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'save' }))
    expect(db.save).toHaveBeenCalledWith({ id: 's1', parent_id: 'sh', position: 3 })
  })

  it('a thing in a pack moves out to the top of the list', async () => {
    db.packing = packs()
    db.save.mockReset().mockResolvedValue({})
    render(<PackingTab trip={trip({ id: 'lap' })} />)
    await userEvent.click(head('shirts'))
    await userEvent.click(screen.getByRole('button', { name: 'edit white tee' }))
    await userEvent.click(within(screen.getByRole('group', { name: 'in' })).getByRole('button', { name: 'no pack' }))
    await userEvent.click(screen.getByRole('button', { name: 'save' }))
    expect(db.save).toHaveBeenCalledWith({ id: 't1', parent_id: null, position: -1 })
  })

  it('copying a list copies its packs with their things inside', async () => {
    db.packing = packs()
    db.save.mockReset().mockResolvedValue({})
    render(<PackingTab trip={trip({ id: 'lap' })} copyTo={[trip({ id: 'gr', name: 'Greece' })]} />)
    await userEvent.click(screen.getByRole('button', { name: 'copy this list to…' }))
    await userEvent.click(within(screen.getByRole('group', { name: 'copy to' })).getByRole('button', { name: 'greece' }))
    const calls = db.save.mock.calls.map((c) => c[0])
    const shirts = calls.find((c) => c.text === 'shirts')
    expect(shirts).toMatchObject({ trip_id: 'gr', is_pack: true, bag: 'check' })
    expect(calls.find((c) => c.text === 'black tees')).toMatchObject({ trip_id: 'gr', parent_id: shirts.id, qty: 3 })
    expect(calls.find((c) => c.text === 'black tees')).not.toHaveProperty('bag')
    expect(screen.getByRole('status')).toHaveTextContent('7 copied to greece')
  })

  it("changing only the bag of an older thing never rewrites its name or sends how many", async () => {
    db.packing = [pk({ id: 'c', text: '2 in 1 charger', position: 0 })]
    db.save.mockReset().mockResolvedValue({})
    render(<PackingTab trip={trip({ id: 'lap' })} />)
    await userEvent.click(screen.getByRole('button', { name: 'edit 2 in 1 charger' }))
    await userEvent.click(within(screen.getByRole('group', { name: 'bag' })).getByRole('button', { name: 'carry-on' }))
    await userEvent.click(screen.getByRole('button', { name: 'save' }))
    expect(db.save).toHaveBeenCalledWith({ id: 'c', bag: 'carry' })
  })

  it("a thing in a pack is whose the pack is: it shows wherever its pack does, and has no whose of its own", async () => {
    // a thing left with another owner than its pack (from before) still shows in its pack
    db.packing = [...packs().filter((p) => p.id !== 't1'), pk({ id: 't1', text: 'white tee', parent_id: 'sh', position: 0, owner: K })]
    render(<PackingTab trip={trip({ id: 'lap' })} />)
    await userEvent.click(head('shirts'))
    expect(within(screen.getByRole('list', { name: 'shirts' })).getByRole('checkbox', { name: 'white tee' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'edit white tee' }))
    expect(screen.queryByRole('group', { name: 'whose' })).toBeNull()
  })

  it("moving a thing into a pack makes it the pack's; changing whose a pack is changes its things too", async () => {
    db.packing = [...packs(), pk({ id: 'mp', text: 'my pack', is_pack: true, position: 5, owner: S }), pk({ id: 'k1', text: 'kindle', position: 6, owner: K })]
    db.save.mockReset().mockResolvedValue({})
    render(<PackingTab trip={trip({ id: 'lap' })} />)
    await userEvent.click(screen.getByRole('tab', { name: "kiahna's" }))
    await userEvent.click(screen.getByRole('button', { name: 'edit kindle' }))
    await userEvent.click(within(screen.getByRole('group', { name: 'in' })).getByRole('button', { name: 'shirts' }))
    await userEvent.click(screen.getByRole('button', { name: 'save' }))
    expect(db.save).toHaveBeenCalledWith({ id: 'k1', owner: null, parent_id: 'sh', position: 3 })
    db.save.mockClear()
    await userEvent.click(head('shirts'))
    await userEvent.click(screen.getByRole('button', { name: 'edit shirts' }))
    await userEvent.click(within(screen.getByRole('group', { name: 'whose' })).getByRole('button', { name: 'mine' }))
    await userEvent.click(screen.getByRole('button', { name: 'save' }))
    expect(db.save).toHaveBeenCalledWith({ id: 'sh', owner: S })
    for (const id of ['t1', 't2', 't3']) expect(db.save).toHaveBeenCalledWith({ id, owner: S })
  })

  it('a pack whose save failed says so, and making it again reuses the same pack', async () => {
    db.packing = []
    db.save.mockReset().mockRejectedValue(new Error('down'))
    render(<PackingTab trip={trip({ id: 'lap' })} />)
    await userEvent.click(screen.getByRole('button', { name: 'new pack' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'pack name' }), 'shirts{Enter}')
    expect(await screen.findByRole('alert')).toHaveTextContent("couldn't save")
    await userEvent.click(screen.getByRole('button', { name: 'make pack' }))
    const ids = db.save.mock.calls.map((c) => c[0].id)
    expect(ids).toHaveLength(2)
    expect(ids[1]).toBe(ids[0])
  })

  it('the pack head says its count to a screen reader, and "edit" sits outside the fold button', async () => {
    db.packing = packs()
    render(<PackingTab trip={trip({ id: 'lap' })} />)
    expect(head('shirts')).toHaveAccessibleDescription('check-in 2 of 6')
    await userEvent.click(head('shirts'))
    const edit = screen.getByRole('button', { name: 'edit shirts' })
    expect(head('shirts')).not.toContainElement(edit)
    expect(edit.closest('.pack-edit-over')).toBeNull()
  })

  it('a new pack keeps its draft when its bag menu is opened before naming it, and escape in that menu keeps it too', async () => {
    db.packing = packs()
    render(<PackingTab trip={trip({ id: 'lap' })} />)
    await userEvent.click(screen.getByRole('button', { name: 'new pack' }))
    await userEvent.click(screen.getByRole('button', { name: 'which bag for the pack' }))
    expect(screen.getByRole('textbox', { name: 'pack name' })).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('textbox', { name: 'pack name' })).toBeInTheDocument()
    // a tap elsewhere drops an unnamed draft
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('textbox', { name: 'pack name' })).toBeNull()
  })

  it('copying never copies the same thing twice', async () => {
    db.packing = [pk({ id: 'a', text: 'adapter', position: 0 }), pk({ id: 'b', text: 'adapter', position: 1 })]
    db.save.mockReset().mockResolvedValue({})
    render(<PackingTab trip={trip({ id: 'lap' })} copyTo={[trip({ id: 'gr', name: 'Greece' })]} />)
    await userEvent.click(screen.getByRole('button', { name: 'copy this list to…' }))
    await userEvent.click(within(screen.getByRole('group', { name: 'copy to' })).getByRole('button', { name: 'greece' }))
    expect(db.save).toHaveBeenCalledTimes(1)
  })

  it("the pack's tick packs everything in it; ticked again it unpacks them all; some packed shows a dash", async () => {
    db.packing = packs()
    db.save.mockReset().mockResolvedValue({})
    render(<PackingTab trip={trip({ id: 'lap' })} />)
    const all = screen.getByRole('checkbox', { name: 'everything in shirts' })
    expect(all).not.toBeChecked()
    expect((all as HTMLInputElement).indeterminate).toBe(true)
    await userEvent.click(all)
    expect(db.save).toHaveBeenCalledWith({ id: 't1', packed_by: [S] })
    expect(db.save).toHaveBeenCalledWith({ id: 't2', packed_by: [S] })
    expect(db.save).not.toHaveBeenCalledWith(expect.objectContaining({ id: 't3' }))
  })

  it("a full pack's tick unpacks everything; an empty pack's tick can't be pressed", () => {
    db.packing = [...packs().map((p) => (p.parent_id === 'wa' ? { ...p, packed_by: [S, K] } : p)), pk({ id: 'em', text: 'electronics', is_pack: true, position: 9 })]
    db.save.mockReset().mockResolvedValue({})
    render(<PackingTab trip={trip({ id: 'lap' })} />)
    const full = screen.getByRole('checkbox', { name: 'everything in toiletries bag' })
    expect(full).toBeChecked()
    fireEvent.click(full)
    expect(db.save).toHaveBeenCalledWith({ id: 'b1', packed_by: [K] })
    expect(screen.getByRole('checkbox', { name: 'everything in electronics' })).toBeDisabled()
  })

  it("adding into a pack can pick its own bag; the pack's bag needs no saving", async () => {
    db.packing = packs()
    db.save.mockReset().mockResolvedValue({})
    render(<PackingTab trip={trip({ id: 'lap' })} />)
    await userEvent.click(head('shirts'))
    const which = screen.getByRole('button', { name: 'which bag in shirts' })
    expect(which).toHaveTextContent('check-in')
    await userEvent.type(screen.getByRole('textbox', { name: 'add to shirts' }), 'linen shirt{Enter}')
    expect(db.save.mock.calls.at(-1)![0]).not.toHaveProperty('bag')
    await userEvent.click(which)
    await userEvent.click(screen.getByRole('option', { name: 'carry-on' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'add to shirts' }), 'good shirt{Enter}')
    expect(db.save).toHaveBeenLastCalledWith(expect.objectContaining({ text: 'good shirt', bag: 'carry', parent_id: 'sh' }))
  })

  it('a pack holding things in two bags names no bag on its line, and shows under either bag with just those things', async () => {
    db.packing = [...packs(), pk({ id: 't4', text: 'good shirt', parent_id: 'sh', position: 4, bag: 'carry' })]
    render(<PackingTab trip={trip({ id: 'lap' })} />)
    expect(head('shirts').closest('.pack-group')!.querySelector('.pack-meta-r .pack-bag')).toBeNull()
    await userEvent.click(within(screen.getByRole('group', { name: 'show bag' })).getByRole('button', { name: 'carry-on' }))
    await userEvent.click(head('shirts'))
    expect(within(screen.getByRole('list', { name: 'shirts' })).getAllByRole('checkbox').map((c) => c.getAttribute('aria-label'))).toEqual(['good shirt'])
  })

  it('every thing and every pack has its own "edit"; tapping a name opens nothing', async () => {
    db.packing = packs()
    render(<PackingTab trip={trip({ id: 'lap' })} />)
    expect(screen.getByRole('button', { name: 'edit shirts' })).toBeInTheDocument()
    const socks = screen.getByRole('checkbox', { name: 'socks' }).closest('li')!
    expect(within(socks).getByRole('button', { name: 'edit socks' })).toHaveTextContent('edit')
    await userEvent.click(within(socks).getByText('socks'))
    expect(screen.queryByRole('textbox', { name: 'packing item' })).toBeNull()
    await userEvent.click(within(socks).getByRole('button', { name: 'edit socks' }))
    expect(screen.getByRole('textbox', { name: 'packing item' })).toHaveValue('7 socks')
  })

  it('a pack says how many it holds after its name, counting each thing\'s number', () => {
    db.packing = packs()
    render(<PackingTab trip={trip({ id: 'lap' })} />)
    expect(head('shirts')).toHaveTextContent(/^shirts×6$/)
    expect(head('toiletries bag')).toHaveTextContent(/^toiletries bag×1$/)
  })
})
