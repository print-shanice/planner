import { render, screen, waitFor } from '@testing-library/react'
import { forgetGuesses, useTripFlags, type Lookup } from '../../src/lib/tripGuess'
import { place, trip } from '../factories'
import type { Trip } from '../../src/lib/types'

const hit = (name: string, cc: string) => ({ features: [{ properties: { name, countrycode: cc, type: 'city' } }] })
function Probe({ trips, lookup }: { trips: Trip[]; lookup: Lookup }) {
  const flagsOf = useTripFlags(trips, [], lookup)
  return <ul>{trips.map((t) => <li key={t.id} data-testid={t.id}>{flagsOf(t).join(' ')}</li>)}</ul>
}

describe('useTripFlags', () => {
  beforeEach(() => { localStorage.clear(); forgetGuesses() })

  it('looks up a trip with no country by its name, once, and remembers the answer on this device', async () => {
    const lookup = vi.fn<Lookup>((part) => Promise.resolve(part === 'amsterdam' ? hit('Amsterdam', 'nl') : { features: [] }))
    const trips = [trip({ id: 'ams', name: 'amsterdam', base: null }), trip({ id: 'loop', name: 'the rail loop', base: null }), trip({ id: 'lap', name: 'lapland', base: place({ country: 'FI' }) })]
    const first = render(<Probe trips={trips} lookup={lookup} />)
    await waitFor(() => expect(screen.getByTestId('ams')).toHaveTextContent('NL'))
    expect(screen.getByTestId('loop')).toHaveTextContent('')
    expect(screen.getByTestId('lap')).toHaveTextContent('FI')
    // a trip that already has a country is never looked up
    expect(lookup.mock.calls.map((c) => c[0]).sort()).toEqual(['amsterdam', 'the rail loop'])
    first.unmount()
    forgetGuesses()
    render(<Probe trips={trips} lookup={lookup} />)
    expect(screen.getByTestId('ams')).toHaveTextContent('NL')
    expect(lookup).toHaveBeenCalledTimes(2)
  })

  it('a failed lookup shows no flag and is tried again later', async () => {
    const lookup = vi.fn<Lookup>(() => Promise.reject(new Error('offline')))
    const trips = [trip({ id: 'ams', name: 'amsterdam', base: null })]
    const first = render(<Probe trips={trips} lookup={lookup} />)
    await waitFor(() => expect(lookup).toHaveBeenCalledTimes(1))
    expect(screen.getByTestId('ams')).toHaveTextContent('')
    first.unmount()
    render(<Probe trips={trips} lookup={() => Promise.resolve(hit('Amsterdam', 'nl'))} />)
    await waitFor(() => expect(screen.getByTestId('ams')).toHaveTextContent('NL'))
  })
})
