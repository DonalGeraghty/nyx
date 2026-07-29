import React from 'react'
import { addLocalDays, localDateKey } from '../utils/nutrition'

const fullDate = new Intl.DateTimeFormat('en-IE', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

const timeOnly = new Intl.DateTimeFormat('en-IE', {
  hour: '2-digit',
  minute: '2-digit',
})

function dayHeading(date, now = new Date()) {
  const label = fullDate.format(date)
  if (localDateKey(date) === localDateKey(now)) return `Today · ${label}`
  if (localDateKey(date) === localDateKey(addLocalDays(now, -1))) {
    return `Yesterday · ${label}`
  }
  return label
}

function DayEntryGroup({
  group,
  demo,
  deletingId,
  onEdit,
  onDelete,
}) {
  const entryLabel = group.totals.meals === 1 ? 'entry' : 'entries'

  return (
    <section className="data-day-group" aria-labelledby={`day-${group.key}`}>
      <header className="data-day-heading">
        <h2 id={`day-${group.key}`}>{dayHeading(group.date)}</h2>
        <p>
          {group.totals.meals} {entryLabel}
          <span aria-hidden="true"> · </span>
          {group.totals.calories.toLocaleString()} kcal
          <span aria-hidden="true"> · </span>
          {group.totals.protein} g protein
        </p>
      </header>
      <div className="data-table-wrap">
        <table className="data-table" aria-label={`Entries for ${fullDate.format(group.date)}`}>
          <colgroup>
            <col className="data-col-time" />
            <col />
            <col className="data-col-number" />
            <col className="data-col-number" />
            <col className="data-col-action" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Time</th>
              <th scope="col">Food</th>
              <th scope="col">Calories</th>
              <th scope="col">Protein</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            {group.entries.map((entry) => (
              <tr key={entry.id || `${entry.datetime}-${entry.food}`}>
                <td>{timeOnly.format(new Date(entry.datetime))}</td>
                <td><span className="data-food" title={entry.food}>{entry.food}</span></td>
                <td>{Number(entry.calories).toLocaleString()}</td>
                <td>{entry.protein} g</td>
                <td>
                  {demo ? (
                    <span className="data-action-unavailable">—</span>
                  ) : (
                    <div className="data-row-actions">
                      <button
                        type="button"
                        className="data-edit-button"
                        onClick={() => onEdit(entry)}
                        disabled={Boolean(deletingId)}
                        aria-label={`Edit ${entry.food}`}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="data-delete-button"
                        onClick={() => onDelete(entry)}
                        disabled={deletingId === entry.id}
                        aria-label={`Delete ${entry.food}`}
                      >
                        {deletingId === entry.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default DayEntryGroup
