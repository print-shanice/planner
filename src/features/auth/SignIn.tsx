import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'

export function SignIn() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [code, setCode] = useState('')

  // the emailed code works where the link can't: an iphone home-screen app keeps its own storage
  async function verify(e: FormEvent) {
    e.preventDefault()
    if (!sent) return
    const token = code.replace(/\s+/g, '')
    if (!token) return
    setBusy(true)
    setError(null)
    try {
      const { error } = await supabase.auth.verifyOtp({ email: sent, token, type: 'email' })
      if (error) setError("that code didn't work")
    } catch {
      setError("couldn't sign in, try again")
    } finally {
      setBusy(false)
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const value = email.trim()
    if (!value) return
    setBusy(true)
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
          <button className="btn primary" type="submit" disabled={busy}>sign in</button>
          {error && <p className="warn-line">{error}</p>}
        </form>
      ) : (
        <form className="signin" onSubmit={submit}>
          <label className="field">
            <span className="label">email</span>
            <input type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <button className="btn primary" type="submit" disabled={busy}>send link</button>
          {error && <p className="warn-line">{error}</p>}
        </form>
      )}
    </main>
  )
}
