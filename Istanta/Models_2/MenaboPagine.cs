using System;
using System.Collections.Generic;

namespace Istanta.Models_2
{
    public partial class MenaboPagine
    {
        public MenaboPagine()
        {
            MenaboRefs = new HashSet<MenaboRef>();
        }

        public Int64 Id { get; set; }
        public int IdTracciato { get; set; }
        public Int16 Numero{ get; set; }
        public string? Formato { get; set; }
        public Int16 IdMastro { get; set; }


        public virtual PromoTracciati IdTracciatoNavigation { get; set; } = null!;
        public virtual ICollection<MenaboRef> MenaboRefs { get; set; }
    }
}
