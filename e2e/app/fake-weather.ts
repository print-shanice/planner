// the weather comes from here, not open-meteo: the same days on every run, and no request ever leaves the machine
const real = window.fetch.bind(window)
const next = (d: string) => new Date(Date.parse(`${d}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10)
window.fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (url.includes('open-meteo.com')) {
    const archive = url.includes('archive-api')
    const q = new URL(url).searchParams
    const time: string[] = []
    for (let d = q.get('start_date') ?? ''; d && d <= (q.get('end_date') ?? ''); d = next(d)) time.push(d)
    // a gentle wobble from day to day, so a plan's days read differently
    const his = archive ? [9, 11, 10] : [13, 15], los = archive ? [2, 4, 3] : [6, 8]
    const days = time.length
      ? { daily: { time, temperature_2m_max: time.map((_, i) => his[i % his.length]), temperature_2m_min: time.map((_, i) => los[i % los.length]) } }
      : { daily: { temperature_2m_max: his, temperature_2m_min: los } }
    return Promise.resolve(new Response(JSON.stringify(days), { status: 200, headers: { 'content-type': 'application/json' } }))
  }
  return real(input, init)
}

export {}
