import { HashRouter, Route, Routes } from 'react-router-dom'
import { AuthGate, AuthProvider } from './lib/auth'
import { RealtimeBridge } from './lib/realtime'

export function App() {
  return (
    <div className="app">
      <AuthProvider>
        <AuthGate>
          <RealtimeBridge />
          <HashRouter>
            <Routes>
              <Route path="*" element={<h1 className="wordmark">planner</h1>} />
            </Routes>
          </HashRouter>
        </AuthGate>
      </AuthProvider>
    </div>
  )
}

export default App
