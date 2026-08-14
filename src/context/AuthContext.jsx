import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  API_BASE_URL,
  API_ENDPOINTS,
  authFetch,
  getStoredToken,
  setStoredToken,
} from '../config/api'
import {
  clearOfflineAccount,
  getActiveOfflineProfile,
  saveOfflineProfile,
} from '../services/offlineStore'

const AuthContext = createContext(null)
const DEMO_TOKEN = 'local-demo-session'
const DEMO_USER = {
  email: 'demo@nyx.local',
  accountId: 'local-demo-account',
  isDemo: true,
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sessionState, setSessionState] = useState('loading')

  const logout = useCallback(async () => {
    const accountId = user?.accountId
    setStoredToken('')
    setUser(null)
    setSessionState('anonymous')
    if (accountId && !user?.isDemo) await clearOfflineAccount(accountId)
  }, [user?.accountId, user?.isDemo])

  const useOfflineProfile = useCallback(async () => {
    const profile = await getActiveOfflineProfile()
    if (!profile) {
      setUser(null)
      setSessionState('anonymous')
      return false
    }
    setUser({
      email: profile.email,
      accountId: profile.accountId,
      offlineSession: true,
    })
    setSessionState('offline')
    return true
  }, [])

  const bootstrap = useCallback(async () => {
    const token = getStoredToken()
    if (import.meta.env.DEV && token === DEMO_TOKEN) {
      setUser(DEMO_USER)
      setSessionState('verified')
      setLoading(false)
      return
    }
    if (!token) {
      setUser(null)
      setSessionState('anonymous')
      setLoading(false)
      return
    }
    try {
      const response = await authFetch(API_ENDPOINTS.AUTH_ME, { method: 'GET' })
      const data = await response.json().catch(() => ({}))
      if (response.ok && data.user?.email && data.user?.account_id) {
        const verifiedUser = {
          email: data.user.email,
          accountId: data.user.account_id,
        }
        await saveOfflineProfile(verifiedUser)
        setUser(verifiedUser)
        setSessionState('verified')
      } else if (response.status === 401 || response.status === 403) {
        const profile = await getActiveOfflineProfile()
        setStoredToken('')
        setUser(null)
        setSessionState('anonymous')
        if (profile?.accountId) await clearOfflineAccount(profile.accountId)
      } else {
        await useOfflineProfile()
      }
    } catch {
      await useOfflineProfile()
    } finally {
      setLoading(false)
    }
  }, [useOfflineProfile])

  const loginAsDemo = useCallback(() => {
    if (!import.meta.env.DEV) return
    setStoredToken(DEMO_TOKEN)
    setUser(DEMO_USER)
    setSessionState('verified')
  }, [])

  useEffect(() => {
    bootstrap()
  }, [bootstrap])

  useEffect(() => {
    if (sessionState !== 'offline') return undefined
    const revalidate = () => bootstrap()
    window.addEventListener('online', revalidate)
    return () => window.removeEventListener('online', revalidate)
  }, [bootstrap, sessionState])

  const login = useCallback(async (email, password) => {
    const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.AUTH_LOGIN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || 'Login failed')
    const verifiedUser = {
      email: data.user?.email || email,
      accountId: data.user?.account_id,
    }
    if (!verifiedUser.accountId) throw new Error('Login response did not include an account ID')
    setStoredToken(data.token)
    await saveOfflineProfile(verifiedUser)
    setUser(verifiedUser)
    setSessionState('verified')
    return data
  }, [])

  const register = useCallback(async (email, password) => {
    const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.AUTH_REGISTER}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || 'Registration failed')
    const verifiedUser = {
      email: data.user?.email || email,
      accountId: data.user?.account_id,
    }
    if (!verifiedUser.accountId) {
      throw new Error('Registration response did not include an account ID')
    }
    setStoredToken(data.token)
    await saveOfflineProfile(verifiedUser)
    setUser(verifiedUser)
    setSessionState('verified')
    return data
  }, [])

  const deleteAccount = useCallback(async (password) => {
    if (!user?.email) throw new Error('Not signed in')
    const response = await authFetch(API_ENDPOINTS.AUTH_DELETE_ACCOUNT, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || 'Could not delete account')
    const accountId = user.accountId
    setStoredToken('')
    setUser(null)
    setSessionState('anonymous')
    await clearOfflineAccount(accountId)
  }, [user?.accountId, user?.email])

  const value = useMemo(
    () => ({
      user,
      loading,
      sessionState,
      login,
      loginAsDemo,
      register,
      logout,
      deleteAccount,
      refreshSession: bootstrap,
    }),
    [
      user,
      loading,
      sessionState,
      login,
      loginAsDemo,
      register,
      logout,
      deleteAccount,
      bootstrap,
    ]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
