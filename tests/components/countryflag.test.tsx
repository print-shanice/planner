import { render, screen } from '@testing-library/react'
import { CountryFlag } from '../../src/components/CountryFlag'

describe('CountryFlag', () => {
  it('draws the country as its code in a tag, named for screen readers, never an emoji', () => {
    const { container } = render(<CountryFlag code="es" />)
    const tag = screen.getByRole('img', { name: 'Spain' })
    expect(tag).toHaveClass('flag')
    expect(container.textContent).toBe('ES')
  })
  it('shows nothing without a real country code', () => {
    const { container } = render(<><CountryFlag code={null} /><CountryFlag code="spain" /></>)
    expect(container.innerHTML).toBe('')
  })
})
