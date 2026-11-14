import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { trip, cost } from '../factories'

const TWO = [{ email: 's@x.com', user_id: 'u1', name: 'shanice', color: 0 }, { email: 'k@x.com', user_id: 'u2', name: 'kai', color: 1 }]
const db = vi.hoisted(() => ({ members: null as null | unknown[], ratesQ: null as null | Record<string, unknown>, save: vi.fn(), trips: [] as any[], costs: [] as any[], stops: [] as any[], costsQ: null as null | Record<string, unknown> }))
vi.mock('../../src/lib/queries', () => ({
  useTrips: () => ({ data: db.trips }),
  useCosts: () => db.costsQ ?? ({ data: db.costs }),
  useLinks: () => ({ data: [] }),
  useStops: () => ({ data: db.stops }),
  useMembers: () => ({ data: db.members ?? TWO }),
  useRates: () => db.ratesQ ?? ({ data: { date: '2026-11-04', rates: { SGD: 1.4398, GBP: 0.85 } } }),
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
  // no rates footnote; only what's left out is said
  expect(screen.queryByText(/ecb rates/)).toBeNull()
  expect(screen.getByText('1 not converted')).toBeInTheDocument()
})

it('over budget shows the amber line', () => {
  const t = trip({ id: 'lap', currency: 'EUR', budget: 100 })
  db.trips = [t]
  db.costs = [cost({ trip_id: 'lap', amount: 120, currency: 'EUR' })]
  show(t)
  expect(screen.getByText('of €100')).toBeInTheDocument()
  expect(screen.getByText('€20 over budget')).toHaveClass('warn-line')
})

it('settle up hidden without paid costs', () => {
  const t = trip({ id: 'lap' })
  db.trips = [t]
  db.costs = [cost({ trip_id: 'lap', amount: 40, status: 'estimate' })]
  show(t)
  expect(screen.queryByRole('region', { name: 'settle up' })).toBeNull()
})

it('settle up says who owes whom, with you for me', () => {
  const t = trip({ id: 'lap', currency: 'EUR' })
  db.trips = [t]
  db.costs = [cost({ trip_id: 'lap', amount: 40, status: 'paid', paid_by: 'u2', split: 'even' })]
  show(t)
  expect(within(screen.getByRole('region', { name: 'settle up' })).getByText('you owe kai €20.00')).toBeInTheDocument()
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

beforeEach(() => { db.costsQ = null; db.members = null })

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
  await userEvent.click(screen.getByRole('switch', { name: 'paid already' }))
  await userEvent.click(screen.getByRole('button', { name: 'save' }))
  expect(db.save).toHaveBeenCalledWith(expect.objectContaining({ title: 'sauna', amount: 80, status: 'paid', paid_by: 'u1' }))
})

it('a new cost with something typed can be cleared; editing a cost has no clear', async () => {
  const t = trip({ id: 'lap' })
  const first = render(<CostForm trip={t} onDone={vi.fn()} />)
  expect(screen.queryByRole('button', { name: 'clear' })).toBeNull()
  await userEvent.type(screen.getByLabelText('name'), 'sauna')
  await userEvent.click(screen.getByRole('button', { name: 'clear' }))
  expect(screen.getByLabelText('name')).toHaveValue('')
  expect(localStorage.getItem('planner-drafts')).toBeNull()
  first.unmount()
  render(<CostForm trip={t} cost={cost({ id: 'c1', trip_id: 'lap', title: 'sauna' })} onDone={vi.fn()} />)
  await userEvent.type(screen.getByLabelText('name'), ' x')
  expect(screen.queryByRole('button', { name: 'clear' })).toBeNull()
})

it('editing a cost keeps no draft', async () => {
  render(<CostForm trip={trip({ id: 'lap' })} cost={cost({ id: 'c1', trip_id: 'lap', title: 'sauna' })} onDone={vi.fn()} />)
  await userEvent.type(screen.getByLabelText('name'), ' x')
  expect(localStorage.getItem('planner-drafts')).toBeNull()
})

it('the cost form asks how much first, then paid, then what it was for', () => {
  render(<CostForm trip={trip({ id: 'lap' })} onDone={vi.fn()} />)
  const amount = screen.getByLabelText('amount')
  const paid = screen.getByRole('switch', { name: 'paid already' })
  const name = screen.getByLabelText('name')
  expect(amount).toHaveFocus()
  expect(amount.compareDocumentPosition(paid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(paid.compareDocumentPosition(name) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

it('the budget line says what is left', () => {
  const t = trip({ id: 'lap', currency: 'EUR', budget: 100 })
  db.trips = [t]
  db.costs = [cost({ trip_id: 'lap', amount: 40 })]
  show(t)
  expect(screen.getByText('of €100 · €60 left')).toBeInTheDocument()
})

it('with side trips, a switch says whether the total includes them', async () => {
  const t = trip({ id: 'eu', name: 'europe', currency: 'EUR' })
  db.trips = [t, trip({ id: 'lap', parent_id: 'eu', name: 'lapland' })]
  db.costs = [cost({ trip_id: 'eu', amount: 10 }), cost({ trip_id: 'lap', amount: 30 })]
  show(t)
  const scope = within(screen.getByRole('group', { name: 'covers' }))
  expect(scope.getAllByRole('button').map((b) => b.textContent)).toEqual(['this trip', 'with side trips'])
  expect(scope.getByRole('button', { name: 'with side trips' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByTestId('money-total')).toHaveTextContent('€40')
  await userEvent.click(scope.getByRole('button', { name: 'this trip' }))
  expect(screen.getByTestId('money-total')).toHaveTextContent('€10')
  expect(screen.queryByRole('region', { name: 'by trip' })).toBeNull()
})

it('a trip without side trips has no switch', () => {
  const t = trip({ id: 'solo' })
  db.trips = [t]
  db.costs = [cost({ trip_id: 'solo', amount: 10 })]
  show(t)
  expect(screen.queryByRole('group', { name: 'covers' })).toBeNull()
})

it('settle-up sits near the top, before the breakdowns', () => {
  const t = trip({ id: 'lap', currency: 'EUR' })
  db.trips = [t]
  db.costs = [cost({ trip_id: 'lap', amount: 40, status: 'paid', paid_by: 'u2', split: 'even' })]
  show(t)
  const settle = screen.getByRole('region', { name: 'settle up' })
  const cats = screen.getByRole('region', { name: 'by category' })
  expect(settle.compareDocumentPosition(cats) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

it('an even split everyone has paid is all square', () => {
  const t = trip({ id: 'lap', currency: 'EUR' })
  db.trips = [t]
  db.costs = [cost({ trip_id: 'lap', amount: 40, status: 'paid', paid_by: 'u2', split: 'even' }), cost({ trip_id: 'lap', amount: 40, status: 'paid', paid_by: 'u1', split: 'even' })]
  show(t)
  expect(within(screen.getByRole('region', { name: 'settle up' })).getByText('settled')).toHaveClass('ok')
})

it('totals round to whole amounts; a single cost keeps its own', () => {
  const t = trip({ id: 'lap', currency: 'EUR' })
  db.trips = [t]
  db.costs = [cost({ trip_id: 'lap', title: 'sim card', amount: 23.98, currency: 'EUR' })]
  show(t)
  expect(screen.getByTestId('money-total')).toHaveTextContent(/^€24$/)
  expect(within(screen.getByRole('region', { name: 'by category' })).getByText('€24')).toBeInTheDocument()
  expect(within(screen.getByRole('region', { name: 'all costs' })).getByText('€23.98')).toBeInTheDocument()
})

it('while exchange rates load, money says so instead of leaving costs out', () => {
  db.ratesQ = { data: undefined, isLoading: true, status: 'pending', fetchStatus: 'fetching' }
  const t = trip({ id: 'lap', currency: 'EUR' })
  db.trips = [t]
  db.costs = [cost({ trip_id: 'lap', amount: 20, currency: 'GBP' })]
  show(t)
  db.ratesQ = null
  expect(screen.getByRole('status')).toHaveTextContent('loading rates')
})

describe('splitting', () => {
  const form = (id: string) => {
    const t = trip({ id, currency: 'EUR' })
    db.trips = [t]
    db.save.mockReset().mockResolvedValue({})
    render(<MemoryRouter><CostForm trip={t} onDone={() => {}} /></MemoryRouter>)
  }
  const fill = async () => {
    await userEvent.type(screen.getByLabelText('amount'), '90')
    await userEvent.type(screen.getByRole('textbox', { name: 'name' }), 'dinner')
  }
  const forBox = () => within(screen.getByRole('group', { name: 'split' }))

  it('everyone is the people in the trip now, written down', async () => {
    form('split-all')
    await fill()
    await userEvent.click(screen.getByRole('button', { name: 'save' }))
    expect(db.save).toHaveBeenCalledWith(expect.objectContaining({ split: 'even', split_among: ['u1', 'u2'], split_amounts: null }))
  })

  it('some people: only the ones ticked share it', async () => {
    form('split-some')
    await fill()
    await userEvent.click(forBox().getByRole('button', { name: 'some people' }))
    await userEvent.click(screen.getByRole('button', { name: 'save' }))
    expect(screen.getByText("pick who it's for")).toBeInTheDocument()
    expect(db.save).not.toHaveBeenCalled()
    await userEvent.click(forBox().getByRole('button', { name: 'for kai' }))
    expect(forBox().getByRole('button', { name: 'for kai' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'save' }))
    expect(db.save).toHaveBeenCalledWith(expect.objectContaining({ split: 'u2', split_among: ['u2'], split_amounts: null }))
  })

  it('exact amounts must add up to the cost', async () => {
    form('split-exact')
    await fill()
    await userEvent.click(forBox().getByRole('button', { name: 'amounts' }))
    await userEvent.type(forBox().getByLabelText("shanice's share"), '30')
    await userEvent.type(forBox().getByLabelText("kai's share"), '50')
    await userEvent.click(screen.getByRole('button', { name: 'save' }))
    expect(screen.getByText("doesn't add up")).toBeInTheDocument()
    expect(db.save).not.toHaveBeenCalled()
    await userEvent.clear(forBox().getByLabelText("kai's share"))
    await userEvent.type(forBox().getByLabelText("kai's share"), '60')
    await userEvent.click(screen.getByRole('button', { name: 'save' }))
    expect(db.save).toHaveBeenCalledWith(expect.objectContaining({ split: 'even', split_among: ['u1', 'u2'], split_amounts: { u1: 30, u2: 60 } }))
  })

  it('an older cost for one person opens as "some people" with them ticked', async () => {
    const t = trip({ id: 'split-old', currency: 'EUR' })
    db.trips = [t]
    render(<MemoryRouter><CostForm trip={t} cost={cost({ trip_id: 'split-old', amount: 30, split: 'u2' })} onDone={() => {}} /></MemoryRouter>)
    expect(forBox().getByRole('button', { name: 'some people' })).toHaveAttribute('aria-pressed', 'true')
    expect(forBox().getByRole('button', { name: 'for kai' })).toHaveAttribute('aria-pressed', 'true')
    expect(forBox().getByRole('button', { name: 'for shanice' })).toHaveAttribute('aria-pressed', 'false')
  })
})

describe('settling up', () => {
  it('with three or more people, it shows where each person stands', () => {
    db.members = [...TWO, { email: 'j@x.com', user_id: 'u3', name: 'jo', color: 2 }]
    const t = trip({ id: 'lap', currency: 'EUR' })
    db.trips = [t]
    db.costs = [cost({ trip_id: 'lap', amount: 90, status: 'paid', paid_by: 'u2', split_among: ['u1', 'u2', 'u3'] })]
    show(t)
    const box = within(screen.getByRole('region', { name: 'settle up' }))
    expect(box.getByRole('listitem', { name: 'kai · owed €60.00' })).toBeInTheDocument()
    expect(box.getByRole('listitem', { name: 'you · owe €30.00' })).toBeInTheDocument()
    expect(box.getByRole('listitem', { name: 'jo · owes €30.00' })).toBeInTheDocument()
    db.members = null
  })

  it('who pays whom, with a paid back button', async () => {
    const t = trip({ id: 'lap', currency: 'EUR' })
    db.trips = [t]
    db.save.mockReset().mockResolvedValue({})
    db.costs = [cost({ trip_id: 'lap', amount: 40, status: 'paid', paid_by: 'u2', split: 'even', split_among: ['u1', 'u2'] })]
    show(t)
    const box = within(screen.getByRole('region', { name: 'settle up' }))
    await userEvent.click(box.getByRole('button', { name: 'paid back: you owe kai €20.00' }))
    expect(db.save).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'confirm repayment' }))
    expect(db.save).toHaveBeenCalledWith(expect.objectContaining({
      trip_id: 'lap', stop_id: null, category: 'repayment', status: 'paid', paid_by: 'u1', split: 'u2', split_among: ['u2'],
      split_amounts: null, amount: 20, currency: 'EUR',
    }))
  })

  it("a pay-back isn't spending and squares up; the list says who paid whom back", () => {
    const t = trip({ id: 'lap', currency: 'EUR' })
    db.trips = [t]
    db.costs = [
      cost({ trip_id: 'lap', amount: 40, status: 'paid', paid_by: 'u2', split_among: ['u1', 'u2'] }),
      cost({ trip_id: 'lap', amount: 20, currency: 'EUR', status: 'paid', paid_by: 'u1', split: 'u2', split_among: ['u2'], category: 'repayment', date: '2027-02-10' }),
    ]
    show(t)
    expect(screen.getByTestId('money-total')).toHaveTextContent(/^€40$/)
    expect(within(screen.getByRole('region', { name: 'settle up' })).getByText('settled')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'all costs' })).getByText('you paid kai back')).toBeInTheDocument()
  })

  it('settle-up covers the whole trip, side trips and parent alike, and pay-backs go on the top trip', async () => {
    const eu = trip({ id: 'eu', currency: 'EUR' })
    const paris = trip({ id: 'paris', parent_id: 'eu', currency: 'EUR' })
    db.trips = [eu, paris]
    db.save.mockReset().mockResolvedValue({})
    db.costs = [cost({ trip_id: 'eu', amount: 40, status: 'paid', paid_by: 'u2', split_among: ['u1', 'u2'] })]
    show(paris)
    const box = within(screen.getByRole('region', { name: 'settle up' }))
    expect(box.getByText('you owe kai €20.00')).toBeInTheDocument()
    await userEvent.click(box.getByRole('button', { name: 'paid back: you owe kai €20.00' }))
    expect(db.save).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'confirm repayment' }))
    expect(db.save).toHaveBeenCalledWith(expect.objectContaining({ trip_id: 'eu', category: 'repayment' }))
  })
})

it('settlement identifies the parent scope and keeps exact cents', () => {
  const parent = trip({id: 'parent', name: 'Europe summer'})
  const child = trip({id: 'child', parent_id: 'parent', name: 'Lisbon'})
  db.trips = [parent, child]
  db.costs = [cost({trip_id: 'parent', amount: 49.50, status: 'paid', paid_by: 'u2', split: 'even'})]
  show(child)
  expect(screen.getByText('you owe kai €24.75')).toBeInTheDocument()
  expect(screen.getByText('Europe summer · with side trips')).toBeInTheDocument()
})

describe('money at a glance', () => {
  it('each person has a balance bar: what they paid, their share, and how far up or down they are', () => {
    const t = trip({ id: 'lap', currency: 'EUR' })
    db.trips = [t]
    db.costs = [cost({ trip_id: 'lap', amount: 40, status: 'paid', paid_by: 'u2', split: 'even', split_among: ['u1', 'u2'] })]
    show(t)
    const box = within(screen.getByRole('region', { name: 'settle up' }))
    const kai = box.getByRole('listitem', { name: 'kai · owed €20.00' })
    expect(within(kai).getByText('paid €40 · share €20')).toBeInTheDocument()
    expect(within(kai).getByText('+€20.00')).toBeInTheDocument()
    expect(kai.querySelector('.bal-bar.up')).toHaveStyle({ width: '100%' })
    const me = box.getByRole('listitem', { name: 'you · owe €20.00' })
    expect(within(me).getByText('−€20.00')).toBeInTheDocument()
    expect(me.querySelector('.bal-bar.down')).toHaveStyle({ width: '100%' })
  })

  it('someone who is square has no bar and says so', () => {
    db.members = [...TWO, { email: 'j@x.com', user_id: 'u3', name: 'jo', color: 2 }]
    const t = trip({ id: 'lap', currency: 'EUR' })
    db.trips = [t]
    db.costs = [cost({ trip_id: 'lap', amount: 40, status: 'paid', paid_by: 'u2', split_among: ['u1', 'u2'] })]
    show(t)
    const jo = within(screen.getByRole('region', { name: 'settle up' })).getByRole('listitem', { name: 'jo · settled' })
    expect(jo.querySelector('.bal-bar')).toBeNull()
    db.members = null
  })

  it('categories are bars, the biggest first and full width', () => {
    const t = trip({ id: 'lap', currency: 'EUR' })
    db.trips = [t]
    db.costs = [cost({ trip_id: 'lap', amount: 50, category: 'food' }), cost({ trip_id: 'lap', amount: 200, category: 'stay' })]
    show(t)
    const rows = within(screen.getByRole('region', { name: 'by category' })).getAllByRole('listitem')
    expect(rows.map((r) => r.querySelector('.share-bar')?.getAttribute('style'))).toEqual(['width: 100%;', 'width: 25%;'])
    expect(rows[0]).toHaveTextContent('€200')
  })
})

describe('adding a cost right in money', () => {
  const t = trip({ id: 'lap', currency: 'EUR' })
  beforeEach(() => { db.trips = [t]; db.costs = []; db.stops = []; db.members = null; db.ratesQ = null; db.costsQ = null; db.save.mockReset().mockResolvedValue({}) })

  it('a name and an amount save an estimate in the trip\'s currency, shared by everyone', async () => {
    show(t)
    await userEvent.type(screen.getByRole('textbox', { name: 'add a cost' }), 'sauna')
    await userEvent.type(screen.getByRole('textbox', { name: 'amount' }), '24,50')
    await userEvent.click(screen.getByRole('button', { name: 'add cost' }))
    expect(db.save).toHaveBeenCalledWith(expect.objectContaining({
      trip_id: 'lap', stop_id: null, title: 'sauna', amount: 24.5, currency: 'EUR', status: 'estimate', paid_by: null, split_among: ['u1', 'u2'], date: null,
    }))
    expect(screen.getByRole('textbox', { name: 'add a cost' })).toHaveValue('')
    expect(screen.getByRole('textbox', { name: 'amount' })).toHaveValue('')
  })

  it('a trip in a currency without a rate still saves in that currency', async () => {
    const mad = trip({ id: 'mar', currency: 'MAD' })
    db.trips = [mad]
    show(mad)
    await userEvent.type(screen.getByRole('textbox', { name: 'add a cost' }), 'riad')
    await userEvent.type(screen.getByRole('textbox', { name: 'amount' }), '300{Enter}')
    expect(db.save).toHaveBeenCalledWith(expect.objectContaining({ title: 'riad', amount: 300, currency: 'MAD' }))
  })

  it('the currency is picked like the "show in" one above, starting on the trip\'s; the line reads like links', async () => {
    show(t)
    const cur = screen.getByRole('combobox', { name: 'currency' })
    expect(cur).toHaveDisplayValue('eur')
    expect(cur).toHaveClass('cur-select')
    // the same typing line as links: underlined fields, apart from each other, and a plain "add"
    expect(screen.getByRole('textbox', { name: 'add a cost' }).closest('form')).toHaveClass('jot', 'cost-line')
    expect(screen.getByRole('textbox', { name: 'add a cost' })).not.toHaveClass('input')
    expect(screen.getByRole('textbox', { name: 'amount' })).not.toHaveClass('input')
    await userEvent.selectOptions(cur, 'GBP')
    await userEvent.type(screen.getByRole('textbox', { name: 'add a cost' }), 'tea')
    await userEvent.type(screen.getByRole('textbox', { name: 'amount' }), '4{Enter}')
    expect(db.save).toHaveBeenCalledWith(expect.objectContaining({ title: 'tea', amount: 4, currency: 'GBP' }))
    expect(cur).toHaveDisplayValue('gbp')
  })

  it('a missing or wrong amount says so and saves nothing', async () => {
    show(t)
    await userEvent.type(screen.getByRole('textbox', { name: 'add a cost' }), 'sauna{Enter}')
    expect(screen.getByRole('alert')).toHaveTextContent('check the amount')
    await userEvent.type(screen.getByRole('textbox', { name: 'amount' }), 'abc{Enter}')
    expect(screen.getByRole('alert')).toHaveTextContent('check the amount')
    expect(db.save).not.toHaveBeenCalled()
  })
})

it('with every cost converted there is no footnote at all', () => {
  const t = trip({ id: 'lap', currency: 'EUR' })
  db.trips = [t]
  db.costs = [cost({ trip_id: 'lap', amount: 10, currency: 'EUR' })]
  db.ratesQ = null
  show(t)
  expect(screen.queryByText(/ecb rates|not converted/)).toBeNull()
})
