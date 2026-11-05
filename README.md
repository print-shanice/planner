# planner

a little travel planner for two. i made it to plan my europe exchange with a friend: one long semester abroad with a bunch of side trips inside it. wanderlog didn't like how long our trip was, so i built my own.

![planner on a phone](screenshots/phone.png)

## what it does

- **trips inside trips.** one big trip (the semester) with side trips inside it (lisbon, rome, …), as deep as you want.
- **day by day plan.** every day gets a card with numbered stops, how long the walk is between them, and drag to reorder. stays show up on every night you're there, flights and trains show their times.
- **search for places.** type a place and add it to a day, or save it for later.
- **map.** every stop is a pin in its day's colour, with the day's route drawn between them. tap anywhere to add or save a spot, or open it in google maps.
- **money.** prices in any currency, converted with live rates. a budget bar, totals by category, who paid what, and who owes who.
- **tickets.** attach pdfs and screenshots to a booking. once opened they stay on your phone, so they work without signal.
- **saved stuff.** instagram reels, tiktoks, youtube videos and random links, kept with the trip they're for.
- **packing list.** tick things off as you pack.
- **a globe on the home page** that spins and fills in every country we've been to or are going to. tap a country to jump to that trip.
- **works offline.** everything is viewable without internet (editing waits until you're back online).
- **shared and live.** we both sign in with our email, and changes show up on the other person's phone straight away.
- **private.** the site is public but the data isn't: only the emails on the list can see or change anything.
- **add to home screen** on an iphone and it opens like an app.

![planner on a laptop](screenshots/laptop.png)

<sub>the screenshots use a made-up trip.</sub>

## what it's made with

react, vite and typescript, hosted for free on github pages. supabase for sign-in, the database (with row level security so only members can read anything), live updates and ticket storage. maplibre with openfreemap for maps, photon for place search, the osrm foot router for walking times, and frankfurter for ecb exchange rates. all free.

## run your own

1. make a free project on [supabase](https://supabase.com).
2. in the sql editor, run `supabase/schema.sql`.
3. add the people who can use it:
   ```sql
   insert into members(email, name, color) values ('you@example.com', 'you', 0);
   insert into members(email, name, color) values ('friend@example.com', 'friend', 1);
   ```
4. in authentication → sign in / providers, turn off "allow new users to sign up" (keep the email provider on).
5. in authentication → url configuration, set the site url and a redirect url to `https://<username>.github.io/planner/`.
6. in authentication → emails → smtp settings, connect an email account (for gmail: host `smtp.gmail.com`, port `587`, your address and a google app password). supabase's own sender only emails people in your supabase organisation.
7. in authentication → emails → templates → magic link, add `<p>or enter this code: {{ .Token }}</p>`, so the email has a code too (the home screen app on an iphone signs in with the code).
8. in authentication → users, add each email with "create new user" (any password, keep "auto confirm user" ticked).
9. in the github repo, go to settings → secrets and variables → actions → variables and add:
   - `VITE_SUPABASE_URL`: the project url, `https://<ref>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY`: the publishable key (`sb_publishable_…`). never the secret key, the site is public (the build stops if you try).
10. in settings → pages, set the source to github actions.
11. push to `main`. it tests, builds and goes live at `https://<username>.github.io/planner/`.

a free supabase project goes to sleep after a week of no use. if the planner says it's asleep, open the supabase dashboard and wake it up.

## working on it

```sh
npm install
npm run dev
npm test
```

put `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local` to run it locally.
