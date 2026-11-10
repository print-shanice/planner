// which real-world stamp a country's passport stamp is modelled on.
// every schengen country stamps the same design, so one drawing covers most of europe
const SCHENGEN = new Set('AT BE BG HR CZ DK EE FI FR DE GR HU IS IT LV LI LT LU MT NL NO PL PT RO SK SI ES SE CH'.split(' '))
const OWN: Record<string, StampStyle> = { JP: 'japan', GB: 'uk', US: 'usa' }

export type StampStyle = 'schengen' | 'japan' | 'uk' | 'usa' | 'plain'

export function stampStyle(code: string): StampStyle {
  const c = code.toUpperCase()
  return SCHENGEN.has(c) ? 'schengen' : OWN[c] ?? 'plain'
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

// the date as that stamp prints it
export function stampDate(iso: string, style: StampStyle): string {
  const [y, m, d] = iso.split('-')
  const mon = MONTHS[+m - 1] ?? ''
  if (style === 'schengen') return `${d}.${m}.${y.slice(2)}`
  if (style === 'usa') return `${mon} ${d} ${y}`
  return `${+d} ${mon} ${y}`
}
