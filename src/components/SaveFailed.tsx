import { useState } from 'react'
import type { TableName } from '../lib/types'
import { useFailure, type Failed } from '../lib/pending'
import { useSave } from '../lib/queries'

// a change the server didn't take stays on screen with a way to send it again
export function SaveFailed({ table, id }: { table: TableName; id: string }) {
  const failed = useFailure(table, id)
  return failed ? <Retry table={table} failed={failed} /> : null
}

function Retry({ table, failed }: { table: TableName; failed: Failed }) {
  const save = useSave(table)
  const [busy, setBusy] = useState(false)
  async function retry() {
    setBusy(true)
    try { await save.mutateAsync({ ...failed.fields, id: failed.id }) } catch { /* still failed: the line stays */ } finally { setBusy(false) }
  }
  return (
    <p className="save-failed" role="alert">
      <span>couldn't save</span>
      <button type="button" className="btn ghost small" disabled={busy} onClick={retry}>retry</button>
    </p>
  )
}
