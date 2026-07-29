import React from 'react'
import {
  BrowserRouter as Router,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import Dock from './components/Dock'
import OfflineSyncManager from './components/OfflineSyncManager'
import PWAStatus from './components/PWAStatus'
import AccountPage from './pages/AccountPage'
import DataPage from './pages/DataPage'
import LoginSplash from './pages/LoginSplash'
import NyxAIHome from './pages/NyxAIHome'
import { AuthProvider, useAuth } from './context/AuthContext'

const ChartsPage = React.lazy(() => import('./pages/ChartsPage'))
const RecommendationsPage = React.lazy(() => import('./pages/RecommendationsPage'))

function AppDock() {
  const location = useLocation()
  const navigate = useNavigate()
  const { logout } = useAuth()

  const goTo = (path) => {
    navigate(path)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const items = [
    { label: 'Home', icon: <span aria-hidden="true">⌂</span>, onClick: () => goTo('/'), current: location.pathname === '/' },
    { label: 'Data', icon: <span aria-hidden="true">≡</span>, onClick: () => goTo('/data'), current: location.pathname === '/data' },
    { label: 'Charts', icon: <span aria-hidden="true">▥</span>, onClick: () => goTo('/charts'), current: location.pathname === '/charts' },
    { label: 'Recommend', icon: <span aria-hidden="true">R</span>, onClick: () => goTo('/recommendations'), current: location.pathname === '/recommendations' },
    { label: 'Account', icon: <span aria-hidden="true">●</span>, onClick: () => goTo('/account'), current: location.pathname === '/account' },
    { label: 'Log out', icon: <span aria-hidden="true">↪</span>, onClick: logout, testId: 'nav-sign-out' },
  ]

  return <Dock items={items} />
}

function ProtectedLayout() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="auth-loading" role="status" aria-live="polite">
        <p>Loading…</p>
      </div>
    )
  }

  if (!user) return <LoginSplash />

  return (
    <div className="app">
      <OfflineSyncManager />
      <AppDock />
      <Outlet />
    </div>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<NyxAIHome />} />
        <Route path="/data" element={<DataPage />} />
        <Route
          path="/charts"
          element={(
            <React.Suspense fallback={<div className="page-loading">Loading charts…</div>}>
              <ChartsPage />
            </React.Suspense>
          )}
        />
        <Route
          path="/recommendations"
          element={(
            <React.Suspense fallback={<div className="page-loading">Loading recommendations…</div>}>
              <RecommendationsPage />
            </React.Suspense>
          )}
        />
        <Route path="/account" element={<AccountPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <PWAStatus />
        <AppRoutes />
      </Router>
    </AuthProvider>
  )
}

export default App
