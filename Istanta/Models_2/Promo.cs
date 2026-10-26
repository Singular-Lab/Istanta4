using IstantaLib;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;

namespace Istanta.Models_2
{
    public partial class Promo
    {
        public Promo()
        {
            PromoImportazionis = new HashSet<PromoImportazioni>();
            PromoTracciatis = new HashSet<PromoTracciati>();
        }

        public int Id { get; set; }
        public string NomePromo { get; set; } = null!;
        public DateTime DataRegistrazione { get; set; }
        public DateTime? ValiditaDal { get; set; }
        public DateTime? ValiditaAl { get; set; }
        public DateTime? DataScadenza { get; set; }
        /// <summary>
        /// 0-chiusa 1-aperta
        /// </summary>
        public byte Stato { get; set; }
        public string? guidID { get; set; }
        public string? Context { get; set; }

        public virtual ICollection<PromoImportazioni> PromoImportazionis { get; set; }
        public virtual ICollection<PromoTracciati> PromoTracciatis { get; set; }

        public string ToStringContext()
        {
            string result = "";

            List<FicoContextField>? arrContext = JsonConvert.DeserializeObject<List<FicoContextField>>(this.Context!);

            foreach (var item in arrContext!)
            {
                if (result!="")
                {
                    result += " ";
                }
                
                result += item.user_value;
                
            }
            return result;
        }
    }
}
