using System;
using System.Collections.Generic;

namespace Correggo4.Models;

public partial class VolantiniCorrezzioniMessaggistica
{
    public long Id { get; set; }

    public long? IdParent { get; set; }

    public long? IdNota { get; set; }

    public long? IdDisegno { get; set; }

    public long? IdPropagato { get; set; }

    public short? IdAutore { get; set; }

    public string Messaggio { get; set; } = null!;

    public string? Tags { get; set; }

    public short Stato { get; set; }

    public DateTime DataRegistrazione { get; set; }

    public DateTime? DataInvioEmailProgrammata { get; set; }

    public DateTime? DataInvioEmail { get; set; }

    public virtual Utenti? IdAutoreNavigation { get; set; }

    public virtual VolantiniPagineDisegniComposizioni? IdDisegnoNavigation { get; set; }

    public virtual VolantiniPagineNote? IdNotaNavigation { get; set; }

    public virtual VolantiniCorrezzioniMessaggistica? IdParentNavigation { get; set; }

    public virtual VolantiniPropagazioniElementi? IdPropagatoNavigation { get; set; }

    public virtual ICollection<VolantiniCorrezzioniMessaggistica> InverseIdParentNavigation { get; set; } = new List<VolantiniCorrezzioniMessaggistica>();
}
