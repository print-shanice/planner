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
