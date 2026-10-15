using System;
using System.Collections.Generic;
using System.Linq;
using Istanta.Models;
using Istanta.Models_2;
using Newtonsoft.Json.Linq;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1106 (Lotto 1): backup e ripristino dei record di una promo. Il backup salva tutte le
/// colonne delle righe; il ripristino le riporta allo stato salvato riscrivendo, reinserendo con
/// lo stesso Id e rimuovendo cio' che e' stato aggiunto dopo, ma lascia stare, e segnala, cio' che
/// non si puo' toccare: i record impaginati o nel menabo', le righe di un tracciato o di una
/// lavorazione che non esistono piu'. Tutto senza database: il controller passa cio' che legge e
/// BackupPromo decide.
/// </summary>
public class BackupPromoTests
{
    private static readonly DateTime Adesso = new DateTime(2026, 10, 15, 12, 30, 0);

    private static PromoTracciatiRecord Record(long id, string codice, string dato = "{\"tema\":\"x\"}", int idTracciato = 10)
    {
        return new PromoTracciatiRecord
        {
            Id = id,
            IdTracciato = idTracciato,
            Versione = 2,
            IndiceLettura = 5,
            IndiceEsportazione = -1,
            Label = "VOL",
            Scatto = "scatto",
            Codice = codice,
            CodiceGruppo = codice,
            Dato = dato,
            DaEsportare = true,
            IdAddestramento = 3,
            DataRegistrazione = new DateTime(2026, 9, 1, 8, 0, 0),
            ModalitaInserimento = 2,
            Stato = 1
        };
    }

    private static PromoLavorazioniRecord Lavorazione(long id, int idLavorazione, long idRecord, string codice = "A", byte pagina = 3)
    {
        return new PromoLavorazioniRecord
        {
            Id = id,
            IdLavorazione = idLavorazione,
            IdRecordTracciato = idRecord,
            Codice = codice,
            CodiceGruppo = codice,
            IdAutore = 7,
            RegisterDate = new DateTime(2026, 9, 2),
            Indice = 0,
            Pagina = pagina,
            Meta = "{\"foto\":1}"
        };
    }

    private static readonly Dictionary<long, string> NessunBloccato = new Dictionary<long, string>();
    private static readonly HashSet<int> Tracciati = new HashSet<int> { 10 };

    /* ---- il backup ---- */

    [Fact]
    public void Il_backup_dei_tracciati_salva_tutte_le_colonne_e_il_conteggio()
    {
        var righe = new[] { Record(1, "A"), Record(2, "B", "{\"tema\":\"fuori depliant\"}") };

        var backup = BackupPromo.CreaTracciati(44, BackupPromo.ORIGINE_OPERATORE, righe, Adesso);

        Assert.Equal(44, backup.IdPromo);
        Assert.Equal((byte)TipoBackupPromo.TracciatiRecords, backup.Tipo);
        Assert.Equal(Adesso, backup.DataBackup);
        Assert.Equal(BackupPromo.ORIGINE_OPERATORE, backup.Origine);
        Assert.Equal(2, backup.Conteggio);

        // Nel contenuto ci sono tutte le colonne della riga: cio' che manca qui non tornerebbe mai.
        var colonne = ((JObject)JArray.Parse(backup.Contenuto)[0]).Properties().Select(p => p.Name).ToHashSet();
        Assert.Equal(new HashSet<string>
        {
            "Id", "IdTracciato", "Versione", "IndiceLettura", "IndiceEsportazione", "Label", "Scatto", "Codice",
            "CodiceGruppo", "Dato", "DaEsportare", "IdAddestramento", "DataRegistrazione", "ModalitaInserimento", "Stato"
        }, colonne);

        var lette = BackupPromo.LeggiTracciati(backup);
        Assert.Equal(2, lette.Count);
        var seconda = lette.Single(r => r.Id == 2);
        Assert.Equal("B", seconda.Codice);
        Assert.Equal("{\"tema\":\"fuori depliant\"}", seconda.Dato);
        Assert.Equal(10, seconda.IdTracciato);
        Assert.Equal((byte)2, seconda.Versione);
        Assert.Equal(-1, seconda.IndiceEsportazione);
        Assert.Equal("VOL", seconda.Label);
        Assert.True(seconda.DaEsportare);
        Assert.Equal(3, seconda.IdAddestramento);
        Assert.Equal(new DateTime(2026, 9, 1, 8, 0, 0), seconda.DataRegistrazione);
        Assert.Equal((byte)2, seconda.ModalitaInserimento);
        Assert.Equal((byte)1, seconda.Stato);
    }

    [Fact]
    public void Il_backup_delle_lavorazioni_e_di_un_altro_tipo_e_non_si_legge_come_tracciati()
    {
        var backup = BackupPromo.CreaLavorazioni(44, BackupPromo.ORIGINE_OPERATORE, new[] { Lavorazione(100, 5, 1) }, Adesso);

        Assert.Equal((byte)TipoBackupPromo.LavorazioniRecords, backup.Tipo);
        Assert.Equal(1, backup.Conteggio);

        var lette = BackupPromo.LeggiLavorazioni(backup);
        Assert.Equal(100, lette[0].Id);
        Assert.Equal(5, lette[0].IdLavorazione);
        Assert.Equal(1, lette[0].IdRecordTracciato);
        Assert.Equal((byte)3, lette[0].Pagina);
        Assert.Equal("{\"foto\":1}", lette[0].Meta);

        // Un backup di lavorazioni ripristinato come tracciati scriverebbe le righe sulla tabella sbagliata.
        Assert.Throws<InvalidOperationException>(() => BackupPromo.LeggiTracciati(backup));
    }

    [Fact]
    public void Un_backup_senza_record_e_valido()
    {
        var backup = BackupPromo.CreaTracciati(44, BackupPromo.ORIGINE_OPERATORE, Array.Empty<PromoTracciatiRecord>(), Adesso);

        Assert.Equal(0, backup.Conteggio);
        Assert.Empty(BackupPromo.LeggiTracciati(backup));
    }

    [Fact]
    public void L_elenco_e_dal_piu_recente_e_descrive_il_tipo()
    {
        var backups = new[]
        {
            new PromoBackup { Id = 1, IdPromo = 44, Tipo = 1, DataBackup = Adesso.AddDays(-1), Origine = "a", Conteggio = 10, Contenuto = "" },
            new PromoBackup { Id = 3, IdPromo = 44, Tipo = 2, DataBackup = Adesso, Origine = "c", Conteggio = 2, Contenuto = "" },
            new PromoBackup { Id = 2, IdPromo = 44, Tipo = 1, DataBackup = Adesso, Origine = "b", Conteggio = 5, Contenuto = "" }
        };

        var elenco = BackupPromo.Elenco(backups);

        Assert.Equal(new[] { 3, 2, 1 }, elenco.Select(e => e.id).ToArray());
        Assert.Equal("Record delle lavorazioni", elenco[0].tipoDescrizione);
        Assert.Equal("Record dei tracciati", elenco[1].tipoDescrizione);
        Assert.Equal("b", elenco[1].origine);
        Assert.Equal(5, elenco[1].conteggio);
    }

    /* ---- il piano del ripristino, record dei tracciati ---- */

    [Fact]
    public void Il_ripristino_riscrive_i_modificati_reinserisce_gli_eliminati_e_rimuove_gli_aggiunti()
    {
        var backup = BackupPromo.LeggiTracciati(BackupPromo.CreaTracciati(44, "x", new[] { Record(1, "A"), Record(2, "B") }, Adesso));
        var correnti = new[]
        {
            Record(1, "A", "{\"tema\":\"cambiato\"}"),   // c'era, ma e' stato modificato
            Record(3, "C")                               // aggiunto dopo il backup
        };

        var piano = BackupPromo.PianificaRipristinoTracciati(backup, correnti, NessunBloccato, Tracciati);

        Assert.Equal(new long[] { 1 }, piano.daAggiornare.Select(r => r.Id).ToArray());
        Assert.Equal("{\"tema\":\"x\"}", piano.daAggiornare[0].Dato);
        Assert.Equal(new long[] { 2 }, piano.daInserire.Select(r => r.Id).ToArray());
        Assert.Equal(new long[] { 3 }, piano.daRimuovere.ToArray());
        Assert.Equal(0, piano.invariati);
        Assert.Empty(piano.nonRimovibili);
        Assert.Empty(piano.nonInseribili);
    }

    [Fact]
    public void Un_record_uguale_al_backup_non_si_riscrive()
    {
        var backup = BackupPromo.LeggiTracciati(BackupPromo.CreaTracciati(44, "x", new[] { Record(1, "A") }, Adesso));

        var piano = BackupPromo.PianificaRipristinoTracciati(backup, new[] { Record(1, "A") }, NessunBloccato, Tracciati);

        Assert.Equal(1, piano.invariati);
        Assert.Empty(piano.daAggiornare);
        Assert.Empty(piano.daInserire);
        Assert.Empty(piano.daRimuovere);
    }

    [Fact]
    public void Un_record_impaginato_o_nel_menabo_resta_e_viene_segnalato()
    {
        var backup = BackupPromo.LeggiTracciati(BackupPromo.CreaTracciati(44, "x", new[] { Record(1, "A") }, Adesso));
        var correnti = new[] { Record(1, "A"), Record(2, "B"), Record(3, "C"), Record(4, "D") };
        var bloccati = new Dictionary<long, string>
        {
            [2] = BackupPromo.MOTIVO_IMPAGINATO,
            [3] = BackupPromo.MOTIVO_NEL_MENABO
        };

        var piano = BackupPromo.PianificaRipristinoTracciati(backup, correnti, bloccati, Tracciati);

        Assert.Equal(new long[] { 4 }, piano.daRimuovere.ToArray());
        Assert.Equal(2, piano.nonRimovibili.Count);
        var impaginato = piano.nonRimovibili.Single(s => s.id == 2);
        Assert.Equal("B", impaginato.codice);
        Assert.Equal(BackupPromo.MOTIVO_IMPAGINATO, impaginato.motivo);
        Assert.Equal(BackupPromo.MOTIVO_NEL_MENABO, piano.nonRimovibili.Single(s => s.id == 3).motivo);
    }

    [Fact]
    public void Una_riga_di_un_tracciato_sparito_non_si_reinserisce()
    {
        var backup = BackupPromo.LeggiTracciati(BackupPromo.CreaTracciati(44, "x", new[] { Record(1, "A", idTracciato: 99), Record(2, "B") }, Adesso));

        var piano = BackupPromo.PianificaRipristinoTracciati(backup, Array.Empty<PromoTracciatiRecord>(), NessunBloccato, Tracciati);

        Assert.Equal(new long[] { 2 }, piano.daInserire.Select(r => r.Id).ToArray());
        var saltata = Assert.Single(piano.nonInseribili);
        Assert.Equal(1, saltata.id);
        Assert.Equal("A", saltata.codice);
        Assert.Equal(BackupPromo.MOTIVO_TRACCIATO_ASSENTE, saltata.motivo);
    }

    [Fact]
    public void Con_un_backup_vuoto_si_rimuove_tutto_tranne_i_bloccati()
    {
        var correnti = new[] { Record(1, "A"), Record(2, "B") };
        var bloccati = new Dictionary<long, string> { [2] = BackupPromo.MOTIVO_IMPAGINATO };

        var piano = BackupPromo.PianificaRipristinoTracciati(new List<RigaTracciatoBackup>(), correnti, bloccati, Tracciati);

        Assert.Equal(new long[] { 1 }, piano.daRimuovere.ToArray());
        Assert.Equal(2, Assert.Single(piano.nonRimovibili).id);
        Assert.Empty(piano.daInserire);
        Assert.Empty(piano.daAggiornare);
    }

    [Fact]
    public void Un_id_doppio_nel_backup_vale_una_volta_sola()
    {
        var backup = BackupPromo.LeggiTracciati(BackupPromo.CreaTracciati(44, "x", new[] { Record(1, "A"), Record(1, "A-bis") }, Adesso));

        var piano = BackupPromo.PianificaRipristinoTracciati(backup, Array.Empty<PromoTracciatiRecord>(), NessunBloccato, Tracciati);

        // Due inserimenti con lo stesso Id farebbero fallire tutto il ripristino.
        var unica = Assert.Single(piano.daInserire);
        Assert.Equal("A", unica.Codice);
    }

    [Fact]
    public void La_riga_reinserita_porta_l_id_originale_e_tutte_le_colonne()
    {
        var originale = Record(123, "A", "{\"d\":1}");
        var riga = BackupPromo.LeggiTracciati(BackupPromo.CreaTracciati(44, "x", new[] { originale }, Adesso)).Single();

        var entita = riga.NuovaEntita();

        Assert.Equal(123, entita.Id);
        Assert.Equal(originale.IdTracciato, entita.IdTracciato);
        Assert.Equal(originale.Versione, entita.Versione);
        Assert.Equal(originale.IndiceLettura, entita.IndiceLettura);
        Assert.Equal(originale.IndiceEsportazione, entita.IndiceEsportazione);
        Assert.Equal(originale.Label, entita.Label);
        Assert.Equal(originale.Scatto, entita.Scatto);
        Assert.Equal(originale.Codice, entita.Codice);
        Assert.Equal(originale.CodiceGruppo, entita.CodiceGruppo);
        Assert.Equal(originale.Dato, entita.Dato);
        Assert.Equal(originale.DaEsportare, entita.DaEsportare);
        Assert.Equal(originale.IdAddestramento, entita.IdAddestramento);
        Assert.Equal(originale.DataRegistrazione, entita.DataRegistrazione);
        Assert.Equal(originale.ModalitaInserimento, entita.ModalitaInserimento);
        Assert.Equal(originale.Stato, entita.Stato);

        // Riscrivere un record esistente non gli cambia l'Id.
        var esistente = Record(123, "vecchio", "{}");
        riga.ApplicaA(esistente);
        Assert.Equal(123, esistente.Id);
        Assert.Equal("A", esistente.Codice);
        Assert.Equal("{\"d\":1}", esistente.Dato);
    }

    /* ---- il piano del ripristino, record delle lavorazioni ---- */

    [Fact]
    public void Il_ripristino_delle_lavorazioni_salta_le_righe_senza_lavorazione_o_senza_record()
    {
        var backup = BackupPromo.LeggiLavorazioni(BackupPromo.CreaLavorazioni(44, "x", new[]
        {
            Lavorazione(100, 5, 1, "A"),
            Lavorazione(101, 6, 2, "B"),   // la lavorazione 6 non c'e' piu'
            Lavorazione(102, 5, 3, "C"),   // il record 3 del tracciato non c'e' piu'
            Lavorazione(103, 5, 4, "D", pagina: 9)
        }, Adesso));
        var correnti = new[]
        {
            Lavorazione(103, 5, 4, "D", pagina: 2),   // cambiata pagina dopo il backup
            Lavorazione(104, 5, 4, "E")               // aggiunta dopo il backup
        };

        var piano = BackupPromo.PianificaRipristinoLavorazioni(backup, correnti, new HashSet<int> { 5 }, new HashSet<long> { 1, 2, 4 });

        Assert.Equal(new long[] { 100 }, piano.daInserire.Select(r => r.Id).ToArray());
        Assert.Equal(new long[] { 103 }, piano.daAggiornare.Select(r => r.Id).ToArray());
        Assert.Equal((byte)9, piano.daAggiornare[0].Pagina);
        Assert.Equal(new long[] { 104 }, piano.daRimuovere.ToArray());
        Assert.Equal(2, piano.nonInseribili.Count);
        Assert.Equal(BackupPromo.MOTIVO_LAVORAZIONE_ASSENTE, piano.nonInseribili.Single(s => s.id == 101).motivo);
        Assert.Equal(BackupPromo.MOTIVO_RECORD_ASSENTE, piano.nonInseribili.Single(s => s.id == 102).motivo);
        Assert.Empty(piano.nonRimovibili);
    }

    /* ---- l'esito e la sequenza ---- */

    [Fact]
    public void Il_riassunto_del_ripristino_riporta_conteggi_e_segnalazioni()
    {
        var backup = BackupPromo.LeggiTracciati(BackupPromo.CreaTracciati(44, "x", new[] { Record(1, "A"), Record(2, "B"), Record(5, "E", idTracciato: 99) }, Adesso));
        var correnti = new[] { Record(1, "A"), Record(2, "B", "{}"), Record(3, "C"), Record(4, "D") };
        var piano = BackupPromo.PianificaRipristinoTracciati(backup, correnti, new Dictionary<long, string> { [4] = BackupPromo.MOTIVO_IMPAGINATO }, Tracciati);

        var risposta = new RipristinoPromoRisposta();
        risposta.Riporta(piano);

        Assert.Equal(1, risposta.aggiornati);
        Assert.Equal(0, risposta.inseriti);
        Assert.Equal(1, risposta.rimossi);
        Assert.Equal(1, risposta.invariati);
        Assert.Equal(4, Assert.Single(risposta.nonRimovibili).id);
        Assert.Equal(5, Assert.Single(risposta.nonInseribili).id);
    }

    [Fact]
    public void La_sequenza_si_riallinea_sul_massimo_della_tabella()
    {
        var sql = BackupPromo.SqlRiallineaSequenza(BackupPromo.TABELLA_TRACCIATI_RECORDS);

        Assert.Contains("pg_get_serial_sequence('promo_tracciati_records', 'id')", sql);
        Assert.Contains("MAX(id)", sql);
        Assert.Contains("FROM promo_tracciati_records", sql);
    }

    [Fact]
    public void Il_tipo_sconosciuto_si_descrive_senza_fermarsi()
    {
        Assert.Equal("Record dei tracciati", BackupPromo.DescriviTipo(1));
        Assert.Equal("Record delle lavorazioni", BackupPromo.DescriviTipo(2));
        Assert.Equal("Tipo sconosciuto (9)", BackupPromo.DescriviTipo(9));
    }
}
