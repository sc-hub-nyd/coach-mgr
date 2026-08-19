// sw.js - Service Worker for CoachMgr PWA
// Cache-First strategy for offline support

const CACHE_VERSION = 'coachmgr-v154';

// Core app files to pre-cache on install
const PRECACHE_URLS = [
  './',
  './index.html',
  './app.js',
  './app-context.js',
  './experience-service.js',
  './color-theme-service.js',
  './matchday-ux-service.js',
  './version.js',
  './drawing.js',
  './store.js',
  './command-stack.js',
  './db.js',
  './formation-defs.js',
  './event-manager.js',
  './library.js',
  './matches.js',
  './players.js',
  './player-development-service.js',
  './parent-operations-service.js',
  './sync-outbox-service.js',
  './workspace-service.js',
  './record-service.js',
  './season-report-service.js',
  './practices.js',
  './settings.js',
  './state.js',
  './tactics.js',
  './utils.js',
  './repository.js',
  './sync-service.js',
  './sync-controller.js',
  './sync-conflict-dialog.js',
  './field-companion-service.js',
  './field-session-service.js',
  './team-operations-service.js',
  './insights-service.js',
  './insights.js',
  './operations-service.js',
  './CSS/main.css',
  './CSS/base.css',
  './CSS/tokens.css',
  './CSS/layouts.css',
  './CSS/components.css',
  './CSS/components-standard.css',
  './CSS/components-system.css',
  './CSS/icon-system.css',
  './CSS/utilities.css',
  './CSS/dashboard.css',
  './CSS/drawing.css',
  './CSS/tactical.css',
  './assets/icons/nanyodai/custom/nanyodai-rising-pass.svg',
  './assets/icons/nanyodai/custom/nanyodai-pass-ladder.svg',
  './assets/icons/nanyodai/custom/nanyodai-team-signal.svg',
  './assets/icons/nanyodai/ui/ui-home.svg',
  './assets/icons/nanyodai/ui/ui-calendar.svg',
  './assets/icons/nanyodai/activity/activity-cone.svg',
  './assets/icons/nanyodai/activity/activity-team.svg',
  './assets/icons/nanyodai/activity/activity-trophy.svg',
  './assets/icons/nanyodai/family/family-document.svg',
  './manifest.json',
  './icons/icon-512x512.jpg'
];

// External CDN resources to cache on first fetch
const EXTERNAL_CACHEABLE = [
  'cdnjs.cloudflare.com/ajax/libs/localforage',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdnjs.cloudflare.com/ajax/libs/font-awesome'
];

// Install: Pre-cache core app shell. Cache-busted fetches prevent the active worker
// from serving its older cache while a new worker is installing.
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    await Promise.all(PRECACHE_URLS.map(async (url) => {
      const separator = url.includes('?') ? '&' : '?';
      const response = await fetch(`${url}${separator}precache=${CACHE_VERSION}`, { cache: 'reload' });
      if (!response.ok) throw new Error(`Failed to precache ${url}`);
      await cache.put(url, response);
    }));
  })());
});

// The page asks an installed update to take control only after user confirmation.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_VERSION)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Cache-First for app shell & static assets, Network-First for API calls
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // YouTube API: Network-only (don't cache, gracefully fail offline)
  if (url.hostname === 'www.youtube.com' || url.hostname === 'youtube.com') {
    event.respondWith(
      fetch(event.request).catch(() => new Response('', { status: 200, statusText: 'OK' }))
    );
    return;
  }

  // Google Apps Script API: Network-first (cloud sync)
  if (url.hostname === 'script.google.com' || url.hostname === 'script.googleusercontent.com') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({ error: 'offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // External CDN resources: Cache-First with network fallback
  const isExternalCacheable = EXTERNAL_CACHEABLE.some((domain) => url.href.includes(domain));
  if (isExternalCacheable) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        }).catch(() => new Response('', { status: 503 }));
      })
    );
    return;
  }

  // App shell & local files: Cache-First
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request).then((response) => {
        // Cache successful responses for local files
        if (response && response.status === 200 && url.origin === self.location.origin) {
          const responseClone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      });
    })
  );
});
