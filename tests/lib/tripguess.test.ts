import { flagsFor, nameParts, pickCountry } from '../../src/lib/tripGuess'
import { place, stop, trip } from '../factories'

const feat = (name: string, cc: string, type = 'city') => ({ geometry: { coordinates: [0, 0] }, properties: { name, countrycode: cc, type } })

describe('guessing where a trip goes from its name', () => {
  it('reads the places in a name', () => {
    expect(nameParts('Madrid · Lisbon')).toEqual(['madrid', 'lisbon'])
    expect(nameParts('rome & naples, then capri')).toEqual(['rome', 'naples', 'then capri'])
    expect(nameParts('amsterdam')).toEqual(['amsterdam'])
    expect(nameParts('a · bb')).toEqual([])
  })
  it('only takes a town, region or country with exactly that name', () => {
    expect(pickCountry('amsterdam', { features: [feat('Amsterdam', 'nl')] })).toBe('NL')
    expect(pickCountry('athens', { features: [feat('Athens Cafe', 'us', 'house'), feat('Athens', 'gr')] })).toBe('GR')
    // the best known comes first: lapland the finnish region, not a village of the same name in canada
    expect(pickCountry('lapland', { features: [feat('Lapland', 'fi', 'state'), feat('Lapland', 'ca')] })).toBe('FI')
    expect(pickCountry('istanbul', { features: [feat('Istanbul', 'tr', 'district')] })).toBe('TR')
    expect(pickCountry('the rail loop', { features: [feat('Railyard Loop', 'us', 'street'), feat('The Rail Loop', 'us', 'locality'), feat('Loop', 'us')] })).toBeNull()
    expect(pickCountry('são paulo', { features: [feat('Sao Paulo', 'br')] })).toBe('BR')
    expect(pickCountry('x', null)).toBeNull()
  })
})

describe('flagsFor: what is known first, a guess only where nothing is', () => {
  const ex = trip({ id: 'ex', name: 'exchange', base: place({ country: 'NL' }) })
  const ams = trip({ id: 'ams', parent_id: 'ex', name: 'amsterdam', base: null })
  const lap = trip({ id: 'lap', parent_id: 'ex', name: 'lapland', base: place({ country: 'FI' }) })
  const guesses = { amsterdam: ['NL'], lapland: ['SE'], 'madrid · lisbon': ['ES', 'PT'] }
  it('a trip with no country of its own takes the guess for its name', () => {
    expect(flagsFor(ams, [ex, ams, lap], [], guesses)).toEqual(['NL'])
    expect(flagsFor(trip({ id: 'ib', name: 'Madrid · Lisbon', base: null }), [], [], guesses)).toEqual(['ES', 'PT'])
  })
  it('a known country is never replaced by a guess', () => {
    expect(flagsFor(lap, [ex, ams, lap], [], guesses)).toEqual(['FI'])
    expect(flagsFor(ams, [ex, ams], [stop({ trip_id: 'ams', place: place({ country: 'BE' }) })], guesses)).toEqual(['BE'])
  })
  it("a parent gathers its side trips' guesses too, each country once", () => {
    const gr = trip({ id: 'gr', parent_id: 'ex', name: 'athens', base: null })
    expect(flagsFor(ex, [ex, ams, lap, gr], [], { ...guesses, athens: ['GR'] })).toEqual(['NL', 'FI', 'GR'])
  })
  it('no guess, no flag', () => {
    expect(flagsFor(trip({ id: 'x', name: 'the rail loop', base: null }), [], [], guesses)).toEqual([])
  })
})
