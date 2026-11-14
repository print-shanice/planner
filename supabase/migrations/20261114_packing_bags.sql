-- which bag a thing goes in: checked in, carried on, or worn to the airport (none = not decided)
alter table public.packing add column if not exists bag text check (bag in ('check', 'carry', 'wear'));
