using ClosedXML.Excel;
using Istanta.Models;
using Istanta.Utility;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1269: lo schema di ordinamento (SourceOrdinamentoLista) generato da un Excel nella sezione Excel
/// della pagina Ordinamento. Si propone l'associazione campo -> colonna dell'addestramento partendo dal
/// primo elemento dello schema, si accettano %PROG% e %NOW%, si genera un elemento per riga con i tipi del
/// primo elemento e si lascia com'e' il resto del source, scrivendo l'associazione sotto mappaturaExcel.
/// Gli Excel si costruiscono in memoria: niente file, niente database.
/// </summary>
public class OrdinamentoDaExcelTests
{
    private static readonly DateTime Adesso = new(2026, 11, 25, 11, 30, 0);

    /// Lo schema nella forma di Edro21: "source", con numeri, sì/no e testo, e "sezioni" da conservare.
    private static JObject SchemaEdro21() => JObject.Parse(@"{
        ""source"": [ { ""Gruppo"": ""GRUPPO A - ORTOFRUTTA"", ""CodiceSegmento"": ""3301001001"", ""NumeroReparto"": 33,
                        ""Food"": true, ""Indice"": 1, ""Aggiornato"": ""2026-01-01T00:00:00"" } ],
        ""sezioni"": [ ""ortofrutta"" ] }");

    /// Lo schema nella forma di Coopfi: "bindings" (altro significato) e "lista".
    private static JObject SchemaCoopfi() => JObject.Parse(@"{
        ""universale"": true, ""sheet"": """", ""IdProg"": 0,
        ""bindings"": { ""area"": { ""rules"": [], ""campoMeta"": ""settore"" } },
        ""lista"": [ { ""area"": ""freschissimi"", ""areaIndex"": 4, ""settore"": ""ortofrutta"", ""orderIndex"": 1 } ] }");

    private static readonly string[] ColonneEdro21 = { "GRUPPO", "CODICE SEGMENTO", "NUMERO_REPARTO", "FOOD" };

    /// L'addestramento: titolo nell'Excel e nome dato in Training. DESC_REPARTO non ha un nome.
    private static readonly OrdinamentoDaExcel.ColonnaAddestramento[] AddestramentoEdro21 =
    {
        new("GRUPPO", "Gruppo"), new("CODICE SEGMENTO", "CodiceSegmento"), new("NUMERO_REPARTO", "NumeroReparto"),
        new("FOOD", "Food"), new("DESC_REPARTO", "")
    };

    /// Un Excel con l'intestazione e le righe date (null = cella vuota), letto come lo legge Istanta.
    private static OrdinamentoDaExcel.TabellaExcel Excel(string[] intestazione, params object?[][] righe)
    {
        using var libro = new XLWorkbook();
        var foglio = libro.AddWorksheet("Foglio1");
        for (int c = 0; c < intestazione.Length; c++) foglio.Cell(1, c + 1).Value = intestazione[c];
        for (int r = 0; r < righe.Length; r++)
            for (int c = 0; c < righe[r].Length; c++)
            {
                var v = righe[r][c];
                if (v is double d) foglio.Cell(r + 2, c + 1).Value = d;
                else if (v is bool b) foglio.Cell(r + 2, c + 1).Value = b;
                else if (v != null) foglio.Cell(r + 2, c + 1).Value = v.ToString();
            }
        using var stream = new MemoryStream();
        libro.SaveAs(stream);
        stream.Position = 0;
        return OrdinamentoDaExcel.Leggi(stream);
    }

    private static Dictionary<string, string> MappaturaEdro21() => new()
    {
        ["Gruppo"] = "Gruppo", ["CodiceSegmento"] = "CodiceSegmento", ["NumeroReparto"] = "NumeroReparto",
        ["Food"] = "Food", ["Indice"] = OrdinamentoDaExcel.Progressivo, ["Aggiornato"] = OrdinamentoDaExcel.Adesso
    };

    // ------------------------------------------------------------------ lettura

    [Fact]
    public void L_Excel_si_legge_con_l_intestazione_e_senza_le_righe_vuote()
    {
        var t = Excel(ColonneEdro21,
            new object?[] { "GRUPPO A", "3301001001", 33.0, true },
            new object?[] { null, null, null, null },
            new object?[] { "GRUPPO B", "3302001001", 34.0, false });

        Assert.Equal(ColonneEdro21, t.Colonne);
        Assert.Equal(2, t.Righe.Count);
        Assert.Equal("GRUPPO B", t.Righe[1][0]?.ToString());
    }

    // ------------------------------------------------------------------ proposta

    [Fact]
    public void La_proposta_prende_i_campi_dal_primo_elemento_e_le_colonne_con_lo_stesso_nome_dato_in_Training()
    {
        var p = OrdinamentoDaExcel.Proponi(SchemaEdro21(), AddestramentoEdro21);

        Assert.Equal("source", p.ChiaveElenco);
        Assert.Equal(new[] { "Gruppo", "CodiceSegmento", "NumeroReparto", "Food", "Indice", "Aggiornato" }, p.Campi);
        // la tendina offre i nomi dati in Training, non i titoli dell'Excel, e non le colonne senza nome
        Assert.Equal(new[] { "Gruppo", "CodiceSegmento", "NumeroReparto", "Food" }, p.Colonne);
        Assert.Equal("Gruppo", p.Mappatura["Gruppo"]);
        Assert.Equal("CodiceSegmento", p.Mappatura["CodiceSegmento"]);
        Assert.Equal("NumeroReparto", p.Mappatura["NumeroReparto"]);
        Assert.Equal("Food", p.Mappatura["Food"]);
        // nessuna colonna con quel nome: da associare
        Assert.Equal("", p.Mappatura["Indice"]);
        Assert.Equal("", p.Mappatura["Aggiornato"]);
    }

    [Fact]
    public void La_proposta_riprende_l_associazione_salvata_nel_source()
    {
        var schema = SchemaEdro21();
        schema[OrdinamentoDaExcel.ChiaveMappatura] = JObject.FromObject(new
        {
            idAddestramento = 12,
            campi = new Dictionary<string, string> { ["Indice"] = "%PROG%", ["Aggiornato"] = "%NOW%", ["Gruppo"] = "COLONNA SPARITA" }
        });

        var p = OrdinamentoDaExcel.Proponi(schema, AddestramentoEdro21);

        Assert.Equal(OrdinamentoDaExcel.Progressivo, p.Mappatura["Indice"]);
        Assert.Equal(OrdinamentoDaExcel.Adesso, p.Mappatura["Aggiornato"]);
        // una colonna salvata che l'addestramento non ha piu' torna alla proposta per nome
        Assert.Equal("Gruppo", p.Mappatura["Gruppo"]);
    }

    // ------------------------------------------------------------------ generazione

    [Fact]
    public void Genera_un_elemento_per_riga_con_i_tipi_del_primo_elemento_e_i_valori_automatici()
    {
        var t = Excel(ColonneEdro21,
            new object?[] { "GRUPPO A", 3301001001.0, 33.0, "SI" },
            new object?[] { null, null, null, null },
            new object?[] { "GRUPPO B", "3302001001", "34", false },
            new object?[] { "GRUPPO C", "3303001001", null, null });

        var esito = OrdinamentoDaExcel.Genera(SchemaEdro21(), t, MappaturaEdro21(), AddestramentoEdro21, 12, Adesso);

        Assert.True(esito.Ok, esito.Errore);
        Assert.Equal(3, esito.Elementi);
        var elenco = (JArray)esito.Source!["source"]!;
        Assert.Equal(3, elenco.Count);

        var primo = (JObject)elenco[0];
        Assert.Equal("GRUPPO A", (string?)primo["Gruppo"]);
        Assert.Equal(JTokenType.String, primo["CodiceSegmento"]!.Type);
        Assert.Equal("3301001001", (string?)primo["CodiceSegmento"]);
        Assert.Equal(JTokenType.Integer, primo["NumeroReparto"]!.Type);
        Assert.Equal(33, (int)primo["NumeroReparto"]!);
        Assert.True((bool)primo["Food"]!);
        Assert.Equal(1, (int)primo["Indice"]!);
        Assert.Equal("2026-11-25T11:30:00", (string?)primo["Aggiornato"]);

        Assert.Equal(34, (int)elenco[1]["NumeroReparto"]!);
        Assert.False((bool)elenco[1]["Food"]!);
        Assert.Equal(2, (int)elenco[1]["Indice"]!);
        // celle vuote: 0 e falso; %PROG% conta solo le righe generate
        Assert.Equal(0, (int)elenco[2]["NumeroReparto"]!);
        Assert.False((bool)elenco[2]["Food"]!);
        Assert.Equal(3, (int)elenco[2]["Indice"]!);
    }

    [Fact]
    public void Il_resto_del_source_resta_e_l_associazione_va_in_mappaturaExcel()
    {
        var t = Excel(new[] { "AREA", "SETTORE" }, new object?[] { "freschi", "carni" }, new object?[] { "secco", "pasta" });
        var mappatura = new Dictionary<string, string>
        {
            ["area"] = "area", ["areaIndex"] = "%PROG%", ["settore"] = "settore", ["orderIndex"] = "%PROG%"
        };
        var schema = SchemaCoopfi();

        var esito = OrdinamentoDaExcel.Genera(schema, t, mappatura,
            new OrdinamentoDaExcel.ColonnaAddestramento[] { new("AREA", "area"), new("SETTORE", "settore") }, 7, Adesso);

        Assert.True(esito.Ok, esito.Errore);
        var nuovo = esito.Source!;
        Assert.True(JToken.DeepEquals(schema["bindings"], nuovo["bindings"]));
        Assert.True((bool)nuovo["universale"]!);
        Assert.Equal(2, ((JArray)nuovo["lista"]!).Count);
        Assert.Equal("carni", (string?)nuovo["lista"]![0]!["settore"]);
        Assert.Equal(2, (int)nuovo["lista"]![1]!["orderIndex"]!);
        Assert.Equal(7, (int)nuovo["mappaturaExcel"]!["idAddestramento"]!);
        Assert.Equal("area", (string?)nuovo["mappaturaExcel"]!["campi"]!["area"]);
        // il source di partenza non e' toccato: si salva solo con il Salva della sezione Source
        Assert.Single((JArray)schema["lista"]!);
        Assert.Null(schema["mappaturaExcel"]);
    }

    [Fact]
    public void Senza_un_associazione_per_ogni_campo_non_si_genera()
    {
        var t = Excel(ColonneEdro21, new object?[] { "GRUPPO A", "1", 33.0, true });
        var mappatura = MappaturaEdro21();
        mappatura["Indice"] = "";

        var esito = OrdinamentoDaExcel.Genera(SchemaEdro21(), t, mappatura, AddestramentoEdro21, 12, Adesso);

        Assert.False(esito.Ok);
        Assert.Contains("Indice", esito.Errore);
    }

    [Fact]
    public void Una_colonna_associata_che_manca_nel_file_ferma_la_generazione()
    {
        var t = Excel(new[] { "GRUPPO", "CODICE SEGMENTO", "FOOD" }, new object?[] { "GRUPPO A", "1", true });

        var esito = OrdinamentoDaExcel.Genera(SchemaEdro21(), t, MappaturaEdro21(), AddestramentoEdro21, 12, Adesso);

        Assert.False(esito.Ok);
        Assert.Equal("Nel file manca la colonna NUMERO_REPARTO (NumeroReparto).", esito.Errore);
    }

    [Fact]
    public void Una_cella_che_non_e_un_numero_in_un_campo_numerico_dice_riga_e_colonna()
    {
        var t = Excel(ColonneEdro21, new object?[] { "GRUPPO A", "1", "trentatre", true });

        var esito = OrdinamentoDaExcel.Genera(SchemaEdro21(), t, MappaturaEdro21(), AddestramentoEdro21, 12, Adesso);

        Assert.False(esito.Ok);
        Assert.Contains("Riga 2", esito.Errore);
        Assert.Contains("NUMERO_REPARTO (NumeroReparto)", esito.Errore);
    }

    [Fact]
    public void Una_colonna_che_l_addestramento_non_ha_non_si_accetta()
    {
        var t = Excel(ColonneEdro21, new object?[] { "GRUPPO A", "1", 33.0, true });
        var mappatura = MappaturaEdro21();
        mappatura["Gruppo"] = "INVENTATA";

        var esito = OrdinamentoDaExcel.Genera(SchemaEdro21(), t, mappatura, AddestramentoEdro21, 12, Adesso);

        Assert.False(esito.Ok);
        Assert.Contains("INVENTATA", esito.Errore);
    }

    [Fact]
    public void Il_titolo_dell_Excel_e_una_colonna_senza_nome_in_Training_non_si_accettano()
    {
        var t = Excel(ColonneEdro21.Append("DESC_REPARTO").ToArray(), new object?[] { "GRUPPO A", "1", 33.0, true, "Ortofrutta" });
        var conTitolo = MappaturaEdro21();
        conTitolo["Gruppo"] = "GRUPPO";
        var senzaNome = MappaturaEdro21();
        senzaNome["Gruppo"] = "DESC_REPARTO";

        var esitoTitolo = OrdinamentoDaExcel.Genera(SchemaEdro21(), t, conTitolo, AddestramentoEdro21, 12, Adesso);
        var esitoSenzaNome = OrdinamentoDaExcel.Genera(SchemaEdro21(), t, senzaNome, AddestramentoEdro21, 12, Adesso);

        Assert.False(esitoTitolo.Ok);
        Assert.Contains("Gruppo → GRUPPO", esitoTitolo.Errore);
        Assert.False(esitoSenzaNome.Ok);
        Assert.Contains("Gruppo → DESC_REPARTO", esitoSenzaNome.Errore);
    }

    // ------------------------------------------------------------------ modello di Coopfi

    [Fact]
    public void mappaturaExcel_sopravvive_al_salvataggio_della_vista_Visual_e_senza_non_compare()
    {
        var schema = SchemaCoopfi();
        schema["mappaturaExcel"] = JObject.Parse(@"{ ""idAddestramento"": 7, ""campi"": { ""area"": ""AREA"" } }");

        var riletto = JObject.Parse(JsonConvert.SerializeObject(schema.ToObject<JsonDbClassificazioneUniversale>()));
        Assert.Equal("AREA", (string?)riletto["mappaturaExcel"]!["campi"]!["area"]);

        var senza = JObject.Parse(JsonConvert.SerializeObject(SchemaCoopfi().ToObject<JsonDbClassificazioneUniversale>()));
        Assert.Null(senza.Property("mappaturaExcel"));
    }
    // ------------------------------------------------------------------ formule

    /// Uno schema con un testo, un numero e un vero/falso, per le formule.
    private static JObject SchemaFormule() => JObject.Parse(@"{
        ""source"": [ { ""Gruppo"": ""A"", ""Tipo"": ""FOOD"", ""Codice"": 101, ""Food"": true } ], ""sezioni"": [] }");

    private static readonly string[] ColonneFormule = { "GRUPPO", "REPARTO", "SETTORE", "FOOD", "NO FOOD" };

    private static readonly OrdinamentoDaExcel.ColonnaAddestramento[] AddestramentoFormule =
    {
        new("GRUPPO", "Gruppo"), new("REPARTO", "NumeroReparto"), new("SETTORE", "NumeroSettore"),
        new("FOOD", "Food"), new("NO FOOD", "NoFood")
    };

    private static OrdinamentoDaExcel.TabellaExcel ExcelFormule() => Excel(ColonneFormule,
        new object?[] { "A", 1.0, 5.0, "X", null },
        new object?[] { "B", 7.0, 3.0, null, "X" },
        new object?[] { "C", 2.0, 10.0, null, null });

    private static Dictionary<string, string> MappaturaFormule(string tipo, string codice = "NumeroReparto", string food = "Food") => new()
    {
        ["Gruppo"] = "Gruppo", ["Tipo"] = tipo, ["Codice"] = codice, ["Food"] = food
    };

    private static OrdinamentoDaExcel.Esito GeneraFormule(Dictionary<string, string> mappatura) =>
        OrdinamentoDaExcel.Genera(SchemaFormule(), ExcelFormule(), mappatura, AddestramentoFormule, 6, Adesso);

    [Fact]
    public void Una_formula_italiana_con_condizioni_su_due_colonne_si_calcola_riga_per_riga()
    {
        string formula = "=SE([Food]=\"X\";\"FOOD\";SE([NoFood]=\"X\";\"NO FOOD\";\"ALTRO\"))";
        var esito = GeneraFormule(MappaturaFormule(formula));

        Assert.True(esito.Ok, esito.Errore);
        var elenco = (JArray)esito.Source!["source"]!;
        Assert.Equal(new[] { "FOOD", "NO FOOD", "ALTRO" }, elenco.Select(e => (string)e["Tipo"]!));
        // la formula resta nell'associazione salvata e torna nella proposta successiva
        Assert.Equal(formula, (string)esito.Source["mappaturaExcel"]!["campi"]!["Tipo"]!);
        Assert.Equal(formula, OrdinamentoDaExcel.Proponi(esito.Source, AddestramentoFormule).Mappatura["Tipo"]);
    }

    [Fact]
    public void La_stessa_formula_in_inglese_da_lo_stesso_risultato()
    {
        var esito = GeneraFormule(MappaturaFormule("=IF([Food]=\"X\",\"FOOD\",IF([NoFood]=\"X\",\"NO FOOD\",\"ALTRO\"))"));

        Assert.True(esito.Ok, esito.Errore);
        Assert.Equal(new[] { "FOOD", "NO FOOD", "ALTRO" }, ((JArray)esito.Source!["source"]!).Select(e => (string)e["Tipo"]!));
    }

    [Fact]
    public void Una_formula_numerica_da_un_numero_e_una_condizione_un_vero_falso()
    {
        var esito = GeneraFormule(MappaturaFormule("=MAIUSC(SINISTRA([Gruppo];1))&\"-\"&TESTO([NumeroReparto];\"00\")",
            codice: "=[NumeroReparto]*100+[NumeroSettore]", food: "=E([Food]=\"X\";[NumeroReparto]<5)"));

        Assert.True(esito.Ok, esito.Errore);
        var elenco = (JArray)esito.Source!["source"]!;
        Assert.Equal(new[] { "A-01", "B-07", "C-02" }, elenco.Select(e => (string)e["Tipo"]!));
        Assert.Equal(JTokenType.Integer, elenco[0]["Codice"]!.Type);
        Assert.Equal(new long[] { 105, 703, 210 }, elenco.Select(e => (long)e["Codice"]!));
        Assert.Equal(new[] { true, false, false }, elenco.Select(e => (bool)e["Food"]!));
    }

    [Fact]
    public void In_italiano_la_virgola_e_decimale_e_i_testi_non_si_toccano()
    {
        var (it, errIt) = OrdinamentoDaExcel.Formula.Compila("=SE([NumeroReparto]>1,5;CONCATENA([Gruppo];\" a,b;c\");\"\")");
        var (en, errEn) = OrdinamentoDaExcel.Formula.Compila("=if([NumeroReparto]>1.5,concatenate([Gruppo],\" a,b;c\"),\"\")");

        Assert.Null(errIt);
        Assert.Null(errEn);
        Assert.Equal("IF([NumeroReparto]>1.5,CONCATENATE([Gruppo],\" a,b;c\"),\"\")", it!.Tradotta);
        Assert.Equal(it.Tradotta, en!.Tradotta);
        Assert.Equal(new[] { "NumeroReparto", "Gruppo" }, it.Colonne);
    }

    [Theory]
    [InlineData("=SE(D2=\"X\";1;0)", "«D2» è un riferimento di Excel")]
    [InlineData("=SE(FOOD=\"X\";1;0)", "«FOOD» non è una colonna: scrivi il nome tra quadre, per esempio [FOOD]")]
    [InlineData("=SE([FOOD=\"X\";1;0)", "manca la ] che chiude")]
    [InlineData("=SE([Food]=\"X;1;0)", "manca la virgoletta")]
    [InlineData("=", "la formula è vuota")]
    public void Una_formula_scritta_male_si_ferma_prima_di_generare(string formula, string messaggio)
    {
        var esito = GeneraFormule(MappaturaFormule(formula));

        Assert.False(esito.Ok);
        Assert.StartsWith("Formula del campo Tipo: ", esito.Errore);
        Assert.Contains(messaggio, esito.Errore);
    }

    [Fact]
    public void Una_colonna_che_l_addestramento_non_ha_nella_formula_non_si_accetta()
    {
        var esito = GeneraFormule(MappaturaFormule("=SE([PIPPO]=\"X\";\"a\";\"b\")"));

        Assert.False(esito.Ok);
        Assert.Equal("Formula del campo Tipo: [PIPPO] non è una colonna dell'addestramento.", esito.Errore);
    }

    [Fact]
    public void Una_formula_con_le_parentesi_sbagliate_dice_che_non_e_valida()
    {
        var esito = GeneraFormule(MappaturaFormule("=SE([Food]=\"X\";\"a\""));

        Assert.False(esito.Ok);
        Assert.StartsWith("Formula del campo Tipo non valida: ", esito.Errore);
    }

    [Fact]
    public void Un_errore_di_calcolo_su_una_riga_dice_riga_e_campo_e_non_genera()
    {
        var tabella = Excel(ColonneFormule,
            new object?[] { "A", 1.0, 5.0, "X", null },
            new object?[] { "B", 0.0, 3.0, null, "X" });

        var esito = OrdinamentoDaExcel.Genera(SchemaFormule(), tabella, MappaturaFormule("=[Gruppo]", codice: "=[NumeroSettore]/[NumeroReparto]"),
            AddestramentoFormule, 6, Adesso);

        Assert.False(esito.Ok);
        Assert.Equal("Riga 3, campo Codice: la formula dà #DIV/0!.", esito.Errore);
        Assert.Null(esito.Source);
    }
    [Fact]
    public void Nella_formula_il_titolo_dell_Excel_non_vale_e_il_nome_si_riconosce_senza_maiuscole()
    {
        var titolo = GeneraFormule(MappaturaFormule("=SE([NO FOOD]=\"X\";\"NO FOOD\";\"\")"));
        var minuscolo = GeneraFormule(MappaturaFormule("=SE([nofood]=\"X\";\"NO FOOD\";\"\")"));

        Assert.False(titolo.Ok);
        Assert.Equal("Formula del campo Tipo: [NO FOOD] non è una colonna dell'addestramento.", titolo.Errore);
        Assert.True(minuscolo.Ok, minuscolo.Errore);
        Assert.Equal(new[] { "", "NO FOOD", "" }, ((JArray)minuscolo.Source!["source"]!).Select(e => (string)e["Tipo"]!));
    }
}
