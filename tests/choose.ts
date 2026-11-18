import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// the planner's own dropdown: open it, then pick the choice by its words
export async function choose(menu: HTMLElement, option: string | RegExp) {
  await userEvent.click(menu)
  await userEvent.click(screen.getByRole('option', { name: option }))
}
