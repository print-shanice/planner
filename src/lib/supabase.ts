import { createClient } from '@supabase/supabase-js'
import { configProblem as check, projectOrigin } from './config'

const env = import.meta.env
export const configProblem = check(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)

// with a bad setup, never hand a secret key to the client; the app shows what to fix instead
const ok = configProblem === null
export const supabase = createClient(
  ok ? projectOrigin(env.VITE_SUPABASE_URL) : 'http://localhost:54321',
  ok ? env.VITE_SUPABASE_ANON_KEY.trim() : 'not-configured',
  { auth: { flowType: 'pkce', persistSession: true, detectSessionInUrl: true, autoRefreshToken: true } },
)
