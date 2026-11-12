using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Istanta.Models;
using Istanta.Utility;
using IstantaLib;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// Le foto della Scheda articolo aperte dal revisore, per una referenza o per un gruppo. Un gruppo non
/// ha un articolo suo: le sue foto extra sono righe ripetute su ogni articolo, con lo stesso GUID. Del
/// gruppo si mostrano quelle presenti su tutte le referenze, e collegare o attivare vale per tutte.
/// Attivare una foto extra cambia solo le righe delle referenze indicate, mai quelle di un altro
/// articolo con lo stesso logo.
/// </summary>
public class GestioneFotoTests
{
    private static string Sorgente(string relativo) =>
        File.ReadAllText(DllAgenziaLibTests.TrovaFile(relativo)).Replace("\r", "");

    private static ArticoliFoto Extra(long idArticolo, string guid, TipoFoto tipo = TipoFoto.Logo, bool attiva = true, string? nome = null) => new ArticoliFoto
    {
        Id = (int)(idArticolo * 100 + guid.GetHashCode() % 50),
        IdArticolo = idArticolo,
        GuidId = guid,
        NomeReale = nome ?? guid + ".ai",
        PathFoto = guid,
        Tipo = (byte)tipo,
        Attiva = attiva,
    };

    /* ---- codici ---- */

    [Fact]
    public void Un_codice_gruppo_si_divide_nelle_sue_referenze()
    {
        Assert.Equal(new[] { "123", "456" }, FotoExtraDiPiuArticoli.Codici(" 123, 456,,123 "));
        Assert.Empty(FotoExtraDiPiuArticoli.Codici(null));
        Assert.True(FotoExtraDiPiuArticoli.EGruppo("123,456"));
        Assert.False(FotoExtraDiPiuArticoli.EGruppo("6119227"));
    }

    /* ---- le foto extra di un gruppo ---- */

    [Fact]
    public void Del_gruppo_si_mostrano_solo_le_foto_extra_presenti_su_tutte_le_referenze()
    {
        var primo = new List<ArticoliFoto> { Extra(1, "LOGO_X"), Extra(1, "BIO"), Extra(1, "SOLO_PRIMO") };
        var secondo = new List<ArticoliFoto> { Extra(2, "BIO"), Extra(2, "LOGO_X") };
        var terzo = new List<ArticoliFoto> { Extra(3, "LOGO_X"), Extra(3, "BIO") };

        var comuni = FotoExtraDiPiuArticoli.ComuniAlGruppo(new List<IEnumerable<ArticoliFoto>?> { primo, secondo, terzo });

        Assert.Equal(new[] { "LOGO_X", "BIO" }, comuni.Select(f => f.GuidId).ToArray());
    }

    [Fact]
    public void Una_foto_extra_su_due_referenze_su_tre_non_e_del_gruppo()
    {
        var comuni = FotoExtraDiPiuArticoli.ComuniAlGruppo(new List<IEnumerable<ArticoliFoto>?>
        {
            new List<ArticoliFoto> { Extra(1, "LOGO_X") },
            new List<ArticoliFoto> { Extra(2, "LOGO_X") },
            new List<ArticoliFoto>(),
        });

        Assert.Empty(comuni);
    }

    [Fact]
    public void Una_referenza_non_in_archivio_non_ha_foto_extra_in_comune()
    {
        var comuni = FotoExtraDiPiuArticoli.ComuniAlGruppo(new List<IEnumerable<ArticoliFoto>?>
        {
            new List<ArticoliFoto> { Extra(1, "LOGO_X") },
            null,
        });

        Assert.Empty(comuni);
    }

    [Fact]
    public void Del_gruppo_una_foto_extra_e_attiva_solo_se_lo_e_su_tutte_le_referenze()
    {
        var primo = new List<ArticoliFoto> { Extra(1, "LOGO_X"), Extra(1, "BIO") };
        var secondo = new List<ArticoliFoto> { Extra(2, "LOGO_X", attiva: false), Extra(2, "BIO") };

        var comuni = FotoExtraDiPiuArticoli.ComuniAlGruppo(new List<IEnumerable<ArticoliFoto>?> { primo, secondo });

        Assert.False(comuni.Single(f => f.GuidId == "LOGO_X").Attiva);
        Assert.True(comuni.Single(f => f.GuidId == "BIO").Attiva);
        //Le righe lette dal database non si toccano.
        Assert.True(primo[0].Attiva);
    }

    [Fact]
    public void Le_foto_del_prodotto_non_sono_foto_extra_del_gruppo()
    {
        var comuni = FotoExtraDiPiuArticoli.ComuniAlGruppo(new List<IEnumerable<ArticoliFoto>?>
        {
            new List<ArticoliFoto> { Extra(1, "FOTO", TipoFoto.Foto) },
            new List<ArticoliFoto> { Extra(2, "FOTO", TipoFoto.Foto) },
        });

        Assert.Empty(comuni);
    }

    [Fact]
    public void Di_una_referenza_le_foto_extra_sono_una_per_nome_come_prima()
    {
        var extra = FotoExtraDiPiuArticoli.DiUnArticolo(new[]
        {
            Extra(1, "G1", nome: "logo.ai"), Extra(1, "G2", nome: "logo.ai"), Extra(1, "G3", nome: "bio.psd"),
            Extra(1, "G4", TipoFoto.Foto, nome: "123_1.psd"),
        });

        Assert.Equal(new[] { "logo.ai", "bio.psd" }, extra.Select(f => f.NomeReale).ToArray());
    }

    /* ---- attivare una foto extra ---- */

    [Fact]
    public void Con_il_codice_si_attivano_solo_le_righe_delle_referenze_indicate()
    {
        var righe = new[] { Extra(1, "LOGO_X"), Extra(2, "LOGO_X"), Extra(3, "LOGO_X") };
        var codici = new Dictionary<long, string> { [1] = "AAA", [2] = "BBB", [3] = "CCC" };

        var daCambiare = FotoExtraDiPiuArticoli.DaAttivare(righe, f => codici[f.IdArticolo], "BBB,CCC");

        Assert.Equal(new long[] { 2, 3 }, daCambiare.Select(f => f.IdArticolo).ToArray());
    }

    [Fact]
    public void Lo_stesso_logo_su_un_altro_articolo_non_si_tocca()
    {
        //Prima il server cambiava la prima riga col GUID: qui quella dell'articolo A, chiedendo B.
        var righe = new[] { Extra(1, "LOGO_X"), Extra(2, "LOGO_X") };
        var codici = new Dictionary<long, string> { [1] = "A", [2] = "B" };

        var daCambiare = FotoExtraDiPiuArticoli.DaAttivare(righe, f => codici[f.IdArticolo], "B");

        Assert.Equal(2, Assert.Single(daCambiare).IdArticolo);
    }

    [Fact]
    public void Senza_codice_resta_il_comportamento_di_prima()
    {
        var righe = new[] { Extra(1, "LOGO_X"), Extra(2, "LOGO_X") };

        var daCambiare = FotoExtraDiPiuArticoli.DaAttivare(righe, f => null, null);

        Assert.Equal(1, Assert.Single(daCambiare).IdArticolo);
        Assert.Empty(FotoExtraDiPiuArticoli.DaAttivare(Array.Empty<ArticoliFoto>(), f => null, null));
    }

    /* ---- chi le usa ---- */

    [Fact]
    public void Il_server_attiva_per_codice_e_collega_su_tutte_le_referenze_del_gruppo()
    {
        var sync = Sorgente("Istanta/Controllers/SyncFotoController.cs");

        Assert.Contains("public async Task<IActionResult> attivaDisattivaFotoExtra(string guidId, bool attiva, [FromQuery] string? codice = null)", sync);
        Assert.Contains("FotoExtraDiPiuArticoli.DaAttivare(righeDelGuid, f => f.IdArticoloNavigation?.Codice, codice);", sync);

        int inizio = sync.IndexOf("public async Task<IActionResult> linkLogoBollo(", StringComparison.Ordinal);
        string link = sync.Substring(inizio, sync.IndexOf("[Route(\"SyncFoto/RimuoviFotoDaMeta", inizio, StringComparison.Ordinal) - inizio);
        Assert.Contains("var codici = FotoExtraDiPiuArticoli.Codici(codiceReferenza);", link);
        Assert.Contains("foreach (var articolo in articoli)", link);
        //Chi l'ha gia' resta com'e'; nessuna referenza da collegare e' l'errore di prima.
        Assert.Contains("continue;", link);
        Assert.Contains("throw new Exception(\"Immagine già associata al prodotto\");", link);
    }

    [Fact]
    public void La_sezione_del_gruppo_ha_le_foto_extra_comuni_e_segnala_le_referenze_non_in_archivio()
    {
        var controller = Sorgente("Istanta/Controllers/SchedaArticoloController.cs");

        Assert.Contains("sezione.Gruppo = codici.Count > 1;", controller);
        Assert.Contains("sezione.Extra = FotoExtraDiPiuArticoli.ComuniAlGruppo(", controller);
        Assert.Contains("sezione.CodiciSenzaArticolo = codici.Where((c, i) => inOrdine[i] == null).ToList();", controller);
        Assert.Contains("sezione.Extra = FotoExtraDiPiuArticoli.DiUnArticolo(articolo.ArticoliFotos);", controller);
    }
}
