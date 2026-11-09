import { readFileSync } from 'node:fs'
import { makeDb, type Db } from './harness'

let d: Db
beforeEach(async () => { d = await makeDb() })

it('member can insert and read a trip', async () => {
  await d.as('shanice@x.com')
  await d.q("insert into trips(name, currency, color) values ('lapland', 'EUR', 1)")
  expect((await d.q('select * from trips')).rows).toHaveLength(1)
})

it('membership ignores email case', async () => {
  await d.as('Shanice@X.com')
  await d.q("insert into trips(name, currency, color) values ('lapland', 'EUR', 1)")
  expect((await d.q('select * from trips')).rows).toHaveLength(1)
})

it('non-member reads nothing', async () => {
  await d.as('shanice@x.com')
  await d.q("insert into trips(name, currency, color) values ('lapland', 'EUR', 1)")
  await d.as('stranger@x.com')
  expect((await d.q('select * from trips')).rows).toHaveLength(0)
})

it('non-member cannot insert', async () => {
  await d.as('stranger@x.com')
  await expect(d.q("insert into trips(name, currency, color) values ('x', 'EUR', 0)")).rejects.toThrow(/row-level security/)
})

it('cannot delete a trip that has side trips', async () => {
  await d.as('shanice@x.com')
  const p = (await d.q("insert into trips(name, currency) values ('eu', 'SGD') returning id")).rows[0].id
  await d.q(`insert into trips(name, currency, parent_id) values ('lapland', 'EUR', '${p}')`)
  await expect(d.q(`delete from trips where id = '${p}'`)).rejects.toThrow(/foreign key/)
})

it('deleting a trip cascades its stops and costs', async () => {
  await d.as('shanice@x.com')
  const t = (await d.q("insert into trips(name, currency) values ('lapland', 'EUR') returning id")).rows[0].id
  const s = (await d.q(`insert into stops(trip_id, kind, title) values ('${t}', 'place', 'arktikum') returning id`)).rows[0].id
  await d.q(`insert into costs(trip_id, stop_id, amount, currency) values ('${t}', '${s}', 68, 'EUR')`)
  await d.q(`delete from trips where id = '${t}'`)
  expect((await d.q('select * from stops')).rows).toHaveLength(0)
  expect((await d.q('select * from costs')).rows).toHaveLength(0)
})

it('claim_member records the user id', async () => {
  await d.as('k@x.com', '00000000-0000-0000-0000-0000000000aa')
  await d.q('select claim_member()')
  await d.admin()
  expect((await d.q("select user_id from members where email = 'k@x.com'")).rows[0].user_id).toBe('00000000-0000-0000-0000-0000000000aa')
})

it('members table is not writable from the app', async () => {
  await d.as('shanice@x.com')
  await expect(d.q("insert into members(email, name) values ('evil@x.com', 'evil')")).rejects.toThrow()
})

it('created_by defaults to the signed-in user', async () => {
  await d.as('shanice@x.com', '00000000-0000-0000-0000-0000000000bb')
  const row = (await d.q("insert into trips(name, currency) values ('x', 'EUR') returning created_by")).rows[0]
  expect(row.created_by).toBe('00000000-0000-0000-0000-0000000000bb')
})

it('files in storage are member-only', async () => {
  await d.as('shanice@x.com')
  await d.q("insert into storage.objects(bucket_id, name) values ('files', 'a/b.pdf')")
  await d.as('stranger@x.com')
  expect((await d.q('select * from storage.objects')).rows).toHaveLength(0)
})

it('schema can be run twice without errors', async () => {
  const { readFileSync } = await import('node:fs')
  await d.admin()
  await expect(d.db.exec(readFileSync('supabase/schema.sql', 'utf8'))).resolves.toBeDefined()
})

it('costs say who they are for; rerunning the schema spells out older rows', async () => {
  await d.admin()
  await d.q(`update members set user_id = '00000000-0000-0000-0000-00000000000a' where email = 'shanice@x.com'`)
  await d.q(`update members set user_id = '00000000-0000-0000-0000-00000000000b' where email = 'k@x.com'`)
  const t = (await d.q("insert into trips(name, currency) values ('eu', 'EUR') returning id")).rows[0].id
  await d.q(`insert into costs(trip_id, amount, currency, split) values ('${t}', 40, 'EUR', 'even'), ('${t}', 10, 'EUR', '00000000-0000-0000-0000-00000000000b')`)
  await d.q(`insert into costs(trip_id, amount, currency, split_among, split_amounts) values ('${t}', 30, 'EUR', array['00000000-0000-0000-0000-00000000000a']::uuid[], '{"00000000-0000-0000-0000-00000000000a": 30}')`)
  await d.db.exec(readFileSync('supabase/schema.sql', 'utf8'))
  const rows = (await d.q('select amount, split_among, split_amounts from costs order by amount')).rows
  expect(rows.map((r) => [Number(r.amount), [...r.split_among].sort()])).toEqual([
    [10, ['00000000-0000-0000-0000-00000000000b']],
    [30, ['00000000-0000-0000-0000-00000000000a']],
    [40, ['00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b']],
  ])
  expect(rows[1].split_amounts).toEqual({ '00000000-0000-0000-0000-00000000000a': 30 })
})

it('a saved link can point at a place, and outlives it', async () => {
  await d.as('shanice@x.com')
  const t = (await d.q("insert into trips(name, currency) values ('eu', 'EUR') returning id")).rows[0].id
  const s = (await d.q(`insert into stops(trip_id, kind, title) values ('${t}', 'place', 'cafe') returning id`)).rows[0].id
  await d.q(`insert into links(url, stop_id) values ('https://instagram.com/reel/a', '${s}')`)
  await d.q(`delete from stops where id = '${s}'`)
  const rows = (await d.q('select trip_id, stop_id from links')).rows
  expect(rows).toEqual([{ trip_id: null, stop_id: null }])
})
