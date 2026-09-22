using DocumentFormat.OpenXml.Bibliography;
using DocumentFormat.OpenXml.Drawing;
using DocumentFormat.OpenXml.InkML;
using DocumentFormat.OpenXml.Packaging;
using Istanta.Controllers;
using Istanta.MiddleWare;
using Istanta.Models;
using Istanta.Models_2;
using IstantaLib;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Microsoft.Win32;
//using System.ComponentModel;
//using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;
using Newtonsoft.Json;
using System.ComponentModel;
using System.Data.Entity;

//using System.Data.Entity;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Mail;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Security;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Text;

namespace Istanta.Utility
{
    public static class Main
    {
        const int limit_char_length_indd = 18;

        public static Dictionary<string, object>? getJsonObject(string json_string)
        {

            Dictionary<string, object>? obj = new Dictionary<string, object>();
            try
            {
                obj = Newtonsoft.Json.JsonConvert.DeserializeObject<Dictionary<string, object>>(json_string);
            }
            catch (Exception ex)
            {
                ex.ToString();
            }

            return obj;
        }

        public static FicoRuntimeKit getFicoRuntimeKit(string json_string)
        {

            FicoRuntimeKit obj = new FicoRuntimeKit();
            try
            {
                if (json_string != null && json_string != "")
                    obj = Newtonsoft.Json.JsonConvert.DeserializeObject<FicoRuntimeKit>(json_string);
            }
            catch (Exception ex)
            {
                ex.ToString();
            }

            return obj;
        }

        public static string? getJsonObjectAndGetValueOfKey(string json_string, string key)
        {
            if (json_string != "")
            {
                Dictionary<string, object>? obj = new Dictionary<string, object>();
                try
                {
                    obj = Newtonsoft.Json.JsonConvert.DeserializeObject<Dictionary<string, object>>(json_string);
                    if (obj!.ContainsKey(key))
                    {
                        return obj[key].ToString();
                    }
                }
                catch (Exception ex)
                {
                    ex.ToString();
                }
            }

            return "";
        }
        public static string getFirmaTracciato(Dictionary<string,object> rec)
        {
            string firma = "#";
            string dyScopeDescr = Enum.GetName(AddestramentoRuoli.Descrizioni) + ".{0}";
            if (rec.ContainsKey(String.Format(dyScopeDescr, GLOBAL_VARIABLES.keyDescr1)))
                firma += rec[String.Format(dyScopeDescr, GLOBAL_VARIABLES.keyDescr1)].ToString() + "#";
            if (rec.ContainsKey(String.Format(dyScopeDescr, GLOBAL_VARIABLES.keyDescr2)))
                firma += rec[String.Format(dyScopeDescr, GLOBAL_VARIABLES.keyDescr2)].ToString() + "#";
            if (rec.ContainsKey(String.Format(dyScopeDescr, GLOBAL_VARIABLES.keyDescr3)))
                firma += rec[String.Format(dyScopeDescr, GLOBAL_VARIABLES.keyDescr3)].ToString() + "#";
            if (rec.ContainsKey(String.Format(dyScopeDescr, GLOBAL_VARIABLES.keyDescr4)))
                firma += rec[String.Format(dyScopeDescr, GLOBAL_VARIABLES.keyDescr4)].ToString() + "#";
            if (rec.ContainsKey(String.Format(dyScopeDescr, GLOBAL_VARIABLES.keyDescrPeso)))
                firma += rec[String.Format(dyScopeDescr, GLOBAL_VARIABLES.keyDescrPeso)].ToString() + "#";            
            if (rec.ContainsKey(String.Format(dyScopeDescr, GLOBAL_VARIABLES.keyDescrUm)))
                firma += rec[String.Format(dyScopeDescr, GLOBAL_VARIABLES.keyDescrUm)].ToString() + "#";
            return firma;
        }

        public static string getFirmaTracciatoGruppo(List<Dictionary<string, object>> recList)
        {
            string firmaGruppo = "";

            using (var md5 = System.Security.Cryptography.MD5.Create())
            {
                foreach (var item in recList.OrderBy(i => i[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString()))
                {
                    
                    string firma = "#";
                    string dyScopeDescr = Enum.GetName(AddestramentoRuoli.Descrizioni) + ".{0}";
                    string keyRefCod = Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice;
                    string? cod = item[keyRefCod].ToString();

                    //Prima abbiamo ragionato nel senso che la firma di gruppo sarebbe dovta essere sensibile alle descrizioni presenti nel record,
                    //Però così facendo basta revisionare il ingolo anche per sbaglio solo DOPO esere certi di aver revisoinato bene il gruppo
                    //e automaticamente la firma cambia e il gruppo torna DA CONFERMARE
                    //Per rimanere fedeli al concetto di FirmaTracciato è necessario rimanere fedeli ai dati prettamente in lista
                    //var art = ctx.Articolis.Include(inc=>inc.ArticoliDescrizionis).FirstOrDefault(w => w.Codice == cod);

                    if (item.ContainsKey(String.Format(dyScopeDescr, GLOBAL_VARIABLES.keyDescr1)))
                            firma += item[String.Format(dyScopeDescr, GLOBAL_VARIABLES.keyDescr1)].ToString() + "#";
                        if (item.ContainsKey(String.Format(dyScopeDescr, GLOBAL_VARIABLES.keyDescr2)))
                            firma += item[String.Format(dyScopeDescr, GLOBAL_VARIABLES.keyDescr2)].ToString() + "#";
                        if (item.ContainsKey(String.Format(dyScopeDescr, GLOBAL_VARIABLES.keyDescr3)))
                            firma += item[String.Format(dyScopeDescr, GLOBAL_VARIABLES.keyDescr3)].ToString() + "#";
                        if (item.ContainsKey(String.Format(dyScopeDescr, GLOBAL_VARIABLES.keyDescr4)))
                            firma += item[String.Format(dyScopeDescr, GLOBAL_VARIABLES.keyDescr4)].ToString() + "#";

                    firmaGruppo += firma;
                }
                byte[] bString = System.Text.ASCIIEncoding.UTF8.GetBytes(firmaGruppo);
                firmaGruppo = BitConverter.ToString(md5.ComputeHash(bString)).Replace("-", string.Empty);
                

            }

            return firmaGruppo;

        }

        public static string getFirmaTracciatoSottogruppoDaKitRecords(
    IEnumerable<ArticoloInKit> records,
    string codiceSottogruppo)
        {
            var keyCodiceRef = Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice;
            var keyCodiceSottogruppo = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceSottogruppo;
            var codiciAttesi = codiceSottogruppo
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var attesiSet = codiciAttesi.ToHashSet(StringComparer.OrdinalIgnoreCase);

            var candidati = records
                .Where(r =>
                    r.recordInTracciato != null &&
                    r.recordInTracciato.TryGetValue(keyCodiceSottogruppo, out var sgObj) &&
                    string.Equals(sgObj?.ToString(), codiceSottogruppo, StringComparison.OrdinalIgnoreCase) &&
                    r.recordInTracciato.TryGetValue(keyCodiceRef, out var codObj) &&
                    codObj != null &&
                    attesiSet.Contains(codObj.ToString()!))
                .ToList();

            var byCode = new Dictionary<string, Dictionary<string, object>>(StringComparer.OrdinalIgnoreCase);

            foreach (var item in candidati)
            {
                var codice = item.recordInTracciato[keyCodiceRef].ToString()!;

                if (!byCode.ContainsKey(codice))
                    byCode[codice] = item.recordInTracciato;
            }

            if (byCode.Count != attesiSet.Count)
                return GLOBAL_VARIABLES.keyMismatchFirma;

            if (!attesiSet.All(c => byCode.ContainsKey(c)))
                return GLOBAL_VARIABLES.keyMismatchFirma;

            var membriGruppo = codiciAttesi
                .OrderBy(x => x, StringComparer.OrdinalIgnoreCase)
                .Select(c => byCode[c])
                .ToList();

            return Utility.Main.getFirmaTracciatoGruppo(membriGruppo);
        }

        /// <summary>
        /// La firma del gruppo presa dai record del tracciato, oppure quella dichiarata da chi
        /// salva quando di record non ce ne sono.
        ///
        /// Senza record non c'e' niente da confrontare: il calcolo risponde "firme discordanti"
        /// e chi lo chiama va a cercare un garante che non esiste, fallendo. E' il caso del
        /// salvataggio che arriva dalla scheda articolo invece che da una lavorazione: li' la
        /// descrizione non nasce da un tracciato e la firma la dichiara il chiamante (I20-983).
        ///
        /// Dove i record ci sono il calcolo resta quello di sempre.
        /// </summary>
        public static string firmaDaRecordsOppureDichiarata(
            IEnumerable<PromoTracciatiRecord>? records,
            string codiceGruppo,
            bool isSottogruppo,
            string? firmaDichiarata)
        {
            if (records == null || !records.Any())
            {
                return firmaDichiarata ?? "";
            }

            return getFirmaTracciatoGruppoDaRecords(records, codiceGruppo, isSottogruppo);
        }

        public static string getFirmaTracciatoGruppoDaRecords(
    IEnumerable<PromoTracciatiRecord> records,
    string codiceGruppo,
    bool isSottogruppo = false)
        {
            string kFirmaTracciato = Enum.GetName(AddestramentoRuoli.Tracciato) + "." + GLOBAL_VARIABLES.keyTracciatoFirma;

            string keySottogruppo = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceSottogruppo;
            var codiciAttesi = codiceGruppo
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var attesiSet = codiciAttesi.ToHashSet(StringComparer.OrdinalIgnoreCase);

            var parsed = records
                .Select(r => new
                {
                    Record = r,
                    Json = Utility.Main.getJsonObject(r.Dato!)
                })
                .Where(x => x.Json != null)
                .ToList();

            if (isSottogruppo)
            {
                parsed = parsed
                    .Where(x =>
                        codiciAttesi.Contains(x.Record.Codice, StringComparer.OrdinalIgnoreCase) &&
                        x.Json!.TryGetValue(keySottogruppo, out var v) &&
                        v != null &&
                        string.Equals(v.ToString(), codiceGruppo, StringComparison.OrdinalIgnoreCase)
                    )
                    .ToList();
            }
            else
            {
                parsed = parsed
                    .Where(x => x.Record.CodiceGruppo == codiceGruppo || x.Record.Codice == codiceGruppo)
                    .ToList();
            }

            var firmeCandidate = parsed
                .GroupBy(x => new
                {
                    Area = x.Record.IdTracciatoNavigation.guidArea,
                    Canale = x.Record.IdTracciatoNavigation.guidCanale,
                    Versione = x.Record.Versione,
                    Label = x.Record.Label
                })
                .Where(grp =>
                {
                    var presenti = grp
                        .Select(x => x.Record.Codice)
                        .ToHashSet(StringComparer.OrdinalIgnoreCase);

                    return presenti.SetEquals(attesiSet);
                })
                .Select(grp => new
                {
                    grp.Key.Area,
                    grp.Key.Canale,
                    grp.Key.Label,
                    grp.Key.Versione,
                    Firma = codiceGruppo.Contains(",") ?
                    Utility.Main.getFirmaTracciatoGruppo(
                        grp.OrderBy(x => x.Record.Codice)
                           .Select(x => x.Json!)
                           .ToList()) :
                    grp.First().Json[kFirmaTracciato].ToString()

                })
                .ToList();

            //if (!firmeCandidate.Any())
            //    return GLOBAL_VARIABLES.keyMismatchFirma;

            var ultimePerOccorrenza = firmeCandidate
                .GroupBy(x => new
                {
                    x.Area,
                    x.Canale,
                    x.Label
                })
                .Select(g => g.OrderByDescending(x => x.Versione).First())
                .ToList();

            var firmeDistinte = ultimePerOccorrenza
                .Select(x => x.Firma)
                .Distinct()
                .ToList();

            return firmeDistinte.Count == 1
                ? firmeDistinte[0]
                : GLOBAL_VARIABLES.keyMismatchFirma;
        }

        public static string getOnlyNameOfFile(string fullName)
        {
            if (fullName != "" && fullName.IndexOf("\\") >= 0)
            {
                return fullName.Substring(fullName.LastIndexOf("\\") + 1);
            }
            else if (fullName != "" && fullName.IndexOf("/") >= 0)
            {
                return fullName.Substring(fullName.LastIndexOf("/") + 1);
            }

            return fullName;
        }

        public static PromoLavorazioniRecord? getLavorazioneRecord(
    string codiceGruppo,
    int idRec,
    List<PromoLavorazioniRecord> lavorazioniRec,
    List<ArticoloInKit> articoliInKit)
        {
            var corrispondenza = lavorazioniRec
                .FirstOrDefault(f =>
                    f.CodiceGruppo == codiceGruppo &&
                    idRec == f.IdRecordTracciato);

            if (corrispondenza != null)
                return corrispondenza;

            var possibileCorrispondenza = lavorazioniRec
                .FirstOrDefault(f => f.CodiceGruppo == codiceGruppo);

            if (possibileCorrispondenza == null)
                return null;

            var elementoIdRecIndicato = articoliInKit
                .FirstOrDefault(f => f.IdRec == idRec);

            if (elementoIdRecIndicato == null)
            {
                throw new Exception("Elemento con idRec " + idRec + " non trovato negli articoli del kit");
            }

            var label = elementoIdRecIndicato.label;

            var elementiGruppo = articoliInKit
                .Where(f =>
                    f.recordInTracciato.ContainsKey(GLOBAL_VARIABLES_FICO.keyCodiceGruppo) &&
                    f.recordInTracciato[GLOBAL_VARIABLES_FICO.keyCodiceGruppo].ToString() == codiceGruppo &&
                    f.label == label)
                .ToList();

            if (elementiGruppo.Any(f => f.IdRec == possibileCorrispondenza.IdRecordTracciato))
                return possibileCorrispondenza;

            return null;
        }

    }
    public static class MathExt
    {
        public static decimal Round(decimal d, MidpointRounding mode)
        {
            return MathExt.Round(d, 0, mode);
        }

        public static decimal Round(decimal d, int decimals, MidpointRounding mode)
        {
            if (mode == MidpointRounding.ToEven)
            {
                return decimal.Round(d, decimals);
            }
            else
            {


                /*
                decimal result = decimal.Round(d, decimals);

                decimal sign = d - (int)d;
                if (sign == (decimal)0.5)
                {
                    result += (decimal)0.01;
                }

                return result;
                */


                decimal factor = Convert.ToDecimal(Math.Pow(10, decimals));
                int sign = Math.Sign(d);
                decimal val = d * factor + 0.5m * sign;

                decimal result = Decimal.Truncate(val) / factor;
                return result;

                //412552


            }

        }





    }


        /* Title: A complete Impersonation Demo in C#
     * Auther: Wayne Ye
     * Technical Blog: http://wayneye.wordpress.com
     * Personal website: http://WayneYe.com
     * */


    /// 
    /// Provides the functionality of impersonating a domain or local PC user.
    /// Microsoft KB link for impersonation: http://support.microsoft.com/kb/306158
    /// 
    public class ImpersonateHelper
    {

        public string nomePrima="";
        public string nomeDopo="";
        public ImpersonateHelper()
        {
            /*
            nomePrima = WindowsIdentity.GetCurrent().Name;

            WindowsIdentity identity = WindowsIdentity.GetCurrent();
        
            WindowsIdentity.RunImpersonated(identity.AccessToken, () =>
            {
                nomeDopo = WindowsIdentity.GetCurrent().Name;
                try
                {
                    Directory.CreateDirectory("\\\\nasnavcove\\Public\\CoopRepository\\Archivio_DOC\\aleexporttest\\Test");
                }
                catch(Exception ex)
                {
                    nomeDopo = ex.ToString();
                }
                
            });
            */

        }
    }


    //public class OlympusChekIdentity
    //{
    //    public bool autorizzato { get; set; } = false;
    //    public string username { get; set; }
    //    public string origin { get; set; }
    //    public Dictionary<string, string>  userPolicy { get; set; }
    //}


    public static class SingletonConfiguration
    {

        private static DbACPV? dbACPV;
        private static DbFormati? dbFormati;
        private static DbLoghiBolli? dbLoghiBolli;
        private static DbNamingConvention? dbNamingConvention;
        private static DbTipoDiExport? dbTipiDiExport;
        private static DbDeclinazioniKit? dbDeclinazioniKit;
        private static DbEtichetta? dbEtichette;
        private static DbFrameworkCss? dbFrameworkCss;
        private static DbMappaStili? dbMappaStili;
        public static DbDeclinazioneMeccaniche? dbDeclinazioniMeccaniche;
        public static DbOrdinamentoLista? dbOrdinamentoLista;
        public static DbConfronto? dbConfronto;
        public static DbCustomPlugin? dbPluginAgenzia;
        //public static DbAllineamenti dbAllineamenti;



        private static string? external_source_path;

        public static DbACPV? DBACPV
        {
            get
            {
                return SingletonConfiguration.dbACPV;
            }
        }

        public static DbFormati? DBFORMATI
        {
            get
            {
                return SingletonConfiguration.dbFormati;
            }
        }

        public static DbLoghiBolli? DBLOGHIBOLLI
        {
            get
            {
                return SingletonConfiguration.dbLoghiBolli;
            }
        }

        public static DbNamingConvention? DBNamingConvention
        {
            get
            {
                return SingletonConfiguration.dbNamingConvention;
            }
        }

        public static DbTipoDiExport? DBTipiDiExport
        {
            get
            {
                return SingletonConfiguration.dbTipiDiExport;
            }
        }
        public static DbDeclinazioniKit? DbDeclinazioniKit
        {
            get
            {
                return SingletonConfiguration.dbDeclinazioniKit;
            }
        }

        public static DbEtichetta? DbEtichette
        {
            get
            {
                return SingletonConfiguration.dbEtichette;
            }
        }

        public static DbFrameworkCss? DBFrameworkCss
        {
            get
            {
                return SingletonConfiguration.dbFrameworkCss;
            }
        }

        public static DbMappaStili? DBMappaStili
        {
            get
            {
                return SingletonConfiguration.dbMappaStili;
            }
        }

        public static DbDeclinazioneMeccaniche? DbDeclinazioniMeccaniche
        {
            get
            {
                return SingletonConfiguration.dbDeclinazioniMeccaniche;

            }
        }

        public static DbOrdinamentoLista? DBOrdinamentoLista
        {
            get
            {
                return SingletonConfiguration.dbOrdinamentoLista;
            }
        }

        public static DbConfronto? DbConfronto
        {
            get
            {
                return SingletonConfiguration.dbConfronto;
            }
        }

        public static DbCustomPlugin? DbPluginAgenzia
        {
            get
            {
                return SingletonConfiguration.dbPluginAgenzia;
            }
        }

        //public static DbAllineamenti DbAllineamenti
        //{
        //    get
        //    {
        //        return SingletonConfiguration.dbAllineamenti;
        //    }
        //}



        public static void SaveLoghiBolli()
        {
            DBLOGHIBOLLI!.SaveChanges();
        }

        public static string? ExternalSourcePath
        {
            get
            {
                return external_source_path;
            }

            set
            {
                external_source_path = value;

                ExternalSourceClass est = new ExternalSourceClass(external_source_path!);
                SingletonConfiguration.dbACPV = est.getACPV();
                SingletonConfiguration.dbFormati = est.getFormati();
                SingletonConfiguration.dbLoghiBolli = est.getLoghiBolli();
                SingletonConfiguration.dbNamingConvention = est.getNamingConvention();
                SingletonConfiguration.dbTipiDiExport = est.getTipiDiExport();
                SingletonConfiguration.dbDeclinazioniKit = est.getDeclinazioniKit();
                SingletonConfiguration.dbEtichette = est.getEtichette();
                SingletonConfiguration.dbFrameworkCss = est.getFrameworkCss();
                SingletonConfiguration.dbMappaStili = est.getMappaStili();
                SingletonConfiguration.dbDeclinazioniMeccaniche = est.getDeclinazioneMeccaniche();
                SingletonConfiguration.dbOrdinamentoLista = est.getOrdinamentoListaFreeSource();
                SingletonConfiguration.dbConfronto = est.getConfronto();
                SingletonConfiguration.dbPluginAgenzia = est.getCustomPluginAgenzia();
                //SingletonConfiguration.dbAllineamenti = est.getDbAllineamentiSource();



            }
        }

    }

    public static class Ordinamento
    {
        public static List<Dictionary<string, object>> ordinaRecordsTracciato(List<Dictionary<string, object>> list, ExternalSourceClass exClass, IstantaController icCtrl, string path_external_source, string nomeCliente)
        {
            string key_codice_gruppo = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppo;
            string keyCodiceRef = Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice;
            //ExternalSourceClass exClass = new ExternalSourceClass(this.path_external_source, new string[] { "SourceOrdinamentoLista" });
            JsonDbClassificazioneUniversale? data = exClass.getClassificazioneUniversale();

            if (data.universale)
            {
                var chiaveArea = data.bindings!.area!.campoMeta;
                var chiaveSettore = data.bindings!.settore!.campoMeta;
                var chiaveReparto = data.bindings!.reparto!.campoMeta;
                var chiaveCategoria = data.bindings!.categoria!.campoMeta;

                for (var i = 0; i < list.Count; i++)
                {
                    Dictionary<string,object> itemLista = list[i];
                    if (itemLista[key_codice_gruppo].ToString() == itemLista[keyCodiceRef].ToString() && itemLista[key_codice_gruppo]!.ToString()!.Contains(","))
                    {
                        itemLista[GLOBAL_VARIABLES.keyIndiceOrdinamento] = 99999999;
                        itemLista["ordered"] = false;
                        continue;
                    }
                    var itemListaRecord = itemLista;
                    itemLista[GLOBAL_VARIABLES.keyIndiceOrdinamento] = 99999999;
                    itemLista["ordered"] = false;

                    try
                    {
                        var corrispondenza = data.lista.Find(f =>
                        (!itemListaRecord.ContainsKey(chiaveArea) || (itemListaRecord.ContainsKey(chiaveArea) && f.area.ToLower() == itemListaRecord[chiaveArea].ToString()!.ToLower())) &&
                        (!itemListaRecord.ContainsKey(chiaveSettore) || (itemListaRecord.ContainsKey(chiaveSettore) && f.settore.ToLower() == itemListaRecord[chiaveSettore].ToString()!.ToLower())) &&
                        (!itemListaRecord.ContainsKey(chiaveReparto) || (itemListaRecord.ContainsKey(chiaveReparto) && f.reparto.ToLower() == itemListaRecord[chiaveReparto].ToString()!.ToLower())) &&
                        (!itemListaRecord.ContainsKey(chiaveCategoria) || (itemListaRecord.ContainsKey(chiaveCategoria) && f.categoria.ToLower() == itemListaRecord[chiaveCategoria].ToString()!.ToLower()))
                        );

                        if (corrispondenza == null)
                        {
                            continue;
                        }
                        if (corrispondenza.orderIndex >= 0)
                        {
                            itemLista[GLOBAL_VARIABLES.keyIndiceOrdinamento] = corrispondenza.orderIndex;
                            itemLista["ordered"] = true;
                        }
                    }
                    catch
                    {
                        continue;
                    }

                }

                var orderedList = list.OrderBy(d => (int)d[GLOBAL_VARIABLES.keyIndiceOrdinamento]).ToList();
                return orderedList;
                //var _list_ordinata_per_speciale = list.sort(function(a, b) {
                //    var inxA = a.orderedIndice;
                //    var inxB = b.orderedIndice;
                //    //console.log("sor check " + [textA,textB]);
                //    return (inxA < inxB) ? -1 : (inxA > inxB) ? 1 : 0;
                //});

                //cb(_list_ordinata_per_speciale);
            }
            else
            {
                //IstantaController icCtrl = new IstantaController(this._config.GetConnectionString("IstandaConnectionDb"), this.path_external_lib, this.path_external_source);


                Dictionary<string, object> _pass = new Dictionary<string, object>();
                _pass["listRecs"] = list;
                _pass["pathOrdinamentoLista"] = path_external_source + "SourceOrdinamentoLista";


                //string resultExternal = icCtrl.execLibFunction($"AgenziaLib.{this._fico_conf.Value.nomeCliente}.ordinaLista", _pass).ToString();
                string resultExternal = icCtrl.execLibFunction($"AgenziaLib.{nomeCliente}.ordinaLista", _pass).ToString()!;
                list = JsonConvert.DeserializeObject<List<Dictionary<string, object>>>(resultExternal)!;
                list = list.OrderBy(d => (Int64)d[GLOBAL_VARIABLES.keyIndiceOrdinamento]).ToList();
            }
            return list;
        }

        public static List<ArticoloInKit> ordinaRecordsTracciatoNew(List<ArticoloInKit> list, ExternalSourceClass exClass)
        {
            string key_codice_gruppo = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppo;
            string keyCodiceRef = Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice;
            //ExternalSourceClass exClass = new ExternalSourceClass(this.path_external_source, new string[] { "SourceOrdinamentoLista" });
            var data = exClass.getClassificazioneUniversale();

            if (data.universale)
            {
                var chiaveArea = data.bindings!.area!.campoMeta;
                var chiaveSettore = data.bindings!.settore!.campoMeta;
                var chiaveReparto = data.bindings!.reparto!.campoMeta;

                for (var i = 0; i < list.Count; i++)
                {
                    var itemLista = list[i].recordInTracciato;
                    if (itemLista[key_codice_gruppo].ToString() == itemLista[keyCodiceRef].ToString() && itemLista[key_codice_gruppo].ToString()!.Contains(","))
                    {
                        itemLista[GLOBAL_VARIABLES.keyIndiceOrdinamento] = 99999999;
                        itemLista["ordered"] = false;
                        continue;
                    }
                    var itemListaRecord = itemLista;
                    itemLista[GLOBAL_VARIABLES.keyIndiceOrdinamento] = 0;
                    itemLista["ordered"] = false;

                    try
                    {
                        var corrispondenza = data.lista.Find(f =>
                        (!itemListaRecord.ContainsKey(chiaveArea) || (itemListaRecord.ContainsKey(chiaveArea) && f.area.ToLower() == itemListaRecord[chiaveArea].ToString()!.ToLower())) &&
                        (!itemListaRecord.ContainsKey(chiaveSettore) || (itemListaRecord.ContainsKey(chiaveSettore) && f.settore.ToLower() == itemListaRecord[chiaveSettore].ToString()!.ToLower())) &&
                        (!itemListaRecord.ContainsKey(chiaveReparto) || (itemListaRecord.ContainsKey(chiaveReparto) && f.reparto.ToLower() == itemListaRecord[chiaveReparto].ToString()!.ToLower()))
                        );

                        if (corrispondenza == null)
                        {
                            continue;
                        }
                        if (corrispondenza.orderIndex >= 0)
                        {
                            itemLista[GLOBAL_VARIABLES.keyIndiceOrdinamento] = corrispondenza.orderIndex;
                            itemLista["ordered"] = true;
                        }
                    }
                    catch
                    {
                        continue;
                    }

                }

                var orderedList = list.OrderBy(d => (int)d.recordInTracciato[GLOBAL_VARIABLES.keyIndiceOrdinamento]).ToList();
                return orderedList;
                //var _list_ordinata_per_speciale = list.sort(function(a, b) {
                //    var inxA = a.orderedIndice;
                //    var inxB = b.orderedIndice;
                //    //console.log("sor check " + [textA,textB]);
                //    return (inxA < inxB) ? -1 : (inxA > inxB) ? 1 : 0;
                //});

                //cb(_list_ordinata_per_speciale);
            }
            else
            {
                //IstantaController icCtrl = new IstantaController(this._config.GetConnectionString("IstandaConnectionDb"), this.path_external_lib, this.path_external_source);
                //DbMenabo SourceOrdinamentoLista = exClass.getSource("SourceMenabo").ToObject<DbMenabo>();
                //Dictionary<string, string> paramsToExternal = new Dictionary<string, string>();

                //Dictionary<string, object> _pass = new Dictionary<string, object>();
                //_pass["listRecs"] = list;
                //_pass["pathOrdinamentoLista"] = this.path_external_source + "SourceOrdinamentoLista";
                //if (SourceOrdinamentoLista.libOrdinamentoLista == null || SourceOrdinamentoLista.libOrdinamentoLista == "")
                //{
                //    return list;
                //}

                //string resultExternal = icCtrl.execLibFunction($"AgenziaLib.{this._fico_conf.Value.nomeCliente}.ordinaLista", _pass).ToString();
                //list = JsonConvert.DeserializeObject<List<Dictionary<string, object>>>(resultExternal);
            }
            return list;
        }

    }

    public static class Selezionatore
    {
        public static async Task<BoolResult> selezioneAutomaticaRefInMenabo(List<ArticoloInRevisione> q_records, Edro21_DbContext2 ctx2, string nomeCliente, string pathExternalLib, bool sovrascrizione = false)
        {
            BoolResult result = new BoolResult();
            try
            {

                string keyCodiceRef = Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice;
                string key_codice_gruppo = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppo;
                string keyXMLSelezione = GLOBAL_VARIABLES.keyXMLSelezione;
                string keyHasFoto = GLOBAL_VARIABLES.keyHasFoto;


                List<string> codici_gruppi = new List<string>();
                codici_gruppi = q_records
                .GroupBy(g => g.recordInTracciato![key_codice_gruppo].ToString()!)
                .Select(group => group.Key)
                .ToList();

                var tracciatoSingoli = q_records
                    .GroupBy(g => new
                    {
                        CodiceRef = g.recordInTracciato![keyCodiceRef]?.ToString(),
                        CodiceGruppo = g.recordInTracciato[key_codice_gruppo]?.ToString(),
                        Label = g.label
                    })
                    .Select(s =>
                    {
                        var first = s.First();         // elemento rappresentativo del gruppo
                        return new
                        {
                            dato = first.recordInTracciato,
                            id = first.idRec,
                            label = first.label,
                            dataRegistrazione = DateTime.Now, // obsoleta
                            hasFoto = (first.hasFoto == (byte)AskFoto.FotoPresente)
                                               ? (byte)AskFoto.FotoPresente
                                               : (byte)AskFoto.FotoNonPresente
                        };
                    })
                    .ToList();

                //Come era prima
                //string funcAutoSelezione = "AgenziaLib." + nomeCliente + ".eseguiAutoSelezioneGruppo";
                //Dictionary<string, object> _pass = new Dictionary<string, object>();
                //IstantaController icCtrl = new IstantaController("", pathExternalLib, "");

                string funcAutoSelezione = "AgenziaLib." + nomeCliente + ".eseguiAutoSelezioneGruppoMassiva";
                Dictionary<string, object> _pass = new Dictionary<string, object>();
                IstantaController icCtrl = new IstantaController("", pathExternalLib, "");

                List<Dictionary<string, object>> elementiGhost = new List<Dictionary<string, object>>();
                List<List<Dictionary<string, object>>> _listone = new List<List<Dictionary<string, object>>>();


                foreach (var gruppo in codici_gruppi)
                {

                    if (!gruppo.Contains(","))
                    {
                        continue;
                    }

                    if (gruppo.Contains("4058997"))
                    {
                        Debug.WriteLine("");
                    }


                    var elements = tracciatoSingoli.Where(f => f.dato![key_codice_gruppo].ToString() == gruppo).ToList();

                    foreach (var el in elements)
                    {
                        var record = q_records.Find(f => f.idRec == el.id);
                        el.dato![keyHasFoto] = el.hasFoto == (Byte)AskFoto.FotoPresente;
                    }

                    var labelsTrovate = elements.Select(f => f.label).Distinct().ToList();

                    foreach (var label in labelsTrovate)
                    {
                        var elementsCorrispondenti = elements.Where(f => f.label == label).ToList();
                        _listone.Add(elementsCorrispondenti.Select(f => f.dato).ToList());
                    }


                    //Come era prima
                    //if (!gruppo.Contains(","))
                    //{
                    //    continue;
                    //}
                    ////if (gruppo == "721784,721784")
                    ////{
                    ////    "debug".ToString();
                    ////}


                    //var elements = tracciatoSingoli.Where(f => f.dato![key_codice_gruppo].ToString() == gruppo).ToList();
                    //List<Dictionary<string, object>> elementiGhost = new List<Dictionary<string, object>>();


                    //elements.ForEach(f => f.dato![keyXMLSelezione] = (Byte)3);


                    //var primaryElement = elements.Find(f => f.hasFoto == (Byte)AskFoto.FotoPresente);
                    //if (primaryElement == null)
                    //{
                    //    primaryElement = elements[0];
                    //}

                    //foreach (var el in elements)
                    //{
                    //    var record = q_records.Find(f => f.idRec == el.id);
                    //    el.dato![keyHasFoto] = el.hasFoto == (Byte)AskFoto.FotoPresente;
                    //}



                    //_pass["gruppo"] = elements.Select(f => f.dato).ToList();
                    //_pass["ghost"] = elementiGhost;

                    //string resultExternal = icCtrl.execLibFunction(funcAutoSelezione, _pass).ToString()!;
                    //List<Dictionary<string, object>> resultExtDict = JsonConvert.DeserializeObject<List<Dictionary<string, object>>>(resultExternal)!;
                    //foreach (var el in resultExtDict)
                    //{
                    //    ArticoloInRevisione? record = q_records.Find(f => f.recordInTracciato![keyCodiceRef].ToString() == el[keyCodiceRef].ToString());
                    //    if (el.ContainsKey(keyXMLSelezione))
                    //    {
                    //        //record.statoSelezione = Byte.Parse(el[keyXMLSelezione].ToString());
                    //        Console.WriteLine($"Selezione ufficiale ->{el[keyCodiceRef].ToString()} {Byte.Parse(el[keyXMLSelezione].ToString()!)}");
                    //        record!.recordInTracciato![keyXMLSelezione] = Byte.Parse(el[keyXMLSelezione].ToString()!);
                    //    }
                    //}

                }

                _pass["gruppo"] = _listone;
                _pass["ghost"] = elementiGhost;

                List<List<Dictionary<string, object>>> resultExtDict = icCtrl.execLibFunction(funcAutoSelezione, _pass) as List<List<Dictionary<string, object>>>; ;

                foreach (var el in resultExtDict)
                {
                    var oneEl = el.FirstOrDefault();
                    string codGruppo = oneEl[GLOBAL_VARIABLES_FICO.keyCodiceGruppo]!.ToString()!;
                    string label = oneEl[GLOBAL_VARIABLES_FICO.keyLabel]!.ToString()!;
                    List<ArticoloInRevisione> _group = q_records.Where(f => f.recordInTracciato[GLOBAL_VARIABLES_FICO.keyCodiceGruppo].ToString() == codGruppo && f.recordInTracciato[GLOBAL_VARIABLES_FICO.keyLabel].ToString() == label).ToList();

                    foreach (var rec in el)
                    {
                        ArticoloInRevisione record = _group.Find(f => f.recordInTracciato[keyCodiceRef].ToString() == rec[keyCodiceRef].ToString());
                        if (rec.ContainsKey(keyXMLSelezione))
                        {
                            record!.recordInTracciato[keyXMLSelezione] = Byte.Parse(rec[keyXMLSelezione].ToString()!);
                        }
                    }

                }



                result.Esito = true;
                return result;
            }
            catch (Exception er)
            {
                result.Esito = false;
                result.error = er.ToString();
                return result;
            }
        }

        public static async Task<BoolResult> selezioneAutomaticaRefInMenaboConDifferenzialeAreaCanale(IEnumerable<ArticoloInRevisione> q_records, Edro21_DbContext2 ctx2, string nomeCliente, string pathExternalLib, bool sovrascrizione = false)
        {
            BoolResult result = new BoolResult();
            try
            {
                Stopwatch sw = new Stopwatch();
                string keyCodiceRef = Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice;
                string key_codice_gruppo = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppo;
                string keyXMLSelezione = GLOBAL_VARIABLES.keyXMLSelezione;
                string keyHasFoto = GLOBAL_VARIABLES.keyHasFoto;

                sw.Start();

                List<string> codici_gruppi = q_records
                    .Select(g => g.recordInTracciato![key_codice_gruppo].ToString()!)
                    .Distinct()
                    .ToList();
                //List<string> codici_gruppi = new List<string>();
                //codici_gruppi = q_records.Where(g=>g.isGruppo)
                //.GroupBy(g => g.recordInTracciato![key_codice_gruppo].ToString()!)
                //.Select(group => group.Key)
                //.ToList();

                Console.WriteLine($"SELEZIONE AUTO STEP1: {sw.ElapsedMilliseconds} ms");

                var tracciatoSingoli = q_records
                    .GroupBy(g => new
                    {
                        CodiceRef = g.recordInTracciato![keyCodiceRef]?.ToString(),
                        CodiceGruppo = g.recordInTracciato[key_codice_gruppo]?.ToString(),
                        Label = g.label,
                        Area = g.recordInTracciato[GLOBAL_VARIABLES.keyArea]?.ToString(),
                        Canale = g.recordInTracciato[GLOBAL_VARIABLES.keyCanale]?.ToString()
                    })
                    .Select(s =>
                    {
                        var first = s.First();         // elemento rappresentativo del gruppo
                        return new
                        {
                            dato = first.recordInTracciato,
                            id = first.idRec,
                            dataRegistrazione = DateTime.Now, // obsoleta
                            hasFoto = (first.hasFoto == (byte)AskFoto.FotoPresente)
                                               ? (byte)AskFoto.FotoPresente
                                               : (byte)AskFoto.FotoNonPresente,
                            canale = first.recordInTracciato[GLOBAL_VARIABLES.keyCanale]?.ToString(),
                            area = first.recordInTracciato[GLOBAL_VARIABLES.keyArea]?.ToString()
                        };
                    })
                    .ToList();

                Console.WriteLine($"SELEZIONE AUTO STEP2: {sw.ElapsedMilliseconds} ms");

                //string funcAutoSelezione = "AgenziaLib." + nomeCliente + ".eseguiAutoSelezioneGruppo";
                string funcAutoSelezione = "AgenziaLib." + nomeCliente + ".eseguiAutoSelezioneGruppoMassiva";
               
                Dictionary<string, object> _pass = new Dictionary<string, object>();
                IstantaController icCtrl = new IstantaController("", pathExternalLib, "");

                List<Dictionary<string, object>> elementiGhost = new List<Dictionary<string, object>>();
                List<List<Dictionary<string, object>>> _listone = new List<List<Dictionary<string, object>>>();

                foreach (var gruppo in codici_gruppi)
                {

                    if (!gruppo.Contains(","))
                    {
                        continue;
                    }

                    var elements = tracciatoSingoli.Where(f => f.dato![key_codice_gruppo].ToString() == gruppo).ToList();

                    foreach (var group in elements.GroupBy(f => new { f.canale, f.area }))
                    {
                        var gruppoDaProcessare = group
                            .Select(g => g.dato)
                            .Where(d => d != null)
                            .ToList();

                        if (gruppoDaProcessare.Count > 0)
                        {
                            _listone.Add(gruppoDaProcessare!);
                        }
                    }

                }

                Console.WriteLine($"SELEZIONE AUTO STEP3: {sw.ElapsedMilliseconds} ms");

                _pass["gruppo"] = _listone;// group.Select(g => g.dato).ToList();
                _pass["ghost"] = elementiGhost;

                List<List<Dictionary<string, object>>> resultExtDict = icCtrl.execLibFunction(funcAutoSelezione, _pass) as List<List<Dictionary<string, object>>>; ;

                Console.WriteLine($"SELEZIONE AUTO STEP4: {sw.ElapsedMilliseconds} ms");

                foreach (var el in resultExtDict)
                {
                    var oneEl = el.FirstOrDefault();
                    string codGruppo = oneEl[GLOBAL_VARIABLES_FICO.keyCodiceGruppo]!.ToString()!;
                    List<Int64> _id_recs = el.Select(s => Convert.ToInt64(s["idRec"])).ToList();

                    List<ArticoloInRevisione> _group = q_records.Where(f =>f.idRec.HasValue &&
                    _id_recs.Contains(f.idRec.Value)).ToList();

                    //foreach (var rec in el)
                    //{
                    //    ArticoloInRevisione record = _group.Find(f => f.recordInTracciato[keyCodiceRef].ToString() == rec[keyCodiceRef].ToString());
                    //    if (rec.ContainsKey(keyXMLSelezione))
                    //    {
                    //        record!.recordInTracciato[keyXMLSelezione] = Byte.Parse(rec[keyXMLSelezione].ToString()!);
                    //    }
                    //}

                    foreach (var rec in el)
                    {
                        if (!rec.TryGetValue("idRec", out var idValue) ||
                            !long.TryParse(idValue?.ToString(), out var idRec))
                        {
                            throw new InvalidOperationException(
                                "Il risultato dell'autoselezione non contiene un idRec valido."
                            );
                        }

                        var record = _group.FirstOrDefault(f =>
                            f.idRec.HasValue &&
                            f.idRec.Value == idRec
                        );

                        if (record == null)
                        {
                            throw new InvalidOperationException(
                                $"Record {idRec} non trovato durante il mapping dell'autoselezione."
                            );
                        }

                        if (rec.TryGetValue(keyXMLSelezione, out var statoValue) &&
                            byte.TryParse(statoValue?.ToString(), out var stato))
                        {
                            record.recordInTracciato[keyXMLSelezione] = stato;
                        }
                    }


                }

                sw.Stop();

                Console.WriteLine($"SELEZIONE AUTO STEP5: {sw.ElapsedMilliseconds} ms");

                result.Esito = true;
                return result;
            }
            catch (Exception er)
            {
                result.Esito = false;
                result.error = er.Message;
                return result;
            }
        }

        public static async Task<BoolResult> selezioneAutomaticaRefInMenabo(List<q_records_per_getListaRevisione> q_records, Edro21_DbContext2 ctx2, string nomeCliente, string pathExternalLib, bool sovrascrizione = false)
        {
            BoolResult result = new BoolResult();
            try
            {

                string keyCodiceRef = Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice;
                string key_codice_gruppo = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppo;
                string keyXMLSelezione = GLOBAL_VARIABLES.keyXMLSelezione;
                string keyHasFoto = GLOBAL_VARIABLES.keyHasFoto;

                string funcAutoSelezione = "AgenziaLib." + nomeCliente + ".eseguiAutoSelezioneGruppo";
                Dictionary<string, object> _pass = new Dictionary<string, object>();
                IstantaController icCtrl = new IstantaController("", pathExternalLib, "");

                //bool ghostFounded = false;

                List<string> codici_gruppi = new List<string>();
                codici_gruppi = q_records
                .GroupBy(g => g.Dato[key_codice_gruppo].ToString()!)
                .Select(group => group.Key)
                .ToList();


                var tracciatoSingoli = q_records
                    .GroupBy(g => new
                    {
                        CodiceRef = g.Dato[keyCodiceRef]?.ToString(),
                        CodiceGruppo = g.Dato[key_codice_gruppo]?.ToString(),
                        Canale = g.Canale,
                        Area = g.Area
                    })
                    .Select(s =>
                    {
                        var first = s.First();         // elemento rappresentativo del gruppo
                        return new
                        {
                            dato = first.Dato,
                            id = first.Id,
                            dataRegistrazione = DateTime.Now, // obsoleta
                            canale = first.Canale,
                            area = first.Area
                        };
                    })
                    .ToList();


                foreach (var gruppo in codici_gruppi)
                {

                    if (!gruppo.Contains(","))
                    {
                        continue;
                    }

                    //cerchiamo in quanti tracciati appare


                    var elements = tracciatoSingoli.Where(f => f.dato[key_codice_gruppo].ToString() == gruppo).ToList();

                    foreach (var group in elements.GroupBy(f => new {f.canale, f.area})) {

                        List<Dictionary<string, object>> elementiGhost = new List<Dictionary<string, object>>();

                        _pass["gruppo"] = group.Select(g=>g.dato).ToList();
                        _pass["ghost"] = elementiGhost;

                        string resultExternal = icCtrl.execLibFunction(funcAutoSelezione, _pass).ToString()!;
                        List<Dictionary<string, object>> resultExtDict = JsonConvert.DeserializeObject<List<Dictionary<string, object>>>(resultExternal)!;
                        foreach (var el in resultExtDict)
                        {
                            q_records_per_getListaRevisione? record = q_records.Find(f => f.Dato[keyCodiceRef].ToString() == el[keyCodiceRef].ToString() && f.Canale == group.Key.canale && f.Area == group.Key.area);
                            if (el.ContainsKey(keyXMLSelezione))
                            {
                                record!.Dato[keyXMLSelezione] = Byte.Parse(el[keyXMLSelezione].ToString()!);
                            }
                        }
                    }

                }

                result.Esito = true;
                return result;
            }
            catch (Exception er)
            {
                result.Esito = false;
                result.error = er.Message;
                return result;
            }
        }

    }

    public static class TypeExtensions
    {
        private static readonly Type[] _simpleTypes = new Type[]
        {
        typeof(string),
        typeof(decimal),
        typeof(double),
        typeof(int),
        typeof(uint),
        typeof(long),
        typeof(ulong),
        typeof(byte),
        typeof(DateTime),
        typeof(DateTimeOffset),
        typeof(TimeSpan),
        typeof(Guid)
        };

        public static bool IsSimpleType(this Type type)
        {
            if (type.IsGenericType && type.GetGenericTypeDefinition() == typeof(Nullable<>))
            {
                // se è Nullable<T>, prendi il T
                type = Nullable.GetUnderlyingType(type)!;
            }

            return type.IsPrimitive
                || _simpleTypes.Contains(type)
                || type.IsEnum;
        }
    }

    public static class Mailer
    {
        public static BoolResult inviaEmail(string subject, string email, string msg)
        {
            BoolResult br = new BoolResult();

            try
            {


                MailMessage message = new MailMessage();
                message.From = new MailAddress("\"Istanta\" <noreply@istanta.it>");
                message.To.Add(new MailAddress(email));

                message.Subject = subject;
                message.IsBodyHtml = true;
                message.Body = msg;
                message.BodyEncoding = System.Text.Encoding.UTF8;
                SmtpClient client = new SmtpClient("pro.turbo-smtp.com", 587);
                client.Credentials = new NetworkCredential("48287acc5fdcf9e8fb24", "5oAqT27vd4DfslwtarCF");
                client.Send(message);
            }
            catch(Exception ex) {
                br.Esito = false;
                br.error = ex.Message;
                return br;
            }

            br.Esito = true;

            return br;
        }
    }
}

