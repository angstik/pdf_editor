/* =====================================================================
   EDITION PDF — service worker
   Stratégie : precache de l'app shell, cache-first, réseau en repli.
   Incrémentez CACHE_VERSION à chaque livraison pour forcer la mise à jour.

   Les écritures en cache sont filtrées sur `res.ok && !res.redirected &&
   res.type === 'basic'` : si un jour l'application passe derrière un portail
   d'authentification, une page de connexion renvoyée par redirection n'entrera
   jamais dans le cache à la place des fichiers de l'application.
   ===================================================================== */
const CACHE_VERSION = 'v18';
const CACHE = 'pdfed-' + CACHE_VERSION;

const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'assets/css/app.css',
  'assets/js/app.js',
  'assets/js/i18n.js',
  'assets/js/theme-boot.js',
  'vendor/pdf.min.js',
  'vendor/pdf.worker.min.js',
  'vendor/pdf-lib.min.js',
  'vendor/fontkit.umd.min.js',
  'vendor/fonts/Montserrat-Regular.ttf',
  'vendor/fonts/Montserrat-Bold.ttf',
  'vendor/fonts/Montserrat-Italic.ttf',
  'vendor/fonts/Montserrat-BoldItalic.ttf',
  'vendor/fonts/Roboto-Regular.ttf',
  'vendor/fonts/Roboto-Bold.ttf',
  'vendor/fonts/Roboto-Italic.ttf',
  'vendor/fonts/Roboto-BoldItalic.ttf',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/icon-maskable-512.png',
  'assets/icons/apple-touch-icon.png',
  'assets/icons/favicon-32.png'
];

const cacheable = res => res && res.ok && !res.redirected && res.type === 'basic';

self.addEventListener('install', e=>{
  e.waitUntil((async ()=>{
    const c = await caches.open(CACHE);
    await Promise.all(SHELL.map(async u=>{
      try{
        const res = await fetch(new Request(u, {cache:'reload', credentials:'same-origin'}));
        if(cacheable(res)) await c.put(u, res);
        else console.warn('[sw] réponse non mise en cache :', u, res.status, res.redirected?'(redirigée)':'');
      }catch(err){ console.warn('[sw] échec :', u, err.message); }
    }));
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

  // Navigations : réseau d'abord, repli sur le cache quand on est hors ligne
  if(req.mode === 'navigate'){
    e.respondWith((async ()=>{
      try{
        const net = await fetch(req);
        if(cacheable(net)) (await caches.open(CACHE)).put('index.html', net.clone());
        return net;                         // y compris une redirection de connexion
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
      if(cacheable(net)) (await caches.open(CACHE)).put(req, net.clone());
      return net;
    }catch(err){ return Response.error(); }
  })());
});

self.addEventListener('message', e=>{ if(e.data === 'skipWaiting') self.skipWaiting(); });
