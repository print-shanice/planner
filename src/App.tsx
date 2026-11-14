import { HashRouter, Route, Routes } from 'react-router-dom'
import { AuthGate, AuthProvider } from './lib/auth'
import { RealtimeBridge } from './lib/realtime'
import { AsleepBanner } from './lib/asleep'
import { ToastProvider } from './components/Toast'
import { configProblem } from './lib/supabase'
import { ConfigProblem } from './features/auth/ConfigProblem'
import { HomePage } from './features/home/HomePage'
import { TripPage } from './features/trip/TripPage'
import { CapturePage } from './features/capture/CapturePage'
import { Crashed } from './components/Crashed'

export function App() {
  if (configProblem) return <div className="app"><ConfigProblem problem={configProblem} /></div>
  return (
    <div className="app">
      <Crashed>
      <AuthProvider>
        <AuthGate>
          <RealtimeBridge />
          <AsleepBanner />
          <ToastProvider>
            <HashRouter>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/trip/:id" element={<TripPage />} />
                <Route path="/save" element={<CapturePage />} />
                <Route path="*" element={<HomePage />} />
              </Routes>
            </HashRouter>
          </ToastProvider>
        </AuthGate>
      </AuthProvider>
      </Crashed>
    </div>
  )
}
