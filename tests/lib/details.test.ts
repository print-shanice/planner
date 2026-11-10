import { describe, expect, it } from 'vitest'
import { DETAIL_PLUS, hoursOn, toDetails } from '../../src/lib/google/details'

const weekdays = [
  'Monday: 9:00 AM – 5:00 PM', 'Tuesday: 9:00 AM – 5:00 PM', 'Wednesday: Closed', 'Thursday: 9:00 AM – 5:00 PM',
  'Friday: 9:00 AM – 5:00 PM', 'Saturday: 10:00 AM – 2:00 PM', 'Sunday: Open 24 hours',
]

describe('google place details, kept to one request', () => {
  it('reads the rating, how many rated it, what it is, its photo, hours and website', () => {
    const d = toDetails({
      rating: 4.2, userRatingCount: 244, primaryTypeDisplayName: 'Hotel',
      photos: [{ getURI: ({ maxWidth }: { maxWidth?: number }) => `https://img/${maxWidth}` }],
      regularOpeningHours: { weekdayDescriptions: weekdays }, websiteURI: 'https://hopinn.example/', googleMapsURI: 'https://maps.google.com/?cid=1',
    })
    expect(d).toEqual({ rating: 4.2, ratings: 244, kind: 'hotel', photo: 'https://img/800', weekdays, website: 'https://hopinn.example/', maps: 'https://maps.google.com/?cid=1' })
  })

  it('a place google knows little about still maps cleanly', () => {
    expect(toDetails({})).toEqual({ rating: null, ratings: null, kind: null, photo: null, weekdays: null, website: null, maps: null })
    expect(toDetails({ photos: [], primaryTypeDisplayName: null, rating: 0 })).toMatchObject({ photo: null, kind: null, rating: null })
  })

  it('never asks for google\'s reviews or atmosphere, which cost more', () => {
    expect(DETAIL_PLUS).not.toContain('reviews')
    expect(DETAIL_PLUS).not.toContain('editorialSummary')
    expect(DETAIL_PLUS).toContain('rating')
  })
})

describe('hours on a day', () => {
  it('picks the day\'s line, drops the day name and lowercases it', () => {
    expect(hoursOn(weekdays, '2027-02-06')).toBe('sat · 10:00 am – 2:00 pm')
    expect(hoursOn(weekdays, '2027-02-10')).toBe('wed · closed')
    expect(hoursOn(weekdays, '2027-02-07')).toBe('sun · open 24 hours')
  })
  it('with no day, today; with no hours, nothing', () => {
    expect(hoursOn(weekdays, null, '2027-02-08')).toBe('mon · 9:00 am – 5:00 pm')
    expect(hoursOn(null, '2027-02-08')).toBeNull()
    expect(hoursOn([], '2027-02-08')).toBeNull()
  })
})
