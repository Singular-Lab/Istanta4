using System;
using System.Collections.Generic;

namespace Correggo4.Models;

public partial class VolantiniPagineElementiVersioni
{
    public long Id { get; set; }

    public long IdElemento { get; set; }

    public int? IdPagina { get; set; }

    public long? IdElementoPropagazione { get; set; }

    public decimal NewPosx { get; set; }

    public decimal NewPosy { get; set; }

    public decimal? NewWidth { get; set; }

    public decimal? NewHeight { get; set; }

    public string NuovaVersione { get; set; } = null!;

    public DateTime DataModifica { get; set; }

    public short IdAutore { get; set; }

    public short Stato { get; set; }

    public virtual Utenti IdAutoreNavigation { get; set; } = null!;

    public virtual VolantiniPagineElementi IdElementoNavigation { get; set; } = null!;

    public virtual VolantiniPropagazioniElementi? IdElementoPropagazioneNavigation { get; set; }

    public virtual VolantiniPagine? IdPaginaNavigation { get; set; }
}
