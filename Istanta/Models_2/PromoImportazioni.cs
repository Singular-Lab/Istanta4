using Istanta.Models;
using System;
using System.Collections.Generic;

namespace Istanta.Models_2
{
    public partial class PromoImportazioni
    {
        public PromoImportazioni()
        {
            PromoTracciatis = new HashSet<PromoTracciati>();            
        }

        public int Id { get; set; }
        public int IdAddestramento { get; set; }
        public int IdPromo { get; set; }
        public string NomeFile { get; set; } = null!;
        public string? TipoMateriale { get; set; }        
        public DateTime DataCaricamento { get; set; }
        public string? ParamsRequest { get; set; }

        public string? guidID { get; set; }
        public long? IdAttivita { get; set; }

        public virtual AddestramentoExcel IdAddestramentoNavigation { get; set; } = null!;
        public virtual Promo IdPromoNavigation { get; set; } = null!;
        public virtual Istanta.Models.Attivitum? IdAttivitaNavigation { get; set; }
        public virtual ICollection<PromoTracciati> PromoTracciatis { get; set; }
    }
}
