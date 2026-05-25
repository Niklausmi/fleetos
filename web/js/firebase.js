/* ═══════════════════════════════════════════
   firebase.js — Firebase Cloud Messaging
   Handles FCM token registration + foreground push
   Token is stored in Traccar notification attributes
═══════════════════════════════════════════ */
import { initializeApp }      from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js';
import { getMessaging, getToken, onMessage }
                               from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-messaging.js';
import { getAnalytics }       from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-analytics.js';

const _config = {
  apiKey:            "AIzaSyCjR3kdOuCOP52tEy389tD4XYo1rdylGF0",
  authDomain:        "fleetos-web.firebaseapp.com",
  projectId:         "fleetos-web",
  storageBucket:     "fleetos-web.firebasestorage.app",
  messagingSenderId: "167457940990",
  appId:             "1:167457940990:web:511221f1e5037f70c5ccaf",
  measurementId:     "G-MGEPH6XSKK",
};

// VAPID public key — get this from Firebase Console →
// Project Settings → Cloud Messaging → Web Push certificates
// Replace with your actual VAPID key
const VAPID_KEY = 'YOUR_VAPID_KEY_HERE';

const _app       = initializeApp(_config);
const _analytics = getAnalytics(_app);
const _messaging = getMessaging(_app);

let _fcmToken = null;

/* ── Register SW + get FCM token ─────── */
async function init() {
  // Must be called after user interaction or login
  if (!('serviceWorker' in navigator) || !('Notification' in window)) {
    console.warn('[FCM] Push not supported in this browser');
    return null;
  }

  try {
    // Register service worker
    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

    // Request notification permission
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      console.warn('[FCM] Notification permission denied');
      return null;
    }

    // Get FCM token
    _fcmToken = await getToken(_messaging, {
      vapidKey:            VAPID_KEY,
      serviceWorkerRegistration: swReg,
    });

    if (_fcmToken) {
      console.log('[FCM] Token obtained:', _fcmToken.slice(0, 12) + '…');
      // Persist for the Traccar firebase notification channel
      localStorage.setItem('fcm_token', _fcmToken);
    }

    // Foreground push handler — show toast when app is open
    onMessage(_messaging, (payload) => {
      const title = payload.notification?.title || 'FleetOS Alert';
      const body  = payload.notification?.body  || payload.data?.message || '';
      const type  = payload.data?.type || '';

      // Map Traccar event types to toast severity
      const isAlert = ['deviceOverspeed','alarm','deviceOffline','geofenceExit'].includes(type);

      if (window.Toast) {
        Toast[isAlert ? 'error' : 'info'](`${title}: ${body}`, 6000);
      }

      // Also prepend to events list if it looks like a Traccar event
      if (payload.data?.deviceId && window.State) {
        State.prependEvents([{
          id:         Date.now(),
          type:       payload.data.type || 'fcm',
          deviceId:   parseInt(payload.data.deviceId),
          serverTime: new Date().toISOString(),
          attributes: payload.data,
        }]);
      }
    });

    return _fcmToken;
  } catch (err) {
    console.error('[FCM] init failed:', err);
    return null;
  }
}

function getStoredToken() {
  return _fcmToken || localStorage.getItem('fcm_token');
}

// Expose globally for non-module scripts
window.FCM = { init, getStoredToken };

export { init, getStoredToken };
