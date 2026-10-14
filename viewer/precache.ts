import type { Plugin } from 'vite';

function hash(text: string): string {
  let value = 2166136261;
  for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619);
  return (value >>> 0).toString(36);
}

function serviceWorker(cacheName: string, assets: string[]): string {
  return `const CACHE = ${JSON.stringify(cacheName)};
const ASSETS = ${JSON.stringify(assets)};
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true, ignoreVary: true }).then((hit) => hit ?? fetch(event.request)),
  );
});
`;
}

export function precache(): Plugin {
  return {
    name: 'precache',
    generateBundle(_, bundle) {
      const assets = ['./', './index.html', ...Object.keys(bundle).filter((file) => file !== 'index.html').sort().map((file) => `./${file}`)];
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: serviceWorker(`scene-${hash(assets.join('|'))}`, assets) });
    },
  };
}
