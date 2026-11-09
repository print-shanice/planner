// the browser key is public by design (anything in a VITE_ variable ships in the page):
// it must be restricted to this site's addresses and to the three apis the planner uses
export function googleKey(): string {
  return String(import.meta.env.VITE_GOOGLE_MAPS_KEY ?? '').trim()
}

// advanced markers need a map id; google's demo id works for trying it out
export function googleMapId(): string {
  return String(import.meta.env.VITE_GOOGLE_MAP_ID ?? '').trim() || 'DEMO_MAP_ID'
}

export const googleConfigured = (): boolean => googleKey().length > 0
