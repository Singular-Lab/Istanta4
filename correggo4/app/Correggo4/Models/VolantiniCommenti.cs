namespace Correggo4.Models;

/// <summary>
/// Un appunto generico su un volantino (j241): quello che si scrive dal bottone "Commenti" della
/// home. Non e' la chat di una correzione (`volantini_correzzioni_messaggistica`), che resta fuori.
/// </summary>
public partial class VolantiniCommenti
{
    public long Id { get; set; }
    public int IdVol { get; set; }
    public short IdAutore { get; set; }
    public string Testo { get; set; } = "";
    public DateTime Data { get; set; }
}
