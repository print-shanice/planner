import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

// The visible itinerary day drives the map, contextual creation, and the day carried
// into the URL when switching sections.
type Reading = { day: string | null; set: (day: string | null) => void }

const Ctx = createContext<Reading>({ day: null, set: () => {} })

export function ReadingDayProvider({ children }: { children: ReactNode }) {
  const [day, set] = useState<string | null>(null)
  const value = useMemo(() => ({ day, set }), [day])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useReadingDay = () => useContext(Ctx)
