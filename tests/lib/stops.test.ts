import { blankStop, newPlaceStop, placeChange } from '../../src/lib/stops'
import { place } from '../factories'

it('a blank stop has every field, a journey starting as a train', () => {
  const s = blankStop('place', 't', { title: 'louvre' })
  expect(s).toMatchObject({ trip_id: 't', kind: 'place', title: 'louvre', day: null, mode: null, status: 'idea', saved: false, flight: null })
  expect(s.id).toBeTruthy()
  expect(blankStop('journey', 't').mode).toBe('train')
})

it("a found place goes on the stop, its guessed kind on the stop only when it has none", () => {
  const found = { ...place({ name: 'café de flore' }), category: 'cafe' }
  const fresh = placeChange({ id: 's', category: null }, found)
  expect(fresh).toEqual({ id: 's', place: place({ name: 'café de flore' }), category: 'cafe' })
  expect(fresh.place).not.toHaveProperty('category')
  expect(placeChange({ id: 's', category: 'bar' }, found)).not.toHaveProperty('category')
})

it('a place from the map is a new undated line named after it', () => {
  const s = newPlaceStop({ ...place({ name: '' }), category: 'museum' }, 't', '10:00', 'n1')
  expect(s).toMatchObject({ id: 'n1', trip_id: 't', kind: 'place', title: 'dropped pin', time: '10:00', day: null, category: 'museum' })
  expect(s.place).not.toHaveProperty('category')
})
