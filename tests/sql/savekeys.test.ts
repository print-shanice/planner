import { readFileSync } from 'node:fs'
import { makeDb, type Db } from './harness'
import { linkKey } from '../../src/lib/capture'

let d: Db
beforeEach(async () => { d = await makeDb() })

const ME = '00000000-0000-0000-0000-000000000001'
const lit = (s: string) => `'${s.replace(/'/g, "''")}'`

async function makeKey(email = 'shanice@x.com', uid = ME): Promise<string> {
  await d.as(email, uid)
  await d.q('select claim_member()')
  return (await d.q('select new_save_key() as k')).rows[0].k
}

async function trip(name: string, extra: { parent?: string; start?: string } = {}): Promise<string> {
  await d.admin()
  const parent = extra.parent ? lit(extra.parent) : 'null'
  const start = extra.start ? lit(extra.start) : 'null'
  return (await d.q(`insert into trips(name, currency, parent_id, start_date) values (${lit(name)}, 'EUR', ${parent}, ${start}) returning id`)).rows[0].id
}

const trips = async (key: string) => (await d.q(`select shortcut_trips(${lit(key)}) as t`)).rows[0].t
const save = async (key: string, url: string, tripLabel = 'inbox') =>
  (await d.q(`select shortcut_save(${lit(key)}, ${lit(url)}, ${lit(tripLabel)}) as r`)).rows[0].r
const links = async () => { await d.admin(); return (await d.q('select * from links order by created_at')).rows }

describe('save keys', () => {
  it('a member makes a long random key; only its hash is kept', async () => {
    const k = await makeKey()
    expect(k).toMatch(/^[0-9a-f]{64}$/)
    await d.admin()
    const row = (await d.q('select * from save_keys')).rows[0]
    expect(row.email).toBe('shanice@x.com')
    expect(JSON.stringify(row)).not.toContain(k)
  })

  it('a new key replaces the old one, which stops working', async () => {
    const old = await makeKey()
    const next = await makeKey()
    expect(next).not.toBe(old)
    await d.anon()
    await expect(trips(old)).rejects.toThrow(/save key not recognised/)
    expect(await trips(next)).toEqual(['inbox'])
  })

  it('has_save_key says whether you have one', async () => {
    await d.as('shanice@x.com')
    expect((await d.q('select has_save_key() as h')).rows[0].h).toBe(false)
    await makeKey()
    expect((await d.q('select has_save_key() as h')).rows[0].h).toBe(true)
    await d.as('k@x.com', '00000000-0000-0000-0000-0000000000aa')
    expect((await d.q('select has_save_key() as h')).rows[0].h).toBe(false)
  })

  it('a stranger cannot make a key', async () => {
    await d.as('stranger@x.com')
    await expect(d.q('select new_save_key()')).rejects.toThrow()
  })

  it('nobody signed in can make a key, and nobody can read the keys table', async () => {
    await d.anon()
    await expect(d.q('select new_save_key()')).rejects.toThrow()
    await expect(d.q('select * from save_keys')).rejects.toThrow()
    await d.as('shanice@x.com')
    await expect(d.q('select * from save_keys')).rejects.toThrow()
    await expect(d.q("insert into save_keys(email, hash) values ('shanice@x.com', '\\x00')")).rejects.toThrow()
  })

  it('the helpers behind the shortcut are not callable on their own', async () => {
    await d.anon()
    await expect(d.q("select save_key_member('x')")).rejects.toThrow(/permission denied/)
    await expect(d.q('select * from trip_labels()')).rejects.toThrow(/permission denied/)
  })
})

describe('the shortcut', () => {
  it('saving answers with a message, the same field an error comes back in', async () => {
    await d.admin()
    const t = (await d.q("select pg_get_function_result('public.shortcut_save(text, text, text)'::regprocedure) as t")).rows[0].t
    expect(t).toBe('json')
  })

  it('rerunning the schema replaces the first version, which answered in plain text', async () => {
    await d.admin()
    await d.q('drop function public.shortcut_save(text, text, text)')
    await d.q("create function public.shortcut_save(key text, url text, trip text default 'inbox') returns text language sql as $$ select 'old' $$")
    await d.db.exec(readFileSync('supabase/schema.sql', 'utf8'))
    const k = await makeKey()
    await d.anon()
    expect(await save(k, 'https://example.com')).toEqual({ message: 'saved to inbox' })
  })

  it('a wrong, empty or missing key gets nothing', async () => {
    await makeKey()
    await trip('euro summer')
    await d.anon()
    for (const k of ['nope', '', '0'.repeat(64)]) {
      await expect(trips(k)).rejects.toThrow(/save key not recognised/)
      await expect(save(k, 'https://example.com')).rejects.toThrow(/save key not recognised/)
    }
    await expect(d.q('select shortcut_trips(null)')).rejects.toThrow(/save key not recognised/)
    expect(await links()).toHaveLength(0)
  })

  it('a key pasted with spaces or a line break around it still works', async () => {
    const k = await makeKey()
    await d.anon()
    expect(await trips(` ${k}\n`)).toEqual(['inbox'])
    expect(await save(`\t${k} `, 'https://example.com')).toEqual({ message: 'saved to inbox' })
  })

  it('lists inbox then the trips, side trips under their parent, soonest first', async () => {
    const k = await makeKey()
    const eu = await trip('Euro Summer', { start: '2027-06-01' })
    await trip('Lapland', { start: '2027-01-10' })
    await trip('Paris', { parent: eu, start: '2027-06-12' })
    await trip('Amsterdam', { parent: eu, start: '2027-06-03' })
    await trip('someday')
    await d.anon()
    expect(await trips(k)).toEqual(['inbox', 'lapland', 'euro summer', 'euro summer · amsterdam', 'euro summer · paris', 'someday'])
  })

  it('two trips with the same name are told apart', async () => {
    const k = await makeKey()
    await trip('paris', { start: '2027-03-01' })
    await trip('paris', { start: '2027-05-01' })
    await d.anon()
    expect(await trips(k)).toEqual(['inbox', 'paris', 'paris 2'])
  })

  it('saves a reel to the picked trip as the key\'s owner', async () => {
    const k = await makeKey()
    const eu = await trip('euro summer')
    const paris = await trip('paris', { parent: eu })
    await d.anon()
    expect(await save(k, 'https://www.instagram.com/reel/C9x/?igsh=abc', 'euro summer · paris')).toEqual({ message: 'saved to euro summer · paris' })
    const [l] = await links()
    expect(l).toMatchObject({ trip_id: paris, url: 'https://www.instagram.com/reel/C9x/?igsh=abc', title: 'instagram', note: '', created_by: ME, stop_id: null })
  })

  it('inbox, or no trip, saves without a trip', async () => {
    const k = await makeKey()
    await d.anon()
    expect(await save(k, 'https://example.com/a')).toEqual({ message: 'saved to inbox' })
    expect((await d.q(`select shortcut_save(${lit(k)}, 'https://example.com/b') as r`)).rows[0].r).toEqual({ message: 'saved to inbox' })
    expect((await links()).map((l) => [l.trip_id, l.title])).toEqual([[null, 'example.com'], [null, 'example.com']])
  })

  it('finds the link inside shared text, without trailing punctuation', async () => {
    const k = await makeKey()
    await d.anon()
    await save(k, 'look at this!! https://vm.tiktok.com/ZM1/).')
    expect((await links())[0]).toMatchObject({ url: 'https://vm.tiktok.com/ZM1/', title: 'tiktok' })
  })

  it('no link, a strange link or a huge one is refused', async () => {
    const k = await makeKey()
    await d.anon()
    await expect(save(k, 'just words')).rejects.toThrow(/no link/)
    await expect(save(k, 'javascript:alert(1)')).rejects.toThrow(/no link/)
    await expect(save(k, `https://example.com/${'a'.repeat(2100)}`)).rejects.toThrow(/link too long/)
    expect(await links()).toHaveLength(0)
  })

  it('a trip that isn\'t in the list is refused', async () => {
    const k = await makeKey()
    await d.anon()
    await expect(save(k, 'https://example.com', 'atlantis')).rejects.toThrow(/trip not found/)
  })

  it('the same reel twice is one link, moved to where it was shared now', async () => {
    const k = await makeKey()
    const lapland = await trip('lapland')
    await d.anon()
    await save(k, 'https://www.instagram.com/reel/C9x/?igsh=abc')
    expect(await save(k, 'https://instagram.com/reels/C9x?igsh=zzz', 'lapland')).toEqual({ message: 'already saved · now in lapland' })
    const all = await links()
    expect(all).toHaveLength(1)
    expect(all[0].trip_id).toBe(lapland)
  })

  it('a link moved to another trip lets go of the old trip\'s place', async () => {
    const k = await makeKey()
    const a = await trip('a')
    await trip('b')
    await d.admin()
    const s = (await d.q(`insert into stops(trip_id, kind, title) values ('${a}', 'place', 'cafe') returning id`)).rows[0].id
    await d.q(`insert into links(trip_id, url, stop_id) values ('${a}', 'https://example.com/x', '${s}')`)
    await d.anon()
    await save(k, 'https://example.com/x', 'a')
    expect((await links())[0].stop_id).toBe(s)
    await save(k, 'https://example.com/x', 'b')
    expect((await links())[0].stop_id).toBeNull()
  })

  it('a key stops working when its member is removed', async () => {
    const k = await makeKey()
    await d.admin()
    await d.q("delete from members where email = 'shanice@x.com'")
    await d.anon()
    await expect(trips(k)).rejects.toThrow(/save key not recognised/)
  })

  it('anyone signed out still cannot touch the tables directly', async () => {
    await makeKey()
    await d.anon()
    await expect(d.q('select * from trips')).rejects.toThrow()
    await expect(d.q("insert into links(url) values ('https://x.com')")).rejects.toThrow()
  })
})

describe('link_key matches the app', () => {
  const urls = [
    'https://www.instagram.com/reel/C9x/?igsh=abc',
    'https://instagram.com/reels/C9x',
    'https://www.instagram.com/p/AbC12/?utm_source=ig_web_copy_link',
    'https://instagr.am/tv/XYZ/',
    'https://www.tiktok.com/@someone/video/7312345?is_from_webapp=1&sender_device=pc',
    'https://vm.tiktok.com/ZM1/',
    'https://youtu.be/dQw4w9WgXcQ?si=xyz',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42',
    'https://m.youtube.com/shorts/abc123',
    'https://music.youtube.com/watch?v=q1',
    'https://example.com/Some/Page/?utm_source=x&b=2&a=1',
    'https://www.example.com/page',
    'https://example.com/',
  ]
  it.each(urls)('%s', async (u) => {
    expect((await d.q(`select link_key(${lit(u)}) as k`)).rows[0].k).toBe(linkKey(u))
  })
})
