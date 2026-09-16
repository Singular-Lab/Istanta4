using IstantaLib;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using AgenziaLib.Tipi;
using Newtonsoft.Json;

namespace AgenziaLib
{

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
                int _len = result.Substring(result.LastIndexOf(".") + 1).Length;
                int sepInx = result.LastIndexOf(".");
                if (_len <= 1)
                    result += "0";
                else if (_len > 2)
                    result = result.Substring(0, sepInx) + "." + result.Substring(sepInx + 1, 2);

            }
            else if (result.LastIndexOf(",") > 0)
            {
                int _len = result.Substring(result.LastIndexOf(",") + 1).Length;
                int sepInx = result.LastIndexOf(",");

                if (_len <= 1)
                    result += "0";
                else if (_len > 2)
                    result = result.Substring(0, sepInx) + "," + result.Substring(sepInx + 1, 2);
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
            if (num_str.IndexOf(".")>0)
                num_str= num_str.Replace(".", ",");

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
                        res = res.ToString().Replace(".",",");
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


        public static string DoubleRoundMidpoint(Double val)
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
                string doubles = num_str.Substring(num_str.IndexOf(",") + 1);

                if (doubles.Length > 2)
                {
                    if (Byte.Parse(doubles[2].ToString()) > 5)
                    {
                        int incr2 = (Int32.Parse(doubles[1].ToString()) + 1);
                        if (incr2 > 9)
                        {
                            incr2 = 0;
                            int incr1 = Int32.Parse(doubles[0].ToString()) + 1;
                            if (incr1 > 9)
                            {
                                incr1 = 0;
                                _int = (Int32.Parse(_int) + 1).ToString();
                            }

                            res = _int + "," + incr1.ToString() + incr2.ToString();
                        }
                        else
                        {
                            res = _int + "," + doubles[0].ToString() + incr2.ToString();
                        }
                    }
                    else if (Byte.Parse(doubles[2].ToString()) == 5)
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
                        res = Math.Round(val, 2).ToString();
                    }
                    else
                    {
                        res = _int + "," + doubles[0].ToString() + doubles[1].ToString();
                    }
                }
                else if (doubles.Length == 1)
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

    public static class StringExtension
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

        public static bool ContainsParole(this string str, string[] parole)
        {
            if (parole.Count() == 0)
                return false;

            foreach (string s in parole)
            {
                if (!str.Contains(s))
                    return false;
            }
            return true;
        }

        public static string UppercaseFirst(this string s)
        {
            // Check for empty string.
            if (string.IsNullOrEmpty(s))
            {
                return string.Empty;
            }
            // Return char and concat substring.
            return char.ToUpper(s[0]) + s.Substring(1);
        }

        public static bool stringIsPartOfABiggerString(this string stringa, string catch_key)
        {
            int inx = stringa.ToLower().IndexOf(catch_key);
            if (inx <= 0)
                return false;
            else if (char.IsLetterOrDigit(stringa[inx - 1]))
            {
                return true;
            }


            return false;
        }

        public static bool laParolaSiTrovaDaSola(string test, string descrizione)
        {
            if (descrizione.IndexOf(test +" ") == 0 || //Inizi così
            descrizione.IndexOf(" "+test+" ") >= 0 || //è in mezzo ad una frase
            (descrizione.IndexOf(" "+test) >= 0 && (descrizione.IndexOf(" " + test) + (" "+test).Length) == descrizione.Length) || //E' alla fine
            descrizione.IndexOf("\n"+test+" ") >= 0 || //E' dopo un'interlinea e a seguire continua la frase
            (descrizione.IndexOf("\n"+test) >= 0 && (descrizione.IndexOf("\n"+test) + ("\n"+test).Length) == descrizione.Length) || //E' dopo un'interlinea e poi finisce
            descrizione.IndexOf(" "+test+"\n") >= 0 || //segue una frase e poi va a capo
            descrizione.IndexOf("\n"+test+"\n") >= 0 // è in mezzo a due linee
            )
            {
                return true;
            }

            return false;
        }
    }

    public static class ObjectExtension
    {
        public static decimal ToDecimal(this object obj)
        {
            decimal d = 0;
            if (obj is double)
            {
                d = (decimal)((double)obj);// Convert.ToDecimal((double)obj);
            }
            else if (obj is decimal)
            {
                d = (decimal)obj;
            }
            else if (obj is float)
            {
                d= (decimal)((float)obj);
            }
            else if (obj is string)
            {
                if (obj.ToString() != "")
                {
                    Decimal.TryParse(obj.ToString(), out d);// Convert.ToDecimal((double)obj);
                }
            }

            return d;
        }

        public static Dictionary<string, object> Clone(this Dictionary<string, object> obj)
        {
            Dictionary<string, object> result = new Dictionary<string, object>();

            foreach (string prop in obj.Keys)
            {
                result.Add(prop, obj[prop]);
            }

            return result;
        }
    }

    public static class NamingConventionUtility
    {
        public static string Decode(TipoDiExport tItem, List<FicoContextField> promoContext, List<FicoContextField> tracciatoContext, FicoRuntimeKit kit, DbACPV acpvDB, FicoNamingConvention ncDB, DbFormati formatiDB, Dictionary<string, object> rec, IAgenzia istanzaAg = null, List<FicoCombinazioniKitDeclinazioneProprieta> propsDeclinazione=null)
        {
            if (tItem.codice == "WEB")
                return "";

            FicoNamingConventionCombinazione ncComb = ncDB.combinazioni.FirstOrDefault(nc => nc.guidId == tItem.guidIdNamingConvention);

            if (ncComb != null)
            {
                StringBuilder sb = new StringBuilder();
                foreach (string compId in ncComb.combinazione)
                {
                    FicoNamingConventionComponent ncF = ncDB.components.FirstOrDefault(c => c.Id == compId);

                    try
                    {


                        if (ncF == null)
                        {
                            sb.Append(compId);//Significa che è un campo statico testuale
                        }
                        else
                        {
                            string chiave = ncF.Nome;

                            //Vediamo se ho un namespace specifico dove cercare
                            if (chiave.Split('.')[0] == "Promo")
                            {
                                //Cerco nel contesto di promo
                            }
                            else if (chiave.Split('.')[0] == "Tracciato")
                            {
                                //Cerco nel contesto di tracciato
                                string nomeChiave = chiave.Split('.')[1];
                                string valChiave = tracciatoContext.FirstOrDefault(pc => pc.nome_field == nomeChiave).user_value;
                                if (GLOBAL_VARIABLES_FICO.keyAreaContext.Contains(nomeChiave) && acpvDB != null)
                                    sb.Append(acpvDB.aree.FirstOrDefault(a => a.guidID == valChiave).sigla);
                                else if (GLOBAL_VARIABLES_FICO.keyCanaleContext.Contains(nomeChiave) && acpvDB != null)
                                    sb.Append(acpvDB.canali.FirstOrDefault(a => a.guidID == valChiave).sigla);
                                else
                                    sb.Append(valChiave);

                            }
                            else if (chiave.Split('.')[0] == "Kit")
                            {
                                //Cerco nel contesto di Kit
                                string nomeChiave = chiave.Split('.')[1];
                                if (nomeChiave == "Formato")
                                {
                                    if (formatiDB != null)
                                        sb.Append(formatiDB.source.FirstOrDefault(f => f.guidID == kit.guidFormato).codice);
                                }
                                else if (nomeChiave == "titolo")
                                {
                                    sb.Append(kit.titolo.Replace(" ", "_").Replace("/", "_").Replace("\\", "_").Replace(":", "_").Replace("*", "_").Replace("?", "_").Replace("\"", "_").Replace("<", "_").Replace(">", "_").Replace("|", "_").Replace(",", "_"));
                                }
                                else if (nomeChiave == "Declinazioni")
                                {
                                    //Accesso diretto alla declinazione
                                    string chiaveProp = chiave.Split('.')[2];

                                    var propItem = propsDeclinazione.FirstOrDefault(p => p.chiaveCompilata == chiaveProp);
                                    if (propItem != null)
                                    {
                                        sb.Append(propItem.valore);
                                    }

                                }
                            }
                            else if (chiave.Split('.')[0] == "AgenziaLib")
                            {
                                //Richiamo la callback per ottenere il valore
                                string nomeChiave = chiave.Split('.')[1];
                                Console.WriteLine("Calling AgenziaLib callback for NC field: " + nomeChiave);
                                string valChiave = istanzaAg.callbackNamingConventionDynamicField(nomeChiave, rec, propsDeclinazione);
                                if (valChiave != "")
                                {
                                    sb.Append(valChiave);
                                }

                            }
                            else
                            {
                                //if (chiave == "Referenza.CodiceGruppo")
                                //    chiave = chiave.Replace("Referenza", "Scatto");//hack!
                                if (chiave.StartsWith("Referenza."))
                                {
                                    chiave = chiave.Replace("Referenza.", "");//hack!
                                    if (chiave=="Codice")
                                    {
                                        chiave = GLOBAL_VARIABLES_FICO.keyRefCodice;
                                    }
                                }

                                if (rec != null && rec.ContainsKey(chiave))
                                {

                                    string val = rec[chiave].ToString();
                                    if (rec[chiave] is DateTime)
                                    {
                                        DateTime dt = (DateTime)rec[chiave];
                                        val = dt.ToString("yyyy-MM-dd");
                                    }

                                    //Ripulire il valore di caratterei che possono non essere buoni per un nome file
                                    val = val.Replace(" ", "_").Replace("/", "_").Replace("\\", "_").Replace(":", "_").Replace("*", "_").Replace("?", "_").Replace("\"", "_").Replace("<", "_").Replace(">", "_").Replace("|", "_").Replace(",", "_");

                                    sb.Append(val);
                                }
                                else
                                {
                                    //Valore non trovato nell'ìtem ref, per cui si fa così
                                    sb.Append("{" + chiave + "}");
                                }
                            }
                        }
                    }catch(Exception ex)
                    {
                        Console.WriteLine("Decode NC ("+ compId +" :: "+ ncF.Nome + ") error: " + ex.ToString()); 
                    }
                }

                return sb.ToString() + ".pdf";
            }
            else
            {
                if (rec != null)
                    return rec[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString() + ".pdf";
                else
                    return "none";
            }
        }
    }

    public static class RefsHelper
    {
        public static List<FotoElementoGruppo> getFotoSecondarieDelGruppo(List<Dictionary<string,object>> gruppo)
        {
            

            List<FotoElementoGruppo> _list = new List<FotoElementoGruppo>();
            foreach (var dict in gruppo)
            {
                if (dict.ContainsKey(Edro21Context.Meta.keyStatoSelezione))
                {
                    byte statoSel = Convert.ToByte(dict[Edro21Context.Meta.keyStatoSelezione]);
                    //La primaria viaggia nella stessa lista delle secondarie perche' anch'essa
                    //porta l'opzione di rendering del box. I consumatori che impaginano solo le
                    //secondarie continuano a filtrare su statoSelezione == 2.
                    if (statoSel == (Byte)1 || statoSel == (Byte)2)
                    {
                        _list.Add(new FotoElementoGruppo()
                        {
                            codRef = dict[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString(),
                            nomeFoto = dict[GLOBAL_VARIABLES_FICO.keyFotoNome].ToString(),
                            statoSelezione = statoSel,
                            hash = dict[GLOBAL_VARIABLES_FICO.keyFotoHash].ToString(),
                            //noRender non e' un dato del record: viene valorizzato da Istanta
                            //dai meta della lavorazione dopo l'export di agenzia.
                        });
                    }
                }
            }

            return _list;
        }
    }

}
