using System;
using System.Collections.Generic;

namespace Istanta.Models
{
    public partial class UtentiFico
    {
        public UtentiFico()
        {
            //Attivita = new HashSet<Attivitum>();
        }
        public int Id { get; set; }
        public Int16? IdUtente { get; set; }
        public string Token { get; set; } = null!;
        public string Origin { get; set; } = null!;
        public string Username { get; set; } = null!;
        public byte TipoUtente { get; set; }
        public string UserData { get; set; } = null!;
        public DateTime lastAccess { get; set; }


        public virtual Utenti IdUtenteNavigation { get; set; } = null!;
    }
}
