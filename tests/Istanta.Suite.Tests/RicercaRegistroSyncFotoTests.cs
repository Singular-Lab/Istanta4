using Istanta.Models;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1214: nel registro delle sincronizzazioni il Nome non filtrava niente. Il server cercava solo
/// per date e la pagina mandava il nome come nomeCartella, mentre la richiesta lo aspetta come nome.
/// Ora una sincronizzazione resta se la sua cartella contiene il testo scritto, senza distinguere le
/// maiuscole; un Nome vuoto le tiene tutte.
/// </summary>
public class RicercaRegistroSyncFotoTests
{
    private static RicercaRegitroRequest Cerca(string nome) => new() { nome = nome };

    [Fact]
    public void Links2_trova_solo_la_cartella_Links2()
    {
        var req = Cerca("links2");

        Assert.True(req.CartellaCorrisponde("Links2"));
        Assert.False(req.CartellaCorrisponde("Links"));
    }

    [Fact]
    public void Il_nome_e_contenuto_nella_cartella_senza_badare_alle_maiuscole()
    {
        var req = Cerca("LINKS");

        Assert.True(req.CartellaCorrisponde("Links"));
        Assert.True(req.CartellaCorrisponde("Links2"));
        Assert.False(req.CartellaCorrisponde("Loghi"));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Un_nome_vuoto_non_restringe_la_ricerca(string nome)
    {
        var req = Cerca(nome);

        Assert.True(req.CartellaCorrisponde("Links"));
        Assert.True(req.CartellaCorrisponde(null));
    }

    [Fact]
    public void Gli_spazi_ai_bordi_del_nome_non_contano()
    {
        Assert.True(Cerca(" links2 ").CartellaCorrisponde("Links2"));
    }

    [Fact]
    public void Una_sincronizzazione_senza_cartella_non_corrisponde_a_un_nome()
    {
        Assert.False(Cerca("links").CartellaCorrisponde(null));
    }

    [Fact]
    public void Il_controller_filtra_per_nome_e_la_pagina_lo_manda_come_nome()
    {
        var controller = File.ReadAllText(DllAgenziaLibTests.TrovaFile("Istanta/Controllers/SyncFotoController.cs"));
        var pagina = File.ReadAllText(DllAgenziaLibTests.TrovaFile("Istanta/Views/SyncFoto/Registro.cshtml"));

        Assert.Contains("result.list = result.list.Where(r => req.CartellaCorrisponde(r.Meta?.dir)).ToList();", controller);
        Assert.Contains("nome: nomeCartella,", pagina);
        Assert.DoesNotContain("nomeCartella: nomeCartella", pagina);
    }
}
