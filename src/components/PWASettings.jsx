import React, { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { usePWA } from '../context/PWAContext'
import { clearOfflineAccount, listOutbox } from '../services/offlineStore'

export default function PWASettings() {
  const { user } = useAuth()
  const { canInstall, installApp } = usePWA()
  const [notice, setNotice] = useState('')
  const [outbox, setOutbox] = useState([])

  const refreshOutbox = useCallback(async () => {
    setOutbox(await listOutbox(user?.accountId))
  }, [user?.accountId])

  useEffect(() => {
    refreshOutbox()
    window.addEventListener('nyx-outbox-changed', refreshOutbox)
    window.addEventListener('nyx-nutrition-synced', refreshOutbox)
    return () => {
      window.removeEventListener('nyx-outbox-changed', refreshOutbox)
      window.removeEventListener('nyx-nutrition-synced', refreshOutbox)
    }
  }, [refreshOutbox])

  const clearLocalData = async () => {
    const confirmed = window.confirm(
      'Clear cached history, drafts, and pending sync items from this device? Server data is not affected.'
    )
    if (!confirmed) return
    await clearOfflineAccount(user?.accountId, { preserveProfile: true })
    await refreshOutbox()
    setNotice('Offline data cleared from this device.')
  }

  return (
    <section className="account-panel" aria-labelledby="offline-heading">
      <div className="account-panel-heading">
        <div>
          <h2 id="offline-heading">App and offline data</h2>
          <p>Install Nyx AI and control private data saved on this device.</p>
        </div>
      </div>
      <div className="account-panel-actions">
        {canInstall && (
          <button type="button" onClick={installApp}>Install Nyx AI</button>
        )}
        <button type="button" className="button-secondary" onClick={clearLocalData}>
          Clear offline data
        </button>
      </div>
      {!canInstall && (
        <p className="account-panel-note">
          If installation is available, use your browser’s “Install app” or
          “Add to Home Screen” menu.
        </p>
      )}
      {outbox.length > 0 && (
        <p className="account-panel-note" role="status">
          {outbox.length} reviewed {outbox.length === 1 ? 'entry is' : 'entries are'} stored in the sync queue.
          {outbox.some((item) => item.status === 'needs_attention')
            ? ' One or more were rejected by the server and need to be cleared.'
            : ''}
        </p>
      )}
      {notice && <p className="meal-log-success" role="status">{notice}</p>}
    </section>
  )
}
