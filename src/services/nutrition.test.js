import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  analyzeMeal,
  listAllMeals,
  listMealsForPeriod,
  NutritionApiError,
  recommendMeals,
} from './nutrition'

const { authFetchMock } = vi.hoisted(() => ({ authFetchMock: vi.fn() }))

vi.mock('../config/api', () => ({
  API_ENDPOINTS: {
    NUTRITION_ANALYZE: '/api/nutrition/analyze',
    NUTRITION_RECOMMEND: '/api/nutrition/recommend',
    NUTRITION_ENTRIES: '/api/nutrition/entries',
  },
  authFetch: authFetchMock,
}))

function response(data, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(data),
  }
}

describe('nutrition service errors', () => {
  beforeEach(() => {
    authFetchMock.mockReset()
  })

  it('propagates provider and model metadata from AI request failures', async () => {
    const provider = { id: 'mistral', name: 'Mistral AI' }
    authFetchMock.mockResolvedValue(response(
      {
        error: 'provider_rate_limited',
        message: 'The selected provider is rate limited.',
        provider,
        model: 'mistral-small-latest',
        details: { retry_after_seconds: 30 },
      },
      { ok: false, status: 429 }
    ))

    await expect(analyzeMeal('A bowl of porridge')).rejects.toMatchObject({
      name: 'NutritionApiError',
      message: 'The selected provider is rate limited.',
      status: 429,
      code: 'provider_rate_limited',
      provider,
      model: 'mistral-small-latest',
      details: { retry_after_seconds: 30 },
    })
    expect(authFetchMock).toHaveBeenCalledWith('/api/nutrition/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'A bowl of porridge' }),
    })
  })

  it('retains generic HTTP error metadata without provider fields', async () => {
    authFetchMock.mockResolvedValue(response(
      {
        error: 'invalid_request',
        message: 'The recommendation request is invalid.',
        details: { field: 'target_calories' },
      },
      { ok: false, status: 400 }
    ))

    let requestError
    try {
      await recommendMeals({ target_calories: -1 })
    } catch (error) {
      requestError = error
    }

    expect(requestError).toBeInstanceOf(NutritionApiError)
    expect(requestError).toMatchObject({
      message: 'The recommendation request is invalid.',
      status: 400,
      code: 'invalid_request',
      details: { field: 'target_calories' },
    })
    expect(requestError.provider).toBeUndefined()
    expect(requestError.model).toBeUndefined()
  })

  it('requests one timezone-aware nutrition period', async () => {
    const start = new Date('2026-07-26T23:00:00.000Z')
    const end = new Date('2026-08-02T23:00:00.000Z')
    const controller = new AbortController()
    authFetchMock.mockResolvedValue(response({
      entries: [{ id: 'entry-1' }],
      pagination: {
        start: start.toISOString(),
        end: end.toISOString(),
        limit: 500,
        truncated: false,
      },
    }))

    const result = await listMealsForPeriod({
      start,
      end,
      signal: controller.signal,
    })

    const [path, options] = authFetchMock.mock.calls[0]
    const requestUrl = new URL(path, 'https://nyxai.local')
    expect(requestUrl.pathname).toBe('/api/nutrition/entries')
    expect(requestUrl.searchParams.get('start')).toBe(start.toISOString())
    expect(requestUrl.searchParams.get('end')).toBe(end.toISOString())
    expect(requestUrl.searchParams.get('limit')).toBe('500')
    expect(options).toEqual({
      method: 'GET',
      signal: controller.signal,
    })
    expect(result.entries).toEqual([{ id: 'entry-1' }])
    expect(result.pagination.truncated).toBe(false)
  })

  it('requests the complete nutrition history for export', async () => {
    const controller = new AbortController()
    authFetchMock.mockResolvedValue(response({
      entries: [{ id: 'newest' }, { id: 'oldest' }],
      pagination: {
        start: null,
        end: null,
        limit: null,
        truncated: false,
      },
    }))

    await expect(listAllMeals({ signal: controller.signal })).resolves.toEqual([
      { id: 'newest' },
      { id: 'oldest' },
    ])
    expect(authFetchMock).toHaveBeenCalledWith(
      '/api/nutrition/entries?all=true',
      {
        method: 'GET',
        signal: controller.signal,
      }
    )
  })
})
