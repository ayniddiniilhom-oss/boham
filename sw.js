const CACHE='boham-shell-v1';
const SHELL=['/','/index.html','/manifest.webmanifest','/assets/campus-hero-reference.jpg','/news/','/schedule/','/services/','/food/','/contact/','/directory/','/library/'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(self.clients.claim())});
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==location.origin||url.pathname.startsWith('/api/'))return;event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{if(response.ok&&['document','script','style','image'].includes(response.type||'')){const copy=response.clone();caches.open(CACHE).then(c=>c.put(event.request,copy))}return response}).catch(()=>caches.match('/index.html'))))});
