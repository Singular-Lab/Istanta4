/*
 * I20-956: ricordare le credenziali di accesso al Plugin.
 *
 * Le credenziali non finiscono in un file ne' in localStorage, che sono leggibili da
 * chiunque apra la cartella: vanno nell'archivio cifrato del sistema operativo, il
 * Portachiavi su Mac e Gestione credenziali su Windows, tramite secureStorage di UXP.
 * Quella protezione vale per l'utente del sistema: chi ha accesso a un profilo gia'
 * sbloccato puo' comunque usare il Plugin, ed e' un limite da conoscere.
 *
 * L'archivio si passa da fuori, cosi' questa logica si verifica con il test runner di
 * Node come gli altri moduli, senza UXP.
 */
var CredenzialiSalvate = (function () {

    var CHIAVE_UTENTE = "istanta.plugin.username";
    var CHIAVE_PASSWORD = "istanta.plugin.password";

    /// secureStorage restituisce i valori come sequenza di byte. Qui si torna al testo,
    /// accettando anche il caso in cui l'archivio restituisca gia' una stringa.
    function aTesto(valore) {
        if (valore == null) {
            return "";
        }

        if (typeof valore === "string") {
            return valore;
        }

        try {
            var codici = [];
            for (var i = 0; i < valore.length; i++) {
                codici.push(valore[i]);
            }
            return String.fromCharCode.apply(null, codici);
        }
        catch (e) {
            return "";
        }
    }

    /// Una coppia e' utilizzabile solo se ci sono entrambe le parti: mezza credenziale
    /// farebbe partire un tentativo di accesso destinato a fallire.
    function coppiaUtilizzabile(username, password) {
        return typeof username === "string" && username !== "" &&
            typeof password === "string" && password !== "";
    }

    /// Le operazioni sull'archivio. Nessuna di queste puo' far fallire il login: se
    /// l'archivio non c'e' o risponde male, il Plugin deve continuare a funzionare come
    /// prima, chiedendo le credenziali a mano.
    function crea(archivio) {

        function disponibile() {
            return archivio != null &&
                typeof archivio.setItem === "function" &&
                typeof archivio.getItem === "function" &&
                typeof archivio.removeItem === "function";
        }

        async function salva(username, password) {
            if (!disponibile() || !coppiaUtilizzabile(username, password)) {
                return false;
            }

            try {
                await archivio.setItem(CHIAVE_UTENTE, username);
                await archivio.setItem(CHIAVE_PASSWORD, password);
                return true;
            }
            catch (e) {
                //Volutamente senza dettagli: qui passano le credenziali.
                console.log("Credenziali non salvate: archivio non disponibile");
                return false;
            }
        }

        async function leggi() {
            if (!disponibile()) {
                return null;
            }

            try {
                var username = aTesto(await archivio.getItem(CHIAVE_UTENTE));
                var password = aTesto(await archivio.getItem(CHIAVE_PASSWORD));

                if (!coppiaUtilizzabile(username, password)) {
                    return null;
                }

                return { username: username, password: password };
            }
            catch (e) {
                return null;
            }
        }

        async function dimentica() {
            if (!disponibile()) {
                return false;
            }

            try {
                await archivio.removeItem(CHIAVE_UTENTE);
                await archivio.removeItem(CHIAVE_PASSWORD);
                return true;
            }
            catch (e) {
                return false;
            }
        }

        return {
            disponibile: disponibile,
            salva: salva,
            leggi: leggi,
            dimentica: dimentica
        };
    }

    return {
        CHIAVE_UTENTE: CHIAVE_UTENTE,
        CHIAVE_PASSWORD: CHIAVE_PASSWORD,
        aTesto: aTesto,
        coppiaUtilizzabile: coppiaUtilizzabile,
        crea: crea
    };
})();

module.exports = CredenzialiSalvate;
