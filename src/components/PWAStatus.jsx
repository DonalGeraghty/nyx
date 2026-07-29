import React from 'react'
import { usePWA } from '../context/PWAContext'

export default function PWAStatus() {
  const {
    isOnline,
    offlineReady,
    dismissOfflineReady,
    needRefresh,
    dismissUpdate,
    updateApp,
  } = usePWA()

  if (!isOnline) {
    return (
      <div className="pwa-status pwa-status-offline" role="status" aria-live="polite">
        You are offline. Saved history and meal drafts remain available.
      </div>
    )
  }

  if (needRefresh) {
    return (
      <div className="pwa-status" role="alert">
        <span>A new Nyx AI version is ready.</span>
        <div>
          <button type="button" onClick={updateApp}>Update now</button>
          <button type="button" className="button-secondary" onClick={dismissUpdate}>
            Later
          </button>
        </div>
      </div>
    )
  }

  if (offlineReady) {
    return (
      <div className="pwa-status" role="status">
        <span>Nyx AI is ready to open offline.</span>
        <button type="button" className="button-secondary" onClick={dismissOfflineReady}>
          Dismiss
        </button>
      </div>
    )
  }

  return null
}
