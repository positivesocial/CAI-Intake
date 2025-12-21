/**
 * CAI Intake - Service Worker
 * Provides offline support and caching for the PWA.
 */

const CACHE_NAME = 'cai-intake-v2';
const OFFLINE_URL = '/offline.html';

// Static assets to cache (NOT pages that may redirect)
const PRECACHE_ASSETS = [
  '/offline.html',
  '/branding/logo-icon.svg',
  '/branding/logo-full.svg',
];

// Install event - cache core assets
self.addEventListener('install', (event) => {
  console.log('[SW] Install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Pre-caching assets');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip API requests - always go to network
  if (event.request.url.includes('/api/')) {
    return;
  }

  // Skip external requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Skip auth-related URLs entirely (Safari redirect issue)
  if (event.request.url.includes('/login') || 
      event.request.url.includes('/auth') ||
      event.request.url.includes('redirectTo')) {
    return;
  }

  // For navigation requests, use network-first strategy
  // Safari has issues with cached redirects from service workers
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Don't cache redirects - Safari can't handle them from SW
          if (response.redirected || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          // Cache successful, non-redirect navigation responses
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Network failed, try cache then offline page
          return caches.match(event.request)
            .then((cachedResponse) => {
              if (cachedResponse) {
                return cachedResponse;
              }
              return caches.match(OFFLINE_URL);
            });
        })
    );
    return;
  }

  // For other requests (assets), use cache-first strategy
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Return cached response if available
        if (cachedResponse) {
          // Fetch and update cache in background
          event.waitUntil(
            fetch(event.request)
              .then((response) => {
                // Don't cache redirects
                if (response && response.status === 200 && !response.redirected) {
                  const responseClone = response.clone();
                  caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseClone);
                  });
                }
              })
              .catch(() => {
                // Network failed, but we have cache
              })
          );
          return cachedResponse;
        }

        // No cache, try network
        return fetch(event.request)
          .then((response) => {
            // Don't cache non-successful or redirect responses
            if (!response || response.status !== 200 || response.type !== 'basic' || response.redirected) {
              return response;
            }

            // Cache successful responses
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });

            return response;
          })
          .catch(() => {
            // Network failed for non-navigation request
            return new Response('Offline', { status: 503 });
          });
      })
  );
});

// Background sync for offline form submissions
self.addEventListener('sync', (event) => {
  console.log('[SW] Sync event:', event.tag);
  
  if (event.tag === 'sync-cutlists') {
    event.waitUntil(syncCutlists());
  }
});

async function syncCutlists() {
  // Get pending cutlists from IndexedDB and sync to server
  console.log('[SW] Syncing cutlists...');
  // Implementation would go here
}

// Push notifications (if enabled)
self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event);
  
  if (!event.data) return;
  
  const data = event.data.json();
  
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/branding/logo-icon.svg',
    badge: '/branding/logo-icon.svg',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/dashboard',
    },
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'CAI Intake', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click:', event.action);
  
  event.notification.close();
  
  if (event.action === 'dismiss') {
    return;
  }
  
  const urlToOpen = event.notification.data?.url || '/dashboard';
  
  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then((clientList) => {
        // Focus existing window if possible
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

console.log('[SW] Service worker loaded');
