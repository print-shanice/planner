import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

// on a laptop the plan and the map beside it share one lit stop: hover a row, its pin lights up
type Lit = { id: string | null; set: (id: string | null) => void }

const Ctx = createContext<Lit>({ id: null, set: () => {} })

export function HighlightProvider({ children }: { children: ReactNode }) {
  const [id, set] = useState<string | null>(null)
  const value = useMemo(() => ({ id, set }), [id])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useHighlight = () => useContext(Ctx)
