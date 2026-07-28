import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AISettings from '../components/AISettings'
import { useAuth } from '../context/AuthContext'

function AccountPage() {
  const navigate = useNavigate()
  const { user, deleteAccount } = useAuth()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const handleDelete = async (e) => {
    e.preventDefault()
    setError('')
    if (!password) {
      setError('Enter your password to confirm.')
      return
    }
    const confirmed = window.confirm(
      'Delete your account permanently? All data stored on the server for this account will be removed. This cannot be undone.'
    )
    if (!confirmed) return
    setBusy(true)
    try {
      await deleteAccount(password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="account-page">
      <div className="account-inner">
        <header className="account-header">
          <h1 className="account-title">Account</h1>
          <p className="account-email">{user?.email}</p>
          <Link to="/" className="account-back">
            ← Back to app
          </Link>
        </header>

        {user?.isDemo && (
          <p className="account-demo">This is a local dummy account. No account data is stored on the server.</p>
        )}

        <AISettings />

        {!user?.isDemo && (
          <section className="account-danger" aria-labelledby="danger-heading">
          <h2 id="danger-heading" className="account-danger-title">
            Delete account
          </h2>
          <p className="account-danger-copy">
            This removes your Janus account and all associated server data. Your session ends immediately.
          </p>
          <form className="account-delete-form" onSubmit={handleDelete}>
            <label className="account-delete-label" htmlFor="delete-password">
              Confirm with your password
            </label>
            <input
              id="delete-password"
              data-testid="account-delete-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="account-delete-input"
              placeholder="Current password"
              disabled={busy}
            />
            {error && (
              <div className="account-delete-error" role="alert">
                {error}
              </div>
            )}
            <button type="submit" className="account-delete-submit" data-testid="account-delete-submit" disabled={busy}>
              {busy ? 'Deleting…' : 'Delete my account'}
            </button>
          </form>
          </section>
        )}
      </div>
    </main>
  )
}

export default AccountPage
