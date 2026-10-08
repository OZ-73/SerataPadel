// Service worker Torneo Padel.
// - index.html: prima la rete (così un nuovo caricamento porta subito la versione aggiornata),
//   con ripiego sulla copia salvata se la rete manca o risponde troppo piano (3 s).
// - tutto il resto (JSZip, font, icone): dalla copia salvata, aggiornata in sottofondo.
// I dati dei tornei NON sono qui: stanno nel localStorage del telefono e questo file non li tocca.
const CACHE_NAME = 'padel-v58';
const PRECACHE = ['./', './index.html', './manifest.json', './jszip.min.js', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];
const NETWORK_TIMEOUT_MS = 3000;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

function networkFirst(request){
  return new Promise(resolve => {
    let settled = false;
    const fallback = () => caches.match(request, { ignoreSearch: true }).then(r => r || caches.match('./index.html'));
    const timer = setTimeout(() => {
      fallback().then(r => { if(r && !settled){ settled = true; resolve(r); } });
    }, NETWORK_TIMEOUT_MS);
    // 'no-cache': rivalida sempre col server, così GitHub Pages non serve una index.html vecchia dalla cache HTTP del browser
    fetch(request.url, { cache: 'no-cache', credentials: 'same-origin' }).then(resp => {
      clearTimeout(timer);
      if(resp && resp.ok){
        const copy = resp.clone();
        caches.open(CACHE_NAME).then(c => c.put(request, copy));
      }
      if(!settled){ settled = true; resolve(resp); }
    }).catch(() => {
      clearTimeout(timer);
      if(!settled){ fallback().then(r => { settled = true; resolve(r || Response.error()); }); }
    });
  });
}

function staleWhileRevalidate(request){
  return caches.match(request).then(cached => {
    const refresh = fetch(request).then(resp => {
      if(resp && (resp.ok || resp.type === 'opaque')){
        const copy = resp.clone();
        caches.open(CACHE_NAME).then(c => c.put(request, copy));
      }
      return resp;
    }).catch(() => cached);
    return cached || refresh;
  });
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.protocol !== 'http:' && url.protocol !== 'https:') return;
  const isPage = req.mode === 'navigate' || (url.origin === self.location.origin && (url.pathname.endsWith('/') || url.pathname.endsWith('index.html')));
  event.respondWith(isPage ? networkFirst(req) : staleWhileRevalidate(req));
});
