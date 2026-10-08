// Optional offline support. Strategy: answer from the cache straight away and
// refresh the cache in the background (stale-while-revalidate), so a new
// deploy shows up on the next visit. Bump VERSION to drop old caches at once.
const VERSION = 'devprep-v1';

const SHELL = [
  './', 'index.html', 'css/styles.css', 'manifest.webmanifest',
  'assets/icon.svg', 'assets/icon-192.png', 'assets/fonts/geist-latin.woff2', 'assets/fonts/jetbrains-mono-latin.woff2',
  'js/app.js', 'js/data.js', 'js/storage.js', 'js/search.js', 'js/ui.js', 'js/utils.js', 'js/plan.js',
  'js/views/dashboard.js', 'js/views/questions.js', 'js/views/question.js', 'js/views/skills.js', 'js/views/practice.js',
  'js/views/playground.js', 'js/views/manager.js', 'js/views/history.js', 'js/views/settings.js',
  'data/skills.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      // One missing file must not stop the install.
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached || (req.mode === 'navigate' ? cache.match('index.html') : Response.error()));
      return cached || network;
    }),
  );
});
