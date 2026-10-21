using System.Text.RegularExpressions;
using Istanta.Models;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// TASK-56428659: articoli_foto si riempiva di righe con lo stesso guid_id. Olimpo deduplica per
/// MD5 e a un file gia' noto restituisce il guid esistente; SyncPacchettoFoto e gli upload lo
/// registravano comunque come foto nuova, e la scansione cercava l'MD5 in tutto l'archivio.
/// Regola: mai due righe con lo stesso guid sullo stesso articolo e nello stesso ambito di area e
/// canale. Fra articoli diversi e fra ambiti diversi lo stesso guid e' ammesso.
/// </summary>
public class RegistroFotoArticoloTests
{
    private static ArticoliFoto Foto(int id, long idArticolo, string guid, string? area = null, string? canale = null, string? hash = null) => new()
    {
        Id = id,
        IdArticolo = idArticolo,
        GuidId = guid,
        Area = area,
        Canale = canale,
        Hash = hash,
        NomeReale = "foto.jpg",
        PathFoto = "foto.jpg",
        DataModifica = DateTime.Now.AddDays(-id),
    };

    [Fact]
    public void Lo_stesso_guid_nello_stesso_ambito_e_gia_registrato()
    {
        var foto = new[] { Foto(1, 10, "G") };

        Assert.Same(foto[0], RegistroFotoArticolo.GiaRegistrata(foto, "G", null, null));
    }

    [Fact]
    public void Area_e_canale_null_o_vuoti_sono_lo_stesso_ambito_generale()
    {
        var foto = new[] { Foto(1, 10, "G", area: "", canale: null) };

        Assert.NotNull(RegistroFotoArticolo.GiaRegistrata(foto, "g", null, ""));
        Assert.NotNull(RegistroFotoArticolo.GiaRegistrata(foto, "G", "  ", null));
    }

    [Fact]
    public void Un_ambito_diverso_dello_stesso_articolo_non_e_un_duplicato()
    {
        var foto = new[] { Foto(1, 10, "G") };

        Assert.Null(RegistroFotoArticolo.GiaRegistrata(foto, "G", "TOSCANA", null));
        Assert.Null(RegistroFotoArticolo.GiaRegistrata(foto, "G", null, "IPER"));
    }

    [Fact]
    public void Un_guid_diverso_o_assente_non_e_un_duplicato()
    {
        var foto = new[] { Foto(1, 10, "G"), Foto(2, 10, "") };

        Assert.Null(RegistroFotoArticolo.GiaRegistrata(foto, "H", null, null));
        // Il segnaposto dell'import non ha guid: non e' mai un duplicato.
        Assert.Null(RegistroFotoArticolo.GiaRegistrata(foto, "", null, null));
    }

    [Fact]
    public void La_riga_esclusa_non_conta()
    {
        var foto = new[] { Foto(1, 10, "G", "TOSCANA") };

        Assert.Null(RegistroFotoArticolo.GiaRegistrata(foto, "G", "TOSCANA", null, foto[0]));
    }

    [Fact]
    public void Riusa_aggiorna_lo_stato_ma_non_nome_ne_ambito()
    {
        var esistente = Foto(1, 10, "G", "TOSCANA", hash: "vecchio");
        esistente.Attiva = false;
        esistente.StatoSelezione = 0;
        var nuova = Foto(0, 10, "G", "TOSCANA", hash: "nuovo");
        nuova.NomeReale = "altro_nome.jpg";
        nuova.Attiva = true;
        nuova.StatoSelezione = 1;

        var risultato = RegistroFotoArticolo.Riusa(esistente, nuova);

        Assert.Same(esistente, risultato);
        Assert.True(risultato.Attiva);
        Assert.Equal((byte)1, risultato.StatoSelezione);
        Assert.Equal("nuovo", risultato.Hash);
        Assert.Equal("foto.jpg", risultato.NomeReale);
        Assert.Equal("TOSCANA", risultato.Area);
    }

    [Fact]
    public void CopieDi_trova_solo_le_righe_dello_stesso_articolo_guid_e_ambito()
    {
        var tenuta = Foto(1, 10, "G");
        var fotoDellArticolo = new[]
        {
            tenuta,
            Foto(2, 10, "G"),            // copia
            Foto(3, 10, "g", area: ""), // copia: guid senza maiuscole, ambito generale
            Foto(4, 10, "G", "TOSCANA"), // altro ambito
            Foto(5, 10, "H"),            // altro guid
            Foto(6, 20, "G"),            // altro articolo
        };

        var copie = RegistroFotoArticolo.CopieDi(fotoDellArticolo, tenuta).Select(f => f.Id).ToList();

        Assert.Equal(new[] { 2, 3 }, copie);
    }

    [Fact]
    public void La_scansione_cerca_l_md5_solo_fra_le_foto_dell_articolo()
    {
        // Lo stesso file su un altro articolo non deve far risultare la foto come nuova:
        // si cerca fra le foto dell'articolo, senza badare alle maiuscole dell'hash.
        var fotoDellArticolo = new[] { Foto(1, 10, "G", hash: "ABCDEF"), Foto(2, 10, "H", hash: "123") };

        Assert.Same(fotoDellArticolo[0], RegistroFotoArticolo.ConMd5(fotoDellArticolo, "abcdef"));
        Assert.Null(RegistroFotoArticolo.ConMd5(fotoDellArticolo, "zzz"));
        Assert.Null(RegistroFotoArticolo.ConMd5(fotoDellArticolo, ""));
    }

    [Fact]
    public void SyncFoto_non_cerca_piu_l_md5_in_tutto_l_archivio_e_registra_passando_dalla_regola()
    {
        string sorgente = File.ReadAllText(DllAgenziaLibTests.TrovaFile("Istanta/Controllers/SyncFotoController.cs"));

        Assert.DoesNotContain("this.ctx.ArticoliFotos.Where(f => f.Hash == file.md5).FirstOrDefaultAsync()", sorgente);
        Assert.Contains("RegistroFotoArticolo.ConMd5(fotoDelNome, file.md5)", sorgente);

        // Le foto di updateFotoFromIndd e della propagazione passano da RegistraFoto; resta una sola
        // Add diretta su articolo.ArticoliFotos, quella di linkLogoBollo, preceduta dal suo controllo.
        Assert.True(Regex.Matches(sorgente, @"RegistraFoto\(articolo, nuovaFoto\)").Count >= 4);
        Assert.Single(Regex.Matches(sorgente, @"articolo\.ArticoliFotos\.Add\(nuovaFoto\)"));
        Assert.Contains("RegistroFotoArticolo.GiaRegistrata(articolo!.ArticoliFotos!, guidId, null, null)", sorgente);

        // SyncPacchettoFoto: prima di aggiungere guarda se l'articolo ha gia' quel guid.
        Assert.Contains("RegistroFotoArticolo.GiaRegistrata(fotoStessoGuid, f.Id, fotoIstanta.Area, fotoIstanta.Canale)", sorgente);
    }

    [Fact]
    public void Archivio_e_Correggo_registrano_passando_dalla_regola()
    {
        string archivio = File.ReadAllText(DllAgenziaLibTests.TrovaFile("Istanta/Controllers/ArchivioController.cs"));
        string fico = File.ReadAllText(DllAgenziaLibTests.TrovaFile("Istanta/Controllers/FicoProcessController.cs"));

        Assert.Contains("RegistroFotoArticolo.GiaRegistrata(articolo.ArticoliFotos!, guidOlympo, areaVal, canaleVal)", archivio);
        // La correzione da Correggo cerca il guid fra le foto dell'articolo, non in tutto l'archivio.
        Assert.DoesNotContain("this.ctx.ArticoliFotos.FirstOrDefault(f => f.GuidId == foto.guidid)", fico);
        Assert.Contains("RegistroFotoArticolo.GiaRegistrata(artItem!.ArticoliFotos!, foto.guidid, null, null)", fico);
    }
}
