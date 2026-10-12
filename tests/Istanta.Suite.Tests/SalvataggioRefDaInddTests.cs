using Istanta.Models;
using Istanta.Utility;
using IstantaLib;
using Xunit;

namespace Istanta.Suite.Tests;

/// I20-1084: il log di Revisore/salvaRefFromIndd dice com'e' arrivata ogni descrizione.
///
/// Una correzione della descrizione dal Plugin e' arrivata al server solo al secondo salvataggio,
/// e il server non aveva scritto niente: non si poteva sapere se le descrizioni fossero partite
/// come "<untouched>", vuote o per niente. Ora il salvataggio scrive nel log un riassunto della
/// richiesta, con lo stato di ogni descrizione e senza i testi.
public class SalvataggioRefDaInddTests
{
    [Fact]
    public void Lo_stato_di_una_descrizione_distingue_non_mandata_non_toccata_vuota_e_testo()
    {
        Assert.Equal("null", SalvataggioRefDaIndd.StatoDescrizione(null));
        Assert.Equal("<untouched>", SalvataggioRefDaIndd.StatoDescrizione(SpecificitaDescrizione.NonToccato));
        Assert.Equal("vuota", SalvataggioRefDaIndd.StatoDescrizione(""));
        Assert.Equal("testo(16)", SalvataggioRefDaIndd.StatoDescrizione("INSALATA DI MARE"));
    }

    [Fact]
    public void Il_riassunto_dice_chi_dove_e_come_sono_arrivate_le_descrizioni_senza_i_testi()
    {
        var req = new RevisioneFromInddRequest
        {
            codice = "4860195",
            codice_gruppo = "4860195",
            idLavorazione = 812,
            area = "",
            canale = "SS",
            revisione = new RevisioneDescrizione
            {
                descrizione1 = "<untouched>",
                descrizione2 = "<untouched>",
                descrizione3 = "condita al limone",
                descrizione4 = null!
            },
            campi_offerta = new List<RevisioneCampiOffertaFromIndd> { new RevisioneCampiOffertaFromIndd(), new RevisioneCampiOffertaFromIndd() }
        };

        string riassunto = SalvataggioRefDaIndd.Riassunto(req);

        Assert.Equal("codice 4860195, gruppo 4860195, lavorazione 812, area -, canale SS, descrizione1 <untouched>, descrizione2 <untouched>, "
            + "descrizione3 testo(17), descrizione4 null, campi offerta 2", riassunto);
        Assert.DoesNotContain("limone", riassunto);
    }

    [Fact]
    public void Una_richiesta_senza_revisione_o_vuota_si_riassume_lo_stesso()
    {
        Assert.Equal("richiesta vuota", SalvataggioRefDaIndd.Riassunto(null));

        string riassunto = SalvataggioRefDaIndd.Riassunto(new RevisioneFromInddRequest { idLavorazione = 3 });
        Assert.Equal("codice -, gruppo -, lavorazione 3, area -, canale -, nessuna revisione, campi offerta 0", riassunto);
    }

    [Fact]
    public void Il_salvataggio_scrive_nel_log_ingresso_esito_ed_errore()
    {
        string sorgente = File.ReadAllText(Path.Combine(CartellaRepository(), "Istanta", "Controllers", "RevisoreController.cs")).Replace("\r", "");
        int inizio = sorgente.IndexOf("public async Task<IActionResult> salvaRefFromIndd(");
        int fine = sorgente.IndexOf("private string registraAttivitaRevisore(", inizio);
        string metodo = sorgente.Substring(inizio, fine - inizio);

        Assert.Contains("riassunto = Utility.SalvataggioRefDaIndd.Riassunto(req);", metodo);
        Assert.Contains("_logger.LogInformation(\"salvaRefFromIndd: {Richiesta}\", riassunto);", metodo);
        Assert.Contains("_logger.LogInformation(\"salvaRefFromIndd riuscito: {Richiesta}, descrizione {Descrizione}\"", metodo);
        Assert.Contains("_logger.LogError(ex, \"salvaRefFromIndd fallito: {Richiesta}\", riassunto);", metodo);
        //L'ingresso viene subito dopo la lettura della richiesta, prima di qualunque lavoro.
        Assert.True(metodo.IndexOf("_logger.LogInformation(\"salvaRefFromIndd: ") < metodo.IndexOf("this.ctx2.PromoLavorazioniRecords"));
    }

    private static string CartellaRepository()
    {
        var cartella = new DirectoryInfo(AppContext.BaseDirectory);
        while (cartella != null && !File.Exists(Path.Combine(cartella.FullName, "Istanta", "Istanta.csproj")))
        {
            cartella = cartella.Parent;
        }
        return cartella?.FullName ?? throw new InvalidOperationException("Cartella del repository non trovata");
    }
}
