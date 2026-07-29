import React, { useEffect, useMemo, useState } from 'react'
import {
  deletePushSubscription,
  getPushSettings,
  savePushSettings,
  savePushSubscription,
} from '../services/push'

function applicationServerKey(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)))
}

export default function PushSettings() {
  const supported = useMemo(() => (
    'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window
  ), [])
  const [settings, setSettings] = useState({
    enabled: false,
    local_time: '20:00',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  })
  const [configuration, setConfiguration] = useState({
    configured: false,
    vapid_public_key: '',
  })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    getPushSettings()
      .then((data) => {
        if (!active) return
        setSettings(data.settings)
        setConfiguration(data.push)
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || 'Could not load reminder settings.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const enable = async () => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      if (!supported) throw new Error('Push notifications are not supported in this browser.')
      if (!configuration.configured || !configuration.vapid_public_key) {
        throw new Error('Push reminders are not configured on the server yet.')
      }
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        throw new Error('Notification permission was not granted.')
      }
      const registration = await navigator.serviceWorker.ready
      let subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey(
            configuration.vapid_public_key
          ),
        })
      }
      await savePushSubscription(subscription.toJSON())
      const updated = { ...settings, enabled: true }
      await savePushSettings(updated)
      setSettings(updated)
      setNotice('Daily reminder enabled on this device.')
    } catch (requestError) {
      setError(requestError.message || 'Could not enable reminders.')
    } finally {
      setBusy(false)
    }
  }

  const disable = async () => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const updated = { ...settings, enabled: false }
      await savePushSettings(updated)
      if (supported) {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()
        if (subscription) {
          await deletePushSubscription(subscription.endpoint)
          await subscription.unsubscribe()
        }
      }
      setSettings(updated)
      setNotice('Daily reminder disabled.')
    } catch (requestError) {
      setError(requestError.message || 'Could not disable reminders.')
    } finally {
      setBusy(false)
    }
  }

  const saveTime = async () => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await savePushSettings(settings)
      setNotice('Reminder time saved.')
    } catch (requestError) {
      setError(requestError.message || 'Could not save reminder time.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="account-panel push-settings" aria-labelledby="push-heading">
      <div className="account-panel-heading">
        <div>
          <h2 id="push-heading">Daily reminders</h2>
          <p>Optional, generic reminders sent through Web Push.</p>
        </div>
        <span className={settings.enabled ? 'status-enabled' : 'status-disabled'}>
          {settings.enabled ? 'Enabled' : 'Off'}
        </span>
      </div>

      {loading ? (
        <p>Loading reminder settings…</p>
      ) : (
        <>
          <label className="push-time-label" htmlFor="push-reminder-time">
            Reminder time
            <input
              id="push-reminder-time"
              type="time"
              value={settings.local_time}
              onChange={(event) => setSettings((current) => ({
                ...current,
                local_time: event.target.value,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
              }))}
              disabled={busy}
            />
          </label>
          <p className="account-panel-note">
            Uses {settings.timezone}. Notification text contains no nutrition details.
          </p>
          {!supported && (
            <p className="content-error">
              This browser does not support Web Push. On iPhone or iPad, install Nyx AI
              to the Home Screen first.
            </p>
          )}
          {!configuration.configured && (
            <p className="data-period-warning">
              The server needs VAPID keys before reminders can be enabled.
            </p>
          )}
          {error && <p className="content-error" role="alert">{error}</p>}
          {notice && <p className="meal-log-success" role="status">{notice}</p>}
          <div className="account-panel-actions">
            {settings.enabled ? (
              <>
                <button type="button" onClick={saveTime} disabled={busy}>
                  {busy ? 'Saving…' : 'Save time'}
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={disable}
                  disabled={busy}
                >
                  Disable
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={enable}
                disabled={busy || !supported || !configuration.configured}
              >
                {busy ? 'Enabling…' : 'Enable reminders'}
              </button>
            )}
          </div>
        </>
      )}
    </section>
  )
}
