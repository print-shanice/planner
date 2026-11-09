import { describe, expect, it } from 'vitest'
import { CATEGORIES, categoryOf, fromGoogleTypes, fromOsm, categoryIcon, categoryLabel } from '../../src/lib/categories'
import { stop } from '../factories'

describe('place categories', () => {
  it('has a small fixed set, each with its own icon', () => {
    const icons = CATEGORIES.map((c) => categoryIcon(c))
    expect(new Set(icons).size).toBe(CATEGORIES.length)
    expect(CATEGORIES).toEqual(expect.arrayContaining(['cafe', 'restaurant', 'stay', 'museum', 'sight', 'shopping', 'park', 'transport']))
  })

  it('reads a stop: stays are always stays, journeys transport, places their saved category', () => {
    expect(categoryOf(stop({ kind: 'stay', category: null }))).toBe('stay')
    expect(categoryOf(stop({ kind: 'journey', category: null }))).toBe('transport')
    expect(categoryOf(stop({ kind: 'place', category: 'cafe' }))).toBe('cafe')
    expect(categoryOf(stop({ kind: 'note', category: null }))).toBe('note')
  })

  it('reads older words and anything unknown as a plain place', () => {
    expect(categoryOf(stop({ category: 'coffee' }))).toBe('cafe')
    expect(categoryOf(stop({ category: 'Museum' }))).toBe('museum')
    expect(categoryOf(stop({ category: 'something odd' }))).toBe('place')
    expect(categoryOf(stop({ category: null }))).toBe('place')
    expect(categoryLabel('place')).toBe('place')
  })

  it('detects from google place types, most specific first', () => {
    expect(fromGoogleTypes(['cafe', 'food', 'point_of_interest', 'establishment'])).toBe('cafe')
    expect(fromGoogleTypes(['coffee_shop', 'store'])).toBe('cafe')
    expect(fromGoogleTypes(['italian_restaurant', 'restaurant', 'food'])).toBe('restaurant')
    expect(fromGoogleTypes(['lodging', 'hotel'])).toBe('stay')
    expect(fromGoogleTypes(['museum', 'tourist_attraction'])).toBe('museum')
    expect(fromGoogleTypes(['tourist_attraction'])).toBe('sight')
    expect(fromGoogleTypes(['clothing_store', 'store'])).toBe('shopping')
    expect(fromGoogleTypes(['train_station', 'transit_station'])).toBe('transport')
    expect(fromGoogleTypes(['park'])).toBe('park')
    expect(fromGoogleTypes(['route'])).toBeNull()
    expect(fromGoogleTypes(undefined)).toBeNull()
  })

  it('detects from openstreetmap tags', () => {
    expect(fromOsm('amenity', 'cafe')).toBe('cafe')
    expect(fromOsm('amenity', 'restaurant')).toBe('restaurant')
    expect(fromOsm('tourism', 'hotel')).toBe('stay')
    expect(fromOsm('tourism', 'museum')).toBe('museum')
    expect(fromOsm('shop', 'bakery')).toBe('bakery')
    expect(fromOsm('shop', 'clothes')).toBe('shopping')
    expect(fromOsm('leisure', 'park')).toBe('park')
    expect(fromOsm('railway', 'station')).toBe('transport')
    expect(fromOsm('highway', 'residential')).toBeNull()
  })
})

import { expenseCategory } from '../../src/lib/categories'
describe('a place category is not an expense category', () => {
  it('suggests the expense bucket for a new price, never copying the place word', () => {
    expect(expenseCategory(stop({ category: 'cafe' }))).toBe('food')
    expect(expenseCategory(stop({ category: 'museum' }))).toBe('activities')
    expect(expenseCategory(stop({ category: 'shopping' }))).toBe('shopping')
    expect(expenseCategory(stop({ kind: 'stay' }))).toBe('stays')
    expect(expenseCategory(stop({ kind: 'journey' }))).toBe('transport')
    expect(expenseCategory(stop({ kind: 'note' }))).toBe('other')
  })
})
