namespace Correggo4.Models;

/// <summary>
/// Finestra temporale dei Category per una promo (classificazione), impostata dall'Agenzia in
/// "Gestisci promo". Nell'originale era il file policy/&lt;classificazione&gt;.json con IdVol = 0
/// (Service.cs setFinestraTemporale); qui una riga per promo. Date in UTC.
/// </summary>
public partial class VolantiniFinestreCategory
{
    public string Classificazione { get; set; } = null!;
    public DateTime DataInizio { get; set; }
    public DateTime DataFine { get; set; }
    public short? IdAutore { get; set; }
    public DateTime DataModifica { get; set; }
}
