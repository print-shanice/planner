import { countryName } from '../lib/countries'

export function CountryFlag({ code }: { code?: string | null }) {
  if (!code || !/^[a-z]{2}$/i.test(code)) return null
  const country = code.toUpperCase()
  return <span role="img" aria-label={countryName(country)} title={countryName(country)}>{[...country].map(c => String.fromCodePoint(127397 + c.charCodeAt(0))).join('')}</span>
}
