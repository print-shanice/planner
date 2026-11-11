import { useCallback, useRef, useState, type ReactNode } from 'react'
import { useCanEdit } from '../lib/offline'
import { saveError } from '../lib/errors'
import { Button } from './Button'
import { SheetFooter } from './Sheet'

// one save at a time: a second tap while saving does nothing, and a failure is kept to show with a retry
export function useSubmit() {
  const busy = useRef(false)
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const run = useCallback(async (fn: () => Promise<void>) => {
    if (busy.current) return
    busy.current = true
    setSaving(true)
    setFailure(null)
    try { await fn() } catch (e) { setFailure(saveError(e)) } finally { busy.current = false; setSaving(false) }
  }, [])
  return { run, saving, failure }
}

// onClear: a new item's form holds something; "clear" empties it and its kept draft
type Props = { form: string; problem: string | null; saving: boolean; failed: boolean; children?: ReactNode; onClear?: () => void }

export function FormFooter({ form, problem, saving, failed, children, onClear }: Props) {
  const canEdit = useCanEdit()
  const line = canEdit ? problem : 'offline'
  return (
    <SheetFooter>
      <div className="form-foot">
        {line && <p className="warn-line" role="alert">{line}</p>}
        {children}
        {onClear && <button type="button" className="text-link form-clear" onClick={onClear}>clear</button>}
        <span className="spacer" />
        <Button variant="primary" type="submit" form={form} disabled={!canEdit} busy={saving && 'saving'}>
          {failed ? 'retry' : 'save'}
        </Button>
      </div>
    </SheetFooter>
  )
}
