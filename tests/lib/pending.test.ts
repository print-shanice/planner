import { renderHook } from '@testing-library/react'
import { failSave, savedFields, failureOf, hide, unhide, overlay, forgetPending, usePending, type Pending } from '../../src/lib/pending'

afterEach(() => forgetPending())

it('nothing pending passes the rows through as the same array', () => {
  const { result } = renderHook(() => usePending('trips'))
  const rows = [{ id: 'a' }]
  expect(overlay(rows, result.current)).toBe(rows)
})

it('a failed edit stays on its row, a failed insert is added, a hidden row is left out', () => {
  const p: Pending = {
    failed: { a: { id: 'a', fields: { done: true }, isNew: false }, n: { id: 'n', fields: { text: 'socks' }, isNew: true } },
    hidden: ['b'],
  }
  expect(overlay([{ id: 'a', done: false, text: 'gloves' }, { id: 'b' }], p)).toEqual([
    { id: 'a', done: true, text: 'gloves' },
    { id: 'n', text: 'socks' },
  ])
})

it('failures of one row merge and stay new once new', () => {
  failSave('packing', 'a', { text: 'socks' }, true)
  failSave('packing', 'a', { done: true }, false)
  expect(failureOf('packing', 'a')).toEqual({ id: 'a', fields: { text: 'socks', done: true }, isNew: true })
})

it('a save that gets through clears only the fields it carried', () => {
  failSave('stops', 'a', { title: 'x', day: '2027-02-08' }, false)
  savedFields('stops', 'a', ['id', 'title'])
  expect(failureOf('stops', 'a')?.fields).toEqual({ day: '2027-02-08' })
  savedFields('stops', 'a', ['id', 'day'])
  expect(failureOf('stops', 'a')).toBeUndefined()
})

it('failures survive a reload', async () => {
  failSave('stops', 'a', { title: 'arktikum' }, true)
  vi.resetModules()
  const again = await import('../../src/lib/pending')
  expect(again.failureOf('stops', 'a')).toEqual({ id: 'a', fields: { title: 'arktikum' }, isNew: true })
  again.forgetPending()
})

it('hidden rows are not kept across a reload', async () => {
  hide('stops', 'a')
  vi.resetModules()
  const again = await import('../../src/lib/pending')
  expect(again.overlay([{ id: 'a' }], { failed: {}, hidden: [] })).toEqual([{ id: 'a' }])
  unhide('stops', 'a')
})

it('forgetting the device forgets unsaved changes', () => {
  failSave('stops', 'a', { title: 'x' }, false)
  forgetPending()
  expect(failureOf('stops', 'a')).toBeUndefined()
  expect(localStorage.getItem('planner-unsaved')).toBeNull()
})
