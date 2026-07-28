import {
  filterEntriesForLocalDay,
  totalNutrition,
  totalNutritionForLocalDay,
} from './nutrition'

describe('local-day nutrition totals', () => {
  const now = new Date(2026, 6, 28, 12, 0, 0)
  const todayMorning = new Date(2026, 6, 28, 8, 30, 0).toISOString()
  const todayEvening = new Date(2026, 6, 28, 20, 15, 0).toISOString()
  const yesterday = new Date(2026, 6, 27, 23, 59, 0).toISOString()

  const entries = [
    { datetime: todayMorning, calories: 340, protein: 14 },
    { datetime: todayEvening, calories: 480, protein: 42.5 },
    { datetime: yesterday, calories: 620, protein: 46 },
  ]

  it('filters entries using the browser local calendar day', () => {
    expect(filterEntriesForLocalDay(entries, now)).toEqual(entries.slice(0, 2))
  })

  it('totals calories, protein, and meal count', () => {
    expect(totalNutrition(entries.slice(0, 2))).toEqual({
      calories: 820,
      protein: 56.5,
      meals: 2,
    })
  })

  it('combines local-day filtering and totals', () => {
    expect(totalNutritionForLocalDay(entries, now)).toEqual({
      calories: 820,
      protein: 56.5,
      meals: 2,
    })
  })
})
