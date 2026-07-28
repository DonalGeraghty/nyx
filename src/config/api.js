// Janus — auth API (Cloud Run). URL updates if service name changes.
export const API_BASE_URL = 'https://janus-gate-965419436472.europe-west1.run.app'

export const API_ENDPOINTS = {
  AUTH_REGISTER: '/api/auth/register',
  AUTH_LOGIN: '/api/auth/login',
  AUTH_ME: '/api/auth/me',
  AUTH_DELETE_ACCOUNT: '/api/auth/account',
  OPENAI_KEY: '/api/user/openai-key',
  NUTRITION_ANALYZE: '/api/nutrition/analyze',
  NUTRITION_RECOMMEND: '/api/nutrition/recommend',
  NUTRITION_ENTRIES: '/api/nutrition/entries',
}

const TOKEN_KEY = 'dg_auth_token'

export function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

export function setStoredToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

export async function authFetch(path, options = {}) {
  const token = getStoredToken()
  const headers = {
    ...(options.headers || {}),
  }
  if (token) headers.Authorization = `Bearer ${token}`
  return fetch(`${API_BASE_URL}${path}`, { ...options, headers })
}
