import { averageOf, fetchTemps, packWeatherAsk, skyOf, tempWords, weatherAsk, weatherLine, weatherUrl, yearsBack } from '../../src/lib/weather'

const TODAY = '2026-11-10'

it('asks for the forecast when a trip is close, and for usual weather when it is far off', () => {
  expect(weatherAsk('2026-11-14', '2026-11-18', TODAY)).toEqual({ kind: 'forecast', from: '2026-11-14', to: '2026-11-18' })
  // under way: from today; running past the forecast's reach: cut at its edge
  expect(weatherAsk('2026-11-08', '2026-12-01', TODAY)).toEqual({ kind: 'forecast', from: '2026-11-10', to: '2026-11-25' })
  expect(weatherAsk('2027-02-19', '2027-02-23', TODAY)).toEqual({
    kind: 'usual', spans: [{ from: '2026-02-19', to: '2026-02-23' }, { from: '2025-02-19', to: '2025-02-23' }, { from: '2024-02-19', to: '2024-02-23' }],
  })
})

it('asks nothing for past, undated or season-long trips', () => {
  expect(weatherAsk('2026-05-01', '2026-05-04', TODAY)).toBeNull()
  expect(weatherAsk(null, null, TODAY)).toBeNull()
  expect(weatherAsk('2027-01-28', '2027-07-13', TODAY)).toBeNull()
})

it('keeps 29 february as the 28th in a year without it', () => {
  expect(yearsBack('2028-02-29', 1)).toBe('2027-02-28')
})

it('builds a free open-meteo request with the place rounded, so no exact spot is sent', () => {
  const url = new URL(weatherUrl('archive', { lat: 48.85661, lng: 2.35222 }, '2026-02-19', '2026-02-23', 'F'))
  expect(url.host).toBe('archive-api.open-meteo.com')
  expect(url.searchParams.get('latitude')).toBe('48.86')
  expect(url.searchParams.get('longitude')).toBe('2.35')
  expect(url.searchParams.get('temperature_unit')).toBe('fahrenheit')
  expect(url.searchParams.has('apikey')).toBe(false)
})

it('averages every day answered into one high and low', () => {
  expect(averageOf([{ daily: { temperature_2m_max: [10, 12], temperature_2m_min: [2, null] } }, { daily: { temperature_2m_max: [14], temperature_2m_min: [4] } }])).toEqual({ hi: 12, lo: 3 })
  expect(averageOf([{ daily: {} }])).toBeNull()
})

it('fetches once, then answers from what it kept', async () => {
  const ask = weatherAsk('2026-11-14', '2026-11-18', TODAY)!
  const spy = vi.spyOn(globalThis, 'fetch')
  const first = await fetchTemps({ lat: 48.85, lng: 2.35 }, ask, 'C')
  expect(first).toEqual({ hi: 13, lo: 5, kind: 'forecast', unit: 'C' })
  await fetchTemps({ lat: 48.85, lng: 2.35 }, ask, 'C')
  expect(spy).toHaveBeenCalledTimes(1)
  spy.mockRestore()
})

it('says a far-off trip\'s weather as usual, not as a forecast', () => {
  expect(tempWords({ hi: 9, lo: 3, kind: 'usual', unit: 'C' })).toBe('usually 9° / 3°')
  expect(tempWords({ hi: 13, lo: 5, kind: 'forecast', unit: 'C' })).toBe('13° / 5°')
})

it('for packing, a past trip asks what its days were, and a long trip asks about its first month', () => {
  expect(packWeatherAsk('2026-05-01', '2026-05-04', TODAY)).toEqual({ kind: 'was', from: '2026-05-01', to: '2026-05-04' })
  expect(packWeatherAsk('2027-01-28', '2027-07-13', TODAY)).toEqual(weatherAsk('2027-01-28', '2027-02-27', TODAY))
  expect(packWeatherAsk('2026-11-14', '2026-11-18', TODAY)).toEqual(weatherAsk('2026-11-14', '2026-11-18', TODAY))
  expect(packWeatherAsk(null, null, TODAY)).toBeNull()
})

it('asks for rain and snow too, and says them in a few words', () => {
  expect(new URL(weatherUrl('forecast', { lat: 1, lng: 2 }, '2026-11-14', '2026-11-18', 'C')).searchParams.get('daily')).toContain('precipitation_sum')
  const days = (rain: number[], snow: number[] = rain.map(() => 0)) => [{ daily: { precipitation_sum: rain, snowfall_sum: snow } }]
  expect(skyOf(days([0, 0, 0, 0]))).toBe('dry')
  expect(skyOf(days([2, 0, 0, 0, 0]))).toBe('mostly dry')
  expect(skyOf(days([2, 0, 3, 0]))).toBe('rain often')
  expect(skyOf(days([2, 0, 0, 0]))).toBe('some rain')
  expect(skyOf(days([2, 2, 2, 0], [3, 4, 0, 0]))).toBe('snow most days')
  expect(skyOf([{ daily: {} }])).toBeUndefined()
  expect(weatherLine({ hi: -3, lo: -11, kind: 'usual', unit: 'C', sky: 'snow most days' })).toBe('usually -3° / -11° · snow most days')
  expect(weatherLine({ hi: 23, lo: 14, kind: 'was', unit: 'C' })).toBe('23° / 14°')
})
