import { targetAt, type DropZone } from '../../src/features/itinerary/drag'

const box = (top: number, bottom: number, left = 0, right = 600) => ({ top, bottom, left, right })
const zones: DropZone[] = [
  { day: '2025-09-21', rect: box(100, 300), rows: [{ id: 'horin', rect: box(140, 180) }, { id: 'kyle', rect: box(180, 220) }] },
  { day: '2025-09-22', rect: box(320, 400), rows: [{ id: 'ginza', rect: box(350, 390) }] },
]

it('drops before the first line whose middle is below the pointer', () => {
  expect(targetAt(zones, 50, 150)).toEqual({ day: '2025-09-21', before: 'horin' })
  expect(targetAt(zones, 50, 170)).toEqual({ day: '2025-09-21', before: 'kyle' })
})

it('below every line of a day drops at its end', () => {
  expect(targetAt(zones, 50, 260)).toEqual({ day: '2025-09-21', before: null })
})

it('outside the plan (over the map, between days) drops nowhere', () => {
  expect(targetAt(zones, 800, 150)).toBeNull()
  expect(targetAt(zones, 50, 310)).toBeNull()
})
