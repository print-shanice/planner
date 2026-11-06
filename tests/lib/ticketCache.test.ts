const sb = vi.hoisted(() => ({ download: vi.fn() }))
vi.mock('../../src/lib/supabase', () => ({ supabase: { storage: { from: () => ({ download: sb.download }) } } }))

import { getTicket, putTicket, openTicket, clearTickets } from '../../src/lib/ticketCache'

const file = (id: string) => ({ id, stop_id: 's1', path: `t/s1/${id}.pdf`, name: `${id}.pdf`, mime: 'application/pdf' })
const setOnline = (v: boolean) => Object.defineProperty(navigator, 'onLine', { value: v, configurable: true })

beforeAll(() => { URL.createObjectURL ??= (() => 'blob:x') as typeof URL.createObjectURL })
beforeEach(() => { sb.download.mockReset(); setOnline(true) })
afterAll(() => setOnline(true))

const text = (b: Blob) => new Promise<string>((r) => { const f = new FileReader(); f.onload = () => r(String(f.result)); f.readAsText(b) })

it('stores and returns a ticket blob', async () => {
  await putTicket('f1', new Blob(['hello'], { type: 'text/plain' }))
  const b = await getTicket('f1')
  expect(b).not.toBeNull()
  expect(await text(b!)).toBe('hello')
  expect(await getTicket('nope')).toBeNull()
})

it('online fetches the file and keeps a copy', async () => {
  sb.download.mockResolvedValue({ data: new Blob(['pdf']), error: null })
  const url = await openTicket(file('f2'))
  expect(sb.download).toHaveBeenCalledWith('t/s1/f2.pdf')
  expect(typeof url).toBe('string')
  expect(await text((await getTicket('f2'))!)).toBe('pdf')
})

it('offline uses the stored blob without fetching', async () => {
  await putTicket('f3', new Blob(['saved']))
  setOnline(false)
  await openTicket(file('f3'))
  expect(sb.download).not.toHaveBeenCalled()
})

it('offline without a stored blob throws not saved offline', async () => {
  setOnline(false)
  await expect(openTicket(file('f4'))).rejects.toThrow('not saved offline')
})

it('a failed download falls back to the stored copy', async () => {
  await putTicket('f5', new Blob(['old']))
  sb.download.mockResolvedValue({ data: null, error: new Error('503') })
  await expect(openTicket(file('f5'))).resolves.toBeTypeOf('string')
})

it('clearTickets forgets every saved ticket', async () => {
  await putTicket('f9', new Blob(['x'], { type: 'text/plain' }))
  await clearTickets()
  expect(await getTicket('f9')).toBeNull()
})
