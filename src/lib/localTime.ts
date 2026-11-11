import { useEffect, useState } from 'react'

// the time where a trip is, like a gallery's "LDN 02:20": a three-letter place, the clock there, and how far it is from yours.
// the zone comes from the country; the few countries that span zones are split by longitude, which is close enough for a clock

const ONE: Record<string, string> = {
  AD: 'Europe/Andorra', AE: 'Asia/Dubai', AL: 'Europe/Tirane', AM: 'Asia/Yerevan', AR: 'America/Argentina/Buenos_Aires', AT: 'Europe/Vienna',
  AZ: 'Asia/Baku', BA: 'Europe/Sarajevo', BB: 'America/Barbados', BD: 'Asia/Dhaka', BE: 'Europe/Brussels', BG: 'Europe/Sofia', BH: 'Asia/Bahrain',
  BO: 'America/La_Paz', BS: 'America/Nassau', BT: 'Asia/Thimphu', BW: 'Africa/Gaborone', BY: 'Europe/Minsk', BZ: 'America/Belize',
  CH: 'Europe/Zurich', CL: 'America/Santiago', CN: 'Asia/Shanghai', CO: 'America/Bogota', CR: 'America/Costa_Rica', CU: 'America/Havana',
  CV: 'Atlantic/Cape_Verde', CY: 'Asia/Nicosia', CZ: 'Europe/Prague', DE: 'Europe/Berlin', DK: 'Europe/Copenhagen', DO: 'America/Santo_Domingo',
  DZ: 'Africa/Algiers', EC: 'America/Guayaquil', EE: 'Europe/Tallinn', EG: 'Africa/Cairo', ES: 'Europe/Madrid', ET: 'Africa/Addis_Ababa',
  FI: 'Europe/Helsinki', FJ: 'Pacific/Fiji', FO: 'Atlantic/Faroe', FR: 'Europe/Paris', GB: 'Europe/London', GE: 'Asia/Tbilisi', GH: 'Africa/Accra',
  GI: 'Europe/Gibraltar', GL: 'America/Nuuk', GR: 'Europe/Athens', GT: 'America/Guatemala', HK: 'Asia/Hong_Kong', HN: 'America/Tegucigalpa',
  HR: 'Europe/Zagreb', HU: 'Europe/Budapest', IE: 'Europe/Dublin', IL: 'Asia/Jerusalem', IN: 'Asia/Kolkata', IQ: 'Asia/Baghdad', IR: 'Asia/Tehran',
  IS: 'Atlantic/Reykjavik', IT: 'Europe/Rome', JM: 'America/Jamaica', JO: 'Asia/Amman', JP: 'Asia/Tokyo', KE: 'Africa/Nairobi', KG: 'Asia/Bishkek',
  KH: 'Asia/Phnom_Penh', KR: 'Asia/Seoul', KW: 'Asia/Kuwait', LA: 'Asia/Vientiane', LB: 'Asia/Beirut', LI: 'Europe/Vaduz', LK: 'Asia/Colombo',
  LT: 'Europe/Vilnius', LU: 'Europe/Luxembourg', LV: 'Europe/Riga', MA: 'Africa/Casablanca', MC: 'Europe/Monaco', MD: 'Europe/Chisinau',
  ME: 'Europe/Podgorica', MG: 'Indian/Antananarivo', MK: 'Europe/Skopje', MM: 'Asia/Yangon', MN: 'Asia/Ulaanbaatar', MO: 'Asia/Macau',
  MT: 'Europe/Malta', MU: 'Indian/Mauritius', MV: 'Indian/Maldives', MY: 'Asia/Kuala_Lumpur', MZ: 'Africa/Maputo', NA: 'Africa/Windhoek',
  NG: 'Africa/Lagos', NI: 'America/Managua', NL: 'Europe/Amsterdam', NO: 'Europe/Oslo', NP: 'Asia/Kathmandu', NZ: 'Pacific/Auckland',
  OM: 'Asia/Muscat', PA: 'America/Panama', PE: 'America/Lima', PH: 'Asia/Manila', PK: 'Asia/Karachi', PL: 'Europe/Warsaw', PR: 'America/Puerto_Rico',
  PT: 'Europe/Lisbon', PY: 'America/Asuncion', QA: 'Asia/Qatar', RO: 'Europe/Bucharest', RS: 'Europe/Belgrade', RW: 'Africa/Kigali',
  SA: 'Asia/Riyadh', SC: 'Indian/Mahe', SE: 'Europe/Stockholm', SG: 'Asia/Singapore', SI: 'Europe/Ljubljana', SK: 'Europe/Bratislava',
  SM: 'Europe/San_Marino', SN: 'Africa/Dakar', SV: 'America/El_Salvador', TH: 'Asia/Bangkok', TN: 'Africa/Tunis', TR: 'Europe/Istanbul',
  TT: 'America/Port_of_Spain', TW: 'Asia/Taipei', TZ: 'Africa/Dar_es_Salaam', UA: 'Europe/Kyiv', UG: 'Africa/Kampala', UY: 'America/Montevideo',
  UZ: 'Asia/Tashkent', VA: 'Europe/Vatican', VE: 'America/Caracas', VN: 'Asia/Ho_Chi_Minh', ZA: 'Africa/Johannesburg', ZM: 'Africa/Lusaka',
  ZW: 'Africa/Harare',
}

// countries with several zones: [west edge of each zone (degrees east), zone], from east to west
const MANY: Record<string, [number, string][]> = {
  US: [[-87.5, 'America/New_York'], [-101.5, 'America/Chicago'], [-114.5, 'America/Denver'], [-129, 'America/Los_Angeles'], [-169, 'America/Anchorage'], [-180, 'Pacific/Honolulu']],
  CA: [[-66, 'America/Halifax'], [-90, 'America/Toronto'], [-102, 'America/Winnipeg'], [-120, 'America/Edmonton'], [-180, 'America/Vancouver']],
  MX: [[-105.5, 'America/Mexico_City'], [-114, 'America/Mazatlan'], [-180, 'America/Tijuana']],
  BR: [[-50, 'America/Sao_Paulo'], [-66, 'America/Manaus'], [-180, 'America/Rio_Branco']],
  AU: [[140.9, 'Australia/Sydney'], [129, 'Australia/Adelaide'], [-180, 'Australia/Perth']],
  ID: [[127, 'Asia/Jayapura'], [115, 'Asia/Makassar'], [-180, 'Asia/Jakarta']],
  RU: [[127, 'Asia/Vladivostok'], [100, 'Asia/Irkutsk'], [80, 'Asia/Krasnoyarsk'], [55, 'Asia/Yekaterinburg'], [-180, 'Europe/Moscow']],
  KZ: [[-180, 'Asia/Almaty']],
  CL: [[-180, 'America/Santiago']],
  PT: [[-20, 'Europe/Lisbon'], [-180, 'Atlantic/Azores']],
  ES: [[-13, 'Europe/Madrid'], [-180, 'Atlantic/Canary']],
}

export function zoneOf(country?: string | null, lng?: number | null): string | null {
  const c = (country ?? '').toUpperCase()
  if (c === 'US' && lng != null && lng < -154 && lng > -161) return 'Pacific/Honolulu'
  const split = MANY[c]
  if (split) return lng == null ? split[0][1] : (split.find(([west]) => lng >= west) ?? split[split.length - 1])[1]
  return ONE[c] ?? null
}

// minutes east of utc for a zone at a moment
export function offsetOf(zone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(at)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'))
  return Math.round((asUtc - Math.floor(at.getTime() / 60000) * 60000) / 60000)
}

export function clockIn(zone: string, at: Date): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at)
}

// "ein", "par", "tok": the place's first three letters, as a departures board would shorten it
export function placeCode(name?: string | null): string {
  return (name ?? '').normalize('NFD').replace(/[^\p{L}]/gu, '').slice(0, 3).toLowerCase()
}

// "same time as you", "+1h from you", "−7h30 from you"
export function diffWords(there: number, here: number): string {
  const d = there - here
  if (d === 0) return 'same time as you'
  const h = Math.trunc(Math.abs(d) / 60), m = Math.abs(d) % 60
  return `${d > 0 ? '+' : '−'}${h}h${m ? String(m).padStart(2, '0') : ''} from you`
}

// this device's own place, from its zone's city: Europe/Amsterdam → "ams"
export function hereCode(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? ''
    return placeCode(zone.split('/').pop()?.replace(/_/g, ' '))
  } catch { return '' }
}

// the minute, kept current
export function useNow(every = 30_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), every)
    return () => clearInterval(t)
  }, [every])
  return now
}
