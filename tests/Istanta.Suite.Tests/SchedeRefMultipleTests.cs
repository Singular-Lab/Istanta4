using Istanta.Controllers;
using Istanta.Models;
using IstantaLib;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1063: con piu' box selezionati il Plugin scarica le schede con Menabo/getSchedeRefs, e da
/// ciascuna capisce se il box e' impaginato o da ricollegare. Lo capisce da errorCode
/// (CodArticoloNonTrovato, 8), come per un box solo con getSchedaRef: getSchedeRefs teneva il
/// messaggio di una scheda non riuscita e perdeva il codice. Qui si chiama la parte che compone il
/// risultato di ogni gruppo; il controller intero vuole il database, che i test non usano.
/// </summary>
public class SchedeRefMultipleTests
{
    [Fact]
    public void Una_scheda_riuscita_resta_quella_di_getSchedaRef()
    {
        var scheda = new ArticoloInRevisioneKitResult { esito = true, records = new List<ArticoloInKit> { new ArticoloInKit() } };

        var risultato = MenaboController.RisultatoDellaSchedaNelMassivo("123", new OkObjectResult(scheda));

        Assert.Same(scheda, risultato);
    }

    [Fact]
    public void Un_box_da_ricollegare_tiene_il_codice_di_errore()
    {
        var scheda = new ArticoloInRevisioneKitResult
        {
            esito = false,
            error = "Articolo non trovato",
            dettaglio = "traccia",
            errorCode = (int)ErrorCodes.CodArticoloNonTrovato
        };

        var risultato = MenaboController.RisultatoDellaSchedaNelMassivo("123", new OkObjectResult(scheda));

        Assert.False(risultato.esito);
        Assert.Equal(8, risultato.errorCode);
        Assert.Equal("Articolo non trovato", risultato.error);
        Assert.Equal("traccia", risultato.dettaglio);
        Assert.Empty(risultato.records);
        Assert.Contains("123", risultato.warn);
    }

    [Fact]
    public void Un_errore_senza_scheda_non_ha_codice()
    {
        var daTesto = MenaboController.RisultatoDellaSchedaNelMassivo("123", new OkObjectResult("sessione scaduta"));
        var sconosciuto = MenaboController.RisultatoDellaSchedaNelMassivo("123", new BadRequestResult());

        Assert.False(daTesto.esito);
        Assert.Equal("sessione scaduta", daTesto.error);
        Assert.Equal(0, daTesto.errorCode);
        Assert.False(sconosciuto.esito);
        Assert.Equal(0, sconosciuto.errorCode);
        Assert.NotEmpty(sconosciuto.error!);
    }
}
