/* eslint-disable @typescript-eslint/no-explicit-any */
// a flat stand-in for google maps: a plain box the trip map puts its markers and lines on, a place search
// over a few made-up places, walking routes as straight lines, and what google "says" about a place
const listeners: Record<string, ((e: any) => void)[]> = {}

class LatLngBounds { pts: any[] = []; extend(p: any) { this.pts.push(p) } contains() { return true } }

class FakeMap {
  box: HTMLElement; center = { lat: 50, lng: 10 }; zoom = 4; markers: any[] = []
  constructor(box: HTMLElement) {
    this.box = box
    box.style.background = '#e9e5dc'
    ;(window as any).__fakeMap = this
    box.addEventListener('click', (e) => {
      if ((e.target as HTMLElement) !== box) return
      const r = box.getBoundingClientRect()
      const p = this.unproject(e.clientX - r.left, e.clientY - r.top)
      for (const f of listeners.click ?? []) f({ latLng: { lat: () => p.lat, lng: () => p.lng } })
    })
  }
  scale() { return 256 * 2 ** this.zoom / 360 }
  project(p: any) { const r = this.box.getBoundingClientRect(); return { x: r.width / 2 + (p.lng - this.center.lng) * this.scale(), y: r.height / 2 - (p.lat - this.center.lat) * this.scale() * 1.5 } }
  unproject(x: number, y: number) { const r = this.box.getBoundingClientRect(); return { lng: this.center.lng + (x - r.width / 2) / this.scale(), lat: this.center.lat - (y - r.height / 2) / (this.scale() * 1.5) } }
  redraw() { for (const m of this.markers) m.place() }
  addListener(ev: string, fn: any) { (listeners[ev] ??= []).push(fn); return { remove() { listeners[ev] = (listeners[ev] ?? []).filter((f) => f !== fn) } } }
  fitBounds(b: LatLngBounds) {
    const lats = b.pts.map((p) => p.lat), lngs = b.pts.map((p) => p.lng)
    this.center = { lat: (Math.min(...lats) + Math.max(...lats)) / 2, lng: (Math.min(...lngs) + Math.max(...lngs)) / 2 }
    const span = Math.max(Math.max(...lngs) - Math.min(...lngs), (Math.max(...lats) - Math.min(...lats)) * 1.5, 0.002)
    this.zoom = Math.min(16, Math.log2((this.box.clientWidth * 0.6) * 360 / (256 * span)))
    this.redraw()
    for (const f of listeners.idle ?? []) f({})
  }
  setCenter(c: any) { this.center = c; this.redraw() }
  setZoom(z: number) { this.zoom = z; this.redraw() }
  panTo(c: any) { this.setCenter(c) }
  getZoom() { return this.zoom }
  getCenter() { return { lat: () => this.center.lat, lng: () => this.center.lng } }
  getBounds() { return new LatLngBounds() }
}

class AdvancedMarkerElement {
  _map: any; content: HTMLElement; _pos: any; zIndex?: number
  constructor(o: any) { this.content = o.content; this._pos = o.position; this.zIndex = o.zIndex; this.content.style.position = 'absolute'; this.content.style.transform = 'translate(-50%, -100%)'; this.map = o.map }
  set map(m: any) {
    if (this._map) { this._map.markers = this._map.markers.filter((x: any) => x !== this); this.content.remove() }
    this._map = m
    if (m) { m.markers.push(this); m.box.append(this.content); this.place() }
  }
  get map() { return this._map }
  set position(p: any) { this._pos = p; this.place() }
  get position() { return this._pos }
  place() { if (!this._map) return; const { x, y } = this._map.project(this._pos); this.content.style.left = `${x}px`; this.content.style.top = `${y}px` }
}

class Polyline {
  svg?: SVGSVGElement
  constructor(o: any) {
    const m = o.map
    if (!m || !o.path?.length) return
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none')
    const pl = document.createElementNS('http://www.w3.org/2000/svg', 'polyline')
    pl.setAttribute('points', o.path.map((p: any) => { const q = m.project(p); return `${q.x},${q.y}` }).join(' '))
    pl.setAttribute('fill', 'none')
    pl.setAttribute('stroke', o.strokeColor || o.icons?.[0]?.icon?.strokeColor || '#555')
    pl.setAttribute('stroke-width', String(o.strokeWeight || 2))
    if (o.icons) pl.setAttribute('stroke-dasharray', '4 4')
    svg.append(pl)
    m.box.prepend(svg)
    this.svg = svg
  }
  setMap(x: any) { if (!x) this.svg?.remove() }
}

// the few places the search knows, with what google would say about them
type Known = { id: string; name: string; sub: string; city: string; country: string; lat: number; lng: number; types: string[]; kind: string; rating?: number; ratings?: number; hours?: string[]; website?: string }
const HOURS = ['Monday: 9:00 AM – 6:00 PM', 'Tuesday: 9:00 AM – 6:00 PM', 'Wednesday: 9:00 AM – 6:00 PM', 'Thursday: 9:00 AM – 9:45 PM', 'Friday: 9:00 AM – 6:00 PM', 'Saturday: 9:00 AM – 6:00 PM', 'Sunday: 9:00 AM – 6:00 PM']
const KNOWN: Known[] = [
  { id: 'g-louvre', name: 'Louvre Museum', sub: 'Rue de Rivoli, Paris', city: 'Paris', country: 'FR', lat: 48.8606, lng: 2.3376, types: ['museum', 'tourist_attraction'], kind: 'Art museum', rating: 4.7, ratings: 310_000, hours: HOURS, website: 'https://www.louvre.fr/' },
  { id: 'g-eiffel', name: 'Eiffel Tower', sub: 'Av. Gustave Eiffel, Paris', city: 'Paris', country: 'FR', lat: 48.8584, lng: 2.2945, types: ['tourist_attraction'], kind: 'Historical landmark', rating: 4.7, ratings: 420_000, hours: HOURS },
  { id: 'g-flore', name: 'Café de Flore', sub: 'Bd Saint-Germain, Paris', city: 'Paris', country: 'FR', lat: 48.8540, lng: 2.3326, types: ['cafe'], kind: 'Cafe', rating: 4.1, ratings: 12_000, hours: HOURS },
  { id: 'g-hop', name: 'Hop Inn Kyoto Shijo Omiya', sub: 'Shimogyo Ward, Kyoto', city: 'Kyoto', country: 'JP', lat: 35.003, lng: 135.747, types: ['lodging'], kind: 'Hotel', rating: 4.2, ratings: 244, website: 'https://hopinn.example/' },
  { id: 'g-stroop', name: 'Stroopwafel Stand', sub: 'Markt, Eindhoven', city: 'Eindhoven', country: 'NL', lat: 51.4395, lng: 5.4785, types: ['bakery'], kind: 'Bakery', rating: 4.6, ratings: 80, hours: HOURS },
]

const fields = (k: Known) => ({
  location: { lat: () => k.lat, lng: () => k.lng },
  formattedAddress: `${k.name}, ${k.sub}, ${k.country}`,
  addressComponents: [{ longText: k.city, shortText: k.city, types: ['locality'] }, { longText: k.country, shortText: k.country, types: ['country'] }],
  types: k.types,
  displayName: k.name,
  rating: k.rating ?? null,
  userRatingCount: k.ratings ?? null,
  primaryTypeDisplayName: k.kind,
  photos: [{ getURI: () => `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="9"><rect width="16" height="9" fill="#d3dfc6"/></svg>')}` }],
  regularOpeningHours: k.hours ? { weekdayDescriptions: k.hours } : null,
  websiteURI: k.website ?? null,
  googleMapsURI: `https://maps.google.com/?q=${encodeURIComponent(k.name)}`,
})

class Place {
  constructor(public o: { id: string }) {}
  async fetchFields() {
    const k = KNOWN.find((x) => x.id === this.o.id)
    if (!k) throw new Error('unknown place')
    return { place: fields(k) }
  }
}

const places = {
  AutocompleteSessionToken: class {},
  AutocompleteSuggestion: {
    fetchAutocompleteSuggestions: async ({ input }: { input: string }) => {
      const q = input.trim().toLowerCase()
      const hits = KNOWN.filter((k) => k.name.toLowerCase().includes(q))
      return { suggestions: hits.map((k) => ({ placePrediction: { placeId: k.id, mainText: { text: k.name }, secondaryText: { text: k.sub }, types: k.types, toPlace: () => new Place({ id: k.id }) } })) }
    },
  },
  Place,
}

const routes = {
  Route: {
    computeRoutes: async (r: any) => ({
      routes: [{
        legs: [r.origin, ...r.intermediates].map((a: any, i: number, all: any[]) => {
          const b = i + 1 < all.length ? all[i + 1] : r.destination
          const m = Math.hypot(a.lat - b.lat, (a.lng - b.lng) * 0.65) * 111000
          return { durationMillis: (m / 1.3) * 1000, distanceMeters: m, path: [a, b].map((p) => ({ lat: () => p.lat, lng: () => p.lng })) }
        }),
      }],
    }),
  },
}

;(window as any).google = {
  maps: {
    importLibrary: async (n: string) => (n === 'marker' ? { AdvancedMarkerElement } : n === 'maps' ? { Map: FakeMap } : n === 'routes' ? routes : n === 'places' ? places : {}),
    Polyline,
    LatLngBounds,
  },
}
