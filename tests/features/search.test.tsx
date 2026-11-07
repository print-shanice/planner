import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { place } from '../factories'

const db = vi.hoisted(() => ({ search: vi.fn() }))
vi.mock('../../src/lib/photon', async (orig) => ({ ...(await orig<typeof import('../../src/lib/photon')>()), searchPlaces: db.search }))

import { AddPlaceField } from '../../src/features/plan/AddPlaceField'
import { PlaceField } from '../../src/features/stops/PlaceField'

function later<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => { resolve = r })
  return { promise, resolve }
}

const fields = {
  'map search': () => render(<AddPlaceField alwaysOpen label="search" onPick={() => {}} />),
  'a form\'s place field': () => render(<PlaceField id="loc" label="location" value={null} onChange={() => {}} />),
}

for (const [name, show] of Object.entries(fields)) {
  describe(`${name} says when it is searching`, () => {
    beforeEach(() => { db.search.mockReset() })

    it('"searching" shows as soon as you have typed enough, and stays until results come', async () => {
      const req = later<unknown[]>()
      db.search.mockReturnValue(req.promise)
      show()
      await userEvent.type(screen.getByRole('searchbox'), 'caf')
      expect(screen.getByRole('status')).toHaveTextContent('searching')
      await waitFor(() => expect(db.search).toHaveBeenCalled())
      expect(screen.getByRole('status')).toHaveTextContent('searching')
      await act(async () => { req.resolve([place({ name: 'cafe central' })]) })
      expect(screen.queryByText('searching')).toBeNull()
      expect(screen.getByRole('button', { name: /cafe central/ })).toBeInTheDocument()
    })

    it('a slow search never says "nothing found" while it is still looking', async () => {
      const req = later<unknown[]>()
      db.search.mockReturnValue(req.promise)
      show()
      await userEvent.type(screen.getByRole('searchbox'), 'zzz{Enter}')
      expect(screen.queryByText('nothing found')).toBeNull()
      await act(async () => { req.resolve([]) })
      expect(screen.getByText('nothing found')).toBeInTheDocument()
    })

    it('two letters and no enter is not a search yet', async () => {
      show()
      await userEvent.type(screen.getByRole('searchbox'), 'ca')
      expect(screen.queryByText('searching')).toBeNull()
    })
  })
}
