using System;
using System.Collections.Generic;

namespace Correggo4.Models;

public partial class DemoneActivity
{
    public long Id { get; set; }

    public short TipoAzione { get; set; }

    public int? IdVol { get; set; }

    public long? IdNota { get; set; }

    public long? IdDisegno { get; set; }

    public long? IdPropagazione { get; set; }

    public long? IdElementoPropagazione { get; set; }

    public long? IdElemento { get; set; }

    public DateTime DataRegistrazione { get; set; }

    public DateTime? DataInizioProcesso { get; set; }

    public DateTime? DataProcesso { get; set; }

    public string? Errore { get; set; }

    public virtual VolantiniPagineDisegniComposizioni? IdDisegnoNavigation { get; set; }

    public virtual VolantiniPagineElementi? IdElementoNavigation { get; set; }

    public virtual VolantiniPropagazioniElementi? IdElementoPropagazioneNavigation { get; set; }

    public virtual VolantiniPagineNote? IdNotaNavigation { get; set; }

    public virtual VolantiniPropagazioni? IdPropagazioneNavigation { get; set; }

    public virtual Volantini? IdVolNavigation { get; set; }
}
