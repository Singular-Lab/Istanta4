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
 * della regola nascondi: quali elementi il motore nasconde, quali rimostra.
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
    CHIAVI_PER_NOME: ["postRidimensionamenti", "allineamenti", "duplicazioni", "ordiniZ", "nascondi"],

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
            nascondi: [],
            sceltaSpazioFoto: null,
            estensioniFoto: null
        };
    },

    /// Fonde le operazioni di una sovrastruttura nelle regole di un box, senza toccarle: torna
    /// una voce nuova.
    ///   - Nelle regole con nomeGruppo, una regola con lo stesso nome sostituisce quella del box,
    ///     una con un nome nuovo si aggiunge.
    ///   - I ridimensionamenti vanno in testa: il motore prende il primo che corrisponde
    ///     all'etichetta, e la sovrastruttura e' il livello piu' alto.
    ///   - Le segnalazioni dei conflitti si aggiungono.
    ///   - sceltaSpazioFoto ed estensioniFoto, se la sovrastruttura le dichiara, sostituiscono
    ///     quelle del box.
    fondiOperazioni(voce, operazioni) {
        var fusa = Object.assign({}, voce);
        var me = this;

        ["ridimensionamenti", "postRidimensionamenti", "allineamenti", "segnalazioniConflitti",
            "duplicazioni", "ordiniZ", "nascondi"].forEach(function (chiave) {
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
            if (!Array.isArray(operazioni[chiave])) {
                return;
            }
            operazioni[chiave].forEach(function (regola) {
                var nome = regola != null ? regola.nomeGruppo : null;
                var indice = nome != null && nome !== ""
                    ? fusa[chiave].findIndex(r => r != null && r.nomeGruppo === nome)
                    : -1;
                if (indice >= 0) {
                    fusa[chiave][indice] = regola;
                }
                else {
                    fusa[chiave].push(regola);
                }
            });
        });

        if (operazioni.sceltaSpazioFoto != null) {
            fusa.sceltaSpazioFoto = operazioni.sceltaSpazioFoto;
        }
        if (operazioni.estensioniFoto != null) {
            fusa.estensioniFoto = operazioni.estensioniFoto;
        }

        return me.completaVoce(fusa);
    },

    /// Una voce con tutti gli elenchi, anche se il dato ne aveva meno.
    completaVoce(voce) {
        ["ridimensionamenti", "postRidimensionamenti", "allineamenti", "segnalazioniConflitti",
            "duplicazioni", "ordiniZ", "nascondi"].forEach(function (chiave) {
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

    /// Le regole nascondi che valgono per un box, dalle quattro voci in cui il motore cerca le
    /// regole, dalla meno alla piu' specifica: default del kit di default, box del kit di
    /// default, default del kit, box del kit. Una regola con lo stesso nomeGruppo di una regola
    /// piu' specifica e' sostituita da quella.
    regoleNascondi(vociDallaMenoSpecifica) {
        var regole = [];
        (vociDallaMenoSpecifica || []).forEach(function (voce) {
            if (voce == null || !Array.isArray(voce.nascondi)) {
                return;
            }
            voce.nascondi.forEach(function (regola) {
                if (regola == null) {
                    return;
                }
                var nome = regola.nomeGruppo;
                var indice = nome != null && nome !== "" ? regole.findIndex(r => r.nomeGruppo === nome) : -1;
                if (indice >= 0) {
                    regole[indice] = regola;
                }
                else {
                    regole.push(regola);
                }
            });
        });
        return regole;
    },

    /// Cosa fare di un elemento che una o piu' regole nascondi nominano.
    ///   - Se almeno una delle sue regole ha le condizioni vere, si nasconde.
    ///   - Altrimenti si mostra, a meno che l'operatore non l'abbia messo in noRender: la sua
    ///     scelta vince sempre, e il motore non la annulla.
    /// Un elemento che nessuna regola nomina resta com'e': torna null.
    esitoNascondi(condizioniDelleRegole, nascostoDallOperatore) {
        if (!Array.isArray(condizioniDelleRegole) || condizioniDelleRegole.length === 0) {
            return null;
        }
        if (condizioniDelleRegole.some(vera => vera === true)) {
            return "nascondi";
        }
        if (nascostoDallOperatore === true) {
            return null;
        }
        return "mostra";
    }
};

module.exports = sovrastrutture;
