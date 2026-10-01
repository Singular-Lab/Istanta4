/*
 * I20-1026: le regole del motore CSS che non appartengono a un box ma a una ref.
 *
 * Fino a qui una regola si dava per un box (nomiBox) o per tutti i box (nomiBox vuoto). Il
 * formato Parmigiano Reggiano ha bisogno d'altro: regole che valgono per QUALUNQUE box che porti
 * una certa ref, e che cambiano con la forma del box. Le sovrastrutture sono questo: un elenco
 * del kit, accanto a operazioniPerBox, di regole con le loro condizioni.
 *
 *   sovrastrutture: [{ nome, listSetCondizioni, operazioni: { ...come le regole di un box } }]
 *
 * Una sovrastruttura le cui condizioni sono vere si FONDE nelle regole del box, come il livello
 * piu' alto: una regola con un nomeGruppo nuovo si aggiunge, una con lo stesso nomeGruppo di una
 * regola del box la sostituisce. Il motore non sa che le sovrastrutture esistono: riceve un DB
 * in cui sono gia' fuse, e la precedenza fra i livelli resta quella di sempre.
 *
 * Qui stanno anche le due condizioni nuove, sulla ref e sulla forma del box, e la decisione
 * della regola disattiva: quali loghi automatici della ref stanno fuori dal box, quali dentro.
 *
 * Niente InDesign: si caricano sotto Node e i test lo chiamano.
 *
 * Esecuzione dei test: node --test tests/plugin/*.test.js
 */

const sovrastrutture = {

    /// Le tre forme del box. Largo: la larghezza e' almeno il rapporto per l'altezza. Alto: il
    /// contrario. Standard: tutti gli altri casi.
    FORME: { largo: "largo", alto: "alto", standard: "standard" },

    /// Il rapporto fra i lati oltre il quale un box non e' piu' standard, se la regola non ne
    /// dichiara un altro.
    RAPPORTO_PREDEFINITO: 1.6,

    /// Le regole di un box che possono avere un nomeGruppo, cioe' quelle in cui una regola di
    /// un livello piu' alto sostituisce quella omonima di un livello piu' basso.
    CHIAVI_PER_NOME: ["postRidimensionamenti", "allineamenti", "duplicazioni", "ordiniZ", "disattiva"],

    /// La forma di un box dai suoi bounds InDesign [y1, x1, y2, x2]. Bounds mancanti o senza
    /// misure valgono standard: una regola di forma non deve scattare su un dato che non c'e'.
    formaDelBox(bounds, rapporto) {
        if (!Array.isArray(bounds) || bounds.length < 4) {
            return this.FORME.standard;
        }

        var altezza = Number(bounds[2]) - Number(bounds[0]);
        var larghezza = Number(bounds[3]) - Number(bounds[1]);
        if (!(altezza > 0) || !(larghezza > 0)) {
            return this.FORME.standard;
        }

        var r = Number(rapporto);
        if (!(r > 0)) {
            r = this.RAPPORTO_PREDEFINITO;
        }

        if (larghezza >= r * altezza) {
            return this.FORME.largo;
        }
        if (altezza >= r * larghezza) {
            return this.FORME.alto;
        }
        return this.FORME.standard;
    },

    /// Il valore di un campo della ref. Per i campi Descrizioni.* di un gruppo vale la
    /// descrizione del gruppo, quando c'e': e' quella che si impagina (come in indexNew).
    valoreCampoRef(itemRef, campo) {
        if (itemRef == null || typeof campo !== "string" || campo === "") {
            return null;
        }

        if (campo.indexOf("Descrizioni.") === 0 && itemRef.descrizione_gruppo != null
            && itemRef.descrizione_gruppo[campo] != null) {
            return itemRef.descrizione_gruppo[campo];
        }

        var valore = itemRef[campo];
        return valore === undefined ? null : valore;
    },

    /// Il testo in minuscolo, con <br>, a capo e spazi ripetuti ridotti a uno spazio: le parole
    /// di una descrizione impaginata possono stare su due righe.
    normalizzaTesto(testo) {
        if (testo == null) {
            return "";
        }
        return String(testo)
            .replace(/<br\s*\/?>/gi, " ")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();
    },

    /// refCondition: [{ campo, contiene }]. Basta che una sia vera (come le altre condizioni a
    /// elenco). Il confronto non distingue maiuscole e minuscole. Senza ref - il ritracciamento
    /// della griglia ne arriva senza - nessuna condizione sulla ref e' vera.
    refConditionVera(itemRef, refConditions) {
        if (!Array.isArray(refConditions) || refConditions.length === 0) {
            return true;
        }
        if (itemRef == null) {
            return false;
        }

        var me = this;
        return refConditions.some(function (condizione) {
            if (condizione == null || condizione.contiene == null || condizione.contiene === "") {
                return false;
            }
            var valore = me.normalizzaTesto(me.valoreCampoRef(itemRef, condizione.campo));
            return valore.indexOf(me.normalizzaTesto(condizione.contiene)) >= 0;
        });
    },

    /// formaBoxCondition: [{ forme: ["largo"|"alto"|"standard"], rapporto }]. Basta che una sia
    /// vera. Una forma scritta male non corrisponde a niente.
    formaBoxConditionVera(bounds, formaConditions) {
        if (!Array.isArray(formaConditions) || formaConditions.length === 0) {
            return true;
        }

        var me = this;
        return formaConditions.some(function (condizione) {
            if (condizione == null || !Array.isArray(condizione.forme) || condizione.forme.length === 0) {
                return false;
            }
            var forma = me.formaDelBox(bounds, condizione.rapporto);
            return condizione.forme.some(f => String(f).toLowerCase() === forma);
        });
    },

    /// Le regole di un box, con tutti gli elenchi presenti: il motore li scorre senza chiedersi
    /// se ci sono.
    voceVuota(nomeBox) {
        return {
            nomiBox: [nomeBox],
            ridimensionamenti: [],
            postRidimensionamenti: [],
            allineamenti: [],
            segnalazioniConflitti: [],
            duplicazioni: [],
            ordiniZ: [],
            disattiva: [],
            sceltaSpazioFoto: null,
            estensioniFoto: null
        };
    },

    /// Fonde le operazioni di una sovrastruttura nelle regole di un box, senza toccarle: torna
    /// una voce nuova.
    ///   - Nelle regole con nomeGruppo, le regole della sovrastruttura sostituiscono quelle del
    ///     box con lo stesso nome, e quelle con un nome nuovo si aggiungono. Piu' regole con lo
    ///     stesso nome si tengono tutte: e' cosi' che il dato esprime varianti alternative dello
    ///     stesso gruppo, con condizioni opposte (Loghi_DX di Edro21 con e senza Conad).
    ///   - I ridimensionamenti vanno in testa: il motore prende il primo che corrisponde
    ///     all'etichetta, e la sovrastruttura e' il livello piu' alto.
    ///   - Le segnalazioni dei conflitti si aggiungono.
    ///   - sceltaSpazioFoto ed estensioniFoto, se la sovrastruttura le dichiara, sostituiscono
    ///     quelle del box.
    fondiOperazioni(voce, operazioni) {
        var fusa = Object.assign({}, voce);
        var me = this;

        ["ridimensionamenti", "postRidimensionamenti", "allineamenti", "segnalazioniConflitti",
            "duplicazioni", "ordiniZ", "disattiva"].forEach(function (chiave) {
            fusa[chiave] = Array.isArray(voce[chiave]) ? voce[chiave].slice() : [];
        });

        if (operazioni == null) {
            return fusa;
        }

        if (Array.isArray(operazioni.ridimensionamenti) && operazioni.ridimensionamenti.length > 0) {
            fusa.ridimensionamenti = operazioni.ridimensionamenti.concat(fusa.ridimensionamenti);
        }

        if (Array.isArray(operazioni.segnalazioniConflitti)) {
            fusa.segnalazioniConflitti = fusa.segnalazioniConflitti.concat(operazioni.segnalazioniConflitti);
        }

        this.CHIAVI_PER_NOME.forEach(function (chiave) {
            if (Array.isArray(operazioni[chiave])) {
                fusa[chiave] = me.sostituisciPerNome(fusa[chiave], operazioni[chiave]);
            }
        });

        if (operazioni.sceltaSpazioFoto != null) {
            fusa.sceltaSpazioFoto = operazioni.sceltaSpazioFoto;
        }
        if (operazioni.estensioniFoto != null) {
            fusa.estensioniFoto = operazioni.estensioniFoto;
        }

        return me.completaVoce(fusa);
    },

    /// Le regole di sopra al posto di quelle di sotto con lo stesso nomeGruppo: le omonime di sotto
    /// se ne vanno tutte, quelle di sopra si aggiungono tutte, nel loro ordine. Una regola senza
    /// nome non sostituisce niente.
    sostituisciPerNome(sotto, sopra) {
        var regoleSopra = (sopra || []).filter(r => r != null);
        var nomi = new Set(regoleSopra.map(r => r.nomeGruppo).filter(n => n != null && n !== ""));
        return (sotto || [])
            .filter(r => r == null || !nomi.has(r.nomeGruppo))
            .concat(regoleSopra);
    },

    /// Una voce con tutti gli elenchi, anche se il dato ne aveva meno.
    completaVoce(voce) {
        ["ridimensionamenti", "postRidimensionamenti", "allineamenti", "segnalazioniConflitti",
            "duplicazioni", "ordiniZ", "disattiva"].forEach(function (chiave) {
            if (!Array.isArray(voce[chiave])) {
                voce[chiave] = [];
            }
        });
        return voce;
    },

    /// Il DB del kit con le sovrastrutture attive fuse nelle regole del box nomeBox. Se il box
    /// non ha regole sue, ne nasce una voce: le regole generali (nomiBox vuoto) continuano a
    /// valere come prima, perche' il motore scende di livello quando la voce del box non ha
    /// la regola che cerca. Il DB del kit non viene toccato.
    fondiNelDB(DB, nomeBox, operazioniAttive) {
        if (!Array.isArray(DB) || !Array.isArray(operazioniAttive) || operazioniAttive.length === 0) {
            return DB;
        }

        var indice = DB.findIndex(el => el != null && Array.isArray(el.nomiBox) && el.nomiBox.includes(nomeBox));
        var voce = indice >= 0 ? DB[indice] : this.voceVuota(nomeBox);

        var me = this;
        operazioniAttive.forEach(function (operazioni) {
            voce = me.fondiOperazioni(voce, operazioni);
        });

        var risultato = DB.slice();
        if (indice >= 0) {
            risultato[indice] = voce;
        }
        else {
            risultato.push(voce);
        }
        return risultato;
    },

    /// Le regole disattiva che valgono per un box, dalle quattro voci in cui il motore cerca le
    /// regole, dalla meno alla piu' specifica: default del kit di default, box del kit di
    /// default, default del kit, box del kit. Una regola con lo stesso nomeGruppo di una regola
    /// piu' specifica e' sostituita da quella (da tutte quelle, se sono piu' d'una).
    regoleDisattiva(vociDallaMenoSpecifica) {
        var me = this;
        var regole = [];
        (vociDallaMenoSpecifica || []).forEach(function (voce) {
            if (voce != null && Array.isArray(voce.disattiva)) {
                regole = me.sostituisciPerNome(regole, voce.disattiva);
            }
        });
        return regole;
    },

    /// La label con cui il Plugin mette nel box una voce di Foto.ExtraAuto.
    labelFotoExtraAuto(voce) {
        return "foto_extra$" + voce.sigla + "$tipo_" + voce.tipo;
    },

    /// Per ogni logo automatico della ref (le voci di Foto.ExtraAuto), se deve stare fuori dal box
    /// o dentro. valutate e' l'elenco delle regole disattiva gia' valutate: { espressioni, vera },
    /// con le espressioni delle etichette che la regola nomina e la verita' delle sue condizioni.
    ///   - Basta una regola vera che lo nomini: il logo e' disattivato, e non sta nel box.
    ///   - Lo nominano solo regole false: e' attivato, e nel box ci deve stare.
    ///   - Non lo nomina nessuna: non e' in nessuno dei due elenchi, e resta com'e'.
    /// L'esclusione dell'operatore (escluso) la guarda chi mette i loghi nel box: vince sempre.
    esitoDisattiva(vociFotoExtraAuto, valutate) {
        var me = this;
        var esito = { disattivati: new Set(), attivati: new Set() };
        (vociFotoExtraAuto || []).forEach(function (voce) {
            if (voce == null || voce.sigla == null) {
                return;
            }
            var label = me.labelFotoExtraAuto(voce);
            var condizioni = (valutate || [])
                .filter(v => v != null && (v.espressioni || []).some(r => r.test(label)))
                .map(v => v.vera === true);
            if (condizioni.length === 0) {
                return;
            }
            if (condizioni.some(vera => vera)) {
                esito.disattivati.add(voce.sigla);
            }
            else {
                esito.attivati.add(voce.sigla);
            }
        });
        return esito;
    }
};

module.exports = sovrastrutture;
