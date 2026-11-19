import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { usePlacePhoto } from '../../src/lib/placePhoto'
import { useDetails } from '../../src/lib/google/details'

// answers kept on the phone from before links were checked still never become links
function withKept(seed: (q: QueryClient) => void) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  seed(client)
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

it('a kept photo whose credit isn\'t a web link shows no credit link', () => {
  const wrapper = withKept((q) => q.setQueryData<object>(['openverse', 'cafe', null], { src: 'https://x/t.jpg', page: 'javascript:alert(1)', source: 'flickr' }))
  const { result } = renderHook(() => usePlacePhoto({ name: 'cafe' } as never), { wrapper })
  expect(result.current.credit).toBeNull()
})

it('kept google details only give web links', () => {
  const wrapper = withKept((q) => q.setQueryData<object>(['gplace', 'g1'], { rating: null, ratings: null, kind: null, weekdays: null, website: 'javascript:alert(1)', maps: 'https://maps.google.com/?cid=1' }))
  const { result } = renderHook(() => useDetails('g1'), { wrapper })
  expect(result.current.data).toMatchObject({ website: null, maps: 'https://maps.google.com/?cid=1' })
})
