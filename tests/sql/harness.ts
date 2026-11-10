import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

// Minimal stand-ins for what Supabase provides, so schema.sql runs unchanged.
const STUBS = `
create schema if not exists auth;
create schema if not exists storage;
create role authenticated nologin;
create role anon nologin;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create function auth.email() returns text language sql stable as $$ select nullif(current_setting('test.email', true), '') $$;
create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
grant usage on schema auth, storage, public to authenticated, anon;
grant execute on all functions in schema auth to authenticated, anon;
grant select, insert, update, delete on storage.objects to authenticated;
create publication supabase_realtime;
-- like supabase: anything new in public is open to anon and authenticated unless schema.sql takes it back
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
`

export type Db = {
  db: PGlite
  as: (email: string, uid?: string) => Promise<void>
  admin: () => Promise<void>
  anon: () => Promise<void>
  q:(sql: string) => Promise<{ rows: any[] }>
}

export async function makeDb(extraSql = ''): Promise<Db> {
  const db = new PGlite()
  await db.exec(STUBS)
  await db.exec(readFileSync('supabase/schema.sql', 'utf8'))
  await db.exec(`insert into public.members(email, name, color) values ('shanice@x.com','shanice',0), ('k@x.com','k',1);`)
  if (extraSql) await db.exec(extraSql)
  return {
    db,
    as: async (email, uid = '00000000-0000-0000-0000-000000000001') => {
      await db.exec(`reset role; select set_config('test.email', '${email}', false); select set_config('test.uid', '${uid}', false); set role authenticated;`)
    },
    admin: async () => { await db.exec('reset role;') },
    // signed out: what a phone shortcut calling the api with only the publishable key is
    anon: async () => {
      await db.exec(`reset role; select set_config('test.email', '', false); select set_config('test.uid', '', false); set role anon;`)
    },
    q: (sql) => db.query(sql) as Promise<{ rows: any[] }>,
  }
}
