import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { stop, place } from '../factories'
import type { Stop } from '../../src/lib/types'

const db = vi.hoisted(() => ({ online: true, wide: true, save: vi.fn((r: unknown) => Promise.resolve(r)) }))
vi.mock('../../src/lib/queries', () => ({ useSave: () => ({ mutateAsync: db.save, mutate: db.save }) }))
vi.mock('../../src/lib/offline', () => ({ useCanEdit: () => db.online, useOnline: () => db.online }))
vi.mock('../../src/lib/useWide', () => ({ useWide: () => db.wide }))

import { Marker } from '../../src/features/itinerary/Marker'

function Where() { const l = useLocation(); return <output data-testid="loc">{l.search}</output> }
const loc = () => new URLSearchParams(screen.getByTestId('loc').textContent ?? '')
function show(s: Stop, seq?: number, kind: 'stop' | 'checkin' = 'stop') {
  return render(<MemoryRouter initialEntries={['/trip/tk?tab=plan']}><Marker stop={s} kind={kind} seq={seq} /><Where /></MemoryRouter>)
}

beforeEach(() => { db.online = true; db.wide = true; db.save.mockClear() })

it('a place on the map shows its number and nothing to press', () => {
  show(stop({ id: 'k', title: 'kyle', place: place() }), 3)
  expect(screen.getByText('03')).toBeInTheDocument()
  expect(screen.queryByRole('button')).toBeNull()
})

it('a place not found yet offers to find it on the map, beside the plan on a laptop', async () => {
  show(stop({ id: 't', title: 'trefac style koenji', day: '2025-09-21', place: null }))
  await userEvent.click(screen.getByRole('button', { name: 'find trefac style koenji on the map' }))
  expect(loc().get('find')).toBe('t')
  expect(loc().get('tab')).toBe('plan')
})

it('on a phone, finding it opens the map at that day', async () => {
  db.wide = false
  show(stop({ id: 't', title: 'trefac', day: '2025-09-21', place: null }))
  await userEvent.click(screen.getByRole('button', { name: 'find trefac on the map' }))
  expect(Object.fromEntries(loc())).toEqual({ tab: 'map', day: '2025-09-21', find: 't' })
})

it('getting around opens a menu that changes what the line is', async () => {
  show(stop({ id: 'z', kind: 'journey', mode: 'train', title: 'line friends store' }))
  await userEvent.click(screen.getByRole('button', { name: 'what line friends store is: getting around' }))
  const menu = screen.getByRole('group', { name: 'what this line is' })
  expect(menu).toHaveTextContent('a place')
  await userEvent.click(screen.getByRole('button', { name: /a place/ }))
  expect(db.save).toHaveBeenCalledWith({ id: 'z', kind: 'place', mode: null })
  expect(loc().get('find')).toBe('z')
})

it('a note can become getting around, taking its mode from its words', async () => {
  show(stop({ id: 'n', kind: 'note', title: 'bus 9 to shijo omiya' }))
  await userEvent.click(screen.getByRole('button', { name: 'what bus 9 to shijo omiya is: a note' }))
  await userEvent.click(screen.getByRole('button', { name: /getting around/ }))
  expect(db.save).toHaveBeenCalledWith({ id: 'n', kind: 'journey', mode: 'bus', place: null })
  expect(screen.queryByRole('group', { name: 'what this line is' })).toBeNull()
})

it('escape closes the menu without changing anything', async () => {
  show(stop({ id: 'n', kind: 'note', title: 'walk' }))
  await userEvent.click(screen.getByRole('button', { name: 'what walk is: a note' }))
  await userEvent.keyboard('{Escape}')
  expect(screen.queryByRole('group', { name: 'what this line is' })).toBeNull()
  expect(db.save).not.toHaveBeenCalled()
})

it('offline, a stay, or a journey with its stations: just the icon', () => {
  db.online = false
  const { unmount } = show(stop({ id: 'x', title: 'trefac', place: null }))
  expect(screen.queryByRole('button')).toBeNull()
  unmount()
  db.online = true
  const a = show(stop({ id: 'b', kind: 'stay', title: 'airbnb' }), undefined, 'checkin')
  expect(screen.queryByRole('button')).toBeNull()
  a.unmount()
  show(stop({ id: 'f', kind: 'journey', mode: 'flight', origin: place(), destination: place() }))
  expect(screen.queryByRole('button')).toBeNull()
})
