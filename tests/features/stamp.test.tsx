import { render } from '@testing-library/react'
import { Stamp } from '../../src/features/home/Stamp'

const draw = (code: string, o: Partial<Parameters<typeof Stamp>[0]> = {}) =>
  render(<Stamp code={code} name="somewhere" date="28 jan 2027" iso="2027-01-28" port={null} mode={null} {...o} />).container

describe('Stamp', () => {
  it('a schengen country gets the european entry stamp: code in a ring of twelve stars, the date in numbers, the port, how you came', () => {
    const el = draw('NL', { port: 'schiphol', mode: 'flight' })
    const svg = el.querySelector('svg')!
    expect(svg).toHaveAttribute('data-style', 'schengen')
    expect(el.querySelectorAll('.stamp-star')).toHaveLength(12)
    expect(svg.textContent).toContain('nl')
    expect(svg.textContent).toContain('28.01.27')
    expect(svg.textContent).toContain('schiphol')
    expect(el.querySelector('[data-mode="flight"]')).not.toBeNull()
  })
  it('without a journey there is no transport mark, and the country stands in for the port', () => {
    const el = draw('FR', { name: 'france' })
    expect(el.querySelector('[data-mode]')).toBeNull()
    expect(el.querySelector('svg')!.textContent).toContain('france')
  })
  it('japan, the uk and the us have their own stamps', () => {
    expect(draw('JP').querySelector('svg')).toHaveAttribute('data-style', 'japan')
    expect(draw('JP').textContent).toContain('landing permission')
    expect(draw('GB').querySelector('svg')).toHaveAttribute('data-style', 'uk')
    expect(draw('US').textContent).toContain('admitted')
  })
  it('anywhere else keeps a plain stamp with its name and date', () => {
    const el = draw('SG', { name: 'singapore' })
    expect(el.querySelector('svg')).toHaveAttribute('data-style', 'plain')
    expect(el.textContent).toContain('singapore')
    expect(el.textContent).toContain('28 jan 2027')
  })
  it('a long port name is cut short so it stays inside the stamp', () => {
    expect(draw('NL', { port: 'amsterdam airport schiphol international' }).textContent).toContain('amsterdam airport s…')
  })
})
