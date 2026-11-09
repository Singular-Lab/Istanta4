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
    /* ---- la foto che prevale, gia' selezionata, si riseleziona ---- */

    private static SyncFile File(string nome, StatoSyncFile stato, long idArticolo = 1633, long id = 0, TipoFoto tipo = TipoFoto.Foto) =>
        new SyncFile { filename = nome, stato = stato, idArticolo = idArticolo, id = id, tipo = tipo, md5 = "h-" + nome, zipDirOrigin = "pacchetto" };

    private static string[] Riselezionate(IEnumerable<SyncFile> files, bool overwrite, params string[] estensioni) =>
        SyncFotoController.DaRiselezionare(files, overwrite, SyncFotoController.EstensioniPostProduzione(estensioni)).Select(f => f.filename).ToArray();

    [Fact]
    public void Pacchetto_risincronizzato_il_psd_gia_selezionato_si_riseleziona_insieme_a_jpeg_e_png()
    {
        //Il collaudo: jpeg e png gia' in archivio e non selezionati, il psd gia' selezionato. Con la
        //sovrascrittura jpeg e png si riselezionano: senza riselezionare anche il psd vinceva il png.
        var files = new[]
        {
            File("1001297_1_AD.jpeg", StatoSyncFile.AlreadyExistButNotSelected, id: 6),
            File("1001297_1_T5.png", StatoSyncFile.AlreadyExistButNotSelected, id: 7),
            File("1001297_1_T5.psd", StatoSyncFile.AlreadyExist, id: 8)
        };

        Assert.Equal(new[] { "1001297_1_T5.psd" }, Riselezionate(files, true));
    }

    [Fact]
    public void Senza_sovrascrittura_non_si_riseleziona_niente_e_il_psd_resta_com_e()
    {
        var files = new[]
        {
            File("1001297_1_AD.jpeg", StatoSyncFile.AlreadyExistButNotSelected, id: 6),
            File("1001297_1_T5.png", StatoSyncFile.AlreadyExistButNotSelected, id: 7),
            File("1001297_1_T5.psd", StatoSyncFile.AlreadyExist, id: 8)
        };

        Assert.Empty(Riselezionate(files, false));
    }

    [Fact]
    public void Un_jpg_nuovo_accanto_al_psd_gia_in_archivio_riseleziona_il_psd()
    {
        //Il psd per primo nello zip: prevale comunque, perche' e' post prodotto.
        var files = new[]
        {
            File("6149843_1_T5.psd", StatoSyncFile.AlreadyExist, id: 8),
            File("6149843_1_T5.jpg", StatoSyncFile.SyncableAsNew)
        };

        Assert.Equal(new[] { "6149843_1_T5.psd" }, Riselezionate(files, false));
    }

    [Fact]
    public void Il_psd_da_solo_gia_selezionato_non_si_tocca()
    {
        Assert.Empty(Riselezionate(new[] { File("6149843_1_T5.psd", StatoSyncFile.AlreadyExist, id: 8) }, true));
    }

    [Fact]
    public void Se_a_prevalere_e_una_foto_che_si_registra_comunque_non_serve_riselezionare_niente()
    {
        //Il psd nuovo si registra, e l'ordine di registrazione lo mette dopo il jpg.
        var files = new[]
        {
            File("6149843_1_T5.jpg", StatoSyncFile.AlreadyExist, id: 3),
            File("6149843_1_T5.psd", StatoSyncFile.SyncableAsNew)
        };

        Assert.Empty(Riselezionate(files, true));
    }

    [Fact]
    public void Senza_post_prodotte_prevale_l_ultima_dello_zip()
    {
        var files = new[]
        {
            File("6149843_2_T5.jpg", StatoSyncFile.SyncableAsNew),
            File("6149843_1_T5.jpg", StatoSyncFile.AlreadyExist, id: 3)
        };

        Assert.Equal(new[] { "6149843_1_T5.jpg" }, Riselezionate(files, false));
    }

    [Fact]
    public void Vale_l_estensione_configurata_non_il_psd()
    {
        var files = new[]
        {
            File("6149843_1_T5.tif", StatoSyncFile.AlreadyExist, id: 4),
            File("6149843_1_T5.psd", StatoSyncFile.SyncableAsNew)
        };

        Assert.Equal(new[] { "6149843_1_T5.tif" }, Riselezionate(files, false, ".tif"));
    }

    [Fact]
    public void Articoli_diversi_e_loghi_non_si_influenzano()
    {
        var files = new[]
        {
            //A: psd gia' selezionato e un jpg nuovo -> si riseleziona.
            File("A_1.psd", StatoSyncFile.AlreadyExist, idArticolo: 1, id: 10),
            File("A_1.jpg", StatoSyncFile.SyncableAsNew, idArticolo: 1),
            //B: psd gia' selezionato, e solo un logo nuovo dello stesso articolo -> niente.
            File("B_1.psd", StatoSyncFile.AlreadyExist, idArticolo: 2, id: 20),
            File("B_logo.ai", StatoSyncFile.SyncableAsNew, idArticolo: 2, tipo: TipoFoto.Logo),
            //Senza articolo (nessuna corrispondenza) -> niente.
            File("X_1.psd", StatoSyncFile.NoMatch, idArticolo: 0)
        };

        Assert.Equal(new[] { "A_1.psd" }, Riselezionate(files, true));
    }
}
