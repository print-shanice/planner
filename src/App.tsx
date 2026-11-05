import { HashRouter, Route, Routes } from 'react-router-dom'
import { AuthGate, AuthProvider } from './lib/auth'
import { RealtimeBridge } from './lib/realtime'
import { HomePage } from './features/home/HomePage'
import { TripPage } from './features/trip/TripPage'

export function App() {
  return (
    <div className="app">
      <AuthProvider>
        <AuthGate>
          <RealtimeBridge />
          <HashRouter>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/trip/:id" element={<TripPage />} />
              <Route path="*" element={<HomePage />} />
            </Routes>
          </HashRouter>
        </AuthGate>
      </AuthProvider>
    </div>
  )
}

export default App
