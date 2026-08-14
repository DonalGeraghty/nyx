import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { demoFoodEntries } from '../data/foodEntries'
import { listMeals, recommendMeals, toDisplayEntries } from '../services/nutrition'
import { totalNutritionForLocalDay } from '../utils/nutrition'
import { aiRequestError } from '../utils/aiErrors'

const EMPTY_TOTALS = { calories: 0, protein: 0, meals: 0 }

const DEMO_MEALS = [
  {
    name: 'Chicken and vegetable stir-fry',
    items: [
      { food: 'Chicken breast', portion: '180 g cooked', calories: 300, protein_g: 56 },
      { food: 'Mixed stir-fry vegetables', portion: '250 g', calories: 120, protein_g: 6 },
      { food: 'Light stir-fry sauce', portion: '2 tbsp', calories: 50, protein_g: 1 },
    ],
    rationale: 'Lean chicken provides substantial protein for relatively few calories.',
  },
  {
    name: 'Greek yoghurt and berries',
    items: [
      { food: 'Low-fat Greek yoghurt', portion: '250 g', calories: 185, protein_g: 25 },
      { food: 'Mixed berries', portion: '100 g', calories: 50, protein_g: 1 },
    ],
    rationale: 'A light second meal that adds protein without using much of the calorie budget.',
  },
  {
    name: 'Tuna salad',
    items: [
      { food: 'Tuna in spring water', portion: '1 drained tin', calories: 150, protein_g: 33 },
      { food: 'Large mixed salad', portion: '1 bowl', calories: 100, protein_g: 4 },
    ],
    rationale: 'Tuna is a convenient high-protein choice for a smaller meal.',
  },
]

function settingsStorageKey(email) {
  return `nyx-recommendation-settings:${String(email || '').toLowerCase()}`
}

function demoEntriesForToday(now = new Date()) {
  return demoFoodEntries.slice(-3, -1).map((entry) => {
    const source = new Date(entry.datetime)
    const datetime = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      source.getHours(),
      source.getMinutes(),
    )
    return { ...entry, datetime: datetime.toISOString() }
  })
}

function demoRecommendation(context) {
  const meals = DEMO_MEALS.slice(0, context.meals_remaining).map((meal) => {
    const totalCalories = meal.items.reduce((sum, item) => sum + item.calories, 0)
    const totalProtein = meal.items.reduce((sum, item) => sum + item.protein_g, 0)
    return {
      ...meal,
      total_calories: totalCalories,
      total_protein_g: totalProtein,
    }
  })
  const planCalories = meals.reduce((sum, meal) => sum + meal.total_calories, 0)
  const planProtein = meals.reduce((sum, meal) => sum + meal.total_protein_g, 0)
  return {
    summary: 'A demo plan prioritising lean protein while keeping portions practical.',
    meals,
    assumptions: ['This result was generated locally rather than by an external AI provider.'],
    calorie_budget_remaining: Math.max(0, context.target_calories - context.current_calories),
    protein_remaining_g: Math.max(0, context.target_protein_g - context.current_protein_g),
    plan_total_calories: planCalories,
    plan_total_protein_g: planProtein,
    projected_daily_calories: context.current_calories + planCalories,
    projected_daily_protein_g: context.current_protein_g + planProtein,
  }
}

function RecommendationsPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [totals, setTotals] = useState(EMPTY_TOTALS)
  const [targetCalories, setTargetCalories] = useState('')
  const [targetProtein, setTargetProtein] = useState('')
  const [mealsRemaining, setMealsRemaining] = useState(1)
  const [preferences, setPreferences] = useState('')
  const [loading, setLoading] = useState(true)
  const [requesting, setRequesting] = useState(false)
  const [error, setError] = useState('')
  const [showAISettingsLink, setShowAISettingsLink] = useState(false)
  const [recommendation, setRecommendation] = useState(null)

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(settingsStorageKey(user?.email)) || '{}')
      if (saved.targetCalories) setTargetCalories(String(saved.targetCalories))
      if (saved.targetProtein) setTargetProtein(String(saved.targetProtein))
      if ([1, 2, 3].includes(saved.mealsRemaining)) setMealsRemaining(saved.mealsRemaining)
      if (typeof saved.preferences === 'string') setPreferences(saved.preferences)
    } catch {
      // Ignore invalid or unavailable browser storage.
    }
  }, [user?.email])

  const handleUnauthorized = useCallback((requestError) => {
    if (requestError.status !== 401) return false
    logout()
    navigate('/', { replace: true })
    return true
  }, [logout, navigate])

  const refreshToday = useCallback(async () => {
    if (user?.isDemo) {
      const nextTotals = totalNutritionForLocalDay(demoEntriesForToday())
      setTotals(nextTotals)
      return nextTotals
    }
    const rows = await listMeals(100)
    const nextTotals = totalNutritionForLocalDay(toDisplayEntries(rows))
    setTotals(nextTotals)
    return nextTotals
  }, [user?.isDemo])

  useEffect(() => {
    let active = true
    refreshToday()
      .catch((requestError) => {
        if (active && !handleUnauthorized(requestError)) {
          setError(requestError.message || 'Could not load today’s nutrition.')
          setShowAISettingsLink(false)
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [refreshToday, handleUnauthorized])

  const parsedTargets = useMemo(() => ({
    calories: Number(targetCalories),
    protein: Number(targetProtein),
  }), [targetCalories, targetProtein])
  const targetsValid = (
    targetCalories !== ''
    && targetProtein !== ''
    && Number.isFinite(parsedTargets.calories)
    && parsedTargets.calories >= 500
    && parsedTargets.calories <= 10000
    && Number.isFinite(parsedTargets.protein)
    && parsedTargets.protein >= 10
    && parsedTargets.protein <= 1000
  )

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!targetsValid || requesting) return
    setRequesting(true)
    setError('')
    setShowAISettingsLink(false)
    setRecommendation(null)
    try {
      const freshTotals = await refreshToday()
      const context = {
        current_calories: freshTotals.calories,
        current_protein_g: freshTotals.protein,
        target_calories: parsedTargets.calories,
        target_protein_g: parsedTargets.protein,
        meals_remaining: mealsRemaining,
        preferences: preferences.trim(),
      }
      try {
        localStorage.setItem(settingsStorageKey(user?.email), JSON.stringify({
          targetCalories: parsedTargets.calories,
          targetProtein: parsedTargets.protein,
          mealsRemaining,
          preferences: preferences.trim(),
        }))
      } catch {
        // Recommendations still work when browser storage is unavailable.
      }
      const result = user?.isDemo
        ? demoRecommendation(context)
        : await recommendMeals(context)
      setRecommendation(result)
    } catch (requestError) {
      if (!handleUnauthorized(requestError)) {
        const errorDetails = aiRequestError(
          requestError,
          'requesting recommendations',
          'Could not generate meal recommendations.'
        )
        setError(errorDetails.message)
        setShowAISettingsLink(errorDetails.showAccountLink)
      }
    } finally {
      setRequesting(false)
    }
  }

  const remainingCalories = targetCalories
    ? Math.max(0, parsedTargets.calories - totals.calories)
    : null
  const remainingProtein = targetProtein
    ? Math.max(0, parsedTargets.protein - totals.protein)
    : null

  return (
    <main className="content-page">
      <div className="content-inner recommendations-page">
        <header className="recommendations-header">
          <h1>Recommendations</h1>
          <p>Build a protein-focused plan for the rest of today.</p>
        </header>

        <section className="recommendation-progress" aria-label="Today’s nutrition">
          <div>
            <span>Calories eaten</span>
            <strong>{loading ? '—' : `${totals.calories.toLocaleString()} kcal`}</strong>
          </div>
          <div>
            <span>Protein eaten</span>
            <strong>{loading ? '—' : `${totals.protein} g`}</strong>
          </div>
          <div>
            <span>Calories remaining</span>
            <strong>{remainingCalories === null || loading ? 'Set a target' : `${remainingCalories.toLocaleString()} kcal`}</strong>
          </div>
          <div>
            <span>Protein remaining</span>
            <strong>{remainingProtein === null || loading ? 'Set a target' : `${remainingProtein} g`}</strong>
          </div>
        </section>

        <form className="recommendation-form" onSubmit={handleSubmit}>
          <div className="recommendation-targets">
            <label htmlFor="daily-calorie-target">
              Daily calorie target
              <input
                id="daily-calorie-target"
                type="number"
                min="500"
                max="10000"
                step="1"
                value={targetCalories}
                onChange={(event) => setTargetCalories(event.target.value)}
                placeholder="e.g. 2000"
                disabled={requesting}
                required
              />
            </label>
            <label htmlFor="daily-protein-target">
              Daily protein target
              <span className="recommendation-input-unit">
                <input
                  id="daily-protein-target"
                  type="number"
                  min="10"
                  max="1000"
                  step="0.1"
                  value={targetProtein}
                  onChange={(event) => setTargetProtein(event.target.value)}
                  placeholder="e.g. 140"
                  disabled={requesting}
                  required
                />
                <span>g</span>
              </span>
            </label>
          </div>

          <fieldset className="recommendation-meal-count">
            <legend>Meals remaining today</legend>
            <div>
              {[1, 2, 3].map((count) => (
                <button
                  key={count}
                  type="button"
                  className={mealsRemaining === count ? 'active' : ''}
                  aria-pressed={mealsRemaining === count}
                  onClick={() => setMealsRemaining(count)}
                  disabled={requesting}
                >
                  {count}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="recommendation-preferences" htmlFor="recommendation-preferences">
            Preferences or restrictions <span>(optional)</span>
            <textarea
              id="recommendation-preferences"
              rows="3"
              maxLength="1000"
              value={preferences}
              onChange={(event) => setPreferences(event.target.value)}
              placeholder="For example: vegetarian, no shellfish, quick meals"
              disabled={requesting}
            />
          </label>

          <p className="recommendation-disclaimer">
            Set targets that are appropriate for you. Recommendations are estimates, not medical advice.
          </p>
          <button
            type="submit"
            className="recommendation-submit"
            disabled={loading || requesting || !targetsValid}
          >
            {requesting ? 'Building your plan…' : 'Recommend meals'}
          </button>
        </form>

        {error && (
          <div className="message-error" role="alert">
            <p>{error}</p>
            {showAISettingsLink && (
              <Link to="/account">Open Account</Link>
            )}
          </div>
        )}

        {recommendation && (
          <section className="recommendation-result" aria-live="polite">
            <div className="recommendation-result-heading">
              <div>
                <span className="recommendation-eyebrow">Your plan</span>
                <h2>{recommendation.summary}</h2>
              </div>
              <div className="recommendation-plan-total">
                <strong>{recommendation.plan_total_calories.toLocaleString()} kcal</strong>
                <span>{recommendation.plan_total_protein_g} g protein</span>
              </div>
            </div>

            <div className="recommended-meals">
              {recommendation.meals.map((meal, index) => (
                <article className="recommended-meal" key={`${meal.name}-${index}`}>
                  <header>
                    <div>
                      <span>Meal {index + 1}</span>
                      <h3>{meal.name}</h3>
                    </div>
                    <div>
                      <strong>{meal.total_calories} kcal</strong>
                      <span>{meal.total_protein_g} g protein</span>
                    </div>
                  </header>
                  <ul>
                    {meal.items.map((item, itemIndex) => (
                      <li key={`${item.food}-${itemIndex}`}>
                        <div>
                          <strong>{item.food}</strong>
                          <span>{item.portion}</span>
                        </div>
                        <div>
                          <span>{item.calories} kcal</span>
                          <span>{item.protein_g} g</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <p>{meal.rationale}</p>
                </article>
              ))}
            </div>

            <div className="recommendation-projection">
              <span>Projected day total</span>
              <strong>{recommendation.projected_daily_calories.toLocaleString()} kcal</strong>
              <strong>{recommendation.projected_daily_protein_g} g protein</strong>
            </div>

            {recommendation.assumptions?.length > 0 && (
              <details className="meal-assumptions">
                <summary>Assumptions</summary>
                <ul>
                  {recommendation.assumptions.map((assumption, index) => (
                    <li key={index}>{assumption}</li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        )}
      </div>
    </main>
  )
}

export default RecommendationsPage
