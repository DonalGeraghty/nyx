import { API_ENDPOINTS, authFetch } from '../config/api'

async function pushRequest(path, options = {}) {
  const response = await authFetch(path, options)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.message || data.error || 'Push request failed')
    error.status = response.status
    error.code = data.error
    throw error
  }
  return data
}

export function getPushSettings() {
  return pushRequest(API_ENDPOINTS.PUSH_SETTINGS, { method: 'GET' })
}

export function savePushSettings(settings) {
  return pushRequest(API_ENDPOINTS.PUSH_SETTINGS, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  })
}

export function savePushSubscription(subscription) {
  return pushRequest(API_ENDPOINTS.PUSH_SUBSCRIPTIONS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription),
  })
}

export function deletePushSubscription(endpoint) {
  return pushRequest(API_ENDPOINTS.PUSH_SUBSCRIPTIONS, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint }),
  })
}
