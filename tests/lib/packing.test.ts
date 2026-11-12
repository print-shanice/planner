import type { PackingItem } from '../../src/lib/types'
import { isPacked, packedBy, shows, tickFor, toggled } from '../../src/lib/packing'

const S = 'u-s', K = 'u-k'
const people = [S, K]
const item = (over: Partial<PackingItem> = {}): PackingItem =>
  ({ id: 'p', trip_id: 't', text: 'x', done: false, position: 0, owner: null, packed_by: [], ...over })

it('a person sees their own things and the shared ones; nobody picked sees everything', () => {
  expect(shows(item({ owner: S }), S)).toBe(true)
  expect(shows(item({ owner: K }), S)).toBe(false)
  expect(shows(item({ owner: null }), S)).toBe(true)
  expect(shows(item({ owner: K }), null)).toBe(true)
})

it('a shared thing is packed for whoever ticked it, and for everyone once all have', () => {
  const half = item({ packed_by: [K] })
  expect(isPacked(half, K, people)).toBe(true)
  expect(isPacked(half, S, people)).toBe(false)
  expect(isPacked(half, null, people)).toBe(false)
  expect(isPacked(item({ packed_by: [S, K] }), null, people)).toBe(true)
})

it("someone's own thing is packed when they've packed it, whoever is looking", () => {
  const mine = item({ owner: S, packed_by: [S] })
  expect(isPacked(mine, S, people)).toBe(true)
  expect(isPacked(mine, null, people)).toBe(true)
  expect(isPacked(item({ owner: S }), null, people)).toBe(false)
})

it('the tick acts for the owner, else the person picked, else me', () => {
  expect(tickFor(item({ owner: K }), S, S)).toBe(K)
  expect(tickFor(item({ owner: K }), null, S)).toBe(K)
  expect(tickFor(item(), K, S)).toBe(K)
  expect(tickFor(item(), null, S)).toBe(S)
})

it('ticking adds or takes away that one person', () => {
  expect(toggled(item({ packed_by: [K] }), S, people)).toEqual([K, S])
  expect(toggled(item({ packed_by: [K, S] }), K, people)).toEqual([S])
})

it('without knowing who is ticking, a shared thing ticks for everyone at once', () => {
  expect(toggled(item({ packed_by: [K] }), null, people)).toEqual(people)
  expect(toggled(item({ packed_by: [S, K] }), null, people)).toEqual([])
})

it('a row from before owners existed reads its old tick as everyone', () => {
  const old = { id: 'p', trip_id: 't', text: 'x', done: true, position: 0 } as PackingItem
  expect(packedBy(old, people)).toEqual(people)
  expect(isPacked(old, S, people)).toBe(true)
  expect(packedBy({ ...old, done: false }, people)).toEqual([])
})
