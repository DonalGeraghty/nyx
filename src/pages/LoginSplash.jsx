import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'

function LoginSplash() {
  const { login, loginAsDemo, register } = useAuth()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      if (mode === 'login') await login(email, password)
      else await register(email, password)
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-splash">
      <div className="login-splash-top">
        <h1 className="login-splash-brand">Nyx</h1>
      </div>
      <div className="login-splash-inner">
        <p className="login-splash-intro">
          Sign in to access your Nyx account.
        </p>
        {import.meta.env.DEV && (
          <button type="button" className="login-splash-demo" onClick={loginAsDemo}>
            Continue as dummy user
          </button>
        )}
        <div className="login-splash-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            data-testid="login-tab-sign-in"
            aria-selected={mode === 'login'}
            className={mode === 'login' ? 'active' : ''}
            onClick={() => {
              setMode('login')
              setError('')
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            data-testid="login-tab-register"
            aria-selected={mode === 'register'}
            className={mode === 'register' ? 'active' : ''}
            onClick={() => {
              setMode('register')
              setError('')
            }}
          >
            Create account
          </button>
        </div>
        <form className="login-splash-form" onSubmit={handleSubmit}>
          <div className="login-splash-field">
            <label htmlFor="splash-email">Email</label>
            <input
              id="splash-email"
              data-testid="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="login-splash-input"
              placeholder="you@example.com"
            />
          </div>
          <div className="login-splash-field">
            <label htmlFor="splash-password">Password</label>
            <input
              id="splash-password"
              data-testid="login-password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === 'register' ? 8 : undefined}
              className="login-splash-input"
              placeholder={mode === 'register' ? 'At least 8 characters' : '••••••••'}
            />
          </div>
          {error && <div className="login-splash-error">{error}</div>}
          <button type="submit" className="login-splash-submit" data-testid="login-submit" disabled={submitting}>
            {submitting ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Register'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default LoginSplash
