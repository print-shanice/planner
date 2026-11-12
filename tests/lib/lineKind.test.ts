import { guessKind } from '../../src/lib/lineKind'

it('getting around reads as a journey, with its mode when the words say it', () => {
  expect(guessKind('tozai line to nakano')).toEqual({ kind: 'journey', mode: 'train' })
  expect(guessKind('bus 9 to shijo omiya')).toEqual({ kind: 'journey', mode: 'bus' })
  expect(guessKind('Keisei limited express (KS)')).toEqual({ kind: 'journey', mode: 'train' })
  expect(guessKind('ferry to enoshima')).toEqual({ kind: 'journey', mode: 'ferry' })
  expect(guessKind('take grab to changi')).toEqual({ kind: 'journey', mode: null })
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
