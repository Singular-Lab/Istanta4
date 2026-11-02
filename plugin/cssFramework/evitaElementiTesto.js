/*
 * I20-1180: testi tenuti lontani da un elemento del box.
 *
 * Nel BOX4 sottocosto di Edro21 il tag "N° PEZZI DISPONIBILI" (quantitativi) sta fisso in alto a
 * sinistra, e la descrizione, in cima alla colonna dei campi di destra, con una prima riga lunga
 * gli finiva sotto. Il contorna testo di InDesign non serve: dentro il box, che e' un gruppo, non
 * agisce sulla descrizione (provato in InDesign). Una voce del box puo' quindi dichiarare quali
 * testi devono stare lontani da quali elementi:
 *
 *   "evitaElementiTesto": [{ "testi": ["descrizione"], "elementi": ["quantitativi"], "margine": 1 }]
 *
 * A fine composizione del box, se una riga di uno di quei testi tocca uno di quegli elementi
 * allargato del margine, il Plugin sposta il bordo del riquadro rivolto verso l'elemento oltre
 * l'elemento: le righe si accorciano e vanno a capo da sole, il testo non cambia. Se il testo
 * ristretto non ci sta, il riquadro sale verso il bordo alto del box; se non basta torna com'era.
 *
 * Qui soltanto il piano, puro: le regole del box, il riquadro ristretto e le altezze da provare.
 * CssFramework lo esegue sul documento (applicaEvitaElementiTesto). I bounds seguono la
 * convenzione InDesign: [alto, sinistra, basso, destra], in mm.
 *
 * Esecuzione dei test: node --test tests/plugin/*.test.js
 */

const cssEvitaElementiTesto = {

    /// Di quanto sale il bordo alto del riquadro a ogni prova, in mm.
    PASSO_CRESCITA: 1,

    /// Sotto questa larghezza, in mm, un riquadro ristretto non e' piu' un testo leggibile.
    LARGHEZZA_MINIMA: 5,

    /// Una regola letta dalla configurazione: { testi, elementi, margine }, con testi ed elementi
    /// non vuoti e il margine in mm (0 se manca o non e' un numero). Null se non serve a niente.
    normalizzaRegola(regola) {
        if (regola == null || typeof regola !== "object") {
            return null;
        }
        const elenco = valore => (Array.isArray(valore) ? valore : [])
            .filter(e => typeof e === "string" && e.trim() !== "")
            .map(e => e.trim());
        const testi = elenco(regola.testi);
        const elementi = elenco(regola.elementi);
        if (testi.length === 0 || elementi.length === 0) {
            return null;
        }
        const margine = Number(regola.margine);
        return { testi: testi, elementi: elementi, margine: isFinite(margine) && margine > 0 ? margine : 0 };
    },

    /// Le regole di un box dalle sue voci, in ordine di precedenza: la voce del box, quella di
    /// default del kit, quella del kit di default (null dove manca). Le regole si sommano, come le
    /// regole di conflitto; una regola uguale a una gia' presa si prende una volta sola.
    regoleDelBox(voci) {
        const regole = [];
        const viste = {};
        (Array.isArray(voci) ? voci : []).forEach(voce => {
            if (voce == null || !Array.isArray(voce.evitaElementiTesto)) {
                return;
            }
            voce.evitaElementiTesto.forEach(grezza => {
                const regola = cssEvitaElementiTesto.normalizzaRegola(grezza);
                if (regola == null) {
                    return;
                }
                const chiave = JSON.stringify(regola);
                if (!viste[chiave]) {
                    viste[chiave] = true;
                    regole.push(regola);
                }
            });
        });
        return regole;
    },

    /// L'ingombro di un elemento allargato del margine su tutti i lati.
    ingombro(bounds, margine) {
        const m = Number(margine) || 0;
        return [bounds[0] - m, bounds[1] - m, bounds[2] + m, bounds[3] + m];
    },

    /// Il riquadro del testo ristretto dal lato dell'elemento: se l'elemento sta a sinistra del
    /// centro del testo il bordo sinistro passa a destra dell'ingombro, altrimenti il bordo destro
    /// passa a sinistra. Alto e basso non cambiano. Null se resta meno di LARGHEZZA_MINIMA.
    riquadroRistretto(boundsTesto, ingombroElemento) {
        const centroTesto = (boundsTesto[1] + boundsTesto[3]) / 2;
        const centroElemento = (ingombroElemento[1] + ingombroElemento[3]) / 2;
        const ristretto = boundsTesto.slice();
        if (centroElemento < centroTesto) {
            ristretto[1] = Math.max(boundsTesto[1], ingombroElemento[3]);
        }
        else {
            ristretto[3] = Math.min(boundsTesto[3], ingombroElemento[1]);
        }
        return ristretto[3] - ristretto[1] >= cssEvitaElementiTesto.LARGHEZZA_MINIMA ? ristretto : null;
    },

    /// Le posizioni da provare per il bordo alto del riquadro, salendo di passo in passo fino al
    /// bordo alto del box compreso. Vuoto se il riquadro e' gia' in cima.
    altezzeDiProva(altoTesto, altoBox, passo = cssEvitaElementiTesto.PASSO_CRESCITA) {
        const altezze = [];
        if (!(passo > 0) || !(altoTesto > altoBox)) {
            return altezze;
        }
        for (let alto = altoTesto - passo; alto > altoBox; alto -= passo) {
            altezze.push(alto);
        }
        altezze.push(altoBox);
        return altezze;
    }
};

module.exports = cssEvitaElementiTesto;
