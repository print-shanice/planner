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
