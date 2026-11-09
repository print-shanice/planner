import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/Button'
import { peekPending } from '../../lib/capture'

export function SignIn() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'sending' | 'signing in' | false>(false)
  const [code, setCode] = useState('')

  // the emailed code works where the link can't: an iphone home-screen app keeps its own storage
  async function verify(e: FormEvent) {
    e.preventDefault()
    if (!sent) return
    const token = code.replace(/\s+/g, '')
    if (!token) return
    setBusy('signing in')
    setError(null)
    try {
      const { error } = await supabase.auth.verifyOtp({ email: sent, token, type: 'email' })
      // a code that worked stays "signing in…" until the planner opens in its place
      if (error) { setError("that code didn't work"); setBusy(false) }
    } catch {
      setError("couldn't sign in, try again")
      setBusy(false)
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const value = email.trim()
    if (!value) return
    setBusy('sending')
    setError(null)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: value,
        options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL, shouldCreateUser: false },
      })
      if (error) setError(/signup|not allowed|not found/i.test(error.message) ? "this email isn't on the planner" : "couldn't send, try again")
      else setSent(value)
    } catch {
      setError("couldn't send, try again")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="center-screen">
      <h1 className="wordmark big">planner</h1>
      {/* a shared link waits on this device, unsaved, until you're signed in */}
      {peekPending() && <p className="note-line">sign in to save your link</p>}
      {sent ? (
        <form className="signin" onSubmit={verify}>
          <div className="stack-sm center">
            <p>check your inbox</p>
            <p className="muted keep-case">{sent}</p>
          </div>
          <label className="field">
            <span className="label">code</span>
            <input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} />
          </label>
          <Button variant="primary" type="submit" busy={busy}>sign in</Button>
          {error && <p className="warn-line">{error}</p>}
        </form>
      ) : (
        <form className="signin" onSubmit={submit}>
          <label className="field">
            <span className="label">email</span>
            <input type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <Button variant="primary" type="submit" busy={busy}>send link</Button>
          {error && <p className="warn-line">{error}</p>}
        </form>
      )}
    </main>
  )
}
