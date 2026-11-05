import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import './styles/tokens.css'
import './styles/base.css'
import './styles/ui.css'
import { App } from './App'
import { MAX_AGE, persister } from './lib/offline'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { gcTime: MAX_AGE, staleTime: 60_000, retry: 1, networkMode: 'offlineFirst' },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: MAX_AGE, buster: 'v1' }}>
      <App />
    </PersistQueryClientProvider>
  </StrictMode>,
)
