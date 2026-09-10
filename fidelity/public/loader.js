/**
 * App Loader Script
 * Controllato esplicitamente da React tramite evento `app:ready`
 * Il loader viene mostrato solo per le route del layout principale (Echo)
 */
(function () {
  const LOADER_ID = "app-loader";
  const FADE_DURATION = 400;          // ms (deve combaciare col CSS)
  const MIN_DISPLAY_TIME = 300;        // ms
  const FALLBACK_TIMEOUT = 10000;      // ms

  /**
   * Route pubbliche dove il loader NON deve essere mostrato
   * (match per startsWith o exact match)
   */
  const NO_LOADER_ROUTES = [
    "/login",
    "/register",
    "/recupero-password",
    "/reset-password",
    "/auth",
    "/landing-page",
    "/webpliant",
    "/display",
    "/embed",
    "/preview",
    "/public",
    "/whatsapp/confirm-opt-in",
  ];

  const path = window.location.pathname;
  const shouldHideLoader = NO_LOADER_ROUTES.some(
    (route) => path === route || path.startsWith(`${route}/`)
  );

  // Se siamo su una route pubblica, nascondiamo subito il loader
  if (shouldHideLoader) {
    const loader = document.getElementById(LOADER_ID);
    if (loader) {
      loader.style.display = "none";
    }
    return; // Esce dallo script, nessun listener necessario
  }

  const startTime = Date.now();
  let removed = false;

  /**
   * Rimuove il loader in modo sicuro e idempotente
   */
  function removeLoader() {
    if (removed) return;
    removed = true;

    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, MIN_DISPLAY_TIME - elapsed);

    setTimeout(() => {
      const loader = document.getElementById(LOADER_ID);
      if (!loader) return;

      loader.classList.add("fade-out");

      setTimeout(() => {
        loader.remove();
      }, FADE_DURATION);
    }, remaining);
  }

  /**
   * React segnala che l'app è pronta
   */
  window.addEventListener("app:ready", removeLoader, { once: true });

  /**
   * Fallback assoluto (non deve mai bloccare l'app)
   */
  setTimeout(removeLoader, FALLBACK_TIMEOUT);
})();
