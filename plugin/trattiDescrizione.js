/*
 * I20-995: i tratti di stile di un campo descrizione.
 *
 * La schermata di edit leggeva il campo un carattere alla volta, e per ogni carattere chiedeva
 * a InDesign l'oggetto, il suo stile, il nome dello stile e il gruppo a cui appartiene. Su una
 * descrizione di duecento caratteri erano migliaia di passaggi verso InDesign, ed e' li' che
 * se ne andavano i secondi di attesa fra primarie/secondarie ed edit.
 *
 * InDesign sa gia' dire dove cambia lo stile: textStyleRanges restituisce i tratti omogenei,
 * che sono pochi. Da li' in poi il lavoro e' su stringhe, e sta qui - fuori da schedaRef.js e
 * utility.js, che richiedono InDesign e non si caricano sotto Node.
 *
 * Quello che questo modulo NON fa e' cambiare il risultato: il testo delle textarea si compone
 * carattere per carattere esattamente come prima, comprese le asimmetrie del codice vecchio.
 *
 * Esecuzione dei test: node --test tests/plugin/trattiDescrizione.test.js
 */

/// Il nome con cui la scheda riconosce uno stile: "gruppo.nome" se lo stile sta dentro un
/// gruppo, altrimenti il nome e basta.
function nomeCompletoStile(nomeStile, nomeGruppo) {
    const nome = nomeStile == null ? '' : String(nomeStile);

    if (nomeGruppo == null || String(nomeGruppo) === '') {
        return nome;
    }

    return String(nomeGruppo) + '.' + nome;
}

/// Unisce i tratti consecutivi che portano lo stesso stile. InDesign spezza i tratti anche
/// dove cambia solo un attributo locale - un corpo, un colore - mentre la scheda ragiona per
/// nome di stile: senza questo passaggio lo stesso stile aprirebbe due textarea.
function accorpa(tratti) {
    const risultato = [];

    (tratti || []).forEach(function (tratto) {
        if (tratto == null) {
            return;
        }

        const contenuto = tratto.contenuto == null ? '' : String(tratto.contenuto);

        //Un tratto senza testo non apre niente e non chiude niente: per la scheda non esiste.
        if (contenuto === '') {
            return;
        }

        const ultimo = risultato.length > 0 ? risultato[risultato.length - 1] : null;

        if (ultimo != null && ultimo.nomeCompleto === tratto.nomeCompleto) {
            ultimo.contenuto += contenuto;
            ultimo.ultimaOrigine = tratto.origine;
            return;
        }

        //origine e ultimaOrigine sono il pezzo di InDesign da cui il tratto viene, il primo e
        //l'ultimo di quelli accorpati. Qui dentro non si guardano mai: servono a chi, dopo,
        //deve risalire alla riga in cui il tratto finisce.
        risultato.push({
            nome: tratto.nome,
            nomeCompleto: tratto.nomeCompleto,
            contenuto: contenuto,
            origine: tratto.origine,
            ultimaOrigine: tratto.origine
        });
    });

    return risultato;
}

/// Gli stili nell'ordine in cui compaiono, uno stile ripetuto piu' avanti compare di nuovo.
/// E' la lista con cui si riconosce lo schema della descrizione.
function stiliInOrdine(tratti) {
    return (tratti || []).map(function (tratto) { return tratto.nomeCompleto; });
}

/// I due testi di un tratto: quello che si vede nella textarea e quello che serve a confrontare
/// il tratto con il contenuto del server.
///
/// Si differenziano sull'a capo, che nella textarea e' "\n" e nel confronto resta "\r". La
/// differenza vale dal secondo carattere in poi: sul primo carattere del tratto il codice
/// vecchio non guardava l'a capo, e cambiarlo adesso vorrebbe dire cambiare di nascosto il
/// contenuto di un campo. Ogni carattere passa dalla normalizzazione, uno per uno, perche'
/// applicarla al tratto intero riconoscerebbe sequenze lunghe - "<br>", "\r\n" - che carattere
/// per carattere non si vedono mai.
function testiDelTratto(contenuto, normalizzaCarattere) {
    const testo = contenuto == null ? '' : String(contenuto);
    const normalizza = typeof normalizzaCarattere === 'function' ? normalizzaCarattere : function (c) { return c; };

    let perLaTextarea = '';
    let perIlConfronto = '';

    for (let i = 0; i < testo.length; i++) {
        const carattere = testo[i];

        if (i > 0 && carattere === '\r') {
            perLaTextarea += '\n';
            perIlConfronto += '\r';
            continue;
        }

        const normalizzato = normalizza(carattere);
        perLaTextarea += normalizzato;
        perIlConfronto += normalizzato;
    }

    return { perLaTextarea: perLaTextarea, perIlConfronto: perIlConfronto };
}

module.exports = {
    nomeCompletoStile,
    accorpa,
    stiliInOrdine,
    testiDelTratto
};
