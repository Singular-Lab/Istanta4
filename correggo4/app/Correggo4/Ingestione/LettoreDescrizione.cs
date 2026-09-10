using System.Text.RegularExpressions;
using Correggo4.Models.Vista;

namespace Correggo4.Ingestione;

/// <summary>
/// La descrizione arriva dal plug-in gia' marcata con i tag di stile InDesign,
/// del tipo &lt;DESCRIZIONE_TITOLO&gt;testo&lt;/DESCRIZIONE_TITOLO&gt;. Correggo
/// li colora: titolo giallo, brand magenta, grammatura viola, tipo ciano
/// (le classi stanno nel Main.aspx originale). I clienti hanno varianti col
/// suffisso, per esempio DESCRIZIONE_TITOLO_ETRURIA: si riconducono al tipo base.
/// </summary>
public static partial class LettoreDescrizione
{
    [GeneratedRegex(@"<(?<tag>[A-Z0-9_]+)>(?<testo>.*?)</\k<tag>>", RegexOptions.Singleline)]
    private static partial Regex Marcatore();

    private static readonly string[] TipiBase =
        { "DESCRIZIONE_TITOLO", "DESCRIZIONE_BRAND", "DESCRIZIONE_GRAMMATURA", "DESCRIZIONE_TIPO" };

    public static List<PezzoDescrizione> Leggi(string? grezza)
    {
        var pezzi = new List<PezzoDescrizione>();
        if (string.IsNullOrWhiteSpace(grezza)) return pezzi;

        int posizione = 0;
        foreach (Match m in Marcatore().Matches(grezza))
        {
            // Testo fuori dai tag: si mostra senza fascia.
            if (m.Index > posizione)
            {
                string fuori = grezza[posizione..m.Index].Trim();
                if (fuori.Length > 0) pezzi.Add(new PezzoDescrizione("", fuori));
            }

            string tag = m.Groups["tag"].Value;
            string testo = m.Groups["testo"].Value.Trim();
            if (testo.Length > 0) pezzi.Add(new PezzoDescrizione(Normalizza(tag), testo));

            posizione = m.Index + m.Length;
        }

        if (posizione < grezza.Length)
        {
            string coda = grezza[posizione..].Trim();
            if (coda.Length > 0) pezzi.Add(new PezzoDescrizione("", coda));
        }

        if (pezzi.Count == 0) pezzi.Add(new PezzoDescrizione("", grezza.Trim()));
        return pezzi;
    }

    private static string Normalizza(string tag)
    {
        foreach (string b in TipiBase)
            if (tag.StartsWith(b, StringComparison.Ordinal)) return b;
        return "";
    }
}
