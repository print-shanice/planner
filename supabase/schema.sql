-- planner database. Run once in the Supabase SQL editor.

create table if not exists public.members (
  email text primary key,
  user_id uuid,
  name text not null default '',
  color smallint not null default 0
);

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where lower(email) = lower(auth.email()))
$$;

create or replace function public.claim_member() returns void
language sql security definer set search_path = public as $$
  update public.members set user_id = auth.uid() where lower(email) = lower(auth.email())
$$;

create or replace function public.touch() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.trips(id) on delete restrict,
  name text not null,
  start_date date,
  end_date date,
  currency text not null default 'EUR' check (char_length(currency) = 3),
  budget numeric,
  color smallint not null default 0,
  base jsonb,
  notes text not null default '',
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stops (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  kind text not null check (kind in ('place', 'stay', 'journey', 'note')),
  title text not null default '',
  day date,
  position integer not null default 0,
  time text,
  end_date date,
  end_time text,
  place jsonb,
  mode text check (mode in ('flight', 'train', 'bus', 'ferry')),
  origin jsonb,
  destination jsonb,
  status text not null default 'idea' check (status in ('idea', 'to_book', 'booked')),
  saved boolean not null default false,
  url text not null default '',
  ref text not null default '',
  notes text not null default '',
  category text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.costs (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  stop_id uuid references public.stops(id) on delete cascade,
  title text not null default '',
  amount numeric not null,
  currency text not null check (char_length(currency) = 3),
  eur_rate numeric,
  category text not null default 'other',
  date date,
  status text not null default 'estimate' check (status in ('estimate', 'paid')),
  paid_by uuid,
  split text not null default 'even',
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- who a cost is for: the people when it was saved, and exact shares when it isn't even
alter table public.costs add column if not exists split_among uuid[];
alter table public.costs add column if not exists split_amounts jsonb;
-- older rows spell out who they were for, so someone joining later never shares old costs
update public.costs set split_among = (select coalesce(array_agg(m.user_id order by m.email), '{}') from public.members m where m.user_id is not null)
  where split_among is null and split = 'even';
update public.costs set split_among = array[split::uuid]
  where split_among is null and split ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

create table if not exists public.links (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references public.trips(id) on delete cascade,
  url text not null,
  title text not null default '',
  note text not null default '',
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- a saved reel or page can belong to a place in the plan; deleting the place keeps the link
alter table public.links add column if not exists stop_id uuid references public.stops(id) on delete set null;
create index if not exists links_stop on public.links(stop_id);

create table if not exists public.packing (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  text text not null,
  done boolean not null default false,
  position integer not null default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  stop_id uuid not null references public.stops(id) on delete cascade,
  path text not null,
  name text not null default '',
  mime text not null default '',
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stops_trip on public.stops(trip_id);
create index if not exists costs_trip on public.costs(trip_id);
create index if not exists trips_parent on public.trips(parent_id);

-- only the two members can see or change anything
alter table public.members enable row level security;
drop policy if exists members_select on public.members;
create policy members_select on public.members for select to authenticated using (public.is_member());

do $$
declare t text;
begin
  foreach t in array array['trips', 'stops', 'costs', 'links', 'packing', 'files'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_member())', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_member())', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_member()) with check (public.is_member())', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_member())', t || '_delete', t);
    execute format('drop trigger if exists %I on public.%I', t || '_touch', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.touch()', t || '_touch', t);
  end loop;
end $$;

revoke all on public.members from anon, authenticated;
grant select on public.members to authenticated;
grant select, insert, update, delete on public.trips, public.stops, public.costs, public.links, public.packing, public.files to authenticated;
revoke all on public.trips, public.stops, public.costs, public.links, public.packing, public.files from anon;
grant execute on function public.is_member() to authenticated;
grant execute on function public.claim_member() to authenticated;

-- private bucket for tickets
insert into storage.buckets (id, name, public) values ('files', 'files', false) on conflict (id) do nothing;
drop policy if exists files_members on storage.objects;
create policy files_members on storage.objects for all to authenticated
  using (bucket_id = 'files' and public.is_member())
  with check (bucket_id = 'files' and public.is_member());

-- live updates
do $$
declare t text;
begin
  foreach t in array array['trips', 'stops', 'costs', 'links', 'packing', 'files'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  stop_id uuid not null references public.stops(id) on delete cascade,
  author_id uuid not null default auth.uid(),
  rating integer check (rating between 1 and 5),
  return_choice text check (return_choice in ('yes', 'maybe', 'no')),
  outcome text not null default 'planned' check (outcome in ('planned', 'done', 'skipped')),
  comments text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (stop_id, author_id)
);
alter table public.reviews enable row level security;
drop policy if exists reviews_read on public.reviews;
create policy reviews_read on public.reviews for select to authenticated using (public.is_member());
drop policy if exists reviews_insert on public.reviews;
create policy reviews_insert on public.reviews for insert to authenticated with check (public.is_member() and author_id = auth.uid());
drop policy if exists reviews_update on public.reviews;
create policy reviews_update on public.reviews for update to authenticated using (public.is_member() and author_id = auth.uid()) with check (public.is_member() and author_id = auth.uid());
drop policy if exists reviews_delete on public.reviews;
create policy reviews_delete on public.reviews for delete to authenticated using (public.is_member() and author_id = auth.uid());
drop trigger if exists reviews_touch on public.reviews;
create trigger reviews_touch before update on public.reviews for each row execute function public.touch();
grant select, insert, update, delete on public.reviews to authenticated;
revoke all on public.reviews from anon;
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reviews') then
    alter publication supabase_realtime add table public.reviews;
  end if;
end $$;

-- saving from the phone's share sheet (an apple shortcut) without signing in there.
-- each member can make a save key; only its sha256 is kept and the key itself is shown once.
-- a key can do two things: list the trips' names and add a link. a new key replaces the old one.
create table if not exists public.save_keys (
  email text primary key references public.members(email) on delete cascade on update cascade,
  hash bytea not null unique,
  created_at timestamptz not null default now()
);
alter table public.save_keys enable row level security;
revoke all on public.save_keys from public, anon, authenticated;

create or replace function public.new_save_key() returns text
language plpgsql volatile security definer set search_path = public as $$
declare m text; k text;
begin
  select email into m from public.members where lower(email) = lower(auth.email());
  if m is null then raise exception 'not a member' using errcode = '42501'; end if;
  k := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.save_keys(email, hash) values (m, sha256(convert_to(k, 'UTF8')))
    on conflict (email) do update set hash = excluded.hash, created_at = now();
  return k;
end $$;

create or replace function public.has_save_key() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.save_keys s join public.members m on m.email = s.email where lower(m.email) = lower(auth.email()))
$$;

-- whose key this is (null when it isn't one); spaces or line breaks pasted around it don't count
create or replace function public.save_key_member(key text) returns text
language sql stable security definer set search_path = public as $$
  select s.email from public.save_keys s, lateral (select btrim(coalesce(key, ''), E' \t\r\n') as k) x
  where char_length(x.k) between 32 and 200 and s.hash = sha256(convert_to(x.k, 'UTF8'))
$$;

-- the shortcut's menu: inbox, then each trip with side trips under it ("parent · side trip"), soonest first
create or replace function public.trip_labels() returns table(id uuid, label text, ord text[])
language sql stable security definer set search_path = public as $$
  with recursive tree as (
    select t.id, lower(trim(t.name)) as name, lower(trim(t.name)) as label,
      array[coalesce(t.start_date::text, '9999-12-31') || ' ' || lower(t.name) || ' ' || t.id::text] as ord
    from public.trips t where t.parent_id is null
    union all
    select c.id, lower(trim(c.name)), tree.name || ' · ' || lower(trim(c.name)),
      tree.ord || (coalesce(c.start_date::text, '9999-12-31') || ' ' || lower(c.name) || ' ' || c.id::text)
    from public.trips c join tree on c.parent_id = tree.id
    where cardinality(tree.ord) < 8
  ), named as (
    select null::uuid as id, 'inbox'::text as label, array['']::text[] as ord
    union all select tree.id, tree.label, tree.ord from tree
  )
  select x.id, case when x.n = 1 then x.label else x.label || ' ' || x.n end, x.ord
  from (select named.*, row_number() over (partition by named.label order by named.ord) as n from named) x
$$;

-- the site a link is on, like the app's host(): lowercased, without www. m. vm. vt.
create or replace function public.link_host(u text) returns text
language sql immutable set search_path = public as $$
  select regexp_replace(lower(substring(u from '^[a-zA-Z][a-zA-Z0-9+.-]*://(?:[^/?#@]*@)?([^/?#:]+)')), '^(www|m|vm|vt)\.', '')
$$;

-- one key per thing saved, the same as linkKey() in src/lib/capture.ts
create or replace function public.link_key(u text) returns text
language plpgsql immutable set search_path = public as $$
declare h text; p text; q text; m text[];
begin
  h := coalesce(public.link_host(u), '');
  p := coalesce(substring(u from '^[a-zA-Z][a-zA-Z0-9+.-]*://[^/?#]*([^?#]*)'), '');
  if h in ('instagram.com', 'instagr.am') then
    m := regexp_match(p, '/(reel|reels|p|tv)/([^/]+)');
    if m is not null then return 'instagram:' || m[2]; end if;
  elsif h = 'tiktok.com' then
    m := regexp_match(p, '/video/([^/]+)');
    if m is not null then return 'tiktok:' || m[1]; end if;
  elsif h in ('youtube.com', 'youtu.be', 'music.youtube.com') then
    if h = 'youtu.be' then m := regexp_match(p, '^/([^/]+)');
    else
      m := regexp_match(u, '[?&]v=([^&#]+)');
      if m is null then m := regexp_match(p, '^/(?:shorts|embed|live)/([^/]+)'); end if;
    end if;
    if m is not null then return 'youtube:' || m[1]; end if;
  end if;
  select string_agg(case when x like '%=%' then x else x || '=' end, '&' order by lower(split_part(x, '=', 1)), split_part(x, '=', 1))
    into q
    from unnest(string_to_array(substring(u from '\?([^#]*)'), '&')) x
    where x <> '' and split_part(x, '=', 1) !~* '^(utm_\w+|igsh|igshid|si|fbclid|gclid|mc_\w+|ref|ref_src|is_from_webapp|sender_device|feature|t|s|_r)$';
  return h || lower(regexp_replace(p, '/+$', '')) || coalesce('?' || q, '');
end $$;

create or replace function public.shortcut_trips(key text) returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if public.save_key_member(key) is null then raise exception 'save key not recognised' using errcode = '28000'; end if;
  return (select json_agg(t.label order by t.ord) from public.trip_labels() t);
end $$;

-- saves the first link in what was shared to the trip picked from shortcut_trips; the same reel again moves it there.
-- the note is your own reminder of why you kept it. it answers {"message": …}, the field an error comes back in too,
-- so the shortcut shows either one
-- earlier versions took no note (and the first answered in plain text): one version only, so the api can't pick the wrong one
drop function if exists public.shortcut_save(text, text, text);
create or replace function public.shortcut_save(key text, url text, trip text default 'inbox', note text default '') returns json
language plpgsql volatile security definer set search_path = public as $$
#variable_conflict use_column
declare who text; uid uuid; raw text; u text; t uuid; lbl text; k text; n text; was public.links;
begin
  who := public.save_key_member(shortcut_save.key);
  if who is null then raise exception 'save key not recognised' using errcode = '28000'; end if;
  raw := coalesce(shortcut_save.url, '');
  if char_length(raw) > 10000 then raise exception 'link too long' using errcode = '22023'; end if;
  u := substring(raw from '(?i)(https?://[^\s<>"'']+|www\.[^\s<>"'']+)');
  if u is null then
    -- say what arrived, so a share that carries no link can be told apart from an empty one
    raw := btrim(regexp_replace(raw, '\s+', ' ', 'g'));
    if raw = '' then raise exception 'nothing was shared' using errcode = '22023'; end if;
    raise exception 'no link in what was shared: “%”', left(raw, 60) || case when char_length(raw) > 60 then '…' else '' end using errcode = '22023';
  end if;
  u := regexp_replace(u, '[).,!?;:]+$', '');
  if u !~* '^https?://' then u := 'https://' || u; end if;
  if char_length(u) > 2048 then raise exception 'link too long' using errcode = '22023'; end if;

  lbl := lower(trim(coalesce(nullif(trim(shortcut_save.trip), ''), 'inbox')));
  select l.id, l.label into t, lbl from public.trip_labels() l where l.label = lbl;
  if not found then raise exception 'trip not found' using errcode = '22023'; end if;

  n := left(btrim(regexp_replace(coalesce(shortcut_save.note, ''), '\s+', ' ', 'g')), 1000);
  select user_id into uid from public.members where email = who;
  k := public.link_key(u);
  select * into was from public.links l where public.link_key(l.url) = k order by l.created_at limit 1;
  if found then
    update public.links set trip_id = t, stop_id = case when was.trip_id is not distinct from t then was.stop_id end,
      note = case when n <> '' then n else was.note end where id = was.id;
    return json_build_object('message', 'already saved · now in ' || lbl);
  end if;
  insert into public.links(trip_id, url, title, note, created_by)
    values (t, u, case public.link_host(u)
      when 'instagram.com' then 'instagram' when 'instagr.am' then 'instagram' when 'tiktok.com' then 'tiktok'
      when 'youtube.com' then 'youtube' when 'youtu.be' then 'youtube' when 'music.youtube.com' then 'youtube'
      else regexp_replace(lower(substring(u from '^[a-zA-Z][a-zA-Z0-9+.-]*://(?:[^/?#@]*@)?([^/?#:]+)')), '^www\.', '') end, n, uid);
  return json_build_object('message', 'saved to ' || lbl);
end $$;

revoke all on function public.save_key_member(text), public.trip_labels(), public.link_host(text), public.link_key(text) from public, anon, authenticated;
revoke all on function public.new_save_key(), public.has_save_key(), public.shortcut_trips(text), public.shortcut_save(text, text, text, text) from public, anon, authenticated;
grant execute on function public.new_save_key(), public.has_save_key() to authenticated;
grant execute on function public.shortcut_trips(text), public.shortcut_save(text, text, text, text) to anon, authenticated;
