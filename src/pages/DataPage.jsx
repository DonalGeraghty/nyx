import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
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
import {
  enqueueNutritionEntry,
  getCachedNutritionEntries,
} from '../services/offlineStore'
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
  const [offlineSnapshotAt, setOfflineSnapshotAt] = useState(null)
  const [syncVersion, setSyncVersion] = useState(0)

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
    setOfflineSnapshotAt(null)

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
      accountId: user?.accountId,
    })
      .then(({ entries: rows, pagination }) => {
        if (!active) return
        setEntries(toDisplayEntries(rows))
        setTruncated(Boolean(pagination?.truncated))
      })
      .catch(async (requestError) => {
        if (!active || requestError.name === 'AbortError') return
        if (requestError instanceof TypeError && user?.accountId) {
          const cached = await getCachedNutritionEntries(user.accountId, {
            start: period.start,
            end: period.end,
          })
          if (!active) return
          setEntries(toDisplayEntries(cached.entries))
          setOfflineSnapshotAt(cached.lastSyncedAt || 'never')
        } else if (!handleUnauthorized(requestError)) {
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
  }, [period.key, syncVersion, user?.accountId, user?.isDemo])

  useEffect(() => {
    const refresh = () => setSyncVersion((version) => version + 1)
    window.addEventListener('nyx-nutrition-synced', refresh)
    return () => window.removeEventListener('nyx-nutrition-synced', refresh)
  }, [])

  const handleDelete = async (entry) => {
    const confirmed = window.confirm(`Delete “${entry.food}” from your nutrition log?`)
    if (!confirmed) return

    setDeletingId(entry.id)
    setError('')
    try {
      await deleteMeal(entry.id, user?.accountId)
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
      accountId: user?.accountId,
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
      if (
        requestError instanceof TypeError
        && !editor?.id
        && user?.accountId
      ) {
        await enqueueNutritionEntry(user.accountId, requestPayload)
        setEditor(null)
        setNotice({
          message: 'Entry saved to the sync queue. It will upload when you reconnect.',
        })
      } else if (!handleUnauthorized(requestError)) {
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
      let exportEntries
      if (user?.isDemo) {
        exportEntries = demoFoodEntries
      } else {
        try {
          exportEntries = toDisplayEntries(await listAllMeals({
            accountId: user?.accountId,
          }))
        } catch (requestError) {
          if (!(requestError instanceof TypeError) || !user?.accountId) throw requestError
          const cached = await getCachedNutritionEntries(user.accountId, {
            requireComplete: true,
          })
          if (!cached.complete) {
            throw new Error(
              'Connect once to export all history. The complete history is not stored on this device yet.'
            )
          }
          exportEntries = toDisplayEntries(cached.entries)
          setOfflineSnapshotAt(cached.lastSyncedAt)
        }
      }
      const csv = foodEntriesToCsv(exportEntries)
      const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
      const downloadUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')

      link.href = downloadUrl
      link.download = 'nyxai-food-entries-all.csv'
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
        {offlineSnapshotAt && (
          <p className="data-period-warning" role="status">
            {offlineSnapshotAt === 'never'
              ? 'You are offline and no saved snapshot exists for this period.'
              : `Showing data saved on this device. Last synced ${new Date(offlineSnapshotAt).toLocaleString()}.`}
          </p>
        )}
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
