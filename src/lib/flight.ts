import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { keys } from './queries'
import { fmtDay } from './dates'
import type { Place } from './types'
import type { Flight, FlightEnd } from '../../supabase/functions/flight/shape'

export type { Flight, FlightEnd }
export type FlightError = 'not_found' | 'quota' | 'unavailable' | 'not_flight' | 'offline' | 'ambiguous' | 'changed'
const KNOWN: FlightError[] = ['not_found', 'quota', 'unavailable', 'not_flight', 'ambiguous', 'changed']

// 'kl1001', ' Kl 1001 ', 'klm 1001' → 'KL 1001' / 'KLM 1001'; anything else null
export function flightNumber(typed: string): string | null {
  const m = typed.trim().toUpperCase().match(/^([A-Z][A-Z0-9]|[0-9][A-Z]|[A-Z]{3})\s*(\d{1,4}[A-Z]?)$/)
  return m ? `${m[1]} ${m[2]}` : null
}

// aerodatabox's local times read 'yyyy-mm-dd hh:mm+hh:mm'
const ms = (local: string) => Date.parse(local.replace(' ', 'T'))
const hhmm = (local: string) => local.slice(11, 16)
const HOUR = 60 * 60_000

// worth checking again: from a day before leaving until an hour after landing
export function canCheck(f: Flight, now: Date): boolean {
  const t = now.getTime()
  return t >= ms(f.dep.scheduled) - 24 * HOUR && t <= ms(f.arr.revised ?? f.arr.scheduled) + HOUR
}

// what each end says on the card: only its terminal and gate (shanice: the desk and belt are noise)
export function endBits(e: FlightEnd): string[] {
  const bits: [string, string | null][] = [['terminal', e.terminal], ['gate', e.gate]]
  return bits.flatMap(([label, v]) => (v ? [`${label} ${v.toLowerCase()}`] : []))
}

const CALM: Record<string, string> = { Boarding: 'boarding', GateClosed: 'gate closed', Departed: 'in the air', EnRoute: 'in the air', Approaching: 'in the air', Arrived: 'landed' }

export function statusWord(f: Flight): { text: string; warn: boolean } | null {
  if (f.status === 'Delayed') return { text: f.dep.revised ? `delayed · leaves ${hhmm(f.dep.revised)}` : 'delayed', warn: true }
  if (f.status === 'Canceled' || f.status === 'CanceledUncertain') return { text: 'cancelled', warn: true }
  if (f.status === 'Diverted') return { text: 'diverted', warn: true }
  return CALM[f.status] ? { text: CALM[f.status], warn: false } : null
}

function toPlace(e: FlightEnd): Place {
  return { name: e.airport, ...(e.city ? { city: e.city } : {}), ...(e.country ? { country: e.country } : {}), lat: e.lat, lng: e.lng }
}

// the journey form's fields, from a looked-up flight
export function toDraft(f: Flight) {
  return {
    title: f.number,
    origin: toPlace(f.dep),
    destination: toPlace(f.arr),
    day: f.dep.scheduled.slice(0, 10),
    time: hhmm(f.dep.scheduled),
    end_date: f.arr.scheduled.slice(0, 10),
    end_time: hhmm(f.arr.scheduled),
  }
}

export function flightError(e: FlightError, number: string, date: string): string {
  switch (e) {
    case 'not_found': return `no ${number.toLowerCase()} on ${fmtDay(date)}`
    case 'quota': return 'lookups used up this month'
    case 'offline': return 'offline'
    case 'not_flight': return 'add the flight number and day first'
    case 'ambiguous': return "couldn't confirm this departure; edit the flight and look it up again"
    case 'changed': return 'the flight changed while checking; close and reopen it to try again'
    default: return "couldn't look it up, try again"
  }
}

export async function invokeFlight(body: { number: string; date: string } | { stop: string }): Promise<Flight | Flight[] | FlightError> {
  try {
    const { data, error } = await supabase.functions.invoke('flight', { body })
    if (error || !data) return 'unavailable'
    if (data.flight) return data.flight as Flight
    if (Array.isArray(data.flights) && data.flights.length) return data.flights as Flight[]
    return KNOWN.includes(data.error) ? data.error : 'unavailable'
  } catch {
    return 'unavailable'
  }
}

// the form's "look up": answers, never saves
export function useFlightLookup() {
  const [busy, setBusy] = useState(false)
  const look = async (number: string, date: string) => {
    setBusy(true)
    try { return await invokeFlight({ number, date }) } finally { setBusy(false) }
  }
  return { look, busy }
}

// the card's "check again": the function saves it, realtime and this refresh show it
export function useFlightCheck(stopId: string) {
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)
  const check = async (): Promise<FlightError | null> => {
    setBusy(true)
    try {
      const r = await invokeFlight({ stop: stopId })
      if (typeof r === 'string') return r
      if (Array.isArray(r)) return 'ambiguous'
      await qc.invalidateQueries({ queryKey: keys.stops })
      return null
    } finally { setBusy(false) }
  }
  return { check, busy }
}
