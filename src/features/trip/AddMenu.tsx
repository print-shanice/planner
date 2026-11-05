import { Sheet } from '../../components/Sheet'
import { Icon } from '../../components/Icon'

export type AddKind = 'stay' | 'journey' | 'note' | 'cost' | 'link' | 'side trip'

const OPTIONS: [AddKind, string][] = [
  ['stay', 'bed'], ['journey', 'train'], ['note', 'note'], ['cost', 'money'], ['link', 'link'], ['side trip', 'globe'],
]

export function AddMenu({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (k: AddKind) => void }) {
  return (
    <Sheet open={open} title="add" onClose={onClose}>
      <div className="add-grid">
        {OPTIONS.map(([k, icon]) => (
          <button key={k} type="button" className="add-option" onClick={() => onPick(k)}>
            <Icon name={icon} size={24} />
            <span>{k}</span>
          </button>
        ))}
      </div>
    </Sheet>
  )
}
