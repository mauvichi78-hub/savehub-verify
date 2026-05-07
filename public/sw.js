// Minimal service worker — just enough to satisfy PWA install criteria
// (Chrome/Edge require an active SW with at least a fetch handler to show
// the install prompt). We don't cache anything yet; offline support and
// asset caching can come later once the app shape stabilizes.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Pass-through. Network handles everything for now.
});
