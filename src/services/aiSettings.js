import { API_ENDPOINTS, authFetch } from '../config/api'

export class AISettingsApiError extends Error {
  constructor(message, status, code, metadata = {}) {
    super(message)
    this.name = 'AISettingsApiError'
    this.status = status
    this.code = code
    this.provider = metadata.provider
    this.model = metadata.model
    this.details = metadata.details
  }
}

async function aiSettingsRequest(path, options) {
  const response = await authFetch(path, options)
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new AISettingsApiError(
      data.message || data.error || 'AI settings request failed',
      response.status,
      data.error,
      data
    )
  }

  return data
}

function credentialPath(provider) {
  const providerId = String(provider || '').trim()
  if (!providerId) throw new Error('Provider is required')
  return `${API_ENDPOINTS.AI_CREDENTIALS}/${encodeURIComponent(providerId)}`
}

function credentialFromResponse(data) {
  return data.credential || { configured: false }
}

export async function getAISettings() {
  const data = await aiSettingsRequest(API_ENDPOINTS.AI_SETTINGS, { method: 'GET' })
  return {
    selection: data.selection || { provider: '', model: '' },
    providers: Array.isArray(data.providers) ? data.providers : [],
  }
}

export async function saveAISelection({ provider, model }) {
  const requestedSelection = { provider, model }
  const data = await aiSettingsRequest(API_ENDPOINTS.AI_SETTINGS, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestedSelection),
  })
  return data.selection || requestedSelection
}

export async function getAIProviderCredential(provider) {
  const data = await aiSettingsRequest(credentialPath(provider), { method: 'GET' })
  return credentialFromResponse(data)
}

export async function saveAIProviderCredential(provider, apiKey) {
  const data = await aiSettingsRequest(credentialPath(provider), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey }),
  })
  return {
    credential: credentialFromResponse(data),
    warning: data.warning || null,
  }
}

export async function deleteAIProviderCredential(provider) {
  await aiSettingsRequest(credentialPath(provider), { method: 'DELETE' })
}
