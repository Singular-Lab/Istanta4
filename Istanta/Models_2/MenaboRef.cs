using System;
using System.Collections.Generic;

namespace Istanta.Models_2
{
    public partial class MenaboRef
    {
        public Int64 Id { get; set; }
        public Int64? IdRecord { get; set; }
        public string? CodiceGruppo { get; set; }
        public Int64 IdPagina { get; set; }
        public Int16 Indice { get; set; }
        public Byte Selezione { get; set; }
        public string? Formato { get; set; }
        public string? Meccaniche { get; set; }
        public virtual MenaboPagine IdPaginaNavigation { get; set; } = null!;
        public virtual PromoTracciatiRecord IdRecordNavigation { get; set; } = null!;
    }

}
