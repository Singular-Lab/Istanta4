using Istanta.Models;
using Istanta.Models_2;
using Istanta.Utility;
using IstantaLib;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// TASK-22d7fad2, lotto 1 (server): i box derivati. Un derivato e' una seconda impaginazione, chiesta
/// dall'operatore, del record di un box gia' impaginato in un Volantino: ha una riga propria di
/// promo_lavorazioni_records (derivato_di = Id della riga originale), con una copia dei meta
/// dell'originale che da li' in poi sono indipendenti. Le letture normali non lo vedono: lo trova solo
/// chi lo chiede per Id (idLavRec). Uscendo dalla lavorazione si cancella, non si disattiva. Le
/// operazioni che cambiano dati fuori dalla sua riga si fanno solo dal box originale.
/// Nessun test si connette a un database.
/// </summary>
public class BoxDerivatiTests
{
    private const string Gruppo = "7938749,7951882";
    private const string MetaPrimariaB = "{\"ps\":[{\"codRef\":\"7951882\",\"stato\":1}]}";
    private static readonly DateTime Prima = new(2026, 11, 1, 9, 0, 0);
    private static readonly DateTime Adesso = new(2026, 11, 23, 12, 0, 0);

    private static PromoLavorazioniRecord Originale(string? meta = MetaPrimariaB) =>
        new()
        {
            Id = 500,
            IdLavorazione = 1193,
            CodiceGruppo = Gruppo,
            Codice = "7938749",
            IdRecordTracciato = 100,
            Pagina = 3,
            IdAutore = 7,
            RegisterDate = Prima,
            Meta = meta
        };

    private static string Sorgente(string relativo) =>
        File.ReadAllText(DllAgenziaLibTests.TrovaFile(relativo)).Replace("\r", "");

    // ---------- creazione ----------

    [Fact]
    public void Una_riga_normale_non_e_un_derivato()
    {
        Assert.Null(new PromoLavorazioniRecord().DerivatoDi);
    }

    [Fact]
    public void Il_derivato_nasce_dal_record_dell_originale_alla_pagina_chiesta_con_una_copia_dei_suoi_meta()
    {
        var originale = Originale();

        var derivato = RecordDellaLavorazione.NuovoDerivato(originale, 7, 9, Adesso);

        Assert.Equal(500, derivato.DerivatoDi);
        Assert.Equal(0, derivato.Id);
        Assert.Equal(1193, derivato.IdLavorazione);
        Assert.Equal(100, derivato.IdRecordTracciato);
        Assert.Equal(Gruppo, derivato.CodiceGruppo);
        Assert.Equal("7938749", derivato.Codice);
        Assert.Equal((byte)7, derivato.Pagina);
        Assert.Equal((short)9, derivato.IdAutore);
        Assert.Equal(Adesso, derivato.RegisterDate);
        Assert.Equal(MetaPrimariaB, derivato.Meta);
        Assert.True(derivato.Attivo);
    }

    [Fact]
    public void Creare_il_derivato_non_cambia_l_originale()
    {
        var originale = Originale();

        RecordDellaLavorazione.NuovoDerivato(originale, 7, 9, Adesso);

        Assert.Null(originale.DerivatoDi);
        Assert.Equal((byte)3, originale.Pagina);
        Assert.Equal((short)7, originale.IdAutore);
        Assert.Equal(MetaPrimariaB, originale.Meta);
    }

    //Due derivati dello stesso box sono due righe distinte: l'Id lo assegna il database a ognuna.
    [Fact]
    public void Due_derivati_dello_stesso_box_sono_due_righe_diverse()
    {
        var originale = Originale();

        var primo = RecordDellaLavorazione.NuovoDerivato(originale, 7, 9, Adesso);
        var secondo = RecordDellaLavorazione.NuovoDerivato(originale, 9, 9, Adesso);

        Assert.NotSame(primo, secondo);
        Assert.Equal(500, primo.DerivatoDi);
        Assert.Equal(500, secondo.DerivatoDi);
        Assert.Equal((byte)9, secondo.Pagina);
    }

    [Fact]
    public void Un_box_impaginato_di_un_volantino_si_puo_derivare()
    {
        Assert.Null(RecordDellaLavorazione.MotivoDelDerivatoRifiutato(Originale(), 7, TipoLavorazione.Volantino, Gruppo));
    }

    [Fact]
    public void Il_derivato_esiste_solo_nel_volantino()
    {
        Assert.Contains("solo nelle lavorazioni Volantino", RecordDellaLavorazione.MotivoDelDerivatoRifiutato(Originale(), 7, TipoLavorazione.PoP, Gruppo));
        Assert.Contains("solo nelle lavorazioni Volantino", RecordDellaLavorazione.MotivoDelDerivatoRifiutato(Originale(), 7, null, Gruppo));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(256)]
    public void Una_pagina_non_valida_ferma_il_derivato_e_dice_quale(int pagina)
    {
        string? motivo = RecordDellaLavorazione.MotivoDelDerivatoRifiutato(Originale(), pagina, TipoLavorazione.Volantino, Gruppo);

        Assert.Contains($"la pagina {pagina} non e' valida", motivo);
    }

    [Fact]
    public void Un_box_non_impaginato_non_si_puo_derivare()
    {
        string? motivo = RecordDellaLavorazione.MotivoDelDerivatoRifiutato(null, 7, TipoLavorazione.Volantino, Gruppo);

        Assert.Contains("non e' impaginato", motivo);
        Assert.Contains(Gruppo, motivo);
    }

    [Fact]
    public void Un_derivato_non_si_puo_derivare_a_sua_volta()
    {
        var derivato = RecordDellaLavorazione.NuovoDerivato(Originale(), 7, 9, Adesso);

        string? motivo = RecordDellaLavorazione.MotivoDelDerivatoRifiutato(derivato, 9, TipoLavorazione.Volantino, Gruppo);

        Assert.Contains("non puo' essere derivato a sua volta", motivo);
    }

    // ---------- il derivato non si confonde con l'originale ----------

    //La riattivazione dei meta conservati (TASK-bb04f9aa) guarda solo righe disattivate: un derivato
    //e' sempre attivo, e comunque non e' la riga dell'originale.
    [Fact]
    public void Reimpaginando_l_originale_non_si_riattiva_mai_un_derivato()
    {
        var derivato = RecordDellaLavorazione.NuovoDerivato(Originale(), 7, 9, Adesso);

        Assert.Null(RecordDellaLavorazione.DaRiattivare(new[] { derivato }, Gruppo, 100, Array.Empty<long>()));
    }

    [Fact]
    public void Le_operazioni_che_cambiano_il_dato_si_rifiutano_sul_derivato_e_dicono_di_farle_dall_originale()
    {
        var errore = Assert.Throws<ErroreIstanta>(() => RecordDellaLavorazione.RifiutaSulDerivato(900, "Lo sgruppamento"));

        Assert.Contains("Lo sgruppamento", errore.Message);
        Assert.Contains("box originale", errore.Message);
    }

    [Fact]
    public void Senza_idLavRec_le_stesse_operazioni_passano()
    {
        RecordDellaLavorazione.RifiutaSulDerivato(0, "Lo sgruppamento");
    }

    // ---------- modello e migration ----------

    [Fact]
    public void Il_contesto_nasconde_i_derivati_come_le_righe_disattivate()
    {
        using var ctx = new FabbricaDesignTimeContesto2().CreateDbContext(Array.Empty<string>());
        var entita = ctx.Model.FindEntityType(typeof(PromoLavorazioniRecord))!;
        string filtro = entita.GetQueryFilter()!.ToString();

        Assert.Contains("Attivo", filtro);
        Assert.Contains("DerivatoDi", filtro);
        var colonna = entita.FindProperty(nameof(PromoLavorazioniRecord.DerivatoDi))!;
        Assert.Equal("derivato_di", colonna.GetColumnName());
        Assert.True(colonna.IsNullable);
        //Senza chiave esterna: il derivato resta valido anche se la riga dell'originale sparisce.
        Assert.DoesNotContain(entita.GetForeignKeys(), fk => fk.Properties.Any(p => p.Name == nameof(PromoLavorazioniRecord.DerivatoDi)));
    }

    [Fact]
    public void La_migration_aggiunge_la_colonna_nulla_senza_toccare_le_righe_esistenti()
    {
        using var ctx = new FabbricaDesignTimeContesto2().CreateDbContext(Array.Empty<string>());
        var migration = Migration(ctx, "LavorazioniRecordDerivato");

        var colonna = Assert.IsType<AddColumnOperation>(Assert.Single(migration.UpOperations));
        Assert.Equal("promo_lavorazioni_records", colonna.Table);
        Assert.Equal("derivato_di", colonna.Name);
        Assert.True(colonna.IsNullable);
        Assert.Null(colonna.DefaultValue);
    }

    [Fact]
    public void Nel_primo_contesto_la_migration_non_tocca_lo_schema()
    {
        using var ctx = new FabbricaDesignTimeContesto1().CreateDbContext(Array.Empty<string>());
        var migration = Migration(ctx, "LavorazioniRecordDerivato");

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
    public void Il_backup_conserva_di_chi_e_derivato_un_box_e_il_ripristino_lo_riporta_come_derivato()
    {
        var derivato = RecordDellaLavorazione.NuovoDerivato(Originale(), 7, 9, Adesso);
        derivato.Id = 900;

        var lette = BackupPromo.LeggiLavorazioni(BackupPromo.CreaLavorazioni(44, BackupPromo.ORIGINE_OPERATORE, new[] { Originale(), derivato }, Adesso));

        Assert.Null(lette.Single(r => r.Id == 500).DerivatoDi);
        Assert.Equal(500, lette.Single(r => r.Id == 900).DerivatoDi);

        var ripristinata = lette.Single(r => r.Id == 900).NuovaEntita();
        Assert.Equal(900, ripristinata.Id);
        Assert.Equal(500, ripristinata.DerivatoDi);
        Assert.Equal(MetaPrimariaB, ripristinata.Meta);
    }

    [Fact]
    public void Un_backup_di_prima_senza_il_legame_vale_come_riga_normale()
    {
        var backup = new PromoBackup
        {
            IdPromo = 44,
            Tipo = (byte)TipoBackupPromo.LavorazioniRecords,
            Contenuto = "[{\"Id\":10,\"IdLavorazione\":1193,\"IdRecordTracciato\":100,\"Codice\":\"A\",\"CodiceGruppo\":\"A\",\"IdAutore\":7,\"Indice\":0,\"Pagina\":3,\"Meta\":null,\"Attivo\":true}]"
        };

        var riga = Assert.Single(BackupPromo.LeggiLavorazioni(backup));

        Assert.Null(riga.DerivatoDi);
        Assert.Null(riga.NuovaEntita().DerivatoDi);
    }

    //Un derivato tolto dopo il backup non c'e' piu' fra le righe correnti: il ripristino lo reinserisce.
    [Fact]
    public void Il_ripristino_reinserisce_il_derivato_cancellato_dopo_il_backup()
    {
        var derivato = RecordDellaLavorazione.NuovoDerivato(Originale(), 7, 9, Adesso);
        derivato.Id = 900;
        var backup = BackupPromo.LeggiLavorazioni(BackupPromo.CreaLavorazioni(44, "x", new[] { Originale(), derivato }, Adesso));

        var piano = BackupPromo.PianificaRipristinoLavorazioni(backup, new[] { Originale() }, new HashSet<int> { 1193 }, new HashSet<long> { 100 });

        Assert.Equal(900, Assert.Single(piano.daInserire).Id);
        Assert.Equal(500, piano.daInserire[0].DerivatoDi);
    }

    // ---------- guardie sul sorgente ----------

    //Le letture che guardano oltre il filtro del contesto sono solo in RecordDellaLavorazione, piu' la
    //lettura dei meta e il backup: un IgnoreQueryFilters sparso farebbe vedere i derivati a chi li
    //scambierebbe per l'originale.
    [Fact]
    public void Solo_le_regole_comuni_la_lettura_dei_meta_e_il_backup_guardano_oltre_il_filtro()
    {
        Assert.DoesNotContain("IgnoreQueryFilters()", Sorgente("Istanta/Controllers/MenaboController.cs"));
        Assert.DoesNotContain("IgnoreQueryFilters()", Sorgente("Istanta/Controllers/SyncFotoController.cs"));
        Assert.DoesNotContain("IgnoreQueryFilters()", Sorgente("Istanta/Controllers/RevisoreController.cs"));
        Assert.DoesNotContain("IgnoreQueryFilters()", Sorgente("Istanta/Controllers/ConfrontiController.cs"));
        Assert.DoesNotContain("IgnoreQueryFilters()", Sorgente("Istanta/Utility/Register.cs"));
    }

    //La lettura dei meta del gruppo non prende mai la riga di un derivato, se non e' quello chiesto.
    [Fact]
    public void I_meta_del_gruppo_non_vengono_dal_derivato_se_non_e_il_box_chiesto()
    {
        string fico = Sorgente("Istanta/Controllers/FicoProcessController.cs");
        string menabo = Sorgente("Istanta/Controllers/MenaboController.cs");

        Assert.Contains("idLavorazione == f.IdLavorazione && f.DerivatoDi == null).ToList();", fico);
        Assert.Contains("if (rigaDelBox != null && string.Equals(rigaDelBox.CodiceGruppo, group.Key.CodiceGruppo, StringComparison.OrdinalIgnoreCase) && group.Any(i => i.IdRec == rigaDelBox.IdRecordTracciato))", fico);
        Assert.Contains("derivato = RecordDellaLavorazione.IlDerivato(this.ctx2, idLavorazione, idLavRec);", menabo);
        Assert.Contains("testiDalBoxPerGruppo, null, volantinoDelPop, derivato);", menabo);
    }

    //Ogni decisione sul box arriva alla riga del derivato quando la richiesta porta il suo Id.
    [Fact]
    public void Le_decisioni_sul_box_arrivano_alla_riga_del_derivato()
    {
        string menabo = Sorgente("Istanta/Controllers/MenaboController.cs");
        string syncFoto = Sorgente("Istanta/Controllers/SyncFotoController.cs");
        string registro = Sorgente("Istanta/Utility/Register.cs");

        //Primarie/secondarie, noRender, foto extra della lavorazione, testi del box.
        Assert.Equal(4, Occorrenze(menabo, "dato.idRec, dato.idLavRec);"));
        Assert.Contains("return RecordDellaLavorazione.IlDerivato(this.ctx2, idLavorazione, idLavRec);", menabo);
        //updateFotoFromIndd, updateImmagineEsistente, RimuoviFotoDaMeta, RimuoviFoto.
        Assert.Contains("_file.idLavorazione, _file.idLavRec);", syncFoto);
        Assert.Contains("data.idLavorazione, data.idLavRec);", syncFoto);
        Assert.Contains("idRec, codice, idLavorazione, idLavRec);", syncFoto);
        Assert.Contains("dato.idLavorazione, dato.idLavRec);", syncFoto);
        //Il registro scrive i meta per Id della riga: deve trovare anche quella di un derivato.
        Assert.Contains("RecordDellaLavorazione.PerId(this.ctx2, operazione.idPromoLavorazioniRecord.Value)", registro);
        Assert.DoesNotContain("this.ctx2.PromoLavorazioniRecords.FirstOrDefault(f => f.Id == operazione.idPromoLavorazioniRecord.Value)", registro);
    }

    [Fact]
    public void Revisione_azioni_sul_box_sgruppa_e_raggruppa_rifiutano_il_derivato()
    {
        string menabo = Sorgente("Istanta/Controllers/MenaboController.cs");
        string revisore = Sorgente("Istanta/Controllers/RevisoreController.cs");

        Assert.Contains("RecordDellaLavorazione.RifiutaSulDerivato(gruppi.idLavRec, \"Lo sgruppamento\");", menabo);
        Assert.Contains("RecordDellaLavorazione.RifiutaSulDerivato(gruppiDaRaggruppare.Select(g => g.idLavRec).FirstOrDefault(id => id > 0), \"Il raggruppamento\");", menabo);
        Assert.Contains("RecordDellaLavorazione.RifiutaSulDerivato(obj?.idLavRec ?? 0, \"Il cambio dei dati del box\");", menabo);
        Assert.Contains("RecordDellaLavorazione.RifiutaSulDerivato(req?.idLavRec ?? 0, \"La revisione dei campi\");", revisore);
    }

    //Svuotando, i derivati della pagina (o di tutta la lavorazione) si cancellano; rimuovendo un box
    //derivato si cancella la sua riga e il record resta nel tracciato.
    [Fact]
    public void Lo_svuotamento_e_la_rimozione_cancellano_i_derivati()
    {
        string menabo = Sorgente("Istanta/Controllers/MenaboController.cs");
        string regole = Sorgente("Istanta/Utility/RecordDellaLavorazione.cs");

        Assert.Contains("RecordDellaLavorazione.EliminaDerivati(this.ctx2, RecordDellaLavorazione.Derivati(this.ctx2).Where(item => item.IdLavorazione == idKit && item.Pagina == pagSelected));", menabo);
        Assert.Contains("RecordDellaLavorazione.EliminaDerivati(this.ctx2, RecordDellaLavorazione.Derivati(this.ctx2).Where(item => item.IdLavorazione == idKit));", menabo);
        Assert.Contains("RecordDellaLavorazione.Esce(this.ctx2, derivato);", menabo);
        Assert.Contains("if (riga.DerivatoDi != null)\n                ctx2.PromoLavorazioniRecords.Remove(riga);\n            else\n                Disattiva(riga);", regole);
    }

    //Un record con un derivato in pagina e' impaginato: non si elimina dal tracciato.
    [Fact]
    public void Chi_elimina_record_dal_tracciato_conta_i_derivati_fra_gli_impaginati()
    {
        Assert.Contains("await RecordDellaLavorazione.ImpaginatiConDerivati(this.ctx2).Where(r => idLavorazioni.Contains(r.IdLavorazione))", Sorgente("Istanta/Controllers/ConfrontiController.cs"));
        Assert.Contains("var impaginati = await RecordDellaLavorazione.ImpaginatiConDerivati(ctx2)", Sorgente("Istanta/Controllers/PromoBackupController.cs"));
        Assert.Contains("if (RecordDellaLavorazione.ConDerivati(this.ctx2, records.Select(r => r.Id)).Count > 0)", Sorgente("Istanta/Controllers/MenaboController.cs"));
    }

    //L'elenco degli impaginati porta i derivati solo a chi li chiede, e li rende riconoscibili.
    [Fact]
    public void L_elenco_degli_impaginati_porta_i_derivati_solo_su_richiesta_e_li_distingue()
    {
        string menabo = Sorgente("Istanta/Controllers/MenaboController.cs");
        Assert.Contains("public List<elementoImpaginato> getListaImpaginati(int idLavorazione, bool conDerivati = false)", menabo);

        var originale = Originale();
        var derivato = RecordDellaLavorazione.NuovoDerivato(originale, 7, 9, Adesso);
        derivato.Id = 900;

        var elenco = Istanta.Controllers.MenaboController.ElementiImpaginati(new[] { originale, derivato }, new Dictionary<int, string>());

        Assert.False(elenco[0].derivato);
        Assert.Equal(0, elenco[0].idLavRec);
        Assert.True(elenco[1].derivato);
        Assert.Equal(900, elenco[1].idLavRec);
        Assert.Equal(100, elenco[1].idRec);
        Assert.Equal("7", elenco[1].nomePagina);
    }

    // ---------- lotto 2b: il documento confrontato col server ----------

    //Nella mappa del documento un derivato ha codice gruppo e idRec dell'originale: lo distingue
    //solo l'idLavRec. Senza, la voce del derivato a pagina 7 faceva passare l'originale per
    //spostato a pagina 7.
    [Fact]
    public void La_voce_di_un_derivato_non_e_il_box_dell_originale_e_viceversa()
    {
        var originale = Originale();
        var derivato = RecordDellaLavorazione.NuovoDerivato(originale, 7, 9, Adesso);
        derivato.Id = 900;

        Assert.True(RecordDellaLavorazione.EVoceDelBox(originale, Gruppo, 100, 0));
        Assert.False(RecordDellaLavorazione.EVoceDelBox(originale, Gruppo, 100, 900));
        Assert.True(RecordDellaLavorazione.EVoceDelBox(derivato, Gruppo, 100, 900));
        Assert.False(RecordDellaLavorazione.EVoceDelBox(derivato, Gruppo, 100, 0));
        Assert.False(RecordDellaLavorazione.EVoceDelBox(derivato, Gruppo, 100, 901));
    }

    //Per i box che non sono derivati la regola resta quella di prima: codice gruppo senza
    //distinguere le maiuscole, e l'idRec solo quando la voce lo porta.
    [Fact]
    public void La_voce_di_un_originale_si_riconosce_come_prima()
    {
        var originale = Originale();

        Assert.True(RecordDellaLavorazione.EVoceDelBox(originale, Gruppo, 0, 0));
        Assert.True(RecordDellaLavorazione.EVoceDelBox(originale, Gruppo.ToUpperInvariant(), 100, 0));
        Assert.False(RecordDellaLavorazione.EVoceDelBox(originale, Gruppo, 101, 0));
        Assert.False(RecordDellaLavorazione.EVoceDelBox(originale, "1,2", 100, 0));
    }

    [Fact]
    public void L_idLavRec_del_box_e_l_Id_della_riga_solo_per_un_derivato()
    {
        var originale = Originale();
        var derivato = RecordDellaLavorazione.NuovoDerivato(originale, 7, 9, Adesso);
        derivato.Id = 900;

        Assert.Equal(0, RecordDellaLavorazione.IdLavRecDelBox(originale));
        Assert.Equal(900, RecordDellaLavorazione.IdLavRecDelBox(derivato));
    }

    //La pre-analisi guarda anche le righe derivate della pagina, risolve le voci con idLavRec
    //sulla riga del derivato, e nelle liste con l'id dice di quale box parla.
    [Fact]
    public void La_pre_analisi_confronta_i_derivati_sulla_loro_riga()
    {
        string menabo = Sorgente("Istanta/Controllers/MenaboController.cs");
        string preAnalisi = Tratto(menabo, "public async Task<IActionResult> PreAnalisiMismatch(", "public async Task<IActionResult> syncImpaginatoConServer(");

        Assert.Contains("elementiImpaginatiAPagina.AddRange(RecordDellaLavorazione.Derivati(this.ctx2)", preAnalisi);
        Assert.Contains("var elementoImpaginato = RigaDelBoxDelDocumento(item, id_lavorazione);", preAnalisi);
        Assert.DoesNotContain("GetLavorazioneRecordConFratelli(", preAnalisi);
        //Le cinque liste con l'id portano l'idLavRec.
        Assert.Equal(2, Occorrenze(preAnalisi, "idLavRec = idLavRec\n"));
        Assert.Equal(3, Occorrenze(preAnalisi, "idLavRec = item.idLavRec\n"));
        //Le liste di soli codici, lette dai client vecchi, restano dei soli originali.
        Assert.Contains("if (idLavRec == 0 && !esitoPagina.codiciPresentiSoloSulServer.Contains(codice))", preAnalisi);
        Assert.Contains("if (item.idLavRec == 0 && !esitoPagina.codiciNonImpaginatiSulServer.Contains(item.codice))", preAnalisi);

        string riga = Tratto(menabo, "private PromoLavorazioniRecord? RigaDelBoxDelDocumento(", "private PromoLavorazioniRecord? GetLavorazioneRecordConFratelli(");
        Assert.Contains("return RecordDellaLavorazione.DerivatoSeEsiste(this.ctx2, idLavorazione, item.idLavRec);", riga);
        Assert.Contains("return GetLavorazioneRecordConFratelli(item.codice, item.idRec, idLavorazione, out _);", riga);
    }

    //La sincronizzazione: un derivato su un'altra pagina sposta la sua riga; uno che il documento
    //non ha piu' si cancella; uno che Istanta non registra piu' non si registra da qui.
    [Fact]
    public void La_sincronizzazione_tratta_il_derivato_sulla_sua_riga()
    {
        string menabo = Sorgente("Istanta/Controllers/MenaboController.cs");
        string sync = Tratto(menabo, "public async Task<IActionResult> syncImpaginatoConServer(", "Menabo/inserisciBoxInPromoLavorazioniRecord/");

        Assert.DoesNotContain("GetLavorazioneRecordConFratelli(", sync);
        Assert.Equal(2, Occorrenze(sync, "RigaDelBoxDelDocumento(item, id_lavorazione);"));
        Assert.Contains("return codiciMappa.Any(c => RecordDellaLavorazione.EVoceDelBox(record, c.codice, c.idRec, c.idLavRec));", sync);
        Assert.Contains("else if (record.DerivatoDi != null)\n                            {\n                                //TASK-22d7fad2: un derivato che il documento non ha piu' si cancella.\n                                RecordDellaLavorazione.Esce(this.ctx2, record);", sync);

        int nonImpaginati = sync.IndexOf("foreach (var item in codiciNonImpaginatiSulServer)", StringComparison.Ordinal);
        int salto = sync.IndexOf("if (item.idLavRec > 0)\n                            {\n                                continue;", nonImpaginati, StringComparison.Ordinal);
        int registra = sync.IndexOf("await impaginaSingolo(richiesta", nonImpaginati, StringComparison.Ordinal);
        Assert.True(nonImpaginati > 0 && salto > nonImpaginati && salto < registra, "il derivato non registrato si salta prima di impaginaSingolo");
    }

    //Con piu' box selezionati la scheda di un derivato si chiede con il suo idLavRec.
    [Fact]
    public void Le_schede_di_piu_box_portano_l_idLavRec_di_ciascuno()
    {
        string menabo = Sorgente("Istanta/Controllers/MenaboController.cs");
        string schede = Tratto(menabo, "public async Task<IActionResult> getSchedeRefs(", "public static ArticoloInRevisioneKitResult RisultatoDellaSchedaNelMassivo(");

        Assert.Contains("[FromForm] string? idsLavRec = null)", schede);
        Assert.Contains("var idLavRec = i < listaIdsLavRec.Count\n                        ? listaIdsLavRec[i]\n                        : 0;", schede);
        Assert.Contains("mode,\n                        idLavRec\n                    );", schede);
    }

    private static string Tratto(string testo, string da, string a)
    {
        int inizio = testo.IndexOf(da, StringComparison.Ordinal);
        Assert.True(inizio >= 0, da + " non trovato");
        int fine = testo.IndexOf(a, inizio + da.Length, StringComparison.Ordinal);
        Assert.True(fine > inizio, a + " non trovato");
        return testo.Substring(inizio, fine - inizio);
    }

    private static int Occorrenze(string testo, string cercato)
    {
        int n = 0;
        for (int i = testo.IndexOf(cercato, StringComparison.Ordinal); i >= 0; i = testo.IndexOf(cercato, i + cercato.Length, StringComparison.Ordinal))
            n++;
        return n;
    }
}
