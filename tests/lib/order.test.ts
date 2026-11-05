import { positionsAfterMove } from '../../src/lib/order'

it('move returns only changed positions', () => {
  expect(positionsAfterMove(['a', 'b', 'c'], 2, 0)).toEqual([{ id: 'c', position: 0 }, { id: 'a', position: 1 }, { id: 'b', position: 2 }])
  expect(positionsAfterMove(['a', 'b', 'c', 'd'], 1, 2)).toEqual([{ id: 'c', position: 1 }, { id: 'b', position: 2 }])
})

it('a move to the same place changes nothing', () => {
  expect(positionsAfterMove(['a', 'b'], 1, 1)).toEqual([])
})

it('gappy stored positions are made tidy', () => {
  expect(positionsAfterMove(['a', 'b', 'c'], 0, 1, [0, 4, 9])).toEqual([{ id: 'b', position: 0 }, { id: 'a', position: 1 }, { id: 'c', position: 2 }])
})
