using System;
using System.Collections.Generic;

namespace Correggo4.Models;

public partial class VolantiniPropagazioni
{
    public long Id { get; set; }

    public long? IdNotaMaster { get; set; }

    public long? IdDisegnoMaster { get; set; }

    public DateTime DataRegistrazione { get; set; }

    public bool Visto { get; set; }

    public DateTime? DataVisto { get; set; }

    public short Attivo { get; set; }

    public virtual ICollection<DemoneActivity> DemoneActivities { get; set; } = new List<DemoneActivity>();

    public virtual VolantiniPagineDisegniComposizioni? IdDisegnoMasterNavigation { get; set; }

    public virtual VolantiniPagineNote? IdNotaMasterNavigation { get; set; }

    public virtual ICollection<VolantiniPropagazioniElementi> VolantiniPropagazioniElementis { get; set; } = new List<VolantiniPropagazioniElementi>();
}
