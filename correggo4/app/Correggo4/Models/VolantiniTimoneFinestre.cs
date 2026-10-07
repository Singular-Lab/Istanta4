using System;

namespace Correggo4.Models;

/// <summary>
/// La finestra del Marketing sul TIMONE (j251), per PROMO come quella dei Category
/// (decisione di Michele del 28/09).
///
/// Mentre è aperta scrive il Marketing e l'Agenzia guarda; quando è chiusa il Marketing non
/// tocca più niente e può correggere l'Agenzia.
/// </summary>
public partial class VolantiniTimoneFinestre
{
    public string Classificazione { get; set; } = null!;

    public DateTime DataInizio { get; set; }

    public DateTime DataFine { get; set; }

    /// <summary>Chi l'ha aperta: l'Agenzia.</summary>
    public short IdAutore { get; set; }

    public DateTime DataModifica { get; set; }
}
