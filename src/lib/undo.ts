import { useCallback } from 'react'
import type { TableName } from './types'
import { useRemove } from './queries'
import { hide, unhide } from './pending'
import { useToast } from '../components/Toast'

// removing hides the row at once; the delete goes when the toast does, so undo needs no server trip
export function useUndoRemove(table: TableName): (id: string) => void {
  const { mutateAsync } = useRemove(table)
  const toast = useToast()
  return useCallback((id: string) => {
    hide(table, id)
    toast.show({
      text: 'removed',
      undo: () => unhide(table, id),
      done: () => {
        Promise.resolve()
          .then(() => mutateAsync(id))
          .then(() => unhide(table, id))
          .catch(() => { unhide(table, id); toast.show({ text: "couldn't remove" }) })
      },
    })
  }, [table, toast, mutateAsync])
}
