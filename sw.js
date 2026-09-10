/* =====================================================================
   EDITION PDF — service worker
   Stratégie : precache de l'app shell, cache-first, réseau en repli.
   Incrémentez CACHE_VERSION à chaque livraison pour forcer la mise à jour.
   ===================================================================== */
const CACHE_VERSION = 'v1';
const CACHE = 'pdfed-' + CACHE_VERSION;

const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'assets/css/app.css',
  'assets/js/app.js',
  'vendor/pdf.min.js',
  'vendor/pdf.worker.min.js',
  'vendor/pdf-lib.min.js',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/icon-maskable-512.png',
  'assets/icons/apple-touch-icon.png',
  'assets/icons/favicon-32.png'
];

self.addEventListener('install', e=>{
  e.waitUntil((async ()=>{
    const c = await caches.open(CACHE);
    await Promise.all(SHELL.map(u => c.add(new Request(u, {cache:'reload'})).catch(err =>
      console.warn('[sw] non mis en cache :', u, err.message))));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e=>{
  e.waitUntil((async ()=>{
    for(const k of await caches.keys()) if(k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e=>{
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.origin !== location.origin) return;

  // Navigations : réseau d'abord (pour récupérer une nouvelle version), repli sur le cache
  if(req.mode === 'navigate'){
    e.respondWith((async ()=>{
      try{
        const net = await fetch(req);
        (await caches.open(CACHE)).put('index.html', net.clone());
        return net;
      }catch(err){
        return (await caches.match('index.html')) || (await caches.match('./')) || Response.error();
      }
    })());
    return;
  }

  // Ressources : cache d'abord
  e.respondWith((async ()=>{
    const hit = await caches.match(req, {ignoreSearch:true});
    if(hit) return hit;
    try{
      const net = await fetch(req);
      if(net.ok && net.type === 'basic') (await caches.open(CACHE)).put(req, net.clone());
      return net;
    }catch(err){ return Response.error(); }
  })());
});

self.addEventListener('message', e=>{ if(e.data === 'skipWaiting') self.skipWaiting(); });
