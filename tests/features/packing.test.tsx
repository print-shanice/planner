import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { trip } from '../factories'

const db = vi.hoisted(() => ({ packing: [] as any[], save: vi.fn(), remove: vi.fn(), packingQ: null as null | Record<string, unknown> }))
vi.mock('../../src/lib/queries', () => ({
  usePacking: () => db.packingQ ?? ({ data: db.packing }),
  useSave: () => ({ mutateAsync: db.save, mutate: db.save, isPending: false }),
  useRemove: () => ({ mutateAsync: db.remove, mutate: db.remove, isPending: false }),
}))
vi.mock('../../src/lib/offline', () => ({ useCanEdit: () => true, useOnline: () => true }))

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
  expect(db.save).toHaveBeenCalledWith({ trip_id: 'lap', text: 'wool socks', done: false, position: 4 })
  expect(screen.getByRole('textbox', { name: 'add to pack' })).toHaveValue('')
  await userEvent.click(screen.getByRole('button', { name: 'passport' }))
  expect(db.save).toHaveBeenCalledWith({ id: 'p2', done: true })
  await userEvent.click(screen.getByRole('button', { name: 'remove thermal gloves' }))
  expect(db.remove).toHaveBeenCalledWith('p1')
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
  await userEvent.click(screen.getByRole('button', { name: 'remove thermal gloves' }))
  expect(screen.getByRole('status')).toHaveTextContent('removed')
  await userEvent.click(screen.getByRole('button', { name: 'undo' }))
  expect(db.remove).not.toHaveBeenCalled()
})
