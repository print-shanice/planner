import { Sheet } from '../../components/Sheet'
import { Icon } from '../../components/Icon'

export type AddKind = 'place' | 'stay' | 'journey' | 'note' | 'cost' | 'link' | 'side trip'

const OPTIONS: [AddKind, string][] = [
  ['place', 'pin'], ['stay', 'bed'], ['journey', 'arrow'], ['note', 'note'], ['cost', 'money'], ['link', 'link'], ['side trip', 'calendar'],
]

// the one way to add anything to a trip
export function AddSheet({ open, title, onPick, onClose }: { open: boolean; title: string; onPick: (kind: AddKind) => void; onClose: () => void }) {
  return (
    <Sheet open={open} title={title} onClose={onClose}>
      <ul className="add-options">
        {OPTIONS.map(([kind, icon]) => (
          <li key={kind}>
            <button type="button" className="add-option" onClick={() => onPick(kind)}>
              <span className="add-icon"><Icon name={icon} /></span>
              <span>{kind}</span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}
