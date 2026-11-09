# planner

a little travel planner for two. i made it to plan my europe exchange with a friend: one long semester abroad with a bunch of side trips inside it. tried to find websites suited for this, but wanderlog didn't like how long our trip was, so i built my own.

![planner on a phone](screenshots/phone.png)

## what it does

- **trips inside trips.** one big trip (the semester) with side trips inside it (lisbon, rome, …), as deep as you want.
- **the plan is one document.** every day with something on it, open, one after another, with how long the walk is between places. drag (or use the arrow keys) to reorder. stays show up on every night you're there, flights and trains show their times.
- **places have a kind.** café, restaurant, museum, park, shop, stay… each with its own icon, in the plan and on the map.
- **dates are optional.** save a café or a whole side trip before you know when. put it on a day later, move it, or take it off again.
- **search for places.** google places when it's set up (openstreetmap otherwise): type a name and add it to a day, or keep it as an idea.
- **map.** google maps with every stop as a pin in its trip's colour, numbered, with the walk drawn along the streets. ideas show as quiet pins. open anything in google maps to actually go there.
- **money.** prices in any currency, converted with live rates. a budget bar, totals by category, who paid what, and who owes who.
- **tickets.** attach pdfs and screenshots to a booking. once opened they stay on your phone, so they work without signal.
- **saved stuff.** instagram reels, tiktoks, youtube videos and random links: share them to the planner (shortcut on iphone, share sheet on android) or paste them in. they wait in an inbox until you put them on a trip, and can belong to a place.
- **packing list.** tick things off as you pack.
- **a globe on the home page** that spins and fills in every country we've been to or are going to. tap a country to jump to that trip.
- **works offline.** everything is viewable without internet (editing waits until you're back online).
- **shared and live.** we both sign in with our email, and changes show up on the other person's phone straight away.
- **private.** the site is public but the data isn't: only the emails on the list can see or change anything.
- **add to home screen** on an iphone and it opens like an app.

![planner on a laptop](screenshots/laptop.png)


## what it's made with

react, vite and typescript, hosted for free on github pages. supabase for sign-in, the database (with row level security so only members can read anything), live updates and ticket storage. google maps for the trip map, place search and walking routes (within google's free monthly allowance for two people), maplibre for the home globe, photon and the osrm foot router when google isn't set up, and frankfurter for ecb exchange rates.

## setting up google maps

the trip map, place search and walking routes use three google apis, each billed on its own. the planner only asks for what it shows:

| what | api | sku it uses | free each month |
|---|---|---|---|
| the map | maps javascript api | dynamic maps (essentials) | 10,000 loads |
| search as you type | places api (new) | autocomplete requests (essentials) | 10,000 |
| the place you pick | places api (new) | place details essentials (location, address, types only) | 10,000 |
| tapping one of google's own map labels | places api (new) | place details pro (adds the name) | 5,000 |
| walking time, distance and line | routes api | compute routes essentials (≤ 10 stops between) | 10,000 |

check the current numbers on [google's pricing page](https://developers.google.com/maps/billing-and-pricing/pricing). to keep it cheap the map is loaded once per visit and only when a map is on screen, search waits for three letters and a pause and uses one session per search, routes are asked for only for the days you're looking at (one request per stretch of walking) and kept in memory for the visit, and no photos, reviews or ratings are ever requested.

1. in the [google cloud console](https://console.cloud.google.com/), create a project and link a billing account (billing has to be on, even for the free allowance).
2. enable **maps javascript api**, **places api (new)** and **routes api** (apis & services → library).
3. create an api key (apis & services → credentials) and restrict it:
   - **application restrictions → websites:** `https://print-shanice.github.io/*` and, for local work, `http://localhost:5180/*` (`npm run dev` always uses port 5180). leave the path off the github one: browsers only tell google the site (`https://print-shanice.github.io/`), not the page, so an entry ending in `/planner/*` blocks the live site
   - **api restrictions:** only the three apis above
4. create a **map id** (google maps platform → map management → create map id, type javascript, vector). it's needed for the pins. without one the planner uses google's demo id, which is fine for trying it out.
5. add two repository variables (settings → secrets and variables → actions → variables): `VITE_GOOGLE_MAPS_KEY` (the key) and `VITE_GOOGLE_MAP_ID` (the map id), and the same two lines in `.env.local` for `npm run dev`. the key ends up in the page, which is why step 3's restrictions matter. never put a key without restrictions here.
6. limit what it can cost:
   - **quotas actually stop usage.** in apis & services → each api → quotas, set a per-day cap, for example maps javascript api map loads 300/day, places autocomplete 300/day, place details 200/day, compute routes 300/day. past the cap google refuses requests (the map says so) until the next day.
   - **budget alerts only email you.** billing → budgets & alerts, e.g. a €5 budget with alerts at 50/90/100%. they don't stop anything on their own.

without a key the planner still works: the map area says it isn't set up, search uses openstreetmap, and walking times come from the osrm router. offline, the plan and any tickets you've opened before still work; the map says it needs a connection.

google's terms let the planner keep a place's google id for good, but its coordinates only for 30 days: places found through google remember when they were looked up and are refreshed by their id after 30 days, while the map is open. search results and routes are never stored.

## saving reels from your phone

**android (chrome):** install the planner to your home screen, then share a reel or link and pick **planner**.

**iphone:** safari and home-screen apps can't appear in the share sheet themselves, so use a shortcut:

1. open the **shortcuts** app → **+** → name it **save to planner**.
2. tap the **i** (details) → turn on **show in share sheet**, and set it to receive **urls** and **text**.
3. add **url encode** (input: shortcut input).
4. add **text** with: `https://print-shanice.github.io/planner/#/save?url=` followed by the **url encoded text** variable.
5. add **open urls** (input: the text from step 4).

now in instagram, tiktok or youtube: share → **save to planner**. it opens the planner in safari with the link filled in; add a title, note or trip if you like (or leave it in the inbox) and save. safari keeps its own sign-in, separate from the home-screen app, so sign in once in safari too. if you aren't signed in yet, the link waits on the phone (not saved) until you are. you can also paste any link with **+ → link**.
