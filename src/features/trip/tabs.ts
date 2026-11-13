export type Tab = 'plan' | 'map' | 'places' | 'notes' | 'links' | 'money'
// phones: six at the bottom. laptops: the map is always beside, so five. packing lives on home (one trip at a time)
export const PHONE_TABS: Tab[] = ['plan', 'map', 'places', 'notes', 'links', 'money']
export const WIDE_TABS: Tab[] = ['plan', 'places', 'notes', 'links', 'money']

// old links still land where they meant: the calendar, itinerary and day views are the plan now,
// ideas (and saved places before them) are places, saved links are links
export function readTab(params: URLSearchParams, wide: boolean): Tab {
  const asked = params.get('tab') ?? ''
  const view = params.get('view') ?? ''
  if (asked === 'map') return wide ? 'plan' : 'map'
  if (asked === 'money' || asked === 'cost') return 'money'
  if (asked === 'links' || (asked === 'saved' && view === 'links')) return 'links'
  if (asked === 'notes') return 'notes'
  if (asked === 'places' || asked === 'ideas' || (asked === 'saved' && view !== 'packing')) return 'places'
  return 'plan'
}

// a trip's old packing link (packing, "more", saved's packing) goes to home's packing, for that trip
export const isPackingLink = (params: URLSearchParams): boolean => {
  const asked = params.get('tab') ?? ''
  return asked === 'packing' || asked === 'more' || params.get('view') === 'packing'
}
export const packingHome = (tripId: string): string => `/?view=packing&trip=${encodeURIComponent(tripId)}`

export const TAB_ICON: Record<Tab, string> = { plan: 'plan', map: 'map', places: 'bookmark', notes: 'note', links: 'link', money: 'money' }
