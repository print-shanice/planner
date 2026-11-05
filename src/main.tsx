import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import '@fontsource-variable/bricolage-grotesque/opsz.css'
import '@fontsource-variable/hanken-grotesk/index.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/ui.css'
import './styles/home.css'
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
