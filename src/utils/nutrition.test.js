import {
  addLocalDays,
  entryIsInPeriod,
  filterEntriesForLocalDay,
  groupEntriesByLocalDay,
  localDateFromKey,
  localDateKey,
  startOfLocalWeek,
  totalNutrition,
  totalNutritionForLocalDay,
  weekPeriodFor,
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

describe('weekly nutrition periods', () => {
  it('builds Monday-to-Monday periods using local calendar boundaries', () => {
    const period = weekPeriodFor(new Date(2026, 6, 29, 14, 30))

    expect(period.start.getDay()).toBe(1)
    expect(period.start.getHours()).toBe(0)
    expect(period.end.getDay()).toBe(1)
    expect(period.end.getHours()).toBe(0)
    expect(localDateKey(period.start)).toBe('2026-07-27')
    expect(localDateKey(period.end)).toBe('2026-08-03')
    expect(period.key).toBe('2026-07-27')
  })

  it('parses valid local date keys and rejects impossible dates', () => {
    expect(localDateKey(localDateFromKey('2026-07-27'))).toBe('2026-07-27')
    expect(localDateFromKey('2026-02-30')).toBeNull()
    expect(localDateFromKey('27-07-2026')).toBeNull()
  })

  it('moves by local calendar days and checks inclusive/exclusive boundaries', () => {
    const period = weekPeriodFor(new Date(2026, 6, 29))
    const finalMoment = new Date(period.end.getTime() - 1).toISOString()

    expect(localDateKey(addLocalDays(period.start, -7))).toBe('2026-07-20')
    expect(entryIsInPeriod({ datetime: period.start.toISOString() }, period)).toBe(true)
    expect(entryIsInPeriod({ datetime: finalMoment }, period)).toBe(true)
    expect(entryIsInPeriod({ datetime: period.end.toISOString() }, period)).toBe(false)
  })

  it('groups entries by local day, newest first, with day totals', () => {
    const mondayMorning = new Date(2026, 6, 27, 8, 30).toISOString()
    const mondayEvening = new Date(2026, 6, 27, 19, 15).toISOString()
    const tuesday = new Date(2026, 6, 28, 12, 0).toISOString()
    const groups = groupEntriesByLocalDay([
      { id: 'morning', datetime: mondayMorning, calories: 300, protein: 12 },
      { id: 'tuesday', datetime: tuesday, calories: 450, protein: 30 },
      { id: 'evening', datetime: mondayEvening, calories: 600, protein: 40 },
    ])

    expect(groups.map((group) => group.key)).toEqual([
      '2026-07-28',
      '2026-07-27',
    ])
    expect(groups[1].entries.map((entry) => entry.id)).toEqual(['evening', 'morning'])
    expect(groups[1].totals).toEqual({
      calories: 900,
      protein: 52,
      meals: 2,
    })
  })
})
