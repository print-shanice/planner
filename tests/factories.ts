import type { Trip, Stop, Cost, Place } from '../src/lib/types'

let n = 0
const id = (p: string) => `${p}${++n}`

export function place(o: Partial<Place> = {}): Place {
  return { name: 'somewhere', address: '', country: 'NL', lat: 52, lng: 5, ...o }
}

export function trip(o: Partial<Trip> = {}): Trip {
  return {
    id: id('t'), parent_id: null, name: 'trip', start_date: '2027-02-07', end_date: '2027-02-11',
    currency: 'EUR', budget: null, color: 0, base: null, notes: '', created_at: '2026-11-05T00:00:00Z', ...o,
  }
}

export function stop(o: Partial<Stop> = {}): Stop {
  return {
    id: id('s'), trip_id: 't0', kind: 'place', title: 'stop', day: '2027-02-07', position: 0, time: null,
    end_date: null, end_time: null, place: null, mode: null, origin: null, destination: null,
    status: 'idea', saved: false, url: '', ref: '', notes: '', category: null, ...o,
  }
}

export function cost(o: Partial<Cost> = {}): Cost {
  return {
    id: id('c'), trip_id: 't0', stop_id: null, title: 'cost', amount: 10, currency: 'EUR', eur_rate: null,
    category: 'other', date: null, status: 'estimate', paid_by: null, split: 'even', ...o,
  }
}
