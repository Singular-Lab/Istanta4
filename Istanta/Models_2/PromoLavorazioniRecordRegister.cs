using Microsoft.AspNetCore.Mvc.Infrastructure;
using System;
using System.Collections.Generic;

namespace Istanta.Models_2
{
    public partial class PromoLavorazioniRecordRegister
    {
        public PromoLavorazioniRecordRegister()
        {
        }

        public long Id { get; set; }
        public long IdLavorazioneRecord { get; set; }
        public Int16 IdAutore { get; set; }
        public Byte TipoAzione { get; set; }
        public DateTime? RegisterDate { get; set; }
       
        public virtual PromoLavorazioniRecord IdPromoLavorazioniRecordNavigation { get; set; } = null!;

        
    }
}
