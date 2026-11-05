import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { keys, TABLES } from './queries'

export function RealtimeBridge() {
  const qc = useQueryClient()
  useEffect(() => {
    let ch = supabase.channel('planner')
    for (const table of TABLES) {
      ch = ch.on('postgres_changes' as never, { event: '*', schema: 'public', table }, () => {
        qc.invalidateQueries({ queryKey: keys[table] })
      })
    }
    ch.subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [qc])
  return null
}
