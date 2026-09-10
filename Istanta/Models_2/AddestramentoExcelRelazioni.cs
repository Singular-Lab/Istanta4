using System;
using System.Collections.Generic;

namespace Istanta.Models_2
{
    public partial class AddestramentoExcelRelazioni
    {
        public AddestramentoExcelRelazioni()
        {
            SchemaCampiExcelRelazionis = new HashSet<SchemaCampiExcelRelazioni>();
        }

        public int Id { get; set; }
        /// <summary>
        /// Rif al campo esteso, non trovato nell&apos;excel
        /// </summary>
        public long IdCampo { get; set; }
        public string NomeRelazione { get; set; } = null!;
        public string? Algoritmo { get; set; }
        /// <summary>
        /// 1 - importazione inline 2 - importazione atend  3 - esportazione 4 - Manuale
        /// </summary>
        public byte TipoCompilazione { get; set; }

        public virtual SchemaCampiExcel IdCampoNavigation { get; set; } = null!;
        public virtual ICollection<SchemaCampiExcelRelazioni> SchemaCampiExcelRelazionis { get; set; }
    }
}
