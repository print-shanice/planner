import { afterEach, describe, expect, it, vi } from 'vitest'
import { openversePhoto } from '../../src/lib/openverse'

const result = (title: string, source = 'flickr', id = title.replace(/\W/g, '')) => ({
  id, title, source, thumbnail: `https://api.openverse.org/v1/images/${id}/thumb/`,
  url: `https://live.staticflickr.com/${id}_b.jpg`, foreign_landing_url: `https://www.flickr.com/photos/x/${id}`,
})
const answers = (...pages: unknown[][]) => {
  const fetch = vi.fn()
  for (const p of pages) fetch.mockResolvedValueOnce(new Response(JSON.stringify({ results: p }), { status: 200 }))
  fetch.mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200 }))
  return fetch
}
const q = (fetch: ReturnType<typeof vi.fn>, i: number) => new URL(String(fetch.mock.calls[i][0]))

afterEach(() => vi.unstubAllGlobals())

describe('a place\'s photo from openverse (open licence photos, mostly flickr)', () => {
  const bakery = { name: 'Du Pain et des Idées', city: 'Paris' }

  it('searches openverse for the name and its city', async () => {
    const fetch = answers([result('Du Pain et des Idées')])
    vi.stubGlobal('fetch', fetch)
    await openversePhoto(bakery)
    const url = q(fetch, 0)
    expect(url.origin + url.pathname).toBe('https://api.openverse.org/v1/images/')
    expect(url.searchParams.get('q')).toBe('Du Pain et des Idées Paris')
  })

  it('takes the first photo whose title plainly names the place: openverse\'s small copy, credited to where it\'s from', async () => {
    vi.stubGlobal('fetch', answers([result('canal saint martin'), result('Du Pain et des Idées', 'flickr', 'dp1')]))
    expect(await openversePhoto(bakery)).toEqual({
      src: 'https://api.openverse.org/v1/images/dp1/thumb/', page: 'https://www.flickr.com/photos/x/dp1', source: 'flickr',
    })
  })

  it('with nothing named so near the city, tries the name alone', async () => {
    const fetch = answers([result('canal saint martin')], [result('ICHIRAN Shibuya', 'flickr', 'ic')])
    vi.stubGlobal('fetch', fetch)
    expect(await openversePhoto({ name: 'Ichiran Shibuya', city: 'Tokyo' })).toMatchObject({ src: 'https://api.openverse.org/v1/images/ic/thumb/' })
    expect(q(fetch, 1).searchParams.get('q')).toBe('Ichiran Shibuya')
  })

  it('never takes a photo that only shares a word ("stroopwafel eindhoven" is not a truck)', async () => {
    vi.stubGlobal('fetch', answers([result('My very own DAF LF')], [result('Eindhoven station')]))
    expect(await openversePhoto({ name: 'Stroopwafel Stand', city: 'Eindhoven' })).toBeNull()
  })

  it('asks once with the name when there is no city, or the name already says it', async () => {
    const fetch = answers([])
    vi.stubGlobal('fetch', fetch)
    expect(await openversePhoto({ name: 'Omotesando Koffee' })).toBeNull()
    expect(await openversePhoto({ name: 'Ichiran Shibuya', city: 'Shibuya' })).toBeNull()
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(q(fetch, 1).searchParams.get('q')).toBe('Ichiran Shibuya')
  })

  it('never asks without a name; a refusal is an error, so it is asked again later', async () => {
    const fetch = answers([])
    vi.stubGlobal('fetch', fetch)
    expect(await openversePhoto({ name: ' ' })).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
    vi.stubGlobal('fetch', vi.fn(async () => new Response('slow down', { status: 429 })))
    await expect(openversePhoto(bakery)).rejects.toThrow()
  })

  it('skips a photo whose page isn\'t a web link, so the credit can never run code', async () => {
    const bad = { ...result('Du Pain et des Idées', 'flickr', 'bad'), foreign_landing_url: 'javascript:alert(1)' }
    vi.stubGlobal('fetch', answers([bad, result('Du Pain et des Idées', 'flickr', 'ok')]))
    expect(await openversePhoto(bakery)).toMatchObject({ page: 'https://www.flickr.com/photos/x/ok' })
  })
})
