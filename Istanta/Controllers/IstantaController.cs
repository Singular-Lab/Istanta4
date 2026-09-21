using Istanta.Models;
using Microsoft.AspNetCore.Mvc;
using System.Configuration;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Diagnostics;
using DocumentFormat.OpenXml.Spreadsheet;
using System.Runtime.CompilerServices;
using System.Xml;
using Istanta.Models_2;
using System.Reflection;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion.Internal;
using DocumentFormat.OpenXml.Drawing.Diagrams;

namespace Istanta.Controllers
{

    public static class IstantaJson
    {
        public static Dictionary<string, object> getJsonObject(string json_string)
        {
            Dictionary<string, object> obj = new Dictionary<string, object>();
            try

            {
                obj = JsonConvert.DeserializeObject<Dictionary<string, object>>(json_string)!;
                //string gs = obj["gruppo_siti"].ToString();
            }
            catch (Exception ex)
            {
                ex.ToString();
            }

            return obj;
        }

        public static object getValueOfJsonObject(string json_string, string key)
        {
            Dictionary<string, object> obj = IstantaJson.getJsonObject(json_string);
            if (obj.ContainsKey(key))
            {
                return obj[key];
            }
            else
            {
                return "not found for " + obj["Referenza.Codice"].ToString();
            }
        }
        public static bool FindIn(string json_string, Dictionary<string, string> queryParams)
        {

            Dictionary<string, object> rec = IstantaJson.getJsonObject(json_string);
            if (queryParams != null)
            {
                foreach (string key in queryParams.Keys)
                {
                    if (!rec.ContainsKey(key))
                    {
                        if (key.IndexOf("Referenza") >= 0)
                        {
                            string[] _kv = key.Split('.');
                            string scope = _kv[0];

                            if (!rec.ContainsKey(scope))
                            {
                                return false;
                            }
                            else
                            {
                                string scope_key = _kv[1];

                                Dictionary<string, object>? _ref = (rec[scope] as JObject)!.ToObject<Dictionary<string, object>>();
                                if (_ref![scope_key].ToString()!.IndexOf(queryParams[key]) < 0)
                                {
                                    return false;
                                }
                            }
                        }

                        return false;
                    }
                    else
                    {
                        if (rec[key].ToString()!.IndexOf(queryParams[key]) < 0)
                        {
                            return false;
                        }
                    }
                }
            }

            return true;
        }

    }


    public  class IstantaController : Controller
    {
        private readonly edro21_dbContext ctx;
        private readonly string pathExternalLib;
        private readonly string pathExternalSource;
        private readonly IDbContextFactory<edro21_dbContext> _dbContextFactory;
        public IstantaController(string connString, string path_external_lib="", string path_external_source="", IDbContextFactory<edro21_dbContext> dbContextFactory=null)
        {
            this._dbContextFactory = dbContextFactory;
            if (this._dbContextFactory!=null)
                this.ctx = this._dbContextFactory.CreateDbContext();
            //this.ctx = new edro21_dbContext(connString);
            this.pathExternalLib = path_external_lib;
            this.pathExternalSource = path_external_source;
        }


        public AttivitaLog addLog(Int64 id_attivita, TipoDiLog tipo, string msg)
        {
            AttivitaLog item = new AttivitaLog();
            item.IdAttivita = id_attivita;
            item.DataRegistrazione = DateTime.Now;
            item.Tipo = (Byte)tipo;
            item.Note = msg;
            return item;
        }

        public object parseAddesttramentoValue(object _val, SchemaCampiExcel schema_campo)
        {
            if (schema_campo.TipoDato == (Byte)AddestramentoTipoValore.Numerico)
            {
                if (_val == null)
                {
                    return 0;
                }

                if (_val is Int64)
                {
                    return Convert.ToInt64(_val);
                }
                else if (_val is Int32)
                {
                    return Convert.ToInt32(_val);
                }
                else if (_val is Int16)
                {
                    return Convert.ToInt16(_val);
                }
                else if (_val is Byte)
                {
                    return Convert.ToByte(_val);
                }
                else
                {

                    //Arrotondiamo eventuali numeri decimali
                    string? valToParse = _val.ToString();

                    string sep = System.Globalization.CultureInfo.CurrentCulture.NumberFormat.NumberDecimalSeparator;
                    int sepIndex = valToParse!.IndexOf(sep);

                    if (sepIndex > 0)
                    {
                        valToParse = valToParse.Substring(0, sepIndex);

                    }

                    Int32 _intVal = 0;
                    Int32.TryParse(valToParse, out _intVal);

                    return _intVal;
                }
            }
            else if (schema_campo.TipoDato == (Byte)AddestramentoTipoValore.Decimale)
            {
                if (_val is string)
                {
                    decimal _decVal = 0;
                    if (_val == null)
                    {
                        return _decVal;
                    }

                    Decimal.TryParse(_val.ToString(), out _decVal);
                    return _decVal;
                }
                else
                    return Convert.ToDecimal(_val);

            }
            else if (schema_campo.TipoDato == (Byte)AddestramentoTipoValore.Bool)
            {
                if (_val is string)
                {
                    bool _boolVal = false;
                    if (_val == null)
                    {
                        return _boolVal;
                    }

                    string strVal = _val.ToString()!.ToLower();
                    if (strVal != "true" && strVal != "false")
                    {
                        if (strVal == "0" || strVal == "1")
                        {
                            return _val.ToString() != "0";
                        }
                        else
                        {
                            //Se il valore non è realmente rappresentabile come boolean allora torno false se il campo è vuoto altrimenti true
                            return _val.ToString() != "";
                        }
                    }
                    Boolean.TryParse(_val.ToString(), out _boolVal);
                    return _boolVal;
                }
                else
                    return Convert.ToBoolean(_val);
                
            }
            else if (schema_campo.TipoDato == (Byte)AddestramentoTipoValore.Data)
            {

                DateTime _dtVal = new DateTime(1900, 1, 1);

                if (_val == null)
                {
                    return _dtVal;
                }

                DateTime.TryParse(_val.ToString(), out _dtVal);
                return _dtVal;
            }
            else
            {
                if (_val == null)
                {
                    return "";
                }

                return _val;
            }
        }

        public ParameterInfo[] getParameterInfo(string algoritmo)
        {
            string[] _p = algoritmo.Split('(');
            string _func = _p[0];
            string _params = _p[1].Replace(")", "");

            string[] _dllParams = _func.Split('.');
            string _dllNamespace = _dllParams[0];
            string _dllTipo = _dllParams[1];
            string _dllMth = _dllParams[2];

            string dllFile = this.pathExternalLib + _dllNamespace + ".dll";

            var ty = caricaTipoAgenzia(dllFile, _dllNamespace + "." + _dllTipo);
            var mth = ty.GetMethod(_dllMth);
            if (mth == null)
                throw new Exception($"Metodo '{_dllMth}' non trovato in {ty.FullName} ({dllFile}).");

            return mth.GetParameters();
        }

        // La dll del cliente, tenuta in cache finche' il file non cambia.
        //
        // Prima ogni chiamata faceva Assembly.Load(File.ReadAllBytes(...)), e non e' un
        // modo di dire: due caricamenti dello stesso file producono due assembly distinti,
        // con tipi e statici separati. Due conseguenze, entrambe indesiderate. Gli assembly
        // si accumulavano nel processo senza essere mai scaricati, uno per chiamata. E una
        // cache statica dentro AgenziaLib non sarebbe servita a nulla, perche' ogni
        // chiamata ripartiva da statici vuoti: e' il motivo per cui questa cache viene
        // prima di quella dei source del cliente.
        //
        // L'invalidazione guarda data di modifica e dimensione del file, quindi ricopiare
        // AgenziaLib.dll a mano continua a fare effetto senza riavviare l'applicazione.
        private static readonly IstantaLib.CacheFilePerPercorso<Assembly> cacheAssemblyAgenzia = new();

        // Carica la dll del cliente e ne ritrova la classe, dicendo cosa manca quando
        // non c'e'. Prima i due chiamanti facevano "ty!.GetMethod(...)": se il tipo non
        // c'era, il ! zittiva il compilatore e usciva un NullReferenceException nudo,
        // che non dice ne' quale classe si cercava ne' da quale file. La causa vera e'
        // quasi sempre una sola: la dll in external_lib e' un build precedente
        // all'aggiunta di quel cliente, perche' dotnet publish NON la aggiorna e va
        // ricopiata a mano. Vedi 02-modello-multicliente.md, punto 6.
        private Type caricaTipoAgenzia(string dllFile, string nomeCompleto)
        {
            var dll = cacheAssemblyAgenzia.Ottieni(dllFile, percorso => Assembly.Load(System.IO.File.ReadAllBytes(percorso)));
            var ty = dll.GetType(nomeCompleto);

            if (ty == null)
                throw new Exception(
                    $"Classe '{nomeCompleto}' non trovata in {dllFile}. " +
                    "Di solito la dll e' un build precedente all'aggiunta del cliente: " +
                    "ricompila AgenziaLib e ricopia AgenziaLib.dll in " + this.pathExternalLib + ".");

            return ty;
        }


        public object execLibFunction(string algoritmo, Dictionary<string,object> dataset)
        {
            string[] _p = algoritmo.Split('(');
            string _func = _p[0];

            string[] _dllParams = _func.Split('.');
            string _dllNamespace = _dllParams[0];
            string _dllTipo = _dllParams[1];
            string _dllMth = _dllParams[2];

            string dllFile = this.pathExternalLib+ _dllNamespace + ".dll";

            var ty = caricaTipoAgenzia(dllFile, _dllNamespace + "." + _dllTipo);
            var mth = ty.GetMethod(_dllMth);
            var obj = Activator.CreateInstance(ty);

            if (mth == null)
            {
                // Comportamento storico, lasciato com'e': metodo assente vuol dire che
                // per questo cliente quella logica non esiste, e si tira dritto. Prima
                // pero' non lo diceva nessuno e il chiamante riceveva "" senza sapere
                // perche'; adesso almeno finisce nel log.
                Console.WriteLine($"AVVISO AgenziaLib: metodo '{_dllMth}' non trovato in {ty.FullName} ({dllFile}). La chiamata restituisce stringa vuota.");
                return "";
            }

            ParameterInfo[] myParams = mth!.GetParameters();            
            object[] _objP = new object[myParams.Count()];
            

            for (int po = 0; po < myParams.Count(); po++)
            {
                ParameterInfo pi = myParams[po];
                ////Console.WriteLine($"Parametro {pi.Name} di tipo {pi.ParameterType.Name}");

                if (pi!.Name!.IndexOf("path") < 0)
                {
                    _objP[po] = dataset[pi.Name];
                }
                else
                {
                    string sourceFile = pi.Name.Replace("path", "Source") + ".json";
                    _objP[po] = this.pathExternalSource + sourceFile;
                }


            }

            object? objResult = mth!.Invoke(obj, _objP);
            return objResult!;
        }
    }

}
