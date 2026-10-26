using System;
using System.Collections.Generic;

namespace Istanta.Models_2
{
    public partial class SchemaCampiExcel
    {
        public SchemaCampiExcel()
        {
            AddestramentoExcelRelazionis = new HashSet<AddestramentoExcelRelazioni>();
            SchemaCampiExcelRelazionis = new HashSet<SchemaCampiExcelRelazioni>();
        }

        public long Id { get; set; }
        public int IdAddestramento { get; set; }
        public string NomeColonnaOriginale { get; set; } = null!;
        public short Indice { get; set; }
        public string? NomeColonna { get; set; }
        public string? NomeVisualizzato { get; set; }
        public string? Note { get; set; }
        public byte? TipoDato { get; set; }
        public string? Ruolo { get; set; }
        /// <summary>
        /// 0 - none 1 - categoria(liv1) 2 - reparto (liv2) 3 - settore (liv 3) 4 - segmento (liv 4)
        /// </summary>
        public byte? Ordinamento { get; set; }

        public virtual AddestramentoExcel IdAddestramentoNavigation { get; set; } = null!;
        public virtual ICollection<AddestramentoExcelRelazioni> AddestramentoExcelRelazionis { get; set; }
        public virtual ICollection<SchemaCampiExcelRelazioni> SchemaCampiExcelRelazionis { get; set; }
    }
}
