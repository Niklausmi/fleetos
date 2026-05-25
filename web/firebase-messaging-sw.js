/* ═══════════════════════════════════════════
   firebase-messaging-sw.js
   Place this file at the ROOT of your web/ folder.
   Service Worker for Firebase Cloud Messaging background push.
═══════════════════════════════════════════ */
importScripts('https://www.gstatic.com/firebasejs/12.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.13.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            "AIzaSyCjR3kdOuCOP52tEy389tD4XYo1rdylGF0",
  authDomain:        "fleetos-web.firebaseapp.com",
  projectId:         "fleetos-web",
  storageBucket:     "fleetos-web.firebasestorage.app",
  messagingSenderId: "167457940990",
  appId:             "1:167457940990:web:511221f1e5037f70c5ccaf",
  measurementId:     "G-MGEPH6XSKK"
});

const messaging = firebase.messaging();

// Background push: show notification when app is not in foreground
messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification || {};
  self.registration.showNotification(title || 'FleetOS Alert', {
    body:  body  || payload.data?.message || '',
    icon:  icon  || '/icon.png',
    badge: '/icon.png',
    tag:   payload.data?.type || 'fleetos',
    data:  payload.data || {},
  });
});

// Notification click → open / focus the app
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(self.location.origin));
      if (existing) return existing.focus();
      return clients.openWindow('/');
    })
  );
});
