export type Tab = 'plan' | 'map' | 'ideas' | 'links' | 'money' | 'packing'
// phones: six at the bottom. laptops: the map is always beside, so five
export const PHONE_TABS: Tab[] = ['plan', 'map', 'ideas', 'links', 'money', 'packing']
export const WIDE_TABS: Tab[] = ['plan', 'ideas', 'links', 'money', 'packing']

// old links still land where they meant: the calendar, itinerary and day views are the plan now,
// saved places are ideas, saved links are links, and everything from "more" is packing
export function readTab(params: URLSearchParams, wide: boolean): Tab {
  const asked = params.get('tab') ?? ''
  const view = params.get('view') ?? ''
  if (asked === 'map') return wide ? 'plan' : 'map'
  if (asked === 'money' || asked === 'cost') return 'money'
  if (asked === 'packing' || view === 'packing') return 'packing'
  if (asked === 'links' || (asked === 'saved' && view === 'links')) return 'links'
  if (asked === 'ideas' || asked === 'saved') return 'ideas'
  if (asked === 'more') return 'packing'
  return 'plan'
}

export const TAB_ICON: Record<Tab, string> = { plan: 'plan', map: 'map', ideas: 'bookmark', links: 'link', money: 'money', packing: 'packing' }
