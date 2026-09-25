using Istanta.Models;
using Istanta.Utility;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-993: la scala di specificita' delle varianti di descrizione e l'elenco che ne esce.
///
/// Il Plugin costruisce una schermata per variante e, chiudendone una, scende alla meno
/// specifica: l'ordine di questo elenco e' quella scala, non un dettaglio di presentazione.
/// Custom resta fuori perche' non e' ordinabile insieme ad area e canale.
/// </summary>
public class VariantiDescrizioneTests
{
    [Theory]
    [InlineData(null, null, 0)]
    [InlineData(null, "SS", 1)]
    [InlineData("TO", null, 2)]
    [InlineData("TO", "SS", 3)]
    public void La_scala_va_dalla_nazionale_alla_piu_specifica(string? area, string? canale, int atteso)
    {
        Assert.Equal(atteso, SpecificitaDescrizione.Rango(area, canale));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Un_valore_vuoto_non_rende_una_variante_piu_specifica(string vuoto)
    {
        // Nell'archivio la nazionale puo' arrivare con le stringhe vuote invece che con null.
        Assert.Equal(0, SpecificitaDescrizione.Rango(vuoto, vuoto));
        Assert.Equal(2, SpecificitaDescrizione.Rango("TO", vuoto));
    }

    [Fact]
    public void L_elenco_esce_dalla_meno_specifica_alla_piu_specifica()
    {
        var descrizioni = new List<ArticoliDescrizioni>
        {
            Variante("TO", "SS"),
            Variante(null, null),
            Variante("TO", null),
            Variante(null, "SS")
        };

        var elenco = SpecificitaDescrizione.Elenco(descrizioni);

        Assert.Equal(4, elenco.Count);
        Assert.Equal(new[] { 0, 1, 2, 3 }, elenco.Select(v => (int)v["specificita"]!));
        Assert.Null(elenco[0]["area"]);
        Assert.Null(elenco[0]["canale"]);
        Assert.Equal("TO", elenco[3]["area"]);
        Assert.Equal("SS", elenco[3]["canale"]);
    }

    [Fact]
    public void Le_varianti_custom_restano_fuori()
    {
        var descrizioni = new List<ArticoliDescrizioni>
        {
            Variante(null, null),
            Variante("TO", "SS", custom: "promo speciale")
        };

        var elenco = SpecificitaDescrizione.Elenco(descrizioni);

        var sola = Assert.Single(elenco);
        Assert.Null(sola["area"]);
    }

    [Fact]
    public void La_stessa_coppia_ripetuta_e_una_schermata_sola()
    {
        // L'archivio tiene piu' righe per la stessa coppia, con date di ricezione diverse.
        var descrizioni = new List<ArticoliDescrizioni>
        {
            Variante("TO", "SS"),
            Variante("TO", "SS"),
            Variante("TO", "SS")
        };

        Assert.Single(SpecificitaDescrizione.Elenco(descrizioni));
    }

    [Fact]
    public void Le_stringhe_vuote_diventano_nulle_nell_elenco()
    {
        // Cosi' il Plugin confronta sempre con null e non deve gestire due forme del vuoto.
        var elenco = SpecificitaDescrizione.Elenco(new List<ArticoliDescrizioni> { Variante("", "  ") });

        var sola = Assert.Single(elenco);
        Assert.Null(sola["area"]);
        Assert.Null(sola["canale"]);
        Assert.Equal(0, (int)sola["specificita"]!);
    }

    [Fact]
    public void Senza_descrizioni_l_elenco_e_vuoto_non_nullo()
    {
        // Viaggia sempre, anche vuoto: il Plugin non deve distinguere "nessuna" da "assente".
        Assert.Empty(SpecificitaDescrizione.Elenco(null));
        Assert.Empty(SpecificitaDescrizione.Elenco(new List<ArticoliDescrizioni>()));
    }

    [Fact]
    public void Ogni_variante_porta_i_suoi_testi()
    {
        // Senza i testi le schermate del Plugin sarebbero vuote e servirebbe una chiamata
        // per ognuna.
        var descrizioni = new List<ArticoliDescrizioni>
        {
            Variante("TO", "SS", descrizione1: "Porchetta di Ariccia")
        };

        var sola = Assert.Single(SpecificitaDescrizione.Elenco(descrizioni));

        Assert.Equal("Porchetta di Ariccia", sola["descrizione1"]);
    }

    [Fact]
    public void Fra_i_doppioni_vale_il_piu_recente()
    {
        // L'archivio tiene piu' righe per la stessa coppia: si mostra quella arrivata dopo,
        // come fa il resto del server ordinando per DataUltimaRicezione.
        var vecchia = Variante("TO", "SS", descrizione1: "vecchia");
        vecchia.DataUltimaRicezione = new DateTime(2026, 1, 1);

        var recente = Variante("TO", "SS", descrizione1: "recente");
        recente.DataUltimaRicezione = new DateTime(2026, 9, 24);

        var sola = Assert.Single(SpecificitaDescrizione.Elenco(new List<ArticoliDescrizioni> { vecchia, recente }));

        Assert.Equal("recente", sola["descrizione1"]);
    }

    [Fact]
    public void Salvando_si_scrive_sulla_variante_indicata()
    {
        // E' il difetto per cui le modifiche fatte sulla ss_sa finivano sulla nazionale.
        var descrizioni = new List<ArticoliDescrizioni>
        {
            Variante(null, null, descrizione1: "nazionale"),
            Variante("TO", "SS", descrizione1: "specifica")
        };

        var scelta = SpecificitaDescrizione.ScegliPerVariante(descrizioni, "TO", "SS");

        Assert.Equal("specifica", scelta!.Descrizione1);
    }

    [Fact]
    public void Senza_variante_indicata_si_scrive_dove_si_scriveva_prima()
    {
        // I client che non mandano area e canale non devono cambiare comportamento.
        var descrizioni = new List<ArticoliDescrizioni>
        {
            Variante(null, null, descrizione1: "la prima"),
            Variante("TO", "SS", descrizione1: "specifica")
        };

        Assert.Equal("la prima", SpecificitaDescrizione.ScegliPerVariante(descrizioni, null, null)!.Descrizione1);
        Assert.Equal("la prima", SpecificitaDescrizione.ScegliPerVariante(descrizioni, "", "  ")!.Descrizione1);
    }

    [Fact]
    public void Una_variante_che_non_esiste_non_fa_scrivere_da_nessuna_parte()
    {
        // Meglio non salvare che salvare sulla riga sbagliata.
        var descrizioni = new List<ArticoliDescrizioni> { Variante(null, null, descrizione1: "nazionale") };

        Assert.Null(SpecificitaDescrizione.ScegliPerVariante(descrizioni, "MI", "SA"));
    }

    [Fact]
    public void Fra_i_doppioni_della_variante_indicata_vale_il_piu_recente()
    {
        var vecchia = Variante("TO", "SS", descrizione1: "vecchia");
        vecchia.DataUltimaRicezione = new DateTime(2026, 1, 1);
        var recente = Variante("TO", "SS", descrizione1: "recente");
        recente.DataUltimaRicezione = new DateTime(2026, 9, 24);

        var scelta = SpecificitaDescrizione.ScegliPerVariante(new List<ArticoliDescrizioni> { vecchia, recente }, "TO", "SS");

        Assert.Equal("recente", scelta!.Descrizione1);
    }

    [Theory]
    [InlineData(null, null, false)]
    [InlineData("", "   ", false)]
    [InlineData(null, "SS", true)]
    [InlineData("TO", null, true)]
    [InlineData("TO", "SS", true)]
    public void La_nazionale_non_si_chiude_le_altre_si(string? area, string? canale, bool atteso)
    {
        // Chiudere una variante la cancella davvero. Sulla nazionale non si puo': e' il fondo
        // della scala, e senza di lei il gruppo resterebbe senza niente su cui ricadere.
        Assert.Equal(atteso, SpecificitaDescrizione.SiPuoChiudere(area, canale));
    }

    [Fact]
    public void Creando_un_campo_non_toccato_eredita_dalla_nazionale()
    {
        // E' il bug I20-996: creando una regionale e toccando un campo solo, gli altri tre
        // nascevano vuoti perche' "non toccato" in creazione non ha niente da lasciare com'era.
        Assert.Equal("dalla nazionale", SpecificitaDescrizione.ValoreInCreazione(SpecificitaDescrizione.NonToccato, "dalla nazionale"));
    }

    [Fact]
    public void Creando_un_campo_toccato_vince_su_quello_della_nazionale()
    {
        Assert.Equal("scritto ora", SpecificitaDescrizione.ValoreInCreazione("scritto ora", "dalla nazionale"));
    }

    [Fact]
    public void Un_campo_svuotato_apposta_resta_vuoto()
    {
        // La stringa vuota e' una scelta dell'operatore, non un "non toccato": non si eredita.
        Assert.Equal("", SpecificitaDescrizione.ValoreInCreazione("", "dalla nazionale"));
    }

    [Fact]
    public void Senza_nazionale_non_c_e_da_dove_ereditare()
    {
        Assert.Equal("", SpecificitaDescrizione.ValoreInCreazione(SpecificitaDescrizione.NonToccato, null));
    }

    [Fact]
    public void Un_campo_assente_del_tutto_resta_come_prima()
    {
        // null vuol dire che il client non manda quel campo, non che l'operatore non l'ha
        // toccato: si restituisce null e chi chiama lascia il valore di partenza.
        Assert.Null(SpecificitaDescrizione.ValoreInCreazione(null, "dalla nazionale"));
    }

    [Fact]
    public void La_nazionale_e_quella_senza_area_canale_e_custom()
    {
        var descrizioni = new List<ArticoliDescrizioni>
        {
            Variante("TO", "SS", descrizione1: "specifica"),
            Variante(null, null, custom: "promo", descrizione1: "custom"),
            Variante(null, null, descrizione1: "nazionale")
        };

        Assert.Equal("nazionale", SpecificitaDescrizione.Nazionale(descrizioni)!.Descrizione1);
    }

    [Fact]
    public void Fra_piu_nazionali_vale_la_piu_recente()
    {
        var vecchia = Variante(null, null, descrizione1: "vecchia");
        vecchia.DataUltimaRicezione = new DateTime(2026, 1, 1);
        var recente = Variante(null, null, descrizione1: "recente");
        recente.DataUltimaRicezione = new DateTime(2026, 9, 25);

        Assert.Equal("recente", SpecificitaDescrizione.Nazionale(new List<ArticoliDescrizioni> { vecchia, recente })!.Descrizione1);
    }

    [Fact]
    public void Senza_descrizioni_non_c_e_nazionale()
    {
        Assert.Null(SpecificitaDescrizione.Nazionale(null));
        Assert.Null(SpecificitaDescrizione.Nazionale(new List<ArticoliDescrizioni>()));
        Assert.Null(SpecificitaDescrizione.Nazionale(new List<ArticoliDescrizioni> { Variante("TO", "SS") }));
    }

    private static ArticoliDescrizioni Variante(string? area, string? canale, string? custom = null, string? descrizione1 = null)
    {
        return new ArticoliDescrizioni
        {
            Area = area,
            Canale = canale,
            Custom = custom,
            Descrizione1 = descrizione1
        };
    }
}
