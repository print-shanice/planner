import { guessKind } from '../../src/lib/lineKind'

it('getting around reads as a journey, with its mode when the words say it', () => {
  expect(guessKind('tozai line to nakano')).toEqual({ kind: 'journey', mode: 'train' })
  expect(guessKind('bus 9 to shijo omiya')).toEqual({ kind: 'journey', mode: 'bus' })
  expect(guessKind('Keisei limited express (KS)')).toEqual({ kind: 'journey', mode: 'train' })
  expect(guessKind('ferry to enoshima')).toEqual({ kind: 'journey', mode: 'ferry' })
  expect(guessKind('take grab to changi')).toEqual({ kind: 'journey', mode: null })
  // by road: no train or bus, so no mode, and it shows as a car
  for (const t of ['uber to the airport', 'didi back to the hotel', 'Taxi to shibuya', 'cab home', 'lyft to soho', 'gojek to ubud', 'bolt to old town', 'drive to kamakura', 'car to okutama']) {
    expect(guessKind(t)).toEqual({ kind: 'journey', mode: null })
  }
  expect(guessKind('randen tram to arashiyama')).toEqual({ kind: 'journey', mode: 'train' })
})

it('a walk is a note', () => {
  expect(guessKind('walk to tokiwadai station')).toEqual({ kind: 'note', mode: null })
  expect(guessKind('Walk 1h to fukazawa tiny museum')).toEqual({ kind: 'note', mode: null })
})

it('a shop that happens to say "line" or "train" is still a place', () => {
  expect(guessKind('line friends store')).toEqual({ kind: 'place', mode: null })
  expect(guessKind('train cafe')).toEqual({ kind: 'place', mode: null })
  expect(guessKind('kyoto obuya')).toEqual({ kind: 'place', mode: null })
  expect(guessKind('online shop pickup')).toEqual({ kind: 'place', mode: null })
})

it('a mode reads as its word and icon; no mode is a car, a flight a plane', async () => {
  const { MODES, modeIcon, modeWord } = await import('../../src/lib/lineKind')
  expect(MODES.map(modeWord)).toEqual(['flight', 'train', 'bus', 'ferry', 'car'])
  expect(MODES.map(modeIcon)).toEqual(['plane', 'train', 'bus', 'ferry', 'car'])
})
