/*
 * Una pagina finta quel tanto che basta per far girare i metodi che parlano col documento.
 *
 * Serve a provare cosa succede davvero premendo un pulsante, invece di controllare com'e' scritto
 * il codice: tiene conto di cosa e' visibile, dei valori dei campi e dei gestori attaccati
 * all'immagine, che e' il punto dove i difetti dell'anteprima si sono manifestati.
 *
 * Non e' un file di test: node --test esegue solo i file che finiscono per .test.js.
 */

function paginaFinta() {
    const nodi = {};

    function nodo(id) {
        if (!nodi[id]) {
            nodi[id] = {
                visibile: true, testo: '', valore: '',
                attributi: {}, proprieta: {},
                elemento: { onload: null, onerror: null }
            };
        }
        return nodi[id];
    }

    const selettore = function (chiave) {
        const n = nodo(String(chiave).replace('#', ''));
        const api = {
            0: n.elemento,
            attr(nome, valore) { if (valore === undefined) { return n.attributi[nome]; } n.attributi[nome] = valore; return api; },
            removeAttr(nome) { delete n.attributi[nome]; return api; },
            prop(nome, valore) { if (valore === undefined) { return n.proprieta[nome]; } n.proprieta[nome] = valore; return api; },
            show() { n.visibile = true; return api; },
            hide() { n.visibile = false; return api; },
            text(t) { if (t === undefined) { return n.testo; } n.testo = t; return api; },
            val(v) { if (v === undefined) { return n.valore; } n.valore = v; return api; }
        };
        return api;
    };

    selettore.nodi = nodi;
    return selettore;
}

module.exports = paginaFinta;
