using System;
using System.Collections.Generic;

namespace Istanta.Models
{
    public partial class FotoEscluse
    {
        public int Id { get; set; }
        public long IdArticolo { get; set; }
        public string NomeReale { get; set; } = "";
        public DateTime DataInserimento { get; set; }
        public string? Filtro { get; set; }

        public virtual Articoli IdArticoloNavigation { get; set; } = null!;
    }

}
