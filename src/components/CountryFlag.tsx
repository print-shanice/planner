import { countryName } from '../lib/countries'

// a round flag drawn from public/flags (circle-flags), so it looks the same on every device and works offline
export function CountryFlag({ code }: { code?: string | null }) {
  if (!code || !/^[a-z]{2}$/i.test(code)) return null
  const name = countryName(code.toUpperCase())
  return <img className="flag" src={`${import.meta.env.BASE_URL}flags/${code.toLowerCase()}.svg`} alt={name} title={name} width="16" height="16" />
}
