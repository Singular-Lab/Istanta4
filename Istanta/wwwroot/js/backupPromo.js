/* backupPromo.js
   I20-1106 (Lotto 1): la pagina Backup promo del menu Confronti.

   L'operatore sceglie una promo, fa il backup dei record dei tracciati o di quelli delle
   lavorazioni e, da un backup dell'elenco, ripristina o elimina. Le parti che decidono qualcosa
   (descrizioni, ordine, testi delle conferme, riassunto dell'esito) sono funzioni statiche senza
   pagina, come in parametriConfronto.js, e si provano sotto Node (tests/istanta-web). Il server
   e' PromoBackupController. */

class BackupPromo {

    constructor(corpoId) {
        this.corpoId = corpoId;
        this.idPromo = 0;
        this.backups = [];
    }

    /* ================= le regole, senza pagina ================= */

    static get TIPO_TRACCIATI() { return 1; }
    static get TIPO_LAVORAZIONI() { return 2; }

    static descriviTipo(tipo) {
        if (tipo === BackupPromo.TIPO_TRACCIATI) return "Record dei tracciati";
        if (tipo === BackupPromo.TIPO_LAVORAZIONI) return "Record delle lavorazioni";
        return "Tipo sconosciuto (" + tipo + ")";
    }

    /// La data del backup come arriva dal server (ISO), in gg/mm/aaaa hh:mm. Una data che non si
    /// legge resta com'e': meglio una stringa strana di "Invalid Date".
    static formattaData(valore) {
        var d = new Date(valore);
        if (valore == null || isNaN(d.getTime())) return String(valore == null ? "" : valore);
        function due(n) { return (n < 10 ? "0" : "") + n; }
        return due(d.getDate()) + "/" + due(d.getMonth() + 1) + "/" + d.getFullYear() + " " + due(d.getHours()) + ":" + due(d.getMinutes());
    }

    /// Dal piu' recente; a parita' di data, l'ultimo creato. Copia: non riordina l'elenco ricevuto.
    static ordina(backups) {
        return (backups || []).slice().sort(function (a, b) {
            var da = new Date(a.dataBackup).getTime();
            var db = new Date(b.dataBackup).getTime();
            if (da !== db) return db - da;
            return (b.id || 0) - (a.id || 0);
        });
    }

    static testoConfermaRipristino(backup) {
        return "Ripristinare il backup del " + BackupPromo.formattaData(backup.dataBackup) +
            " (" + BackupPromo.descriviTipo(backup.tipo) + ", " + backup.conteggio + " record)?\n\n" +
            "I record di quel tipo della promo torneranno allo stato salvato: quelli modificati dopo " +
            "saranno riscritti, quelli aggiunti dopo rimossi (tranne gli impaginati e quelli nel menabo'), " +
            "quelli eliminati dopo reinseriti.\n\nPrima viene fatto un backup di sicurezza dello stato attuale.";
    }

    static testoSecondaConfermaRipristino() {
        return "ATTENZIONE: confermi definitivamente il ripristino? I record della promo verranno riscritti.";
    }

    static testoConfermaEliminazione(backup) {
        return "Il backup del " + BackupPromo.formattaData(backup.dataBackup) +
            " (" + BackupPromo.descriviTipo(backup.tipo) + ") sara' eliminato in modo definitivo, procedere lo stesso?";
    }

    /// Le righe del messaggio a ripristino riuscito: i conteggi, poi cio' che e' rimasto com'era e
    /// perche'. Testo semplice: chi lo mostra decide come andare a capo.
    static riassuntoRipristino(res) {
        var righe = [];
        righe.push("Ripristino eseguito: " + (res.aggiornati || 0) + " record riscritti, " +
            (res.inseriti || 0) + " reinseriti, " + (res.rimossi || 0) + " rimossi, " +
            (res.invariati || 0) + " invariati.");
        if (res.idBackupSicurezza) {
            righe.push("Backup di sicurezza dello stato precedente: n. " + res.idBackupSicurezza + ".");
        }
        (res.nonRimovibili || []).forEach(function (s) {
            righe.push("Non rimosso " + (s.codice || ("id " + s.id)) + ": " + s.motivo + ".");
        });
        (res.nonInseribili || []).forEach(function (s) {
            righe.push("Non reinserito " + (s.codice || ("id " + s.id)) + ": " + s.motivo + ".");
        });
        return righe;
    }

    static esc(v) {
        return String(v === null || v === undefined ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /* ================= la pagina ================= */

    cambiaPromo(idPromo) {
        this.idPromo = idPromo;
        this.backups = [];
        nascondiMessaggio();
        if (!idPromo) {
            $("#rowAzioni").hide();
            $("#rowElenco").hide();
            return;
        }
        $("#rowAzioni").show();
        this.caricaElenco();
    }

    caricaElenco() {
        var me = this;
        showLoading();
        Call.do("PromoBackup", "lista/" + me.idPromo, "GET", null, me, function (res) {
            hideLoading();
            if (!res || !res.esito) {
                mostraMessaggio("Elenco dei backup non letto: " + BackupPromo.esc(me.motivo(res)), "danger");
                return;
            }
            me.backups = BackupPromo.ordina(res.backups);
            me.render();
        });
    }

    render() {
        var me = this;
        var $corpo = $("#" + me.corpoId);
        $corpo.empty();
        $("#rowElenco").show();

        if (me.backups.length === 0) {
            $("#pNessunBackup").show();
            $("#tabellaBackup").hide();
            return;
        }
        $("#pNessunBackup").hide();
        $("#tabellaBackup").show();

        me.backups.forEach(function (b) {
            var h = "<tr data-id='" + b.id + "'>";
            h += "<td>" + BackupPromo.esc(BackupPromo.formattaData(b.dataBackup)) + "</td>";
            h += "<td>" + BackupPromo.esc(b.tipoDescrizione || BackupPromo.descriviTipo(b.tipo)) + "</td>";
            h += "<td>" + BackupPromo.esc(b.origine) + "</td>";
            h += "<td class='text-end'>" + BackupPromo.esc(b.conteggio) + "</td>";
            h += "<td class='text-end'>";
            h += "<button class='btn btn-warning btn-sm btnRipristina' data-id='" + b.id + "'>Ripristina</button> ";
            h += "<button class='btn btn-danger btn-sm btnEliminaBackup' data-id='" + b.id + "'>Elimina</button>";
            h += "</td></tr>";
            $corpo.append(h);
        });

        $corpo.find(".btnRipristina").on("click", function () {
            me.ripristina(parseInt($(this).attr("data-id"), 10));
        });
        $corpo.find(".btnEliminaBackup").on("click", function () {
            me.elimina(parseInt($(this).attr("data-id"), 10));
        });
    }

    crea(tipo) {
        var me = this;
        if (!me.idPromo) return;
        nascondiMessaggio();
        showLoading("Backup in corso");
        Call.doWithLargePayload("PromoBackup", "crea", "PUT", { idPromo: me.idPromo, tipo: tipo }, me, function (res) {
            hideLoading();
            if (!res || !res.esito) {
                mostraMessaggio("Backup non riuscito: " + BackupPromo.esc(me.motivo(res)), "danger");
                return;
            }
            var b = res.backup || {};
            mostraMessaggio("Backup creato: " + BackupPromo.esc(b.tipoDescrizione || BackupPromo.descriviTipo(tipo)) +
                ", " + BackupPromo.esc(b.conteggio) + " record.", "success");
            me.caricaElenco();
        });
    }

    trova(idBackup) {
        return this.backups.find(function (b) { return b.id === idBackup; }) || null;
    }

    ripristina(idBackup) {
        var me = this;
        var backup = me.trova(idBackup);
        if (backup == null) return;

        // Doppia conferma: la seconda per non ripristinare per un click di troppo.
        if (!confirm(BackupPromo.testoConfermaRipristino(backup))) return;
        if (!confirm(BackupPromo.testoSecondaConfermaRipristino())) return;

        nascondiMessaggio();
        showLoading("Ripristino in corso");
        Call.doWithLargePayload("PromoBackup", "ripristina", "PUT", { idBackup: idBackup }, me, function (res) {
            hideLoading();
            if (!res || !res.esito) {
                mostraMessaggio("Ripristino non riuscito, nessun record modificato: " + BackupPromo.esc(me.motivo(res)), "danger");
                return;
            }
            var righe = BackupPromo.riassuntoRipristino(res).map(BackupPromo.esc);
            var tipo = (res.nonRimovibili || []).length + (res.nonInseribili || []).length > 0 ? "warning" : "success";
            mostraMessaggio(righe.join("<br>"), tipo);
            me.caricaElenco();
        });
    }

    elimina(idBackup) {
        var me = this;
        var backup = me.trova(idBackup);
        if (backup == null) return;
        if (!confirm(BackupPromo.testoConfermaEliminazione(backup))) return;

        nascondiMessaggio();
        showLoading();
        Call.do("PromoBackup", "elimina/" + idBackup, "DELETE", null, me, function (res) {
            hideLoading();
            if (!res || !res.esito) {
                mostraMessaggio("Backup non eliminato: " + BackupPromo.esc(me.motivo(res)), "danger");
                return;
            }
            me.caricaElenco();
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
    module.exports = BackupPromo;
}
