# planner

A shared travel planner for two. React + Supabase, hosted on GitHub Pages.

## Setup

1. Create a free project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run `supabase/schema.sql`. If you have a `seed.sql` with existing trips, run it next.
3. Add each person who may use the planner:
   ```sql
   insert into members(email, name, color) values ('you@example.com', 'you', 0);
   insert into members(email, name, color) values ('friend@example.com', 'friend', 1);
   ```
4. In **Authentication → Sign In / Providers**, turn off **Allow new users to sign up** (leave the Email provider on).
5. In **Authentication → URL Configuration**, set both the **Site URL** and a **Redirect URL** to `https://<username>.github.io/planner/`.
6. In **Authentication → Emails → SMTP Settings**, connect an email account (for Gmail: host `smtp.gmail.com`, port `587`, your address, and a Google app password). Supabase's built-in sender only reaches members of your Supabase organisation and locks the templates.
7. In **Authentication → Emails → Templates → Magic Link**, add `<p>or enter this code: {{ .Token }}</p>` so the email also carries a code (the app installed on an iPhone home screen signs in with the code).
8. In **Authentication → Users**, use **Add user → Create new user** for each email (any password, keep **Auto Confirm User** ticked).
9. In the GitHub repo, **Settings → Secrets and variables → Actions → Variables**, add:
   - `VITE_SUPABASE_URL`: the project URL, `https://<ref>.supabase.co`, with nothing after `.co` (Supabase **Connect**, or **Project Settings → Data API**)
   - `VITE_SUPABASE_ANON_KEY`: the **publishable** key (`sb_publishable_…`). Never the secret key: the site is public. The build stops if it gets one.
10. In **Settings → Pages**, set **Source** to **GitHub Actions**.
11. Push to `main`. The workflow tests, builds and publishes to `https://<username>.github.io/planner/`.

To use it as an app on an iPhone: open the site in Safari, then **Share → Add to Home Screen**.

A free Supabase project pauses after a week without use. If the planner says it is asleep, open the Supabase dashboard and restore the project.

## Develop

```sh
npm install
npm run dev
npm test
```

Put `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local` for local development.
