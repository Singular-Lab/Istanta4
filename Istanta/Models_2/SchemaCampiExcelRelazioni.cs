using System;
using System.Collections.Generic;

namespace Istanta.Models_2
{
    public partial class SchemaCampiExcelRelazioni
    {
        public long Id { get; set; }
        public int IdRelazione { get; set; }
        /// <summary>
        /// Rif al campo essitente sull&apos;excel
        /// </summary>
        public long IdCampo { get; set; }
        public string? Condizione { get; set; }

        public virtual SchemaCampiExcel IdCampoNavigation { get; set; } = null!;
        public virtual AddestramentoExcelRelazioni IdRelazioneNavigation { get; set; } = null!;
    }
}
