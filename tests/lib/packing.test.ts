import type { PackingItem } from '../../src/lib/types'
import { arrange, bagOf, isPacked, packedBy, parseQty, qtyLabel, qtyOf, shows, tally, tickFor, toggled } from '../../src/lib/packing'

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


describe('how many', () => {
  it('a number in front or a ×n at the end is how many; the name keeps the rest', () => {
    expect(parseQty('3 black tees')).toEqual({ text: 'black tees', qty: 3 })
    expect(parseQty('socks ×7')).toEqual({ text: 'socks', qty: 7 })
    expect(parseQty('socks x7')).toEqual({ text: 'socks', qty: 7 })
    expect(parseQty('socks x 2')).toEqual({ text: 'socks', qty: 2 })
    expect(parseQty('  1 passport ')).toEqual({ text: 'passport', qty: 1 })
  })
  it('numbers that are part of the name stay in it', () => {
    expect(parseQty('24h adapter')).toEqual({ text: '24h adapter', qty: 1 })
    expect(parseQty('usb-c cable 2m')).toEqual({ text: 'usb-c cable 2m', qty: 1 })
    expect(parseQty('box')).toEqual({ text: 'box', qty: 1 })
    expect(parseQty('3')).toEqual({ text: '3', qty: 1 })
    expect(parseQty('0 socks')).toEqual({ text: '0 socks', qty: 1 })
    expect(parseQty('150 socks')).toEqual({ text: '150 socks', qty: 1 })
  })
  it('one is the default, and only more than one is shown', () => {
    expect(qtyOf(item())).toBe(1)
    expect(qtyOf(item({ qty: 4 }))).toBe(4)
    expect(qtyLabel(item({ qty: 1 }))).toBe('')
    expect(qtyLabel(item({ qty: 3 }))).toBe('×3')
  })
})

describe('packs', () => {
  const shirts = item({ id: 'sh', text: 'shirts', is_pack: true, position: 1, bag: 'check' })
  const wash = item({ id: 'wa', text: 'toiletries bag', is_pack: true, position: 0, bag: 'carry' })
  const tee = item({ id: 't1', text: 'white tee', parent_id: 'sh', position: 5 })
  const tees = item({ id: 't2', text: 'black tees', parent_id: 'sh', position: 2, qty: 3 })
  const brush = item({ id: 'b1', text: 'toothbrush', parent_id: 'wa', position: 0, bag: 'check' })
  const socks = item({ id: 's1', text: 'socks', position: -1, qty: 7 })
  const lost = item({ id: 'x', text: 'gone', parent_id: 'nope' })

  it('packs come in order with their things in order; loose things apart; things of a missing pack are left out', () => {
    const { packs, loose } = arrange([tee, socks, shirts, brush, tees, wash, lost])
    expect(packs.map((p) => [p.pack.id, p.things.map((t) => t.id)])).toEqual([['wa', ['b1']], ['sh', ['t2', 't1']]])
    expect(loose.map((t) => t.id)).toEqual(['s1'])
  })

  it('an empty pack is still a pack', () => {
    expect(arrange([shirts]).packs).toEqual([{ pack: shirts, things: [] }])
  })

  it('counts add up how many', () => {
    expect(tally([tee, tees, socks], (p) => p.id === 't2')).toEqual({ done: 3, total: 11 })
  })

  it("a thing inside a pack goes in the pack's bag", () => {
    const byId = new Map([shirts, wash, tee, brush].map((p) => [p.id, p]))
    expect(bagOf(brush, byId)).toBe('carry')
    expect(bagOf(tee, byId)).toBe('check')
    expect(bagOf(socks, byId)).toBeNull()
    expect(bagOf(shirts, byId)).toBe('check')
  })
})
