using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json;
using System.IO;
//using System.Security.Cryptography;
//using ImageMagick;
using System.Drawing;
using System.ComponentModel;
using System.Net;
using System.Runtime.InteropServices;
using System.Xml.XPath;
using System.Runtime.InteropServices.ComTypes;
using System.Configuration;
using System.IO.Compression;
using System.Data;
using System.Threading;

namespace IstantaLib
{
    public class Canale
    {
        public string nome { get; set; }
        public string sigla { get; set; }
        public string guidID { get; set; }
    }

    public class Area
    {
        public string nome { get; set; }
        public string sigla { get; set; }
        public string guidID { get; set; }
    }


    public static class Extentions
    {
        public static void removeDuplicatesFromList<T>(this List<T> list)
        {
            HashSet<T> hashset = new HashSet<T>();
            list.RemoveAll(x => !hashset.Add(x));
        }
    }

    public static class StringExtensions
    {
        public static string ToNoSpacing(this string str)
        {
            return str.Replace(Environment.NewLine, "").Replace(" ", "");
        }

        public static int countStringIn(this string str, string tofind)
        {
            int result = 0;

            int current_index = 0;

            while (true)
            {
                int found = str.IndexOf(tofind, current_index);
                if (found >= 0)
                {
                    result++;
                    current_index = found + tofind.Length;
                }
                else
                {
                    break;
                }
            }

            return result;
        }

        //public static bool ContainsParole(this string str, string[] parole)
        //{
        //    if (parole.Count() == 0)
        //        return false;

        //    foreach (string s in parole)
        //    {
        //        if (!str.Contains(s))
        //            return false;
        //    }
        //    return true;
        //}

        public static bool ContainsWord(this string source, string[] words)
        {
            if (string.IsNullOrEmpty(source) || words == null || words.Length == 0)
                return false;


            bool result = false;
            foreach (var word in words)
            {
                if (string.IsNullOrEmpty(word))
                    continue;

                // Check if the word is present in the source string
                string[] _list_righe = source.Split('\n');
                foreach(string riga in _list_righe)
                {
                    string[] _list_spazi = riga.Split(' ');
                    foreach (var item in _list_spazi)
                    {
                        string _item = item.Replace("\r", "").Trim();
                        if (word == _item)
                        {
                            result = true;
                            break;
                        }
                    }
                }
            }

            return result;
        }
    }
    
    public class ResultSearchedPhoto
    {
        public List<SearchedFoto> list=new List<SearchedFoto>();
        public string error;
    }

    public class SearchedFoto
    {
        public string nome_file = "";
        public string error = "";
        public string path = "";
        public string macroPath = "";
        public string md5 = "";
        public DateTime data_modifica;
    }


    public class Tag
    {
        public string tag_apertura;
        public string tag_chiusura;
        public string stile;
        public int inx_start;
        public string content;
    }

    public class XmlInterpreter
    {

        //EDRO21
        /*public Dictionary<string,object> getExportingRef(Dictionary<string, object> objDb)
        {

            Dictionary<string, object> result = objDb;

            try
            {
                DateTime data_da = DateTime.Parse(objDb["data_da"].ToString());
                DateTime data_a = DateTime.Parse(objDb["data_a"].ToString());

                string sez_data = "";

                if (data_da.Month == data_a.Month)
                {
                    sez_data = String.Format("Dal {0} al {1}", data_da.Day.ToString("d"), data_a.ToString("d MMMM yyyy"));
                }
                else
                {
                    if (data_da.Year != data_a.Year)
                    {
                        sez_data = String.Format("Dal {0} al {1}", data_da.ToString("d MMMM yyyy"), data_a.ToString("d MMMM yyyy"));
                    }
                    else
                    {
                        sez_data = String.Format("Dal {0} al {1}", data_da.ToString("d MMMM"), data_a.ToString("d MMMM yyyy"));
                    }
                }

                result.Add("sez_data", sez_data);

                result["prezzo_paghi"] = "€ " + result["prezzo_paghi"].ToString();
            }
            catch (Exception ex)
            {
                result = new Dictionary<string, object>();
                result.Add("error", ex.ToString());
            }
            

            return result;

        }*/

        //DOC ROMA
        public Dictionary<string, object> getExportingRefPOP(Dictionary<string, object> objDb)
        {
            Dictionary<string, object> result = objDb;

            if (objDb.ContainsKey("files_foto"))
            {
                //Se arrivaa da record tracciato
                string foto = objDb["files_foto"].ToString();
                string[] foto_list = foto.Split(',');
                for (int i = 0; i < foto_list.Length; i++)
                {
                    foto_list[i] = foto_list[i].Substring(foto_list[i].LastIndexOf("\\") + 1);
                }

                result["files_foto"] = string.Join(",", foto_list);
            }
            else if (objDb.ContainsKey("foto"))
            {
                //Se arriva da record storico
                result["files_foto"] = objDb["foto"];
            }
            else 
            {
                result["files_foto"] = objDb["codice_articolo"].ToString()+".psd";
            }

            if (!objDb.ContainsKey("prima_di_prezzo2"))
            {
                objDb["prima_di_prezzo2"] = getPrimaDiPrezzo2(objDb);
            }


            if (objDb.ContainsKey("meccanica_market") && objDb["meccanica_market"].ToString() != "")
                objDb["prezzo"] = getPrezzo(objDb, "");
            else
            {
                decimal d;
                if (Decimal.TryParse(objDb["prezzo"].ToString(), out d))
                {
                    objDb["prezzo"] = MathExt.DecimalRoundMidpoint(d).ToString();
                }
            }

            if (objDb.ContainsKey("prezzo_oro"))
                objDb["prezzo_oro"] = getPrezzo(objDb, "_oro");
            else
                objDb["prezzo_oro"] = "deprecato";//Perchè la ref arriva da un volantino diretto epr cui il valore è senza suffissi, esce già giusto da esportazione INDD


            decimal promo;
            if (Decimal.TryParse(objDb["prezzo_promo"].ToString(), out promo))
            {
                string spec = objDb["speciale"].ToString().ToLower();
                string peso = objDb["peso"].ToString();

                decimal val = promo;
                if (Decimal.TryParse(peso, out decimal pesoNum))
                {
                    if (pesoNum == 1 && spec.Contains("gastronomia"))
                    {
                        val = val / 10;
                        string valstr = val.ToString();
                        if (valstr.IndexOf(",") > 0)
                        {
                            string[] valstrP = valstr.Split(',');
                            string decstr = valstrP[1];
                            if (decstr.Length > 2)
                            {
                                valstr = valstrP[0] + "," + decstr.Substring(0, 2);
                            }
                            else if (decstr.Length == 1)
                            {
                                valstr = valstrP[0] + "," + decstr + "0";
                            }
                            else
                            {
                                valstr = valstrP[0] + "," + decstr;
                            }
                        }
                        else
                        {
                            valstr += ",00";
                        }

                        val = Decimal.Parse(valstr);
                    }
                }

                objDb["prezzo_promo"] = MathExt.DecimalRoundMidpoint(val).ToString();
            }

            decimal promo_oro;
            if (Decimal.TryParse(objDb["prezzo_promo_oro"].ToString(), out promo_oro))
            {
                objDb["prezzo_promo_oro"] = MathExt.DecimalRoundMidpoint(promo_oro).ToString();
            }

            if (!objDb.ContainsKey("prezzo_promo_kgl"))
            {
                objDb["prezzo_promo_kgl"] = getPrezzoPromoKgl(objDb, "");
                objDb["prezzo_promo_kgl_oro"] = getPrezzoPromoKgl(objDb, "_oro");
            }
            else
                objDb["prezzo_promo_kgl_oro"] = "deprecato";//Perchè la ref arriva da un volantino diretto epr cui il valore è senza suffissi, esce già giusto da esportazione INDD

            if (objDb.ContainsKey("descrizione_1"))
            {
                objDb["descrizione"] = objDb["descrizione_1"];
                objDb["tipo_gusto"] = objDb["descrizione_3"];
                objDb["grammatura"] = objDb["descrizione_4"];
            }

            return result;
        }

        public Dictionary<string, object> getExportingRef(Dictionary<string, object> objDb)
        {

            Dictionary<string, object> result = objDb;

            try
            {
                //List<Dictionary<string, object>> secondari = objDb["secondari"] as List<Dictionary<string, object>>;
                if (objDb.ContainsKey("files_foto"))
                {
                    string foto = objDb["files_foto"].ToString();
                    string[] foto_list = foto.Split(',');
                    for (int i = 0; i < foto_list.Length; i++)
                    {
                        foto_list[i] = foto_list[i].Substring(foto_list[i].LastIndexOf("\\") + 1);
                    }

                    objDb["files_foto"] = string.Join(",", foto_list);
                }

                if (objDb.ContainsKey("prezzo"))
                {
                    decimal prezzo;
                    if (Decimal.TryParse(objDb["prezzo"].ToString(), out prezzo))
                        objDb["prezzo"] = MathExt.DecimalRoundMidpoint(prezzo).ToString();
                }

                if (objDb.ContainsKey("prezzo_oro"))
                {
                    decimal prezzo_oro;
                    if (Decimal.TryParse(objDb["prezzo_oro"].ToString(), out prezzo_oro))
                        objDb["prezzo_oro"] = MathExt.DecimalRoundMidpoint(prezzo_oro).ToString();
                }

                decimal promo=0;
                if (objDb.ContainsKey("prezzo_promo"))
                {
                   
                    if (Decimal.TryParse(objDb["prezzo_promo"].ToString(), out promo))
                    {
                        string spec = "";
                        if (objDb.ContainsKey("speciale"))
                            spec = objDb["speciale"].ToString().ToLower();

                        string peso = "";
                        if  (objDb.ContainsKey("peso"))
                            peso = objDb["peso"].ToString();

                        decimal val = promo;
                        if (Decimal.TryParse(peso, out decimal pesoNum))
                        {
                            if (pesoNum == 1 && spec.Contains("gastronomia"))
                            {
                                val = val / 10;
                                string valstr = val.ToString();
                                if (valstr.IndexOf(",") > 0)
                                {
                                    string[] valstrP = valstr.Split(',');
                                    string decstr = valstrP[1];
                                    if (decstr.Length > 2)
                                    {
                                        valstr = valstrP[0] + "," + decstr.Substring(0, 2);
                                    }
                                    else if (decstr.Length == 1)
                                    {
                                        valstr = valstrP[0] + "," + decstr + "0";
                                    }
                                    else
                                    {
                                        valstr = valstrP[0] + "," + decstr;
                                    }
                                }
                                else
                                {
                                    valstr += ",00";
                                }

                                val = Decimal.Parse(valstr);
                            }
                        }

                        objDb["prezzo_promo"] = MathExt.DecimalRoundMidpoint(val).ToString();
                    }
                }

                if (objDb.ContainsKey("prezzo_oro"))
                {
                    decimal promo_oro;
                    if (Decimal.TryParse(objDb["prezzo_promo_oro"].ToString(), out promo_oro))
                    {
                        objDb["prezzo_promo_oro"] = MathExt.DecimalRoundMidpoint(promo_oro).ToString();
                    }
                }

                decimal prezzo_kgl=0;
                if (objDb.ContainsKey("prezzo_kgl"))
                {
                    
                    if (Decimal.TryParse(objDb["prezzo_kgl"].ToString(), out prezzo_kgl))
                        objDb["prezzo_kgl"] = MathExt.DecimalRoundMidpoint(prezzo_kgl).ToString();
                }

                if (objDb.ContainsKey("prezzo_kgl_oro"))
                {
                    decimal prezzo_kgl_oro;
                    if (Decimal.TryParse(objDb["prezzo_kgl_oro"].ToString(), out prezzo_kgl_oro))
                        objDb["prezzo_kgl_oro"] = MathExt.DecimalRoundMidpoint(prezzo_kgl_oro).ToString();
                }

                if (objDb.ContainsKey("meccanica_market"))
                {
                    if (objDb["meccanica_market"].ToString() == "1+1")
                    {
                        string dettagli_1_1 = String.Format("1 pezzo {0} € - al {1} {2} €", promo, objDb["um"], prezzo_kgl);
                        objDb["dettagli_1_1"] = dettagli_1_1;
                    }


                    if (objDb["meccanica_market"].ToString().ToLower().Contains("alla cassa"))
                    {
                        string mecc = objDb["meccanica_market"].ToString();
                        objDb["meccanica_market"] = mecc.Substring(0, mecc.IndexOf("%") + 1);
                        objDb["alla_cassa"] = "True";
                    }
                }

                if (objDb.ContainsKey("prima_di_prezzo2"))
                {
                    objDb["prima_di_prezzo2"] = getPrimaDiPrezzo2(objDb);
                }

            }
            catch (Exception ex)
            {
                result = new Dictionary<string, object>();
                result.Add("error", ex.ToString());
            }


            return result;

        }

        public Dictionary<string, object> getExportingRefSub(Dictionary<string, object> objDb)
        {

            Dictionary<string, object> result = new Dictionary<string, object>();

            try
            {
                result.Add("codice_articolo", objDb["codice_articolo"]);
                
            }
            catch (Exception ex)
            {
                result = new Dictionary<string, object>();
                result.Add("error", ex.ToString());
            }


            return result;

        }

        private decimal getPrezzoPromo(Dictionary<string, object> objDb)
        {
            decimal promo;
            if (Decimal.TryParse(objDb["prezzo_promo"].ToString(), out promo))
            {
                string spec = objDb["speciale"].ToString().ToLower();
                string peso = objDb["peso"].ToString();

                decimal val = promo;
                if (Decimal.TryParse(peso, out decimal pesoNum))
                {
                    if (pesoNum == 1 && spec.Contains("gastronomia"))
                    {
                        val = val / 10;
                        string valstr = val.ToString();
                        if (valstr.IndexOf(",") > 0)
                        {
                            string[] valstrP = valstr.Split(',');
                            string decstr = valstrP[1];
                            if (decstr.Length > 2)
                            {
                                valstr = valstrP[0] + "," + decstr.Substring(0, 2);
                            }
                            else if (decstr.Length == 1)
                            {
                                valstr = valstrP[0] + "," + decstr + "0";
                            }
                            else
                            {
                                valstr = valstrP[0] + "," + decstr;
                            }
                        }
                        else
                        {
                            valstr += ",00";
                        }

                        val = Decimal.Parse(valstr);
                    }
                }

                objDb["prezzo_promo"] = MathExt.DecimalRoundMidpoint(val).ToString();
            }

            return promo;
        }

        private string getPrezzo(Dictionary<string,object> objDb, string quale)
        {
            string mecc = objDb["meccanica_market"].ToString();
            string prezzo = objDb["prezzo"+quale].ToString();

            if (Decimal.TryParse(prezzo, out decimal num))
            {
                if (mecc.IndexOf("SCONTO") >= 0)
                {
                    return "invece di " + MathExt.DecimalRoundMidpoint(num) + " €";

                }
                else
                {
                    return "";
                }
            }
            else
                return prezzo;
        }

        private string getPrezzoPromoKgl(Dictionary<string, object> objDb,string quale)
        {
            string um = objDb["um"].ToString();
            string sett = objDb["settore"].ToString();
            string gramm = objDb["grammatura"].ToString();
            if (objDb.ContainsKey("descrizione_4"))
                gramm = objDb["descrizione_4"].ToString();
            if (gramm == "")
            {
                if (objDb.ContainsKey("descrizione_html") && objDb["descrizione_html"].ToString() != "")
                {
                    List<Tag> _tags = getDescrizioneHtmlTags(objDb["descrizione_html"].ToString());
                    for (int t = 0; t < _tags.Count; t++)
                    {
                        Tag tagItem = _tags[t];
                        if (tagItem.stile == "DESCRIZIONE GRAMMATURA")
                        {
                            gramm += tagItem.content;
                        }
                    }
                }
            }

            if (sett.ToLower() != "chimica" &&
                um.ToLower() != "pz"
            )
            {
                if (gramm.IndexOf("circa") >= 0 ||
                    ((sett.ToLower() == "freschi" || sett.ToLower() == "freschissimi") && gramm == ""))
                {
                    return "";
                }
                else
                {
                    if (Decimal.TryParse(objDb["prezzo_kgl" + quale].ToString(), out decimal num))
                    {
                        return "al " + um + " " + MathExt.DecimalRoundMidpoint(num) + " €";
                    }
                    else
                    {
                        return "";
                    }

                }
            }
            else
            {
                return "";
            }
        }

        private string getPrimaDiPrezzo2(Dictionary<string, object> objDb)
        {
            string mecc = objDb["meccanica_market"].ToString();
            string rep = objDb["reparto"].ToString();
            string sett = objDb["settore"].ToString();
            string gramm = objDb["grammatura"].ToString();
            if (objDb.ContainsKey("descrizione_4"))
                gramm = objDb["descrizione_4"].ToString();

            if (gramm=="")
            {
                if (objDb.ContainsKey("descrizione_html") && objDb["descrizione_html"].ToString() != "")
                {
                    List<Tag> _tags = getDescrizioneHtmlTags(objDb["descrizione_html"].ToString());
                    for (int t = 0; t < _tags.Count; t++) {
                        Tag tagItem = _tags[t];
                        if (tagItem.stile == "DESCRIZIONE GRAMMATURA")
                        {
                            gramm += tagItem.content;
                        }
                    }
                }
            }

            if (mecc.IndexOf("1+1") >= 0)
            {
                return "2 pezzi";
            }
            else if (gramm.IndexOf("circa") >= 0 ||
                ((sett.ToLower() == "freschi" || sett.ToLower() == "freschissimi") && gramm == ""))
            {
                return "al " + objDb["um"].ToString();
            }
            else
            {
                return "";
            }
        }

        private List<Tag> getDescrizioneHtmlTags(string descr)
        {
            List<Tag> result = new List<Tag>();

            var parsing = descr;
            var next_tag = getNextTag(parsing);
            var n_iter = 0;
            try
            {


                while (next_tag != null && parsing != "")
                {
                    //alert("while " + parsing);

                    var da = next_tag.inx_start + next_tag.tag_apertura.Length;
                    var a = parsing.IndexOf(next_tag.tag_chiusura);
                    var end = a + next_tag.tag_chiusura.Length;

                    //alert(da + " -> " + (a-da));
                    var content = parsing.Substring(da, a - da);
                    //alert(content);

                    next_tag.content = content;
                    result.Add(next_tag);

                    //alert("riparto da " + end + " dopo chiusura " + next_tag.tag_chiusura);
                    parsing = parsing.Substring(end);

                    next_tag = getNextTag(parsing);
                    n_iter++;
                    if (n_iter > 500)
                        break;
                }

            }
            catch (Exception ex)
            {
                ex.ToString();
                //alert(err);
            }

            //alert(result);
            return result;
        }

        static string DESCRIZIONE_TITOLO = "<DESCRIZIONE TITOLO>";
        static string DESCRIZIONE_TITOLO_end = "</DESCRIZIONE TITOLO>";
        static string DESCRIZIONE_GRAMMATURA = "<DESCRIZIONE GRAMMATURA>";
        static string DESCRIZIONE_GRAMMATURA_end = "</DESCRIZIONE GRAMMATURA>";
        static string DESCRIZIONE_TIPO = "<DESCRIZIONE TIPO>";
        static string DESCRIZIONE_TIPO_end = "</DESCRIZIONE TIPO>";
        static string DESCRIZIONE_CARTA = "<DESCRIZIONE CARTA>";
        static string DESCRIZIONE_CARTA_end = "</DESCRIZIONE CARTA>";
        static string DESCRIZIONE_11 = "<DESCRIZIONE 1+1>";
        static string DESCRIZIONE_11_end = "</DESCRIZIONE 1+1>";
        static string ESEMPIO = "<ESEMPIO>";
        static string ESEMPIO_end = "</ESEMPIO>";
        static string DESCRIZIONE_ESEMPIO = "<DESCRIZIONE ESEMPIO>";
        static string DESCRIZIONE_ESEMPIO_end = "</DESCRIZIONE ESEMPIO>";
        static string PEZZI_DISPONIBILI = "<PEZZI DISPONIBILI>";
        static string PEZZI_DISPONIBILI_end = "</PEZZI DISPONIBILI>";

        private Tag getNextTag(string descr)
        {
            Tag next_tag = new Tag();

            var inx_descr = descr.IndexOf(DESCRIZIONE_TITOLO);
            var inx_gramm = descr.IndexOf(DESCRIZIONE_GRAMMATURA);
            var inx_tipo = descr.IndexOf(DESCRIZIONE_TIPO);
            var inx_carta = descr.IndexOf(DESCRIZIONE_CARTA);
            var inx_esempio = descr.IndexOf(ESEMPIO);
            var inx_descr_esempio = descr.IndexOf(DESCRIZIONE_ESEMPIO);
            var inx_pezzi_disp = descr.IndexOf(PEZZI_DISPONIBILI);
            var inx_11 = descr.IndexOf(DESCRIZIONE_11);



            //alert(inx_descr + "," + inx_gramm + "," + inx_tipo + "," + inx_carta + "," + inx_esempio + "," + inx_descr_esempio);

            var inx_leader = 99999999;
            if (inx_descr >= 0)
                inx_leader = inx_descr;

            next_tag.tag_apertura = DESCRIZIONE_TITOLO;
            next_tag.tag_chiusura = DESCRIZIONE_TITOLO_end;
            next_tag.stile = "DESCRIZIONE TITOLO";
            if (inx_gramm >= 0 && inx_gramm < inx_leader)
            {
                inx_leader = inx_gramm;
                next_tag.tag_apertura = DESCRIZIONE_GRAMMATURA;
                next_tag.tag_chiusura = DESCRIZIONE_GRAMMATURA_end;
                next_tag.stile = "DESCRIZIONE GRAMMATURA";
            }
            if (inx_tipo >= 0 && inx_tipo < inx_leader)
            {
                inx_leader = inx_tipo;
                next_tag.tag_apertura = DESCRIZIONE_TIPO;
                next_tag.tag_chiusura = DESCRIZIONE_TIPO_end;
                next_tag.stile = "DESCRIZIONE TIPO";
            }
            if (inx_carta >= 0 && inx_carta < inx_leader)
            {
                inx_leader = inx_carta;
                next_tag.tag_apertura = DESCRIZIONE_CARTA;
                next_tag.tag_chiusura = DESCRIZIONE_CARTA_end;
                next_tag.stile = "DESCRIZIONE CARTA";
            }
            if (inx_esempio >= 0 && inx_esempio < inx_leader)
            {
                inx_leader = inx_esempio;
                next_tag.tag_apertura = ESEMPIO;
                next_tag.tag_chiusura = ESEMPIO_end;
                next_tag.stile = "ESEMPIO";
            }
            if (inx_descr_esempio >= 0 && inx_descr_esempio < inx_leader)
            {
                inx_leader = inx_descr_esempio;
                next_tag.tag_apertura = DESCRIZIONE_ESEMPIO;
                next_tag.tag_chiusura = DESCRIZIONE_ESEMPIO_end;
                next_tag.stile = "DESCRIZIONE ESEMPIO";
            }

            if (inx_pezzi_disp >= 0 && inx_pezzi_disp < inx_leader)
            {
                inx_leader = inx_pezzi_disp;
                next_tag.tag_apertura = PEZZI_DISPONIBILI;
                next_tag.tag_chiusura = PEZZI_DISPONIBILI_end;
                next_tag.stile = "PEZZI DISPONIBILI";
            }

            if (inx_11 >= 0 && inx_11 < inx_leader)
            {
                inx_leader = inx_11;
                next_tag.tag_apertura = DESCRIZIONE_11;
                next_tag.tag_chiusura = DESCRIZIONE_11_end;
                next_tag.stile = "DESCRIZIONE 1+1";
            }

            next_tag.inx_start = inx_leader;

            if (next_tag.inx_start >= 0)
                return next_tag;

            return null;
        }

        /*
        //COOP.FI
        public Dictionary<string, object> getExportingRef(Dictionary<string, object> objDb)
        {

            Dictionary<string, object> result = objDb;

            try
            {

                //List<Dictionary<string, object>> secondari = objDb["secondari"] as List<Dictionary<string, object>>;

                if (objDb.ContainsKey("files_foto"))
                {
                    string foto = objDb["files_foto"].ToString();
                    string[] foto_list = foto.Split(',');
                    for (int i = 0; i < foto_list.Length; i++)
                    {
                        foto_list[i] = foto_list[i].Substring(foto_list[i].LastIndexOf("\\") + 1);
                    }

                    objDb["files_foto"] = string.Join(",", foto_list);
                }

                
                decimal prezzo;
                if (Decimal.TryParse(objDb["prezzo"].ToString(), out prezzo))
                    objDb["prezzo"] = MathExt.DecimalRoundMidpoint(prezzo).ToString();

                decimal promo;
                if (Decimal.TryParse(objDb["prezzo_offerta"].ToString(), out promo))
                    objDb["prezzo_offerta"] = MathExt.DecimalRoundMidpoint(promo).ToString();

                decimal prezzo_kgl;
                if (Decimal.TryParse(objDb["prezzo_kgl"].ToString(), out prezzo_kgl))
                    objDb["prezzo_kgl"] = MathExt.DecimalRoundMidpoint(prezzo_kgl).ToString();

                decimal prezzo_promo_kgl;
                if (Decimal.TryParse(objDb["prezzo_offerta_kgl"].ToString(), out prezzo_promo_kgl))
                    objDb["prezzo_offerta_kgl"] = MathExt.DecimalRoundMidpoint(prezzo_promo_kgl).ToString();


            }
            catch (Exception ex)
            {
                result = new Dictionary<string, object>();
                result.Add("error", ex.ToString());
            }


            return result;

        }
        
        public Dictionary<string, object> getExportingRefSub(Dictionary<string, object> objDb)
        {

            Dictionary<string, object> result = new Dictionary<string, object>();

            try
            {
                result.Add("codice_articolo", objDb["codice_articolo"]);

            }
            catch (Exception ex)
            {
                result = new Dictionary<string, object>();
                result.Add("error", ex.ToString());
            }


            return result;

        }
        */
    }


    public class PhotoManager
    {
        Dictionary<string, List<string>> dir_files = new Dictionary<string, List<string>>();
        List<Dictionary<string, object>> paths;

        string error_report = "";
        public string Errors
        {
            get { return error_report; }
        }
        public PhotoManager(List<string> paths)
        {            
            foreach (string path in paths)
            {
                try
                {
                    dir_files.Add(path, Directory.GetFiles(path, "*.*", SearchOption.AllDirectories).ToList());
                }
                catch (Exception ex){ error_report += ex.ToString(); }
            }            
        }
        #region nuova implementazione Istanta 2.0
        public PhotoManager(List<Dictionary<string, object>> paths)
        {
            this.paths = paths;
            
        }

        public PhotoManager()
        {
        }
     
        //public string scan()
        //{
        //    SyncResult result = new SyncResult();
        //    try
        //    {
        //        foreach (Dictionary<string, object> pathItem in paths)
        //        {
        //            try
        //            {

        //                string path = pathItem["path"].ToString();
        //                string user = "";
        //                string pass = "";


        //                if (pathItem.ContainsKey("credentials"))
        //                {
        //                    string _access = pathItem["credentials"].ToString();
        //                    if (_access != "" && _access.IndexOf("@") > 0)
        //                    {
        //                        //Necessaria identificazione utente
        //                        string[] credenziali = _access.Split('@');
        //                        user = credenziali[0];
        //                        pass = credenziali[1];
        //                    }
        //                }

        //                if (user != "")
        //                {
        //                    System.Net.NetworkCredential readCredentials = new NetworkCredential(user, pass);

        //                    /*
        //                    var credentials = new SimpleImpersonation.UserCredentials(user, pass);
        //                    var files = SimpleImpersonation.Impersonation.RunAsUser(credentials, SimpleImpersonation.LogonType.Network, () =>
        //                    {
        //                        string[] _res = Directory.GetFiles(path, "*.*", SearchOption.AllDirectories);
        //                        return _res;

        //                        //return System.IO.Directory.GetFiles(@"\\server\share");
        //                    });*/

                            
        //                    using (new NetworkConnection(path, readCredentials))
        //                    {
        //                        string[] files = Directory.GetFiles(path, "*.*", SearchOption.AllDirectories);
        //                        foreach(string f in files)
        //                        {
        //                            var syF = getSyncFile((Int64)pathItem["id"], f);
        //                            if (syF!=null)
        //                                result.files.Add(syF);
        //                        }
        //                    }
        //                }
        //                else
        //                {
        //                    string[] files = Directory.GetFiles(path, "*.*", SearchOption.AllDirectories);
        //                    foreach (string f in files)
        //                    {
        //                        var syF = getSyncFile((Int64)pathItem["id"], f);
        //                        if (syF!=null)
        //                            result.files.Add(syF);
        //                    }
        //                }
        //            }
        //            catch (Exception ex) { 
        //                result.error += ex.ToString(); 
        //            }
        //        }
        //    }
        //    catch(Exception ex)
        //    {
        //        result.error = ex.ToString();
        //    }

            

        //    return Newtonsoft.Json.JsonConvert.SerializeObject(result);
        //}

        //public string scanFile(string filename)
        //{
        //    foreach (Dictionary<string, object> pathItem in paths)
        //    {
        //        string path = pathItem["path"].ToString();
        //        string user = "";
        //        string pass = "";

        //        string f = path + "\\" + filename;
                
        //        try
        //        {
        //            if (pathItem.ContainsKey("credentials"))
        //            {
        //                string _access = pathItem["credentials"].ToString();
        //                if (_access != "" && _access.IndexOf("@") > 0)
        //                {
        //                    //Necessaria identificazione utente
        //                    string[] credenziali = _access.Split('@');
        //                    user = credenziali[0];
        //                    pass = credenziali[1];
        //                }
        //            }

        //            if (user != "")
        //            {
        //                System.Net.NetworkCredential readCredentials = new NetworkCredential(user, pass);

        //                SyncFile result=new SyncFile();
        //                bool flag = false;

        //                using (new NetworkConnection(path, readCredentials))
        //                {
        //                    if (File.Exists(f))
        //                    {
        //                        flag = true;
        //                        result = getSyncFile((Int64)pathItem["id"], f);
        //                    }

        //                }

        //                if (flag)
        //                {
        //                    return Newtonsoft.Json.JsonConvert.SerializeObject(result);
        //                }
        //            }
        //            else
        //            {
        //                if (File.Exists(f))
        //                {
        //                    SyncFile result = getSyncFile((Int64)pathItem["id"], f);
        //                    return Newtonsoft.Json.JsonConvert.SerializeObject(result);
        //                }
        //            }
        //        }
        //        catch (Exception ex)
        //        {
        //            return ex.ToString();
        //        }
        //    }

        //    return "no found";
            
        //}

        //private SyncFile getSyncFile(Int64 idPath, string f)
        //{
        //    SyncFile item = new SyncFile();
        //    try
        //    {
        //        item.idPath = idPath;
        //        item.filename = f.Substring(f.LastIndexOf("\\") + 1);
        //        if (item.filename.IndexOf("!")==0)
        //        {
        //            //I file con questo carattere iniziale sono file NON riconosciuti dall'operatore come ancora validi, per cui in fase di SYNC vanno saltati
        //            return null;
        //        }
        //        else if (item.filename.IndexOf("$") == 0)
        //        {
        //            //Siamo nella casistica per cui l'utente rinominando il file,
        //            //Ha messo come primo carattere il "$"
        //            //E dal momento che viene processato qui, significa che il Core ha valutato che il valore immesso dopo
        //            //sia seguito dal separatore "_" e dal resto del nome effettivo del file
        //            //es.
        //            //$798989_Mele fresche.psd
        //            //Il nome della foto che verrà salvata sarà
        //            //Mele fresche.psd
        //            //Il codice forzato da ricercare che l'operatore ha messo è 798989 e per contenerlo ha usato $ in apertura e _ in chiusura

        //            //Per questa ragione per ricavare il dato richiesto
        //            if (item.filename.IndexOf('_') > 0)
        //            {
        //                item.queryFilename = item.filename.Substring(1, item.filename.IndexOf('_')-1);
        //            }
        //        }

        //        item.stato = 0;
        //        item.md5 = GetMD5HashFromFile(f);
        //        item.stato = StatoSyncFile.Scanned;
        //    }
        //    catch(Exception ex)
        //    {
        //        item.error = ex.ToString();
        //        item.stato = StatoSyncFile.ScannedError;
        //    }

        //    return item;
        //}

        //public string uploadSyncFile(byte[] file, string filename)
        //{
        //    try
        //    {
        //        if (this.paths.Count>0)
        //        {
        //            Dictionary<string,object> syncFolder = this.paths.FirstOrDefault();
        //            string user = "";
        //            string pass = "";
        //            string path = syncFolder["path"].ToString();

        //            if (syncFolder.ContainsKey("credentials"))
        //            {
        //                string _access = syncFolder["credentials"].ToString();
        //                if (_access != "" && _access.IndexOf("@") > 0)
        //                {
        //                    //Necessaria identificazione utente
        //                    string[] credenziali = _access.Split('@');
        //                    user = credenziali[0];
        //                    pass = credenziali[1];
        //                }
        //            }

        //            if (user != "")
        //            {
        //                System.Net.NetworkCredential readCredentials = new NetworkCredential(user, pass);
   
        //                using (new NetworkConnection(path, readCredentials))
        //                {
        //                    using (FileStream fs = new FileStream(path + "\\" + filename, FileMode.Create, FileAccess.Write))
        //                    {
        //                        fs.Write(file, 0, file.Length);
        //                    }
        //                }
        //            }
        //            else
        //            {
        //                using (FileStream fs = new FileStream(path + "\\" + filename, FileMode.Create, FileAccess.Write))
        //                {
        //                    fs.Write(file, 0, file.Length);                            
        //                }

        //            }

        //        }
        //        else
        //        {
        //            throw new Exception("nessuna directory impostata");
        //        }
        //    }
        //    catch(Exception ex)
        //    {
        //        return ex.ToString();
        //    }

        //    return "ok";
        //}

        public string startExport(Dictionary<string, object> expDir, Dictionary<string, object> altaDir, string pathEsportazione, string[] listFiles)
        {

            string user = "";
            string pass = "";
            string path = expDir["path"].ToString();

            if (expDir.ContainsKey("credentials"))
            {
                string _access = expDir["credentials"].ToString();
                if (_access != "" && _access.IndexOf("@") > 0)
                {
                    //Necessaria identificazione utente
                    string[] credenziali = _access.Split('@');
                    user = credenziali[0];
                    pass = credenziali[1];
                }
            }

            if (user != "")
            {
                System.Net.NetworkCredential readCredentials = new NetworkCredential(user, pass);

                using (new NetworkConnection(path, readCredentials))
                {
                    if (!Directory.Exists(pathEsportazione))
                    {
                        Directory.CreateDirectory(pathEsportazione);                        
                    }

                    string links_folder = pathEsportazione + "\\Links";
                    if (!Directory.Exists(links_folder))
                    {
                        Directory.CreateDirectory(links_folder);
                    }

                    foreach (string pathListfile in listFiles)
                    {
                        using (FileStream fs_source = new FileStream(pathListfile, FileMode.Open, FileAccess.Read, FileShare.Read))
                        {
                            FileInfo fi = new FileInfo(pathListfile);
                            string dest = pathEsportazione + "\\" + fi.Name;

                            byte[] bytes_source = new byte[fs_source.Length];
                            fs_source.Read(bytes_source, 0, bytes_source.Length);
                            using (FileStream fs_copy = new FileStream(dest, FileMode.Create))
                            {
                                fs_copy.Write(bytes_source, 0, bytes_source.Length);
                            }
                        }
                    }
                    
                }
            }
            else
            {
                if (!Directory.Exists(pathEsportazione))
                {
                    Directory.CreateDirectory(pathEsportazione);
                }


                string links_folder = pathEsportazione + "\\links";
                if (!Directory.Exists(links_folder))
                {
                    Directory.CreateDirectory(links_folder);
                }

                foreach (string pathListfile in listFiles)
                {
                    using (FileStream fs_source = new FileStream(pathListfile, FileMode.Open, FileAccess.Read, FileShare.Read))
                    {
                        FileInfo fi = new FileInfo(pathListfile);
                        string dest = pathEsportazione + "\\" + fi.Name;

                        byte[] bytes_source = new byte[fs_source.Length];
                        fs_source.Read(bytes_source, 0, bytes_source.Length);
                        using (FileStream fs_copy = new FileStream(dest, FileMode.Create))
                        {
                            fs_copy.Write(bytes_source, 0, bytes_source.Length);
                        }
                    }
                }

            }

            this.paths = new List<Dictionary<string, object>>();
            this.paths.Add(expDir);
            this.paths.Add(altaDir);

            return "ok";
        }

        public string exportFileFromAltaTo(string fileOrigin, string fileDest)
        {
            var altaDir=this.paths[1];
            string user = "";
            string pass = "";
            string path = altaDir["path"].ToString();

            string fileOriginDef = fileOrigin;
            if (fileOriginDef.IndexOf("!")==0)
            {
                //Se trovo questo simbolo il file è ancora incerto
                //Ma se è l'unica possibilità devo cmq tentare di uscire per cui prendo la parte che è salvata su FS ovvero decurtando la formula "!<cod_ref>_"
                fileOriginDef = fileOriginDef.Substring(fileOriginDef.IndexOf("_") + 1);
            }

            if (altaDir.ContainsKey("credentials"))
            {
                string _access = altaDir["credentials"].ToString();
                if (_access != "" && _access.IndexOf("@") > 0)
                {
                    //Necessaria identificazione utente
                    string[] credenziali = _access.Split('@');
                    user = credenziali[0];
                    pass = credenziali[1];
                }
            }

            if (user != "")
            {
                System.Net.NetworkCredential readCredentials = new NetworkCredential(user, pass);

                using (new NetworkConnection(path, readCredentials))
                {
                    //string fileOriginDef = fileOrigin;
                    string fileDestDef = fileDest;
                    if (!System.IO.File.Exists(fileOriginDef))
                    {
                        fileOriginDef = path + "\\nofoto.psd";
                        FileInfo fi_no_ex = new FileInfo(fileOrigin);
                        fileDestDef = fileDest.Replace(fi_no_ex.Extension, ".psd");
                    }

                    using (FileStream fs_source = new FileStream(fileOriginDef, FileMode.Open, FileAccess.Read, FileShare.Read))
                    {
                        byte[] bytes_source = new byte[fs_source.Length];
                        fs_source.Read(bytes_source, 0, bytes_source.Length);
                        using (FileStream fs_copy = new FileStream(fileDestDef, FileMode.Create))
                        {
                            fs_copy.Write(bytes_source, 0, bytes_source.Length);
                        }
                    }
                }
            }
            else
            {
                //string fileOriginDef = fileOrigin;
                string fileDestDef = fileDest;
                if (!System.IO.File.Exists(fileOriginDef))
                {
                    fileOriginDef = path + "\\nofoto.psd";
                    FileInfo fi_no_ex = new FileInfo(fileOrigin);
                    fileDestDef = fileDest.Replace(fi_no_ex.Extension, ".psd");
                }

                using (FileStream fs_source = new FileStream(fileOriginDef, FileMode.Open, FileAccess.Read, FileShare.Read))
                {
                    byte[] bytes_source = new byte[fs_source.Length];
                    fs_source.Read(bytes_source, 0, bytes_source.Length);
                    using (FileStream fs_copy = new FileStream(fileDestDef, FileMode.Create))
                    {
                        fs_copy.Write(bytes_source, 0, bytes_source.Length);
                    }
                }
            }


            return "ok";
        }


        //public ResultSearchedPhoto cercaFotoByName2(string searchPath, string chiave, string pathweb)
        //{
        //    ResultSearchedPhoto result = new ResultSearchedPhoto();

        //    try
        //    {
        //        try
        //        {
        //            System.Net.NetworkCredential readCredentials = new NetworkCredential("admin", "admin");

        //            using (new NetworkConnection(searchPath, readCredentials))
        //            {
        //                //File.Copy(@"\\Servername\DevTest\MyFiles\XXX.txt", @"\\Servername\DevTest\MyFiles\XXX-Copy.txt");
        //                List<string> _files = Directory.GetFiles(searchPath).Where(item => item.Contains(chiave)).ToList();

        //                foreach (string s in _files)
        //                {
        //                    SearchedFoto sf = new SearchedFoto();
        //                    sf.nome_file = s.Substring(s.LastIndexOf("\\") + 1);
        //                    sf.path = s.Substring(0, s.LastIndexOf("\\"));
        //                    sf.macroPath = searchPath;
        //                    sf.md5 = GetMD5HashFromFile(s);
        //                    result.list.Add(sf);

        //                    FileInfo info = new FileInfo(sf.nome_file);
        //                    string webfile = sf.nome_file.Replace(info.Extension, ".jpg");
        //                }

        //            }


        //            /*
        //            NetworkCredential cred = new NetworkCredential("admin", "admin");

        //            List<string> _files = Directory.GetFiles("\\\\NASNavcove\\Public\\CoopRepository\\Archivio_DOC\\alta").Where(item => item.Contains("8033300821152")).ToList();
        //            _files.ToString();*/
        //        }
        //        catch (Exception ex)
        //        {
        //            ex.ToString();
        //            result.error = "OOOOO" + ex.ToString();
        //        }

        //        /*
        //        List<string> _files = Directory.GetFiles(searchPath).Where(item => item.Contains(chiave)).ToList();
        //        List<string> webconversion = new List<string>();
        //        foreach (string s in _files)
        //        {
        //            SearchedFoto sf = new SearchedFoto();
        //            sf.nome_file = s.Substring(s.LastIndexOf("\\") + 1);
        //            sf.path = s.Substring(0, s.LastIndexOf("\\"));
        //            sf.macroPath = searchPath;
        //            sf.md5 = GetMD5HashFromFile(s);
        //            result.list.Add(sf);

        //            FileInfo info = new FileInfo(sf.nome_file);
        //            string webfile = sf.nome_file.Replace(info.Extension, ".jpg");
        //            if (!File.Exists(pathweb + webfile))
        //                webconversion.Add(sf.path + "\\" + sf.nome_file);
        //        }


        //        if (pathweb != "")
        //        {
        //            this.convertForWeb(webconversion, pathweb);
        //        }
        //        */
        //    }
        //    catch (Exception ex2)
        //    {
        //        result.error = "OOOOO" + ex2.ToString();
        //    }

        //    return result;
        //}

        //public Dictionary<string, object> syncFotoFromIndd(byte[] arrBytes, string nomeFile, Dictionary<string, object> sync_folder_item, Dictionary<string, object> path_alta_item, Dictionary<string, object> path_web_item)
        //{
        //    Dictionary<string, object> result = new Dictionary<string, object>();
        //    result["error"] = "";
        //    try
        //    {
        //        //sync
        //        string path_sync = sync_folder_item["path"].ToString();
        //        string user = "";
        //        string pass = "";
        //        string filePath = path_sync + "\\" + nomeFile;

        //        if (sync_folder_item.ContainsKey("credentials"))
        //        {
        //            string _access = sync_folder_item["credentials"].ToString();
        //            if (_access != "" && _access.IndexOf("@") > 0)
        //            {
        //                //Necessaria identificazione utente
        //                string[] credenziali = _access.Split('@');
        //                user = credenziali[0];
        //                pass = credenziali[1];
        //            }
        //        }

        //        if (user != "")
        //        {
        //            System.Net.NetworkCredential readCredentials = new NetworkCredential(user, pass);

        //            using (new NetworkConnection(path_sync, readCredentials))
        //            {
        //                using (FileStream fs=new FileStream(filePath, FileMode.Create))
        //                {
        //                    fs.Write(arrBytes, 0, arrBytes.Length);
        //                }
        //            }
        //        }
        //        else
        //        {
        //            using (FileStream fs = new FileStream(filePath, FileMode.Create))
        //            {
        //                fs.Write(arrBytes, 0, arrBytes.Length);
        //            }
        //        }

        //        string hash = GetMD5HashFromFile(filePath);
        //        //path_alta
        //        string path_alta = path_alta_item["path"].ToString();
        //        string user_alta = "";
        //        string pass_alta = "";


        //        if (path_alta_item.ContainsKey("credentials"))
        //        {
        //            string _access = path_alta_item["credentials"].ToString();
        //            if (_access != "" && _access.IndexOf("@") > 0)
        //            {
        //                //Necessaria identificazione utente
        //                string[] credenziali = _access.Split('@');
        //                user_alta = credenziali[0];
        //                pass_alta = credenziali[1];
        //            }
        //        }

        //        if (user_alta != "")
        //        {
        //            System.Net.NetworkCredential readCredentials = new NetworkCredential(user_alta, pass_alta);

        //            using (new NetworkConnection(path_alta, readCredentials))
        //            {
        //                File.Copy(filePath, path_alta + "\\" + nomeFile, true);
        //            }
        //        }
        //        else
        //        {
        //            File.Copy(filePath, path_alta + "\\" + nomeFile, true);          
        //        }


        //        //path_web
        //        string path_web = path_web_item["path"].ToString();
        //        string user_web = "";
        //        string pass_web = "";


        //        if (path_web_item.ContainsKey("credentials"))
        //        {
        //            string _access = path_web_item["credentials"].ToString();
        //            if (_access != "" && _access.IndexOf("@") > 0)
        //            {
        //                //Necessaria identificazione utente
        //                string[] credenziali = _access.Split('@');
        //                user_web = credenziali[0];
        //                pass_web = credenziali[1];
        //            }
        //        }

        //        if (user_web != "")
        //        {
        //            System.Net.NetworkCredential readCredentials = new NetworkCredential(user_web, pass_web);

        //            using (new NetworkConnection(path_web, readCredentials))
        //            {
        //                convertFoto(filePath, path_web+"\\"+ nomeFile.Substring(0,nomeFile.LastIndexOf("."))+".jpg");
        //            }
        //        }
        //        else
        //        {
        //            convertFoto(filePath, path_web);
        //        }

        //        File.Delete(filePath);

        //        result["hash"] = hash;
        //        result["esito"] = true;
        //        return result;
        //    }
        //    catch (Exception ex)
        //    {
        //        result["error"] = ex.ToString();
        //        result["eesito"] = false;
        //        return result;
        //    }
        //}

        //public string sync(Int64 idPath, string sync_file, string path_alta, string path_web)
        //{
        //    SyncFile result = new SyncFile();
        //    result.idPath = idPath;
        //    result.filename = sync_file;

        //    string report_error = "";
        //    int prog = 0;

        //    Dictionary<string, object> pathItem = this.paths.Where(p => (Int64)p["id"] == idPath).FirstOrDefault();

        //    if (pathItem==null)
        //    {
        //        throw new Exception("Folder not found");
        //    }

        //    string path = pathItem["path"].ToString();
        //    string user = "";
        //    string pass = "";

        //    string fullname = path + "\\" + sync_file;

        //    string sync_file_alta = sync_file;
        //    if (sync_file.IndexOf("$")==0)
        //    {
        //        //Siamo nella casistica per cui l'utente rinominando il file,
        //        //Ha messo come primo carattere il "$"
        //        //E dal momento che viene processato qui, significa che il Core ha valutato che il valore immesso dopo
        //        //sia seguito dal separatore "_" e dal resto del nome effettivo del file

        //        //Per questa ragione per ricavare il nome da salvare sia in alta che su web che su db è ricavato così
        //        if (sync_file_alta.IndexOf('_') > 0)
        //        {
        //            sync_file_alta = sync_file_alta.Substring(sync_file_alta.IndexOf('_') + 1);
        //            result.filename = sync_file_alta;
        //        }
        //    }
        //    string altaFullname = path_alta + "\\" + sync_file_alta;

        //    if (pathItem.ContainsKey("credentials"))
        //    {
        //        string _access = pathItem["credentials"].ToString();
        //        if (_access != "" && _access.IndexOf("@") > 0)
        //        {
        //            //Necessaria identificazione utente
        //            string[] credenziali = _access.Split('@');
        //            user = credenziali[0];
        //            pass = credenziali[1];
        //        }
        //    }

        //    if (user != "")
        //    {
        //        System.Net.NetworkCredential readCredentials = new NetworkCredential(user, pass);

        //        using (new NetworkConnection(path, readCredentials))
        //        {
        //            try
        //            {
        //                if (File.Exists(fullname))
        //                {
        //                    //Converto la foto in jpg e in bassa per spostarla nella folder web
        //                    convertFoto(fullname, path_web);
        //                    //Poi copio la foto in alta e la elimino da sync folder
        //                    File.Copy(fullname, altaFullname, true);
        //                    File.Delete(fullname);
        //                    result.stato = StatoSyncFile.Synced;

        //                }
        //                else
        //                {
        //                    throw new Exception("foto not found");
        //                }
        //            }catch(Exception ex)
        //            {
        //                result.error = ex.ToString();
        //                result.stato = StatoSyncFile.SyncedError;
        //            }
        //        }
        //    }
        //    else
        //    {
        //        try
        //        {
        //            if (File.Exists(fullname))
        //            {
        //                //Converto la foto in jpg e in bassa per spostarla nella folder web
        //                convertFoto(fullname, path_web);
        //                //Poi copio la foto in alta e la elimino da sync folder
        //                File.Copy(fullname, altaFullname, true);                        
        //                File.Delete(fullname);
        //                result.stato = StatoSyncFile.Synced;
        //            }
        //            else
        //            {
        //                throw new Exception("foto not found");
        //            }
        //        }
        //        catch (Exception ex)
        //        {
        //            result.error = ex.ToString();
        //            result.stato = StatoSyncFile.SyncedError;
        //        }
        //    }


        //    return Newtonsoft.Json.JsonConvert.SerializeObject(result);
        //}

        //private void convertFoto(string f, string path_web)
        //{
        //    uint w = 0;
        //    uint h = 0;

        //    using (var image = new MagickImage(f))
        //    {
        //        w = 400;
        //        h = (image.Height * w) / image.Width;
        //    }


        //    var settings = new MagickReadSettings();
        //    // Tells the xc: reader the image to create should be 800x600
        //    settings.Width = w;
        //    settings.Height = h;

        //    string onlyname = f.Substring(f.LastIndexOf("\\") + 1);
        //    onlyname = onlyname.Substring(0, onlyname.LastIndexOf("."));

        //    if (onlyname.IndexOf("$") == 0)
        //    {
        //        //Siamo nella casistica per cui l'utente rinominando il file,
        //        //Ha messo come primo carattere il "$"
        //        //E dal momento che viene processato qui, significa che il Core ha valutato che il valore immesso dopo
        //        //sia seguito dal separatore "_" e dal resto del nome effettivo del file

        //        //Per questa ragione per ricavare il nome da salvare sia in alta che su web che su db è ricavato così
        //        onlyname = onlyname.Substring(onlyname.IndexOf('_') + 1);

        //    }

        //    using (var image = new MagickImage(f, settings))
        //    {
        //        //image.CompressionMethod = ImageMagick.CompressionMethod.JPEG2000;
        //        image.Resize(w, h);
        //        image.Quality = 75;
        //        image.Blur(0.05, 0.5);
        //        image.Strip();
        //        image.Write(path_web + "\\" + onlyname + ".jpg");
        //    }
        //}

        #endregion
        //public ResultSearchedPhoto cercaFoto(Dictionary<string, object> objDb)
        //{
        //    ResultSearchedPhoto result = new ResultSearchedPhoto();

        //    try
        //    {
        //        string ean = "";
        //        string codice = "";
        //        if (objDb.ContainsKey("codice_referenza"))
        //            codice = objDb["codice_referenza"].ToString();
        //        else if (objDb.ContainsKey("codice_articolo"))
        //            codice = objDb["codice_articolo"].ToString();
        //        else
        //            throw new Exception("codice ref non valido");

        //        if(objDb.ContainsKey("barcode"))
        //            ean = objDb["barcode"].ToString();
        //        else if (objDb.ContainsKey("ean"))
        //            ean = objDb["barcode"].ToString();

        //        if (codice == "" && ean == "")
        //            return result;
        //        /*string nome_esplicito = "";
        //        if (objDb["nome_foto"]!=null)
        //        {
        //            nome_esplicito = objDb["nome_foto"].ToString();
        //        }*/

        //        foreach (string path in dir_files.Keys)
        //        {
        //            //DirectoryInfo di1 = new DirectoryInfo(path);
        //            //FileInfo[] found = di1.GetFiles("*"+codice+"*.*", SearchOption.AllDirectories);

        //            //string found = "";

        //            List<string> founds = dir_files[path].Where(s => (codice != null && s.Contains(codice)) || (s.Contains(ean) && ean!="")).ToList();//.FirstOrDefault();

        //            foreach (string found in founds)
        //            {

        //               /* if ((found == null || found == "") && ean != "")
        //                {
        //                    //found = di1.GetFiles("*" + ean + "*.*");
        //                    found = dir_files[path].Where(s => s.Contains(ean)).FirstOrDefault();
        //                }*/

        //                if (found != null && found != "")
        //                {
        //                    string path2 = path;
        //                    if (path2.IndexOf("\\") < 0)
        //                        path2 += "\\";
        //                    SearchedFoto sf = new SearchedFoto();
        //                    sf.nome_file = found.Substring(found.LastIndexOf("\\") + 1);

        //                    if (sf.nome_file.IndexOf(codice) > 0 && (!sf.nome_file.Contains(ean) || ean==""))
        //                    {
        //                        //Se il codice è all'interno del testo e non come inizio del file, allora è da scartare
        //                        continue;
        //                    }

        //                    FileInfo fi = new FileInfo(found);

        //                    sf.path = found.Substring(0, found.LastIndexOf("\\"));
        //                    sf.macroPath = path2;
        //                    sf.md5 = GetMD5HashFromFile(found);
        //                    sf.data_modifica = fi.LastWriteTime;
        //                    result.list.Add(sf);
        //                    //break;
        //                }
        //            }

        //            if (founds.Count > 0)
        //            {
        //                result.list = result.list.OrderByDescending(o => o.data_modifica).ToList();
        //                break;
        //            }

        //        }
        //    }
        //    catch (Exception ex)
        //    {
        //        result.error = "OOOOO" + ex.ToString();
        //    }

        //    return result;
        //}

        //public ResultSearchedPhoto cercaFotoByName(string chiave, string pathweb)
        //{
        //    ResultSearchedPhoto result = new ResultSearchedPhoto();

        //    try
        //    {

        //        foreach (string path in dir_files.Keys)
        //        {
        //            //DirectoryInfo di1 = new DirectoryInfo(path);
        //            //FileInfo[] found = di1.GetFiles("*"+codice+"*.*", SearchOption.AllDirectories);

        //            //string found = "";

        //            List<string> founds = dir_files[path].Where(s => s.Contains(chiave)).ToList();

        //            List<string> webconversion = new List<string>();

        //            foreach (string found in founds)
        //            {

        //                if (found != null && found != "")
        //                {
        //                    string path2 = path;
        //                    if (path2.IndexOf("\\") < 0)
        //                        path2 += "\\";
        //                    SearchedFoto sf = new SearchedFoto();
        //                    sf.nome_file = found.Substring(found.LastIndexOf("\\") + 1);
        //                    sf.path = found.Substring(0, found.LastIndexOf("\\"));
        //                    sf.macroPath = path2;
        //                    sf.md5 = GetMD5HashFromFile(found);
        //                    result.list.Add(sf);

        //                    FileInfo info = new FileInfo(sf.nome_file);
        //                    string webfile = sf.nome_file.Replace(info.Extension, ".jpg");
        //                    if (!File.Exists(pathweb + webfile))
        //                        webconversion.Add(sf.path + "\\"+sf.nome_file);
        //                }
        //            }
                    
        //            if (pathweb != "")
        //            {
        //                this.convertForWeb(webconversion, pathweb);
        //            }

        //            if (founds.Count > 0)
        //                break;

        //        }
        //    }
        //    catch (Exception ex)
        //    {
        //        result.error = "OOOOO" + ex.ToString();
        //    }

        //    return result;
        //}
        
        //protected string GetMD5HashFromFile(string fileName)
        //{
        //    using (var md5 = MD5.Create())
        //    {
                
        //        using (var stream = File.OpenRead(fileName))
        //        {
        //            return BitConverter.ToString(md5.ComputeHash(stream)).Replace("-", string.Empty);
        //        }
        //    }
        //}

        //public string convertForWeb(List<string> files, string path_web)
        //{

        //    string report_error = "";
        //    int prog = 0;

        //    foreach (string f in files)
        //    {
        //        try
        //        {
        //            uint w = 0;
        //            uint h = 0;

        //            if (File.Exists(f))

        //            {
        //                using (var image = new MagickImage(f))
        //                {
        //                    w = 400;
        //                    h = (image.Height * w) / image.Width;
        //                }


        //                var settings = new MagickReadSettings();
        //                // Tells the xc: reader the image to create should be 800x600
        //                settings.Width = w;
        //                settings.Height = h;

        //                string onlyname = f.Substring(f.LastIndexOf("\\") + 1);
        //                onlyname = onlyname.Substring(0, onlyname.LastIndexOf("."));

        //                using (var image = new MagickImage(f, settings))
        //                {
        //                    //image.CompressionMethod = ImageMagick.CompressionMethod.JPEG2000;
        //                    image.Resize(w, h);
        //                    image.Quality = 75;
        //                    image.Blur(0.05, 0.5);
        //                    image.Strip();
        //                    image.Write(path_web + onlyname + ".jpg");
        //                }
        //            }
        //            else
        //            {
        //                report_error += "########!!!!!!! FOTO NON TROVATA: " + f;
        //            }
        //        }
        //        catch (Exception ex)
        //        {
        //            report_error += f + " : " + ex.ToString() + ", ";
        //        }

        //        prog++;

        //    }

        //    return report_error;
        //}

        public string scanSyncFotoFromDb(List<string> fotoDb)
        {
            var result = new SyncResult();
            try
            {
                List<string> file_matches = new List<string>();

                //Scansione l'attuale Sync Folder
                //SyncResult resultScansione = JsonConvert.DeserializeObject<SyncResult>(this.scan());
                List<string> file_searched = new List<string>();
                foreach (Dictionary<string, object> pathItem in paths)
                {
                    try
                    {

                        string path = pathItem["path"].ToString();
                        string user = "";
                        string pass = "";


                        if (pathItem.ContainsKey("credentials"))
                        {
                            string _access = pathItem["credentials"].ToString();
                            if (_access != "" && _access.IndexOf("@") > 0)
                            {
                                //Necessaria identificazione utente
                                string[] credenziali = _access.Split('@');
                                user = credenziali[0];
                                pass = credenziali[1];
                            }
                        }

                        if (user != "")
                        {
                            System.Net.NetworkCredential readCredentials = new NetworkCredential(user, pass);


                            using (new NetworkConnection(path, readCredentials))
                            {
                                file_searched = Directory.GetFiles(path, "*.*", SearchOption.AllDirectories).ToList();
                            }
                        }
                        else
                        {
                            file_searched = Directory.GetFiles(path, "*.*", SearchOption.AllDirectories).ToList();
                        }
                    }
                    catch (Exception ex)
                    {
                        result.error += ex.ToString();
                    }
                }

                if (file_searched.Count>0)
                {
                    //Prendo il primo path fornito a PhotoManager (solitamente è sempre e solo 1 path (la cartella di sync)
                    //E creo la cartella dove sposterò tutte le foto che il DB ha già registrate
                    string path = this.paths[0]["path"].ToString();
                    string syncdb_path = path + "\\SYNCDB";

                    //Non mi dovrebbero servire più  le credenziali IN CASO di path protetto, perchè ci avrebbe già pensato l'operazione di SCAN
                    if (!Directory.Exists(syncdb_path))
                        Directory.CreateDirectory(syncdb_path);

                    //Confronto il risultato di scansione con la listadi files registrati su DB
                    foreach (string file in file_searched)
                    {
                        //Cerco le foto dove è contenuto il nome: Questo mi da la possibilità di vedere la lista di foto in caso della formula ?<COD>_
                        string filename = file.Substring(file.LastIndexOf("\\") + 1);
                        List<string> _foto_cercate_in_db = fotoDb.Where(f => f.Contains(filename)).ToList();
                        
                        result.files.Add(new SyncFile() { filename=filename });

                        foreach (string fName in _foto_cercate_in_db)
                        {
                            //Se trovo corrispondenza copio file dalla cartella principale di SYNC, nella sotto cartella SYNCDB appena creata
                            string fNameChecked = fName;
                            if (fNameChecked.IndexOf("?")==0)
                            {
                                fNameChecked = fNameChecked.Replace("?", "!");
                            }
                            File.Copy(file, syncdb_path + "\\" + fNameChecked, true);
                            file_matches.Add(fName);
                        }
                    }

                    var non_trovati_su_fs = fotoDb.Except(file_matches).ToList();

                    if (non_trovati_su_fs.Count>0)
                        result.error = "Mismatch: " + String.Join(",", non_trovati_su_fs);
                }
            }
            catch (Exception ex)
            {
                result.error = ex.ToString();
            }

            return JsonConvert.SerializeObject(result);

        }

        public class returnFotoZip
        {
            public bool esito = true;
            public string error = "";
            public string zipName = "";
        }
        public returnFotoZip generaPacchettoFoto(Dictionary<string, string>  lista_articoli, Dictionary<string, object> pathItem)
        {
            returnFotoZip result = new returnFotoZip();
            string user = "";
            string pass = "";
            float flussoCodice = 0;

            try
            {
                DateTime currentDateTime = DateTime.Now;

                // Formatta la data e l'ora come desideri, ad esempio nel formato "yyyyMMdd_HHmmss"
                string formattedDateTime = currentDateTime.ToString("yyyyMMdd_HHmmss");

                // Costruisci il nome del file con la data e l'ora aggiunte
                string name = "result_" + formattedDateTime + ".zip";

                string pathAlta = pathItem["path"].ToString();
                string pathTemp = ConfigurationManager.AppSettings["pathTemp"].ToString();

                flussoCodice = 1;
                if (pathItem.ContainsKey("credentials"))
                {
                    string _access = pathItem["credentials"].ToString();
                    if (_access != "" && _access.IndexOf("@") > 0)
                    {
                        //Necessaria identificazione utente
                        string[] credenziali = _access.Split('@');
                        user = credenziali[0];
                        pass = credenziali[1];
                    }
                }


                flussoCodice = 2;


                if (user != "")
                {
                    System.Net.NetworkCredential readCredentials = new NetworkCredential(user, pass);


                    using (new NetworkConnection(pathAlta, readCredentials))
                    {
                        var res = generaPacchettoFotoCallback(lista_articoli, pathAlta, pathTemp, name);
                        if (!res.esito)
                        {
                            flussoCodice = 2.05f;
                            throw new Exception(res.error);
                        }
                        else
                        {
                            flussoCodice = 2.1f;
                            result.zipName = res.zipName+"/"+name;
                            return result;
                        }
                    }


                }
                else
                {
                    var res = generaPacchettoFotoCallback(lista_articoli, pathAlta, pathTemp, name);
                    if (!res.esito)
                    {
                        flussoCodice = 2.15f;
                        throw new Exception(res.error);
                    }
                    else
                    {
                        flussoCodice = 2.2f;
                        result.zipName = res.zipName + "/" + name;
                        return result;
                    }
                }

            }
            catch(Exception ex)
            {
                result.esito = false;
                result.error = ex.ToString() + "flussoCodice: "+flussoCodice;
                return result;
            }
        }


        private returnFotoZip generaPacchettoFotoCallback(Dictionary<string, string> lista_articoli, string pathAlta, string pathTemp, string zipname)
        {
            float flussoCodiceCallBack = 3;
            string nomeFotoSchianto = "";
            returnFotoZip result = new returnFotoZip();
            try
            {
                string uid = "test";
                string testFolderName = $"{uid}\\Links";

                string dirWorking = $"{pathTemp}\\{testFolderName}";
                string zipFolder = $"{pathTemp}\\{uid}";

                if (!Directory.Exists(dirWorking))
                {
                    Directory.CreateDirectory(dirWorking);
                }

                flussoCodiceCallBack = 4;
                string zipPath = $"{pathTemp}\\{zipname}";

                foreach (string k in lista_articoli.Keys)
                {

                    string nome_foto = lista_articoli[k];
                    nomeFotoSchianto = nome_foto;
                    string fileToSearch = $"{pathAlta}\\{nome_foto}";
                    if (File.Exists(fileToSearch))
                    {
                        File.Copy(fileToSearch, $"{dirWorking}\\{nome_foto}", true);
                    }
                    else
                    {
                        string fileNoFoto = $"{pathAlta}\\nofoto.psd";
                        File.Copy(fileNoFoto, $"{dirWorking}\\{nome_foto}", true);
                    }

                }
                flussoCodiceCallBack = 5;

                string pathBolliniInAlta =$"{pathAlta}\\bollini";
                if (Directory.Exists(pathBolliniInAlta))
                {
                    Directory.CreateDirectory(dirWorking + "\\bollini");

                    foreach (string bia in Directory.GetFiles(pathBolliniInAlta))
                    {
                        string nome_foto = bia.Substring(bia.LastIndexOf("\\") + 1);
                        File.Copy(bia, $"{dirWorking}\\bollini\\{nome_foto}", true);
                    }
                }

                flussoCodiceCallBack = 6;

                ZipFile.CreateFromDirectory(zipFolder, zipPath);

                Thread.Sleep(1000);

                Directory.Delete(zipFolder, true);
                string root = pathTemp.Replace("\\", "/");
                try
                {
                    root = root.Substring(pathTemp.LastIndexOf("wwwroot")+8);
                }
                catch (Exception ex)
                {
                    result.error = ex.ToString();
                    flussoCodiceCallBack = 7;

                }
                result.esito = true;
                result.zipName = root;
                return result;
            }
            catch (Exception ex)
            {
                result.esito = false;
                result.error = ex.ToString() + "flussoCodiceCallBack: "+flussoCodiceCallBack+ " nomeFotoSchianto: " + nomeFotoSchianto;
                return result;
            }

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


        public static string DecimalRoundToString(decimal val)
        {
            string result = val.ToString();

            if (result.LastIndexOf(".") > 0)
            {
                if (result.Substring(result.LastIndexOf(".") + 1).Length <= 1)
                    result += "0";
            }
            else if (result.LastIndexOf(",") > 0)
            {
                if (result.Substring(result.LastIndexOf(",") + 1).Length <= 1)
                    result += "0";
            }
            else
            {
                result += ",00";
            }

            return result;
        }

        public static string DecimalRoundMidpoint(decimal val)
        {
            /*if (val.Equals(32.5555556))
            {
                "ok".ToString();
                
            }*/

            string res = "";
            string num_str = val.ToString();
            try
            {
                if (num_str.IndexOf(",") < 0)
                    return num_str + ",00";

                string _int = num_str.Substring(0, num_str.IndexOf(","));
                string decimals = num_str.Substring(num_str.IndexOf(",") + 1);

                if (decimals.Length > 2)
                {
                    if (Byte.Parse(decimals[2].ToString()) > 5)
                    {
                        int incr2 = (Int32.Parse(decimals[1].ToString()) + 1);
                        if (incr2 > 9)
                        {
                            incr2 = 0;
                            int incr1 = Int32.Parse(decimals[0].ToString()) + 1;
                            if (incr1 > 9)
                            {
                                incr1 = 0;
                                _int = (Int32.Parse(_int) + 1).ToString();
                            }

                            res = _int + "," + incr1.ToString() + incr2.ToString();
                        }
                        else
                        {
                            res = _int + "," + decimals[0].ToString() + incr2.ToString();
                        }
                    }
                    else if (Byte.Parse(decimals[2].ToString()) == 5)
                    {
                        /*
                        if (decimals.Length > 3)
                        {
                            if (Byte.Parse(decimals[3].ToString()) > 5)
                            {
                                res = _int + "," + decimals[0].ToString() + (Byte.Parse(decimals[1].ToString()) + 1).ToString();
                            }
                            else
                            {
                                res = _int + "," + decimals[0].ToString() + decimals[1].ToString();
                            }
                        }
                        else
                        {
                            res = _int + "," + decimals[0].ToString() + decimals[1].ToString();
                        }*/
                        res = Decimal.Round(val, 2).ToString();
                    }
                    else
                    {
                        res = _int + "," + decimals[0].ToString() + decimals[1].ToString();
                    }
                }
                else if (decimals.Length == 1)
                {
                    res = num_str + "0";
                }
                else
                {
                    if (num_str.Length == 1)
                        res = num_str + ",00";
                    else
                        res = num_str;
                }
            }
            catch
            {
                if (num_str.Length == 1)
                    res = num_str + ",00";
                else
                    res = num_str;
            }

            return res;
        }

        public static string DecimalOrIntToString(decimal val)
        {
            string result = val.ToString();

            if (val == (int)val)
            {
                result = ((int)val).ToString();
            }

            return result;
        }

        public static string generateComplexName(Byte length)
        {
            string result = "";

            string[] combinazioni = new string[] { "q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "a", "s", "d", "f", "g", "h", "j", "k", "l", "z", "x", "c", "v", "b", "n", "m", "1", "2", "3", "4", "5", "6", "7", "8", "9" };
            int num_combinazioni = combinazioni.Length;
            Random rnd = new Random();

            for (int i = 0; i < length; i++)
            {
                result += combinazioni[rnd.Next(num_combinazioni)].ToString().ToUpper();
            }

            return result;
        }

    }

    public class Dna
    {
        public string codice;
        public string gruppo;
    }

    public class ExportingBox
    {
        public Dna dna;
        public string label;
        public Dictionary<string, string> data = new Dictionary<string, string>();
    }
    public class NetworkConnection : IDisposable
    {
        readonly string _networkName;

        public NetworkConnection(string networkName, NetworkCredential credentials)
        {
            _networkName = networkName;

            var netResource = new NetResource
            {
                Scope = ResourceScope.GlobalNetwork,
                ResourceType = ResourceType.Disk,
                DisplayType = ResourceDisplaytype.Share,
                RemoteName = networkName
            };

            var userName = string.IsNullOrEmpty(credentials.Domain)
                ? credentials.UserName
                : string.Format(@"{0}\{1}", credentials.Domain, credentials.UserName);

            var result = WNetAddConnection2(
                netResource,
                credentials.Password,
                userName,
                0);

            if (result != 0)
            {
                throw new Win32Exception(result, "Error connecting to remote share");
            }
        }

        ~NetworkConnection()
        {
            Dispose(false);
        }

        public void Dispose()
        {
            Dispose(true);
            GC.SuppressFinalize(this);
        }

        protected virtual void Dispose(bool disposing)
        {
            WNetCancelConnection2(_networkName, 0, true);
        }

        [DllImport("mpr.dll")]
        private static extern int WNetAddConnection2(NetResource netResource,
            string password, string username, int flags);

        [DllImport("mpr.dll")]
        private static extern int WNetCancelConnection2(string name, int flags,
            bool force);

        [StructLayout(LayoutKind.Sequential)]
        public class NetResource
        {
            public ResourceScope Scope;
            public ResourceType ResourceType;
            public ResourceDisplaytype DisplayType;
            public int Usage;
            public string LocalName;
            public string RemoteName;
            public string Comment;
            public string Provider;
        }

        public enum ResourceScope : int
        {
            Connected = 1,
            GlobalNetwork,
            Remembered,
            Recent,
            Context
        };

        public enum ResourceType : int
        {
            Any = 0,
            Disk = 1,
            Print = 2,
            Reserved = 8,
        }

        public enum ResourceDisplaytype : int
        {
            Generic = 0x0,
            Domain = 0x01,
            Server = 0x02,
            Share = 0x03,
            File = 0x04,
            Group = 0x05,
            Network = 0x06,
            Root = 0x07,
            Shareadmin = 0x08,
            Directory = 0x09,
            Tree = 0x0a,
            Ndscontainer = 0x0b
        }
    }

    //public enum TipoFoto
    //{
    //    FotoDelProdotto = 1,
    //    Bollino = 2,
    //    Logo = 3,
    //    Extra = 4
    //}

    public class SyncResult
    {        
        public List<SyncFile> files=new List<SyncFile>();
        public string error;
    }
    public class SyncFile
    {
        public Int64 id { get; set; }
        public string guidid { get; set; }
        public Int64 idPath;
        public Int64 idArticolo { get; set; }
        public string codArticoloNew { get; set; }

        public string filename;
        public string queryFilename;
        public string md5 { get; set; }

        //public bool isGrezzo { get; set; }
        public bool daPostProdurre { get; set; } = false;

        public string zipDirOrigin { get; set; }

        public TipoFoto tipo { get; set; } = TipoFoto.Foto;

        [JsonConverter(typeof(StatoSyncFileConverter))]
        public StatoSyncFile stato { get; set; }
        public string idRecView { get; set; }

        public string error;
        public string details;

        public string FileName { get { return filename; } set { filename = value; } }
    }
    public class ShortSyncFile
    {
        //Struttura piu leggera per memorizzare le info nel registro
        public StatoSyncFile stato { get; set; }
        public string filename { get; set; }="";
        public string zipOriginDir { get; set; } = "";
        public bool daPostProdurre { get; set; } = false;
    }

    public class StatoSyncFileConverter : JsonConverter<StatoSyncFile>
    {
        public override StatoSyncFile ReadJson(JsonReader reader, Type objectType, StatoSyncFile existingValue, bool hasExistingValue, JsonSerializer serializer)
        {
            int intValue = Convert.ToInt32(reader.Value);
            StatoSyncFile st = (StatoSyncFile)Enum.Parse(typeof(StatoSyncFile), intValue.ToString());
            return st;
        }

        public override void WriteJson(JsonWriter writer, StatoSyncFile value, JsonSerializer serializer)
        {
            writer.WriteValue((int)value);
        }
    }

    public enum StatoSyncFile
    {
        //0 - none, 1 - converted, 2 - conversion error, 3 - scanned, 4 - scannedError, 5 - syncable, 6 - syncableAsNew (Causa la creazione di un articolo nuovo)
        None=0,
        Synced=1,
        SyncedError=2,
        Scanned=3,//Solo temporaneo dopodichè il CORE decide
        ScannedError=4,
        Syncable=5,
        SyncableAsNew=6,
        SyncableAsOverwrite = 7,
        AlreadyExist =8,
        NoMatch=9,
        NotInTracciato=10,
        AlreadyExistButNotSelected=11
        
    }
}
