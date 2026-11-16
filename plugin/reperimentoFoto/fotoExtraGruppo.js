/// Le foto extra di un gruppo nel Plugin.
///
/// Un gruppo ha una foto extra solo se tutte le sue referenze la hanno. Istanta scrive sul dato del
/// box di un gruppo le foto extra comuni (Foto.ExtraGruppo) e quelle presenti solo su alcune
/// referenze (Foto.ExtraParziali, con quante e quali): nel volantino su ogni record del gruppo, nel PoP
/// solo sul cartello di gruppo. Il box di un gruppo impagina le comuni; una referenza impaginata da
/// sola tiene le sue Foto.Extra, anche quelle che il gruppo non ha.
///
/// Le parziali non escono: il box riceve la segnalazione FEX-01 e dalla schermata Foto extra si
/// estendono a tutte le referenze o si eliminano. Funzioni pure, provate sotto Node.

const Segnalazioni = require('../segnalazioni/segnalazioni');

const NOMI_TIPO = { 2: "Bollino", 3: "Logo", 4: "Foto ambientata", 5: "Sfondo" };

const FotoExtraGruppo = {

    CODICE_SEGNALAZIONE: "FEX-01",

    /// Vero se il dato e' quello di un gruppo: Istanta gli ha scritto le foto extra del gruppo.
    eDiGruppo(tracciato) {
        return tracciato != null && Array.isArray(tracciato["Foto.ExtraGruppo"]);
    },

    /// Le foto extra che il box impagina: del gruppo per il box di un gruppo, altrimenti le sue.
    fotoExtraDelBox(tracciato) {
        if (tracciato == null) {
            return null;
        }
        return FotoExtraGruppo.eDiGruppo(tracciato) ? tracciato["Foto.ExtraGruppo"] : tracciato["Foto.Extra"];
    },

    /// Le foto extra presenti solo su alcune referenze del gruppo, come le ha scritte Istanta.
    parzialiDelBox(tracciato) {
        return tracciato != null && Array.isArray(tracciato["Foto.ExtraParziali"]) ? tracciato["Foto.ExtraParziali"] : [];
    },

    /// Le foto extra comuni e parziali dai record del gruppo in memoria, con la stessa regola di
    /// Istanta: confronto per GUID nell'ordine della primaria, attiva solo se lo e' su tutte. Serve
    /// alla schermata Foto extra, che dopo ogni operazione aggiorna le Foto.Extra dei record.
    comuniEParziali(records) {
        const membri = [];
        const codiciVisti = {};
        const ordinati = (records || []).slice().sort((a, b) => FotoExtraGruppo._ordine(a) - FotoExtraGruppo._ordine(b));
        ordinati.forEach(r => {
            const dato = r != null ? r.recordInTracciato : null;
            if (dato == null) {
                return;
            }
            const codice = String(dato["Referenza.Codice"] != null ? dato["Referenza.Codice"] : "");
            if (codiciVisti[codice]) {
                return;
            }
            codiciVisti[codice] = true;
            membri.push({ codice: codice, extra: (Array.isArray(dato["Foto.Extra"]) ? dato["Foto.Extra"] : []).filter(e => e != null && e.guidId) });
        });

        const comuni = [];
        const parziali = [];
        if (membri.length < 2) {
            return { comuni: membri.length === 1 ? membri[0].extra.slice() : [], parziali: parziali };
        }

        const visti = {};
        membri.forEach(m => m.extra.forEach(e => {
            if (visti[e.guidId]) {
                return;
            }
            visti[e.guidId] = true;
            const con = membri.filter(x => x.extra.some(y => y.guidId === e.guidId));
            if (con.length === membri.length) {
                comuni.push(Object.assign({}, e, { attiva: membri.every(x => x.extra.some(y => y.guidId === e.guidId && y.attiva !== false)) }));
            }
            else {
                parziali.push(Object.assign({}, e, {
                    presenti: con.length,
                    totale: membri.length,
                    codiciCon: con.map(x => x.codice),
                    codiciSenza: membri.filter(x => con.indexOf(x) < 0).map(x => x.codice)
                }));
            }
        }));
        return { comuni: comuni, parziali: parziali };
    },

    _ordine(record) {
        const stato = record != null && record.recordInTracciato != null ? Number(record.recordInTracciato.StatoSelezione) : NaN;
        return stato === 1 ? 0 : (stato === 2 ? 1 : 2);
    },

    /// Il nome con cui l'extra sta nel box e nelle segnalazioni: la sigla o, se non c'e', il nome del file.
    nomeDellExtra(extra) {
        return extra != null && extra.sigla ? extra.sigla : (extra != null ? extra.nome : "");
    },

    testoSegnalazione(parziale) {
        const tipo = NOMI_TIPO[Number(parziale.tipo)] || "Foto extra";
        return "Code " + FotoExtraGruppo.CODICE_SEGNALAZIONE + ": " + tipo + " " + FotoExtraGruppo.nomeDellExtra(parziale) +
            " presente solo su " + parziale.presenti + "/" + parziale.totale + " referenze del gruppo: non impaginato. Si risolve in Foto extra";
    },

    /// Gli argomenti di addSegnalazione per una foto extra parziale: avviso, nel bollino, una per GUID.
    segnalazione(parziale) {
        return {
            msg: FotoExtraGruppo.testoSegnalazione(parziale),
            typeMessage: "warning",
            key: FotoExtraGruppo.CODICE_SEGNALAZIONE + "$" + parziale.guidId,
            verifica: { fotoExtraParziale: parziale.guidId }
        };
    },

    /// Le voci di un bollino senza quella della foto extra parziale indicata.
    vociSenzaParziale(voci, guidId) {
        return (voci || []).filter(v => !(v != null && v.v != null && v.v.fotoExtraParziale === guidId));
    },

    /// Toglie dal bollino del box la segnalazione della foto extra parziale, dopo Estendi o Elimina.
    /// Restituisce il box com'e' dopo: il bollino puo' rifarne il gruppo.
    togliSegnalazioneParziale(box, guidId) {
        if (box == null || !box.isValid) {
            return box;
        }
        const voci = Segnalazioni.leggiDalBox(box);
        const restanti = FotoExtraGruppo.vociSenzaParziale(voci, guidId);
        if (restanti.length === voci.length) {
            return box;
        }
        return restanti.length > 0 ? Segnalazioni.applicaAlBox(box, restanti) : Segnalazioni.togliDalBox(box);
    },

    /// Riscrive sui record in memoria di un gruppo le foto extra comuni e le parziali, ricalcolate dalle
    /// loro Foto.Extra: dopo un'operazione della schermata sono quelle che il box e il fix devono usare.
    /// Solo sui dati che Istanta ha gia' segnato come di un gruppo.
    scriviInMemoria(records, calcolo) {
        (records || []).forEach(r => {
            [r != null ? r.recordInTracciato : null, r != null ? r.sottogruppo : null].forEach(dato => {
                if (FotoExtraGruppo.eDiGruppo(dato)) {
                    dato["Foto.ExtraGruppo"] = calcolo.comuni.map(e => Object.assign({}, e));
                    dato["Foto.ExtraParziali"] = calcolo.parziali.map(e => Object.assign({}, e));
                }
            });
        });
    },

    /// Dopo Estendi: le referenze a cui mancava ricevono la foto extra nei record in memoria.
    estendiInMemoria(records, parziale) {
        const extra = {
            nome: parziale.nome, tipo: parziale.tipo, guidId: parziale.guidId, attiva: parziale.attiva !== false,
            puntatore: parziale.puntatore === true, sigla: parziale.sigla || ""
        };
        (records || []).forEach(r => {
            const dato = r != null ? r.recordInTracciato : null;
            if (dato == null) {
                return;
            }
            if (!Array.isArray(dato["Foto.Extra"])) {
                dato["Foto.Extra"] = [];
            }
            if (!dato["Foto.Extra"].some(e => e != null && e.guidId === parziale.guidId)) {
                dato["Foto.Extra"].push(Object.assign({}, extra));
            }
        });
    },

    /// Dopo Elimina di una parziale: la foto extra non c'e' piu' su nessuna referenza.
    togliInMemoria(records, guidId) {
        (records || []).forEach(r => {
            const dato = r != null ? r.recordInTracciato : null;
            if (dato != null && Array.isArray(dato["Foto.Extra"])) {
                dato["Foto.Extra"] = dato["Foto.Extra"].filter(e => e == null || e.guidId !== guidId);
            }
        });
    },

    /* ---- i collegamenti a un logo che non e' piu' nell'archivio Loghi/Bolli ---- */

    /// I collegamenti non piu' a sistema delle referenze del box (Foto.ExtraNonASistema, scritte da
    /// Istanta): uno per GUID, con le referenze che lo hanno. Non vanno nel box; si eliminano.
    nonASistemaDelBox(records) {
        const perGuid = new Map();
        (records || []).forEach(r => {
            const dato = r != null ? r.recordInTracciato : null;
            const lista = dato != null && Array.isArray(dato["Foto.ExtraNonASistema"]) ? dato["Foto.ExtraNonASistema"] : [];
            lista.forEach(e => {
                if (e == null || !e.guidId) {
                    return;
                }
                if (!perGuid.has(e.guidId)) {
                    perGuid.set(e.guidId, Object.assign({}, e, { codici: [] }));
                }
                const codice = dato["Referenza.Codice"];
                const voce = perGuid.get(e.guidId);
                if (codice != null && !voce.codici.includes(codice)) {
                    voce.codici.push(codice);
                }
            });
        });
        return Array.from(perGuid.values());
    },

    /// Dopo Elimina di un collegamento non piu' a sistema: non c'e' piu' su nessuna referenza.
    togliNonASistemaInMemoria(records, guidId) {
        (records || []).forEach(r => {
            const dato = r != null ? r.recordInTracciato : null;
            if (dato != null && Array.isArray(dato["Foto.ExtraNonASistema"])) {
                dato["Foto.ExtraNonASistema"] = dato["Foto.ExtraNonASistema"].filter(e => e == null || e.guidId !== guidId);
            }
        });
    }
};

module.exports = FotoExtraGruppo;
