using System;
using System.Collections.Generic;

namespace Correggo4.Models;

public partial class VolantiniPostit
{
    public long Id { get; set; }

    public int IdVolantino { get; set; }

    public short VersioneVol { get; set; }

    public string Messaggio { get; set; } = null!;

    public short IdAutore { get; set; }

    public short Stato { get; set; }

    public DateTime DataRegistrazione { get; set; }

    public virtual Utenti IdAutoreNavigation { get; set; } = null!;

    public virtual Volantini IdVolantinoNavigation { get; set; } = null!;
}
