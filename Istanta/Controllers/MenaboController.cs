using CsvHelper;
using CsvHelper.Configuration;
using CsvHelper.TypeConversion;
using DocumentFormat.OpenXml.Bibliography;
using DocumentFormat.OpenXml.Drawing;
using DocumentFormat.OpenXml.Drawing.Charts;
using DocumentFormat.OpenXml.Drawing.Diagrams;
using DocumentFormat.OpenXml.Office.CustomUI;
using DocumentFormat.OpenXml.Office2010.CustomUI;
using DocumentFormat.OpenXml.Office2010.Excel;
using DocumentFormat.OpenXml.Office2010.ExcelAc;
using DocumentFormat.OpenXml.Office2016.Drawing.ChartDrawing;
using DocumentFormat.OpenXml.Spreadsheet;
using DocumentFormat.OpenXml.Vml;
using DocumentFormat.OpenXml.Wordprocessing;
using Istanta.Models;
using Istanta.Models_2;
using Istanta.Utility;
using IstantaLib;
using LinqKit;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.TagHelpers;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion.Internal;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Microsoft.SqlServer.Server;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Collections;
using System.Collections.Generic;
using System.ComponentModel;
using System.Configuration;
using System.Diagnostics;
using System.Globalization;
using System.IO.Pipelines;
using System.IO.Pipes;
using System.Linq;
using System.Reflection;
using System.Security.Cryptography;
using System.Security.Policy;
using System.Text;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using System.Xml.Linq;
using static Istanta.Controllers.SyncFotoController;
using static IstantaLib.PhotoManager;

namespace Istanta.Controllers
{
    public class MenaboController : Controller
    {
        private readonly ILogger<MenaboController>? _logger;
        private readonly edro21_dbContext ctx;
        private Edro21_DbContext2 ctx2;
        private FicoProcessController? ficoController;
        private readonly IConfiguration _config;
        private readonly string path_external_source = "";
        private readonly string path_external_lib = "";
        private readonly string path_export = "";
        private readonly IMemoryCache? _cache;
        private readonly IOptions<PathExternal> _external_lib;        
        private readonly IOptions<PathOperationImport>? _option_import;
        private readonly IOptions<FicoConfig> _fico_conf;
        private readonly LogAssistent logAssistent;
        private readonly string extarnalSourcePath;
        private ExternalSourceClass exClass;

        //private readonly IOptions<SyncOptions> _syncOptions;

        IHttpClientFactory httpClient;
        private readonly IDbContextFactory<edro21_dbContext> _dbContextFactory;
        private readonly IDbContextFactory<Edro21_DbContext2> _dbContextFactory2;
        public MenaboController(ILogger<MenaboController>? logger, IConfiguration configuration, IOptions<PathExternal> external_lib, IOptions<PathOperationExport>? option_export, IHttpClientFactory? httpClientFactory, IMemoryCache? memoryCache, IOptions<PathOperationImport>? option_import, IOptions<FicoConfig> ficoConf, IDbContextFactory<edro21_dbContext> dbContextFactory, IDbContextFactory<Edro21_DbContext2> dbContextFactory2)
        {
            this._dbContextFactory2 = dbContextFactory2;
            this._dbContextFactory = dbContextFactory;
            this.ctx = this._dbContextFactory.CreateDbContext();
            //this.ctx = new edro21_dbContext(configuration.GetConnectionString("IstandaConnectionDb")!);
            this.ctx2 = this._dbContextFactory2.CreateDbContext();
            _logger = logger;
            _config = configuration;
            path_external_source = external_lib.Value.pathSource;
            path_external_lib = external_lib.Value.pathLib;
            if (option_export != null)
                path_export = option_export.Value.path;
            if (memoryCache != null)
                this._cache = memoryCache;

            this._fico_conf = ficoConf;
            this._external_lib = external_lib;
            this._option_import = option_import;

            this.httpClient = httpClientFactory!;
            this.logAssistent = new LogAssistent();

            this.extarnalSourcePath = external_lib.Value.pathSource;
            exClass = new ExternalSourceClass(this.extarnalSourcePath);
            //this._syncOptions = syncOptions;

        }

        public async Task<IActionResult> Index(int id_tracciato)
        {
            this.Bind();


            ViewBag.IdTracciato = id_tracciato;

            List<MenaboPagine> pags = await this.ctx2.MenaboPagines.Include(i => i.MenaboRefs).Where(m => m.IdTracciato == id_tracciato).ToListAsync();
            PromoTracciati? tracciato = await this.ctx2.PromoTracciatis.Where(m => m.Id == id_tracciato).FirstOrDefaultAsync();
            Dictionary<string, object>? Meta = JsonConvert.DeserializeObject<Dictionary<string, object>>(tracciato!.Meta!);
            ViewBag.Titolo = tracciato.Sigla;// Meta["NomeEsportazione"].ToString();

            /*if(pags.Count==0)
            {
                //Associamo subito un menabo al tracciato in base all'area
                JObject o1 = JObject.Parse(System.IO.File.ReadAllText(this.path_external_source + "SourceMenabo.json"));
                DbMenabo menaboDB = o1.ToObject<DbMenabo>();


                Int64 id_schema = 1;//Di default                
                DbMenaboItem mbItem = menaboDB.source.Where(s => s.Aree.Contains(area)).FirstOrDefault();
                if (mbItem!=null)
                {
                    id_schema = mbItem.IdMenaboPagine;
                }


                JObject o2 = JObject.Parse(System.IO.File.ReadAllText(this.path_external_source + "SourceMenaboPagine.json"));
                DbMenaboPagine menaboPagsDB = o2.ToObject<DbMenaboPagine>();
                DbMenaboPagineItem schemaItem = menaboPagsDB.source.Where(mb => mb.Id == id_schema).FirstOrDefault();
                
                foreach (DbMenaboPagineItemPagina item in schemaItem.Pagine)
                {
                    MenaboPagine mbDbItem = new MenaboPagine();
                    mbDbItem.IdTracciato = id_tracciato;
                    mbDbItem.Formato = item.Formato;
                    mbDbItem.IdMastro = item.IdMastro;
                    mbDbItem.Numero = item.Numero;
                    this.ctx2.MenaboPagines.Add(mbDbItem);
                }

                this.ctx2.SaveChanges();

            }
            else
            {*/
            ViewBag.PagineSource = pags;
            //)}

            return View();
        }



        [HttpGet]
        [Route("Menabo/getFormato/{meccanica}")]
        public async Task<IActionResult> getFormato(string meccanica)
        {
            ExternalSourceClass exClass = new ExternalSourceClass(this.path_external_source, new string[] { "SourceMeccaniche" });
            return Ok(exClass.getFormatoMeccanica(meccanica));
        }

        public DbMastro getMastro()
        {
            JObject? oMastro = JObject.Parse(System.IO.File.ReadAllText(this.path_external_source + "SourceMastro.json"));
            DbMastro? mastroDB = oMastro!.ToObject<DbMastro>();
            return mastroDB!;
        }

        public DbMeccaniche getMeccaniche()
        {
            JObject? oMeccaniche = JObject.Parse(System.IO.File.ReadAllText(this.path_external_source + "SourceMeccaniche.json"));
            DbMeccaniche? meccanicheDB = oMeccaniche.ToObject<DbMeccaniche>();
            return meccanicheDB!;
        }


        [HttpGet]
        [Route("Menabo/salvaPagina/{id_tracciato}/{id}/{id_mastro}/{formato}")]
        public async Task<IActionResult> Index(int id_tracciato, Int64 id, Int16 id_mastro, string formato)
        {
            BoolResult result = new BoolResult();
            try
            {


                MenaboPagine? pag = await this.ctx2.MenaboPagines.Include(f => f.MenaboRefs).Where(m => m.IdTracciato == id_tracciato && m.Id == id).FirstOrDefaultAsync();
                if (pag != null)
                {
                    #region commenti
                    //Controllo della quantità di ref
                    /*string[] operators = formato.Split('x');
                    int nSpazi = Int32.Parse(operators[0]) * Int32.Parse(operators[1]);
                    if (this.ctx2.MenaboRefs.Where(mr => mr.IdPagina == pag.Id).GroupBy(g => g.Indice).Count() > nSpazi)
                    {
                        throw new Exception("Formato troppo piccolo rispetto al numero di referenze impaginate");
                    }

                    //Contorllo anche dell'ultimo indice per capire se serve ricollocarli in funzione del nuovo formato
                    Int16 last_indice = this.ctx2.MenaboRefs.Where(mr => mr.IdPagina == pag.Id).OrderByDescending(o => o.Indice).Select(s => s.Indice).FirstOrDefault();
                    if (last_indice > nSpazi)
                    {
                        //DA FARE
                    }
                    */
                    #endregion
                    foreach (var item in pag.MenaboRefs)
                    {
                        IActionResult? formatoRes = null;
                        formatoRes = await getFormato(item.Formato!);
                        string formatoRichiesto = "";
                        if (formatoRes is OkObjectResult && (formatoRes as OkObjectResult)!.Value is string)
                        {
                            formatoRichiesto = (formatoRes as OkObjectResult)!.Value!.ToString()!;
                        }
                        if ((CalcolaSpazi(formato, item.Indice, formatoRichiesto!)).Count == 0)
                        {
                            throw new Exception("Impossibile cambiare il formato");
                        }
                    }
                    pag.Formato = formato;
                    pag.IdMastro = id_mastro;
                }
                else
                {
                    Int16 numero = 1;
                    if (id == 0)
                    {
                        //Incremento di uno l'ultima pagina trovata
                        MenaboPagine? pag_last = this.ctx2.MenaboPagines.Where(m => m.IdTracciato == id_tracciato).OrderByDescending(o => o.Numero).FirstOrDefault();
                        numero = 1;
                        if (pag_last != null)
                        {
                            numero = (Int16)(pag_last.Numero + 1);
                        }

                        pag = new MenaboPagine();
                        pag.IdTracciato = id_tracciato;
                        pag.Formato = formato;
                        pag.Numero = numero;
                        pag.IdMastro = id_mastro;
                        this.ctx2.MenaboPagines.Add(pag);

                        this.ctx2.SaveChanges();

                        return Ok(pag);
                    }
                    else if (id == -1)
                    {
                        //Provo a prendere lo schema
                        if (this.ctx2.MenaboPagines.Where(m => m.IdTracciato == id_tracciato).Count() <= 0)
                        {
                            PromoTracciati? tracciato = this.ctx2.PromoTracciatis.Find(id_tracciato);
                            string area = tracciato!.Canale + tracciato.Area;// IstantaJson.getJsonObject(tracciato.Meta)[Enum.GetName(AddestramentoRuoli.Area)].ToString();

                            //Associamo subito un menabo al tracciato in base all'area
                            JObject o1 = JObject.Parse(System.IO.File.ReadAllText(this.path_external_source + "SourceMenabo.json"));
                            DbMenabo? menaboDB = o1.ToObject<DbMenabo>();


                            Int64 id_schema = 0;//Di default                
                            DbMenaboItem? mbItem = menaboDB!.source.Where(s => s.Aree.Contains(area)).FirstOrDefault();
                            if (mbItem != null)
                            {
                                id_schema = mbItem.IdMenaboPagine;
                            }

                            if (id_schema == 0)
                            {
                                throw new Exception("Nessuno schema trovato");
                            }

                            JObject o2 = JObject.Parse(System.IO.File.ReadAllText(this.path_external_source + "SourceMenaboPagine.json"));
                            DbMenaboPagine? menaboPagsDB = o2.ToObject<DbMenaboPagine>();
                            DbMenaboPagineItem? schemaItem = menaboPagsDB!.source.Where(mb => mb.Id == id_schema).FirstOrDefault();

                            JObject o3 = JObject.Parse(System.IO.File.ReadAllText(this.path_external_source + "SourceMastro.json"));
                            DbMastro? menaboMastroDB = o3.ToObject<DbMastro>();
                            foreach (DbMenaboPagineItemPagina item in schemaItem!.Pagine)
                            {
                                MenaboPagine mbDbItem = new MenaboPagine();
                                mbDbItem.IdTracciato = id_tracciato;
                                mbDbItem.Formato = menaboMastroDB!.source.Find(f => f.Id == item.IdMastro)!.Formato;
                                mbDbItem.IdMastro = item.IdMastro;
                                mbDbItem.Numero = item.Numero;
                                this.ctx2.MenaboPagines.Add(mbDbItem);
                            }

                            this.ctx2.SaveChanges();

                            List<MenaboPagine> pags = await this.ctx2.MenaboPagines.Where(m => m.IdTracciato == id_tracciato).ToListAsync();
                            return Ok(pags);

                        }
                        else
                        {
                            throw new Exception("Pagine già create, impossibile creare schema");
                        }
                    }



                }

                this.ctx2.SaveChanges();

                result.error = "";
                result.Esito = true;
            }
            catch (Exception ex)
            {
                result.error = ex.ToString();
            }

            return Ok(result);
        }

        [HttpGet]
        [Route("Menabo/getListaTracciatoNew2/{idLavorazione}/{noCache}")]
        public async Task<IActionResult> getListaTracciatoNew(int idLavorazione, bool noCache)
        {
            ArticoloInRevisioneKitResult result = new ArticoloInRevisioneKitResult();
            ExternalSourceClass exClass = new ExternalSourceClass(this.path_external_source, new string[] { "SourceOrdinamentoLista" });
            if (idLavorazione == 0)
            {
                result.error = "Lavorazione non specificata";
                return Ok(result);
            }
            try
            {

                if (ficoController == null)
                {
                    ficoController = new FicoProcessController(_config, _external_lib, this._fico_conf, _option_import, this.httpClient, _cache, this._dbContextFactory, null, dbContextFactory2: this._dbContextFactory2);
                }

                Stopwatch sw = new Stopwatch();
                sw.Start();

                //PromoLavorazioni plItem = this.ctx2.PromoLavorazionis.FirstOrDefault(p => p.Id == idLavorazione);
                ficoController.HttpContextInRent = HttpContext;
                //Console.WriteLine($"Scarico kit {idLavorazione}");

                var promise = await ficoController.processaKit(idLavorazione, FicoCombinazioneKitReadMode.Advanced, noCache);
                var okResult = promise as OkObjectResult;
                result = (okResult!.Value as ArticoloInRevisioneKitResult)!;

                if (!result.esito)
                {
                    throw new Exception(result.error);
                }
                //List<Dictionary<string, object>> listaFiltrata = result.records.Where(f => (Byte)f.recordInTracciato[GLOBAL_VARIABLES.keyXMLSelezione] == (Byte)TipoSelezioneMenabo.Primaria).Select(f => f.recordInTracciato).ToList();
                if(result.tipoLavorazione != TipoLavorazione.PoP)
                {
                    result.records = Ordinamento.ordinaRecordsTracciatoNew(result.records, exClass);
                }


                sw.Stop();
                sw.ToString();
                //return Ok(processKitResult);

            }
            catch (Exception ex)
            {

                //Console.WriteLine($"Scarico kit error {ex.ToString()}");

                result.error = "getListaTracciatoNew -> " + ex.ToString();
                ex.ToString();
            }

            return Ok(result);
        }

        public List<ArticoloInRevisione> Etichettatura(List<ArticoloInRevisione> records)
        {
            List<ArticoloInRevisione> copyRecords = new List<ArticoloInRevisione>();
            copyRecords.AddRange(records);
            try
            {
                ExternalSourceClass exClass = new ExternalSourceClass(this.path_external_source, new string[] { "SourceMenabo" });
                DbEtichetta EtichetteRefSource = exClass.getEtichette();


                foreach (var record in records)
                {
                    var debug = false;
                    if (record.idRec == 97890)
                    {
                        Debug.WriteLine("");
                        debug = true;
                    }
                    try
                    {
                        record.allEtichette = new List<string>();
                        record.etichetteVisual = new List<string>();
                        foreach (var etichetta in EtichetteRefSource.source)
                        {
                            if (debug && etichetta.Id == 84)
                            {
                                Debug.WriteLine("");
                            }
                            if (etichetta.Regole == null)
                            {
                                continue;
                            }
                            foreach (var setRegole in etichetta.Regole)
                            {

                                foreach (var regola in setRegole)
                                {

                                    if (!getPercorso(record, regola.campo, out var percorso))
                                    {
                                        if (percorso == null)
                                        {
                                            goto setRegole;
                                        }
                                    }
                                    //getPercorso(record, regola.campo, out var percorso);

                                    //if (percorso == null)
                                    //{
                                    //    percorso = "";
                                    //}

                                    if (regola.Value == null)
                                    {
                                        regola.Value = "";
                                    }
                                    switch (regola.Operatore)
                                    {
                                        case "IN":
                                            if (!percorso.ToString()!.ToLower().Contains(regola.Value.ToLower()))
                                            {
                                                goto setRegole;
                                            }
                                            break;
                                        case "CIN":
                                            if (!percorso.ToString()!.Contains(regola.Value))
                                            {
                                                goto setRegole;
                                            }
                                            break;
                                        case "SIN":
                                            if (!percorso.ToString()!.ToLower().Replace(" ", "").Contains(regola.Value.Replace(" ", "").ToLower()))
                                            {
                                                goto setRegole;
                                            }
                                            break;
                                        case "SCIN":
                                            if (!percorso.ToString()!.Replace(" ", "").Contains(regola.Value.Replace(" ", "")))
                                            {
                                                goto setRegole;
                                            }
                                            break;
                                        case "!IN":
                                            if (percorso.ToString()!.ToLower().Contains(regola.Value.ToLower()))
                                            {
                                                goto setRegole;
                                            }
                                            break;
                                        case "C!IN":
                                            if (percorso.ToString()!.Contains(regola.Value))
                                            {
                                                goto setRegole;
                                            }
                                            break;
                                        case "S!IN":
                                            if (percorso.ToString()!.ToLower().Replace(" ", "").Contains(regola.Value.ToLower().Replace(" ", "")))
                                            {
                                                goto setRegole;
                                            }
                                            break;
                                        case "SC!IN":
                                            if (percorso.ToString()!.Replace(" ", "").Contains(regola.Value.Replace(" ", "")))
                                            {
                                                goto setRegole;
                                            }
                                            break;
                                        case "==":
                                            if (double.TryParse(regola.Value.ToString(), out double valore1) &&
        double.TryParse(percorso.ToString(), out double valore2))
                                            {
                                                // Confronto numerico
                                                if (valore1 != valore2)
                                                {
                                                    goto setRegole;
                                                }
                                            }
                                            else
                                            {
                                                // Confronto come stringhe
                                                if (regola.Value.ToString().ToLower() != percorso.ToString()!.ToLower())
                                                {
                                                    goto setRegole;
                                                }
                                            }
                                            break;
                                        case "C==":
                                            if (double.TryParse(regola.Value.ToString(), out double valore3) &&
        double.TryParse(percorso.ToString(), out double valore4))
                                            {
                                                // Confronto numerico
                                                if (valore3 != valore4)
                                                {
                                                    goto setRegole;
                                                }
                                            }
                                            else
                                            {
                                                if (regola.Value.ToString() != percorso.ToString())
                                                {
                                                    goto setRegole;
                                                }
                                            }
                                            break;
                                        case "S==":
                                            if (double.TryParse(regola.Value.ToString(), out double valore5) &&
double.TryParse(percorso.ToString(), out double valore6))
                                            {
                                                // Confronto numerico
                                                if (valore5 != valore6)
                                                {
                                                    goto setRegole;
                                                }
                                            }
                                            else
                                            {
                                                if (regola.Value.ToString().ToLower().Replace(" ", "") != percorso.ToString()!.ToLower().Replace(" ", ""))
                                                {
                                                    goto setRegole;
                                                }
                                            }
                                            break;
                                        case "SC==":
                                            if (double.TryParse(regola.Value.ToString(), out double valore7) &&
double.TryParse(percorso.ToString(), out double valore8))
                                            {
                                                // Confronto numerico
                                                if (valore7 != valore8)
                                                {
                                                    goto setRegole;
                                                }
                                            }
                                            else
                                            {
                                                if (regola.Value.ToString().Replace(" ", "") != percorso.ToString()!.Replace(" ", ""))
                                                {
                                                    goto setRegole;
                                                }
                                            }
                                            break;
                                        case "!=":
                                            if (double.TryParse(regola.Value.ToString(), out double valore9) &&
double.TryParse(percorso.ToString(), out double valore10))
                                            {
                                                // Confronto numerico
                                                if (valore9 == valore10)
                                                {
                                                    goto setRegole;
                                                }
                                            }
                                            else
                                            {
                                                if (regola.Value.ToString().ToLower() == percorso.ToString()!.ToLower())
                                                {
                                                    goto setRegole;
                                                }
                                            }
                                            break;
                                        case "C!=":
                                            if (double.TryParse(regola.Value.ToString(), out double valore11) &&
double.TryParse(percorso.ToString(), out double valore12))
                                            {
                                                // Confronto numerico
                                                if (valore11 == valore12)
                                                {
                                                    goto setRegole;
                                                }
                                            }
                                            else
                                            {
                                                if (regola.Value.ToString() == percorso.ToString())
                                                {
                                                    goto setRegole;
                                                }
                                            }
                                            break;
                                        case "S!=":
                                            if (double.TryParse(regola.Value.ToString(), out double valore13) &&
double.TryParse(percorso.ToString(), out double valore14))
                                            {
                                                // Confronto numerico
                                                if (valore13 == valore14)
                                                {
                                                    goto setRegole;
                                                }
                                            }
                                            else
                                            {
                                                if (regola.Value.ToString().ToLower().Replace(" ", "") == percorso.ToString()!.ToLower().Replace(" ", ""))
                                                {
                                                    goto setRegole;
                                                }
                                            }
                                            break;
                                        case "SC!=":
                                            if (double.TryParse(regola.Value.ToString(), out double valore15) &&
double.TryParse(percorso.ToString(), out double valore16))
                                            {
                                                // Confronto numerico
                                                if (valore15 == valore16)
                                                {
                                                    goto setRegole;
                                                }
                                            }
                                            else
                                            {
                                                if (regola.Value.ToString().Replace(" ", "") == percorso.ToString()!.Replace(" ", ""))
                                                {
                                                    goto setRegole;
                                                }
                                            }
                                            break;
                                        case ">":
                                            if (double.TryParse(percorso.ToString(), out double numericValue) && double.TryParse(regola.Value.ToString(), out double regolaValue))
                                            {
                                                if (numericValue <= regolaValue)
                                                {
                                                    goto setRegole;
                                                }
                                            }
                                            else
                                            {
                                                // campoValue o regolaValue non è un numero
                                                goto setRegole;
                                            }

                                            break;
                                        case "<":

                                            if (double.TryParse(percorso.ToString(), out numericValue) && double.TryParse(regola.Value.ToString(), out regolaValue))
                                            {
                                                if (numericValue >= regolaValue)
                                                {
                                                    goto setRegole;
                                                }
                                            }
                                            else
                                            {
                                                // campoValue o regolaValue non è un numero
                                                goto setRegole;
                                            }
                                            break;
                                        case ">=":
                                            if (double.TryParse(percorso.ToString(), out numericValue) && double.TryParse(regola.Value.ToString(), out regolaValue))
                                            {
                                                if (numericValue < regolaValue)
                                                {
                                                    goto setRegole;
                                                }
                                            }
                                            else
                                            {
                                                // campoValue o regolaValue non è un numero
                                                goto setRegole;
                                            }
                                            break;
                                        case "<=":
                                            if (double.TryParse(percorso.ToString(), out numericValue) && double.TryParse(regola.Value.ToString(), out regolaValue))
                                            {
                                                if (numericValue > regolaValue)
                                                {
                                                    goto setRegole;
                                                }
                                            }
                                            else
                                            {
                                                // campoValue o regolaValue non è un numero
                                                goto setRegole;
                                            }
                                            break;
                                        default:
                                            //Console.WriteLine("Operatore non supportato: " + regola.Operatore);
                                            goto setRegole;
                                    }
                                }
                                record.allEtichette.Add(etichetta.Etichetta);
                                if (etichetta.Visual != null && etichetta.Visual != "")
                                {
                                    record.etichetteVisual.Add(etichetta.Visual);
                                }
                                goto prossimaEtichetta;
                            setRegole: continue;
                            }
                        prossimaEtichetta: continue;
                        }
                        record.recordInTracciato!.Add("allEtichette", record.allEtichette);
                        record.recordInTracciato!.Add("etichetteVisual", record.etichetteVisual);
                    }
                    catch
                    {
                        continue;
                    }
                }
            }
            catch
            {
                return copyRecords;
            }
            return records;
        }

        public ArticoloInRevisione Etichettatura(ArticoloInRevisione record)
        {
            ExternalSourceClass exClass = new ExternalSourceClass(this.path_external_source, new string[] { });
            DbEtichetta EtichetteRefSource = exClass.getEtichette();
            ArticoloInRevisione copyRecord = record;
            if (record.recordInTracciato!["Referenza.Codice"].ToString() == "6333940")
            {
                Debug.WriteLine("");
            }
            try
            {
                record.allEtichette = new List<string>();
                record.etichetteVisual = new List<string>();
                foreach (var etichetta in EtichetteRefSource.source)
                {
                    if (etichetta.Regole == null)
                    {
                        continue;
                    }
                    foreach (var setRegole in etichetta.Regole)
                    {

                        foreach (var regola in setRegole)
                        {
                            if (!getPercorso(record, regola.campo, out var percorso))
                            {
                                if (percorso == null)
                                {
                                    goto setRegole;
                                }
                            }
                            //getPercorso(record, regola.campo, out var percorso);

                            //if (percorso == null)
                            //{
                            //    percorso = "";
                            //}

                            if (regola.Value == null)
                            {
                                regola.Value = "";
                            }

                            regola.Value = regola.Value.ToString().Replace(",", ".");
                            percorso = percorso.ToString()!.Replace(",", ".");

                            switch (regola.Operatore)
                            {
                                case "IN":
                                    if (!percorso.ToString()!.ToLower().Contains(regola.Value.ToLower()))
                                    {
                                        goto setRegole;
                                    }
                                    break;
                                case "CIN":
                                    if (!percorso.ToString()!.Contains(regola.Value))
                                    {
                                        goto setRegole;
                                    }
                                    break;
                                case "SIN":
                                    if (!percorso.ToString()!.ToLower().Replace(" ", "").Contains(regola.Value.Replace(" ", "").ToLower()))
                                    {
                                        goto setRegole;
                                    }
                                    break;
                                case "SCIN":
                                    if (!percorso.ToString()!.Replace(" ", "").Contains(regola.Value.Replace(" ", "")))
                                    {
                                        goto setRegole;
                                    }
                                    break;
                                case "!IN":
                                    if (percorso.ToString()!.ToLower().Contains(regola.Value.ToLower()))
                                    {
                                        goto setRegole;
                                    }
                                    break;
                                case "C!IN":
                                    if (percorso.ToString()!.Contains(regola.Value))
                                    {
                                        goto setRegole;
                                    }
                                    break;
                                case "S!IN":
                                    if (percorso.ToString()!.ToLower().Replace(" ", "").Contains(regola.Value.ToLower().Replace(" ", "")))
                                    {
                                        goto setRegole;
                                    }
                                    break;
                                case "SC!IN":
                                    if (percorso.ToString()!.Replace(" ", "").Contains(regola.Value.Replace(" ", "")))
                                    {
                                        goto setRegole;
                                    }
                                    break;
                                case "==":
                                    if (double.TryParse(regola.Value.ToString(), out double valore1) &&
double.TryParse(percorso.ToString(), out double valore2))
                                    {
                                        // Confronto numerico
                                        if (valore1 != valore2)
                                        {
                                            goto setRegole;
                                        }
                                    }
                                    else
                                    {
                                        // Confronto come stringhe
                                        if (regola.Value.ToString().ToLower() != percorso.ToString()!.ToLower())
                                        {
                                            goto setRegole;
                                        }
                                    }
                                    break;
                                case "C==":
                                    if (double.TryParse(regola.Value.ToString(), out double valore3) &&
double.TryParse(percorso.ToString(), out double valore4))
                                    {
                                        // Confronto numerico
                                        if (valore3 != valore4)
                                        {
                                            goto setRegole;
                                        }
                                    }
                                    else
                                    {
                                        if (regola.Value.ToString() != percorso.ToString())
                                        {
                                            goto setRegole;
                                        }
                                    }
                                    break;
                                case "S==":
                                    if (double.TryParse(regola.Value.ToString(), out double valore5) &&
double.TryParse(percorso.ToString(), out double valore6))
                                    {
                                        // Confronto numerico
                                        if (valore5 != valore6)
                                        {
                                            goto setRegole;
                                        }
                                    }
                                    else
                                    {
                                        if (regola.Value.ToString().ToLower().Replace(" ", "") != percorso.ToString()!.ToLower().Replace(" ", ""))
                                        {
                                            goto setRegole;
                                        }
                                    }
                                    break;
                                case "SC==":
                                    if (double.TryParse(regola.Value.ToString(), out double valore7) &&
double.TryParse(percorso.ToString(), out double valore8))
                                    {
                                        // Confronto numerico
                                        if (valore7 != valore8)
                                        {
                                            goto setRegole;
                                        }
                                    }
                                    else
                                    {
                                        if (regola.Value.ToString().Replace(" ", "") != percorso.ToString()!.Replace(" ", ""))
                                        {
                                            goto setRegole;
                                        }
                                    }
                                    break;
                                case "!=":
                                    if (double.TryParse(regola.Value.ToString(), out double valore9) &&
double.TryParse(percorso.ToString(), out double valore10))
                                    {
                                        // Confronto numerico
                                        if (valore9 == valore10)
                                        {
                                            goto setRegole;
                                        }
                                    }
                                    else
                                    {
                                        if (regola.Value.ToString().ToLower() == percorso.ToString()!.ToLower())
                                        {
                                            goto setRegole;
                                        }
                                    }
                                    break;
                                case "C!=":
                                    if (double.TryParse(regola.Value.ToString(), out double valore11) &&
double.TryParse(percorso.ToString(), out double valore12))
                                    {
                                        // Confronto numerico
                                        if (valore11 == valore12)
                                        {
                                            goto setRegole;
                                        }
                                    }
                                    else
                                    {
                                        if (regola.Value.ToString() == percorso.ToString())
                                        {
                                            goto setRegole;
                                        }
                                    }
                                    break;
                                case "S!=":
                                    if (double.TryParse(regola.Value.ToString(), out double valore13) &&
double.TryParse(percorso.ToString(), out double valore14))
                                    {
                                        // Confronto numerico
                                        if (valore13 == valore14)
                                        {
                                            goto setRegole;
                                        }
                                    }
                                    else
                                    {
                                        if (regola.Value.ToString().ToLower().Replace(" ", "") == percorso.ToString()!.ToLower().Replace(" ", ""))
                                        {
                                            goto setRegole;
                                        }
                                    }
                                    break;
                                case "SC!=":
                                    if (double.TryParse(regola.Value.ToString(), out double valore15) &&
double.TryParse(percorso.ToString(), out double valore16))
                                    {
                                        // Confronto numerico
                                        if (valore15 == valore16)
                                        {
                                            goto setRegole;
                                        }
                                    }
                                    else
                                    {
                                        if (regola.Value.ToString().Replace(" ", "") == percorso.ToString()!.Replace(" ", ""))
                                        {
                                            goto setRegole;
                                        }
                                    }
                                    break;
                                case ">":
                                    if (double.TryParse(percorso.ToString(), out double numericValue) && double.TryParse(regola.Value.ToString(), out double regolaValue))
                                    {
                                        if (numericValue <= regolaValue)
                                        {
                                            goto setRegole;
                                        }
                                    }
                                    else
                                    {
                                        // campoValue o regolaValue non è un numero
                                        goto setRegole;
                                    }

                                    break;
                                case "<":

                                    if (double.TryParse(percorso.ToString(), out numericValue) && double.TryParse(regola.Value.ToString(), out regolaValue))
                                    {
                                        if (numericValue >= regolaValue)
                                        {
                                            goto setRegole;
                                        }
                                    }
                                    else
                                    {
                                        // campoValue o regolaValue non è un numero
                                        goto setRegole;
                                    }
                                    break;
                                case ">=":
                                    if (double.TryParse(percorso.ToString(), out numericValue) && double.TryParse(regola.Value.ToString(), out regolaValue))
                                    {
                                        if (numericValue < regolaValue)
                                        {
                                            goto setRegole;
                                        }
                                    }
                                    else
                                    {
                                        // campoValue o regolaValue non è un numero
                                        goto setRegole;
                                    }
                                    break;
                                case "<=":
                                    if (double.TryParse(percorso.ToString(), out numericValue) && double.TryParse(regola.Value.ToString(), out regolaValue))
                                    {
                                        if (numericValue > regolaValue)
                                        {
                                            goto setRegole;
                                        }
                                    }
                                    else
                                    {
                                        // campoValue o regolaValue non è un numero
                                        goto setRegole;
                                    }
                                    break;
                                default:
                                    //Console.WriteLine("Operatore non supportato: " + regola.Operatore);
                                    goto setRegole;
                            }
                        }
                        record.allEtichette.Add(etichetta.Etichetta);
                        if (etichetta.Visual != null && etichetta.Visual != "")
                        {
                            record.etichetteVisual.Add(etichetta.Visual);
                        }
                        goto prossimaEtichetta;
                    setRegole: continue;
                    }
                prossimaEtichetta: continue;
                }
                record.recordInTracciato.Add("allEtichette", record.allEtichette);
                record.recordInTracciato.Add("etichetteVisual", record.etichetteVisual);

            }
            catch
            {
                return copyRecord;
            }
            return record;

        }

        public List<ArticoloInRevisione> GetMastroAssociate(List<ArticoloInRevisione> records)
        {

            List<ArticoloInRevisione> copyRecords = new List<ArticoloInRevisione>();
            copyRecords.AddRange(records);
            try
            {
                ExternalSourceClass exClass = new ExternalSourceClass(this.path_external_source, new string[] { "SourceMenabo" });
                DbRegoleMastro RegoleMastro = exClass.getDbRegoleMastro();

                foreach (var record in records)
                {
                    if (record.isGruppo || record.allEtichette == null)
                    {
                        continue;
                    }
                    try
                    {
                        foreach (var mastro in RegoleMastro.source)
                        {
                            if (mastro.Regole != null && mastro.Regole.Count > 0)
                            {
                                foreach (var setRegole in mastro.Regole)
                                {
                                    bool setValido = true;
                                    foreach (var regola in setRegole)
                                    {
                                        if (regola.presente != record.allEtichette.Contains(regola.nomeEtichetta))
                                        {
                                            setValido = false;
                                            break;
                                        }
                                    }
                                    if (setValido)
                                    {
                                        record.regoleMastro.Add(mastro);
                                        break;
                                    }
                                }
                            }
                            else
                            {
                                //record.regoleMastro.Add(mastro);
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        ex.ToString();
                    }
                }
            }
            catch
            {
                return copyRecords;
            }
            return records;
        }
        public ArticoloInRevisione GetMastroAssociate(ArticoloInRevisione record)
        {
            ArticoloInRevisione copyRecord = record;
            if (record.isGruppo)
            {
                return copyRecord;
            }
            try
            {
                ExternalSourceClass exClass = new ExternalSourceClass(this.path_external_source, new string[] { "SourceMenabo" });
                DbRegoleMastro RegoleMastro = exClass.getDbRegoleMastro();
                foreach (var mastro in RegoleMastro.source)
                {
                    if (mastro.Regole != null && mastro.Regole.Count > 0)
                    {
                        foreach (var setRegole in mastro.Regole)
                        {
                            bool setValido = true;
                            foreach (var regola in setRegole)
                            {
                                if (regola.presente != record.allEtichette!.Contains(regola.nomeEtichetta))
                                {
                                    setValido = false;
                                    break;
                                }
                            }
                            if (setValido)
                            {
                                record.regoleMastro.Add(mastro);
                                break;
                            }
                        }
                    }
                    else
                    {
                        //record.regoleMastro.Add(mastro);
                    }
                }
            }
            catch (Exception ex)
            {
                ex.ToString();
                return copyRecord;
            }
            return record;
        }

        [HttpGet]
        [Route("Menabo/getDbRegoleMastro")]
        public async Task<IActionResult> getDbRegoleMastro()
        {
            try
            {
                ExternalSourceClass exClass = new ExternalSourceClass(this.path_external_source, new string[] { "SourceMenabo" });
                DbRegoleMastro RegoleMastro = exClass.getDbRegoleMastro();
                return Ok(RegoleMastro);
            }
            catch (Exception ex)
            {
                return Ok(ex.ToString());
            }
        }
        bool getPercorso(ArticoloInRevisione record, string campo, out object percorso)
        {
            try
            {
                if (campo.Contains("recordInTracciato"))
                {
                    string chiave = campo.Replace("recordInTracciato.", "");
                    percorso = "";
                    bool contextPromo = false;
                    bool contextTracciato = false;
                    if (chiave.StartsWith(GLOBAL_VARIABLES.keyContextPromo))
                    {
                        contextPromo = true;
                        chiave = chiave.Replace(GLOBAL_VARIABLES.keyContextPromo, "");
                    }
                    else if (chiave.StartsWith(GLOBAL_VARIABLES.keyContextTracciato))
                    {
                        contextTracciato = true;
                        chiave = chiave.Replace(GLOBAL_VARIABLES.keyContextTracciato, "");
                    }

                    if (!contextPromo && !contextTracciato)
                    {
                        if (!record.recordInTracciato!.ContainsKey(chiave))
                        {
                            return false;
                        }
                        percorso = record.recordInTracciato[chiave];
                    }
                    else if (contextPromo)
                    {
                        if (!record.recordInTracciato!.ContainsKey(GLOBAL_VARIABLES.keyContextPromo))
                        {
                            return false;
                        }

                        var context = record.recordInTracciato[GLOBAL_VARIABLES.keyContextPromo] as List<Dictionary<string, object>>;

                        //destinazioneObj = JsonConvert.DeserializeObject<List<Dictionary<string, object>>>(destinazioneObj.ToString());
                        if (context == null)
                        {
                            return false;
                        }

                        Dictionary<string, object>? dict = context
                            .Find(f => f.ContainsKey("nome_field") && f["nome_field"].ToString() == chiave);
                        if (dict == null)
                        {
                            percorso = "";
                            return false;
                        }
                        percorso = dict["user_value"];
                        return true;
                    }
                    else if (contextTracciato)
                    {
                        if (!record.recordInTracciato!.ContainsKey(GLOBAL_VARIABLES.keyContextTracciato))
                        {
                            return false;
                        }

                        var context = record.recordInTracciato[GLOBAL_VARIABLES.keyContextTracciato] as List<Dictionary<string, object>>;
                        if (context == null)
                        {
                            return false;
                        }

                        //destinazioneObj = JsonConvert.DeserializeObject<List<Dictionary<string, object>>>(destinazioneObj.ToString());

                        Dictionary<string, object>? dict = context
                            .Find(f => f.ContainsKey("nome_field") && f["nome_field"].ToString() == chiave);
                        if (dict == null)
                        {
                            percorso = "";
                            return false;
                        }
                        percorso = dict["user_value"];
                        return true;
                    }
                }
                else if (campo.Contains("recordRevisionato"))
                {
                    percorso = "";
                    if (record.recordRevisionato == null)
                    {
                        return false;
                    }
                    var ty = record.recordRevisionato.GetType();
                    string chiave = campo.Replace("recordRevisionato.", "");

                    PropertyInfo? p = ty.GetProperty(chiave);

                    percorso = p!.GetValue(record.recordRevisionato)!;
                }
                else if (campo.Contains("recordImpaginato"))
                {
                    if (record.isGruppo)
                    {
                        Debug.WriteLine("");
                    }
                    percorso = "";
                    if (record.recordImpaginato == null)
                    {
                        return false;
                    }
                    var ty = record.recordImpaginato.GetType();
                    string chiave = campo.Replace("recordImpaginato.", "");

                    var chiaviSplit = chiave.Split(".");
                    //PropertyInfo p = ty.GetProperty(chiaveSingola);
                    //var destinazione = p.GetValue(record.recordImpaginato);
                    int count = 0;
                    var destinazione = ty;
                    var destinazioneObj = new object();
                    foreach (var chiaveSingola in chiaviSplit)
                    {
                        if (count == 0)
                        {
                            PropertyInfo? p = ty.GetProperty(chiaveSingola);
                            destinazioneObj = p!.GetValue(record.recordImpaginato);
                            destinazione = destinazioneObj!.GetType();
                            if (chiaviSplit.Length == 1)
                            {
                                percorso = destinazioneObj;
                            }
                            count++;
                        }
                        else
                        {
                            PropertyInfo? p = destinazione.GetProperty(chiaveSingola);
                            Type ty2 = p!.GetValue(destinazioneObj!)!.GetType();
                            if (!ty2.IsSimpleType())//!ty2.IsSerializable)
                            {
                                destinazione = p!.GetValue(destinazioneObj)!.GetType();
                            }
                            else
                            {
                                //Prendi il valore
                                percorso = p!.GetValue(destinazioneObj)!;
                                break;
                            }

                            count++;
                        }
                    }

                    //percorso = destinazione;

                }
                else if (campo.Contains("promoTracciati"))
                {
                    if (record.isGruppo)
                    {
                        Debug.WriteLine("");
                    }
                    percorso = "";
                    if (record.promoTracciati == null)
                    {
                        return false;
                    }
                    if (record.promoTracciati == null)
                    {
                        return false;
                    }
                    var ty = record.promoTracciati.GetType();
                    string chiave = campo.Replace("promoTracciati.", "");

                    var chiaviSplit = chiave.Split(".");
                    //PropertyInfo p = ty.GetProperty(chiaveSingola);
                    //var destinazione = p.GetValue(record.recordImpaginato);
                    int count = 0;
                    var destinazione = ty;
                    var destinazioneObj = new object();
                    //modificare come in promo di modo che legga nome field dal context invece che usare il meta
                    foreach (var chiaveSingola in chiaviSplit)
                    {
                        if (destinazione.Name.ToLower() == "string" && chiaviSplit[0].ToLower() == "meta")
                        {
                            destinazioneObj = JsonConvert.DeserializeObject<Dictionary<string, object>>(destinazioneObj.ToString()!);
                            if ((destinazioneObj as Dictionary<string, object>)!.ContainsKey(chiaveSingola))
                            {
                                percorso = (destinazioneObj as Dictionary<string, object>)![chiaveSingola];
                                return true;
                            }
                        }
                        if (count == 0)
                        {
                            PropertyInfo? p = ty.GetProperty(chiaveSingola);
                            destinazioneObj = p!.GetValue(record.promoTracciati);
                            if (destinazioneObj == null)
                            {
                                return false;
                            }
                            destinazione = destinazioneObj.GetType();
                            if (chiaviSplit.Length == 1)
                            {
                                percorso = destinazioneObj;
                            }
                            count++;
                        }
                        else
                        {
                            PropertyInfo? p = destinazione.GetProperty(chiaveSingola);
                            if (p == null)
                            {
                                percorso = "";
                                return false;
                            }
                            Type ty2 = p.GetValue(destinazioneObj)!.GetType();
                            if (!ty2.IsSimpleType())//!ty2.IsSerializable)
                            {
                                destinazione = p.GetValue(destinazioneObj)!.GetType();
                            }
                            else
                            {
                                //Prendi il valore
                                percorso = p.GetValue(destinazioneObj)!;
                                break;
                            }

                            count++;
                        }
                    }
                }
                else if (campo.Contains("promo"))
                {
                    percorso = "";
                    if (record.promo == null)
                    {
                        return false;
                    }
                    if (record.isGruppo)
                    {
                        Debug.WriteLine("");
                    }
                    if (record.promo == null)
                    {
                        return false;
                    }
                    var ty = record.promo.GetType();
                    string chiave = campo.Replace("promo.", "");

                    var chiaviSplit = chiave.Split(".");
                    //PropertyInfo p = ty.GetProperty(chiaveSingola);
                    //var destinazione = p.GetValue(record.recordImpaginato);
                    int count = 0;
                    var destinazione = ty;
                    var destinazioneObj = new object();
                    foreach (var chiaveSingola in chiaviSplit)
                    {
                        if (destinazione.Name.ToLower() == "string" && chiaviSplit[0].ToLower() == "context")
                        {
                            destinazioneObj = JsonConvert.DeserializeObject<List<Dictionary<string, object>>>(destinazioneObj.ToString()!);

                            Dictionary<string, object> dict = (destinazioneObj as List<Dictionary<string, object>>)!
                                .Find(f => f.ContainsKey("nome_field") && f["nome_field"].ToString() == chiaveSingola)!;
                            if (dict == null)
                            {
                                percorso = "";
                                return false;
                            }
                            percorso = dict["user_value"];
                            return true;
                        }
                        if (count == 0)
                        {
                            PropertyInfo? p = ty.GetProperty(chiaveSingola);
                            if (p == null)
                            {
                                percorso = "";
                                return false;
                            }
                            destinazioneObj = p.GetValue(record.promo);
                            if (destinazioneObj == null)
                            {
                                return false;
                            }
                            destinazione = destinazioneObj.GetType();
                            if (chiaviSplit.Length == 1)
                            {
                                percorso = destinazioneObj;
                            }
                            count++;
                        }
                        else
                        {
                            PropertyInfo? p = destinazione.GetProperty(chiaveSingola);
                            Type ty2 = p!.GetValue(destinazioneObj)!.GetType();
                            if (!ty2.IsSimpleType())//!ty2.IsSerializable)
                            {
                                destinazione = p.GetValue(destinazioneObj)!.GetType();
                            }
                            else
                            {
                                //Prendi il valore
                                percorso = p.GetValue(destinazioneObj)!;
                                break;
                            }

                            count++;
                        }
                    }
                }
                else if (campo.Contains("kit.declinazioni"))
                {
                    string chiave = campo.Replace("kit.declinazioni.", "");
                    percorso = "";

                    if (!record.recordInTracciato!.ContainsKey(GLOBAL_VARIABLES.keyKitDeclinazioni))
                    {
                        return false;
                    }

                    var context = record.recordInTracciato[GLOBAL_VARIABLES.keyKitDeclinazioni] as List<FicoCombinazioniKitDeclinazioneProprieta>;
                    if (context == null)
                    {
                        return false;
                    }

                    //destinazioneObj = JsonConvert.DeserializeObject<List<Dictionary<string, object>>>(destinazioneObj.ToString());
                    //Int16 chiaveDK = 0;
                    //Int16.TryParse(chiave, out chiaveDK);
                    //FicoDeclinazioneKit ficoDK = null;
                    //if (chiaveDK>0)
                    //    ficoDK = SingletonConfiguration.DbDeclinazioniKit.source.FirstOrDefault(kd => kd.Id == chiaveDK);
                    //else
                    //    ficoDK = SingletonConfiguration.DbDeclinazioniKit.source.FirstOrDefault(kd => kd.Codice == chiave);

                    var dict = context.Find(f => f.chiaveCompilata == chiave);
                    if (dict == null)
                    {
                        percorso = "";
                        return false;
                    }
                    percorso = dict.valore;
                    return true;


                }
                else if (campo.Contains("formato"))
                {
                    percorso = "";
                    if (record.formato == null)
                    {
                        return false;
                    }
                    var ty = record.formato.GetType();
                    string chiave = campo.Replace("formato.", "");

                    var chiaviSplit = chiave.Split(".");
                    //PropertyInfo p = ty.GetProperty(chiaveSingola);
                    //var destinazione = p.GetValue(record.recordImpaginato);
                    int count = 0;
                    var destinazione = ty;
                    var destinazioneObj = new object();
                    foreach (var chiaveSingola in chiaviSplit)
                    {
                        if (count == 0)
                        {
                            PropertyInfo? p = ty.GetProperty(chiaveSingola);
                            if (p == null)
                            {
                                percorso = "";
                                return false;
                            }
                            destinazioneObj = p.GetValue(record.formato);
                            if (destinazioneObj == null)
                            {
                                return false;
                            }
                            destinazione = destinazioneObj.GetType();
                            if (chiaviSplit.Length == 1)
                            {
                                percorso = destinazioneObj;
                            }
                            count++;
                        }
                        else
                        {
                            PropertyInfo? p = destinazione.GetProperty(chiaveSingola);
                            Type ty2 = p!.GetValue(destinazioneObj)!.GetType();
                            if (!ty2.IsSimpleType())//!ty2.IsSerializable)
                            {
                                destinazione = p.GetValue(destinazioneObj)!.GetType();
                            }
                            else
                            {
                                //Prendi il valore
                                percorso = p.GetValue(destinazioneObj)!;
                                break;
                            }

                            count++;
                        }
                    }
                }
                else
                {
                    int indicePunto = campo.IndexOf('.');

                    // Se il punto esiste nella stringa
                    if (indicePunto != -1)
                    {
                        // Rimuovi tutto prima del primo '.'
                        campo = campo.Substring(indicePunto + 1);
                    }

                    Type tipo = record.GetType();

                    // Cerca il campo specifico (puoi anche usare GetProperty se è una proprietà)
                    FieldInfo? campoField = tipo.GetField(campo, BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance);
                    //throw new Exception();
                    if (campoField != null)
                    {
                        percorso = campoField.GetValue(record)!;
                    }
                    else
                    {
                        throw new ArgumentException($"Campo o proprietà '{campo}' non trovata.");
                    }

                    return true;
                }
                return true;

            }
            catch
            {
                percorso = "";
                return false;
            }
        }

        private bool returnHasFoto(Dictionary<string, object> result)
        {
            string? referenza = Enum.GetName(AddestramentoRuoli.Referenza);
            if (result.ContainsKey(referenza!))
            {
                Dictionary<string, object>? referenzaContent = ((JObject)result[referenza!]).ToObject<Dictionary<string, object>>();
                Int64 id = (Int64)referenzaContent![GLOBAL_VARIABLES.keyRefId];

                return ctx.ArticoliFotos.Where(w => w.IdArticolo == id).Count() > 0;

            }
            return false;
        }

        [HttpPost]
        [Route("Menabo/AllInMenabo")]
        public async Task<IActionResult> AllInMenabo(ListMenaboRefsToImpaginate objs)
        {
            ResultImpaginazioneAutomatica result = new ResultImpaginazioneAutomatica();
            if (objs.refsToImpaginate == null)
            {
                return Ok(result);
            }
            try
            {
                List<long> pagineBloccate = new List<long>();
                List<long> pagineBloccateFormato = new List<long>();
                List<long> pagineNonNuove = new List<long>();
                List<long> tmpPagineBloccate = new List<long>();
                List<long> tmpPagineBloccateFormato = new List<long>();
                List<long> tmpPagineNonNuove = new List<long>();
                pagineNonNuove = ctx2.MenaboPagines.Include(f => f.MenaboRefs).Where(f => f.MenaboRefs.Count > 0 && f.IdTracciato == objs.refsToImpaginate[0].idTracciato).Select(f => f.Id).ToList();
                int idRegolaUltimoBlocco = 0;
                int idRegolaUltimoNonNuovo = 0;
                int idRegolaUltima = 0;
                DbMastro mastro = getMastro();
                DbMeccaniche meccaniche = getMeccaniche();

                if (objs.refsToImpaginate == null)
                {
                    objs.refsToImpaginate = new List<MenaboRefsToImpaginate>();
                }
                List<ResultMenaboRefsToImpaginate> failedRefNotImpaginated = new List<ResultMenaboRefsToImpaginate>();
                List<ResultMenaboRefsToImpaginate> successRefImpaginated = new List<ResultMenaboRefsToImpaginate>();
                for (int i = 0; i < objs.refsToImpaginate.Count; i++) // var item in objs.refsToImpaginate)
                {
                    var item = objs.refsToImpaginate[i];
                    if (item.menaboref!.IdRecord.ToString() == "3529")
                    {
                        //Console.WriteLine("Hey");
                    }


                    if (item.regole![0].id != idRegolaUltimoBlocco)
                    {
                        pagineBloccate.AddRange(tmpPagineBloccate);
                        tmpPagineBloccate.Clear();
                    }
                    if (item.regole[0].id != idRegolaUltimoNonNuovo)
                    {
                        pagineNonNuove.AddRange(tmpPagineNonNuove);
                        tmpPagineNonNuove.Clear();
                    }
                    if (item.regole[0].id != idRegolaUltima)
                    {
                        pagineBloccateFormato.AddRange(tmpPagineBloccateFormato);
                        tmpPagineBloccateFormato.Clear();
                        idRegolaUltima = item.regole[0].id;
                    }
                    IActionResult? res = null;
                    IActionResult? resCambioFormato = null;
                    int PagCurr = item.regole[0].paginaDa;
                    var objPagCurr = this.ctx2.MenaboPagines.Where(f => f.Numero == PagCurr && f.IdTracciato == item.idTracciato).FirstOrDefault();
                    item.menaboref.IdPagina = objPagCurr!.Id;
                    bool skip = false;


                    IActionResult? formatoRes = null;
                    string formatoRichiesto = "";
                    if (item.regole[0].meccanica == "0")
                    {
                        short idPagMastro = objPagCurr.IdMastro;
                        var pagMastro = mastro.source.Find(f => f.Id == idPagMastro);
                        JObject? jobj = JsonConvert.DeserializeObject<JObject>(JsonConvert.SerializeObject(pagMastro!));
                        var mastroDict = jobj!.ToObject<Dictionary<string, object>>();

                        JObject? jobjMecc = JsonConvert.DeserializeObject<JObject>(JsonConvert.SerializeObject(meccaniche!));
                        var meccanicheDict = jobjMecc!.ToObject<Dictionary<string, object>>();

                        JObject o1 = JObject.Parse(System.IO.File.ReadAllText(this.path_external_source + "SourceMenabo.json"));
                        if (!o1.ContainsKey("libAutoImpaginazioneMeccanica"))
                        {
                            throw new Exception("libAutoImpaginazioneMeccanica non specificato in sourceMenabo.json");
                        }
                        string? funcAutoImpaginazione = o1["libAutoImpaginazioneMeccanica"]!.ToString();
                        Dictionary<string, object> _pass = new Dictionary<string, object>();
                        IstantaController icCtrl = new IstantaController("", this.path_external_lib, this.path_external_source, this._dbContextFactory);
                        ParameterInfo[] par = icCtrl.getParameterInfo(funcAutoImpaginazione);
                        var gruppo = this.ctx2.PromoTracciatiRecords.Where(f => f.IdTracciato == item.idTracciato && (item.menaboref.IdRecord != 0 ? f.Id == item.menaboref.IdRecord : f.CodiceGruppo == item.menaboref.CodiceGruppo)).ToList();
                        //Dictionary<string, object> mastroDict = new Dictionary<string, object>();
                        //PropertyInfo[] properties = pagMastro.GetType().GetProperties();

                        //foreach (PropertyInfo property in properties)
                        //{
                        //    // Aggiungere la proprietà e il suo valore al dizionario
                        //    mastroDict[property.Name] = property.GetValue(pagMastro);
                        //}

                        List<Dictionary<string, object>> listGruppoDict = new List<Dictionary<string, object>>();
                        foreach (var single in gruppo)
                        {
                            Dictionary<string, object> singleDict = new Dictionary<string, object>();
                            PropertyInfo[] propertiesSingle = single.GetType().GetProperties();
                            foreach (PropertyInfo property in propertiesSingle)
                            {
                                // Aggiungere la proprietà e il suo valore al dizionario
                                singleDict[property.Name] = property.GetValue(single)!;
                            }
                            listGruppoDict.Add(singleDict);
                        }

                        _pass["gruppo"] = listGruppoDict;
                        _pass["mastro"] = mastroDict!;
                        _pass["meccaniche"] = meccanicheDict!;
                        string? resultExternal = icCtrl.execLibFunction(funcAutoImpaginazione, _pass).ToString();

                        if (resultExternal != "0" && resultExternal != "")
                        {
                            item.regole[0].meccanica = resultExternal!;
                        }
                        //List<Dictionary<string, object>> resultExtDict = JsonConvert.DeserializeObject<List<Dictionary<string, object>>>(resultExternal);
                    }

                    if (item.regole[0].meccanica != "0")
                    {
                        formatoRes = await getFormato(item.regole[0].meccanica!);
                        if (formatoRes is OkObjectResult && (formatoRes as OkObjectResult)!.Value is string)
                        {
                            formatoRichiesto = (formatoRes as OkObjectResult)!.Value!.ToString()!;
                        }
                    }
                    else
                    {
                        throw new Exception("meccanica non trovata per l'elemento");
                    }



                    if (!pagineBloccate.Contains(objPagCurr.Id))
                    {
                        if (item.regole[0].restrizioni == (int)Restrizioni.Nessuna || item.regole[0].restrizioni != (int)Restrizioni.Nessuna && !pagineNonNuove.Contains(objPagCurr.Id))
                        {
                            if (formatoRichiesto != "1x1" && item.regole[0].formatoPagina != "0")
                            {
                                if (!pagineBloccateFormato.Contains(objPagCurr.Id) || item.regole[0].formatoPagina == getFormatoPagina(objPagCurr.Id))
                                {
                                    resCambioFormato = await Index(item.idTracciato, objPagCurr.Id, (short)objPagCurr.IdMastro, item.regole[0].formatoPagina!);
                                    if (resCambioFormato is OkObjectResult && (resCambioFormato as OkObjectResult)!.Value is BoolResult && !((resCambioFormato as OkObjectResult)!.Value as BoolResult)!.Esito)
                                    {
                                        skip = true;
                                        res = new OkObjectResult(new BoolResult());
                                        ((res as OkObjectResult)!.Value as BoolResult)!.Esito = false;
                                        ((res as OkObjectResult)!.Value as BoolResult)!.error = "Impossibile impostare il formato richiesto per la pagina";
                                        ((res as OkObjectResult)!.Value as BoolResult)!.errorCode = ErrorCodes.ImpossibileCambiareFormatoPagina;
                                    }
                                    if (!tmpPagineBloccateFormato.Contains(objPagCurr.Id))
                                    {
                                        tmpPagineBloccateFormato.Add(objPagCurr.Id);
                                    }
                                }
                                else
                                {
                                    skip = true;
                                    res = new OkObjectResult(new BoolResult());
                                    ((res as OkObjectResult)!.Value as BoolResult)!.Esito = false;
                                    ((res as OkObjectResult)!.Value as BoolResult)!.error = "Impossibile impostare il formato richiesto per la pagina";
                                    ((res as OkObjectResult)!.Value as BoolResult)!.errorCode = ErrorCodes.ImpossibileCambiareFormatoPagina;
                                }
                            }
                            if (!skip)
                            {
                                res = await inMenabo(item.menaboref, true, item.idTracciato, item.areaTracciato!, Convert.ToInt16(item.regole[0].indice), true, item.regole[0]);
                            }
                        }
                    }
                    while (res == null && PagCurr < item.regole[0].paginaA || (res is OkObjectResult && (res as OkObjectResult)!.Value is BoolResult && PagCurr < item.regole[0].paginaA))
                    {
                        if (res is OkObjectResult && (res as OkObjectResult)!.Value is BoolResult)
                        {
                            item.menaboref.Indice = 0;
                            item.regole[0].indice = 0;
                        }
                        PagCurr += 1;
                        objPagCurr = this.ctx2.MenaboPagines.Where(f => f.Numero == PagCurr && f.IdTracciato == item.idTracciato).FirstOrDefault();
                        item.menaboref.IdPagina = objPagCurr!.Id;
                        if (!pagineBloccate.Contains(objPagCurr.Id))
                        {
                            if (item.regole[0].restrizioni == (int)Restrizioni.Nessuna || item.regole[0].restrizioni != (int)Restrizioni.Nessuna && !pagineNonNuove.Contains(objPagCurr.Id))
                            {
                                if (formatoRichiesto != "1x1")
                                {
                                    if (!pagineBloccateFormato.Contains(objPagCurr.Id) || item.regole[0].formatoPagina == getFormatoPagina(objPagCurr.Id))
                                    {
                                        resCambioFormato = await Index(item.idTracciato, objPagCurr.Id, (short)objPagCurr.IdMastro, item.regole[0].formatoPagina!);
                                        if (resCambioFormato is OkObjectResult && (resCambioFormato as OkObjectResult)!.Value is BoolResult && !((resCambioFormato as OkObjectResult)!.Value as BoolResult)!.Esito)
                                        {
                                            res = new OkObjectResult(new BoolResult());
                                            ((res as OkObjectResult)!.Value as BoolResult)!.Esito = false;
                                            ((res as OkObjectResult)!.Value as BoolResult)!.error = "Impossibile impostare il formato richiesto per la pagina";
                                            ((res as OkObjectResult)!.Value as BoolResult)!.errorCode = ErrorCodes.ImpossibileCambiareFormatoPagina;
                                            continue;
                                        }
                                        if (!tmpPagineBloccateFormato.Contains(objPagCurr.Id))
                                        {
                                            tmpPagineBloccateFormato.Add(objPagCurr.Id);
                                        }
                                    }
                                    else
                                    {
                                        res = new OkObjectResult(new BoolResult());
                                        ((res as OkObjectResult)!.Value as BoolResult)!.Esito = false;
                                        ((res as OkObjectResult)!.Value as BoolResult)!.error = "Impossibile impostare il formato richiesto per la pagina";
                                        ((res as OkObjectResult)!.Value as BoolResult)!.errorCode = ErrorCodes.ImpossibileCambiareFormatoPagina;
                                        continue;
                                    }
                                }
                                res = await inMenabo(item.menaboref, true, item.idTracciato, item.areaTracciato!, Convert.ToInt16(item.regole[0].indice), true, item.regole[0]);
                            }
                        }
                    }
                    if (res is OkObjectResult)
                    {
                        var okObjectResult = res as OkObjectResult;
                        if (okObjectResult!.Value is BoolResult)
                        {
                            tmpPagineBloccateFormato.Remove(objPagCurr.Id);
                            if (item.regole.Count > 1)
                            {
                                item.regole.RemoveAt(0);
                                objs.refsToImpaginate = objs.refsToImpaginate.OrderBy(f => f.regole![0].priority).ThenBy(f => f.regole![0].ordine).ToList();
                                i--;
                                continue;
                            }
                            else
                            {
                                var boolResult = okObjectResult.Value as BoolResult;

                                // Ora puoi lavorare con l'oggetto BoolResult
                                if (!boolResult!.Esito)
                                {
                                    ResultMenaboRefsToImpaginate failedRef = new ResultMenaboRefsToImpaginate();
                                    failedRef.error = boolResult.error;
                                    failedRef.errorCode = (int)boolResult.errorCode;
                                    failedRef.refs = item;
                                    failedRefNotImpaginated.Add(failedRef);
                                }
                            }
                        }
                        else if (okObjectResult.Value is refsConMultiplex)
                        {
                            var refResult = okObjectResult.Value as refsConMultiplex;
                            this.ctx2.MenaboRefs.Where(f => f.Id == refResult!.Ref!.Id!).FirstOrDefault()!.Formato = item.regole[0].meccanica;
                            this.ctx2.SaveChanges();
                            ResultMenaboRefsToImpaginate successRef = new ResultMenaboRefsToImpaginate();
                            successRef.error = "";
                            successRef.errorCode = 0;
                            //item.menaboref = refResult.Ref;
                            item.menaboref.Selezione = refResult!.Ref!.Selezione;
                            item.menaboref.CodiceGruppo = refResult.Ref.CodiceGruppo;
                            item.menaboref.Indice = refResult.Ref.Indice;
                            item.menaboref.Formato = refResult.Ref.Formato;
                            item.menaboref.Id = refResult.Ref.Id;
                            item.menaboref.IdPagina = refResult.Ref.IdPagina;
                            item.menaboref.IdRecord = refResult.Ref.IdRecord;
                            item.indiceImpaginato = refResult.Ref.Indice;
                            item.paginaImpaginato = this.ctx2.MenaboPagines.Where(f => f.Id == refResult.Ref.IdPagina && f.IdTracciato == item.idTracciato).FirstOrDefault()!.Numero;
                            successRef.refs = item;
                            successRefImpaginated.Add(successRef);

                            if (item.regole[0].restrizioni == (int)Restrizioni.PaginaEsclusiva)
                            {
                                idRegolaUltimoBlocco = item.regole[0].id;
                                if (!tmpPagineBloccate.Contains(refResult.Ref.IdPagina))
                                {
                                    tmpPagineBloccate.Add(refResult.Ref.IdPagina);
                                }
                            }

                            idRegolaUltimoNonNuovo = item.regole[0].id;
                            if (!tmpPagineNonNuove.Contains(refResult.Ref.IdPagina))
                            {
                                tmpPagineNonNuove.Add(refResult.Ref.IdPagina);
                            }

                        }
                    }
                    else if (res == null)
                    {
                        ResultMenaboRefsToImpaginate failedRef = new ResultMenaboRefsToImpaginate();
                        failedRef.error = "Tutte le pagine non erano più disponibili";
                        failedRef.errorCode = (int)ErrorCodes.NessunaPaginaDisponibile;
                        failedRef.refs = item;
                        failedRefNotImpaginated.Add(failedRef);
                    }
                }

                result.menaboRefsImpaginated.AddRange(successRefImpaginated);
                result.menaboRefsFailed.AddRange(failedRefNotImpaginated);

                return Ok(result);
            }
            catch (Exception ex)
            {
                result.failedOperation = true;
                result.error = ex.Message;
                return Ok(result);
            }
        }

        private string getFormatoPagina(long id)
        {
            MenaboPagine? pag = this.ctx2.MenaboPagines.Where(m => m.Id == id).FirstOrDefault();
            if (pag != null)
            {
                return pag.Formato!;
            }
            else
            {
                return "";
            }
        }

        [HttpPut]
        [Route("Menabo/inMenabo/{onoff}/{indice}/{idTracciato}/{areaTracciato}")]
        public async Task<IActionResult> inMenabo(MenaboRef obj, bool onoff, int idTracciato, string areaTracciato = "", Int16 indice = 0, bool automatismo = false, listaSetRegole? regole = null)
        {
            BoolResult result = new BoolResult();
            refsConMultiplex resultMultiplex = new refsConMultiplex();
            resultMultiplex.Ref = new MenaboRefLocal();
            if (obj.CodiceGruppo == "1459933,1507202")
            {
                //Console.WriteLine("hey");
            }
            try
            {
                //MenaboRef _ref = await this.ctx2.MenaboRefs.Where(mp => mp.IdRecord == obj.IdRecord || mp.CodiceGruppo.Equals(obj.CodiceGruppo)).FirstOrDefaultAsync();
                //MenaboRef _ref = await this.ctx2.MenaboRefs.Include(i1 => i1.IdPaginaNavigation).Where(mp => mp.IdRecord == obj.IdRecord || mp.CodiceGruppo.Equals(obj.CodiceGruppo) && mp.IdPaginaNavigation.IdTracciato == idTracciato).FirstOrDefaultAsync();
                if (await this.ctx2.MenaboPagines.Where(f => f.Id == obj.IdPagina).FirstOrDefaultAsync() == null)
                {
                    result.errorCode = ErrorCodes.PaginaInesistente;
                    throw new Exception("Pagina non presente in menabo");
                }
                MenaboRef? _ref = await this.ctx2.MenaboRefs.Include(i1 => i1.IdPaginaNavigation).Where(mp => (mp.IdRecord != null ? mp.IdRecord == obj.IdRecord : mp.CodiceGruppo!.Equals(obj.CodiceGruppo)) && mp.IdPaginaNavigation.IdTracciato == idTracciato).FirstOrDefaultAsync();

                if (onoff)
                {
                    JObject oMecc = JObject.Parse(System.IO.File.ReadAllText(this.path_external_source + "SourceMeccaniche.json"));
                    DbMeccaniche? meccDB = oMecc.ToObject<DbMeccaniche>();
                    string meccDefault = "";
                    try
                    {
                        meccDefault = meccDB!.source.Where(f => f.Aree == null || f.Aree.Count == 0 || f.Aree.Contains(areaTracciato)).FirstOrDefault()!.NomeTraduzione;
                    }
                    catch
                    {
                        meccDefault = meccDB!.source[0].NomeTraduzione;
                    }

                    if (_ref == null)
                    {
                        if (indice > 0)
                        {
                            if (!automatismo || regole == null)
                            {
                                //controllo se l'indice richiesto è in pagina, se non presente cambio il formato pagina se possibile
                                MenaboPagine? pag = this.ctx2.MenaboPagines.Include(i => i.MenaboRefs).Where(p => p.Id == obj.IdPagina).FirstOrDefault();
                                string[] formato_operator = pag!.Formato!.Split('x');
                                int indiceMax = Convert.ToInt32(formato_operator[0]) * Convert.ToInt32(formato_operator[1]);
                                if (indice > indiceMax) //l'indice richiesto è fuori pagina
                                {
                                    //leggo i formati di pagina esistenti da json
                                    JObject o1 = JObject.Parse(System.IO.File.ReadAllText(this.path_external_source + "SourceMenabo.json"));
                                    List<string>? listaFormati = o1["formatiMenaboPagina"]!.ToObject<List<string>>();
                                    int indexFormato = listaFormati!.IndexOf(pag.Formato);
                                    bool formatoValido = false;
                                    for (int i = indexFormato; i < listaFormati.Count; i++)
                                    {
                                        string[] formato = listaFormati[i].Split('x');
                                        int indiceMaxFormato = Convert.ToInt32(formato[0]) * Convert.ToInt32(formato[1]);
                                        if (indiceMaxFormato >= indice)
                                        {
                                            formatoValido = true;
                                            await Index(idTracciato, pag.Id, pag.IdMastro, listaFormati[i]);
                                            break;
                                        }
                                    }
                                    if (!formatoValido)
                                    {
                                        result.errorCode = ErrorCodes.FormatoIncorretto;
                                        throw new Exception("Non ci sono formati più grandi disponibili");
                                    }
                                }
                                _ref = new MenaboRef();
                                _ref.IdPagina = obj.IdPagina;
                                if (obj.IdRecord > 0)
                                {
                                    _ref.IdRecord = obj.IdRecord;
                                    //this.ctx2.PromoTracciatiRecords.Find(obj.IdRecord).SelezioneMenabo = (Byte)TipoSelezioneMenabo.Primaria;
                                }
                                else
                                {
                                    _ref.CodiceGruppo = obj.CodiceGruppo;
                                }
                                if (await this.ctx2.MenaboRefs.Where(mp => mp.Id != _ref.Id && mp.IdPagina == obj.IdPagina && mp.Indice == indice).FirstOrDefaultAsync() == null)
                                {
                                    List<int> listIndexTaken = new(); //creo la lista di indici in cui salvare gli indici occupati
                                    foreach (MenaboRef mRef in pag.MenaboRefs)
                                    {
                                        IActionResult? formatoDaEstrarre = null;
                                        formatoDaEstrarre = await getFormato(mRef.Formato!); //il formato in realtà è la meccanica
                                        string formato = "1x1";
                                        if (formatoDaEstrarre is OkObjectResult)
                                        {
                                            var okResult = formatoDaEstrarre as OkObjectResult;
                                            if (okResult!.Value is string)
                                            {
                                                formato = (okResult.Value as string)!;
                                            }

                                        }
                                        List<int> indexOccupati = CalcolaSpazi(pag.Formato, mRef.Indice, formato);
                                        if (indexOccupati == null || indexOccupati.Count == 0)
                                        {
                                            result.errorCode = ErrorCodes.Generic;
                                            throw new Exception("Dati errati");
                                        }
                                        listIndexTaken.AddRange(indexOccupati);
                                    }
                                    if (listIndexTaken.Contains(indice))
                                    {
                                        result.errorCode = ErrorCodes.IndiceGiàOccupatoInMenabò;
                                        throw new Exception("Non è possibile inserire a tale indice");
                                    }
                                }

                                _ref.Indice = indice;
                                _ref.Formato = meccDefault;// "1x1";
                                _ref.IdPaginaNavigation = this.ctx2.MenaboPagines.Find(_ref.IdPagina)!;
                                this.ctx2.MenaboRefs.Add(_ref);
                                this.ctx2.SaveChanges();
                                if (await this.ctx2.MenaboRefs.Where(mp => mp.Id != _ref.Id && mp.IdPagina == obj.IdPagina && mp.Indice == indice).FirstOrDefaultAsync() != null)
                                {
                                    string codiceMultiplexAggiunto = await AggiungiMultiplex(obj.IdPagina, _ref.Indice, (obj.IdRecord > 0 ? obj.IdRecord.ToString() : obj.CodiceGruppo)!, idTracciato);
                                    string key_codice_multiplex = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppoMultiplex;
                                    string idOrCod = (obj.IdRecord > 0 ? obj.IdRecord.ToString() : obj.CodiceGruppo)!;
                                    bool isGruppo = idOrCod.Contains(",");
                                    List<MenaboRef> refDaModificare = await this.ctx2.MenaboRefs.Where(p => p.IdPagina == obj.IdPagina && p.Indice == obj.Indice || (isGruppo ? p.CodiceGruppo == idOrCod : p.IdRecord == Int64.Parse(idOrCod))).ToListAsync();

                                    PromoTracciatiRecord? record = await this.ctx2.PromoTracciatiRecords.Where(p => (refDaModificare[0].CodiceGruppo != null ? p.CodiceGruppo == refDaModificare[0].CodiceGruppo : p.Id == refDaModificare[0].IdRecord)).FirstOrDefaultAsync();


                                    Dictionary<string, object>? Dato = JsonConvert.DeserializeObject<Dictionary<string, object>>(record!.Dato!);
                                    if (codiceMultiplexAggiunto != "" && codiceMultiplexAggiunto != null)
                                    {
                                        resultMultiplex.codiceMultiplexAggiunto = codiceMultiplexAggiunto; //Dato[key_codice_multiplex].ToString();
                                    }
                                    foreach (MenaboRef r in refDaModificare)
                                    {
                                        if (r.CodiceGruppo != null)
                                        {
                                            resultMultiplex.codiciRefdaAggiungere!.Add(r.CodiceGruppo);
                                        }
                                        else
                                        {
                                            resultMultiplex.codiciRefdaAggiungere!.Add(r.IdRecord.ToString()!);
                                        }
                                    }

                                    this.ctx2.SaveChanges();
                                }

                                resultMultiplex.Ref.Selezione = _ref.Selezione;
                                resultMultiplex.Ref.CodiceGruppo = _ref.CodiceGruppo;
                                resultMultiplex.Ref.Indice = _ref.Indice;
                                resultMultiplex.Ref.Formato = _ref.Formato;
                                resultMultiplex.Ref.Id = _ref.Id;
                                resultMultiplex.Ref.IdPagina = _ref.IdPagina;
                                resultMultiplex.Ref.IdRecord = _ref.IdRecord;
                                resultMultiplex.Ref.IdPaginaNavigation = _ref.IdPaginaNavigation;
                                return Ok(resultMultiplex);
                            }
                            else
                            {
                                IActionResult? formatoRes = null;
                                formatoRes = await getFormato(regole.meccanica!);
                                string formatoRichiesto = "";
                                if (formatoRes is OkObjectResult && (formatoRes as OkObjectResult)!.Value is string)
                                {
                                    formatoRichiesto = (formatoRes as OkObjectResult)!.Value!.ToString()!;
                                }
                                //controllo se l'indice richiesto è in pagina, se non presente cambio il formato pagina se possibile
                                MenaboPagine? pag = this.ctx2.MenaboPagines.Include(i => i.MenaboRefs).Where(p => p.Id == obj.IdPagina).FirstOrDefault();
                                string[] formato_operator = pag!.Formato!.Split('x');
                                int indiceMax = Convert.ToInt32(formato_operator[0]) * Convert.ToInt32(formato_operator[1]);
                                if (indice > indiceMax) //l'indice richiesto è fuori pagina
                                {
                                    if (regole.indicePreciso)
                                    {
                                        if (formatoRichiesto == "1x1")
                                        {
                                            //leggo i formati di pagina esistenti da json
                                            JObject o1 = JObject.Parse(System.IO.File.ReadAllText(this.path_external_source + "SourceMenabo.json"));
                                            List<string>? listaFormati = o1["formatiMenaboPagina"]!.ToObject<List<string>>();
                                            int indexFormato = listaFormati!.IndexOf(pag.Formato);
                                            bool formatoValido = false;
                                            for (int i = indexFormato; i < listaFormati.Count; i++)
                                            {
                                                string[] formato = listaFormati[i].Split('x');
                                                int indiceMaxFormato = Convert.ToInt32(formato[0]) * Convert.ToInt32(formato[1]);
                                                if (indiceMaxFormato >= indice)
                                                {
                                                    formatoValido = true;
                                                    await Index(idTracciato, pag.Id, pag.IdMastro, listaFormati[i]);
                                                    break;
                                                }
                                            }
                                            if (!formatoValido)
                                            {
                                                result.errorCode = ErrorCodes.FormatoIncorretto;
                                                throw new Exception("Non ci sono formati più grandi disponibili");
                                            }
                                        }
                                        else
                                        {
                                            //leggo i formati di pagina esistenti da json
                                            JObject o1 = JObject.Parse(System.IO.File.ReadAllText(this.path_external_source + "SourceMenabo.json"));
                                            string currentFormato = pag.Formato;
                                            string[] formato = currentFormato.Split('x');
                                            int indiceMaxFormato = Convert.ToInt32(formato[0]) * Convert.ToInt32(formato[1]);
                                            if (indiceMaxFormato < indice)
                                            {
                                                result.errorCode = ErrorCodes.FormatoIncorretto;
                                                throw new Exception("Non ci sono formati più grandi disponibili");
                                            }
                                        }

                                    }
                                    else
                                    {
                                        //Ok verifichaimo se ci sono posti liberi
                                        List<int> listIndexTaken = new(); //creo la lista di indici in cui salvare gli indici occupati
                                        for (int i = 0; i < indice; i++)
                                        {
                                            listIndexTaken.Add(i);
                                        }
                                        foreach (MenaboRef mRef in pag.MenaboRefs)
                                        {
                                            if (!listIndexTaken.Contains(mRef.Indice))
                                            {
                                                listIndexTaken.Add(mRef.Indice);
                                            }
                                        }
                                        int nSpazi = Int32.Parse(formato_operator[0]) * Int32.Parse(formato_operator[1]);
                                        int spaziOccupati = listIndexTaken.Count();
                                        if (spaziOccupati < nSpazi)
                                        {

                                            //Ricerca del primo indice utile

                                            List<int> lista1 = Enumerable.Range(1, nSpazi).ToList();

                                            lista1.RemoveAll(numero => listIndexTaken.Contains(numero));
                                            Int16 indice_disponibile;
                                            try
                                            {
                                                indice_disponibile = (Int16)lista1[0];
                                            }
                                            catch
                                            {
                                                indice_disponibile = 0;
                                            }

                                            if (indice_disponibile > 0)
                                            {
                                                //Inserisco la referenza
                                                _ref = new MenaboRef();
                                                _ref.IdPagina = obj.IdPagina;
                                                if (obj.IdRecord > 0)
                                                {
                                                    _ref.IdRecord = obj.IdRecord;
                                                    //this.ctx2.PromoTracciatiRecords.Find(obj.IdRecord).SelezioneMenabo = (Byte)TipoSelezioneMenabo.Primaria;
                                                }
                                                else
                                                {
                                                    _ref.CodiceGruppo = obj.CodiceGruppo;
                                                }
                                                indice = indice_disponibile;
                                            }
                                            else
                                            {
                                                result.errorCode = ErrorCodes.SpazioInsufficienteInMenabò;
                                                throw new Exception("Indice disponibile non trovato");
                                            }
                                        }
                                        else
                                        {

                                            if (regole.formatoPagina != "0")
                                            {
                                                JObject o1 = JObject.Parse(System.IO.File.ReadAllText(this.path_external_source + "SourceMenabo.json"));
                                                List<string>? listaFormati = o1["formatiMenaboPagina"]!.ToObject<List<string>>();
                                                int indexFormato = listaFormati!.IndexOf(pag.Formato);
                                                int maxFormatoConsentito = listaFormati.IndexOf(regole.formatoPagina!);
                                                bool formatoValido = false;
                                                for (int i = indexFormato + 1; i <= maxFormatoConsentito; i++)
                                                {
                                                    string[] formato = listaFormati[i].Split('x');
                                                    int indiceMaxFormato = Convert.ToInt32(formato[0]) * Convert.ToInt32(formato[1]);
                                                    if (indiceMaxFormato >= indice)
                                                    {
                                                        formatoValido = true;
                                                        await Index(idTracciato, pag.Id, pag.IdMastro, listaFormati[i]);
                                                        break;
                                                    }
                                                }
                                                if (!formatoValido)
                                                {
                                                    result.errorCode = ErrorCodes.SpazioInsufficienteInMenabò;
                                                    throw new Exception("Non ci sono posti disponibili");
                                                }
                                                else
                                                {
                                                    var res = await inMenabo(obj, onoff, idTracciato, areaTracciato, indice, automatismo, regole);
                                                    return res;
                                                }
                                            }
                                            else
                                            {
                                                result.errorCode = ErrorCodes.SpazioInsufficienteInMenabò;
                                                throw new Exception("Non ci sono posti disponibili");
                                            }
                                        }
                                    }
                                }
                                _ref = new MenaboRef();
                                _ref.IdPagina = obj.IdPagina;
                                if (obj.IdRecord > 0)
                                {
                                    _ref.IdRecord = obj.IdRecord;
                                    //this.ctx2.PromoTracciatiRecords.Find(obj.IdRecord).SelezioneMenabo = (Byte)TipoSelezioneMenabo.Primaria;
                                }
                                else
                                {
                                    _ref.CodiceGruppo = obj.CodiceGruppo;
                                }



                                //Ok verifichaimo se ci sono posti liberi

                                List<int> listIndexTakenSecondControl = new(); //creo la lista di indici in cui salvare gli indici occupati
                                for (int i = 1; i < indice; i++)
                                {
                                    listIndexTakenSecondControl.Add(i);
                                }
                                foreach (MenaboRef mRef in pag.MenaboRefs)
                                {
                                    IActionResult? formatoDaEstrarre = null;
                                    formatoDaEstrarre = await getFormato(mRef.Formato!); //il formato in realtà è la meccanica
                                    string formato = "1x1";
                                    if (formatoDaEstrarre is OkObjectResult)
                                    {
                                        var okResult = formatoDaEstrarre as OkObjectResult;
                                        if (okResult!.Value is string)
                                        {
                                            formato = (okResult.Value as string)!;
                                        }

                                    }
                                    List<int> indexOccupati = CalcolaSpazi(pag.Formato, mRef.Indice, formato);
                                    if (indexOccupati == null || indexOccupati.Count == 0)
                                    {
                                        result.errorCode = ErrorCodes.Generic;
                                        throw new Exception("Dati errati");
                                    }
                                    listIndexTakenSecondControl.AddRange(indexOccupati);
                                }
                                listIndexTakenSecondControl = listIndexTakenSecondControl.Distinct().ToList();

                                int nSpaziSecondControl = Int32.Parse(formato_operator[0]) * Int32.Parse(formato_operator[1]);
                                int spaziOccupatiSecondControl = listIndexTakenSecondControl.Count();
                                if (spaziOccupatiSecondControl < nSpaziSecondControl)
                                {
                                    if (regole.indicePreciso && listIndexTakenSecondControl.Contains(regole.indice))
                                    {
                                        result.errorCode = ErrorCodes.IndiceGiàOccupatoInMenabò;
                                        throw new Exception("Indice richiesto già occupato");
                                    }
                                    //Ricerca del primo indice utile

                                    List<int> lista1 = Enumerable.Range(1, nSpaziSecondControl).ToList();

                                    lista1.RemoveAll(numero => listIndexTakenSecondControl.Contains(numero));
                                    Int16 indice_disponibile = 0;
                                    try
                                    {
                                        foreach (var item in lista1)
                                        {
                                            if (regole.indicePreciso && regole.indice != indice)
                                            {
                                                continue;
                                            }
                                            List<int> indiciRichiesti = CalcolaSpazi(pag.Formato, item, formatoRichiesto);
                                            if (indiciRichiesti.Count > 0 && indiciRichiesti.All(f => lista1.Contains(f)))
                                            {
                                                indice_disponibile = (Int16)item;
                                                break;
                                            }
                                        }
                                    }
                                    catch
                                    {
                                        indice_disponibile = 0;
                                    }

                                    if (indice_disponibile > 0)
                                    {
                                        //Inserisco la referenza
                                        _ref = new MenaboRef();
                                        _ref.IdPagina = obj.IdPagina;
                                        if (obj.IdRecord > 0)
                                        {
                                            _ref.IdRecord = obj.IdRecord;
                                            //this.ctx2.PromoTracciatiRecords.Find(obj.IdRecord).SelezioneMenabo = (Byte)TipoSelezioneMenabo.Primaria;
                                        }
                                        else
                                        {
                                            _ref.CodiceGruppo = obj.CodiceGruppo;
                                        }
                                        indice = indice_disponibile;
                                    }
                                    else
                                    {
                                        result.errorCode = ErrorCodes.SpazioInsufficienteInMenabò;
                                        throw new Exception("Indice disponibile non trovato");
                                    }





                                    _ref.Indice = indice;
                                    _ref.Formato = meccDefault;// "1x1";
                                    _ref.IdPaginaNavigation = this.ctx2.MenaboPagines.Find(_ref.IdPagina)!;
                                    if (await this.ctx2.MenaboRefs.Where(mp => mp.Id != _ref.Id && mp.IdPagina == obj.IdPagina && mp.Indice == indice).FirstOrDefaultAsync() != null)
                                    {
                                        result.errorCode = ErrorCodes.IndiceGiàOccupatoInMenabò;
                                        throw new Exception("Indice già occupato");

                                    }
                                    this.ctx2.MenaboRefs.Add(_ref);
                                    this.ctx2.SaveChanges();
                                    resultMultiplex.Ref.Selezione = _ref.Selezione;
                                    resultMultiplex.Ref.CodiceGruppo = _ref.CodiceGruppo;
                                    resultMultiplex.Ref.Indice = _ref.Indice;
                                    resultMultiplex.Ref.Formato = _ref.Formato;
                                    resultMultiplex.Ref.Id = _ref.Id;
                                    resultMultiplex.Ref.IdPagina = _ref.IdPagina;
                                    resultMultiplex.Ref.IdRecord = _ref.IdRecord;
                                    resultMultiplex.Ref.IdPaginaNavigation = _ref.IdPaginaNavigation;

                                    return Ok(resultMultiplex);
                                }
                                else
                                {
                                    result.errorCode = ErrorCodes.SpazioInsufficienteInMenabò;
                                    throw new Exception("Spazio insufficiente in menabò");
                                }
                            }
                        }
                        else
                        {
                            if (automatismo && regole != null && regole.indicePreciso)
                            {
                                result.errorCode = ErrorCodes.Generic;
                                throw new Exception("Dati errati");
                            }
                            string formatoRichiesto = "1x1";
                            if (regole!.meccanica != null)
                            {
                                IActionResult? formatoRes = null;
                                formatoRes = await getFormato(regole.meccanica);
                                if (formatoRes is OkObjectResult && (formatoRes as OkObjectResult)!.Value is string)
                                {
                                    formatoRichiesto = (formatoRes as OkObjectResult)!.Value!.ToString()!;
                                }
                            }

                            //Ok verifichaimo se ci sono posti liberi
                            MenaboPagine? pag = this.ctx2.MenaboPagines.Include(i => i.MenaboRefs).Where(p => p.Id == obj.IdPagina).FirstOrDefault();
                            string[] formato_operator = pag!.Formato!.Split('x');
                            List<int> listIndexTaken = new(); //creo la lista di indici in cui salvare gli indici occupati
                            foreach (MenaboRef mRef in pag.MenaboRefs)
                            {
                                IActionResult? formatoDaEstrarre = null;
                                formatoDaEstrarre = await getFormato(mRef.Formato!); //il formato in realtà è la meccanica
                                string formato = "1x1";
                                if (formatoDaEstrarre is OkObjectResult)
                                {
                                    var okResult = formatoDaEstrarre as OkObjectResult;
                                    if (okResult!.Value is string)
                                    {
                                        formato = (okResult.Value as string)!;
                                    }

                                }
                                List<int> indexOccupati = CalcolaSpazi(pag.Formato, mRef.Indice, formato);
                                if (indexOccupati == null || indexOccupati.Count == 0)
                                {
                                    result.errorCode = ErrorCodes.Generic;
                                    throw new Exception("Dati errati");
                                }
                                listIndexTaken.AddRange(indexOccupati);
                            }
                            int nSpazi = Int32.Parse(formato_operator[0]) * Int32.Parse(formato_operator[1]);
                            int spaziOccupati = listIndexTaken.Count();
                            if (spaziOccupati < nSpazi)
                            {

                                //Ricerca del primo indice utile

                                List<int> lista1 = Enumerable.Range(1, nSpazi).ToList();

                                lista1.RemoveAll(numero => listIndexTaken.Contains(numero));
                                Int16 indice_disponibile = 0;
                                try
                                {
                                    foreach (var item in lista1)
                                    {
                                        List<int> indiciRichiesti = CalcolaSpazi(pag.Formato, item, formatoRichiesto);
                                        if (indiciRichiesti.Count > 0 && indiciRichiesti.All(f => lista1.Contains(f)))
                                        {
                                            indice_disponibile = (Int16)item;
                                            break;
                                        }
                                    }
                                }
                                catch
                                {
                                    indice_disponibile = 0;
                                }

                                if (indice_disponibile > 0)
                                {
                                    //Inserisco la referenza
                                    _ref = new MenaboRef();
                                    _ref.IdPagina = obj.IdPagina;
                                    if (obj.IdRecord > 0)
                                    {
                                        _ref.IdRecord = obj.IdRecord;
                                        //this.ctx2.PromoTracciatiRecords.Find(obj.IdRecord).SelezioneMenabo = (Byte)TipoSelezioneMenabo.Primaria;
                                    }
                                    else
                                    {
                                        _ref.CodiceGruppo = obj.CodiceGruppo;
                                    }
                                    _ref.Indice = indice_disponibile;
                                    _ref.Formato = meccDefault;// "1x1";
                                    this.ctx2.MenaboRefs.Add(_ref);
                                    this.ctx2.SaveChanges();
                                    resultMultiplex.Ref.Selezione = _ref.Selezione;
                                    resultMultiplex.Ref.CodiceGruppo = _ref.CodiceGruppo;
                                    resultMultiplex.Ref.Indice = _ref.Indice;
                                    resultMultiplex.Ref.Formato = _ref.Formato;
                                    resultMultiplex.Ref.Id = _ref.Id;
                                    resultMultiplex.Ref.IdPagina = _ref.IdPagina;
                                    resultMultiplex.Ref.IdRecord = _ref.IdRecord;
                                    resultMultiplex.Ref.IdPaginaNavigation = _ref.IdPaginaNavigation;

                                    return Ok(resultMultiplex);
                                }
                                else
                                {
                                    result.errorCode = ErrorCodes.SpazioInsufficienteInMenabò;
                                    throw new Exception("Indice disponibile non trovato");
                                }
                            }
                            else
                            {
                                if (automatismo && regole != null)
                                {
                                    if (regole.formatoPagina != "0")
                                    {
                                        JObject o1 = JObject.Parse(System.IO.File.ReadAllText(this.path_external_source + "SourceMenabo.json"));
                                        List<string>? listaFormati = o1["formatiMenaboPagina"]!.ToObject<List<string>>();
                                        int indexFormato = listaFormati!.IndexOf(pag.Formato);
                                        int maxFormatoConsentito = listaFormati.IndexOf(regole.formatoPagina!);
                                        bool formatoValido = false;
                                        for (int i = indexFormato + 1; i <= maxFormatoConsentito; i++)
                                        {
                                            string[] formato = listaFormati[i].Split('x');
                                            int indiceMaxFormato = Convert.ToInt32(formato[0]) * Convert.ToInt32(formato[1]);
                                            if (indiceMaxFormato >= indice)
                                            {
                                                formatoValido = true;
                                                await Index(idTracciato, pag.Id, pag.IdMastro, listaFormati[i]);
                                                break;
                                            }
                                        }
                                        if (!formatoValido)
                                        {
                                            result.errorCode = ErrorCodes.SpazioInsufficienteInMenabò;
                                            throw new Exception("Non ci sono posti disponibili");
                                        }
                                        else
                                        {
                                            var res = await inMenabo(obj, onoff, idTracciato, areaTracciato, indice, automatismo, regole);
                                            return res;
                                        }
                                    }
                                    else
                                    {
                                        result.errorCode = ErrorCodes.SpazioInsufficienteInMenabò;
                                        throw new Exception("Non ci sono posti disponibili");
                                    }
                                }
                                else
                                {
                                    result.errorCode = ErrorCodes.SpazioInsufficienteInMenabò;
                                    throw new Exception("Non ci sono posti disponibili");
                                }
                            }
                        }
                    }
                    else
                    {
                        result.errorCode = ErrorCodes.ReferenzaImpaginata;
                        throw new Exception("Referenza già presente in menabo");
                    }
                }
                else
                {
                    if (_ref != null)
                    {
                        await RimuoviMultiplex(obj.IdPagina, _ref.Indice, (obj.IdRecord > 0 ? obj.IdRecord.ToString() : obj.CodiceGruppo)!, idTracciato);
                        resultMultiplex.codiceMultiplexRimossi = "";

                        if (await this.ctx2.MenaboRefs.Where(mp => mp.Id != _ref.Id && mp.IdPagina == obj.IdPagina && mp.Indice == _ref.Indice).FirstOrDefaultAsync() != null)
                        {
                            string key_codice_multiplex = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppoMultiplex;
                            List<MenaboRef> refDaModificare = await this.ctx2.MenaboRefs.Where(p => p.Id != _ref.Id && p.IdPagina == obj.IdPagina && p.Indice == _ref.Indice).ToListAsync();

                            var _frItem = refDaModificare.FirstOrDefault();
                            PromoTracciatiRecord? record = await this.ctx2.PromoTracciatiRecords.Where(p => (_frItem!.CodiceGruppo != null ? p.CodiceGruppo == _frItem.CodiceGruppo : p.Id == _frItem.IdRecord)).FirstOrDefaultAsync();

                            Dictionary<string, object>? Dato = JsonConvert.DeserializeObject<Dictionary<string, object>>(record!.Dato!);
                            if (Dato!.ContainsKey(key_codice_multiplex))
                            {
                                resultMultiplex.codiceMultiplexRimossi = Dato[key_codice_multiplex].ToString();
                            }
                            else
                            {
                                resultMultiplex.codiceMultiplexRimossi = "";
                            }

                            foreach (MenaboRef r in refDaModificare)
                            {
                                if (r.CodiceGruppo != null)
                                {
                                    resultMultiplex.codiciRefdaRimuovere!.Add(r.CodiceGruppo);
                                }
                                else
                                {
                                    resultMultiplex.codiciRefdaRimuovere!.Add(r.IdRecord.ToString()!);
                                }
                            }

                        }
                        resultMultiplex.Ref.Selezione = _ref.Selezione;
                        resultMultiplex.Ref.CodiceGruppo = _ref.CodiceGruppo;
                        resultMultiplex.Ref.Indice = _ref.Indice;
                        resultMultiplex.Ref.Formato = _ref.Formato!;
                        resultMultiplex.Ref.Id = _ref.Id;
                        resultMultiplex.Ref.IdPagina = _ref.IdPagina;
                        resultMultiplex.Ref.IdRecord = _ref.IdRecord;
                        resultMultiplex.Ref.IdPaginaNavigation = _ref.IdPaginaNavigation;

                        //Ok procedo alla rimozione
                        this.ctx2.MenaboRefs.Remove(_ref);
                        this.ctx2.SaveChanges();

                        result.error = "";
                        result.Esito = true;

                        return Ok(resultMultiplex);
                    }
                    else
                    {
                        throw new Exception("Referenza non trovata in impaginato");
                    }
                }
            }
            catch (Exception ex)
            {
                result.error = ex.Message;
            }

            return Ok(result);
        }


        public ArticoloInRevisione IdentificaArticoloInRevisione(int idTracciato, string codice, bool setRefToNull = false)
        {
            try
            {
                string key_codice_gruppo = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppo;
                string keyCodiceRef = Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice;
                string primoCodice = "";
                if (codice.Contains(","))
                {
                    primoCodice = codice.Split(",")[0];
                }
                PromoTracciatiRecord? record = this.ctx2.PromoTracciatiRecords.Where(t => t.IdTracciato == idTracciato && (codice.Contains(",") ? t.Codice == primoCodice : t.Codice == codice)).FirstOrDefault();

                var tracciatoSingolo = new
                {
                    Dato = IstantaJson.getJsonObject(record!.Dato!),
                    Id = record.Id,
                    //StatoSelezione = record.SelezioneMenabo,
                    HasFoto = (returnHasFoto(IstantaJson.getJsonObject(record.Dato!)) ? AskFoto.FotoPresente : AskFoto.FotoNonPresente),
                    Label = record.Label
                };


                ArticoloInRevisione item = new ArticoloInRevisione();

                item.recordInTracciato = tracciatoSingolo.Dato;
                if (!codice.Contains(","))
                {
                    Articoli? artItem = this.ctx.Articolis.Include(i => i.ArticoliDescrizionis).Where(r => r.Codice == tracciatoSingolo.Dato[keyCodiceRef].ToString()).FirstOrDefault();
                    if (artItem != null)
                    {
                        item.recordRevisionato = artItem.ArticoliDescrizionis!.OrderByDescending(o => o.DataUltimaRicezione).FirstOrDefault()!;
                    }
                }
                else
                {
                    item.recordRevisionato = this.ctx.ArticoliDescrizionis.Where(f => f.CodiceGruppo == codice).FirstOrDefault()!;
                }

                item.isGruppo = codice.Contains(",");
                item.isObsoleto = false;
                item.idRec = tracciatoSingolo.Id;
                item.hasFoto = (Byte)tracciatoSingolo.HasFoto;
                item.label = tracciatoSingolo.Label!;
                ArticoloImpaginato? artImp = new ArticoloImpaginato();
                var recordImp = this.ctx2.MenaboRefs.Include(f => f.IdPaginaNavigation).Where(f => (codice.Contains(",") ? f.CodiceGruppo == codice : f.IdRecord == tracciatoSingolo.Id) && f.IdPaginaNavigation.IdTracciato == idTracciato).FirstOrDefault();
                if (recordImp != null)
                {
                    artImp.CodiceGruppo = recordImp.CodiceGruppo;
                    artImp.IdRecord = recordImp.IdRecord;
                    artImp.IdPagina = recordImp.IdPaginaNavigation.Id;
                    artImp.IdPaginaNavigation = recordImp.IdPaginaNavigation;
                    artImp.Indice = recordImp.Indice;
                }
                else
                {
                    artImp = null;
                }

                item.recordImpaginato = (setRefToNull ? null : artImp);
                item = Etichettatura(item);
                return item;
            }
            catch (Exception ex)
            {
                ex.ToString();
                return new ArticoloInRevisione();
            }

        }


        public RecordPostControlloMeccaniche IdentificaMeccanicaRecord(int idTracciato, MenaboRef refRecord, DbDeclinazioneMeccaniche? meccDB = null, bool setRefToNull = false)
        {
            string key_codice_gruppo = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppo;
            string keyCodiceRef = Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice;
            string primoCodice = "";
            if (refRecord.CodiceGruppo != null)
            {
                primoCodice = refRecord.CodiceGruppo.Split(",")[0];
            }
            PromoTracciatiRecord? record = this.ctx2.PromoTracciatiRecords.Where(t => t.IdTracciato == idTracciato && (refRecord.CodiceGruppo != null ? t.Codice == primoCodice : t.Id == refRecord.IdRecord)).FirstOrDefault();

            var tracciatoSingolo = new
            {
                Dato = IstantaJson.getJsonObject(record!.Dato!),
                Id = record.Id,
                //StatoSelezione = record.SelezioneMenabo,
                HasFoto = (returnHasFoto(IstantaJson.getJsonObject(record.Dato!)) ? AskFoto.FotoPresente : AskFoto.FotoNonPresente),
                Label = record.Label
            };


            ArticoloInRevisione item = new ArticoloInRevisione();

            item.recordInTracciato = tracciatoSingolo.Dato;
            if (refRecord.CodiceGruppo == null)
            {
                Articoli? artItem = this.ctx.Articolis.Include(i => i.ArticoliDescrizionis).Where(r => r.Codice == tracciatoSingolo.Dato[keyCodiceRef].ToString()).FirstOrDefault();
                if (artItem != null)
                {
                    item.recordRevisionato = artItem.ArticoliDescrizionis!.OrderByDescending(o => o.DataUltimaRicezione).FirstOrDefault()!;
                }
            }
            else
            {
                item.recordRevisionato = this.ctx.ArticoliDescrizionis.Where(f => f.CodiceGruppo == refRecord.CodiceGruppo).FirstOrDefault()!;
            }

            item.isGruppo = refRecord.CodiceGruppo != null;
            item.isObsoleto = false;
            item.idRec = tracciatoSingolo.Id;
            item.hasFoto = (Byte)tracciatoSingolo.HasFoto;
            item.label = tracciatoSingolo.Label!;
            ArticoloImpaginato artImp = new ArticoloImpaginato();
            artImp.CodiceGruppo = refRecord.CodiceGruppo;
            artImp.IdRecord = refRecord.IdRecord;
            artImp.IdPagina = refRecord.IdPagina;
            artImp.IdPaginaNavigation = this.ctx2.MenaboPagines.Where(f => f.Id == artImp.IdPagina).FirstOrDefault()!;
            artImp.Indice = refRecord.Indice;
            item.recordImpaginato = (setRefToNull ? null : artImp);
            item = Etichettatura(item);

            if (meccDB == null)
            {
                JObject oDeclMecc = JObject.Parse(System.IO.File.ReadAllText(this.path_external_source + "SourceDeclinazioneMeccaniche.json"));
                meccDB = oDeclMecc.ToObject<DbDeclinazioneMeccaniche>();
            }
            List<MeccanicheLivello> listaMeccanichePerLivello = new List<MeccanicheLivello>();
            if (meccDB != null)
            {
                var meccRaggruppate = meccDB.source.OrderBy(o => o.Livello).GroupBy(s => s.Livello);
                foreach (var gruppoLivello in meccRaggruppate)
                {
                    MeccanicheLivello meccanicheLivello = new MeccanicheLivello(gruppoLivello.Key);
                    foreach (var declMeccanica in gruppoLivello)
                    {
                        if (declMeccanica.Regole != null)
                        {
                            foreach (var setRegole in declMeccanica.Regole)
                            {
                                if (setRegole != null)
                                {
                                    bool setValido = true;
                                    foreach (var regola in setRegole)
                                    {
                                        if ((!item.allEtichette!.Contains(regola.nomeEtichetta) && regola.presente) || (item.allEtichette.Contains(regola.nomeEtichetta) && !regola.presente))
                                        {
                                            setValido = false;
                                            break;

                                        }
                                    }
                                    if (setValido)
                                    {
                                        meccanicheLivello.Meccaniche.Add(declMeccanica);
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    if (meccanicheLivello.Meccaniche.Count > 0)
                    {
                        listaMeccanichePerLivello.Add(meccanicheLivello);
                    }
                    else
                    {
                        DeclinazioneMeccanica? meccDefaultLiv = gruppoLivello.Where(f => f.Regole == null).FirstOrDefault();
                        if (meccDefaultLiv != null)
                        {
                            meccanicheLivello.Meccaniche.Add(meccDefaultLiv);
                            listaMeccanichePerLivello.Add(meccanicheLivello);
                        }
                        else
                        {
                            listaMeccanichePerLivello.Add(meccanicheLivello);
                        }
                    }
                }



                // Raggruppa per LivelloEsternoMeccanicaAvanzata
                var meccanicheAvanzateRaggruppate = meccDB.meccanicheAvanzate
                .OrderBy(o => o.LivelloMeccanica)  // Ordina per LivelloMeccanica
                .GroupBy(s => s.LivelloEsternoMeccanicaAvanzata)  // Raggruppa per LivelloEsternoMeccanicaAvanzata
                .Select(outerGroup => new
                {
                    LivelloEsterno = outerGroup.Key,  // Chiave del primo raggruppamento (LivelloEsternoMeccanicaAvanzata)
                    LivelliInterni = outerGroup
                        .GroupBy(inner => inner.LivelloMeccanica)  // Raggruppamento annidato per LivelloMeccanica
                        .Select(innerGroup => new
                        {
                            LivelloMeccanica = innerGroup.Key,  // Chiave del secondo raggruppamento (LivelloMeccanica)
                            Meccaniche = innerGroup.ToList()    // Lista degli elementi all'interno di questo gruppo
                        })
                        .ToList()  // Converti in una lista per avere l'accesso ai gruppi interni
                })
                .ToList();  // Converti in lista il risultato finale


                foreach (var livelloEsterno in meccanicheAvanzateRaggruppate)
                {
                    #region rimozioneMeccanicheBefore
                    // Raggruppa per LivelloEsternoMeccanicaAvanzata
                    var meccanicheInRimozione = meccDB.meccanicheInRimozione.Where(f => f.timeToApply == timeToApplyOperation.applyBefore)
                        .OrderBy(o => o.LivelloMeccanica)  // Ordina per LivelloMeccanica
                        .GroupBy(s => s.LivelloEsternoMeccanicaAvanzata)  // Raggruppa per LivelloEsternoMeccanicaAvanzata
                        .Select(outerGroup => new
                        {
                            LivelloEsterno = outerGroup.Key,  // Chiave del primo raggruppamento (LivelloEsternoMeccanicaAvanzata)
                            LivelliInterni = outerGroup
                                .GroupBy(inner => inner.LivelloMeccanica)  // Raggruppamento annidato per LivelloMeccanica
                                .Select(innerGroup => new
                                {
                                    LivelloMeccanica = innerGroup.Key,  // Chiave del secondo raggruppamento (LivelloMeccanica)
                                    Meccaniche = innerGroup.ToList(),    // Lista degli elementi all'interno di questo gruppo

                                })
                                .ToList()  // Converti in una lista per avere l'accesso ai gruppi interni
                        })
                        .ToList();  // Converti in lista il risultato finale


                    List<RimozioneDeclinazioneMeccanica> listMeccDaRimuovere = new List<RimozioneDeclinazioneMeccanica>();
                    foreach (var livelloEsternoRimozione in meccanicheInRimozione)
                    {
                        foreach (var livelloInterno in livelloEsternoRimozione.LivelliInterni)
                        {
                            foreach (var declMecc in livelloInterno.Meccaniche)
                            {
                                if (declMecc.Regole != null)
                                {
                                    foreach (var setRegole in declMecc.Regole)
                                    {
                                        if (setRegole != null)
                                        {
                                            bool setValido = true;
                                            if (setRegole.regoleEtichetta != null)
                                            {
                                                foreach (var regola in setRegole.regoleEtichetta)
                                                {
                                                    if ((!item.allEtichette!.Contains(regola.nomeEtichetta) && regola.presente) || (item.allEtichette.Contains(regola.nomeEtichetta) && !regola.presente))
                                                    {
                                                        setValido = false;
                                                        break;
                                                    }
                                                }
                                            }
                                            if (setRegole.regoleMeccanica != null)
                                            {
                                                foreach (var regola in setRegole.regoleMeccanica)
                                                {
                                                    //var meccanicheLiv = listaMeccanichePerLivello.Find(f => f.Livello == declMecc.LivelloMeccanica);
                                                    if (regola.idMeccanica > 0 && (regola.nomeMeccanica == null || regola.nomeMeccanica == ""))
                                                    {
                                                        var meccanicheLiv = listaMeccanichePerLivello.Find(f => f.Meccaniche.Find(r => r.Id == (long)regola.idMeccanica) != null);
                                                        if (setRegole.EsclusivitaMeccanicheCoinvolte)
                                                        {
                                                            if (meccanicheLiv!.Meccaniche.Count != setRegole.regoleMeccanica.Where(f => f.presente).Count())
                                                            {
                                                                setValido = false;
                                                                break;
                                                            }
                                                        }

                                                        if ((meccanicheLiv == null && regola.presente)
                                                            || (meccanicheLiv != null && meccanicheLiv.Meccaniche.Find(f => f.Id == (long)regola.idMeccanica) == null && regola.presente)
                                                            || (meccanicheLiv != null && meccanicheLiv.Meccaniche.Find(f => f.Id == (long)regola.idMeccanica) != null && !regola.presente))
                                                        {
                                                            setValido = false;
                                                            break;
                                                        }
                                                    }
                                                    else if (regola.nomeMeccanica != null || regola.nomeMeccanica != "")
                                                    {
                                                        var meccanicheLiv = listaMeccanichePerLivello.Find(f => f.Meccaniche.Find(r => r.Nome == regola.nomeMeccanica) != null);
                                                        if (setRegole.EsclusivitaMeccanicheCoinvolte)
                                                        {
                                                            if (meccanicheLiv!.Meccaniche.Count != setRegole.regoleMeccanica.Where(f => f.presente).Count())
                                                            {
                                                                setValido = false;
                                                                break;
                                                            }
                                                        }

                                                        if ((meccanicheLiv == null && regola.presente)
                                                            || (meccanicheLiv != null && meccanicheLiv.Meccaniche.Find(f => f.Nome == regola.nomeMeccanica) == null && regola.presente)
                                                            || (meccanicheLiv != null && meccanicheLiv.Meccaniche.Find(f => f.Nome == regola.nomeMeccanica) != null && !regola.presente))
                                                        {
                                                            setValido = false;
                                                            break;
                                                        }
                                                    }
                                                }
                                            }
                                            if (setValido)
                                            {
                                                listMeccDaRimuovere.Add(declMecc);
                                                break;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    for (int i = 0; i < listaMeccanichePerLivello.Count; i++)
                    {
                        var listaMecc = listaMeccanichePerLivello[i];
                        for (int i2 = 0; i2 < listaMecc.Meccaniche.Count; i2++)
                        {
                            var mecc = listaMecc.Meccaniche[i2];


                            var found = listMeccDaRimuovere.Find(f => f.LivelloMeccanica == listaMecc.Livello && f.Nome.ToLower() == mecc.Nome.ToLower()) != null;

                            if (found)
                            {
                                listaMecc.Meccaniche.RemoveAt(i2);
                                i2--;
                            }
                        }
                    }

                    #endregion rimozioneMeccanicheBefore

                    List<DeclinazioneMeccanica> meccConCuiSostituire = new List<DeclinazioneMeccanica>();
                    foreach (var livelloInterno in livelloEsterno.LivelliInterni)
                    {
                        DeclinazioneMeccanica meccDaInserire = new DeclinazioneMeccanica();

                        foreach (var declMecc in livelloInterno.Meccaniche)
                        {
                            if (declMecc.Regole != null)
                            {
                                foreach (var setRegole in declMecc.Regole)
                                {
                                    if (setRegole != null)
                                    {
                                        bool setValido = true;
                                        if (setRegole.regoleEtichetta != null)
                                        {
                                            foreach (var regola in setRegole.regoleEtichetta)
                                            {
                                                if ((!item.allEtichette!.Contains(regola.nomeEtichetta) && regola.presente) || (item.allEtichette.Contains(regola.nomeEtichetta) && !regola.presente))
                                                {
                                                    setValido = false;
                                                    break;
                                                }
                                            }
                                        }
                                        if (setRegole.regoleMeccanica != null)
                                        {
                                            foreach (var regola in setRegole.regoleMeccanica)
                                            {
                                                //var meccanicheLiv = listaMeccanichePerLivello.Find(f => f.Livello == declMecc.LivelloMeccanica);
                                                if (regola.idMeccanica > 0)
                                                {
                                                    var meccanicheLiv = listaMeccanichePerLivello.Find(f => f.Meccaniche.Find(r => r.Id == (long)regola.idMeccanica) != null);
                                                    if (setRegole.EsclusivitaMeccanicheCoinvolte)
                                                    {
                                                        if (meccanicheLiv!.Meccaniche.Count != setRegole.regoleMeccanica.Where(f => f.presente).Count())
                                                        {
                                                            setValido = false;
                                                            break;
                                                        }
                                                    }

                                                    if ((meccanicheLiv == null && regola.presente)
                                                        || (meccanicheLiv != null && meccanicheLiv.Meccaniche.Find(f => f.Id == (long)regola.idMeccanica) == null && regola.presente)
                                                        || (meccanicheLiv != null && meccanicheLiv.Meccaniche.Find(f => f.Id == (long)regola.idMeccanica) != null && !regola.presente))
                                                    {
                                                        setValido = false;
                                                        break;
                                                    }
                                                }
                                                else if (regola.idMeccanica < 0) //stiamo chiedendo che il livello sia vuoto
                                                {
                                                    if (regola.presente) //se vogliamo che sia vuoto
                                                    {
                                                        var liv = listaMeccanichePerLivello.Find(f => f.Livello == MathF.Abs(regola.idMeccanica));
                                                        if (liv != null && liv.Meccaniche != null && liv.Meccaniche.Count > 0)
                                                        {
                                                            setValido = false;
                                                            break;

                                                        }
                                                    }
                                                    else //se vogliamo che ci sia almeno un elemento
                                                    {
                                                        var liv = listaMeccanichePerLivello.Find(f => f.Livello == MathF.Abs(regola.idMeccanica));
                                                        if (liv == null || (liv != null && liv.Meccaniche != null && liv.Meccaniche.Count == 0))
                                                        {
                                                            setValido = false;
                                                            break;

                                                        }
                                                    }
                                                }
                                            }
                                        }
                                        if (setValido)
                                        {
                                            meccDaInserire.Formato = declMecc.Formato;
                                            meccDaInserire.Livello = declMecc.LivelloMeccanica;
                                            meccDaInserire.Regole = null;
                                            meccDaInserire.Nome = declMecc.Nome;
                                            meccDaInserire.Id = declMecc.Id;

                                            meccConCuiSostituire.Add(meccDaInserire);
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    }

                    //var meccanicheLivelloCorrispondente = listaMeccanichePerLivello.Find(f => f.Livello == livelloEsterno.LivelloEsterno);

                    for (int i = 0; i < listaMeccanichePerLivello.Count; i++)
                    {
                        var meccanicheLivelloCorrispondente = listaMeccanichePerLivello[i];
                        if (meccConCuiSostituire.Find(f => f.Livello == meccanicheLivelloCorrispondente.Livello) != null)
                        {
                            meccanicheLivelloCorrispondente.Meccaniche = meccConCuiSostituire.Where(f => f.Livello == meccanicheLivelloCorrispondente.Livello).ToList();
                        }
                    }

                    var meccanicheDiLivelliInesistenti = meccConCuiSostituire.Where(f => listaMeccanichePerLivello.Find(g => g.Livello == f.Livello) == null).ToList();
                    var gruppiLivelloMeccanicheInesistenti = meccanicheDiLivelliInesistenti.GroupBy(f => f.Livello);
                    foreach (var gruppoLivello in gruppiLivelloMeccanicheInesistenti)
                    {
                        MeccanicheLivello nuovoLivello = new MeccanicheLivello(gruppoLivello.Key);

                        foreach (var decl in gruppoLivello)
                        {
                            nuovoLivello.Meccaniche.Add(decl);
                        }

                        listaMeccanichePerLivello.Add(nuovoLivello);
                    }

                    //if (meccanicheLivelloCorrispondente != null && meccConCuiSostituire.Count > 0)
                    //{
                    //    meccanicheLivelloCorrispondente.Meccaniche = meccConCuiSostituire;
                    //}
                    //else if (meccanicheLivelloCorrispondente == null && meccConCuiSostituire.Count > 0)
                    //{
                    //    MeccanicheLivello nuovoLivello = new MeccanicheLivello(livelloEsterno.LivelliInterni[0].LivelloMeccanica);
                    //    nuovoLivello.Meccaniche = meccConCuiSostituire;
                    //    listaMeccanichePerLivello.Add(nuovoLivello);
                    //}

                    #region rimozioneMeccaniche
                    // Raggruppa per LivelloEsternoMeccanicaAvanzata
                    meccanicheInRimozione = meccDB.meccanicheInRimozione.Where(f => f.timeToApply == timeToApplyOperation.applyAfter)
                        .OrderBy(o => o.LivelloMeccanica)  // Ordina per LivelloMeccanica
                        .GroupBy(s => s.LivelloEsternoMeccanicaAvanzata)  // Raggruppa per LivelloEsternoMeccanicaAvanzata
                        .Select(outerGroup => new
                        {
                            LivelloEsterno = outerGroup.Key,  // Chiave del primo raggruppamento (LivelloEsternoMeccanicaAvanzata)
                            LivelliInterni = outerGroup
                                .GroupBy(inner => inner.LivelloMeccanica)  // Raggruppamento annidato per LivelloMeccanica
                                .Select(innerGroup => new
                                {
                                    LivelloMeccanica = innerGroup.Key,  // Chiave del secondo raggruppamento (LivelloMeccanica)
                                    Meccaniche = innerGroup.ToList(),    // Lista degli elementi all'interno di questo gruppo

                                })
                                .ToList()  // Converti in una lista per avere l'accesso ai gruppi interni
                        })
                        .ToList();  // Converti in lista il risultato finale


                    listMeccDaRimuovere = new List<RimozioneDeclinazioneMeccanica>();
                    foreach (var livelloEsternoRimozione in meccanicheInRimozione)
                    {
                        foreach (var livelloInterno in livelloEsternoRimozione.LivelliInterni)
                        {
                            foreach (var declMecc in livelloInterno.Meccaniche)
                            {
                                if (declMecc.Regole != null)
                                {
                                    foreach (var setRegole in declMecc.Regole)
                                    {
                                        if (setRegole != null)
                                        {
                                            bool setValido = true;
                                            if (setRegole.regoleEtichetta != null)
                                            {
                                                foreach (var regola in setRegole.regoleEtichetta)
                                                {
                                                    if ((!item.allEtichette!.Contains(regola.nomeEtichetta) && regola.presente) || (item.allEtichette.Contains(regola.nomeEtichetta) && !regola.presente))
                                                    {
                                                        setValido = false;
                                                        break;
                                                    }
                                                }
                                            }
                                            if (setRegole.regoleMeccanica != null)
                                            {
                                                foreach (var regola in setRegole.regoleMeccanica)
                                                {
                                                    //var meccanicheLiv = listaMeccanichePerLivello.Find(f => f.Livello == declMecc.LivelloMeccanica);
                                                    if (regola.idMeccanica > 0 && (regola.nomeMeccanica == null || regola.nomeMeccanica == ""))
                                                    {
                                                        var meccanicheLiv = listaMeccanichePerLivello.Find(f => f.Meccaniche.Find(r => r.Id == (long)regola.idMeccanica) != null);
                                                        if (setRegole.EsclusivitaMeccanicheCoinvolte)
                                                        {
                                                            if (meccanicheLiv!.Meccaniche.Count != setRegole.regoleMeccanica.Where(f => f.presente).Count())
                                                            {
                                                                setValido = false;
                                                                break;
                                                            }
                                                        }

                                                        if ((meccanicheLiv == null && regola.presente)
                                                            || (meccanicheLiv != null && meccanicheLiv.Meccaniche.Find(f => f.Id == (long)regola.idMeccanica) == null && regola.presente)
                                                            || (meccanicheLiv != null && meccanicheLiv.Meccaniche.Find(f => f.Id == (long)regola.idMeccanica) != null && !regola.presente))
                                                        {
                                                            setValido = false;
                                                            break;
                                                        }
                                                    }
                                                    else if (regola.nomeMeccanica != null || regola.nomeMeccanica != "")
                                                    {
                                                        var meccanicheLiv = listaMeccanichePerLivello.Find(f => f.Meccaniche.Find(r => r.Nome == regola.nomeMeccanica) != null);
                                                        if (setRegole.EsclusivitaMeccanicheCoinvolte)
                                                        {
                                                            if (meccanicheLiv!.Meccaniche.Count != setRegole.regoleMeccanica.Where(f => f.presente).Count())
                                                            {
                                                                setValido = false;
                                                                break;
                                                            }
                                                        }

                                                        if ((meccanicheLiv == null && regola.presente)
                                                            || (meccanicheLiv != null && meccanicheLiv.Meccaniche.Find(f => f.Nome == regola.nomeMeccanica) == null && regola.presente)
                                                            || (meccanicheLiv != null && meccanicheLiv.Meccaniche.Find(f => f.Nome == regola.nomeMeccanica) != null && !regola.presente))
                                                        {
                                                            setValido = false;
                                                            break;
                                                        }
                                                    }
                                                }
                                            }
                                            if (setValido)
                                            {
                                                listMeccDaRimuovere.Add(declMecc);
                                                break;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    for (int i = 0; i < listaMeccanichePerLivello.Count; i++)
                    {
                        var listaMecc = listaMeccanichePerLivello[i];
                        for (int i2 = 0; i2 < listaMecc.Meccaniche.Count; i2++)
                        {
                            var mecc = listaMecc.Meccaniche[i2];


                            var found = listMeccDaRimuovere.Find(f => f.LivelloMeccanica == listaMecc.Livello && f.Nome.ToLower() == mecc.Nome.ToLower()) != null;

                            if (found)
                            {
                                listaMecc.Meccaniche.RemoveAt(i2);
                                i2--;
                            }
                        }
                    }

                    #endregion rimozioneMeccaniche

                }
            }



            listaMeccanichePerLivello.RemoveAll(f => f.Meccaniche.Count == 0);
            List<List<DeclinazioneMeccanica>> listaDeclinazioniDaCombinare = new List<List<DeclinazioneMeccanica>>();

            foreach (var gruppoDecl in listaMeccanichePerLivello)
            {
                List<DeclinazioneMeccanica> listaLivello = new List<DeclinazioneMeccanica>();
                foreach (var decl in gruppoDecl.Meccaniche)
                {
                    listaLivello.Add(decl);
                }
                listaDeclinazioniDaCombinare.Add(listaLivello);
            }

            if (listaMeccanichePerLivello.Count > 0)
            {
                //Composizione possibili Meccaniche
                var combinazioniNomine = GetCartesianProduct(listaDeclinazioniDaCombinare);

                // Creare gli oggetti CombinazioniMeccaniche con i formati appropriati
                var risultato = combinazioniNomine.Select(comb =>
                {
                    string? formato = comb.Select(d => d.Formato).LastOrDefault(f => f != null);
                    return new CombinazioniMeccaniche
                    {
                        NomeCombinazione = string.Join("_", comb.Select(d => d.Nome)),
                        Formato = formato == null || formato == "" ? "1x1" : formato,
                    };
                }).ToList();

                foreach (var combinazione in risultato)
                {
                    var combinazionePresente = meccDB!.combinazioniMeccaniche.Find(f => f.NomeCombinazione == combinazione.NomeCombinazione);
                    if (combinazionePresente != null)
                    {
                        combinazione.Formato = combinazionePresente.Formato;
                    }
                }

                RecordPostControlloMeccaniche returnRecord = new RecordPostControlloMeccaniche();
                returnRecord.record = item;
                returnRecord.meccanicheValide = risultato;
                returnRecord.meccanicaAssegnata = risultato.Count > 0 ? risultato[0].NomeCombinazione : "";
                returnRecord.meccanicaInvalidata = meccDB!.meccanicheInvalidate.Any(name => name == risultato[0].NomeCombinazione);


                return returnRecord;
            }
            else
            {
                RecordPostControlloMeccaniche returnRecord = new RecordPostControlloMeccaniche();
                returnRecord.record = item;
                returnRecord.meccanicheValide = new List<CombinazioniMeccaniche>
                {
                    new CombinazioniMeccaniche
                    {
                        NomeCombinazione = meccDB!.meccanicaDefault,
                        Formato = "1x1",
                    }
                };
                returnRecord.meccanicaAssegnata = "";
                returnRecord.meccanicaInvalidata = false;

                return returnRecord;
            }

        }

        public RecordPostControlloMeccaniche IdentificaMeccanicaRecord(int idTracciato, string codice, DbDeclinazioneMeccaniche? meccDB = null, bool setRefToNull = false)
        {
            if (codice.Contains("2044885"))
            {
                Debug.WriteLine("");
            }
            string key_codice_gruppo = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppo;
            string keyCodiceRef = Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice;
            string primoCodice = "";
            if (codice.Contains(","))
            {
                primoCodice = codice.Split(",")[0];
            }
            PromoTracciatiRecord? record = this.ctx2.PromoTracciatiRecords.Where(t => t.IdTracciato == idTracciato && (codice.Contains(",") ? t.Codice == primoCodice : t.Codice == codice)).FirstOrDefault();

            var tracciatoSingolo = new
            {
                Dato = IstantaJson.getJsonObject(record!.Dato!),
                Id = record.Id,
                //StatoSelezione = record.SelezioneMenabo,
                HasFoto = (returnHasFoto(IstantaJson.getJsonObject(record!.Dato!)) ? AskFoto.FotoPresente : AskFoto.FotoNonPresente),
                Label = record.Label
            };


            ArticoloInRevisione item = new ArticoloInRevisione();

            item.recordInTracciato = tracciatoSingolo.Dato;
            if (!codice.Contains(","))
            {
                Articoli? artItem = this.ctx.Articolis.Include(i => i.ArticoliDescrizionis).Where(r => r.Codice == tracciatoSingolo.Dato[keyCodiceRef].ToString()).FirstOrDefault();
                if (artItem != null)
                {
                    item.recordRevisionato = artItem.ArticoliDescrizionis!.OrderByDescending(o => o.DataUltimaRicezione).FirstOrDefault()!;
                }
            }
            else
            {
                item.recordRevisionato = this.ctx.ArticoliDescrizionis.Where(f => f.CodiceGruppo == codice).FirstOrDefault()!;
            }

            item.isGruppo = codice.Contains(",");
            item.isObsoleto = false;
            item.idRec = tracciatoSingolo.Id;
            //item.statoSelezione = tracciatoSingolo.StatoSelezione;
            item.hasFoto = (Byte)tracciatoSingolo.HasFoto;
            item.label = tracciatoSingolo.Label!;
            ArticoloImpaginato artImp = new ArticoloImpaginato();
            var recordImp = this.ctx2.MenaboRefs.Include(f => f.IdPaginaNavigation).Where(f => (codice.Contains(",") ? f.CodiceGruppo == codice : f.IdRecord == tracciatoSingolo.Id) && f.IdPaginaNavigation.IdTracciato == idTracciato).FirstOrDefault();
            if (recordImp != null)
            {
                artImp.CodiceGruppo = recordImp.CodiceGruppo;
                artImp.IdRecord = recordImp.IdRecord;
                artImp.IdPagina = recordImp.IdPaginaNavigation.Id;
                artImp.IdPaginaNavigation = recordImp.IdPaginaNavigation;
                artImp.Indice = recordImp.Indice;
            }

            item.recordImpaginato = (setRefToNull ? null : artImp);

            //if (item.isGruppo)
            //{
            //    RecordPostControlloMeccaniche returnRecord = new RecordPostControlloMeccaniche();
            //    returnRecord.record = item;
            //    returnRecord.meccanicheValide = new List<CombinazioniMeccaniche>
            //    {
            //        new CombinazioniMeccaniche
            //        {
            //            NomeCombinazione = "",
            //            Formato = "",
            //        }
            //    };
            //    returnRecord.meccanicaAssegnata = "";
            //    return returnRecord;
            //}

            item = Etichettatura(item);

            if (meccDB == null)
            {
                JObject oDeclMecc = JObject.Parse(System.IO.File.ReadAllText(this.path_external_source + "SourceDeclinazioneMeccaniche.json"));
                meccDB = oDeclMecc.ToObject<DbDeclinazioneMeccaniche>();
            }
            List<MeccanicheLivello> listaMeccanichePerLivello = new List<MeccanicheLivello>();
            if (meccDB != null)
            {
                var meccRaggruppate = meccDB.source.OrderBy(o => o.Livello).GroupBy(s => s.Livello);
                foreach (var gruppoLivello in meccRaggruppate)
                {
                    MeccanicheLivello meccanicheLivello = new MeccanicheLivello(gruppoLivello.Key);
                    foreach (var declMeccanica in gruppoLivello)
                    {
                        if (declMeccanica.Regole != null)
                        {
                            foreach (var setRegole in declMeccanica.Regole)
                            {
                                if (setRegole != null)
                                {
                                    bool setValido = true;
                                    foreach (var regola in setRegole)
                                    {
                                        if ((!item.allEtichette!.Contains(regola.nomeEtichetta) && regola.presente) || (item.allEtichette.Contains(regola.nomeEtichetta) && !regola.presente))
                                        {
                                            setValido = false;
                                            break;

                                        }
                                    }
                                    if (setValido)
                                    {
                                        meccanicheLivello.Meccaniche.Add(declMeccanica);
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    if (meccanicheLivello.Meccaniche.Count > 0)
                    {
                        listaMeccanichePerLivello.Add(meccanicheLivello);
                    }
                    else
                    {
                        DeclinazioneMeccanica? meccDefaultLiv = gruppoLivello.Where(f => f.Regole == null).FirstOrDefault();
                        if (meccDefaultLiv != null)
                        {
                            meccanicheLivello.Meccaniche.Add(meccDefaultLiv);
                            listaMeccanichePerLivello.Add(meccanicheLivello);
                        }
                        else
                        {
                            listaMeccanichePerLivello.Add(meccanicheLivello);
                        }
                    }
                }

                // Raggruppa per LivelloEsternoMeccanicaAvanzata
                var meccanicheAvanzateRaggruppate = meccDB.meccanicheAvanzate
                    .OrderBy(o => o.LivelloMeccanica)  // Ordina per LivelloMeccanica
                    .GroupBy(s => s.LivelloEsternoMeccanicaAvanzata)  // Raggruppa per LivelloEsternoMeccanicaAvanzata
                    .Select(outerGroup => new
                    {
                        LivelloEsterno = outerGroup.Key,  // Chiave del primo raggruppamento (LivelloEsternoMeccanicaAvanzata)
                        LivelliInterni = outerGroup
                            .GroupBy(inner => inner.LivelloMeccanica)  // Raggruppamento annidato per LivelloMeccanica
                            .Select(innerGroup => new
                            {
                                LivelloMeccanica = innerGroup.Key,  // Chiave del secondo raggruppamento (LivelloMeccanica)
                                Meccaniche = innerGroup.ToList()    // Lista degli elementi all'interno di questo gruppo
                            })
                            .ToList()  // Converti in una lista per avere l'accesso ai gruppi interni
                    })
                    .ToList();  // Converti in lista il risultato finale

                foreach (var livelloEsterno in meccanicheAvanzateRaggruppate)
                {
                    List<DeclinazioneMeccanica> meccConCuiSostituire = new List<DeclinazioneMeccanica>();
                    foreach (var livelloInterno in livelloEsterno.LivelliInterni)
                    {
                        DeclinazioneMeccanica meccDaInserire = new DeclinazioneMeccanica();

                        foreach (var declMecc in livelloInterno.Meccaniche)
                        {
                            if (declMecc.Regole != null)
                            {
                                foreach (var setRegole in declMecc.Regole)
                                {
                                    if (setRegole != null)
                                    {
                                        bool setValido = true;
                                        if (setRegole.regoleEtichetta != null)
                                        {
                                            foreach (var regola in setRegole.regoleEtichetta)
                                            {
                                                if ((!item.allEtichette!.Contains(regola.nomeEtichetta) && regola.presente) || (item.allEtichette.Contains(regola.nomeEtichetta) && !regola.presente))
                                                {
                                                    setValido = false;
                                                    break;
                                                }
                                            }
                                        }
                                        if (setRegole.regoleMeccanica != null)
                                        {
                                            foreach (var regola in setRegole.regoleMeccanica)
                                            {
                                                //var meccanicheLiv = listaMeccanichePerLivello.Find(f => f.Livello == declMecc.LivelloMeccanica);
                                                var meccanicheLiv = listaMeccanichePerLivello.Find(f => f.Meccaniche.Find(r => r.Id == (long)regola.idMeccanica) != null); if (setRegole.EsclusivitaMeccanicheCoinvolte)
                                                {
                                                    if (meccanicheLiv!.Meccaniche.Count != setRegole.regoleMeccanica.Where(f => f.presente).Count())
                                                    {
                                                        setValido = false;
                                                        break;
                                                    }
                                                }

                                                if ((meccanicheLiv == null && regola.presente)
                                                    || (meccanicheLiv != null && meccanicheLiv.Meccaniche.Find(f => f.Id == (long)regola.idMeccanica) == null && regola.presente)
                                                    || (meccanicheLiv != null && meccanicheLiv.Meccaniche.Find(f => f.Id == (long)regola.idMeccanica) != null && !regola.presente))
                                                {
                                                    setValido = false;
                                                    break;
                                                }
                                            }
                                        }
                                        if (setValido)
                                        {
                                            meccDaInserire.Formato = declMecc.Formato;
                                            meccDaInserire.Livello = declMecc.LivelloMeccanica;
                                            meccDaInserire.Regole = null;
                                            meccDaInserire.Nome = declMecc.Nome;
                                            meccDaInserire.Id = declMecc.Id;

                                            meccConCuiSostituire.Add(meccDaInserire);
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    }

                    var meccanicheLivelloCorrispondente = listaMeccanichePerLivello.Find(f => f.Livello == livelloEsterno.LivelloEsterno);

                    if (meccanicheLivelloCorrispondente != null && meccConCuiSostituire.Count > 0)
                    {
                        meccanicheLivelloCorrispondente.Meccaniche = meccConCuiSostituire;
                    }
                    else if (meccanicheLivelloCorrispondente == null && meccConCuiSostituire.Count > 0)
                    {
                        MeccanicheLivello nuovoLivello = new MeccanicheLivello(livelloEsterno.LivelliInterni[0].LivelloMeccanica);
                        nuovoLivello.Meccaniche = meccConCuiSostituire;
                        listaMeccanichePerLivello.Add(nuovoLivello);
                    }
                }
            }


            listaMeccanichePerLivello.RemoveAll(f => f.Meccaniche.Count == 0);
            List<List<DeclinazioneMeccanica>> listaDeclinazioniDaCombinare = new List<List<DeclinazioneMeccanica>>();

            foreach (var gruppoDecl in listaMeccanichePerLivello)
            {
                List<DeclinazioneMeccanica> listaLivello = new List<DeclinazioneMeccanica>();
                foreach (var decl in gruppoDecl.Meccaniche)
                {
                    listaLivello.Add(decl);
                }
                listaDeclinazioniDaCombinare.Add(listaLivello);
            }

            if (listaDeclinazioniDaCombinare.Count > 0)
            {
                //Composizione possibili Meccaniche
                var combinazioniNomine = GetCartesianProduct(listaDeclinazioniDaCombinare);

                // Creare gli oggetti CombinazioniMeccaniche con i formati appropriati
                var risultato = combinazioniNomine.Select(comb =>
                {
                    string? formato = comb.Select(d => d.Formato).LastOrDefault(f => f != null);
                    return new CombinazioniMeccaniche
                    {
                        NomeCombinazione = string.Join("_", comb.Select(d => d.Nome)),
                        Formato = formato == null || formato == "" ? "1x1" : formato,
                    };
                }).ToList();

                foreach (var combinazione in risultato)
                {
                    var combinazionePresente = meccDB!.combinazioniMeccaniche.Find(f => f.NomeCombinazione == combinazione.NomeCombinazione);
                    if (combinazionePresente != null)
                    {
                        combinazione.Formato = combinazionePresente.Formato;
                    }
                }

                RecordPostControlloMeccaniche returnRecord = new RecordPostControlloMeccaniche();
                returnRecord.record = item;
                returnRecord.meccanicheValide = risultato;
                returnRecord.meccanicaAssegnata = risultato.Count > 0 ? risultato[0].NomeCombinazione : "";
                returnRecord.meccanicaInvalidata = meccDB!.meccanicheInvalidate.Any(name => name == risultato[0].NomeCombinazione);

                return returnRecord;
            }
            else
            {
                RecordPostControlloMeccaniche returnRecord = new RecordPostControlloMeccaniche();
                returnRecord.record = item;
                returnRecord.meccanicheValide = new List<CombinazioniMeccaniche>
                {
                    new CombinazioniMeccaniche
                    {
                        NomeCombinazione = meccDB!.meccanicaDefault,
                        Formato = "1x1",
                    }
                };
                returnRecord.meccanicaAssegnata = "";
                returnRecord.meccanicaInvalidata = false;

                return returnRecord;
            }
        }

        public RecordPostControlloMeccaniche IdentificaMeccanicaRecord(ArticoloInRevisione item, DbDeclinazioneMeccaniche? meccDB = null)
        {
            string keyCodiceRef = Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice;

            if (item.recordInTracciato![keyCodiceRef].ToString()!.Contains("2044885"))
            {
                Debug.WriteLine("");
            }
            //if (item.isGruppo)
            //{
            //    RecordPostControlloMeccaniche returnRecord = new RecordPostControlloMeccaniche();
            //    returnRecord.record = item;
            //    returnRecord.meccanicheValide = new List<CombinazioniMeccaniche>
            //    {
            //        new CombinazioniMeccaniche
            //        {
            //            NomeCombinazione = "",
            //            Formato = "",
            //        }
            //    };
            //    returnRecord.meccanicaAssegnata = "";
            //    return returnRecord;
            //}

            if (item.allEtichette == null)
            {
                item = Etichettatura(item);
            }

            if (item.recordInTracciato!["Referenza.Codice"].ToString() == "4714232")
            {
                Debug.WriteLine("");
            }
            if (meccDB == null)
            {
                JObject oDeclMecc = JObject.Parse(System.IO.File.ReadAllText(this.path_external_source + "SourceDeclinazioneMeccaniche.json"));
                meccDB = oDeclMecc.ToObject<DbDeclinazioneMeccaniche>();
            }
            List<MeccanicheLivello> listaMeccanichePerLivello = new List<MeccanicheLivello>();
            if (meccDB != null)
            {
                var meccRaggruppate = meccDB.source.OrderBy(o => o.Livello).GroupBy(s => s.Livello);
                foreach (var gruppoLivello in meccRaggruppate)
                {
                    MeccanicheLivello meccanicheLivello = new MeccanicheLivello(gruppoLivello.Key);
                    foreach (var declMeccanica in gruppoLivello)
                    {
                        if (declMeccanica.Regole != null)
                        {
                            foreach (var setRegole in declMeccanica.Regole)
                            {
                                if (setRegole != null)
                                {
                                    bool setValido = true;
                                    foreach (var regola in setRegole)
                                    {
                                        if ((!item.allEtichette!.Contains(regola.nomeEtichetta) && regola.presente) || (item.allEtichette.Contains(regola.nomeEtichetta) && !regola.presente))
                                        {
                                            setValido = false;
                                            break;

                                        }
                                    }
                                    if (setValido)
                                    {
                                        meccanicheLivello.Meccaniche.Add(declMeccanica);
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    if (meccanicheLivello.Meccaniche.Count > 0)
                    {
                        listaMeccanichePerLivello.Add(meccanicheLivello);
                    }
                    else
                    {
                        DeclinazioneMeccanica? meccDefaultLiv = gruppoLivello.Where(f => f.Regole == null).FirstOrDefault();
                        if (meccDefaultLiv != null)
                        {
                            meccanicheLivello.Meccaniche.Add(meccDefaultLiv);
                            listaMeccanichePerLivello.Add(meccanicheLivello);
                        }
                        else
                        {
                            listaMeccanichePerLivello.Add(meccanicheLivello);
                        }
                    }
                }



                // Raggruppa per LivelloEsternoMeccanicaAvanzata
                var meccanicheAvanzateRaggruppate = meccDB.meccanicheAvanzate
                .OrderBy(o => o.LivelloMeccanica)  // Ordina per LivelloMeccanica
                .GroupBy(s => s.LivelloEsternoMeccanicaAvanzata)
                .OrderBy(s => s.Key)// Raggruppa per LivelloEsternoMeccanicaAvanzata
                .Select(outerGroup => new
                {
                    LivelloEsterno = outerGroup.Key,  // Chiave del primo raggruppamento (LivelloEsternoMeccanicaAvanzata)
                    LivelliInterni = outerGroup
                        .GroupBy(inner => inner.LivelloMeccanica)  // Raggruppamento annidato per LivelloMeccanica
                        .Select(innerGroup => new
                        {
                            LivelloMeccanica = innerGroup.Key,  // Chiave del secondo raggruppamento (LivelloMeccanica)
                            Meccaniche = innerGroup.ToList()    // Lista degli elementi all'interno di questo gruppo
                        })
                        .ToList()  // Converti in una lista per avere l'accesso ai gruppi interni
                })
                .ToList();  // Converti in lista il risultato finale


                foreach (var livelloEsterno in meccanicheAvanzateRaggruppate)
                {
                    #region rimozioneMeccanicheBefore
                    // Raggruppa per LivelloEsternoMeccanicaAvanzata
                    var meccanicheInRimozione = meccDB.meccanicheInRimozione.Where(f => f.timeToApply == timeToApplyOperation.applyBefore)
                        .OrderBy(o => o.LivelloMeccanica)  // Ordina per LivelloMeccanica
                        .GroupBy(s => s.LivelloEsternoMeccanicaAvanzata)  // Raggruppa per LivelloEsternoMeccanicaAvanzata
                        .Select(outerGroup => new
                        {
                            LivelloEsterno = outerGroup.Key,  // Chiave del primo raggruppamento (LivelloEsternoMeccanicaAvanzata)
                            LivelliInterni = outerGroup
                                .GroupBy(inner => inner.LivelloMeccanica)  // Raggruppamento annidato per LivelloMeccanica
                                .Select(innerGroup => new
                                {
                                    LivelloMeccanica = innerGroup.Key,  // Chiave del secondo raggruppamento (LivelloMeccanica)
                                    Meccaniche = innerGroup.ToList(),    // Lista degli elementi all'interno di questo gruppo

                                })
                                .ToList()  // Converti in una lista per avere l'accesso ai gruppi interni
                        })
                        .ToList();  // Converti in lista il risultato finale


                    List<RimozioneDeclinazioneMeccanica> listMeccDaRimuovere = new List<RimozioneDeclinazioneMeccanica>();
                    foreach (var livelloEsternoRimozione in meccanicheInRimozione)
                    {
                        foreach (var livelloInterno in livelloEsternoRimozione.LivelliInterni)
                        {
                            foreach (var declMecc in livelloInterno.Meccaniche)
                            {
                                if (declMecc.Regole != null)
                                {
                                    foreach (var setRegole in declMecc.Regole)
                                    {
                                        if (setRegole != null)
                                        {
                                            bool setValido = true;
                                            if (setRegole.regoleEtichetta != null)
                                            {
                                                foreach (var regola in setRegole.regoleEtichetta)
                                                {
                                                    if ((!item.allEtichette!.Contains(regola.nomeEtichetta) && regola.presente) || (item.allEtichette.Contains(regola.nomeEtichetta) && !regola.presente))
                                                    {
                                                        setValido = false;
                                                        break;
                                                    }
                                                }
                                            }
                                            if (setRegole.regoleMeccanica != null)
                                            {
                                                foreach (var regola in setRegole.regoleMeccanica)
                                                {
                                                    //var meccanicheLiv = listaMeccanichePerLivello.Find(f => f.Livello == declMecc.LivelloMeccanica);
                                                    if (regola.idMeccanica > 0 && (regola.nomeMeccanica == null || regola.nomeMeccanica == ""))
                                                    {
                                                        var meccanicheLiv = listaMeccanichePerLivello.Find(f => f.Meccaniche.Find(r => r.Id == (long)regola.idMeccanica) != null);
                                                        if (setRegole.EsclusivitaMeccanicheCoinvolte)
                                                        {
                                                            if (meccanicheLiv!.Meccaniche.Count != setRegole.regoleMeccanica.Where(f => f.presente).Count())
                                                            {
                                                                setValido = false;
                                                                break;
                                                            }
                                                        }

                                                        if ((meccanicheLiv == null && regola.presente)
                                                            || (meccanicheLiv != null && meccanicheLiv.Meccaniche.Find(f => f.Id == (long)regola.idMeccanica) == null && regola.presente)
                                                            || (meccanicheLiv != null && meccanicheLiv.Meccaniche.Find(f => f.Id == (long)regola.idMeccanica) != null && !regola.presente))
                                                        {
                                                            setValido = false;
                                                            break;
                                                        }
                                                    }
                                                    else if (regola.nomeMeccanica != null || regola.nomeMeccanica != "")
                                                    {
                                                        var meccanicheLiv = listaMeccanichePerLivello.Find(f => f.Meccaniche.Find(r => r.Nome == regola.nomeMeccanica) != null);
                                                        if (setRegole.EsclusivitaMeccanicheCoinvolte)
                                                        {
                                                            if (meccanicheLiv!.Meccaniche.Count != setRegole.regoleMeccanica.Where(f => f.presente).Count())
                                                            {
                                                                setValido = false;
                                                                break;
                                                            }
                                                        }

                                                        if ((meccanicheLiv == null && regola.presente)
                                                            || (meccanicheLiv != null && meccanicheLiv.Meccaniche.Find(f => f.Nome == regola.nomeMeccanica) == null && regola.presente)
                                                            || (meccanicheLiv != null && meccanicheLiv.Meccaniche.Find(f => f.Nome == regola.nomeMeccanica) != null && !regola.presente))
                                                        {
                                                            setValido = false;
                                                            break;
                                                        }
                                                    }
                                                }
                                            }
                                            if (setValido)
                                            {
                                                listMeccDaRimuovere.Add(declMecc);
                                                break;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    for (int i = 0; i < listaMeccanichePerLivello.Count; i++)
                    {
                        var listaMecc = listaMeccanichePerLivello[i];
                        for (int i2 = 0; i2 < listaMecc.Meccaniche.Count; i2++)
                        {
                            var mecc = listaMecc.Meccaniche[i2];


                            var found = listMeccDaRimuovere.Find(f => f.LivelloMeccanica == listaMecc.Livello && f.Nome.ToLower() == mecc.Nome.ToLower()) != null;

                            if (found)
                            {
                                listaMecc.Meccaniche.RemoveAt(i2);
                                i2--;
                            }
                        }
                    }

                    #endregion rimozioneMeccanicheBefore

                    List<DeclinazioneMeccanica> meccConCuiSostituire = new List<DeclinazioneMeccanica>();
                    foreach (var livelloInterno in livelloEsterno.LivelliInterni)
                    {
                        DeclinazioneMeccanica meccDaInserire = new DeclinazioneMeccanica();

                        foreach (var declMecc in livelloInterno.Meccaniche)
                        {
                            if (declMecc.Regole != null)
                            {
                                foreach (var setRegole in declMecc.Regole)
                                {
                                    if (setRegole != null)
                                    {
                                        bool setValido = true;
                                        if (setRegole.regoleEtichetta != null)
                                        {
                                            foreach (var regola in setRegole.regoleEtichetta)
                                            {
                                                if ((!item.allEtichette!.Contains(regola.nomeEtichetta) && regola.presente) || (item.allEtichette.Contains(regola.nomeEtichetta) && !regola.presente))
                                                {
                                                    setValido = false;
                                                    break;
                                                }
                                            }
                                        }
                                        if (setRegole.regoleMeccanica != null)
                                        {
                                            foreach (var regola in setRegole.regoleMeccanica)
                                            {
                                                //var meccanicheLiv = listaMeccanichePerLivello.Find(f => f.Livello == declMecc.LivelloMeccanica);
                                                if (regola.idMeccanica > 0)
                                                {
                                                    var meccanicheLiv = listaMeccanichePerLivello.Find(f => f.Meccaniche.Find(r => r.Id == (long)regola.idMeccanica) != null);
                                                    if (setRegole.EsclusivitaMeccanicheCoinvolte)
                                                    {
                                                        if (meccanicheLiv!.Meccaniche.Count != setRegole.regoleMeccanica.Where(f => f.presente).Count())
                                                        {
                                                            setValido = false;
                                                            break;
                                                        }
                                                    }

                                                    if ((meccanicheLiv == null && regola.presente)
                                                        || (meccanicheLiv != null && meccanicheLiv.Meccaniche.Find(f => f.Id == (long)regola.idMeccanica) == null && regola.presente)
                                                        || (meccanicheLiv != null && meccanicheLiv.Meccaniche.Find(f => f.Id == (long)regola.idMeccanica) != null && !regola.presente))
                                                    {
                                                        setValido = false;
                                                        break;
                                                    }
                                                }
                                                else if (regola.idMeccanica < 0) //stiamo chiedendo che il livello sia vuoto
                                                {
                                                    if (regola.presente) //se vogliamo che sia vuoto
                                                    {
                                                        var liv = listaMeccanichePerLivello.Find(f => f.Livello == MathF.Abs(regola.idMeccanica));
                                                        if (liv != null && liv.Meccaniche != null && liv.Meccaniche.Count > 0)
                                                        {
                                                            setValido = false;
                                                            break;

                                                        }
                                                    }
                                                    else //se vogliamo che ci sia almeno un elemento
                                                    {
                                                        var liv = listaMeccanichePerLivello.Find(f => f.Livello == MathF.Abs(regola.idMeccanica));
                                                        if (liv == null || (liv != null && liv.Meccaniche != null && liv.Meccaniche.Count == 0))
                                                        {
                                                            setValido = false;
                                                            break;

                                                        }
                                                    }
                                                }
                                            }
                                        }
                                        if (setValido)
                                        {
                                            meccDaInserire.Formato = declMecc.Formato;
                                            meccDaInserire.Livello = declMecc.LivelloMeccanica;
                                            meccDaInserire.Regole = null;
                                            meccDaInserire.Nome = declMecc.Nome;
                                            meccDaInserire.Id = declMecc.Id;

                                            meccConCuiSostituire.Add(meccDaInserire);
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    }

                    //var meccanicheLivelloCorrispondente = listaMeccanichePerLivello.Find(f => f.Livello == livelloEsterno.LivelloEsterno);

                    for (int i = 0; i < listaMeccanichePerLivello.Count; i++)
                    {
                        var meccanicheLivelloCorrispondente = listaMeccanichePerLivello[i];
                        if (meccConCuiSostituire.Find(f => f.Livello == meccanicheLivelloCorrispondente.Livello) != null)
                        {
                            meccanicheLivelloCorrispondente.Meccaniche = meccConCuiSostituire.Where(f => f.Livello == meccanicheLivelloCorrispondente.Livello).ToList();
                        }
                    }

                    var meccanicheDiLivelliInesistenti = meccConCuiSostituire.Where(f => listaMeccanichePerLivello.Find(g => g.Livello == f.Livello) == null).ToList();
                    var gruppiLivelloMeccanicheInesistenti = meccanicheDiLivelliInesistenti.GroupBy(f => f.Livello);
                    foreach (var gruppoLivello in gruppiLivelloMeccanicheInesistenti)
                    {
                        MeccanicheLivello nuovoLivello = new MeccanicheLivello(gruppoLivello.Key);

                        foreach (var decl in gruppoLivello)
                        {
                            nuovoLivello.Meccaniche.Add(decl);
                        }

                        listaMeccanichePerLivello.Add(nuovoLivello);
                    }

                    //if (meccanicheLivelloCorrispondente != null && meccConCuiSostituire.Count > 0)
                    //{
                    //    meccanicheLivelloCorrispondente.Meccaniche = meccConCuiSostituire;
                    //}
                    //else if (meccanicheLivelloCorrispondente == null && meccConCuiSostituire.Count > 0)
                    //{
                    //    MeccanicheLivello nuovoLivello = new MeccanicheLivello(livelloEsterno.LivelliInterni[0].LivelloMeccanica);
                    //    nuovoLivello.Meccaniche = meccConCuiSostituire;
                    //    listaMeccanichePerLivello.Add(nuovoLivello);
                    //}

                    #region rimozioneMeccaniche
                    // Raggruppa per LivelloEsternoMeccanicaAvanzata
                    meccanicheInRimozione = meccDB.meccanicheInRimozione.Where(f => f.timeToApply == timeToApplyOperation.applyAfter)
                        .OrderBy(o => o.LivelloMeccanica)  // Ordina per LivelloMeccanica
                        .GroupBy(s => s.LivelloEsternoMeccanicaAvanzata)  // Raggruppa per LivelloEsternoMeccanicaAvanzata
                        .Select(outerGroup => new
                        {
                            LivelloEsterno = outerGroup.Key,  // Chiave del primo raggruppamento (LivelloEsternoMeccanicaAvanzata)
                            LivelliInterni = outerGroup
                                .GroupBy(inner => inner.LivelloMeccanica)  // Raggruppamento annidato per LivelloMeccanica
                                .Select(innerGroup => new
                                {
                                    LivelloMeccanica = innerGroup.Key,  // Chiave del secondo raggruppamento (LivelloMeccanica)
                                    Meccaniche = innerGroup.ToList(),    // Lista degli elementi all'interno di questo gruppo

                                })
                                .ToList()  // Converti in una lista per avere l'accesso ai gruppi interni
                        })
                        .ToList();  // Converti in lista il risultato finale


                    listMeccDaRimuovere = new List<RimozioneDeclinazioneMeccanica>();
                    foreach (var livelloEsternoRimozione in meccanicheInRimozione)
                    {
                        foreach (var livelloInterno in livelloEsternoRimozione.LivelliInterni)
                        {
                            foreach (var declMecc in livelloInterno.Meccaniche)
                            {
                                if (declMecc.Regole != null)
                                {
                                    foreach (var setRegole in declMecc.Regole)
                                    {
                                        if (setRegole != null)
                                        {
                                            bool setValido = true;
                                            if (setRegole.regoleEtichetta != null)
                                            {
                                                foreach (var regola in setRegole.regoleEtichetta)
                                                {
                                                    if ((!item.allEtichette!.Contains(regola.nomeEtichetta) && regola.presente) || (item.allEtichette.Contains(regola.nomeEtichetta) && !regola.presente))
                                                    {
                                                        setValido = false;
                                                        break;
                                                    }
                                                }
                                            }
                                            if (setRegole.regoleMeccanica != null)
                                            {
                                                foreach (var regola in setRegole.regoleMeccanica)
                                                {
                                                    //var meccanicheLiv = listaMeccanichePerLivello.Find(f => f.Livello == declMecc.LivelloMeccanica);
                                                    if (regola.idMeccanica > 0 && (regola.nomeMeccanica == null || regola.nomeMeccanica == ""))
                                                    {
                                                        var meccanicheLiv = listaMeccanichePerLivello.Find(f => f.Meccaniche.Find(r => r.Id == (long)regola.idMeccanica) != null);
                                                        if (setRegole.EsclusivitaMeccanicheCoinvolte)
                                                        {
                                                            if (meccanicheLiv!.Meccaniche.Count != setRegole.regoleMeccanica.Where(f => f.presente).Count())
                                                            {
                                                                setValido = false;
                                                                break;
                                                            }
                                                        }

                                                        if ((meccanicheLiv == null && regola.presente)
                                                            || (meccanicheLiv != null && meccanicheLiv.Meccaniche.Find(f => f.Id == (long)regola.idMeccanica) == null && regola.presente)
                                                            || (meccanicheLiv != null && meccanicheLiv.Meccaniche.Find(f => f.Id == (long)regola.idMeccanica) != null && !regola.presente))
                                                        {
                                                            setValido = false;
                                                            break;
                                                        }
                                                    }
                                                    else if (regola.nomeMeccanica != null || regola.nomeMeccanica != "")
                                                    {
                                                        var meccanicheLiv = listaMeccanichePerLivello.Find(f => f.Meccaniche.Find(r => r.Nome == regola.nomeMeccanica) != null);
                                                        if (setRegole.EsclusivitaMeccanicheCoinvolte)
                                                        {
                                                            if (meccanicheLiv!.Meccaniche.Count != setRegole.regoleMeccanica.Where(f => f.presente).Count())
                                                            {
                                                                setValido = false;
                                                                break;
                                                            }
                                                        }

                                                        if ((meccanicheLiv == null && regola.presente)
                                                            || (meccanicheLiv != null && meccanicheLiv.Meccaniche.Find(f => f.Nome == regola.nomeMeccanica) == null && regola.presente)
                                                            || (meccanicheLiv != null && meccanicheLiv.Meccaniche.Find(f => f.Nome == regola.nomeMeccanica) != null && !regola.presente))
                                                        {
                                                            setValido = false;
                                                            break;
                                                        }
                                                    }
                                                }
                                            }
                                            if (setValido)
                                            {
                                                listMeccDaRimuovere.Add(declMecc);
                                                break;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    for (int i = 0; i < listaMeccanichePerLivello.Count; i++)
                    {
                        var listaMecc = listaMeccanichePerLivello[i];
                        for (int i2 = 0; i2 < listaMecc.Meccaniche.Count; i2++)
                        {
                            var mecc = listaMecc.Meccaniche[i2];


                            var found = listMeccDaRimuovere.Find(f => f.LivelloMeccanica == listaMecc.Livello && f.Nome.ToLower() == mecc.Nome.ToLower()) != null;

                            if (found)
                            {
                                listaMecc.Meccaniche.RemoveAt(i2);
                                i2--;
                            }
                        }
                    }

                    #endregion rimozioneMeccaniche

                }
            }



            listaMeccanichePerLivello.RemoveAll(f => f.Meccaniche.Count == 0);
            List<List<DeclinazioneMeccanica>> listaDeclinazioniDaCombinare = new List<List<DeclinazioneMeccanica>>();

            foreach (var gruppoDecl in listaMeccanichePerLivello)
            {
                List<DeclinazioneMeccanica> listaLivello = new List<DeclinazioneMeccanica>();
                foreach (var decl in gruppoDecl.Meccaniche)
                {
                    listaLivello.Add(decl);
                }
                listaDeclinazioniDaCombinare.Add(listaLivello);
            }

            if (listaMeccanichePerLivello.Count > 0)
            {
                //Composizione possibili Meccaniche
                var combinazioniNomine = GetCartesianProduct(listaDeclinazioniDaCombinare);

                // Creare gli oggetti CombinazioniMeccaniche con i formati appropriati
                var risultato = combinazioniNomine.Select(comb =>
                {
                    string? formato = comb.Select(d => d.Formato).LastOrDefault(f => f != null);
                    return new CombinazioniMeccaniche
                    {
                        NomeCombinazione = string.Join("_", comb.Select(d => d.Nome)),
                        Formato = formato == null || formato == "" ? "1x1" : formato,
                    };
                }).ToList();

                foreach (var combinazione in risultato)
                {
                    var combinazionePresente = meccDB!.combinazioniMeccaniche.Find(f => f.NomeCombinazione == combinazione.NomeCombinazione);
                    if (combinazionePresente != null)
                    {
                        combinazione.Formato = combinazionePresente.Formato;
                    }
                }

                RecordPostControlloMeccaniche returnRecord = new RecordPostControlloMeccaniche();
                returnRecord.record = item;
                returnRecord.meccanicheValide = risultato;
                returnRecord.meccanicaAssegnata = risultato.Count > 0 ? risultato[0].NomeCombinazione : "";
                returnRecord.meccanicaInvalidata = meccDB!.meccanicheInvalidate.Any(name => name == risultato[0].NomeCombinazione);


                return returnRecord;
            }
            else
            {
                RecordPostControlloMeccaniche returnRecord = new RecordPostControlloMeccaniche();
                returnRecord.record = item;
                returnRecord.meccanicheValide = new List<CombinazioniMeccaniche>
                {
                    new CombinazioniMeccaniche
                    {
                        NomeCombinazione = meccDB!.meccanicaDefault,
                        Formato = "1x1",
                    }
                };
                returnRecord.meccanicaAssegnata = "";
                returnRecord.meccanicaInvalidata = false;

                return returnRecord;
            }
        }

        public string IdentificaCodiceBox(ArticoloInRevisione item, DbFrameworkCss? frameDB = null)
        {
            try
            {

                if (!item.recordInTracciato!.ContainsKey(Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice))
                {
                    return "";
                }

                if (!item.recordInTracciato.ContainsKey(GLOBAL_VARIABLES.combinazioneAssegnata))
                {
                    throw new Exception("L'elemento non ha una meccaniza assegnata");
                }

                if (item.allEtichette == null)
                {
                    item = Etichettatura(item);
                }

                if (frameDB == null)
                {
                    JObject oFrame = JObject.Parse(System.IO.File.ReadAllText(this.path_external_source + "SourceFrameworkCss.json"));
                    frameDB = oFrame.ToObject<DbFrameworkCss>();
                }

                string codice = "";

                if (item.idRec == 79045)
                {
                    Debug.WriteLine("");
                }

                if (frameDB != null)
                {
                    foreach (var livello in frameDB.livelli.OrderBy(f => f.ordine))
                    {
                        foreach (var def in livello.definizioni.OrderBy(f => f.ordine))
                        {
                            if (def.regole == null)
                            {
                                continue;
                            }


                            foreach (var setRegole in def.regole)
                            {

                                foreach (var regola in setRegole.regole)
                                {

                                    if (!getPercorso(item, regola.campo, out var percorso))
                                    {
                                        if (percorso == null)
                                        {
                                            goto setRegole;
                                        }
                                    }
                                    //getPercorso(record, regola.campo, out var percorso);

                                    //if (percorso == null)
                                    //{
                                    //    percorso = "";
                                    //}

                                    if (regola.Value == null)
                                    {
                                        regola.Value = "";
                                    }

                                    if (percorso is string)
                                    {
                                        percorso = percorso.ToString()!.Replace(",", ".");
                                    }
                                    regola.Value = regola.Value.ToString().Replace(",", ".");

                                    switch (regola.Operatore)
                                    {
                                        case "IN":
                                            if ((percorso is IEnumerable enumerableIN) && !(percorso is string))
                                            {
                                                var listaDiStringhe = new List<string>();

                                                foreach (var elemento in enumerableIN)
                                                {
                                                    if (elemento == null || !(elemento is string || elemento.GetType().IsPrimitive || elemento is IConvertible))
                                                    {
                                                        // Se l'elemento non è convertibile in stringa, salta direttamente a setRegole
                                                        goto setRegole;
                                                    }

                                                    // Converte l'elemento in stringa e lo trasforma in minuscolo
                                                    listaDiStringhe.Add(elemento.ToString()!.ToLower());
                                                }
                                                if (!listaDiStringhe.Contains(regola.Value.ToLower()))
                                                {
                                                    goto setRegole;
                                                }
                                            }
                                            else if (!percorso.ToString()!.ToLower().Contains(regola.Value.ToLower()))
                                            {
                                                goto setRegole;
                                            }
                                            break;
                                        case "CIN":
                                            if ((percorso is IEnumerable enumerableCIN) && !(percorso is string))
                                            {
                                                var listaDiStringhe = new List<string>();

                                                foreach (var elemento in enumerableCIN)
                                                {
                                                    if (elemento == null || !(elemento is string || elemento.GetType().IsPrimitive || elemento is IConvertible))
                                                    {
                                                        // Se l'elemento non è convertibile in stringa, salta direttamente a setRegole
                                                        goto setRegole;
                                                    }

                                                    // Converte l'elemento in stringa e lo trasforma in minuscolo
                                                    listaDiStringhe.Add(elemento.ToString()!);
                                                }
                                                if (!listaDiStringhe.Contains(regola.Value))
                                                {
                                                    goto setRegole;
                                                }
                                            }
                                            if (!percorso.ToString()!.Contains(regola.Value))
                                            {
                                                goto setRegole;
                                            }
                                            break;
                                        case "SIN":
                                            if ((percorso is IEnumerable enumerableSIN) && !(percorso is string))
                                            {
                                                var listaDiStringhe = new List<string>();

                                                foreach (var elemento in enumerableSIN)
                                                {
                                                    if (elemento == null || !(elemento is string || elemento.GetType().IsPrimitive || elemento is IConvertible))
                                                    {
                                                        // Se l'elemento non è convertibile in stringa, salta direttamente a setRegole
                                                        goto setRegole;
                                                    }

                                                    // Converte l'elemento in stringa e lo trasforma in minuscolo
                                                    listaDiStringhe.Add(elemento.ToString()!.ToLower().Replace(" ", ""));
                                                }
                                                if (!listaDiStringhe.Contains(regola.Value.ToLower().Replace(" ", "")))
                                                {
                                                    goto setRegole;
                                                }
                                            }
                                            if (!percorso.ToString()!.ToLower().Replace(" ", "").Contains(regola.Value.Replace(" ", "").ToLower()))
                                            {
                                                goto setRegole;
                                            }
                                            break;
                                        case "SCIN":
                                            if ((percorso is IEnumerable enumerableSCIN) && !(percorso is string))
                                            {
                                                var listaDiStringhe = new List<string>();

                                                foreach (var elemento in enumerableSCIN)
                                                {
                                                    if (elemento == null || !(elemento is string || elemento.GetType().IsPrimitive || elemento is IConvertible))
                                                    {
                                                        // Se l'elemento non è convertibile in stringa, salta direttamente a setRegole
                                                        goto setRegole;
                                                    }

                                                    // Converte l'elemento in stringa e lo trasforma in minuscolo
                                                    listaDiStringhe.Add(elemento.ToString()!.Replace(" ", ""));
                                                }
                                                if (!listaDiStringhe.Contains(regola.Value.Replace(" ", "")))
                                                {
                                                    goto setRegole;
                                                }
                                            }
                                            if (!percorso.ToString()!.Replace(" ", "").Contains(regola.Value.Replace(" ", "")))
                                            {
                                                goto setRegole;
                                            }
                                            break;
                                        case "!IN":
                                            if ((percorso is IEnumerable enumerableNIN) && !(percorso is string))
                                            {
                                                var listaDiStringhe = new List<string>();

                                                foreach (var elemento in enumerableNIN)
                                                {
                                                    if (elemento == null || !(elemento is string || elemento.GetType().IsPrimitive || elemento is IConvertible))
                                                    {
                                                        // Se l'elemento non è convertibile in stringa, salta direttamente a setRegole
                                                        goto setRegole;
                                                    }

                                                    // Converte l'elemento in stringa e lo trasforma in minuscolo
                                                    listaDiStringhe.Add(elemento.ToString()!.ToLower());
                                                }
                                                if (listaDiStringhe.Contains(regola.Value.ToLower()))
                                                {
                                                    goto setRegole;
                                                }
                                            }
                                            if (percorso.ToString()!.ToLower().Contains(regola.Value.ToLower()))
                                            {
                                                goto setRegole;
                                            }
                                            break;
                                        case "C!IN":
                                            if ((percorso is IEnumerable enumerableCNIN) && !(percorso is string))
                                            {
                                                var listaDiStringhe = new List<string>();

                                                foreach (var elemento in enumerableCNIN)
                                                {
                                                    if (elemento == null || !(elemento is string || elemento.GetType().IsPrimitive || elemento is IConvertible))
                                                    {
                                                        // Se l'elemento non è convertibile in stringa, salta direttamente a setRegole
                                                        goto setRegole;
                                                    }

                                                    // Converte l'elemento in stringa e lo trasforma in minuscolo
                                                    listaDiStringhe.Add(elemento.ToString()!);
                                                }
                                                if (listaDiStringhe.Contains(regola.Value))
                                                {
                                                    goto setRegole;
                                                }
                                            }
                                            if (percorso.ToString()!.Contains(regola.Value))
                                            {
                                                goto setRegole;
                                            }
                                            break;
                                        case "S!IN":
                                            if ((percorso is IEnumerable enumerableSNIN) && !(percorso is string))
                                            {
                                                var listaDiStringhe = new List<string>();

                                                foreach (var elemento in enumerableSNIN)
                                                {
                                                    if (elemento == null || !(elemento is string || elemento.GetType().IsPrimitive || elemento is IConvertible))
                                                    {
                                                        // Se l'elemento non è convertibile in stringa, salta direttamente a setRegole
                                                        goto setRegole;
                                                    }

                                                    // Converte l'elemento in stringa e lo trasforma in minuscolo
                                                    listaDiStringhe.Add(elemento.ToString()!.ToLower().Replace(" ", ""));
                                                }
                                                if (listaDiStringhe.Contains(regola.Value.ToLower().Replace(" ", "")))
                                                {
                                                    goto setRegole;
                                                }
                                            }
                                            if (percorso.ToString()!.ToLower().Replace(" ", "").Contains(regola.Value.ToLower().Replace(" ", "")))
                                            {
                                                goto setRegole;
                                            }
                                            break;
                                        case "SC!IN":
                                            if ((percorso is IEnumerable enumerableSCNIN) && !(percorso is string))
                                            {
                                                var listaDiStringhe = new List<string>();

                                                foreach (var elemento in enumerableSCNIN)
                                                {
                                                    if (elemento == null || !(elemento is string || elemento.GetType().IsPrimitive || elemento is IConvertible))
                                                    {
                                                        // Se l'elemento non è convertibile in stringa, salta direttamente a setRegole
                                                        goto setRegole;
                                                    }

                                                    // Converte l'elemento in stringa e lo trasforma in minuscolo
                                                    listaDiStringhe.Add(elemento.ToString()!.Replace(" ", ""));
                                                }
                                                if (listaDiStringhe.Contains(regola.Value.Replace(" ", "")))
                                                {
                                                    goto setRegole;
                                                }
                                            }
                                            if (percorso.ToString()!.Replace(" ", "").Contains(regola.Value.Replace(" ", "")))
                                            {
                                                goto setRegole;
                                            }
                                            break;
                                        case "==":
                                            if (double.TryParse(regola.Value.ToString(), out double valore1) &&
double.TryParse(percorso.ToString(), out double valore2))
                                            {
                                                // Confronto numerico
                                                if (valore1 != valore2)
                                                {
                                                    goto setRegole;
                                                }
                                            }
                                            else
                                            {
                                                if (regola.Value.ToString().ToLower() != percorso.ToString()!.ToLower())
                                                {
                                                    goto setRegole;
                                                }
                                            }
                                            break;
                                        case "C==":
                                            if (double.TryParse(regola.Value.ToString(), out double valore3) &&
double.TryParse(percorso.ToString(), out double valore4))
                                            {
                                                // Confronto numerico
                                                if (valore3 != valore4)
                                                {
                                                    goto setRegole;
                                                }
                                            }
                                            else
                                            {
                                                if (regola.Value.ToString() != percorso.ToString())
                                                {
                                                    goto setRegole;
                                                }
                                            }
                                            break;
                                        case "S==":
                                            if (double.TryParse(regola.Value.ToString(), out double valore5) &&
double.TryParse(percorso.ToString(), out double valore6))
                                            {
                                                // Confronto numerico
                                                if (valore5 != valore6)
                                                {
                                                    goto setRegole;
                                                }
                                            }
                                            else
                                            {
                                                if (regola.Value.ToString().ToLower().Replace(" ", "") != percorso.ToString()!.ToLower().Replace(" ", ""))
                                                {
                                                    goto setRegole;
                                                }
                                            }
                                            break;
                                        case "SC==":
                                            if (double.TryParse(regola.Value.ToString(), out double valore7) &&
double.TryParse(percorso.ToString(), out double valore8))
                                            {
                                                // Confronto numerico
                                                if (valore7 != valore8)
                                                {
                                                    goto setRegole;
                                                }
                                            }
                                            else
                                            {
                                                if (regola.Value.ToString().Replace(" ", "") != percorso.ToString()!.Replace(" ", ""))
                                                {
                                                    goto setRegole;
                                                }
                                            }
                                            break;
                                        case "!=":
                                            if (double.TryParse(regola.Value.ToString(), out double valore9) &&
double.TryParse(percorso.ToString(), out double valore10))
                                            {
                                                // Confronto numerico
                                                if (valore9 == valore10)
                                                {
                                                    goto setRegole;
                                                }
                                            }
                                            else
                                            {
                                                if (regola.Value.ToString().ToLower() == percorso.ToString()!.ToLower())
                                                {
                                                    goto setRegole;
                                                }
                                            }
                                            break;
                                        case "C!=":
                                            if (double.TryParse(regola.Value.ToString(), out double valore11) &&
double.TryParse(percorso.ToString(), out double valore12))
                                            {
                                                // Confronto numerico
                                                if (valore11 == valore12)
                                                {
                                                    goto setRegole;
                                                }
                                            }
                                            else
                                            {
                                                if (regola.Value.ToString() == percorso.ToString())
                                                {
                                                    goto setRegole;
                                                }
                                            }
                                            break;
                                        case "S!=":
                                            if (double.TryParse(regola.Value.ToString(), out double valore13) &&
double.TryParse(percorso.ToString(), out double valore14))
                                            {
                                                // Confronto numerico
                                                if (valore13 == valore14)
                                                {
                                                    goto setRegole;
                                                }
                                            }
                                            else
                                            {
                                                if (regola.Value.ToString().ToLower().Replace(" ", "") == percorso.ToString()!.ToLower().Replace(" ", ""))
                                                {
                                                    goto setRegole;
                                                }
                                            }
                                            break;
                                        case "SC!=":
                                            if (double.TryParse(regola.Value.ToString(), out double valore15) &&
double.TryParse(percorso.ToString(), out double valore16))
                                            {
                                                // Confronto numerico
                                                if (valore15 == valore16)
                                                {
                                                    goto setRegole;
                                                }
                                            }
                                            else
                                            {
                                                if (regola.Value.ToString().Replace(" ", "") == percorso.ToString()!.Replace(" ", ""))
                                                {
                                                    goto setRegole;
                                                }
                                            }
                                            break;
                                        case ">":
                                            if (double.TryParse(percorso.ToString(), out double numericValue) && double.TryParse(regola.Value.ToString(), out double regolaValue))
                                            {
                                                if (numericValue <= regolaValue)
                                                {
                                                    goto setRegole;
                                                }
                                            }
                                            else
                                            {
                                                // campoValue o regolaValue non è un numero
                                                goto setRegole;
                                            }

                                            break;
                                        case "<":

                                            if (double.TryParse(percorso.ToString(), out numericValue) && double.TryParse(regola.Value.ToString(), out regolaValue))
                                            {
                                                if (numericValue >= regolaValue)
                                                {
                                                    goto setRegole;
                                                }
                                            }
                                            else
                                            {
                                                // campoValue o regolaValue non è un numero
                                                goto setRegole;
                                            }
                                            break;
                                        case ">=":
                                            if (double.TryParse(percorso.ToString(), out numericValue) && double.TryParse(regola.Value.ToString(), out regolaValue))
                                            {
                                                if (numericValue < regolaValue)
                                                {
                                                    goto setRegole;
                                                }
                                            }
                                            else
                                            {
                                                // campoValue o regolaValue non è un numero
                                                goto setRegole;
                                            }
                                            break;
                                        case "<=":
                                            if (double.TryParse(percorso.ToString(), out numericValue) && double.TryParse(regola.Value.ToString(), out regolaValue))
                                            {
                                                if (numericValue > regolaValue)
                                                {
                                                    goto setRegole;
                                                }
                                            }
                                            else
                                            {
                                                // campoValue o regolaValue non è un numero
                                                goto setRegole;
                                            }
                                            break;
                                        default:
                                            //Console.WriteLine("Operatore non supportato: " + regola.Operatore);
                                            goto setRegole;
                                    }

                                }

                                var res = leggiRegoleRicorsive(setRegole.regoleAnnidate, item);
                                if (res.Esito)
                                {
                                    codice = def.result;
                                    goto nextLevel;
                                }
                                else if (!res.Esito && res.error != "")
                                {
                                    throw new Exception(res.error);
                                }
                            setRegole: continue;
                            }
                        }
                    nextLevel: continue;
                    }

                    if (codice == "")
                    {
                        codice = frameDB.defaultBox;
                    }
                    return codice;
                }
                else
                {
                    throw new Exception("FrameworkCssDb non trovato");
                }
            }
            catch (Exception ex)
            {
                return "error: " + ex.Message;
            }
        }

        private BoolResult leggiRegoleRicorsive(List<macroRegolaCssFramework> regoleAnnidate, ArticoloInRevisione item)
        {
            BoolResult result = new BoolResult();

            try
            {
                if (regoleAnnidate == null || regoleAnnidate.Count == 0)
                {
                    result.Esito = true;
                    result.error = "";
                    return result;
                }

                foreach (var setRegole in regoleAnnidate)
                {
                    foreach (var regola in setRegole.regole)
                    {
                        if (!getPercorso(item, regola.campo, out var percorso))
                        {
                            if (percorso == null)
                            {
                                goto setRegole;
                            }
                        }

                        if (regola.Value == null)
                        {
                            regola.Value = "";
                        }

                        if (percorso is string)
                        {
                            percorso = percorso.ToString()!.Replace(",", ".");
                        }
                        regola.Value = regola.Value.ToString().Replace(",", ".");

                        switch (regola.Operatore)
                        {
                            case "IN":
                                if ((percorso is IEnumerable enumerableIN) && !(percorso is string))
                                {
                                    var listaDiStringhe = new List<string>();

                                    foreach (var elemento in enumerableIN)
                                    {
                                        if (elemento == null || !(elemento is string || elemento.GetType().IsPrimitive || elemento is IConvertible))
                                        {
                                            // Se l'elemento non è convertibile in stringa, salta direttamente a setRegole
                                            goto setRegole;
                                        }

                                        // Converte l'elemento in stringa e lo trasforma in minuscolo
                                        listaDiStringhe.Add(elemento.ToString()!.ToLower());
                                    }
                                    if (!listaDiStringhe.Contains(regola.Value.ToLower()))
                                    {
                                        goto setRegole;
                                    }
                                }
                                else if (!percorso.ToString()!.ToLower().Contains(regola.Value.ToLower()))
                                {
                                    goto setRegole;
                                }
                                break;
                            case "CIN":
                                if ((percorso is IEnumerable enumerableCIN) && !(percorso is string))
                                {
                                    var listaDiStringhe = new List<string>();

                                    foreach (var elemento in enumerableCIN)
                                    {
                                        if (elemento == null || !(elemento is string || elemento.GetType().IsPrimitive || elemento is IConvertible))
                                        {
                                            // Se l'elemento non è convertibile in stringa, salta direttamente a setRegole
                                            goto setRegole;
                                        }

                                        // Converte l'elemento in stringa e lo trasforma in minuscolo
                                        listaDiStringhe.Add(elemento.ToString()!);
                                    }
                                    if (!listaDiStringhe.Contains(regola.Value))
                                    {
                                        goto setRegole;
                                    }
                                }
                                if (!percorso.ToString()!.Contains(regola.Value))
                                {
                                    goto setRegole;
                                }
                                break;
                            case "SIN":
                                if ((percorso is IEnumerable enumerableSIN) && !(percorso is string))
                                {
                                    var listaDiStringhe = new List<string>();

                                    foreach (var elemento in enumerableSIN)
                                    {
                                        if (elemento == null || !(elemento is string || elemento.GetType().IsPrimitive || elemento is IConvertible))
                                        {
                                            // Se l'elemento non è convertibile in stringa, salta direttamente a setRegole
                                            goto setRegole;
                                        }

                                        // Converte l'elemento in stringa e lo trasforma in minuscolo
                                        listaDiStringhe.Add(elemento.ToString()!.ToLower().Replace(" ", ""));
                                    }
                                    if (!listaDiStringhe.Contains(regola.Value.ToLower().Replace(" ", "")))
                                    {
                                        goto setRegole;
                                    }
                                }
                                if (!percorso.ToString()!.ToLower().Replace(" ", "").Contains(regola.Value.Replace(" ", "").ToLower()))
                                {
                                    goto setRegole;
                                }
                                break;
                            case "SCIN":
                                if ((percorso is IEnumerable enumerableSCIN) && !(percorso is string))
                                {
                                    var listaDiStringhe = new List<string>();

                                    foreach (var elemento in enumerableSCIN)
                                    {
                                        if (elemento == null || !(elemento is string || elemento.GetType().IsPrimitive || elemento is IConvertible))
                                        {
                                            // Se l'elemento non è convertibile in stringa, salta direttamente a setRegole
                                            goto setRegole;
                                        }

                                        // Converte l'elemento in stringa e lo trasforma in minuscolo
                                        listaDiStringhe.Add(elemento.ToString()!.Replace(" ", ""));
                                    }
                                    if (!listaDiStringhe.Contains(regola.Value.Replace(" ", "")))
                                    {
                                        goto setRegole;
                                    }
                                }
                                if (!percorso.ToString()!.Replace(" ", "").Contains(regola.Value.Replace(" ", "")))
                                {
                                    goto setRegole;
                                }
                                break;
                            case "!IN":
                                if ((percorso is IEnumerable enumerableNIN) && !(percorso is string))
                                {
                                    var listaDiStringhe = new List<string>();

                                    foreach (var elemento in enumerableNIN)
                                    {
                                        if (elemento == null || !(elemento is string || elemento.GetType().IsPrimitive || elemento is IConvertible))
                                        {
                                            // Se l'elemento non è convertibile in stringa, salta direttamente a setRegole
                                            goto setRegole;
                                        }

                                        // Converte l'elemento in stringa e lo trasforma in minuscolo
                                        listaDiStringhe.Add(elemento.ToString()!.ToLower());
                                    }
                                    if (listaDiStringhe.Contains(regola.Value.ToLower()))
                                    {
                                        goto setRegole;
                                    }
                                }
                                if (percorso.ToString()!.ToLower().Contains(regola.Value.ToLower()))
                                {
                                    goto setRegole;
                                }
                                break;
                            case "C!IN":
                                if ((percorso is IEnumerable enumerableCNIN) && !(percorso is string))
                                {
                                    var listaDiStringhe = new List<string>();

                                    foreach (var elemento in enumerableCNIN)
                                    {
                                        if (elemento == null || !(elemento is string || elemento.GetType().IsPrimitive || elemento is IConvertible))
                                        {
                                            // Se l'elemento non è convertibile in stringa, salta direttamente a setRegole
                                            goto setRegole;
                                        }

                                        // Converte l'elemento in stringa e lo trasforma in minuscolo
                                        listaDiStringhe.Add(elemento.ToString()!);
                                    }
                                    if (listaDiStringhe.Contains(regola.Value))
                                    {
                                        goto setRegole;
                                    }
                                }
                                if (percorso.ToString()!.Contains(regola.Value))
                                {
                                    goto setRegole;
                                }
                                break;
                            case "S!IN":
                                if ((percorso is IEnumerable enumerableSNIN) && !(percorso is string))
                                {
                                    var listaDiStringhe = new List<string>();

                                    foreach (var elemento in enumerableSNIN)
                                    {
                                        if (elemento == null || !(elemento is string || elemento.GetType().IsPrimitive || elemento is IConvertible))
                                        {
                                            // Se l'elemento non è convertibile in stringa, salta direttamente a setRegole
                                            goto setRegole;
                                        }

                                        // Converte l'elemento in stringa e lo trasforma in minuscolo
                                        listaDiStringhe.Add(elemento.ToString()!.ToLower().Replace(" ", ""));
                                    }
                                    if (listaDiStringhe.Contains(regola.Value.ToLower().Replace(" ", "")))
                                    {
                                        goto setRegole;
                                    }
                                }
                                if (percorso.ToString()!.ToLower().Replace(" ", "").Contains(regola.Value.ToLower().Replace(" ", "")))
                                {
                                    goto setRegole;
                                }
                                break;
                            case "SC!IN":
                                if ((percorso is IEnumerable enumerableSCNIN) && !(percorso is string))
                                {
                                    var listaDiStringhe = new List<string>();

                                    foreach (var elemento in enumerableSCNIN)
                                    {
                                        if (elemento == null || !(elemento is string || elemento.GetType().IsPrimitive || elemento is IConvertible))
                                        {
                                            // Se l'elemento non è convertibile in stringa, salta direttamente a setRegole
                                            goto setRegole;
                                        }

                                        // Converte l'elemento in stringa e lo trasforma in minuscolo
                                        listaDiStringhe.Add(elemento.ToString()!.Replace(" ", ""));
                                    }
                                    if (listaDiStringhe.Contains(regola.Value.Replace(" ", "")))
                                    {
                                        goto setRegole;
                                    }
                                }
                                if (percorso.ToString()!.Replace(" ", "").Contains(regola.Value.Replace(" ", "")))
                                {
                                    goto setRegole;
                                }
                                break;
                            case "==":
                                if (double.TryParse(regola.Value.ToString(), out double valore1) &&
double.TryParse(percorso.ToString(), out double valore2))
                                {
                                    // Confronto numerico
                                    if (valore1 != valore2)
                                    {
                                        goto setRegole;
                                    }
                                }
                                else
                                {
                                    if (regola.Value.ToString().ToLower() != percorso.ToString()!.ToLower())
                                    {
                                        goto setRegole;
                                    }
                                }
                                break;
                            case "C==":
                                if (double.TryParse(regola.Value.ToString(), out double valore3) &&
double.TryParse(percorso.ToString(), out double valore4))
                                {
                                    // Confronto numerico
                                    if (valore3 != valore4)
                                    {
                                        goto setRegole;
                                    }
                                }
                                else
                                {
                                    if (regola.Value.ToString() != percorso.ToString())
                                    {
                                        goto setRegole;
                                    }
                                }
                                break;
                            case "S==":
                                if (double.TryParse(regola.Value.ToString(), out double valore5) &&
double.TryParse(percorso.ToString(), out double valore6))
                                {
                                    // Confronto numerico
                                    if (valore5 != valore6)
                                    {
                                        goto setRegole;
                                    }
                                }
                                else
                                {
                                    if (regola.Value.ToString().ToLower().Replace(" ", "") != percorso.ToString()!.ToLower().Replace(" ", ""))
                                    {
                                        goto setRegole;
                                    }
                                }
                                break;
                            case "SC==":
                                if (double.TryParse(regola.Value.ToString(), out double valore7) &&
double.TryParse(percorso.ToString(), out double valore8))
                                {
                                    // Confronto numerico
                                    if (valore7 != valore8)
                                    {
                                        goto setRegole;
                                    }
                                }
                                else
                                {
                                    if (regola.Value.ToString().Replace(" ", "") != percorso.ToString()!.Replace(" ", ""))
                                    {
                                        goto setRegole;
                                    }
                                }
                                break;
                            case "!=":
                                if (double.TryParse(regola.Value.ToString(), out double valore9) &&
double.TryParse(percorso.ToString(), out double valore10))
                                {
                                    // Confronto numerico
                                    if (valore9 == valore10)
                                    {
                                        goto setRegole;
                                    }
                                }
                                else
                                {
                                    if (regola.Value.ToString().ToLower() == percorso.ToString()!.ToLower())
                                    {
                                        goto setRegole;
                                    }
                                }
                                break;
                            case "C!=":
                                if (double.TryParse(regola.Value.ToString(), out double valore11) &&
double.TryParse(percorso.ToString(), out double valore12))
                                {
                                    // Confronto numerico
                                    if (valore11 == valore12)
                                    {
                                        goto setRegole;
                                    }
                                }
                                else
                                {
                                    if (regola.Value.ToString() == percorso.ToString())
                                    {
                                        goto setRegole;
                                    }
                                }
                                break;
                            case "S!=":
                                if (double.TryParse(regola.Value.ToString(), out double valore13) &&
double.TryParse(percorso.ToString(), out double valore14))
                                {
                                    // Confronto numerico
                                    if (valore13 == valore14)
                                    {
                                        goto setRegole;
                                    }
                                }
                                else
                                {
                                    if (regola.Value.ToString().ToLower().Replace(" ", "") == percorso.ToString()!.ToLower().Replace(" ", ""))
                                    {
                                        goto setRegole;
                                    }
                                }
                                break;
                            case "SC!=":
                                if (double.TryParse(regola.Value.ToString(), out double valore15) &&
double.TryParse(percorso.ToString(), out double valore16))
                                {
                                    // Confronto numerico
                                    if (valore15 == valore16)
                                    {
                                        goto setRegole;
                                    }
                                }
                                else
                                {
                                    if (regola.Value.ToString().Replace(" ", "") == percorso.ToString()!.Replace(" ", ""))
                                    {
                                        goto setRegole;
                                    }
                                }
                                break;
                            case ">":
                                if (double.TryParse(percorso.ToString(), out double numericValue) && double.TryParse(regola.Value.ToString(), out double regolaValue))
                                {
                                    if (numericValue <= regolaValue)
                                    {
                                        goto setRegole;
                                    }
                                }
                                else
                                {
                                    // campoValue o regolaValue non è un numero
                                    goto setRegole;
                                }

                                break;
                            case "<":

                                if (double.TryParse(percorso.ToString(), out numericValue) && double.TryParse(regola.Value.ToString(), out regolaValue))
                                {
                                    if (numericValue >= regolaValue)
                                    {
                                        goto setRegole;
                                    }
                                }
                                else
                                {
                                    // campoValue o regolaValue non è un numero
                                    goto setRegole;
                                }
                                break;
                            case ">=":
                                if (double.TryParse(percorso.ToString(), out numericValue) && double.TryParse(regola.Value.ToString(), out regolaValue))
                                {
                                    if (numericValue < regolaValue)
                                    {
                                        goto setRegole;
                                    }
                                }
                                else
                                {
                                    // campoValue o regolaValue non è un numero
                                    goto setRegole;
                                }
                                break;
                            case "<=":
                                if (double.TryParse(percorso.ToString(), out numericValue) && double.TryParse(regola.Value.ToString(), out regolaValue))
                                {
                                    if (numericValue > regolaValue)
                                    {
                                        goto setRegole;
                                    }
                                }
                                else
                                {
                                    // campoValue o regolaValue non è un numero
                                    goto setRegole;
                                }
                                break;
                            default:
                                //Console.WriteLine("Operatore non supportato: " + regola.Operatore);
                                goto setRegole;
                        }
                    }
                    var res = leggiRegoleRicorsive(setRegole.regoleAnnidate, item);
                    if (res.Esito)
                    {
                        return res;
                    }
                    else if (!res.Esito && res.error != "")
                    {
                        return res;
                    }
                setRegole: continue;
                }

                result.Esito = false;
                return result;
            }
            catch (Exception ex)
            {
                result.Esito = false;
                result.error = ex.ToString();
                return result;
            }
        }

        static IEnumerable<IEnumerable<DeclinazioneMeccanica>> GetCartesianProduct(List<List<DeclinazioneMeccanica>> lists)
        {
            IEnumerable<IEnumerable<DeclinazioneMeccanica>> result = new[] { Enumerable.Empty<DeclinazioneMeccanica>() };
            foreach (var list in lists)
            {
                result = from prev in result
                         from item in list
                         select prev.Concat(new[] { item });
            }
            return result;
        }

        //static IEnumerable<MeccanicheLivello> GetCartesianProduct(List<MeccanicheLivello> lists)
        //{
        //    // Inizializziamo con un IEnumerable contenente un singolo elemento vuoto
        //    IEnumerable<MeccanicheLivello> result = new[] { new MeccanicheLivello(0) };

        //    foreach (var list in lists)
        //    {
        //        result = from prev in result
        //                 from item in list.Meccaniche
        //                 select new MeccanicheLivello(prev.Livello)
        //                 {
        //                     Meccaniche = prev.Meccaniche.Concat(new[] { item }).ToList()
        //                 };
        //    }

        //    return result;
        //}


        public List<int> CalcolaSpazi(string FormatoPag, int IndiceRef, string FormatoRef)
        {

            List<int> listIndexRequired = new List<int>();

            string[] righexColonne = FormatoRef.Split("x");
            string[] paginaRighexColonne = FormatoPag.Split("x");

            int ColonnaRefStart = (int)Math.Truncate((double)(IndiceRef - 1) / Convert.ToInt16(paginaRighexColonne[0]));

            if (Convert.ToInt16(paginaRighexColonne[0]) < ((Convert.ToInt16(righexColonne[0]) + ((IndiceRef - 1)) % Convert.ToInt16(paginaRighexColonne[0]))) || Convert.ToInt16(paginaRighexColonne[1]) < Convert.ToInt16(righexColonne[1]) + ColonnaRefStart)
            {
                return (listIndexRequired);
            }

            for (int i = 0; i < Convert.ToInt16(righexColonne[1]); i++)
            {
                for (int i2 = 0; i2 < Convert.ToInt16(righexColonne[0]); i2++)
                {
                    int result = IndiceRef + i2 + (i * Convert.ToInt16(paginaRighexColonne[0]));
                    listIndexRequired.Add(result);
                }
            }
            return (listIndexRequired);
        }



        //[HttpPut]
        //[Route("Menabo/selezioneRefInMenabo")]
        //public async Task<IActionResult> selezioneRefInMenabo(PromoTracciatiRecord rec)
        //{
        //    BoolResult result = new BoolResult();

        //    try
        //    {
        //        PromoTracciatiRecord _rec = await this.ctx2.PromoTracciatiRecords.Where(mp => mp.Id == rec.Id).FirstOrDefaultAsync();

        //        if (_rec != null)
        //        {
        //            //Al momento posso editare solo l'indice                    
        //            //_rec.SelezioneMenabo = rec.SelezioneMenabo;
        //            this.ctx2.SaveChanges();

        //            return Ok(_rec);
        //        }
        //        else
        //        {
        //            throw new Exception("Record non trovato nel tracciato");
        //        }

        //    }
        //    catch (Exception ex)
        //    {
        //        result.error = ex.Message;
        //    }

        //    return Ok(result);
        //}

        // +--- DEPRECATO --- 9/9/2026 -------------------------------------------------
        // COSA        la rotta Menabo/esporta e il metodo esporta(InputForExport).
        // PERCHE      Confermato da Michele il 9/9/2026: sostituita dall'omonima Esporta
        //             dentro AgenziaLib, una per cliente. La logica di impacchettamento
        //             verso il volantino e passata di la.
        // NON CANCELLARE: da valutare in un futuro lavoro di pulizia.
        // +---------------------------------------------------------------------------
        [HttpPut]
        [Route("Menabo/esporta")]
        public async Task<IActionResult> esporta(InputForExport req)
        {
            AttivitaResult result = new AttivitaResult();

            try
            {
                OperationRequest op = new OperationRequest();
                op.Command = OperationCommand.EsportazioneVol;//EsportazionePoP;//

                if (req.fields!.ContainsKey("id_tracciato"))
                {
                    Int32 id_tracciato = Int32.Parse(req.fields["id_tracciato"]);
                    PromoTracciati? pItem = await this.ctx2.PromoTracciatis.Where(t => t.Id == id_tracciato).FirstOrDefaultAsync();
                    req.fields.Add("Titolo", Utility.Main.getJsonObject(pItem!.Meta!)!["NomeEsportazione"].ToString()!);
                }

                op.Packet = req;


                //Registro l'operazione, Ottengo così l'ID e preparo la cartella per l'elaborazione
                OperationsController op_ctrl = new OperationsController(_config.GetConnectionString("IstandaConnectionDb")!, "", "", dbContextFactory2: this._dbContextFactory2);
                var actionResult = await op_ctrl.Add(op);


                try
                {
                    OkObjectResult res = (OkObjectResult)actionResult;
                    if (res.Value is Attivitum)
                    {
                        Attivitum obj = (Attivitum)res.Value!;
                        result.Attivita = obj;

                    }

                }
                catch (Exception ex)
                {
                    result.errorCode = ErrorCodes.Generic;
                    result.error = ex.ToString();
                    return Ok(result);
                }

            }
            catch (Exception ex)
            {
                result.error = ex.Message;
            }

            return Ok(result);
        }

        [HttpGet]
        [Route("Menabo/donwloadPacchettoFoto/{id_tracciato}")]
        public async Task<IActionResult> downloadPacchettoFoto(int id_tracciato)
        {
            //AttivitaResult result = new AttivitaResult();
            returnFotoZip result = new returnFotoZip();
            //Response.Write("ESPORTAZIONE PER " + tItem.area + " - " + tItem.nome_esportazione + " materiale " + materiale_pop_singolo + "  conteggio liste =" + parco_liste.Count+"<br>");

            DbUnitaItem? alta_folder = null;
            Dictionary<string, string> fotoRichieste = new Dictionary<string, string>();
            IstantaLib.PhotoManager ph = new IstantaLib.PhotoManager();

            try
            {
                JObject o1 = JObject.Parse(System.IO.File.ReadAllText(this.path_external_source + "SourceUnita.json"));
                DbUnita? archiviDB = o1.ToObject<DbUnita>();
                alta_folder = archiviDB!.source.Where(s => !s.webFolder && !s.syncFolder && !s.exportFolder).FirstOrDefault()!;



                //Scarico tutti i dati json di tutti gli articoli in tracciato
                List<string> tRecordsJson = this.ctx2.PromoTracciatiRecords.Where(t => t.IdTracciato == id_tracciato)
                .Select(t => t.Codice!).ToList();





                //Qui devo prendere la descrizione revisionata dell'articolo singolo piazzato in menabo
                List<Articoli> artItems = this.ctx.Articolis
    .Include(s => s.ArticoliFotos)
    .Where(a => tRecordsJson.Contains(a.Codice))
    .ToList();


                foreach (var art in artItems)
                {
                    ArticoliFoto? af = art.ArticoliFotos!.Where(f => (!f.Tipo.HasValue || f.Tipo == (Byte)TipoFoto.Foto) && f.Attiva == true).OrderByDescending(o => o.DataModifica).FirstOrDefault();//.Where(af => af.StatoSelezione == (Byte)StatoSelezioneFoto.Primaria).OrderByDescending(o => o.DataModifica).ThenByDescending(o2 => o2.DataInserimento).FirstOrDefault();
                    if (af != null)
                    {
                        //ATTENZIONE: controlliamo che qui non incida sul db realmente
                        fotoRichieste[art.Codice] = af.NomeReale;
                    }
                    else
                    {
                        fotoRichieste[art.Codice] = art.Codice + ".psd";
                    }
                }

            }
            catch (Exception ex)
            {
                result.esito = false;
                result.error = ex.ToString();
                return Ok(result);
            }


            Dictionary<string, object> altaPathObject = new Dictionary<string, object>();
            string altapathJsonRString = "";
            try
            {
                altapathJsonRString = Newtonsoft.Json.JsonConvert.SerializeObject(alta_folder);
                altaPathObject = Newtonsoft.Json.JsonConvert.DeserializeObject<Dictionary<string, object>>(altapathJsonRString)!;
                var res = ph.generaPacchettoFoto(fotoRichieste, altaPathObject); //-> Questa funzione deve creare lo zip e tornarti indietro il percorso
                if (!res.esito)
                {
                    throw new Exception(res.error);
                }

                result.zipName = res.zipName;
                result.esito = true;
                //byte[] reportBytes = System.IO.File.ReadAllBytes(fileContent);
                return Ok(result);// File(reportBytes, "application/octet-stream", new FileInfo(fileContent).Name);
            }
            catch (Exception ex)
            {
                result.esito = false;
                result.error = ex.ToString() + " altaPathObjectIsNull: " + (altaPathObject == null || altaPathObject.Count == 0) + " fotoRichiesteIsNull: " + (fotoRichieste == null || fotoRichieste.Count == 0) + " phIsNull: " + (ph == null) + " altapathJsonRString: " + altapathJsonRString;
                return Ok(result);
            }
            //return Ok("linkDownload");

        }

        // +--- DEPRECATO --- 9/9/2026 -------------------------------------------------
        // COSA        la rotta Menabo/esportaPoP e il metodo esportaPoP(InputForExport).
        // PERCHE      Confermato da Michele il 9/9/2026: sostituita da EsportaPoP dentro
        //             AgenziaLib, una per cliente.
        // NON CANCELLARE: da valutare in un futuro lavoro di pulizia.
        // +---------------------------------------------------------------------------
        [HttpPut]
        [Route("Menabo/esportaPoP")]
        public async Task<IActionResult> esportaPoP(InputForExport req)
        {
            AttivitaResult result = new AttivitaResult();

            try
            {
                OperationRequest op = new OperationRequest();
                op.Command = OperationCommand.EsportazionePoP;

                if (req.fields!.ContainsKey("id_tracciato"))
                {
                    Int32 id_tracciato = Int32.Parse(req.fields["id_tracciato"]);
                    PromoTracciati? pItem = await this.ctx2.PromoTracciatis.Where(t => t.Id == id_tracciato).FirstOrDefaultAsync();
                    req.fields.Add("Titolo", Utility.Main.getJsonObject(pItem!.Meta!)!["NomeEsportazione"].ToString()!);
                }

                op.Packet = req;


                //Registro l'operazione, Ottengo così l'ID e preparo la cartella per l'elaborazione
                OperationsController op_ctrl = new OperationsController(_config.GetConnectionString("IstandaConnectionDb")!, "", "", dbContextFactory2: this._dbContextFactory2);
                var actionResult = await op_ctrl.Add(op);


                try
                {
                    OkObjectResult res = (OkObjectResult)actionResult;
                    if (res.Value is Attivitum)
                    {
                        Attivitum obj = (Attivitum)res.Value!;
                        result.Attivita = obj;

                    }

                }
                catch (Exception ex)
                {
                    result.errorCode = ErrorCodes.Generic;
                    result.error = ex.ToString();
                    return Ok(result);
                }

            }
            catch (Exception ex)
            {
                result.error = ex.Message;
            }

            return Ok(result);
        }
        protected void Bind()
        {
            JObject oMastro = JObject.Parse(System.IO.File.ReadAllText(this.path_external_source + "SourceMastro.json"));
            DbMastro? mastroDB = oMastro.ToObject<DbMastro>();
            ViewBag.MastroSource = mastroDB!.source;
            try
            {
                JObject oMecc = JObject.Parse(System.IO.File.ReadAllText(this.path_external_source + "SourceMeccaniche.json"));
                DbMeccaniche? meccDB = oMecc.ToObject<DbMeccaniche>();
                ViewBag.MaccanicheSource = meccDB!.source;
            }
            catch (Exception exSilenzioso)
            {
                Console.WriteLine($"[catch muto] MenaboController.cs riga ~6355: {exSilenzioso.Message}");
            }
        }

        [HttpGet]
        [Route("Menabo/SvuotaPagina/{idKit}/{pagSelected}")]
        public async Task<IActionResult> SvuotaPagina(Int64 idKit, Int64 pagSelected)
        {
            BoolResult result = new BoolResult();
            try
            {
                var itemsToRemove = this.ctx2.PromoLavorazioniRecords.Where(item => item.IdLavorazione == idKit && item.Pagina == pagSelected).ToList();

                // Rimuove tutti gli elementi trovati
                this.ctx2.PromoLavorazioniRecords.RemoveRange(itemsToRemove);

                this.ctx2.SaveChanges();
                result.Esito = true;
                return Ok(result);

            }
            catch (Exception ex)
            {
                result.Esito = false;
                result.error = ex.ToString();
                return Ok(result);
            }
        }

        [HttpGet]
        [Route("Menabo/svuotaMenabo/{idKit}")]
        public async Task<IActionResult> svuotaMenabo(int idKit)
        {
            BoolResult result = new BoolResult();
            try
            {
                var itemsToRemove = this.ctx2.PromoLavorazioniRecords.Where(item => item.IdLavorazione == idKit).ToList();

                // Rimuove tutti gli elementi trovati
                this.ctx2.PromoLavorazioniRecords.RemoveRange(itemsToRemove);

                this.ctx2.SaveChanges();
                result.Esito = true;
            }
            catch (Exception ex)
            {
                result.Esito = false;
                result.error = ex.ToString();
            }

            return Ok(result);
        }


        [HttpGet]
        [Route("Menabo/cambiaFormato/{idPagina}/{idorCodice}/{meccanica}")]
        public async Task<IActionResult> cambiaFormato(int idPagina, string idorCodice, string meccanica)
        {
            BoolResult result = new BoolResult();
            try
            {
                bool isGruppo = idorCodice.Contains(",");
                MenaboRef? refSelcted = new MenaboRef();
                if (isGruppo)
                {
                    refSelcted = await this.ctx2.MenaboRefs.Where(p => p.IdPagina == idPagina && p.CodiceGruppo == idorCodice).FirstOrDefaultAsync();
                }
                else
                {
                    refSelcted = await this.ctx2.MenaboRefs.Where(p => p.IdRecord == Convert.ToInt32(idorCodice)).FirstOrDefaultAsync();
                }
                refSelcted!.Formato = meccanica;
                List<MenaboRef> refMultiplex = await this.ctx2.MenaboRefs.Where(p => p.IdPagina == idPagina && p.Indice == refSelcted.Indice && p.Id != refSelcted.Id).ToListAsync();
                List<MenaboRef> copyRefMultiplex = new List<MenaboRef>();
                copyRefMultiplex.AddRange(refMultiplex);
                foreach (var item in copyRefMultiplex)
                {
                    refMultiplex.Find(f => f.Id == item!.Id)!.Formato = meccanica;
                }
                this.ctx2.SaveChanges();
                result.Esito = true;
            }
            catch (Exception ex)
            {
                result.error = ex.Message;
            }

            return Ok(result);
        }

        [HttpPut]
        [Route("Menabo/cambiaFormatoNew/{idPagina}/{idorCodice}")]
        public async Task<IActionResult> cambiaFormato(int idPagina, string idorCodice, Meccanica meccanica)
        {
            BoolResult result = new BoolResult();
            try
            {
                bool isGruppo = idorCodice.Contains(",");
                MenaboRef? refSelcted = new MenaboRef();
                if (isGruppo)
                {
                    refSelcted = await this.ctx2.MenaboRefs.Where(p => p.IdPagina == idPagina && p.CodiceGruppo == idorCodice).FirstOrDefaultAsync();
                }
                else
                {
                    refSelcted = await this.ctx2.MenaboRefs.Where(p => p.IdRecord == Convert.ToInt32(idorCodice)).FirstOrDefaultAsync();
                }
                refSelcted!.Formato = meccanica.meccanicaName;
                List<MenaboRef> refMultiplex = await this.ctx2.MenaboRefs.Where(p => p.IdPagina == idPagina && p.Indice == refSelcted.Indice && p.Id != refSelcted.Id).ToListAsync();
                List<MenaboRef> copyRefMultiplex = new List<MenaboRef>();
                copyRefMultiplex.AddRange(refMultiplex);
                foreach (var item in copyRefMultiplex)
                {
                    refMultiplex.Find(f => f.Id == item.Id)!.Formato = meccanica.meccanicaName;
                }
                this.ctx2.SaveChanges();
                result.Esito = true;
            }
            catch (Exception ex)
            {
                result.error = ex.Message;
            }

            return Ok(result);
        }

        public async Task<IActionResult> RimuoviMultiplex(Int64 id_pag, int Indice, string idOrCod, int idTracciato)
        {
            string key_codice_multiplex = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppoMultiplex;
            string key_codice_referenza = Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice;
            BoolResult result = new BoolResult();
            try
            {

                bool isGruppo = idOrCod.Contains(",");

                if (isGruppo)
                {
                    string[] codiciDelGruppo = idOrCod.Split(",");
                    List<MenaboRef> refDaModificare = await this.ctx2.MenaboRefs.Where(p => p.IdPagina == id_pag && p.Indice == Indice && p.CodiceGruppo != idOrCod).ToListAsync();
                    List<PromoTracciatiRecord> recordDelGruppoDaRimuovere = await this.ctx2.PromoTracciatiRecords.Where(p => p.CodiceGruppo == idOrCod && p.IdTracciato == idTracciato).ToListAsync();
                    foreach (PromoTracciatiRecord promo in recordDelGruppoDaRimuovere)
                    {
                        Dictionary<string, object>? DatoDaRimuovere = JsonConvert.DeserializeObject<Dictionary<string, object>>(promo.Dato!);
                        DatoDaRimuovere!.Remove(key_codice_multiplex);
                        promo.Dato = JsonConvert.SerializeObject(DatoDaRimuovere);
                    }


                    if (refDaModificare.Count == 1)
                    {
                        foreach (MenaboRef r in refDaModificare)
                        {
                            if (r.CodiceGruppo != null)
                            {
                                List<PromoTracciatiRecord> records = await this.ctx2.PromoTracciatiRecords.Where(p => p.CodiceGruppo == r.CodiceGruppo && idTracciato == p.IdTracciato).ToListAsync();
                                foreach (PromoTracciatiRecord record in records)
                                {
                                    if (record == null)
                                    {
                                        throw new Exception("Referenza mancante in PromoTracciatiRecord, incongruenza nel database");
                                    }
                                    Dictionary<string, object>? Dato = JsonConvert.DeserializeObject<Dictionary<string, object>>(record.Dato!);
                                    Dato!.Remove(key_codice_multiplex);
                                    record.Dato = JsonConvert.SerializeObject(Dato);
                                }
                            }
                            else
                            {
                                PromoTracciatiRecord? record = await this.ctx2.PromoTracciatiRecords.Where(p => p.Id == r.IdRecord).FirstOrDefaultAsync();
                                if (record == null)
                                {
                                    throw new Exception("Referenza mancante in PromoTracciatiRecord, incongruenza nel database");
                                }
                                Dictionary<string, object>? Dato = JsonConvert.DeserializeObject<Dictionary<string, object>>(record.Dato!);
                                Dato!.Remove(key_codice_multiplex);
                                record.Dato = JsonConvert.SerializeObject(Dato);
                            }
                        }
                        return Ok("");
                    }
                    else
                    {
                        string codiceMultiplex = "";
                        foreach (MenaboRef r in refDaModificare)
                        {
                            if (r.CodiceGruppo != null)
                            {
                                List<PromoTracciatiRecord> records = await this.ctx2.PromoTracciatiRecords.Where(p => p.CodiceGruppo == r.CodiceGruppo && idTracciato == p.IdTracciato).ToListAsync();
                                foreach (PromoTracciatiRecord record in records)
                                {
                                    if (record == null)
                                    {
                                        throw new Exception("Referenza mancante in PromoTracciatiRecord, incongruenza nel database");
                                    }
                                    //if (record. == idOrCod)
                                    //{

                                    //}
                                    Dictionary<string, object>? Dato = JsonConvert.DeserializeObject<Dictionary<string, object>>(record.Dato!);
                                    string? outputString = Dato![key_codice_multiplex].ToString();

                                    foreach (string codice in codiciDelGruppo)
                                    {
                                        outputString = outputString!.Replace(codice, "");
                                        outputString = outputString.Replace(",,", ",");
                                        char firstChar = outputString[0];
                                        if (firstChar == ',')
                                        {
                                            outputString = outputString.Substring(1);
                                        }
                                        char lastChar = outputString.Substring(outputString.Length - 1, 1)[0];
                                        if (lastChar == ',')
                                        {
                                            outputString = outputString.Substring(0, outputString.Length - 1);
                                        }
                                    }

                                    Dato[key_codice_multiplex] = outputString!;
                                    codiceMultiplex = outputString!;
                                    record.Dato = JsonConvert.SerializeObject(Dato);
                                }
                            }
                            else
                            {
                                PromoTracciatiRecord? record = await this.ctx2.PromoTracciatiRecords.Where(p => p.Id == r.IdRecord).FirstOrDefaultAsync();
                                if (record == null)
                                {
                                    throw new Exception("Referenza mancante in PromoTracciatiRecord, incongruenza nel database");
                                }
                                Dictionary<string, object>? Dato = JsonConvert.DeserializeObject<Dictionary<string, object>>(record.Dato!);
                                string? outputString = Dato![key_codice_multiplex].ToString();

                                foreach (string codice in codiciDelGruppo)
                                {
                                    outputString = outputString!.Replace(codice, "");
                                    outputString = outputString.Replace(",,", ",");
                                    char firstChar = outputString[0];
                                    if (firstChar == ',')
                                    {
                                        outputString = outputString.Substring(1);
                                    }
                                    char lastChar = outputString.Substring(outputString.Length - 1, 1)[0];
                                    if (lastChar == ',')
                                    {
                                        outputString = outputString.Substring(0, outputString.Length - 1);
                                    }
                                }

                                Dato[key_codice_multiplex] = outputString!;
                                record.Dato = JsonConvert.SerializeObject(Dato);
                                codiceMultiplex = outputString!;
                            }
                            //this.ctx2.SaveChanges();                       
                        }
                        return Ok(codiceMultiplex);
                    }
                }
                else
                {
                    MenaboRef? _ref = await this.ctx2.MenaboRefs.Where(p => p.IdRecord == Int64.Parse(idOrCod)).FirstOrDefaultAsync();
                    PromoTracciatiRecord? recordDaRimuovere = await this.ctx2.PromoTracciatiRecords.Where(p => p.Id == _ref!.IdRecord).FirstOrDefaultAsync();
                    Dictionary<string, object>? DatoDaRimuovere = JsonConvert.DeserializeObject<Dictionary<string, object>>(recordDaRimuovere!.Dato!);
                    DatoDaRimuovere!.Remove(key_codice_multiplex);
                    recordDaRimuovere.Dato = JsonConvert.SerializeObject(DatoDaRimuovere);
                    List<MenaboRef> refDaModificare = await this.ctx2.MenaboRefs.Where(p => p.IdPagina == id_pag && p.Indice == Indice && p.IdRecord != Int64.Parse(idOrCod)).ToListAsync();
                    if (refDaModificare.Count == 1)
                    {
                        foreach (MenaboRef r in refDaModificare)
                        {
                            if (r.CodiceGruppo != null)
                            {
                                List<PromoTracciatiRecord> records = await this.ctx2.PromoTracciatiRecords.Where(p => p.CodiceGruppo == r.CodiceGruppo && idTracciato == p.IdTracciato).ToListAsync();
                                foreach (PromoTracciatiRecord record in records)
                                {
                                    if (record == null)
                                    {
                                        throw new Exception("Referenza mancante in PromoTracciatiRecord, incongruenza nel database");
                                    }
                                    Dictionary<string, object>? Dato = JsonConvert.DeserializeObject<Dictionary<string, object>>(record.Dato!);
                                    Dato!.Remove(key_codice_multiplex);
                                    record.Dato = JsonConvert.SerializeObject(Dato);
                                }
                            }
                            else
                            {
                                PromoTracciatiRecord? record = await this.ctx2.PromoTracciatiRecords.Where(p => p.Id == r.IdRecord).FirstOrDefaultAsync();
                                if (record == null)
                                {
                                    throw new Exception("Referenza mancante in PromoTracciatiRecord, incongruenza nel database");
                                }
                                Dictionary<string, object>? Dato = JsonConvert.DeserializeObject<Dictionary<string, object>>(record.Dato!);
                                Dato!.Remove(key_codice_multiplex);
                                record.Dato = JsonConvert.SerializeObject(Dato);
                            }
                        }
                        return Ok("");
                    }
                    else
                    {
                        foreach (MenaboRef r in refDaModificare)
                        {
                            if (r.CodiceGruppo != null)
                            {
                                List<PromoTracciatiRecord> records = await this.ctx2.PromoTracciatiRecords.Where(p => p.CodiceGruppo == r.CodiceGruppo && idTracciato == p.IdTracciato).ToListAsync();
                                foreach (PromoTracciatiRecord record in records)
                                {
                                    if (record == null)
                                    {
                                        throw new Exception("Referenza mancante in PromoTracciatiRecord, incongruenza nel database");
                                    }
                                    Dictionary<string, object>? Dato = JsonConvert.DeserializeObject<Dictionary<string, object>>(record.Dato!);
                                    string? outputString = Dato![key_codice_multiplex].ToString();

                                    outputString = outputString!.Replace(DatoDaRimuovere[key_codice_referenza].ToString()!, "");
                                    outputString = outputString.Replace(",,", ",");
                                    char firstChar = outputString[0];
                                    if (firstChar == ',')
                                    {
                                        outputString = outputString.Substring(1);
                                    }
                                    char lastChar = outputString.Substring(outputString.Length - 1, 1)[0];
                                    if (lastChar == ',')
                                    {
                                        outputString = outputString.Substring(0, outputString.Length - 1);
                                    }

                                    Dato[key_codice_multiplex] = outputString;
                                    record.Dato = JsonConvert.SerializeObject(Dato);
                                }
                            }
                            else
                            {
                                PromoTracciatiRecord? record = await this.ctx2.PromoTracciatiRecords.Where(p => p.Id == r.IdRecord).FirstOrDefaultAsync();
                                if (record == null)
                                {
                                    throw new Exception("Referenza mancante in PromoTracciatiRecord, incongruenza nel database");
                                }
                                Dictionary<string, object>? Dato = JsonConvert.DeserializeObject<Dictionary<string, object>>(record.Dato!);
                                string? outputString = Dato![key_codice_multiplex].ToString();

                                outputString = outputString!.Replace(DatoDaRimuovere[key_codice_referenza].ToString()!, "");
                                outputString = outputString.Replace(",,", ",");
                                char firstChar = outputString[0];
                                if (firstChar == ',')
                                {
                                    outputString = outputString.Substring(1);
                                }
                                char lastChar = outputString.Substring(outputString.Length - 1, 1)[0];
                                if (lastChar == ',')
                                {
                                    outputString = outputString.Substring(0, outputString.Length - 1);
                                }

                                Dato[key_codice_multiplex] = outputString;

                                record.Dato = JsonConvert.SerializeObject(Dato);
                            }
                            //this.ctx2.SaveChanges();                        
                        }
                    }

                    result.Esito = true;
                }
            }
            catch (Exception ex)
            {
                result.error = ex.Message;
            }

            return Ok(result);
        }

        public async /*Task<IActionResult>*/ Task<string> AggiungiMultiplex(Int64 id_pag, int Indice, string idOrCod, int idTracciato)
        {
            string key_codice_multiplex = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppoMultiplex;
            string key_codice_referenza = Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice;
            BoolResult result = new BoolResult();
            string codiceMultiplex = "";
            try
            {

                bool isGruppo = idOrCod.Contains(",");

                List<MenaboRef> refDaModificare = await this.ctx2.MenaboRefs.Where(p => p.IdPagina == id_pag && p.Indice == Indice).ToListAsync(); //|| (isGruppo ? p.CodiceGruppo == idOrCod : p.IdRecord == Int64.Parse(idOrCod))
                List<string> composizioneMultiplexAssente = new List<string>();
                foreach (MenaboRef r in refDaModificare)
                {
                    string primoCodice = "";
                    if (r.CodiceGruppo != null)
                    {
                        primoCodice = r.CodiceGruppo.Split(",")[0];
                    }
                    PromoTracciatiRecord? record = await this.ctx2.PromoTracciatiRecords.Where(p => (r.CodiceGruppo != null ? p.CodiceGruppo == r.CodiceGruppo : p.Id == r.IdRecord) && idTracciato == p.IdTracciato).FirstOrDefaultAsync();
                    if (record == null)
                    {
                        throw new Exception("Referenza mancante in PromoTracciatiRecord, incongruenza nel database");
                    }


                    Dictionary<string, object>? Dato = JsonConvert.DeserializeObject<Dictionary<string, object>>(record.Dato!);
                    if (Dato!.ContainsKey(key_codice_multiplex)) // errore
                    {
                        codiceMultiplex = Dato[key_codice_multiplex].ToString()!;
                        break;
                    }
                    else
                    {
                        if (r.CodiceGruppo != null)
                        {
                            string[] codiciTotali = r.CodiceGruppo.Split(",");
                            composizioneMultiplexAssente.AddRange(codiciTotali);
                            composizioneMultiplexAssente.Sort();
                        }
                        else
                        {
                            composizioneMultiplexAssente.Add(Dato[key_codice_referenza].ToString()!);
                            composizioneMultiplexAssente.Sort();
                        }
                    }
                }

                bool NuovoCodiceGenerato = false;
                if (codiceMultiplex == "")
                {
                    foreach (string cod in composizioneMultiplexAssente)
                    {
                        codiceMultiplex += cod + ",";
                    }
                    char firstChar = codiceMultiplex[0];
                    if (firstChar == ',')
                    {
                        codiceMultiplex = codiceMultiplex.Substring(1);
                    }
                    char lastChar = codiceMultiplex.Substring(codiceMultiplex.Length - 1, 1)[0];
                    if (lastChar == ',')
                    {
                        codiceMultiplex = codiceMultiplex.Substring(0, codiceMultiplex.Length - 1);
                    }
                    NuovoCodiceGenerato = true;
                }

                if (isGruppo)
                {
                    List<string> codiciTotali = codiceMultiplex.Split(",").ToList();
                    if (!NuovoCodiceGenerato)
                    {
                        //riordino i codici del gruppo in ordine alfabetico
                        List<string> codiciDelGruppo = idOrCod.Split(",").ToList();
                        codiciTotali.AddRange(codiciDelGruppo);
                    }
                    codiciTotali.Sort();

                    string outputString = "";
                    foreach (string codice in codiciTotali)
                    {
                        outputString += codice + ",";
                    }
                    char firstChar = outputString[0];
                    if (firstChar == ',')
                    {
                        outputString = outputString.Substring(1);
                    }
                    char lastChar = outputString.Substring(outputString.Length - 1, 1)[0];
                    if (lastChar == ',')
                    {
                        outputString = outputString.Substring(0, outputString.Length - 1);
                    }
                    codiceMultiplex = outputString;

                    foreach (MenaboRef r2 in refDaModificare)
                    {
                        if (r2.CodiceGruppo != null)
                        {
                            List<PromoTracciatiRecord> records = await this.ctx2.PromoTracciatiRecords.Where(p => p.CodiceGruppo == r2.CodiceGruppo && idTracciato == p.IdTracciato).ToListAsync();
                            foreach (PromoTracciatiRecord record in records)
                            {
                                Dictionary<string, object>? Dato = JsonConvert.DeserializeObject<Dictionary<string, object>>(record.Dato!);

                                Dato![key_codice_multiplex] = codiceMultiplex;
                                record.Dato = JsonConvert.SerializeObject(Dato);
                            }
                        }
                        else
                        {
                            PromoTracciatiRecord? record = await this.ctx2.PromoTracciatiRecords.Where(p => p.Id == r2.IdRecord).FirstOrDefaultAsync();
                            Dictionary<string, object>? Dato = JsonConvert.DeserializeObject<Dictionary<string, object>>(record!.Dato!);

                            Dato![key_codice_multiplex] = codiceMultiplex;
                            record.Dato = JsonConvert.SerializeObject(Dato);
                        }
                        //this.ctx2.SaveChanges();                       
                    }
                    result.Esito = true;
                }
                else
                {
                    List<string> codiciTotali = codiceMultiplex.Split(",").ToList();
                    MenaboRef? _ref = await this.ctx2.MenaboRefs.Where(p => p.IdRecord == Int64.Parse(idOrCod)).FirstOrDefaultAsync();
                    PromoTracciatiRecord? recordDaAggiungere = await this.ctx2.PromoTracciatiRecords.Where(p => p.Id == _ref!.IdRecord).FirstOrDefaultAsync();
                    Dictionary<string, object>? DatoDaAggiungere = JsonConvert.DeserializeObject<Dictionary<string, object>>(recordDaAggiungere!.Dato!);
                    if (!NuovoCodiceGenerato)
                    {
                        codiciTotali.Add(DatoDaAggiungere![key_codice_referenza].ToString()!);
                    }
                    codiciTotali.Sort();

                    string outputString = "";
                    foreach (string codice in codiciTotali)
                    {
                        outputString += codice + ",";
                    }
                    char firstChar = outputString[0];
                    if (firstChar == ',')
                    {
                        outputString = outputString.Substring(1);
                    }
                    char lastChar = outputString.Substring(outputString.Length - 1, 1)[0];
                    if (lastChar == ',')
                    {
                        outputString = outputString.Substring(0, outputString.Length - 1);
                    }
                    codiceMultiplex = outputString;

                    foreach (MenaboRef r3 in refDaModificare)
                    {
                        if (r3.CodiceGruppo != null)
                        {
                            List<PromoTracciatiRecord> records = await this.ctx2.PromoTracciatiRecords.Where(p => p.CodiceGruppo == r3.CodiceGruppo && idTracciato == p.IdTracciato).ToListAsync();
                            foreach (PromoTracciatiRecord record in records)
                            {
                                Dictionary<string, object>? Dato = JsonConvert.DeserializeObject<Dictionary<string, object>>(record.Dato!);

                                Dato![key_codice_multiplex] = codiceMultiplex;
                                record.Dato = JsonConvert.SerializeObject(Dato);
                            }
                        }
                        else
                        {
                            PromoTracciatiRecord? record = await this.ctx2.PromoTracciatiRecords.Where(p => p.Id == r3.IdRecord).FirstOrDefaultAsync();
                            Dictionary<string, object>? Dato = JsonConvert.DeserializeObject<Dictionary<string, object>>(record!.Dato!);

                            Dato![key_codice_multiplex] = codiceMultiplex;
                            record.Dato = JsonConvert.SerializeObject(Dato);
                        }

                        //this.ctx2.SaveChanges();                       
                    }
                    result.Esito = true;
                }
            }
            catch (Exception ex)
            {
                result.error = ex.Message;
            }

            return codiceMultiplex;
        }

        //[HttpGet]
        //[Route("Menabo/controllaRevisioneMultiplex/{codiceGruppoMultiplex}")]
        //public async Task<IActionResult> controllaRevisioneMultiplex(string codiceGruppoMultiplex)
        //{
        //    revisioneMultiplex result = new revisioneMultiplex();
        //    try
        //    {
        //        ArticoliDescrizioni descrItem = await this.ctx.ArticoliDescrizionis.Where(d => d.CodiceGruppo == codiceGruppoMultiplex).FirstOrDefaultAsync();
        //        if (descrItem != null)
        //        {
        //            result.revisioneEffettuata = true;
        //        }
        //        else
        //        {
        //            result.revisioneEffettuata = false;
        //        }
        //        result.Esito = true;
        //    }
        //    catch (Exception ex)
        //    {
        //        result.Esito = false;
        //        result.error = ex.Message;
        //    }

        //    return Ok(result);
        //}


        public class tmpObjInPagina
        {
            public int Indice { get; set; }
            public long Pagina { get; set; }
        }



        public static int getEditDistance(string X, string Y)
        {
            int m = X.Length;
            int n = Y.Length;

            int[][] T = new int[m + 1][];
            for (int i = 0; i < m + 1; ++i)
            {
                T[i] = new int[n + 1];
            }

            for (int i = 1; i <= m; i++)
            {
                T[i][0] = i;
            }
            for (int j = 1; j <= n; j++)
            {
                T[0][j] = j;
            }

            int cost;
            for (int i = 1; i <= m; i++)
            {
                for (int j = 1; j <= n; j++)
                {
                    cost = X[i - 1] == Y[j - 1] ? 0 : 1;
                    T[i][j] = Math.Min(Math.Min(T[i - 1][j] + 1, T[i][j - 1] + 1),
                            T[i - 1][j - 1] + cost);
                }
            }

            return T[m][n];
        }

        public static double findSimilarity(string x, string y)
        {
            if (x == null || y == null)
            {
                throw new ArgumentException("Strings must not be null");
            }

            double maxLength = Math.Max(x.Length, y.Length);
            if (maxLength > 0)
            {
                // facoltativamente ignora le maiuscole se necessario
                return (maxLength - getEditDistance(x, y)) / maxLength;
            }
            return 1.0;
        }

        private List<csvDemo> modificaParametri(List<csvDemo> ListSeparatedColumns)
        {

            foreach (var separatedColumns in ListSeparatedColumns)
            {
                if (separatedColumns.Reparto == "GASTRONOMIA")
                {
                    if (separatedColumns.Categoria!.Contains("FORMAGGI FRESCHI SERVIZIO"))
                    {
                        separatedColumns.Categoria = "FORMAGGI FRESCHI SERVIZIO";
                    }
                    if (separatedColumns.Categoria.Contains("FORMAGGI STAGIONATI SERVIZIO ASSISTITO"))
                    {
                        separatedColumns.Categoria = "FORMAGGI STAGIONATI SERVIZIO ASSISTITO";
                    }
                    if (separatedColumns.Categoria.Contains("FORMAGGI STAGIONATI SERVIZIO A"))
                    {
                        separatedColumns.Categoria = "FORMAGGI STAGIONATI SERVIZIO A";
                    }
                }
                if (separatedColumns.Reparto == "SALSE/COND./SCATOLAME")
                {
                    if (separatedColumns.Categoria!.Contains("CONSERVE DI VERDURE E LEGUMI"))
                    {
                        separatedColumns.Categoria = "CONSERVE DI VERDURE E LEGUMI";
                    }
                }
                if (separatedColumns.Categoria == "CARTA IGENICA")
                {
                    separatedColumns.Categoria = "CARTA IGIENICA";
                }
            }
            return ListSeparatedColumns;
        }


        public class ZeroLeadingStringConverter : CsvHelper.TypeConversion.StringConverter
        {
            //public override string? ConvertToString(object value, IWriterRow row, MemberMapData memberMapData)
            //{
            //    if (value != null)
            //    {
            //        return value.ToString();
            //    }

            //    return null;
            //}
        }


        [HttpGet]
        [Route("Menabo/leggiCsv/{id_tracciato}")]
        public async Task<IActionResult> leggiCsv(int id_tracciato)
        {
            BoolResult result = new BoolResult();
            try
            {
                string filePath = "C:\\Users\\Sviluppatore3\\OneDrive\\Desktop\\csvProva\\risultati\\result.csv";

                // Configura le opzioni di lettura del CSV
                var csvConfig = new CsvConfiguration(CultureInfo.InvariantCulture);
                // Leggi il file CSV e deserializzalo in una lista di oggetti MyData
                using (var reader = new StreamReader(filePath))
                using (var csv = new CsvReader(reader, csvConfig))
                {
                    csv.Context.TypeConverterCache.AddConverter<string>(new ZeroLeadingStringConverter());
                    // Leggi i dati e deserializzali
                    IEnumerable<csvDemoResult> recordsCsv = csv.GetRecords<csvDemoResult>();
                    List<csvDemoResult> records = new();
                    // Ora 'records' contiene i dati dal file CSV
                    foreach (var record in recordsCsv)
                    {
                        records.Add(record);
                        // Puoi accedere ai dati delle colonne come proprietà dell'oggetto MyData
                        //string codice = record.Codice;
                        // Esegui le operazioni desiderate sui dati
                    }

                    List<string> gruppiAnalizzati = new();
                    foreach (var item in records)
                    {
                        if (item.CodiceGruppo == "0")
                        {
                            MenaboRef _ref = new();
                            int repetition = 0;
                            PromoTracciatiRecord? rec = new();
                            do
                            {
                                if (repetition > 0)
                                {
                                    item.Codice = "0" + item.Codice;
                                }
                                rec = this.ctx2.PromoTracciatiRecords.Where(f => f.Codice == item.Codice && f.IdTracciato == id_tracciato).FirstOrDefault();
                                repetition++;
                            } while (rec == null && repetition < 4);
                            if (repetition == 4)
                            {
                                continue;
                            }
                            _ref.IdRecord = rec!.Id;
                            _ref.IdPagina = this.ctx2.MenaboPagines.Where(f => f.IdTracciato == id_tracciato && f.Numero == item.Pagina).FirstOrDefault()!.Id;
                            _ref.Indice = item.Indice;
                            await inMenabo(_ref, true, id_tracciato, "", item.Indice);
                        }
                        else
                        {
                            if (gruppiAnalizzati.Contains(item.CodiceGruppo!))
                            {
                                continue;
                            }
                            List<csvDemoResult> elementiGruppo = records.Where(f => f.CodiceGruppo == item.CodiceGruppo).ToList();
                            bool tuttiAlloStessoIndice = true;
                            foreach (var itemGruppo in elementiGruppo)
                            {
                                if (itemGruppo.Indice != item.Indice)
                                {
                                    tuttiAlloStessoIndice = false;
                                }
                            }
                            if (tuttiAlloStessoIndice)
                            {
                                MenaboRef _ref = new();
                                PromoTracciatiRecord? rec = this.ctx2.PromoTracciatiRecords.Where(f => f.Codice == item.Codice && f.IdTracciato == id_tracciato).FirstOrDefault();
                                _ref.IdRecord = 0;
                                _ref.CodiceGruppo = item.CodiceGruppo;
                                _ref.IdPagina = this.ctx2.MenaboPagines.Where(f => f.IdTracciato == id_tracciato && f.Numero == item.Pagina).FirstOrDefault()!.Id;
                                _ref.Indice = item.Indice;
                                await inMenabo(_ref, true, id_tracciato, "", item.Indice);
                                gruppiAnalizzati.Add(item.CodiceGruppo!);
                            }
                            else
                            {
                                MenaboRef _ref = new();
                                PromoTracciatiRecord? rec = this.ctx2.PromoTracciatiRecords.Where(f => f.Codice == item.Codice && f.IdTracciato == id_tracciato).FirstOrDefault();
                                _ref.IdRecord = rec!.Id;
                                _ref.IdPagina = this.ctx2.MenaboPagines.Where(f => f.IdTracciato == id_tracciato && f.Numero == item.Pagina).FirstOrDefault()!.Id;
                                _ref.Indice = item.Indice;
                                await inMenabo(_ref, true, id_tracciato, "", item.Indice);
                            }
                        }
                    }
                }
                result.Esito = true;
                return Ok(result);
            }
            catch (Exception ex)
            {
                result.error = ex.Message;
                return Ok(result);
            }
        }


        [HttpGet]
        [Route("Menabo/AutoImpaginazione/{idTracciato}/{areaTracciato}")]
        public async Task<IActionResult> AutoImpaginazione(int idTracciato, string areaTracciato)
        {
            // Crea un oggetto Blob con il tipo MIME appropriato
            try
            {
                /*IOptions<PathExternal> external_lib = Options.Create(new PathExternal());
                external_lib.Value.pathSource = @"C:\\Ufficiale\\Istanta\\Istanta\\wwwroot\\external_source\\";
                external_lib.Value.pathLib = @"C:\\Ufficiale\\Istanta\\Istanta\\wwwroot\\external_lib\\";                
                IOptions<PathOperationImport> path_import = Options.Create(new PathOperationImport());
                path_import.Value.path = @"C:\\Ufficiale\\Istanta\\Istanta\\wwwroot\\imported_files\\";
                IOptions<PathOperationExport> path_export = Options.Create(new PathOperationExport());
                path_import.Value.path = @"C:\\Ufficiale\\Istanta\\Istanta\\wwwroot\\exported_files\\";*/
                //TracciatiController trac = new TracciatiController(null,null, "", "", path_external_lib);
                //var res = await trac.getAllRegoleMenabo();
                ExternalSourceClass exClass = new ExternalSourceClass(this.path_external_source, new string[] { "SourceMenabo" });
                var regole = exClass.getRegoleMenabo().automatismo;

                //List<listaSetRegole> regole = new List<listaSetRegole>();
                //if (res is OkObjectResult)
                //{
                //    if ((res as OkObjectResult).Value is List<listaSetRegole>)
                //    {
                //        regole = (res as OkObjectResult).Value as List<listaSetRegole>;
                //    }
                //    else
                //    {
                //        throw new Exception("Impossibile recuperare le regole per l'autoimpaginazione");
                //    }
                //}
                regole = regole.OrderBy(f => f.ordine).ToList();
                foreach (var item in regole)
                {
                    IActionResult? formatoRes = null;
                    formatoRes = await getFormato(item.meccanica!);
                    string formatoRichiesto = "";
                    if (formatoRes is OkObjectResult && (formatoRes as OkObjectResult)!.Value is string)
                    {
                        formatoRichiesto = (formatoRes as OkObjectResult)!.Value!.ToString()!;
                    }

                    if (formatoRichiesto != "1x1")
                    {
                        if (item.indicePreciso)
                        {
                            item.priority = 1;
                        }
                        else
                        {
                            item.priority = 2;
                        }
                    }
                    else
                    {
                        if (item.indicePreciso)
                        {
                            item.priority = 3;
                        }
                        else
                        {
                            item.priority = 4;
                        }
                    }
                }
                PromoTracciati? tracciato = await this.ctx2.PromoTracciatis.Include(i => i.PromoTracciatiRecords).Where(t => t.Id == idTracciato).FirstOrDefaultAsync();
                List<MenaboPagine>? pagine = await this.ctx2.MenaboPagines.Include(i => i.MenaboRefs).Where(t => t.IdTracciato == idTracciato).ToListAsync();
                List<PromoTracciatiRecord> q_records = new List<PromoTracciatiRecord>();
                q_records.AddRange(tracciato!.PromoTracciatiRecords.Where(f => f.Stato == (byte)StatoRecord.Attivo).ToList());
                q_records = getElementLastVersion(q_records);

                List<refImpaginazione> listObjToImpaginate = new List<refImpaginazione>();
                foreach (var item in q_records)
                {
                    var objResult = CheckCorrispondenzaRegole(item, regole);

                    if (objResult.Count > 0)// != null)
                    {
                        refImpaginazione objToImpaginate = new refImpaginazione();
                        objToImpaginate.refToImpaginate.IdRecord = item.Id;
                        objToImpaginate.refToImpaginate.CodiceGruppo = "0";
                        objToImpaginate.record = item;
                        objToImpaginate.regola = objResult;
                        listObjToImpaginate.Add(objToImpaginate);
                    }
                }

                List<refImpaginazione> listCopy = new List<refImpaginazione>();
                listCopy.AddRange(listObjToImpaginate);
                foreach (var item in listCopy)
                {
                    if (item.record.CodiceGruppo != item.record.Codice)
                    {
                        string[] codici = item.record.CodiceGruppo!.Split(",");
                        bool tuttiPresenti = codici.All(codice => listObjToImpaginate.Any(obj => obj.record.Codice == codice));
                        if (tuttiPresenti)
                        {
                            listObjToImpaginate.RemoveAll(obj => codici.Contains(obj.record.Codice));
                            item.refToImpaginate.CodiceGruppo = item.record.CodiceGruppo;
                            item.refToImpaginate.IdRecord = 0;
                            listObjToImpaginate.Add(item);
                        }
                    }
                }

                var listaOrdinata = await OrdinaRefDaImpaginareSecondoRegole(listObjToImpaginate);

                if (listaOrdinata is OkObjectResult && (listaOrdinata as OkObjectResult)!.Value is List<refImpaginazione>)
                {
                    listObjToImpaginate = ((listaOrdinata as OkObjectResult)!.Value as List<refImpaginazione>)!;
                }


                ListMenaboRefsToImpaginate objToImpaginateToSend = new ListMenaboRefsToImpaginate();
                objToImpaginateToSend.refsToImpaginate = new List<MenaboRefsToImpaginate>();

                foreach (var item in listObjToImpaginate)
                {
                    MenaboRefsToImpaginate refToImp = new MenaboRefsToImpaginate();
                    refToImp.menaboref = item.refToImpaginate;
                    refToImp.regole = item.regola;
                    refToImp.idTracciato = idTracciato;
                    refToImp.areaTracciato = areaTracciato;
                    objToImpaginateToSend.refsToImpaginate.Add(refToImp);
                }
                var result = await AllInMenabo(objToImpaginateToSend);

                if (result is OkObjectResult && (result as OkObjectResult)!.Value is ResultImpaginazioneAutomatica)
                {
                    var ritorno = (result as OkObjectResult)!.Value as ResultImpaginazioneAutomatica;
                    return Ok(ritorno);
                }

                return Ok(new ResultImpaginazioneAutomatica());
            }
            catch (Exception ex)
            {
                return Ok(ex.ToString());
            }

        }

        private async Task<IActionResult> OrdinaRefDaImpaginareSecondoRegole(List<refImpaginazione> listObjToImpaginate)
        {
            List<refImpaginazione> formatoSpecificatoConIndice = new List<refImpaginazione>();
            List<refImpaginazione> formatoSpecificatoSenzaIndice = new List<refImpaginazione>();
            List<refImpaginazione> IndiceSpecificato = new List<refImpaginazione>();
            List<refImpaginazione> elementiGenerici = new List<refImpaginazione>();
            foreach (var item in listObjToImpaginate)
            {
                IActionResult? formatoRes = null;
                formatoRes = await getFormato(item.regola[0].meccanica!);
                string formatoRichiesto = "";
                if (formatoRes is OkObjectResult && (formatoRes as OkObjectResult)!.Value is string)
                {
                    formatoRichiesto = (formatoRes as OkObjectResult)!.Value!.ToString()!;
                }

                if (formatoRichiesto != "1x1")
                {
                    if (item.regola[0].indicePreciso)
                    {
                        formatoSpecificatoConIndice.Add(item);
                    }
                    else
                    {
                        formatoSpecificatoSenzaIndice.Add(item);
                    }
                }
                else
                {
                    if (item.regola[0].indicePreciso)
                    {
                        IndiceSpecificato.Add(item);
                    }
                    else
                    {
                        elementiGenerici.Add(item);
                    }
                }
            }
            formatoSpecificatoConIndice = formatoSpecificatoConIndice.OrderBy(f => f.regola[0].ordine).ToList();
            formatoSpecificatoSenzaIndice = formatoSpecificatoSenzaIndice.OrderBy(f => f.regola[0].ordine).ToList();
            IndiceSpecificato = IndiceSpecificato.OrderBy(f => f.regola[0].ordine).ToList();
            elementiGenerici = elementiGenerici.OrderBy(f => f.regola[0].ordine).ToList();
            listObjToImpaginate.Clear();
            listObjToImpaginate.AddRange(formatoSpecificatoConIndice);
            listObjToImpaginate.AddRange(formatoSpecificatoSenzaIndice);
            listObjToImpaginate.AddRange(IndiceSpecificato);
            listObjToImpaginate.AddRange(elementiGenerici);
            return Ok(listObjToImpaginate);
        }

        public List<listaSetRegole> CheckCorrispondenzaRegole(PromoTracciatiRecord record, List<listaSetRegole> regole)
        {
            List<listaSetRegole> regoleRispettateList = new List<listaSetRegole>();
            foreach (var setRegoleList in regole)
            {

                var notValidLabel = false;

                if (setRegoleList.label != null && setRegoleList.label != "" && record.Label != setRegoleList.label)
                {
                    notValidLabel = true;
                }
                if (!notValidLabel)
                {
                    foreach (var setRegole in setRegoleList.setRegoleList!)
                    {
                        bool regoleRispettate = true;
                        foreach (var regola in setRegole.setDiRegole!)
                        {
                            if (regoleRispettate)
                            {
                                regoleRispettate = CheckCorrispondenza((operatorId)regola.operatorId, IstantaJson.getJsonObject(record!.Dato!), regola.nomeCampo!, regola.value!);
                            }
                        }
                        if (regoleRispettate)
                        {
                            regoleRispettateList.Add(setRegoleList);
                        }
                    }
                }
            }
            return regoleRispettateList;
        }

        private bool CheckCorrispondenza(operatorId operatorId, Dictionary<string, object> dato, string nomeCampo, string value)
        {
            float floatValue = 0;
            float regolaFloatValue = 0;
            if (!dato.ContainsKey(nomeCampo))
            {
                return false;
            }
            switch (operatorId)
            {
                case operatorId.Uguale:
                    return dato[nomeCampo].ToString()!.ToLower() == value.ToLower();

                case operatorId.Diverso:
                    return dato[nomeCampo].ToString()!.ToLower() != value.ToLower();

                case operatorId.Contiene:
                    return dato[nomeCampo].ToString()!.ToLower().Contains(value.ToLower());

                case operatorId.Non_contiene:
                    return !dato[nomeCampo].ToString()!.ToLower().Contains(value.ToLower());

                case operatorId.Inizia_con:
                    return dato[nomeCampo].ToString()!.ToLower().StartsWith(value.ToLower());

                case operatorId.Finisce_con:
                    return dato[nomeCampo].ToString()!.ToLower().EndsWith(value.ToLower());

                case operatorId.Maggiore_di:
                    if (float.TryParse(dato[nomeCampo].ToString(), out floatValue) && float.TryParse(value, out regolaFloatValue))
                    {
                        return floatValue > regolaFloatValue;
                    }
                    else
                    {
                        return false;
                    }

                case operatorId.Maggiore_o_uguale_di:
                    if (float.TryParse(dato[nomeCampo].ToString(), out floatValue) && float.TryParse(value, out regolaFloatValue))
                    {
                        return floatValue >= regolaFloatValue;
                    }
                    else
                    {
                        return false;
                    }

                case operatorId.Minore_di:
                    if (float.TryParse(dato[nomeCampo].ToString(), out floatValue) && float.TryParse(value, out regolaFloatValue))
                    {
                        return floatValue < regolaFloatValue;
                    }
                    else
                    {
                        return false;
                    }

                case operatorId.Minore_o_uguale_di:
                    if (float.TryParse(dato[nomeCampo].ToString(), out floatValue) && float.TryParse(value, out regolaFloatValue))
                    {
                        return floatValue <= regolaFloatValue;
                    }
                    else
                    {
                        return false;
                    }

                default:
                    return false;
            }
        }

        public List<PromoTracciatiRecord> getElementLastVersion(List<PromoTracciatiRecord> recordDaAnalizzare)
        {
            List<PromoTracciatiRecord> q_records = new List<PromoTracciatiRecord>();
            q_records = recordDaAnalizzare
            .GroupBy(r => r.Label) // Raggruppa per label
            .SelectMany(g => g.Where(r => r.Versione == g.Max(r => r.Versione))) // Seleziona gli elementi con la versione massima in ogni gruppo
            .ToList();
            return q_records;
        }

        public List<PromoTracciatiRecord> getElementPreviousVersion(List<PromoTracciatiRecord> recordDaAnalizzare)
        {
            List<PromoTracciatiRecord> filteredRecords = recordDaAnalizzare
            .GroupBy(r => r.Label) // Raggruppa per label
            .SelectMany(g => g.Where(r => r.Versione != g.Max(r => r.Versione))) // Seleziona gli elementi con la versione diversa da quella massima in ogni gruppo
            .ToList();
            return filteredRecords;
        }

        [HttpPut]
        [Route("Menabo/ScambiaRef/{idTracciato}/{pagId}/{newInx}/{idOrCodGruppo}/{areaTracciato}")]
        public async Task<IActionResult> ScambiaRef(MenaboRef itemInMenabo, int idTracciato, int pagId, int newInx, string idOrCodGruppo, string areaTracciato)
        {
            BoolResult result = new BoolResult();
            try
            {
                MenaboPagine? pag = await this.ctx2.MenaboPagines.Include(f => f.MenaboRefs).Where(f => f.Id == pagId && f.IdTracciato == idTracciato).FirstOrDefaultAsync();
                if (itemInMenabo.Id != 0)
                {
                    List<int> indiciOccuppatiPagina = new List<int>();
                    string[] pagSpacesString = pag!.Formato!.ToLower().Split("x");
                    int pagIndiceMax = Convert.ToInt32(pagSpacesString[0]) * Convert.ToInt32(pagSpacesString[1]);
                    List<MenaboRef> refDaScambiare = new List<MenaboRef>();
                    List<MenaboRef> refItemInMenabo = new List<MenaboRef>();
                    IActionResult? formatoRefDaScambiare = null;
                    string formatoRichiestoRefDaScambiare = "";
                    string formatoRichiestoItemInMenabo = "";
                    foreach (var item in pag.MenaboRefs)
                    {
                        if (item.Indice != newInx && item.Indice != itemInMenabo.Indice)
                        {
                            IActionResult? formatoRes = null;
                            formatoRes = await getFormato(item.Formato!);
                            string formatoRichiesto = "";
                            if (formatoRes is OkObjectResult && (formatoRes as OkObjectResult)!.Value is string)
                            {
                                formatoRichiesto = (formatoRes as OkObjectResult)!.Value!.ToString()!;
                            }

                            indiciOccuppatiPagina.AddRange(CalcolaSpazi(pag.Formato, item.Indice, formatoRichiesto));
                        }
                        else if (item.Indice == newInx)
                        {

                            formatoRefDaScambiare = await getFormato(item.Formato!);
                            if (formatoRefDaScambiare is OkObjectResult && (formatoRefDaScambiare as OkObjectResult)!.Value is string)
                            {
                                formatoRichiestoRefDaScambiare = (formatoRefDaScambiare as OkObjectResult)!.Value!.ToString()!;
                            }
                            refDaScambiare.Add(item);
                        }
                        else if (item.Indice == itemInMenabo.Indice)
                        {
                            formatoRefDaScambiare = await getFormato(itemInMenabo.Formato!);
                            if (formatoRefDaScambiare is OkObjectResult && (formatoRefDaScambiare as OkObjectResult)!.Value is string)
                            {
                                formatoRichiestoItemInMenabo = (formatoRefDaScambiare as OkObjectResult)!.Value!.ToString()!;
                            }
                            refItemInMenabo.Add(item);
                        }
                    }
                    //si calcola il primo elemento, quello che si trovava all'indice richiesto
                    List<int> spaziRichiesti = CalcolaSpazi(pag.Formato, itemInMenabo.Indice, formatoRichiestoRefDaScambiare);
                    if (spaziRichiesti.Count == 0)
                    {
                        throw new Exception("Impossibile scambiare, l'ingombro degli elementi uscirebbe dalla pagina");
                    }
                    List<int> elementiComuni = indiciOccuppatiPagina.Intersect(spaziRichiesti).ToList();
                    if (elementiComuni.Count != 0)
                    {
                        throw new Exception("Impossibile scambiare, l'ingombro degli elementi si andrebbe a sovrappore con altri elementi impaginati");
                    }
                    indiciOccuppatiPagina.AddRange(spaziRichiesti);
                    foreach (var refScambio in refDaScambiare)
                    {
                        refScambio.Indice = itemInMenabo.Indice;
                    }

                    //si calcola il secondo elemento quello che è stato spostato
                    spaziRichiesti = CalcolaSpazi(pag.Formato, newInx, formatoRichiestoItemInMenabo);
                    if (spaziRichiesti.Count == 0)
                    {
                        throw new Exception("Impossibile scambiare, l'ingombro degli elementi uscirebbe dalla pagina");
                    }
                    elementiComuni = indiciOccuppatiPagina.Intersect(spaziRichiesti).ToList();
                    if (elementiComuni.Count != 0)
                    {
                        throw new Exception("Impossibile scambiare, l'ingombro degli elementi si andrebbe a sovrappore con altri elementi impaginati");
                    }
                    foreach (var itemInMenaboScambio in refItemInMenabo)
                    {
                        itemInMenaboScambio.Indice = (short)newInx;
                    }
                    this.ctx2.SaveChanges();
                    return Ok(pag);
                }
                else
                {
                    if (idOrCodGruppo != "")
                    {
                        List<MenaboRef> elementiDaRimuovere = this.ctx2.MenaboRefs.Where(f => f.Indice == newInx && f.IdPagina == pag!.Id).ToList();

                        foreach (var item in elementiDaRimuovere)
                        {
                            IActionResult? inMenaboRes = null;
                            BoolResult? esito = null;
                            refsConMultiplex? esitoMult = null;
                            inMenaboRes = await inMenabo(item, false, idTracciato);
                            if (inMenaboRes is OkObjectResult)
                            {
                                var okResult = inMenaboRes as OkObjectResult;
                                if (okResult!.Value is BoolResult)
                                {
                                    esito = (okResult.Value as BoolResult);
                                }

                                if (okResult.Value is refsConMultiplex)
                                {
                                    esitoMult = (okResult.Value as refsConMultiplex);
                                }
                            }

                            if ((esito != null && esito.Esito) || (esitoMult != null))
                            {
                                MenaboRef elementoDaInserire = new MenaboRef();
                                PromoTracciatiRecord? record = this.ctx2.PromoTracciatiRecords.Where(f => (idOrCodGruppo.Contains(",") ? f.CodiceGruppo == idOrCodGruppo : f.Id == Int32.Parse(idOrCodGruppo))).FirstOrDefault();
                                elementoDaInserire.CodiceGruppo = record!.CodiceGruppo;
                                elementoDaInserire.IdRecord = (!idOrCodGruppo.Contains(",") ? Int64.Parse(idOrCodGruppo) : 0);
                                elementoDaInserire.IdPagina = pagId;
                                inMenaboRes = null;
                                esito = null;
                                inMenaboRes = await inMenabo(elementoDaInserire, true, idTracciato, areaTracciato, (short)newInx);
                                if (inMenaboRes is OkObjectResult)
                                {
                                    var okResult = inMenaboRes as OkObjectResult;
                                    if (okResult!.Value is BoolResult)
                                    {
                                        esito = (okResult.Value as BoolResult);
                                    }
                                }

                                if ((esito != null && esito.Esito) || (esitoMult != null))
                                {
                                    if (item == elementiDaRimuovere[elementiDaRimuovere.Count - 1])
                                    {
                                        pag = await this.ctx2.MenaboPagines.Include(f => f.MenaboRefs).Where(f => f.Id == pagId && f.IdTracciato == idTracciato).FirstOrDefaultAsync();
                                        return Ok(pag);
                                    }
                                }
                                else
                                {
                                    throw new Exception((esito != null ? esito.error + "; error code " + esito.errorCode : "impossibile rimuovere referenza per lo scambio"));
                                }
                            }
                            else
                            {
                                throw new Exception((esito != null ? esito.error + "; error code " + esito.errorCode : "impossibile rimuovere referenza per lo scambio"));
                            }
                        }
                        throw new Exception("Nessun elemento trovato da rimuovere per lo scambio");
                    }
                    else
                    {
                        result.Esito = false;
                        result.error = "Sia itemInMenabo che idOrCodGruppo non validi";
                        return Ok(result);
                    }
                }
            }
            catch (Exception ex)
            {
                result.Esito = false;
                result.error = ex.Message;
                return Ok(result);
            }
        }

        public class DebugInterface
        {
            public Dictionary<string, object>? oggettoConErrore;
            public FiltriPerPagina? filtroCorrispondente;
            public int informazioneIntGenerica1;
            public int informazioneIntGenerica2;
            public string? informazioneStringGenerica1;
            public string? error;
        }

        public class elementoImpaginato
        {
            public string codiceGruppo = "";
            public long idRec = 0;
            public string nomePagina = "";
        }

        [HttpGet]
        [Route("Menabo/getListaImpaginati/{idLavorazione}")]
        public List<elementoImpaginato> getListaImpaginati(int idLavorazione)
        {
            var recordImpaginati = this.ctx2.PromoLavorazioniRecords.Where(f => f.IdLavorazione == idLavorazione).ToList();
            List<elementoImpaginato> result = new List<elementoImpaginato>();

            foreach (var record in recordImpaginati)
            {
                elementoImpaginato elImp = new elementoImpaginato();
                elImp.codiceGruppo = record.CodiceGruppo;
                elImp.idRec = record.IdRecordTracciato;
                elImp.nomePagina = record.Pagina.ToString();
                result.Add(elImp);
            }
            return result;
        }


        [HttpPost]
        [Route("Menabo/restoreCacheConfronto")]
        public async Task<IActionResult> RestoreCacheConfronto(int idLavorazione)
        {
            var res = new PromoLavorazioniResult();
            PromoLavorazioni cached = new PromoLavorazioni();
            var cacheId = "PR_" + idLavorazione.ToString()!;
            if (!_cache!.TryGetValue(cacheId, out cached!))
                return StatusCode(StatusCodes.Status410Gone, new { error = "Cache scaduta" , Esito = false});

            // Carica entità esistente + figli (se serve)
            var dbEntity = await ctx2.PromoLavorazionis
                .Include(p => p.PromoLavorazioniRecords)
                .FirstOrDefaultAsync(p => p.Id == idLavorazione);

            if (dbEntity == null)
                return NotFound(new { error = "Lavorazione non trovata" , Esito = false});

            // Copia SCALARI (stesso tipo)
            this.ctx2.Entry(dbEntity).CurrentValues.SetValues(cached);

            // Sincronizza la collezione figli
            // Supponendo che i record abbiano chiave Id
            var cachedById = cached.PromoLavorazioniRecords.ToDictionary(r => r.Id);
            var dbById = dbEntity.PromoLavorazioniRecords.ToDictionary(r => r.Id);

            // UPDATE + ADD
            foreach (var kv in cachedById)
            {
                if (dbById.TryGetValue(kv.Key, out var existing))
                {
                    this.ctx2.Entry(existing).CurrentValues.SetValues(kv.Value); // update scalari
                }
                else
                {
                    // Attacca nuovo figlio collegandolo al parent
                    dbEntity.PromoLavorazioniRecords.Add(kv.Value);
                }
            }

            // REMOVE
            foreach (var kv in dbById)
            {
                if (!cachedById.ContainsKey(kv.Key))
                {
                    this.ctx2.Remove(kv.Value);
                }
            }

            try
            {
                await ctx2.SaveChangesAsync();
                _cache!.Remove("PR_"+idLavorazione.ToString()!); // rimuovi SOLO dopo successo
                res.Esito = true;
                res.records = dbEntity.PromoLavorazioniRecords.ToList(); // opzionale per response
                return Ok(res);
            }
            catch (DbUpdateConcurrencyException ex)
            {
                return Conflict(new { error = "Conflitto di concorrenza, "+ ex.Message, Esito = false});
            }
            catch (Exception ex)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new { error = ex.Message, Esito = false });
            }
        }

        private readonly record struct CodiceFiltroKey(string Codice, long? IdRec)
        {
            public bool IsConId => IdRec.HasValue && IdRec.Value > 0;
        }

        private static string? GetCodiceGruppo(
    Dictionary<string, object> record,
    string keyCodiceGruppo)
        {
            return record.TryGetValue(keyCodiceGruppo, out var value)
                ? value?.ToString()
                : null;
        }

        private static long? GetIdRec(Dictionary<string, object> record)
        {
            if (!record.TryGetValue("idRec", out var value) || value == null)
                return null;

            return long.TryParse(value.ToString(), out var id)
                ? id
                : null;
        }

        private static bool MatchCodiceFiltro(
            Dictionary<string, object> record,
            CodiceFiltroKey filtro,
            string keyCodiceGruppo)
        {
            var codiceRecord = GetCodiceGruppo(record, keyCodiceGruppo);

            if (codiceRecord != filtro.Codice)
                return false;

            // Vecchia retrocompatibilità: se non ho idRec, confronto solo per codice
            if (!filtro.IsConId)
                return true;

            var idRecRecord = GetIdRec(record);

            return idRecRecord == filtro.IdRec;
        }
        private static bool MatchFiltroSuLavorazioniRecord(
    CodiceFiltroKey filtro,
    List<PromoLavorazioniRecord> recordGiaImpaginati,
    List<ArticoloInKit> listaOriginale)
        {
            if (!filtro.IdRec.HasValue || filtro.IdRec.Value <= 0)
            {
                return recordGiaImpaginati.Any(r => r.CodiceGruppo == filtro.Codice);
            }

            return Utility.Main.getLavorazioneRecord(
                filtro.Codice,
                Convert.ToInt32(filtro.IdRec.Value),
                recordGiaImpaginati,
                listaOriginale
            ) != null;
        }

        private static List<CodiceFiltroKey> GetCodiciForzatiNormalizzati(FiltriPerPagina filtro)
        {
            if (filtro.codiciForzatiConId != null && filtro.codiciForzatiConId.Count > 0)
            {
                return filtro.codiciForzatiConId
                    .Where(c => !string.IsNullOrWhiteSpace(c.codice))
                    .Select(c => new CodiceFiltroKey(c.codice, c.idRec > 0 ? c.idRec : null))
                    .ToList();
            }

            return filtro.codiciForzati
                .Where(c => !string.IsNullOrWhiteSpace(c))
                .Select(c => new CodiceFiltroKey(c, null))
                .ToList();
        }

        private static List<CodiceFiltroKey> GetCodiciEsclusiNormalizzati(FiltriPerPagina filtro)
        {
            if (filtro.codiciEsclusiConId != null && filtro.codiciEsclusiConId.Count > 0)
            {
                return filtro.codiciEsclusiConId
                    .Where(c => !string.IsNullOrWhiteSpace(c.codice))
                    .Select(c => new CodiceFiltroKey(c.codice, c.idRec > 0 ? c.idRec : null))
                    .ToList();
            }

            return filtro.codiciEsclusi
                .Where(c => !string.IsNullOrWhiteSpace(c))
                .Select(c => new CodiceFiltroKey(c, null))
                .ToList();
        }

        private static bool SameRecordImpaginazione(
    Dictionary<string, object> a,
    Dictionary<string, object> b,
    string keyCodiceGruppo)
        {
            var codiceA = GetCodiceGruppo(a, keyCodiceGruppo);
            var codiceB = GetCodiceGruppo(b, keyCodiceGruppo);

            if (codiceA != codiceB)
                return false;

            var idA = GetIdRec(a);
            var idB = GetIdRec(b);

            // Nuovo metodo: se entrambi hanno idRec, confronto preciso
            if (idA.HasValue && idB.HasValue)
                return idA.Value == idB.Value;

            // Legacy: se manca idRec, fallback al solo codice gruppo
            return true;
        }

        (string CodiceRef, string Label) GetChiaveProdotto(Dictionary<string, object> dict)
        {
            string keyCodiceRef = Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice;
            string keyLabel = GLOBAL_VARIABLES.keyLabel;
            return (
                dict.ContainsKey(keyCodiceRef) ? dict[keyCodiceRef]?.ToString() ?? "" : "",
                dict.ContainsKey(keyLabel) ? dict[keyLabel]?.ToString() ?? "" : ""
            );
        }

        void RimuoviDaListaFiltrataSoloImpaginati(List<Dictionary<string, object>> impaginati, List<Dictionary<string, object>> listaFiltrata)
        {
            var chiaviImpaginate = impaginati
                .Select(GetChiaveProdotto)
                .ToHashSet();

            listaFiltrata.RemoveAll(f => chiaviImpaginate.Contains(GetChiaveProdotto(f)));
        }

        void RimuoviImpaginatiDagliAvanzatiPrecedenti(
            Dictionary<string, object> elementiAvanzatiFil,
            List<Dictionary<string, object>> impaginati)
        {
            var chiaviImpaginate = impaginati
                .Select(GetChiaveProdotto)
                .ToHashSet();

            foreach (var nomeGruppoAvanzati in elementiAvanzatiFil.Keys.ToList())
            {
                if (elementiAvanzatiFil[nomeGruppoAvanzati] is List<Dictionary<string, object>> listaAvanzati)
                {
                    listaAvanzati.RemoveAll(a => chiaviImpaginate.Contains(GetChiaveProdotto(a)));

                    if (listaAvanzati.Count == 0)
                    {
                        elementiAvanzatiFil.Remove(nomeGruppoAvanzati);
                    }
                }
            }
        }

        [HttpPut]
        //i primi due sono deprecati ma per retrocompatibilità vanno lasciati, quando il plugin sarà aggiornato potranno essere rimossi.
        [Route("Menabo/ImpaginaFromInDesignNew/{idLavorazione}/{impagina}/{sovrascriviPS}/{noCache}/{idLavorazioneConfronto}")]
        [Route("Menabo/ImpaginaFromInDesignNew/{idLavorazione}/{impagina}/{sovrascriviPS}/{noCache}/{idLavorazioneConfronto}/{confronto}")]
        [Route("Menabo/ImpaginaFromInDesignNew/{idLavorazione}/{impagina}/{noCache}")]
        public async Task<IActionResult> ImpaginaFromInDesignNew(RootFilters filtri, int idLavorazione, bool impagina, bool noCache = false /*int idLavorazioneConfronto = 0, bool confronto = false*/)
        {
            logAssistent.Write("Filtro");
            logAssistent.Write(JsonConvert.SerializeObject(filtri));

            //impostiamo la cultura inglese per le date
            System.Globalization.CultureInfo culture = new System.Globalization.CultureInfo("en-US");


            RootFilterResponse result = new RootFilterResponse();
            result.Result = new List<ResponseImpagination>();

            //NON SI PUO FARE UN CONTROLLO QUI SUI FILTRI
            //IL POP non VUOLE I FILTRI
            //e onestamente anche un volantino potrebbe voler oimpaginare TUTTA la lista, maagrai è una lista piccola


            List<string> codiciImpaginatiInQuestaImpaginazione = new List<string>();

            try
            {
                //controllo di sicurezza sui codici forzati duplicati
                //List<string> listaGeneraleCodiciForzati = new List<string>();
                //// Mappa: pagina => lista codici forzati
                //Dictionary<int, List<string>> codiciForzatiPerPagina = new Dictionary<int, List<string>>();
                //HashSet<string> codiciVisti = new HashSet<string>();
                //List<string> codiciDuplicati = new List<string>();
                //HashSet<string> codiciForzatiAssegnati = new HashSet<string>();

                var listaGeneraleCodiciForzati = new List<CodiceFiltroKey>();
                var codiciForzatiPerPagina = new Dictionary<int, List<CodiceFiltroKey>>();
                var codiciVisti = new HashSet<CodiceFiltroKey>();
                var codiciDuplicati = new List<CodiceFiltroKey>();


                //if (filtri.Filters != null)
                //{
                //    filtri.Filters = filtri.Filters.OrderBy(f => f.Ordine).ToList();
                //    foreach (var filtro in filtri.Filters)
                //    {
                //        if (!codiciForzatiPerPagina.ContainsKey(filtro.Pag))
                //            codiciForzatiPerPagina[filtro.Pag] = new List<string>();

                //        foreach (var codice in filtro.codiciForzati)
                //        {
                //            codiciForzatiPerPagina[filtro.Pag].Add(codice);

                //            if (!codiciVisti.Add(codice))
                //            {
                //                if (!codiciDuplicati.Contains(codice))
                //                    codiciDuplicati.Add(codice);
                //            }
                //            else
                //            {
                //                listaGeneraleCodiciForzati.Add(codice);
                //            }
                //        }
                //    }
                //}

                if (filtri.Filters != null)
                {
                    filtri.Filters = filtri.Filters.OrderBy(f => f.Ordine).ToList();

                    foreach (var filtro in filtri.Filters)
                    {
                        if (!codiciForzatiPerPagina.ContainsKey(filtro.Pag))
                            codiciForzatiPerPagina[filtro.Pag] = new List<CodiceFiltroKey>();

                        var codiciForzatiFiltro = GetCodiciForzatiNormalizzati(filtro);

                        foreach (var codice in codiciForzatiFiltro)
                        {
                            codiciForzatiPerPagina[filtro.Pag].Add(codice);

                            if (!codiciVisti.Add(codice))
                            {
                                if (!codiciDuplicati.Contains(codice))
                                    codiciDuplicati.Add(codice);
                            }
                            else
                            {
                                listaGeneraleCodiciForzati.Add(codice);
                            }
                        }
                    }
                }

                if (codiciDuplicati.Count > 0)
                {
                    var msg = string.Join(", ", codiciDuplicati.Select(c =>
                        c.IsConId ? $"{c.Codice} / idRec {c.IdRec}" : c.Codice));

                    throw new Exception($"Codici forzati duplicati: {msg}");
                }

                // Lanciamo un errore se ci sono duplicati
                //if (codiciDuplicati.Count > 0)
                //{
                //    throw new Exception($"Codici forzati duplicati: {string.Join(", ", codiciDuplicati)}");
                //}

                if (filtri.Filters != null)
                {
                    // Controlliamo anche la capienza delle griglie per pagina
                    foreach (var filtro in filtri.Filters)
                    {
                        if (filtro.Griglia != null)
                        {
                            int spaziDisponibili = 0;
                            //int spaziDisponibili = filtro.Griglia.Righe.Sum(r => r.Count(c => c == 0));
                            if(filtri.GriglieValide == null || filtri.GriglieValide.Count == 0)
                            {
                                spaziDisponibili = CalcolaEspressione(filtro.Griglia.nomeGriglia!);
                            }
                            else
                            {
                                spaziDisponibili = CalcolaEspressione(filtro.Griglia.formato!);
                            }
                            int numForzati = codiciForzatiPerPagina.ContainsKey(filtro.Pag) ? codiciForzatiPerPagina[filtro.Pag].Count : 0;

                            if (numForzati > spaziDisponibili)
                            {
                                throw new Exception($"Pagina {filtro.Pag}: troppi codici forzati ({numForzati}) rispetto agli spazi disponibili ({spaziDisponibili})");
                            }
                        }
                    }
                }


                if (ficoController == null)
                {
                    //ficoController = new FicoProcessController(_config, _external_lib, null, _option_import, null, _cache);
                    ficoController = new FicoProcessController(_config, _external_lib, this._fico_conf, _option_import, this.httpClient, _cache, this._dbContextFactory, null, dbContextFactory2: this._dbContextFactory2);
                    ficoController.HttpContextInRent = HttpContext;
                }

                PromoLavorazioni? promoLav = ctx2.PromoLavorazionis.Where(f => f.Id == idLavorazione).Include(f=>f.PromoLavorazioniRecords).FirstOrDefault();
                //PromoLavorazioni? promoLavConfronto = null;
                //if (idLavorazioneConfronto != 0)
                //{
                //    promoLavConfronto = ctx2.PromoLavorazionis.Where(f => f.Id == idLavorazioneConfronto).FirstOrDefault();
                //}

                string session = SessionIstantaObject.GetSession(HttpContext);
                Int16 id_utente = Int16.Parse(session);


                //if (confronto)
                //{
                //    string kitCacheId = "PR_"+idLavorazione.ToString();
                //    if (!this._cache!.TryGetValue(kitCacheId, out PromoLavorazioni? kitResult))
                //    {
                //        IstantaLib.Utility.Logger.Log($"Creo cache di confronto");
                //        this._cache!.Set(kitCacheId, promoLav, new MemoryCacheEntryOptions().SetSlidingExpiration(TimeSpan.FromMinutes(120)));
                //    }

                //    if (filtri.Filters != null)
                //    {
                //        foreach (var filtro in filtri.Filters)
                //        {
                //            await this.SvuotaPagina(idLavorazione, filtro.Pag);
                //        }
                //    }
                //}

                Dictionary<string, object> elementiPerPagina = new Dictionary<string, object>();
                Dictionary<string, object> elementiAvanzatiLimitePerPagina = new Dictionary<string, object>();
                //TipoImpagnazione tipoImpaginazione = TipoImpagnazione.ImpaginaTutto;
                string keyXMLSelezione = GLOBAL_VARIABLES.keyXMLSelezione;
                string _key_foto_extra = Enum.GetName(AddestramentoRuoli.Foto) + "." + GLOBAL_VARIABLES.keyFotoExtra;
                string keyFotoEscluse = GLOBAL_VARIABLES.keyFotoExtra;
                string keyRegoleMastro = GLOBAL_VARIABLES.keyRegoleMastro;
                ExternalSourceClass exClass = new ExternalSourceClass(this.path_external_source, new string[] { "SourceOrdinamentoLista" });
                IstantaController icCtrl = new IstantaController(this._config.GetConnectionString("IstandaConnectionDb")!, this.path_external_lib, this.path_external_source, this._dbContextFactory);

                //bool ultimoCiclo = true;
                //cambiaTipoImpaginazione:
                //    if (tipoImpaginazione == TipoImpagnazione.SoloIngombranti && ultimoCiclo)
                //    {
                //        foreach (var item in result.Result)
                //        {
                //            item.ListaRefNonImpaginate.Clear();
                //        }
                //        tipoImpaginazione = TipoImpagnazione.ImpaginaTutto;
                //    }

                IstantaController icItem = new IstantaController(this._config.GetConnectionString("IstandaConnectionDb")!, this.path_external_lib, this.path_external_source, this._dbContextFactory);

                JObject oDeclMecc = JObject.Parse(System.IO.File.ReadAllText(this.path_external_source + "SourceDeclinazioneMeccaniche.json"));
                DbDeclinazioneMeccaniche? meccDB = oDeclMecc.ToObject<DbDeclinazioneMeccaniche>();

                //JObject oMenaboSource = JObject.Parse(System.IO.File.ReadAllText(this.path_external_source + "SourceMenabo.json"));
                //DbMenabo menaboDB = oMenaboSource.ToObject<DbMenabo>(); //1 riferimento, questa entity va tolta

                JObject oFrameSource = JObject.Parse(System.IO.File.ReadAllText(this.path_external_source + "SourceFrameworkCss.json"));
                DbFrameworkCss? frameDB = oFrameSource.ToObject<DbFrameworkCss>();


                string key_codice_gruppo = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppo;
                string key_codice_sottogruppo = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceSottogruppo;
                string key_descrizione_gruppo = GLOBAL_VARIABLES.keyDescrGruppo;
                string key_compiled_field = GLOBAL_VARIABLES.keyCompiledFields;
                string keyCodiceRef = Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice;
                string keyAllEtichette = GLOBAL_VARIABLES.allEtichette;
                string keyEtichetteVisual = GLOBAL_VARIABLES.etichetteVisual;
                string keyLabel = GLOBAL_VARIABLES.keyLabel;


                //var res = await ficoController.processaKit(idLavorazione, (confronto ? IstantaLib.FicoCombinazioneKitReadMode.Advanced : IstantaLib.FicoCombinazioneKitReadMode.Classic), noCache, "", confronto);
                var res = await ficoController.processaKit(idLavorazione, IstantaLib.FicoCombinazioneKitReadMode.Advanced, noCache, ""/*, confronto*/);
                List<IstantaLib.ArticoloInKit>? listaOriginale = null;

                if (res is OkObjectResult)
                {
                    var okResult = res as OkObjectResult;
                    if (okResult!.Value is ArticoloInRevisioneKitResult)
                    {
                        var esito = (okResult.Value as ArticoloInRevisioneKitResult);
                        if (esito!.esito == false)
                        {
                            throw new Exception("Fallimento durante il processamento del kit da ficoController: " + esito.error);
                        }

                        result.tipoLavorazione = esito.tipoLavorazione;
                        listaOriginale = esito.records;
                    }
                }

                if (result.tipoLavorazione == TipoLavorazione.Volantino && (filtri == null || filtri.Filters == null || filtri.Filters.Count == 0))
                {
                    result.error = "Filtri non inseriti";
                    return Ok(result);
                }

                PromoLavorazioni? plItem = this.ctx2.PromoLavorazionis.FirstOrDefault(pl => pl.Id == idLavorazione);

                Promo? promo = this.ctx2.Promos.Where(w => w.guidID == plItem!.GuidPromo).FirstOrDefault();



                foreach (var itemOriginale in listaOriginale!)
                {
                    itemOriginale.recordInTracciato["idRec"] = itemOriginale.IdRec;
                    if (itemOriginale.recordInTracciato[GLOBAL_VARIABLES_FICO.keyCodiceGruppo].ToString() == "2907018,6922799,7053334,7231599")
                        "ok".ToString();

                    if (itemOriginale.recordInTracciato.ContainsKey(keyAllEtichette))
                    {
                        itemOriginale.allEtichette.AddRange(itemOriginale.recordInTracciato[keyAllEtichette] as List<string>);
                    }
                    ///Rimuovi duplicati
                    itemOriginale.allEtichette.GroupBy(g => g).Select(s => s.Key).ToList();
                    itemOriginale.recordInTracciato[keyAllEtichette] = itemOriginale.allEtichette;
                    itemOriginale.recordInTracciato[keyEtichetteVisual] = itemOriginale.etichetteVisual;
                }

                //Console.WriteLine($"Cerco lavorazione {idLavorazione}");

                var recordGiaImpaginati = this.ctx2.PromoLavorazioniRecords.Where(f => f.IdLavorazione == idLavorazione).ToList();


                var codiciInConflitto = listaGeneraleCodiciForzati
                    .Where(c => MatchFiltroSuLavorazioniRecord(
                        c,
                        recordGiaImpaginati,
                        listaOriginale
                    ))
                    .Distinct()
                    .ToList();

                if (codiciInConflitto.Any())
                {
                    var messaggio = "I seguenti codici forzati risultano già impaginati: " +
                        string.Join(", ", codiciInConflitto.Select(c =>
                            c.IdRec.HasValue && c.IdRec.Value > 0
                                ? $"{c.Codice} / idRec {c.IdRec.Value}"
                                : c.Codice
                        ));

                    throw new Exception(messaggio);
                }

                //if (codiciInConflitto.Any())
                //{
                //    string messaggio = "I seguenti codici forzati risultano già impaginati: " + string.Join(", ", codiciInConflitto);
                //    throw new Exception(messaggio);
                //}

                //listaOriginale = listaOriginale.Where(f => recordGiaImpaginati.Find(g => g.CodiceGruppo == f.recordInTracciato[key_codice_gruppo].ToString()) == null).ToList();
                var listaOriginaleCompleta = listaOriginale;

                listaOriginale = listaOriginale
                    .Where(f => Utility.Main.getLavorazioneRecord(
                        f.recordInTracciato[key_codice_gruppo].ToString(),
                        Convert.ToInt32(f.IdRec),
                        recordGiaImpaginati,
                        listaOriginaleCompleta
                    ) == null)
                    .ToList();

                //Qui siamo ad un crocevia
                //Il PoP non deve essere compresso in gruppi, deve uscire tutto a prescindere
                if (result.tipoLavorazione == TipoLavorazione.Volantino)
                {
                    //ordiniamo i filtri secondo il semiOrdine
                    for (var i = 0; i < filtri.Filters!.Count; i++)
                    {
                        var filter = filtri.Filters[i];
                        if (filter.listFiltri != null && filter.listFiltri.Count > 1)
                        {
                            filter.listFiltri = filter.listFiltri.OrderBy(f => f.Ordine).ToList();
                        }
                    }


                    foreach (var filtro in filtri.Filters)
                    {
                        if (filtro.Stato == statoFiltro.locked)
                        {
                            continue;
                        }
                    }

                    if (filtri.Filters == null || filtri.Filters.Count == 0)
                    {
                        return Ok("Nessun filtro trovato");
                    }
                    filtri.CodiciImpaginati ??= new List<string>();
                    filtri.CodiciEsclusi ??= new List<string>();

                    filtri.CodiciImpaginatiConId ??= new List<filtroCodici>();
                    filtri.CodiciEsclusiConId ??= new List<filtroCodici>();

                    var resLista = OttieniListaImpaginazione(listaOriginale);
                    if (!resLista.esito)
                    {
                        throw new Exception(resLista.error);
                    }

                    List<Dictionary<string, object>> listaFiltrata = resLista.listaGruppi;


                    //inserire ordinamento
                    listaFiltrata = Ordinamento.ordinaRecordsTracciato(listaFiltrata, exClass, icCtrl, this.path_external_source, this._fico_conf.Value.nomeCliente);
                    string codeFiltro = "";
                    List<CodiceFiltroKey> listaCodiciForzati = new();
                    List<CodiceFiltroKey> listaCodiciEsclusi = new();
                    var ricercaBloccoEffettuata = false;
                    List<FiltriPerPagina> gruppoFiltri = new List<FiltriPerPagina>();
                    for (int i = 0; i < filtri.Filters.Count; i++)
                    {
                        var filtro = filtri.Filters[i];


                        Dictionary<string, object> elementiValidi = new Dictionary<string, object>();
                        Dictionary<string, object> elementiAvanzatiFil = new Dictionary<string, object>();

                        if (filtro.Stato == statoFiltro.locked)
                        {
                            elementiPerPagina["Pag_" + filtro.Pag.ToString() + "_stato_" + filtro.Stato.ToString()] = elementiValidi;
                            elementiAvanzatiLimitePerPagina["Pag_" + filtro.Pag.ToString()] = new Dictionary<string, object>();

                            continue;
                        }

                        if (filtro.Stato == statoFiltro.locked || (filtro.Stato == statoFiltro.free && filtro.listFiltri != null))
                        {
                            listaCodiciForzati.Clear();
                            listaCodiciEsclusi.Clear();
                            ricercaBloccoEffettuata = false;
                        }

                        if (!ricercaBloccoEffettuata)
                        {
                            listaCodiciForzati.AddRange(GetCodiciForzatiNormalizzati(filtro));
                            listaCodiciEsclusi.AddRange(GetCodiciEsclusiNormalizzati(filtro));
                            gruppoFiltri.Add(filtro);
                            var x = 1;
                            while (i + x < filtri.Filters.Count && filtri.Filters[i + x].Stato == statoFiltro.free && filtri.Filters[i + x].listFiltri == null)
                            {
                                listaCodiciForzati.AddRange(GetCodiciForzatiNormalizzati(filtri.Filters[i + x]));
                                listaCodiciEsclusi.AddRange(GetCodiciEsclusiNormalizzati(filtri.Filters[i + x]));
                                gruppoFiltri.Add(filtri.Filters[i + x]);

                                x++;
                            }
                            ricercaBloccoEffettuata = true;
                        }

                        if (filtro.listFiltri != null)
                        {
                            codeFiltro = new string(Enumerable.Range(0, 10).Select(_ => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[Random.Shared.Next(62)]).ToArray());

                            var lastOrder = -9999;
                            var precedenteNomeGruppo = "";
                            var inserisciInGruppoPrecedente = false;
                            foreach (var fil in filtro.listFiltri)
                            {
                                string nomeGruppo = "";
                                if (fil.Ordine == lastOrder)
                                {
                                    nomeGruppo = precedenteNomeGruppo;
                                    inserisciInGruppoPrecedente = true;
                                }
                                else
                                {
                                    inserisciInGruppoPrecedente = false;
                                }
                                lastOrder = fil.Ordine;
                                List<Dictionary<string, object>> criterioValido = new List<Dictionary<string, object>>();
                                criterioValido.Clear();
                                bool firstIterationCriterio = true;

                                bool AnyKeyEquals(Dictionary<string, object> f, List<string> chiavi, List<string> valori)
                                {
                                    return chiavi.Any(chiave =>
                                        TryGetValueForKey(f, chiave, out object? dato) &&
                                        valori.Any(val => EqualsValue(dato, val))
                                    );
                                }

                                bool AnyKeyCompare(Dictionary<string, object> f, Operatore operatore, List<string> chiavi, List<string> valori)
                                {
                                    return chiavi.Any(chiave =>
                                        TryGetValueForKey(f, chiave, out object? dato) &&
                                        valori.Any(val => CompareValue(dato, val, operatore))
                                    );
                                }

                                bool AnyKeyContains(Dictionary<string, object> f, List<string> chiavi, List<string> valori)
                                {
                                    return chiavi.Any(chiave =>
                                        TryGetValueForKey(f, chiave, out object? dato) &&
                                        valori.Any(val => dato?.ToString()?.ToLower().Contains(val) == true)
                                    );
                                }

                                bool HasAnyRequestedKey(Dictionary<string, object> f, List<string> chiavi)
                                {
                                    return chiavi.Any(chiave =>
                                        TryGetValueForKey(f, chiave, out _)
                                    );
                                }

                                bool AnyKeyDifferent(Dictionary<string, object> f, List<string> chiavi, List<string> valori)
                                {
                                    return HasAnyRequestedKey(f, chiavi) && !AnyKeyEquals(f, chiavi, valori);
                                }

                                bool AnyKeyNotContains(Dictionary<string, object> f, List<string> chiavi, List<string> valori)
                                {
                                    return HasAnyRequestedKey(f, chiavi) && !AnyKeyContains(f, chiavi, valori);
                                }

                                bool IsDescrizioneKey(string chiave)
                                {
                                    return chiave == "Descrizioni.Descrizione1" ||
                                           chiave == "Descrizioni.Descrizione2" ||
                                           chiave == "Descrizioni.Descrizione3" ||
                                           chiave == "Descrizioni.Descrizione4";
                                }

                                bool TryGetValueForKey(
                                    Dictionary<string, object> f,
                                    string chiave,
                                    out object? value
                                )
                                {
                                    value = null;
                                    if (f.ContainsKey("descrizione_gruppo"))
                                    {
                                        Debug.WriteLine("");
                                    }

                                    if (IsDescrizioneKey(chiave) &&
                                        f.ContainsKey("descrizione_gruppo"))
                                    {
                                        JObject jObjExtra = f["descrizione_gruppo"] as JObject;
                                        Dictionary<string, object> listExtra = jObjExtra.ToObject<Dictionary<string, object>>();
                                        return jObjExtra.ToObject<Dictionary<string, object>>().TryGetValue(chiave, out value);
                                    }

                                    return f.TryGetValue(chiave, out value);
                                }

                                foreach (var regola in fil.Criteri!)
                                {
                                    string val = regola.Valore!;
                                    if (val == null)
                                        val = "";

                                    if (!inserisciInGruppoPrecedente)
                                    {
                                        nomeGruppo += regola.Chiave + "_";
                                        nomeGruppo += regola.Operatore.ToString() + "_";
                                        nomeGruppo += val + "_";
                                    }
                                    #region vecchie regole filtro
                                    #endregion
                                    List<string> valori = val.Split("||").Select(v => v.Trim().ToLower()).ToList();
                                    List<string> chiavi = regola.Chiave!
    .Split("||")
    .Select(k => k.Trim())
    .Where(k => !string.IsNullOrWhiteSpace(k))
    .ToList();

                                    //Console.WriteLine("FILTRO LISTA -> " + regola.Chiave + "" + String.Join("#", valori.ToArray()));

                                    if (regola.Chiave == "etichetteVisual" || regola.Chiave == "allEtichette")
                                    {
                                        if (regola.Operatore == Operatore.Uguale)
                                            regola.Operatore = Operatore.In;

                                        if (regola.Operatore == Operatore.Diverso)
                                            regola.Operatore = Operatore.NotIn;
                                    }


                                    switch (regola.Operatore)
                                    {
                                        case Operatore.Uguale:
                                            if (firstIterationCriterio)
                                            {
                                                firstIterationCriterio = false;
                                                criterioValido.AddRange(listaFiltrata.Where(f => AnyKeyEquals(f, chiavi, valori)));
                                            }
                                            else
                                            {
                                                criterioValido.RemoveAll(f => !AnyKeyEquals(f, chiavi, valori));
                                            }
                                            break;

                                        case Operatore.Minore:
                                            if (firstIterationCriterio)
                                            {
                                                firstIterationCriterio = false;
                                                criterioValido.AddRange(listaFiltrata.Where(f => AnyKeyCompare(f, Operatore.Minore, chiavi, valori)));
                                            }
                                            else
                                            {
                                                criterioValido.RemoveAll(f => !AnyKeyCompare(f, Operatore.Minore, chiavi, valori));
                                            }
                                            break;

                                        case Operatore.MinoreUguale:
                                            if (firstIterationCriterio)
                                            {
                                                firstIterationCriterio = false;
                                                criterioValido.AddRange(listaFiltrata.Where(f => AnyKeyCompare(f, Operatore.MinoreUguale, chiavi, valori)));
                                            }
                                            else
                                            {
                                                criterioValido.RemoveAll(f => !AnyKeyCompare(f, Operatore.MinoreUguale, chiavi, valori));
                                            }
                                            break;

                                        case Operatore.Maggiore:
                                            if (firstIterationCriterio)
                                            {
                                                firstIterationCriterio = false;
                                                criterioValido.AddRange(listaFiltrata.Where(f => AnyKeyCompare(f, Operatore.Maggiore, chiavi, valori)));
                                            }
                                            else
                                            {
                                                criterioValido.RemoveAll(f => !AnyKeyCompare(f, Operatore.Maggiore, chiavi, valori));
                                            }
                                            break;

                                        case Operatore.MaggioreUguale:
                                            if (firstIterationCriterio)
                                            {
                                                firstIterationCriterio = false;
                                                criterioValido.AddRange(listaFiltrata.Where(f => AnyKeyCompare(f, Operatore.MaggioreUguale, chiavi, valori)));
                                            }
                                            else
                                            {
                                                criterioValido.RemoveAll(f => !AnyKeyCompare(f, Operatore.MaggioreUguale, chiavi, valori));
                                            }
                                            break;

                                        case Operatore.Diverso:
                                            if (firstIterationCriterio)
                                            {
                                                firstIterationCriterio = false;
                                                criterioValido.AddRange(listaFiltrata.Where(f => AnyKeyDifferent(f, chiavi, valori)));
                                            }
                                            else
                                            {
                                                criterioValido.RemoveAll(f => !AnyKeyDifferent(f, chiavi, valori));
                                            }
                                            break;

                                        case Operatore.In:
                                            if (firstIterationCriterio)
                                            {
                                                firstIterationCriterio = false;
                                                criterioValido.AddRange(listaFiltrata.Where(f => AnyKeyContains(f, chiavi, valori)));
                                            }
                                            else
                                            {
                                                criterioValido.RemoveAll(f => !AnyKeyContains(f, chiavi, valori));
                                            }
                                            break;

                                        case Operatore.NotIn:
                                            if (firstIterationCriterio)
                                            {
                                                firstIterationCriterio = false;
                                                criterioValido.AddRange(listaFiltrata.Where(f => AnyKeyNotContains(f, chiavi, valori)));
                                            }
                                            else
                                            {
                                                criterioValido.RemoveAll(f => !AnyKeyNotContains(f, chiavi, valori));
                                            }
                                            break;

                                        default:
                                            break;
                                    }

                                }

                                logAssistent.Write("Criterio valido count: " + criterioValido.Count);

                                foreach (var c in criterioValido)
                                {
                                    logAssistent.Write(c[key_codice_gruppo]);
                                }

                                // 1. Ricolloca o integra i codici forzati
                                if (listaCodiciForzati.Count > 0)
                                {
                                    var forzati = new List<Dictionary<string, object>>();
                                    var nonForzati = new List<Dictionary<string, object>>();

                                    var codiciForzatiAssegnati = new HashSet<CodiceFiltroKey>();

                                    foreach (var criterio in criterioValido)
                                    {
                                        var codiceForzato = listaCodiciForzati
                                            .FirstOrDefault(c => MatchCodiceFiltro(criterio, c, key_codice_gruppo));

                                        if (!codiceForzato.Equals(default(CodiceFiltroKey)))
                                        {
                                            forzati.Add(criterio);
                                            codiciForzatiAssegnati.Add(codiceForzato);
                                        }
                                        else
                                        {
                                            nonForzati.Add(criterio);
                                        }
                                    }

                                    foreach (var codiceForzato in listaCodiciForzati)
                                    {
                                        if (codiciForzatiAssegnati.Contains(codiceForzato))
                                            continue;

                                        if (fil == filtro.listFiltri.Last())
                                        {
                                            var trovato = listaFiltrata
                                                .FirstOrDefault(d => MatchCodiceFiltro(d, codiceForzato, key_codice_gruppo));

                                            if (trovato != null)
                                            {
                                                forzati.Add(trovato);
                                                codiciForzatiAssegnati.Add(codiceForzato);
                                            }
                                        }
                                    }

                                    criterioValido = forzati.Concat(nonForzati).ToList();
                                }

                                // Filtro 1: rimuovi i codici forzati non presenti nella lista locale
                                var codiciForzatiNonLocali = listaGeneraleCodiciForzati
    .Where(c => !listaCodiciForzati.Contains(c))
    .ToList();

                                criterioValido.RemoveAll(f =>
                                    codiciForzatiNonLocali.Any(c => MatchCodiceFiltro(f, c, key_codice_gruppo))
                                );

                                // Filtro 2: rimuovi tutti i codici esclusi
                                criterioValido.RemoveAll(f =>
    listaCodiciEsclusi.Any(c => MatchCodiceFiltro(f, c, key_codice_gruppo))
);

                                if (!inserisciInGruppoPrecedente)
                                {
                                    nomeGruppo = nomeGruppo.Substring(0, nomeGruppo.Length - 1);
                                }
                                precedenteNomeGruppo = nomeGruppo;
                                if (!inserisciInGruppoPrecedente)
                                {
                                    if (criterioValido.Count > 0)
                                    {
                                        if (fil.Limite > 0)
                                        {
                                            //qua dobbiamo mettere negli elementi avanzati ciò che non si prende (ancora da fare)


                                            //var listaAppoggio = criterioValido.Take(fil.Limite).ToList();
                                            //var avanzati = criterioValido.Skip(fil.Limite).ToList();

                                            //var valoriDaRimuovere = criterioValido
                                            //.Select(dict => new
                                            //{
                                            //    CodiceRef = dict[keyCodiceRef],
                                            //    Label = dict[keyLabel]
                                            //})
                                            //.ToHashSet();

                                            //listaFiltrata.RemoveAll(f => valoriDaRimuovere.Contains(new
                                            //{
                                            //    CodiceRef = f[keyCodiceRef],
                                            //    Label = f[keyLabel]
                                            //}));
                                            //elementiValidi[nomeGruppo] = listaAppoggio;
                                            //elementiAvanzatiFil[nomeGruppo] = avanzati;

                                            var listaAppoggio = criterioValido.Take(fil.Limite).ToList();
                                            var avanzati = criterioValido.Skip(fil.Limite).ToList();

                                            RimuoviDaListaFiltrataSoloImpaginati(listaAppoggio, listaFiltrata);
                                            RimuoviImpaginatiDagliAvanzatiPrecedenti(elementiAvanzatiFil, listaAppoggio);

                                            elementiValidi[nomeGruppo] = listaAppoggio;

                                            if (avanzati.Count > 0)
                                            {
                                                elementiAvanzatiFil[nomeGruppo] = avanzati;
                                            }

                                        }
                                        else
                                        {
                                            //var valoriDaRimuovere = criterioValido
                                            //.Select(dict => new
                                            //{
                                            //    CodiceRef = dict[keyCodiceRef],
                                            //    Label = dict[keyLabel]
                                            //})
                                            //.ToHashSet();

                                            //listaFiltrata.RemoveAll(f => valoriDaRimuovere.Contains(new
                                            //{
                                            //    CodiceRef = f[keyCodiceRef],
                                            //    Label = f[keyLabel]
                                            //}));

                                            //elementiValidi[nomeGruppo] = criterioValido;

                                            RimuoviDaListaFiltrataSoloImpaginati(criterioValido, listaFiltrata);
                                            RimuoviImpaginatiDagliAvanzatiPrecedenti(elementiAvanzatiFil, criterioValido);

                                            elementiValidi[nomeGruppo] = criterioValido;
                                        }
                                    }
                                }
                                else
                                {
                                    if (criterioValido.Count > 0)
                                    {
                                        if (elementiValidi.ContainsKey(nomeGruppo))
                                        {
                                            if (fil.Limite > 0)
                                            {
                                                //qua dobbiamo mettere negli elementi avanzati ciò che non si prende (ancora da fare)


                                                //var listaAppoggio = criterioValido.Take(fil.Limite).ToList();
                                                //var avanzati = criterioValido.Skip(fil.Limite).ToList();

                                                //var valoriDaRimuovere = criterioValido
                                                //.Select(dict => new
                                                //{
                                                //    CodiceRef = dict[keyCodiceRef],
                                                //    Label = dict[keyLabel]
                                                //})
                                                //.ToHashSet();

                                                //listaFiltrata.RemoveAll(f => valoriDaRimuovere.Contains(new
                                                //{
                                                //    CodiceRef = f[keyCodiceRef],
                                                //    Label = f[keyLabel]
                                                //}));

                                                //(elementiValidi[nomeGruppo] as List<Dictionary<string, object>>)!.AddRange(listaAppoggio);
                                                //(elementiAvanzatiFil[nomeGruppo] as List<Dictionary<string, object>>)!.AddRange(avanzati);

                                                var listaAppoggio = criterioValido.Take(fil.Limite).ToList();
                                                var avanzati = criterioValido.Skip(fil.Limite).ToList();

                                                RimuoviDaListaFiltrataSoloImpaginati(listaAppoggio, listaFiltrata);
                                                RimuoviImpaginatiDagliAvanzatiPrecedenti(elementiAvanzatiFil, listaAppoggio);

                                                (elementiValidi[nomeGruppo] as List<Dictionary<string, object>>)!.AddRange(listaAppoggio);

                                                if (avanzati.Count > 0)
                                                {
                                                    if (elementiAvanzatiFil.ContainsKey(nomeGruppo))
                                                    {
                                                        (elementiAvanzatiFil[nomeGruppo] as List<Dictionary<string, object>>)!.AddRange(avanzati);
                                                    }
                                                    else
                                                    {
                                                        elementiAvanzatiFil[nomeGruppo] = avanzati;
                                                    }
                                                }
                                            }
                                            else
                                            {
                                                RimuoviDaListaFiltrataSoloImpaginati(criterioValido, listaFiltrata);
                                                RimuoviImpaginatiDagliAvanzatiPrecedenti(elementiAvanzatiFil, criterioValido);

                                                (elementiValidi[nomeGruppo] as List<Dictionary<string, object>>)!.AddRange(criterioValido);

                                                //var valoriDaRimuovere = criterioValido
                                                //.Select(dict => new
                                                //{
                                                //    CodiceRef = dict[keyCodiceRef],
                                                //    Label = dict[keyLabel]
                                                //})
                                                //.ToHashSet();
                                                //listaFiltrata.RemoveAll(f => valoriDaRimuovere.Contains(new
                                                //{
                                                //    CodiceRef = f[keyCodiceRef],
                                                //    Label = f[keyLabel]
                                                //}));

                                                //(elementiValidi[nomeGruppo] as List<Dictionary<string, object>>)!.AddRange(criterioValido);
                                            }
                                            //serve riordinare di nuovo? Da scoprire
                                            List<Dictionary<string, object>>? recordSommati = elementiValidi[nomeGruppo] as List<Dictionary<string, object>>;
                                            recordSommati = Ordinamento.ordinaRecordsTracciato(recordSommati!, exClass, icCtrl, this.path_external_source, this._fico_conf.Value.nomeCliente);

                                            elementiValidi[nomeGruppo] = recordSommati;
                                        }
                                    }
                                }
                            }

                        }
                        logAssistent.Write("elementi validi " + elementiValidi.Count);

                        elementiPerPagina["Pag_" + filtro.Pag.ToString() + "_stato_" + ((int)filtro.Stato).ToString() + "_codiceFiltro_" + codeFiltro] = elementiValidi;
                        elementiAvanzatiLimitePerPagina["Pag_" + filtro.Pag.ToString() + "_codiceFiltro_" + codeFiltro] = elementiAvanzatiFil;
                    }

                    var elementiAvanzati = new List<Dictionary<string, object>>();
                    var nextPair = new Dictionary<string, object>();
                    int lastPage = -1;
                    List<Dictionary<string, object>> oggettiImpaginati = new List<Dictionary<string, object>>();

                    for (int i = 0; i < elementiPerPagina.Count; i++)
                    {
                        var pair = elementiPerPagina.ElementAt(i);
                        int pag = Convert.ToInt32(pair.Key.Split("_")[1]);
                        if(pag <= 0)
                        {
                            throw new Exception("E' stata richiesta per l'impaginazione la pagina non valida di numero: " + pag);
                        }
                        string codiceFiltro = "";
                        if (pair.Key.Split("_").Count() > 4)
                            codiceFiltro = pair.Key.Split("_")[5].ToString();

                        var filtroCorrispondente = filtri.Filters.Find(f => f.Pag == pag);
                        ResponseImpagination resultPag = new ResponseImpagination();
                        bool pagGiaCreata = false;
                        resultPag.ListaRef = new List<Dictionary<string, object>>();
                        resultPag.ListaRefNonImpaginate = new List<Dictionary<string, object>>();
                        resultPag.Errori = new List<string>();
                        resultPag.Pag = pag;
                        if (result.Result.Find(f => f.Pag == pag) != null)
                        {
                            resultPag = result.Result.Find(f => f.Pag == pag)!;
                            pagGiaCreata = true;
                        }
                        if (filtroCorrispondente!.Stato != statoFiltro.free || (filtroCorrispondente.Stato == statoFiltro.free && filtroCorrispondente.listFiltri != null && filtroCorrispondente.listFiltri.Count > 0))
                        {
                            //if (elementiAvanzati.Count > 0 && !ultimoCiclo)
                            //{
                            //    result.Result.Last().ListaRefNonImpaginate.AddRange(elementiAvanzati);
                            //    elementiAvanzati.Clear();
                            //}
                            //else if (elementiAvanzati.Count > 0 && ultimoCiclo)
                            if (elementiAvanzati.Count > 0)
                            {
                                int index = result.Result.IndexOf(result.Result.Find(f => f.Pag == lastPage)!);
                                if (index >= 0)
                                {
                                    result.Result[index].ListaRefNonImpaginate!.AddRange(elementiAvanzati);
                                    elementiAvanzati.Clear();
                                }
                            }
                        }
                        if (filtroCorrispondente.Stato == statoFiltro.locked)
                        {
                            nextPair.Clear();
                            continue;
                        }



                        PromoLavorazioniRecord _ref = new PromoLavorazioniRecord();

                        _ref.Pagina = (Byte)pag;
                        _ref.Indice = (Byte)0;


                        var filtroOggetto = (pair.Value as Dictionary<string, object>);
                        if (filtroOggetto!.Values.Count == 0)
                        {
                            foreach (var coppia in nextPair)
                            {
                                filtroOggetto.Add(coppia.Key, coppia.Value);
                            }
                        }
                        nextPair.Clear();

                        int[] posizioneInGrigliaUltimoElementoCategoria = new int[] { -1, -1 };
                        //questo if (ma non l'else) sarà presto deprecato, serve per la transizione della letture griglie da vecchio a nuovo metodo
                        if(filtri.GriglieValide == null || filtri.GriglieValide.Count == 0)
                        {
                            if (filtroCorrispondente.Griglia == null || CalcolaEspressione(filtroCorrispondente.Griglia.nomeGriglia!) == 0/*|| filtroCorrispondente.Griglia.Righe == null || filtroCorrispondente.Griglia.Righe.Count == 0*/)
                            {
                                logAssistent.Write("Griglia da impostare per pagina " + filtroCorrispondente.Pag);
                                int totalElements = 0;
                                int pagConsecutive = consecutivePagesAutoImpaginazione(pag, filtri);
                                Dictionary<string, object> primoElementDaCuiLeggereTracciatoContext = new Dictionary<string, object>();
                                if (filtroOggetto.Values.Count > 0)
                                {
                                    foreach (var listaCategorieOggetti in filtroOggetto.Values)
                                    {

                                        var elementiDaImpaginare = listaCategorieOggetti as List<Dictionary<string, object>>;
                                        totalElements += elementiDaImpaginare!.Count;
                                        if (elementiDaImpaginare.Count > 0)
                                        {
                                            primoElementDaCuiLeggereTracciatoContext = elementiDaImpaginare[0];
                                        }
                                    }

                                }
                                if (totalElements == 0)
                                {
                                    continue;
                                }
                                float elementiMediPerPagina = totalElements / pagConsecutive;

                                Formato? formato = SingletonConfiguration.DBFORMATI!.source.Where(f => f.guidID == promoLav!.GuidFormato).FirstOrDefault();
                                FormatoDettagli? frmDtl = formato!.dettagliGriglie.Where(d => d.pag == pag).FirstOrDefault();
                                if (frmDtl == null)
                                {
                                    throw new Exception("Il formato per pagina " + pag + " non è stato specificato, aggiornare SourceFormati.json nella cartella externalSource");
                                }
                                List<regoleGriglia> regoleGriglie = formato.regoleGriglie;
                                filtroCorrispondente.Griglia = findGriglia(pag, elementiMediPerPagina, pagConsecutive, frmDtl, regoleGriglie, primoElementDaCuiLeggereTracciatoContext, promo!, plItem!);
                            }
                            else if (CalcolaEspressione(filtroCorrispondente.Griglia.nomeGriglia!) != filtroCorrispondente.Griglia.numeroBox)
                            {
                                filtroCorrispondente.Griglia.numeroBox = CalcolaEspressione(filtroCorrispondente.Griglia.nomeGriglia!);
                            }
                        }
                        else
                        {
                            if (filtroCorrispondente.Griglia == null || CalcolaEspressione(filtroCorrispondente.Griglia.formato!) == 0/*|| filtroCorrispondente.Griglia.Righe == null || filtroCorrispondente.Griglia.Righe.Count == 0*/)
                            {
                                logAssistent.Write("Griglia da impostare per pagina " + filtroCorrispondente.Pag);
                                int totalElements = 0;
                                int pagConsecutive = consecutivePagesAutoImpaginazione(pag, filtri);
                                Dictionary<string, object> primoElementDaCuiLeggereTracciatoContext = new Dictionary<string, object>();
                                if (filtroOggetto.Values.Count > 0)
                                {
                                    foreach (var listaCategorieOggetti in filtroOggetto.Values)
                                    {

                                        var elementiDaImpaginare = listaCategorieOggetti as List<Dictionary<string, object>>;
                                        totalElements += elementiDaImpaginare!.Count;
                                        if (elementiDaImpaginare.Count > 0)
                                        {
                                            primoElementDaCuiLeggereTracciatoContext = elementiDaImpaginare[0];
                                        }
                                    }

                                }
                                if (totalElements == 0)
                                {
                                    continue;
                                }
                                float elementiMediPerPagina = totalElements / pagConsecutive;

                                //Formato? formato = SingletonConfiguration.DBFORMATI!.source.Where(f => f.guidID == promoLav!.GuidFormato).FirstOrDefault();
                                //FormatoDettagli? frmDtl = formato!.dettagliGriglie.Where(d => d.pag == pag).FirstOrDefault();
                                //if (frmDtl == null)
                                //{
                                //    throw new Exception("Il formato per pagina " + pag + " non è stato specificato, aggiornare SourceFormati.json nella cartella externalSource");
                                //}
                                //List<regoleGriglia> regoleGriglie = formato.regoleGriglie;
                                //filtroCorrispondente.Griglia = findGriglia(pag, elementiMediPerPagina, pagConsecutive, frmDtl, regoleGriglie, primoElementDaCuiLeggereTracciatoContext, promo!, plItem!);
                                filtroCorrispondente.Griglia = findGrigliaNew(elementiMediPerPagina, pagConsecutive, filtri.GriglieValide, primoElementDaCuiLeggereTracciatoContext, promo!, plItem!);
                            }
                            else if (CalcolaEspressione(filtroCorrispondente.Griglia.formato!) != filtroCorrispondente.Griglia.numeroBox)
                            {
                                filtroCorrispondente.Griglia.numeroBox = CalcolaEspressione(filtroCorrispondente.Griglia.formato!);
                            }
                        }


                        resultPag.Griglia = filtroCorrispondente.Griglia;
                        if (resultPag.ConteggioBox == 0)
                        {
                            resultPag.ConteggioBox = resultPag.Griglia.numeroBox;
                        }
                        int countElementiDaImpaginare = 0;
                        int elementiImpaginati = 0;
                        int boxOccupati = 0;
                        elementiAvanzati.Clear();

                        var elementiAvanzatiLimite = elementiAvanzatiLimitePerPagina.ElementAt(i).Value as Dictionary<string, object>;

                        elementiAvanzati.AddRange(elementiAvanzatiLimite!.SelectMany(f => (List<Dictionary<string, object>>)f.Value));

                        codiciForzatiPerPagina.TryGetValue(pag, out var codiciForzatiDiPagina);
                        codiciForzatiDiPagina ??= new List<CodiceFiltroKey>();
                        // 1) Impaginazione forzata
                        if (codiciForzatiDiPagina.Count > 0)
                        {

                            foreach (var codiceForzato in codiciForzatiDiPagina)
                            {
                                var oggetto = filtroOggetto
                                    .SelectMany(kvp => (List<Dictionary<string, object>>)kvp.Value)
                                    .FirstOrDefault(o => MatchCodiceFiltro(o, codiceForzato, key_codice_gruppo));

                                if (oggetto == null)
                                {
                                    var label = codiceForzato.IsConId
                                        ? $"{codiceForzato.Codice} / idRec {codiceForzato.IdRec}"
                                        : codiceForzato.Codice;

                                    throw new Exception($"Codice forzato '{label}' non trovato tra i criteri validi della pagina {pag}");
                                }

                                if (oggettiImpaginati.Any(o => MatchCodiceFiltro(o, codiceForzato, key_codice_gruppo)))
                                    continue; // già impaginato

                                //var posizione = GetGrigliaPosition(filtroCorrispondente.Griglia, new List<int[]>(), tipoImpaginazione);
                                //if (posizione[0] == -1 || posizione[1] == -1)
                                if (filtroCorrispondente.Griglia.numeroBox <= filtroCorrispondente.Griglia.boxOccupati.Count)
                                {
                                    throw new Exception($"Nessuna posizione disponibile per codice forzato '{codiceForzato}' su pagina {pag}");
                                }

                                //var resRicerca = CheckGrigliaPosition(filtroCorrispondente.Griglia, new List<int[]>(), posizione, 1, 1, tipoImpaginazione);
                                //if (!resRicerca.esito)
                                //{
                                //    throw new Exception($"Posizione non valida per codice forzato '{codiceForzato}' su pagina {pag}");
                                //}

                                // Impagina il codice come fai nel blocco successivo (semplificato)
                                //oggetto[GLOBAL_VARIABLES.keyPosizioniRichieste] = resRicerca.posizioneRichiesta;
                                var boxDisponibile = GetBoxDisponibile(filtroCorrispondente.Griglia.numeroBox, filtroCorrispondente.Griglia.boxOccupati);
                                if (boxDisponibile == -1)
                                {
                                    throw new Exception($"Posizione non valida per codice forzato '{codiceForzato}' su pagina {pag}");
                                }
                                oggetto[GLOBAL_VARIABLES.keyBoxRichiesto] = boxDisponibile;

                                resultPag.ListaRef!.Add(oggetto);
                                oggettiImpaginati.Add(oggetto);
                                var codiceGruppo = oggetto[key_codice_gruppo].ToString()!;
                                var idRec = Convert.ToInt32(oggetto["idRec"]);

                                filtri.CodiciImpaginati.Add(codiceGruppo);

                                filtri.CodiciImpaginatiConId.Add(new filtroCodici
                                {
                                    codice = codiceGruppo,
                                    idRec = idRec
                                });

                                if (impagina)
                                {
                                    PromoLavorazioniRecord recToAdd = new PromoLavorazioniRecord();
                                    recToAdd.Codice = oggetto[keyCodiceRef].ToString();
                                    recToAdd.CodiceGruppo = oggetto[key_codice_gruppo].ToString();
                                    recToAdd.IdRecordTracciato = Convert.ToInt64(oggetto["idRec"]);
                                    recToAdd.IdLavorazione = idLavorazione;
                                    recToAdd.Pagina = (Byte)pag;
                                    recToAdd.Indice = (Byte)0;
                                    recToAdd.IdAutore = id_utente;
                                    recToAdd.RegisterDate = DateTime.Now;
                                    this.ctx2.PromoLavorazioniRecords.Add(recToAdd);
                                }

                                filtroCorrispondente.Griglia.boxOccupati.Add(boxDisponibile);
                                //filtroCorrispondente.Griglia.Righe[resRicerca.posizioneRichiesta[1]][resRicerca.posizioneRichiesta[0]] = 1;
                                //boxOccupati += resRicerca.spaziOccupati;
                                elementiImpaginati++;
                            }
                        }



                        foreach (var listaCategorie in filtroOggetto)
                        {
                            var listaCategorieOggetti = listaCategorie.Value;

                            var elementiDaImpaginare = listaCategorieOggetti as List<Dictionary<string, object>>;
                            var elementiAvanzatiCategoria = new List<Dictionary<string, object>>();
                            if (elementiDaImpaginare!.Count > 0)
                            {
                                countElementiDaImpaginare = elementiDaImpaginare.Count;
                            }
                            else if (elementiDaImpaginare.Count > 0 && elementiAvanzati.Count == 0)
                            {
                                countElementiDaImpaginare = 0;
                            }


                            resultPag.ConteggioRef = countElementiDaImpaginare;
                            bool riempito = filtroCorrispondente.Griglia.boxOccupati.Count >= filtroCorrispondente.Griglia.numeroBox;

                            //nuova parte per i codici forzati


                            foreach (var oggetto in elementiDaImpaginare)
                            {

                                var codiceForzatoGlobale = listaGeneraleCodiciForzati
    .FirstOrDefault(c => MatchCodiceFiltro(oggetto, c, key_codice_gruppo));

                                if (!codiceForzatoGlobale.Equals(default(CodiceFiltroKey)))
                                {
                                    var forzatoDiQuestaPagina = codiciForzatiDiPagina != null &&
                                        codiciForzatiDiPagina.Any(c => MatchCodiceFiltro(oggetto, c, key_codice_gruppo));

                                    if (!forzatoDiQuestaPagina)
                                    {
                                        elementiAvanzati.Add(oggetto);
                                        elementiAvanzatiCategoria.Add(oggetto);
                                    }

                                    continue;
                                }

                                if (oggettiImpaginati.Any(f => SameRecordImpaginazione(f, oggetto, key_codice_gruppo)))
                                {
                                    continue;
                                }
                                _ref.CodiceGruppo = (oggetto[key_codice_gruppo] as string)!.Contains(",") ? (oggetto[key_codice_gruppo] as string) : null;
                                _ref.Codice = oggetto[keyCodiceRef].ToString();
                                if (!oggetto.ContainsKey("idRec"))
                                {
                                    oggetto.ToString();
                                }
                                _ref.IdRecordTracciato = /*!(oggetto[key_codice_gruppo] as string).Contains(",") ? */Convert.ToInt64(oggetto["idRec"]) /*: null*/;
                                bool posizioneValida = false;
                                List<int[]> posizioniNonValide = new List<int[]>();
                                while (!posizioneValida)
                                {
                                    riempito = filtroCorrispondente.Griglia.boxOccupati.Count >= filtroCorrispondente.Griglia.numeroBox;
                                    //int[] posizione = GetGrigliaPosition(filtroCorrispondente.Griglia, posizioniNonValide, tipoImpaginazione); //la posizione è nel formato colonna, riga
                                    //if (posizione[0] != -1 && posizione[1] != -1 && !riempito)
                                    if (!riempito)
                                    {

                                        //int[] formatoMeccanicaRichiesta = new int[] { 1, 1 };
                                        //if (tipoImpaginazione == TipoImpagnazione.UnoXUno && (formatoMeccanicaRichiesta[0] != 1 || formatoMeccanicaRichiesta[1] != 1))
                                        //{
                                        //    break;
                                        //}
                                        //else if (tipoImpaginazione == TipoImpagnazione.SoloIngombranti && formatoMeccanicaRichiesta[0] == 1 && formatoMeccanicaRichiesta[1] == 1)
                                        //{
                                        //    break;
                                        //}

                                        //var resRicerca = CheckGrigliaPosition(filtroCorrispondente.Griglia, posizioniNonValide, posizione, formatoMeccanicaRichiesta[0], formatoMeccanicaRichiesta[1], tipoImpaginazione);

                                        //if (resRicerca.esito)
                                        //{
                                        posizioneValida = true;
                                        //oggetto[GLOBAL_VARIABLES.keyPosizioniRichieste] = resRicerca.posizioneRichiesta;

                                        var boxDisponibile = GetBoxDisponibile(filtroCorrispondente.Griglia.numeroBox, filtroCorrispondente.Griglia.boxOccupati);
                                        if (boxDisponibile != -1)
                                        {

                                            oggetto[GLOBAL_VARIABLES.keyBoxRichiesto] = boxDisponibile;

                                            //Vediamo se è in corso un confronto
                                            //if (idLavorazioneConfronto > 0)
                                            //{
                                            //    string codGruppo = oggetto[key_codice_gruppo].ToString()!;
                                            //    PromoLavorazioniRecord? refDiConfronto = promoLavConfronto!.PromoLavorazioniRecords.FirstOrDefault(plr => plr.CodiceGruppo == codGruppo);

                                            //    oggetto[GLOBAL_VARIABLES.keyConfrontoPaginaInMaster] = 0;//Di defual la metto come Confronto NON TROVATO

                                            //    if (refDiConfronto != null)
                                            //    {
                                            //        oggetto[GLOBAL_VARIABLES.keyConfrontoPaginaInMaster] = refDiConfronto.Pagina;
                                            //    }
                                            //}

                                            resultPag.ListaRef!.Add(oggetto);
                                            oggettiImpaginati.Add(oggetto);
                                            var codiceGruppo = oggetto[key_codice_gruppo].ToString()!;
                                            var idRec = Convert.ToInt32(oggetto["idRec"]);

                                            filtri.CodiciImpaginati.Add(codiceGruppo);

                                            filtri.CodiciImpaginatiConId.Add(new filtroCodici
                                            {
                                                codice = codiceGruppo,
                                                idRec = idRec
                                            }); 
                                            
                                            if (impagina)
                                            {

                                                PromoLavorazioniRecord recToAdd = new PromoLavorazioniRecord();
                                                recToAdd.Codice = oggetto[keyCodiceRef].ToString();
                                                recToAdd.CodiceGruppo = oggetto[key_codice_gruppo].ToString();
                                                recToAdd.IdRecordTracciato = /*!(oggetto[key_codice_gruppo] as string).Contains(",") ? */Convert.ToInt64(oggetto["idRec"]) /*: null*/;
                                                recToAdd.IdLavorazione = idLavorazione;
                                                recToAdd.Pagina = (Byte)pag;
                                                recToAdd.Indice = (Byte)0;
                                                recToAdd.IdAutore = id_utente;
                                                recToAdd.RegisterDate = DateTime.Now;
                                                this.ctx2.PromoLavorazioniRecords.Add(recToAdd);


                                            }

                                            elementiImpaginati++;
                                            //boxOccupati += resRicerca.spaziOccupati;


                                            //filtroCorrispondente.Griglia.Righe[resRicerca.posizioneRichiesta[1]][resRicerca.posizioneRichiesta[0]] = 1;
                                            filtroCorrispondente.Griglia.boxOccupati.Add(boxDisponibile);
                                        }
                                        else
                                        {
                                            riempito = true;

                                            elementiAvanzati.Add(oggetto);
                                            elementiAvanzatiCategoria.Add(oggetto);
                                            break;
                                        }
                                    }
                                    else
                                    {

                                        //int[] formatoMeccanicaRichiesta = new int[2] { 1, 1 };
                                        //if (tipoImpaginazione == TipoImpagnazione.UnoXUno && (formatoMeccanicaRichiesta[0] != 1 || formatoMeccanicaRichiesta[1] != 1))
                                        //{
                                        //    break;
                                        //}
                                        //else if (tipoImpaginazione == TipoImpagnazione.SoloIngombranti && formatoMeccanicaRichiesta[0] == 1 && formatoMeccanicaRichiesta[1] == 1)
                                        //{
                                        //    break;
                                        //}
                                        elementiAvanzati.Add(oggetto);
                                        elementiAvanzatiCategoria.Add(oggetto);
                                        break;
                                    }
                                }
                            }
                            List<Dictionary<string, object>> tmpDictionary = new List<Dictionary<string, object>>();
                            foreach (var item in elementiAvanzatiCategoria)
                            {
                                tmpDictionary.Add(item);
                            }
                            nextPair[listaCategorie.Key] = tmpDictionary;
                        }
                        resultPag.ConteggioRefImpaginate += elementiImpaginati;
                        resultPag.ConteggioBoxOccupati += boxOccupati;
                        resultPag.codiceFiltro = codiceFiltro;
                        if (!pagGiaCreata)
                        {
                            result.Result.Add(resultPag);
                        }
                        lastPage = pag;
                    }
                    if (impagina)
                    {
                        this.ctx2.SaveChanges();
                    }
                    if (elementiAvanzati.Count > 0)
                    {
                        result.Result.Last().ListaRefNonImpaginate!.AddRange(elementiAvanzati);
                        elementiAvanzati.Clear();
                    }

                    //if (tipoImpaginazione == TipoImpagnazione.SoloIngombranti)
                    //{
                    //    ultimoCiclo = true;
                    //}
                }
                else
                {
                    Console.WriteLine("Impaginazione POP fase 1");

                    // NOTA MIGRAZIONE codiciConId:
                    // Per ora il PoP non aggiorna CodiciImpaginatiConId perché non usa la logica
                    // di filtri/avanzati del Volantino. La migrazione del PoP verrà gestita separatamente.

                    result.Result = new List<ResponseImpagination>();

                    //Raccolgo tutti i formati di lavorazioen tipo VOL
                    List<string> guidIdsFormatiVol = SingletonConfiguration.DBFORMATI!.source.Where(f => f.tipo == TipoLavorazione.Volantino).Select(s => s.guidID).ToList();

                    //Mi serve innanzitutto di avere a portata i mano il VOL di riferimento delle sole prestazioni che hanno subito variazioni eplicite
                    List<int> idsPlFormatiVol = this.ctx2.PromoLavorazionis.Where(p => p.GuidPromo == promoLav!.GuidPromo &&
                    p.GuidCanale == promoLav.GuidCanale &&
                    p.GuidArea == promoLav.GuidArea && guidIdsFormatiVol.Contains(p.GuidFormato!)
                    ).Select(s => s.Id).ToList();

                    List<PromoLavorazioniRecord> plrAlteratiNeiFormatiVol = this.ctx2.PromoLavorazioniRecords.Where(p => idsPlFormatiVol.Contains(p.IdLavorazione) && p.Meta != null).ToList();

                    Console.WriteLine("Impaginazione POP fase 1_2");

                    if (impagina)
                    {
                        //I formati PoP possono al massimo configurare solo il formato di pag 0 in quanto non hanno un numero di pag definito ma sequenziale
                        //FormatoDettagli frmDtl = SingletonConfiguration.DBFORMATI.source.Where(f => f.guidID == promoLav!.GuidFormato).Select(s => s.dettagliGriglie.Where(d => d.pag == 0).FirstOrDefault()).FirstOrDefault()!;
                        string grigliaDef = "1x1";
                        string grigliaNome = "1x1";
                        if (filtri.GriglieValide != null)
                        {
                            if (filtri.GriglieValide.Count > 1)
                            {
                                throw new Exception("Sono state ricevute più di una griglia, controllare la libreria PoP perchè abbia una sola griglia valida per l'attuale canale.");
                            }
                            if (filtri.GriglieValide.Count == 1)
                            {
                                grigliaDef = filtri.GriglieValide[0].formato;
                                grigliaNome = filtri.GriglieValide[0].nomeGriglia;
                            }
                        }

                        //if (frmDtl != null)
                        //{
                        //    //Al massimo una sola griglia, non devono adattarsi a scenari ma IMPONGONO
                        //    if (frmDtl.griglie.Count > 0)
                        //    {
                        //        //valore di default ancora sovrascrivibile dal filtro
                        //        grigliaDef = frmDtl.griglie[0];
                        //    }
                        //}

                        

                        int pag = 1;
                        int spaziOccupati = 0;
                        var grigliaObj = new Griglia();


                        int currInPag = 0;

                        List<Dictionary<string, object>> _listTemp = new List<Dictionary<string, object>>();
                        for (int r = 0; r < listaOriginale.Count; r++)
                        {
                            var griglia = grigliaDef;
                            FiltriPerPagina filtroCorrispondente = null;
                            if (filtri != null && filtri.Filters != null && filtri.Filters.Count > 0)
                            {
                                filtroCorrispondente = filtri.Filters.Find(f => f.Pag == pag);

                                if(filtroCorrispondente == null)
                                {
                                    break;
                                }
                            }

                            if(filtroCorrispondente != null)
                            {
                                if(filtri.GriglieValide == null || filtri.GriglieValide.Count == 0)
                                {
                                    griglia = filtroCorrispondente.Griglia.nomeGriglia;
                                }
                                else
                                {
                                    griglia = filtroCorrispondente.Griglia.formato;
                                }
                                grigliaObj = filtroCorrispondente.Griglia;
                            }

                            int max_in_pag = CalcolaEspressione(griglia);

                            var rec = listaOriginale[r];

                            if (!rec.recordInTracciato.ContainsKey(key_compiled_field))
                            {
                                continue;
                            }
                            
                            rec.recordInTracciato[GLOBAL_VARIABLES.keyBoxRichiesto] = spaziOccupati + 1;
                            spaziOccupati++;
                            //Per ogni codice devo controllare se esiste alterazione esplicita di campi indesign nel VOL di riferimento
                            //List<PromoLavorazioniRecord> plrs = plrAlteratiNeiFormatiVol.Where(r => r.CodiceGruppo == rec.recordInTracciato[key_codice_gruppo].ToString()).ToList();
                            //List<RevisioneMetaPromoLavorazioni> revisioniSuPlrs = plrs.Select(s => JsonConvert.DeserializeObject<RevisioneMetaPromoLavorazioni>(s.Meta!)).ToList()!;

                            //Dictionary<string, object> syncSingoloObj = new Dictionary<string, object>();
                            ////Attenzione, al momento non esiste un ordinamento per data di modifica
                            ////Reputiamo che non sia davvero necessario metterla. Il campo dovrebbe sempre essere allineato dovuqnue
                            ////quidni si da per assodato che venga manipolato al massimo da un impaginato e sincronizzato sugli altri di conseguenza
                            ////Qualora dovesse emergere quesata esigenza è necessario mettere un campo DATA alla revisione meta
                            //foreach (RevisioneMetaPromoLavorazioni item_revisioniSuPlrs in revisioniSuPlrs)
                            //{
                            //    foreach (RevisioneCampiOffertaFromIndd co_indd in item_revisioniSuPlrs.campiOfferta!)
                            //    {
                            //        syncSingoloObj[co_indd.label] = co_indd;
                            //    }
                            //}
                            //if (syncSingoloObj.Count > 0)
                            //{
                            //    rec.recordInTracciato[GLOBAL_VARIABLES.keySyncIndd] = syncSingoloObj;
                            //}                           

                            if (rec.sottogruppo != null)
                            {

                                //List<PromoLavorazioniRecord> plrs_gruppo = plrAlteratiNeiFormatiVol.Where(r => r.CodiceGruppo == rec.recordInTracciato[keyCodiceRef].ToString()).ToList();
                                //List<RevisioneMetaPromoLavorazioni> revisioniSuPlrs_gruppo = plrs.Select(s => JsonConvert.DeserializeObject<RevisioneMetaPromoLavorazioni>(s.Meta!)).ToList()!;
                                //Dictionary<string, object> syncGruppoObj = new Dictionary<string, object>();
                                ////Attenzione, al momento non esiste un ordinamento per data di modifica
                                ////Reputiamo che non sia davvero necessario metterla. Il campo dovrebbe sempre essere allineato dovuqnue
                                ////quidni si da per assodato che venga manipolato al massimo da un impaginato e sincronizzato sugli altri di conseguenza
                                ////Qualora dovesse emergere quesata esigenza è necessario mettere un campo DATA alla revisione meta
                                //foreach (RevisioneMetaPromoLavorazioni item_revisioniSuPlrsGruppo in revisioniSuPlrs_gruppo)
                                //{
                                //    foreach (RevisioneCampiOffertaFromIndd co_indd in item_revisioniSuPlrsGruppo.campiOfferta!)
                                //    {
                                //        syncGruppoObj[co_indd.label] = co_indd;
                                //    }
                                //}
                                //if (syncGruppoObj.Count > 0)
                                //{
                                //    rec.sottogruppo[GLOBAL_VARIABLES.keySyncIndd] = syncSingoloObj;
                                //}

                                //Adesso integro anche le foto secondarie se ci sono
                                //List<Dictionary<string, object>> _elementiSottogruppo = listaOriginale.Where(l => l.recordInTracciato.ContainsKey(key_codice_sottogruppo) && l.recordInTracciato[key_codice_sottogruppo].ToString() == rec.sottogruppo[keyCodiceRef].ToString()).Select(sel => sel.recordInTracciato).ToList();

                                ////Rieloaboro la firma tracciato per permettere la verifica con la firma revisione
                                //rec.sottogruppo[Enum.GetName(AddestramentoRuoli.Tracciato) + "." + GLOBAL_VARIABLES.keyTracciatoFirma] = Utility.Main.getFirmaTracciatoGruppo(_elementiSottogruppo);

                                var codiceSottogruppo = rec.sottogruppo[keyCodiceRef].ToString();

                                rec.sottogruppo[
                                    Enum.GetName(AddestramentoRuoli.Tracciato) + "." + GLOBAL_VARIABLES.keyTracciatoFirma
                                ] = Utility.Main.getFirmaTracciatoSottogruppoDaKitRecords(
                                    listaOriginale,
                                    codiceSottogruppo!
                                );

                                //Questa prestazione prende due posti
                                currInPag++;
                                _listTemp.Add(rec.sottogruppo);

                                if (max_in_pag == currInPag || r >= listaOriginale.Count - 1)
                                {
                                    ResponseImpagination impResult = new ResponseImpagination();
                                    impResult.Pag = pag;
                                    impResult.ListaRef = _listTemp;
                                    impResult.ConteggioRef = currInPag;
                                    impResult.ConteggioRefImpaginate = currInPag;
                                    impResult.ConteggioBox = currInPag;
                                    impResult.Griglia = grigliaObj;

                                    result.Result.Add(impResult);

                                    Int64 _idRec = Convert.ToInt64(rec.recordInTracciato["idRec"]);

                                    PromoLavorazioniRecord recToAdd = new PromoLavorazioniRecord();
                                    recToAdd.Codice = rec.recordInTracciato[keyCodiceRef].ToString();
                                    recToAdd.CodiceGruppo = rec.sottogruppo[keyCodiceRef].ToString();
                                    recToAdd.IdRecordTracciato = _idRec;// Convert.ToInt64(rec.recordInTracciato["idRec"]);
                                    recToAdd.IdLavorazione = idLavorazione;
                                    recToAdd.Pagina = (Byte)pag;
                                    recToAdd.Indice = (Byte)0;
                                    recToAdd.IdAutore = id_utente;
                                    recToAdd.RegisterDate = DateTime.Now;
                                    this.ctx2.PromoLavorazioniRecords.Add(recToAdd);

                                    currInPag = 0;
                                    pag++;
                                    _listTemp = new List<Dictionary<string, object>>();
                                }

                            }

                            //Questo è il punto cruciale in cui si inserisce il record singolo SOLO se non c'p una forzatura di uscita esclusiva del suo gruppo al suo posto
                            if (!rec.forzaSoloUscitaSottogruppo)
                            {
                                _listTemp.Add(rec.recordInTracciato);

                                currInPag++;

                                if (max_in_pag == currInPag || r >= listaOriginale.Count - 1)
                                {
                                    ResponseImpagination impResult = new ResponseImpagination();
                                    impResult.Pag = pag;
                                    impResult.ListaRef = _listTemp;
                                    impResult.ConteggioRef = currInPag;
                                    impResult.ConteggioRefImpaginate = currInPag;
                                    impResult.ConteggioBox = currInPag;
                                    impResult.Griglia = grigliaObj;

                                    result.Result.Add(impResult);

                                    Int64 _idRec = Convert.ToInt64(rec.recordInTracciato["idRec"]);

                                    PromoLavorazioniRecord recSingoloToAdd = new PromoLavorazioniRecord();
                                    recSingoloToAdd.Codice = rec.recordInTracciato[keyCodiceRef].ToString();
                                    recSingoloToAdd.CodiceGruppo = rec.recordInTracciato[key_codice_gruppo].ToString();

                                    recSingoloToAdd.IdRecordTracciato = _idRec;

                                    recSingoloToAdd.IdLavorazione = idLavorazione;
                                    recSingoloToAdd.Pagina = (Byte)pag;
                                    recSingoloToAdd.Indice = (Byte)0;
                                    recSingoloToAdd.IdAutore = id_utente;
                                    recSingoloToAdd.RegisterDate = DateTime.Now;
                                    this.ctx2.PromoLavorazioniRecords.Add(recSingoloToAdd);

                                    currInPag = 0;
                                    pag++;
                                    _listTemp = new List<Dictionary<string, object>>();
                                }
                            }


                        }

                        Console.WriteLine("Impaginazione POP fase 2");

                        this.ctx2.SaveChanges();

                    }
                    else
                    {
                        Console.WriteLine("Impaginazione POP ERROR 1 ##Conteggio non disponibile per materiale PoP");
                        throw new Exception("Conteggio non disponibile per materiale PoP");
                    }

                    //result.Result = new List<ResponseImpagination>() { impResult };
                }

                //rimuoviamo dagli avanzati qualsiasi codice appaia tra gli impaginati

                //foreach (var pagResult in result.Result)
                //{
                //    if (pagResult.ListaRefNonImpaginate != null)
                //    {
                //        pagResult.ListaRefNonImpaginate.RemoveAll(singleRef =>
                //            singleRef.TryGetValue(key_codice_gruppo, out var codiceGruppoObj) &&
                //            codiceGruppoObj is string codiceGruppo &&
                //            filtri.CodiciImpaginati!.Contains(codiceGruppo)
                //        );
                //    }
                //}

                Console.WriteLine("Impaginazione POP fase 3");

                foreach (var pagResult in result.Result)
                {
                    if (pagResult.ListaRefNonImpaginate != null)
                    {
                        pagResult.ListaRefNonImpaginate.RemoveAll(singleRef =>
                        {
                            var codiceGruppo = GetCodiceGruppo(singleRef, key_codice_gruppo);
                            var idRec = GetIdRec(singleRef);

                            if (string.IsNullOrWhiteSpace(codiceGruppo))
                                return false;

                            if (filtri.CodiciImpaginatiConId != null && filtri.CodiciImpaginatiConId.Count > 0)
                            {
                                return filtri.CodiciImpaginatiConId.Any(c =>
                                    c.codice == codiceGruppo &&
                                    idRec.HasValue &&
                                    c.idRec == idRec.Value
                                );
                            }

                            return filtri.CodiciImpaginati != null &&
                                   filtri.CodiciImpaginati.Contains(codiceGruppo);
                        });
                    }
                }

                Console.WriteLine("Impaginazione POP fase 4");

            }
            catch (Exception ex)
            {
                Console.WriteLine("Impaginazione POP ERROR 2 " + ex.ToString());

                result.error = ex.ToString();
                return Ok(result);
            }

            //string keyNomeFoto = Enum.GetName(AddestramentoRuoli.Foto) + "." + GLOBAL_VARIABLES.keyFotoNome;
            //string keyRefCodice = Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice;

            //Dictionary<string, object> fotoDaScaricare = new Dictionary<string, object>();
            //foreach (var item in result.Result)
            //{
            //    foreach (var refImpaginata in item.ListaRef)
            //    {
            //        fotoDaScaricare[refImpaginata[keyRefCodice].ToString()] = refImpaginata[keyNomeFoto];
            //    }
            //}

            return Ok(result);
        }

        private bool TryParseComparableDate(object? value, out DateTime date)
        {
            date = default;

            if (value == null)
                return false;

            string str = value.ToString()?.Trim() ?? "";

            if (string.IsNullOrWhiteSpace(str))
                return false;

            // Caso ISO tipo: 2025-01-31T14:22:10
            // Ignoriamo il time e prendiamo solo la parte data.
            int tIndex = str.IndexOf('T');
            if (tIndex > 0)
            {
                str = str.Substring(0, tIndex);
            }

            return DateTime.TryParse(
                str,
                CultureInfo.GetCultureInfo("it-IT"),
                DateTimeStyles.None,
                out date
            );
        }

        private bool CompareValue(object? dato, string valoreRegola, Operatore operatore)
        {
            string datoStr = dato?.ToString()?.Trim() ?? "";
            string regolaStr = valoreRegola?.Trim() ?? "";

            // Prima provo come date.
            // Se entrambe sono date, confronto solo la parte Date.
            if (TryParseComparableDate(datoStr, out DateTime datoDate) &&
                TryParseComparableDate(regolaStr, out DateTime regolaDate))
            {
                datoDate = datoDate.Date;
                regolaDate = regolaDate.Date;

                return operatore switch
                {
                    Operatore.Minore => datoDate < regolaDate,
                    Operatore.MinoreUguale => datoDate <= regolaDate,
                    Operatore.Maggiore => datoDate > regolaDate,
                    Operatore.MaggioreUguale => datoDate >= regolaDate,
                    _ => false
                };
            }

            // Se non sono date, provo come numeri.
            if (float.TryParse(datoStr, NumberStyles.Float, CultureInfo.GetCultureInfo("it-IT"), out float datoValue) &&
                float.TryParse(regolaStr, NumberStyles.Float, CultureInfo.GetCultureInfo("it-IT"), out float regolaValue))
            {
                return operatore switch
                {
                    Operatore.Minore => datoValue < regolaValue,
                    Operatore.MinoreUguale => datoValue <= regolaValue,
                    Operatore.Maggiore => datoValue > regolaValue,
                    Operatore.MaggioreUguale => datoValue >= regolaValue,
                    _ => false
                };
            }

            return false;
        }

        private bool EqualsValue(object? dato, string valoreRegola)
        {
            string datoStr = dato?.ToString()?.Trim() ?? "";
            string regolaStr = valoreRegola?.Trim() ?? "";

            if (TryParseComparableDate(datoStr, out DateTime datoDate) &&
                TryParseComparableDate(regolaStr, out DateTime regolaDate))
            {
                return datoDate.Date == regolaDate.Date;
            }

            return datoStr.Equals(regolaStr, StringComparison.OrdinalIgnoreCase);
        }

        public static int CalcolaEspressione(string input)
        {
            // Sostituisci 'x' con '*' per coerenza interna
            input = input.Replace("x", "*");

            // Pattern: numero * numero, con opzionale [+/-]numero
            var match = Regex.Match(input, @"^(\d+)\*(\d+)([\+\-]\d+)?$");

            if (!match.Success)
                throw new ArgumentException("Espressione non valida");

            int primo = int.Parse(match.Groups[1].Value);
            int secondo = int.Parse(match.Groups[2].Value);
            int risultato = primo * secondo;

            if (match.Groups[3].Success)
            {
                string operazioneFinale = match.Groups[3].Value;
                if (operazioneFinale.StartsWith("+"))
                    risultato += int.Parse(operazioneFinale.Substring(1));
                else if (operazioneFinale.StartsWith("-"))
                    risultato -= int.Parse(operazioneFinale.Substring(1));
            }

            return risultato;
        }

        public static int GetBoxDisponibile(int boxTotali, List<int> boxOccupati)
        {
            for (int i = 1; i <= boxTotali; i++)
            {
                if (!boxOccupati.Contains(i))
                    return i;
            }

            // Se tutti i box sono occupati, puoi lanciare un'eccezione oppure restituire -1
            return -1;
        }

        public OkResultGruppi OttieniListaImpaginazione(List<IstantaLib.ArticoloInKit> lista)
        {
            OkResultGruppi result = new OkResultGruppi();
            string key_codice_gruppo = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppo;
            string keyXMLSelezione = GLOBAL_VARIABLES.keyXMLSelezione;
            //string keyMembriGruppoFoto = GLOBAL_VARIABLES.keyMembriGruppoFoto;
            string keyNomeFoto = Enum.GetName(AddestramentoRuoli.Foto) + "." + GLOBAL_VARIABLES.keyFotoNome;
            string key_codiceRef = Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice;
            try
            {
                var groupedRecords = lista
        .GroupBy(f => new
        {
            f.label,
            CodiceGruppo = f.recordInTracciato[key_codice_gruppo]
        });

                foreach (var item in groupedRecords)
                {
                    ////List<Dictionary<string, object>> listaFiltrata = listaOriginale.Where(f => (Byte)f.recordInTracciato[GLOBAL_VARIABLES.keyXMLSelezione] == (Byte)TipoSelezioneMenabo.Primaria).Select(f => f.recordInTracciato).ToList();
                    Dictionary<string, object>? primario = item.Where(f => Convert.ToByte(f.recordInTracciato[keyXMLSelezione]) == (Byte)TipoSelezioneMenabo.Primaria).Select(f => f.recordInTracciato).FirstOrDefault();
                    if (primario == null)
                    {
                        throw new Exception($"Primario non trovato in OttieniListaImpaginazione GRUPPO:{item.FirstOrDefault()!.recordInTracciato[GLOBAL_VARIABLES_FICO.keyCodiceGruppo]}");
                    }

                    //List<FotoElementoGruppo> membriGruppoFoto = getFotoSecondarieGruppo(item.Select(s => s.recordInTracciato).ToList(), new List<PromoLavorazioniRecord>());
                    //primario[keyMembriGruppoFoto] = membriGruppoFoto;

                    result.listaGruppi.Add(primario);
                }

                result.esito = true;
            }
            catch (Exception ex)
            {
                result.esito = false;
                result.error = ex.ToString();
                result.listaGruppi.Clear();
            }

            return result;
        }

        public class grigliaCheck
        {
            public bool esito = false;
            public int[]? posizioneRichiesta;
            public int spaziOccupati = 0;
        }

        public int consecutivePagesAutoImpaginazione(int startingPag, RootFilters filtri)
        {
            var filtroCorrispondente = filtri.Filters!.Find(f => f.Pag == startingPag);
            if (filtroCorrispondente == null)
            {
                return -1;
            }
            if (filtroCorrispondente.Stato != statoFiltro.free)
            {
                return 1;
            }
            //guardiamo quante pagine consecutive sono free e con nessuna referenza specificata
            int pagineConsecutive = 1;
            while (true)
            {
                FiltriPerPagina? nextFilter = filtri.Filters.Find(f => f.Pag == startingPag + pagineConsecutive);
                if (nextFilter == null)
                {
                    break;
                }
                else if (nextFilter.Stato != statoFiltro.free)
                {
                    break;
                }
                else if (nextFilter.listFiltri == null || nextFilter.listFiltri.Count == 0)
                {
                    pagineConsecutive++;
                }
                else
                {
                    break;
                }

                if (pagineConsecutive > 1000)
                {
                    return -1;
                }
            }
            return pagineConsecutive;
        }
        public Griglia findGriglia(int pag, float referenzePerPagina, int numeroPagine, FormatoDettagli formatoDettagli, List<regoleGriglia> regoleGriglie, Dictionary<string, object> elementoDaCuiEstrarreContextTracciato, Promo promo, PromoLavorazioni promoLavorazione)// DbMenabo menaboDB)
        {
            Griglia grigliaRichiesta = new Griglia();
            grigliaRichiesta.nomeGriglia = null;
            grigliaRichiesta.numeroBox = 0;
            //grigliaRichiesta.Righe = new List<List<int>>();
            try
            {
                if (formatoDettagli.griglie.Count == 0)
                {
                    throw new Exception("Nessuna griglia inserita nei formati");
                }
                int referenzeArrotondate = numeroPagine > 1 ? (int)Math.Round(referenzePerPagina) : (int)Math.Ceiling(referenzePerPagina);

                //trovo il formato subito prima e subito dopo necessari per spazi
                float spaziAvanzatiGrigliaScelta = 999;

                string grigliaPiuGrande = "";
                int spaziGrigliaPiuGrande = 0;

                List<string> griglieValide = getFormatiValidiGriglie(formatoDettagli, regoleGriglie, pag, elementoDaCuiEstrarreContextTracciato, promo, promoLavorazione);
                logAssistent.Write("Quantità griglie valide: " + griglieValide.Count);
                foreach (var griglia in griglieValide)  //menaboDB.formatiMenaboPagina)
                {
                    try
                    {
                        //int tempFormatoColonne = Int32.Parse(griglia.ToLower().Split("x")[0]);
                        //int tempFormatoRighe= Int32.Parse(griglia.ToLower().Split("x")[1]);

                        int referenzeContenibili = CalcolaEspressione(griglia);
                        //int referenzeContenibili = tempFormatoColonne * tempFormatoRighe;


                        //if (spazioGrigliaMassima < referenzeContenibili)
                        //{
                        //    //formatoMaggioreColonne = tempFormatoColonne;
                        //    //formatoMaggioreRighe = tempFormatoRighe;
                        //    spazioGrigliaMassima = referenzeContenibili;
                        //}
                        logAssistent.Write("Griglia: " + griglia);
                        logAssistent.Write("referenze contenibili: " + referenzeContenibili);
                        logAssistent.Write("referenze da inserire: " + referenzeArrotondate);
                        logAssistent.Write("spazi avanzati griglia scelta: " + spaziAvanzatiGrigliaScelta);

                        if(spaziGrigliaPiuGrande < referenzeContenibili)
                        {
                            spaziGrigliaPiuGrande = referenzeContenibili;
                            grigliaPiuGrande = griglia;
                        }

                        if ((referenzeContenibili >= referenzeArrotondate && ((referenzeContenibili - referenzeArrotondate) < spaziAvanzatiGrigliaScelta)))
                        {
                            //formatoTrovatoColonne = tempFormatoColonne;
                            //formatoTrovatoRighe = tempFormatoRighe;


                            spaziAvanzatiGrigliaScelta = referenzeContenibili - referenzeArrotondate;
                            grigliaRichiesta.nomeGriglia = griglia;
                            grigliaRichiesta.numeroBox = referenzeContenibili;
                            if (spaziAvanzatiGrigliaScelta == 0)
                            {
                                break;
                            }

                        }
                    }
                    catch (Exception exSilenzioso)
                    {
                        Console.WriteLine($"[catch muto] MenaboController.cs riga ~10709: {exSilenzioso.Message}");
                    }
                }

                if(grigliaRichiesta.nomeGriglia == null)
                {
                    grigliaRichiesta.nomeGriglia = grigliaPiuGrande;
                    grigliaRichiesta.numeroBox = spaziGrigliaPiuGrande;
                }

                logAssistent.Write("Griglia scelta: " + grigliaRichiesta.nomeGriglia);

                //if (formatoTrovatoRighe == 0 && formatoTrovatoColonne == 0)
                //{
                //    formatoTrovatoColonne = formatoMaggioreColonne;
                //    formatoTrovatoRighe = formatoMaggioreRighe;
                //}
                //for (int i = 0; i < formatoTrovatoRighe; i++)
                //{
                //    List<int> riga = new List<int>();
                //    for (int y = 0; y < formatoTrovatoColonne; y++)
                //    {
                //        riga.Add(0);
                //    }
                //    grigliaRichiesta.Righe.Add(riga);
                //}
            }
            catch (Exception ex)
            {
                //for (int i = 0; i < 5; i++)
                //{
                //    List<int> riga = new List<int>();
                //    for (int y = 0; y < 5; y++)
                //    {
                //        riga.Add(0);
                //    }
                //    grigliaRichiesta.Righe.Add(riga);
                //}
                logAssistent.Write("Selezione griglia errore: " + ex.Message);
                throw new Exception("Errore durante la selezione della griglia: " + ex.Message);

            }

            return grigliaRichiesta;
        }

        public Griglia findGrigliaNew(float referenzePerPagina, int numeroPagine, List<Griglia> griglieValide, Dictionary<string, object> elementoDaCuiEstrarreContextTracciato, Promo promo, PromoLavorazioni promoLavorazione)// DbMenabo menaboDB)
        {
            Griglia grigliaRichiesta = new Griglia();
            grigliaRichiesta.nomeGriglia = null;
            grigliaRichiesta.formato = null;
            grigliaRichiesta.numeroBox = 0;
            //grigliaRichiesta.Righe = new List<List<int>>();
            try
            {
                if (griglieValide == null || griglieValide.Count == 0)
                {
                    throw new Exception("Nessuna griglia valida trovata");
                }
                int referenzeArrotondate = numeroPagine > 1 ? (int)Math.Round(referenzePerPagina) : (int)Math.Ceiling(referenzePerPagina);

                //trovo il formato subito prima e subito dopo necessari per spazi
                float spaziAvanzatiGrigliaScelta = 999;

                string grigliaPiuGrande = "";
                string nomeGrigliaPiuGrande = "";
                int spaziGrigliaPiuGrande = 0;

                //List<string> griglieValide = getFormatiValidiGriglie(formatoDettagli, regoleGriglie, pag, elementoDaCuiEstrarreContextTracciato, promo, promoLavorazione);
                logAssistent.Write("Quantità griglie valide: " + griglieValide.Count);
                foreach (var griglia in griglieValide)  //menaboDB.formatiMenaboPagina)
                {
                    try
                    {

                        int referenzeContenibili = CalcolaEspressione(griglia.formato);

                        logAssistent.Write("Griglia: " + griglia);
                        logAssistent.Write("referenze contenibili: " + referenzeContenibili);
                        logAssistent.Write("referenze da inserire: " + referenzeArrotondate);
                        logAssistent.Write("spazi avanzati griglia scelta: " + spaziAvanzatiGrigliaScelta);

                        if (spaziGrigliaPiuGrande < referenzeContenibili)
                        {
                            spaziGrigliaPiuGrande = referenzeContenibili;
                            grigliaPiuGrande = griglia.formato;
                            nomeGrigliaPiuGrande = griglia.nomeGriglia;
                        }

                        if ((referenzeContenibili >= referenzeArrotondate && ((referenzeContenibili - referenzeArrotondate) < spaziAvanzatiGrigliaScelta)))
                        {
                            //formatoTrovatoColonne = tempFormatoColonne;
                            //formatoTrovatoRighe = tempFormatoRighe;


                            spaziAvanzatiGrigliaScelta = referenzeContenibili - referenzeArrotondate;
                            grigliaRichiesta.nomeGriglia = griglia.nomeGriglia;
                            grigliaRichiesta.formato = griglia.formato;
                            grigliaRichiesta.numeroBox = referenzeContenibili;
                            if (spaziAvanzatiGrigliaScelta == 0)
                            {
                                break;
                            }

                        }
                    }
                    catch (Exception exSilenzioso)
                    {
                        Console.WriteLine($"[catch muto] MenaboController.cs riga ~10814: {exSilenzioso.Message}");
                    }
                }

                if (grigliaRichiesta.nomeGriglia == null)
                {
                    grigliaRichiesta.nomeGriglia = nomeGrigliaPiuGrande;
                    grigliaRichiesta.formato = grigliaPiuGrande;
                    grigliaRichiesta.numeroBox = spaziGrigliaPiuGrande;
                }

                logAssistent.Write("Griglia scelta: " + grigliaRichiesta.nomeGriglia);
            }
            catch (Exception ex)
            {
                logAssistent.Write("Selezione griglia errore: " + ex.Message);
                throw new Exception("Errore durante la selezione della griglia: " + ex.Message);

            }

            return grigliaRichiesta;
        }

        public List<string> getFormatiValidiGriglie(FormatoDettagli formatoDettagli, List<regoleGriglia> specificaGriglie, int pag, Dictionary<string, object> elementoDaCuiEstrarreContextTracciato, Promo promo, PromoLavorazioni promoLavorazione)
        {
            return formatoDettagli.griglie;           
        }


        [HttpPut]
        [Route("Menabo/LeggiTracciatoRecord/{idTracciato}/{importa}/{isPop}/{getMastro}/{getOnlyMeta}/{leggiDaOgniTracciato}")]
        public async Task<IActionResult> LeggiTracciatoRecord(string codiceOrCodiceGruppo, int idTracciato, bool importa = true, bool isPop = false, bool getMastro = false, bool getOnlyMeta = false, bool leggiDaOgniTracciato = false)
        {

            IstantaController icItem = new IstantaController(this._config.GetConnectionString("IstandaConnectionDb")!, this.path_external_lib, this.path_external_source, this._dbContextFactory);

            List<Dictionary<string, object>> elementiTrovati = new List<Dictionary<string, object>>();
            string keyXMLSelezione = GLOBAL_VARIABLES.keyXMLSelezione;
            string keyFotoEscluse = GLOBAL_VARIABLES.keyFotoEscluse;
            string keyFotoExtraAuto = GLOBAL_VARIABLES.keyFotoExtraAuto;
            string keyHasFoto = GLOBAL_VARIABLES.keyHasFoto;
            string keyNomeFoto = Enum.GetName(AddestramentoRuoli.Foto) + "." + GLOBAL_VARIABLES.keyFotoNome;
            string keyGuidFoto = Enum.GetName(AddestramentoRuoli.Foto) + "." + GLOBAL_VARIABLES.keyFotoGuidId;
            string keyCodiceRef = Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice;
            string key_codice_gruppo = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppo;

            string descr1Key = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr1;
            string descr2Key = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr2;
            string descr3Key = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr3;
            string descr4Key = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr4;
            //string descrInddKey = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescrIndd;
            string _key_foto_extra = Enum.GetName(AddestramentoRuoli.Foto) + "." + GLOBAL_VARIABLES.keyFotoExtra;
            string _key_tracciato_firma = Enum.GetName(AddestramentoRuoli.Tracciato) + "." + GLOBAL_VARIABLES.keyTracciatoFirma;
            string keyRegoleMastro = GLOBAL_VARIABLES.keyRegoleMastro;
            string keyStatoRevisioneSingolo = GLOBAL_VARIABLES.keyStatoRevisioneSingolo;
            string keyStatoRevisioneGruppo = GLOBAL_VARIABLES.keyStatoRevisioneGruppo;
            string keyDescrizioneRegionale = GLOBAL_VARIABLES.keyDescrizioneRegionale;
            string keyDescrizioneCanale = GLOBAL_VARIABLES.keyDescrizioneCanale;
            string keyDataUltimaRicezione = GLOBAL_VARIABLES.keyDataUltimaRicezione;
            string keyAllEtichette = GLOBAL_VARIABLES.allEtichette;
            string keyEtichetteVisual = GLOBAL_VARIABLES.etichetteVisual;


            try
            {
                if (idTracciato == 0 && !leggiDaOgniTracciato)
                {
                    throw new Exception("Tracciato non selezionato");
                }
                else if (idTracciato == 0 && leggiDaOgniTracciato)
                {
                    if (codiceOrCodiceGruppo.Contains(","))
                    {
                        //List<List<PromoTracciatiRecord>> elementiGruppi = this.ctx2.PromoTracciatiRecords
                        //    .Include(f => f.IdTracciatoNavigation).ThenInclude(f=>f.IdPromoNavigation)
                        //    .Where(f => codiceOrCodiceGruppo == f.CodiceGruppo)
                        //    .GroupBy(f => f.IdTracciato)
                        //    .Select(g => g.ToList())
                        //    .ToList();
                        //List<List<Dictionary<string, object>>> elementiTrovatiTracciati = new List<List<Dictionary<string, object>>>();
                        //foreach (var elementiGruppo in elementiGruppi)
                        //{
                        //    List<Dictionary<string, object>> elementiGruppoDict = new List<Dictionary<string, object>>();
                        //    foreach (var item in elementiGruppo)
                        //    {
                        //        var dato = IstantaJson.getJsonObject(item.Dato!);
                        //        var el = new Dictionary<string, object>();
                        //        el.Add("Dato", dato);
                        //        el.Add("promo", item.IdTracciatoNavigation.IdPromoNavigation.NomePromo);
                        //        el.Add("idPromo", item.IdTracciatoNavigation.IdPromoNavigation.Id);
                        //        el.Add("dataPromo", item.IdTracciatoNavigation.IdPromoNavigation.ValiditaDal);
                        //        el.Add("tracciato", item.IdTracciatoNavigation.Sigla!);
                        //        el.Add("area", item.IdTracciatoNavigation.Area!);
                        //        el.Add("canale", item.IdTracciatoNavigation.Canale!);
                        //        el.Add("idTracciato", item.IdTracciato);
                        //        el.Add("idAddestramento", item.IdAddestramento);
                        //        elementiGruppoDict.Add(el);
                        //    }

                        //    if (elementiGruppoDict.Count > 0)
                        //    {
                        //        elementiTrovatiTracciati.Add(elementiGruppoDict);
                        //    }
                        //}


                        var records = this.ctx2.PromoTracciatiRecords
                            .Include(f => f.IdTracciatoNavigation)
                                .ThenInclude(f => f.IdPromoNavigation)
                            .Where(f => codiceOrCodiceGruppo == f.CodiceGruppo)
                            .ToList();

                        List<List<Dictionary<string, object>>> elementiTrovatiCodici = records
                            .GroupBy(f => f.Codice)
                            .Select(gruppoCodice => gruppoCodice
                                .Select(item =>
                                {
                                    var dato = IstantaJson.getJsonObject(item.Dato!);
                                    var el = new Dictionary<string, object>();
                                    el.Add("Dato", dato);
                                    el.Add("promo", item.IdTracciatoNavigation.IdPromoNavigation.NomePromo);
                                    el.Add("idPromo", item.IdTracciatoNavigation.IdPromoNavigation.Id);
                                    el.Add("dataPromo", item.IdTracciatoNavigation.IdPromoNavigation.ValiditaDal);
                                    el.Add("tracciato", item.IdTracciatoNavigation.Sigla!);
                                    el.Add("area", item.IdTracciatoNavigation.Area!);
                                    el.Add("canale", item.IdTracciatoNavigation.Canale!);
                                    el.Add("idTracciato", item.IdTracciato);
                                    el.Add("idAddestramento", item.IdAddestramento);
                                    el.Add("codice", item.Codice);
                                    return el;
                                })
                                .ToList())
                            .ToList();

                        return Ok(elementiTrovatiCodici);
                    }
                    else
                    {
                        //                    List<List<PromoTracciatiRecord>> elementiSingoli
                        //                        = this.ctx2.PromoTracciatiRecords
                        //.Include(f => f.IdTracciatoNavigation).ThenInclude(f => f.IdPromoNavigation)
                        //.Where(f => codiceOrCodiceGruppo == f.Codice)
                        //.GroupBy(f => f.IdTracciato)
                        //.Select(g => g.ToList())
                        //.ToList();

                        //List<List<Dictionary<string, object>>> elementiTrovatiTracciati = new List<List<Dictionary<string, object>>>();
                        //foreach (var elementoSingolo in elementiSingoli)
                        //{
                        //    List<Dictionary<string, object>> elementiSingoliDict = new List<Dictionary<string, object>>();
                        //    foreach (var item in elementoSingolo)
                        //    {
                        //        var dato = IstantaJson.getJsonObject(item.Dato!);
                        //        var el = new Dictionary<string, object>();
                        //        el.Add("Dato", dato);
                        //        el.Add("promo", item.IdTracciatoNavigation.IdPromoNavigation.NomePromo);
                        //        el.Add("idPromo", item.IdTracciatoNavigation.IdPromoNavigation.Id);
                        //        el.Add("dataPromo", item.IdTracciatoNavigation.IdPromoNavigation.ValiditaDal);
                        //        el.Add("tracciato", item.IdTracciatoNavigation.Sigla!);
                        //        el.Add("area", item.IdTracciatoNavigation.Area!);
                        //        el.Add("canale", item.IdTracciatoNavigation.Canale!);
                        //        el.Add("idTracciato", item.IdTracciato);
                        //        el.Add("idAddestramento", item.IdAddestramento);

                        //        elementiSingoliDict.Add(el);
                        //    }
                        //    if (elementiSingoliDict.Count > 0)
                        //    {
                        //        elementiTrovatiTracciati.Add(elementiSingoliDict);
                        //    }
                        //}
                        //return Ok(elementiTrovatiTracciati);

                        var records = this.ctx2.PromoTracciatiRecords
    .Include(f => f.IdTracciatoNavigation)
        .ThenInclude(f => f.IdPromoNavigation)
    .Where(f => codiceOrCodiceGruppo == f.Codice)
    .ToList();

                        List<List<Dictionary<string, object>>> elementiTrovatiCodici = records
                            .GroupBy(f => f.Codice)
                            .Select(gruppoCodice => gruppoCodice
                                .Select(item =>
                                {
                                    var dato = IstantaJson.getJsonObject(item.Dato!);
                                    var el = new Dictionary<string, object>();
                                    el.Add("Dato", dato);
                                    el.Add("promo", item.IdTracciatoNavigation.IdPromoNavigation.NomePromo);
                                    el.Add("idPromo", item.IdTracciatoNavigation.IdPromoNavigation.Id);
                                    el.Add("dataPromo", item.IdTracciatoNavigation.IdPromoNavigation.ValiditaDal);
                                    el.Add("tracciato", item.IdTracciatoNavigation.Sigla!);
                                    el.Add("area", item.IdTracciatoNavigation.Area!);
                                    el.Add("canale", item.IdTracciatoNavigation.Canale!);
                                    el.Add("idTracciato", item.IdTracciato);
                                    el.Add("idAddestramento", item.IdAddestramento);
                                    el.Add("codice", item.Codice);
                                    return el;
                                })
                                .ToList())
                            .ToList();

                        return Ok(elementiTrovatiCodici);


                    }
                }

                return Ok(elementiTrovati);
            }
            catch (Exception ex)
            {
                BoolResult res = new BoolResult();
                res.Esito = false;
                res.error = ex.ToString();
                return Ok(res);
            }

        }

        public int getTracciatoByCodice(List<int> tracciatiConcorrenti, string codiceGruppo, bool isPoP = false)
        {
            int idTracciato = 0;
            //prendiamo il primo codice poichè in un gruppo tutti i codici hanno lo stesso tracciato
            var codiceSingolo = codiceGruppo.Split(",")[0];

            var recordsPreVersion = this.ctx2.PromoTracciatiRecords.Where(f => f.Codice == codiceSingolo && f.CodiceGruppo == codiceGruppo && tracciatiConcorrenti.Contains(f.IdTracciato)).ToList();
            if(isPoP && recordsPreVersion.Count == 0)
            {
                recordsPreVersion = this.ctx2.PromoTracciatiRecords.Where(f => f.Codice == codiceSingolo && tracciatiConcorrenti.Contains(f.IdTracciato)).ToList();
            }
            List<PromoTracciatiRecord> records = new List<PromoTracciatiRecord>();
            foreach (var rec in recordsPreVersion)
            {
                var maxVersione = this.ctx2.PromoTracciatiRecords
    .Where(r => r.IdTracciato == rec.IdTracciato && r.Label == rec.Label)
    .Max(r => r.Versione);

                if(rec.Versione == maxVersione)
                {
                    records.Add(rec);
                }
            }
            


            if(records.Count() > 1)
            {
                logAssistent.Write("Per il codice " + codiceGruppo + " sono stati trovate " + records.Count() + " corrispondenze nei promoTracciatiRecords della stessa promo");
            }
            else if (records.Count() == 0)
            {
                logAssistent.Write("Per il codice " + codiceGruppo + " non sono state trovate corrispondenze nei promoTracciatiRecords");
                return -1;
            }
            else
            {
                idTracciato = records[0].IdTracciato;
            }

            return idTracciato;
        }

        [HttpPut]
        [Route("Menabo/getSchedeRefs/{idLavorazione}/{byPassLavorazioneRecord}")]
        [Route("Menabo/getSchedeRefs/{idLavorazione}/{byPassLavorazioneRecord}/{mode}")]
        public async Task<IActionResult> getSchedeRefs(
    [FromForm] string codiciGruppo,
    [FromForm] string? idsRec,
    int idLavorazione,
    bool byPassLavorazioneRecord = false,
    FicoCombinazioneKitReadMode mode = FicoCombinazioneKitReadMode.Classic)
        {
            try
            {
                codiciGruppo ??= "";

                var listaCodici = codiciGruppo
                    .Split("-", StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                    .ToList();

                var listaIdsRec = (idsRec ?? "")
                    .Split("-", StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                    .Select(x => long.TryParse(x, out var id) ? id : 0)
                    .ToList();

                var resultList = new List<ArticoloInRevisioneKitResult>();

                for (int i = 0; i < listaCodici.Count; i++)
                {
                    var cod = listaCodici[i];

                    var idRec = i < listaIdsRec.Count
                        ? listaIdsRec[i]
                        : 0;

                    IActionResult res = await getSchedaRef(
                        cod,
                        idLavorazione,
                        idRec,
                        byPassLavorazioneRecord,
                        mode
                    );

                    ArticoloInRevisioneKitResult gruppoResult = new ArticoloInRevisioneKitResult();

                    if (res is OkObjectResult okResult &&
                        okResult.Value is ArticoloInRevisioneKitResult schedaResult)
                    {
                        gruppoResult = schedaResult;

                        if (gruppoResult == null || !gruppoResult.esito)
                        {
                            resultList.Add(new ArticoloInRevisioneKitResult()
                            {
                                records = new List<ArticoloInKit>(),
                                error = gruppoResult?.error ?? "",
                                warn = "Gruppo " + cod + " non trovato da LeggiTracciatiRecord",
                                esito = false,
                            });
                        }
                        else
                        {
                            resultList.Add(gruppoResult);
                        }
                    }
                    else if (res is OkObjectResult okStringResult &&
                             okStringResult.Value is string errorString)
                    {
                        resultList.Add(new ArticoloInRevisioneKitResult()
                        {
                            records = new List<ArticoloInKit>(),
                            error = errorString,
                            esito = false,
                        });
                    }
                    else
                    {
                        resultList.Add(new ArticoloInRevisioneKitResult()
                        {
                            records = new List<ArticoloInKit>(),
                            error = "Errore nel tentativo di leggere il risultato di LeggiTracciatiRecord",
                            esito = false,
                        });
                    }
                }

                return Ok(resultList);
            }
            catch
            {
                return Ok(new List<ArticoloInRevisioneKitResult>());
            }
        }


        [HttpPut]
        [Route("Menabo/getSchedaRef/{idLavorazione}/{byPassLavorazioneRecord}")]
        [Route("Menabo/getSchedaRef/{idLavorazione}/{byPassLavorazioneRecord}/{mode}")]
        public async Task<IActionResult> getSchedaRef([FromForm] string codiceGruppo, int idLavorazione, [FromForm] long idRec = 0,bool byPassLavorazioneRecord = false, FicoCombinazioneKitReadMode mode = FicoCombinazioneKitReadMode.Classic)
        {
            ArticoloInRevisioneKitResult result = new ArticoloInRevisioneKitResult();

            LogAssistent logAss = new LogAssistent();

            Console.WriteLine($"getSchedaRef -> Codice:{codiceGruppo} - idLavorazione:{idLavorazione} - idRec:{idRec} - byPassLavorazioneRecord:{byPassLavorazioneRecord} - mode:{mode}");

            try
            {
                string descr1Key = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr1;
                string descr2Key = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr2;
                string descr3Key = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr3;
                string descr4Key = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr4;
                string descrInddKey = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescrIndd;
                string propCodScatto = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppo;
                string keyCodiceRef = Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice;
                string keyFotoExtraAuto = Enum.GetName(AddestramentoRuoli.Foto) + "." + GLOBAL_VARIABLES.keyFotoExtraAuto;
                string keyFirmaRevisione = GLOBAL_VARIABLES.keyFirmaRevisione;



                string k_multiplex = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppoMultiplex;
                string k_codgruppo = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppo;
                string k_cod = Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice;
                string keyXMLSelezione = GLOBAL_VARIABLES.keyXMLSelezione;

                //Console.WriteLine("Get scheda step 1");

                string? firmaRevisione = "";
                //Scarico tutti i dati json di tutti gli articoli in tracciato
                PromoLavorazioni lavorazione = this.ctx2.PromoLavorazionis.FirstOrDefault(f => f.Id == idLavorazione);
                //PromoLavorazioni? plItem = this.ctx2.PromoLavorazionis.FirstOrDefault(pl => pl.Id == idLavorazione);
                if (lavorazione == null)
                    throw new Exception("Lavorazione (id:" + idLavorazione + ") non trovata nel database durante il recupero della schedaRef.");
                //FicoCombinazioneKit kit = JsonConvert.DeserializeObject<FicoCombinazioneKit>(plItem.Meta);
                FicoRuntimeKit? kit = JsonConvert.DeserializeObject<FicoRuntimeKit>(lavorazione!.Meta!);
                Formato? objFormato = Utility.SingletonConfiguration.DBFORMATI!.source.Where(w => w.guidID == kit!.guidFormato).FirstOrDefault();
                //Console.WriteLine("Get scheda step 1_1");

                PromoLavorazioniRecord? lavoriazioneRecord = null;
                int idTracciato = 0;
                PromoTracciati? tracciato = null;
                PromoTracciatiRecord? recordTargetById = null;

                if (idRec > 0)
                {
                    recordTargetById = this.ctx2.PromoTracciatiRecords
                        //.AsNoTracking()
                        .FirstOrDefault(r => r.Id == idRec);
                }

                if (byPassLavorazioneRecord)
                {
                    if (ficoController == null)
                    {
                        ficoController = new FicoProcessController(_config, _external_lib, this._fico_conf, _option_import, this.httpClient, _cache, this._dbContextFactory, null, dbContextFactory2: this._dbContextFactory2);
                    }

                    if(recordTargetById != null)
                    {
                        idTracciato = recordTargetById.IdTracciato;
                    }
                    else
                    {
                        var tracciati = ficoController.getTracciatiFromIdkitLavorazione(idLavorazione);
                        idTracciato = getTracciatoByCodice(tracciati, codiceGruppo, objFormato.tipo == TipoLavorazione.PoP);

                        if (idTracciato == 0)
                        {
                            throw new Exception("Record trovato più volte all'interno della stessa promo, probabile errore di lista");
                        }
                    }


                    //if (idTracciato == -1)
                    //{
                    //    throw new Exception("Record non trovato in promoTracciatiRecord");
                    //}
                }

                
                Console.WriteLine($"getSchedaRef #2 -> ID TRACCIATO: {idTracciato}");

                //Console.WriteLine("Get scheda step 2");

                //lavoriazioneRecord = this.ctx2.PromoLavorazioniRecords.Include(i => i.IdPromoLavorazioniNavigation).Where(f => f.CodiceGruppo == codiceGruppo && idLavorazione == f.IdLavorazione).FirstOrDefault();



                var lavorazioniRecCandidate = this.ctx2.PromoLavorazioniRecords
                    .Include(i => i.IdPromoLavorazioniNavigation)
                    .Where(f =>
                        f.CodiceGruppo == codiceGruppo &&
                        f.IdLavorazione == idLavorazione)
                    .ToList();

                if (idRec > 0)
                {
                    // 1. Match esatto: codiceGruppo + idRec.
                    lavoriazioneRecord = lavorazioniRecCandidate
                        .FirstOrDefault(f => f.IdRecordTracciato == idRec);

                    // 2. Se non matcha esatto, provo il match fratello.
                    if (lavoriazioneRecord == null && recordTargetById != null)
                    {
                        var idsCandidati = lavorazioniRecCandidate
                            .Select(c => c.IdRecordTracciato)
                            .Distinct()
                            .ToList();

                        if (idsCandidati.Count > 0)
                        {
                            var recordsCandidati = this.ctx2.PromoTracciatiRecords
                                .AsNoTracking()
                                .Where(r => idsCandidati.Contains(r.Id))
                                .Select(r => new
                                {
                                    r.Id,
                                    r.IdTracciato,
                                    r.CodiceGruppo,
                                    r.Label,
                                    r.Versione
                                })
                                .ToList();

                            var recordFratello = recordsCandidati.FirstOrDefault(r =>
                                r.IdTracciato == recordTargetById.IdTracciato &&
                                r.CodiceGruppo == recordTargetById.CodiceGruppo &&
                                r.Label == recordTargetById.Label &&
                                r.Versione == recordTargetById.Versione
                            );

                            if (recordFratello != null)
                            {
                                lavoriazioneRecord = lavorazioniRecCandidate.FirstOrDefault(c =>
                                    c.IdRecordTracciato == recordFratello.Id
                                );
                            }
                        }
                    }
                }
                else
                {
                    // Legacy: vecchi client senza idRec.
                    lavoriazioneRecord = lavorazioniRecCandidate.FirstOrDefault();
                }

                //if (idTracciato == 0 || idTracciato == -1)
                //{
                //    if (lavoriazioneRecord == null)
                //    {
                //        result.errorCode = (int)ErrorCodes.CodArticoloNonTrovato;
                //        throw new Exception("Gruppo " + codiceGruppo + " in lavorazione " + idLavorazione + " non trovato in PromoLavorazioniRecords");
                //    }
                //    idTracciato = this.ctx2.PromoTracciatiRecords
                //        .Where(f => f.Id == lavoriazioneRecord.IdRecordTracciato)
                //        .FirstOrDefault()?.IdTracciato ?? 0;
                //    if (idTracciato == 0)
                //    {
                //        throw new Exception("Record con id " + lavoriazioneRecord.IdRecordTracciato + " non trovato in PromoTracciatiRecords");
                //    }
                //}

                if (idTracciato == 0 || idTracciato == -1)
                {
                    if (lavoriazioneRecord == null)
                    {
                        Console.WriteLine($"getSchedaRef #3 -> Codice non trovato!");

                        result.errorCode = (int)ErrorCodes.CodArticoloNonTrovato;
                        throw new Exception("Gruppo " + codiceGruppo + " in lavorazione " + idLavorazione + " non trovato in PromoLavorazioniRecords");
                    }

                    if (recordTargetById != null &&
    (
        string.Equals(recordTargetById.CodiceGruppo, codiceGruppo, StringComparison.OrdinalIgnoreCase) ||
        string.Equals(recordTargetById.Codice, codiceGruppo, StringComparison.OrdinalIgnoreCase)
    ))
                    {
                        idTracciato = recordTargetById.IdTracciato;
                    }
                    else
                    {
                        idTracciato = this.ctx2.PromoTracciatiRecords
                            .Where(f => f.Id == lavoriazioneRecord.IdRecordTracciato)
                            .Select(f => f.IdTracciato)
                            .FirstOrDefault();
                    }

                    if (idTracciato == 0)
                    {
                        throw new Exception("Record con id " + lavoriazioneRecord.IdRecordTracciato + " non trovato in PromoTracciatiRecords");
                    }
                }

                //logAss.WriteLine("GET SCHEDA REF >> step3 -> cod gruppo = " + codiceGruppo + " idTracciato="+idTracciato);

                if (tracciato == null)
                {
                    tracciato = this.ctx2.PromoTracciatis.Include(f => f.IdPromoNavigation)/*.Include(inc => inc.IdImportazioneNavigation)*/.Where(f => f.Id == idTracciato).FirstOrDefault();
                }
                var promo = tracciato!.IdPromoNavigation;

                //            var gruppoRecords = this.ctx2.PromoTracciatiRecords
                //.Include(r => r.IdTracciatoNavigation)
                //.Where(t => t.CodiceGruppo == codiceGruppo && t.IdTracciato == idTracciato)
                //.ToList();

                IQueryable<PromoTracciatiRecord> gruppoRecordsQuery = this.ctx2.PromoTracciatiRecords
    .Include(r => r.IdTracciatoNavigation)
    .Where(t =>
        t.CodiceGruppo == codiceGruppo &&
        t.IdTracciato == idTracciato
    );

                if (recordTargetById != null &&
                    string.Equals(recordTargetById.CodiceGruppo, codiceGruppo, StringComparison.OrdinalIgnoreCase))
                {
                    gruppoRecordsQuery = gruppoRecordsQuery.Where(t =>
                        t.Label == recordTargetById.Label &&
                        t.Versione == recordTargetById.Versione
                    );
                }

                var gruppoRecords = gruppoRecordsQuery.ToList();

    //            var gruppo = gruppoRecords
    //.Select(t => new ArticoloInRevisione
    //{
    //    idRec = t.Id,
    //    label = t.Label,
    //    Versione = t.Versione,
    //    recordInTracciato = Utility.Main.getJsonObject(t.Dato!)!,
    //    promo = promo,
    //    promoTracciati = tracciato
    //})
    //.ToList();


                var gruppo = gruppoRecords
                    .Select(t =>
                    {
                        var recordInTracciato = Utility.Main.getJsonObject(t.Dato!);

                        recordInTracciato[GLOBAL_VARIABLES.keyRefIdRec] = t.Id;

                        return new ArticoloInRevisione
                        {
                            idRec = t.Id,
                            label = t.Label,
                            Versione = t.Versione,
                            recordInTracciato = recordInTracciato,
                            promo = promo,
                            promoTracciati = tracciato,
                        };
                    })
                    .ToList();

                //if (gruppo.Count == 0)
                //{
                //    gruppoRecords = this.ctx2.PromoTracciatiRecords
                //        .Include(r => r.IdTracciatoNavigation)
                //        .Where(t => t.Codice == codiceGruppo && t.IdTracciato == idTracciato)
                //        .ToList();

                //    gruppo = gruppoRecords
                //        .Select(t => new ArticoloInRevisione
                //        {
                //            idRec = t.Id,
                //            label = t.Label,
                //            Versione = t.Versione,
                //            recordInTracciato = Utility.Main.getJsonObject(t.Dato!)!,
                //            promo = promo,
                //            promoTracciati = tracciato
                //        })
                //        .ToList();
                //}

                if (gruppo.Count == 0)
{
    IQueryable<PromoTracciatiRecord> fallbackQuery = this.ctx2.PromoTracciatiRecords
        .Include(r => r.IdTracciatoNavigation)
        .Where(t =>
            t.Codice == codiceGruppo &&
            t.IdTracciato == idTracciato
        );

    if (idRec > 0)
    {
        fallbackQuery = fallbackQuery.Where(t => t.Id == idRec);
    }

    gruppoRecords = fallbackQuery.ToList();

    gruppo = gruppoRecords
        .Select(t => new ArticoloInRevisione
        {
            idRec = t.Id,
            label = t.Label,
            Versione = t.Versione,
            recordInTracciato = Utility.Main.getJsonObject(t.Dato!)!,
            promo = promo,
            promoTracciati = tracciato
        })
        .ToList();
}

                if (gruppo.Count == 0)
                {
                    throw new Exception("Nessun record trovato per il gruppo " + codiceGruppo + " nel tracciato " + idTracciato);
                }


                //logAss.WriteLine("GET SCHEDA REF >> step4_ 1 " + gruppo.Count);

                var versions = this.ctx2.PromoTracciatiRecords
.Where(f => f.IdTracciato == idTracciato && f.Label == gruppo[0].label)
.Select(f => f.Versione).ToList();

                //logAss.WriteLine("GET SCHEDA REF >> step4_2");

                // Prevenire l'eccezione se la lista è vuota
                var lastVersion = versions.Max();

                if (gruppo.Any(f => f.Versione != lastVersion))
                {
                    ListaGruppiRaggruppamento gruppoDaRimuovere = new ListaGruppiRaggruppamento();
                    gruppoDaRimuovere.ListaCodici = [codiceGruppo];
                    await rimuoviRefImpaginata(idLavorazione, false, gruppoDaRimuovere);
                    throw new Exception("Uno o più elementi del gruppo risultavano obsoleti (versione non congrua a quella attuale)");
                }

                if (ficoController == null)
                {
                    ficoController = new FicoProcessController(_config, _external_lib, this._fico_conf, _option_import, this.httpClient, _cache, this._dbContextFactory, null, dbContextFactory2: this._dbContextFactory2);
                }



                var DescrGruppo = this.ctx.ArticoliDescrizionis.Where(d => d.CodiceGruppo == codiceGruppo).ToList();
                List<Articoli> art_list = new List<Articoli>();
                List<ArticoloInRevisione> recDeclinati = new List<ArticoloInRevisione>();




                //string firma_tracciato_gruppo = "";
                //if (gruppo.Count>1)
                //{                   
                //    var _membriGruppo = gruppo.Select(s => s.recordInTracciato).ToList();
                //    firma_tracciato_gruppo = Utility.Main.getFirmaTracciatoGruppo(_membriGruppo);
                //}

                string firma_tracciato_gruppo = "";

                if (gruppo.Count > 1)
                {
                    firma_tracciato_gruppo = Utility.Main.getFirmaTracciatoGruppoDaRecords(
                        gruppoRecords,
                        codiceGruppo,
                        false
                    );
                }

                foreach (var rec in gruppo)
                {
                    rec.hasFoto = 0;
                    rec.isObsoleto = rec.Versione == lastVersion ? false : true;



                    string? _cod = rec.recordInTracciato![k_cod].ToString();

                    //logAss.WriteLine($"GET SCHEDA REF >> step6 {_cod}");

                    //Preparazione del singolo
                    Articoli? artItem = this.ctx.Articolis.Include(i => i.ArticoliFotos).Include(f => f.ArticoliDescrizionis).Where(a => a.Codice == rec.recordInTracciato[k_cod].ToString()).FirstOrDefault();
                    art_list.Add(artItem!);


                    Formato? formatoLav = SingletonConfiguration.DBFORMATI!.source.FirstOrDefault(f => f.guidID == lavorazione.GuidFormato);
                    rec.formato = formatoLav!;


                    ArticoloInRevisione revResult = ficoController.impacchettaInfoRecord(rec, artItem!, gruppo, tracciato, DescrGruppo, formatoLav!.tipo);



                    rec.recordInTracciato = revResult.recordInTracciato;
                    rec.recordRevisionato = revResult.recordRevisionato;
                    rec.hasFoto = revResult.hasFoto;

                    if (revResult.recordRevisionato != null)
                    {
                        firmaRevisione = revResult.recordRevisionato.FirmaTracciato != null ? revResult.recordRevisionato.FirmaTracciato : "";
                        rec.recordInTracciato![keyFirmaRevisione] = firmaRevisione;
                    }
                    else
                    {
                        rec.recordInTracciato![keyFirmaRevisione] = "";
                        firmaRevisione = null;

                    }

                    if (firma_tracciato_gruppo!="")
                        rec.recordInTracciato[Enum.GetName(AddestramentoRuoli.Tracciato) + "." + GLOBAL_VARIABLES.keyTracciatoFirma] = firma_tracciato_gruppo;

                    //if (kit!.declinazioni != null && kit.declinazioni.Count > 0)
                    //{
                    //    foreach (FicoCombinazioniKitDeclinazione dec in kit.declinazioni)
                    //    {
                    //        if (ficoController.checkFiltro(rec.recordInTracciato, dec.filtri))
                    //        {
                    //            //Il record rispetta i filtri della declinazione e quindi lo duplica
                    //            //Inoltre gli associa le proprietà di declinazione della combinazione
                    //            ArticoloInRevisione decClone = rec.Clona();
                    //            if (!decClone.recordInTracciato!.ContainsKey(GLOBAL_VARIABLES_FICO.keyFicoDeclinazioni))
                    //            {
                    //                decClone.recordInTracciato[GLOBAL_VARIABLES_FICO.keyFicoDeclinazioni] = new List<FicoCombinazioniKitDeclinazioneProprieta>();
                    //            }

                    //            List<FicoCombinazioniKitDeclinazioneProprieta> _decs = (decClone.recordInTracciato[GLOBAL_VARIABLES_FICO.keyFicoDeclinazioni] as List<FicoCombinazioniKitDeclinazioneProprieta>)!;
                    //            _decs.AddRange(dec.proprieta);
                    //            recDeclinati.Add(decClone);
                    //        }
                    //    }
                    //}

                }


                //logAss.WriteLine("GET SCHEDA REF >> step7");

                var resultAutoPS = await Utility.Selezionatore.selezioneAutomaticaRefInMenabo(gruppo, this.ctx2, this._fico_conf.Value.nomeCliente, this.path_external_lib, true);

                //if (recDeclinati.Count > 0)
                //    gruppo.AddRange(recDeclinati);

                if(gruppo.Count > 1)
                {
                    gruppo = gruppo.OrderBy(g => Convert.ToByte(g.recordInTracciato![keyXMLSelezione])).ToList();
                }

                //logAss.WriteLine("GET SCHEDA REF >> step8");

                //Attuo l'etichettatura
                gruppo = Etichettatura(gruppo);

                gruppo = ficoController.etichettaRecords(gruppo, this);

                //logAss.WriteLine("GET SCHEDA REF >> step9");

                var prepLista = new PreparazioneListaResult()
                {
                    records = gruppo.Where(f =>!f.isObsoleto).Select(s => new ArticoloInKit()
                    {
                        IdRec = s.idRec!.Value,
                        recordInTracciato = s.recordInTracciato,
                        allEtichette = s.allEtichette,
                        etichetteVisual = s.etichetteVisual,                       
                    }).ToList(),
                    archivio_descr_gruppo = DescrGruppo,
                    archivio_refs = art_list,
                };



                List<FicoContextField> promoContext = promo.Context == null ? new List<FicoContextField>() : JsonConvert.DeserializeObject<List<FicoContextField>>(promo.Context)!;
                List<FicoContextField> tracciatoContext = tracciato.Context == null ? new List<FicoContextField>() : JsonConvert.DeserializeObject<List<FicoContextField>>(tracciato.Context)!;
                //Formato? objFormato = Utility.SingletonConfiguration.DBFORMATI!.source.Where(w => w.guidID == kit!.guidFormato).FirstOrDefault();


                //Aggiungo al contesto la sigla tracciato area/canale/pv
                if (tracciatoContext.Count(tc => tc.nome_field == GLOBAL_VARIABLES_FICO.keyCanaleContext) == 0)
                    tracciatoContext.Add(new FicoContextField() { nome_field = GLOBAL_VARIABLES_FICO.keyCanaleContext, user_value = tracciato.guidCanale });
                if (tracciatoContext.Count(tc => tc.nome_field == GLOBAL_VARIABLES_FICO.keyAreaContext) == 0)
                    tracciatoContext.Add(new FicoContextField() { nome_field = GLOBAL_VARIABLES_FICO.keyAreaContext, user_value = tracciato.guidArea });
                if (tracciatoContext.Count(tc => tc.nome_field == GLOBAL_VARIABLES_FICO.keyPVContext) == 0 && tracciato.guidPV != null && tracciato.guidPV != "")
                    tracciatoContext.Add(new FicoContextField() { nome_field = GLOBAL_VARIABLES_FICO.keyPVContext, user_value = tracciato.guidPV });

                //logAss.WriteLine("GET SCHEDA REF >> step10");


                PreparazioneListaResult resultGlobale = new PreparazioneListaResult();


                if (mode != FicoCombinazioneKitReadMode.OnlyMeta)
                {
                    string agenziaFunc = "";

                    if (objFormato!.tipo == TipoLavorazione.PoP)
                    {
                        ////POP
                        //try
                        //{
                        //    TracciatoResultKit resultExternal = icItem.execLibFunction("AgenziaLib."+this.ficoConf.Value.nomeCliente+".esportaPoP", objParams) as TracciatoResultKit;

                        //    if (resultExternal.errors != "")
                        //    {
                        //        error_report += $"Promo Esport error: " + resultExternal.errors + "\n";
                        //        continue;
                        //    }

                        //    foreach (var itemLista in resultExternal.liste)
                        //    {
                        //        //Sovrascrivo il recordInTracciato con quello elaborato da Agenzia
                        //        //foreach(ArticoloInKit aKit in itemLista.Records)
                        //        //{
                        //        //    ArticoloInRevisione aRev = resultPreparazione.records.FirstOrDefault(f2 => f2.idRec == aKit.IdRec);
                        //        //    aRev.recordInTracciato = aKit.recordInTracciato;
                        //        //    aRev.names = aKit.names;
                        //        //}

                        //        foreach(var lista in resultExternal.liste)
                        //            resultGlobale.records.AddRange(lista.Records);// resultPreparazione.records);
                        //    }

                        //}
                        //catch (Exception ex)
                        //{
                        //    error_report += $"Error on export PoP (guid ID {kit.guidFormato} Kit ID {kit.guidId}) : {ex.ToString()}\n";
                        //}

                        agenziaFunc = "esportaPoP";

                    }
                    else if (objFormato.tipo == TipoLavorazione.Volantino)
                    {
                        ////VOL
                        //try
                        //{
                        //    TracciatoResultKit resultExternal = icItem.execLibFunction("AgenziaLib."+this.ficoConf.Value.nomeCliente+".esportaVolantino", objParams) as TracciatoResultKit;
                        //    if (resultExternal.errors != "")
                        //    {
                        //        error_report += $"Promo Esport error: " + resultExternal.errors + "\n";
                        //        continue;
                        //    }

                        //    foreach (var itemLista in resultExternal.liste)
                        //    {
                        //        //Sovrascrivo il recordInTracciato con quello elaborato da Agenzia
                        //        //foreach (ArticoloInKit aKit in itemLista.Records)
                        //        //{
                        //        //    ArticoloInRevisione aRev = resultPreparazione.records.FirstOrDefault(f2 => f2.idRec == aKit.IdRec);
                        //        //    aRev.recordInTracciato = aKit.recordInTracciato;
                        //        //    aRev.names = aKit.names;
                        //        //}


                        //        resultGlobale.records.AddRange(resultPreparazione.records);
                        //    }

                        //}
                        //catch (Exception ex)
                        //{
                        //    error_report += $"Error on export VOL (guid ID {kit.guidFormato} Kit ID {kit.guidId}) : {ex.ToString()}\n";
                        //}
                        agenziaFunc = "esportaVolantino";
                    }


                    var listeModificate = ficoController.updateDatiFromMetaPromoLavorazioni(prepLista.records, idLavorazione, kit!);
                    prepLista.records = listeModificate;
                    //logAss.WriteLine("GET SCHEDA REF >> step9");

                    TracciatoResultKit resultAgenzia = ficoController.esportaConLogicheDiAgenzia(kit!, promoContext, tracciatoContext, prepLista.records, mode, agenziaFunc);
                    if (resultAgenzia.errorCode == ErrorCodesFico.ListaAzzerataInEsportazione)
                    {

                    }
                    else if (resultAgenzia.errors != "")
                    {
                        result.error += resultAgenzia.errors;
                        throw new Exception(resultAgenzia.errors);
                    }
                    else
                    {
                        foreach (var itemLista in resultAgenzia.liste)
                        {

                            resultGlobale.records.AddRange(itemLista.Records);
                        }

                        foreach (var itemLista in resultGlobale.records)
                        {
                            if (itemLista.recordInTracciato.ContainsKey(keyFotoExtraAuto) && (itemLista.recordInTracciato[keyFotoExtraAuto] as List<LogoBollo>)!.Count > 0)
                            {
                                var fotoEscluse = this.ctx.Articolis.Include(f => f.FotoEscluses).Where(f => f.Codice == itemLista.recordInTracciato[keyCodiceRef].ToString()).FirstOrDefault()!.FotoEscluses;
                                if (fotoEscluse!.Count > 0)
                                {
                                    foreach (var logoBollo in (itemLista.recordInTracciato[keyFotoExtraAuto] as List<LogoBollo>)!)
                                    {
                                        if (fotoEscluse.Any(f => f.NomeReale == logoBollo.nome))
                                        {
                                            Console.WriteLine($"MB Scheda 12977 - Escludo foto {logoBollo.nome} per codice ref {itemLista.recordInTracciato[keyCodiceRef].ToString()}");
                                            logoBollo.escluso = true;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                else
                {
                    resultGlobale.records.AddRange(prepLista.records);
                }

                //logAss.WriteLine("GET SCHEDA REF >> step11");



                result = new ArticoloInRevisioneKitResult()
                {
                    records = resultGlobale.records.Select(s => new ArticoloInKit()
                    {
                        IdRec = s.IdRec,
                        recordInTracciato = s.recordInTracciato,
                        allEtichette = s.allEtichette,
                        etichetteVisual = s.etichetteVisual,
                        firmaRevisione = firmaRevisione,
                        sottogruppo = s.sottogruppo,
                    }).ToList(),
                    IdRecInLavorazione = lavoriazioneRecord != null ? lavoriazioneRecord.Id : 0,
                    error = "",
                    esito = true,
                };

                //logAss.WriteLine("GET SCHEDA REF >> step12");

                //string key_codice_gruppo = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppo;

                //var mieiComponentiGruppoPrincipale = resultGlobale.records.Select(sel => sel.recordInTracciato).ToList();

                //List<FotoElementoGruppo> fotoSecondarieGruppo = getFotoSecondarieGruppo(mieiComponentiGruppoPrincipale, new List<PromoLavorazioniRecord>());

                //foreach (var item in result.records)
                //{
                //    item.recordInTracciato[GLOBAL_VARIABLES.keyMembriGruppoFoto] = fotoSecondarieGruppo;
                //}

            }
            catch (Exception ex)
            {
                Console.WriteLine("Errore in getSchedaRef: " + ex.ToString());

                result = new ArticoloInRevisioneKitResult()
                {
                    records = new List<ArticoloInKit>(),
                    error = ex.ToString(),
                    esito = false,
                    errorCode = result.errorCode,
                };
            }

            return Ok(result);
        }

        [HttpPut]
        [Route("Menabo/impaginaSingolo")]
        public async Task<IActionResult> impaginaSingolo([FromForm] RichiestaImpaginazioneSingolo richiesta, FicoCombinazioneKitReadMode mode = FicoCombinazioneKitReadMode.Classic, bool skipSave = false)
        {
            ArticoloInRevisioneKitResult result = new ArticoloInRevisioneKitResult();

            try
            {
                var db = this.ctx2;

                var session = SessionIstantaObject.GetSession(HttpContext);
                Int16 id_utente = Int16.Parse(session);

                if(richiesta.pagina <= 0)
                {
                    throw new Exception("E' stata richiesta per l'impaginazione la pagina non valida di numero: " + richiesta.pagina);
                }

                var giaImpaginato = this.ctx2.PromoLavorazioniRecords.Where(f => f.IdLavorazione == richiesta.idLavorazione && f.CodiceGruppo == richiesta.codiceGruppo && (richiesta.idRec != 0 ? richiesta.idRec == f.IdRecordTracciato : true)).FirstOrDefault();
                if(giaImpaginato != null && !richiesta.byPassBloccoGiaImpaginato)
                {
                    throw new Exception("L'elemento richiesto è già impaginato");
                }
                else if(giaImpaginato != null && richiesta.byPassBloccoGiaImpaginato)
                {
                    giaImpaginato.Pagina = richiesta.pagina;
                    IActionResult res = await getSchedaRef(richiesta.codiceGruppo!, richiesta.idLavorazione, richiesta.idRec);
                    ArticoloInRevisioneKitResult gruppoResult = new ArticoloInRevisioneKitResult();
                    if (res is OkObjectResult && (res as OkObjectResult)!.Value is ArticoloInRevisioneKitResult)
                    {
                        gruppoResult = ((res as OkObjectResult)!.Value as ArticoloInRevisioneKitResult)!;

                        if (gruppoResult == null || !gruppoResult.esito)
                        {
                            throw new Exception("Gruppo " + richiesta.codiceGruppo + " non trovato da LeggiTracciatiRecord");
                        }
                    }
                    else
                    {
                        if (res is OkObjectResult && (res as OkObjectResult)!.Value is string)
                        {
                            throw new Exception((res as OkObjectResult)!.Value as string);
                        }
                        else
                        {
                            throw new Exception("Errore nel tentativo di leggere il risultato di LeggiTracciatiRecord");
                        }
                    }
                    result.records = gruppoResult.records;
                }
                else
                {

                    if (ficoController == null)
                    {
                        ficoController = new FicoProcessController(_config, _external_lib, this._fico_conf, _option_import, this.httpClient, _cache, this._dbContextFactory, null, dbContextFactory2: this._dbContextFactory2);
                    }

                    IActionResult res = await getSchedaRef(richiesta.codiceGruppo!, richiesta.idLavorazione, richiesta.idRec, true);
                    ArticoloInRevisioneKitResult gruppoResult = new ArticoloInRevisioneKitResult();
                    if (res is OkObjectResult && (res as OkObjectResult)!.Value is ArticoloInRevisioneKitResult)
                    {
                        gruppoResult = ((res as OkObjectResult)!.Value as ArticoloInRevisioneKitResult)!;

                        if (gruppoResult == null || !gruppoResult.esito)
                        {
                            if (gruppoResult.error != "")
                            {
                                throw new Exception("Gruppo " + richiesta.codiceGruppo + " è stato registrato l'errore: "+gruppoResult.error);
                            }
                            else
                            {
                                throw new Exception("Gruppo " + richiesta.codiceGruppo + " non trovato da LeggiTracciatiRecord");
                            }
                        }
                    }
                    else
                    {
                        if (res is OkObjectResult && (res as OkObjectResult)!.Value is string)
                        {
                            throw new Exception((res as OkObjectResult)!.Value as string);
                        }
                        else
                        {
                            throw new Exception("Errore nel tentativo di leggere il risultato di LeggiTracciatiRecord");
                        }
                    }

                    var primario = gruppoResult.records.First(f => Convert.ToByte(f.recordInTracciato[GLOBAL_VARIABLES.keyXMLSelezione]) == (Byte)1);

                    if(primario == null)
                    {
                        throw new Exception("Nessun elemento primario trovato");
                    }


                    PromoLavorazioniRecord nuovoRecord = new PromoLavorazioniRecord();
                    nuovoRecord.Pagina = richiesta.pagina;
                    nuovoRecord.IdLavorazione = richiesta.idLavorazione;
                    nuovoRecord.Indice = (byte)0;
                    nuovoRecord.CodiceGruppo = richiesta.codiceGruppo;
                    nuovoRecord.Codice = richiesta.codiceGruppo!.Split(",")[0];
                    nuovoRecord.IdRecordTracciato = primario.IdRec;
                    nuovoRecord.IdAutore = id_utente;
                    nuovoRecord.RegisterDate = DateTime.Now;

                    db.PromoLavorazioniRecords.Add(nuovoRecord);

                    result.records = gruppoResult.records;

                }

                if (!skipSave)
                {
                    db.SaveChanges();
                }

                result.error = "";
                result.esito = true;
            }
            catch (Exception ex)
            {
                result = new ArticoloInRevisioneKitResult()
                {
                    records = new List<ArticoloInKit>(),
                    error = ex.ToString(),
                    esito = false,
                };
            }

            return Ok(result);
        }


        [HttpPut]
        [Route("Menabo/PreAnalisiMismatch/{id_lavorazione}")]
        public async Task<IActionResult> PreAnalisiMismatch([FromForm]string lista, int id_lavorazione)
        {
            resultPreAnalisi res = new resultPreAnalisi();
            try
            {

                var listaRef = JsonConvert.DeserializeObject<listaRefPerPagina>(lista)!;

                foreach (var pag in listaRef.listRefPerPagina)
                {

                    var codiciPagina =
        pag.codiciConId != null && pag.codiciConId.Count > 0
            ? pag.codiciConId
                .Where(c => !string.IsNullOrWhiteSpace(c.codice))
                .ToList()
            : (pag.codici ?? new List<string>())
                .Where(c => !string.IsNullOrWhiteSpace(c))
                .Select(c => new filtroCodici
                {
                    codice = c,
                    idRec = 0
                })
                .ToList();
                    resultPagina esitoPagina = new resultPagina();
                    res.esito = true;
                    esitoPagina.nomePagina = pag.nomePagina;
                    try
                    {
                        var elementiImpaginatiAPagina = this.ctx2.PromoLavorazioniRecords
                            .Include(p => p.IdPromoTracciatiRecordNavigation)
                            .Where(f =>
                                f.IdLavorazione == id_lavorazione &&
                                f.Pagina.ToString() == pag.nomePagina)
                            .ToList();

                        void AddNonPiuPresente(PromoLavorazioniRecord elemento)
                        {
                            var codice = elemento.CodiceGruppo ?? "";

                            if (!esitoPagina.codiciImpaginatiMaNonPiuPresentiInTracciato.Contains(codice))
                            {
                                esitoPagina.codiciImpaginatiMaNonPiuPresentiInTracciato.Add(codice);
                            }

                            if (!esitoPagina.codiciImpaginatiMaNonPiuPresentiInTracciatoConId.Any(c =>
                                    c.codice == codice &&
                                    c.idRec == elemento.IdRecordTracciato))
                            {
                                esitoPagina.codiciImpaginatiMaNonPiuPresentiInTracciatoConId.Add(new filtroCodici
                                {
                                    codice = codice,
                                    idRec = Convert.ToInt32(elemento.IdRecordTracciato)
                                });
                            }
                        }

                        bool IsNonPiuPresente(filtroCodici item)
                        {
                            if (item.idRec > 0)
                            {
                                return esitoPagina.codiciImpaginatiMaNonPiuPresentiInTracciatoConId.Any(c =>
                                    c.codice == item.codice &&
                                    c.idRec == item.idRec);
                            }

                            return esitoPagina.codiciImpaginatiMaNonPiuPresentiInTracciato.Contains(item.codice);
                        }

                        void AddCorrispondente(filtroCodici item, PromoLavorazioniRecord elemento)
                        {
                            if (!esitoPagina.codiciCorrispondenti.Contains(item.codice))
                            {
                                esitoPagina.codiciCorrispondenti.Add(item.codice);
                            }

                            var idRec = item.idRec > 0
                                ? item.idRec
                                : Convert.ToInt32(elemento.IdRecordTracciato);

                            if (!esitoPagina.codiciCorrispondentiConId.Any(c =>
                                    c.codice == item.codice &&
                                    c.idRec == idRec))
                            {
                                esitoPagina.codiciCorrispondentiConId.Add(new filtroCodici
                                {
                                    codice = item.codice,
                                    idRec = idRec
                                });
                            }
                        }

                        void AddPaginaDifferente(filtroCodici item, PromoLavorazioniRecord elemento)
                        {
                            if (!esitoPagina.codiciImpaginatiAPaginaDifferente.Contains(item.codice))
                            {
                                esitoPagina.codiciImpaginatiAPaginaDifferente.Add(item.codice);
                            }

                            var idRec = item.idRec > 0
                                ? item.idRec
                                : Convert.ToInt32(elemento.IdRecordTracciato);

                            if (!esitoPagina.codiciImpaginatiAPaginaDifferenteConId.Any(c =>
                                    c.codice == item.codice &&
                                    c.idRec == idRec))
                            {
                                esitoPagina.codiciImpaginatiAPaginaDifferenteConId.Add(new filtroCodici
                                {
                                    codice = item.codice,
                                    idRec = idRec
                                });
                            }
                        }

                        void AddNonImpaginato(filtroCodici item)
                        {
                            if (!esitoPagina.codiciNonImpaginatiSulServer.Contains(item.codice))
                            {
                                esitoPagina.codiciNonImpaginatiSulServer.Add(item.codice);
                            }

                            if (!esitoPagina.codiciNonImpaginatiSulServerConId.Any(c =>
                                    c.codice == item.codice &&
                                    c.idRec == item.idRec))
                            {
                                esitoPagina.codiciNonImpaginatiSulServerConId.Add(new filtroCodici
                                {
                                    codice = item.codice,
                                    idRec = item.idRec
                                });
                            }
                        }

                        void AddSoloServer(PromoLavorazioniRecord elemento)
                        {
                            var codice = elemento.CodiceGruppo ?? "";
                            var idRec = Convert.ToInt32(elemento.IdRecordTracciato);

                            if (!esitoPagina.codiciPresentiSoloSulServer.Contains(codice))
                            {
                                esitoPagina.codiciPresentiSoloSulServer.Add(codice);
                            }

                            if (!esitoPagina.codiciPresentiSoloSulServerConId.Any(c =>
                                    c.codice == codice &&
                                    c.idRec == idRec))
                            {
                                esitoPagina.codiciPresentiSoloSulServerConId.Add(new filtroCodici
                                {
                                    codice = codice,
                                    idRec = idRec
                                });
                            }
                        }

                        foreach (var elementoSuServer in elementiImpaginatiAPagina)
                        {
                            var promoTracciatoRecord = elementoSuServer.IdPromoTracciatiRecordNavigation;

                            if (promoTracciatoRecord == null)
                            {
                                AddNonPiuPresente(elementoSuServer);
                                continue;
                            }

                            bool codiceCorrispondente = string.Equals(
                                elementoSuServer.CodiceGruppo,
                                promoTracciatoRecord.CodiceGruppo,
                                StringComparison.OrdinalIgnoreCase
                            );

                            if (!codiceCorrispondente)
                            {
                                AddNonPiuPresente(elementoSuServer);
                                continue;
                            }

                            string label = promoTracciatoRecord.Label;

                            var versions = this.ctx2.PromoTracciatiRecords
                                .Where(f =>
                                    f.IdTracciato == promoTracciatoRecord.IdTracciato &&
                                    f.Label == label)
                                .Select(f => f.Versione)
                                .ToList();

                            if (versions.Count == 0)
                            {
                                AddNonPiuPresente(elementoSuServer);
                                continue;
                            }

                            var lastVersion = versions.Max();

                            if (promoTracciatoRecord.Versione != lastVersion)
                            {
                                AddNonPiuPresente(elementoSuServer);
                            }
                        }

                        var idsCorrispondenti = new HashSet<int>();

                        foreach (var item in codiciPagina)
                        {
                            if (IsNonPiuPresente(item))
                            {
                                continue;
                            }

                            PromoTracciatiRecord? recordTarget;

                            var elementoImpaginato = GetLavorazioneRecordConFratelli(
                                item.codice,
                                item.idRec,
                                id_lavorazione,
                                out recordTarget
                            );

                            if (elementoImpaginato == null)
                            {
                                AddNonImpaginato(item);
                                continue;
                            }

                            bool presenteSullaPagina = elementiImpaginatiAPagina
                                .Any(f => f.Id == elementoImpaginato.Id);

                            if (presenteSullaPagina)
                            {
                                AddCorrispondente(item, elementoImpaginato);
                                idsCorrispondenti.Add((int)elementoImpaginato.Id);
                            }
                            else
                            {
                                AddPaginaDifferente(item, elementoImpaginato);
                            }
                        }

                        foreach (var elementoSuServer in elementiImpaginatiAPagina)
                        {
                            var codice = elementoSuServer.CodiceGruppo ?? "";
                            var idRec = Convert.ToInt32(elementoSuServer.IdRecordTracciato);

                            bool nonPiuPresente = esitoPagina.codiciImpaginatiMaNonPiuPresentiInTracciatoConId.Any(c =>
                                c.codice == codice &&
                                c.idRec == idRec);

                            if (nonPiuPresente)
                            {
                                continue;
                            }

                            if (!idsCorrispondenti.Contains((int)elementoSuServer.Id))
                            {
                                AddSoloServer(elementoSuServer);
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        res.errors.Add(ex.Message);
                        res.esito = false;
                    }

                    res.resultPaginas.Add(esitoPagina);
                }
            }
            catch (Exception ex)
            {
                res.esito = false;
                res.errors.Add(ex.ToString());
            }

            return Ok(res);
        }

        [HttpPut]
        [Route("Menabo/syncImpaginatoConServer/{id_lavorazione}/{impaginaETogliDaImpaginato}")]
        public async Task<IActionResult> syncImpaginatoConServer([FromForm] string preAnalisi, [FromForm] string mappa, int id_lavorazione, bool impaginaETogliDaImpaginato)
        {
            ListArticoloInRevisioneKitResult res = new ListArticoloInRevisioneKitResult();
            listaRefPerPagina? listaRefMappa = null;
            if (mappa != null)
            {
                listaRefMappa = JsonConvert.DeserializeObject<listaRefPerPagina>(mappa);
            }

            var db = this.ctx2;

            List<resultPagina> preAnalisiEsiti = JsonConvert.DeserializeObject<List<resultPagina>>(preAnalisi)!;

            try
            {
                List<filtroCodici> NormalizzaListaConFallback(
    List<filtroCodici>? listaConId,
    List<string>? listaLegacy)
                {
                    if (listaConId != null && listaConId.Count > 0)
                    {
                        return listaConId
                            .Where(c => !string.IsNullOrWhiteSpace(c.codice))
                            .ToList();
                    }

                    return (listaLegacy ?? new List<string>())
                        .Where(c => !string.IsNullOrWhiteSpace(c))
                        .Select(c => new filtroCodici
                        {
                            codice = c,
                            idRec = 0
                        })
                        .ToList();
                }

                foreach (var pag in preAnalisiEsiti)
                {
                    var codiciPresentiSoloSulServer = NormalizzaListaConFallback(
    pag.codiciPresentiSoloSulServerConId,
    pag.codiciPresentiSoloSulServer
);

                    var codiciNonImpaginatiSulServer = NormalizzaListaConFallback(
                        pag.codiciNonImpaginatiSulServerConId,
                        pag.codiciNonImpaginatiSulServer
                    );

                    var codiciImpaginatiAPaginaDifferente = NormalizzaListaConFallback(
                        pag.codiciImpaginatiAPaginaDifferenteConId,
                        pag.codiciImpaginatiAPaginaDifferente
                    );

                    recordsPerPagina recs = new recordsPerPagina();
                    recs.nomePagina = pag.nomePagina;                   
                    List<PromoLavorazioniRecord> recordDaEliminare = new List<PromoLavorazioniRecord>();
                    //e' una list di list perchè ogni list interna è la lista di elementi del gruppo, quella esterna è la lista di gruppi
                    List<List<ArticoloInKit>> recordDaImpaginare = new List<List<ArticoloInKit>>();
                    if (impaginaETogliDaImpaginato)
                    {
                        //var recordsNonPresenti = db.PromoLavorazioniRecords
                        //    .Where(f => pag.codiciPresentiSoloSulServer.Contains(f.CodiceGruppo!)
                        //                && f.IdLavorazione == id_lavorazione).ToList();

                        List<PromoLavorazioniRecord> recordsNonPresenti = new List<PromoLavorazioniRecord>();

                        foreach (var item in codiciPresentiSoloSulServer)
                        {
                            PromoTracciatiRecord? recordTarget;

                            var record = GetLavorazioneRecordConFratelli(
                                item.codice,
                                item.idRec,
                                id_lavorazione,
                                out recordTarget
                            );

                            if (record != null)
                            {
                                recordsNonPresenti.Add(record);
                            }
                        }


                        //if (recordsNonPresenti.Count > 0 && listaRefMappa == null)
                        //{
                        //    throw new Exception("La mappa per il sync non è stata ricevuta");
                        //}

                        ////controlliamo i recordPresentiSulServer se sono stati spostati

                        //foreach (var record in recordsNonPresenti)
                        //{
                        //    var paginaMappa = listaRefMappa!.listRefPerPagina.FirstOrDefault(f => f.codici.Contains(record.CodiceGruppo!));

                        //    if (paginaMappa != null)
                        //    {
                        //        record.Pagina = Byte.Parse(paginaMappa.nomePagina!);
                        //    }
                        //    else
                        //    {
                        //        recordDaEliminare.Add(record);
                        //    }
                        //}

                        if (recordsNonPresenti.Count > 0 && listaRefMappa == null)
                        {
                            throw new Exception("La mappa per il sync non è stata ricevuta");
                        }

                        foreach (var record in recordsNonPresenti)
                        {
                            var paginaMappa = listaRefMappa!.listRefPerPagina.FirstOrDefault(f =>
                            {
                                var codiciMappa =
                                    f.codiciConId != null && f.codiciConId.Count > 0
                                        ? f.codiciConId
                                            .Where(c => !string.IsNullOrWhiteSpace(c.codice))
                                            .ToList()
                                        : (f.codici ?? new List<string>())
                                            .Where(c => !string.IsNullOrWhiteSpace(c))
                                            .Select(c => new filtroCodici
                                            {
                                                codice = c,
                                                idRec = 0
                                            })
                                            .ToList();

                                return codiciMappa.Any(c =>
                                {
                                    if (!string.Equals(c.codice, record.CodiceGruppo, StringComparison.OrdinalIgnoreCase))
                                        return false;

                                    if (c.idRec > 0)
                                        return c.idRec == record.IdRecordTracciato;

                                    return true;
                                });
                            });

                            if (paginaMappa != null)
                            {
                                record.Pagina = Byte.Parse(paginaMappa.nomePagina!);
                            }
                            else
                            {
                                recordDaEliminare.Add(record);
                            }
                        }

                        db.RemoveRange(recordDaEliminare);
                    }

                    if (impaginaETogliDaImpaginato)
                    {
                        foreach (var item in codiciNonImpaginatiSulServer)
                        {
                            RichiestaImpaginazioneSingolo richiesta = new RichiestaImpaginazioneSingolo();
                            richiesta.pagina = Byte.Parse(pag.nomePagina!);
                            richiesta.idLavorazione = id_lavorazione;
                            richiesta.byPassBloccoGiaImpaginato = false;
                            richiesta.codiceGruppo = item.codice;
                            richiesta.idRec = item.idRec;
                            IActionResult resImpSingolo = await impaginaSingolo(richiesta, FicoCombinazioneKitReadMode.Classic, true);
                            ArticoloInRevisioneKitResult? gruppoResult = null;
                            if (resImpSingolo is OkObjectResult && (resImpSingolo as OkObjectResult)!.Value is ArticoloInRevisioneKitResult)
                            {
                                gruppoResult = ((resImpSingolo as OkObjectResult)!.Value as ArticoloInRevisioneKitResult)!;

                                if (gruppoResult == null || !gruppoResult.esito)
                                {
                                    throw new Exception("Gruppo " + item.codice + " non trovato da impaginaSingolo");
                                }
                            }
                            else
                            {
                                if (resImpSingolo is OkObjectResult && (resImpSingolo as OkObjectResult)!.Value is string)
                                {
                                    throw new Exception((resImpSingolo as OkObjectResult)!.Value as string);
                                }
                                else
                                {
                                    throw new Exception("Errore nel tentativo di leggere il risultato di impaginaSingolo");
                                }
                            }

                            if (gruppoResult != null)
                            {
                                recordDaImpaginare.Add(gruppoResult.records);
                            }
                        }

                        recs.records.AddRange(recordDaImpaginare);
                    }

                    //                var recordsDaCambiarePagina = db.PromoLavorazioniRecords
                    //.Where(f => pag.codiciImpaginatiAPaginaDifferente.Contains(f.CodiceGruppo!)
                    //            && f.IdLavorazione == id_lavorazione).ToList();

                    //                foreach (var item in recordsDaCambiarePagina)
                    //                {
                    //                    if (byte.Parse(pag.nomePagina!) <= 0)
                    //                    {
                    //                        throw new Exception("E' stata ricevuta durante la sincronizzazione la richiesta di mettere l'elemento: " + item.CodiceGruppo + " a pagina non valida numero: " + byte.Parse(pag.nomePagina!));
                    //                    }
                    //                    item.Pagina = byte.Parse(pag.nomePagina!);
                    //                }

                    foreach (var item in codiciImpaginatiAPaginaDifferente)
                    {
                        PromoTracciatiRecord? recordTarget;

                        var recordDaCambiarePagina = GetLavorazioneRecordConFratelli(
                            item.codice,
                            item.idRec,
                            id_lavorazione,
                            out recordTarget
                        );

                        if (recordDaCambiarePagina == null)
                        {
                            continue;
                        }

                        if (byte.Parse(pag.nomePagina!) <= 0)
                        {
                            throw new Exception(
                                "E' stata ricevuta durante la sincronizzazione la richiesta di mettere l'elemento: " +
                                item.codice +
                                " a pagina non valida numero: " +
                                byte.Parse(pag.nomePagina!)
                            );
                        }

                        recordDaCambiarePagina.Pagina = byte.Parse(pag.nomePagina!);
                    }


                    res.recordsPerPagina.Add(recs);


                }


                db.SaveChanges();
                res.Esito = true;
            }
            catch (Exception ex)
            {
                res.error = ex.Message;
                res.Esito = false;
                res.recordsPerPagina = new List<recordsPerPagina>();
            }

            return Ok(res);
        }

        [HttpPut]
        [Route("Menabo/inserisciBoxInPromoLavorazioniRecord/{id_lavorazione}")]
        public async Task<IActionResult> inserisciBoxInPromoLavorazioniRecord([FromForm] string codice,[FromForm] string pag, int id_lavorazione)
        {
            try
            {
                RichiestaImpaginazioneSingolo richiesta = new RichiestaImpaginazioneSingolo();
                richiesta.pagina = Byte.Parse(pag);
                richiesta.idLavorazione = id_lavorazione;
                richiesta.byPassBloccoGiaImpaginato = false;
                richiesta.codiceGruppo = codice;
                IActionResult resImpSingolo = await impaginaSingolo(richiesta, FicoCombinazioneKitReadMode.Classic);
                ArticoloInRevisioneKitResult? gruppoResult = null;
                if (resImpSingolo is OkObjectResult && (resImpSingolo as OkObjectResult)!.Value is ArticoloInRevisioneKitResult)
                {
                    gruppoResult = ((resImpSingolo as OkObjectResult)!.Value as ArticoloInRevisioneKitResult)!;

                    if (gruppoResult == null || !gruppoResult.esito)
                    {
                        throw new Exception(codice + " non trovato in tracciato. L'elemento potrebbe essere uscito dalla lista o essere non più valido.");
                    }
                }
                else
                {
                    if (resImpSingolo is OkObjectResult && (resImpSingolo as OkObjectResult)!.Value is string)
                    {
                        throw new Exception((resImpSingolo as OkObjectResult)!.Value as string);
                    }
                    else
                    {
                        throw new Exception("Errore nel tentativo di leggere il risultato di impaginaSingolo");
                    }
                }

                return Ok(gruppoResult);

            }
            catch(Exception ex)
            {
                ArticoloInRevisioneKitResult? gruppoResult = new ArticoloInRevisioneKitResult
                {
                    error = ex.Message,
                    records = new List<ArticoloInKit>(),
                    esito = false,
                };

                return Ok(gruppoResult);
            }
            
        }

        [HttpPut]
        [Route("Menabo/ricollegaBox")]
        public async Task<IActionResult> ricollegaBox([FromForm] string stringRequest)
        {
            RisultatoRicollegamentoBox result = new RisultatoRicollegamentoBox();

            try
            {
                RichiestaRicollegamentoBox request = JsonConvert.DeserializeObject<RichiestaRicollegamentoBox>(stringRequest);
                PromoLavorazioni pl = await this.ctx2.PromoLavorazionis.Include(i2 => i2.PromoLavorazioniRecords).AsSplitQuery().FirstOrDefaultAsync(f => f.Id == request.idLavorazione);
                FicoRuntimeKit? kit = JsonConvert.DeserializeObject<FicoRuntimeKit>(pl.Meta!);

                if (pl == null)
                {
                    result.error = "lavorazione_inesistente";
                    return Ok(result);
                }


                result.idLavorazione = request.idLavorazione;
                List<Byte> _pagineCoinvolte = new List<byte>();
                if (request.rangePagine != null)
                {
                    string[] blocchi = request.rangePagine.Split(',');
                    foreach (string b in blocchi)
                    {
                        string[] microRange = b.Split('-');
                        if (microRange.Length == 1)
                        {
                            _pagineCoinvolte.Add(Byte.Parse(microRange[0]));
                        }
                        else
                        {
                            for (Byte b2 = Byte.Parse(microRange[0]); b2 <= Byte.Parse(microRange[1]); b2++)
                            {
                                // Your logic for each number in the microRange
                                _pagineCoinvolte.Add(b2);
                            }
                        }
                    }
                }


                Promo promo = await this.ctx2.Promos.FirstOrDefaultAsync(p => p.guidID == pl.GuidPromo);
                if (ficoController == null)
                {
                    ficoController = new FicoProcessController(_config, _external_lib, this._fico_conf, _option_import, this.httpClient, _cache, this._dbContextFactory, null, dbContextFactory2: this._dbContextFactory2);
                }

                List<PromoTracciati> tracciatiDellaLavorazione = ficoController.getTracciatiDelKit(promo, kit);

                List<int> _ids_tracciatiLavorazione = tracciatiDellaLavorazione.Select(s => s.Id).ToList();
                List<PromoTracciatiRecord> ptrDellaLavorazione = await this.ctx2.PromoTracciatiRecords.AsSplitQuery().Where(p => _ids_tracciatiLavorazione.Contains(p.IdTracciato)).ToListAsync();

                Func<string, PromoTracciatiRecord> getFormaDiversa = (_cod) =>
                {
                    //Estriamo intanto grossolanamente dove quel codice è presente in una stringa più grande
                    var _listaCodSingoloInGruppi = ptrDellaLavorazione.Where(p => p.CodiceGruppo.Contains(_cod)).ToList();
                    //Assicuriamoci che sia proprio quel codice ad essere un intero item e non magari solo per una parte
                    var prestazioneFormaDiversa = _listaCodSingoloInGruppi.FirstOrDefault(pp => pp.CodiceGruppo.Split(',').Contains(_cod));
                    return prestazioneFormaDiversa;
                };

                //var gruppoImpaginato = pl.PromoLavorazioniRecords.FirstOrDefault(f => f.Codice == request.elementoDaRicollegare.codiceGruppo);
                //List<PromoTracciatiRecord> itemsInTracciato = ptrDellaLavorazione.Where(P => P.CodiceGruppo == request.elementoDaRicollegare.codiceGruppo).ToList();

                var itemsInTracciato = ptrDellaLavorazione
.Where(p => string.Equals(
    p.CodiceGruppo,
    request.elementoDaRicollegare.codiceGruppo,
    StringComparison.OrdinalIgnoreCase))
.ToList();

                //PromoLavorazioniRecord plr = pl.PromoLavorazioniRecords.FirstOrDefault(f => f.Codice == request.elementoDaRicollegare.codiceGruppo);
                PromoTracciatiRecord? recordTarget;

                var plr = GetLavorazioneRecordConFratelli(
                    request.elementoDaRicollegare.codiceGruppo,
                    request.elementoDaRicollegare.idRec,
                    request.idLavorazione,
                    out recordTarget
                );

                string recordTargetCodice = "";
                if (recordTarget != null)
                {
                    recordTargetCodice = recordTarget.Codice;
                    itemsInTracciato = itemsInTracciato
                        .Where(p =>
                            p.IdTracciato == recordTarget.IdTracciato &&
                            p.Label == recordTarget.Label &&
                            p.Versione == recordTarget.Versione)
                        .ToList();
                }

                if (itemsInTracciato.Count == 0)
                {
                    //l'idRec non è affidabile
                    itemsInTracciato = ptrDellaLavorazione
                    .Where(p => string.Equals(
                        p.CodiceGruppo,
                        request.elementoDaRicollegare.codiceGruppo,
                        StringComparison.OrdinalIgnoreCase))
                    .ToList();

                    var probabilePrimario = itemsInTracciato.FirstOrDefault(f => f.Codice == recordTargetCodice);

                    if (probabilePrimario != null)
                    {
                        request.elementoDaRicollegare.idRec = (int)probabilePrimario.Id;
                        result.idRecSelezionato = request.elementoDaRicollegare.idRec;
                        //result.error = "IdRec non corrispondente con impossibilità di risalire a quello corretto";
                        //return Ok(result);
                    }

                }


                List<string> listCodici = request.elementoDaRicollegare.codiceGruppo
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
    .Distinct(StringComparer.OrdinalIgnoreCase)
    .ToList();

                if (itemsInTracciato.Count > 1)
                {
                    //è un gruppo ed è già presente in tracciato
                    if (itemsInTracciato.Count != listCodici.Count)
                    {
                        //prendiamo il primo elemento e vediamo se appare più volte
                        var el = itemsInTracciato[0];
                        if (itemsInTracciato.Count(f=>f.Codice == el.Codice) > 1)
                        {
                            throw new Exception("Elemento con più istanze nello stesso tracciato e idRec non corrispondente, impossibile effettuare il ricollegamento.");
                        }
                        else
                        {
                            throw new Exception("Mismatch tra il numero di elementi trovati e quelli attesi durante la ricerca in tracciato per il ricollegamento.");
                        }
                    }
                }

                if (request.elementoDaRicollegare.idRec <= 0 && itemsInTracciato.Count > 0)
                {
                    var occorrenze = itemsInTracciato
                        .GroupBy(p => new
                        {
                            p.IdTracciato,
                            p.Label,
                            p.Versione,
                            p.CodiceGruppo
                        })
                        .Count();

                    if (occorrenze > 1)
                    {
                        throw new Exception(
                            $"Ricollegamento ambiguo: il codice gruppo {request.elementoDaRicollegare.codiceGruppo} " +
                            "è presente in più occorrenze. Passare idRec per disambiguare."
                        );
                    }
                }


                if (plr != null)
                {
                    RicollegamentoBoxItem item = new RicollegamentoBoxItem();
                    //Codice gia impaginato in questa lavorazione
                    if (request.elementoDaRicollegare.forzaloAllaPaginaIndicata)
                    {
                        //Attenzione, se lavoro per range di pagina 
                        //Devo capire se la pagina trovata è fuori da quel range.
                        //Se lo è non posso forzare niente
                        bool fuoriRange = false;
                        if (_pagineCoinvolte.Count > 0)
                        {
                            fuoriRange = !_pagineCoinvolte.Contains(plr.Pagina);
                        }

                        if (!fuoriRange)
                        {
                            plr.Pagina = request.elementoDaRicollegare.pag;
                        }
                    }

                    item.stato = StatoRicollegamentoBox.GiaImpaginato;
                    item.pag = plr.Pagina;
                    result.codici.Add(item);
                }
                else
                {

                    if (itemsInTracciato.Count > 0)
                    {
                        //Semplicemente lo metto in promo lavorazione record e FINE, ricollegamento semplice
                        RicollegamentoBoxItem item = new RicollegamentoBoxItem();


                        RichiestaImpaginazioneSingolo richiesta = new RichiestaImpaginazioneSingolo();
                        richiesta.pagina = request.elementoDaRicollegare.pag;
                        richiesta.idLavorazione = pl.Id;
                        richiesta.idRec = request.elementoDaRicollegare.idRec;
                        richiesta.byPassBloccoGiaImpaginato = false;
                        richiesta.codiceGruppo = request.elementoDaRicollegare.codiceGruppo;

                        IActionResult resImpSingolo = await impaginaSingolo(richiesta, FicoCombinazioneKitReadMode.Classic);

                        string _err = "";
                        ArticoloInRevisioneKitResult? gruppoResult = null;
                        if (resImpSingolo is OkObjectResult && (resImpSingolo as OkObjectResult)!.Value is ArticoloInRevisioneKitResult)
                        {
                            gruppoResult = ((resImpSingolo as OkObjectResult)!.Value as ArticoloInRevisioneKitResult)!;

                            if (gruppoResult == null || !gruppoResult.esito)
                            {
                                _err = "Non trovato in tracciato. L'elemento potrebbe essere uscito dalla lista o essere non più valido.";
                            }
                        }
                        else
                        {
                            if (resImpSingolo is OkObjectResult && (resImpSingolo as OkObjectResult)!.Value is string)
                            {
                                _err = (resImpSingolo as OkObjectResult)!.Value as string;
                            }
                            else
                            {
                                _err = "Errore nel tentativo di leggere il risultato di impaginaSingolo";
                            }
                        }

                        item.stato = StatoRicollegamentoBox.AutoImpaginato;
                        item.error = _err;
                        result.codici.Add(item);


                    }
                    else
                    {

                        //Prima vediamo se il codice analizzato è presente all'interno di questa lavorazione ma in altre forme
                        //Per farlo devo scomporre il codice in tutti i suoi singoli e controllarne uno ad uno
                        bool formaDiversa = false;
                        List<string> codiciCambioFormaPresenti = new List<string>();
                        foreach (string codSingolo in listCodici)
                        {
                            var gruppoFormaDiversa = getFormaDiversa(codSingolo);
                            if (gruppoFormaDiversa != null)
                            {
                                //Controllo se esiste già perchè puo accadere con facilità
                                if (!codiciCambioFormaPresenti.Contains(gruppoFormaDiversa.CodiceGruppo))
                                    codiciCambioFormaPresenti.Add(gruppoFormaDiversa.CodiceGruppo);
                            }
                        }

                        if (codiciCambioFormaPresenti.Count > 0)
                        {
                            RicollegamentoBoxItem item = new RicollegamentoBoxItem();
                            //C'è cambio forma
                            //Sottrazione dei codici
                            var _listaCodiciPresenti = String.Join(',', codiciCambioFormaPresenti.Select(s => s));
                            listCodici = listCodici.Where(s => !_listaCodiciPresenti.Split(',').Contains(s)).ToList();

                            item.stato = StatoRicollegamentoBox.CambioDiForma;
                            item.codiciPresenti = codiciCambioFormaPresenti;
                            item.codiciNonEsistenti = listCodici.ToList();
                            result.codici.Add(item);

                        }
                        else
                        {
                            //dobbiamo recuperare i dati per ognuno per poter effettuare il clonamento



                            IActionResult? elementi = null;
                            elementi = await LeggiTracciatoRecord(request.elementoDaRicollegare.codiceGruppo, 0, false, false, false, true, true);
                            List<List<Dictionary<string, object>>> riscontroTracciati = new List<List<Dictionary<string, object>>>();
                            if (elementi is OkObjectResult)
                            {
                                var okResult = elementi as OkObjectResult;
                                if (okResult!.Value is List<List<Dictionary<string, object>>>)
                                {
                                    riscontroTracciati = (okResult.Value as List<List<Dictionary<string, object>>>)!;
                                }

                            }

                            if (riscontroTracciati.Count == 0)
                            {
                                RicollegamentoBoxItem item = new RicollegamentoBoxItem();

                                //Codice non presente in nessuna promo
                                item.stato = StatoRicollegamentoBox.Inesistente;
                                result.codici.Add(item);
                            }
                            else
                            {
                                foreach (var riscontro in riscontroTracciati)
                                {
                                    //ogni ciclo di foreach rappresenta un codice del gruppo
                                    RicollegamentoBoxItem item = new RicollegamentoBoxItem();

                                    var ordinatiPerData = riscontro
                         .OrderByDescending(x => x["dataPromo"])
                         .ToList();

                                    var piuRecente = ordinatiPerData[0];

                                    var primoPerPromo = ordinatiPerData
                                        .FirstOrDefault(x =>
                                            x.ContainsKey("idPromo") &&
                                            x["idPromo"] != null &&
                                            Convert.ToInt32(x["idPromo"]) == promo.Id);

                                    var primoPerAreaECanale = ordinatiPerData
                                        .FirstOrDefault(x =>
                                            x.ContainsKey("area") &&
                                            x.ContainsKey("canale") &&
                                            string.Equals(x["area"]?.ToString(), request.areaDiPartenza, StringComparison.OrdinalIgnoreCase) &&
                                            string.Equals(x["canale"]?.ToString(), request.canaleDiPartenza, StringComparison.OrdinalIgnoreCase));

                                    Dictionary<string, object>? primoPerArea = null;
                                    Dictionary<string, object>? primoPerCanale = null;

                                    if (primoPerAreaECanale == null)
                                    {
                                        primoPerArea = ordinatiPerData
                                            .FirstOrDefault(x =>
                                                x.ContainsKey("area") &&
                                                string.Equals(x["area"]?.ToString(), request.areaDiPartenza, StringComparison.OrdinalIgnoreCase));

                                        primoPerCanale = ordinatiPerData
                                            .FirstOrDefault(x =>
                                                x.ContainsKey("canale") &&
                                                string.Equals(x["canale"]?.ToString(), request.canaleDiPartenza, StringComparison.OrdinalIgnoreCase));
                                    }

                                    RiscontriInAltriTracciati obj = new RiscontriInAltriTracciati();
                                    obj.tuttiRiscontri = ordinatiPerData;
                                    obj.piuRecente = piuRecente;
                                    obj.stessaPromo = primoPerPromo;
                                    obj.stessoCanaleArea = primoPerAreaECanale;
                                    obj.stessoCanale = primoPerCanale;
                                    obj.stessaArea = primoPerArea;

                                    item.riscontriInAltriTracciati = obj;
                                    item.stato = StatoRicollegamentoBox.RichiestaClonazione;
                                    item.error = "";
                                    result.codici.Add(item);
                                }

                            }
                        }

                    }

                }

            }
            catch (Exception ex)
            {
                result.error = ex.ToString();
                result.idRecSelezionato = 0;
            }

            return Ok(result);

        }

        public class InddObjImpostazionePrimarieSecondarieRequest
        {
            public int idLavorazione { get; set; }
            public string? CodiceGruppo { get; set; }

            public int idRec { get; set; } = 0;
            public string? ps { get; set; }
        }

        //public class InddObjCambioPaginaRequest
        //{
        //    public int idLavorazione { get; set; }
        //    public string? CodiceGruppo { get; set; }

        //    public int idRec { get; set; } = 0;
        //    public Byte pag { get; set; }
        //}

        public class OkInddResponse
        {
            public List<string> nomiFotoRichieste = new List<string>();
            public bool esito = true;
            public string error = "";
        }

        //[HttpPut]
        //[Route("Menabo/modificaPrimarieSecondarie/{idOperazione}")]
        //public async Task<IActionResult> modificaPrimarieSecondarie(InddObjImpostazionePrimarieSecondarieRequest dato, int idOperazione)
        //{
        //    BoolResult result = new BoolResult();
        //    try
        //    {
        //        List<RevisioneSelezioneFotoFromIndd> ps = JsonConvert.DeserializeObject<List<RevisioneSelezioneFotoFromIndd>>(dato.ps!)!;
        //        PromoLavorazioniRecord? plrItem = this.ctx2.PromoLavorazioniRecords.Include(i1 => i1.IdPromoTracciatiRecordNavigation).Where(plr => plr.IdLavorazione == dato.idLavorazione && plr.CodiceGruppo == dato.CodiceGruppo).FirstOrDefault();
        //        if (plrItem == null)
        //            throw new Exception($"Nessun elemento trovato, Codice {dato.CodiceGruppo} non disponibile");

        //        registraAttivitaMenabo(idOperazione, dato.CodiceGruppo!, "modificaPrimarieSecondarie", tipoOperazione.updatePS, ps, plrItem.Id);

        //        result.Esito = true;
        //        return Ok(result);
        //    }
        //    catch (Exception ex)
        //    {
        //        result.error = ex.ToString();
        //        result.Esito = false;
        //        return Ok(result);
        //    }
        //}

        [HttpPut]
        [Route("Menabo/modificaPrimarieSecondarie/{idOperazione}")]
        public async Task<IActionResult> modificaPrimarieSecondarie(
    InddObjImpostazionePrimarieSecondarieRequest dato,
    int idOperazione)
        {
            BoolResult result = new BoolResult();

            try
            {
                List<RevisioneSelezioneFotoFromIndd> ps =
                    JsonConvert.DeserializeObject<List<RevisioneSelezioneFotoFromIndd>>(dato.ps!)!;

                PromoLavorazioniRecord? plrItem = null;

                long idRec = dato.idRec;

                var query = this.ctx2.PromoLavorazioniRecords
                    .Include(i1 => i1.IdPromoTracciatiRecordNavigation)
                    .Where(plr =>
                        plr.IdLavorazione == dato.idLavorazione &&
                        plr.CodiceGruppo == dato.CodiceGruppo);

                if (idRec > 0)
                {
                    // 1. Match esatto.
                    plrItem = query.FirstOrDefault(plr =>
                        plr.IdRecordTracciato == idRec);

                    // 2. Fallback fratello.
                    if (plrItem == null)
                    {
                        var candidati = query.ToList();

                        if (candidati.Count > 0)
                        {
                            var recordTarget = this.ctx2.PromoTracciatiRecords
                                .AsNoTracking()
                                .Where(r => r.Id == idRec)
                                .Select(r => new
                                {
                                    r.Id,
                                    r.IdTracciato,
                                    r.CodiceGruppo,
                                    r.Label,
                                    r.Versione
                                })
                                .FirstOrDefault();

                            if (recordTarget != null)
                            {
                                var idsCandidati = candidati
                                    .Select(c => c.IdRecordTracciato)
                                    .Distinct()
                                    .ToList();

                                var recordsCandidati = this.ctx2.PromoTracciatiRecords
                                    .AsNoTracking()
                                    .Where(r => idsCandidati.Contains(r.Id))
                                    .Select(r => new
                                    {
                                        r.Id,
                                        r.IdTracciato,
                                        r.CodiceGruppo,
                                        r.Label,
                                        r.Versione
                                    })
                                    .ToList();

                                var fratello = recordsCandidati.FirstOrDefault(r =>
                                    r.IdTracciato == recordTarget.IdTracciato &&
                                    r.Versione == recordTarget.Versione &&
                                    r.Label == recordTarget.Label &&
                                    string.Equals(r.CodiceGruppo, recordTarget.CodiceGruppo, StringComparison.OrdinalIgnoreCase)
                                );

                                if (fratello != null)
                                {
                                    plrItem = candidati.FirstOrDefault(c =>
                                        c.IdRecordTracciato == fratello.Id);
                                }
                            }
                        }
                    }
                }
                else
                {
                    // Legacy: vecchi client senza idRec.
                    plrItem = query.FirstOrDefault();
                }

                if (plrItem == null)
                {
                    throw new Exception(
                        $"Nessun elemento trovato, Codice {dato.CodiceGruppo} non disponibile"
                    );
                }

                registraAttivitaMenabo(
                    idOperazione,
                    dato.CodiceGruppo!,
                    "modificaPrimarieSecondarie",
                    tipoOperazione.updatePS,
                    ps,
                    plrItem.Id
                );

                result.Esito = true;
                return Ok(result);
            }
            catch (Exception ex)
            {
                result.error = ex.ToString();
                result.Esito = false;
                return Ok(result);
            }
        }

        private string registraAttivitaMenabo(int id_operazione, string codRef, string url, tipoOperazione tipo, List<RevisioneSelezioneFotoFromIndd>? listaCambiamenti = null, Int64 id_lavorazione_record = 0)
        {
            var register = new Register(_config.GetConnectionString("IstandaConnectionDb")!, this._dbContextFactory, dbContextFactory2: this._dbContextFactory2);
            var session = SessionIstantaObject.GetSession(HttpContext);

            if (id_operazione == 0)
            {
                var nuovaOperazione = new RegistroOperazioni();
                nuovaOperazione.Autore = int.Parse(session);
                nuovaOperazione.TipoOperazione = (byte)tipo;// tipoOperazione.updateFoto;
                nuovaOperazione.CodiceAssociato = codRef;
                nuovaOperazione.Url = url;
                if (listaCambiamenti != null)
                {
                    nuovaOperazione.FormData = JsonConvert.SerializeObject(listaCambiamenti);
                }
                if (id_lavorazione_record > 0)
                {
                    nuovaOperazione.idPromoLavorazioniRecord = id_lavorazione_record;
                }

                int idAttivita = (int)register.addOperazione(nuovaOperazione, true, session, DateTime.Now);
                if (idAttivita == 0)
                {
                    return "Impossibile aggiungere l'operazione ai task del registro operazioni";
                }
            }
            else
            {
                register.updateOperazione(id_operazione, statoOperazioni.risolta, session);
            }

            return "ok";
        }

        public class FileTest
        {
            public string? nomeFile { get; set; }
            public List<byte>? byteList { get; set; }
        }


        [HttpPut]
        [Route("Menabo/Sgruppa/{idKitLavorazione}/{idOperazione}")]
        public async Task<IActionResult> Sgruppa(SgruppamentoRequest gruppi, int idKitLavorazione, int idOperazione)
        {
            //OkResultGruppi result = new OkResultGruppi();
            SgruppamentoResponse result = new SgruppamentoResponse();
            string keyAllEtichette = GLOBAL_VARIABLES.allEtichette;
            string keyEtichetteVisual = GLOBAL_VARIABLES.etichetteVisual;

            try
            {
                using var tx = await this.ctx2.Database.BeginTransactionAsync();
                var session = SessionIstantaObject.GetSession(HttpContext);
                Int16 id_utente = Int16.Parse(session);
                PromoTracciatiRecord? recordTargetOriginale;

                var lavorazioneRecord = GetLavorazioneRecordConFratelli(
                    gruppi.originalGroup!,
                    gruppi.idRec,
                    idKitLavorazione,
                    out recordTargetOriginale
                );

                if (lavorazioneRecord == null)
                {
                    throw new Exception("Gruppo " + gruppi.originalGroup + " non trovato in PromoLavorazioniRecords");
                }
                if(lavorazioneRecord.Pagina <= 0)
                {
                    throw new Exception("L'elemento gruppo da cui i singoli vorrebbero ereditare la pagina risulta trovarsi alla pagina non valida: " + lavorazioneRecord.Pagina + ". Operazione bloccata, contattare un tecnico.");
                }
                //var Tracciato = this.ctx2.PromoTracciatiRecords
                //    .Include(i => i.IdTracciatoNavigation)
                //    .ThenInclude(i2 => i2.IdPromoNavigation)
                //    .Where(f => f.Id == lavorazioneRecord.IdRecordTracciato)
                //    .FirstOrDefault();

                //int idTracciato = Tracciato != null ? (int)Tracciato.IdTracciato : 0;

                //if (idTracciato == 0)
                //{
                //    throw new Exception("Record con id " + lavorazioneRecord.IdRecordTracciato + " non trovato in PromoTracciatiRecords");
                //}

                int idTracciato = 0;
                PromoTracciatiRecord? Tracciato = null;

                if (recordTargetOriginale != null)
                {
                    idTracciato = recordTargetOriginale.IdTracciato;

                    Tracciato = this.ctx2.PromoTracciatiRecords
                        .Include(i => i.IdTracciatoNavigation)
                        .ThenInclude(i2 => i2.IdPromoNavigation)
                        .FirstOrDefault(f => f.Id == recordTargetOriginale.Id);
                }
                else
                {
                    Tracciato = this.ctx2.PromoTracciatiRecords
                        .Include(i => i.IdTracciatoNavigation)
                        .ThenInclude(i2 => i2.IdPromoNavigation)
                        .FirstOrDefault(f => f.Id == lavorazioneRecord.IdRecordTracciato);

                    idTracciato = Tracciato != null ? Tracciato.IdTracciato : 0;
                }

                if (idTracciato == 0)
                {
                    throw new Exception("Record con id " + lavorazioneRecord.IdRecordTracciato + " non trovato in PromoTracciatiRecords");
                }

                //var recordsGruppo = this.ctx2.PromoTracciatiRecords.Where(f => f.CodiceGruppo == gruppi.originalGroup && f.IdTracciato == idTracciato).ToList();
                var recordsGruppo = GetRecordsGruppoDaRaggruppare(
    gruppi.originalGroup!,
    idTracciato,
    recordTargetOriginale
);
                //if (recordsGruppo.Count == 0 || recordsGruppo.Count != gruppi.originalGroup!.Split(",").Length)
                //{
                //    throw new Exception("Non tutti gli elementi del gruppo" + gruppi.originalGroup + " sono stati trovati in PromoTracciatiRecords");
                //}

                var codiciOriginali = gruppi.originalGroup!
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
    .Distinct(StringComparer.OrdinalIgnoreCase)
    .ToList();

                if (recordsGruppo.Count == 0 || recordsGruppo.Count != codiciOriginali.Count)
                {
                    throw new Exception("Non tutti gli elementi del gruppo " + gruppi.originalGroup + " sono stati trovati in PromoTracciatiRecords");
                }

                string key_codice_gruppo = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppo;
                string keyCodiceRef = Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice;


                List<Dictionary<string, object>> _recDicts = new List<Dictionary<string, object>>();


                foreach (var gruppo in gruppi.ListaGruppi!)
                {
                    var codiciSingoli = gruppo.CodiceGruppo!.Split(",", StringSplitOptions.RemoveEmptyEntries)
                                                          .Select(s => s.Trim())
                                                          .ToArray();

                    foreach (string codice in codiciSingoli)
                    {
                        var ptr = recordsGruppo.FirstOrDefault(f => f.Codice == codice);
                        if (ptr == null)
                            throw new Exception($"Record {codice} non trovato in PromoTracciatiRecords (gruppo originale {gruppi.originalGroup})");

                        var dato = IstantaJson.getJsonObject(ptr.Dato!);
                        dato[key_codice_gruppo] = gruppo.CodiceGruppo;   // come già fai
                        _recDicts.Add(dato);
                    }
                }


                IstantaController icCtrl = new IstantaController("", this.path_external_lib, this.path_external_source, this._dbContextFactory);
                FicoRuntimeKit kit = JsonConvert.DeserializeObject<FicoRuntimeKit>(lavorazioneRecord.IdPromoLavorazioniNavigation.Meta!);
                Dictionary<string, object> _pass = new Dictionary<string, object>();
                _pass["records"] = _recDicts;
                _pass["kit"] = kit;

                List<Dictionary<string, object>> resultExternal = icCtrl.execLibFunction($"AgenziaLib.{this._fico_conf.Value.nomeCliente}.elaboraTracciatiRecords", _pass) as List<Dictionary<string, object>>;

                //foreach (Dictionary<string, object> recPostElaborazione in resultExternal)
                //{
                //    string codSingooloInGruppoSgruppato = recPostElaborazione[keyCodiceRef].ToString()!;
                //    PromoTracciatiRecord ptr = recordsGruppo.FirstOrDefault(f => f.Codice == codSingooloInGruppoSgruppato)!;
                //    if (ptr == null)
                //        throw new Exception($"Record {codSingooloInGruppoSgruppato} restituito da elaboraTracciatiRecords non trovato nei recordsGruppo");
                //    ptr.Dato = JsonConvert.SerializeObject(recPostElaborazione);
                //    ptr.CodiceGruppo = recPostElaborazione[GLOBAL_VARIABLES_FICO.keyCodiceGruppo].ToString();
                //}

                var ptrQueueByCodice = recordsGruppo
    .GroupBy(p => p.Codice)
    .ToDictionary(
        g => g.Key!,
        g => new Queue<PromoTracciatiRecord>(g),
        StringComparer.OrdinalIgnoreCase
    );

                var recordsAggiornatiPerGruppo =
                    new Dictionary<string, List<(PromoTracciatiRecord Ptr, Dictionary<string, object> Dato)>>(
                        StringComparer.OrdinalIgnoreCase
                    );

                foreach (Dictionary<string, object> recPostElaborazione in resultExternal)
                {
                    string codiceSingolo = recPostElaborazione[keyCodiceRef].ToString()!;
                    string nuovoGruppo = recPostElaborazione[GLOBAL_VARIABLES_FICO.keyCodiceGruppo].ToString()!;

                    if (!ptrQueueByCodice.TryGetValue(codiceSingolo, out var queue) || queue.Count == 0)
                    {
                        throw new Exception($"Record {codiceSingolo} restituito da elaboraTracciatiRecords non trovato nei recordsGruppo");
                    }

                    PromoTracciatiRecord ptr = queue.Dequeue();

                    ptr.Dato = JsonConvert.SerializeObject(recPostElaborazione);
                    ptr.CodiceGruppo = nuovoGruppo;

                    if (!recordsAggiornatiPerGruppo.ContainsKey(nuovoGruppo))
                    {
                        recordsAggiornatiPerGruppo[nuovoGruppo] =
                            new List<(PromoTracciatiRecord Ptr, Dictionary<string, object> Dato)>();
                    }

                    recordsAggiornatiPerGruppo[nuovoGruppo].Add((ptr, recPostElaborazione));
                }



                await this.ctx2.SaveChangesAsync();


                foreach (var gruppo in gruppi.ListaGruppi)
                {
                    //IActionResult? newGruppoRes = null;
                    //newGruppoRes = await getSchedaRef(gruppo.CodiceGruppo!, idKitLavorazione, gruppo.IdRec, true);

                    if (!recordsAggiornatiPerGruppo.TryGetValue(gruppo.CodiceGruppo!, out var recordsNuovoGruppo) ||
    recordsNuovoGruppo.Count == 0)
                    {
                        throw new Exception($"Nessun record aggiornato trovato per il nuovo gruppo {gruppo.CodiceGruppo}");
                    }

                    var primarioNuovoGruppo = recordsNuovoGruppo
                        .FirstOrDefault(r =>
                            r.Dato.ContainsKey(GLOBAL_VARIABLES.keyXMLSelezione) &&
                            Convert.ToByte(r.Dato[GLOBAL_VARIABLES.keyXMLSelezione]) == (byte)TipoSelezioneMenabo.Primaria);

                    long idRecSchedaRef = primarioNuovoGruppo.Ptr != null
                        ? primarioNuovoGruppo.Ptr.Id
                        : recordsNuovoGruppo[0].Ptr.Id;

                    IActionResult? newGruppoRes = await getSchedaRef(
                        gruppo.CodiceGruppo!,
                        idKitLavorazione,
                        idRecSchedaRef,
                        true,
                        FicoCombinazioneKitReadMode.Classic
                    );

                    ArticoloInRevisioneKitResult gruppoResult = new ArticoloInRevisioneKitResult();
                    if (newGruppoRes is OkObjectResult && (newGruppoRes as OkObjectResult)!.Value is ArticoloInRevisioneKitResult)
                    {
                        gruppoResult = ((newGruppoRes as OkObjectResult)!.Value as ArticoloInRevisioneKitResult)!;

                        if (gruppoResult == null || !gruppoResult.esito)
                        {
                            throw new Exception("Gruppo " + gruppo.CodiceGruppo + " non trovato da LeggiTracciatiRecord");
                        }
                    }
                    else
                    {
                        if (newGruppoRes is OkObjectResult && (newGruppoRes as OkObjectResult)!.Value is string)
                        {
                            throw new Exception((newGruppoRes as OkObjectResult)!.Value as string);
                        }
                        else
                        {
                            throw new Exception("Errore nel tentativo di leggere il risultato di LeggiTracciatiRecord");
                        }
                    }


                    Dictionary<string, object> res = new Dictionary<string, object>();
                    var primario = gruppoResult.records.Where(f => Convert.ToByte(f.recordInTracciato[GLOBAL_VARIABLES.keyXMLSelezione]) == (Byte)TipoSelezioneMenabo.Primaria).FirstOrDefault();
                    if (primario == null)
                        throw new Exception($"Primario non trovato per gruppo {gruppo.CodiceGruppo}");
                    primario!.recordInTracciato[keyAllEtichette] = primario.allEtichette;
                    primario.recordInTracciato[keyEtichetteVisual] = primario.etichetteVisual;
                    primario.recordInTracciato[GLOBAL_VARIABLES.keyRefIdRec] = primario.IdRec;


                    long idRecPrimario = primario.IdRec; // o cast/convert se serve

                    string codicePrimario = primario.recordInTracciato[keyCodiceRef].ToString()!;
                    // oppure GLOBAL_VARIABLES.keyRefCodice, dipende da cosa hai dentro recordInTracciato

                    var recToAdd = new PromoLavorazioniRecord
                    {
                        Codice = codicePrimario,
                        CodiceGruppo = gruppo.CodiceGruppo,
                        IdRecordTracciato = idRecPrimario,
                        IdLavorazione = idKitLavorazione,
                        Pagina = lavorazioneRecord.Pagina,
                        Indice = (byte)0,
                        IdAutore = id_utente,
                        RegisterDate = DateTime.Now
                    };

                    this.ctx2.PromoLavorazioniRecords.Add(recToAdd);

                    var resLista = OttieniListaImpaginazione(gruppoResult.records);
                    if (!resLista.esito)
                    {
                        throw new Exception(resLista.error);
                    }

                    result.listaGruppi.AddRange(resLista.listaGruppi);
                }

                this.ctx2.PromoLavorazioniRecords.Remove(lavorazioneRecord);
                await this.ctx2.SaveChangesAsync();
                await tx.CommitAsync();

                var register = new Register(_config.GetConnectionString("IstandaConnectionDb")!, this._dbContextFactory, dbContextFactory2: this._dbContextFactory2);
                if (idOperazione == 0)
                {
                    //l'operazione è stata autorizzata per cui procediamo a creare l'operazione sul DB
                    var nuovaOperazione = new RegistroOperazioni();
                    nuovaOperazione.Area = "";
                    nuovaOperazione.Canale = "";
                    nuovaOperazione.Stato = (byte)statoOperazioni.risolta;
                    nuovaOperazione.Autore = int.Parse(session);
                    //var data = DateTime.Now;
                    //string dataFormattata = data.ToString("dd/MM/yyyy HH:mm:ss");
                    //nuovaOperazione.Data_Registrazione = dataFormattata;
                    //nuovaOperazione.Data_Esecuzione = dataFormattata;
                    nuovaOperazione.TipoOperazione = (byte)tipoOperazione.sgruppa;
                    nuovaOperazione.IdTracciato = idTracciato;
                    nuovaOperazione.idPromoLavorazione = idKitLavorazione;
                    nuovaOperazione.CodiceAssociato = gruppi.originalGroup;
                    nuovaOperazione.FormData = JsonConvert.SerializeObject(gruppi);
                    nuovaOperazione.Url = "Menabo/Sgruppa";
                    register.addOperazione(nuovaOperazione, true, session, DateTime.Now);
                }
                else
                {
                    register.updateOperazione(idOperazione, statoOperazioni.risolta, session);
                }
            }
            catch (Exception ex)
            {
                result.esito = false;
                result.error = ex.ToString();
                result.listaGruppi.Clear();
                return Ok(result);
            }

            result.esito = true;

            return Ok(result);
        }


        [HttpPut]
        [Route("Menabo/Raggruppa/{idLavorazione}/{idOperazione}")]
        public async Task<IActionResult> Raggruppa([FromForm] ListaGruppiRaggruppamento gruppi, int idLavorazione, int idOperazione)
        {
            //OkResultGruppi result = new OkResultGruppi();
            RaggruppamentoResponse result = new RaggruppamentoResponse();
            string keyAllEtichette = GLOBAL_VARIABLES.allEtichette;
            string keyEtichetteVisual = GLOBAL_VARIABLES.etichetteVisual;
            var session = SessionIstantaObject.GetSession(HttpContext);
            Int16 id_utente = Int16.Parse(session);
            try
            {
                using var tx = await this.ctx2.Database.BeginTransactionAsync();
                string key_codice_gruppo = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppo;
                string keyCodiceRef = Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice;
                string keyXMLSelezione = GLOBAL_VARIABLES.keyXMLSelezione;

                var gruppiDaRaggruppare =
    gruppi.ListaCodiciConId != null && gruppi.ListaCodiciConId.Count > 0
        ? gruppi.ListaCodiciConId
            .Where(g => !string.IsNullOrWhiteSpace(g.codice))
            .ToList()
        : (gruppi.ListaCodici ?? new List<string>())
            .Where(c => !string.IsNullOrWhiteSpace(c))
            .Select(c => new filtroCodici
            {
                codice = c,
                idRec = 0
            })
            .ToList();

                if (gruppiDaRaggruppare.Count == 0)
                {
                    throw new Exception("Nessun gruppo ricevuto per il raggruppamento");
                }


                //List<string> codiciSingoli = new List<string>();
                //foreach (var gruppo in gruppi.ListaCodici!)
                //{
                //    //Console.WriteLine($"RAGGRUPPA {gruppo}");
                //    codiciSingoli.AddRange(gruppo.Split(","));
                //}

                //codiciSingoli.Sort();

                //string nuovoCodiceGruppo = "";
                //foreach (var codice in codiciSingoli)
                //{
                //    nuovoCodiceGruppo += codice + ",";
                //}

                ////Console.WriteLine($"Codice formato {nuovoCodiceGruppo}");

                //nuovoCodiceGruppo = nuovoCodiceGruppo.Substring(0, nuovoCodiceGruppo.Length - 1);

                List<string> codiciSingoli = new List<string>();

                foreach (var gruppo in gruppiDaRaggruppare)
                {
                    codiciSingoli.AddRange(
                        gruppo.codice.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                    );
                }

                codiciSingoli = codiciSingoli
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .OrderBy(c => c, StringComparer.OrdinalIgnoreCase)
                    .ToList();

                string nuovoCodiceGruppo = string.Join(",", codiciSingoli);

                int idTracciato = 0;
                int paginaPrimoElemento = -1;

                List<Dictionary<string, object>> _recDicts = new List<Dictionary<string, object>>();
                List<PromoTracciatiRecord> _ptrList = new List<PromoTracciatiRecord>();
                FicoRuntimeKit kit = null;
                List<ArticoloInRevisione> revList = new List<ArticoloInRevisione>();

                foreach (var gruppoInput in gruppiDaRaggruppare)
                {
                    string gruppo = gruppoInput.codice;
                    long idRecGruppo = gruppoInput.idRec;

                    PromoTracciatiRecord? recordTarget;

                    var lavoriazioneRecord = GetLavorazioneRecordConFratelli(
                        gruppo,
                        idRecGruppo,
                        idLavorazione,
                        out recordTarget
                    );

                    if (lavoriazioneRecord == null)
                    {
                        throw new Exception("Gruppo " + gruppo + " non trovato in PromoLavorazioniRecords");
                    }

                    if (kit == null)
                    {
                        kit = JsonConvert.DeserializeObject<FicoRuntimeKit>(
                            lavoriazioneRecord.IdPromoLavorazioniNavigation.Meta!
                        );
                    }

                    if (paginaPrimoElemento == -1)
                    {
                        paginaPrimoElemento = lavoriazioneRecord.Pagina;
                    }

                    if (paginaPrimoElemento <= 0)
                    {
                        throw new Exception(
                            "L'elemento da cui ereditare la pagina risulta trovarsi alla pagina non valida: " +
                            paginaPrimoElemento +
                            ". Operazione bloccata, contattare un tecnico."
                        );
                    }

                    if (idTracciato == 0)
                    {
                        if (recordTarget != null)
                        {
                            idTracciato = recordTarget.IdTracciato;
                        }
                        else
                        {
                            idTracciato = this.ctx2.PromoTracciatiRecords
                                .Where(f => f.Id == lavoriazioneRecord.IdRecordTracciato)
                                .Select(f => f.IdTracciato)
                                .FirstOrDefault();
                        }

                        if (idTracciato == 0)
                        {
                            throw new Exception("Record con id " + lavoriazioneRecord.IdRecordTracciato + " non trovato in PromoTracciatiRecords");
                        }
                    }

                    var recordsGruppo = GetRecordsGruppoDaRaggruppare(
                        gruppo,
                        idTracciato,
                        recordTarget
                    );

                    if (recordsGruppo.Count == 0)
                    {
                        throw new Exception("Elemento (" + gruppo + ") non trovato in tracciato");
                    }

                    _ptrList.AddRange(recordsGruppo);

                    foreach (var record in recordsGruppo)
                    {
                        var dato = IstantaJson.getJsonObject(record.Dato!);
                        dato[key_codice_gruppo] = nuovoCodiceGruppo;

                        _recDicts.Add(dato);
                    }

                    this.ctx2.PromoLavorazioniRecords.Remove(lavoriazioneRecord);
                }

                IstantaController icCtrl = new IstantaController("", this.path_external_lib, this.path_external_source, this._dbContextFactory);
                Dictionary<string, object> _pass = new Dictionary<string, object>();
                _pass["records"] = _recDicts;
                _pass["kit"] = kit;

                List<Dictionary<string, object>> resultExternal = icCtrl.execLibFunction($"AgenziaLib.{this._fico_conf.Value.nomeCliente}.elaboraTracciatiRecords", _pass) as List<Dictionary<string, object>>;
                var ptrQueueByCodice = _ptrList
    .GroupBy(p => p.Codice)
    .ToDictionary(
        g => g.Key!,
        g => new Queue<PromoTracciatiRecord>(g),
        StringComparer.OrdinalIgnoreCase
    );

                foreach (Dictionary<string, object> recPostElaborazione in resultExternal)
                {
                    string codSingooloInGruppoSgruppato = recPostElaborazione[keyCodiceRef].ToString()!;
                    //PromoTracciatiRecord ptr = _ptrList.FirstOrDefault(f => f.Codice == codSingooloInGruppoSgruppato)!;
                    if (!ptrQueueByCodice.TryGetValue(codSingooloInGruppoSgruppato, out var queue) || queue.Count == 0)
                    {
                        throw new Exception("Record tracciato non trovato per codice " + codSingooloInGruppoSgruppato);
                    }

                    PromoTracciatiRecord ptr = queue.Dequeue();
                    ptr.Dato = JsonConvert.SerializeObject(recPostElaborazione);
                    ptr.CodiceGruppo = nuovoCodiceGruppo;

                    var revArt = new ArticoloInRevisione();
                    revArt.recordInTracciato = recPostElaborazione;//JsonConvert.DeserializeObject<Dictionary<string, object>>(record.Dato)!;// as Dictionary<string, object>;
                    revArt.idRec = ptr.Id;
                    revList.Add(revArt);
                }


                var primarioRev = revList
    .FirstOrDefault(f =>
        f.recordInTracciato != null &&
        f.recordInTracciato.ContainsKey(keyXMLSelezione) &&
        Convert.ToByte(f.recordInTracciato[keyXMLSelezione]) == (byte)TipoSelezioneMenabo.Primaria);


                long idRecSchedaRef = primarioRev?.idRec ?? _ptrList.First().Id;

                await this.ctx2.SaveChangesAsync();
                await tx.CommitAsync();

                


                //_ = Utility.Selezionatore.selezioneAutomaticaRefInMenabo(revList, this.ctx2, this._fico_conf.Value.nomeCliente, this.path_external_lib, true);


                //var primarioArtRev = revList.Where(f => f.recordInTracciato!.ContainsKey(keyXMLSelezione) && (byte)f.recordInTracciato[keyXMLSelezione] == (byte)TipoSelezioneMenabo.Primaria).FirstOrDefault();
                //if (primarioArtRev == null)
                //{
                //    throw new Exception("Primario non trovato tra i codici inviati");
                //}
                //codicePrimario = primarioArtRev.recordInTracciato![keyCodiceRef] as string;
                //idRecPrimario = (int)primarioArtRev.idRec!;


                IActionResult? newGruppoRes = null;
                newGruppoRes = await getSchedaRef(nuovoCodiceGruppo, idLavorazione, idRecSchedaRef, true);
                ArticoloInRevisioneKitResult gruppoResult = new ArticoloInRevisioneKitResult();
                if (newGruppoRes is OkObjectResult && (newGruppoRes as OkObjectResult)!.Value is ArticoloInRevisioneKitResult)
                {
                    gruppoResult = ((newGruppoRes as OkObjectResult)!.Value as ArticoloInRevisioneKitResult)!;

                    if (gruppoResult == null || !gruppoResult.esito)
                    {
                        throw new Exception("Gruppo " + nuovoCodiceGruppo + " non trovato da LeggiTracciatiRecord");
                    }
                }
                else
                {
                    if (newGruppoRes is OkObjectResult && (newGruppoRes as OkObjectResult)!.Value is string)
                    {
                        throw new Exception((newGruppoRes as OkObjectResult)!.Value as string);
                    }
                    else
                    {
                        throw new Exception("Errore nel tentativo di leggere il risultato di LeggiTracciatiRecord");
                    }
                }
                Dictionary<string, object> res = new Dictionary<string, object>();
                //var primario = gruppoResult.records.Where(f => (Byte)f.recordInTracciato[GLOBAL_VARIABLES.keyXMLSelezione] == (Byte)TipoSelezioneMenabo.Primaria).FirstOrDefault();
                var primario = gruppoResult.records
    .FirstOrDefault(f =>
        f.recordInTracciato != null &&
        f.recordInTracciato.ContainsKey(GLOBAL_VARIABLES.keyXMLSelezione) &&
        Convert.ToByte(f.recordInTracciato[GLOBAL_VARIABLES.keyXMLSelezione]) == (byte)TipoSelezioneMenabo.Primaria
    );
                primario!.recordInTracciato[keyAllEtichette] = primario.allEtichette;
                primario.recordInTracciato[keyEtichetteVisual] = primario.etichetteVisual;
                primario.recordInTracciato[GLOBAL_VARIABLES.keyRefIdRec] = primario.IdRec;

                long idRecPrimario = primario.IdRec; // o cast/convert se serve

                string codicePrimario = primario.recordInTracciato[keyCodiceRef].ToString()!;

                PromoLavorazioniRecord recToAdd = new PromoLavorazioniRecord();
                recToAdd.Codice = codicePrimario;
                recToAdd.CodiceGruppo = nuovoCodiceGruppo;
                recToAdd.IdRecordTracciato = idRecPrimario;
                recToAdd.IdLavorazione = idLavorazione;
                recToAdd.Pagina = (byte)paginaPrimoElemento;
                recToAdd.Indice = (Byte)0;
                recToAdd.IdAutore = id_utente;
                recToAdd.RegisterDate = DateTime.Now;
                this.ctx2.PromoLavorazioniRecords.Add(recToAdd);

                this.ctx2.SaveChanges();


                var resLista = OttieniListaImpaginazione(gruppoResult.records);
                if (!resLista.esito)
                {
                    throw new Exception(resLista.error);
                }

                //result.listaGruppi.AddRange(resLista.listaGruppi);
                result.gruppo = resLista.listaGruppi.FirstOrDefault()!;


                var register = new Register(_config.GetConnectionString("IstandaConnectionDb")!, this._dbContextFactory, dbContextFactory2: this._dbContextFactory2);
                if (idOperazione == 0)
                {
                    //l'operazione è stata autorizzata per cui procediamo a creare l'operazione sul DB
                    var nuovaOperazione = new RegistroOperazioni();
                    nuovaOperazione.Area = "";
                    nuovaOperazione.Canale = "";
                    nuovaOperazione.Stato = (byte)statoOperazioni.risolta;
                    nuovaOperazione.Autore = int.Parse(session);
                    nuovaOperazione.TipoOperazione = (byte)tipoOperazione.gruppa;
                    nuovaOperazione.IdTracciato = idTracciato;
                    nuovaOperazione.CodiceAssociato = nuovoCodiceGruppo;
                    nuovaOperazione.FormData = JsonConvert.SerializeObject(gruppi);
                    nuovaOperazione.Url = "Menabo/Raggruppa";
                    nuovaOperazione.idPromoLavorazione = idLavorazione;
                    register.addOperazione(nuovaOperazione, true, session, DateTime.Now);
                }
                else
                {
                    register.updateOperazione(idOperazione, statoOperazioni.risolta, session);
                }

                result.esito = true;

            }
            catch (Exception ex)
            {
                result.esito = false;
                result.error = ex.ToString();
                //result.listaGruppi.Clear();
                result.gruppo = new Dictionary<string, object>();
                return Ok(result);
            }
            return Ok(result);
        }

        private PromoLavorazioniRecord? GetLavorazioneRecordConFratelli(
            string codiceGruppo,
            long idRec,
            int idLavorazione,
            out PromoTracciatiRecord? recordTarget)
        {
            recordTarget = null;

            var candidati = this.ctx2.PromoLavorazioniRecords
                .Include(i => i.IdPromoLavorazioniNavigation)
                .Include(i=> i.IdPromoTracciatiRecordNavigation)
                .Where(f =>
                    f.CodiceGruppo == codiceGruppo &&
                    f.IdLavorazione == idLavorazione)
                .ToList();

            if (idRec <= 0)
            {
                return candidati.FirstOrDefault();
            }

            recordTarget = this.ctx2.PromoTracciatiRecords
                .AsNoTracking()
                .FirstOrDefault(r => r.Id == idRec);

            if (recordTarget == null)
            {
                throw new Exception("Record tracciato con idRec " + idRec + " non trovato");
            }

            var matchEsatto = candidati.FirstOrDefault(c => c.IdRecordTracciato == idRec);

            if (matchEsatto != null)
                return matchEsatto;

            if (candidati.Count == 0)
                return null;

            var target = recordTarget; // copia locale per evitare CS1628

            var idsCandidati = candidati
                .Select(c => c.IdRecordTracciato)
                .Distinct()
                .ToList();

            var recordsCandidati = this.ctx2.PromoTracciatiRecords
                .AsNoTracking()
                .Where(r => idsCandidati.Contains(r.Id))
                .Select(r => new
                {
                    r.Id,
                    r.IdTracciato,
                    r.CodiceGruppo,
                    r.Label,
                    r.Versione
                })
                .ToList();

            var fratello = recordsCandidati.FirstOrDefault(r =>
                r.IdTracciato == target.IdTracciato &&
                r.Versione == target.Versione &&
                r.Label == target.Label &&
                string.Equals(r.CodiceGruppo, target.CodiceGruppo, StringComparison.OrdinalIgnoreCase)
            );

            if (fratello == null)
                return null;

            return candidati.FirstOrDefault(c => c.IdRecordTracciato == fratello.Id);
        }

        private List<PromoTracciatiRecord> GetRecordsGruppoDaRaggruppare(
    string codiceGruppo,
    int idTracciato,
    PromoTracciatiRecord? recordTarget)
        {
            var query = this.ctx2.PromoTracciatiRecords
                .Where(f =>
                    f.CodiceGruppo == codiceGruppo &&
                    f.IdTracciato == idTracciato);

            if (recordTarget != null &&
                string.Equals(recordTarget.CodiceGruppo, codiceGruppo, StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(f =>
                    f.Label == recordTarget.Label &&
                    f.Versione == recordTarget.Versione);
            }

            return query.ToList();
        }

        [HttpPut]
        [Route("Menabo/setArtwork/{idLavorazione}/{idOperazione}")]
        public async Task<IActionResult> setArtwork([FromForm] ArtworkRequest obj, int idLavorazione, int idOperazione)
        {
            BoolResult bRes = new BoolResult();

            try
            {
                string[] mainParts = obj.Id!.Split('_');
                if (mainParts.Length != 2)
                {
                    throw new Exception("Formato ID ARTWORK non corretto");
                }

                string idArtwork = mainParts[1];
                string[] gruppiInArtwork = idArtwork.Split(new string[] { "-" }, StringSplitOptions.RemoveEmptyEntries);

                if (gruppiInArtwork.Length <= 0)
                {
                    throw new Exception("Nessun elemento nell'artwork");
                }

                string report = "";
                foreach (string codGruppo in gruppiInArtwork)
                {

                    var lavorazioniMatch = this.ctx2.PromoLavorazioniRecords
    .Where(plr =>
        plr.IdLavorazione == idLavorazione &&
        plr.CodiceGruppo == codGruppo)
    .Select(plr => plr.IdRecordTracciato)
    .Distinct()
    .ToList();

                    if (lavorazioniMatch.Count == 0)
                    {
                        throw new Exception($"Nessun elemento trovato per artwork, codice gruppo {codGruppo}");
                    }

                    if (lavorazioniMatch.Count > 1)
                    {
                        throw new Exception(
                            $"Artwork non applicabile: il codice gruppo {codGruppo} è duplicato nella lavorazione. " +
                            "Operazione bloccata perché setArtwork non usa idRec."
                        );
                    }

                    CambioMetaRecordTracciatoRequest req = new CambioMetaRecordTracciatoRequest();
                    req.codiceGruppo = codGruppo;
                    req.azioni = new List<CambioMetaRecordTracciatoAzioneRequest>();

                    CambioMetaRecordTracciatoAzioneRequest azione = new CambioMetaRecordTracciatoAzioneRequest();
                    azione.attributi = new Dictionary<string, string>();
                    azione.attributi.Add(GLOBAL_VARIABLES.keyArtwork, obj.delete ? "" : obj.Id);
                    azione.attributi.Add(GLOBAL_VARIABLES.keyArtworkFoto, obj.delete ? "" : obj.FotoId);

                    req.azioni.Add(azione);
                    report += "-cambio DATO artworkId of" + codGruppo + "\n";

                    var op = await cambioMetaRecordInLavorazione(req, idLavorazione, idOperazione);
                    if (op is OkObjectResult && (op as OkObjectResult)!.Value is CambioMetaRecordTracciatoResponse)
                    {
                        CambioMetaRecordTracciatoResponse result = ((op as OkObjectResult)!.Value as CambioMetaRecordTracciatoResponse)!;
                        if (!result.esito)
                        {
                            throw new Exception("Esito negativo dell'operazione. Attenzione adesso il dato può essere compromesso: Report: " + report);
                        }
                    }
                    else
                    {
                        throw new Exception("Operazione fallita. Attenzione adesso il dato può essere compromesso: Report: " + report);

                    }
                }


                bRes.Esito = true;
            }
            catch (Exception ex)
            {
                bRes.Esito = false;
                bRes.error = ex.ToString();
            }

            return Ok(bRes);

        }

        [HttpPut]
        [Route("Menabo/setCambioStrutturale/{idLavorazione}/{idOperazione}")]
        public async Task<IActionResult> setCambioStrutturale([FromForm] CambioMetaRecordTracciatoRequest obj, int idLavorazione, int idOperazione)
        {
            CambioStrutturaleResponse result = new CambioStrutturaleResponse();
            try
            {
                string report = "";


                var op = await cambioMetaRecordInLavorazione(obj, idLavorazione, idOperazione);
                if (op is OkObjectResult && (op as OkObjectResult)!.Value is CambioMetaRecordTracciatoResponse)
                {
                    CambioMetaRecordTracciatoResponse resultSet = ((op as OkObjectResult)!.Value as CambioMetaRecordTracciatoResponse)!;
                    if (!resultSet!.esito)
                    {
                        throw new Exception("Esito negativo dell'operazione. Attenzione adesso il dato può essere compromesso: Error:" + resultSet.error + " Report: " + report);
                    }
                    else
                    {
                        //Scarico scheda e dati per impaginazione
                        Console.WriteLine("setCambioStrutturale -> getSchedaRef post modifica");
                        IActionResult? schedaRef = null;
                        schedaRef = await getSchedaRef(obj.codiceGruppo!, idLavorazione, obj.idRec);
                        ArticoloInRevisioneKitResult schedaRefResult = new ArticoloInRevisioneKitResult();
                        if (schedaRef is OkObjectResult && (schedaRef as OkObjectResult)!.Value is ArticoloInRevisioneKitResult)
                        {
                            schedaRefResult = ((schedaRef as OkObjectResult)!.Value as ArticoloInRevisioneKitResult)!;

                            if (schedaRefResult == null || !schedaRefResult.esito)
                            {
                                throw new Exception("Gruppo " + obj.codiceGruppo + " non trovato da getSchedaRef");
                            }

                        }
                        else
                        {
                            if (schedaRef is OkObjectResult && (schedaRef as OkObjectResult)!.Value is string)
                            {
                                throw new Exception((schedaRef as OkObjectResult)!.Value as string);
                            }
                            else
                            {
                                throw new Exception("Errore nel tentativo di leggere il risultato di getSchedaRef");
                            }
                        }

                        if(schedaRefResult.records.Count == 0)
                        {
                            //il record è andato fuori volantino
                            ListaGruppiRaggruppamento gruppoDaRimuovere = new ListaGruppiRaggruppamento();
                            gruppoDaRimuovere.ListaCodici = new List<string>();
                            gruppoDaRimuovere.ListaCodici.Add(obj.codiceGruppo);
                            await rimuoviRefImpaginata(idLavorazione, false, gruppoDaRimuovere);   // era senza await: la rimozione poteva non essere conclusa alla risposta
                            result.item = null;
                            return Ok(result);
                        }

                        string keyAllEtichette = GLOBAL_VARIABLES.allEtichette;
                        string keyEtichetteVisual = GLOBAL_VARIABLES.etichetteVisual;

                        Console.WriteLine("setCambioStrutturale -> preparazione recInTrac");

                        Dictionary<string, object> res = new Dictionary<string, object>();
                        var primario = schedaRefResult.records.Where(f => Convert.ToByte(f.recordInTracciato[GLOBAL_VARIABLES.keyXMLSelezione]) == (Byte)TipoSelezioneMenabo.Primaria).FirstOrDefault();
                        primario!.recordInTracciato[keyAllEtichette] = primario.allEtichette;
                        primario.recordInTracciato[keyEtichetteVisual] = primario.etichetteVisual;
                        primario.recordInTracciato[GLOBAL_VARIABLES.keyRefIdRec] = primario.IdRec;

                        Console.WriteLine("setCambioStrutturale -> preparato recInTrac");

                        var resLista = OttieniListaImpaginazione(schedaRefResult.records);
                        
                        Console.WriteLine("Ottenuta lista di impaginazione");

                        if (!resLista.esito)
                        {
                            throw new Exception(resLista.error);
                        }

                        //result.listaGruppi.AddRange(resLista.listaGruppi);
                        result.item = resLista.listaGruppi.FirstOrDefault()!;
                    }
                }
                else
                {
                    throw new Exception("Operazione fallita. Attenzione adesso il dato può essere compromesso: Report: " + report);

                }

            }
            catch (Exception ex)
            {
                Console.WriteLine("setCambioStrutturale error -> " + ex.StackTrace.ToString());
                result.esito = false;
                result.error = ex.ToString();
            }

            return Ok(result);
        }


        [HttpPut]
        [Route("Menabo/cambiaMetaRecordInLavorazione/{idLavorazione}/{idOperazione}")]
        public async Task<IActionResult> cambioMetaRecordInLavorazione([FromForm] CambioMetaRecordTracciatoRequest obj, int idLavorazione, int idOperazione)
        {
            System.Globalization.CultureInfo culture = new System.Globalization.CultureInfo("it-IT");

            LogAssistent lAss = new LogAssistent();

            CambioMetaRecordTracciatoResponse result = new CambioMetaRecordTracciatoResponse();
            string keyAllEtichette = GLOBAL_VARIABLES.allEtichette;
            string keyEtichetteVisual = GLOBAL_VARIABLES.etichetteVisual;
            var session = SessionIstantaObject.GetSession(HttpContext);
            Int16 id_utente = Int16.Parse(session);
            try
            {

                string key_codice_gruppo = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppo;
                string keyCodiceRef = Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice;

                List<string> codiciSingoli = new List<string>();

                IstantaController icCtrl = new IstantaController("", this.path_external_lib, this.path_external_source, this._dbContextFactory);
                //PromoLavorazioniRecord? plr = this.ctx2.PromoLavorazioniRecords.Include(i => i.IdPromoTracciatiRecordNavigation).FirstOrDefault(f => f.IdLavorazione == idLavorazione && f.CodiceGruppo == obj.codiceGruppo);

                //if (plr == null)
                //{
                //    throw new Exception("Record lavorazione no trovato per il codice " + obj.codiceGruppo);
                //}

                PromoTracciatiRecord? recordTarget;

                PromoLavorazioniRecord? plr = GetLavorazioneRecordConFratelli(
                    obj.codiceGruppo!,
                    obj.idRec,
                    idLavorazione,
                    out recordTarget
                );

                if (plr == null)
                {
                    throw new Exception("Record lavorazione non trovato per il codice " + obj.codiceGruppo);
                }

                //int id_tracciato = plr.IdPromoTracciatiRecordNavigation.IdTracciato;
                int id_tracciato = recordTarget != null
                    ? recordTarget.IdTracciato
                    : this.ctx2.PromoTracciatiRecords
                        .Where(r => r.Id == plr.IdRecordTracciato)
                        .Select(r => r.IdTracciato)
                        .FirstOrDefault();

                if (id_tracciato == 0)
                {
                    throw new Exception("Record con id " + plr.IdRecordTracciato + " non trovato in PromoTracciatiRecords");
                }

                //Scarico addestramento con cui è stato caricato questo record
                AddestramentoExcel? adItem = this.ctx2.AddestramentoExcels.Include(i2 => i2.SchemaCampiExcels)
                    .FirstOrDefault(a => a.Id == (plr.IdPromoTracciatiRecordNavigation.IdAddestramento.HasValue ? plr.IdPromoTracciatiRecordNavigation.IdAddestramento.Value : 0));

                //List<PromoTracciatiRecord> ptrList = this.ctx2.PromoTracciatiRecords.Where(pt => pt.IdTracciato == id_tracciato && pt.CodiceGruppo == obj.codiceGruppo).ToList();
                List<PromoTracciatiRecord> ptrList = GetRecordsGruppoDaRaggruppare(
    obj.codiceGruppo!,
    id_tracciato,
    recordTarget
);
                //lAss.WriteLine($"Azione di cambio strutturale {obj.azioni!.Count}");

                foreach (CambioMetaRecordTracciatoAzioneRequest act in obj.azioni)
                {
                    Dictionary<string, string> attributi = act.attributi;

                    //Voglio clonare ptrList in ptrList_Act
                    List<PromoTracciatiRecord> ptrList_Act = ptrList;

                    if (act.codice != null && act.codice != "")
                    {
                        //Filtro per singola ref
                        //ptrList_Act = new List<PromoTracciatiRecord>();
                        ptrList_Act = ptrList
    .Where(f => string.Equals(f.Codice, act.codice, StringComparison.OrdinalIgnoreCase))
    .ToList();

                        if (ptrList_Act.Count == 0)
                        {
                            throw new Exception($"Record {act.codice} non trovato nel gruppo {obj.codiceGruppo}");
                        }
                        //ptrList_Act.Add(ptrList.FirstOrDefault(f => f.Codice == act.codice)!);
                    }
                    else if (act.codiceSottoGruppo != null && act.codiceSottoGruppo != "")
                    {
                        //string[] codiciSottogruppo = act.codiceSottoGruppo.Split(',');
                        //Filtro per sottogruppo
                        //ptrList_Act = new List<PromoTracciatiRecord>();
                        var codiciSottogruppo = act.codiceSottoGruppo
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
    .ToHashSet(StringComparer.OrdinalIgnoreCase);

                        ptrList_Act = ptrList
                            .Where(f => f.Codice != null && codiciSottogruppo.Contains(f.Codice))
                            .ToList();

                        if (ptrList_Act.Count == 0)
                        {
                            throw new Exception($"Sottogruppo {act.codiceSottoGruppo} non trovato nel gruppo {obj.codiceGruppo}");
                        }
                        //ptrList_Act.AddRange(ptrList.Where(f => codiciSottogruppo.Contains(f.Codice)));
                    }

                    foreach (PromoTracciatiRecord ptr in ptrList_Act)
                    {
                        
                        //lAss.WriteLine($">>>>>>>>>>>Cambio strtturale per {ptr.Codice}");

                        Dictionary<string, object> metaRef = Utility.Main.getJsonObject(ptr.Dato!)!;
                        Dictionary<string, object> alterazioniObj = new Dictionary<string, object>();

                        if (metaRef.ContainsKey(GLOBAL_VARIABLES.keyAlterazioni))
                        {

                            var objUndefined = metaRef[GLOBAL_VARIABLES.keyAlterazioni];
                            //lAss.WriteLine($"Ricostruisco l'alerazione {objUndefined}");

                            JObject objAlterazione = (metaRef[GLOBAL_VARIABLES.keyAlterazioni] as JObject)!;
                            //lAss.WriteLine($"Traduco in Dict<obj.str>");
                            alterazioniObj = (objAlterazione.ToObject<Dictionary<string, object>>())!;
                        }



                        foreach (string k in attributi.Keys)
                        {
                            string kParsed = k.Replace("$", ".");

                            if (metaRef.ContainsKey(kParsed))
                            {
                                //Prima di sovrascrivere registro l'alterazione
                                if (!alterazioniObj.ContainsKey(kParsed))
                                {
                                    //lAss.WriteLine($"Sovrascrittura alterazione: {kParsed} -> {alterazioniObj[kParsed]}={metaRef[kParsed]}");
                                    alterazioniObj[kParsed] = metaRef[kParsed];
                                }
                                //La sovrascrivo solo SE il campo è presente
                            }
                            else
                            {
                                alterazioniObj[kParsed] = "";//Non esisteva alcun valore prima
                            }

                            //Attenzione al tipo
                            //Qui va fatto un controllo sul tipo di addestramento usato e quindi tipo di dato del campo specificato
                            SchemaCampiExcel? schemaCampoAddestramento = adItem!.SchemaCampiExcels.FirstOrDefault(af => af.NomeColonna == kParsed);
                            object? val = null;


                            if (schemaCampoAddestramento != null)
                            {
                                //lAss.WriteLine($"Campo addesteramento: {attributi[k]} -> {schemaCampoAddestramento.Id}");
                                val = icCtrl.parseAddesttramentoValue(attributi[k], schemaCampoAddestramento);
                                metaRef[kParsed] = val;// icCtrl.parseAddesttramentoValue(attributi[k], schemaCampoAddestramento);

                            }
                            else
                            {
                                //Se non lo trova lo tratta come stringa classica
                                //lAss.WriteLine($"Metto nuova chiave in alterazione: {kParsed}");

                                //if (attributi[kParsed] != null)
                                //{
                                //    metaRef[kParsed] = attributi[kParsed];
                                //    val = attributi[kParsed];

                                //}
                                //else
                                //{
                                //    metaRef[kParsed] = "";
                                //    val = "";
                                //}
                                if (attributi[k] != null)
                                {
                                    metaRef[kParsed] = attributi[k];
                                    val = attributi[k];
                                }
                                else
                                {
                                    metaRef[kParsed] = "";
                                    val = "";
                                }
                            }

                            //lAss.WriteLine($"[{ptr.Codice}].{kParsed}={val}");

                            //Sovrascirvo le alterazioni
                            metaRef[GLOBAL_VARIABLES.keyAlterazioni] = alterazioniObj;

                            //Controllo se il dato è derivato da Descizioni. Se è così devo fare anche la revisione
#warning VULNERABILITA'. Quello che avviene adesso sul controllo della chiave CORE Descirizoni per il processo di cambio strutturale NON è corretto e potrebbe portare a dele brutte sorprese. Quando torneremo a parlare DA PLUGIN del tratamento delle descrizioni regionali, dovrmeo fare un pensiero sull'esporre i parametri PESO e UM al pari dei campi descrittivi 1,2,3,4
                            if (kParsed.Split('.')[0] == "Descrizioni")
                            {
                                Articoli? artItem = this.ctx.Articolis.Include(inc => inc.ArticoliDescrizionis).FirstOrDefault(a => a.Codice == metaRef[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString());
                                if (artItem != null)
                                {
                                    ArticoliDescrizioni? artDescrItem = artItem.ArticoliDescrizionis!.OrderByDescending(o => o.DataUltimaRicezione).FirstOrDefault();
                                    if (artDescrItem != null)
                                    {
                                        string kSub = kParsed.Split('.')[1];

                                        if (kSub == "Um")
                                            artDescrItem.Um = val.ToString();
                                    }
                                }
                                this.ctx.SaveChanges();

                            }


                            //SAlvo  i nuovi meta
                            ptr.Dato = JsonConvert.SerializeObject(metaRef);
                        }

                        this.ctx2.SaveChanges();

                        var register = new Register(_config.GetConnectionString("IstandaConnectionDb")!, this._dbContextFactory, dbContextFactory2: this._dbContextFactory2);
                        if (idOperazione == 0)
                        {
                            //Console.WriteLine("Registro operazione");
                            //l'operazione è stata autorizzata per cui procediamo a creare l'operazione sul DB
                            var nuovaOperazione = new RegistroOperazioni();
                            nuovaOperazione.Area = "";
                            nuovaOperazione.Canale = "";
                            nuovaOperazione.Stato = (byte)statoOperazioni.risolta;
                            nuovaOperazione.Autore = int.Parse(session);
                            nuovaOperazione.TipoOperazione = (byte)tipoOperazione.cambioMeta;
                            nuovaOperazione.CodiceAssociato = obj.codiceGruppo;
                            nuovaOperazione.FormData = JsonConvert.SerializeObject(new { azioni = obj.azioni, recTracciatoVersion = ptr.Versione, recTracciaoId = ptr.Id });
                            //Vorrei serializzare un oggett dinamico                            
                            nuovaOperazione.Url = "CambioMetaRecordTracciatoRequest";
                            nuovaOperazione.IdTracciato = id_tracciato;
                            nuovaOperazione.idPromoLavorazione = idLavorazione;
                            nuovaOperazione.idPromoLavorazioniRecord = plr.Id;
                            register.addOperazione(nuovaOperazione, true, session, DateTime.Now);
                        }
                        else
                        {
                            register.updateOperazione(idOperazione, statoOperazioni.risolta, session);
                        }
                    }
                }

                result.esito = true;

            }
            catch (Exception ex)
            {
                Console.WriteLine(ex.StackTrace.ToString());
                result.esito = false;
                result.error = ex.ToString();
                return Ok(result);
            }
            return Ok(result);
        }


        [HttpPut]
        [Route("Menabo/rimuoviRefImpaginata/{idLavorazione}/{eliminaDaTracciato}")]
        public async Task<IActionResult> rimuoviRefImpaginata(
    int idLavorazione,
    bool eliminaDaTracciato,
    ListaGruppiRaggruppamento codiciGruppo)
        {
            BoolResult result = new BoolResult();

            try
            {
                var codiciDaRimuovere =
                    codiciGruppo.ListaCodiciConId != null && codiciGruppo.ListaCodiciConId.Count > 0
                        ? codiciGruppo.ListaCodiciConId
                            .Where(c => !string.IsNullOrWhiteSpace(c.codice))
                            .ToList()
                        : (codiciGruppo.ListaCodici ?? new List<string>())
                            .Where(c => !string.IsNullOrWhiteSpace(c))
                            .Select(c => new filtroCodici
                            {
                                codice = c,
                                idRec = 0
                            })
                            .ToList();

                if (codiciDaRimuovere.Count == 0)
                {
                    result.Esito = true;
                    return Ok(result);
                }

                PromoLavorazioni? plItem = this.ctx2.PromoLavorazionis
                    .FirstOrDefault(pl => pl.Id == idLavorazione);

                if (plItem == null)
                {
                    throw new Exception("Lavorazione " + idLavorazione + " non trovata");
                }

                FicoRuntimeKit? kit = JsonConvert.DeserializeObject<FicoRuntimeKit>(plItem.Meta!);

                Formato? objFormato = Utility.SingletonConfiguration.DBFORMATI!.source
                    .FirstOrDefault(w => w.guidID == kit!.guidFormato);

                if (objFormato == null)
                {
                    throw new Exception("Formato lavorazione non trovato");
                }

                if (ficoController == null)
                {
                    ficoController = new FicoProcessController(
                        _config,
                        _external_lib,
                        this._fico_conf,
                        _option_import,
                        this.httpClient,
                        _cache,
                        this._dbContextFactory,
                        null
                    , dbContextFactory2: this._dbContextFactory2);
                }

                var tracciati = eliminaDaTracciato
                    ? ficoController.getTracciatiFromIdkitLavorazione(idLavorazione)
                    : null;

                foreach (var codiceInput in codiciDaRimuovere)
                {
                    string codice = codiceInput.codice;
                    long idRec = codiceInput.idRec;

                    PromoTracciatiRecord? recordTarget;

                    var refImpaginata = GetLavorazioneRecordConFratelli(
                        codice,
                        idRec,
                        idLavorazione,
                        out recordTarget
                    );

                    if (refImpaginata == null)
                    {
                        result.error += "L'elemento " + codice + " non era già presente nell'impaginato ";
                    }
                    else
                    {
                        this.ctx2.PromoLavorazioniRecords.Remove(refImpaginata);
                    }

                    if (eliminaDaTracciato)
                    {
                        int idTracciato = 0;

                        if (recordTarget != null)
                        {
                            idTracciato = recordTarget.IdTracciato;
                        }
                        else
                        {
                            // Legacy: senza idRec mantieni il vecchio comportamento
                            idTracciato = getTracciatoByCodice(
                                tracciati!,
                                codice,
                                objFormato.tipo == TipoLavorazione.PoP
                            );

                            if (idTracciato == 0)
                            {
                                throw new Exception("Record trovato più volte all'interno della stessa promo, probabile errore di lista");
                            }
                        }

                        var records = GetRecordsGruppoDaRaggruppare(
                            codice,
                            idTracciato,
                            recordTarget
                        );

                        if (records.Count == 0)
                        {
                            throw new Exception("Nessun record tracciato trovato per il gruppo " + codice);
                        }

                        this.ctx2.PromoTracciatiRecords.RemoveRange(records);
                    }
                }

                await this.ctx2.SaveChangesAsync();

                result.Esito = true;
                return Ok(result);
            }
            catch (Exception ex)
            {
                result.Esito = false;
                result.error = ex.ToString();
                return Ok(result);
            }
        }

        [HttpPut]
        [Route("Menabo/ClonaRecordRicollegato/{idKitLavorazione}")]
        public async Task<IActionResult> ClonaRecordRicollegato([FromForm] string req, int idKitLavorazione)
        {
            BoolResult res = new BoolResult();
            try
            {
                richiestaClonazione? dati = JsonConvert.DeserializeObject<richiestaClonazione>(req);

                IstantaController icCtrl = new IstantaController(this._config.GetConnectionString("IstandaConnectionDb")!, this.path_external_lib, this.path_external_source, this._dbContextFactory);

                string key_codice_gruppo = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppo;
                string keyCodiceRef = Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice;
                string keyContextPromo = GLOBAL_VARIABLES.keyContextPromo;
                string keyContextTracciato = GLOBAL_VARIABLES.keyContextTracciato;

                var lavorazione = this.ctx2.PromoLavorazionis.Where(f => f.Id == idKitLavorazione).FirstOrDefault();
                if (lavorazione == null)
                {
                    throw new Exception("Impossibile procedere, lavorazione con Id " + idKitLavorazione + " non trovata");
                }

                FicoRuntimeKit? kit = JsonConvert.DeserializeObject<FicoRuntimeKit>(lavorazione.Meta!);
                var guidFormato = kit.guidFormato;

                if (ficoController == null)
                {
                    ficoController = new FicoProcessController(_config, _external_lib, this._fico_conf, _option_import, this.httpClient, _cache, this._dbContextFactory, null, dbContextFactory2: this._dbContextFactory2);
                }

                var tracciati = ficoController.getTracciatiFromIdkitLavorazione(idKitLavorazione);
                if (tracciati.Count > 1)
                {
                    throw new Exception("Impossibile procedere, il kit di lavorazione è associato a più tracciati");
                }

                if (tracciati.Count == 0)
                {
                    throw new Exception("Impossibile procedere, nessun tracciato associato al kit di lavorazione");
                }

                var idTracciato = tracciati[0];
                var tracciato = this.ctx2.PromoTracciatis.Include(f => f.IdPromoNavigation).Where(f => f.Id == idTracciato).FirstOrDefault();

                if (tracciato == null)
                {
                    throw new Exception("Impossibile procedere, nessun tracciato trovato con ID: " + idTracciato);
                }

                var recordVersioneMax = this.ctx2.PromoTracciatiRecords
  .Where(f => f.IdTracciato == idTracciato
              && f.Stato == (byte)StatoRecord.Attivo
              && f.Label == dati.label)
  .OrderByDescending(f => f.Versione)  // Ordina per versione in modo decrescente
  .FirstOrDefault();

                if (recordVersioneMax == null)
                {
                    throw new Exception("Impossibile procedere, non è stato trovato nessun record con la label " + dati.label);
                }

                var cultureInfo = new CultureInfo("it-IT");
                var numberFormatInfo = (NumberFormatInfo)cultureInfo.NumberFormat.Clone();
                numberFormatInfo.NumberDecimalSeparator = ".";


                List<Dictionary<string, object>> tracciatiRecord = new List<Dictionary<string, object>>();
                var listCodici = new List<string>();
                foreach (var meta in dati.meta)
                {
                    Dictionary<string, object>? tracciatoRecord = JsonConvert.DeserializeObject<Dictionary<string, object>>(meta);
                    tracciatiRecord.Add(tracciatoRecord);
                    var codiceSingolo = tracciatoRecord[keyCodiceRef].ToString();
                    listCodici.Add(codiceSingolo);

                    var singoloInTracciato = this.ctx2.PromoTracciatiRecords.Where(f => f.IdTracciato == idTracciato && f.Codice == codiceSingolo).FirstOrDefault();

                    if (singoloInTracciato != null)
                    {
                        throw new Exception("Impossibile procedere, il codice" + codiceSingolo+" che è stato cercato di clonare si trova già nel tracciato");
                    }
                }

                listCodici = listCodici.Order().ToList();
                var codiceGruppo =  string.Join(",", listCodici);

                foreach (var tracciatoRecord in tracciatiRecord)
                {


                    foreach (KeyValuePair<string, object> kvp in tracciatoRecord)
                    {

                        if (tracciatoRecord[kvp.Key] is bool)
                        {
                            if (bool.TryParse(tracciatoRecord[kvp.Key].ToString(), out bool boolResult))
                                tracciatoRecord[kvp.Key] = boolResult;
                            else
                                tracciatoRecord[kvp.Key] = default(bool);
                        }
                        else if (tracciatoRecord[kvp.Key] is int)
                        {
                            if (int.TryParse(tracciatoRecord[kvp.Key].ToString(), NumberStyles.Any, numberFormatInfo, out int intResult))
                                tracciatoRecord[kvp.Key] = intResult;
                            else
                                tracciatoRecord[kvp.Key] = default(int);
                        }
                        else if (tracciatoRecord[kvp.Key] is float)
                        {
                            if (float.TryParse(tracciatoRecord[kvp.Key].ToString(), NumberStyles.Any, numberFormatInfo, out float floatResult))
                                tracciatoRecord[kvp.Key] = floatResult;
                            else
                                tracciatoRecord[kvp.Key] = default(float);
                        }
                        else if (tracciatoRecord[kvp.Key] is decimal)
                        {
                            if (decimal.TryParse(tracciatoRecord[kvp.Key].ToString(), NumberStyles.Any, numberFormatInfo, out decimal decimalResult))
                                tracciatoRecord[kvp.Key] = decimalResult;
                            else
                                tracciatoRecord[kvp.Key] = default(decimal);
                        }
                        else if (tracciatoRecord[kvp.Key] is double)
                        {
                            if (double.TryParse(tracciatoRecord[kvp.Key].ToString(), NumberStyles.Any, numberFormatInfo, out double doubleResult))
                                tracciatoRecord[kvp.Key] = doubleResult;
                            else
                                tracciatoRecord[kvp.Key] = default(double);
                        }
                        else
                        {
                            tracciatoRecord[kvp.Key] = tracciatoRecord[kvp.Key]; // Assegna il valore così com'è se non è uno dei tipi specificati
                        }
                    }

                    AddestramentoExcel? adItem = this.ctx2.AddestramentoExcels.Include(i2 => i2.SchemaCampiExcels)
        .FirstOrDefault(a => a.Id == dati.idAddestramento);

                    //sottraiamo da tracciatoRecord tutte le chiavi che non troviamo nell'addestramento
                    List<string> chiaviDaRimuovere = new List<string>();
                    foreach (var key in tracciatoRecord.Keys)
                    {
                        var match = adItem.SchemaCampiExcels.Any(f => f.NomeColonna == key);
                        if (!match)
                        {
                            //chiave non trovata nell'addestramento
                            chiaviDaRimuovere.Add(key);
                        }
                    }

                    Dictionary<string, object> chiaviEliminate = new Dictionary<string, object>();

                    foreach (var key in chiaviDaRimuovere)
                    {
                        chiaviEliminate[key] = tracciatoRecord[key];
                        tracciatoRecord.Remove(key);
                    }

                    foreach (var schema_campo in adItem.SchemaCampiExcels)
                    {
                        var match = tracciatoRecord.Any(f => f.Key == schema_campo.NomeColonna);
                        if (!match && schema_campo.NomeColonna != null)
                        {
                            //chiave non trovata nel tracciatoRecord
                            tracciatoRecord[schema_campo.NomeColonna] = icCtrl.parseAddesttramentoValue("", schema_campo);
                        }
                    }


                    tracciatoRecord[key_codice_gruppo] = codiceGruppo;


                    Dictionary<string, object> objParams = new Dictionary<string, object>();
                    objParams.Add("origin", tracciatoRecord);

                    SampleKitDiDestinazioneClone data = new SampleKitDiDestinazioneClone();
                    data.codiceCanale = tracciato.Canale;
                    data.codiceArea = tracciato.Area;

                    var formato = SingletonConfiguration.DBFORMATI!.source.First(f => f.guidID == guidFormato);
                    data.codiceFormato = formato.codice;

                    data.idAddestramento = dati.idAddestramento;
                    data.label = dati.label;

                    Dictionary<string, object> sample = JsonConvert.DeserializeObject<Dictionary<string, object>>(recordVersioneMax.Dato);
                    data.sampleData = sample;


                    objParams.Add("sample", data);
                    objParams.Add("codiceBox", dati.codiceBox);
                    objParams.Add("chiaviEliminate", chiaviEliminate);

                    Dictionary<string, object> resultExternal = icCtrl.execLibFunction($"AgenziaLib.{this._fico_conf.Value.nomeCliente}.elaboraRecordDaClonare", objParams) as Dictionary<string, object>;

                    var ContextPromo = tracciato.IdPromoNavigation.Context;
                    resultExternal[keyContextPromo] = ContextPromo;
                    var ContextTracciato = tracciato.Context;
                    resultExternal[keyContextTracciato] = ContextTracciato;

                    string firma = Utility.Main.getFirmaTracciato(resultExternal);
                    resultExternal[Enum.GetName(AddestramentoRuoli.Tracciato) + "." + GLOBAL_VARIABLES.keyTracciatoFirma] = firma;

                    resultExternal[GLOBAL_VARIABLES_FICO.keyVersioneTracciato] = recordVersioneMax != null ? recordVersioneMax.Versione : (byte)0;
                    resultExternal[GLOBAL_VARIABLES_FICO.keyXlsxTracciato] = "Importato manualmente";                    


                    PromoTracciatiRecord newRecord = new PromoTracciatiRecord();
                    newRecord.Stato = (byte)StatoRecord.Attivo;
                    newRecord.IndiceLettura = 0;
                    newRecord.Label = dati.label;
                    newRecord.DaEsportare = null;
                    newRecord.Scatto = null;
                    newRecord.Codice = resultExternal[keyCodiceRef].ToString();
                    newRecord.CodiceGruppo = codiceGruppo;
                    newRecord.DataRegistrazione = DateTime.Now;
                    newRecord.IdTracciato = idTracciato;
                    newRecord.IndiceEsportazione = -1;
                    newRecord.ModalitaInserimento = (byte)ModalitaInserimento.Manuale;
                    newRecord.Versione = recordVersioneMax != null ? recordVersioneMax.Versione : (byte)0;
                    newRecord.Dato = JsonConvert.SerializeObject(resultExternal);
                    newRecord.IdAddestramento = dati.idAddestramento;
                    this.ctx2.PromoTracciatiRecords.Add(newRecord);

                }

                this.ctx2.SaveChanges();
                if (dati.pagina != 0)
                {
                    RichiestaImpaginazioneSingolo richiesta = new RichiestaImpaginazioneSingolo();
                    richiesta.codiceGruppo = codiceGruppo;
                    richiesta.idLavorazione = idKitLavorazione;
                    richiesta.pagina = dati.pagina;
                    richiesta.byPassBloccoGiaImpaginato = false;
                    IActionResult resImpSingolo = await impaginaSingolo(richiesta);
                    ArticoloInRevisioneKitResult? gruppoResult = null;
                    if (resImpSingolo is OkObjectResult && (resImpSingolo as OkObjectResult)!.Value is ArticoloInRevisioneKitResult)
                    {
                        gruppoResult = ((resImpSingolo as OkObjectResult)!.Value as ArticoloInRevisioneKitResult)!;

                        if (gruppoResult == null || !gruppoResult.esito)
                        {
                            throw new Exception("Gruppo " + richiesta.codiceGruppo + " non trovato da impaginaSingolo");
                        }
                    }
                    else
                    {
                        if (resImpSingolo is OkObjectResult && (resImpSingolo as OkObjectResult)!.Value is string)
                        {
                            throw new Exception((resImpSingolo as OkObjectResult)!.Value as string);
                        }
                        else
                        {
                            throw new Exception("Errore nel tentativo di leggere il risultato di impaginaSingolo");
                        }
                    }

                }

                res.Esito = true;
            }
            catch (Exception ex)
            {
                res.error = ex.ToString();
                res.Esito = false;
            }
            return Ok(res);
        }


        [HttpGet]
        [Route("Menabo/getCambioStrutturale")]
        public async Task<IActionResult> getCambioStrutturale()
        {
            IstantaController icCtrl = new IstantaController(this._config.GetConnectionString("IstandaConnectionDb")!, this.path_external_lib, this.path_external_source, this._dbContextFactory);

            List<CambioStrutturale> resultExternal = icCtrl.execLibFunction($"AgenziaLib.{this._fico_conf.Value.nomeCliente}.GetCambioStrutturalePath", new Dictionary<string, object>()) as List<CambioStrutturale>;

            return Ok(resultExternal);
        }

    }
}
