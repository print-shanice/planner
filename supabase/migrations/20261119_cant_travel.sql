-- days you can't travel (exams) live beside your own holidays, marked busy
alter table public.days_off add column if not exists busy boolean not null default false;
