import { Icon } from './Icon'

export function SectionHeading({ title, action, disabled, onAction }: {
  title: string
  action: string
  disabled?: boolean
  onAction: () => void
}) {
  return (
    <header className="section-heading">
      <h2 className="head">{title}</h2>
      <button type="button" className="section-action" aria-label={action} title={action} disabled={disabled} onClick={onAction}><Icon name="plus" size={20} /></button>
    </header>
  )
}
