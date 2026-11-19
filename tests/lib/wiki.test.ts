import { afterEach, describe, expect, it, vi } from 'vitest'
import { wikiPhoto, wikiMatch } from '../../src/lib/wiki'

const page = (title: string, lat: number, lon: number, image: string | null = `${title.replace(/ /g, '_')}.jpg`) => ({
  title, coordinates: [{ lat, lon }],
  ...(image ? { pageimage: image, thumbnail: { source: `https://upload.wikimedia.org/${image}`, width: 800, height: 533 } } : {}),
})
const answer = (pages: unknown[]) => vi.fn(async () => new Response(JSON.stringify({ query: { pages } }), { status: 200 }))

afterEach(() => vi.unstubAllGlobals())

describe('is this wikipedia page the place?', () => {
  it('the same name, a shorter one, or a longer one that holds every word', () => {
    expect(wikiMatch('Eiffel Tower', 'Eiffel Tower')).toBe(true)
    expect(wikiMatch('Louvre Museum', 'Louvre')).toBe(true)
    expect(wikiMatch('Fushimi Inari', 'Fushimi Inari-taisha')).toBe(true)
    expect(wikiMatch('Café de Flore', 'Café de Flore')).toBe(true)
    expect(wikiMatch('cafe de flore', 'Café de Flore')).toBe(true)
  })
  it('not a neighbour that shares a word, nor the district a shop is named after', () => {
    expect(wikiMatch('Louvre Museum', 'Carrousel du Louvre')).toBe(false)
    expect(wikiMatch('Starbucks Shibuya', 'Shibuya')).toBe(false)
    expect(wikiMatch('Du Pain et des Idées', 'Canal Saint-Martin')).toBe(false)
    expect(wikiMatch('Hop Inn Kyoto Shijo Omiya', 'Ōmiya Station')).toBe(false)
  })
})

describe('a place\'s photo from wikipedia', () => {
  const eiffel = { name: 'Eiffel Tower', lat: 48.8584, lng: 2.2945 }

  it('asks english wikipedia for pages around the place, with their photos', async () => {
    const fetch = answer([page('Eiffel Tower', 48.8583, 2.2944)])
    vi.stubGlobal('fetch', fetch)
    await wikiPhoto(eiffel)
    const url = new URL(String((fetch.mock.calls[0] as unknown[])[0]))
    expect(url.origin).toBe('https://en.wikipedia.org')
    expect(url.searchParams.get('generator')).toBe('geosearch')
    expect(url.searchParams.get('ggscoord')).toBe('48.8584|2.2945')
    expect(url.searchParams.get('origin')).toBe('*')
    expect(url.searchParams.get('pithumbsize')).toBe('800')
  })

  it('takes the nearest page that is the place, with a link to the photo\'s own page for the credit', async () => {
    vi.stubGlobal('fetch', answer([
      page('Champ de Mars', 48.8556, 2.2986),
      page('Eiffel Tower', 48.8583, 2.2944, 'Tour_Eiffel_Wikimedia_Commons.jpg'),
    ]))
    expect(await wikiPhoto(eiffel)).toEqual({
      src: 'https://upload.wikimedia.org/Tour_Eiffel_Wikimedia_Commons.jpg',
      page: 'https://en.wikipedia.org/wiki/File:Tour_Eiffel_Wikimedia_Commons.jpg',
    })
  })

  it('nothing when no page is the place, or the page has no free photo', async () => {
    vi.stubGlobal('fetch', answer([page('Champ de Mars', 48.8556, 2.2986)]))
    expect(await wikiPhoto(eiffel)).toBeNull()
    vi.stubGlobal('fetch', answer([page('Eiffel Tower', 48.8583, 2.2944, null)]))
    expect(await wikiPhoto(eiffel)).toBeNull()
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })))
    expect(await wikiPhoto(eiffel)).toBeNull()
  })

  it('never asks without a name and a spot', async () => {
    const fetch = answer([])
    vi.stubGlobal('fetch', fetch)
    expect(await wikiPhoto({ name: '', lat: 1, lng: 1 })).toBeNull()
    expect(await wikiPhoto({ name: 'x', lat: null, lng: null })).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('a refusal is an error, so it is asked again later', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('busy', { status: 503 })))
    await expect(wikiPhoto(eiffel)).rejects.toThrow()
  })
})
