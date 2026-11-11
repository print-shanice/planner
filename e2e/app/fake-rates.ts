// the exchange rates come from here, not the internet, so the tests run the same offline and never lean on a live service
const real = window.fetch.bind(window)
const rates = { amount: 1, base: 'EUR', date: '2026-11-09', rates: { SGD: 1.5, GBP: 0.85, USD: 1.08, CHF: 0.94, JPY: 165, DKK: 7.46, NOK: 11.5, SEK: 11.2, PLN: 4.3, CZK: 25, HUF: 400, AUD: 1.65, CAD: 1.5, NZD: 1.8, KRW: 1500, CNY: 7.8, HKD: 8.4, INR: 90, IDR: 17000, MYR: 5, PHP: 62, THB: 38, TRY: 36, ZAR: 20, BRL: 6, MXN: 20, ILS: 4, ISK: 150, RON: 5 } }
window.fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (url.includes('frankfurter')) return Promise.resolve(new Response(JSON.stringify(rates), { status: 200, headers: { 'content-type': 'application/json' } }))
  return real(input, init)
}
