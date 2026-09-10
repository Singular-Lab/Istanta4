using Microsoft.AspNetCore.Mvc.Infrastructure;
using System;
using System.Collections.Generic;

namespace Istanta.Models_2
{
    public partial class PromoLavorazioniRecord
    {
        public PromoLavorazioniRecord()
        {
            PromoLavorazioniRecordRegisters = new HashSet<PromoLavorazioniRecordRegister>();
        }

        public long Id { get; set; }
        public int IdLavorazione { get; set; }
        public long IdRecordTracciato { get; set; }
        public string? Codice { get; set; }
        public string? CodiceGruppo { get; set; }
        public Int16 IdAutore { get; set; }
        public DateTime? RegisterDate { get; set; }
        public Byte Indice { get; set; }
        public Byte Pagina { get; set; }
        public string? Meta { get; set; }

        public virtual PromoLavorazioni IdPromoLavorazioniNavigation { get; set; } = null!;
        public virtual PromoTracciatiRecord IdPromoTracciatiRecordNavigation { get; set; } = null!;

        public virtual ICollection<PromoLavorazioniRecordRegister> PromoLavorazioniRecordRegisters { get; set; }

    }
}
