using System;
using System.Collections.Generic;

namespace Correggo4.Models;

public partial class VolantiniRevisione
{
    public int Id { get; set; }

    public int IdVolantino { get; set; }

    public DateTime DataEsportazione { get; set; }

    public DateTime? DataRicezione { get; set; }

    public string? PdfKey { get; set; }

    public string? CorrezioniKey { get; set; }

    public virtual Volantini IdVolantinoNavigation { get; set; } = null!;
}
