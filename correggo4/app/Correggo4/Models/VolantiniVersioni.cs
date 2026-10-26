using System;
using System.Collections.Generic;

namespace Correggo4.Models;

public partial class VolantiniVersioni
{
    public long Id { get; set; }

    public int IdVol { get; set; }

    public short Versione { get; set; }

    public DateTime DataPubblicazione { get; set; }

    public DateTime? DataChiusura { get; set; }

    /// <summary>
    /// Sostituisce il &quot;versione = 0&quot; dell&apos;originale (vedi RevocaVersioneVol)
    /// </summary>
    public bool DaRevocare { get; set; }

    public virtual Volantini IdVolNavigation { get; set; } = null!;

    public virtual ICollection<VolantiniPagine> VolantiniPagines { get; set; } = new List<VolantiniPagine>();
}
