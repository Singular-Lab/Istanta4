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
        /// TASK-bb04f9aa: false quando il box e' uscito dalla lavorazione. La riga non si cancella, per
        /// conservarne i meta, ma per tutte le letture non esiste: il contesto la filtra
        /// (HasQueryFilter). Chi deve vederla lo chiede con IgnoreQueryFilters; disattivazione e
        /// riattivazione passano da Utility.RecordDellaLavorazione.
        public bool Attivo { get; set; } = true;
        /// TASK-22d7fad2: non null per un box derivato, cioe' una seconda impaginazione dello stesso
        /// record chiesta dall'operatore; il valore e' l'Id della riga del box da cui e' nato. Non e'
        /// una chiave esterna: il derivato resta valido anche se l'originale esce dalla lavorazione.
        /// Il contesto nasconde i derivati come le righe disattivate: li vede solo chi li chiede per
        /// Id, con Utility.RecordDellaLavorazione. Un derivato non si disattiva: uscendo si cancella.
        public long? DerivatoDi { get; set; }

        public virtual PromoLavorazioni IdPromoLavorazioniNavigation { get; set; } = null!;
        public virtual PromoTracciatiRecord IdPromoTracciatiRecordNavigation { get; set; } = null!;

        public virtual ICollection<PromoLavorazioniRecordRegister> PromoLavorazioniRecordRegisters { get; set; }

    }
}
