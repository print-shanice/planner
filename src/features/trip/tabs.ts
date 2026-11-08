export type Tab = 'calendar' | 'itinerary' | 'map' | 'money' | 'saved'
export type SavedView = 'ideas' | 'links' | 'packing'
export const PHONE_TABS: Tab[] = ['calendar', 'itinerary', 'map', 'money', 'saved']
// on a laptop the map is always beside the plan
export const WIDE_TABS: Tab[] = ['calendar', 'itinerary', 'money', 'saved']
export const SAVED_VIEWS: SavedView[] = ['ideas', 'links', 'packing']

// old links (plan, cost, ideas, links, packing) still land where they meant
export function readTab(params: URLSearchParams, wide: boolean): { tab: Tab; view: SavedView } {
  const asked = params.get('tab') ?? ''
  const askedView = params.get('view') as SavedView
  let tab: Tab = 'calendar'
  let view: SavedView = SAVED_VIEWS.includes(askedView) ? askedView : 'ideas'
  if (asked === 'cost' || asked === 'money') tab = 'money'
  else if (asked === 'itinerary') tab = 'itinerary'
  else if (asked === 'map') tab = 'map'
  else if (asked === 'saved') tab = 'saved'
  else if (SAVED_VIEWS.includes(asked as SavedView)) { tab = 'saved'; view = asked as SavedView }
  if (!(wide ? WIDE_TABS : PHONE_TABS).includes(tab)) tab = 'calendar'
  return { tab, view }
}
