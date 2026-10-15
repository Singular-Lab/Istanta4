/* puliziaListe.js
   I20-1106 (Lotto 2): la pagina Pulizia liste del menu Confronti.

   L'operatore sceglie una promo e una delle sue liste, avvia il report e vede i record della
   promo che le regole del cliente riconoscono e che nella lista non ci sono piu': i manuali prima,
   gli impaginati visibili ma non selezionabili, i contatori in cima che accendono e spengono ogni
   categoria. Seleziona, poi ELIMINA con doppia conferma. Le parti che decidono qualcosa sono
   funzioni statiche senza pagina, come in backupPromo.js, e si provano sotto Node
   (tests/istanta-web). Il server e' ConfrontiController (listeDellaPromo, puliziaListeReport,
   puliziaListeElimina). */

class PuliziaListe {

    constructor(corpoId) {
        this.corpoId = corpoId;
        this.idPromo = 0;
        this.idImportazione = 0;
        this.nomeLista = "";
        this.righe = [];
        this.selezionati = {};
        this.attive = { manuale: true, daLista: true, impaginato: true };
    }

    /* ================= le regole, senza pagina ================= */

    /// Le categorie di una riga: manuale oppure daLista, piu' impaginato se lo e'.
    static categorie(riga) {
        var c = [riga.manuale ? "manuale" : "daLista"];
        if (riga.impaginato) c.push("impaginato");
        return c;
    }

    /// Una riga resta visibile finche' almeno una delle sue categorie e' accesa.
    static visibile(riga, attive) {
        return PuliziaListe.categorie(riga).some(function (c) { return attive[c] !== false; });
    }

    /// Manuali prima, poi per codice, poi dalla versione piu' alta. Copia: non riordina l'originale.
    static ordina(righe) {
        return (righe || []).slice().sort(function (a, b) {
            if (!!a.manuale !== !!b.manuale) return a.manuale ? -1 : 1;
            var ca = String(a.codice || ""), cb = String(b.codice || "");
            if (ca !== cb) return ca < cb ? -1 : 1;
            return (b.versione || 0) - (a.versione || 0);
        });
    }

    /// I contatori: per categoria sull'intero report, e i visualizzati con le categorie accese.
    static conta(righe, attive) {
        var r = righe || [];
        return {
            manuali: r.filter(function (x) { return x.manuale; }).length,
            daLista: r.filter(function (x) { return !x.manuale; }).length,
            impaginati: r.filter(function (x) { return x.impaginato; }).length,
            visualizzati: r.filter(function (x) { return PuliziaListe.visibile(x, attive || {}); }).length
        };
    }

    /// Gli id che un pulsante di selezione sceglie: mai gli impaginati, mai le righe nascoste.
    static idSelezionabili(righe, criterio, attive) {
        var a = attive || {};
        return (righe || []).filter(function (r) {
            if (r.impaginato || !PuliziaListe.visibile(r, a)) return false;
            if (criterio === "tutti") return true;
            if (criterio === "manuali") return !!r.manuale;
            if (criterio === "daLista") return !r.manuale;
            return false;
        }).map(function (r) { return r.id; });
    }

    static testoConfermaEliminazione(quanti, nomeLista) {
        return "Stai per eliminare " + quanti + " record dal tracciato della promo (lista " + (nomeLista || "") + ").\n\n" +
            "I prodotti selezionati saranno eliminati dal tracciato: non compariranno piu' nelle liste della promo. " +
            "Prima dell'eliminazione viene fatto un backup dei record dei tracciati, da cui si puo' ripristinare (Confronti > Backup promo).\n\n" +
            "Procedere?";
    }

    static testoSecondaConfermaEliminazione(quanti) {
        return "ATTENZIONE: confermi definitivamente l'eliminazione di " + quanti + " record dal tracciato?";
    }

    /// Le righe del messaggio a eliminazione riuscita: quanti, il backup, e cio' che e' rimasto e perche'.
    static riassuntoEliminazione(res) {
        var righe = [];
        righe.push("Eliminati " + (res.eliminati || 0) + " record dal tracciato.");
        if (res.idBackup) {
            righe.push("Backup dei record dei tracciati fatto prima dell'eliminazione: n. " + res.idBackup + ".");
        }
        (res.saltati || []).forEach(function (s) {
            righe.push("Non eliminato " + (s.codice || ("id " + s.id)) + ": " + s.motivo + ".");
        });
        return righe;
    }

    static formattaData(valore) {
        var d = new Date(valore);
        if (valore == null || isNaN(d.getTime())) return String(valore == null ? "" : valore);
        function due(n) { return (n < 10 ? "0" : "") + n; }
        return due(d.getDate()) + "/" + due(d.getMonth() + 1) + "/" + d.getFullYear() + " " + due(d.getHours()) + ":" + due(d.getMinutes());
    }

    static esc(v) {
        return String(v === null || v === undefined ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /* ================= la pagina ================= */

    cambiaPromo(idPromo) {
        this.idPromo = idPromo;
        this.idImportazione = 0;
        this.nascondiReport();
        nascondiMessaggio();
        var $lista = $("#TendinaLista");
        $lista.empty().prop("disabled", true);
        $("#btnAvviaReport").hide();
        if (!idPromo) {
            $lista.append("<option value='0'>Seleziona prima una promo</option>");
            return;
        }
        this.caricaListe();
    }

    caricaListe() {
        var me = this;
        showLoading();
        Call.do("Confronti", "listeDellaPromo/" + me.idPromo, "GET", null, me, function (res) {
            hideLoading();
            var $lista = $("#TendinaLista");
            if (!res || !res.esito) {
                mostraMessaggio("Liste della promo non lette: " + PuliziaListe.esc(me.motivo(res)), "danger");
                return;
            }
            $lista.append("<option value='0'>Seleziona una lista</option>");
            (res.liste || []).forEach(function (l) {
                $lista.append("<option value='" + l.idImportazione + "' data-nome='" + PuliziaListe.esc(l.nomeFile) + "'>" +
                    PuliziaListe.esc(l.nomeFile) + " - " + PuliziaListe.esc(l.label || "senza label") + " (" + PuliziaListe.esc(PuliziaListe.formattaData(l.dataCaricamento)) + ")</option>");
            });
            $lista.prop("disabled", (res.liste || []).length === 0);
            if ((res.liste || []).length === 0) {
                mostraMessaggio("Questa promo non ha liste caricate.", "warning");
            }
        });
    }

    cambiaLista(idImportazione) {
        this.idImportazione = idImportazione;
        this.nomeLista = $("#TendinaLista option:selected").attr("data-nome") || "";
        this.nascondiReport();
        nascondiMessaggio();
        if (idImportazione) {
            $("#btnAvviaReport").show();
        } else {
            $("#btnAvviaReport").hide();
        }
    }

    nascondiReport() {
        this.righe = [];
        this.selezionati = {};
        this.attive = { manuale: true, daLista: true, impaginato: true };
        $("#reportContainer").hide();
    }

    avviaReport() {
        var me = this;
        if (!me.idPromo || !me.idImportazione) return;
        nascondiMessaggio();
        showLoading("Lettura della lista e dei record");
        Call.doWithLargePayload("Confronti", "puliziaListeReport", "PUT", { idPromo: me.idPromo, idImportazione: me.idImportazione }, me, function (res) {
            hideLoading();
            if (!res || !res.esito) {
                mostraMessaggio("Report non riuscito: " + PuliziaListe.esc(me.motivo(res)), "danger");
                return;
            }
            me.righe = PuliziaListe.ordina(res.righe);
            me.selezionati = {};
            me.attive = { manuale: true, daLista: true, impaginato: true };
            $("#reportTitolo").text(" - " + (res.nomeLista || me.nomeLista) + " (" + (res.label || "") + "), " + (res.codiciInLista || 0) + " codici in lista, tipi: " + ((res.tipi || []).join(", ") || "nessuno"));
            if ((res.tipi || []).length === 0) {
                mostraMessaggio("Nessun tipo di record definito nelle regole del cliente: il report e' vuoto per forza. Apri le regole e definiscine almeno uno.", "warning");
            }
            me.render();
        });
    }

    render() {
        var me = this;
        var $corpo = $("#" + me.corpoId);
        $corpo.empty();
        $("#reportContainer").show();

        if (me.righe.length === 0) {
            $("#pNessunRecord").show();
            $("#tabellaReport").hide();
        } else {
            $("#pNessunRecord").hide();
            $("#tabellaReport").show();
        }

        me.righe.forEach(function (r) {
            var classi = [];
            if (r.impaginato) classi.push("impaginata");
            if (me.selezionati[r.id]) classi.push("selezionata");
            var h = "<tr data-id='" + r.id + "' class='" + classi.join(" ") + "'" + (PuliziaListe.visibile(r, me.attive) ? "" : " style='display:none;'") + ">";
            h += "<td>" + (r.impaginato ? "" : "<input type='checkbox' class='chkRiga' data-id='" + r.id + "'" + (me.selezionati[r.id] ? " checked" : "") + ">") + "</td>";
            h += "<td>" + PuliziaListe.esc(r.codice) + (r.impaginato ? "<div class='avviso-impaginato'>&#9888; non eliminabile: " + PuliziaListe.esc(r.motivoImpaginato) + "</div>" : "") + "</td>";
            h += "<td>" + PuliziaListe.esc(r.codiceGruppo) + "</td>";
            h += "<td>" + PuliziaListe.esc(r.descrizione) + "</td>";
            h += "<td>" + PuliziaListe.esc(r.label) + " / " + PuliziaListe.esc(r.versione) + "</td>";
            h += "<td>" + PuliziaListe.esc(r.tracciato) + "</td>";
            h += "<td>" + (r.manuale ? "<span class='badge bg-warning text-dark'>manuale</span>" : "<span class='badge bg-primary'>da lista</span>") + "</td>";
            h += "<td>" + PuliziaListe.esc(r.tipo) + "</td>";
            var valori = [];
            Object.keys(r.valoriRegole || {}).forEach(function (k) {
                valori.push("<b>" + PuliziaListe.esc(k) + "</b>: " + PuliziaListe.esc(r.valoriRegole[k]));
            });
            h += "<td class='valori-regole'>" + valori.join("<br>") + "</td>";
            h += "</tr>";
            $corpo.append(h);
        });

        $corpo.find(".chkRiga").on("change", function () {
            me.toggleRiga(parseInt($(this).attr("data-id"), 10), $(this).is(":checked"));
        });

        me.renderContatori();
        me.aggiornaPulsanti();
    }

    renderContatori() {
        var c = PuliziaListe.conta(this.righe, this.attive);
        $("#cntManuali span").text(c.manuali);
        $("#cntDaLista span").text(c.daLista);
        $("#cntImpaginati span").text(c.impaginati);
        $("#cntTutti span").text(c.visualizzati);
        this.coloraContatore("#cntManuali", "warning", this.attive.manuale);
        this.coloraContatore("#cntDaLista", "primary", this.attive.daLista);
        this.coloraContatore("#cntImpaginati", "secondary", this.attive.impaginato);
    }

    coloraContatore(id, colore, acceso) {
        $(id).removeClass("btn-" + colore + " btn-outline-" + colore).addClass(acceso ? "btn-" + colore : "btn-outline-" + colore);
    }

    /// Il contatore fa da interruttore: spento, le righe di quella categoria si nascondono (se non
    /// hanno un'altra categoria accesa) e perdono la selezione.
    toggleCategoria(categoria) {
        var me = this;
        me.attive[categoria] = me.attive[categoria] === false;
        me.righe.forEach(function (r) {
            var visibile = PuliziaListe.visibile(r, me.attive);
            $("#" + me.corpoId + " tr[data-id='" + r.id + "']").toggle(visibile);
            if (!visibile && me.selezionati[r.id]) {
                me.toggleRiga(r.id, false);
            }
        });
        me.renderContatori();
        me.aggiornaPulsanti();
    }

    seleziona(criterio) {
        var me = this;
        var scelti = {};
        PuliziaListe.idSelezionabili(me.righe, criterio, me.attive).forEach(function (id) { scelti[id] = true; });
        me.righe.forEach(function (r) {
            me.toggleRiga(r.id, !!scelti[r.id]);
        });
        me.aggiornaPulsanti();
    }

    toggleRiga(id, selezionata) {
        if (selezionata) {
            this.selezionati[id] = true;
        } else {
            delete this.selezionati[id];
        }
        var $riga = $("#" + this.corpoId + " tr[data-id='" + id + "']");
        $riga.toggleClass("selezionata", !!selezionata);
        $riga.find(".chkRiga").prop("checked", !!selezionata);
        this.aggiornaPulsanti();
    }

    idSelezionati() {
        return Object.keys(this.selezionati).map(function (k) { return parseInt(k, 10); });
    }

    aggiornaPulsanti() {
        var quanti = this.idSelezionati().length;
        $("#btnElimina").prop("disabled", quanti === 0).text(quanti === 0 ? "ELIMINA" : "ELIMINA (" + quanti + ")");
    }

    elimina() {
        var me = this;
        var ids = me.idSelezionati();
        if (ids.length === 0) return;

        // Doppia conferma, con l'avviso: la seconda per non eliminare per un click di troppo.
        if (!confirm(PuliziaListe.testoConfermaEliminazione(ids.length, me.nomeLista))) return;
        if (!confirm(PuliziaListe.testoSecondaConfermaEliminazione(ids.length))) return;

        nascondiMessaggio();
        showLoading("Backup ed eliminazione in corso");
        Call.doWithLargePayload("Confronti", "puliziaListeElimina", "PUT", { idPromo: me.idPromo, idImportazione: me.idImportazione, ids: ids }, me, function (res) {
            hideLoading();
            if (!res || !res.esito) {
                mostraMessaggio("Eliminazione non riuscita, nessun record toccato: " + PuliziaListe.esc(me.motivo(res)), "danger");
                return;
            }
            var righe = PuliziaListe.riassuntoEliminazione(res).map(PuliziaListe.esc);
            mostraMessaggio(righe.join("<br>"), (res.saltati || []).length > 0 ? "warning" : "success");
            // Il report si rifa' dal server: e' lui che sa cosa e' rimasto.
            me.avviaReport();
        });
    }

    /// Il motivo di un errore, da una risposta del server o da un fallimento della chiamata.
    motivo(res) {
        if (res == null) return "nessuna risposta";
        return res.error || res.message || "errore sconosciuto";
    }
}

//In Node si esporta per i test (tests/istanta-web). Nella pagina module non esiste e questa riga
//non fa nulla.
if (typeof module !== "undefined" && module.exports) {
    module.exports = PuliziaListe;
}
