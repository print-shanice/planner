import { openLayer } from '../../src/lib/layers'

const escape = () => {
  const e = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true, bubbles: true })
  document.dispatchEvent(e)
  return e
}

it('escape closes only the newest layer', () => {
  const a = vi.fn(), b = vi.fn()
  const offA = openLayer(a), offB = openLayer(b)
  escape()
  expect(b).toHaveBeenCalledTimes(1)
  expect(a).not.toHaveBeenCalled()
  offB()
  escape()
  expect(a).toHaveBeenCalledTimes(1)
  offA()
})

it('a key something else already handled is left alone', () => {
  const a = vi.fn()
  const off = openLayer(a)
  const e = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })
  e.preventDefault()
  document.dispatchEvent(e)
  expect(a).not.toHaveBeenCalled()
  off()
})

it('with nothing open, escape does nothing', () => {
  expect(escape().defaultPrevented).toBe(false)
})
