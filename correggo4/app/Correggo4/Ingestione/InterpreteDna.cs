using System.Text.Json;

namespace Correggo4.Ingestione;

public sealed record DnaInterpretato(string Codice, string Gruppo, string Descrizione);

/// <summary>
/// L'interpretazione di dna / basecode / gruppo, portata alla lettera da
/// CorreggoWebPublisher/Worker.cs:947-1003 (identica a Worker.cs:1691-1752).
///
/// NOTA IMPORTANTE: nel sistema originale questa logica esiste in TRE copie
/// divergenti (Helper.cs dell'app web, Worker.cs del publisher,
/// CostruttoreCatena.cs del demone). Qui deve restare UNA SOLA: qualunque
/// componente ne abbia bisogno passa da qui.
/// </summary>
public static class InterpreteDna
{
    public const string GruppoGrafica = "grafica";

    public static DnaInterpretato Interpreta(string? dnaGrezzo, string? dnaGruppo, string? descrizione = null)
    {
        string dna = dnaGrezzo ?? "";
        string dnaGruppoOriginale = dnaGruppo ?? "";

        // 1. Se dna_gruppo e' valorizzato, sovrascrive dna (Worker.cs:948-952).
        if (!string.IsNullOrEmpty(dnaGruppoOriginale))
            dna = dnaGruppoOriginale;

        // 2. Se dna e' un JSON, il codice vero sta in "codice_gruppo" (Worker.cs:963-970).
        //    Commento originale: "Prendendo codice_gruppo, mi assicuro di prendere il
        //    codice completo. Se si tratta di un singolo, codice=codice_gruppo".
        if (dna.Contains('{'))
        {
            try
            {
                var dizionario = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(dna);
                if (dizionario != null && dizionario.TryGetValue("codice_gruppo", out var cg))
                    dna = cg.ToString();
            }
            catch (JsonException)
            {
                // L'originale non gestisce questo caso: teniamo il dna grezzo.
            }
        }

        string codice;
        string gruppo;

        if (!string.IsNullOrEmpty(dnaGruppoOriginale))
        {
            // Codice e gruppo finiscono uguali: e' cosi' anche nell'originale.
            codice = dna;
            gruppo = dnaGruppoOriginale;
        }
        else if (dna.Contains(','))
        {
            // Il primo token e' il gruppo; il resto e' il codice, eventualmente
            // riprefissato con la parte prima del primo '_' del gruppo.
            // Commento originale: "Si tratta di uno scatto composto da ref con identico
            // DNA che vanno differenziate usando proprio il prefisso differenziale".
            string gruppoDna = dna.Split(',')[0];
            string prefissoScatto = "";
            if (gruppoDna.IndexOf('_') > 0)
                prefissoScatto = gruppoDna.Split('_')[0] + "_";

            codice = dna.Replace(gruppoDna + ",", prefissoScatto);
            gruppo = gruppoDna;
        }
        else
        {
            // Senza virgola non c'e' gruppo: e' un elemento grafico, e per
            // costruzione non propaghera' mai per euristica.
            codice = dna;
            gruppo = GruppoGrafica;
        }

        return new DnaInterpretato(codice, gruppo, descrizione ?? "");
    }

    /// <summary>
    /// label_ind: il codice troncato a 22 caratteri + "..." se supera i 25
    /// (Worker.cs:1755-1758).
    /// </summary>
    public static string EtichettaDaCodice(string codice)
        => codice.Length > 25 ? codice[..22] + "..." : codice;
}
