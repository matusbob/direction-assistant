const CACHE = 'direction-assistant-v38';
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];
// Present only in the real app page, so a Wi-Fi login page or error page is never saved in its place
const APP_MARKER = 'name="app-id" content="direction-assistant"';

self.addEventListener('install', (e) => {
// cache: 'reload' skips the browser's HTTP cache, so a new version never stores a stale copy of the page
e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))));
self.skipWaiting();
});

self.addEventListener('activate', (e) => {
e.waitUntil(
caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
);
self.clients.claim();
});

self.addEventListener('fetch', (e) => {
if (e.request.method !== 'GET') return;
const url = new URL(e.request.url);
// Map lookups (OpenStreetMap) go straight to the network
if (url.origin !== self.location.origin) return;
if (e.request.mode === 'navigate' && /\/(index\.html)?$/.test(url.pathname)) {
// The app page itself: newest version when online, saved copy when offline or the network is very slow
const fromNetwork = fetch(url.href, { cache: 'no-store', credentials: 'same-origin' }).then(async (res) => {
if (!res.ok) return null;
const text = await res.clone().text();
if (text.indexOf(APP_MARKER) === -1) return null;
const copy = res.clone();
caches.open(CACHE).then((c) => c.put('./index.html', copy));
return res;
}).catch(() => null);
const fromCache = () => caches.match('./index.html');
const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 5000));
e.respondWith(
Promise.race([fromNetwork, timeout])
.then((res) => res || fromCache())
.then((res) => res || fromNetwork)
.then((res) => res || fetch(e.request))
);
return;
}
e.respondWith(
caches.match(e.request).then((cached) => cached || fetch(e.request).catch(() => cached))
);
});
