import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { trip } from '../factories'

const db = vi.hoisted(() => ({ packing: [] as any[], save: vi.fn(), remove: vi.fn() }))
vi.mock('../../src/lib/queries', () => ({
  usePacking: () => ({ data: db.packing }),
  useSave: () => ({ mutateAsync: db.save, mutate: db.save, isPending: false }),
  useRemove: () => ({ mutateAsync: db.remove, mutate: db.remove, isPending: false }),
}))
vi.mock('../../src/lib/offline', () => ({ useCanEdit: () => true, useOnline: () => true }))

import { PackingTab } from '../../src/features/packing/PackingTab'

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
