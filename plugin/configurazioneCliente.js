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
    },

    /* ---------- I20-1066: gli indirizzi del server nella voce della lavorazione ---------- */

    /// Gli indirizzi di Istanta e di Olimpo come si salvano nella voce di lavorazioni.json: quelli
    /// dell'ipconfig montato quando la voce nasce.
    indirizziServer(istanta, olimpo) {
        return {
            istanta: istanta == null ? "" : String(istanta),
            olimpo: olimpo == null ? "" : String(olimpo)
        };
    },

    /// Un indirizzo da confrontare: senza spazi intorno, senza "/" in fondo, minuscolo.
    indirizzoConfrontabile(indirizzo) {
        return String(indirizzo == null ? "" : indirizzo).trim().replace(/\/+$/, "").toLowerCase();
    },

    /// Gli indirizzi registrati nella voce contro quelli dell'ipconfig attuale. "mancanti" se la
    /// voce non li ha (e' nata prima di I20-1066), "uguali" o "diversi"; diversi elenca quali, coi
    /// due valori, per l'errore da mostrare.
    confrontaIndirizzi(registrati, attuali) {
        const istantaRegistrato = registrati != null ? ConfigurazioneCliente.indirizzoConfrontabile(registrati.istanta) : "";
        const olimpoRegistrato = registrati != null ? ConfigurazioneCliente.indirizzoConfrontabile(registrati.olimpo) : "";
        if (istantaRegistrato === "" && olimpoRegistrato === "") {
            return { esito: "mancanti", diversi: [] };
        }
        const diversi = [];
        [["Istanta", "istanta"], ["Olimpo", "olimpo"]].forEach(function (coppia) {
            const registrato = ConfigurazioneCliente.indirizzoConfrontabile(registrati[coppia[1]]);
            const attuale = ConfigurazioneCliente.indirizzoConfrontabile(attuali != null ? attuali[coppia[1]] : "");
            if (registrato !== attuale) {
                diversi.push({ nome: coppia[0], registrato: String(registrati[coppia[1]] == null ? "" : registrati[coppia[1]]), attuale: String(attuali != null && attuali[coppia[1]] != null ? attuali[coppia[1]] : "") });
            }
        });
        return { esito: diversi.length === 0 ? "uguali" : "diversi", diversi: diversi };
    },

    /// Il dettaglio dell'errore di blocco: gli indirizzi della lavorazione e quelli di adesso.
    testoIndirizziDiversi(diversi) {
        const righe = (diversi || []).map(d => d.nome + ": lavorazione " + (d.registrato || "(vuoto)") + " - Plugin " + (d.attuale || "(vuoto)"));
        return "La lavorazione di questo documento e' stata creata con un altro server. " + righe.join("; ") +
            ". Montare il cliente giusto (" + ConfigurazioneCliente.MONTAGGIO + ") o correggere l'ipconfig, poi ricaricare il Plugin.";
    }
};

module.exports = ConfigurazioneCliente;
