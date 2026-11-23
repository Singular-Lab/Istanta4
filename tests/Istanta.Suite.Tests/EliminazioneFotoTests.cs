using Istanta.Models;
using Istanta.Utility;
using IstantaLib;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1253: l'eliminazione di una foto del prodotto dalla Scheda articolo. Non si elimina la
/// primaria selezionata della scheda, ne' la foto che il Plugin usa per la sua area e il suo canale;
/// la conferma avvisa se la foto e' stata selezionata meno di un mese fa. Le regole le calcola
/// EliminazioneFoto, per la vista e per SchedaArticolo/DeleteFoto; il controller vuole il database,
/// che i test non usano: per lui si controlla il sorgente.
/// </summary>
public class EliminazioneFotoTests
{
    private static readonly DateTime Adesso = new DateTime(2026, 11, 23, 10, 0, 0);

    private static ArticoliFoto Foto(int id, string nome, DateTime inserita, DateTime? modificata, bool? attiva = false,
        byte? stato = 0, string? area = null, string? canale = null, byte? tipo = (byte)TipoFoto.Foto)
    {
        return new ArticoliFoto
        {
            Id = id,
            IdArticolo = 1,
            NomeReale = nome,
            PathFoto = nome,
            GuidId = "g" + id,
            DataInserimento = inserita,
            DataModifica = modificata,
            Attiva = attiva,
            StatoSelezione = stato,
            Area = area,
            Canale = canale,
            Tipo = tipo
        };
    }

    /// La primaria della scheda (modificata per ultima), una foto caricata per errore oggi e
    /// archiviata senza selezionarla, e una vecchia primaria sostituita.
    private static List<ArticoliFoto> FotoDellArticolo(out ArticoliFoto primaria, out ArticoliFoto sbagliata, out ArticoliFoto vecchia)
    {
        primaria = Foto(1, "6934648_1_T5.psd", Adesso.AddDays(-12), Adesso.AddDays(-12), attiva: true, stato: 1);
        sbagliata = Foto(2, "6934648_sbagliata.jpg", Adesso.AddHours(-1), Adesso.AddHours(-1), attiva: false, stato: 0);
        vecchia = Foto(3, "6934648_1_AD.jpg", Adesso.AddDays(-200), Adesso.AddDays(-150), attiva: true, stato: 1);
        //La caricata per errore e' piu' recente della primaria solo per DataInserimento, non per DataModifica:
        //la primaria della scheda e' quella con la DataModifica piu' recente.
        sbagliata.DataModifica = Adesso.AddDays(-20);
        sbagliata.DataInserimento = Adesso.AddDays(-20);
        return new List<ArticoliFoto> { primaria, sbagliata, vecchia };
    }

    /* ---- quali foto si eliminano ---- */

    [Fact]
    public void La_primaria_selezionata_non_si_elimina_e_una_foto_archiviata_si()
    {
        var foto = FotoDellArticolo(out var primaria, out var sbagliata, out var vecchia);

        Assert.Same(primaria, EliminazioneFoto.PrimariaDellaScheda(foto));
        Assert.True(EliminazioneFoto.InUso(primaria, foto));
        Assert.False(EliminazioneFoto.InUso(sbagliata, foto));
        //La vecchia primaria e' ancora attiva, ma nel suo ambito (generico) c'e' una foto piu' recente.
        Assert.False(EliminazioneFoto.InUso(vecchia, foto));
    }

    [Fact]
    public void La_foto_in_uso_per_la_sua_area_e_il_suo_canale_non_si_elimina()
    {
        var foto = FotoDellArticolo(out _, out _, out _);
        var regionale = Foto(4, "6934648_TO.psd", Adesso.AddDays(-90), Adesso.AddDays(-90), attiva: true, stato: 1, area: "TO", canale: "CN");
        var regionaleVecchia = Foto(5, "6934648_TO_old.psd", Adesso.AddDays(-300), Adesso.AddDays(-300), attiva: true, stato: 1, area: "TO", canale: "CN");
        foto.Add(regionale);
        foto.Add(regionaleVecchia);

        Assert.True(EliminazioneFoto.InUso(regionale, foto));
        Assert.False(EliminazioneFoto.InUso(regionaleVecchia, foto));
    }

    [Fact]
    public void Vuoto_e_asterisco_sono_lo_stesso_ambito()
    {
        var generica = Foto(1, "a.psd", Adesso.AddDays(-5), Adesso.AddDays(-5), attiva: true, area: "*", canale: "");
        var primaria = Foto(2, "b.psd", Adesso.AddDays(-1), Adesso.AddDays(-1), attiva: true);
        var foto = new List<ArticoliFoto> { generica, primaria };

        //Nello stesso ambito generico la piu' recente e' la primaria: la generica con "*" non e' in uso.
        Assert.False(EliminazioneFoto.InUso(generica, foto));
    }

    [Fact]
    public void Le_foto_extra_non_sono_foto_del_prodotto_e_non_contano_per_la_primaria()
    {
        var primaria = Foto(1, "a.psd", Adesso.AddDays(-5), Adesso.AddDays(-5), attiva: true);
        var logo = Foto(2, "logo.ai", Adesso, Adesso, attiva: true, tipo: (byte)TipoFoto.Logo);
        var foto = new List<ArticoliFoto> { primaria, logo };

        Assert.False(EliminazioneFoto.EFotoDelProdotto(logo));
        Assert.True(EliminazioneFoto.EFotoDelProdotto(Foto(3, "c.psd", Adesso, Adesso, tipo: null)));
        Assert.Same(primaria, EliminazioneFoto.PrimariaDellaScheda(foto));
    }

    /* ---- l'avviso del mese ---- */

    [Fact]
    public void Selezionata_dieci_giorni_fa_avvisa_quaranta_giorni_fa_no()
    {
        var dieciGiorni = Foto(1, "a.psd", Adesso.AddDays(-60), Adesso.AddDays(-10), attiva: false, stato: 0);
        var quarantaGiorni = Foto(2, "b.psd", Adesso.AddDays(-60), Adesso.AddDays(-40), attiva: true, stato: 1);

        Assert.True(EliminazioneFoto.SelezionataDiRecente(dieciGiorni, Adesso));
        Assert.False(EliminazioneFoto.SelezionataDiRecente(quarantaGiorni, Adesso));
    }

    [Fact]
    public void Una_foto_appena_archiviata_senza_selezionarla_non_avvisa()
    {
        var inserita = Adesso.AddDays(-2);
        var archiviata = Foto(1, "sbagliata.jpg", inserita, inserita.AddMilliseconds(3), attiva: false, stato: 0);

        Assert.False(EliminazioneFoto.SelezionataDiRecente(archiviata, Adesso));
    }

    [Fact]
    public void Una_foto_entrata_in_uso_di_recente_avvisa_anche_senza_modifiche_dopo()
    {
        var inserita = Adesso.AddDays(-3);
        var sincronizzata = Foto(1, "a.psd", inserita, inserita, attiva: true, stato: 1);

        Assert.True(EliminazioneFoto.SelezionataDiRecente(sincronizzata, Adesso));
        Assert.False(EliminazioneFoto.SelezionataDiRecente(Foto(2, "b.psd", inserita, null, attiva: true), Adesso));
    }

    /* ---- i punti del codice ---- */

    [Fact]
    public void DeleteFoto_controlla_articolo_tipo_e_uso_e_risponde_con_l_esito()
    {
        string metodo = Tratto(Sorgente("Istanta/Controllers/SchedaArticoloController.cs"),
            "public async Task<IActionResult> DeleteFoto(", "[HttpPut]");

        Assert.Contains("[Route(\"SchedaArticolo/DeleteFoto/{id}\")]", Sorgente("Istanta/Controllers/SchedaArticoloController.cs"));
        Assert.Contains("Where(a => a.Codice == codice)", metodo);
        Assert.Contains("if (!EliminazioneFoto.EFotoDelProdotto(foto))", metodo);
        Assert.Contains("if (EliminazioneFoto.InUso(foto, articolo.ArticoliFotos))", metodo);
        Assert.Contains("this.ctx.ArticoliFotos.Remove(foto);", metodo);
        Assert.Contains("return Ok(new { esito = true, error = (string?)null });", metodo);
        Assert.DoesNotContain("Redirect(", metodo);
    }

    [Fact]
    public void La_vista_mette_Elimina_solo_sulle_foto_non_in_uso_e_mai_sulla_primaria()
    {
        string vista = Sorgente("Istanta/Views/Shared/_GestioneFoto.cshtml");
        string primaria = Tratto(vista, "@if (fotoPrimaria != null)", "Altre foto non selezionate");
        string altre = Tratto(vista, "@foreach (var foto in altreFotoArticolo)", "</figure>");

        Assert.DoesNotContain("eliminaFotoArticolo", primaria);
        Assert.Contains("@if (!Istanta.Utility.EliminazioneFoto.InUso(foto, Model.Foto))", altre);
        Assert.Contains("data-azione=\"eliminaFotoArticolo\"", altre);
        Assert.Contains("Istanta.Utility.EliminazioneFoto.SelezionataDiRecente(foto, DateTime.Now)", altre);
    }

    /* ---- strumenti ---- */

    private static string Tratto(string sorgente, string inizio, string fine)
    {
        int da = sorgente.IndexOf(inizio, StringComparison.Ordinal);
        Assert.True(da >= 0, "manca " + inizio);
        int a = sorgente.IndexOf(fine, da + inizio.Length, StringComparison.Ordinal);
        Assert.True(a > da, "manca " + fine + " dopo " + inizio);
        return sorgente.Substring(da, a - da);
    }

    private static string Sorgente(string relativo)
    {
        var cartella = new DirectoryInfo(AppContext.BaseDirectory);
        while (cartella != null)
        {
            var candidato = Path.Combine(cartella.FullName, relativo.Replace('/', Path.DirectorySeparatorChar));
            if (File.Exists(candidato))
            {
                return File.ReadAllText(candidato).Replace("\r", "");
            }
            cartella = cartella.Parent;
        }

        throw new FileNotFoundException($"Sorgente non trovata risalendo da {AppContext.BaseDirectory}: {relativo}");
    }
}
