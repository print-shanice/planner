// how wide the plan is beside the map on a laptop: dragged by hand, remembered on this device
export const SPLIT_MIN = 380
export const MAP_MIN = 320
export const SPLIT_DEFAULT = 600
const KEY = 'planner.split'

export function clampSplit(px: number, viewport: number): number {
  return Math.round(Math.max(SPLIT_MIN, Math.min(px, viewport - MAP_MIN)))
}

export function readSplit(): number | null {
  try {
    const n = Number(localStorage.getItem(KEY))
    return Number.isFinite(n) && n > 0 ? n : null
  } catch { return null }
}

export function saveSplit(px: number | null) {
  try { if (px == null) localStorage.removeItem(KEY); else localStorage.setItem(KEY, String(px)) } catch { /* private window: the width just isn't kept */ }
}
