import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { trip, cost } from '../factories'

const db = vi.hoisted(() => ({ trips: [] as any[], costs: [] as any[], stops: [] as any[] }))
vi.mock('../../src/lib/queries', () => ({
  useTrips: () => ({ data: db.trips }),
  useCosts: () => ({ data: db.costs }),
  useStops: () => ({ data: db.stops }),
  useMembers: () => ({ data: [{ email: 's@x.com', user_id: 'u1', name: 'shanice', color: 0 }, { email: 'k@x.com', user_id: 'u2', name: 'kai', color: 1 }] }),
  useRates: () => ({ data: { date: '2026-11-04', rates: { SGD: 1.4398, GBP: 0.85 } } }),
  useSave: () => ({ mutateAsync: vi.fn(), mutate: vi.fn(), isPending: false }),
  useRemove: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('../../src/lib/offline', () => ({ useCanEdit: () => true, useOnline: () => true }))
vi.mock('../../src/lib/auth', () => ({ useAuth: () => ({ userId: 'u1', status: 'signed-in' }) }))

import { MoneyTab } from '../../src/features/money/MoneyTab'

const show = (t: any) => render(<MemoryRouter><MoneyTab trip={t} /></MemoryRouter>)

it('money tab totals in the display currency and shows left-out count', () => {
  const t = trip({ id: 'lap', currency: 'SGD' })
  db.trips = [t]
  db.costs = [cost({ trip_id: 'lap', amount: 100, currency: 'EUR' }), cost({ trip_id: 'lap', amount: 50, currency: 'MAD' })]
  show(t)
  expect(screen.getByTestId('money-total')).toHaveTextContent('S$144')
  expect(screen.getByText('in total')).toBeInTheDocument()
  expect(screen.getByText('ecb rates, 4 nov · 1 not converted')).toBeInTheDocument()
})

it('over budget shows the amber line', () => {
  const t = trip({ id: 'lap', currency: 'EUR', budget: 100 })
  db.trips = [t]
  db.costs = [cost({ trip_id: 'lap', amount: 120, currency: 'EUR' })]
  show(t)
  expect(screen.getByText('of €100 budget')).toBeInTheDocument()
  expect(screen.getByText('over by €20')).toHaveClass('warn-line')
})

it('settle up hidden without paid costs', () => {
  const t = trip({ id: 'lap' })
  db.trips = [t]
  db.costs = [cost({ trip_id: 'lap', amount: 40, status: 'estimate' })]
  show(t)
  expect(screen.queryByRole('heading', { name: 'settle up' })).toBeNull()
})

it('settle up says who owes whom, with you for me', () => {
  const t = trip({ id: 'lap', currency: 'EUR' })
  db.trips = [t]
  db.costs = [cost({ trip_id: 'lap', amount: 40, status: 'paid', paid_by: 'u2', split: 'even' })]
  show(t)
  expect(screen.getByRole('heading', { name: 'settle up' })).toBeInTheDocument()
  expect(screen.getByText('you owe kai €20')).toBeInTheDocument()
})

it('side trips are included and listed by trip', () => {
  const t = trip({ id: 'eu', name: 'europe', currency: 'EUR' })
  const k = trip({ id: 'lap', parent_id: 'eu', name: 'lapland' })
  db.trips = [t, k]
  db.costs = [cost({ trip_id: 'eu', amount: 10 }), cost({ trip_id: 'lap', amount: 30 })]
  show(t)
  expect(screen.getByTestId('money-total')).toHaveTextContent('€40')
  const rows = within(screen.getByRole('region', { name: 'by trip' })).getAllByRole('listitem').map((r) => r.textContent)
  expect(rows).toEqual(['europe€10', 'lapland€30'])
})
