using Istanta.Models_2;
using System;
using System.Collections.Generic;

namespace Istanta.Models
{
    public partial class Attivitum
    {
        public Attivitum()
        {
            AttivitaLogs = new HashSet<AttivitaLog>();
        }

        public long Id { get; set; }
        public long? IdParent { get; set; }
        public short? IdUtente { get; set; }
        public byte Coda { get; set; }
        public string Titolo { get; set; } = null!;
        public string Contract { get; set; } = null!;
        public DateTime DataInserimento { get; set; }
        public byte Tipo { get; set; }
        public byte TipoProcesso { get; set; }
        public byte Stato { get; set; }
        public short Progress { get; set; }
        public string? StatoMsg { get; set; }
        public DateTime? DataFine { get; set; }
        public DateTime? DataInizio { get; set; }
        public byte Priorita { get; set; }

        //public virtual Utenti? IdUtenteNavigation { get; set; }
        public virtual Attivitum? IdParentNavigation { get; set; }
        public virtual ICollection<AttivitaLog> AttivitaLogs { get; set; }
        public virtual ICollection<Attivitum>? SubAttivita { get; set; }
        public virtual ICollection<Istanta.Models_2.PromoImportazioni>? PromoImportazionis { get; set; }
    }
}
