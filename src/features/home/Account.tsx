import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../lib/auth'
import { forgetDevice, useOnline } from '../../lib/offline'
import { useMembers } from '../../lib/queries'
import { Sheet } from '../../components/Sheet'
import { Icon } from '../../components/Icon'
import { Button, IconButton } from '../../components/Button'
import { Copy } from '../../components/Copy'
import { useArmed } from '../../components/TwoTapDelete'
import { hasSaveKey, newSaveKey } from '../../lib/saveKey'
import { Help } from '../../components/Tooltip'

export function AccountButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <IconButton label="account" onClick={() => setOpen(true)}><Icon name="user" /></IconButton>
      <Sheet open={open} title="account" onClose={() => setOpen(false)}><Account /></Sheet>
    </>
  )
}

function Account() {
  const { email, signOut } = useAuth()
  const me = (useMembers().data ?? []).find((m) => m.email.toLowerCase() === email?.toLowerCase())
  const online = useOnline()
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  async function out() {
    setBusy(true)
    setFailed(false)
    try {
      await signOut()
    } catch {
      setFailed(true)
      setBusy(false)
      return
    }
    await forgetDevice(qc)
  }

  return (
    <div className="stack">
      <div className="stack-xs">
        {me?.name && <p className="head account-name">{me.name}</p>}
        {email && <p className="muted">{email}</p>}
      </div>
      <SaveKey online={online} />
      {failed && <p className="warn-line">couldn't sign out</p>}
      <Button className="block" disabled={!online} busy={busy && 'signing out'} onClick={out}>sign out</Button>
    </div>
  )
}

// the key the "planner" shortcut in the phone's share sheet saves links with; shown once, replaced with two taps
function SaveKey({ online }: { online: boolean }) {
  const qc = useQueryClient()
  const has = useQuery({ queryKey: ['save-key'], queryFn: hasSaveKey, retry: 0 })
  const [key, setKey] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [armed, setArmed] = useArmed()
  const replacing = !!key || has.data === true

  async function make() {
    if (replacing && !armed) { setArmed(true); return }
    setArmed(false)
    setBusy(true)
    setFailed(false)
    try {
      setKey(await newSaveKey())
      qc.setQueryData(['save-key'], true)
    } catch {
      setFailed(true)
    }
    setBusy(false)
  }

  return (
    <div className="stack-xs save-key">
      <span className="label help-label">save key<Help label="about save keys">connect your phone’s share-sheet shortcut so it can save links to Planner</Help></span>
      {key && (
        <>
          <div className="fact-copy row"><span className="copy-text keep-case mono">{key}</span><Copy text={key} label="copy save key" /></div>
          <p className="muted">shown once</p>
        </>
      )}
      {failed && <p className="warn-line">couldn't make a save key</p>}
      <Button className="block" disabled={!online || has.isPending} busy={busy && 'making'} onClick={make}>
        {!replacing ? 'make a save key' : armed ? 'tap again · the old key stops working' : 'new save key'}
      </Button>
    </div>
  )
}
