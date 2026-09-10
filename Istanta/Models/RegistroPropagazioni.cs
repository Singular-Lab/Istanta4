namespace Istanta.Models
{
    public partial class RegistroPropagazioni
    {
        public Int64 Id { get; set; }
        public Int64 IdRegistro { get; set; }
        public Int64 IdPromoLavorazioniRecord { get; set; }
        public DateTime DataRegistrazione { get; set; }
        public DateTime? DataElaborazione { get; set; }
        public Int16? AutoreElaborazione { get; set; }
        public byte Priorita { get; set; }
        public byte Stato { get; set; }

        public virtual Utenti IdUtenteNavigation { get; set; } = null!;
        public virtual RegistroOperazioni IdRegistroNavigation { get; set; } = null!;
    }
}
