import { journeyLength } from '../../src/lib/span'
import { stop } from '../factories'

describe('journeyLength: how long a journey takes, in words', () => {
  it('from its times on one day', () => {
    expect(journeyLength(stop({ kind: 'journey', day: '2027-02-08', time: '17:16', end_time: '18:40' }))).toBe('1 h 24 min')
    expect(journeyLength(stop({ kind: 'journey', day: '2027-02-08', time: '09:00', end_time: '09:45' }))).toBe('45 min')
    expect(journeyLength(stop({ kind: 'journey', day: '2027-02-08', time: '09:00', end_time: '11:00' }))).toBe('2 h')
  })
  it('across days when it arrives on a later one', () => {
    expect(journeyLength(stop({ kind: 'journey', day: '2027-02-08', time: '22:00', end_date: '2027-02-09', end_time: '06:30' }))).toBe('8 h 30 min')
  })
  it("a looked-up flight counts its time zones", () => {
    const end = (scheduled: string) => ({ iata: '', airport: '', city: '', country: null, lat: null, lng: null, scheduled, revised: null, terminal: null, gate: null, desk: null, belt: null })
    const flight = { number: 'SQ 618', airline: '', status: '', live: false, checked_at: '', dep: end('2024-03-25 08:30+08:00'), arr: end('2024-03-25 15:50+09:00') }
    expect(journeyLength(stop({ kind: 'journey', mode: 'flight', day: '2024-03-25', time: '08:30', end_time: '15:50', flight }))).toBe('6 h 20 min')
  })
  it('nothing without both times, or when it would end before it starts', () => {
    expect(journeyLength(stop({ kind: 'journey', day: '2027-02-08', time: '17:16' }))).toBeNull()
    expect(journeyLength(stop({ kind: 'journey', day: '2027-02-08', time: '18:00', end_time: '17:00' }))).toBeNull()
  })
})
