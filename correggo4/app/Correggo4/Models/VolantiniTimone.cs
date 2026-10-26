using System;

namespace Correggo4.Models;

/// <summary>
/// Il piano del TIMONE (j251): la rimpaginazione che il Marketing propone su un volantino già
/// impaginato. Uno per volantino e versione.
///
/// Il piano è uno STRATO A PARTE: non tocca mai i box veri
/// (<c>volantini_pagine_elementi</c>), perché a quelli puntano note, timbri, OK visto, Edit
/// avanzato e propagazioni. Vedi claude/timone-specifica.md §2.1.
/// </summary>
public partial class VolantiniTimone
{
    public long Id { get; set; }

    public int IdVol { get; set; }

    /// <summary>La versione del volantino che è stata fotografata.</summary>
    public short Versione { get; set; }

    /// <summary>0 = in lavorazione · 1 = chiuso al Marketing · 2 = esportato.</summary>
    public short Stato { get; set; }

    /// <summary>Sale di uno a ogni salvataggio: impedisce che due persone si sovrascrivano.</summary>
    public int Revisione { get; set; }

    public DateTime DataCreazione { get; set; }

    public DateTime? DataModifica { get; set; }

    public DateTime? DataSalvataggio { get; set; }

    /// <summary>Chi ha aperto il piano: l'Agenzia.</summary>
    public short IdAutore { get; set; }

    public short? IdUltimoSalvataggio { get; set; }

    /// <summary>
    /// Quando l'Agenzia ha premuto FATTO, cioè ha detto «ho riportato sull'impaginato quello che
    /// il Marketing ha chiesto col timone» (j317). Vuoto = non l'ha ancora fatto.
    ///
    /// È una DATA e non un sì/no di proposito: se dopo il «fatto» il Marketing salva di nuovo, il
    /// confronto con <c>DataSalvataggio</c> fa tornare da sé l'avviso nella home. Con un sì/no
    /// resterebbe spento e il lavoro nuovo non lo vedrebbe nessuno.
    /// </summary>
    public DateTime? DataSistemato { get; set; }

    /// <summary>Chi ha premuto FATTO. Vuoto finché nessuno l'ha premuto.</summary>
    public short? IdSistemato { get; set; }
}
