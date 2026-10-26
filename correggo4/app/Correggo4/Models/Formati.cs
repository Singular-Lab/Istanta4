using System;
using System.Collections.Generic;

namespace Correggo4.Models;

public partial class Formati
{
    public short Id { get; set; }

    public string Nome { get; set; } = null!;

    public decimal WReale { get; set; }

    public decimal WEsportazione { get; set; }

    public decimal Coefficiente { get; set; }

    public virtual ICollection<Volantini> Volantinis { get; set; } = new List<Volantini>();
}
