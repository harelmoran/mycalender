// Minimal service worker — mainly here so the site qualifies as an
// installable PWA (required by Chrome/Android and by APK-packaging tools
// like PWABuilder). Just passes requests straight through to the network.
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
