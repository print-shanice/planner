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
