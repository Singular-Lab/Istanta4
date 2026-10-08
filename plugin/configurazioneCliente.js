/*
 * I20-1064: quale cliente usa il Plugin su questa postazione.
 *
 * Prima monta-cliente.sh copiava plugin/Agenzie/<Cliente>/custom.js in plugin/custom.js, e il
 * Plugin leggeva la copia. La copia non sta in git: una correzione fatta li' e non riportata
 * nell'archivio si perdeva al montaggio successivo. Ora non si copia niente, come per agenzia.js
 * di Istanta: si legge direttamente l'archivio del cliente.
 *
 * La catena e' di tre file, tutti relativi alla cartella del Plugin:
 *
 *     clienteAttivo.json              { "ipconfig": "Agenzie/Edro21/ipconfig.json" }
 *     Agenzie/Edro21/ipconfig.json    gli indirizzi, piu' "custom": "Agenzie/Edro21/custom.js"
 *     Agenzie/Edro21/custom.js        la logica del cliente, quella in git
 *
 * clienteAttivo.json e' per il Plugin quello che launchSettings.json e' per Istanta: lo scrive
 * monta-cliente.sh e non sta in git, come gli ipconfig. Il modello neutro da cui nasce un
 * ipconfig nuovo e' Agenzie/ipconfig.template.json, che in git c'e'.
 *
 * Se un anello manca il Plugin non parte, e il messaggio dice quale: indexNew.js lo mostra nel
 * riquadro di avvio. Non c'e' ripiego sui vecchi file in radice.
 *
 * Non richiede InDesign: il require arriva come parametro da indexNew.js, cosi' i percorsi si
 * risolvono dalla radice del Plugin, e qui sotto Node si prova con un require finto.
 */

const ConfigurazioneCliente = {

    PUNTATORE: "clienteAttivo.json",
    MONTAGGIO: "./monta-cliente.sh <Cliente>",

    /// Un percorso dentro la cartella del Plugin, scritto relativo: niente percorsi assoluti e
    /// niente "..", che porterebbero a leggere file fuori dal Plugin.
    percorsoValido(percorso) {
        if (typeof percorso !== "string" || percorso.trim() === "") {
            return false;
        }
        if (/^([\\/]|[A-Za-z]:)/.test(percorso)) {
            return false;
        }
        return !percorso.split(/[\\/]/).includes("..");
    },

    /// Il percorso come lo vuole il require di indexNew.js, senza "./" davanti.
    normalizza(percorso) {
        return percorso.trim().replace(/\\/g, "/").replace(/^(\.\/)+/, "");
    },

    /// Carica la catena. richiedi(percorso) fa il require di un file dato il percorso relativo
    /// alla cartella del Plugin. Torna { ipconfig, customAgenzia, percorsoIpconfig, percorsoCustom }
    /// oppure { errore } con il testo da mostrare all'operatore.
    carica(richiedi) {
        const leggi = function (percorso) {
            try {
                return { valore: richiedi(percorso) };
            }
            catch (e) {
                return { messaggio: e && e.message ? e.message : String(e) };
            }
        };
        const montaDiNuovo = "Lanciare " + ConfigurazioneCliente.MONTAGGIO + " dalla radice del repository.";

        const puntatore = leggi(ConfigurazioneCliente.PUNTATORE);
        if (puntatore.messaggio != null) {
            return { errore: "Nessun cliente montato su questa postazione: manca plugin/" + ConfigurazioneCliente.PUNTATORE + ". " + montaDiNuovo };
        }
        const percorsoIpconfig = puntatore.valore != null ? puntatore.valore.ipconfig : null;
        if (!ConfigurazioneCliente.percorsoValido(percorsoIpconfig)) {
            return { errore: "plugin/" + ConfigurazioneCliente.PUNTATORE + " non indica un ipconfig valido nella cartella del Plugin. " + montaDiNuovo };
        }

        const ipconfig = leggi(ConfigurazioneCliente.normalizza(percorsoIpconfig));
        if (ipconfig.messaggio != null) {
            return { errore: "Non riesco a leggere plugin/" + ConfigurazioneCliente.normalizza(percorsoIpconfig) + " (" + ipconfig.messaggio + "). " +
                montaDiNuovo + " Lo crea da plugin/Agenzie/ipconfig.template.json, poi vanno scritti gli indirizzi." };
        }
        const percorsoCustom = ipconfig.valore != null ? ipconfig.valore.custom : null;
        if (!ConfigurazioneCliente.percorsoValido(percorsoCustom)) {
            return { errore: "plugin/" + ConfigurazioneCliente.normalizza(percorsoIpconfig) + " non indica in \"custom\" il custom.js del cliente, per esempio \"Agenzie/Edro21/custom.js\"." };
        }

        const custom = leggi(ConfigurazioneCliente.normalizza(percorsoCustom));
        if (custom.messaggio != null) {
            return { errore: "Non riesco a caricare plugin/" + ConfigurazioneCliente.normalizza(percorsoCustom) + " (" + custom.messaggio + ")." };
        }

        return {
            ipconfig: ipconfig.valore,
            customAgenzia: custom.valore,
            percorsoIpconfig: ConfigurazioneCliente.normalizza(percorsoIpconfig),
            percorsoCustom: ConfigurazioneCliente.normalizza(percorsoCustom)
        };
    }
};

module.exports = ConfigurazioneCliente;
