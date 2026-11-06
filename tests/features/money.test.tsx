import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { trip, cost } from '../factories'

const db = vi.hoisted(() => ({ save: vi.fn(), trips: [] as any[], costs: [] as any[], stops: [] as any[], costsQ: null as null | Record<string, unknown> }))
vi.mock('../../src/lib/queries', () => ({
  useTrips: () => ({ data: db.trips }),
  useCosts: () => db.costsQ ?? ({ data: db.costs }),
  useStops: () => ({ data: db.stops }),
  useMembers: () => ({ data: [{ email: 's@x.com', user_id: 'u1', name: 'shanice', color: 0 }, { email: 'k@x.com', user_id: 'u2', name: 'kai', color: 1 }] }),
  useRates: () => ({ data: { date: '2026-11-04', rates: { SGD: 1.4398, GBP: 0.85 } } }),
  useSave: () => ({ mutateAsync: db.save, mutate: db.save, isPending: false }),
  useRemove: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('../../src/lib/offline', () => ({ useCanEdit: () => true, useOnline: () => true }))
vi.mock('../../src/lib/auth', () => ({ useAuth: () => ({ userId: 'u1', status: 'signed-in' }) }))

import { MoneyTab } from '../../src/features/money/MoneyTab'
import { CostForm } from '../../src/features/money/CostForm'
import userEvent from '@testing-library/user-event'
import { failSave, forgetPending } from '../../src/lib/pending'

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

const loading = { data: undefined, status: 'pending', fetchStatus: 'fetching' }

beforeEach(() => { db.costsQ = null })

it('costs still loading are not "no costs yet"', () => {
  const t = trip({ id: 'lap' })
  db.trips = [t]
  db.costsQ = loading
  show(t)
  expect(screen.getByRole('status', { name: 'loading' })).toBeInTheDocument()
  expect(screen.queryByText('no costs yet')).toBeNull()
  expect(screen.queryByTestId('money-total')).toBeNull()
})

afterEach(() => forgetPending())

it('a cost whose save failed says so', () => {
  const t = trip({ id: 'lap' })
  db.trips = [t]
  db.costs = [cost({ id: 'c7', trip_id: 'lap', title: 'sauna' })]
  failSave('costs', 'c7', { amount: 12 }, false)
  show(t)
  expect(within(screen.getByRole('region', { name: 'all costs' })).getByRole('alert')).toHaveTextContent("couldn't save")
})

it('saving a cost again after it failed sends the same new row, not a second one', async () => {
  db.save.mockReset().mockRejectedValueOnce(new Error('asleep')).mockResolvedValue({})
  render(<CostForm trip={trip({ id: 'lap' })} onDone={vi.fn()} />)
  await userEvent.type(screen.getByLabelText('name'), 'sauna')
  await userEvent.type(screen.getByLabelText('amount'), '80')
  await userEvent.click(screen.getByRole('button', { name: 'save' }))
  await userEvent.click(await screen.findByRole('button', { name: 'retry' }))
  const [a, b] = db.save.mock.calls.map((c) => c[0].id)
  expect(a).toEqual(expect.any(String))
  expect(b).toBe(a)
})

it('the cost form uses the same paid switch and keeps a new draft', async () => {
  db.save.mockReset().mockResolvedValue({})
  const t = trip({ id: 'lap' })
  const first = render(<CostForm trip={t} onDone={vi.fn()} />)
  expect(screen.queryByRole('group', { name: 'status' })).toBeNull()
  await userEvent.type(screen.getByLabelText('name'), 'sauna')
  first.unmount()
  render(<CostForm trip={t} onDone={vi.fn()} />)
  expect(screen.getByLabelText('name')).toHaveValue('sauna')
  await userEvent.type(screen.getByLabelText('amount'), '80')
  await userEvent.click(screen.getByRole('button', { name: 'paid' }))
  await userEvent.click(screen.getByRole('button', { name: 'save' }))
  expect(db.save).toHaveBeenCalledWith(expect.objectContaining({ title: 'sauna', amount: 80, status: 'paid', paid_by: 'u1' }))
})

it('editing a cost keeps no draft', async () => {
  render(<CostForm trip={trip({ id: 'lap' })} cost={cost({ id: 'c1', trip_id: 'lap', title: 'sauna' })} onDone={vi.fn()} />)
  await userEvent.type(screen.getByLabelText('name'), ' x')
  expect(localStorage.getItem('planner-drafts')).toBeNull()
})

it('in the cost form, paid or not paid sits right under the name', () => {
  render(<CostForm trip={trip({ id: 'lap' })} onDone={vi.fn()} />)
  const name = screen.getByLabelText('name')
  const payment = screen.getByRole('group', { name: 'payment' })
  const amount = screen.getByLabelText('amount')
  expect(name.compareDocumentPosition(payment) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(payment.compareDocumentPosition(amount) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})
