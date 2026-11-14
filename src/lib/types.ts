import type { Flight } from '../../supabase/functions/flight/shape'

export type Place = {
  name: string
  address?: string
  city?: string
  // the neighbourhood or district, when the search knows it
  area?: string
  country?: string
  lat: number | null
  lng: number | null
  osm_id?: string
  // google's place id: kept for good, so the place can be looked up again
  gid?: string
  // when the coordinates came from google (yyyy-mm-dd); they're refreshed after 30 days
  at?: string
  // what the search thought it was (cafe, museum…); the stop keeps its own category
  category?: string
}

export type Trip = {
  id: string
  parent_id: string | null
  name: string
  start_date: string | null
  end_date: string | null
  currency: string
  budget: number | null
  color: number
  base: Place | null
  notes: string
  created_at: string
  created_by?: string | null
}

export type StopKind = 'place' | 'stay' | 'journey' | 'note'
export type StopStatus = 'idea' | 'to_book' | 'booked'
export type Mode = 'flight' | 'train' | 'bus' | 'ferry'

export type Stop = {
  id: string
  trip_id: string
  kind: StopKind
  title: string
  day: string | null
  position: number
  time: string | null
  end_date: string | null
  end_time: string | null
  place: Place | null
  mode: Mode | null
  origin: Place | null
  destination: Place | null
  status: StopStatus
  saved: boolean
  url: string
  ref: string
  notes: string
  category: string | null
  // a flight's looked-up details, null for anything else
  flight: Flight | null
  created_by?: string | null
}

export type Cost = {
  id: string
  trip_id: string
  stop_id: string | null
  title: string
  amount: number
  currency: string
  eur_rate: number | null
  category: string
  date: string | null
  status: 'estimate' | 'paid'
  paid_by: string | null
  // older rows: 'even' or one person's id. newer rows also say exactly who it was for
  split: string
  split_among?: string[] | null
  // exact shares, in the cost's own currency; none means split evenly
  split_amounts?: Record<string, number> | null
  created_by?: string | null
}

export type Link = {
  id: string
  trip_id: string | null
  url: string
  title: string
  note: string
  // the place in the plan it's inspiration for
  stop_id?: string | null
  created_at?: string
  created_by?: string | null
}

export type PackingItem = {
  id: string
  trip_id: string
  text: string
  // older rows: a tick for everyone (schema.sql moves it into packed_by)
  done: boolean
  position: number
  // a member's user id, or none for things you both pack (rows cached before owners existed have neither)
  owner?: string | null
  packed_by?: string[]
  // checked in, carried on, or worn to the airport
  bag?: Bag | null
}

export type Bag = 'check' | 'carry' | 'wear'

export type FileRow = {
  id: string
  stop_id: string
  path: string
  name: string
  mime: string
}

export type Member = {
  email: string
  user_id: string | null
  name: string
  color: number
}

export type Review = {
  id: string
  stop_id: string
  author_id: string
  rating: number | null
  return_choice: 'yes' | 'maybe' | 'no' | null
  outcome: 'planned' | 'done' | 'skipped'
  comments: string
  created_at?: string
}

export type TableName = 'trips' | 'stops' | 'costs' | 'links' | 'packing' | 'files' | 'members' | 'reviews'
