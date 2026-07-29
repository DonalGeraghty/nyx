/// <reference lib="webworker" />
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching'
import { NetworkOnly } from 'workbox-strategies'
import { NavigationRoute, registerRoute } from 'workbox-routing'

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')))

// Authentication headers, API keys, AI responses, and nutrition data must never
// be written to Cache Storage. Private offline data is managed by the app in an
// account-partitioned IndexedDB database instead.
registerRoute(
  ({ url }) => (
    url.hostname === 'janus-gate-965419436472.europe-west1.run.app'
    && url.pathname.startsWith('/api/')
  ),
  new NetworkOnly()
)

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data?.json() || {}
  } catch {
    data = {}
  }
  const title = data.title || 'Nyx AI reminder'
  const options = {
    body: data.body || 'Take a moment to update your nutrition log.',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    tag: data.tag || 'nyx-daily-reminder',
    data: { url: data.url || '/' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const existing = windows.find((client) => client.url.startsWith(self.location.origin))
    if (existing) {
      await existing.focus()
      if ('navigate' in existing) await existing.navigate(targetUrl)
      return
    }
    await self.clients.openWindow(targetUrl)
  })())
})
