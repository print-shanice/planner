import { useCallback } from 'react'
import type { TableName } from './types'
import { useRemove } from './queries'
import { hide, unhide } from './pending'
import { useToast } from '../components/Toast'

// removing hides the rows at once; the delete goes when the toast does, so undo needs no server trip
// label: what went, for the toast ("removed neel")
export function useUndoRemove(table: TableName): (ids: string | string[], label?: string) => void {
  const { mutateAsync } = useRemove(table)
  const toast = useToast()
  return useCallback((ids: string | string[], label?: string) => {
    const all = Array.isArray(ids) ? ids : [ids]
    if (!all.length) return
    all.forEach((id) => hide(table, id))
    toast.show({
      text: label ? `removed ${label}` : all.length === 1 ? 'removed' : `${all.length} removed`,
      undo: () => all.forEach((id) => unhide(table, id)),
      done: () => {
        all.reduce((chain, id) => chain
          .then(() => mutateAsync(id))
          .then(() => unhide(table, id))
          .catch(() => { unhide(table, id); toast.show({ text: "couldn't remove" }) }), Promise.resolve())
      },
    })
  }, [table, toast, mutateAsync])
}
