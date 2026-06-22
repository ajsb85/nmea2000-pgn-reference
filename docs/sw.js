const CACHE='nmea2000-v6.2.0-339';
const FILES=['./','./index.html'];
self.addEventListener('install',e=>e.waitUntil(
  caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())
));
self.addEventListener('activate',e=>e.waitUntil(
  caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim())
));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  e.respondWith(
    caches.match(e.request).then(cached=>cached||
      fetch(e.request).then(res=>{
        if(res.ok){const c=res.clone();caches.open(CACHE).then(cache=>cache.put(e.request,c));}
        return res;
      })
    )
  );
});
