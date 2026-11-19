import { useId, useState, type FormEvent } from 'react'
import { useSave } from '../../lib/queries'
import { useUndoRemove } from '../../lib/undo'
import type { DayOff } from '../../lib/types'
import { Pick } from '../../components/Pick'
import { FormFooter, useSubmit } from '../../components/FormFooter'
import { TwoTapDelete } from '../../components/TwoTapDelete'

// one of your own holidays: its name and days, or delete it (with undo)
export function DayOffForm({ off, onDone }: { off: DayOff; onDone: () => void }) {
  const save = useSave('days_off')
  const removeLater = useUndoRemove('days_off')
  const [name, setName] = useState(off.name)
  const [start, setStart] = useState(off.start_date)
  const [end, setEnd] = useState(off.end_date)
  const [problem, setProblem] = useState<string | null>(null)
  const { run, saving, failure } = useSubmit()
  const formId = useId()

  function submit(e: FormEvent) {
    e.preventDefault()
    const p = !name.trim() ? 'add a name' : !start ? 'add a first day' : end && end < start ? 'ends before it starts' : null
    setProblem(p)
    if (p) return
    void run(async () => {
      await save.mutateAsync({ id: off.id, name: name.trim(), start_date: start, end_date: end || start })
      onDone()
    })
  }

  return (
    <form id={formId} className="stack page-form" onSubmit={submit} noValidate>
      <input className="title-input" aria-label="name" placeholder="name" value={name} onChange={(e) => setName(e.target.value)} required />
      <div className="when">
        <div className="when-row"><span className="when-label">from</span><Pick type="date" label="from" value={start} onChange={setStart} /></div>
        <div className="when-row"><span className="when-label">until</span><Pick type="date" label="until" value={end} min={start || undefined} onChange={setEnd} /></div>
      </div>
      <FormFooter form={formId} problem={problem ?? failure} saving={saving} failed={!!failure}>
        <TwoTapDelete onConfirm={() => { onDone(); removeLater(off.id, off.name.toLowerCase()) }} />
      </FormFooter>
    </form>
  )
}
