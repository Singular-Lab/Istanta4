using System;
using System.Collections.Generic;

namespace Istanta.Models
{
    public partial class ArticoliFoto
    {
        public int Id { get; set; }
        public long IdArticolo { get; set; }
        public string? Area { get; set; }
        public string? Canale { get; set; }
        public string PathFoto { get; set; } = null!;
        public string NomeReale { get; set; } = null!;
        public string GuidId { get; set; } = null!;
        public bool Puntatore { get; set; } = false;
        public DateTime DataInserimento { get; set; }
        /// <summary>
        /// 0 - no selezionata 1 - primaria 2 - selezionata
        /// </summary>
        public byte? StatoSelezione { get; set; }
        public bool? Attiva { get; set; }
        public string? Hash { get; set; }
        public DateTime? DataModifica { get; set; }
        public byte? Tipo { get; set; }

        public virtual Articoli IdArticoloNavigation { get; set; } = null!;
    }

}
