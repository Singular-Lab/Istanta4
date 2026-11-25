using Correggo4.Data;
using Correggo4.Servizi;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Correggo4.Tests;

/// <summary>
/// I test di Correggo4 girano sul database in memoria, che esegue le query come LINQ sugli oggetti: passa
/// anche una query che PostgreSQL non puo' ricevere, perche' chiama un metodo C# che Npgsql non sa tradurre.
/// Cosi' e' arrivata in produzione la InvalidOperationException su Volantini/Dettaglio (I20-1268:
/// ServizioCorrezioni.Confermata dentro la query dello storico). Qui le query si traducono davvero con
/// Npgsql, con ToQueryString(), che non apre connessioni: l'indirizzo del database e' finto.
/// </summary>
public class QueryTraducibiliTests
{
    private static Correggo4Context Contesto() =>
        new(new DbContextOptionsBuilder<Correggo4Context>().UseNpgsql("Host=non-usato;Database=nessuno").Options);

    [Fact]
    public void Lo_storico_dei_box_si_traduce_in_SQL()
    {
        using var ctx = Contesto();

        string sql = ServizioStorico.ElementiConEditAvanzato(ctx, new List<int> { 1, 2 }).ToQueryString();

        Assert.Contains("volantini_pagine_elementi_versioni", sql);
        Assert.Contains("stato", sql);
    }

    [Fact]
    public void Le_correzioni_da_annullare_nella_revoca_si_traducono_in_SQL()
    {
        using var ctx = Contesto();

        string sql = ServizioPromo.EditAvanzatoDaAnnullare(ctx, new List<long> { 10, 20 }).ToQueryString();

        Assert.Contains("volantini_pagine_elementi_versioni", sql);
        Assert.Contains("stato", sql);
    }

    // Le correzioni vive sono le registrate e le confermate, qui o sul volantino pilota: le annullate no.
    [Fact]
    public void Gli_stati_vivi_sono_registrata_e_confermata()
    {
        Assert.Equal(
            new[] { ServizioCorrezioni.EaRegistrato, ServizioCorrezioni.EaCorretto, ServizioCorrezioni.EaConfermataDaApplicare },
            ServizioCorrezioni.StatiEaVivi.OrderBy(s => s));
        Assert.DoesNotContain(ServizioCorrezioni.EaAnnullato, ServizioCorrezioni.StatiEaVivi);
        Assert.All(ServizioCorrezioni.StatiEaVivi.Where(s => s != ServizioCorrezioni.EaRegistrato),
                   s => Assert.True(ServizioCorrezioni.Confermata(s)));
    }
}
