import { describe, expect, it } from 'vitest'
import { chainsOf, legKey } from '../../src/lib/google/routes'
import { toPlace, needsRefresh } from '../../src/lib/google/places'

const pt = (lat: number, lng: number, name = '') => ({ name, lat, lng })

describe('walking routes, asked for economically', () => {
  it('joins legs that follow on into one request, and starts again after a journey', () => {
    const a = pt(1, 1), b = pt(1, 2), c = pt(1, 3), d = pt(5, 5), e = pt(5, 6)
    const legs = [{ a, b }, { a: b, b: c }, { a: d, b: e }]
    expect(chainsOf(legs)).toEqual([[a, b, c], [d, e]])
  })

  it('keeps each request within ten stops in between (the cheaper tier)', () => {
    const pts = Array.from({ length: 15 }, (_, i) => pt(1, i))
    const legs = pts.slice(1).map((p, i) => ({ a: pts[i], b: p }))
    const out = chainsOf(legs)
    expect(out.every((c) => c.length <= 12)).toBe(true)
    expect(out.flatMap((c, i) => (i ? c.slice(1) : c))).toEqual(pts)
  })

  it('names a leg by its two ends', () => {
    expect(legKey(pt(51.1234567, 5.1), pt(51.2, 5.2))).toBe(legKey(pt(51.12345671, 5.1), pt(51.2, 5.2)))
  })
})

describe('google place details', () => {
  const loc = { lat: () => 51.44, lng: () => 5.47 }
  it('keeps the name you picked, the place id, the date fetched and what kind of place it is', () => {
    const p = toPlace('kopi soesoe', 'gid1', {
      location: loc, formattedAddress: 'Kopi Soesoe, Kleine Berg 30, 5611 JV Eindhoven, Netherlands', types: ['cafe', 'food'],
      addressComponents: [{ longText: 'Eindhoven', shortText: 'Eindhoven', types: ['locality'] }, { longText: 'Netherlands', shortText: 'NL', types: ['country'] }, { longText: 'Centrum', types: ['sublocality_level_1'] }],
    }, '2027-01-02')
    expect(p).toMatchObject({ name: 'kopi soesoe', gid: 'gid1', at: '2027-01-02', lat: 51.44, lng: 5.47, city: 'Eindhoven', area: 'Centrum', country: 'NL', category: 'cafe' })
    expect(p.address).toBe('Kleine Berg 30, 5611 JV Eindhoven')
  })

  it('asks again for coordinates kept 30 days or more', () => {
    expect(needsRefresh({ name: 'x', lat: 1, lng: 1, gid: 'g', at: '2027-01-01' }, '2027-01-30')).toBe(false)
    expect(needsRefresh({ name: 'x', lat: 1, lng: 1, gid: 'g', at: '2027-01-01' }, '2027-01-31')).toBe(true)
    expect(needsRefresh({ name: 'x', lat: 1, lng: 1 }, '2030-01-01')).toBe(false)
  })
})
