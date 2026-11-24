/// TASK-22d7fad2, lotto 3: creare un box derivato dal Plugin.
///
/// Un box derivato e' una seconda impaginazione del record di un box gia' impaginato, in una
/// lavorazione Volantino: ha una riga propria su Istanta, con una copia dei meta dell'originale, e
/// nel DNA lo slot idRec*idLavRec (dnaBox.js). Nasce solo su richiesta dell'operatore, che ne
/// indica la pagina: dal Reimpagina box della scheda, con la spunta "Impagina come derivato", o
/// dal tracciato, quando l'originale e' registrato a una pagina che il documento aperto non ha.
///
/// Qui stanno le regole (quando si puo' derivare, quale pagina va bene, quali derivati di un
/// record ci sono nel documento), la finestra che chiede la pagina, con il motivo scritto dentro
/// quando non va bene, e la creazione: registrazione su Istanta (Menabo/creaDerivato), scheda del
/// derivato, impaginazione. Se l'impaginazione non riesce la registrazione si toglie, perche' un
/// derivato senza box non serve a nessuno.
///
/// Non fa require('indesign'): si carica sotto Node, e i test chiamano le regole. Il documento, la
/// scheda e le funzioni dell'impaginazione sono le globali del Plugin, usate solo a richiesta.

const DnaBox = require('./dnaBox');
const VersionePrecedente = require('./versionePrecedente');
const XMLHttpRequestClient = require('./XMLHttpRequestClient');
const CampiARiposo = require('./campiARiposo');

const BoxDerivati = {
    /// Il tipo di lavorazione in cui esistono i derivati (TipoLavorazione.Volantino su Istanta).
    TIPO_VOLANTINO: 1,

    /// La pagina di un derivato sta in un byte su Istanta.
    PAGINA_MASSIMA: 255,

    /// Oltre questa attesa la registrazione del derivato si da' per non riuscita.
    ATTESA_MASSIMA_REGISTRAZIONE: 30000,

    /// Un derivato nasce solo nel Volantino, e mai da un box che e' a sua volta un derivato.
    puoDerivare(tipoLavorazione, idLavRec) {
        return Number(tipoLavorazione) === BoxDerivati.TIPO_VOLANTINO && DnaBox.idValido(idLavRec) === 0;
    },

    /// I nomi delle pagine del documento, come testo. Vuoto se il documento non si legge.
    nomiPagine(doc) {
        const nomi = [];
        try {
            for (let i = 0; i < doc.pages.length; i++) {
                nomi.push(String(doc.pages.item(i).name));
            }
        }
        catch (e) {
            return [];
        }
        return nomi;
    },

    /// Se la pagina e' una di quelle del documento.
    paginaNelDocumento(pagina, nomiPagine) {
        return pagina != null && (Array.isArray(nomiPagine) ? nomiPagine : []).map(n => String(n)).indexOf(String(pagina)) >= 0;
    },

    /// Le pagine del documento in poche parole: "1-8", "1-4, 7, 9-12". I nomi che non sono numeri
    /// restano in fondo, cosi' come sono.
    descriviPagine(nomiPagine) {
        const nomi = (Array.isArray(nomiPagine) ? nomiPagine : []).map(n => String(n));
        const numeri = nomi.filter(n => /^\d+$/.test(n)).map(n => parseInt(n, 10)).sort((a, b) => a - b);
        const altri = nomi.filter(n => !/^\d+$/.test(n));
        const tratti = [];
        for (let i = 0; i < numeri.length; i++) {
            let fine = i;
            while (fine + 1 < numeri.length && numeri[fine + 1] === numeri[fine] + 1) {
                fine++;
            }
            tratti.push(fine > i ? numeri[i] + "-" + numeri[fine] : String(numeri[i]));
            i = fine;
        }
        return tratti.concat(altri).join(", ");
    },

    /// La pagina scritta dall'operatore: { pagina } se va bene, altrimenti { errore } con il motivo
    /// da mostrargli. Va bene un numero intero che e' una pagina del documento.
    validaPagina(testo, nomiPagine) {
        const scritto = testo == null ? "" : String(testo).trim();
        if (scritto === "") {
            return { errore: "Indica la pagina in cui impaginare il derivato." };
        }
        if (!/^\d+$/.test(scritto)) {
            return { errore: "\"" + scritto + "\" non e' un numero di pagina." };
        }
        const pagina = parseInt(scritto, 10);
        if (pagina < 1 || pagina > BoxDerivati.PAGINA_MASSIMA) {
            return { errore: "La pagina deve essere fra 1 e " + BoxDerivati.PAGINA_MASSIMA + "." };
        }
        if (!BoxDerivati.paginaNelDocumento(pagina, nomiPagine)) {
            const pagine = BoxDerivati.descriviPagine(nomiPagine);
            return { errore: "La pagina " + pagina + " non e' in questo documento" + (pagine !== "" ? " (pagine: " + pagine + ")." : ".") };
        }
        return { pagina: pagina };
    },

    /// I box derivati di un record che stanno nel documento, sul livello InPagina:
    /// [{ pagina, idLavRec, box }]. leggiDna e' Utility.getDnaOfBox.
    derivatiNelDocumento(doc, codiceGruppo, idRec, leggiDna) {
        const numero = (valore) => {
            const n = parseInt(valore);
            return isNaN(n) ? null : n;
        };
        const idRecCercato = numero(idRec);
        return VersionePrecedente.gruppiConDnaSulLivello(doc, "InPagina", leggiDna)
            .filter(c => DnaBox.idLavRecDi(c.dna) > 0
                && String(c.dna.codice_gruppo) === String(codiceGruppo)
                && (idRecCercato == null || numero(c.dna.idRec) === idRecCercato))
            .map(c => ({ pagina: c.pagina, idLavRec: DnaBox.idLavRecDi(c.dna), box: c.gruppo }));
    },

    /// L'avviso per chi ha appena cambiato il dato dall'originale: quanti derivati ci sono nel
    /// documento e a quali pagine. Null se non ce ne sono.
    /// I20-1257: soggetto cambia l'inizio della frase (per le correzioni di Correggo, che toccano
    /// piu' box: "I box corretti hanno").
    testoAvvisoDerivati(derivati, soggetto = "Questo box ha") {
        const elenco = Array.isArray(derivati) ? derivati : [];
        if (elenco.length === 0) {
            return null;
        }
        const pagine = elenco.map(d => String(d.pagina)).filter((p, i, tutte) => tutte.indexOf(p) === i);
        return "Code DRV-06 " + soggetto + " " + (elenco.length === 1 ? "1 derivato" : elenco.length + " derivati")
            + " nel documento, a pagina " + pagine.join(", ")
            + ": " + (elenco.length === 1 ? "va reimpaginato" : "vanno reimpaginati") + " per prendere il dato nuovo.";
    },

    /// I campi della richiesta a Menabo/creaDerivato. idLavRec e' quello del box di partenza: se
    /// e' un derivato Istanta rifiuta, e dice perche'.
    richiestaDiCreazione(idLavorazione, dati) {
        return {
            idLavorazione: idLavorazione,
            codiceGruppo: dati.codiceGruppo != null ? String(dati.codiceGruppo) : "",
            idRec: DnaBox.idValido(dati.idRec),
            idLavRec: DnaBox.idValido(dati.idLavRec),
            pagina: dati.pagina
        };
    },

    /// Registra il derivato su Istanta. Si risolve con la risposta ({ esito, error, idLavRec,
    /// idRec, pagina }); una richiesta che non arriva in fondo vale { esito: false, error }.
    registra(dati) {
        return new Promise(resolve => {
            let risposto = false;
            const rispondi = (valore) => {
                if (!risposto) {
                    risposto = true;
                    resolve(valore);
                }
            };

            try {
                const richiesta = BoxDerivati.richiestaDiCreazione(idKitLavorazione, dati);
                const formData = new FormData();
                Object.keys(richiesta).forEach(chiave => formData.append(chiave, richiesta[chiave]));

                const xhr = new XMLHttpRequestClient();
                xhr.descrizione = "Registrazione del box derivato";
                xhr.onload = (objResult, parsed) => {
                    try {
                        rispondi(parsed ? objResult : JSON.parse(objResult));
                    }
                    catch (e) {
                        rispondi({ esito: false, error: "risposta non leggibile: " + e });
                    }
                };
                xhr.onerror = (motivo) => rispondi({ esito: false, error: XMLHttpRequestClient.testoErrore(motivo) });
                xhr.onabort = (motivo) => rispondi({ esito: false, error: "annullato a causa di: " + motivo });
                setTimeout(() => rispondi({ esito: false, error: "Istanta non ha risposto in tempo" }), BoxDerivati.ATTESA_MASSIMA_REGISTRAZIONE);
                xhr.send("Menabo/creaDerivato", formData, "PUT");
            }
            catch (e) {
                rispondi({ esito: false, error: String(e) });
            }
        });
    },

    /// Crea un derivato del record alla pagina indicata e lo impagina: { codiceGruppo, idRec,
    /// idLavRec, pagina }, dove idRec e idLavRec sono quelli del box di partenza. Si risolve con il
    /// box nuovo, o null se non e' nato: in quel caso su Istanta non resta niente.
    async creaEImpagina(dati) {
        let registrato = null;
        indesignEvents.setBusy(true);
        try {
            showLoading("Registrazione del derivato a pagina " + dati.pagina + "...");
            const risposta = await BoxDerivati.registra(dati);
            if (risposta == null || !risposta.esito) {
                messaggioUtente("Code DRV-01 Derivato non creato: " + (risposta != null && risposta.error ? risposta.error : "errore non precisato"), "error", false, 10);
                return null;
            }
            registrato = { codice: String(dati.codiceGruppo), idRec: DnaBox.idValido(risposta.idRec), idLavRec: DnaBox.idValido(risposta.idLavRec) };

            showLoading("Impaginazione del derivato a pagina " + dati.pagina + "...");
            //La scheda del derivato: i suoi record portano l'idLavRec, che finisce nel DNA del box.
            const scheda = await getSchedaRefAsync(schedaRef, registrato.codice, registrato.idRec, registrato.idLavRec);
            if (scheda == null || !Array.isArray(scheda.records) || scheda.records.length === 0) {
                throw new Error(scheda != null && scheda.error ? scheda.error : "la scheda del derivato non e' arrivata");
            }

            assicuraLivelloInPagina(docInLavorazione);
            const esito = await impaginazioneSingoloIndd(scheda.records, dati.pagina);
            const box = esito != null ? (esito.boxFinale || esito.boxAggiunto || (esito.isValid ? esito : null)) : null;
            if (box == null) {
                throw new Error("il box non e' stato impaginato a pagina " + dati.pagina);
            }

            registrato = null;
            messaggioUtente("Code DRV-02 Derivato di " + dati.codiceGruppo + " impaginato a pagina " + dati.pagina, "success", false, 5);
            return box;
        }
        catch (e) {
            console.error("Creazione del derivato non riuscita:", e);
            messaggioUtente("Code DRV-03 Derivato non impaginato: " + (e && e.message ? e.message : e) + (registrato != null ? ". La sua registrazione viene tolta." : ""), "error", false, 10);
            return null;
        }
        finally {
            if (registrato != null) {
                await BoxDerivati.togliRegistrazione(registrato);
            }
            hideLoading();
            indesignEvents.setBusy(false);
        }
    },

    /// Toglie da Istanta un derivato registrato e non impaginato. Il box dell'originale non si tocca:
    /// la voce porta l'idLavRec, e Istanta cancella solo quella riga.
    async togliRegistrazione(registrato) {
        try {
            await rimuoviRefImpaginata([registrato], true);
        }
        catch (e) {
            console.error("Registrazione del derivato non tolta:", e);
            messaggioUtente("Code DRV-04 La registrazione del derivato " + registrato.codice + " non e' stata tolta: la togliera' il Report Integrita'.", "warning", false, 10);
        }
    },

    /// La finestra che chiede cosa fare, con il campo della pagina del derivato e il motivo scritto
    /// dentro quando la pagina non va bene: in quel caso resta aperta.
    ///
    ///   titolo, righe          il titolo e le righe di testo sotto
    ///   avviso                 un testo in rosso, o null
    ///   derivato               null se il derivato non si offre; altrimenti { conSpunta, testo }:
    ///                          con la spunta il campo pagina compare solo spuntando, senza e'
    ///                          sempre li'
    ///   nomiPagine             le pagine del documento, per il controllo
    ///   pulsanti               [{ testo, azione, colore, pagina }]: pagina "sempre" vuole una
    ///                          pagina valida, "conSpunta" la vuole se la spunta e' attiva, e allora
    ///                          l'azione diventa "derivato"
    ///
    /// Si risolve con { azione, pagina }; chiudere la finestra da fuori vale "annulla".
    async chiedi(config) {
        let esito = null;
        try {
            CampiARiposo.tuttiARiposo();
            $("#derivatoModal").remove();

            const modal = $('<div id="derivatoModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5); z-index: 5001; display: flex; justify-content: center; align-items: center; padding: 10px; box-sizing: border-box;"></div>');
            const dialog = $('<div style="width: 620px; max-width: 90%; max-height: 85%; background-color: white; color: black; display: flex; flex-direction: column; justify-content: space-between; align-items: stretch; padding: 16px; box-sizing: border-box; border-radius: 8px;"></div>');
            const corpo = $('<div style="overflow: auto; display: flex; flex-direction: column; gap: 8px;"></div>');

            corpo.append($('<h3 style="margin: 0; color: black;"></h3>').text(config.titolo || ""));
            (config.righe || []).forEach(riga => corpo.append($('<div style="font-size: 13px; color: black;"></div>').text(riga)));
            if (config.avviso) {
                corpo.append($('<div id="avvisoDerivatoModal" style="font-weight: bold; color: red; font-size: 13px;"></div>').text(config.avviso));
            }

            //In UXP il riferimento tenuto a un input da quando e' stato creato non ne riflette lo
            //stato: misurato in console il 23/11/2026, nel gestore del change this.checked era true e
            //il riferimento dava undefined. Lo stato della spunta e il testo del campo si leggono
            //quindi dall'evento, o ritrovando l'elemento nella finestra, come fanno le finestre di
            //eliminazione. Vale per chi si legge; gli eventi agganciati al riferimento partono.
            const nellaFinestra = (id) => $("#derivatoModal").find("#" + id);
            const spuntaAttiva = () => nellaFinestra("chkImpaginaComeDerivato").prop("checked") === true;

            let spunta = null;
            let campo = null;
            const errore = $('<div id="erroreDerivato" style="color: red; font-size: 12px; min-height: 16px;"></div>');
            if (config.derivato != null) {
                const riquadro = $('<div style="border-top: 1px solid #ddd; padding-top: 8px; display: flex; flex-direction: column; gap: 6px;"></div>');
                const rigaPagina = $('<div id="rigaPaginaDerivato" style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: black;"></div>');
                campo = $('<input type="text" id="txtPaginaDerivato" autocomplete="off" style="width: 70px; color: black;">');
                rigaPagina.append($('<span></span>').text("Pagina del derivato:")).append(campo);

                if (config.derivato.conSpunta) {
                    const rigaSpunta = $('<label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: black; cursor: pointer;"></label>');
                    spunta = $('<input type="checkbox" id="chkImpaginaComeDerivato">');
                    rigaSpunta.append(spunta).append($('<span></span>').text(config.derivato.testo || "Impagina come derivato"));
                    riquadro.append(rigaSpunta);
                    rigaPagina.css("display", "none");
                    errore.css("display", "none");
                    spunta.on("change", function (evento) {
                        const casella = evento != null && evento.target != null ? evento.target : this;
                        const attiva = casella.checked === true;
                        nellaFinestra("rigaPaginaDerivato").css("display", attiva ? "flex" : "none");
                        nellaFinestra("erroreDerivato").css("display", attiva ? "block" : "none").text("");
                    });
                }
                else if (config.derivato.testo) {
                    riquadro.append($('<div style="font-size: 13px; color: black;"></div>').text(config.derivato.testo));
                }

                riquadro.append(rigaPagina).append(errore);
                corpo.append(riquadro);
                campo.on("input", function () { nellaFinestra("erroreDerivato").text(""); });
            }

            const piede = $('<div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; flex-wrap: wrap;"></div>');
            const premi = function (pulsante) {
                const conSpunta = spunta != null && spuntaAttiva();
                const vuolePagina = pulsante.pagina === "sempre" || (pulsante.pagina === "conSpunta" && conSpunta);
                if (!vuolePagina) {
                    esito = { azione: pulsante.azione, pagina: null };
                }
                else {
                    const valida = BoxDerivati.validaPagina(campo != null ? nellaFinestra("txtPaginaDerivato").val() : "", config.nomiPagine);
                    if (valida.errore) {
                        //Il motivo resta nella finestra, che non si chiude.
                        nellaFinestra("erroreDerivato").css("display", "block").text(valida.errore);
                        return;
                    }
                    esito = { azione: pulsante.pagina === "conSpunta" ? "derivato" : pulsante.azione, pagina: valida.pagina };
                }
                $("#derivatoModal").remove();
            };
            (config.pulsanti || []).forEach(pulsante => {
                const bottone = $('<button style="min-width: 110px; height: 26px; padding: 0 10px; color: white; border: none; border-radius: 5px; cursor: pointer;"></button>')
                    .text(pulsante.testo)
                    .css("background-color", pulsante.colore || "#0d6efd");
                bottone.on("click", function () { premi(pulsante); });
                piede.append(bottone);
            });
            if (campo != null) {
                campo.on("keydown", function (e) {
                    const conInvio = (config.pulsanti || []).find(p => p.pagina === "sempre" || p.pagina === "conSpunta");
                    if ((e.key === "Enter" || e.keyCode === 13) && conInvio != null) {
                        premi(conInvio);
                    }
                });
            }

            modal.on("click", function (e) { e.stopPropagation(); });
            dialog.append(corpo).append(piede);
            modal.append(dialog);
            $("body").append(modal);

            while (esito == null) {
                //Tolta da fuori (un'altra finestra, un cambio di schermata): vale Annulla.
                if ($("#derivatoModal").length === 0) {
                    esito = { azione: "annulla", pagina: null };
                    break;
                }
                await delay(100);
            }
            return esito;
        }
        catch (e) {
            console.error("Errore nella finestra del derivato:", e);
            $("#derivatoModal").remove();
            return { azione: "annulla", pagina: null };
        }
    },

    /// La conferma del Reimpagina box di un box solo. puoDerivare dice se offrire la spunta.
    /// Si risolve con { azione: "reimpagina" | "derivato" | "annulla", pagina }.
    chiediReimpagina(dati) {
        const righe = [];
        if (dati.descrizione) {
            righe.push(dati.descrizione);
        }
        if (dati.eDerivato) {
            righe.push("Questo box e' un derivato: viene rifatto con i suoi meta.");
        }
        return BoxDerivati.chiedi({
            titolo: "Reimpaginare il box " + dati.codiceGruppo + "?",
            righe: righe,
            avviso: null,
            derivato: dati.puoDerivare ? { conSpunta: true, testo: "Impagina come derivato" } : null,
            nomiPagine: dati.nomiPagine,
            pulsanti: [
                { testo: "Annulla", azione: "annulla", colore: "#6c757d", pagina: false },
                { testo: "Reimpagina", azione: "reimpagina", colore: "#0d6efd", pagina: "conSpunta" }
            ]
        });
    },

    /// Dal tracciato: il record e' registrato a una pagina che il documento non ha. Si puo'
    /// impaginarne un derivato a una pagina del documento (solo nel Volantino), toglierlo dal
    /// server sapendo che sta altrove, o lasciare tutto com'e'.
    /// Si risolve con { azione: "derivato" | "rimuovi" | "annulla", pagina }.
    chiediPerPaginaAssente(dati) {
        const pagine = BoxDerivati.descriviPagine(dati.nomiPagine);
        return BoxDerivati.chiedi({
            titolo: "Elemento a una pagina non presente in questo documento",
            righe: [
                "Codice: " + dati.codice,
                "Id record: " + dati.idRec,
                "Pagina registrata: " + dati.paginaRegistrata,
                "Pagine di questo documento: " + (pagine !== "" ? pagine : "nessuna")
            ],
            avviso: "Attenzione: \"Rimuovi dal server\" toglie dall'impaginato un elemento che sta a pagina " + dati.paginaRegistrata
                + ", non presente in questo documento. Potrebbe essere impaginato in un altro documento della lavorazione.",
            derivato: dati.puoDerivare ? { conSpunta: false, testo: "Per averlo anche qui, impagina un derivato a una pagina di questo documento." } : null,
            nomiPagine: dati.nomiPagine,
            pulsanti: [
                { testo: "Annulla", azione: "annulla", colore: "#6c757d", pagina: false },
                { testo: "Rimuovi dal server", azione: "rimuovi", colore: "#dc3545", pagina: false }
            ].concat(dati.puoDerivare ? [{ testo: "Impagina derivato", azione: "derivato", colore: "#0d6efd", pagina: "sempre" }] : [])
        });
    }
};

module.exports = BoxDerivati;
