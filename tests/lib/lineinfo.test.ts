import { lineInfo } from '../../src/lib/lineInfo'
import { cost, stop } from '../factories'

const none = { files: 0, costs: [], links: [] }

describe('lineInfo: what a plan line holds beyond its name', () => {
  it('is empty for a bare place', () => {
    expect(lineInfo(stop({ id: 'a' }), none)).toEqual({ note: null, ref: null, tickets: 0, cost: null, links: [] })
  })
  it('gives the first written line of the notes, but not for a note (its text is already the line)', () => {
    expect(lineInfo(stop({ notes: '\n  ask for the window table \nsecond' }), none).note).toBe('ask for the window table')
    expect(lineInfo(stop({ kind: 'note', notes: 'call ahead' }), none).note).toBeNull()
  })
  it('gives the booking ref, except on a journey whose line already shows it', () => {
    expect(lineInfo(stop({ ref: 'MVE5DH' }), none).ref).toBe('MVE5DH')
    expect(lineInfo(stop({ kind: 'journey', ref: 'Q7TZ2L' }), none).ref).toBeNull()
  })
  it('counts tickets and adds up costs in one currency', () => {
    const info = lineInfo(stop({ id: 'a' }), { files: 2, costs: [cost({ stop_id: 'a', amount: 30 }), cost({ stop_id: 'a', amount: 12.5, status: 'paid' })], links: [] })
    expect(info.tickets).toBe(2)
    expect(info.cost).toEqual({ text: '€42.50', paid: false })
  })
  it('says paid only when every cost is, and counts costs in mixed currencies', () => {
    expect(lineInfo(stop(), { ...none, costs: [cost({ amount: 9, status: 'paid' })] }).cost).toEqual({ text: '€9', paid: true })
    expect(lineInfo(stop(), { ...none, costs: [cost({ amount: 9 }), cost({ amount: 900, currency: 'JPY' })] }).cost).toEqual({ text: '2 costs', paid: false })
  })
  it("lists its links: the place's own page first, then saved links, only safe addresses", () => {
    const info = lineInfo(stop({ url: 'https://nomad.coffee' }), { ...none, links: [
      { id: 'l', trip_id: 't', url: 'https://instagram.com/reel/1', title: 'food finds', note: '' },
      { id: 'bad', trip_id: 't', url: 'javascript:alert(1)', title: 'x', note: '' },
    ] })
    expect(info.links).toEqual([{ url: 'https://nomad.coffee', label: 'nomad.coffee' }, { url: 'https://instagram.com/reel/1', label: 'food finds' }])
  })
})
