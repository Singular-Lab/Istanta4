using Istanta.Controllers;
using Istanta.Models;
using IstantaLib;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1212: il cliente carica nello stesso pacchetto di sync piu' foto dello stesso articolo, per
/// esempio il jpg di pre produzione e il psd post prodotto. Olimpo le restituisce nell'ordine dello
/// zip e il sync le registrava cosi', ognuna con la data di modifica del momento: in uscita andava
/// l'ultima dello zip, a volte il jpg e a volte il psd. Ora le foto si registrano tutte, le post
/// prodotte per ultime (con l'estensione configurata, qualunque sia, e .psd se non ce n'e'), le
/// altre nell'ordine dello zip, con date di modifica strettamente crescenti.
/// </summary>
public class SyncFotoMultipleTests
{
    private static FileOlympoSync Foto(string nome, string idRef = "0") =>
        new FileOlympoSync { Id = "g-" + nome, FileName = nome, FileHash = "h-" + nome, IdRef = idRef };

    private static string[] Nomi(IEnumerable<FileOlympoSync> foto) => foto.Select(f => f.FileName!).ToArray();

    [Fact]
    public void Psd_prima_del_jpg_nello_zip_il_psd_si_registra_per_ultimo()
    {
        var ordine = SyncFotoController.OrdineDiRegistrazione(
            new[] { Foto("6149843_1_T5.psd"), Foto("6149843_1_T5.jpg") }, new[] { ".psd" });

        Assert.Equal(new[] { "6149843_1_T5.jpg", "6149843_1_T5.psd" }, Nomi(ordine));
    }

    [Fact]
    public void Jpg_prima_del_psd_nello_zip_il_psd_resta_per_ultimo()
    {
        var ordine = SyncFotoController.OrdineDiRegistrazione(
            new[] { Foto("6149843_1_T5.jpg"), Foto("6149843_1_T5.psd") }, new[] { ".psd" });

        Assert.Equal(new[] { "6149843_1_T5.jpg", "6149843_1_T5.psd" }, Nomi(ordine));
    }

    [Fact]
    public void Senza_post_prodotte_resta_l_ordine_dello_zip()
    {
        var ordine = SyncFotoController.OrdineDiRegistrazione(
            new[] { Foto("6149843_2_T5.jpg"), Foto("6149843_1_T5.jpg") }, new[] { ".psd" });

        Assert.Equal(new[] { "6149843_2_T5.jpg", "6149843_1_T5.jpg" }, Nomi(ordine));
    }

    [Fact]
    public void L_estensione_si_confronta_senza_maiuscole()
    {
        var ordine = SyncFotoController.OrdineDiRegistrazione(
            new[] { Foto("6149843_1_T5.PSD"), Foto("6149843_1_T5.jpg") }, new[] { ".psd" });

        Assert.Equal(new[] { "6149843_1_T5.jpg", "6149843_1_T5.PSD" }, Nomi(ordine));
    }

    [Fact]
    public void Con_un_altra_estensione_configurata_vince_quella_e_non_il_psd()
    {
        var estensioni = SyncFotoController.EstensioniPostProduzione(new[] { ".tif" });
        var ordine = SyncFotoController.OrdineDiRegistrazione(
            new[] { Foto("6149843_1_T5.tif"), Foto("6149843_1_T5.psd") }, estensioni);

        Assert.Equal(new[] { ".tif" }, estensioni);
        Assert.Equal(new[] { "6149843_1_T5.psd", "6149843_1_T5.tif" }, Nomi(ordine));
    }

    [Fact]
    public void Senza_estensioni_configurate_vale_il_psd()
    {
        Assert.Equal(new[] { ".psd" }, SyncFotoController.EstensioniPostProduzione(null));
        Assert.Equal(new[] { ".psd" }, SyncFotoController.EstensioniPostProduzione(Array.Empty<string>()));
        Assert.Equal(new[] { ".psd" }, SyncFotoController.EstensioniPostProduzione(new[] { "", "  " }));

        var ordine = SyncFotoController.OrdineDiRegistrazione(
            new[] { Foto("6149843_1_T5.psd"), Foto("6149843_1_T5.jpg") }, SyncFotoController.EstensioniPostProduzione(Array.Empty<string>()));
        Assert.Equal(new[] { "6149843_1_T5.jpg", "6149843_1_T5.psd" }, Nomi(ordine));
    }

    [Fact]
    public void Un_estensione_configurata_senza_punto_vale_lo_stesso()
    {
        Assert.Equal(new[] { ".tif", ".psd" }, SyncFotoController.EstensioniPostProduzione(new[] { "tif", " .psd " }));
    }

    [Fact]
    public void Articoli_diversi_restano_indipendenti_e_ognuno_ha_il_suo_psd_per_ultimo()
    {
        //A e B mescolati nello zip: ogni psd viene dopo il jpg dello stesso articolo.
        var ordine = Nomi(SyncFotoController.OrdineDiRegistrazione(
            new[] { Foto("A_1.psd"), Foto("B_1.jpg"), Foto("A_1.jpg"), Foto("B_1.psd"), Foto("C_1.jpg") }, new[] { ".psd" }));

        Assert.Equal(new[] { "B_1.jpg", "A_1.jpg", "C_1.jpg", "A_1.psd", "B_1.psd" }, ordine);
        Assert.True(Array.IndexOf(ordine, "A_1.psd") > Array.IndexOf(ordine, "A_1.jpg"));
        Assert.True(Array.IndexOf(ordine, "B_1.psd") > Array.IndexOf(ordine, "B_1.jpg"));
    }

    [Fact]
    public void Le_date_di_registrazione_sono_strettamente_crescenti_al_microsecondo()
    {
        var inizio = new DateTime(2026, 11, 9, 14, 30, 0);

        var date = Enumerable.Range(0, 4).Select(i => SyncFotoController.OrarioDiRegistrazione(inizio, i)).ToArray();

        Assert.Equal(inizio, date[0]);
        for (int i = 1; i < date.Length; i++)
        {
            Assert.Equal(TimeSpan.FromTicks(10), date[i] - date[i - 1]);
        }
    }

    [Fact]
    public void Un_elenco_senza_foto_resta_vuoto_e_uno_nullo_e_un_errore()
    {
        Assert.Empty(SyncFotoController.OrdineDiRegistrazione(Array.Empty<FileOlympoSync>(), new[] { ".psd" }));
        Assert.Throws<ArgumentNullException>(() => SyncFotoController.OrdineDiRegistrazione(null!, new[] { ".psd" }));
    }
    /* ---- a sync finito, la foto che prevale per ogni articolo (ConsolidaSelezione) ---- */

    private static SyncFile File(string nome, StatoSyncFile stato, long idArticolo = 1633, long id = 0, TipoFoto tipo = TipoFoto.Foto) =>
        new SyncFile { filename = nome, stato = stato, idArticolo = idArticolo, id = id, tipo = tipo, md5 = "h-" + nome, zipDirOrigin = "pacchetto" };

    private static string[] Prevalenti(IEnumerable<SyncFile> files, params string[] estensioni) =>
        SyncFotoController.FotoCheDevonoPrevalere(files, SyncFotoController.EstensioniPostProduzione(estensioni)).Select(f => f.filename).ToArray();

    [Fact]
    public void Pacchetto_risincronizzato_prevale_il_psd_gia_selezionato()
    {
        //Il collaudo: jpeg e png riselezionati dal sync, il psd gia' selezionato e mai mandato dalla pagina.
        var files = new[]
        {
            File("1001297_1_AD.jpeg", StatoSyncFile.Synced, id: 6),
            File("1001297_1_T5.png", StatoSyncFile.Synced, id: 7),
            File("1001297_1_T5.psd", StatoSyncFile.AlreadyExist, id: 8)
        };

        Assert.Equal(new[] { "1001297_1_T5.psd" }, Prevalenti(files));
    }

    [Fact]
    public void Un_jpg_nuovo_accanto_al_psd_gia_selezionato_lascia_in_uscita_il_psd()
    {
        var files = new[]
        {
            File("6149843_1_T5.psd", StatoSyncFile.AlreadyExist, id: 8),
            File("6149843_1_T5.jpg", StatoSyncFile.Synced, id: 9)
        };

        Assert.Equal(new[] { "6149843_1_T5.psd" }, Prevalenti(files));
    }

    [Fact]
    public void Senza_sovrascrittura_il_psd_gia_in_archivio_e_non_selezionato_prevale_sul_jpg_nuovo()
    {
        //Regola confermata: il psd non si ricarica, si seleziona.
        var files = new[]
        {
            File("6149843_1_T5.psd", StatoSyncFile.AlreadyExistButNotSelected, id: 8),
            File("6149843_1_T5.jpg", StatoSyncFile.Synced, id: 9)
        };

        Assert.Equal(new[] { "6149843_1_T5.psd" }, Prevalenti(files));
    }

    [Fact]
    public void Un_articolo_senza_foto_registrate_non_si_tocca()
    {
        var files = new[]
        {
            File("6149843_1_T5.jpg", StatoSyncFile.AlreadyExistButNotSelected, id: 3),
            File("6149843_1_T5.psd", StatoSyncFile.AlreadyExist, id: 8)
        };

        Assert.Empty(Prevalenti(files));
    }

    [Fact]
    public void Una_foto_nuova_non_registrata_non_puo_prevalere()
    {
        //Il psd nuovo deselezionato dall'operatore non e' in archivio: prevale il jpg registrato.
        var files = new[]
        {
            File("6149843_1_T5.jpg", StatoSyncFile.Synced, id: 9),
            File("6149843_1_T5.psd", StatoSyncFile.SyncableAsNew)
        };

        Assert.Equal(new[] { "6149843_1_T5.jpg" }, Prevalenti(files));
    }

    [Fact]
    public void Pacchetto_di_30_foto_il_psd_in_testa_prevale_sul_jpg_in_coda()
    {
        //La pagina sincronizza a blocchi di 20: qui conta solo l'elenco intero.
        var files = new List<SyncFile> { File("6149843_1_T5.psd", StatoSyncFile.Synced, id: 1) };
        for (int i = 0; i < 28; i++)
        {
            files.Add(File($"altro_{i}.jpg", StatoSyncFile.Synced, idArticolo: 5000 + i, id: 100 + i));
        }
        files.Add(File("6149843_1_T5.jpg", StatoSyncFile.Synced, id: 2));

        var prevalenti = SyncFotoController.FotoCheDevonoPrevalere(files, new[] { ".psd" });

        Assert.Equal("6149843_1_T5.psd", prevalenti.Single(f => f.idArticolo == 1633).filename);
    }

    [Fact]
    public void Senza_post_prodotte_prevale_l_ultima_dello_zip()
    {
        var files = new[]
        {
            File("6149843_2_T5.jpg", StatoSyncFile.Synced, id: 4),
            File("6149843_1_T5.jpg", StatoSyncFile.AlreadyExist, id: 3)
        };

        Assert.Equal(new[] { "6149843_1_T5.jpg" }, Prevalenti(files));
    }

    [Fact]
    public void Vale_l_estensione_configurata_non_il_psd()
    {
        var files = new[]
        {
            File("6149843_1_T5.tif", StatoSyncFile.AlreadyExist, id: 4),
            File("6149843_1_T5.psd", StatoSyncFile.Synced, id: 5)
        };

        Assert.Equal(new[] { "6149843_1_T5.tif" }, Prevalenti(files, ".tif"));
    }

    [Fact]
    public void Articoli_diversi_e_loghi_non_si_influenzano()
    {
        var files = new[]
        {
            //A: psd gia' selezionato e un jpg registrato -> psd.
            File("A_1.psd", StatoSyncFile.AlreadyExist, idArticolo: 1, id: 10),
            File("A_1.jpg", StatoSyncFile.Synced, idArticolo: 1, id: 11),
            //B: solo un logo registrato -> l'articolo non si tocca.
            File("B_1.psd", StatoSyncFile.AlreadyExist, idArticolo: 2, id: 20),
            File("B_logo.ai", StatoSyncFile.Synced, idArticolo: 2, id: 21, tipo: TipoFoto.Logo),
            //Senza articolo -> niente.
            File("X_1.psd", StatoSyncFile.NoMatch, idArticolo: 0)
        };

        Assert.Equal(new[] { "A_1.psd" }, Prevalenti(files));
    }
}
