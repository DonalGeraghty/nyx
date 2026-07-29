import React, { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useAuth } from '../context/AuthContext'
import { demoFoodEntries } from '../data/foodEntries'
import { listMeals, toDisplayEntries } from '../services/nutrition'
import { getCachedNutritionEntries } from '../services/offlineStore'
import { aggregateRecentDays, filterRecentEntries } from '../utils/nutrition'

const tooltipStyle = {
  background: '#050505',
  border: '1px solid #1c1c1c',
  borderRadius: '.5rem',
}

function ChartsPage() {
  const { user } = useAuth()
  const [entries, setEntries] = useState(user?.isDemo ? demoFoodEntries : [])
  const [loading, setLoading] = useState(!user?.isDemo)
  const [error, setError] = useState('')
  const [offlineSnapshotAt, setOfflineSnapshotAt] = useState(null)

  useEffect(() => {
    if (user?.isDemo) return undefined
    let active = true
    listMeals(100, { accountId: user?.accountId })
      .then((rows) => {
        if (active) setEntries(toDisplayEntries(rows))
      })
      .catch(async (requestError) => {
        if (!active) return
        if (requestError instanceof TypeError && user?.accountId) {
          const end = new Date()
          end.setDate(end.getDate() + 1)
          const start = new Date(end)
          start.setDate(start.getDate() - 8)
          const cached = await getCachedNutritionEntries(user.accountId, { start, end })
          if (active) {
            setEntries(toDisplayEntries(cached.entries))
            setOfflineSnapshotAt(cached.lastSyncedAt || 'never')
          }
        } else {
          setError(requestError.message || 'Could not load nutrition data.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [user?.accountId, user?.isDemo])
  const recentEntries = filterRecentEntries(entries)
  const dailyData = aggregateRecentDays(entries)
  const totalCalories = dailyData.reduce((total, day) => total + day.calories, 0)
  const totalProtein = dailyData.reduce((total, day) => total + day.protein, 0)
  const dayCount = 7
  const daysLogged = dailyData.filter((day) => day.meals > 0).length
  const highestCalorieDay = dailyData.reduce(
    (highest, day) => (!highest || day.calories > highest.calories ? day : highest),
    null,
  )

  const metrics = [
    { label: '7-day avg calories', value: `${Math.round(totalCalories / dayCount).toLocaleString()} kcal` },
    { label: '7-day avg protein', value: `${Math.round(totalProtein / dayCount)} g` },
    { label: 'Meals logged', value: recentEntries.length },
    { label: 'Days logged', value: daysLogged },
  ]

  return (
    <main className="content-page">
      <div className="content-inner charts-page">
        <header>
          <h1>Charts</h1>
          <p>Nutrition trends from the last seven days.</p>
          {offlineSnapshotAt && (
            <p className="data-period-warning" role="status">
              {offlineSnapshotAt === 'never'
                ? 'You are offline and no chart snapshot is saved on this device.'
                : `Offline snapshot from ${new Date(offlineSnapshotAt).toLocaleString()}.`}
            </p>
          )}
        </header>

        {loading ? (
          <div className="charts-empty">Loading nutrition data…</div>
        ) : error ? (
          <div className="charts-empty" role="alert">{error}</div>
        ) : !recentEntries.length ? (
          <div className="charts-empty">No food data is available to chart yet.</div>
        ) : (
          <>
            <section className="metric-grid" aria-label="Nutrition summary">
              {metrics.map((metric) => (
                <div className="metric-card" key={metric.label}>
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                </div>
              ))}
            </section>

            <div className="chart-grid">
              <section className="chart-card" aria-labelledby="calories-chart-title">
                <h2 id="calories-chart-title">Daily calories</h2>
                <div className="chart-body">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyData} accessibilityLayer margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="#1c1c1c" vertical={false} />
                      <XAxis dataKey="label" stroke="#888" tickLine={false} axisLine={false} />
                      <YAxis stroke="#888" tickLine={false} axisLine={false} width={48} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        cursor={{ fill: '#0a0a0a' }}
                        formatter={(value) => [`${Number(value).toLocaleString()} kcal`, 'Calories']}
                      />
                      <Bar dataKey="calories" fill="#f2f2f2" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="chart-summary">
                  Highest intake was {highestCalorieDay.calories.toLocaleString()} kcal on {highestCalorieDay.label}.
                </p>
              </section>

              <section className="chart-card" aria-labelledby="protein-chart-title">
                <h2 id="protein-chart-title">Daily protein</h2>
                <div className="chart-body">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyData} accessibilityLayer margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="#1c1c1c" vertical={false} />
                      <XAxis dataKey="label" stroke="#888" tickLine={false} axisLine={false} />
                      <YAxis stroke="#888" tickLine={false} axisLine={false} width={40} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value) => [`${value} g`, 'Protein']}
                      />
                      <Line
                        type="monotone"
                        dataKey="protein"
                        stroke="#f2f2f2"
                        strokeWidth={2}
                        dot={{ fill: '#000', stroke: '#f2f2f2', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="chart-summary">
                  Average daily protein was {Math.round(totalProtein / dayCount)} g.
                </p>
              </section>
            </div>
          </>
        )}
      </div>
    </main>
  )
}

export default ChartsPage
