export function filterRecentEntries(entries, dayCount = 7, now = new Date()) {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - (dayCount - 1))

  const end = new Date(start)
  end.setDate(end.getDate() + dayCount)

  return entries.filter((entry) => {
    const datetime = new Date(entry.datetime)
    return datetime >= start && datetime < end
  })
}

export function aggregateRecentDays(entries, dayCount = 7, now = new Date()) {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - (dayCount - 1))

  const days = Array.from({ length: dayCount }, (_, index) => {
    const current = new Date(start)
    current.setDate(current.getDate() + index)
    const date = [
      current.getFullYear(),
      String(current.getMonth() + 1).padStart(2, '0'),
      String(current.getDate()).padStart(2, '0'),
    ].join('-')
    return { date, calories: 0, protein: 0, meals: 0 }
  })

  const daysByDate = new Map(days.map((day) => [day.date, day]))
  filterRecentEntries(entries, dayCount, now).forEach((entry) => {
    const day = daysByDate.get(entry.datetime.slice(0, 10))
    if (!day) return
    day.calories += entry.calories
    day.protein += entry.protein
    day.meals += 1
  })

  return days.map((day) => ({
    ...day,
    label: new Date(`${day.date}T00:00:00`).toLocaleDateString('en-IE', {
      weekday: 'short',
      day: 'numeric',
    }),
  }))
}

export function filterEntriesForLocalDay(entries, now = new Date()) {
  return entries.filter((entry) => {
    const datetime = new Date(entry.datetime)
    return (
      datetime.getFullYear() === now.getFullYear()
      && datetime.getMonth() === now.getMonth()
      && datetime.getDate() === now.getDate()
    )
  })
}

export function totalNutrition(entries) {
  return entries.reduce(
    (totals, entry) => ({
      calories: totals.calories + Number(entry.calories || 0),
      protein: Math.round((totals.protein + Number(entry.protein || 0)) * 10) / 10,
      meals: totals.meals + 1,
    }),
    { calories: 0, protein: 0, meals: 0 },
  )
}

export function totalNutritionForLocalDay(entries, now = new Date()) {
  return totalNutrition(filterEntriesForLocalDay(entries, now))
}
