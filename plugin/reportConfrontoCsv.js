/*
 * I20-981 (Lotto 2): come e' fatto il csv del Report Integrita'.
 *
 * Stava tutto dentro confronti.js, che fa require('indesign') e sotto Node non si carica:
 * il nome del file, l'ordine delle righe, la virgolettatura e la descrizione composta non
 * erano verificabili. Qui restano le regole; in confronti.js resta cio' che tocca il disco.
 *
 * Esecuzione dei test: node --test tests/plugin/reportConfrontoCsv.test.js
 */

//Excel apre bene un csv con il punto e virgola, il BOM e le righe chiuse da CRLF.
const SEPARATORE_CAMPI = ";";
const FINE_RIGA = "\r\n";
const BOM = "﻿";

//I20-981: i campi della descrizione si separano con la barra, non piu' col trattino, che si
//confondeva con i trattini dentro i nomi dei prodotti.
const SEPARATORE_DESCRIZIONE = " | ";

const PREFISSO_NOME = "ConfR_";
const ESTENSIONE = ".csv";

const INTESTAZIONI = [
    "Stato",
    "Pagina",
    "Codice gruppo",
    "Etichetta tracciato",
    "Versione tracciato",
    "Reparto",
    "Descrizione",
    "Campo",
    "Dettaglio"
];

const CAMPI_DESCRIZIONE = [
    "Descrizioni.Descrizione1",
    "Descrizioni.Descrizione2",
    "Descrizioni.Descrizione3",
    "Descrizioni.Descrizione4"
];

/// Il numero progressivo del prossimo csv in una cartella: si guarda il massimo gia' presente
/// e si aggiunge uno. Non si contano i file, altrimenti cancellarne uno rimetterebbe in giro
/// un numero gia' usato.
function prossimoProgressivo(nomiFile) {
    let massimo = 0;

    (nomiFile || []).forEach(nome => {
        const trovato = String(nome || "").match(/^ConfR_(\d+)_/i);
        if (trovato == null) {
            return;
        }

        const numero = parseInt(trovato[1], 10);
        if (!isNaN(numero) && numero > massimo) {
            massimo = numero;
        }
    });

    return massimo + 1;
}

/// I caratteri che un nome di file non puo' portare. Il titolo del kit arriva da Fidelity e
/// contiene spazi, trattini e barre: gli spazi e i trattini restano, il resto diventa "_".
function nomeFileSicuro(testo) {
    return String(testo == null ? "" : testo)
        .replace(/[\\/:*?"<>|]/g, "_")
        // eslint-disable-next-line no-control-regex
        .replace(/[\x00-\x1f]/g, "_")
        .replace(/^[.\s]+|[.\s]+$/g, "")
        .trim();
}

function duecifre(valore) {
    return valore < 10 ? "0" + valore : String(valore);
}

/// ConfR_<progressivo nella cartella>_<titolo del kit>_<data e ora>.csv
/// La data e' quella del report, non quella del salvataggio: se il file viene rifatto in
/// un'altra cartella resta riconoscibile come il csv di quel confronto.
function nomeFileReport(progressivo, titoloKit, data) {
    const quando = data instanceof Date && !isNaN(data.getTime()) ? data : new Date();

    const titolo = nomeFileSicuro(titoloKit) || "kit";

    const dataTesto = duecifre(quando.getDate())
        + "-" + duecifre(quando.getMonth() + 1)
        + "-" + quando.getFullYear()
        + "_" + duecifre(quando.getHours())
        + duecifre(quando.getMinutes());

    return PREFISSO_NOME + progressivo + "_" + titolo + "_" + dataTesto + ESTENSIONE;
}

/// La descrizione composta dai quattro campi, saltando quelli vuoti.
function descrizioneComposta(item) {
    const src = (item && item.descrizione_gruppo) || item || {};
    const parti = [];

    CAMPI_DESCRIZIONE.forEach(chiave => {
        const valore = src[chiave];
        if (valore != null && String(valore).trim() !== "") {
            parti.push(String(valore).trim());
        }
    });

    return parti.join(SEPARATORE_DESCRIZIONE);
}

/// Il reparto come lo vuole leggere chi apre il csv: il reparto e, fra parentesi, la sigla.
/// Se il reparto manca resta la sigla da sola; se mancano entrambi la cella e' vuota.
function repartoDelRecord(item) {
    const record = item || {};
    const reparto = record["reparto"] != null ? String(record["reparto"]).trim() : "";
    const sigla = record["sigla_reparto"] != null ? String(record["sigla_reparto"]).trim() : "";

    if (reparto === "") {
        return sigla;
    }

    if (sigla === "") {
        return reparto;
    }

    return reparto + " (" + sigla + ")";
}

/// I dati che ogni riga del csv prende dal record del tracciato.
function datiRecordPerCsv(item) {
    const record = item || {};

    return {
        etichetta: record["Tracciato.Label"] != null ? String(record["Tracciato.Label"]) : "",
        versione: record["Tracciato.Versione"] != null ? String(record["Tracciato.Versione"]) : "",
        reparto: repartoDelRecord(record),
        descrizione: descrizioneComposta(record)
    };
}

/// Le righe seguono l'impaginato: pagina per pagina, in ordine numerico. Le pagine con nome
/// non numerico vengono dopo, e in fondo cio' che una pagina non ce l'ha: i "Nuovi", che nel
/// documento non ci sono ancora.
function ordinaPerPagina(voci) {
    const conIndice = (voci || []).map((voce, indice) => ({ voce: voce, indice: indice }));

    conIndice.sort((a, b) => {
        const pesoA = pesoPagina(a.voce.pagina);
        const pesoB = pesoPagina(b.voce.pagina);

        if (pesoA.gruppo !== pesoB.gruppo) {
            return pesoA.gruppo - pesoB.gruppo;
        }

        if (pesoA.gruppo === 0 && pesoA.numero !== pesoB.numero) {
            return pesoA.numero - pesoB.numero;
        }

        if (pesoA.gruppo === 1 && pesoA.testo !== pesoB.testo) {
            return pesoA.testo < pesoB.testo ? -1 : 1;
        }

        //A parita' di pagina resta l'ordine con cui il report le ha raccolte, che segue la
        //posizione nella pagina.
        return a.indice - b.indice;
    });

    return conIndice.map(elemento => elemento.voce);
}

function pesoPagina(pagina) {
    const testo = pagina == null ? "" : String(pagina).trim();

    if (testo === "") {
        return { gruppo: 2, numero: 0, testo: "" };
    }

    const numero = parseInt(testo, 10);
    if (!isNaN(numero) && String(numero) === testo) {
        return { gruppo: 0, numero: numero, testo: testo };
    }

    return { gruppo: 1, numero: 0, testo: testo };
}

function campoCsv(valore) {
    const testo = valore == null ? "" : String(valore);

    if (testo.indexOf(SEPARATORE_CAMPI) >= 0
        || testo.indexOf("\"") >= 0
        || testo.indexOf("\n") >= 0
        || testo.indexOf("\r") >= 0) {
        return "\"" + testo.replace(/"/g, "\"\"") + "\"";
    }

    return testo;
}

/// Il csv completo: intestazioni, righe ordinate per pagina, BOM davanti.
/// Una voce ha: stato, pagina, codiceGruppo, etichetta, versione, reparto, descrizione,
/// campo, dettaglio.
function componiCsv(voci) {
    const righe = [INTESTAZIONI.slice()];

    ordinaPerPagina(voci).forEach(voce => {
        righe.push([
            voce.stato,
            voce.pagina,
            voce.codiceGruppo,
            voce.etichetta,
            voce.versione,
            voce.reparto,
            voce.descrizione,
            voce.campo,
            voce.dettaglio
        ]);
    });

    return BOM + righe
        .map(riga => riga.map(campoCsv).join(SEPARATORE_CAMPI))
        .join(FINE_RIGA) + FINE_RIGA;
}

/// I byte utf8 di un testo, calcolati qui e non lasciati a chi scrive il file.
/// I20-981: il csv usciva con le accentate rotte, e chi lo apriva in Excel al posto di "e'
/// accentata" trovava segni che non c'entravano nulla. Scrivendo byte, l'unica cosa che conta
/// e' il BOM davanti, che dice a Excel come leggerli.
function bytesUtf8(testo) {
    const stringa = String(testo == null ? "" : testo);

    if (typeof TextEncoder !== "undefined") {
        return new TextEncoder().encode(stringa);
    }

    //Ripiego senza TextEncoder: la codifica utf8 a mano, coppie surrogate comprese.
    const bytes = [];

    for (let i = 0; i < stringa.length; i++) {
        let codice = stringa.charCodeAt(i);

        if (codice >= 0xd800 && codice <= 0xdbff && i + 1 < stringa.length) {
            const basso = stringa.charCodeAt(i + 1);
            if (basso >= 0xdc00 && basso <= 0xdfff) {
                codice = ((codice - 0xd800) << 10) + (basso - 0xdc00) + 0x10000;
                i++;
            }
        }

        if (codice < 0x80) {
            bytes.push(codice);
        }
        else if (codice < 0x800) {
            bytes.push(0xc0 | (codice >> 6), 0x80 | (codice & 0x3f));
        }
        else if (codice < 0x10000) {
            bytes.push(0xe0 | (codice >> 12), 0x80 | ((codice >> 6) & 0x3f), 0x80 | (codice & 0x3f));
        }
        else {
            bytes.push(
                0xf0 | (codice >> 18),
                0x80 | ((codice >> 12) & 0x3f),
                0x80 | ((codice >> 6) & 0x3f),
                0x80 | (codice & 0x3f));
        }
    }

    return new Uint8Array(bytes);
}

module.exports = {
    SEPARATORE_CAMPI,
    SEPARATORE_DESCRIZIONE,
    FINE_RIGA,
    BOM,
    INTESTAZIONI,
    PREFISSO_NOME,
    prossimoProgressivo,
    nomeFileSicuro,
    nomeFileReport,
    descrizioneComposta,
    repartoDelRecord,
    datiRecordPerCsv,
    ordinaPerPagina,
    campoCsv,
    componiCsv,
    bytesUtf8
};
