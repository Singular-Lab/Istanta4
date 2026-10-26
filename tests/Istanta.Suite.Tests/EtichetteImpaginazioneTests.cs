using Newtonsoft.Json.Linq;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1048: l'impaginazione esauriva la memoria del server.
///
/// I record del kit restano in cache tra un'impaginazione e l'altra, e ImpaginaFromInDesignNew
/// aggiungeva la lista delle etichette del record a se stessa: le etichette raddoppiavano a ogni
/// chiamata, finche' trasformare la lista in JSON per ordinarla non trovava piu' memoria. Qui si
/// fissa che unire le etichette non raddoppi mai, e che la lettura delle descrizioni del gruppo,
/// alleggerita nello stesso task, restituisca gli stessi valori di prima.
/// </summary>
public class EtichetteImpaginazioneTests
{
    [Fact]
    public void Le_etichette_si_uniscono_senza_doppioni_nell_ordine()
    {
        var unite = Istanta.Utility.Main.unisciEtichette(
            new List<string> { "PROMO", "NOVITA" },
            new List<string> { "NOVITA", "BIO", "PROMO" });

        Assert.Equal(new[] { "PROMO", "NOVITA", "BIO" }, unite);
    }

    // Il caso del difetto: dopo la prima impaginazione le due liste sono lo stesso oggetto.
    [Fact]
    public void La_stessa_lista_passata_due_volte_non_raddoppia()
    {
        var etichette = new List<string> { "PROMO", "BIO" };

        var unite = Istanta.Utility.Main.unisciEtichette(etichette, etichette);

        Assert.Equal(new[] { "PROMO", "BIO" }, unite);
        Assert.Equal(2, etichette.Count);
    }

    // Ripete quello che fa ImpaginaFromInDesignNew su un record rimasto in cache.
    [Fact]
    public void Impaginazioni_ripetute_lasciano_le_etichette_invariate()
    {
        List<string> allEtichette = new List<string>();
        var recordInTracciato = new Dictionary<string, object>
        {
            ["allEtichette"] = new List<string> { "PROMO", "BIO" }
        };

        for (int impaginazione = 0; impaginazione < 25; impaginazione++)
        {
            recordInTracciato.TryGetValue("allEtichette", out object? etichetteRecord);
            allEtichette = Istanta.Utility.Main.unisciEtichette(allEtichette, etichetteRecord as List<string>);
            recordInTracciato["allEtichette"] = allEtichette;
        }

        Assert.Equal(new[] { "PROMO", "BIO" }, allEtichette);
        Assert.Same(allEtichette, recordInTracciato["allEtichette"]);
    }

    [Fact]
    public void Una_lista_gia_gonfiata_torna_pulita()
    {
        var gonfiata = Enumerable.Repeat(new[] { "PROMO", "BIO" }, 1024).SelectMany(e => e).ToList();

        Assert.Equal(new[] { "PROMO", "BIO" }, Istanta.Utility.Main.unisciEtichette(gonfiata, gonfiata));
    }

    // Come il GroupBy di prima: maiuscole e minuscole contano.
    [Fact]
    public void Etichette_che_differiscono_per_le_maiuscole_restano_distinte()
    {
        Assert.Equal(new[] { "Bio", "BIO" }, Istanta.Utility.Main.unisciEtichette(new List<string> { "Bio" }, new List<string> { "BIO" }));
    }

    [Fact]
    public void Le_liste_mancanti_sono_tollerate()
    {
        Assert.Empty(Istanta.Utility.Main.unisciEtichette(null, null));
        Assert.Equal(new[] { "BIO" }, Istanta.Utility.Main.unisciEtichette(null, new List<string> { "BIO" }));
        Assert.Equal(new[] { "BIO" }, Istanta.Utility.Main.unisciEtichette(new List<string> { "BIO" }, null));
    }

    [Fact]
    public void Il_risultato_e_sempre_una_lista_nuova()
    {
        var giaRaccolte = new List<string> { "PROMO" };
        var delRecord = new List<string> { "BIO" };

        var unite = Istanta.Utility.Main.unisciEtichette(giaRaccolte, delRecord);

        Assert.NotSame(giaRaccolte, unite);
        Assert.NotSame(delRecord, unite);
        Assert.Equal(new[] { "PROMO" }, giaRaccolte);
        Assert.Equal(new[] { "BIO" }, delRecord);
    }

    /* ---- descrizione_gruppo ---- */

    private static JObject DescrizioneGruppo() => JObject.Parse(@"{
        ""Descrizioni.Descrizione1"": ""Tortellini al prosciutto"",
        ""Descrizioni.Descrizione2"": 250,
        ""Descrizioni.Descrizione3"": null,
        ""Descrizioni.Descrizione4"": ""2026-10-05T12:00:00""
    }");

    [Theory]
    [InlineData("Descrizioni.Descrizione1")]
    [InlineData("Descrizioni.Descrizione2")]
    [InlineData("Descrizioni.Descrizione3")]
    [InlineData("Descrizioni.Descrizione4")]
    public void La_descrizione_letta_e_la_stessa_della_vecchia_conversione(string chiave)
    {
        var descrizione = DescrizioneGruppo();
        //Com'era: tutto descrizione_gruppo convertito in dizionario, poi la chiave.
        bool trovataPrima = descrizione.ToObject<Dictionary<string, object>>()!.TryGetValue(chiave, out object? valorePrima);

        bool trovata = Istanta.Utility.Main.leggiCampoDescrizioneGruppo(descrizione, chiave, out object? valore);

        Assert.Equal(trovataPrima, trovata);
        Assert.Equal(valorePrima, valore);
        Assert.Equal(valorePrima?.GetType(), valore?.GetType());
    }

    [Fact]
    public void Una_chiave_assente_non_si_trova()
    {
        Assert.False(Istanta.Utility.Main.leggiCampoDescrizioneGruppo(DescrizioneGruppo(), "Descrizioni.Descrizione5", out object? valore));
        Assert.Null(valore);
    }

    [Fact]
    public void Una_descrizione_che_non_e_un_oggetto_json_non_ha_chiavi()
    {
        Assert.False(Istanta.Utility.Main.leggiCampoDescrizioneGruppo(null, "Descrizioni.Descrizione1", out _));
        Assert.False(Istanta.Utility.Main.leggiCampoDescrizioneGruppo("testo", "Descrizioni.Descrizione1", out _));
    }
}
