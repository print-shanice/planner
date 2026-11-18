import { dayAsks, dayTempWords, fetchDayTemps, usualFrom } from '../../src/lib/dayWeather'

const TODAY = '2026-11-18'
const paris = { lat: 48.8566, lng: 2.3522 }
const nearParis = { lat: 48.88, lng: 2.37 }
const rome = { lat: 41.9, lng: 12.5 }

it('asks the forecast for days within its reach, what was for past days, and usual weather for days further off', () => {
  const asks = dayAsks([
    { date: '2026-11-20', at: paris },
    { date: '2026-11-25', at: nearParis },
    { date: '2026-12-20', at: paris },
    { date: '2026-08-01', at: paris },
  ], TODAY)
  expect(asks).toEqual([
    { kind: 'was', at: { lat: 48.9, lng: 2.4 }, from: '2026-08-01', to: '2026-08-01' },
    { kind: 'forecast', at: { lat: 48.9, lng: 2.4 }, from: '2026-11-20', to: '2026-11-25' },
    { kind: 'usual', at: { lat: 48.9, lng: 2.4 }, from: '2026-12-20', to: '2026-12-20' },
  ])
})

it('asks once per place, the place rounded so no exact spot is sent', () => {
  const asks = dayAsks([{ date: '2026-11-19', at: paris }, { date: '2026-11-20', at: rome }, { date: '2026-11-21', at: paris }], TODAY)
  expect(asks.map((a) => [a.at, a.from, a.to])).toEqual([
    [{ lat: 48.9, lng: 2.4 }, '2026-11-19', '2026-11-21'],
    [{ lat: 41.9, lng: 12.5 }, '2026-11-20', '2026-11-20'],
  ])
})

it('days with no spot ask nothing', () => {
  expect(dayAsks([], TODAY)).toEqual([])
})

const serve = (byUrl: (u: URL) => unknown) => vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
  const u = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
  return Promise.resolve(new Response(JSON.stringify(byUrl(u)), { status: 200 }))
})

it('reads each day\'s low and high, rounded', async () => {
  const spy = serve(() => ({ daily: { time: ['2026-11-20', '2026-11-21'], temperature_2m_max: [12.4, null], temperature_2m_min: [3.6, 2] } }))
  const got = await fetchDayTemps({ kind: 'forecast', at: { lat: 48.9, lng: 2.4 }, from: '2026-11-20', to: '2026-11-21' }, 'C')
  expect(got).toEqual({ '2026-11-20': { lo: 4, hi: 12 } })
  spy.mockRestore()
})

it('a far-off day is the last three years around that date, so one odd day doesn\'t decide it', () => {
  const year = (hi: number, lo: number, y: number) => ({
    daily: { time: [`${y}-02-18`, `${y}-02-19`, `${y}-02-20`], temperature_2m_max: [hi - 2, hi, hi + 2], temperature_2m_min: [lo, lo, lo] },
  })
  const got = usualFrom(['2027-02-19'], [year(10, 2, 2026), year(12, 4, 2025), year(8, 0, 2024)])
  expect(got).toEqual({ '2027-02-19': { lo: 2, hi: 10 } })
})

it('usual weather asks three years back, with a few days either side', async () => {
  const urls: URL[] = []
  const spy = serve((u) => { urls.push(u); return { daily: { time: [], temperature_2m_max: [], temperature_2m_min: [] } } })
  await fetchDayTemps({ kind: 'usual', at: { lat: 48.9, lng: 2.4 }, from: '2027-02-19', to: '2027-02-23' }, 'C')
  expect(urls.map((u) => [u.host, u.searchParams.get('start_date'), u.searchParams.get('end_date')])).toEqual([
    ['archive-api.open-meteo.com', '2026-02-16', '2026-02-26'],
    ['archive-api.open-meteo.com', '2025-02-16', '2025-02-26'],
    ['archive-api.open-meteo.com', '2024-02-16', '2024-02-26'],
  ])
  spy.mockRestore()
})

it('fetches once, then answers from what it kept', async () => {
  const spy = serve(() => ({ daily: { time: ['2026-11-20'], temperature_2m_max: [12], temperature_2m_min: [4] } }))
  const ask = { kind: 'forecast' as const, at: { lat: 48.9, lng: 2.4 }, from: '2026-11-20', to: '2026-11-20' }
  await fetchDayTemps(ask, 'C')
  expect(await fetchDayTemps(ask, 'C')).toEqual({ '2026-11-20': { lo: 4, hi: 12 } })
  expect(spy).toHaveBeenCalledTimes(1)
  spy.mockRestore()
})

it('says a day low to high, with a real minus', () => {
  expect(dayTempWords({ lo: 4, hi: 12 })).toBe('4°–12°')
  expect(dayTempWords({ lo: -3, hi: 4 })).toBe('−3°–4°')
})
