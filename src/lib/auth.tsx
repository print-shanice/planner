import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import { SignIn } from '../features/auth/SignIn'
import { resumePersist } from './wipe'

type Status = 'loading' | 'signed-out' | 'signed-in' | 'asleep'
type AuthValue = {
  status: Status
  email: string | null
  userId: string | null
  signOut: () => Promise<void>
  markAsleep: () => void
}

const Ctx = createContext<AuthValue>({
  status: 'loading', email: null, userId: null, signOut: async () => {}, markAsleep: () => {},
})

export const useAuth = () => useContext(Ctx)

export function isNetworkError(e: unknown): boolean {
  return e instanceof TypeError && (typeof navigator === 'undefined' || navigator.onLine)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')
  const [user, setUser] = useState<{ id: string; email: string | null } | null>(null)
  const claimed = useRef(false)

  const accept = useCallback((session: { user: { id: string; email?: string | null } } | null) => {
    if (!session) { setUser(null); setStatus('signed-out'); return }
    resumePersist()
    setUser({ id: session.user.id, email: session.user.email ?? null })
    setStatus('signed-in')
    if (!claimed.current) {
      claimed.current = true
      Promise.resolve(supabase.rpc('claim_member')).catch(() => { claimed.current = false })
    }
  }, [])

  useEffect(() => {
    let alive = true
    supabase.auth.getSession()
      .then(({ data }) => { if (alive) accept(data.session) })
      .catch((e) => { if (alive) setStatus(isNetworkError(e) ? 'asleep' : 'signed-out') })
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'SIGNED_OUT') accept(session)
    })
    return () => { alive = false; data.subscription.unsubscribe() }
  }, [accept])

  const value = useMemo<AuthValue>(() => ({
    status,
    email: user?.email ?? null,
    userId: user?.id ?? null,
    signOut: async () => {
      // this device only; the default would sign out every phone and laptop too
      const { error } = await supabase.auth.signOut({ scope: 'local' })
      if (error) throw error
    },
    markAsleep: () => setStatus('asleep'),
  }), [status, user])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function Asleep() {
  return (
    <main className="center-screen">
      <h1 className="wordmark big">planner</h1>
      <p>the planner is asleep</p>
      <a className="btn ghost" href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer">open supabase</a>
    </main>
  )
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  if (status === 'loading') return null
  if (status === 'asleep') return <Asleep />
  if (status === 'signed-out') return <SignIn />
  return <>{children}</>
}
