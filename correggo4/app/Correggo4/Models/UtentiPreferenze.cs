using System;
using System.Collections.Generic;

namespace Correggo4.Models;

public partial class UtentiPreferenze
{
    public short Id { get; set; }

    public short IdUtente { get; set; }

    public string Cartella { get; set; } = null!;

    public DateTime DataSalvataggio { get; set; }

    public virtual Utenti IdUtenteNavigation { get; set; } = null!;
}
