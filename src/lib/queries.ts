import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { fetchRates } from './rates'
import type { Rates } from './money'
import type { Cost, FileRow, Link, Member, PackingItem, Stop, TableName, Trip } from './types'

export const keys = {
  trips: ['trips'],
  stops: ['stops'],
  costs: ['costs'],
  links: ['links'],
  packing: ['packing'],
  files: ['files'],
  members: ['members'],
} as const satisfies Record<TableName, readonly string[]>

export const TABLES = Object.keys(keys) as TableName[]

async function loadAll<T>(table: TableName): Promise<T[]> {
  const { data, error } = await supabase.from(table).select('*')
  if (error) throw error
  return (data ?? []) as T[]
}

function useTable<T>(table: TableName) {
  return useQuery<T[]>({ queryKey: keys[table], queryFn: () => loadAll<T>(table) })
}

export const useTrips = () => useTable<Trip>('trips')
export const useStops = () => useTable<Stop>('stops')
export const useCosts = () => useTable<Cost>('costs')
export const useLinks = () => useTable<Link>('links')
export const usePacking = () => useTable<PackingItem>('packing')
export const useFiles = () => useTable<FileRow>('files')
export const useMembers = () => useTable<Member>('members')

export function useRates() {
  return useQuery<Rates>({ queryKey: ['rates'], queryFn: fetchRates, staleTime: 6 * 60 * 60 * 1000, retry: 0 })
}

export function newId(): string {
  const c = globalThis.crypto as Crypto | undefined
  if (c?.randomUUID) return c.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

type Row = { id?: string } & Record<string, unknown>

export function useSave<T extends { id: string } = { id: string }>(table: TableName) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (fields: Row) => {
      const row = { ...fields, id: (fields.id as string | undefined) ?? newId() }
      const { data, error } = await supabase.from(table).upsert(row).select().single()
      if (error) throw error
      return data as T
    },
    onMutate: (fields: Row) => {
      // show the change at once; the refetch after settle is the source of truth
      const id = fields.id ?? newId()
      fields.id = id
      qc.setQueryData<Row[]>(keys[table], (old) => {
        const list = old ?? []
        const i = list.findIndex((r) => r.id === id)
        if (i === -1) return [...list, { ...fields }]
        const next = list.slice()
        next[i] = { ...list[i], ...fields }
        return next
      })
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys[table] }),
  })
}

export function useRemove(table: TableName) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq('id', id)
      if (error) throw error
    },
    onMutate: (id: string) => {
      qc.setQueryData<Row[]>(keys[table], (old) => old?.filter((r) => r.id !== id))
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys[table] }),
  })
}
