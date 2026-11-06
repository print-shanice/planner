import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const save = vi.hoisted(() => vi.fn())
vi.mock('../../src/lib/queries', () => ({ useSave: () => ({ mutateAsync: save }) }))

import { SaveFailed } from '../../src/components/SaveFailed'
import { failSave, savedFields, forgetPending } from '../../src/lib/pending'

afterEach(() => { forgetPending(); save.mockReset() })

it('shows nothing until a save fails, then retries it and goes away', async () => {
  render(<SaveFailed table="stops" id="s1" />)
  expect(screen.queryByRole('alert')).toBeNull()
  act(() => failSave('stops', 's1', { title: 'arktikum' }, false))
  expect(screen.getByRole('alert')).toHaveTextContent("couldn't save")
  save.mockImplementation(async (r: { id: string }) => { savedFields('stops', r.id, Object.keys(r)) })
  await userEvent.click(screen.getByRole('button', { name: 'retry' }))
  expect(save).toHaveBeenCalledWith({ id: 's1', title: 'arktikum' })
  expect(screen.queryByRole('alert')).toBeNull()
})

it('a retry that fails again keeps the line and the button', async () => {
  act(() => failSave('stops', 's1', { title: 'arktikum' }, false))
  render(<SaveFailed table="stops" id="s1" />)
  save.mockRejectedValue(new Error('still asleep'))
  await userEvent.click(screen.getByRole('button', { name: 'retry' }))
  expect(screen.getByRole('alert')).toHaveTextContent("couldn't save")
  expect(screen.getByRole('button', { name: 'retry' })).toBeEnabled()
})
