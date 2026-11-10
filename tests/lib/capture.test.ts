import { describe, expect, it } from 'vitest'
import { extractUrl, linkKey, platformOf, findSaved, readShareParams, keepPending, takePending, peekPending, captureHref, linkName } from '../../src/lib/capture'
import type { Link } from '../../src/lib/types'

const link = (url: string, o: Partial<Link> = {}): Link => ({ id: url, trip_id: null, url, title: '', note: '', ...o })

describe('link capture', () => {
  it('finds the link inside shared text', () => {
    expect(extractUrl('look at this https://www.instagram.com/reel/C9xYz12/?igsh=abc so good')).toBe('https://www.instagram.com/reel/C9xYz12/?igsh=abc')
    expect(extractUrl('www.example.com/page')).toBe('https://www.example.com/page')
    expect(extractUrl('  https://youtu.be/dQw4w9WgXcQ  ')).toBe('https://youtu.be/dQw4w9WgXcQ')
    expect(extractUrl('example.org/page')).toBe('https://example.org/page')
    expect(extractUrl('no link here')).toBeNull()
    expect(extractUrl('javascript:alert(1)')).toBeNull()
  })

  it('names the platform', () => {
    expect(platformOf('https://www.instagram.com/reel/C9x/')).toBe('instagram')
    expect(platformOf('https://vm.tiktok.com/ZM123/')).toBe('tiktok')
    expect(platformOf('https://youtu.be/abc')).toBe('youtube')
    expect(platformOf('https://example.com')).toBe('web')
  })

  it('treats the same reel or video as one link, whatever the tracking bits', () => {
    expect(linkKey('https://www.instagram.com/reel/C9xYz12/?igsh=abc')).toBe(linkKey('https://instagram.com/reels/C9xYz12'))
    expect(linkKey('https://www.instagram.com/p/C9xYz12/')).toBe(linkKey('https://instagram.com/reel/C9xYz12/'))
    expect(linkKey('https://youtu.be/dQw4w9WgXcQ?si=x')).toBe(linkKey('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3'))
    expect(linkKey('https://m.youtube.com/shorts/dQw4w9WgXcQ')).toBe(linkKey('https://youtube.com/watch?v=dQw4w9WgXcQ'))
    expect(linkKey('https://www.tiktok.com/@a/video/123?is_from_webapp=1')).toBe(linkKey('https://tiktok.com/@a/video/123'))
    expect(linkKey('https://Example.com/a/?utm_source=x&b=2')).toBe(linkKey('https://example.com/a?b=2'))
    expect(linkKey('https://example.com/a?b=2')).not.toBe(linkKey('https://example.com/a?b=3'))
  })

  it('spots a link that is already saved', () => {
    const saved = [link('https://www.instagram.com/reel/AAA/'), link('https://example.com/x')]
    expect(findSaved('https://instagram.com/reel/AAA/?igsh=1', saved)?.id).toBe('https://www.instagram.com/reel/AAA/')
    expect(findSaved('https://instagram.com/reel/BBB/', saved)).toBeUndefined()
  })

  it('reads a share target or shortcut from the page address', () => {
    expect(readShareParams('?url=https%3A%2F%2Fa.com&title=hi', '')).toEqual({ url: 'https://a.com', title: 'hi', text: '' })
    expect(readShareParams('', '#/save?text=see%20https%3A%2F%2Fb.com%2Fx')).toEqual({ url: 'https://b.com/x', title: '', text: 'see https://b.com/x' })
    expect(readShareParams('?u=https%3A%2F%2Fc.com', '')).toMatchObject({ url: 'https://c.com' })
    expect(readShareParams('', '#/trip/1')).toBeNull()
  })

  it('keeps a capture through signing in, and only hands it out once', () => {
    keepPending({ url: 'https://a.com', title: '', text: '' })
    expect(peekPending()?.url).toBe('https://a.com')
    expect(takePending()?.url).toBe('https://a.com')
    expect(takePending()).toBeNull()
  })

  it('builds the address the shortcut opens', () => {
    expect(captureHref('https://print-shanice.github.io/planner/', 'https://a.com/?x=1&y=2')).toBe('https://print-shanice.github.io/planner/#/save?url=https%3A%2F%2Fa.com%2F%3Fx%3D1%26y%3D2')
  })
})

describe('linkName', () => {
  const l = (p: Partial<Link>) => ({ id: 'l', trip_id: null, url: 'https://www.instagram.com/reel/C9x/', title: 'instagram', note: '', ...p }) as Link
  it('your note names a link that only has the site as its title', () => {
    expect(linkName(l({ note: 'rooftop bar' }))).toEqual({ title: 'rooftop bar', sub: 'instagram.com' })
    expect(linkName(l({ title: '', note: 'rooftop bar' }))).toEqual({ title: 'rooftop bar', sub: 'instagram.com' })
    expect(linkName(l({ url: 'https://example.com/a', title: 'example.com', note: 'menu' }))).toEqual({ title: 'menu', sub: 'example.com' })
  })
  it('a title someone typed stays, with the note beside the site', () => {
    expect(linkName(l({ title: 'cafe reel', note: 'go early' }))).toEqual({ title: 'cafe reel', sub: 'instagram.com · go early' })
  })
  it('without a note it is the title, else the site', () => {
    expect(linkName(l({}))).toEqual({ title: 'instagram', sub: 'instagram.com' })
    expect(linkName(l({ title: '' }))).toEqual({ title: 'instagram.com', sub: '' })
  })
})
