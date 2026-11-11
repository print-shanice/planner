// the weather comes from here, not open-meteo: the same days on every run, and no request ever leaves the machine
const real = window.fetch.bind(window)
window.fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (url.includes('open-meteo.com')) {
    const archive = url.includes('archive-api')
    const days = { daily: { temperature_2m_max: archive ? [9, 11, 10] : [13, 15], temperature_2m_min: archive ? [2, 4, 3] : [6, 8] } }
    return Promise.resolve(new Response(JSON.stringify(days), { status: 200, headers: { 'content-type': 'application/json' } }))
  }
  return real(input, init)
}

export {}
