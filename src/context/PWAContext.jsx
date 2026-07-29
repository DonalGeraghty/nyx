import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

const PWAContext = createContext(null)

export function PWAProvider({ children }) {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  const [installPrompt, setInstallPrompt] = useState(null)
  const [installOutcome, setInstallOutcome] = useState('')
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisterError(error) {
      console.error('Service worker registration failed', error)
    },
  })

  useEffect(() => {
    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    const captureInstallPrompt = (event) => {
      event.preventDefault()
      setInstallPrompt(event)
    }
    const installed = () => {
      setInstallPrompt(null)
      setInstallOutcome('installed')
    }

    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    window.addEventListener('beforeinstallprompt', captureInstallPrompt)
    window.addEventListener('appinstalled', installed)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('beforeinstallprompt', captureInstallPrompt)
      window.removeEventListener('appinstalled', installed)
    }
  }, [])

  const installApp = useCallback(async () => {
    if (!installPrompt) return false
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    setInstallPrompt(null)
    setInstallOutcome(choice.outcome)
    return choice.outcome === 'accepted'
  }, [installPrompt])

  const dismissUpdate = useCallback(() => setNeedRefresh(false), [setNeedRefresh])
  const dismissOfflineReady = useCallback(
    () => setOfflineReady(false),
    [setOfflineReady]
  )

  const value = useMemo(
    () => ({
      isOnline,
      canInstall: Boolean(installPrompt),
      installApp,
      installOutcome,
      offlineReady,
      dismissOfflineReady,
      needRefresh,
      dismissUpdate,
      updateApp: () => updateServiceWorker(true),
    }),
    [
      dismissOfflineReady,
      dismissUpdate,
      installApp,
      installOutcome,
      installPrompt,
      isOnline,
      needRefresh,
      offlineReady,
      updateServiceWorker,
    ]
  )

  return <PWAContext.Provider value={value}>{children}</PWAContext.Provider>
}

export function usePWA() {
  const context = useContext(PWAContext)
  if (!context) throw new Error('usePWA must be used within PWAProvider')
  return context
}
