using System;
using System.Collections.Generic;

namespace Correggo4.Models;

public partial class VolantiniPagineNote
{
    public long Id { get; set; }

    public int IdPagina { get; set; }

    public long? IdElemento { get; set; }

    public short Tipo { get; set; }

    public string Descrizione { get; set; } = null!;

    public double Posx { get; set; }

    public double Posy { get; set; }

    public string? RefRegion { get; set; }

    public string? RefLabel { get; set; }

    public string? AllegatoKey { get; set; }

    public short Stato { get; set; }

    public short? IdAutore { get; set; }

    public DateTime DataInserimento { get; set; }

    public DateTime? DataModifica { get; set; }

    public short? IdCorrettore { get; set; }

    public DateTime? DataCorrezione { get; set; }

    public short? IdRevisore { get; set; }

    public DateTime? DataRevisione { get; set; }

    public virtual ICollection<DemoneActivity> DemoneActivities { get; set; } = new List<DemoneActivity>();

    public virtual Utenti? IdAutoreNavigation { get; set; }

    public virtual Utenti? IdCorrettoreNavigation { get; set; }

    public virtual VolantiniPagineElementi? IdElementoNavigation { get; set; }

    public virtual VolantiniPagine IdPaginaNavigation { get; set; } = null!;

    public virtual Utenti? IdRevisoreNavigation { get; set; }

    public virtual ICollection<Notifiche> Notifiches { get; set; } = new List<Notifiche>();

    public virtual ICollection<VolantiniCorrezzioniMessaggistica> VolantiniCorrezzioniMessaggisticas { get; set; } = new List<VolantiniCorrezzioniMessaggistica>();

    public virtual ICollection<VolantiniPropagazioni> VolantiniPropagazionis { get; set; } = new List<VolantiniPropagazioni>();
}
