using System.Text.Json;

namespace Correggo4.Servizi;

/// <summary>
/// Il PolicyManager.CoopFi del Correggo originale (App_Code/PolicyManager.cs), che all'ingresso da
/// Fidelity (OAuthLanded.ashx) trasformava i reparti dell'utente in una policy di correzione.
///   - <see cref="ParseGruppi"/>: dall'albero `ruoli` di Olimpo (Settore -> Reparto -> Area) ai valori
///     "settore-reparto" del dizionario <see cref="Reparti"/>;
///   - <see cref="Crea"/>: dai valori alla policy (un blocco codice_settore/codice_reparto per valore,
///     minVersion 1, timbri di dimensione esclusi), nel formato che <see cref="PolicyCorrezione"/> legge.
/// Scostamenti decisi con l'utente (13/10/2026):
///   - un reparto che il dizionario non conosce, o mappato su nessun valore, si ignora (l'originale
///     falliva tutta la scansione); fallisce solo se c'erano reparti e nessuno e' conosciuto;
///   - nel dizionario " 58-05" (con lo spazio, mai corrispondente a un prodotto) diventa "58-05";
///     "66-06" di OF resta com'era.
/// </summary>
public static class PolicyManager
{
    /// <summary>Il valore di Fico:NomeGdo che attiva questo manager (nomeGdo dell'originale).</summary>
    public const string ClienteCoopFi = "CoopFi";

    /// <summary>repInterpreter dell'originale: reparto Olimpo -> valori "settore-reparto" (o solo "settore").</summary>
    public static readonly IReadOnlyDictionary<string, string[]> Reparti = new Dictionary<string, string[]>
    {
        ["OCFOPLSGS"] = ["56-03", "56-04"],
        ["GVPNABOX"] = ["52-01", "52-02", "66", "64", "62", "68"],
        ["CHPETSU"] = ["54-01", "54-02", "54-03", "52-04", "56-01"],
        ["FOGSPLS"] = ["58-05", "58-06", "56-03", "56-04", "56-02"],
        ["GVPLSSU"] = ["52-01", "52-02", "56-01", "56-02"],
        ["OCPLSGS"] = ["56-03", "56-04"],
        ["OFPLSSU"] = ["58-01", "56-02", "56-01"],
        ["PLSCAOF"] = ["56-01", "58-02", "58-03", "58-08", "58-01"],
        ["PRFICOM"] = [],
        ["VGVSUNA"] = ["52-01", "52-02", "66", "64", "62", "68", "56-01"],
        ["CASPER"] = ["54-01", "54-02", "54-03"],
        ["DA2PET"] = ["52-01", "52-04"],
        ["GSPEFO"] = ["56-03", "56-04", "58-04", "58-05", "58-06"],
        ["GSSALA"] = ["56-03", "56-04"],
        ["GVCASS"] = ["52-01", "52-02"],
        ["GVNASU"] = ["52-01", "52-02", "66", "64", "62", "68", "56-01"],
        ["GVSUNA"] = ["52-01", "52-02", "66", "64", "62", "68", "56-01"],
        ["FORIS"] = ["58-05", "58-06"],
        ["GSPLS"] = ["56-03", "56-04", "56-02"],
        ["GVPLS"] = ["52-01", "52-02", "56-02"],
        ["MKTOP"] = [],
        ["MUCAS"] = ["66", "64", "62", "68"],
        ["OGVSU"] = ["52-01", "52-02", "56-01"],
        ["PLSGS"] = ["52-01", "52-02", "56-02"],
        ["PLSSU"] = ["52-01", "52-02", "56-01"],
        ["STPER"] = ["66", "64", "62", "68", "54-01", "54-02", "54-03"],
        ["SUPET"] = ["56-01", "52-04"],
        ["SWMTG"] = [],
        ["VGVSU"] = ["52-01", "52-02", "56-01"],
        ["BRST"] = ["66", "64", "62", "68"],
        ["CABI"] = ["58-02", "58-03", "58-08"],
        ["CAPE"] = ["58-02", "58-03", "58-08", "58-04"],
        ["CHSU"] = ["54-01", "54-02", "54-03", "56-01"],
        ["DALI"] = ["52-01", "52-02", "52-03"],
        ["FOPA"] = ["58-05", "58-06"],
        ["FRSS"] = ["58-01", "58-02", "58-03", "58-08", "58-04", "58-05", "58-06"],
        ["GSFO"] = ["58-05", "58-06", "56-03", "56-04"],
        ["GSRO"] = ["56-03", "56-04"],
        ["GVSU"] = ["52-01", "52-02", "56-01"],
        ["PROF"] = ["54-01", "54-02", "54-03"],
        ["UODO"] = ["66", "64", "62", "68"],
        ["CSG"] = ["66", "64", "62", "68"],
        ["DA1"] = ["52-02"],
        ["DA2"] = ["52-01"],
        ["DA1DA2"] = ["52-02", "52-01"],
        ["PET"] = ["52-04"],
        ["PLS"] = ["56-02"],
        ["PUB"] = [],
        ["CA"] = ["58-02", "58-03", "58-08"],
        ["AV"] = ["58-02", "58-03", "58-08"],
        ["CH"] = ["54-01", "54-02", "54-03"],
        ["DA"] = ["52-01", "52-02"],
        ["DO"] = ["66", "64", "62", "68"],
        ["FO"] = ["58-05", "58-06"],
        ["FR"] = ["56-03", "56-04", "56-02", "56-01"],
        ["GE"] = ["56-01"],
        ["GS"] = ["56-03", "56-04"],
        ["GV"] = ["52-01", "52-02"],
        ["IA"] = ["54-01", "54-02", "54-03"],
        ["IP"] = ["54-01", "54-02", "54-03"],
        ["LI"] = ["52-03"],
        ["MU"] = ["66", "64", "62", "68"],
        ["NA"] = ["66", "64", "62", "68"],
        ["OF"] = ["58-01", "66-06"],
        ["PA"] = ["58-05", "58-06"],
        ["PE"] = ["58-04"],
        ["PF"] = ["58-01"],
        ["PR"] = ["54-01", "54-02", "54-03"],
        ["RO"] = ["56-03", "56-04"],
        ["ST"] = ["66", "64", "62", "68"],
        ["SU"] = ["56-01"],
        ["TE"] = ["66", "64", "62", "68"],
        ["UO"] = ["66", "64", "62", "68"],
    };

    /// <summary>I quattro timbri di dimensione che la policy toglieva (agenzia.js `_3_*`).</summary>
    public static readonly string[] TimbriDimensione = ["_3_1_x2", "_3_2_x4", "_3_3_meta", "_3_4_un_quarto"];

    /// <summary>
    /// Esito della scansione. Valori: i "settore-reparto" senza ripetizioni, nell'ordine in cui
    /// compaiono. Ignorati: i reparti che il dizionario non conosce o che non danno valori.
    /// NessunoRiconosciuto: c'erano reparti, ma nessuno conosciuto (per un Category: non entra).
    /// </summary>
    public sealed record Gruppi(IReadOnlyList<string> Valori, IReadOnlyList<string> Ignorati)
    {
        public bool NessunoRiconosciuto => Valori.Count == 0 && Ignorati.Count > 0;
    }

    /// <summary>
    /// parseGruppi dell'originale. `ruoli` e' userPolicy.ruoli della risposta di checkIdentity: una lista
    /// di nodi Settore i cui figli sono i Reparti (nodeValue). Assente o non lista = nessun reparto.
    /// </summary>
    public static Gruppi ParseGruppi(JsonElement ruoli)
    {
        var valori = new List<string>();
        var ignorati = new List<string>();
        if (ruoli.ValueKind != JsonValueKind.Array) return new Gruppi(valori, ignorati);

        foreach (var settore in ruoli.EnumerateArray())
        {
            if (settore.ValueKind != JsonValueKind.Object
                || !settore.TryGetProperty("children", out var figli) || figli.ValueKind != JsonValueKind.Array)
                continue;

            foreach (var reparto in figli.EnumerateArray())
            {
                string codice = reparto.ValueKind == JsonValueKind.Object
                                && reparto.TryGetProperty("nodeValue", out var v) && v.ValueKind == JsonValueKind.String
                    ? v.GetString() ?? "" : "";
                if (!Reparti.TryGetValue(codice, out var mappati) || mappati.Length == 0)
                {
                    ignorati.Add(codice);
                    continue;
                }
                foreach (string m in mappati)
                    if (!valori.Contains(m)) valori.Add(m);
            }
        }
        return new Gruppi(valori, ignorati);
    }

    /// <summary>
    /// create dell'originale: un blocco per valore, con codice_settore e, se c'e', codice_reparto
    /// ("56-03" -> settore 56 AND reparto 03). Null quando non ci sono regole: l'originale in quel caso
    /// cancellava il file e non ne scriveva un altro, cioe' "nessun limite".
    /// </summary>
    public static PolicyCorrezione? Crea(IEnumerable<string> gruppi)
    {
        var regole = new List<List<PolicyRegola>>();
        foreach (string g in gruppi)
        {
            string[] parti = g.Split('-');
            var blocco = new List<PolicyRegola>
            {
                new() { Field = "codice_settore", Inclusione = true, Valori = parti[0].Split(',') }
            };
            if (parti.Length > 1)
                blocco.Add(new() { Field = "codice_reparto", Inclusione = true, Valori = parti[1].Split(',') });
            regole.Add(blocco);
        }
        if (regole.Count == 0) return null;

        return new PolicyCorrezione
        {
            Regole = regole,
            Tool = TimbriDimensione.Select(t => new PolicyTool { Tipo = "timbro", Icona = t, Inclusione = false }).ToList(),
            MinVersion = 1
        };
    }

    /// <summary>Il JSON della policy con i nomi dell'originale (regole, tool, minVersion, field...).</summary>
    public static string Json(PolicyCorrezione policy) => JsonSerializer.Serialize(new
    {
        regole = policy.Regole.Select(b => b.Select(r => new { field = r.Field, inclusione = r.Inclusione, valori = r.Valori })),
        tool = policy.Tool.Select(t => new { tipo = t.Tipo, icona = t.Icona, inclusione = t.Inclusione }),
        minVersion = policy.MinVersion
    });
}
