import React, { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import Brand from '../components/Brand'
import { useAuth } from '../context/AuthContext'
import { demoFoodEntries } from '../data/foodEntries'
import { listMeals, toDisplayEntries } from '../services/nutrition'
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

  useEffect(() => {
    if (user?.isDemo) return undefined
    let active = true
    listMeals(100)
      .then((rows) => {
        if (active) setEntries(toDisplayEntries(rows))
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || 'Could not load nutrition data.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [user?.isDemo])

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
        <Brand />
        <header>
          <h1>Charts</h1>
          <p>Nutrition trends from the last seven days.</p>
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
                      <YAxis
                        stroke="#888"
                        tickLine={false}
                        axisLine={false}
                        width={48}
                        domain={[0, (dataMax) => Math.max(2000, dataMax)]}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        cursor={{ fill: '#0a0a0a' }}
                        formatter={(value) => [`${Number(value).toLocaleString()} kcal`, 'Calories']}
                      />
                      <ReferenceLine
                        y={1800}
                        stroke="#f59e0b"
                        strokeDasharray="5 5"
                        label={{ value: 'Upper limit · 1,800 kcal', position: 'insideTopRight', fill: '#fbbf24', fontSize: 12 }}
                      />
                      <ReferenceLine
                        y={1500}
                        stroke="#22c55e"
                        strokeDasharray="5 5"
                        label={{ value: 'Lower limit · 1,500 kcal', position: 'insideTopRight', fill: '#4ade80', fontSize: 12 }}
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
