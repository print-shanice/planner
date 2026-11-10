import { stampStyle, stampDate } from '../../src/lib/stampStyle'

describe('which real stamp a country gets', () => {
  it('schengen countries share the one european entry stamp', () => {
    for (const c of ['NL', 'fr', 'ES', 'FI', 'CH', 'IS', 'HR']) expect(stampStyle(c)).toBe('schengen')
  })
  it('a few others have their own; ireland and the uk are not schengen', () => {
    expect(stampStyle('JP')).toBe('japan')
    expect(stampStyle('GB')).toBe('uk')
    expect(stampStyle('US')).toBe('usa')
    expect(stampStyle('IE')).toBe('plain')
    expect(stampStyle('SG')).toBe('plain')
  })
  it('dates read the way each stamp prints them', () => {
    expect(stampDate('2027-01-28', 'schengen')).toBe('28.01.27')
    expect(stampDate('2024-10-03', 'japan')).toBe('3 oct 2024')
    expect(stampDate('2026-05-01', 'uk')).toBe('1 may 2026')
    expect(stampDate('2026-05-01', 'usa')).toBe('may 01 2026')
  })
})
