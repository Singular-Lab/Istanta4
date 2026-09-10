using System;
using System.Collections.Generic;

namespace Correggo4.Models;

public partial class VolantiniNotificheEmail
{
    public long Id { get; set; }

    public int IdNotifica { get; set; }

    public string Oggetto { get; set; } = null!;

    public string Messaggio { get; set; } = null!;

    public DateTime? DataInvio { get; set; }

    public virtual VolantiniNotifiche IdNotificaNavigation { get; set; } = null!;
}
