'use strict';
const ASSETS = ["index.html","pwa.js","manifest.webmanifest","icons/icon-192.png","icons/icon-512.png","icons/icon-180.png","icons/icon-32.png","icons/icon-maskable-512.png","icons/icon.svg","social/maeumi-studio-v1.png"];
const APP_ROOT = new URL('./', self.location.href);
const PREFIX = 'maeumi-studio-' + encodeURIComponent(APP_ROOT.pathname) + '-';
const CACHE = PREFIX + '5b430af1e627ca7b';
const URLS = ASSETS.map(file => new URL(file, APP_ROOT).href);
const INDEX = new URL('index.html', APP_ROOT).href;
function cleanRedirect(response) {
  // Static hosts can redirect index.html to /. Navigation responses must not
  // retain a followed-redirect flag when served from the offline cache.
  return response.redirected ? new Response(response.body, { status: response.status, statusText: response.statusText, headers: response.headers }) : response;
}
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(async cache => {
    await cache.addAll(URLS.map(url => new Request(url, { cache: 'reload' })));
    const index = await cache.match(INDEX);
    if (index && index.redirected) await cache.put(INDEX, cleanRedirect(index));
  }));
  // An update waits until the user saves work and chooses to activate it.
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'ACTIVATE_UPDATE') self.skipWaiting();
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== APP_ROOT.origin) return;
  // Only app-owned static files are cacheable. Keys, generated code, settings,
  // user-selected files, query parameters and external URLs are never cached.
  let target = url.href;
  if (request.mode === 'navigate' && (url.pathname === APP_ROOT.pathname || url.pathname === new URL('index.html', APP_ROOT).pathname)) target = INDEX;
  else if (url.search || !URLS.includes(target)) return;
  event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(target)) || cleanRedirect(await fetch(new Request(target, { cache: 'no-cache' })))));
});
