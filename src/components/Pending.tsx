// one look for every wait: a short word and a soft pulse, said out loud to screen readers too
export function Pending({ label, className = '' }: { label: string; className?: string }) {
  return (
    <span className={`pending ${className}`.trim()} role="status">
      <span className="pending-dot pulse" aria-hidden="true" />
      <span>{label}</span>
    </span>
  )
}
