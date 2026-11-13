import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { fetchRates } from './rates'
import { newId } from './id'
import { failSave, failureOf, forgetFailure, overlay, savedFields, usePending } from './pending'
import type { Rates } from './money'
import type { Cost, FileRow, Link, Member, Review, PackingItem, Stop, TableName, Trip } from './types'

export const keys = {
  trips: ['trips'],
  stops: ['stops'],
  costs: ['costs'],
  links: ['links'],
  packing: ['packing'],
  files: ['files'],
  members: ['members'],
  reviews: ['reviews'],
} as const satisfies Record<TableName, readonly string[]>

export const TABLES = Object.keys(keys) as TableName[]

async function loadAll<T>(table: TableName): Promise<T[]> {
  const { data, error, status } = await supabase.from(table).select('*')
  if (error) throw Object.assign(new Error(error.message), { code: error.code, status })
  return (data ?? []) as T[]
}

function useTable<T>(table: TableName) {
  const pending = usePending(table)
  const select = useCallback((rows: T[]) => overlay(rows, pending), [pending])
  return useQuery<T[]>({ queryKey: keys[table], queryFn: () => loadAll<T>(table), select })
}

export const useTrips = () => useTable<Trip>('trips')
export const useStops = () => useTable<Stop>('stops')
export const useCosts = () => useTable<Cost>('costs')
export const useLinks = () => useTable<Link>('links')
export const usePacking = () => useTable<PackingItem>('packing')
export const useFiles = () => useTable<FileRow>('files')
export const useMembers = () => useTable<Member>('members')

export const useReviews = () => useTable<Review>('reviews')

export function useRates() {
  return useQuery<Rates>({ queryKey: ['rates'], queryFn: fetchRates, staleTime: 6 * 60 * 60 * 1000, retry: 0 })
}

type Row = { id?: string } & Record<string, unknown>

// tables whose rows show "couldn't save"; elsewhere a kept failure would look saved when it isn't
const KEEPS_FAILURES: TableName[] = ['stops', 'costs', 'links', 'packing']

type Change = { row: Row & { id: string }; isNew: boolean }

// new rows are inserted; existing rows send only the fields that changed,
// so two people editing different fields of one row never undo each other
export function useSave<T extends { id: string } = { id: string }>(table: TableName) {
  const qc = useQueryClient()
  const m = useMutation({
    mutationFn: async ({ row, isNew }: Change) => {
      const { id, ...fields } = row
      const q = isNew ? supabase.from(table).insert(row) : supabase.from(table).update(fields).eq('id', id)
      const { data, error } = await q.select().single()
      if (error) throw error
      return data as T
    },
    onMutate: ({ row }: Change) => {
      qc.setQueryData<Row[]>(keys[table], (old) => {
        const list = old ?? []
        const i = list.findIndex((r) => r.id === row.id)
        if (i === -1) return [...list, { ...row }]
        const next = list.slice()
        next[i] = { ...list[i], ...row }
        return next
      })
    },
    // a failure is kept on screen with a retry instead of quietly disappearing on the next refresh
    onError: (_e: unknown, { row, isNew }: Change) => {
      if (!KEEPS_FAILURES.includes(table)) {
        // a new row nothing will keep on screen comes back out, so trying again inserts it rather than updating it
        if (isNew) qc.setQueryData<Row[]>(keys[table], (old) => old?.filter((r) => r.id !== row.id))
        return
      }
      const { id, ...fields } = row
      failSave(table, id, fields, isNew)
    },
    onSuccess: (_d: T, { row }: Change) => savedFields(table, row.id, Object.keys(row)),
    onSettled: () => qc.invalidateQueries({ queryKey: keys[table] }),
  })
  const mutateAsync = (fields: Row): Promise<T> => {
    const id = (fields.id as string | undefined) ?? newId()
    // a row whose insert failed is still new: send everything it had
    const prior = failureOf(table, id)
    if (prior?.isNew) return m.mutateAsync({ row: { ...prior.fields, ...fields, id }, isNew: true })
    const known = !!fields.id && !!qc.getQueryData<Row[]>(keys[table])?.some((r) => r.id === fields.id)
    return m.mutateAsync({ row: { ...fields, id }, isNew: !known })
  }
  return { ...m, mutateAsync, mutate: (fields: Row) => { mutateAsync(fields).catch(() => {}) } }
}

export function useRemove(table: TableName) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq('id', id)
      if (error) throw error
    },
    onMutate: (id: string) => {
      forgetFailure(table, id)
      const before = qc.getQueryData<Row[]>(keys[table])
      const at = before?.findIndex((r) => r.id === id) ?? -1
      qc.setQueryData<Row[]>(keys[table], (old) => old?.filter((r) => r.id !== id))
      return { row: at === -1 ? undefined : before![at], at }
    },
    // a delete that didn't go through puts the row back, even when the refresh can't reach the server either
    onError: (_e: unknown, _id: string, ctx?: { row?: Row; at: number }) => {
      const row = ctx?.row
      if (!row) return
      qc.setQueryData<Row[]>(keys[table], (old) => {
        const list = (old ?? []).filter((r) => r.id !== row.id)
        list.splice(Math.min(ctx.at, list.length), 0, row)
        return list
      })
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys[table] }),
  })
}
