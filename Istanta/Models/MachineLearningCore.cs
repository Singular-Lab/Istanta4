using DocumentFormat.OpenXml.Wordprocessing;
using CsvHelper.Configuration.Attributes;

namespace Istanta.Models
{
    public class csvDemo
    {
        public string? Speciale { get; set; }
        public bool SpecialeUnknown = false;
        public string? Categoria { get; set; }
        public bool CategoriaUnknown = false;
        public string? Settore { get; set; }
        public bool SettoreUnknown = false;
        public string? Reparto { get; set; }
        public bool RepartoUnknown = false;
        public string? Area { get; set; }
        public string? CodiceGruppo { get; set; }
        //public string CodiceMultiplex { get; set; }
        public string? Codice { get; set; }
        public string? Label { get; set; }
        public short Pagina { get; set; }
        public short Indice { get; set; }
        public DateTime? Date { get; set; }
    }

    public class csvDemoResult
    {
        [Name("Codice")]
        public string? Codice { get; set; }

        [Name("CodiceGruppo")]
        public string? CodiceGruppo { get; set; }

        [Name("Pagina")]
        public short Pagina { get; set; }

        [Name("Indice")]
        public short Indice { get; set; }
    }

    
}