import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  deleteAIProviderCredential,
  getAIProviderCredential,
  getAISettings,
  saveAIProviderCredential,
  saveAISelection,
} from './aiSettings'

const { authFetchMock } = vi.hoisted(() => ({ authFetchMock: vi.fn() }))

vi.mock('../config/api', () => ({
  API_ENDPOINTS: {
    AI_SETTINGS: '/api/user/ai-settings',
    AI_CREDENTIALS: '/api/user/ai-credentials',
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

describe('AI settings service', () => {
  beforeEach(() => {
    authFetchMock.mockReset()
  })

  it('loads the selected model and provider credential metadata', async () => {
    const payload = {
      selection: { provider: 'openai', model: 'gpt-4.1-mini' },
      providers: [
        {
          id: 'openai',
          name: 'OpenAI',
          models: [{ id: 'gpt-4.1-mini', name: 'GPT-4.1 mini', description: 'Fast' }],
          credential: { configured: true, last_four: '1234' },
        },
      ],
    }
    authFetchMock.mockResolvedValue(response(payload))

    await expect(getAISettings()).resolves.toEqual(payload)
    expect(authFetchMock).toHaveBeenCalledWith('/api/user/ai-settings', { method: 'GET' })
  })

  it('saves only the provider and model selection', async () => {
    const selection = { provider: 'mistral', model: 'mistral-small-latest' }
    authFetchMock.mockResolvedValue(response({ selection }))

    await expect(saveAISelection(selection)).resolves.toEqual(selection)
    expect(authFetchMock).toHaveBeenCalledWith('/api/user/ai-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(selection),
    })
  })

  it.each(['mistral', 'anthropic'])(
    'uses the provider credential route for %s get, save, and remove',
    async (providerId) => {
      authFetchMock
        .mockResolvedValueOnce(response({ credential: { configured: true, last_four: '5678' } }))
        .mockResolvedValueOnce(response({ credential: { configured: true, last_four: '9012' } }))
        .mockResolvedValueOnce(response({}))

      await expect(getAIProviderCredential(providerId)).resolves.toEqual({
        configured: true,
        last_four: '5678',
      })
      await expect(saveAIProviderCredential(providerId, 'secret-key')).resolves.toEqual({
        configured: true,
        last_four: '9012',
      })
      await deleteAIProviderCredential(providerId)

      expect(authFetchMock).toHaveBeenNthCalledWith(
        1,
        `/api/user/ai-credentials/${providerId}`,
        { method: 'GET' }
      )
      expect(authFetchMock).toHaveBeenNthCalledWith(
        2,
        `/api/user/ai-credentials/${providerId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: 'secret-key' }),
        }
      )
      expect(authFetchMock).toHaveBeenNthCalledWith(
        3,
        `/api/user/ai-credentials/${providerId}`,
        { method: 'DELETE' }
      )
    }
  )

  it('retains provider metadata on API failures', async () => {
    const provider = { id: 'mistral', name: 'Mistral AI' }
    authFetchMock.mockResolvedValue(response(
      {
        error: 'provider_key_invalid',
        message: 'The saved key was rejected.',
        provider,
        model: 'mistral-small-latest',
      },
      { ok: false, status: 422 }
    ))

    await expect(saveAIProviderCredential('mistral', 'bad-key')).rejects.toMatchObject({
      name: 'AISettingsApiError',
      code: 'provider_key_invalid',
      status: 422,
      provider,
      model: 'mistral-small-latest',
    })
  })
})
