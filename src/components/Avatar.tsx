import type { ReactNode } from 'react'
import type { Member } from '../lib/types'
import { colourVar } from '../lib/colors'

// a member by name: theirs, else their email
export const memberName = (m: Pick<Member, 'name' | 'email'>): string => (m.name || m.email).toLowerCase()

// a member's initial in a circle of their colour ("?" for someone not on the planner); the name is said beside it
export function Avatar({ member, children }: { member: Member | undefined; children?: ReactNode }) {
  return (
    <span className="avatar" aria-hidden="true" style={{ background: colourVar(member?.color) }}>
      {member ? memberName(member).slice(0, 1) : '?'}{children}
    </span>
  )
}
