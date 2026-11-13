export type Tab = 'plan' | 'map' | 'places' | 'notes' | 'links' | 'money' | 'packing'
// phones: seven at the bottom (six once packing moves home). laptops: the map is always beside, so six
export const PHONE_TABS: Tab[] = ['plan', 'map', 'places', 'notes', 'links', 'money', 'packing']
export const WIDE_TABS: Tab[] = ['plan', 'places', 'notes', 'links', 'money', 'packing']

// old links still land where they meant: the calendar, itinerary and day views are the plan now,
// ideas (and saved places before them) are places, saved links are links, and everything from "more" is packing
export function readTab(params: URLSearchParams, wide: boolean): Tab {
  const asked = params.get('tab') ?? ''
  const view = params.get('view') ?? ''
  if (asked === 'map') return wide ? 'plan' : 'map'
  if (asked === 'money' || asked === 'cost') return 'money'
  if (asked === 'packing' || view === 'packing') return 'packing'
  if (asked === 'links' || (asked === 'saved' && view === 'links')) return 'links'
  if (asked === 'notes') return 'notes'
  if (asked === 'places' || asked === 'ideas' || asked === 'saved') return 'places'
  if (asked === 'more') return 'packing'
  return 'plan'
}

export const TAB_ICON: Record<Tab, string> = { plan: 'plan', map: 'map', places: 'bookmark', notes: 'note', links: 'link', money: 'money', packing: 'packing' }
