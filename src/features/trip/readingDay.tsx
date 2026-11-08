import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

// the day the itinerary is showing as you scroll it. the laptop map and the + follow it;
// the link's ?day= (and so the calendar) only changes when you pick a day in the calendar
type Reading = { day: string | null; set: (day: string | null) => void }

const Ctx = createContext<Reading>({ day: null, set: () => {} })

export function ReadingDayProvider({ children }: { children: ReactNode }) {
  const [day, set] = useState<string | null>(null)
  const value = useMemo(() => ({ day, set }), [day])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useReadingDay = () => useContext(Ctx)
