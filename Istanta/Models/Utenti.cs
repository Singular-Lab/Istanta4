using System;
using System.Collections.Generic;

namespace Istanta.Models
{
    public partial class Utenti
    {
        public Utenti()
        {
            //Attivita = new HashSet<Attivitum>();
        }

        public short Id { get; set; }
        public string NomeUtente { get; set; } = null!;
        public string? Nome { get; set; } = null!;
        public string? Cognome { get; set; } = null!;
        public string Email { get; set; } = null!;
        public string Password { get; set; } = null!;
        public byte Stato { get; set; }
        public byte Ruolo { get; set; }
        public DateTime Data_Registrazione { get; set; }
        public DateTime? Data_Update { get; set; }
        public string? PrivateKey { get; set; }
        public string? ADToken { get; set; }
        public DateTime? ADTokenExpiration { get; set; }
        public string? PolicyGroups { get; set; } = null!;

        //public virtual ICollection<Attivitum> Attivita { get; set; }
        public virtual ICollection<UtentiFico>? UtentiFicos { get; set; }
        public virtual ICollection<RegistroPropagazioni>? RegistroPopagazionis { get; set; }
    }
}
