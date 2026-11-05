// instagram and tiktok embeds need their own script; load each once and re-run it for new cards
const SRC = { instagram: 'https://www.instagram.com/embed.js', tiktok: 'https://www.tiktok.com/embed.js' } as const
const loaded: Partial<Record<keyof typeof SRC, Promise<void>>> = {}

declare global { interface Window { instgrm?: { Embeds: { process: () => void } } } }

function inject(kind: keyof typeof SRC): Promise<void> {
  return new Promise((resolve) => {
    const s = document.createElement('script')
    s.src = SRC[kind]
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => resolve()
    document.body.appendChild(s)
  })
}

export async function runEmbeds(kind: keyof typeof SRC) {
  if (kind === 'instagram') {
    if (!loaded.instagram) loaded.instagram = inject('instagram')
    await loaded.instagram
    window.instgrm?.Embeds.process()
  } else {
    // tiktok's script only scans the page when it loads, so add it again for new cards
    document.querySelectorAll(`script[src="${SRC.tiktok}"]`).forEach((s) => s.remove())
    await inject('tiktok')
  }
}
