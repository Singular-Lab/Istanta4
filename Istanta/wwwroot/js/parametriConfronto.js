/* parametriConfronto.js
   I20-1024: la scheda Visual di Confronti > Parametri confronto.

   Modifica campiDiControllo di SourceConfronto.json: l'elenco dei campi che il confronto fra
   liste mostra con il valore prima e dopo, e che nel confronto fra due promo diverse sono gli
   unici a essere controllati.

   Come cssFramework.js, legge il file statico che legge la scheda Source e salva con l'endpoint
   che esiste gia', Confronti/salvaSourceJsonCode: nessun controller nuovo. Del file riscrive solo
   campiDiControllo; rules, che oggi nessuno usa, e le eventuali altre chiavi restano com'erano. */

class ParametriConfronto {

    /// opzioni.dopoSalvataggio(json): chiamata a salvataggio riuscito, col JSON salvato. Serve a
    /// tenere allineata la scheda Source, che il file lo ha gia' letto.
    constructor(containerId, opzioni) {
        this.containerId = containerId;
        this.opzioni = opzioni || {};
        this.radice = null;     // l'intero SourceConfronto.json come letto
        this.campi = [];        // [{ nome, rules }] in modifica
        this.sporco = false;
    }

    /* ================= le regole, senza pagina ================= */

    /// I campi di controllo del file, copiati: modificarli non tocca la radice letta.
    static campiDaRadice(radice) {
        var elenco = radice != null && Array.isArray(radice.campiDiControllo) ? radice.campiDiControllo : [];
        return elenco
            .filter(function (c) { return c != null; })
            .map(function (c) {
                return {
                    nome: typeof c.nome === "string" ? c.nome : "",
                    rules: Array.isArray(c.rules) ? c.rules.slice() : []
                };
            });
    }

    /// I problemi dell'elenco, riga per riga. Vuoto vuol dire che si puo' salvare.
    /// Il nome e' la chiave del campo nei dati della referenza: vuoto non vuol dire niente, e due
    /// righe uguali darebbero due volte le stesse colonne.
    static valida(campi) {
        var errori = [];
        var visti = {};

        (campi || []).forEach(function (c, i) {
            var nome = c != null && typeof c.nome === "string" ? c.nome.trim() : "";
            if (nome === "") {
                errori.push({ indice: i, messaggio: "Il nome del campo e' obbligatorio." });
                return;
            }
            if (visti[nome] !== undefined) {
                errori.push({ indice: i, messaggio: "Il campo \"" + nome + "\" c'e' gia' alla riga " + (visti[nome] + 1) + "." });
                return;
            }
            visti[nome] = i;
        });

        return errori;
    }

    /// Il file da salvare: la radice com'era, con campiDiControllo sostituito. I nomi perdono gli
    /// spazi ai bordi, e ogni campo conserva le sue rules.
    static radiceDaSalvare(radice, campi) {
        var copia = radice != null && typeof radice === "object" ? JSON.parse(JSON.stringify(radice)) : {};
        copia.campiDiControllo = (campi || []).map(function (c) {
            return {
                nome: String(c.nome || "").trim(),
                rules: Array.isArray(c.rules) ? c.rules.slice() : []
            };
        });
        return copia;
    }

    static esc(v) {
        return String(v === null || v === undefined ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /* ================= la pagina ================= */

    carica() {
        var me = this;
        var contenitore = $("#" + me.containerId);
        contenitore.html('<div class="text-muted py-4">Caricamento…</div>');

        var rnd = Math.floor(Math.random() * 999999);
        var url = '/' + getWebAppRootFolder() + 'external_source' + exPathCustom + '/SourceConfronto.json?v1.' + rnd;

        $.getJSON(url)
            .done(function (dati) {
                me.radice = dati || {};
                me.campi = ParametriConfronto.campiDaRadice(me.radice);
                me.sporco = false;
                me.disegna();
            })
            .fail(function () {
                //Il file non c'e' ancora: si parte da un elenco vuoto, e il primo salvataggio lo crea.
                me.radice = {};
                me.campi = [];
                me.sporco = false;
                me.disegna('Il file <code>SourceConfronto.json</code> non esiste ancora per questo cliente: verra\' creato al primo salvataggio.');
            });
    }

    disegna(avviso, errori) {
        var me = this;
        var E = ParametriConfronto.esc;
        var erroriPerRiga = {};
        (errori || []).forEach(function (e) { erroriPerRiga[e.indice] = e.messaggio; });

        var h = '';
        if (avviso) {
            h += '<div class="alert alert-secondary" role="alert">' + avviso + '</div>';
        }

        h += '<h5 class="mb-1">Campi di controllo del confronto</h5>'
           + '<p class="text-muted mb-3" style="font-size:.9rem;">'
           + 'Ogni campo diventa due colonne, <em>prima</em> e <em>dopo</em>, nel risultato del confronto. '
           + 'Nel confronto fra due promo diverse sono anche gli unici campi controllati. '
           + 'Il nome e\' la chiave del campo nei dati della referenza, scritta esattamente cosi\'.</p>';

        h += '<table class="table table-sm align-middle" style="max-width:700px;"><thead><tr>'
           + '<th scope="col">Nome del campo</th><th scope="col" style="width:110px;"></th>'
           + '</tr></thead><tbody>';

        if (me.campi.length === 0) {
            h += '<tr><td colspan="2" class="text-muted">Nessun campo di controllo: il confronto mostrera\' solo stato, codice e descrizione.</td></tr>';
        }

        me.campi.forEach(function (c, i) {
            var errore = erroriPerRiga[i];
            h += '<tr data-indice="' + i + '"><td>'
               + '<input type="text" class="form-control form-control-sm pcNome' + (errore ? ' is-invalid' : '') + '" value="' + E(c.nome) + '" placeholder="es. tema">'
               + (errore ? '<div class="invalid-feedback">' + E(errore) + '</div>' : '')
               + '</td><td style="text-align:right;">'
               + '<button type="button" class="btn btn-outline-danger btn-sm pcRimuovi">Rimuovi</button>'
               + '</td></tr>';
        });

        h += '</tbody></table>'
           + '<button type="button" class="btn btn-outline-primary btn-sm" id="pcAggiungi">+ Aggiungi campo</button>'
           + '<div class="mt-4" style="max-width:700px; text-align:right;">'
           + '<span id="pcStato" class="me-3">' + (me.sporco ? '<span class="text-warning">Modifiche non salvate</span>' : '') + '</span>'
           + '<button type="button" class="btn btn-primary" id="pcSalva">Salva</button></div>';

        var contenitore = $("#" + me.containerId);
        contenitore.html(h);

        contenitore.find(".pcNome").on("input", function () {
            var i = parseInt($(this).closest("tr").attr("data-indice"), 10);
            me.campi[i].nome = $(this).val();
            me.segnaSporco();
        });
        contenitore.find(".pcRimuovi").on("click", function () {
            var i = parseInt($(this).closest("tr").attr("data-indice"), 10);
            me.campi.splice(i, 1);
            me.sporco = true;
            me.disegna();
        });
        contenitore.find("#pcAggiungi").on("click", function () {
            me.campi.push({ nome: "", rules: [] });
            me.sporco = true;
            me.disegna();
            contenitore.find(".pcNome").last().trigger("focus");
        });
        contenitore.find("#pcSalva").on("click", function () {
            me.salva();
        });
    }

    segnaSporco() {
        this.sporco = true;
        $("#pcStato").html('<span class="text-warning">Modifiche non salvate</span>');
    }

    salva() {
        var me = this;
        var errori = ParametriConfronto.valida(me.campi);
        if (errori.length > 0) {
            me.disegna(null, errori);
            $("#pcStato").html('<span class="text-danger">Correggi le righe segnate: non e\' stato salvato niente.</span>');
            return;
        }

        var radice = ParametriConfronto.radiceDaSalvare(me.radice, me.campi);
        var json = JSON.stringify(radice);

        $("#pcSalva").prop("disabled", true);
        $("#pcStato").html('<span class="text-muted">Salvataggio in corso…</span>');

        //Stessa chiamata della scheda Source: (controller, azione, metodo, dati, mittente, callback).
        Call.doWithLargePayload('Confronti', 'salvaSourceJsonCode', 'PUT',
            { jsoncode: json, origin: 'SourceConfronto' }, this,
            function (result) {
                if (result && result.esito) {
                    me.radice = radice;
                    me.campi = ParametriConfronto.campiDaRadice(radice);
                    me.sporco = false;
                    me.disegna();
                    $("#pcStato").html('<span class="text-success">Salvato</span>');
                    if (typeof me.opzioni.dopoSalvataggio === "function") {
                        me.opzioni.dopoSalvataggio(json);
                    }
                } else {
                    $("#pcStato").html('<span class="text-danger">Errore: '
                        + ParametriConfronto.esc((result && result.error) || 'salvataggio non riuscito') + '</span>');
                    $("#pcSalva").prop("disabled", false);
                }
            });
    }
}

//In Node si esporta per i test (tests/istanta-web). Nella pagina module non esiste e questa riga
//non fa nulla.
if (typeof module !== "undefined" && module.exports) {
    module.exports = ParametriConfronto;
}
