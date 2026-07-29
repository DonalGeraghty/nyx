import React from 'react'
import { addLocalDays } from '../utils/nutrition'

const shortDate = new Intl.DateTimeFormat('en-IE', {
  day: 'numeric',
  month: 'short',
})

const longEndDate = new Intl.DateTimeFormat('en-IE', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

export function formatWeekRange(period) {
  const finalDay = addLocalDays(period.end, -1)
  return `${shortDate.format(period.start)} – ${longEndDate.format(finalDay)}`
}

function WeekNavigator({
  period,
  current,
  loading,
  onPrevious,
  onNext,
  onCurrent,
}) {
  return (
    <nav className="week-navigator" aria-label="Nutrition history period">
      <button
        type="button"
        className="week-navigation-button"
        onClick={onPrevious}
        disabled={loading}
      >
        <span aria-hidden="true">←</span> Previous week
      </button>
      <div className="week-navigation-current" aria-live="polite">
        <span>Selected period</span>
        <strong>{formatWeekRange(period)}</strong>
        {!current && (
          <button type="button" onClick={onCurrent} disabled={loading}>
            This week
          </button>
        )}
      </div>
      <button
        type="button"
        className="week-navigation-button week-navigation-next"
        onClick={onNext}
        disabled={loading || current}
      >
        Next week <span aria-hidden="true">→</span>
      </button>
    </nav>
  )
}

export default WeekNavigator
