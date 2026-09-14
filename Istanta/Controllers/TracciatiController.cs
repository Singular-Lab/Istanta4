using DocumentFormat.OpenXml.Bibliography;
using DocumentFormat.OpenXml.Drawing;
using DocumentFormat.OpenXml.Math;
using DocumentFormat.OpenXml.Office2010.Excel;
using DocumentFormat.OpenXml.Office2013.Excel;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Spreadsheet;
using ExcelDataReader;
using Istanta.Models;
using Istanta.Models_2;
using Istanta.Utility;
using IstantaLib;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion.Internal;
using Microsoft.EntityFrameworkCore.ValueGeneration.Internal;
using Microsoft.Extensions.Options;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using SMBLibrary;
using SMBLibrary.Client;
using System;
using System.Collections.Generic;
using System.ComponentModel.Design.Serialization;
using System.Configuration;
using System.Globalization;
using System.Linq;
using System.Net;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Security.Cryptography.Xml;

namespace Istanta.Controllers
{    

	public class TracciatiController : Controller
    {
        private readonly ILogger<TracciatiController> _logger;
        private readonly string path_to_export="";
        private readonly string path_to_import = "";
        private readonly string path_external_lib = "";
        private readonly string path_external_source = "";
        private readonly edro21_dbContext ctx;
        private readonly Edro21_DbContext2 ctx2;
        private readonly string[] ext_pre_lavorazione;
        private readonly string[] ext_post_lavorazione;
        IConfiguration _config;
        private readonly IDbContextFactory<edro21_dbContext> _dbContextFactory;

        private readonly IDbContextFactory<Edro21_DbContext2> _dbContextFactory2;
        public TracciatiController(ILogger<TracciatiController> logger, IConfiguration configuration, IOptions<PathOperationExport> option_export, IOptions<PathOperationImport> option_import, IOptions<PathExternal> external_lib, IOptions<SyncOptions> sync_options, IDbContextFactory<edro21_dbContext> dbContextFactory, IDbContextFactory<Edro21_DbContext2> dbContextFactory2)
        {
            this._dbContextFactory2 = dbContextFactory2;
            this._dbContextFactory = dbContextFactory;
            this.ctx = this._dbContextFactory.CreateDbContext();
            //this.ctx = new edro21_dbContext(configuration.GetConnectionString("IstandaConnectionDb")!);
            this.ctx2 = this._dbContextFactory2.CreateDbContext();
            _logger = logger;

            _config = configuration;

            path_to_export = option_export.Value.path;
            path_to_import = option_import.Value.path;
            path_external_lib = external_lib.Value.pathLib;
            path_external_source = external_lib.Value.pathSource;

            ext_pre_lavorazione = sync_options.Value.extPreLavorazione!;
            ext_post_lavorazione = sync_options.Value.extPostLavorazione!;

            ViewData["jsGuid"] = Guid.NewGuid().ToString();
            ViewData["Title"] = "Home";

            /* 
            var _all = this.ctx2.PromoTracciatiRecords.ToList();
            foreach(PromoTracciatiRecord rec in _all)
            {
                Dictionary<string, object> _dato = JsonConvert.DeserializeObject<Dictionary<string, object>>(rec.Dato);
                string codGruppo =  _dato["Scatto." + GLOBAL_VARIABLES.keyScattoCodiceGruppo].ToString();
                rec.CodiceGruppo = codGruppo;
            }

            this.ctx2.SaveChanges();*/

            //Scrittura Composizioni da eredità Edro
            /*var mList = this.ctx.TipiMateriales.Select(s=>new PopMateriale { Id = s.Id, Codice=s.Codice, Nome=s.Nome, EreditaDa=0}).ToList();
            var cList = this.ctx.PopCategories.Select(s=>new PopCategoria { Id=s.Id, Nome=s.Nome}).ToList();
            var fList = this.ctx.PopFormatis.Select(s=>new PopFormato { Id=s.Id, Nome=s.Nome}).ToList();

            JObject o1 = JObject.Parse(System.IO.File.ReadAllText(this.path_external_source + "SourceAree.json"));
            DbAree areeDB = o1.ToObject<DbAree>();
            List<Aree> aree = areeDB.source;

            DbPopCombinazioni db = new DbPopCombinazioni();
            db.Materiali = mList;
            db.Formati = fList;
            db.Categorie = cList;
            db.Combinazioni = new List<PopCombinazione>();

            Dictionary<string, object> optionScheme = new Dictionary<string, object>();
            optionScheme.Add("dupFidelity", false);
            optionScheme.Add("nomeFidelity", "");
           
            foreach (PopCombinazioni item in this.ctx.PopCombinazionis.Where(c=>c.Selezionato))
            {
                var area = aree.Where(a => a.Id == item.IdArea).FirstOrDefault();
                if (area!=null)
                {
                    PopCombinazione comb = new PopCombinazione();
                    comb.IdFormato = item.IdFormato;
                    comb.IdMateriale = item.IdMateriale;
                    comb.IdCategoria = item.IdCategoria;
                    comb.IdArea = area.Id;
                    comb.Attivo = item.Selezionato;
                    comb.Options = optionScheme;
                    db.Combinazioni.Add(comb);
                }
            }

            db.optionsScheme = optionScheme;
            
            string jsonStr = JsonConvert.SerializeObject(db);
            using (StreamWriter sw = new StreamWriter("E:\\Dropbox\\Progetti\\Edro21\\Istanta\\Istanta\\Istanta\\wwwroot\\external_source\\SourceCombinazioniPoP.json"))
            {
                sw.WriteLine(jsonStr);
            }
            */

            //Fine scrittura            

        }

        public IActionResult Index()
        {
            //var session = ObjectExtension.GetSession(HttpContext);
            //if (session.ToLower() == "no session")
            //{
            //    return Redirect("/Login");
            //}

            this.Bind();

            //6639409

            DateTime dStart = DateTime.Now;

            /*
            //Scrittura Tipi materiale
            List<TipiMateriale> tmList = this.ctx.TipiMateriales.ToList();
            string jsonStr = JsonConvert.SerializeObject(tmList);
            using (StreamWriter sw = new StreamWriter("E:\\Dropbox\\Progetti\\Edro21\\Istanta\\Istanta\\Istanta\\wwwroot\\external_source\\SourceTipiMateriale.json"))
            {
                sw.WriteLine(jsonStr);
            }
            */

            //Fine scrittura



            return View();
        }

        public IActionResult Training()
        {
            //Scarico tutte le librerie e metodi associati
            /*JObject o2 = JObject.Parse(File.ReadAllText(this.path_external_source+"SourceOrdinamentoLista.json"));
            Dictionary<string, object> ordDB = o1.ToObject<DbOrdinamento>();
            List<Ordinamento> schemaOrd = ordDB.source;*/

            // Solo i .dll: la cartella puo' contenere anche altro (copie di backup,
            // e le versioni .br/.gz che dotnet publish genera per gli asset statici).
            // Caricarli come assembly produce BadImageFormatException.
            string[] libs = Directory.GetFiles(this.path_external_lib, "*.dll");

            List<AddestramentoExternalLibItem> _dbLibs = new List<AddestramentoExternalLibItem>();

            foreach(string lib in libs)
            {
                string nome_file_lib = new FileInfo(lib).Name.Replace(".dll","");
                Type[] tys;
                try
                {
                    var dll = Assembly.Load(System.IO.File.ReadAllBytes(lib));
                    tys = dll.GetTypes();
                }
                catch (Exception exLib)
                {
                    // libreria non caricabile: la salto invece di far fallire la pagina
                    Console.WriteLine($"Training: libreria ignorata {nome_file_lib}: {exLib.Message}");
                    continue;
                }
                foreach(Type ty in tys)
                {
                    MethodInfo[] mths = ty.GetMethods();
                    foreach (MethodInfo mth in mths)
                    {
                        //var ty = dll.GetType("DemoLib.Interpreter");
                        //var mth = ty!.GetMethod("isGruppo");
                        //var obj = Activator.CreateInstance(ty);
                        
                        var obj = new AddestramentoExternalLibItem() { File = ty.Namespace!, Metodo = mth.Name, Tipo = ty.Name };
                        _dbLibs.Add(obj);
                    }

                    
                }

            }
            ViewBag.listaLibsItem = _dbLibs;

            return View("Training");
        }


        private void Bind()
        {
            //ExternalSourceClass exSource = new ExternalSourceClass(this.path_external_source);

            //var _list = exSource.getMateriali();// this.ctx.TipiMateriales.ToList();
            //ViewBag.MaterialiVol = _list.Where(m => (m.Associazione! == (Byte)1 || m.Associazione! == (Byte)3)).ToList();
            //ViewBag.MaterialiPoP = _list.Where(m => (m.Associazione! == (Byte)2 || m.Associazione! == (Byte)3)).ToList();
            //ViewBag.MaterialiManifesto = _list.Where(m => m.Codice=="BB").ToList();

            

            //var _list_area = exSource.Exec("getAree");
            //if (_list_area is List<Aree>)
            //{
            //    ViewBag.ListaAree = _list_area;//.Select(s => s.FirstOrDefault()).ToList().OrderBy(ord => ord.IndiceCombo).ToList(); //getListaAree();
            //}

        }


        [HttpGet]
        [Route("Tracciati/GetTracciatiPromoByIdTracc/{idTracciato}")]
        public async Task<IActionResult> GetTracciatiPromoByIdTracc(int idTracciato)
        {
            try
            {
                PromoTracciati PromoTracciato = this.ctx2.PromoTracciatis.Where(f => f.Id == idTracciato).FirstOrDefault()!;
                if (PromoTracciato == null)
                {
                    throw new Exception("Tracciato non trovato nel database");
                }
                int idPromo = PromoTracciato.IdPromo;
                Promo item = this.ctx2.Promos.Include(f => f.PromoTracciatis).Where(i => i.Id == idPromo).FirstOrDefault()!;

                return Ok(item.PromoTracciatis);

            }
            catch (Exception ex)
            {
                string error = ex.Message;
                return Ok(error);
            }
            
        }



        [HttpGet]
        [Route("Tracciati/GetTracciatiPromo/{idPromo}")]
        public async Task<IActionResult> GetTracciatiPromo(int idPromo)
        {
            try
            {
                Promo item = this.ctx2.Promos.Include(f => f.PromoTracciatis).Where(i => i.Id == idPromo).FirstOrDefault()!;
                if (item == null)
                {
                    throw new Exception("Promo non trovata");
                }
                return Ok(item.PromoTracciatis);

            }
            catch (Exception ex)
            {
                string error = ex.Message;
                return Ok(error);
            }

        }

        

        #region Promozioni

        [HttpGet]
        [Route("Tracciati/getPromoAperte")]
        public async Task<IActionResult> getPromoAperte()
        {
            try
            {
                Console.WriteLine("getPromoAperte ask");
                DateTime dtCheck = DateTime.Now.AddDays(-1);
                var list = await this.ctx2.Promos.Include(i => i.PromoTracciatis).Include(i2 => i2.PromoImportazionis).Where(p => p.DataScadenza.HasValue && p.DataScadenza.Value >= dtCheck && p.Stato==(Byte)StatoPromo.Aperta).ToListAsync();
                return Ok(list);
            }
            catch(Exception ex)
            {
                ex.ToString();
                return Ok(ex.ToString());

            }
        }


        [HttpGet]
        [Route("Tracciati/getAreeDellaPromo/{idPromo}")]
        public async Task<IActionResult> getAreeDellaPromo(int idPromo)
        {
            List<Promo> result = new List<Promo>();

            try
            {
                var pList =  this.ctx2.PromoTracciatis.Where(p => p.IdPromo == idPromo).ToList();
                var aree = pList.GroupBy(g =>g.Area).Select(s=>s.Key!.ToString()).ToList(); //pList.GroupBy(g => Utility.Main.getJsonObject(g.Meta)[Enum.GetName(AddestramentoRuoli.Area) + "." + GLOBAL_VARIABLES.keyAreaCodice]).Select(s => s.Key.ToString()).ToList();


                return Ok(aree);
            }
            catch (Exception ex)
            {
                ex.ToString();
            }

            return Ok(result);
        }

        [HttpPut]
        [Route("Tracciati/creaPromo")]
        public async Task<IActionResult> creaPromo(Promo req)
        {
            BoolResult result = new BoolResult();

            try
            {

                if ((req.NomePromo==null || req.NomePromo=="") || !req.ValiditaDal.HasValue || !req.ValiditaAl.HasValue || !req.DataScadenza.HasValue)
                {
                    throw new Exception("Tutti i campi sono obbligatori");
                }
                else if (req.ValiditaDal.Value>req.ValiditaAl)
                {
                    throw new Exception("Data inizio superiore a data fine validità");
                }

                Promo item = new Promo();

                item.NomePromo = req.NomePromo;
                item.ValiditaDal = req.ValiditaDal.Value;
                item.ValiditaAl = req.ValiditaAl.Value;
                item.DataScadenza = req.DataScadenza.Value;
                item.DataRegistrazione = DateTime.Now;
                item.Stato = (Byte)StatoPromo.Aperta;

                this.ctx2.Add(item);
                await this.ctx2.SaveChangesAsync();

                result.Esito = true;

            }
            catch (Exception ex)
            {
                result.error = ex.ToString();
            }

            return Ok(result);
        }

        [HttpGet]
        [Route("Tracciati/getImportazioni/{id_promo}")]
        public async Task<IActionResult> getImportazioni(Int32 id_promo)
        {
            try
            {
                var res = await  this.ctx2.PromoImportazionis.Where(imp => imp.IdPromo == id_promo).ToListAsync();

                return Ok(res);

            }
            catch (Exception ex)
            {
                return Ok(ex.ToString());
            }
        }

        [HttpGet]
        [Route("Tracciati/getImportazioniPending/{id_promo}")]
        public async Task<IActionResult> getImportazioniPending(Int32 id_promo)
        {
            try
            {
                var res = await this.ctx2.PromoImportazionis.Where(
                    imp => imp.IdPromo == id_promo && 
                    imp.IdAttivita.HasValue).Select(s=>s.IdAttivita).ToListAsync();

                var result = await this.ctx.Attivita.Where(a => (a.Stato == (Byte)OperationStauts.InAttesaDiConfermaUtente || a.Stato == (Byte)OperationStauts.Esaminata || a.Stato==(Byte)OperationStauts.TerminataConErrori) && res.Contains(a.Id))
                    .ToListAsync();
                    
                 var resultMapped =result.Select(s => new
                    {
                        idPromo=id_promo,
                        id = s.Id,
                        titolo = s.Titolo,
                        label = JsonConvert.DeserializeObject<InputFormTracciato>(JsonConvert.DeserializeObject<OperationRequest>(s.Contract)!.Packet!.ToString()!)!.fields!["idLabel"].ToString()!
                    }).ToList();

                return Ok(resultMapped);

            }
            catch (Exception ex)
            {
                return Ok(ex.ToString());
            }
        }

        #endregion

        #region Training

        [HttpPut]
        [Route("Tracciati/CaricaAddestramento")]
        public async Task<IActionResult> CaricaAddestramento(InputFormAddestramento request)
        {
            BoolResult result = new BoolResult();

            if (request.file != null && request.file != String.Empty)
            {


                //Creo la sessione
                AddestramentoExcel addestramento = new AddestramentoExcel();
                addestramento.DataCaricamento = DateTime.Now;
                addestramento.FileAddestramento = request.filename;
                addestramento.Titolo = request.titolo;
                addestramento.salvaSuDb = true;

                this.ctx2.AddestramentoExcels.Add(addestramento);
                await this.ctx2.SaveChangesAsync();

                 
                string file_xls = path_to_import + request.filename;

                System.IO.FileInfo fi = new FileInfo(file_xls);
                if (fi.Extension != ".xls" && fi.Extension != ".xlsx")
                {
                    result.Esito = false;
                    result.errorCode = ErrorCodes.FormatoIncorretto;
                    result.error = "Formato del file non corretto";
                    return Ok(result);
                }


                try
                {
                    System.IO.File.WriteAllBytes(file_xls, Convert.FromBase64String(request.file.Substring(request.file.IndexOf(",") + 1)));

                    //Adesso leggo lo schema
                    bool headerIsFound = false;

                    System.Text.Encoding.RegisterProvider(System.Text.CodePagesEncodingProvider.Instance);

                    using (var stream = System.IO.File.Open(file_xls, FileMode.Open, FileAccess.Read))
                    {
                        using (var reader = ExcelReaderFactory.CreateReader(stream))
                        {
                            while (reader.Read() && !headerIsFound)
                            {
                                for (int c=0; c<reader.FieldCount; c++)
                                {
                                    object val =  reader.GetValue(c);
                                    if (val != null)
                                    {
                                        headerIsFound = true;
                                        val.ToString();
                                        
                                       /*CampoAddestramento campo = new CampoAddestramento();
                                       campo.indice = (Int16)i;
                                       campo.nome_colonna_originale = nome_colonna;
                                       campo.ordinamento = TipoOrdinamento.None;
                                       campo.tipo_valore = TipoValore.NonAssegnato;
                                       schema.campi.Add(campo);*/

                                       SchemaCampiExcel campoDB = new SchemaCampiExcel();
                                       campoDB.Indice = (Int16)c;
                                       campoDB.NomeColonnaOriginale = val.ToString()!;
                                        if (campoDB.NomeColonnaOriginale.Length>70)
                                        {
                                            campoDB.NomeColonnaOriginale = campoDB.NomeColonnaOriginale.Substring(0, 70);
                                        }
                                       campoDB.Ordinamento = (Byte)AddestramentoTipoOrdinamento.None;
                                       campoDB.TipoDato = (Byte)AddestramentoTipoValore.NonAssegnato;
                                       campoDB.IdAddestramento = addestramento.Id;
                                        campoDB.Ruolo = "0";
                                       this.ctx2.SchemaCampiExcels.Add(campoDB);
                                    
                                    }
                                    else
                                        break;

                                }
                            }
                        }
                    }

                    result.Esito = true;

                    await this.ctx2.SaveChangesAsync();

                    return Ok(addestramento);
                }
                catch (Exception ex)
                {
                    result.Esito = false;
                    result.errorCode = ErrorCodes.Generic;
                    result.error = ex.ToString();
                    //return Ok(result);
                }
            }


            return Ok(result);
        }

        [HttpPut]
        [Route("Tracciati/ProvaAddestramento")]
        public async Task<IActionResult> ProvaAddestramento(InputFormAddestramentoTest request)
        {
            BoolResult result = new BoolResult();

            if (request.file != null && request.file != String.Empty)
            {


                //Creo la sessione
                AddestramentoExcel? addestramento = await this.ctx2.AddestramentoExcels.Include(i=>i.SchemaCampiExcels).Where(a=>a.Id==request.idAddestramento).FirstOrDefaultAsync();
                List<SchemaCampiExcel> _campi = addestramento!.SchemaCampiExcels.ToList();

                string file_xls = path_to_import + request.filename;
               

                try
                {

                    //Simulazione Importazione
                    //Con parametri
                    Dictionary<string, object> req = new Dictionary<string, object>();
                    req.Add("tipo_materiale", "VOL");
                    req.Add("cmbCanaleArea", "-1");
                    //req.Add("cmbTipoTracciato", "1");
                    req.Add("idPromo", "1");

                    PromoImportazioni pImp = new PromoImportazioni();
                    pImp.DataCaricamento = DateTime.Now;
                    pImp.ParamsRequest = JsonConvert.SerializeObject(req);
                    pImp.IdPromo = 1;
                    pImp.IdAddestramento = addestramento.Id;
                    pImp.NomeFile = request.filename;
                    this.ctx2.Add(pImp);
                    this.ctx2.SaveChanges();



                    System.IO.File.WriteAllBytes(file_xls, Convert.FromBase64String(request.file.Substring(request.file.IndexOf(",") + 1)));

                    //Adesso leggo lo schema
                    bool headerIsFound = false;

                    List<Dictionary<string, object>> tracciato = new List<Dictionary<string, object>>();


                    JObject? o1 = JObject.Parse(System.IO.File.ReadAllText(this.path_external_source + "SourceAree.json"));
                    DbAree? areeDB = o1.ToObject<DbAree>();
                    List<Aree> aree = areeDB!.source;

                    IstantaController icCtrl = new IstantaController("","","", this._dbContextFactory);

                    List<Articoli> _articoli_cache = new List<Articoli>();

                    double media_processo_item = 0;
                    int count_items = 0;

                    string nome_colonna_scatto = "";

                    using (var stream = System.IO.File.Open(file_xls, FileMode.Open, FileAccess.Read))
                    {
                        using (var reader = ExcelReaderFactory.CreateReader(stream))
                        {
                            while (reader.Read())
                            {
                                DateTime inizio_processo_item = DateTime.Now;

                                Dictionary<string, object> rec = new Dictionary<string, object>();

                                int fieldRead = 0;

                                Articoli? artRecord = null;

                                for (int c = 0; c < reader.FieldCount; c++)
                                {
                                    object val = reader.GetValue(c);

                                    if (headerIsFound)
                                        val = "";

                                    if (val != null)
                                    {
                                        fieldRead++;

                                        if (!headerIsFound)
                                        {

                                        }
                                        else
                                        {
                                            SchemaCampiExcel schema_campo = _campi.Where(f => f.Indice == c).FirstOrDefault()!;

                                            if (schema_campo != null && schema_campo.NomeColonna != null)
                                            {
                                                //Analisi del nome della colonna
                                                string scope = "";
                                                string scope_chiave = "";
                                                if (schema_campo.NomeColonna.IndexOf(".") > 0)
                                                {
                                                    //Campo strutturale
                                                    string[] scopes = schema_campo.NomeColonna.Split('.');
                                                    scope = scopes[0];
                                                    scope_chiave = scopes[1];
                                                }


                                                string _val = "";
                                                if (!reader.IsDBNull(c))
                                                    _val = reader.GetValue(c).ToString()!;

                                                if (schema_campo.Ruolo == Enum.GetName(AddestramentoRuoli.Scatto))
                                                {
                                                    nome_colonna_scatto = schema_campo.NomeColonna;
                                                }

                                                if (scope == "")
                                                {
                                                    rec[schema_campo.NomeColonna] = icCtrl.parseAddesttramentoValue(_val, schema_campo);
                                                    /*
                                                    if (schema_campo.TipoDato == (Byte)AddestramentoTipoValore.Numerico)
                                                    {
                                                        Int32 _intVal = 0;
                                                        Int32.TryParse(_val, out _intVal);
                                                        rec[schema_campo.NomeColonna] = _intVal;
                                                    }
                                                    else if (schema_campo.TipoDato == (Byte)AddestramentoTipoValore.Decimale)
                                                    {
                                                        decimal _decVal = 0;
                                                        Decimal.TryParse(_val, out _decVal);
                                                        rec[schema_campo.NomeColonna] = _decVal;
                                                    }
                                                    else if (schema_campo.TipoDato == (Byte)AddestramentoTipoValore.Bool)
                                                    {
                                                        bool _boolVal = false;
                                                        Boolean.TryParse(_val, out _boolVal);
                                                        rec[schema_campo.NomeColonna] = _boolVal;
                                                    }
                                                    else if (schema_campo.TipoDato == (Byte)AddestramentoTipoValore.Data)
                                                    {
                                                        DateTime _dtVal = new DateTime(1900, 1, 1);
                                                        DateTime.TryParse(_val, out _dtVal);
                                                        rec[schema_campo.NomeColonna] = _dtVal;
                                                    }
                                                    else
                                                    {
                                                        rec[schema_campo.NomeColonna] = _val;
                                                    }
                                                    */
                                                }
                                                else
                                                {
                                                    //Altro ragionamento, basato su unità logiche
                                                    if (scope == Enum.GetName(AddestramentoRuoli.Area))
                                                    {
                                                        if (scope_chiave == "Codice")
                                                        {
                                                            Aree aItem = aree.Where(a => a.Area == _val).FirstOrDefault()!;
                                                            var dict = new Dictionary<string, object>();
                                                            dict.Add("Codice", aItem!.Area);
                                                            dict.Add("Id", aItem!.Id);

                                                            rec["Area"] = dict;

                                                        }
                                                        else
                                                        {
                                                            if (rec["Area"] != null)
                                                            {
                                                                (rec["Area"] as Dictionary<string, object>)!.Add(scope_chiave, icCtrl.parseAddesttramentoValue(_val, schema_campo));
                                                            }
                                                        }

                                                        /*if (!rec.ContainsKey("Area"))
                                                            rec["Area"] = new Dictionary<string, object>();

                                                        (rec["Area"] as Dictionary<string, object>).Add(scope_chiave, _val);*/
                                                    }
                                                    else if (scope == Enum.GetName(AddestramentoRuoli.Referenza))
                                                    {

                                                        if (artRecord == null)
                                                        {
                                                            if (scope_chiave == "Codice")
                                                            {
                                                                artRecord = _articoli_cache.Where(ac => ac.Codice == _val).FirstOrDefault();
                                                                if (artRecord == null)
                                                                {
                                                                    artRecord = this.ctx.Articolis.Where(a => a.Codice == _val).FirstOrDefault();
                                                                    if (artRecord != null)
                                                                        _articoli_cache.Add(artRecord);
                                                                }
                                                            }
                                                            else if (scope_chiave == "Id")
                                                            {
                                                                artRecord = this.ctx.Articolis.Where(a => a.Id == Int64.Parse(_val)).FirstOrDefault();
                                                            }
                                                            else if (scope_chiave == "Ean")
                                                            {
                                                                artRecord = this.ctx.Articolis.Where(a => a.Ean == _val).FirstOrDefault();
                                                            }
                                                        }

                                                        if (artRecord != null)
                                                        {
                                                            string refJson = JsonConvert.SerializeObject(artRecord);
                                                            rec.Add(scope, JsonConvert.DeserializeObject<Dictionary<string, object>>(refJson)!);
                                                        }
                                                    }
                                                    else if (scope == Enum.GetName(AddestramentoRuoli.Descrizioni))
                                                    {
                                                        //if (!rec.ContainsKey(scope))
                                                        //{
                                                        //    rec.Add(scope, new Dictionary<string, object>());
                                                        //}

                                                        //(rec[scope] as Dictionary<string, object>).Add(scope_chiave, _val);
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    else if (headerIsFound)
                                    {
                                        //Valore nullo di un campo record effettivo
                                        //Non possiamo non caricarlo nel dictionary per cui ci va con valore vuoto
                                        SchemaCampiExcel schema_campo = _campi.Where(f => f.Indice == c).FirstOrDefault()!;
                                        if (schema_campo != null && schema_campo.NomeColonna != null)
                                            rec[schema_campo.NomeColonna] = "";

                                    }

                                }

                                if (headerIsFound)
                                {
                                    media_processo_item += DateTime.Now.Subtract(inizio_processo_item).TotalMilliseconds;

                                    count_items++;
                                    /*if (count_items >= 100)
                                    {
                                        break;
                                    }*/
                                }
                            
                                if (fieldRead > 0)
                                    headerIsFound = true;

                                if (rec.Keys.Count > 0)
                                    tracciato.Add(rec);

                            }
                        }
                    }

                    media_processo_item = media_processo_item / count_items;

                    if (addestramento.externalCallPerImport!=null)
                    {
                        string[] _p = addestramento.externalCallPerImport.Split('(');
                        string _func = _p[0];
                        string _params = _p[1].Replace(")","");

                        string[] _dllParams = _func.Split('.');
                        string _dllNamespace = _dllParams[0];
                        string _dllTipo = _dllParams[1];
                        string _dllMth = _dllParams[2];
                        
                        string dllFile = this.path_external_lib + _dllNamespace + ".dll";

                        var dll = Assembly.Load(System.IO.File.ReadAllBytes(dllFile));
                        var ty = dll.GetType(_dllNamespace+"."+_dllTipo);
                        var mth = ty!.GetMethod(_dllMth);
                        object? obj = Activator.CreateInstance(ty);

                        
                        ParameterInfo[] myParams = mth!.GetParameters();
                        object?[]? _objP = new object[myParams.Count()];
                        for(int po= 0; po < myParams.Count(); po++)
                        {
                            ParameterInfo pi = myParams[po];
                            if (pi.Name == "tracciato")
                                _objP[po] = tracciato;
                            else if (pi.Name == "formRequest")
                                _objP[po] = req;//req in questo caso è simulato sopra
                            else if (pi.Name!.IndexOf("path") == 0)
                            {
                                //Richiesta db source path
                                string sourceFile = pi.Name.Replace("path", "Source") + ".json";
                                _objP[po] = path_external_source + sourceFile;
                            }
                        }

                        object? objRes =  mth?.Invoke(obj!, _objP!);
                        string? resultExternal = objRes!.ToString();

                        
                        ImportResult? parsingRes = JsonConvert.DeserializeObject<ImportResult>(resultExternal!);
                        foreach (Dictionary<string, object> lista in parsingRes!.liste!)
                        {
                            var str1 = "Inserisco nel db " + lista["Area"].ToString();
                            object? str2 = lista["Records"];
                            Type _ty = str2.GetType();                            
                            var recs = (str2 as JArray)!.ToObject<List<Dictionary<string, object>>>();

                            PromoTracciati pTr = new PromoTracciati();
                            pTr.IdImportazione = pImp.Id;
                            lista.Remove("Records");
                            pTr.Meta = JsonConvert.SerializeObject(lista);
                            
                            this.ctx2.Add(pTr);
                            this.ctx2.SaveChanges();

                            foreach(Dictionary<string, object>? item in recs!)
                            {
                                PromoTracciatiRecord _rec = new PromoTracciatiRecord();
                                _rec.IdTracciato = pTr.Id;
                                _rec.IndiceLettura = 0;
                                _rec.IndiceEsportazione = 0;
                                if (nome_colonna_scatto!="")
                                {
                                    _rec.Scatto = item[nome_colonna_scatto].ToString();
                                }
                                _rec.Dato = JsonConvert.SerializeObject(item);
                                this.ctx2.Add(_rec);
                            }

                            this.ctx2.SaveChanges();

                        }
                        
                        "Fine".ToString();
                    }

                    result.Esito = true;
                }
                catch (Exception ex)
                {
                    result.Esito = false;
                    result.errorCode = ErrorCodes.Generic;
                    result.error = ex.ToString();
                    //return Ok(result);
                }
            }


            return Ok(result);
        }


        [HttpGet]
        [Route("Tracciati/getAddestramenti")]
        public async Task<IActionResult> getAddestramenti()
        {
            List<AddestramentoExcel> result = new List<AddestramentoExcel>();

            try
            {
                return Ok(await this.ctx2.AddestramentoExcels.Include(f=>f.SchemaCampiExcels).ToListAsync());
            }
            catch(Exception ex)
            {
                ex.ToString();
            }
           
            return Ok(result);
        }

        [HttpGet]
        [Route("Tracciati/getAddestramentoById/{id}")]
        public async Task<IActionResult> getAddestramentoById(int id)
        {
            List<AddestramentoExcel> result = new List<AddestramentoExcel>();

            try
            {
                
                return Ok(await this.ctx2.AddestramentoExcels.Include(i => i.SchemaCampiExcels).ThenInclude(i2=>i2.AddestramentoExcelRelazionis).Where(a=>a.Id==id).FirstOrDefaultAsync());
            }
            catch (Exception exSilenzioso)
            {
                _logger.LogWarning(exSilenzioso, "eccezione ingoiata in TracciatiController.cs riga ~907");

            }

            return Ok(result);
        }
        [HttpGet]
        [Route("Tracciati/getAddestramentoByIdRecordLavorazione/{idRecLavorazione}")]
        public async Task<IActionResult> getAddestramentoByIdRecordLavorazione(Int64 idRecLavorazione)
        {

            List<AddestramentoExcel> result = new List<AddestramentoExcel>();

            try
            {

                int idAdd = this.ctx2.PromoLavorazioniRecords.Include(i => i.IdPromoTracciatiRecordNavigation)
                    .FirstOrDefault(f => f.Id == idRecLavorazione)!.IdPromoTracciatiRecordNavigation!.IdAddestramento!.Value;

                return Ok(await this.ctx2.AddestramentoExcels.Include(i => i.SchemaCampiExcels).ThenInclude(i2 => i2.AddestramentoExcelRelazionis).Where(a => a.Id == idAdd).FirstOrDefaultAsync());
            }
            catch (Exception exSilenzioso)
            {
                _logger.LogWarning(exSilenzioso, "eccezione ingoiata in TracciatiController.cs riga ~929");

            }

            return Ok(result);
        }

        [HttpPut]
        [Route("Tracciati/salvaSchema")]
        public async Task<IActionResult> salvaSchema(AddestramentoExcel schema)
        {
            BoolResult result = new BoolResult();

            try
            {
                if (schema.Id > 0)
                {
                    var obj = await this.ctx2.AddestramentoExcels.FindAsync(schema.Id);
                    
                    if (obj != null)
                    {
                        if (schema.externalCallPerExport != null)
                        {
                            if (schema.externalCallPerExport != "null")
                                obj.externalCallPerExport = schema.externalCallPerExport;
                            else
                                obj.externalCallPerExport = null;
                        }
                        if (schema.externalCallPerImport != null)
                        {
                            if (schema.externalCallPerImport != "null")
                                obj.externalCallPerImport = schema.externalCallPerImport;
                            else
                                obj.externalCallPerImport = null;
                        }
                        if (schema.externalCallPerExportPoP !=null)
                        {
                            if (schema.externalCallPerExportPoP != "null")
                                obj.externalCallPerExportPoP = schema.externalCallPerExportPoP;
                            else
                                obj.externalCallPerExportPoP = null;
                        }

                        obj.esportaSubito = schema.esportaSubito;

                        this.ctx2.SaveChanges();
                    }
                    else
                    {
                        return NotFound();
                    }

                    this.ctx2.SaveChanges();

                    result.Esito = true;

                }
                else
                {
                    return NotFound();
                }

            }
            catch (Exception exSilenzioso)
            {
                _logger.LogWarning(exSilenzioso, "eccezione ingoiata in TracciatiController.cs riga ~993");

            }

            return Ok(result);
        }

        [HttpPut]
        [Route("Tracciati/salvaSchemaCampo")]
        public async Task<IActionResult> salvaSchemaCampo(SchemaCampiExcel schema)
        {
            BoolResult result = new BoolResult();

            try
            {
                if (schema.Id > 0)
                {
                    SchemaCampiExcel? obj = await this.ctx2.SchemaCampiExcels.FindAsync(schema.Id);
                    obj!.NomeColonna = schema.NomeColonna;
                    obj!.Ordinamento = schema.Ordinamento;
                    obj!.TipoDato = schema.TipoDato;
                    obj!.Ruolo = schema.Ruolo;
                }
                else
                {
                    //Il campo è nuovo
                    SchemaCampiExcel obj = new SchemaCampiExcel();
                    obj.NomeColonna = schema.NomeColonna;
                    obj.NomeColonnaOriginale = schema.NomeColonna!;
                    obj.Ordinamento = schema.Ordinamento;
                    obj.TipoDato = schema.TipoDato;
                    obj.Ruolo = schema.Ruolo;
                    obj.IdAddestramento = schema.IdAddestramento;

                    if (schema.AddestramentoExcelRelazionis.Count > 0)
                    {
                        //Ha una relazione con chiamata esterna
                        obj.Indice = -1;

                       this.ctx2.Add(obj);

                       var ext =   schema.AddestramentoExcelRelazionis.FirstOrDefault();
                       this.ctx2.SaveChanges();

                        AddestramentoExcelRelazioni rel = new AddestramentoExcelRelazioni();
                        rel = ext!;
                        rel.IdCampo = obj.Id;
                        rel.NomeRelazione = "";
                        this.ctx2.Add(rel);

                    }
                }


                this.ctx2.SaveChanges();

                result.Esito = true;

                return Ok(result);
            }
            catch (Exception exSilenzioso)
            {
                _logger.LogWarning(exSilenzioso, "eccezione ingoiata in TracciatiController.cs riga ~1054");

            }

            return Ok(result);
        }

        [HttpGet]
        [Route("Tracciati/eliminaSchemaCampo/{idCampo}")]
        public async Task<IActionResult> eliminaSchemaCampo(int idCampo)
        {
            BoolResult result = new BoolResult();

            try
            {

                var obj = await this.ctx2.SchemaCampiExcels.Include(i=>i.AddestramentoExcelRelazionis).Where(c=>c.Id==idCampo).FirstOrDefaultAsync();
                if (obj!=null)
                {
                    if (obj.Indice>=0)
                    {
                        throw new Exception("non_cancellabile");
                    }

                    if (obj.AddestramentoExcelRelazionis.Count>0)
                        this.ctx2.Remove(obj.AddestramentoExcelRelazionis.FirstOrDefault()!);
                    this.ctx2.Remove(obj);

                    this.ctx2.SaveChanges();
                    result.Esito = true;

                }
                else
                {
                    return NotFound();
                }
               

                this.ctx2.SaveChanges();

                result.Esito = true;

                return Ok(result);
            }
            catch(Exception ex)
            {
                result.error = ex.ToString();
            }

            return Ok(result);
        }

        [HttpGet]
        [Route("Tracciati/getLibItemInfo/{id}")]
        public async Task<IActionResult> getLibItemInfo(string id)
        {

            try
            {
                string[] _p = id.Split('.');
                string _file = _p[0];
                string _tipo = _p[1];
                string _mth = _p[2];

                string dllFile = _file + ".dll";

                var dll = Assembly.Load(System.IO.File.ReadAllBytes(this.path_external_lib + dllFile));
                var ty = dll.GetType(_file + "." + _tipo);
                var mth = ty!.GetMethod(_mth);

                AddestramentoExternalLibItem result = new AddestramentoExternalLibItem();
                result.Metodo = _mth;
                result.Tipo = _tipo;
                result.File = _file;

                result.Parameters = new Dictionary<int, string>();

                ParameterInfo[] myParams = mth!.GetParameters();
                foreach(ParameterInfo pi in myParams)
                {
                    result.Parameters.Add(pi.Position, pi.Name+ "<"+pi.ParameterType.Name+">");
                }

                //var obj = Activator.CreateInstance(ty);
                //ViewBag.test_reflaction = mth!.Invoke(obj, new object[] { "AVV" }).ToString();

                return Ok(result);
            }
            catch (Exception exSilenzioso)
            {
                _logger.LogWarning(exSilenzioso, "eccezione ingoiata in TracciatiController.cs riga ~1143");

            }

            return Ok();
        }

        [HttpPut]
        [Route("Tracciati/scriviRegolaMenabo/{remove}")]
        public async Task<IActionResult> scriviRegolaMenabo(listaSetRegole list, bool remove)
        {
            BoolResult res = new BoolResult();
            try
            {
                ExternalSourceClass exClass = new ExternalSourceClass(this.path_external_source, new string[] { "SourceMenabo" });
                var result = exClass.getRegoleMenabo();
                if (result.automatismo == null)
                {
                    result.automatismo = new List<listaSetRegole>();
                }
                if (remove)
                {
                    if (list.id == 0)
                    {
                        throw new Exception("Non è stato specificato l'id dell'elemento da eliminare");
                    }
                    else
                    {
                        var index = result.automatismo.FindIndex(x => x.id == list.id);
                        result.automatismo.RemoveAt(index);
                    }
                }
                else
                {
                    if (list.id == 0)
                    {
                        int newId = 1;
                        if (result.automatismo.Count > 0)
                        {
                            newId = result.automatismo.Max(x => x.id) + 1;
                        }
                        else
                        {
                            list.ordine = 1;
                        }
                        list.id = newId;
                        if (list.ordine == -1)
                        {
                            list.ordine = result.automatismo.Max(x => x.ordine) + 1;
                        }
                        else if (list.ordine != -1 && result.automatismo.Find(f=>f.ordine == list.ordine) != null)
                        {
                            List<listaSetRegole> altreRegoleConordinePariOSuperiore = result.automatismo.Where(f => f.ordine >= list.ordine).ToList();
                            foreach (var item in altreRegoleConordinePariOSuperiore)
                            {
                                item.ordine += 1;
                            }
                        }
                        result.automatismo.Add(list);
                    }
                    else
                    {
                        if (list.ordine == -1)
                        {
                            list.ordine = result.automatismo.Max(x => x.ordine) + 1;
                        }
                        else if (list.ordine != -1 && result.automatismo.Find(f => f.ordine == list.ordine) != null)
                        {
                            List<listaSetRegole> altreRegoleConordinePariOSuperiore = result.automatismo.Where(f => f.ordine >= list.ordine).ToList();
                            foreach (var item in altreRegoleConordinePariOSuperiore)
                            {
                                item.ordine += 1;
                            }
                        }
                        var index = result.automatismo.FindIndex(x => x.id == list.id);
                        result.automatismo[index] = list;
                    }
                }


                exClass.saveMenabo(result);
                res.Esito = true;
                res.error = "";
            }
            catch(Exception ex)
            {
                res.Esito = true;
                res.error = ex.Message;
            }

            return Ok(res);
        }

        [HttpGet]
        [Route("Tracciati/getRegoleMenaboByIdAddestramento/{idAddestramento}")]
        public async Task<IActionResult> getRegoleMenabo(int idAddestramento)
        {
            try
            {
                ExternalSourceClass exClass = new ExternalSourceClass(this.path_external_source, new string[] { "SourceMenabo" });
                var result = exClass.getRegoleMenabo();
                return Ok(result.automatismo.Where(x=>x.idAddestramento == idAddestramento));
            }
            catch(Exception ex)
            {
                return Ok(ex.Message);
            }
        }

        [HttpGet]
        [Route("Tracciati/getAllRegoleMenabo")]
        public async Task<IActionResult> getAllRegoleMenabo()
        {
            try
            {
                ExternalSourceClass exClass = new ExternalSourceClass(this.path_external_source, new string[] { "SourceMenabo" });
                var result = exClass.getRegoleMenabo();
                return Ok(result.automatismo);
            }
            catch (Exception ex)
            {
                return Ok(ex.Message);
            }
        }

        [HttpGet]
        [Route("Tracciati/getAllFormatiPaginaMenabo")]
        public async Task<IActionResult> getAllFormatiPaginaMenabo()
        {
            try
            {
                ExternalSourceClass exClass = new ExternalSourceClass(this.path_external_source, new string[] { "SourceMenabo" });
                var result = exClass.getFormatiPagina();
                return Ok(result);
            }
            catch (Exception ex)
            {
                return Ok(ex.Message);
            }
        }


        [HttpGet]
        [Route("Tracciati/getAllMeccaniche")]
        public async Task<IActionResult> getAllMeccaniche()
        {
            try
            {
                JObject oMecc = JObject.Parse(System.IO.File.ReadAllText(this.path_external_source + "SourceMeccaniche.json"));
                DbMeccaniche meccDB = oMecc.ToObject<DbMeccaniche>()!;
                return Ok(meccDB.source);
            }
            catch (Exception ex)
            {
                return Ok(ex.Message);
            }
        }

        #endregion

        #region Importazione Manuale

        [HttpGet]
        [Route("Tracciati/controllaIntegritaGruppo/{idTracciato}/{codGruppo}")]
        public async Task<IActionResult> controllaIntegritaGruppo(int idTracciato, string codGruppo)
        {
            BoolResult result = new BoolResult();
            try
            {
                var tracciati = controlloIntegrità(codGruppo, idTracciato);

                List<PromoTracciati> _promo_tracciati_esistenti = await ctx2.PromoTracciatis
                        .Include(f => f.PromoTracciatiRecords)
                        .Where(f => f.IdPromo == ctx2.PromoTracciatis.FirstOrDefault(t => t.Id == idTracciato)!.IdPromo)
                        .ToListAsync();
                if (_promo_tracciati_esistenti.Count == tracciati.Split(",").Count())
                {
                    result.error = "";
                    result.Esito = true;
                    return Ok(result);
                }
                string nomeTracciati = "";
                foreach (var trac in tracciati.Split(","))
                {
                    nomeTracciati += (await this.ctx2.PromoTracciatis
                        .Where(f => f.Id == int.Parse(trac))
                        .Select(f => f.Sigla)
                        .FirstOrDefaultAsync()) ?? "";
                    nomeTracciati += ", ";
                }
                nomeTracciati = nomeTracciati.Substring(0, nomeTracciati.Length - 2);
                result.error = nomeTracciati;
                result.Esito = true;
            }
            catch (Exception er)
            {
                result.error = er.Message;
                result.Esito = false;
            }

            return Ok(result);
        }

        public string controlloIntegrità(string codGruppo, int idTracciato)
        {
            string tracciatiDaModificare = "";
            bool isGruppo = codGruppo.IndexOf(",") != -1;
            List<PromoTracciati> _promo_tracciati_esistenti = ctx2.PromoTracciatis
                        .Include(f => f.PromoTracciatiRecords)
                        .Where(f => f.IdPromo == ctx2.PromoTracciatis.FirstOrDefault(t => t.Id == idTracciato)!.IdPromo)
                        .ToList();

            foreach (var tracc in _promo_tracciati_esistenti)
            {
                List<PromoTracciatiRecord> ultimaVersioneRecords = tracc.PromoTracciatiRecords
                        .GroupBy(r => r.Label) // Raggruppa per label
                        .SelectMany(g => g.Where(r => r.Versione == g.Max(r => r.Versione))) // Seleziona gli elementi con la versione massima in ogni gruppo
                        .ToList();
                bool gruppoPresente = false;
                gruppoPresente = ultimaVersioneRecords.Where(f => (isGruppo ? f.CodiceGruppo == codGruppo : f.Codice == codGruppo)).FirstOrDefault() != null;
                if (gruppoPresente)
                {
                    tracciatiDaModificare += tracc.Id + ",";
                }
            }
            if (!string.IsNullOrEmpty(tracciatiDaModificare))
            {
                tracciatiDaModificare = tracciatiDaModificare.Substring(0, tracciatiDaModificare.Length - 1);
            }
            return tracciatiDaModificare;
        }


        [HttpPut]
        [Route("Tracciati/importaManualmente/{idAddestramento}/{label}/{idTracciato}/{codGruppo}")]
        public async Task<IActionResult> importaManualmente(ArticoliManuali arts, int idAddestramento, string label, int idTracciato, string codGruppo)
        {
            AttivitaResult result = new AttivitaResult();

            try
            {
                string tracciatiInCuiOperare = "0";
                List<int> tracciatiDaModificare = new();

                if (codGruppo != "" && codGruppo != "0")
                {
                    tracciatiInCuiOperare = controlloIntegrità(codGruppo, idTracciato);
                    if (tracciatiInCuiOperare != "")
                    {
                        var tracciatiInCuiOperareList = tracciatiInCuiOperare.Split(",");
                        foreach (var tracc in tracciatiInCuiOperareList)
                        {
                            tracciatiDaModificare.Add(int.Parse(tracc));
                        }
                    }
                    else
                    {
                        tracciatiInCuiOperare = "0";
                    }
                }
                var addestramento = await this.ctx2.AddestramentoExcels.Include(i => i.SchemaCampiExcels).ThenInclude(i2 => i2.AddestramentoExcelRelazionis).Where(a => a.Id == idAddestramento).FirstOrDefaultAsync();
                List<SchemaCampiExcel> schema = new List<SchemaCampiExcel>();
                schema.AddRange(addestramento!.SchemaCampiExcels);
                //compongo il dictionary
                List<Dictionary<string, object>> Tracciati = new List<Dictionary<string, object>>();
                if (arts.listTracciato!.Count == 1 && codGruppo != "0" && codGruppo != "")
                {
                    var codici = codGruppo.Split(",");
                    foreach (string codice in codici)
                    {
                        var element = ctx2.PromoTracciatiRecords.Where(f => f.Codice == codice && f.IdTracciato == idTracciato).FirstOrDefault()!;
                        Tracciati.Add(IstantaJson.getJsonObject(element.Dato!));
                    }
                }
                foreach (var item in arts.listTracciato)
                {
                    Dictionary<string, object> recordInTracciato = new Dictionary<string, object>();
                    foreach (var campo in item)
                    {
                        var typeOfValue = schema.Find(f => f.NomeColonna == campo.Key)!.TipoDato;
                        if (typeOfValue != null && (int)typeOfValue != 0)
                        {
                            switch ((int)typeOfValue)
                            {
                                case (int)AddestramentoTipoValore.Stringa:
                                    if (campo.Value != null)
                                    {
                                        recordInTracciato.Add(campo.Key, campo.Value);
                                    }
                                    else
                                    {
                                        recordInTracciato.Add(campo.Key, "");
                                    }
                                    break;
                                case (int)AddestramentoTipoValore.Data:
                                    if (campo.Value != null)
                                    {
                                        DateTime dt_val = DateTime.MinValue;
                                        DateTime.TryParse(campo.Value, out dt_val);
                                        recordInTracciato.Add(campo.Key, dt_val);
                                    }
                                    else
                                    {
                                        recordInTracciato.Add(campo.Key, DateTime.MinValue);
                                    }
                                    break;
                                case (int)AddestramentoTipoValore.Decimale:
                                    if (campo.Value != null)
                                    {
                                        Decimal dc_val = 0;
                                        //string Value = campo.Value.Replace(',', '.');

                                        CultureInfo culture = CultureInfo.InvariantCulture;

                                        if (Decimal.TryParse(campo.Value, NumberStyles.AllowDecimalPoint, culture, out dc_val))
                                        {
                                            recordInTracciato.Add(campo.Key, dc_val);
                                        }
                                        else
                                        {
                                            throw new Exception("Errore durante la conversione del decimale per il campo" + campo.Key + "con il valore" + campo.Value);
                                        }
                                        //Decimal.TryParse(campo.Value, out dc_val);
                                        //recordInTracciato.Add(campo.Key, dc_val);
                                    }
                                    else
                                    {
                                        recordInTracciato.Add(campo.Key, 0);
                                    }
                                    break;
                                case (int)AddestramentoTipoValore.Numerico:
                                    if (campo.Value != null)
                                    {
                                        int num_val = 0;
                                        int.TryParse(campo.Value, out num_val);
                                        recordInTracciato.Add(campo.Key, num_val);
                                    }
                                    else
                                    {
                                        recordInTracciato.Add(campo.Key, 0);
                                    }
                                    break;
                                case (int)AddestramentoTipoValore.Bool:
                                    if (campo.Value != null)
                                    {
                                        bool bool_val = false;
                                        bool.TryParse(campo.Value, out bool_val);
                                        recordInTracciato.Add(campo.Key, bool_val);
                                    }
                                    else
                                    {
                                        recordInTracciato.Add(campo.Key, false);
                                    }
                                    break;
                            }
                        }
                    }
                    Tracciati.Add(recordInTracciato);
                }
                try
                {

                    IstantaController icCtrl = new IstantaController("", this.path_external_lib, this.path_external_source, this._dbContextFactory);
                    Dictionary<string, object> _pass = new Dictionary<string, object>();
                    _pass["tracciato"] = Tracciati;//List<Dictionary> da passargli con i nuovi articoli da integrare
                    _pass["formRequest"] = new Dictionary<string, string>();
                    string resultExternal = icCtrl.execLibFunction(addestramento.externalCallPerImport!, _pass).ToString()!;

                    ImportResult parsingRes = JsonConvert.DeserializeObject<ImportResult>(resultExternal!)!;
                    string areaKey = Enum.GetName(AddestramentoRuoli.Area)!;
                    string nome_colonna_scatto = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodice;
                    string nome_colonna_codGruppo = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppo;
                    string nome_ref = Enum.GetName(AddestramentoRuoli.Referenza)!;
                    string kRefCod = Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice;

                    string KFirma = Enum.GetName(AddestramentoRuoli.Tracciato) + "." + GLOBAL_VARIABLES.keyTracciatoFirma;

                    PromoTracciatiRecord rec;
                    foreach (Dictionary<string, object> lista in parsingRes.liste!)
                    {
                        List<PromoTracciati> _promo_tracciati_esistenti = await ctx2.PromoTracciatis
                        .Include(f => f.PromoTracciatiRecords)
                        .Where(f => f.IdPromo == ctx2.PromoTracciatis.FirstOrDefault(t => t.Id == idTracciato)!.IdPromo)
                        .ToListAsync();
                        //var str1 = "Inserisco nel db " + lista["Area"].ToString();

                        PromoTracciati pTr = _promo_tracciati_esistenti.Where(pt => Utility.Main.getJsonObject(pt.Meta!)![areaKey].ToString() == lista[areaKey].ToString()).FirstOrDefault()!;

                        if (!tracciatiDaModificare.Contains(pTr.Id) && tracciatiInCuiOperare != "0")
                        {
                            continue;
                        }

                        List<PromoTracciatiRecord> records = pTr.PromoTracciatiRecords.ToList();
                        List<PromoTracciatiRecord> ultimaVersioneRecords = pTr.PromoTracciatiRecords
                        .GroupBy(r => r.Label) // Raggruppa per label
                        .SelectMany(g => g.Where(r => r.Versione == g.Max(r => r.Versione))) // Seleziona gli elementi con la versione massima in ogni gruppo
                        .ToList();


                        byte? versioneTmp = ultimaVersioneRecords
                        .Where(f => f.Label == label)
                        .FirstOrDefault()?.Versione ?? 1;
                        byte versioneLab = (byte)versioneTmp;
                        var _recs = lista["Records"];
                        var recs = (_recs as JArray)!.ToObject<List<Dictionary<string, object>>>();
                        foreach (Dictionary<string, object> item in recs!)
                        {

                            PromoTracciatiRecord _rec = new PromoTracciatiRecord();
                            _rec.IdTracciato = pTr.Id;
                            _rec.IndiceLettura = 0;
                            _rec.IndiceEsportazione = 0;
                            _rec.Versione = versioneLab;
                            _rec.Label = label;
                            _rec.DataRegistrazione = DateTime.Now;
                            //_rec.SelezioneMenabo = (Byte)TipoSelezioneMenabo.None;
                            _rec.ModalitaInserimento = (Byte)ModalitaInserimento.Manuale;
                            _rec.Stato = (Byte)StatoRecord.Attivo;
                            if (item.ContainsKey(nome_colonna_scatto))
                            {
                                _rec.Scatto = item[nome_colonna_scatto].ToString();
                            }
                            if (item.ContainsKey(nome_colonna_codGruppo))
                            {
                                _rec.CodiceGruppo = item[nome_colonna_codGruppo].ToString();
                            }
                            if (item.ContainsKey(kRefCod))
                            {
                                _rec.Codice = item[kRefCod].ToString();
                            }
                            //controllo scatto
                            if (codGruppo == "0" || codGruppo == "")
                            {
                                var conflittoDiScatto = records.Find(f => f.Scatto == _rec.Scatto);
                                if (conflittoDiScatto != null)
                                {
                                    throw new Exception("Il codice scatto formato è già presente in altri articoli");
                                }
                            }
                            else
                            {
                                var conflittoDiScatto = records.Find(f => f.Scatto == _rec.Scatto && f.CodiceGruppo != codGruppo && f.CodiceGruppo != _rec.CodiceGruppo);
                                if (conflittoDiScatto != null)
                                {
                                    throw new Exception("Il codice scatto formato è già presente in altri articoli non del gruppo");
                                }
                            }
                            _rec.Dato = JsonConvert.SerializeObject(item);
                            if (records.Find(f => f.Codice == _rec.Codice) != null)
                            {
                                rec = this.ctx2.PromoTracciatiRecords.Where(f => f.IdTracciato == pTr.Id && f.Codice == _rec.Codice).FirstOrDefault()!;
                                if (rec != null)
                                {
                                    if (rec.Label != _rec.Label)
                                    {
                                        throw new Exception("La label attualmente presente nel gruppo è " + rec.Label + " mentre la label che si sta cercando di impostare è " + _rec.Label + ", è necessario risolvere il conflitto prima di procedere.");
                                    }
                                    rec.Scatto = _rec.Scatto;
                                    rec.CodiceGruppo = _rec.CodiceGruppo;
                                    rec.Dato = _rec.Dato;
                                    rec.ModalitaInserimento = _rec.ModalitaInserimento;
                                    rec.Stato = _rec.Stato;
                                }
                                else
                                {
                                    throw new Exception("Elemento del gruppo " + _rec.CodiceGruppo + " non trovato in tracciato, modifica impossibile");
                                }
                            }
                            else
                            {

                                //Ricerca in archivio
                                //Se non esiste va creato
                                Articoli artRecord = this.ctx.Articolis.Where(f => f.Codice == _rec.Codice).FirstOrDefault()!;
                                if (artRecord == null)
                                {
                                    artRecord = new();

                                    artRecord.Codice = _rec.Codice!;
                                    artRecord.Descrizione1 = "";
                                    artRecord.Descrizione2 = "";
                                    artRecord.Descrizione3 = "";
                                    artRecord.Descrizione4 = "";
                                    artRecord.StatoRevisione = 0;
                                    artRecord.DataInserimento = DateTime.Now;
                                    artRecord.DataModifica = DateTime.Now;
                                    this.ctx.Articolis.Add(artRecord);
                                    this.ctx.SaveChanges();

                                }

                                string refJson = JsonConvert.SerializeObject(artRecord);
                                item.Add(nome_ref, JsonConvert.DeserializeObject<Dictionary<string, object>>(refJson)!);
                                item.Add(KFirma, Utility.Main.getFirmaTracciato(item));
                                _rec.Dato = JsonConvert.SerializeObject(item);

                                this.ctx2.PromoTracciatiRecords.Add(_rec);
                            }
                        }
                    }
                    this.ctx2.SaveChanges();

                }
                catch (Exception ex)
                {
                    result.errorCode = ErrorCodes.Generic;
                    result.error = ex.Message;
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
        [Route("Tracciati/getTracciatoById/{idTracciato}")]
        public async Task<IActionResult> getTracciatoById(int idTracciato)
        {
            PromoTracciati? tracciato = await this.ctx2.PromoTracciatis.Where(f => f.Id == idTracciato).FirstOrDefaultAsync();
            return Ok(tracciato);
        }

        /*

         */
        #endregion

        #region Esportazione

        // +--- DEPRECATO --- 9/9/2026 -------------------------------------------------
        // COSA        la rotta Tracciati/esporta e il metodo esporta(InputForExport).
        // PERCHE      Confermato da Michele il 9/9/2026: e deprecata. L'esportazione vera
        //             non sta piu qui: sta in AgenziaLib, nella classe del cliente
        //             (Famila.cs, Coopfi.cs, ...), come metodo Esporta imposto
        //             dall'interfaccia che ogni agenzia deve implementare.
        // ATTENZIONE  Non usarla per collaudare l'esportazione: misura un percorso morto.
        //             Il 9/9/2026 stavo per proporre proprio questo, ed e stato Michele a
        //             fermarmi. Sul serverino exported_files e vuota su entrambi gli
        //             ambienti: nessuno passa piu di qui.
        // NON CANCELLARE: da valutare in un futuro lavoro di pulizia.
        // +---------------------------------------------------------------------------
        [HttpPut]
        [Route("Tracciati/esporta")]
        public async Task<IActionResult> esporta(InputForExport req)
        {
            AttivitaResult result = new AttivitaResult();

            try
            {
                OperationRequest op = new OperationRequest();
                op.Command = OperationCommand.EsportazioneVol;

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

        #endregion

        #region Esporta Promo come Modulo Json da compilare per Dump

        [HttpGet]
        [Route("Tracciati/downloadForDump/{idPromo}")]
        public async Task<IActionResult> downloadForDump(int idPromo)
        {
            ModuloCompilazionePerDataDump modulo = new ModuloCompilazionePerDataDump();
            try
            {
                List<PromoTracciati> listaTracciati = await this.ctx2.PromoTracciatis.Include(inc => inc.PromoTracciatiRecords).Where(f => f.IdPromo == idPromo).ToListAsync();

                List<PromoTracciatiRecord> trecs = new List<PromoTracciatiRecord>();

                listaTracciati.ForEach(f => trecs.AddRange(f.PromoTracciatiRecords.ToList()));

                var dataset = trecs.GroupBy(g =>  g.CodiceGruppo ).ToList();


                modulo.source = dataset.Select(s => new RefForModuloCompilazionePerDataDump() { codice = s.Key! }).ToList();
                List<RefForModuloCompilazionePerDataDump> singoliDeiGruppi = new List<RefForModuloCompilazionePerDataDump>();
                foreach (var item in modulo.source)
                {
                    string[] arrGruppo = item.codice!.Split(',');
                    foreach (string cod in arrGruppo)
                    {
                        List<string> fotoArr = new List<string>();
                        ArticoliFoto? af = await this.ctx.ArticoliFotos.Include(i => i.IdArticoloNavigation).Where(a => a.IdArticoloNavigation.Codice == cod && (!a.Tipo.HasValue || a.Tipo == (Byte)TipoFoto.Foto) && a.Attiva == true)/* NULL-ORDER 7/9/2026: su PostgreSQL i NULL vengono PRIMA in ORDER BY DESC, su SQL Server dopo. Senza HasValue una foto con data_modifica vuota risulterebbe "la piu recente" e finirebbe nel volantino al posto di quella giusta. Vedi migrazione-mssql-postgres.md §12. */ .OrderByDescending(o => o.DataModifica.HasValue).ThenByDescending(o => o.DataModifica).FirstOrDefaultAsync();
                        string nomeFotoASttuale = "";
                        if (af != null)
                        {
                            string ext = System.IO.Path.GetExtension(af.NomeReale);
                            if (
                                (this.ext_pre_lavorazione == null || this.ext_pre_lavorazione.Contains(ext)) &&
                                (this.ext_post_lavorazione == null || !this.ext_post_lavorazione.Contains(ext))
                                )
                            {
                                nomeFotoASttuale = af.NomeReale;
                            }
                        }

                        if (arrGruppo.Length > 1)
                        {
                            //Dobbiamo aggiungere il record per il singolo del gruppo
                            singoliDeiGruppi.Add(new RefForModuloCompilazionePerDataDump() { codice = cod, nomeFotoAttualeSuIstanta= nomeFotoASttuale });
                        }
                        else
                        {
                            item.nomeFotoAttualeSuIstanta = nomeFotoASttuale;
                        }
                    }
                }
                modulo.source.AddRange(singoliDeiGruppi);
                

            }
            catch(Exception ex)
            {
                modulo.error = ex.ToString();
            }
            string json = JsonConvert.SerializeObject(modulo);
         

            var content = new System.Text.UTF8Encoding().GetBytes(json);
            var result = new FileContentResult(content, "application/json")
            {
                FileDownloadName = "download.json"
            };
            return result;
            

        }

        #endregion

        #region Integrazioni dato manuale

        [DisableRequestSizeLimit]
        [HttpPut]
        [Route("Tracciati/integrazioneMirataInTracciato")]
        public async Task<IActionResult> integrazioneMirataInTracciato([FromBody] RequestForIntegrazioneMirata req)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            ResponseForIntegrazioneMirata result = new ResponseForIntegrazioneMirata();
            result.output=new List<ItemIntegrazioneMirata>();

            try
            {
                string label = "";
                //Recupero addestramento di importazione
                Attivitum attItem = await this.ctx.Attivita.FirstOrDefaultAsync(f => f.Id == req.idAttivita);
                OperationRequest opReq = JsonConvert.DeserializeObject<OperationRequest>(attItem.Contract!);
                if (opReq != null)
                {
                    InputFormTracciato? packet = (opReq.Packet as JObject).ToObject<InputFormTracciato>();
                    label = packet.getFieldByKey("idLabel");
                }
                else
                {
                    result.error="Impossibile recuperare il label dall'attività di importazione.";
                    result.esito= false;
                    return Ok(result);
                }

                var impItem = await this.ctx2.PromoImportazionis
                        .Include(i1 => i1.IdAddestramentoNavigation)
                        .ThenInclude(i2 => i2.SchemaCampiExcels).FirstOrDefaultAsync(f => f.IdAttivita == req.idAttivita);
                //Recuper la promo
                var promoItem = await this.ctx2.Promos.FirstOrDefaultAsync(f => f.Id == req.idPromo);

                //IstantaController icCtrl = new IstantaController("", this.path_external_lib, this.path_external_source, this._dbContextFactory);


                //Leggiamo il report e accediamo quindi alla source
                string _source = await System.IO.File.ReadAllTextAsync(System.IO.Path.Combine(this.path_to_import, req.idAttivita.ToString(), "Report.json" ));
                List<Dictionary<string,object>> _dbReport = JsonConvert.DeserializeObject<List<Dictionary<string, object>>>(_source)!;

                Dictionary<string, List<PromoTracciatiRecord>> dictCache = new Dictionary<string, List<PromoTracciatiRecord>>();

                foreach (var _it in req.items)
                {

                    var item = _dbReport.FirstOrDefault(d => d[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString()==_it.codice && d["AC"].ToString()==_it.ac);

                    Dictionary<string, object> _refForDb = new Dictionary<string, object>();
                    string guidIdAreaDelRecord = "";
                    string guidIdCanaleDelRecord = "";
                    foreach (string key in item.Keys)
                    {
                        if (key=="guidIdArea")
                        {
                            guidIdAreaDelRecord = item[key]!.ToString()!;
                        }
                        if (key == "guidIdCanale")
                        {
                            guidIdCanaleDelRecord = item[key]!.ToString()!;
                        }
                        else if (key != "AC" && key != "versione")
                        {
                            //var schema = impItem.IdAddestramentoNavigation.SchemaCampiExcels.FirstOrDefault(sc => sc.NomeColonna == key);
                            //if (schema == null)
                            //{
                                _refForDb[key] = item[key];
                            //}
                            //else
                            //{
                            //    _refForDb[key] = icCtrl.parseAddesttramentoValue(item[key], schema);
                            //}
                        }
                    }

                    //Aggiungo il record al promo tracciati di queata promo
                    PromoTracciati? pTr = await this.ctx2.PromoTracciatis
                        .Include(i1=>i1.PromoTracciatiRecords)
                        .Where(f => f.IdPromo == promoItem.Id && 
                            f.guidArea == guidIdAreaDelRecord &&
                            f.guidCanale == guidIdCanaleDelRecord
                            ).FirstOrDefaultAsync();

                    if (pTr != null)
                    {
                        //Prendo la label
                        string idCache = $"{guidIdCanaleDelRecord}_{guidIdAreaDelRecord}";

                        var lastVer = pTr.PromoTracciatiRecords.Where(ptr => ptr.Label == label).Max(r => r.Versione);

                        List<PromoTracciatiRecord> promoTracciatiRecordsList = new List<PromoTracciatiRecord>();
                        if (dictCache.ContainsKey(idCache))
                        {
                            Console.WriteLine($"{pTr.Id} Track in cache");
                            promoTracciatiRecordsList = dictCache[idCache];
                        }
                        else
                        { 
                            promoTracciatiRecordsList = pTr.PromoTracciatiRecords.ToList();
                            Console.WriteLine($"{pTr.Id} Track tot = {promoTracciatiRecordsList.Count}");
                            dictCache[idCache] = promoTracciatiRecordsList;
                        }



                        string codRef = _refForDb[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString();
                        //Assicuriamoci adesso che il codice che stiamo per inserire non sia gia esistente
                        if (pTr.PromoTracciatiRecords.Count(ptr => ptr.Codice == codRef) <= 0)
                        {
                            PromoTracciatiRecord newRecord = new PromoTracciatiRecord();
                            newRecord.IdTracciato = pTr.Id;
                            newRecord.IdAddestramento = impItem.IdAddestramento;
                            newRecord.Versione = lastVer;
                            newRecord.Label = label;

                            newRecord.IndiceLettura = 0;
                            newRecord.IndiceEsportazione = 0;

                            newRecord.DataRegistrazione = DateTime.Now;
                            newRecord.ModalitaInserimento = (Byte)ModalitaInserimento.Manuale;
                            newRecord.Stato = (Byte)StatoRecord.Attivo;

                            //Qui devo capire se intanto è un signolo vero
                            string origincCodGruppo = _refForDb[GLOBAL_VARIABLES_FICO.keyCodiceGruppo].ToString();

                            Console.WriteLine($"INTEGRAZOINE {codRef} -> {origincCodGruppo}, il vecchio ha {promoTracciatiRecordsList.Count} records ");
                            if (codRef == origincCodGruppo)
                            {
                                Console.WriteLine($"Importazione singolo naturaale");

                                //E' un singolo da importazione naturale, non si fa alcun intervento
                                newRecord.Codice = codRef;
                                newRecord.CodiceGruppo = origincCodGruppo;
                            }
                            else
                            {
                                Console.WriteLine($"Attenzione è un gruppo");
                                //Risulta essere un gruppo.
                                //Ora dobbiamo capire se questo gruppo è tutto nuovo oppure trova gia qualche componente nel dato esistente
                                string[] codsGruppo = origincCodGruppo.Split(',');
                                if (promoTracciatiRecordsList.Count(p => codsGruppo.Contains(p.Codice)) > 0)
                                {
                                    Console.WriteLine($"Alemno un codice è nel vecchio");

                                    //Almeno un codice del gruppo formato è già in traccaito, questa ref deve essere forzata ad entrare come singola
                                    newRecord.Codice = codRef;
                                    newRecord.CodiceGruppo = codRef;
                                    _refForDb[GLOBAL_VARIABLES_FICO.keyCodiceGruppo] = codRef;
                                }
                                else
                                {
                                    Console.WriteLine($"Codice gruppo integro: {origincCodGruppo}");
                                    //Nuovo gruppo formato
                                    newRecord.Codice = codRef;
                                    newRecord.CodiceGruppo = origincCodGruppo;
                                }
                            }

                            newRecord.Dato = JsonConvert.SerializeObject(_refForDb);

                            this.ctx2.PromoTracciatiRecords.Add(newRecord);

                            //Adesso devo anche accertarmi che sia in archivoi
                            var artRecord = await this.ctx.Articolis.FirstOrDefaultAsync(a => a.Codice == codRef);
                            if (artRecord==null)
                            {
                                artRecord = new Articoli();
                                artRecord.Descrizione1 = "";
                                artRecord.Descrizione2 = "";
                                artRecord.Descrizione3 = "";
                                artRecord.Descrizione4 = "";
                                artRecord.Codice = codRef;
                                if (_refForDb.ContainsKey(GLOBAL_VARIABLES_FICO.keyEanCodice))
                                {
                                    artRecord.Ean = _refForDb[GLOBAL_VARIABLES_FICO.keyEanCodice].ToString();
                                }
                                artRecord.StatoRevisione = (Byte)StatoRevisioneArticolo.NonProcessato;
                                artRecord.DataInserimento = DateTime.Now;
                                this.ctx.Articolis.Add(artRecord);

                                _= await this.ctx.SaveChangesAsync();

                                //Inserito il NUOVO articolo, è anche il caso di fare una revisione senza valenza di firma per far si che venga cmq ricontrollato dall'operatore
                                //Ma almeno potrebbe essere facilitato e velocizzato il meccanismo di revisione
                                //Questo sempre e solo se espone almeno uno dei 4 campi descrittivi base 
                                if (_refForDb.ContainsKey(GLOBAL_VARIABLES_FICO.keyDescrizione1) ||
                                    _refForDb.ContainsKey(GLOBAL_VARIABLES_FICO.keyDescrizione2) ||
                                    _refForDb.ContainsKey(GLOBAL_VARIABLES_FICO.keyDescrizione3) ||
                                    _refForDb.ContainsKey(GLOBAL_VARIABLES_FICO.keyDescrizione4))
                                {
                                    ArticoliDescrizioni ad = new ArticoliDescrizioni();

                                    ad.Descrizione1 = _refForDb.ContainsKey(GLOBAL_VARIABLES_FICO.keyDescrizione1) ? _refForDb[GLOBAL_VARIABLES_FICO.keyDescrizione1].ToString() : "";
                                    ad.Descrizione2 = _refForDb.ContainsKey(GLOBAL_VARIABLES_FICO.keyDescrizione2) ? _refForDb[GLOBAL_VARIABLES_FICO.keyDescrizione2].ToString() : "";
                                    ad.Descrizione3 = _refForDb.ContainsKey(GLOBAL_VARIABLES_FICO.keyDescrizione3) ? _refForDb[GLOBAL_VARIABLES_FICO.keyDescrizione3].ToString() : "";
                                    ad.Descrizione4 = _refForDb.ContainsKey(GLOBAL_VARIABLES_FICO.keyDescrizione4) ? _refForDb[GLOBAL_VARIABLES_FICO.keyDescrizione4].ToString() : "";
                                    ad.Um = _refForDb.ContainsKey(GLOBAL_VARIABLES_FICO.keyDescrUm) ? _refForDb[GLOBAL_VARIABLES_FICO.keyDescrUm].ToString() : "";
                                    if (item.ContainsKey(GLOBAL_VARIABLES_FICO.keyDescrPeso))
                                    {
                                        if (_refForDb[GLOBAL_VARIABLES_FICO.keyDescrPeso] is double)
                                            ad.Peso = (decimal)((double)_refForDb[GLOBAL_VARIABLES_FICO.keyDescrPeso]);
                                        else if (_refForDb[GLOBAL_VARIABLES_FICO.keyDescrPeso] is decimal)
                                            ad.Peso = (decimal)_refForDb[GLOBAL_VARIABLES_FICO.keyDescrPeso];
                                    }
                                    ad.Approvata = false;
                                    ad.DataUltimaRicezione = DateTime.Now;
                                    ad.IdArticolo = artRecord.Id;
                                    this.ctx.Add(ad);

                                    _ = await this.ctx.SaveChangesAsync();
                                }
                            }

                            _it.result = "ok";
                            result.output.Add(_it);
                        }
                        else
                        {
                            _it.result = "gia_esistente";
                            result.output.Add(_it);
                        }

                    }
                    else
                    {
                        
                        //Errore
                        result.error += $"Impossibile trovare il tracciato per area e canale specificati. {guidIdAreaDelRecord}/{guidIdCanaleDelRecord}";
                        result.esito= false;

                        return Ok(result);
                    }
                    
                }

                
                await this.ctx2.SaveChangesAsync();

                result.esito = true;
            }
            catch (Exception ex)
            {
                result.error = ex.Message;
            }

            return Ok(result);
        }

        #endregion

        #region FicoContext Editor
        public IActionResult FicoContexts()
        {
            return View("FicoContexts");
        }

        [HttpPut]
        [Route("Tracciati/salvaSourceJsonCode")]
        public async Task<IActionResult> salvaSourceJsonCode([FromBody] SourceJsonRequest request)
        {
            BoolResult bRes = new BoolResult();

            if (request != null)
            {
                if (request.origin.Contains("nuovaLavorazione"))
                {
                    //bRes = SingletonConfiguration.dbOrdinamentoLista!.SetJsonSource(request.jsoncode);
                    string path = System.IO.Path.Combine(this.path_external_source, request.origin+".json");
                    if (System.IO.File.Exists(path))
                    {
                        System.IO.File.Delete(path);
                    }

                    using (StreamWriter sw = new StreamWriter(path))
                    {
                        //Sovrascrivo il file con il nuovo codice json
                        sw.Write(request.jsoncode);
                    }
                    
                }                
            }
            else
            {
                bRes.error = "Parametro null";
            }



            return Ok(bRes);
        }

        #endregion
    }
}
