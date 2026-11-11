// public holidays come from here, not date.nager.at: the real 2027 dates for the countries the made-up trips visit,
// the same on every run, and no request ever leaves the machine
const real = window.fetch.bind(window)
const H = (date: string, name: string, localName: string, global = true) => ({ date, name, localName, global, types: ['Public'] })
const days: Record<string, unknown[]> = {
  'NL/2027': [H('2027-01-01', "New Year's Day", 'Nieuwjaarsdag'), H('2027-03-28', 'Easter Sunday', 'Eerste Paasdag'), H('2027-03-29', 'Easter Monday', 'Tweede Paasdag'),
    H('2027-04-27', "King's Day", 'Koningsdag'), H('2027-05-05', 'Liberation Day', 'Bevrijdingsdag'), H('2027-05-06', 'Ascension Day', 'Hemelvaartsdag'),
    H('2027-05-16', 'Whit Sunday', 'Eerste Pinksterdag'), H('2027-05-17', 'Whit Monday', 'Tweede Pinksterdag'), H('2027-12-25', 'Christmas Day', 'Eerste Kerstdag')],
  'FR/2027': [H('2027-01-01', "New Year's Day", "Jour de l'an"), H('2027-03-29', 'Easter Monday', 'Lundi de Pâques'), H('2027-05-01', 'Labour Day', 'Fête du Travail'),
    H('2027-05-06', 'Ascension Day', 'Ascension'), H('2027-07-14', 'Bastille Day', 'Fête nationale')],
}
window.fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const m = /date\.nager\.at\/api\/v3\/PublicHolidays\/(\d{4})\/([A-Z]{2})/.exec(url)
  if (m) return Promise.resolve(new Response(JSON.stringify(days[`${m[2]}/${m[1]}`] ?? []), { status: 200, headers: { 'content-type': 'application/json' } }))
  return real(input, init)
}

export {}
