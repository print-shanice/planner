// the free photos come from here, not wikipedia or openverse: one wikipedia page (the musée d'orsay) and one flickr
// photo (du pain et des idées), so cards show a borrowed photo with its credit, and no request ever leaves the machine
const real = window.fetch.bind(window)
const ORSAY = { lat: 48.86, lng: 2.326 }
const photo = (fill: string) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="9"><rect width="16" height="9" fill="${fill}"/></svg>`)}`
const json = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }))
window.fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (url.includes('wikipedia.org')) {
    const [lat, lng] = (new URL(url).searchParams.get('ggscoord') ?? '').split('|').map(Number)
    const near = Math.abs(lat - ORSAY.lat) < 0.003 && Math.abs(lng - ORSAY.lng) < 0.003
    const pages = near ? [{ title: "Musée d'Orsay", coordinates: [{ lat: 48.86, lon: 2.3266 }], pageimage: 'Musee_d_Orsay.jpg', thumbnail: { source: photo('#c9d3e0'), width: 16, height: 9 } }] : []
    return json({ query: { pages } })
  }
  if (url.includes('api.openverse.org')) {
    const q = (new URL(url).searchParams.get('q') ?? '').toLowerCase()
    const results = q.includes('du pain et des idées')
      ? [{ title: 'Du Pain et des Idées', thumbnail: photo('#e0d2c0'), foreign_landing_url: 'https://www.flickr.com/photos/x/du-pain', source: 'flickr' }]
      : []
    return json({ results })
  }
  return real(input, init)
}

export {}
