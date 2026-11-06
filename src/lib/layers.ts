// things escape can close (sheets, the globe tip); one press closes only the newest
type Layer = { close: () => void }
const stack: Layer[] = []

function onKey(e: KeyboardEvent) {
  if (e.key !== 'Escape' || e.defaultPrevented || !stack.length) return
  e.preventDefault()
  stack[stack.length - 1].close()
}

export function openLayer(close: () => void): () => void {
  const layer = { close }
  if (!stack.length) document.addEventListener('keydown', onKey)
  stack.push(layer)
  return () => {
    const i = stack.indexOf(layer)
    if (i !== -1) stack.splice(i, 1)
    if (!stack.length) document.removeEventListener('keydown', onKey)
  }
}
