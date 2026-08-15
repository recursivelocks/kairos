if ('serviceWorker' in navigator) {
  // Automatically reload the page when a new service worker takes control
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      console.log('[Service Worker] Controller changed. Reloading page...');
      window.location.reload();
    }
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => {
        console.log('[Service Worker] Registered successfully with scope:', reg.scope);
      })
      .catch((err) => {
        console.error('[Service Worker] Registration failed:', err);
      });
  });
}
