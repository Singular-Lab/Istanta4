/*
 * I20-1221: la sezione Correggo del Report Integrita', la parte pura.
 *
 * Il bottone "Importa correzioni" scarica, tramite Istanta, le correzioni ancora aperte in Correggo4
 * sul volantino della lavorazione (FicoProcess/correzioniCorreggo/{idLavorazione}). Ogni correzione
 * di Correggo4 (una nota, un timbro, una parte dell'Edit avanzato) si apre qui in voci, perche'
 * dentro la stessa correzione ci sono cose automatiche e cose da decidere: la parte "offerta" porta
 * i prezzi (automatici) e le azioni sul box (da decidere), la parte "descrizione" porta la
 * descrizione (da decidere), le foto e i loghi (automatici).
 *
 * Le automatiche arrivano su Approva, le altre senza scelta. Un timbro e' automatico se il plugin di
 * agenzia gli da' una regola (correzioniCorreggo.timbri): un'azione sul box o l'eliminazione della
 * referenza, che solo un superAdmin puo' approvare.
 *
 * "Conferma correzioni" applica le voci approvate, box per box, e chiude in Correggo4 una correzione
 * solo se tutte le sue voci sono state approvate e applicate: una voce rifiutata, senza scelta o non
 * riuscita la lascia aperta in Correggo4, com'era (decisione dell'operatore del 12/11).
 *
 * I20-1233: la descrizione arriva per conoscenza. Approvata non cambia ne' la referenza ne' il box, ma
 * conta come applicata e si chiude in Correggo4 come accettata, come una nota.
 *
 * I20-1233: gli scambi del menabo' avanzato (tipo "timone"): una referenza che il Marketing ha messo nella
 * casella di un altro box della stessa pagina va nel rettangolo che quella casella aveva nell'impaginato
 * esportato a Correggo (boundsDestinazione); una rimessa nella sua casella torna al suo posto. Arrivano
 * senza scelta; quelle che Correggo4 dice da sistemare a mano (griglia nuova, casella vuota) non si
 * approvano. Si applicano dopo le altre correzioni dei box; in Correggo4 non si chiudono uno per uno, si
 * registra il FATTO del menabo' avanzato quando ci sono tutti.
 *
 * I20-1233: un raggruppamento del menabo' avanzato e' lo scambio del capogruppo con unisci: i box delle
 * altre referenze del gruppo, che si uniscono al suo in un box solo (il Raggruppa di Istanta) nel
 * rettangolo della casella del gruppo.
 *
 * I20-1233: codici, codiciDelBox e codiciTimone servono a riconoscere una referenza staccata nel menabo'
 * da un gruppo formato in Correggo e gia' unito nel documento: lo sgruppa si fa a mano.
 *
 * Esecuzione dei test: node --test tests/plugin/reportCorreggo.test.js
 */

const TIPO = {
    nota: "nota",
    timbro: "timbro",
    prezzi: "prezzi",
    azione: "azione",
    descrizione: "descrizione",
    foto: "foto",
    loghi: "loghi",
    scambio: "scambio"
};

const SCELTA = {
    approva: "approva",
    rifiuta: "rifiuta",
    nessuna: ""
};

/// Stati delle voci foto di Correggo4: 1-3 foto (primaria, secondaria, non selezionata), 4-5 loghi.
const STATO_FOTO = { primaria: 1, secondaria: 2, nessuna: 3, aggiungiLogo: 4, togliLogo: 5 };

/// Le etichette dei campi dei prezzi, come le scrive il report correzioni di Correggo4.
const ETICHETTE_CAMPI = {
    prezzo_promo: "Prezzo promo",
    prezzo_promo_kgl: "Prezzo al Kg/Lt",
    prezzo_continuo: "Prezzo continuo",
    azione_pubblico: "Sconto",
    txt_sconto: "Sconto",
    tipo_offerta: "Tipo offerta",
    nome_evento: "Evento",
    note: "Note"
};

/// La configurazione del cliente, o null se il Report Correggo e' spento.
function configurazione(correzioniCorreggo) {
    if (correzioniCorreggo == null || correzioniCorreggo.abilitato !== true) {
        return null;
    }
    return {
        abilitato: true,
        timbri: Array.isArray(correzioniCorreggo.timbri) ? correzioniCorreggo.timbri : []
    };
}

/// Il nome di un campo come lo legge l'operatore.
function etichettaCampo(campo) {
    const chiave = String(campo || "").split("$").join(".");
    if (ETICHETTE_CAMPI[chiave] != null) {
        return ETICHETTE_CAMPI[chiave];
    }
    const testo = chiave.replace(/_/g, " ").trim();
    return testo.length > 0 ? testo.charAt(0).toUpperCase() + testo.slice(1) : testo;
}

/// La descrizione di Correggo4 in chiaro: senza i tag delle fasce, con gli a capo.
function descrizioneInChiaro(testo) {
    return String(testo || "")
        .replace(/FORCED_LINE_BREAK/g, "\n")
        .replace(/<\/?[A-Za-z0-9_.\-]+>/g, " ")
        .replace(/[ \t]+/g, " ")
        .split("\n").map(r => r.trim()).filter(r => r.length > 0).join(" / ");
}

function regolaDelTimbro(config, simbolo) {
    if (config == null) {
        return null;
    }
    return config.timbri.find(t => t != null && t.simbolo === simbolo) || null;
}

/// Le voci di una correzione di Correggo4. Ogni voce sa da quale correzione viene (idCorrezione),
/// su quale box sta, che cosa propone e se e' automatica.
function vociDellaCorrezione(correzione, config) {
    if (correzione == null || correzione.id == null) {
        return [];
    }
    const base = {
        idCorrezione: String(correzione.id),
        basecode: String(correzione.basecode || ""),
        labelBox: String(correzione.labelBox || ""),
        pagina: correzione.pagina != null ? Number(correzione.pagina) : null,
        autore: String(correzione.autore || ""),
        tipoAutore: String(correzione.tipoAutore || ""),
        propagata: correzione.propagata === true,
        //I20-1257: chi e' il box in Correggo4. Un derivato ha lo stesso basecode del suo originale.
        idRec: Number(correzione.idRec) > 0 ? Number(correzione.idRec) : 0,
        idLavRec: Number(correzione.idLavRec) > 0 ? Number(correzione.idLavRec) : 0
    };
    base.derivato = correzione.derivato === true || base.idLavRec > 0;
    const voce = (tipo, indice, altro) => Object.assign({}, base, { chiave: base.idCorrezione + "|" + tipo + "|" + indice, tipo: tipo }, altro);
    const voci = [];

    if (correzione.tipo === TIPO.nota) {
        voci.push(voce(TIPO.nota, 0, {
            automatica: false,
            testo: "Nota: " + String(correzione.testo || ""),
            nota: String(correzione.testo || "")
        }));
    }
    else if (correzione.tipo === TIPO.timbro) {
        const regola = regolaDelTimbro(config, correzione.simbolo);
        const elimina = regola != null && regola.eliminaRef === true;
        const idAzione = regola != null && !elimina && Number(regola.idAzione) > 0 ? Number(regola.idAzione) : null;
        voci.push(voce(TIPO.timbro, 0, {
            automatica: elimina || idAzione != null,
            testo: "Timbro: " + String(correzione.nomeTimbro || correzione.simbolo || ""),
            simbolo: String(correzione.simbolo || ""),
            eliminaRef: elimina,
            idAzione: idAzione,
            valori: idAzione != null && regola.valori != null ? Object.assign({}, regola.valori) : {}
        }));
    }
    else if (correzione.parte === "offerta") {
        const campi = correzione.campi || {};
        const nomi = Object.keys(campi);
        if (nomi.length > 0) {
            voci.push(voce(TIPO.prezzi, 0, {
                automatica: true,
                testo: "Prezzo cambiato in: " + nomi.map(n => etichettaCampo(n) + ": " + campi[n]).join(", "),
                campi: Object.assign({}, campi)
            }));
        }
        (correzione.azioni || []).forEach((a, i) => {
            const valori = a != null && a.campi != null ? a.campi : {};
            const descritti = Object.keys(valori).map(n => valori[n]).filter(v => v != null && String(v) !== "");
            voci.push(voce(TIPO.azione, i, {
                automatica: false,
                testo: "Azione: " + String(a != null ? a.titolo || "" : "") + (descritti.length > 0 ? " (" + descritti.join(", ") + ")" : ""),
                titoloAzione: String(a != null ? a.titolo || "" : ""),
                valori: Object.assign({}, valori)
            }));
        });
    }
    else if (correzione.tipo === "timone") {
        const aMano = correzione.daSistemareAMano != null && String(correzione.daSistemareAMano) !== "" ? String(correzione.daSistemareAMano) : "";
        const codice = String(correzione.codice || correzione.basecode || "");
        const destinazione = String(correzione.basecodeDestinazione || "");
        const bounds = Array.isArray(correzione.boundsDestinazione) && correzione.boundsDestinazione.length === 4
            ? correzione.boundsDestinazione.map(Number) : null;
        const colonne = Math.max(1, Number(correzione.colonne) || 1);
        const righe = Math.max(1, Number(correzione.righe) || 1);
        const stessoBox = destinazione === String(correzione.basecode || "");
        const unisci = Array.isArray(correzione.unisci)
            ? correzione.unisci.map(b => ({ basecode: String(b.basecode || ""), labelBox: String(b.labelBox || ""), pagina: b.pagina,
                codici: Array.isArray(b.codici) ? b.codici.map(String) : [] }))
            : null;
        let dove;
        if (unisci != null) {
            const insieme = [String(correzione.basecode || codice)].concat(unisci.map(b => b.basecode)).join(" e ");
            dove = aMano !== ""
                ? "gruppo di " + insieme + ": " + aMano
                : "unisce " + insieme + " in un box" + (correzione.casella != null ? ", nella casella " + correzione.casella : "");
        }
        else if (aMano !== "") {
            dove = " spostata, " + aMano;
        }
        else if (colonne > 1 || righe > 1) {
            dove = " allargata su " + colonne + "×" + righe + " caselle"
                + (destinazione === "" ? (correzione.casella != null ? " dalla casella " + correzione.casella : "") : stessoBox ? "" : ", al posto di " + destinazione);
        }
        else if (destinazione === "") {
            //I20-1233: pagina ridisegnata dal Marketing: va nella casella, non al posto di un box.
            dove = " va nella casella " + (correzione.casella != null ? correzione.casella : "");
        }
        else {
            dove = stessoBox ? " torna al suo posto" : " va al posto di " + destinazione;
        }
        voci.push(voce(TIPO.scambio, 0, {
            automatica: false,
            testo: "Menabò avanzato: " + (unisci != null ? "" : codice) + dove,
            codiceReferenza: codice,
            basecodeDestinazione: destinazione,
            labelBoxDestinazione: String(correzione.labelBoxDestinazione || ""),
            boundsDestinazione: bounds,
            colonne: colonne,
            righe: righe,
            daSistemareAMano: aMano,
            unisci: unisci,
            codici: Array.isArray(correzione.codici) ? correzione.codici.map(String) : [],
            codiciDelBox: Array.isArray(correzione.codiciDelBox) ? correzione.codiciDelBox.map(String) : [],
            codiciTimone: Array.isArray(correzione.codiciTimone) ? correzione.codiciTimone.map(String) : []
        }));
    }
    else if (correzione.parte === "descrizione") {
        if (correzione.descrizione != null && String(correzione.descrizione) !== "") {
            voci.push(voce(TIPO.descrizione, 0, {
                automatica: false,
                testo: "Descrizione modificata in: " + descrizioneInChiaro(correzione.descrizione),
                descrizione: String(correzione.descrizione),
                //I20-1233: per conoscenza, approvata non cambia l'impaginato.
                soloInformativa: true
            }));
        }
        const foto = (correzione.foto || []).filter(f => f != null);
        if (foto.length > 0) {
            voci.push(voce(TIPO.foto, 0, {
                automatica: true,
                testo: "Foto cambiata in: " + foto.map(f => f.codice + " " + nomeStatoFoto(f.stato)).join(", "),
                foto: foto.map(f => ({ codice: String(f.codice || ""), guidid: String(f.guidId || f.guidid || ""), nomeFile: String(f.nomeFile || ""), stato: Number(f.stato) }))
            }));
        }
        const loghi = (correzione.loghi || []).filter(f => f != null);
        if (loghi.length > 0) {
            const aggiunti = loghi.filter(l => Number(l.stato) === STATO_FOTO.aggiungiLogo);
            const tolti = loghi.filter(l => Number(l.stato) === STATO_FOTO.togliLogo);
            const parti = [];
            if (aggiunti.length > 0) parti.push("Logo inserito: " + aggiunti.map(l => l.codice).join(", "));
            if (tolti.length > 0) parti.push("Logo rimosso: " + tolti.map(l => l.codice).join(", "));
            voci.push(voce(TIPO.loghi, 0, {
                automatica: true,
                testo: parti.join("; "),
                aggiunti: aggiunti.map(l => ({ sigla: String(l.codice || ""), guidid: String(l.guidId || l.guidid || ""), nomeFile: String(l.nomeFile || ""), md5: String(l.md5 || "") })),
                tolti: tolti.map(l => ({ sigla: String(l.codice || "") }))
            }));
        }
    }
    //I20-1257: su un box derivato si mettono solo note. Una correzione arrivata comunque (per esempio
    //registrata prima di questa regola) non si approva e non si applica: resta aperta in Correggo4.
    if (base.derivato) {
        voci.filter(v => v.tipo !== TIPO.nota).forEach(v => {
            v.suDerivato = true;
            v.automatica = false;
            v.testo = MOTIVO_DERIVATO + " " + v.testo;
        });
    }
    return voci;
}

/// I20-1257: perche' una correzione su un box derivato non si applica.
const MOTIVO_DERIVATO = "Box derivato: le correzioni si fanno sul box originale, questa non si applica.";

function nomeStatoFoto(stato) {
    switch (Number(stato)) {
        case STATO_FOTO.primaria: return "primaria";
        case STATO_FOTO.secondaria: return "secondaria";
        default: return "non selezionata";
    }
}

/// Se l'operatore puo' approvare la voce: l'eliminazione della referenza solo un superAdmin; uno scambio
/// da sistemare a mano nessuno.
function approvabile(voce, superAdmin) {
    //I20-1257: una correzione su un box derivato non si approva (si correggono gli originali)
    if (voce != null && voce.suDerivato === true) {
        return false;
    }
    if (voce != null && voce.tipo === TIPO.scambio && (voce.daSistemareAMano !== "" || voce.boundsDestinazione == null)) {
        return false;
    }
    return !(voce != null && voce.eliminaRef === true && superAdmin !== true);
}

/// La scelta con cui la voce arriva: le automatiche su Approva, salvo l'eliminazione per chi non
/// e' superAdmin; le altre senza scelta.
function sceltaIniziale(voce, superAdmin) {
    return voce.automatica === true && approvabile(voce, superAdmin) ? SCELTA.approva : SCELTA.nessuna;
}

/// Le voci di tutte le correzioni importate, con la scelta iniziale, nell'ordine di Correggo4
/// (pagina, box). Le correzioni senza box (le note sulla pagina) restano, da decidere a mano.
function importa(correzioni, correzioniCorreggo, superAdmin) {
    const config = configurazione(correzioniCorreggo);
    const voci = [];
    (correzioni || []).forEach(c => vociDellaCorrezione(c, config).forEach(v => {
        v.scelta = sceltaIniziale(v, superAdmin);
        v.approvabile = approvabile(v, superAdmin);
        voci.push(v);
    }));
    return voci;
}

/// I20-1233: uno scambio il cui box nel documento sta gia' dove lo vuole il menabo' avanzato (un giro
/// applicato prima, quando il FATTO non si e' potuto registrare). Non si decide: arriva approvato e alla
/// conferma conta come applicato, senza rifare il box.
function segnaGiaAlSuoPosto(voce) {
    if (voce == null || voce.tipo !== TIPO.scambio || voce.approvabile === false) {
        return false;
    }
    voce.giaAlSuoPosto = true;
    voce.automatica = true;
    voce.scelta = SCELTA.approva;
    voce.testo = Array.isArray(voce.unisci)
        ? "Menabò avanzato: il gruppo di " + [voce.basecode].concat(voce.unisci.map(b => b.basecode)).join(" e ") + " è già unito al suo posto"
        : "Menabò avanzato: " + voce.codiceReferenza + " è già al suo posto";
    return true;
}

/// I20-1233: uno scambio che all'importazione si scopre da sistemare a mano (una referenza staccata nel
/// menabo' da un gruppo formato in Correggo: lo sgruppa si fa a mano, decisione dell'operatore del 13/11).
/// Non si approva piu' e dice perche'.
function segnaDaSistemareAMano(voce, motivo) {
    if (voce == null || voce.tipo !== TIPO.scambio) {
        return false;
    }
    voce.daSistemareAMano = String(motivo);
    voce.approvabile = false;
    voce.automatica = false;
    voce.scelta = SCELTA.nessuna;
    voce.testo = "Menabò avanzato: " + voce.codiceReferenza + ", " + voce.daSistemareAMano;
    return true;
}

/// Cambia la scelta di una voce; una voce che l'operatore non puo' approvare resta com'e'.
function scegli(voce, scelta, superAdmin) {
    if (voce == null) {
        return false;
    }
    if (scelta === SCELTA.approva && !approvabile(voce, superAdmin)) {
        return false;
    }
    //I20-1233: uno scambio gia' al suo posto non si decide.
    if (voce.giaAlSuoPosto === true) {
        return false;
    }
    voce.scelta = scelta === SCELTA.approva || scelta === SCELTA.rifiuta ? scelta : SCELTA.nessuna;
    return true;
}

function chiaveBox(voce) {
    //I20-1257: l'idLavRec separa un derivato dal suo originale, che ha lo stesso basecode
    return voce.basecode + "|" + (voce.pagina != null ? voce.pagina : "") + "|" + (Number(voce.idLavRec) > 0 ? Number(voce.idLavRec) : 0);
}

/// Le referenze che la conferma eliminera': quelle con un timbro Elimina approvato, una per box.
function referenzeDaEliminare(voci) {
    const box = new Map();
    (voci || []).filter(v => v.scelta === SCELTA.approva && v.eliminaRef === true && v.basecode !== "")
        .forEach(v => box.set(chiaveBox(v), v.basecode));
    return Array.from(box.values());
}

/// La domanda prima della conferma, se ci sono referenze da eliminare; null altrimenti.
function domandaEliminazione(voci) {
    const n = referenzeDaEliminare(voci).length;
    if (n === 0) {
        return null;
    }
    return n === 1 ? "Verra' eliminata 1 ref. Confermi?" : "Verranno eliminate " + n + " ref. Confermi?";
}

/// Il lavoro della conferma, box per box. Per ogni box: se va eliminato (e allora le altre sue voci
/// non si applicano), le azioni sul box da mandare insieme (prezzi, azioni, timbri con un'azione), le
/// foto e i loghi. Le voci approvate senza box, o che non cambiano l'impaginato (le note, le
/// descrizioni, i timbri senza regola), si contano come applicate: le ha gestite l'operatore.
function pianoDellaConferma(voci) {
    const perBox = new Map();
    const senzaLavoro = [];
    const scambi = [];
    (voci || []).filter(v => v.scelta === SCELTA.approva).forEach(v => {
        //I20-1233: gli scambi si fanno a parte, dopo i box.
        if (v.tipo === TIPO.scambio) {
            scambi.push(v);
            return;
        }
        //I20-1233: la descrizione approvata non cambia ne' la referenza ne' il box.
        const cambiaIlBox = v.tipo !== TIPO.nota && v.tipo !== TIPO.descrizione && !(v.tipo === TIPO.timbro && !v.eliminaRef && v.idAzione == null);
        if (!cambiaIlBox || v.basecode === "") {
            senzaLavoro.push(v);
            return;
        }
        const k = chiaveBox(v);
        if (!perBox.has(k)) {
            perBox.set(k, {
                basecode: v.basecode, pagina: v.pagina, labelBox: v.labelBox,
                idLavRec: Number(v.idLavRec) > 0 ? Number(v.idLavRec) : 0,
                elimina: false, azioni: [], prezzi: {}, foto: [], loghiAggiunti: [], loghiTolti: [], voci: []
            });
        }
        const p = perBox.get(k);
        p.voci.push(v);
        if (v.eliminaRef === true) {
            p.elimina = true;
        }
        else if (v.tipo === TIPO.timbro) {
            p.azioni.push({ idAzione: v.idAzione, valori: v.valori || {}, chiave: v.chiave });
        }
        else if (v.tipo === TIPO.azione) {
            p.azioni.push({ titolo: v.titoloAzione, valori: v.valori || {}, chiave: v.chiave });
        }
        else if (v.tipo === TIPO.prezzi) {
            Object.assign(p.prezzi, v.campi || {});
        }
        else if (v.tipo === TIPO.foto) {
            p.foto = p.foto.concat(v.foto || []);
        }
        else if (v.tipo === TIPO.loghi) {
            p.loghiAggiunti = p.loghiAggiunti.concat(v.aggiunti || []);
            p.loghiTolti = p.loghiTolti.concat(v.tolti || []);
        }
    });
    return { box: Array.from(perBox.values()), senzaLavoro: senzaLavoro, scambi: scambiPerPagina(scambi) };
}

/// I20-1233: gli scambi approvati per pagina, nell'ordine di Correggo4.
function scambiPerPagina(scambi) {
    const perPagina = new Map();
    (scambi || []).forEach(v => {
        const k = v.pagina != null ? v.pagina : "";
        if (!perPagina.has(k)) {
            perPagina.set(k, { pagina: v.pagina, voci: [] });
        }
        perPagina.get(k).voci.push(v);
    });
    return Array.from(perPagina.values());
}

/// Le istruzioni di setCambioStrutturale per i prezzi: un'azione con valori fissi, i nomi dei campi
/// con il "$" al posto del punto come nelle altre richieste del Plugin.
function azioneDeiPrezzi(prezzi) {
    const nomi = Object.keys(prezzi || {});
    if (nomi.length === 0) {
        return null;
    }
    return { titolo: "Prezzi da Correggo", istruzioni: nomi.map(n => ({ field: String(n).split(".").join("$"), valore: String(prezzi[n]) })) };
}

/// I valori che l'operatore scriverebbe per un'azione, per nome di istruzione: Correggo4 li porta con
/// il punto, le istruzioni del plugin di agenzia possono averli con il "$".
function valoriPerIstruzioni(istruzioni, valori) {
    const risultato = {};
    (istruzioni || []).forEach(i => {
        if (i == null || i.field == null) {
            return;
        }
        const conPunto = String(i.field).split("$").join(".");
        const v = valori != null ? (valori[i.field] != null ? valori[i.field] : valori[conPunto]) : null;
        if (v != null) {
            risultato[i.field] = String(v);
        }
    });
    return risultato;
}

/// La struttura del plugin di agenzia per un'azione di Correggo4: per id (le regole dei timbri) o per
/// titolo (l'Edit avanzato, che porta l'indice dell'azione nel box all'esportazione, non il suo id).
function strutturaDellAzione(strutture, azione) {
    const elenco = Array.isArray(strutture) ? strutture : [];
    if (azione != null && azione.idAzione != null) {
        return elenco.find(s => s != null && Number(s.id) === Number(azione.idAzione)) || null;
    }
    const titolo = String(azione != null ? azione.titolo || "" : "").trim().toLowerCase();
    if (titolo === "") {
        return null;
    }
    return elenco.find(s => s != null && String(s.titolo || "").trim().toLowerCase() === titolo) || null;
}

/// La lista ps di Menabo/modificaPrimarieSecondarie: per ogni referenza del gruppo lo stato che
/// propone Correggo4, o quello che ha. Null se Correggo4 non cambia nessuno stato. Le referenze che
/// Correggo4 porta e che il gruppo non ha si ignorano.
function primarieSecondarie(records, foto) {
    const proposte = new Map();
    (foto || []).forEach(f => {
        if (f != null && f.codice !== "" && [STATO_FOTO.primaria, STATO_FOTO.secondaria, STATO_FOTO.nessuna].includes(Number(f.stato))) {
            proposte.set(String(f.codice), Number(f.stato));
        }
    });
    let cambia = false;
    const ps = (records || []).filter(r => r != null && r.recordInTracciato != null).map(r => {
        const codice = String(r.recordInTracciato["Referenza.Codice"]);
        const attuale = Number(r.recordInTracciato.StatoSelezione);
        const stato = proposte.has(codice) ? proposte.get(codice) : attuale;
        if (stato !== attuale) {
            cambia = true;
        }
        return { codRef: codice, stato: stato };
    });
    return cambia ? ps : null;
}

/// Le foto di Correggo4 con un file diverso da quello della referenza: vanno cambiate in archivio.
function fotoDaCambiare(records, foto) {
    return (foto || []).filter(f => {
        if (f == null || f.guidid === "") {
            return false;
        }
        const r = (records || []).find(x => x != null && x.recordInTracciato != null && String(x.recordInTracciato["Referenza.Codice"]) === String(f.codice));
        return r != null && String(r.recordInTracciato["Foto.guidid"] || "") !== f.guidid;
    });
}

/// Gli id delle correzioni di Correggo4 da chiudere: tutte le loro voci approvate e applicate.
/// esiti: chiave della voce -> true se applicata.
function correzioniDaChiudere(voci, esiti) {
    const perCorrezione = new Map();
    (voci || []).forEach(v => {
        const ok = v.scelta === SCELTA.approva && esiti != null && esiti[v.chiave] === true;
        perCorrezione.set(v.idCorrezione, (perCorrezione.has(v.idCorrezione) ? perCorrezione.get(v.idCorrezione) : true) && ok);
    });
    return Array.from(perCorrezione.entries()).filter(e => e[1]).map(e => e[0]);
}

/// I20-1233: le sezioni del Report Correggo, come le divide Correggo4: le note, i timbri, l'Edit avanzato e
/// il menabo' avanzato. La sezione si legge dal tipo della correzione nel suo id (nota:, timbro:, edit:,
/// timone:), cosi' tutte le voci di una correzione stanno insieme.
const SEZIONI = [
    { chiave: "nota", titolo: "Note" },
    { chiave: "timbro", titolo: "Timbri" },
    { chiave: "edit", titolo: "Edit avanzato" },
    { chiave: "timone", titolo: "Menabò avanzato" }
];

function sezioneDi(voce) {
    const tipo = String(voce != null && voce.idCorrezione != null ? voce.idCorrezione : "").split(":")[0];
    return SEZIONI.some(s => s.chiave === tipo) ? tipo : "edit";
}

/// Le voci divise per sezione, nell'ordine di Correggo4, ognuna con le sue voci nell'ordine in cui
/// arrivano (pagina e box). Le rifiutate stanno tutte nella sezione Rifiutati, in fondo. Le sezioni
/// senza voci non ci sono.
function perSezione(voci) {
    const rifiutata = (v) => v != null && v.scelta === SCELTA.rifiuta;
    const sezioni = SEZIONI.map(s => ({ chiave: s.chiave, titolo: s.titolo, voci: (voci || []).filter(v => !rifiutata(v) && sezioneDi(v) === s.chiave) }));
    sezioni.push({ chiave: "rifiutate", titolo: "Rifiutati", voci: (voci || []).filter(rifiutata) });
    return sezioni.filter(s => s.voci.length > 0);
}

/// I20-1233: le rifiutate non vanno a Correggo4 e a ogni importazione tornerebbero da decidere. Il Plugin
/// le ricorda per lavorazione con la loro firma: la voce e il testo con cui e' arrivata. Se in Correggo4
/// la correzione cambia, cambia il testo e torna da decidere.
function firmaRifiuto(voce) {
    return String(voce.chiave) + "\n" + String(voce.testoImportato != null ? voce.testoImportato : voce.testo);
}

/// All'importazione: le voci rifiutate in un giro precedente tornano rifiutate.
function applicaRifiuti(voci, rifiutate) {
    const firme = new Set(rifiutate || []);
    (voci || []).forEach(v => {
        v.testoImportato = v.testo;
        if (firme.has(firmaRifiuto(v)) && v.giaAlSuoPosto !== true) {
            v.scelta = SCELTA.rifiuta;
        }
    });
    return voci;
}

/// L'elenco delle rifiutate dopo una scelta sulla voce: c'e' se la voce e' rifiutata, altrimenti no.
function aggiornaRifiuti(rifiutate, voce) {
    const firma = firmaRifiuto(voce);
    const resto = (rifiutate || []).filter(f => f !== firma);
    if (voce.scelta === SCELTA.rifiuta) {
        resto.push(firma);
    }
    return resto;
}

/// Il riepilogo della conferma per l'operatore.
function riepilogo(voci, esiti, chiuse) {
    const approvate = (voci || []).filter(v => v.scelta === SCELTA.approva);
    const applicate = approvate.filter(v => esiti != null && esiti[v.chiave] === true).length;
    const nonRiuscite = approvate.length - applicate;
    const rifiutate = (voci || []).filter(v => v.scelta === SCELTA.rifiuta).length;
    const senzaScelta = (voci || []).filter(v => v.scelta === SCELTA.nessuna).length;
    const parti = [applicate + " applicate"];
    if (nonRiuscite > 0) parti.push(nonRiuscite + " non riuscite");
    if (rifiutate > 0) parti.push(rifiutate + " rifiutate");
    if (senzaScelta > 0) parti.push(senzaScelta + " senza scelta");
    parti.push((chiuse || []).length + " chiuse in Correggo4");
    return {
        testo: "Correzioni di Correggo: " + parti.join(", ") + ".",
        tipo: nonRiuscite > 0 ? "warning" : "success"
    };
}

module.exports = {
    TIPO,
    SCELTA,
    STATO_FOTO,
    configurazione,
    etichettaCampo,
    descrizioneInChiaro,
    vociDellaCorrezione,
    approvabile,
    MOTIVO_DERIVATO,
    sceltaIniziale,
    importa,
    scegli,
    referenzeDaEliminare,
    domandaEliminazione,
    pianoDellaConferma,
    scambiPerPagina,
    segnaGiaAlSuoPosto,
    segnaDaSistemareAMano,
    SEZIONI,
    perSezione,
    firmaRifiuto,
    applicaRifiuti,
    aggiornaRifiuti,
    azioneDeiPrezzi,
    valoriPerIstruzioni,
    strutturaDellAzione,
    primarieSecondarie,
    fotoDaCambiare,
    correzioniDaChiudere,
    riepilogo
};
