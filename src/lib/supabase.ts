import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL || 'http://localhost:54321'
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || 'anon-key-missing'

export const supabase = createClient(url, key, {
  auth: { flowType: 'pkce', persistSession: true, detectSessionInUrl: true, autoRefreshToken: true },
})
