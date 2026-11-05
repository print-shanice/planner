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
