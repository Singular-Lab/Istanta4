using System;
using System.Collections.Generic;

namespace Istanta.Models
{
    public partial class AttivitaLog
    {
        public long Id { get; set; }
        public long IdAttivita { get; set; }
        public DateTime DataRegistrazione { get; set; }
        public byte Tipo { get; set; }
        public string Note { get; set; } = null!;

        public virtual Attivitum IdAttivitaNavigation { get; set; } = null!;
    }
}
