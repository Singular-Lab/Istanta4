using System;
using System.Collections.Generic;

namespace Istanta.Models_2
{
    public partial class AddestramentoExcel
    {
        public AddestramentoExcel()
        {
            PromoImportazionis = new HashSet<PromoImportazioni>();
            SchemaCampiExcels = new HashSet<SchemaCampiExcel>();
        }

        public int Id { get; set; }
        public string FileAddestramento { get; set; } = null!;
        public string? Titolo { get; set; }
        public DateTime DataCaricamento { get; set; }
        public bool esportaSubito { get; set; }
        public bool salvaSuDb { get; set; }
        public string? externalCallPerImport { get; set; }
        public string? externalCallPerExport { get; set; }
        public string? externalCallPerExportPoP { get; set; }

        public virtual ICollection<PromoImportazioni> PromoImportazionis { get; set; }
        public virtual ICollection<PromoTracciatiRecord> PromoTracciatiRecords { get; set; } = new HashSet<PromoTracciatiRecord>();
        public virtual ICollection<SchemaCampiExcel> SchemaCampiExcels { get; set; }
    }
}
