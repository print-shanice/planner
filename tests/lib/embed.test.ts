import { embedFor } from '../../src/lib/embed'

it('embedFor', () => {
  expect(embedFor('https://www.instagram.com/reel/Cx1/')).toEqual({ kind: 'instagram', id: 'Cx1' })
  expect(embedFor('https://instagram.com/p/AbC-9_x/?igsh=1')).toEqual({ kind: 'instagram', id: 'AbC-9_x' })
  expect(embedFor('https://www.tiktok.com/@someone.travel/video/7301234567890')).toEqual({ kind: 'tiktok', id: '7301234567890' })
  expect(embedFor('https://youtu.be/abc')).toEqual({ kind: 'youtube', id: 'abc' })
  expect(embedFor('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10')).toEqual({ kind: 'youtube', id: 'dQw4w9WgXcQ' })
  expect(embedFor('https://youtube.com/shorts/xyz_1')).toEqual({ kind: 'youtube', id: 'xyz_1' })
  expect(embedFor('https://skyscanner.net/x').kind).toBe('link')
  expect(embedFor('not a url').kind).toBe('link')
})
