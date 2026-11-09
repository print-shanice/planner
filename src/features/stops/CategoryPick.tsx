import { CATEGORIES, categoryIcon, type Category } from '../../lib/categories'
import { Icon } from '../../components/Icon'

// what kind of place: one row of choices you can scroll; tapping the chosen one again clears it
export function CategoryPick({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const choices = CATEGORIES.filter((c) => c !== 'stay' && c !== 'transport')
  return (
    <div className="category-pick" role="group" aria-label="kind of place">
      {choices.map((c: Category) => (
        <button key={c} type="button" className="cat-chip" aria-pressed={value === c} onClick={() => onChange(value === c ? '' : c)}>
          <Icon name={categoryIcon(c)} size={16} /><span>{c}</span>
        </button>
      ))}
    </div>
  )
}
