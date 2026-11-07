import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../lib/auth'
import { forgetDevice, useOnline } from '../../lib/offline'
import { useMembers } from '../../lib/queries'
import { Sheet } from '../../components/Sheet'
import { Icon } from '../../components/Icon'
import { Button, IconButton } from '../../components/Button'

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
      {failed && <p className="warn-line">couldn't sign out</p>}
      <Button className="block" disabled={!online} busy={busy && 'signing out'} onClick={out}>sign out</Button>
    </div>
  )
}
