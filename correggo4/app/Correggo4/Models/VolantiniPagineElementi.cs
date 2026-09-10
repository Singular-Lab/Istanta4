using System;
using System.Collections.Generic;

namespace Correggo4.Models;

public partial class VolantiniPagineElementi
{
    public long Id { get; set; }

    public int IdPagina { get; set; }

    public long? IdParent { get; set; }

    public short Tipo { get; set; }

    public string LabelInd { get; set; } = null!;

    public string Basecode { get; set; } = null!;

    public string? Dna { get; set; }

    public string Contenuto { get; set; } = null!;

    public short ZIndex { get; set; }

    public decimal PosizioneX { get; set; }

    public decimal PosizioneY { get; set; }

    public decimal Larghezza { get; set; }

    public decimal Altezza { get; set; }

    public short Stato { get; set; }

    public DateTime? UltimoCambiamento { get; set; }

    public DateTime? DataOk { get; set; }

    public short? IdAutoreOk { get; set; }

    public short Contatore { get; set; }

    public short ContatoreConferme { get; set; }

    public virtual ICollection<DemoneActivity> DemoneActivities { get; set; } = new List<DemoneActivity>();

    public virtual Utenti? IdAutoreOkNavigation { get; set; }

    public virtual VolantiniPagine IdPaginaNavigation { get; set; } = null!;

    public virtual VolantiniPagineElementi? IdParentNavigation { get; set; }

    public virtual ICollection<VolantiniPagineElementi> InverseIdParentNavigation { get; set; } = new List<VolantiniPagineElementi>();

    public virtual ICollection<VolantiniPagineDisegniComposizioni> VolantiniPagineDisegniComposizionis { get; set; } = new List<VolantiniPagineDisegniComposizioni>();

    public virtual ICollection<VolantiniPagineElementiVersioni> VolantiniPagineElementiVersionis { get; set; } = new List<VolantiniPagineElementiVersioni>();

    public virtual ICollection<VolantiniPagineNote> VolantiniPagineNotes { get; set; } = new List<VolantiniPagineNote>();

    public virtual ICollection<VolantiniPropagazioniElementi> VolantiniPropagazioniElementis { get; set; } = new List<VolantiniPropagazioniElementi>();
}
