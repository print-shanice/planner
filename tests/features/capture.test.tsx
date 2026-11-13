import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { trip } from '../factories'

const db = vi.hoisted(() => ({ save: vi.fn(), links: [] as any[] }))
vi.mock('../../src/lib/queries', () => ({
  useTrips: () => ({ data: [trip({ id: 'eu', name: 'euro summer' })] }),
  useLinks: () => ({ data: db.links }),
  useStops: () => ({ data: [] }),
  useSave: () => ({ mutateAsync: db.save, mutate: db.save }),
}))
vi.mock('../../src/lib/offline', () => ({ useCanEdit: () => true, useOnline: () => true }))
import { CapturePage } from '../../src/features/capture/CapturePage'
import { keepPending, peekPending } from '../../src/lib/capture'

const show = (path: string) => render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/save" element={<CapturePage />} /><Route path="/" element={<p>home</p>} /></Routes></MemoryRouter>)

beforeEach(() => { db.save.mockReset().mockImplementation(async (r) => r); db.links = [] })

it('the shortcut\'s address fills the link; saving needs no date and says where it went', async () => {
  show(`/save?url=${encodeURIComponent('https://www.instagram.com/reel/C9x/?igsh=abc')}`)
  expect(screen.getByLabelText('link')).toHaveValue('https://www.instagram.com/reel/C9x/?igsh=abc')
  await userEvent.click(screen.getByRole('button', { name: 'save' }))
  expect(db.save).toHaveBeenCalledWith(expect.objectContaining({ trip_id: null, title: 'instagram' }))
  expect(await screen.findByRole('region', { name: 'saved' })).toHaveTextContent('in your inbox')
})

it('a link kept from before signing in is picked up, and forgotten once saved', async () => {
  keepPending({ url: '', title: 'cafe reel', text: 'so good https://vm.tiktok.com/ZM1/' })
  show('/save')
  expect(screen.getByLabelText('link')).toHaveValue('https://vm.tiktok.com/ZM1/')
  expect(screen.getByLabelText('title')).toHaveValue('cafe reel')
  await userEvent.selectOptions(screen.getByLabelText('trip'), 'eu')
  await userEvent.click(screen.getByRole('button', { name: 'save' }))
  expect(await screen.findByRole('link', { name: 'open euro summer →' })).toHaveAttribute('href', '/trip/eu?tab=links')
  expect(peekPending()).toBeNull()
})

it('a link with no preview still saves as the link itself', async () => {
  show(`/save?url=${encodeURIComponent('https://example.com/a-page')}`)
  await userEvent.click(screen.getByRole('button', { name: 'save' }))
  expect(db.save).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://example.com/a-page', title: 'example.com' }))
})
