/*
 * TASK-9d0fffc9: il registro dell'avvio del Plugin.
 *
 * Su una postazione il Plugin restava su "Avvio del plugin in corso..." senza lasciare traccia: i
 * log si scrivono nella cartella logs del documento, che all'avvio puo' non esserci ancora, e i
 * passi dell'avvio non si registravano da nessuna parte. Qui ogni passo dell'avvio diventa una riga
 * del log della giornata, nello stesso formato di messaggioUtente (cosi' "Leggi log" la rilegge),
 * con il tempo trascorso dall'inizio.
 *
 * - Finche' la cartella logs non c'e', le righe restano in memoria; appena c'e' si scrivono, in
 *   ordine (scarica).
 * - Se dopo SOGLIA_BLOCCO_MS l'avvio non e' concluso, si registra l'ultimo passo raggiunto con lo
 *   stato del ciclo; se logs non c'e', le righe vanno in un log apposito nella cartella del
 *   documento aperto, logAvvio_<macchina>_<data>.txt. Senza documento resta la console.
 * - Concluso l'avvio (login, pannello di lavoro, Istanta giu') il registro scrive solo i passi che
 *   gli si chiedono ancora esplicitamente.
 *
 * Non richiede InDesign: tutto arriva da ambiente, cosi' si carica sotto Node e si prova con
 * oggetti finti. ambiente: { ora, fs, console, macchina, cartellaLog, cartellaDocumento, stato }.
 */

const RegistroAvvio = {

    SOGLIA_BLOCCO_MS: 30000,

    _dueCifre(n) {
        return n < 10 ? "0" + n : "" + n;
    },

    /// Il giorno come nel nome dei log di messaggioUtente: log_26-11-2026.txt, senza zeri davanti.
    giornoNelNome(data) {
        return data.getDate() + "-" + (data.getMonth() + 1) + "-" + data.getFullYear();
    },

    /// Il nome del log apposito nella cartella del documento: la macchina nel nome, perche' due
    /// postazioni sulla stessa cartella condivisa non si scrivano sopra.
    nomeLogApposito(macchina, data) {
        const nome = String(macchina == null ? "" : macchina).replace(/[^A-Za-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "macchina";
        return "logAvvio_" + nome + "_" + RegistroAvvio.giornoNelNome(data) + ".txt";
    },

    _senzaBarraFinale(percorso) {
        return String(percorso == null ? "" : percorso).replace(/[\\/]+$/, "");
    },

    /// Aggiunge voci al file di log (un array JSON, come appendToFile). Torna false se non scrive.
    aggiungiAlFile(fs, percorso, voci) {
        try {
            let esistenti = [];
            try {
                const testo = fs.readFileSync(percorso, 'utf8');
                if (testo != null && String(testo).trim() !== "") {
                    esistenti = JSON.parse(testo);
                }
            }
            catch (e) {
                esistenti = [];
            }
            if (!Array.isArray(esistenti)) {
                esistenti = [];
            }
            fs.writeFileSync(percorso, JSON.stringify(esistenti.concat(voci)));
            return true;
        }
        catch (e) {
            return false;
        }
    },

    /// Un registro nuovo: l'avvio comincia adesso.
    crea(ambiente) {
        const amb = ambiente || {};
        const ora = typeof amb.ora === "function" ? amb.ora : function () { return Date.now(); };
        const uscita = amb.console || console;
        const leggi = function (funzione, riserva) {
            try {
                const valore = typeof funzione === "function" ? funzione() : riserva;
                return valore == null ? riserva : valore;
            }
            catch (e) {
                return riserva;
            }
        };

        const registro = {
            inizio: ora(),
            voci: [],
            scritte: 0,
            concluso: false,
            bloccato: false,
            ultimoPasso: null,
            ultimoPassoAlle: null,

            /// Un passo dell'avvio: in console subito, nel log appena si puo'.
            passo(testo, dettagli = null, stile = "info") {
                const adesso = ora();
                const data = new Date(adesso);
                const trascorso = adesso - registro.inizio;
                let msg = "Avvio +" + trascorso + " ms: " + testo;
                if (dettagli != null && String(dettagli) !== "") {
                    msg += " - " + dettagli;
                }
                const voce = {
                    data: RegistroAvvio._dueCifre(data.getDate()) + "/" + RegistroAvvio._dueCifre(data.getMonth() + 1) + "/" + data.getFullYear(),
                    orario: RegistroAvvio._dueCifre(data.getHours()) + ":" + RegistroAvvio._dueCifre(data.getMinutes()) + ":" + RegistroAvvio._dueCifre(data.getSeconds()),
                    macchina: String(leggi(amb.macchina, "")),
                    stile: stile,
                    msg: msg
                };
                registro.voci.push(voce);
                registro.ultimoPasso = testo;
                registro.ultimoPassoAlle = adesso;
                try {
                    if (stile === "error") {
                        uscita.error("[Avvio] " + msg);
                    }
                    else {
                        uscita.log("[Avvio] " + msg);
                    }
                }
                catch (e) {
                    //la console non deve fermare l'avvio
                }
                registro.scarica();
                return voce;
            },

            /// Un errore non gestito durante l'avvio, con il suo stack.
            errore(errore, origine = "") {
                if (registro.concluso) {
                    return null;
                }
                let testo = "";
                let pila = "";
                try {
                    testo = errore != null && errore.message ? errore.message : String(errore);
                    pila = errore != null && errore.stack ? String(errore.stack) : "";
                }
                catch (e) {
                    testo = "errore illeggibile";
                }
                return registro.passo("Errore non gestito" + (origine ? " (" + origine + ")" : "") + ": " + testo, pila, "error");
            },

            /// Dove scrivere adesso: il log della giornata in logs; se l'avvio e' bloccato e logs non
            /// c'e', il log apposito nella cartella del documento; altrimenti da nessuna parte.
            destinazione() {
                const data = new Date(ora());
                const logs = String(leggi(amb.cartellaLog, ""));
                if (logs !== "") {
                    return RegistroAvvio._senzaBarraFinale(logs) + "/log_" + RegistroAvvio.giornoNelNome(data) + ".txt";
                }
                const documento = String(leggi(amb.cartellaDocumento, ""));
                if (registro.bloccato && documento !== "") {
                    return RegistroAvvio._senzaBarraFinale(documento) + "/" + RegistroAvvio.nomeLogApposito(leggi(amb.macchina, ""), data);
                }
                return null;
            },

            /// Scrive le righe non ancora scritte. Torna true se adesso non ne resta nessuna.
            scarica() {
                if (registro.scritte >= registro.voci.length) {
                    return true;
                }
                const percorso = registro.destinazione();
                if (percorso == null || amb.fs == null) {
                    return false;
                }
                if (!RegistroAvvio.aggiungiAlFile(amb.fs, percorso, registro.voci.slice(registro.scritte))) {
                    return false;
                }
                registro.scritte = registro.voci.length;
                return true;
            },

            /// Da chiamare a intervalli: se l'avvio non e' concluso dopo la soglia, registra una volta
            /// l'ultimo passo raggiunto con lo stato del ciclo, e scrive. Restituisce il testo da
            /// mostrare sotto il messaggio di avvio, o null se l'avvio non e' fermo.
            controllaBlocco() {
                if (registro.concluso) {
                    return null;
                }
                const adesso = ora();
                if (adesso - registro.inizio < RegistroAvvio.SOGLIA_BLOCCO_MS) {
                    return null;
                }
                if (!registro.bloccato) {
                    const passoFermo = registro.ultimoPasso;
                    const fermoDa = registro.ultimoPassoAlle != null ? adesso - registro.ultimoPassoAlle : 0;
                    let stato = "";
                    try {
                        stato = JSON.stringify(leggi(amb.stato, {}));
                    }
                    catch (e) {
                        stato = "";
                    }
                    registro.bloccato = true;
                    registro.passo("Avvio non concluso dopo " + Math.round((adesso - registro.inizio) / 1000) + " s; ultimo passo: " +
                        (passoFermo || "nessuno") + " (da " + Math.round(fermoDa / 1000) + " s)", stato, "error");
                    //il passo del blocco diventa l'ultimo: per chi legge conta quello di prima
                    registro.ultimoPasso = passoFermo;
                    registro.ultimoPassoAlle = adesso - fermoDa;
                }
                registro.scarica();
                return registro.testoBlocco();
            },

            /// "Fermo a: <passo> da N s", per l'operatore.
            testoBlocco() {
                if (registro.concluso || !registro.bloccato) {
                    return null;
                }
                const secondi = registro.ultimoPassoAlle != null ? Math.round((ora() - registro.ultimoPassoAlle) / 1000) : 0;
                return "Fermo a: " + (registro.ultimoPasso || "inizio dell'avvio") + " da " + secondi + " s";
            },

            /// L'avvio e' finito: si registra come e da qui in poi la vigilanza tace.
            concludi(come) {
                if (registro.concluso) {
                    return;
                }
                registro.passo("Avvio concluso: " + come);
                registro.concluso = true;
            }
        };
        return registro;
    }
};

module.exports = RegistroAvvio;
