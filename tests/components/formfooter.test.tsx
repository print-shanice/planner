import { render, screen, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type FormEvent } from 'react'

const env = vi.hoisted(() => ({ canEdit: true }))
vi.mock('../../src/lib/offline', () => ({ useCanEdit: () => env.canEdit, useOnline: () => env.canEdit }))

import { FormFooter, useSubmit } from '../../src/components/FormFooter'
import { Sheet } from '../../src/components/Sheet'

function Form({ send }: { send: () => Promise<void> }) {
  const { run, saving, failure } = useSubmit()
  const [name, setName] = useState('')
  const submit = (e: FormEvent) => { e.preventDefault(); void run(send) }
  return (
    <Sheet open title="new note" onClose={() => {}}>
      <form id="f" onSubmit={submit}>
        <label>name<input value={name} onChange={(e) => setName(e.target.value)} /></label>
        <input aria-label="other" />
      </form>
      <FormFooter form="f" problem={failure} saving={saving} failed={!!failure} />
    </Sheet>
  )
}

beforeEach(() => { env.canEdit = true })

it('two quick submits send one save', async () => {
  let done!: () => void
  const send = vi.fn(() => new Promise<void>((r) => { done = r }))
  render(<Form send={send} />)
  const form = document.getElementById('f')!
  fireEvent.submit(form)
  fireEvent.submit(form)
  expect(send).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: 'saving…' })).toBeDisabled()
  await act(async () => { done() })
  expect(screen.getByRole('button', { name: 'save' })).toBeEnabled()
})

it('a failed save says so and the button retries', async () => {
  const send = vi.fn().mockRejectedValueOnce(new Error('asleep')).mockResolvedValue(undefined)
  render(<Form send={send} />)
  await userEvent.click(screen.getByRole('button', { name: 'save' }))
  expect(await screen.findByText("couldn't save")).toHaveClass('warn-line')
  await userEvent.click(screen.getByRole('button', { name: 'retry' }))
  expect(send).toHaveBeenCalledTimes(2)
  expect(screen.queryByText("couldn't save")).toBeNull()
})

// browsers send enter in a field to the form's first submit button, including one tied to it by form=
// (checked in webkit and chromium); user-event doesn't model that, so pin the tie itself
it('enter in a field submits through the footer button', () => {
  render(<Form send={vi.fn()} />)
  const save = screen.getByRole('button', { name: 'save' }) as HTMLButtonElement
  expect(save.type).toBe('submit')
  expect(save.form).toBe(document.getElementById('f'))
})

it('offline says so and cannot save', () => {
  env.canEdit = false
  render(<Form send={vi.fn()} />)
  expect(screen.getByText('offline')).toHaveClass('warn-line')
  expect(screen.getByRole('button', { name: 'save' })).toBeDisabled()
})
