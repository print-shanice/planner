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
import './styles/calendar.css'
import './styles/trip.css'
import './styles/plan.css'
import './styles/itinerary.css'
import './styles/map.css'
import './styles/tabs.css'
import './styles/paper.css'
import { App } from './App'
import { MAX_AGE, persister, queryDefaults } from './lib/offline'
import { keepPending, readShareParams } from './lib/capture'

// a shared link (android's share target lands on /planner/?url=…, the shortcut on #/save?url=…)
// is kept on this device before anything else, so signing in first doesn't lose it
const incoming = readShareParams(window.location.search, window.location.hash)
if (incoming) {
  keepPending(incoming)
  if (window.location.search) window.history.replaceState(null, '', `${window.location.pathname}#/save`)
}

const queryClient = new QueryClient({ defaultOptions: queryDefaults })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: MAX_AGE, buster: 'v1' }}>
      <App />
    </PersistQueryClientProvider>
  </StrictMode>,
)
