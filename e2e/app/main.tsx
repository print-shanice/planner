// the real app, on made-up data: the same screens as the live planner, with supabase and google maps stood in for
import './fake-google'
import './fake-rates'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@fontsource-variable/bricolage-grotesque/opsz.css'
import '@fontsource-variable/hanken-grotesk/index.css'
import '../../src/styles/tokens.css'
import '../../src/styles/base.css'
import '../../src/styles/ui.css'
import '../../src/styles/home.css'
import '../../src/styles/calendar.css'
import '../../src/styles/trip.css'
import '../../src/styles/plan.css'
import '../../src/styles/itinerary.css'
import '../../src/styles/map.css'
import '../../src/styles/tabs.css'
import '../../src/styles/paper.css'
import { App } from '../../src/App'
import { queryDefaults } from '../../src/lib/offline'

const q = new QueryClient({ defaultOptions: queryDefaults })
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={q}><App /></QueryClientProvider>)
