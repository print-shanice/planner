const sb = vi.hoisted(() => ({ download: vi.fn() }))
vi.mock('../../src/lib/supabase', () => ({ supabase: { storage: { from: () => ({ download: sb.download }) } } }))

import { getTicket, putTicket, openTicket, clearTickets, ticketType } from '../../src/lib/ticketCache'

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

describe('only pdfs and plain photos open as themselves', () => {
  it('keeps pdfs and photos, and turns anything that could run code into a plain download', () => {
    for (const t of ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'IMAGE/JPEG; charset=x'])
      expect(ticketType(t)).not.toBe('application/octet-stream')
    for (const t of ['image/svg+xml', 'text/html', 'application/xhtml+xml', 'text/xml', 'application/javascript', '', undefined])
      expect(ticketType(t)).toBe('application/octet-stream')
  })

  it('a ticket saved as an svg or a web page opens as a download, whatever the server or row says it is', async () => {
    const made = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x')
    sb.download.mockResolvedValue({ data: new Blob(['<svg onload="alert(1)"/>'], { type: 'image/svg+xml' }), error: null })
    await openTicket({ ...file('s1'), name: 'pass.svg', mime: 'image/svg+xml' })
    expect((made.mock.calls[0][0] as Blob).type).toBe('application/octet-stream')
    sb.download.mockResolvedValue({ data: new Blob(['<script>'], { type: 'text/html' }), error: null })
    await openTicket(file('s2'))
    expect((made.mock.calls[1][0] as Blob).type).toBe('application/octet-stream')
    sb.download.mockResolvedValue({ data: new Blob(['%PDF'], { type: 'application/pdf' }), error: null })
    await openTicket(file('s3'))
    expect((made.mock.calls[2][0] as Blob).type).toBe('application/pdf')
    made.mockRestore()
  })
})
