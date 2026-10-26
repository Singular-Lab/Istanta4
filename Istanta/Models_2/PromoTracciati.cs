using Istanta.Models;
using Istanta.Utility;
using System;
using System.Collections.Generic;
using IstantaLib;

namespace Istanta.Models_2
{
    public partial class PromoTracciati
    {
        public PromoTracciati()
        {
            PromoTracciatiRecords = new HashSet<PromoTracciatiRecord>();
            MenaboPagines = new HashSet<MenaboPagine>();
        }

        public int Id { get; set; }
        public int IdImportazione { get; set; }
        public int IdPromo { get; set; }
        public Byte Versione { get; set; }
        public string? Sigla { get; set; }
        public string? guidArea { get; set; }
        public string? guidCanale { get; set; }
        public string? guidPV { get; set; }
        public string? Area
        {
            get
            {
                if (this.guidArea!= null && this.guidArea!="")
                {
                    Area? a = SingletonConfiguration.DBACPV!.aree.Where(c => c.guidID == this.guidArea).FirstOrDefault();
                    if (a == null)
                        return "null";
                    return a.sigla;
                }
                return area;
            }

            set
            {
                area = value!;
            }        
        }

        public string? Canale { 
            get {
                if (this.guidCanale != null && this.guidCanale != "")
                {
                    Canale? c = SingletonConfiguration.DBACPV!.canali.Where(c => c.guidID == this.guidCanale).FirstOrDefault();
                    return c!.sigla;
                }
                return canale;
            }

            set
            {
                canale = value!;
            }
        }
        public string? OrdineLista { get; set; }
        public string? Meta { get; set; }
        public string? Context { get; set; }

        public virtual PromoImportazioni IdImportazioneNavigation { get; set; } = null!;
        public virtual Promo IdPromoNavigation { get; set; } = null!;
        public virtual ICollection<PromoTracciatiRecord> PromoTracciatiRecords { get; set; }
        public virtual ICollection<MenaboPagine> MenaboPagines { get; set; }

        private string canale="";
        private string area = "";


    }
}
