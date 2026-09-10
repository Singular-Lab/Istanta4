using System;
using System.Collections.Generic;

namespace Correggo4.Models;

public partial class VolantiniPagine
{
    public int Id { get; set; }

    public int IdVol { get; set; }

    public long? IdVersione { get; set; }

    public short Numero { get; set; }

    public short Versione { get; set; }

    public decimal Sinistra { get; set; }

    public decimal Alto { get; set; }

    public decimal Larghezza { get; set; }

    public decimal Altezza { get; set; }

    public decimal? RapportoX { get; set; }

    public decimal? RapportoY { get; set; }

    public decimal? MargineEsterno { get; set; }

    public string Path { get; set; } = null!;

    public string? PathFisico { get; set; }

    public string? Mastro { get; set; }

    public short Stato { get; set; }

    public DateTime DataVersione { get; set; }

    public DateTime? UltimoAggiornamento { get; set; }

    public DateTime? UltimaVisita { get; set; }

    public short Contatore { get; set; }

    public short ContatoreConferme { get; set; }

    public virtual VolantiniVersioni? IdVersioneNavigation { get; set; }

    public virtual Volantini IdVolNavigation { get; set; } = null!;

    public virtual ICollection<VolantiniPagineDisegniComposizioni> VolantiniPagineDisegniComposizionis { get; set; } = new List<VolantiniPagineDisegniComposizioni>();

    public virtual ICollection<VolantiniPagineElementiVersioni> VolantiniPagineElementiVersionis { get; set; } = new List<VolantiniPagineElementiVersioni>();

    public virtual ICollection<VolantiniPagineElementi> VolantiniPagineElementis { get; set; } = new List<VolantiniPagineElementi>();

    public virtual ICollection<VolantiniPagineNote> VolantiniPagineNotes { get; set; } = new List<VolantiniPagineNote>();
}
