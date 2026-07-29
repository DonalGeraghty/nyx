import { useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { usePWA } from '../context/PWAContext'
import { createMealEntry } from '../services/nutrition'
import {
  deleteOutboxItem,
  listOutbox,
  markOutboxAttempt,
} from '../services/offlineStore'

export default function OfflineSyncManager() {
  const { user, sessionState } = useAuth()
  const { isOnline } = usePWA()
  const syncing = useRef(false)

  useEffect(() => {
    if (!isOnline || !user?.accountId || sessionState !== 'verified') return undefined

    const sync = async () => {
      if (syncing.current) return
      syncing.current = true
      try {
        const items = await listOutbox(user.accountId)
        for (const item of items) {
          if (
            item.type !== 'create_nutrition_entry'
            || item.status === 'needs_attention'
          ) continue
          try {
            await createMealEntry({
              ...item.payload,
              accountId: user.accountId,
            })
            await deleteOutboxItem(user.accountId, item.id)
            window.dispatchEvent(new CustomEvent('nyx-nutrition-synced'))
          } catch (error) {
            const permanent = error?.status >= 400 && error.status < 500
            await markOutboxAttempt(
              user.accountId,
              item,
              error,
              permanent ? 'needs_attention' : 'pending'
            )
            if (!permanent) break
          }
        }
      } finally {
        syncing.current = false
      }
    }

    sync()
    window.addEventListener('nyx-outbox-changed', sync)
    return () => window.removeEventListener('nyx-outbox-changed', sync)
  }, [isOnline, sessionState, user?.accountId])

  return null
}
