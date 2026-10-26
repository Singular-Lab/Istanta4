using System;
using System.Collections.Generic;

namespace Correggo4.Models;

public partial class Notifiche
{
    public long Id { get; set; }

    public short IdUtente { get; set; }

    public long? IdNota { get; set; }

    public long? IdDisegno { get; set; }

    public long? IdPropagazioneElemento { get; set; }

    public int? IdVolantino { get; set; }

    public string? Tag { get; set; }

    public short Stato { get; set; }

    public DateTime DataRegistrazione { get; set; }

    public DateTime? DataLettura { get; set; }

    public DateTime? DataModifica { get; set; }

    public virtual VolantiniPagineDisegniComposizioni? IdDisegnoNavigation { get; set; }

    public virtual VolantiniPagineNote? IdNotaNavigation { get; set; }

    public virtual VolantiniPropagazioniElementi? IdPropagazioneElementoNavigation { get; set; }

    public virtual Utenti IdUtenteNavigation { get; set; } = null!;

    public virtual Volantini? IdVolantinoNavigation { get; set; }
}
