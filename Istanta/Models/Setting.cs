using System;
using System.Collections.Generic;

namespace Istanta.Models
{
    public partial class Setting
    {
        public int Id { get; set; }
        public string Codice { get; set; } = null!;
        public string Valore { get; set; } = null!;
    }
}
