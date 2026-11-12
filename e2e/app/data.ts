// made-up demo data for the end-to-end tests and the local preview: no real trips, no real people
let n = 0
const id = (p: string) => `${p}-${++n}`
const pl = (name: string, city: string, country: string, lat: number, lng: number) => ({ name, city, country, lat, lng })
const T = (o: any) => ({ currency: 'EUR', budget: null, notes: '', created_at: '2026-10-01', base: null, parent_id: null, ...o })
const trips = [
  T({ id: 'eu', name: 'euro summer', start_date: '2027-01-28', end_date: '2027-07-13', color: 0, budget: 6000, base: pl('eindhoven', 'eindhoven', 'NL', 51.44, 5.47) }),
  T({ id: 'par', parent_id: 'eu', name: 'paris', start_date: '2027-02-19', end_date: '2027-02-23', color: 2, base: pl('paris', 'paris', 'FR', 48.85, 2.35) }),
  T({ id: 'lap', parent_id: 'eu', name: 'lapland', start_date: '2027-03-04', end_date: '2027-03-09', color: 1, base: pl('rovaniemi', 'rovaniemi', 'FI', 66.5, 25.73) }),
  T({ id: 'bcn', parent_id: 'eu', name: 'barcelona', start_date: '2027-04-15', end_date: '2027-04-20', color: 3, base: pl('barcelona', 'barcelona', 'ES', 41.39, 2.17) }),
  T({ id: 'mont', parent_id: 'bcn', name: 'montserrat', start_date: '2027-04-17', end_date: '2027-04-17', color: 4 }),
  T({ id: 'rome', parent_id: 'eu', name: 'someday rome', start_date: null, end_date: null, color: 4 }),
  T({ id: 'gr', name: 'greek islands', start_date: '2027-07-20', end_date: '2027-07-30', color: 4, base: pl('naxos', 'naxos', 'GR', 37.1, 25.37) }),
  T({ id: 'lis', name: 'lisbon long weekend', start_date: '2026-05-01', end_date: '2026-05-04', color: 5, base: pl('lisbon', 'lisbon', 'PT', 38.72, -9.14) }),
  T({ id: 'cph', name: 'copenhagen', start_date: '2025-09-12', end_date: '2025-09-15', color: 1, base: pl('copenhagen', 'copenhagen', 'DK', 55.68, 12.57) }),
  T({ id: 'jp', name: 'japan 2024', start_date: '2024-10-02', end_date: '2024-10-12', color: 2, currency: 'JPY', base: pl('tokyo', 'tokyo', 'JP', 35.68, 139.69) }),
]
const S = (o: any) => ({ id: id('s'), kind: 'place', title: '', day: null, position: 0, time: null, end_date: null, end_time: null, place: null, mode: null, origin: null, destination: null, status: 'idea', saved: false, url: '', ref: '', notes: '', category: null, ...o })
const ein = pl('eindhoven centraal', 'eindhoven', 'NL', 51.443, 5.479)
const stops = [
  S({ trip_id: 'eu', kind: 'journey', title: 'flight to amsterdam', mode: 'flight', day: '2027-01-28', time: '07:10', end_date: '2027-01-28', end_time: '14:35', origin: pl('dublin airport', 'dublin', 'IE', 53.42, -6.27), destination: pl('schiphol', 'amsterdam', 'NL', 52.31, 4.76), status: 'booked', ref: 'KL934' }),
  S({ trip_id: 'eu', kind: 'journey', title: 'train to eindhoven', mode: 'train', day: '2027-01-28', time: '15:30', end_time: '16:50', origin: pl('schiphol', 'amsterdam', 'NL', 52.31, 4.76), destination: ein, status: 'to_book', position: 1 }),
  S({ trip_id: 'eu', kind: 'stay', title: 'student flat', day: '2027-01-28', end_date: '2027-07-13', place: pl('student flat', 'eindhoven', 'NL', 51.448, 5.49), status: 'booked', position: 2 }),
  S({ trip_id: 'eu', title: 'van abbemuseum', day: '2027-01-30', time: '11:00', place: pl('van abbemuseum', 'eindhoven', 'NL', 51.435, 5.481), category: 'museum' }),
  S({ trip_id: 'eu', title: 'coffee at kopi soesoe', day: '2027-01-30', place: pl('kopi soesoe', 'eindhoven', 'NL', 51.437, 5.476), category: 'cafe', position: 1 }),
  S({ trip_id: 'eu', kind: 'note', title: 'pick up residence permit', day: '2027-02-02', position: 0 }),
  S({ trip_id: 'eu', title: 'de effenaar gig', day: '2027-02-06', time: '20:00', place: pl('effenaar', 'eindhoven', 'NL', 51.44, 5.483), status: 'to_book' }),
  S({ trip_id: 'eu', title: 'keukenhof', saved: true, place: pl('keukenhof', 'lisse', 'NL', 52.27, 4.546) }),
  S({ trip_id: 'eu', title: 'kinderdijk windmills', saved: true, place: pl('kinderdijk', 'kinderdijk', 'NL', 51.88, 4.64) }),
  S({ trip_id: 'eu', kind: 'journey', title: 'train to paris', mode: 'train', day: '2027-02-19', time: '08:12', end_time: '11:40', origin: ein, destination: pl('gare du nord', 'paris', 'FR', 48.88, 2.355), status: 'booked', ref: 'THA 9312' }),
  S({ trip_id: 'par', kind: 'stay', title: 'hotel marais', day: '2027-02-19', end_date: '2027-02-23', place: pl('hotel marais', 'paris', 'FR', 48.859, 2.36), status: 'booked' }),
  S({ trip_id: 'par', title: 'musée d’orsay', day: '2027-02-20', time: '10:00', place: pl('musée d’orsay', 'paris', 'FR', 48.86, 2.326), status: 'to_book' }),
  S({ trip_id: 'par', title: 'du pain et des idées', day: '2027-02-20', position: 1, place: pl('du pain et des idées', 'paris', 'FR', 48.871, 2.363), category: 'bakery' }),
  S({ trip_id: 'par', title: 'sainte-chapelle', day: '2027-02-21', time: '09:30', place: pl('sainte-chapelle', 'paris', 'FR', 48.855, 2.345) }),
  S({ trip_id: 'par', title: 'montmartre walk', day: '2027-02-21', position: 1, place: pl('sacré-cœur', 'paris', 'FR', 48.886, 2.343) }),
  S({ trip_id: 'lap', kind: 'journey', title: 'flight to rovaniemi', mode: 'flight', day: '2027-03-04', time: '06:40', end_time: '12:15', origin: pl('eindhoven airport', 'eindhoven', 'NL', 51.45, 5.37), destination: pl('rovaniemi airport', 'rovaniemi', 'FI', 66.56, 25.83), status: 'to_book' }),
  S({ trip_id: 'lap', kind: 'stay', title: 'glass igloo', day: '2027-03-04', end_date: '2027-03-09', place: pl('arctic glass igloo', 'rovaniemi', 'FI', 66.55, 25.85), status: 'to_book' }),
  S({ trip_id: 'lap', title: 'husky ride', day: '2027-03-05', place: pl('husky park', 'rovaniemi', 'FI', 66.52, 25.9) }),
  S({ trip_id: 'bcn', kind: 'stay', title: 'flat in gràcia', day: '2027-04-15', end_date: '2027-04-20', place: pl('gràcia flat', 'barcelona', 'ES', 41.403, 2.157), status: 'booked' }),
  S({ trip_id: 'bcn', title: 'sagrada família', day: '2027-04-16', time: '10:15', place: pl('sagrada família', 'barcelona', 'ES', 41.403, 2.174), status: 'booked' }),
  S({ trip_id: 'gr', kind: 'stay', title: 'room near the port', day: '2027-07-20', end_date: '2027-07-30', place: pl('naxos port', 'naxos', 'GR', 37.105, 25.375) }),
  S({ trip_id: 'lis', kind: 'stay', title: 'alfama flat', day: '2026-05-01', end_date: '2026-05-04', place: pl('alfama flat', 'lisbon', 'PT', 38.711, -9.13), status: 'booked' }),
  S({ trip_id: 'lis', title: 'pastéis de belém', day: '2026-05-02', place: pl('pastéis de belém', 'lisbon', 'PT', 38.697, -9.203), status: 'booked' }),
  S({ trip_id: 'lis', title: 'sintra day', day: '2026-05-03', place: pl('pena palace', 'sintra', 'PT', 38.787, -9.39) }),
  S({ trip_id: 'cph', title: 'tivoli', day: '2025-09-13', place: pl('tivoli', 'copenhagen', 'DK', 55.673, 12.568) }),
  S({ trip_id: 'cph', kind: 'journey', title: 'sk 1552', mode: 'flight', day: '2025-09-12', time: '09:00', end_time: '10:20', origin: pl('schiphol', 'amsterdam', 'NL', 52.31, 4.76), destination: pl('kastrup', 'copenhagen', 'DK', 55.62, 12.65), status: 'booked' }),
  // a past trip far away: flights, a train and a stay the whole-trip map should show
  S({ trip_id: 'jp', kind: 'journey', title: 'sq 638', mode: 'flight', day: '2024-10-02', time: '23:55', end_date: '2024-10-03', end_time: '07:40', origin: pl('changi', 'singapore', 'SG', 1.36, 103.99), destination: pl('narita', 'tokyo', 'JP', 35.77, 140.39), status: 'booked', ref: 'ABC123',
    flight: { number: 'SQ 638', airline: 'Singapore Airlines', status: 'Arrived', live: false, checked_at: '2024-10-01T10:00:00.000Z',
      dep: { iata: 'SIN', airport: 'Singapore Changi', city: 'Singapore', country: 'SG', lat: 1.36, lng: 103.99, scheduled: '2024-10-02 23:55+08:00', revised: null, terminal: '3', gate: 'B5', desk: '6', belt: null },
      arr: { iata: 'NRT', airport: 'Narita International', city: 'Tokyo', country: 'JP', lat: 35.77, lng: 140.39, scheduled: '2024-10-03 07:40+09:00', revised: null, terminal: '1', gate: null, desk: null, belt: '3' } } }),
  S({ trip_id: 'jp', kind: 'stay', title: 'shinjuku hostel', day: '2024-10-03', end_date: '2024-10-07', place: pl('shinjuku hostel', 'tokyo', 'JP', 35.69, 139.70), status: 'booked' }),
  S({ trip_id: 'jp', title: 'senso-ji', day: '2024-10-04', time: '09:00', category: 'sight', place: pl('senso-ji', 'tokyo', 'JP', 35.715, 139.797) }),
  S({ trip_id: 'jp', title: 'teamlab planets', day: '2024-10-05', time: '13:00', category: 'museum', place: pl('teamlab planets', 'tokyo', 'JP', 35.649, 139.790), status: 'booked' }),
  S({ trip_id: 'jp', kind: 'journey', title: 'nozomi 21', mode: 'train', day: '2024-10-07', time: '10:00', end_time: '12:15', origin: pl('tokyo station', 'tokyo', 'JP', 35.681, 139.767), destination: pl('kyoto station', 'kyoto', 'JP', 34.985, 135.758), status: 'booked' }),
  S({ trip_id: 'jp', kind: 'stay', title: 'hop inn kyoto shijo omiya', day: '2024-10-07', end_date: '2024-10-11', place: { ...pl('hop inn kyoto shijo omiya', 'kyoto', 'JP', 35.003, 135.747), gid: 'g-hop', at: '2024-09-01' }, status: 'booked', ref: 'HOP-7781' }),
  S({ trip_id: 'jp', title: 'fushimi inari', day: '2024-10-08', time: '07:00', category: 'sight', place: pl('fushimi inari taisha', 'kyoto', 'JP', 34.967, 135.773) }),
  S({ trip_id: 'jp', title: 'nishiki market', day: '2024-10-08', category: 'shopping', position: 1, place: pl('nishiki market', 'kyoto', 'JP', 35.005, 135.765) }),
  S({ trip_id: 'jp', kind: 'journey', title: 'haruka', mode: 'train', day: '2024-10-11', time: '14:00', end_time: '15:20', origin: pl('kyoto station', 'kyoto', 'JP', 34.985, 135.758), destination: pl('kansai airport', 'osaka', 'JP', 34.43, 135.24), status: 'booked' }),
  S({ trip_id: 'jp', kind: 'journey', title: 'sq 619', mode: 'flight', day: '2024-10-11', time: '18:00', end_time: '23:40', origin: pl('kansai airport', 'osaka', 'JP', 34.43, 135.24), destination: pl('changi', 'singapore', 'SG', 1.36, 103.99), status: 'booked' }),
  // a busy travel day in barcelona: a flight in, a train, timed and untimed places, a note with no place
  S({ trip_id: 'bcn', kind: 'journey', title: 'vy 8312', mode: 'flight', day: '2027-04-15', time: '07:05', end_time: '09:10', origin: pl('eindhoven airport', 'eindhoven', 'NL', 51.45, 5.37), destination: pl('el prat', 'barcelona', 'ES', 41.297, 2.083), status: 'booked', ref: 'Q7TZ2L' }),
  S({ trip_id: 'bcn', kind: 'journey', title: 'r2 nord', mode: 'train', day: '2027-04-15', time: '10:00', end_time: '10:30', origin: pl('el prat t2 station', 'barcelona', 'ES', 41.304, 2.072), destination: pl('passeig de gràcia', 'barcelona', 'ES', 41.392, 2.165), position: 1 }),
  S({ trip_id: 'bcn', title: 'satan\'s coffee corner', day: '2027-04-15', position: 2, category: 'cafe', place: pl('satan\'s coffee', 'barcelona', 'ES', 41.383, 2.176) }),
  S({ trip_id: 'bcn', title: 'la boqueria', day: '2027-04-15', position: 3, category: 'shopping', place: pl('la boqueria', 'barcelona', 'ES', 41.3817, 2.1716) }),
  S({ trip_id: 'bcn', kind: 'note', title: 'buy t-casual card', day: '2027-04-15', position: 4 }),
  S({ trip_id: 'bcn', title: 'bunkers del carmel sunset', day: '2027-04-15', time: '19:30', category: 'sight', place: pl('bunkers del carmel', 'barcelona', 'ES', 41.419, 2.162) }),
  S({ trip_id: 'bcn', title: 'bar del pla', day: '2027-04-15', time: '21:30', category: 'restaurant', place: pl('bar del pla', 'barcelona', 'ES', 41.385, 2.180) }),
  // undated ideas
  S({ trip_id: 'bcn', title: 'park güell', saved: true, category: 'park', place: pl('park güell', 'barcelona', 'ES', 41.4145, 2.1527) }),
  S({ trip_id: 'bcn', title: 'nomad coffee', category: 'cafe', place: pl('nomad coffee', 'barcelona', 'ES', 41.388, 2.178) }),
]
const C = (o: any) => ({ id: id('c'), stop_id: null, currency: 'EUR', eur_rate: null, category: 'other', date: null, status: 'estimate', paid_by: null, split: 'even', ...o })
const costs = [
  C({ trip_id: 'eu', stop_id: stops[0].id, title: 'flight to amsterdam', amount: 142, category: 'transport', date: '2027-01-28', status: 'paid', paid_by: 'u-shanice' }),
  C({ trip_id: 'eu', stop_id: stops[2].id, title: 'student flat', amount: 3300, category: 'stay', status: 'paid', paid_by: 'u-shanice' }),
  C({ trip_id: 'par', stop_id: stops[10].id, title: 'hotel marais', amount: 480, category: 'stay', status: 'paid', paid_by: 'u-friend' }),
  C({ trip_id: 'par', title: 'food in paris', amount: 200, category: 'food' }),
  C({ trip_id: 'lap', stop_id: stops[16].id, title: 'glass igloo', amount: 900, category: 'stay' }),
  C({ trip_id: 'bcn', title: 'tapas crawl', amount: 60, category: 'food', status: 'paid', paid_by: 'u-friend' }),
  C({ trip_id: 'eu', title: 'sim card', amount: 20, currency: 'GBP', category: 'other', status: 'paid', paid_by: 'u-shanice' }),
  C({ trip_id: 'jp', stop_id: stops.find((s: any) => s.title === 'hop inn kyoto shijo omiya')!.id, title: 'hop inn kyoto shijo omiya', amount: 52000, currency: 'JPY', category: 'stays', date: '2024-10-07', status: 'paid', paid_by: 'u-friend' }),
  C({ trip_id: 'jp', stop_id: stops.find((s: any) => s.title === 'teamlab planets')!.id, title: 'teamlab planets', amount: 7600, currency: 'JPY', category: 'activities', date: '2024-10-05', status: 'paid', paid_by: 'u-shanice' }),
]
const L = (o: any) => ({ id: id('l'), note: '', created_at: '2026-10-02', ...o })
const links = [
  L({ trip_id: 'eu', url: 'https://www.ns.nl/en', title: 'dutch trains' }),
  L({ trip_id: 'eu', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: 'eindhoven city guide' }),
  L({ trip_id: 'par', url: 'https://www.instagram.com/p/abc/', title: 'cafe list', note: 'the one with the pistachio croissant' }),
  L({ trip_id: 'eu', url: 'https://www.tiktok.com/@x/video/1', title: 'hidden spots in utrecht' }),
  L({ trip_id: null, url: 'https://www.instagram.com/reel/Cinbox1/', title: 'instagram', note: 'rooftop bar?' }),
  L({ trip_id: null, url: 'https://youtu.be/xyz123', title: 'youtube' }),
]
const P = (o: any) => ({ id: id('p'), done: false, position: n, owner: null, packed_by: [], ...o })
// whose: shanice's, maya's, or (no owner) both, each ticked by whoever packed it
const packing = [
  P({ trip_id: 'eu', text: 'passport', owner: 'u-shanice', packed_by: ['u-shanice'] }), P({ trip_id: 'eu', text: 'residence letter', owner: 'u-shanice' }),
  P({ trip_id: 'eu', text: 'adapter (eu plug)', packed_by: ['u-shanice', 'u-friend'] }), P({ trip_id: 'eu', text: 'rain jacket', owner: 'u-friend' }),
  P({ trip_id: 'lap', text: 'thermal layers' }), P({ trip_id: 'lap', text: 'ski gloves' }),
]
const members = [
  { email: 'shanice@example.com', user_id: 'u-shanice', name: 'shanice', color: 0 },
  { email: 'friend@example.com', user_id: 'u-friend', name: 'maya', color: 3 },
]
const reviews = [
  { id: 'r1', stop_id: stops[22].id, author_id: 'u-shanice', rating: 5, return_choice: 'yes', outcome: 'done', comments: 'best custard tart ever' },
]
export const data = { trips, stops, costs, links, packing, files: [], members, reviews }
