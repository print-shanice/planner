export type Place = {
  name: string
  address?: string
  city?: string
  country?: string
  lat: number | null
  lng: number | null
  osm_id?: string
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
  split: string
  created_by?: string | null
}

export type Link = {
  id: string
  trip_id: string | null
  url: string
  title: string
  note: string
  created_at?: string
  created_by?: string | null
}

export type PackingItem = {
  id: string
  trip_id: string
  text: string
  done: boolean
  position: number
}

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

export type TableName = 'trips' | 'stops' | 'costs' | 'links' | 'packing' | 'files' | 'members'
