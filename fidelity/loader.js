/**
 * App Loader Script
 * Controllato esplicitamente da React tramite evento `app:ready`
 */
(function () {
    const LOADER_ID = "app-loader";
    const FADE_DURATION = 400;          // ms (deve combaciare col CSS)
    const MIN_DISPLAY_TIME = 300;        // ms
    const FALLBACK_TIMEOUT = 10000;      // ms

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
