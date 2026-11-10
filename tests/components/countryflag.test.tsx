import { render, screen } from '@testing-library/react'
import { CountryFlag } from '../../src/components/CountryFlag'

describe('CountryFlag', () => {
  it('draws the country as a round picture, never an emoji', () => {
    const { container } = render(<CountryFlag code="ES" />)
    const img = screen.getByRole('img', { name: 'Spain' })
    expect(img.tagName).toBe('IMG')
    expect(img.getAttribute('src')).toMatch(/flags\/es\.svg$/)
    expect(container.textContent).toBe('')
  })
  it('shows nothing without a real country code', () => {
    const { container } = render(<><CountryFlag code={null} /><CountryFlag code="spain" /></>)
    expect(container.innerHTML).toBe('')
  })
})
