import { countriesOn, fetchHolidays, holidaysOn, holidaysUrl, readHolidays, type Holiday } from '../../src/lib/holidays'
import { place, stop, trip } from '../factories'

it('asks nager.date for a country\'s year, with no key', () => {
  expect(holidaysUrl('nl', 2027)).toBe('https://date.nager.at/api/v3/PublicHolidays/2027/NL')
})

it('keeps only nationwide public holidays', () => {
  const raw = [
    { date: '2027-04-27', name: "King's Day", localName: 'Koningsdag', global: true, types: ['Public'] },
    { date: '2027-03-17', name: "St Patrick's Day", localName: 'Lá Fhéile Pádraig', global: false, types: ['Public'] },
    { date: '2027-02-14', name: 'Valentine', localName: 'Valentijn', global: true, types: ['Observance'] },
  ]
  expect(readHolidays(raw, 'nl')).toEqual([{ date: '2027-04-27', name: "King's Day", local: 'Koningsdag', country: 'NL' }])
})

it('fetches a country\'s year once, then answers from what it kept; a country it doesn\'t know has none', async () => {
  const spy = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url = String(input)
    if (url.endsWith('/XK')) return Promise.resolve(new Response('', { status: 404 }))
    return Promise.resolve(new Response(JSON.stringify([{ date: '2027-04-27', name: "King's Day", localName: 'Koningsdag', global: true, types: ['Public'] }]), { status: 200 }))
  })
  expect(await fetchHolidays('NL', 2027)).toHaveLength(1)
  expect(await fetchHolidays('NL', 2027)).toHaveLength(1)
  expect(await fetchHolidays('XK', 2027)).toEqual([])
  expect(spy).toHaveBeenCalledTimes(2)
  spy.mockRestore()
})

it('a day\'s countries are where its trip is based and wherever that day\'s plans are', () => {
  const eu = trip({ id: 'eu', start_date: '2027-01-28', end_date: '2027-07-13', base: place({ country: 'NL' }) })
  const bcn = trip({ id: 'bcn', parent_id: 'eu', start_date: '2027-04-15', end_date: '2027-04-20', base: place({ country: 'ES' }) })
  const stops = [stop({ trip_id: 'eu', day: '2027-03-01', place: place({ country: 'BE' }) })]
  const none = () => []
  expect(countriesOn(eu, [eu, bcn], stops, '2027-04-27', none)).toEqual(['NL'])
  expect(countriesOn(eu, [eu, bcn], stops, '2027-04-16', none)).toEqual(['ES'])
  expect(countriesOn(eu, [eu, bcn], stops, '2027-03-01', none)).toEqual(['NL', 'BE'])
})

it('shows a day only the holidays of the countries you\'re in', () => {
  const kings: Holiday = { date: '2027-04-27', name: "King's Day", local: 'Koningsdag', country: 'NL' }
  const byDate = new Map([['2027-04-27', [kings, { ...kings, name: 'Freedom Day', country: 'ZA' }]]])
  expect(holidaysOn(byDate, '2027-04-27', ['NL'])).toEqual([kings])
  expect(holidaysOn(byDate, '2027-04-28', ['NL'])).toEqual([])
})
