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
