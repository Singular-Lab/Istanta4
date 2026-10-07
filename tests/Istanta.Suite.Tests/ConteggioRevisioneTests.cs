using AgenziaLib;
using Istanta.Models;
using Istanta.Utility;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-972: il conteggio delle revisioni in home deve leggere i dati come la pagina del
/// revisore. Qui si verificano le parti pure: il filtro di agenzia, la deduplica per versione
/// e la scelta della descrizione nazionale.
///
/// I20-1051: il filtro di agenzia sta in Edro21 e legge le regole di disattivazione dal
/// SourceCustomPlugin. Ogni test ne scrive uno suo in una cartella temporanea: per default la
/// regola di Edro, reparto EX disattivato in entrambi.
/// </summary>
public class ConteggioRevisioneTests : IDisposable
{
    private readonly string _cartella = Path.Combine(Path.GetTempPath(), "i20-1051-" + Guid.NewGuid().ToString("N"));

    public ConteggioRevisioneTests()
    {
        Directory.CreateDirectory(_cartella);
    }

    public void Dispose()
    {
        Directory.Delete(_cartella, true);
    }

    private static string Regola(string disattivato, string reparto = "EX")
        => "{\"disattivato\":\"" + disattivato + "\",\"setRegole\":[{\"Id\":1,\"Deepness\":0,\"Regole\":[{\"isBox\":false,"
            + "\"Campo\":\"sigla_reparto\",\"Operatore\":0,\"Value\":\"" + reparto + "\"}],\"RegoleAnnidate\":[]}]}";

    private static string Source(params string[] regole)
        => "{\"disattivazioneRefRules\":[" + string.Join(",", regole) + "]}";

    private string ScriviSource(string json)
    {
        var percorso = Path.Combine(_cartella, "SourceCustomPlugin.json");
        File.WriteAllText(percorso, json);
        return percorso;
    }

    private List<Dictionary<string, object>> Filtra(List<Dictionary<string, object>> records, string utente, string? source = null)
        => new Edro21().FiltraRecordsPerConteggioRevisione(records, utente, ScriviSource(source ?? Source(Regola("entrambi"))));

    private static Dictionary<string, object> Record(string codice, string codiceGruppo, string? reparto)
    {
        var r = new Dictionary<string, object>
        {
            [AgenziaLib.Tipi.GLOBAL_VARIABLES.keyRefCodice] = codice,
            [AgenziaLib.Tipi.GLOBAL_VARIABLES.keyScattoCodiceGruppo] = codiceGruppo
        };
        if (reparto != null)
        {
            r[AgenziaLib.Tipi.GLOBAL_VARIABLES.keySiglaReparto] = reparto;
        }
        return r;
    }

    private static List<string> Codici(IEnumerable<Dictionary<string, object>> records)
        => records.Select(r => r[AgenziaLib.Tipi.GLOBAL_VARIABLES.keyRefCodice].ToString()!).OrderBy(x => x).ToList();

    private static List<Dictionary<string, object>> GruppoConUnEX() => new()
    {
        Record("A1", "A1,A2,A3", "EX"),
        Record("A2", "A1,A2,A3", "OR"),
        Record("A3", "A1,A2,A3", "OR"),
        Record("B1", "B1", "OR")
    };

    [Fact]
    public void Un_gruppo_con_un_solo_membro_EX_sparisce_per_intero_come_in_pagina()
    {
        // E' il caso di I20-972: la pagina toglieva tutto il gruppo, il conteggio solo il membro EX,
        // e il gruppo restava conteggiato senza che in pagina ci fosse nulla da revisionare.
        var filtrati = Filtra(GruppoConUnEX(), "mario");

        Assert.Equal(new[] { "B1" }, Codici(filtrati));
    }

    [Fact]
    public void Un_singolo_EX_si_esclude_da_solo_perche_il_suo_gruppo_e_il_suo_codice()
    {
        var records = new List<Dictionary<string, object>>
        {
            Record("S1", "S1", "EX"),
            Record("S2", "S2", "OR")
        };

        var filtrati = Filtra(records, "mario");

        Assert.Equal(new[] { "S2" }, Codici(filtrati));
    }

    [Fact]
    public void Un_gruppo_senza_EX_resta_intero_e_i_record_senza_reparto_non_vengono_toccati()
    {
        var records = new List<Dictionary<string, object>>
        {
            Record("G1", "G1,G2", "OR"),
            Record("G2", "G1,G2", null),
            Record("N1", "N1", null)
        };

        var filtrati = Filtra(records, "mario");

        Assert.Equal(new[] { "G1", "G2", "N1" }, Codici(filtrati));
    }

    [Fact]
    public void Il_reparto_EX_si_riconosce_anche_scritto_minuscolo()
    {
        var records = new List<Dictionary<string, object>> { Record("S1", "S1", "ex"), Record("S2", "S2", "OR") };

        Assert.Equal(new[] { "S2" }, Codici(Filtra(records, "mario")));
    }

    [Fact]
    public void L_utente_gg_vede_tutto_EX_compresi()
    {
        // In pagina il filtro non si applica a gg: il conteggio deve tornare gli stessi numeri.
        var records = new List<Dictionary<string, object>>
        {
            Record("A1", "A1,A2", "EX"),
            Record("A2", "A1,A2", "OR"),
            Record("S1", "S1", "EX")
        };

        var filtrati = Filtra(records, "gg");

        Assert.Equal(new[] { "A1", "A2", "S1" }, Codici(filtrati));
    }

    [Fact]
    public void Un_record_EX_senza_codice_gruppo_resta_come_in_pagina()
    {
        // La pagina raccoglie i codici gruppo dei record EX scartando i null: un EX senza gruppo
        // non finisce nell'insieme e non viene tolto. Qui si fa lo stesso, non si "migliora".
        var senzaGruppo = new Dictionary<string, object>
        {
            [AgenziaLib.Tipi.GLOBAL_VARIABLES.keyRefCodice] = "X1",
            [AgenziaLib.Tipi.GLOBAL_VARIABLES.keySiglaReparto] = "EX"
        };
        var records = new List<Dictionary<string, object>> { senzaGruppo, Record("S2", "S2", "OR") };

        var filtrati = Filtra(records, "mario");

        Assert.Equal(new[] { "S2", "X1" }, Codici(filtrati));
    }

    [Fact]
    public void Liste_vuote_o_con_buchi_non_fanno_saltare_il_filtro()
    {
        Assert.Empty(Filtra(null!, "mario"));
        Assert.Empty(Filtra(new List<Dictionary<string, object>>(), "mario"));

        var conBuco = new List<Dictionary<string, object>> { null!, Record("S2", "S2", "OR") };
        Assert.Equal(new[] { "S2" }, Codici(Filtra(conBuco, null!)));
    }

    [Fact]
    public void Una_regola_revisore_esclude_il_gruppo_come_entrambi()
    {
        var filtrati = Filtra(GruppoConUnEX(), "mario", Source(Regola("revisore")));

        Assert.Equal(new[] { "B1" }, Codici(filtrati));
    }

    [Fact]
    public void Una_regola_solo_plugin_o_nessuno_non_tocca_il_conteggio()
    {
        // "plugin" blocca la scheda ref nel Plugin, ma la ref resta da revisionare.
        Assert.Equal(new[] { "A1", "A2", "A3", "B1" }, Codici(Filtra(GruppoConUnEX(), "mario", Source(Regola("plugin")))));
        Assert.Equal(new[] { "A1", "A2", "A3", "B1" }, Codici(Filtra(GruppoConUnEX(), "mario", Source(Regola("nessuno")))));
    }

    [Fact]
    public void Vale_la_prima_regola_che_corrisponde_al_record()
    {
        // Come nel Plugin: la seconda regola, pur corrispondendo, non si guarda.
        var filtrati = Filtra(GruppoConUnEX(), "mario", Source(Regola("nessuno"), Regola("entrambi")));

        Assert.Equal(new[] { "A1", "A2", "A3", "B1" }, Codici(filtrati));
    }

    [Fact]
    public void Senza_regole_o_senza_source_non_si_esclude_nulla()
    {
        Assert.Equal(new[] { "A1", "A2", "A3", "B1" }, Codici(Filtra(GruppoConUnEX(), "mario", "{}")));
        Assert.Equal(new[] { "A1", "A2", "A3", "B1" }, Codici(Filtra(GruppoConUnEX(), "mario", Source())));

        var edro = new Edro21();
        Assert.Equal(4, edro.FiltraRecordsPerConteggioRevisione(GruppoConUnEX(), "mario", Path.Combine(_cartella, "manca.json")).Count);
        Assert.Equal(4, edro.FiltraRecordsPerConteggioRevisione(GruppoConUnEX(), "mario", null!).Count);
    }

    [Fact]
    public void Un_source_nel_formato_di_prima_esclude_ancora_le_EX()
    {
        // Un SourceCustomPlugin non ancora risalvato ha editSchedaRefRules con valido false: vale
        // come "entrambi", cioe' quello che Edro faceva prima di I20-1051.
        const string legacy = "{\"editSchedaRefRules\":[{\"valido\":false,\"setRegole\":[{\"Id\":1,\"Deepness\":0,"
            + "\"Regole\":[{\"isBox\":false,\"Campo\":\"sigla_reparto\",\"Operatore\":0,\"Value\":\"EX\"}],\"RegoleAnnidate\":[]}]}]}";

        Assert.Equal(new[] { "B1" }, Codici(Filtra(GruppoConUnEX(), "mario", legacy)));
    }

    private record Rec(string Label, int Tracciato, int Versione, string Codice);

    [Fact]
    public void La_deduplica_tiene_l_ultima_versione_per_ogni_tracciato_non_quella_globale()
    {
        // Stessa label in due tracciati: uno alla versione 2, l'altro fermo alla 1.
        // Per sola label il tracciato fermo spariva dal conteggio, in pagina no.
        var records = new List<Rec>
        {
            new("L", 10, 1, "A"),
            new("L", 10, 2, "A"),
            new("L", 20, 1, "B"),
            new("M", 20, 1, "C")
        };

        var ultime = RevisioneConteggio
            .UltimaVersionePerTracciato(records, r => r.Label, r => r.Tracciato, r => r.Versione)
            .OrderBy(r => r.Codice).ToList();

        Assert.Equal(new[] { ("A", 2), ("B", 1), ("C", 1) }, ultime.Select(r => (r.Codice, r.Versione)).ToArray());
    }

    [Fact]
    public void La_deduplica_su_una_lista_vuota_o_nulla_non_esplode()
    {
        Assert.Empty(RevisioneConteggio.UltimaVersionePerTracciato<Rec>(null!, r => r.Label, r => r.Tracciato, r => r.Versione));
        Assert.Empty(RevisioneConteggio.UltimaVersionePerTracciato(new List<Rec>(), r => r.Label, r => r.Tracciato, r => r.Versione));
    }

    private static ArticoliDescrizioni Descrizione(string? firma, string? custom, DateTime ricezione, string? area = null, string? canale = null)
        => new() { FirmaTracciato = firma, Custom = custom, DataUltimaRicezione = ricezione, Area = area, Canale = canale };

    [Fact]
    public void Per_l_articolo_vince_la_descrizione_che_porta_gia_la_firma_del_record()
    {
        var vecchia = Descrizione("F1", null, new DateTime(2026, 1, 1));
        var conFirma = Descrizione("F2", null, new DateTime(2025, 1, 1));
        var regionale = Descrizione("F2", null, new DateTime(2026, 6, 1), area: "TO");

        var scelta = RevisioneConteggio.ScegliDescrizioneNazionale(new[] { vecchia, regionale, conFirma }, "F2");

        // Con FirstOrDefault sarebbe uscita "vecchia" e l'articolo sarebbe risultato da confermare.
        Assert.Same(conFirma, scelta);
    }

    [Fact]
    public void A_pari_firma_la_custom_precede_la_standard_e_senza_firma_vince_la_piu_recente()
    {
        var standardConFirma = Descrizione("F2", null, new DateTime(2026, 1, 1));
        var customConFirma = Descrizione("F2", "si", new DateTime(2025, 1, 1));
        Assert.Same(customConFirma, RevisioneConteggio.ScegliDescrizioneNazionale(new[] { standardConFirma, customConFirma }, "F2"));

        var recente = Descrizione("F1", null, new DateTime(2026, 5, 1));
        var vecchia = Descrizione("F1", null, new DateTime(2024, 5, 1));
        Assert.Same(recente, RevisioneConteggio.ScegliDescrizioneNazionale(new[] { vecchia, recente }, "F9"));

        Assert.Null(RevisioneConteggio.ScegliDescrizioneNazionale(null, "F9"));
        Assert.Null(RevisioneConteggio.ScegliDescrizioneNazionale(new[] { Descrizione("F1", null, DateTime.Now, area: "TO") }, "F1"));
    }

    [Fact]
    public void Per_il_gruppo_la_custom_precede_la_standard_senza_guardare_la_firma()
    {
        var standard = Descrizione("F1", null, new DateTime(2026, 1, 1));
        var custom = Descrizione("F0", "si", new DateTime(2020, 1, 1));

        Assert.Same(custom, RevisioneConteggio.ScegliDescrizioneNazionaleGruppo(new[] { standard, custom }));
        Assert.Same(standard, RevisioneConteggio.ScegliDescrizioneNazionaleGruppo(new[] { standard }));
        Assert.Null(RevisioneConteggio.ScegliDescrizioneNazionaleGruppo(Array.Empty<ArticoliDescrizioni>()));
    }
}
