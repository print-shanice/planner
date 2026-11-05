import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'

export function SignIn() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

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
        <div className="stack-sm center">
          <p>check your inbox</p>
          <p className="muted keep-case">{sent}</p>
        </div>
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
