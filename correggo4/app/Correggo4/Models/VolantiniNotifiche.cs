using System;
using System.Collections.Generic;

namespace Correggo4.Models;

public partial class VolantiniNotifiche
{
    public int Id { get; set; }

    public int IdVolantino { get; set; }

    public DateTime? DataUltimaCorrezione { get; set; }

    public DateTime? DataUltimaEmail { get; set; }

    public virtual Volantini IdVolantinoNavigation { get; set; } = null!;

    public virtual ICollection<VolantiniNotificheEmail> VolantiniNotificheEmails { get; set; } = new List<VolantiniNotificheEmail>();
}
