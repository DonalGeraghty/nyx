import { API_ENDPOINTS, authFetch } from '../config/api'

export class NutritionApiError extends Error {
  constructor(message, status, code) {
    super(message)
    this.name = 'NutritionApiError'
    this.status = status
    this.code = code
  }
}

async function nutritionRequest(path, options) {
  const response = await authFetch(path, options)
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new NutritionApiError(
      data.message || data.error || 'Nutrition request failed',
      response.status,
      data.error
    )
  }

  return data
}

export async function analyzeMeal(message) {
  const data = await nutritionRequest(API_ENDPOINTS.NUTRITION_ANALYZE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })
  return data.analysis
}

export async function recommendMeals(context) {
  const data = await nutritionRequest(API_ENDPOINTS.NUTRITION_RECOMMEND, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(context),
  })
  return data.recommendation
}

export async function logMeal(items, sourceMessage) {
  return createMealEntry({
    items,
    sourceMessage,
    eatenAt: new Date().toISOString(),
  })
}

export async function createMealEntry({ items, sourceMessage = null, eatenAt }) {
  const data = await nutritionRequest(API_ENDPOINTS.NUTRITION_ENTRIES, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items,
      source_message: sourceMessage,
      eaten_at: eatenAt,
    }),
  })
  return data.entry
}

export async function updateMealEntry(entryId, { items, sourceMessage = null, eatenAt }) {
  const data = await nutritionRequest(
    `${API_ENDPOINTS.NUTRITION_ENTRIES}/${encodeURIComponent(entryId)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items,
        source_message: sourceMessage,
        eaten_at: eatenAt,
      }),
    }
  )
  return data.entry
}

export async function listMeals(limit = 100) {
  const data = await nutritionRequest(
    `${API_ENDPOINTS.NUTRITION_ENTRIES}?limit=${limit}`,
    { method: 'GET' }
  )
  return data.entries || []
}

export async function deleteMeal(entryId) {
  await nutritionRequest(`${API_ENDPOINTS.NUTRITION_ENTRIES}/${encodeURIComponent(entryId)}`, {
    method: 'DELETE',
  })
}

export function toDisplayEntries(entries) {
  return entries.map((entry) => ({
    id: entry.id,
    datetime: entry.eaten_at,
    food: (entry.items || [])
      .map((item) => `${item.food} (${item.portion})`)
      .join(', '),
    calories: entry.total_calories,
    protein: entry.total_protein_g,
    items: entry.items || [],
    sourceMessage: entry.source_message || null,
  }))
}
