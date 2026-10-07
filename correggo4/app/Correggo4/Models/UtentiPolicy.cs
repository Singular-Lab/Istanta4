namespace Correggo4.Models;

/// <summary>
/// La policy di correzione di un utente (j235): il contenuto del file `policy/&lt;idUtente&gt;.json`
/// del Correggo originale, spostato in banca dati. Chi non ha riga non ha limiti.
/// </summary>
public partial class UtentiPolicy
{
    public short IdUtente { get; set; }

    /// <summary>JSON con la stessa forma dell'originale: `regole`, `tool`, `minVersion`.</summary>
    public string Policy { get; set; } = "";

    /// <summary>A memoria di chi l'ha scritta e perche' (l'originale non aveva niente del genere).</summary>
    public string Nota { get; set; } = "";

    public DateTime DataModifica { get; set; }
}
