import { act, render, screen, waitFor } from '@testing-library/react'
import { EMPTY, mapFeatures } from '../../src/features/map/features'
import { trip, stop, place } from '../factories'

const g = vi.hoisted(() => ({ online: true, maps: [] as any[], markers: [] as any[], lines: [] as any[] }))
vi.mock('../../src/lib/offline', () => ({ useOnline: () => g.online, useCanEdit: () => true }))

function installGoogle() {
  class Map {
    listeners: Record<string, ((e: unknown) => void)[]> = {}
    constructor(public box: HTMLElement) { g.maps.push(this) }
    addListener(ev: string, fn: (e: unknown) => void) { (this.listeners[ev] ??= []).push(fn); return { remove() {} } }
    fitBounds() {} setCenter() {} setZoom() {} panTo() {} getZoom() { return 12 } getCenter() { return { lat: () => 1, lng: () => 2 } } getBounds() { return null }
  }
  class AdvancedMarkerElement {
    map: unknown; content: HTMLElement; position: unknown
    constructor(o: { map: unknown; content: HTMLElement; position: unknown }) { this.map = o.map; this.content = o.content; this.position = o.position; document.body.append(o.content); g.markers.push(this) }
  }
  class Polyline { constructor(o: unknown) { g.lines.push(o) } setMap() {} }
  class LatLngBounds { extend() {} }
  ;(window as any).google = { maps: { importLibrary: async (n: string) => (n === 'marker' ? { AdvancedMarkerElement } : { Map }), Polyline, LatLngBounds } }
}

beforeEach(() => {
  vi.resetModules()
  g.online = true; g.maps = []; g.markers = []; g.lines = []
  document.body.innerHTML = ''
  delete (window as any).google
})
afterEach(() => vi.unstubAllEnvs())

const lap = trip({ id: 'lap', start_date: '2027-02-07', end_date: '2027-02-11', color: 1 })
const stops = [
  stop({ id: 'c', trip_id: 'lap', title: 'kopi', day: '2027-02-08', category: 'cafe', place: place({ lat: 66.5, lng: 25.7 }) }),
  stop({ id: 'm', trip_id: 'lap', title: 'arktikum', day: '2027-02-08', position: 1, category: 'museum', place: place({ lat: 66.51, lng: 25.72 }) }),
  stop({ id: 'i', trip_id: 'lap', title: 'bakery idea', day: null, category: 'bakery', place: place({ lat: 66.505, lng: 25.71 }) }),
]

async function show(data = mapFeatures(lap, [lap], stops, '2027-02-08')) {
  const { TripMap } = await import('../../src/features/map/TripMap')
  return render(<TripMap data={data} fitKey="k" fallback={null} focus={null} onPick={() => {}} onEmpty={() => {}} />)
}

it('says the map is not set up when there is no google key, and loads nothing', async () => {
  vi.stubEnv('VITE_GOOGLE_MAPS_KEY', '')
  await show()
  expect(screen.getByRole('status')).toHaveTextContent('map not set up')
  expect(document.querySelector('script[src*="maps.googleapis"]')).toBeNull()
})

it('says it needs a connection when offline', async () => {
  vi.stubEnv('VITE_GOOGLE_MAPS_KEY', 'k')
  g.online = false
  await show()
  expect(screen.getByRole('status')).toHaveTextContent('the map needs a connection')
})

it('draws each stop as its number, the same as the plan, edged in its trip colour, and ideas as quiet pins', async () => {
  vi.stubEnv('VITE_GOOGLE_MAPS_KEY', 'k')
  installGoogle()
  await show(mapFeatures(lap, [lap], stops, '2027-02-08'))
  await waitFor(() => expect(g.markers.length).toBeGreaterThan(0))
  const pins = [...document.querySelectorAll('.gpin-stop')] as HTMLElement[]
  expect(pins.map((p) => p.querySelector('.gpin-n')?.textContent)).toEqual(['01', '02'])
  expect(pins.map((p) => p.getAttribute('aria-label')?.split(' ')[0])).toEqual(['1', '2'])
  expect(pins[0].style.getPropertyValue('--pin')).toBeTruthy()
  expect(document.querySelectorAll('.gpin-idea')).toHaveLength(1)
})

it('makes one map per visit, however many times the map screen opens', async () => {
  vi.stubEnv('VITE_GOOGLE_MAPS_KEY', 'k')
  installGoogle()
  const a = await show({ ...EMPTY })
  await waitFor(() => expect(g.maps).toHaveLength(1))
  a.unmount()
  const { TripMap } = await import('../../src/features/map/TripMap')
  await act(async () => { render(<TripMap data={EMPTY} fitKey="j" fallback={null} focus={null} onPick={() => {}} onEmpty={() => {}} />) })
  await waitFor(() => expect(document.querySelector('.gmap')).not.toBeNull())
  expect(g.maps).toHaveLength(1)
})
