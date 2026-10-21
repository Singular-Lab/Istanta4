/// I20-1124: la versione precedente di un box rifatto in pagina.
///
/// Quando il Plugin rifa' un box - con un'azione sul box o con Reimpagina box - il nuovo prende
/// la posizione del vecchio su InPagina, e il vecchio resta sopra per il confronto: scostato di
/// dieci punti in alto a destra, al 60% di opacita', sul livello cloneVecchioImpaginato, che non
/// si stampa. Cosi' si capisce a colpo d'occhio quale dei due e' la versione precedente, e un
/// clone dimenticato non finisce nel PDF.
///
/// Un box su quel livello per il Plugin non e' impaginato: la mappa dell'impaginato, Trova e lo
/// svuotamento della pagina guardano solo InPagina. Riportarlo in pagina lo rimette su InPagina,
/// dov'era e com'era.
///
/// Il modulo si carica sotto Node: gli oggetti di InDesign arrivano da chi chiama, e LocationOptions
/// si chiede a InDesign solo quando serve.

const NOME_LIVELLO = "cloneVecchioImpaginato";
const NOME_LIVELLO_IN_PAGINA = "InPagina";
const OPACITA = 60;
//Verso destra e verso l'alto, in punti: le coordinate di InDesign hanno la y che cresce in giu'.
const SCOSTAMENTO = [10, -10];

function locationOptions() {
    try {
        return require("indesign").LocationOptions;
    }
    catch (e) {
        return null;
    }
}

const VersionePrecedente = {
    NOME_LIVELLO,
    OPACITA,
    SCOSTAMENTO,

    /// Se un elemento sta sul livello delle versioni precedenti.
    eVersionePrecedente(item) {
        try {
            return item != null && item.itemLayer != null
                && String(item.itemLayer.name).toLowerCase() === NOME_LIVELLO.toLowerCase();
        }
        catch (e) {
            return false;
        }
    },

    /// Il livello delle versioni precedenti del documento: lo crea se manca, sopra InPagina, e lo
    /// tiene non stampabile anche se c'era gia'.
    livello(doc) {
        let livello = doc.layers.itemByName(NOME_LIVELLO);
        if (livello == null || !livello.isValid) {
            livello = doc.layers.add({ name: NOME_LIVELLO });
            const inPagina = doc.layers.itemByName(NOME_LIVELLO_IN_PAGINA);
            const opzioni = locationOptions();
            if (inPagina != null && inPagina.isValid && opzioni != null) {
                livello.move(opzioni.before, inPagina);
            }
        }
        try {
            livello.printable = false;
        }
        catch (e) {
            //un livello che non accetta l'opzione resta com'e'
        }
        return livello;
    },

    /// Mette da parte la versione precedente: scostata, sul suo livello, al 60%.
    mettiDaParte(box, doc) {
        box.move(undefined, SCOSTAMENTO.slice());
        box.itemLayer = this.livello(doc);
        box.transparencySettings.blendingSettings.opacity = OPACITA;
        return box;
    },

    /// Riporta in pagina una versione precedente: su InPagina, dov'era, opaca.
    riportaInPagina(box, doc) {
        box.move(undefined, [-SCOSTAMENTO[0], -SCOSTAMENTO[1]]);
        box.itemLayer = doc.layers.itemByName(NOME_LIVELLO_IN_PAGINA);
        box.transparencySettings.blendingSettings.opacity = 100;
        return box;
    },

    /// Due riferimenti alla stessa presenza: stesso codice gruppo e stesso idRec (vuoto compreso).
    stessaPresenza(codiceGruppoA, idRecA, codiceGruppoB, idRecB) {
        const idA = idRecA == null || idRecA === "" ? "" : String(idRecA);
        const idB = idRecB == null || idRecB === "" ? "" : String(idRecB);
        return String(codiceGruppoA) === String(codiceGruppoB) && idA === idB;
    },

    /// I gruppi del documento, pagina per pagina, che stanno su un livello e hanno un DNA.
    /// leggiDna e' Utility.getDnaOfBox, passata da chi chiama perche' qui non c'e'.
    gruppiConDnaSulLivello(doc, nomeLivello, leggiDna, nomiPagine = null) {
        const trovati = [];
        const livelloCercato = String(nomeLivello).toLowerCase();
        for (let p = 0; p < doc.pages.length; p++) {
            const pagina = doc.pages.item(p);
            if (nomiPagine != null && nomiPagine.indexOf(String(pagina.name)) < 0) {
                continue;
            }
            for (let g = 0; g < pagina.groups.length; g++) {
                const gruppo = pagina.groups.item(g);
                let nomeLivelloDelGruppo = "";
                try {
                    nomeLivelloDelGruppo = String(gruppo.itemLayer.name).toLowerCase();
                }
                catch (e) {
                    continue;
                }
                if (nomeLivelloDelGruppo !== livelloCercato) {
                    continue;
                }
                const dna = leggiDna(gruppo);
                if (dna == null) {
                    continue;
                }
                trovati.push({ gruppo, dna, pagina: String(pagina.name) });
            }
        }
        return trovati;
    },

    /// Il box su InPagina di una presenza (codice gruppo e idRec), in qualunque pagina. Null se non c'e'.
    boxInPaginaPer(doc, codiceGruppo, idRec, leggiDna) {
        const candidati = this.gruppiConDnaSulLivello(doc, NOME_LIVELLO_IN_PAGINA, leggiDna);
        const trovato = candidati.find(c => this.stessaPresenza(c.dna.codice_gruppo, c.dna.idRec, codiceGruppo, idRec));
        return trovato != null ? trovato.gruppo : null;
    },

    /// La versione precedente di una presenza, se nel documento ce n'e' una. Null se non c'e'.
    versionePrecedenteDi(doc, codiceGruppo, idRec, leggiDna) {
        const candidati = this.gruppiConDnaSulLivello(doc, NOME_LIVELLO, leggiDna);
        const trovato = candidati.find(c => this.stessaPresenza(c.dna.codice_gruppo, c.dna.idRec, codiceGruppo, idRec));
        return trovato != null ? trovato.gruppo : null;
    }
};

module.exports = VersionePrecedente;
