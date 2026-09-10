using System;
using System.Collections.Generic;

namespace Correggo4.Models;

public partial class VolantiniPagineDisegniComposizioni
{
    public long Id { get; set; }

    public int IdPagina { get; set; }

    public long? IdElemento { get; set; }

    public string Simbolo { get; set; } = null!;

    public string? Color { get; set; }

    public short Border { get; set; }

    public short Stato { get; set; }

    public short IdAutore { get; set; }

    public DateTime DataInserimento { get; set; }

    public short? IdCorrettore { get; set; }

    public DateTime? DataCorrezione { get; set; }

    public short? IdRevisore { get; set; }

    public DateTime? DataRevisione { get; set; }

    public virtual ICollection<DemoneActivity> DemoneActivities { get; set; } = new List<DemoneActivity>();

    public virtual Utenti IdAutoreNavigation { get; set; } = null!;

    public virtual Utenti? IdCorrettoreNavigation { get; set; }

    public virtual VolantiniPagineElementi? IdElementoNavigation { get; set; }

    public virtual VolantiniPagine IdPaginaNavigation { get; set; } = null!;

    public virtual Utenti? IdRevisoreNavigation { get; set; }

    public virtual ICollection<Notifiche> Notifiches { get; set; } = new List<Notifiche>();

    public virtual ICollection<VolantiniCorrezzioniMessaggistica> VolantiniCorrezzioniMessaggisticas { get; set; } = new List<VolantiniCorrezzioniMessaggistica>();

    public virtual ICollection<VolantiniPagineDisegni> VolantiniPagineDisegnis { get; set; } = new List<VolantiniPagineDisegni>();

    public virtual ICollection<VolantiniPropagazioni> VolantiniPropagazionis { get; set; } = new List<VolantiniPropagazioni>();
}
