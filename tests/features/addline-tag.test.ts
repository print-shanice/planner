import { readTag } from '../../src/features/itinerary/AddLine'

it('a typed [to do] makes the line something to do, wherever it sits, and comes off the name', () => {
  expect(readTag('buy winter wear [to do]')).toEqual({ title: 'buy winter wear', kind: 'note', status: 'to_book' })
  expect(readTag('[todo] buy winter wear')).toEqual({ title: 'buy winter wear', kind: 'note', status: 'to_book' })
  expect(readTag('buy [TO DO] gloves')).toEqual({ title: 'buy gloves', kind: 'note', status: 'to_book' })
})

it('a typed [to book] keeps it a place, still to book; no tag is a plain place', () => {
  expect(readTag('rijksmuseum [to book]')).toEqual({ title: 'rijksmuseum', kind: 'place', status: 'to_book' })
  expect(readTag('  vondelpark ')).toEqual({ title: 'vondelpark', kind: 'place', status: 'idea' })
})
