using System;
using System.Collections.Generic;

namespace Correggo4.Models;

public partial class VolantiniPagineDisegni
{
    public long Id { get; set; }

    public long IdGruppo { get; set; }

    public string Vectors { get; set; } = null!;

    public virtual VolantiniPagineDisegniComposizioni IdGruppoNavigation { get; set; } = null!;
}
