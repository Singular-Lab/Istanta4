using System.Text.Json;
using Correggo4.Models;

namespace Correggo4.Servizi;

/// <summary>Cosa può fare un timbro quando si propaga (PolicyPropagazioneSimbolo dell'originale).</summary>
public sealed record PolicySimbolo(bool Propagabile, bool SoloStessaPromo, bool SoloStessoCanale);

/// <summary>
/// La regola dei gemelli del vecchio Correggo, in un solo posto (nell'originale stava in tre copie
/// divergenti: CostruttoreCatena.cs:450, Helper.cs:633, Worker.cs:2152 — vedi correggo-demoni.md).
/// Vale la versione del demone, la più restrittiva: due descrizioni vuote non fanno gemelli.
///
/// Differenza voluta rispetto all'originale (decisione di Michele del 14/9): un box **senza
/// basecode** non fa gemelli con nessuno. Nell'originale "" == "" passava il primo controllo e una
/// correzione poteva propagarsi a tutti i box senza codice.
/// </summary>
public static class Gemelli
{
    /// <summary>Soglie dell'originale: cardinalità minima 1/10, intersezione 50% sul pilota.</summary>
    public const decimal RapportoCardinalita = 0.1m;
    public const decimal SogliaIntersezione = 0.5m;

    /// <summary>
    /// Timbri di Famila che restano nella loro promo (decisione di Michele del 14/9): quelli che
    /// parlano di impaginazione. Nell'originale era la stessa idea con i nomi CoopFi
    /// (mod1, star, mezza, vedette, fv, tre4pag... Helper.cs:390-424).
    /// </summary>
    private static readonly HashSet<string> SoloPromo = new()
    {
        "_1_1_fvol",     // Fuori volantino
        "_2_1_artwork",  // ArtWork
        "_2_2_star",     // Star
        "_2_3_g1", "_2_4_g2", "_2_5_g3", "_2_6_g4"   // Gruppo 1-4
    };

    /// <summary>Nell'originale erano movPrec/movSucc: fra i timbri di Famila non c'è l'equivalente.</summary>
    private static readonly HashSet<string> SoloCanale = new();

    /// <summary>Nell'originale penna, pac e cestino non propagavano: fra i nostri timbri non ci sono.</summary>
    private static readonly HashSet<string> MaiPropagabili = new();

    public static PolicySimbolo Policy(string? simbolo)
    {
        string s = simbolo ?? "";
        if (MaiPropagabili.Contains(s)) return new PolicySimbolo(false, false, false);
        bool canale = SoloCanale.Contains(s);
        return new PolicySimbolo(true, canale || SoloPromo.Contains(s), canale);
    }

    /// <summary>Il "canale" dell'originale: i primi 3 caratteri del titolo (CostruttoreCatena.cs:283).</summary>
    public static string Canale(string? titolo)
    {
        string t = titolo ?? "";
        return t.Length >= 3 ? t[..3] : t;   // l'originale non si difendeva: un titolo corto lanciava eccezione
    }

    /// <summary>
    /// Il pilota e l'altro box sono lo stesso prodotto? Ordine dei controlli dell'originale.
    /// Attenzione: non è simmetrica (il 50% si calcola sui codici del pilota), come nell'originale.
    /// </summary>
    public static bool StessoDna(VolantiniPagineElementi pilota, VolantiniPagineElementi altro)
    {
        try
        {
            string b1 = (pilota.Basecode ?? "").Trim(), b2 = (altro.Basecode ?? "").Trim();
            if (b1.Length == 0 || b2.Length == 0) return false;   // scelta nostra: senza codice, niente catena
            if (b1 == b2) return true;

            var dna1 = LeggiDna(pilota.Dna);
            if (string.Equals(dna1.Gruppo, "grafica", StringComparison.OrdinalIgnoreCase)) return false;

            // Prefisso a lettera (A_123,456): l'altro deve avere la stessa lettera.
            if (b1.Contains('_'))
            {
                var p1 = b1.Split('_');
                if (p1[0].Length == 1)
                {
                    if (!b2.Contains('_')) return false;
                    var p2 = b2.Split('_');
                    if (p2[0].Length != 1 || p1[0] != p2[0]) return false;
                }
            }

            var c1 = b1.Split(',', StringSplitOptions.RemoveEmptyEntries);
            var c2 = b2.Split(',', StringSplitOptions.RemoveEmptyEntries);
            if (c1.Length == 0 || c2.Length == 0) return false;
            decimal massimo = Math.Max(c1.Length, c2.Length), minimo = Math.Min(c1.Length, c2.Length);
            if (minimo / massimo < RapportoCardinalita) return false;

            int presenti = c1.Count(x => c2.Contains(x));
            if ((decimal)presenti / c1.Length >= SogliaIntersezione) return true;

            // Ultima spiaggia: la stessa descrizione, senza spazi ne' andate a capo.
            string d1 = Normalizza(dna1.Descrizione), d2 = Normalizza(LeggiDna(altro.Dna).Descrizione);
            return d1.Length > 0 && d1 == d2;
        }
        catch (Exception ex) when (ex is JsonException or ArgumentException or FormatException)
        {
            return false;   // come l'originale: un DNA illeggibile non fa gemelli
        }
    }

    private static string Normalizza(string? s) =>
        (s ?? "").Replace("<br>", "").Replace("\r", "").Replace("\n", "").Replace(" ", "").Trim();

    private sealed record DnaBox(string? Codice, string? Gruppo, string? Descrizione);

    private static DnaBox LeggiDna(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new DnaBox(null, null, null);
        using var d = JsonDocument.Parse(json);
        if (d.RootElement.ValueKind != JsonValueKind.Object) return new DnaBox(null, null, null);
        string? Testo(string nome) => d.RootElement.TryGetProperty(nome, out var v) && v.ValueKind == JsonValueKind.String
            ? v.GetString() : null;
        return new DnaBox(Testo("codice"), Testo("gruppo"), Testo("descrizione"));
    }
}
