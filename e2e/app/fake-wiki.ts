// wikipedia's photos come from here, not wikipedia: one page (the musée d'orsay, which google knows nothing about here),
// so a card can show a borrowed photo with its credit, and no request ever leaves the machine
const real = window.fetch.bind(window)
const ORSAY = { lat: 48.86, lng: 2.326 }
const photo = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="9"><rect width="16" height="9" fill="#c9d3e0"/></svg>')}`
window.fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (url.includes('wikipedia.org')) {
    const [lat, lng] = (new URL(url).searchParams.get('ggscoord') ?? '').split('|').map(Number)
    const near = Math.abs(lat - ORSAY.lat) < 0.003 && Math.abs(lng - ORSAY.lng) < 0.003
    const pages = near ? [{ title: "Musée d'Orsay", coordinates: [{ lat: 48.86, lon: 2.3266 }], pageimage: 'Musee_d_Orsay.jpg', thumbnail: { source: photo, width: 16, height: 9 } }] : []
    return Promise.resolve(new Response(JSON.stringify({ query: { pages } }), { status: 200, headers: { 'content-type': 'application/json' } }))
  }
  return real(input, init)
}

export {}
