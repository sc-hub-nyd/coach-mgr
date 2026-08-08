// sw.js - Service Worker for CoachMgr PWA
// Cache-First strategy for offline support

const CACHE_VERSION = 'coachmgr-v43';

// Core app files to pre-cache on install
const PRECACHE_URLS = [
  './',
  './index.html',
  './app.js',
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
  './practices.js',
  './settings.js',
  './state.js',
  './tactics.js',
  './utils.js',
  './base.css',
  './CSS/main.css',
  './CSS/base.css',
  './CSS/components.css',
  './CSS/dashboard.css',
  './CSS/drawing.css',
  './CSS/tactical.css',
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

// Install: Pre-cache core app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
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
