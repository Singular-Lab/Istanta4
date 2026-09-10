using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;

namespace Istanta.Models
{
    public partial class ArticoliDescrizioni
    {
        public Int64 Id { get; set; }
        public Int64? IdArticolo { get; set; }
        public string? CodiceGruppo { get; set; }
        public string? Area { get; set; }
        public string? Canale { get; set; }
        public string? Custom { get; set; }
        public string? Descrizione1 { get; set; }
        public string? Descrizione2 { get; set; }
        public string? Descrizione3 { get; set; }
        public string? Descrizione4 { get; set; }
        public string? DescrizioneIndd { get; set; }
        public string? Extra { get; set; }

        [Precision(18, 3)]
        public decimal? Peso { get; set; }
        public string? Um{ get; set; }
        
        public DateTime DataUltimaRicezione { get; set; }

        public bool Approvata { get; set; }
        public bool Attiva { get; set; }
        public string? FirmaTracciato { get; set; }

        public string? Meta { get; set; }

        public virtual Articoli IdArticoloNavigation { get; set; } = null!;
    }

}
