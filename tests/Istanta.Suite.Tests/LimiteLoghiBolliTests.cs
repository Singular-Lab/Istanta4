using System.Reflection;
using System.Text.RegularExpressions;
using Istanta.Controllers;
using Istanta.Handlers;
using Istanta.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.AspNetCore.Routing;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// TASK-8d8f5604: limite esplicito di 50 MB per i file di LoghiBolli/salva. Prima valeva, in
/// Release, quello predefinito di Kestrel (30.000.000 byte) e la pagina riceveva un errore senza
/// motivo. Ora il filtro fissa il limite della richiesta e respinge con 413 JSON quella che lo
/// supera; il file appena oltre i 50 MB lo ferma l'azione, con lo stesso codice.
/// </summary>
public class LimiteLoghiBolliTests
{
    private const long MB = 1024 * 1024;

    [Fact]
    public void Il_limite_del_file_e_50_MB()
    {
        Assert.Equal(52_428_800L, LimiteLoghiBolli.DimensioneMassimaFileByte);
        Assert.True(LimiteLoghiBolli.DimensioneMassimaRichiestaByte > LimiteLoghiBolli.DimensioneMassimaFileByte);
    }

    [Fact]
    public void Fino_a_50_MB_il_file_non_supera_il_limite()
    {
        Assert.False(LimiteLoghiBolli.Supera(40 * MB));
        Assert.False(LimiteLoghiBolli.Supera(LimiteLoghiBolli.DimensioneMassimaFileByte));
        Assert.True(LimiteLoghiBolli.Supera(LimiteLoghiBolli.DimensioneMassimaFileByte + 1));
    }

    [Fact]
    public void Il_messaggio_dice_nome_peso_e_limite()
    {
        string messaggio = LimiteLoghiBolli.Messaggio("enorme.psd", (long)(63.2 * MB));

        Assert.Equal("Il file \"enorme.psd\" pesa 63,2 MB: il limite per loghi e bolli e' 50 MB.", messaggio);
    }

    [Fact]
    public void Il_rifiuto_porta_esito_negativo_codice_e_limite()
    {
        LogoBolloOperationResult rifiuto = LimiteLoghiBolli.Rifiuto("msg");

        Assert.False(rifiuto.esito);
        Assert.Equal("msg", rifiuto.error);
        Assert.Equal("FILE_TROPPO_GRANDE", rifiuto.codice);
        Assert.Equal(LimiteLoghiBolli.DimensioneMassimaFileByte, rifiuto.limiteByte);
        Assert.Null(rifiuto.item);
    }

    [Fact]
    public void Una_risposta_riuscita_non_ha_codice_ne_limite()
    {
        var riuscita = new LogoBolloOperationResult { esito = true };

        Assert.Null(riuscita.codice);
        Assert.Null(riuscita.limiteByte);
    }

    [Fact]
    public void Il_filtro_respinge_con_413_JSON_la_richiesta_oltre_il_limite()
    {
        long dichiarato = LimiteLoghiBolli.DimensioneMassimaRichiestaByte + 1;
        var (contesto, limite) = Contesto(dichiarato);

        new LimiteLoghiBolliAttribute().OnResourceExecuting(contesto);

        var risultato = Assert.IsType<ObjectResult>(contesto.Result);
        Assert.Equal(StatusCodes.Status413PayloadTooLarge, risultato.StatusCode);
        var corpo = Assert.IsType<LogoBolloOperationResult>(risultato.Value);
        Assert.False(corpo.esito);
        Assert.Equal("FILE_TROPPO_GRANDE", corpo.codice);
        Assert.Equal(LimiteLoghiBolli.DimensioneMassimaFileByte, corpo.limiteByte);
        Assert.Contains("50 MB", corpo.error);
        Assert.Equal(LimiteLoghiBolli.DimensioneMassimaRichiestaByte, limite.MaxRequestBodySize);
    }

    [Fact]
    public void Il_filtro_lascia_passare_la_richiesta_entro_il_limite_e_ne_fissa_il_limite()
    {
        var (contesto, limite) = Contesto(40 * MB);

        new LimiteLoghiBolliAttribute().OnResourceExecuting(contesto);

        Assert.Null(contesto.Result);
        // Al posto dei 30.000.000 byte predefiniti di Kestrel.
        Assert.Equal(LimiteLoghiBolli.DimensioneMassimaRichiestaByte, limite.MaxRequestBodySize);
    }

    [Fact]
    public void Il_filtro_lascia_passare_la_richiesta_senza_Content_Length()
    {
        var (contesto, limite) = Contesto(null);

        new LimiteLoghiBolliAttribute().OnResourceExecuting(contesto);

        Assert.Null(contesto.Result);
        Assert.Equal(LimiteLoghiBolli.DimensioneMassimaRichiestaByte, limite.MaxRequestBodySize);
    }

    [Fact]
    public void LoghiBolli_salva_ha_il_filtro_del_limite()
    {
        MethodInfo? azione = typeof(SyncFotoController).GetMethod("salvaLogoBollo");

        Assert.NotNull(azione);
        Assert.NotNull(azione!.GetCustomAttribute<LimiteLoghiBolliAttribute>());
    }

    // La pagina ferma il file prima di inviarlo: il suo limite deve essere lo stesso del server.
    [Fact]
    public void Il_limite_della_pagina_e_quello_del_server()
    {
        string js = File.ReadAllText(TrovaNelRepository("Istanta/wwwroot/js/loghibolli.js"));
        Match m = Regex.Match(js, @"static DIMENSIONE_MASSIMA_BYTE = (\d+) \* 1024 \* 1024;");

        Assert.True(m.Success, "DIMENSIONE_MASSIMA_BYTE non trovata in loghibolli.js");
        Assert.Equal(LimiteLoghiBolli.DimensioneMassimaFileByte, long.Parse(m.Groups[1].Value) * MB);
    }

    private static (ResourceExecutingContext, LimiteRichiestaFinto) Contesto(long? contentLength)
    {
        var http = new DefaultHttpContext();
        http.Request.ContentLength = contentLength;
        var limite = new LimiteRichiestaFinto();
        http.Features.Set<IHttpMaxRequestBodySizeFeature>(limite);

        var azione = new ActionContext(http, new RouteData(), new ActionDescriptor());
        return (new ResourceExecutingContext(azione, new List<IFilterMetadata>(), new List<IValueProviderFactory>()), limite);
    }

    private sealed class LimiteRichiestaFinto : IHttpMaxRequestBodySizeFeature
    {
        public bool IsReadOnly => false;
        public long? MaxRequestBodySize { get; set; } = 30_000_000;
    }

    private static string TrovaNelRepository(string relativo)
    {
        var cartella = new DirectoryInfo(AppContext.BaseDirectory);
        while (cartella != null)
        {
            var candidato = Path.Combine(cartella.FullName, relativo.Replace('/', Path.DirectorySeparatorChar));
            if (File.Exists(candidato))
            {
                return candidato;
            }
            cartella = cartella.Parent;
        }

        throw new FileNotFoundException(relativo + " non trovato risalendo da " + AppContext.BaseDirectory);
    }
}
