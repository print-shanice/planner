import { act, renderHook } from '@testing-library/react'
import { clearDraft, draftKey, forgetDrafts, readDraft, useDraft, writeDraft } from '../../src/lib/drafts'

it('drafts are kept per trip and kind', () => {
  writeDraft(draftKey('lis', 'note'), { title: 'tram 28' })
  expect(readDraft(draftKey('lis', 'note'))).toEqual({ title: 'tram 28' })
  expect(readDraft(draftKey('par', 'note'))).toBeUndefined()
  expect(readDraft(draftKey('lis', 'stay'))).toBeUndefined()
  clearDraft(draftKey('lis', 'note'))
  expect(readDraft(draftKey('lis', 'note'))).toBeUndefined()
})

it('a form left untouched keeps no draft; a touched one is restored', () => {
  const key = draftKey('lis', 'note')
  const a = renderHook(() => useDraft(key, () => ({ title: '' })))
  expect(readDraft(key)).toBeUndefined()
  act(() => a.result.current[1]((v) => ({ ...v, title: 'tram 28' })))
  a.unmount()
  const b = renderHook(() => useDraft(key, () => ({ title: '' })))
  expect(b.result.current[0]).toEqual({ title: 'tram 28' })
})

it('after a save attempt the draft is gone and stays gone', () => {
  const key = draftKey('lis', 'link')
  const h = renderHook(() => useDraft(key, () => ({ url: '' })))
  act(() => h.result.current[1](() => ({ url: 'a.com' })))
  act(() => h.result.current[2]())
  act(() => h.result.current[1](() => ({ url: 'b.com' })))
  expect(readDraft(key)).toBeUndefined()
})

it('without a key nothing is stored', () => {
  const h = renderHook(() => useDraft<{ t: string }>(null, () => ({ t: '' })))
  act(() => h.result.current[1](() => ({ t: 'x' })))
  expect(h.result.current[0]).toEqual({ t: 'x' })
  expect(localStorage.getItem('planner-drafts')).toBeNull()
})

it('forgetting drafts empties them all', () => {
  writeDraft(draftKey('lis', 'note'), { title: 'x' })
  forgetDrafts()
  expect(localStorage.getItem('planner-drafts')).toBeNull()
})

it('a draft kept under an older shape of the form is dropped, not restored', () => {
  const key = draftKey('lis', 'journey')
  writeDraft(key, { id: 'j1', d: { title: 'kl 1691' } })
  const h = renderHook(() => useDraft(key, () => ({ id: 'j2', d: { title: '', seats: '' } })))
  expect(h.result.current[0]).toEqual({ id: 'j2', d: { title: '', seats: '' } })
  expect(readDraft(key)).toBeUndefined()
})

it('a draft with a place filled in still counts as the same shape', () => {
  const key = draftKey('lis', 'stay')
  writeDraft(key, { id: 's1', d: { title: 'casa', place: { name: 'casa do sol', lat: 1, lng: 2 } } })
  const h = renderHook(() => useDraft(key, () => ({ id: 's2', d: { title: '', place: null } })))
  expect(h.result.current[0].id).toBe('s1')
})
