using Istanta.Controllers;
using Istanta.Utility;
using IstantaLib;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// Pulizia notturna della cartella delle estrazioni di SyncFoto: si eliminano le voci di primo
/// livello create prima del periodo di conservazione, giudicate dalla loro data di creazione e mai
/// da quella delle foto contenute, che l'estrazione lascia all'originale. Un pacchetto eliminato,
/// riscaricato dal registro, risulta scaduto.
/// </summary>
public class PuliziaEstrazioniTests : IDisposable
{
    private static readonly DateTime Adesso = new DateTime(2026, 10, 14, 3, 0, 0, DateTimeKind.Utc);

    private readonly string cartella = Path.Combine(Path.GetTempPath(), "istanta-estrazioni-" + Guid.NewGuid().ToString("N"));

    public PuliziaEstrazioniTests() => Directory.CreateDirectory(cartella);

    public void Dispose()
    {
        try { Directory.Delete(cartella, true); } catch (IOException) { }
    }

    private string File(string nome, DateTime creato)
    {
        string percorso = Path.Combine(cartella, nome);
        System.IO.File.WriteAllText(percorso, "x");
        System.IO.File.SetCreationTimeUtc(percorso, creato);
        return percorso;
    }

    /// Una cartella di pacchetto estratto: le foto hanno la data originale, la cartella quella data.
    private string Pacchetto(string nome, DateTime creato, DateTime dataFoto)
    {
        string percorso = Path.Combine(cartella, nome);
        Directory.CreateDirectory(percorso);
        string foto = Path.Combine(percorso, "1234.jpg");
        System.IO.File.WriteAllText(foto, "foto");
        System.IO.File.SetCreationTimeUtc(foto, dataFoto);
        System.IO.File.SetLastWriteTimeUtc(foto, dataFoto);
        Directory.SetCreationTimeUtc(percorso, creato);
        return percorso;
    }

    private static DateTime Scadenza() => PuliziaEstrazioni.Scadenza(Adesso, PuliziaEstrazioni.MesiDefault);

    [Fact]
    public void Pacchetto_e_zip_piu_vecchi_di_un_mese_vengono_eliminati()
    {
        string vecchia = Pacchetto("01_09_2026_10_00_00_aaa", Adesso.AddDays(-40), Adesso.AddDays(-40));
        string zip = File("01_09_2026_10_00_00_aaa.zip", Adesso.AddDays(-40));
        string json = File("bbb.json", Adesso.AddDays(-40));

        var esito = PuliziaEstrazioni.Elimina(cartella, Scadenza());

        Assert.False(Directory.Exists(vecchia));
        Assert.False(System.IO.File.Exists(zip));
        Assert.False(System.IO.File.Exists(json));
        Assert.Equal(3, esito.Eliminate);
        Assert.Equal(0, esito.Errori);
    }

    [Fact]
    public void Un_pacchetto_di_ieri_con_foto_del_2019_resta()
    {
        string recente = Pacchetto("13_10_2026_18_00_00_ccc", Adesso.AddDays(-1), new DateTime(2019, 5, 2, 0, 0, 0, DateTimeKind.Utc));
        string zip = File("13_10_2026_18_00_00_ccc.zip", Adesso.AddDays(-1));

        var esito = PuliziaEstrazioni.Elimina(cartella, Scadenza());

        Assert.True(System.IO.File.Exists(Path.Combine(recente, "1234.jpg")));
        Assert.True(System.IO.File.Exists(zip));
        Assert.Equal(0, esito.Eliminate);
    }

    [Fact]
    public void Il_limite_e_un_mese_esatto_dalla_data_attuale()
    {
        DateTime unMeseFa = Adesso.AddMonths(-1);
        string alLimite = File("al_limite.zip", unMeseFa);
        string appenaPrima = File("appena_prima.zip", unMeseFa.AddMinutes(-1));

        PuliziaEstrazioni.Elimina(cartella, Scadenza());

        Assert.True(System.IO.File.Exists(alLimite));
        Assert.False(System.IO.File.Exists(appenaPrima));
    }

    [Fact]
    public void Con_piu_mesi_di_conservazione_resta_anche_il_pacchetto_di_40_giorni()
    {
        string zip = File("vecchio.zip", Adesso.AddDays(-40));

        PuliziaEstrazioni.Elimina(cartella, PuliziaEstrazioni.Scadenza(Adesso, 2));

        Assert.True(System.IO.File.Exists(zip));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Senza_cartella_configurata_non_elimina_nulla(string? percorso)
    {
        var esito = PuliziaEstrazioni.Elimina(percorso, Scadenza());

        Assert.Equal(0, esito.Eliminate);
        Assert.Equal(0, esito.Errori);
    }

    [Fact]
    public void Una_cartella_inesistente_non_e_un_errore()
    {
        var esito = PuliziaEstrazioni.Elimina(Path.Combine(cartella, "non-esiste"), Scadenza());

        Assert.Equal(0, esito.Eliminate);
        Assert.Equal(0, esito.Errori);
    }

    [Theory]
    [InlineData(null, 1)]
    [InlineData(0, 1)]
    [InlineData(-2, 1)]
    [InlineData(3, 3)]
    public void Mesi_di_conservazione_con_default_a_uno(int? configurati, int attesi)
    {
        Assert.Equal(attesi, PuliziaEstrazioni.Mesi(configurati));
    }

    [Theory]
    [InlineData(null, 3)]
    [InlineData(-1, 3)]
    [InlineData(24, 3)]
    [InlineData(0, 0)]
    [InlineData(23, 23)]
    public void Ora_della_pulizia_con_default_alle_tre(int? configurata, int attesa)
    {
        Assert.Equal(attesa, PuliziaEstrazioni.Ora(configurata));
    }

    [Fact]
    public void Prima_dell_ora_la_pulizia_e_oggi_dopo_e_domani()
    {
        var sera = new DateTime(2026, 10, 14, 22, 30, 0);
        var notte = new DateTime(2026, 10, 14, 1, 15, 0);
        var allOra = new DateTime(2026, 10, 14, 3, 0, 0);

        Assert.Equal(new DateTime(2026, 10, 15, 3, 0, 0), PuliziaEstrazioni.ProssimaEsecuzione(sera, 3));
        Assert.Equal(new DateTime(2026, 10, 14, 3, 0, 0), PuliziaEstrazioni.ProssimaEsecuzione(notte, 3));
        Assert.Equal(new DateTime(2026, 10, 15, 3, 0, 0), PuliziaEstrazioni.ProssimaEsecuzione(allOra, 3));
    }

    /* ---- riscaricamento dal registro ---- */

    private SyncFile Foto(string dir, string nome) => new SyncFile { zipDirOrigin = dir, filename = nome };

    [Fact]
    public void Un_pacchetto_eliminato_dalla_pulizia_risulta_scaduto()
    {
        string dir = Path.GetFileName(Pacchetto("01_09_2026_10_00_00_ddd", Adesso.AddDays(-40), Adesso.AddDays(-40)));
        var files = new List<SyncFile> { Foto(dir, "1234.jpg") };
        Assert.False(SyncFotoController.PacchettoScaduto(cartella, files));

        PuliziaEstrazioni.Elimina(cartella, Scadenza());

        Assert.True(SyncFotoController.PacchettoScaduto(cartella, files));
    }

    [Fact]
    public void Basta_un_file_mancante_perche_il_pacchetto_sia_scaduto()
    {
        string dir = Path.GetFileName(Pacchetto("13_10_2026_18_00_00_eee", Adesso.AddDays(-1), Adesso.AddDays(-1)));

        Assert.True(SyncFotoController.PacchettoScaduto(cartella, new List<SyncFile>
        {
            Foto(dir, "1234.jpg"),
            Foto("01_08_2026_10_00_00_eliminato", "5678.jpg")
        }));
    }

    [Fact]
    public void Senza_elenco_di_file_il_pacchetto_non_e_scaduto()
    {
        Assert.False(SyncFotoController.PacchettoScaduto(cartella, null));
    }

    [Fact]
    public void Il_codice_di_scaduto_e_quello_che_la_pagina_riconosce()
    {
        Assert.Equal("pacchetto_scaduto", SyncFotoController.CodicePacchettoScaduto);
    }
}
