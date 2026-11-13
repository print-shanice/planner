// a line that was just added lights up for a moment wherever it lands, once it's on screen
export function flash(id: string) {
  let tries = 0
  const go = () => {
    // the page can be gone before the line shows (a test's page torn down mid-retry)
    if (typeof document === 'undefined') return
    const el = document.querySelector<HTMLElement>(`[data-line="${id}"], [data-stop="${id}"]`)
    if (!el) { if (++tries < 30) setTimeout(go, 50); return }
    el.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })
    el.classList.remove('lit')
    void el.offsetWidth
    el.classList.add('lit')
    setTimeout(() => el.classList.remove('lit'), 1700)
  }
  go()
}
