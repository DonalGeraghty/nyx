import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Brand from '../components/Brand'
import DayEntryGroup from '../components/DayEntryGroup'
import NutritionEntryForm from '../components/NutritionEntryForm'
import WeekNavigator, { formatWeekRange } from '../components/WeekNavigator'
import { useAuth } from '../context/AuthContext'
import { demoFoodEntries } from '../data/foodEntries'
import {
  createMealEntry,
  deleteMeal,
  listAllMeals,
  listMealsForPeriod,
  toDisplayEntries,
  updateMealEntry,
} from '../services/nutrition'
import { foodEntriesToCsv } from '../utils/csv'
import {
  addLocalDays,
  entryIsInPeriod,
  groupEntriesByLocalDay,
  localDateFromKey,
  localDateKey,
  totalNutrition,
  weekPeriodFor,
} from '../utils/nutrition'

function selectedPeriodFrom(searchParams, now = new Date()) {
  const requestedDate = localDateFromKey(searchParams.get('week'))
  const currentPeriod = weekPeriodFor(now)
  if (!requestedDate) return currentPeriod
  const requestedPeriod = weekPeriodFor(requestedDate)
  return requestedPeriod.start > currentPeriod.start
    ? currentPeriod
    : requestedPeriod
}

function DataPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, logout } = useAuth()
  const now = new Date()
  const currentPeriod = weekPeriodFor(now)
  const period = selectedPeriodFrom(searchParams, now)
  const current = period.key === currentPeriod.key
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [truncated, setTruncated] = useState(false)
  const [deletingId, setDeletingId] = useState('')
  const [editor, setEditor] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(null)

  const groups = useMemo(() => groupEntriesByLocalDay(entries), [entries])
  const totals = useMemo(() => totalNutrition(entries), [entries])

  const handleUnauthorized = (requestError) => {
    if (requestError.status !== 401) return false
    logout()
    navigate('/', { replace: true })
    return true
  }

  const showPeriod = (start) => {
    const target = weekPeriodFor(start)
    const next = new URLSearchParams(searchParams)
    if (target.key === currentPeriod.key) next.delete('week')
    else next.set('week', target.key)
    setEditor(null)
    setNotice(null)
    setSearchParams(next)
  }

  useEffect(() => {
    const weekText = searchParams.get('week')
    const parsed = localDateFromKey(weekText)
    if (!weekText) return
    if (
      !parsed
      || localDateKey(weekPeriodFor(parsed).start) !== weekText
      || weekPeriodFor(parsed).start > currentPeriod.start
    ) {
      const next = new URLSearchParams(searchParams)
      next.delete('week')
      setSearchParams(next, { replace: true })
    }
  }, [currentPeriod.key, searchParams, setSearchParams])

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setLoading(true)
    setError('')
    setTruncated(false)
    setNotice(null)

    if (user?.isDemo) {
      setEntries(
        demoFoodEntries
          .filter((entry) => entryIsInPeriod(entry, period))
          .sort((left, right) => new Date(right.datetime) - new Date(left.datetime))
      )
      setLoading(false)
      return () => controller.abort()
    }

    listMealsForPeriod({
      start: period.start,
      end: period.end,
      signal: controller.signal,
    })
      .then(({ entries: rows, pagination }) => {
        if (!active) return
        setEntries(toDisplayEntries(rows))
        setTruncated(Boolean(pagination?.truncated))
      })
      .catch((requestError) => {
        if (!active || requestError.name === 'AbortError') return
        if (!handleUnauthorized(requestError)) {
          setError(requestError.message || 'Could not load food entries.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [period.key, user?.isDemo])

  const handleDelete = async (entry) => {
    const confirmed = window.confirm(`Delete “${entry.food}” from your nutrition log?`)
    if (!confirmed) return

    setDeletingId(entry.id)
    setError('')
    try {
      await deleteMeal(entry.id)
      setEntries((currentEntries) => (
        currentEntries.filter((row) => row.id !== entry.id)
      ))
    } catch (requestError) {
      if (!handleUnauthorized(requestError)) {
        setError(requestError.message || 'Could not delete this food entry.')
      }
    } finally {
      setDeletingId('')
    }
  }

  const handleSave = async (payload) => {
    setSaving(true)
    setError('')
    setNotice(null)
    const clientRequestId = globalThis.crypto?.randomUUID?.()
      || `${Date.now()}-${Math.random().toString(16).slice(2)}`
    const requestPayload = {
      ...payload,
      clientRequestId,
    }
    try {
      const saved = editor?.id
        ? await updateMealEntry(editor.id, requestPayload)
        : await createMealEntry(requestPayload)
      const displayEntry = toDisplayEntries([saved])[0]

      if (entryIsInPeriod(displayEntry, period)) {
        setEntries((currentEntries) => (
          editor?.id
            ? currentEntries.map((entry) => (
              entry.id === displayEntry.id ? displayEntry : entry
            ))
            : [displayEntry, ...currentEntries]
        ))
      } else {
        setEntries((currentEntries) => (
          currentEntries.filter((entry) => entry.id !== displayEntry.id)
        ))
        const targetPeriod = weekPeriodFor(new Date(displayEntry.datetime))
        setNotice({
          message: `Entry saved in ${formatWeekRange(targetPeriod)}.`,
          target: targetPeriod.start,
        })
      }
      setEditor(null)
    } catch (requestError) {
      if (!handleUnauthorized(requestError)) {
        setError(requestError.message || 'Could not save this food entry.')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    setError('')
    try {
      const exportEntries = user?.isDemo
        ? demoFoodEntries
        : toDisplayEntries(await listAllMeals())
      const csv = foodEntriesToCsv(exportEntries)
      const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
      const downloadUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')

      link.href = downloadUrl
      link.download = 'nyx-food-entries-all.csv'
      document.body.appendChild(link)
      try {
        link.click()
      } finally {
        link.remove()
        URL.revokeObjectURL(downloadUrl)
      }
    } catch (requestError) {
      if (!handleUnauthorized(requestError)) {
        setError(requestError.message || 'Could not export nutrition history.')
      }
    } finally {
      setExporting(false)
    }
  }

  return (
    <main className="content-page">
      <div className="content-inner">
        <Brand />
        <div className="data-page-heading">
          <div>
            <h1>Data</h1>
            <p>Nutrition history grouped by local day.</p>
          </div>
          <div className="data-heading-actions">
            <button
              type="button"
              className="data-export-button"
              onClick={handleExport}
              disabled={exporting}
            >
              {exporting ? 'Exporting…' : 'Export all CSV'}
            </button>
            {!user?.isDemo && (
              <button
                type="button"
                className="data-add-button"
                onClick={() => setEditor({ mode: 'add' })}
              >
                Add entry
              </button>
            )}
          </div>
        </div>

        <WeekNavigator
          period={period}
          current={current}
          loading={loading}
          onPrevious={() => showPeriod(addLocalDays(period.start, -7))}
          onNext={() => showPeriod(addLocalDays(period.start, 7))}
          onCurrent={() => showPeriod(currentPeriod.start)}
        />

        <section className="data-period-summary" aria-label="Selected period totals">
          <div><span>Entries</span><strong>{totals.meals}</strong></div>
          <div>
            <span>Calories</span>
            <strong>{totals.calories.toLocaleString()} kcal</strong>
          </div>
          <div><span>Protein</span><strong>{totals.protein} g</strong></div>
        </section>

        {error && <p className="content-error" role="alert">{error}</p>}
        {notice && (
          <div className="data-period-notice" role="status">
            <span>{notice.message}</span>
            {notice.target && (
              <button type="button" onClick={() => showPeriod(notice.target)}>
                View week
              </button>
            )}
          </div>
        )}
        {truncated && (
          <p className="data-period-warning" role="alert">
            This period has more than 500 entries. Only the newest 500 are shown.
          </p>
        )}

        {editor && (
          <NutritionEntryForm
            key={editor.id || 'new'}
            entry={editor.id ? editor : null}
            busy={saving}
            onCancel={() => setEditor(null)}
            onSave={handleSave}
          />
        )}

        {loading ? (
          <div className="data-period-state" role="status">Loading this week…</div>
        ) : groups.length ? (
          <div className="data-day-groups">
            {groups.map((group) => (
              <DayEntryGroup
                key={group.key}
                group={group}
                demo={user?.isDemo}
                deletingId={deletingId}
                onEdit={setEditor}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ) : (
          <div className="data-period-state">
            <strong>No entries in this period</strong>
            <span>Choose another week or add a nutrition entry.</span>
          </div>
        )}
      </div>
    </main>
  )
}

export default DataPage
