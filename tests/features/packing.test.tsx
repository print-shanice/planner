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
  expect(rows[0]).toHaveTextContent(/^yellow shirtcarry-on$/)
  expect(rows[0].querySelector('.pack-bag')).toHaveTextContent(/^carry-on$/)
  expect(rows[1]).toHaveTextContent(/^sunscreen$/)
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
  expect(document.querySelector('.pack-meter')!.nextElementSibling).toBe(filter)
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
  expect(db.save).toHaveBeenCalledWith({ trip_id: 'gr', text: 'passport', owner: S, packed_by: [], position: 6, bag: 'carry' })
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
