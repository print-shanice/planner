// deploy: npx supabase functions deploy flight --no-verify-jwt --project-ref <ref>
// secret: npx supabase secrets set AERODATABOX_KEY=<rapidapi key> --project-ref <ref>
// (the session is checked here, by getUser and is_member, rather than by the gateway)
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import { handle, type Db } from './handler.ts'
import type { Flight } from './shape.ts'

const url = Deno.env.get('SUPABASE_URL')!
const anon = Deno.env.get('SUPABASE_ANON_KEY')!
const key = Deno.env.get('AERODATABOX_KEY') ?? ''

function db(authorization: string): Db {
  // acting as the person who asked, so row-level security applies to every read and write
  const client = createClient(url, anon, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return {
    who: async () => {
      const { data } = await client.auth.getUser(authorization.replace(/^Bearer\s+/i, ''))
      if (!data.user) return 'none'
      const { data: member } = await client.rpc('is_member')
      return member === true ? 'member' : 'stranger'
    },
    stop: async (id) => {
      const { data } = await client.from('stops').select('id, kind, mode, title, day, flight').eq('id', id).maybeSingle()
      return data
    },
    saveFlight: async (id: string, flight: Flight) => {
      const { error } = await client.from('stops').update({ flight }).eq('id', id)
      if (error) throw error
    },
  }
}

Deno.serve((req) => handle(req, { key, db, fetch, now: () => new Date() }))
