namespace Istanta.Models
{
    public partial class RegistroOperazioni
    {
        public Int64 Id { get; set; }
        public byte TipoOperazione { get; set; } 
        public string? CodiceAssociato { get; set; } 
        public int? IdTracciato { get; set; }
        public int? idPromoLavorazione { get; set; }
        public Int64? idPromoLavorazioniRecord { get; set; }
        public string? Area { get; set; }
        public string? Canale { get; set; }
        public string? Url { get; set; }
        public string? FormData { get; set; }
        public DateTime Data_Registrazione { get; set; }
        public DateTime? Data_Esecuzione { get; set; }
        public DateTime? DataElaborazionePropagazioni { get; set; }
        public byte Stato { get; set; }
        public int Autore { get; set; }
        public int? Esecutore { get; set; }

        public virtual ICollection<RegistroPropagazioni>? RegistroPopagazionis { get; set; }
    }
}

