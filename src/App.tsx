import { HashRouter, Route, Routes } from 'react-router-dom'
import { AuthGate, AuthProvider } from './lib/auth'

export function App() {
  return (
    <div className="app">
      <AuthProvider>
        <AuthGate>
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
