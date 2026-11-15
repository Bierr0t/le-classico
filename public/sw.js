/* Service worker du Classico : reçoit les notifications et ouvre l'app quand on les touche. */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { corps: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.titre || 'Le Classico', {
    body: d.corps || '',
    icon: './icone-192.png',
    badge: './icone-192.png',
    tag: d.id,
    data: { url: d.url || './' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || './', self.registration.scope).href;
  e.waitUntil((async () => {
    const fenetres = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const ouverte = fenetres.find((f) => f.url.startsWith(self.registration.scope));
    if (ouverte) { await ouverte.focus(); return ouverte.navigate ? ouverte.navigate(url).catch(() => {}) : undefined; }
    return self.clients.openWindow(url);
  })());
});
