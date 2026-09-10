using Microsoft.AspNetCore.Mvc.Infrastructure;
using System;
using System.Collections.Generic;

namespace Istanta.Models_2
{
    public partial class PromoTracciatiRecord
    {
        public PromoTracciatiRecord()
        {
            MenaboRefs = new HashSet<MenaboRef>();
            PromoLavorazioniRecords = new HashSet<PromoLavorazioniRecord>();
        }

        public long Id { get; set; }
        public int IdTracciato { get; set; }
        public Byte Versione { get; set; }
        public int IndiceLettura { get; set; }
        public int IndiceEsportazione { get; set; }
        public string? Label { get; set; }
        public string? Scatto { get; set; }
        public string? Codice { get; set; }
        public string? CodiceGruppo { get; set; }
        public string? Dato { get; set; }
        public bool? DaEsportare { get; set; }
        public int? IdAddestramento { get; set; }
        //public Byte SelezioneMenabo { get; set; }
        public DateTime? DataRegistrazione { get; set; }
        public Byte ModalitaInserimento { get; set; }
        public Byte Stato { get; set; }

        public virtual PromoTracciati IdTracciatoNavigation { get; set; } = null!;
        public virtual AddestramentoExcel IdAddestramentoNavigation { get; set; } = null!;
        public virtual ICollection<PromoLavorazioniRecord>? PromoLavorazioniRecords { get; set; } = null!;
        public virtual ICollection<MenaboRef>? MenaboRefs { get; set; }
        
    }
}
