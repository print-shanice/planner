import { countryName } from '../lib/countries'

// a country as its two-letter code in a hairline tag, like a luggage label: black and white, the same on every device
export function CountryFlag({ code }: { code?: string | null }) {
  if (!code || !/^[a-z]{2}$/i.test(code)) return null
  const c = code.toUpperCase()
  const name = countryName(c)
  return <span className="flag" role="img" aria-label={name} title={name}>{c}</span>
}
