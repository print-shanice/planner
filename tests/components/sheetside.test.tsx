import { render, screen } from '@testing-library/react'
import { Sheet } from '../../src/components/Sheet'

describe('Sheet side', () => {
  it('marks a side sheet, so a laptop trip shows it as a panel beside the plan', () => {
    render(<Sheet side open title="nomad coffee" onClose={() => {}}><p>details</p></Sheet>)
    expect(screen.getByRole('dialog', { name: 'nomad coffee' })).toHaveClass('side')
    expect(document.querySelector('.sheet-root')).toHaveClass('side')
  })
  it('an ordinary sheet is not one', () => {
    render(<Sheet open title="add" onClose={() => {}}><p>menu</p></Sheet>)
    expect(screen.getByRole('dialog', { name: 'add' })).not.toHaveClass('side')
  })
})
