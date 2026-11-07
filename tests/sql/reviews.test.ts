import { makeDb, type Db } from './harness'
let db: Db
beforeAll(async () => { db = await makeDb() })
afterAll(async () => { await db.db.close() })
it('reviews are readable by members and writable only by their author', async () => {
  await db.as('shanice@x.com')
  const t = (await db.q("insert into trips(name) values ('sample') returning id")).rows[0].id
  const s = (await db.q(`insert into stops(trip_id, kind, title) values ('${t}', 'place', 'cafe') returning id`)).rows[0].id
  const r = (await db.q(`insert into reviews(stop_id, rating, outcome) values ('${s}', 4, 'done') returning id`)).rows[0].id
  await expect(db.q(`insert into reviews(stop_id, rating) values ('${s}', 6)`)).rejects.toThrow()
  await db.as('k@x.com', '00000000-0000-0000-0000-000000000002')
  expect((await db.q('select * from reviews')).rows).toHaveLength(1)
  expect((await db.q(`update reviews set rating = 1 where id = '${r}' returning id`)).rows).toHaveLength(0)
  await expect(db.q(`insert into reviews(stop_id, author_id) values ('${s}', '00000000-0000-0000-0000-000000000001')`)).rejects.toThrow()
  await db.as('stranger@x.com')
  expect((await db.q('select * from reviews')).rows).toHaveLength(0)
})
