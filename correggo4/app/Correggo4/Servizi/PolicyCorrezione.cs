using System.Text.Json;

namespace Correggo4.Servizi;

/// <summary>
/// La **policy di correzione** del Correggo originale (`Helper.cs:269-346`), portata così com'è.
///
/// Diceva, per un singolo utente, su quali prodotti poteva lavorare. Nell'originale stava in un
/// file per utente (`policy/&lt;idUtente&gt;.json`), scritto all'ingresso da
/// `PolicyManager.CoopFi.create`: i gruppi dell'SSO passavano per un dizionario cablato di ~65
/// reparti (del tipo "OCFOPLSGS" → 56-03, 56-04) e diventavano coppie settore/reparto.
/// In Correggo4 il contenuto è identico ma sta in banca dati (tabella `utenti_policy`), come era
/// già stato deciso il 3/9 ("in riscrittura le policy vanno su database, non su file").
///
/// - `regole`: blocchi in **OR**, e dentro ogni blocco condizioni in **AND**, sui campi del
///   tracciato del prodotto (`codice_settore`, `codice_reparto`, `Referenza.Codice`…) oppure sul
///   numero di pagina (`Container.pag`);
/// - `tool`: strumenti esclusi (all'originale servivano per togliere ai Category i quattro timbri
///   di dimensione `_3_*`);
/// - `minVersion`: la versione minima dei volantini che l'utente può vedere.
///
/// Chi **non** ha una policy non ha limiti: era così nell'originale (Marketing e Agenzia non
/// avevano il file) e resta così.
/// </summary>
public sealed class PolicyCorrezione
{
    public List<List<PolicyRegola>> Regole { get; set; } = new();
    public List<PolicyTool> Tool { get; set; } = new();
    public byte MinVersion { get; set; }

    private static readonly JsonSerializerOptions Opzioni = new()
    {
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true
    };

    /// <summary>Null se il JSON non c'è o non si legge (= nessun limite, come l'originale).</summary>
    public static PolicyCorrezione? Leggi(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            return JsonSerializer.Deserialize<PolicyCorrezione>(json, Opzioni);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    /// <summary>
    /// Nessuna regola = nessun limite. **Scostamento voluto dall'originale**: lì `check` con
    /// `regole` vuote cadeva in fondo e restituiva `false`, cioè "non puoi toccare niente", e il
    /// `try/catch` che ingoiava tutto rendeva il caso indistinguibile da un dato rotto (è una delle
    /// trappole segnate in `correggo-mappa-funzionale.md` §8). `PolicyManager` non scriveva mai il
    /// file senza regole, quindi in pratica non accadeva: qui una riga senza regole vale come
    /// "nessuna policy" invece di chiudere fuori l'utente.
    /// </summary>
    public bool SenzaRegole => Regole.Count == 0 || Regole.All(b => b.Count == 0);

    /// <summary>
    /// La verifica dell'originale, prodotto per prodotto: lo schema è quello del box radice
    /// (`SchemaReferenza.Leggi(elemento.Contenuto)`, cioè l'`itemRefStringfied` dell'originale) e
    /// `numeroPagina` è il numero della pagina su cui sta.
    /// Un blocco è valido se **tutte** le sue condizioni passano; basta un blocco valido.
    /// Come nell'originale, una condizione su un campo che il prodotto non ha **non viene
    /// valutata** (il blocco resta valido), e un prodotto senza schema non passa.
    /// </summary>
    public bool Check(SchemaReferenza? schema, short numeroPagina)
    {
        if (SenzaRegole) return true;
        if (schema == null) return false;

        foreach (var blocco in Regole)
        {
            bool bloccoValido = true;
            foreach (var regola in blocco)
            {
                if (regola.Field.StartsWith("Container.", StringComparison.Ordinal))
                {
                    if (regola.Field == "Container.pag")
                    {
                        string mia = numeroPagina.ToString();
                        if (regola.Inclusione && !regola.Valori.Contains(mia)) bloccoValido = false;
                        else if (!regola.Inclusione && regola.Valori.Contains(mia)) bloccoValido = false;
                    }
                }
                else if (schema.Originali.TryGetValue(SchemaReferenza.ChiaveTracciato(regola.Field), out var valore))
                {
                    if (regola.Inclusione && !regola.Valori.Contains(valore)) bloccoValido = false;
                    else if (!regola.Inclusione && regola.Valori.Contains(valore)) bloccoValido = false;
                }
                if (!bloccoValido) break;
            }
            if (bloccoValido) return true;
        }
        return false;
    }

    /// <summary>
    /// Uno strumento è permesso se la policy non lo esclude (`inclusione = false` sul suo nome).
    /// Serve al passo 3 (timbri); qui c'è già perché la forma della policy è quella dell'originale.
    /// </summary>
    public bool StrumentoPermesso(string tipo, string icona) =>
        !Tool.Any(t => !t.Inclusione
                       && string.Equals(t.Icona, icona, StringComparison.OrdinalIgnoreCase)
                       && (t.Tipo == "" || string.Equals(t.Tipo, tipo, StringComparison.OrdinalIgnoreCase)));
}

public sealed class PolicyRegola
{
    public string Field { get; set; } = "";
    public bool Inclusione { get; set; }
    public string[] Valori { get; set; } = Array.Empty<string>();
}

public sealed class PolicyTool
{
    /// <summary>Nell'originale "disegno" o "timbro", a seconda di chi scriveva il file.</summary>
    public string Tipo { get; set; } = "";
    public string Icona { get; set; } = "";
    public bool Inclusione { get; set; }
}
