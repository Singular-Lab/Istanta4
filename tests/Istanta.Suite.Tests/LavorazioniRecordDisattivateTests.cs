using Istanta.Models;
using Istanta.Models_2;
using Istanta.Utility;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// TASK-bb04f9aa: quando un box esce dalla lavorazione la sua riga di promo_lavorazioni_records non
/// si cancella piu', si disattiva, e reimpaginando lo stesso record si riattiva con i meta che
/// aveva (primarie/secondarie, foto, noRender, testi del box). Per ogni altra lettura la riga
/// disattivata non esiste: la filtra il contesto. Prima la riga veniva cancellata e le scelte
/// dell'operatore si perdevano togliendo il box dalla pagina.
/// Nessun test si connette a un database.
/// </summary>
public class LavorazioniRecordDisattivateTests
{
    private const string Gruppo = "7938749,7951882";
    private const string MetaPrimariaB = "{\"ps\":[{\"codRef\":\"7951882\",\"stato\":1}]}";
    private static readonly DateTime Prima = new(2026, 11, 1, 9, 0, 0);
    private static readonly DateTime Adesso = new(2026, 11, 23, 10, 0, 0);

    private static PromoLavorazioniRecord Riga(long id, long idRecord, bool attivo = true, string codiceGruppo = Gruppo, string? meta = null) =>
        new()
        {
            Id = id,
            IdLavorazione = 1193,
            CodiceGruppo = codiceGruppo,
            Codice = codiceGruppo.Split(',')[0],
            IdRecordTracciato = idRecord,
            Pagina = 3,
            IdAutore = 7,
            RegisterDate = Prima,
            Meta = meta,
            Attivo = attivo
        };

    // ---------- disattivazione e riattivazione ----------

    [Fact]
    public void Una_riga_nuova_e_attiva()
    {
        Assert.True(new PromoLavorazioniRecord().Attivo);
    }

    [Fact]
    public void Disattivare_spegne_la_riga_e_non_tocca_altro()
    {
        var riga = Riga(10, 100, meta: MetaPrimariaB);

        RecordDellaLavorazione.Disattiva(riga);

        Assert.False(riga.Attivo);
        Assert.Equal(MetaPrimariaB, riga.Meta);
        Assert.Equal((byte)3, riga.Pagina);
        Assert.Equal(100, riga.IdRecordTracciato);
    }

    [Fact]
    public void Disattivare_un_elenco_le_spegne_tutte_e_regge_i_null()
    {
        var righe = new List<PromoLavorazioniRecord> { Riga(10, 100), Riga(11, 101) };

        RecordDellaLavorazione.Disattiva(righe);
        RecordDellaLavorazione.Disattiva((PromoLavorazioniRecord?)null);
        RecordDellaLavorazione.Disattiva((IEnumerable<PromoLavorazioniRecord>?)null);

        Assert.All(righe, r => Assert.False(r.Attivo));
    }

    [Fact]
    public void La_riga_riattivata_tiene_Id_e_meta_e_prende_record_pagina_autore_e_data_nuovi()
    {
        var riga = Riga(10, 100, attivo: false, meta: MetaPrimariaB);

        RecordDellaLavorazione.Compila(riga, 1193, "7951882", Gruppo, 101, 5, 9, Adesso);

        Assert.True(riga.Attivo);
        Assert.Equal(10, riga.Id);
        Assert.Equal(MetaPrimariaB, riga.Meta);
        Assert.Equal(101, riga.IdRecordTracciato);
        Assert.Equal("7951882", riga.Codice);
        Assert.Equal((byte)5, riga.Pagina);
        Assert.Equal((short)9, riga.IdAutore);
        Assert.Equal(Adesso, riga.RegisterDate);
    }

    // ---------- quale riga si riattiva ----------

    [Fact]
    public void Si_riattiva_la_riga_dello_stesso_record()
    {
        var righe = new[] { Riga(10, 100, attivo: false), Riga(11, 200, attivo: false) };

        var scelta = RecordDellaLavorazione.DaRiattivare(righe, Gruppo, 200, Array.Empty<long>());

        Assert.Equal(11, scelta!.Id);
    }

    //Dopo un cambio di primaria il gruppo si reimpagina con l'idRec della nuova primaria: la riga e'
    //legata a quello della vecchia, che e' un suo fratello (stessa lista, versione e label).
    [Fact]
    public void Senza_il_record_esatto_si_riattiva_la_riga_di_un_fratello()
    {
        var righe = new[] { Riga(10, 100, attivo: false, meta: MetaPrimariaB) };

        var scelta = RecordDellaLavorazione.DaRiattivare(righe, Gruppo, 101, new long[] { 100 });

        Assert.Equal(10, scelta!.Id);
    }

    //Lo stesso codice gruppo con un'altra label ha altri record: non sono fratelli.
    [Fact]
    public void La_riga_di_un_altra_label_non_si_riattiva()
    {
        var righe = new[] { Riga(10, 100, attivo: false, meta: MetaPrimariaB) };

        Assert.Null(RecordDellaLavorazione.DaRiattivare(righe, Gruppo, 900, new long[] { 901 }));
    }

    [Fact]
    public void Due_fratelli_candidati_non_dicono_quale_vale_e_non_se_ne_riattiva_nessuno()
    {
        var righe = new[] { Riga(10, 100, attivo: false), Riga(11, 102, attivo: false) };

        Assert.Null(RecordDellaLavorazione.DaRiattivare(righe, Gruppo, 101, new long[] { 100, 102 }));
    }

    [Fact]
    public void Il_record_esatto_vince_sui_fratelli()
    {
        var righe = new[] { Riga(10, 100, attivo: false), Riga(11, 101, attivo: false) };

        var scelta = RecordDellaLavorazione.DaRiattivare(righe, Gruppo, 101, new long[] { 100 });

        Assert.Equal(11, scelta!.Id);
    }

    [Fact]
    public void Una_riga_attiva_o_di_un_altro_codice_gruppo_non_si_riattiva()
    {
        var righe = new[] { Riga(10, 100, attivo: true), Riga(11, 100, attivo: false, codiceGruppo: "1018787") };

        Assert.Null(RecordDellaLavorazione.DaRiattivare(righe, Gruppo, 100, Array.Empty<long>()));
    }

    [Fact]
    public void Senza_righe_o_senza_idRec_non_c_e_niente_da_riattivare()
    {
        Assert.Null(RecordDellaLavorazione.DaRiattivare(null, Gruppo, 100, null));
        Assert.Null(RecordDellaLavorazione.DaRiattivare(new[] { Riga(10, 100, attivo: false) }, Gruppo, 0, new long[] { 100 }));
    }

    // ---------- lettura dei meta ----------

    [Fact]
    public void Per_i_meta_la_riga_attiva_del_gruppo_viene_prima_di_quella_disattivata()
    {
        var righe = new[] { Riga(10, 100, attivo: false, meta: MetaPrimariaB), Riga(11, 101, attivo: true) };

        var letta = RecordDellaLavorazione.PerLaLetturaConDisattivate(righe, new long[] { 100, 101 });

        Assert.Equal(11, letta!.Id);
    }

    //Il caso della richiesta: box tolto dalla pagina, il gruppo non e' impaginato ma i meta restano.
    [Fact]
    public void Senza_riga_attiva_valgono_i_meta_della_riga_disattivata_del_gruppo()
    {
        var righe = new[] { Riga(10, 100, attivo: false, meta: MetaPrimariaB) };

        var letta = RecordDellaLavorazione.PerLaLetturaConDisattivate(righe, new long[] { 100, 101 });

        Assert.Equal(10, letta!.Id);
        Assert.Equal(MetaPrimariaB, letta.Meta);
    }

    [Fact]
    public void La_riga_disattivata_di_un_altra_label_non_da_i_suoi_meta()
    {
        var righe = new[] { Riga(10, 100, attivo: false, meta: MetaPrimariaB) };

        Assert.Null(RecordDellaLavorazione.PerLaLetturaConDisattivate(righe, new long[] { 900, 901 }));
    }

    [Fact]
    public void Due_righe_disattivate_dello_stesso_gruppo_non_danno_meta()
    {
        var righe = new[] { Riga(10, 100, attivo: false), Riga(11, 101, attivo: false) };

        Assert.Null(RecordDellaLavorazione.PerLaLetturaConDisattivate(righe, new long[] { 100, 101 }));
    }

    //Senza righe disattivate la lettura e' quella di prima (I20-1088), riga unica compresa.
    [Fact]
    public void Con_sole_righe_attive_la_lettura_e_quella_di_prima()
    {
        var una = new[] { Riga(10, 100) };
        var due = new[] { Riga(10, 100), Riga(11, 200) };

        foreach (var ids in new[] { new long[] { 100 }, new long[] { 200 }, new long[] { 999 } })
        {
            Assert.Same(RecordDellaLavorazione.PerLaLettura(una, ids), RecordDellaLavorazione.PerLaLetturaConDisattivate(una, ids));
            Assert.Same(RecordDellaLavorazione.PerLaLettura(due, ids), RecordDellaLavorazione.PerLaLetturaConDisattivate(due, ids));
        }
    }

    //La riga disattivata non conta come "sola riga del codice gruppo": quel ripiego e' delle attive.
    [Fact]
    public void La_riga_disattivata_non_slegata_dal_gruppo_non_fa_da_riga_unica()
    {
        var righe = new[] { Riga(10, 100, attivo: false, meta: MetaPrimariaB), Riga(11, 200, attivo: true) };

        var letta = RecordDellaLavorazione.PerLaLetturaConDisattivate(righe, new long[] { 999 });

        Assert.Equal(11, letta!.Id);
    }

    // ---------- modello e migration ----------

    [Fact]
    public void Il_contesto_filtra_le_righe_disattivate_e_mappa_la_colonna_attivo()
    {
        using var ctx = new FabbricaDesignTimeContesto2().CreateDbContext(Array.Empty<string>());
        var entita = ctx.Model.FindEntityType(typeof(PromoLavorazioniRecord))!;

        Assert.NotNull(entita.GetQueryFilter());
        Assert.Contains("Attivo", entita.GetQueryFilter()!.ToString());
        Assert.Equal("attivo", entita.FindProperty(nameof(PromoLavorazioniRecord.Attivo))!.GetColumnName());
        Assert.False(entita.FindProperty(nameof(PromoLavorazioniRecord.Attivo))!.IsNullable);
    }

    //Le righe che esistono gia' sono impaginazioni in corso: la colonna nasce a true.
    [Fact]
    public void La_migration_aggiunge_la_colonna_con_le_righe_esistenti_attive()
    {
        using var ctx = new FabbricaDesignTimeContesto2().CreateDbContext(Array.Empty<string>());
        var migration = Migration(ctx, "LavorazioniRecordAttivo");

        var colonna = Assert.IsType<AddColumnOperation>(Assert.Single(migration.UpOperations));
        Assert.Equal("promo_lavorazioni_records", colonna.Table);
        Assert.Equal("attivo", colonna.Name);
        Assert.False(colonna.IsNullable);
        Assert.Equal(true, colonna.DefaultValue);
    }

    //Nel primo contesto la tabella non esiste: la migration riallinea solo lo snapshot.
    [Fact]
    public void Nel_primo_contesto_la_migration_non_tocca_lo_schema()
    {
        using var ctx = new FabbricaDesignTimeContesto1().CreateDbContext(Array.Empty<string>());
        var migration = Migration(ctx, "LavorazioniRecordAttivo");

        Assert.Empty(migration.UpOperations);
        Assert.Empty(migration.DownOperations);
    }

    private static Migration Migration(DbContext ctx, string nome)
    {
        var assembly = ctx.GetService<IMigrationsAssembly>();
        var tipo = assembly.Migrations.Single(m => m.Key.EndsWith("_" + nome)).Value;
        return assembly.CreateMigration(tipo, ctx.Database.ProviderName!);
    }

    // ---------- backup ----------

    [Fact]
    public void Il_backup_conserva_lo_stato_della_riga_e_il_ripristino_lo_riporta()
    {
        var backup = BackupPromo.CreaLavorazioni(44, BackupPromo.ORIGINE_OPERATORE,
            new[] { Riga(10, 100, attivo: false, meta: MetaPrimariaB), Riga(11, 200) }, Adesso);

        var lette = BackupPromo.LeggiLavorazioni(backup);

        Assert.False(lette.Single(r => r.Id == 10).Attivo);
        Assert.True(lette.Single(r => r.Id == 11).Attivo);

        var ripristinata = lette.Single(r => r.Id == 10).NuovaEntita();
        Assert.False(ripristinata.Attivo);
        Assert.Equal(MetaPrimariaB, ripristinata.Meta);

        var corrente = Riga(10, 100, attivo: true);
        lette.Single(r => r.Id == 10).ApplicaA(corrente);
        Assert.False(corrente.Attivo);
    }

    //I backup fatti prima di questa colonna non la portano: quelle righe erano tutte impaginazioni.
    [Fact]
    public void Un_backup_di_prima_senza_lo_stato_vale_come_riga_attiva()
    {
        var backup = new PromoBackup
        {
            IdPromo = 44,
            Tipo = (byte)TipoBackupPromo.LavorazioniRecords,
            Contenuto = "[{\"Id\":10,\"IdLavorazione\":1193,\"IdRecordTracciato\":100,\"Codice\":\"A\",\"CodiceGruppo\":\"A\",\"IdAutore\":7,\"Indice\":0,\"Pagina\":3,\"Meta\":null}]"
        };

        var riga = Assert.Single(BackupPromo.LeggiLavorazioni(backup));

        Assert.True(riga.Attivo);
        Assert.True(riga.NuovaEntita().Attivo);
    }

    //Una riga disattivata dopo il backup e' diversa da quella salvata: il ripristino la riporta attiva.
    [Fact]
    public void Il_ripristino_riattiva_la_riga_disattivata_dopo_il_backup()
    {
        var backup = BackupPromo.LeggiLavorazioni(BackupPromo.CreaLavorazioni(44, "x", new[] { Riga(10, 100) }, Adesso));
        var correnti = new[] { Riga(10, 100, attivo: false) };

        var piano = BackupPromo.PianificaRipristinoLavorazioni(backup, correnti, new HashSet<int> { 1193 }, new HashSet<long> { 100 });

        Assert.Equal(10, Assert.Single(piano.daAggiornare).Id);
    }

    // ---------- guardia sul sorgente ----------

    //Una riga di promo_lavorazioni_records non si cancella e non nasce fuori da RecordDellaLavorazione:
    //un Remove o un new diretto riporterebbe la perdita dei meta, o una riga doppia accanto a quella
    //disattivata. L'endpoint restoreCacheConfronto, che le riscriveva da una cache mai scritta, e' stato tolto.
    [Fact]
    public void Il_MenaboController_non_cancella_e_non_crea_le_righe_da_solo()
    {
        string sorgente = File.ReadAllText(DllAgenziaLibTests.TrovaFile("Istanta/Controllers/MenaboController.cs")).Replace("\r", "");

        Assert.DoesNotContain("PromoLavorazioniRecords.Remove(", sorgente);
        Assert.DoesNotContain("PromoLavorazioniRecords.RemoveRange(", sorgente);
        Assert.DoesNotContain("db.RemoveRange(recordDaEliminare)", sorgente);
        Assert.DoesNotContain("this.ctx2.PromoLavorazioniRecords.Add(", sorgente);
        Assert.DoesNotContain("db.PromoLavorazioniRecords.Add(", sorgente);
        Assert.DoesNotContain("PromoLavorazioniRecords.Add(", sorgente);
        Assert.DoesNotContain("restoreCacheConfronto", sorgente);

        Assert.Equal(7, Occorrenze(sorgente, "RecordDellaLavorazione.Impagina("));
        Assert.Equal(6, Occorrenze(sorgente, "RecordDellaLavorazione.Disattiva("));
    }

    //Chi elimina record dal tracciato toglie prima le loro righe disattivate, o la chiave esterna
    //rifiuta un'eliminazione che prima riusciva.
    [Theory]
    [InlineData("Istanta/Controllers/MenaboController.cs")]
    [InlineData("Istanta/Controllers/ConfrontiController.cs")]
    [InlineData("Istanta/Controllers/PromoBackupController.cs")]
    public void Chi_elimina_record_dal_tracciato_elimina_prima_le_righe_disattivate(string file)
    {
        string sorgente = File.ReadAllText(DllAgenziaLibTests.TrovaFile(file)).Replace("\r", "");

        int elimina = sorgente.IndexOf("PromoTracciatiRecords.RemoveRange(", StringComparison.Ordinal);
        int disattivate = sorgente.IndexOf("RecordDellaLavorazione.EliminaLeDisattivateDei(", StringComparison.Ordinal);

        Assert.True(elimina > 0, "eliminazione dei record non trovata in " + file);
        Assert.True(disattivate > 0 && disattivate < elimina, "le righe disattivate vanno eliminate prima dei record in " + file);
        Assert.Equal(1, Occorrenze(sorgente, "PromoTracciatiRecords.RemoveRange("));
    }

    //La lettura dei meta e il backup sono i soli a guardare anche le righe disattivate.
    [Fact]
    public void La_lettura_dei_meta_e_il_backup_vedono_anche_le_righe_disattivate()
    {
        string fico = File.ReadAllText(DllAgenziaLibTests.TrovaFile("Istanta/Controllers/FicoProcessController.cs")).Replace("\r", "");
        string backup = File.ReadAllText(DllAgenziaLibTests.TrovaFile("Istanta/Controllers/PromoBackupController.cs")).Replace("\r", "");

        Assert.Contains("RecordDellaLavorazione.PerLaLetturaConDisattivate(righeDelGruppo", fico);
        Assert.Equal(1, Occorrenze(fico, "IgnoreQueryFilters()"));
        Assert.Contains("ctx2.PromoLavorazioniRecords.IgnoreQueryFilters().Where(r => r.IdPromoLavorazioniNavigation.GuidPromo == guid)", backup);
    }

    private static int Occorrenze(string testo, string cercato)
    {
        int n = 0;
        for (int i = testo.IndexOf(cercato, StringComparison.Ordinal); i >= 0; i = testo.IndexOf(cercato, i + cercato.Length, StringComparison.Ordinal))
            n++;
        return n;
    }
}
