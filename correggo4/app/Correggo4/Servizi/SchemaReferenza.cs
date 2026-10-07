using System.Globalization;
using System.Text.Json;

namespace Correggo4.Servizi;

/// <summary>
/// Lo schema di una referenza, cioe' cosa l'Edit avanzato permette di correggere su un prodotto.
///
/// Lo scrive il plugin InDesign all'esportazione (plugin/ficoProcess.js ~1886-1985, dai cambi
/// strutturali del kit) e l'ingestione lo salva intero nel contenuto del box radice
/// (volantini_pagine_elementi.contenuto; completo di istruzioni dal job j193 dell'11/9/2026):
///
///   { boxName, itemRefStringfied, bounds, pag,
///     azioni: [ { id, titolo, compiledValue, labelIndd, bounds,
///                 istruzioni: [ { tipoDato, field, valore[], autocomplete, primary, triggerActionId } ] } ] }
///
/// Regole del plugin e dell'originale (Scripts/correzioni.js 2425-2500 e 2940-3005):
///  - labelIndd "base": azione sul box intero (le "Altre azioni"); "descrizione" e "immagine" hanno
///    colonne loro; ogni altra label e' un campo della colonna prezzi;
///  - valore con UN elemento: valore fisso che l'azione imposta; nessun elemento: lo scrive
///    l'utente; piu' elementi: si sceglie fra quelli.
///  - i campi delle istruzioni usano "$" dove il tracciato usa "." (Descrizioni$Peso / Descrizioni.Peso).
/// </summary>
public sealed class SchemaReferenza
{
    public const string LabelBase = "base";
    public const string LabelDescrizione = "descrizione";
    public const string LabelImmagine = "immagine";

    public string NomeBox { get; init; } = "";
    public List<AzioneReferenza> Azioni { get; init; } = new();

    /// <summary>I valori del tracciato (itemRefStringfied), con le chiavi del tracciato (col punto).</summary>
    public Dictionary<string, string> Originali { get; init; } = new(StringComparer.Ordinal);

    /// <summary>Azioni sui campi della colonna prezzi.</summary>
    public IEnumerable<AzioneReferenza> AzioniCampo =>
        Azioni.Where(a => a.LabelIndd != "" && a.LabelIndd != LabelBase
                          && a.LabelIndd != LabelDescrizione && a.LabelIndd != LabelImmagine);

    /// <summary>Azioni sul box intero: il menu "Altre azioni".</summary>
    public IEnumerable<AzioneReferenza> AzioniBase => Azioni.Where(a => a.LabelIndd == LabelBase);

    public static string ChiaveTracciato(string field) => field.Replace('$', '.');
    public static string ChiaveIstruzione(string field) => field.Replace('.', '$');

    public string Originale(string field) =>
        Originali.TryGetValue(ChiaveTracciato(field), out var v) ? v : "";

    /// <summary>Null se il contenuto non e' uno schema (box senza pacchetto, JSON rotto).</summary>
    public static SchemaReferenza? Leggi(string? contenuto)
    {
        if (string.IsNullOrWhiteSpace(contenuto) || contenuto.TrimStart()[0] != '{') return null;
        try
        {
            using var d = JsonDocument.Parse(contenuto);
            var radice = d.RootElement;
            if (radice.ValueKind != JsonValueKind.Object) return null;

            var schema = new SchemaReferenza
            {
                NomeBox = Testo(radice, "boxName")
            };

            string interno = Testo(radice, "itemRefStringfied");
            if (interno.TrimStart().StartsWith('{'))
            {
                try
                {
                    using var d2 = JsonDocument.Parse(interno);
                    foreach (var p in d2.RootElement.EnumerateObject())
                        schema.Originali[p.Name] = Scalare(p.Value);
                }
                catch (JsonException) { }
            }

            if (radice.TryGetProperty("azioni", out var az) && az.ValueKind == JsonValueKind.Array)
            {
                foreach (var a in az.EnumerateArray())
                {
                    if (a.ValueKind != JsonValueKind.Object) continue;
                    var azione = new AzioneReferenza
                    {
                        Id = a.TryGetProperty("id", out var id) && id.ValueKind == JsonValueKind.Number
                             && id.TryGetInt32(out int n) ? n : 0,
                        Titolo = Testo(a, "titolo"),
                        LabelIndd = Testo(a, "labelIndd")
                    };
                    if (a.TryGetProperty("istruzioni", out var ist) && ist.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var i in ist.EnumerateArray())
                        {
                            if (i.ValueKind != JsonValueKind.Object) continue;
                            string field = Testo(i, "field");
                            if (field == "") continue;
                            var istr = new IstruzioneReferenza { Field = field, TipoDato = Testo(i, "tipoDato") };
                            if (i.TryGetProperty("valore", out var v) && v.ValueKind == JsonValueKind.Array)
                                foreach (var x in v.EnumerateArray()) istr.Valore.Add(Scalare(x));
                            azione.Istruzioni.Add(istr);
                        }
                    }
                    schema.Azioni.Add(azione);
                }
            }
            return schema;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static string Testo(JsonElement e, string nome) =>
        e.TryGetProperty(nome, out var v) ? Scalare(v) : "";

    private static string Scalare(JsonElement v) => v.ValueKind switch
    {
        JsonValueKind.String => v.GetString() ?? "",
        JsonValueKind.Number => v.GetRawText(),
        JsonValueKind.True => "true",
        JsonValueKind.False => "false",
        JsonValueKind.Null or JsonValueKind.Undefined => "",
        _ => v.GetRawText()
    };
}

public sealed class AzioneReferenza
{
    public int Id { get; set; }
    public string Titolo { get; set; } = "";
    public string LabelIndd { get; set; } = "";
    public List<IstruzioneReferenza> Istruzioni { get; set; } = new();
}

public sealed class IstruzioneReferenza
{
    public string Field { get; set; } = "";
    public string TipoDato { get; set; } = "";
    public List<string> Valore { get; set; } = new();

    /// <summary>Valore imposto dall'azione (correzioni.js:2972: valore.length == 1).</summary>
    public bool Fisso => Valore.Count == 1;

    /// <summary>Si sceglie fra piu' valori (select).</summary>
    public bool Scelta => Valore.Count > 1;

    public bool Numero => TipoDato == "number";

    public static bool ProvaNumero(string? s, out decimal valore)
    {
        string t = (s ?? "").Replace("€", "").Replace(" ", "").Replace(',', '.').Trim();
        return decimal.TryParse(t, NumberStyles.Number, CultureInfo.InvariantCulture, out valore);
    }
}
