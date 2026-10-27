/* I20-1147: le pagine di Correggo4 sono disegnate in pixel fissi su un MacBook. Su uno schermo
   piu' grande restavano piccole in mezzo; adesso si ingrandiscono in proporzione: caratteri,
   card e spazi crescono insieme. La home riempie la larghezza tenendo due card per riga
   (Views/Volantini/Index.cshtml). Sul MacBook e sugli schermi piu' piccoli non cambia niente. L'editor del volantino e la lettura
   affiancata non caricano questo file: calcolano dove cadono i clic sulla pagina.
   Si carica nella <head>, prima che la pagina venga disegnata, cosi' non salta. */
(function () {
    // La finestra dello screenshot del MacBook 13" scelto dall'operatore (1372x783): la home
    // intera in altezza, con due card per riga.
    var LARGHEZZA_MACBOOK = 1372;
    var ALTEZZA_MACBOOK = 783;

    // Decide l'altezza: la pagina si ingrandisce quanto basta perche' ci stia come sul MacBook.
    // Un 27" e' piu' largo che alto: ingrandendo con la larghezza la seconda riga di card finiva
    // fuori schermo. La larghezza fa solo da tetto; sotto il MacBook non si rimpicciolisce.
    function fattore(larghezza, altezza) {
        return Math.max(1, Math.min(larghezza / LARGHEZZA_MACBOOK, altezza / ALTEZZA_MACBOOK));
    }

    // window.innerWidth/innerHeight e non clientWidth: lo zoom messo qui cambia clientWidth, e
    // la pagina all'allargarsi della finestra oscillerebbe fra ingrandita e no.
    function applica() {
        var f = fattore(window.innerWidth, window.innerHeight);
        document.documentElement.style.zoom = f === 1 ? "" : String(Math.round(f * 1000) / 1000);
    }

    applica();
    window.addEventListener("resize", applica);
})();
