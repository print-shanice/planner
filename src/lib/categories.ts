import type { Stop } from './types'

// what kind of place something is, apart from whether it's booked, what it cost or when it happens
export const CATEGORIES = ['cafe', 'restaurant', 'bar', 'bakery', 'museum', 'sight', 'park', 'shopping', 'stay', 'transport'] as const
export type Category = (typeof CATEGORIES)[number]
// what a stop reads as: a category, a plain place when nobody knows, or a note
export type Kindish = Category | 'place' | 'note'

const ICON: Record<Kindish, string> = {
  cafe: 'cafe', restaurant: 'restaurant', bar: 'bar', bakery: 'bakery', museum: 'museum', sight: 'sight',
  park: 'park', shopping: 'shopping', stay: 'bed', transport: 'train', place: 'pin', note: 'note',
}

// older words and near misses that already sit in the data
const ALIAS: Record<string, Category> = {
  coffee: 'cafe', 'coffee shop': 'cafe', café: 'cafe', food: 'restaurant', lunch: 'restaurant', dinner: 'restaurant',
  pub: 'bar', drinks: 'bar', nightlife: 'bar', club: 'bar', gallery: 'museum', attraction: 'sight', landmark: 'sight',
  viewpoint: 'sight', garden: 'park', nature: 'park', beach: 'park', shop: 'shopping', market: 'shopping',
  hotel: 'stay', hostel: 'stay', lodging: 'stay', station: 'transport', airport: 'transport',
}

export function asCategory(value: string | null | undefined): Category | null {
  const v = (value ?? '').trim().toLowerCase()
  if (!v) return null
  if ((CATEGORIES as readonly string[]).includes(v)) return v as Category
  return ALIAS[v] ?? null
}

export function categoryOf(s: Pick<Stop, 'kind' | 'category'>): Kindish {
  if (s.kind === 'stay') return 'stay'
  if (s.kind === 'journey') return 'transport'
  const c = asCategory(s.category)
  if (c) return c
  return s.kind === 'note' ? 'note' : 'place'
}

export const categoryIcon = (c: Kindish): string => ICON[c]
export const categoryLabel = (c: Kindish): string => c

// google's place types, in the order that tells the most
const GOOGLE: [Category, string[]][] = [
  ['stay', ['lodging', 'hotel', 'hostel', 'bed_and_breakfast', 'guest_house', 'motel', 'resort_hotel', 'campground', 'inn']],
  ['transport', ['airport', 'train_station', 'transit_station', 'subway_station', 'bus_station', 'light_rail_station', 'ferry_terminal']],
  ['bakery', ['bakery']],
  ['cafe', ['cafe', 'coffee_shop', 'tea_house', 'cat_cafe']],
  ['bar', ['bar', 'pub', 'wine_bar', 'night_club', 'cocktail_bar']],
  ['museum', ['museum', 'art_gallery', 'history_museum', 'art_museum']],
  ['park', ['park', 'national_park', 'garden', 'botanical_garden', 'beach', 'hiking_area', 'zoo']],
  ['restaurant', ['restaurant', 'meal_takeaway', 'food_court', 'brunch_restaurant', 'ice_cream_shop']],
  ['shopping', ['shopping_mall', 'clothing_store', 'book_store', 'department_store', 'market', 'store', 'gift_shop', 'supermarket']],
  ['sight', ['tourist_attraction', 'historical_landmark', 'monument', 'church', 'place_of_worship', 'castle', 'observation_deck', 'amusement_park', 'aquarium', 'performing_arts_theater']],
]

export function fromGoogleTypes(types: readonly string[] | null | undefined): Category | null {
  if (!types?.length) return null
  const set = new Set(types)
  for (const [c, list] of GOOGLE) if (list.some((t) => set.has(t) || [...set].some((x) => x.endsWith(`_${t}`)))) return c
  return null
}

// openstreetmap's key and value (photon's osm_key / osm_value)
export function fromOsm(key: string | null | undefined, value: string | null | undefined): Category | null {
  const k = (key ?? '').toLowerCase(), v = (value ?? '').toLowerCase()
  if (k === 'tourism' && ['hotel', 'hostel', 'guest_house', 'motel', 'apartment', 'camp_site', 'chalet'].includes(v)) return 'stay'
  if (k === 'railway' || k === 'aeroway' || (k === 'amenity' && ['bus_station', 'ferry_terminal'].includes(v)) || (k === 'public_transport' && v === 'station')) return 'transport'
  if (v === 'bakery' || v === 'pastry') return 'bakery'
  if (k === 'amenity' && v === 'cafe') return 'cafe'
  if (k === 'amenity' && ['bar', 'pub', 'nightclub', 'biergarten'].includes(v)) return 'bar'
  if (k === 'amenity' && ['restaurant', 'fast_food', 'food_court', 'ice_cream'].includes(v)) return 'restaurant'
  if (k === 'tourism' && ['museum', 'gallery'].includes(v)) return 'museum'
  if (k === 'leisure' && ['park', 'garden', 'nature_reserve', 'beach_resort'].includes(v)) return 'park'
  if (k === 'natural' && v === 'beach') return 'park'
  if (k === 'shop' || (k === 'amenity' && v === 'marketplace')) return 'shopping'
  if (k === 'tourism' && ['attraction', 'viewpoint', 'artwork', 'theme_park', 'zoo', 'aquarium'].includes(v)) return 'sight'
  if (k === 'historic' || (k === 'amenity' && ['place_of_worship', 'theatre'].includes(v))) return 'sight'
  return null
}

// the money tab's bucket for a stop's price: suggested from the place, stored on the cost on its own
export function expenseCategory(s: Pick<Stop, 'kind' | 'category'>): string {
  const c = categoryOf(s)
  if (c === 'stay') return 'stays'
  if (c === 'transport') return 'transport'
  if (c === 'cafe' || c === 'restaurant' || c === 'bar' || c === 'bakery') return 'food'
  if (c === 'shopping') return 'shopping'
  if (c === 'note') return 'other'
  return 'activities'
}
