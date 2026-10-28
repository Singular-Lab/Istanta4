using Istanta.Utility;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// Le date di inserimento e modifica delle foto nella pagina Archivio: le scrive DateFoto, per la
/// pagina e per la risposta di Archivio/caricaFotoManuale. Una data mancante o prima del 2000 non si
/// mostra; la modifica uguale all'inserimento nemmeno.
/// </summary>
public class DateFotoTests
{
    [Fact]
    public void La_data_si_scrive_giorno_mese_anno_ore_e_minuti()
    {
        Assert.Equal("05/03/2026 09:07", DateFoto.Data(new DateTime(2026, 3, 5, 9, 7, 42)));
    }

    [Fact]
    public void Una_data_mancante_o_non_plausibile_non_si_scrive()
    {
        Assert.Equal("", DateFoto.Data(null));
        Assert.Equal("", DateFoto.Data(DateTime.MinValue));
        Assert.Equal("", DateFoto.Data(new DateTime(1999, 12, 31)));
    }

    [Fact]
    public void Inserimento_e_modifica_insieme_quando_sono_diverse()
    {
        Assert.Equal("Inserita il 12/10/2026 14:32 · Modificata il 20/10/2026 09:15",
            DateFoto.Testo(new DateTime(2026, 10, 12, 14, 32, 0), new DateTime(2026, 10, 20, 9, 15, 0)));
    }

    [Fact]
    public void Una_modifica_uguale_all_inserimento_o_mancante_non_si_ripete()
    {
        var data = new DateTime(2026, 10, 12, 14, 32, 10);
        Assert.Equal("Inserita il 12/10/2026 14:32", DateFoto.Testo(data, data.AddSeconds(20)));
        Assert.Equal("Inserita il 12/10/2026 14:32", DateFoto.Testo(data, null));
        Assert.Equal("Modificata il 20/10/2026 09:15", DateFoto.Testo(DateTime.MinValue, new DateTime(2026, 10, 20, 9, 15, 0)));
        Assert.Equal("", DateFoto.Testo(DateTime.MinValue, null));
    }

    [Fact]
    public void Il_suggerimento_della_lista_ha_il_nome_e_a_capo_le_date()
    {
        Assert.Equal("123.psd\nInserita il 12/10/2026 14:32", DateFoto.Suggerimento("123.psd", new DateTime(2026, 10, 12, 14, 32, 0), null));
        Assert.Equal("123.psd", DateFoto.Suggerimento("123.psd", DateTime.MinValue, null));
    }

    [Fact]
    public void La_pagina_Archivio_e_il_caricamento_usano_le_stesse_date()
    {
        string vista = Sorgente("Istanta/Views/Archivio/Index.cshtml");
        Assert.Contains("Istanta.Utility.DateFoto.Testo(fotoTabNaz.DataInserimento, fotoTabNaz.DataModifica)", vista);
        Assert.Contains("Istanta.Utility.DateFoto.Testo(fotoTabScope.DataInserimento, fotoTabScope.DataModifica)", vista);
        Assert.Contains("Istanta.Utility.DateFoto.Suggerimento(fotoPrimaria!.NomeReale, fotoPrimaria.DataInserimento, fotoPrimaria.DataModifica)", vista);

        string controller = Sorgente("Istanta/Controllers/ArchivioController.cs");
        Assert.Contains("date = Istanta.Utility.DateFoto.Testo(nuovaFoto.DataInserimento, nuovaFoto.DataModifica),", controller);
    }

    [Fact]
    public void La_scheda_articolo_mostra_le_date_di_primaria_altre_foto_e_foto_extra()
    {
        string vista = Sorgente("Istanta/Views/SchedaArticolo/Index.cshtml");
        Assert.Contains("Istanta.Utility.DateFoto.Testo(fotoPrimaria.DataInserimento, fotoPrimaria.DataModifica)", vista);
        //Altre foto e foto extra: la stessa riga per ogni foto dei due elenchi.
        int volte = vista.Split("Istanta.Utility.DateFoto.Testo(foto.DataInserimento, foto.DataModifica)").Length - 1;
        Assert.Equal(2, volte);
    }

    private static string Sorgente(string relativo)
    {
        var cartella = new DirectoryInfo(AppContext.BaseDirectory);
        while (cartella != null)
        {
            var candidato = Path.Combine(cartella.FullName, relativo.Replace('/', Path.DirectorySeparatorChar));
            if (File.Exists(candidato))
            {
                return File.ReadAllText(candidato);
            }
            cartella = cartella.Parent;
        }
        throw new FileNotFoundException(relativo + " non trovato risalendo da " + AppContext.BaseDirectory);
    }
}
