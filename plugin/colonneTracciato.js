/*
 * TASK-ff931e6d: le colonne della lista del tracciato nella Home del Plugin, nella parte che si decide
 * senza InDesign. La disegna indexNew (renderIntestazioneTracciato, creaElementoTracciato), che chiede qui:
 *
 * - quali colonne si vedono: l'operatore le nasconde e le rimostra dal menu del click destro
 *   sull'intestazione, tranne Pag e Codice;
 * - in che ordine vanno le righe: una colonna alla volta, crescente, decrescente, poi l'ordine di prima;
 *   nascondere la colonna ordinata toglie l'ordinamento;
 * - quanto e' larga ogni colonna: almeno la sua larghezza configurata (colonneTracciato.percColonna) e
 *   mai meno della sua intestazione, nome e frecce dell'ordinamento; lo spazio che avanza nel pannello va
 *   prima alle colonne il cui testo non si vede intero (o, se va a capo, sta in piu' di 4 righe), tranne
 *   Pag e Codice, poi si divide in parti uguali fra tutte;
 * - fino a quante righe va a capo una colonna: la descrizione 5, le altre quante ne dichiara il cliente
 *   (righeMassime; Edro21 la note category, 5).
 *
 * Colonne nascoste e ordinamento valgono finche' il pannello resta aperto: stanno in memoria, qui.
 *
 * La larghezza di un testo si stima dal numero dei caratteri: in UXP le misure di un testo appena scritto
 * non sono affidabili, e misurare migliaia di celle a ogni ridisegno sarebbe lento. Se la stima risulta
 * stretta o larga si corregge LARGHEZZA_CARATTERE.
 *
 * Esecuzione dei test: node --test tests/plugin/colonneTracciato.test.js
 */

const ColonneTracciato = {
    /// Le chiavi delle colonne che non si nascondono: la pagina (calcolata dal Plugin) e il codice.
    SEMPRE_VISIBILI: ["__pagina__", "codice"],

    /// Fino a quante righe va a capo la descrizione, per tutti i clienti.
    RIGHE_DESCRIZIONE: 5,

    /// Il fabbisogno di una colonna che va a capo: il testo piu' lungo in questo numero di righe.
    RIGHE_DEL_FABBISOGNO: 4,

    /// La larghezza media di un carattere delle celle, in px (stimata dallo screenshot del tracciato).
    LARGHEZZA_CARATTERE: 6,

    /// Il padding orizzontale di una cella (.tracciato-cell: 10px per lato).
    PADDING_CELLA: 20,

    /// L'intestazione: un carattere del nome in grassetto, piu' largo del testo delle celle, e lo spazio
    /// delle frecce dell'ordinamento (4 px di margine e la freccia).
    LARGHEZZA_CARATTERE_INTESTAZIONE: 7,
    SPAZIO_ORDINAMENTO: 16,

    /// L'altezza di una riga di testo di una cella che va a capo, e il padding verticale (8px per lato).
    ALTEZZA_RIGA: 15,
    PADDING_VERTICALE: 16,

    /// Lo stato del pannello: le chiavi delle colonne nascoste e l'ordinamento ({ chiave, verso } o null).
    stato: {
        nascoste: [],
        ordinamento: null
    },

    /// Riporta tutto come all'apertura del pannello (per i test).
    azzera() {
        this.stato = { nascoste: [], ordinamento: null };
    },

    chiave(colonna) {
        return String(colonna != null && colonna.chiaveDato != null ? colonna.chiaveDato : "").toLowerCase();
    },

    /// Se l'operatore puo' nascondere la colonna: tutte tranne Pag e Codice.
    nascondibile(colonna) {
        return !this.SEMPRE_VISIBILI.includes(this.chiave(colonna));
    },

    /// Se la colonna si vede adesso.
    visibile(colonna) {
        return !this.nascondibile(colonna) || !this.stato.nascoste.includes(this.chiave(colonna));
    },

    /// Le colonne da disegnare, nell'ordine dato.
    colonneVisibili(colonne) {
        return (Array.isArray(colonne) ? colonne : []).filter(c => this.visibile(c));
    },

    /// Nasconde o rimostra una colonna; Pag e Codice restano sempre. Nascondere la colonna ordinata
    /// toglie l'ordinamento. Restituisce true se e' cambiato qualcosa.
    cambiaVisibilita(colonna, visibile) {
        if (!this.nascondibile(colonna) || this.visibile(colonna) === visibile) {
            return false;
        }
        const chiave = this.chiave(colonna);
        if (visibile) {
            this.stato.nascoste = this.stato.nascoste.filter(c => c !== chiave);
        }
        else {
            this.stato.nascoste = this.stato.nascoste.concat([chiave]);
            if (this.stato.ordinamento != null && this.stato.ordinamento.chiave === chiave) {
                this.stato.ordinamento = null;
            }
        }
        return true;
    },

    /// Il verso dell'ordinamento di una colonna: "crescente", "decrescente" o null.
    versoDi(colonna) {
        const o = this.stato.ordinamento;
        return o != null && o.chiave === this.chiave(colonna) ? o.verso : null;
    },

    /// Il click sull'icona dell'ordinamento di una colonna: crescente, poi decrescente, poi l'ordine di
    /// prima. Una colonna alla volta: le altre tornano all'ordine di prima.
    cliccaOrdinamento(colonna) {
        const chiave = this.chiave(colonna);
        const verso = this.versoDi(colonna);
        if (verso === "crescente") {
            this.stato.ordinamento = { chiave: chiave, verso: "decrescente" };
        }
        else if (verso === "decrescente") {
            this.stato.ordinamento = null;
        }
        else {
            this.stato.ordinamento = { chiave: chiave, verso: "crescente" };
        }
        return this.stato.ordinamento;
    },

    /// Il simbolo dell'icona di una colonna: le due frecce, o quella del verso.
    simboloOrdinamento(colonna) {
        const verso = this.versoDi(colonna);
        return verso === "crescente" ? "▲" : verso === "decrescente" ? "▼" : "⇅";
    },

    /// Due testi in ordine "naturale": i numeri come numeri ("9" prima di "10"), senza maiuscole.
    confronta(a, b) {
        return String(a).localeCompare(String(b), "it", { numeric: true, sensitivity: "base" });
    },

    /// Le righe nell'ordine della colonna ordinata, se e' fra le colonne date (le visibili); altrimenti
    /// come sono. testo(riga, colonna) e' il testo della cella. Le celle vuote stanno sempre in fondo, e
    /// a parita' resta l'ordine di prima. Non cambia la lista data.
    ordina(righe, colonne, testo) {
        const lista = Array.isArray(righe) ? righe.slice() : [];
        const o = this.stato.ordinamento;
        const colonna = o == null ? null : (colonne || []).find(c => this.chiave(c) === o.chiave);
        if (colonna == null) {
            return lista;
        }
        const segno = o.verso === "decrescente" ? -1 : 1;
        return lista
            .map((riga, indice) => ({ riga: riga, indice: indice, valore: String(testo(riga, colonna) ?? "").trim() }))
            .sort((x, y) => {
                const vuotoX = x.valore === "";
                const vuotoY = y.valore === "";
                if (vuotoX !== vuotoY) {
                    return vuotoX ? 1 : -1;
                }
                const confronto = vuotoX ? 0 : this.confronta(x.valore, y.valore) * segno;
                return confronto !== 0 ? confronto : x.indice - y.indice;
            })
            .map(x => x.riga);
    },

    /// Fino a quante righe va a capo la colonna: la descrizione 5, le altre righeMassime (0: una riga).
    righeMassime(colonna) {
        if (this.chiave(colonna) === "descrizione") {
            return this.RIGHE_DESCRIZIONE;
        }
        const righe = Number(colonna != null ? colonna.righeMassime : 0);
        return Number.isFinite(righe) && righe > 0 ? Math.floor(righe) : 0;
    },

    /// L'altezza massima di una cella che va a capo fino a righe righe.
    altezzaMassima(righe) {
        return righe * this.ALTEZZA_RIGA + this.PADDING_VERTICALE;
    },

    /// La larghezza minima di una colonna: quella configurata, ma mai meno di quella che serve alla sua
    /// intestazione intera, nome e frecce, perche' il nome non si tagli.
    minimo(colonna) {
        const configurata = Math.max(0, Math.floor(Number(colonna != null ? colonna.width : 0) || 0));
        const nome = String(colonna != null && colonna.nome != null ? colonna.nome : "");
        const intestazione = Math.ceil(nome.length * this.LARGHEZZA_CARATTERE_INTESTAZIONE + this.SPAZIO_ORDINAMENTO + this.PADDING_CELLA);
        return Math.max(configurata, intestazione);
    },

    /// La larghezza che serve alla colonna perche' il testo piu' lungo delle righe si veda intero, o,
    /// se va a capo, stia in RIGHE_DEL_FABBISOGNO righe; mai meno della sua larghezza minima. Pag e
    /// Codice non hanno priorita': a loro basta la minima, e prendono solo la parte uguale di quello che
    /// avanza.
    fabbisogno(colonna, righe, testo) {
        const minimo = this.minimo(colonna);
        if (!this.nascondibile(colonna)) {
            return minimo;
        }
        let lunghezza = 0;
        (righe || []).forEach(riga => {
            lunghezza = Math.max(lunghezza, String(testo(riga, colonna) ?? "").trim().length);
        });
        const testoIntero = lunghezza * this.LARGHEZZA_CARATTERE;
        const larghezza = this.righeMassime(colonna) > 0
            ? Math.ceil(testoIntero / this.RIGHE_DEL_FABBISOGNO)
            : testoIntero;
        return Math.max(minimo, Math.ceil(larghezza + this.PADDING_CELLA));
    },

    /// Le larghezze delle colonne nello spazio disponibile. Sotto la somma delle larghezze minime
    /// restano quelle (e la lista scorre in orizzontale). Sopra, lo spazio in piu' va prima a chi ne ha
    /// bisogno, in proporzione al bisogno, e quello che avanza si divide in parti uguali. In pixel interi,
    /// mai oltre lo spazio disponibile.
    larghezze(colonne, disponibile, fabbisogni) {
        const minimi = (colonne || []).map(c => this.minimo(c));
        const somma = minimi.reduce((s, m) => s + m, 0);
        const spazio = Math.floor(Number(disponibile) || 0);
        if (minimi.length === 0 || spazio <= somma) {
            return minimi;
        }
        const extra = spazio - somma;
        const bisogni = minimi.map((m, i) => Math.max(0, (Number(fabbisogni && fabbisogni[i]) || 0) - m));
        const totale = bisogni.reduce((s, b) => s + b, 0);
        let calcolate;
        if (totale >= extra) {
            calcolate = minimi.map((m, i) => m + extra * bisogni[i] / totale);
        }
        else {
            const quota = (extra - totale) / minimi.length;
            calcolate = minimi.map((m, i) => m + bisogni[i] + quota);
        }
        return calcolate.map(l => Math.floor(l));
    }
};

module.exports = ColonneTracciato;
