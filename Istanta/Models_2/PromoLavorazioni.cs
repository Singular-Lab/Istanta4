using Istanta.Models;
using Istanta.Utility;
using System;
using System.Collections.Generic;
using IstantaLib;

namespace Istanta.Models_2
{
    public partial class PromoLavorazioni
    {
        public PromoLavorazioni()
        {
            PromoLavorazioniRecords = new HashSet<PromoLavorazioniRecord>();
        }       

        public int Id { get; set; }
        public string? GuidId { get; set; }
        public string? GuidPromo { get; set; }
        public string? GuidCanale { get; set; }
        public string? GuidArea { get; set; }
        public string? GuidRaccoglitore { get; set; }
        public string? GuidFormato { get; set; }
        public Int16 IdAutore { get; set; }
        public DateTime RegisterDate { get; set; }
        public string? Meta { get; set; }
        public Byte Stato { get; set; }
        
        public virtual ICollection<PromoLavorazioniRecord> PromoLavorazioniRecords { get; set; }

    }
}
