using DocumentFormat.OpenXml.Drawing;
using DocumentFormat.OpenXml.ExtendedProperties;
using DocumentFormat.OpenXml.Office.CustomUI;
using ExcelDataReader.Log;
using Istanta.Antlr;
using Istanta.Models;
using Istanta.Models_2;
using Istanta.Utility;
using IstantaLib;
using LinqKit;
using Microsoft.AspNetCore.JsonPatch.Operations;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.AspNetCore.Routing.Matching;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Microsoft.Win32;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System.Collections.Generic;
using System.Configuration;
using System.Data;
//using System.Data.Entity;
using System.Diagnostics;
using System.Globalization;
using System.Linq;
using System.Reflection.Emit;
using System.Runtime.CompilerServices;
using System.Security.Cryptography.Xml;
using System.Timers;
using System.Xml;
using System.Xml.Linq;

namespace Istanta.Controllers
{


	public class RevisoreController : Controller
    {
        private readonly ILogger<RevisoreController> _logger;
        private readonly edro21_dbContext ctx;
        private readonly Edro21_DbContext2 ctx2;
        private readonly IConfiguration _config;
		private readonly string path_to_import = "";
		private readonly string path_external_source = "";
        private readonly string path_external_lib = "";
        private readonly string connString="";
        private readonly string olympusServerUrl;
        private readonly IOptions<FicoConfig> _fico_conf;

        private AntlrOptions antlrOptions;
        private AntlrController antlrController;
        private readonly IDbContextFactory<edro21_dbContext> _dbContextFactory;
        private readonly IDbContextFactory<Edro21_DbContext2> _dbContextFactory2;
        public RevisoreController(ILogger<RevisoreController> logger, IConfiguration configuration, IOptions<PathOperationImport> option_import, IOptions<PathExternal> external_paths, IOptions<FicoConfig> olConfig, IOptions<AntlrOptions> antlr_options, IOptions<FicoConfig> ficoConf, IDbContextFactory<edro21_dbContext> dbContextFactory, IDbContextFactory<Edro21_DbContext2> dbContextFactory2)
        {
            this._dbContextFactory2 = dbContextFactory2;
            this.connString = configuration.GetConnectionString("IstandaConnectionDb")!;
            this._dbContextFactory = dbContextFactory;
            this.ctx = this._dbContextFactory.CreateDbContext();
            //this.ctx = new edro21_dbContext(this.connString);
            this.ctx2 = this._dbContextFactory2.CreateDbContext();
            _logger = logger;
            _config = configuration;
            path_to_import = option_import.Value.path;
            path_external_source = external_paths.Value.pathSource;
            path_external_lib = external_paths.Value.pathLib;
            olympusServerUrl = olConfig.Value.olympusServerUrl;
            this._fico_conf = ficoConf;

            antlrOptions = antlr_options.Value;
            antlrController = new AntlrController(antlrOptions.patternsDescrizioneRegionale!);

            ViewData["jsGuid"] = Guid.NewGuid().ToString();
        }

        [HttpGet]
        public async Task<IActionResult> Index(int id_promo, string id_tracciati)
        {
            string[] idTracciati;
            List<int> listIdTracciati = new List<int>();
            if (id_tracciati != null)
            {
                idTracciati = id_tracciati.Split(',');
                listIdTracciati = idTracciati.Select(s => int.Parse(s)).ToList();
            }
            //var item = await this.ctx.Importazionis.Where(i => i.Id == id_importazione).FirstOrDefaultAsync();
            if (listIdTracciati.Count >= 1 && listIdTracciati[0] != 0)
            {
                var item = await this.ctx2.PromoTracciatis.Where(i => listIdTracciati.Contains(i.Id)).ToListAsync();
                ViewBag.Tracciato = item;
                id_promo = item[0].IdPromo;
            }
            if (id_promo != 0)
            {
                var promo = await this.ctx2.Promos.Include(f=>f.PromoTracciatis).Where(i => i.Id == id_promo).FirstOrDefaultAsync();
                ViewBag.Promo = promo;
            }
            viewOlimpoIp();
            
            /*
            //Routine di auto generazione revisioni delle descrizioni di tutti gli articoli in database
            var _inventario = await this.ctx.Articolis.Include(i=>i.ArticoliDescrizionis).ToListAsync();
            foreach(Articoli _item in _inventario)
            {
                if (_item.ArticoliDescrizionis.Count<=0)
                {
                    ArticoliDescrizioni rev = new ArticoliDescrizioni();
                    rev.IdArticolo = _item.Id;
                    rev.Descrizione1 = _item.Descrizione1;
                    rev.Descrizione2 = _item.Descrizione2;
                    rev.Descrizione3 = _item.Descrizione3;
                    rev.Descrizione4 = _item.Descrizione4;
                    rev.Approvata = false;
                    rev.DataUltimaRicezione = DateTime.Now;
                    rev.FirmaTracciato = "";
                    this.ctx.Add(rev);
                }
            }

            this.ctx.SaveChanges();
            //Routine di auto generazione revisioni delle descrizioni di tutti gli articoli in database
            */


            return View();
        }


        static object? NormalizeForCompare(object value)
        {
            // Normalizza per ridurre falsi mismatch: null/"" -> null, trim stringhe, ecc.
            if (value is string s) return string.IsNullOrWhiteSpace(s) ? null : s.Trim();
            return value ?? null;
        }

        static object? GetDatoValueOrNull(Dictionary<string, object> dato, string key)
        {
            return dato != null && key != null && dato.TryGetValue(key, out var v) ? NormalizeForCompare(v) : null;
        }

        static string? Canon(object v)
        {
            if (v == null) return "<NULL>";
            if (v is string s) return string.IsNullOrWhiteSpace(s) ? "<NULL>" : s.Trim();
            if (v is DateTime dt) return dt.ToUniversalTime().ToString("o", CultureInfo.InvariantCulture); // ISO 8601
            if (v is IFormattable form) return form.ToString(null, CultureInfo.InvariantCulture); // numeri/bool/decimal ecc.
            return v.ToString(); // fallback
        }

        public void viewOlimpoIp()
        {
            ViewBag.ipOlympus = this.olympusServerUrl;
            //return View();
        }

        public record recSemplificato(
            string Codice,
            string CodGruppo,
            string label,
            int versione,
            int idTracciato,
            Int64 Id,
            Dictionary<string,object> RecInTracciato
        );

        private List<WrapperGruppoConTracciato> BuildGruppiGaranteDaRecSemplificati(
    IEnumerable<recSemplificato> records,
    Dictionary<int, string> sigleTracciatoMap)
        {
            var result = new List<WrapperGruppoConTracciato>();

            if (records == null)
            {
                return result;
            }

            var gruppi = records
                .Where(r => r != null && r.RecInTracciato != null)
                .GroupBy(r => new
                {
                    IdTracciato = r.idTracciato,
                    Label = r.label ?? ""
                })
                .ToList();

            foreach (var grp in gruppi)
            {
                var metaGruppo = grp
                    .Where(x => x.RecInTracciato != null)
                    .Select(x => x.RecInTracciato)
                    .ToList();

                if (metaGruppo.Count == 0)
                {
                    continue;
                }

                result.Add(new WrapperGruppoConTracciato
                {
                    idTracciato = grp.Key.IdTracciato,
                    siglaTracciato = sigleTracciatoMap.ContainsKey(grp.Key.IdTracciato)
                        ? sigleTracciatoMap[grp.Key.IdTracciato]
                        : "",
                    gruppo = metaGruppo
                });
            }

            return result;
        }

        [HttpPost]
        [Route("Revisore/getConteggio")]
        public async Task<IActionResult> getConteggioListaRevisione(RevisoreRequest req)
        {

            try
            {

                Stopwatch sw = new Stopwatch();

                sw.Start();
                IstantaController icCtrl = new IstantaController(this._config.GetConnectionString("IstandaConnectionDb")!, this.path_external_lib, this.path_external_source, this._dbContextFactory);

                RevisoreCountResult result = new RevisoreCountResult();

                var imp = await this.ctx2.Promos.Include(f => f.PromoTracciatis)
                    .ThenInclude(i2 => i2.PromoTracciatiRecords).Where(i => i.Id == req.IdPromo).FirstOrDefaultAsync();

                var sigleTracciatoMap = imp!.PromoTracciatis
    .ToDictionary(
        t => t.Id,
        t => t.Sigla ?? ""
    );

                List<PromoTracciatiRecord> rec = new List<PromoTracciatiRecord>();
                Dictionary<int, int[]> conteggioPerTracciato = new Dictionary<int, int[]>();

                Console.WriteLine($"Step1 {sw.ElapsedMilliseconds}");

                foreach (PromoTracciati tracciato in imp!.PromoTracciatis)
                {
                    conteggioPerTracciato[tracciato.Id] = new int[2] { 0, 0 };
                    rec.AddRange(tracciato.PromoTracciatiRecords
                        .Where(s => s.Stato == (byte)StatoRecord.Attivo));
                }
                //var lista = rec
                //    .Select(item => new recSemplificato(
                //        item.Codice,
                //        item.CodiceGruppo,
                //        item.Label,
                //        item.Versione,
                //        item.IdTracciato,
                //        item.Id,
                //        Utility.Main.getJsonObject(item.Dato)
                //    ))
                //    .ToList();

                var lista = rec
    .Select(item =>
    {
        var dato = Utility.Main.getJsonObject(item.Dato);

        if (dato == null)
        {
            dato = new Dictionary<string, object>();
        }

        dato["idRec"] = item.Id.ToString();
        dato["idTracciato"] = item.IdTracciato;
        dato["label"] = item.Label ?? "";

        return new recSemplificato(
            item.Codice,
            item.CodiceGruppo,
            item.Label,
            item.Versione,
            item.IdTracciato,
            item.Id,
            dato
        );
    })
    .ToList();

                lista = lista
    .GroupBy(x => x.label)
    .SelectMany(g =>
    {
        var maxV = g.Max(x => x.versione);
        return g.Where(x => x.versione == maxV);
    })
    .ToList();

                var listaDizionariPerFiltroAgenzia = lista
    .Where(x => x.RecInTracciato != null)
    .Select(x => x.RecInTracciato)
    .ToList();

                Dictionary<string, object> passFiltroAgenzia = new Dictionary<string, object>();
                passFiltroAgenzia["records"] = listaDizionariPerFiltroAgenzia;

                var listaFiltrataAgenzia = icCtrl.execLibFunction(
                    $"AgenziaLib.{this._fico_conf.Value.nomeCliente}.FiltraRecordsPerConteggioRevisione",
                    passFiltroAgenzia
                ) as List<Dictionary<string, object>>;

                if (listaFiltrataAgenzia != null)
                {
                    var idRecordsAmmessi = listaFiltrataAgenzia
                        .Where(x => x.ContainsKey("idRec") && x["idRec"] != null)
                        .Select(x => x["idRec"].ToString())
                        .Where(x => !string.IsNullOrWhiteSpace(x))
                        .ToHashSet();

                    lista = lista
                        .Where(x => x.RecInTracciato != null &&
                                    x.RecInTracciato.ContainsKey("idRec") &&
                                    idRecordsAmmessi.Contains(x.RecInTracciato["idRec"].ToString()))
                        .ToList();
                }


                Console.WriteLine($"Step2 {sw.ElapsedMilliseconds}");

                var codici = lista
                .Select(x => x.Codice)
                .Distinct()
                .ToList();

                var codiciGruppo = lista.Where(x=>x.CodGruppo != x.Codice)
                .Select(x => x.CodGruppo)
                .Distinct()
                .ToList();


                string kSottogruppo= Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceSottogruppo;

                var codiciSottogruppi = lista.Where(x => x.RecInTracciato.ContainsKey(kSottogruppo) && x.RecInTracciato[kSottogruppo].ToString().Contains(","))
                    .Select(x => x.RecInTracciato[kSottogruppo].ToString())
                    .Distinct()
                    .ToList();

                Console.WriteLine($"Step3 {sw.ElapsedMilliseconds}");

                var counterRevisioniAssenti = 0;
                var counterRevisioniAssentiSottogruppi = 0;

                //singoli

                var articoli = this.ctx.Articolis.AsSplitQuery().Include(f=>f.ArticoliDescrizionis).Where(f => codici.Contains(f.Codice)).ToList();
                var articoliConRevisioni = articoli.Where(f => f.ArticoliDescrizionis != null && f.ArticoliDescrizionis.Count > 0).ToList();
                var articoliSenzaRevisioni = articoli.Where(f => f.ArticoliDescrizionis == null || f.ArticoliDescrizionis.Count == 0).ToList();
                counterRevisioniAssenti += articoli.Count - articoliConRevisioni.Count();

                Console.WriteLine($"Step4_0 {sw.ElapsedMilliseconds}");

                Dictionary<int, List<recSemplificato>> cacheTracciati = new Dictionary<int, List<recSemplificato>>();

                var batchGaranteConteggio = new WrapperBatchPerGetGarante();
                var pendingConteggioGarante = new List<PendingConteggioGarante>();

                List<recSemplificato> GetListaTracciatoCached(int idTracciato)
                {
                    if (!cacheTracciati.ContainsKey(idTracciato))
                    {
                        cacheTracciati[idTracciato] = lista
                            .Where(l => l.idTracciato == idTracciato)
                            .ToList();
                    }

                    return cacheTracciati[idTracciato];
                }

                void IncrementaConteggioSingolo(string codice)
                {
                    counterRevisioniAssenti++;

                    foreach (var k in conteggioPerTracciato.Keys.ToList())
                    {
                        var _list = GetListaTracciatoCached(k);

                        if (_list.Any(l => l.Codice == codice))
                        {
                            conteggioPerTracciato[k][0]++;
                        }
                    }
                }

                void IncrementaConteggioGruppo(string codiceGruppo)
                {
                    counterRevisioniAssenti++;

                    foreach (var k in conteggioPerTracciato.Keys.ToList())
                    {
                        var _list = GetListaTracciatoCached(k);

                        if (_list.Any(l => l.CodGruppo == codiceGruppo))
                        {
                            conteggioPerTracciato[k][0]++;
                        }
                    }
                }

                void IncrementaConteggioSottogruppo(string codiceSottogruppo)
                {
                    counterRevisioniAssentiSottogruppi++;

                    foreach (var k in conteggioPerTracciato.Keys.ToList())
                    {
                        var _list = GetListaTracciatoCached(k);

                        if (_list.Any(l =>
                            l.RecInTracciato.ContainsKey(kSottogruppo) &&
                            l.RecInTracciato[kSottogruppo]?.ToString() == codiceSottogruppo))
                        {
                            conteggioPerTracciato[k][1]++;
                        }
                    }
                }

                void AggiungiPendingGarante(
    string key,
    string codice,
    string tipo,
    string meta,
    IEnumerable<recSemplificato> recordsGarante)
                {
                    if (string.IsNullOrWhiteSpace(meta))
                    {
                        if (tipo == "S")
                        {
                            IncrementaConteggioSingolo(codice);
                        }
                        else if (tipo == "G")
                        {
                            IncrementaConteggioGruppo(codice);
                        }
                        else if (tipo == "SG")
                        {
                            IncrementaConteggioSottogruppo(codice);
                        }

                        return;
                    }

                    var gruppiPerTracciato = BuildGruppiGaranteDaRecSemplificati(
                        recordsGarante,
                        sigleTracciatoMap
                    );

                    if (gruppiPerTracciato.Count == 0)
                    {
                        if (tipo == "S")
                        {
                            IncrementaConteggioSingolo(codice);
                        }
                        else if (tipo == "G")
                        {
                            IncrementaConteggioGruppo(codice);
                        }
                        else if (tipo == "SG")
                        {
                            IncrementaConteggioSottogruppo(codice);
                        }

                        return;
                    }

                    batchGaranteConteggio.items.Add(new WrapperItemPerGetGarante
                    {
                        key = key,
                        meta = meta,
                        wrap = new WrapperPerGetGarante
                        {
                            idPromo = req.IdPromo,
                            gruppiPerTracciato = gruppiPerTracciato
                        }
                    });

                    pendingConteggioGarante.Add(new PendingConteggioGarante
                    {
                        key = key,
                        codice = codice,
                        tipo = tipo
                    });
                }

                bool spaccato = false;
                foreach (var item in articoliConRevisioni)
                {

                    if (spaccato)
                        Console.WriteLine($"Step4_0_1 {sw.ElapsedMilliseconds}");
                    if (item.Codice == "392236")
                    {
                        Console.WriteLine("");
                    }
                    var primaCorrispondenza = lista.FirstOrDefault(f => f.Codice == item.Codice);

                    if(primaCorrispondenza == null)
                    {
                        throw new Exception("Errore, codice non trovato in lista");
                    }
                    var firma = primaCorrispondenza.RecInTracciato[Enum.GetName(AddestramentoRuoli.Tracciato) + "." + GLOBAL_VARIABLES.keyTracciatoFirma]!.ToString()!;
                    var descrNaz = item.ArticoliDescrizionis.FirstOrDefault(f => f.Area == null && f.Canale == null);

                    if (spaccato)
                        Console.WriteLine($"Step4_0_2 {sw.ElapsedMilliseconds}");

                    if (descrNaz == null)
                    {
                        counterRevisioniAssenti++;
                        //listCodici.Add(item.Codice);
                        //Vado ad asegnarle ciascuna per ogni A/C
                        foreach (var k in conteggioPerTracciato)
                        {
                            if (!cacheTracciati.ContainsKey(k.Key))
                            {
                                cacheTracciati[k.Key] = lista.Where(l => l.idTracciato == k.Key).ToList();
                            }
                            var _list = cacheTracciati[k.Key];

                            //if (_list.Count(l => l.Codice == item.Codice && l.idTracciato == k.Key) > 0)
                            if (_list.Count(l => l.Codice == item.Codice) > 0)
                            {
                                conteggioPerTracciato[k.Key][0]++;
                            }
                        }


                    }
                    else
                    {
                        //if (descrNaz.FirmaTracciato != firma)
                        //{
                        //    //da confermare
                        //    counterRevisioniAssenti++;
                        //    //counterDaConfermare++;
                        //    foreach (var k in conteggioPerTracciato)
                        //    {
                        //        if (!cacheTracciati.ContainsKey(k.Key))
                        //        {
                        //            cacheTracciati[k.Key] = lista.Where(l => l.idTracciato == k.Key).ToList();
                        //        }

                        //        var _list = cacheTracciati[k.Key];

                        //        //if (lista.Count(l => l.Codice == item.Codice && l.idTracciato == k.Key) > 0)
                        //        if (_list.Count(l => l.Codice == item.Codice) > 0)
                        //        {
                        //            conteggioPerTracciato[k.Key][0]++;
                        //        }
                        //    }
                        //}

                        if (descrNaz.FirmaTracciato != firma)
                        {
                            var recordsCodice = lista
                                .Where(l => l.Codice == item.Codice)
                                .ToList();

                            AggiungiPendingGarante(
                                key: "S|" + item.Codice,
                                codice: item.Codice,
                                tipo: "S",
                                meta: descrNaz.Meta,
                                recordsGarante: recordsCodice
                            );
                        }
                    }
                    if (spaccato)
                        Console.WriteLine($"Step4_0_3 {sw.ElapsedMilliseconds}");


                    spaccato = false;

                }

                Console.WriteLine($"Step4 {sw.ElapsedMilliseconds}");

                //gruppi

                var descrGruppi = this.ctx.ArticoliDescrizionis.AsSplitQuery().Where(f => codiciGruppo.Contains(f.CodiceGruppo)).ToList();

                foreach (var cod in codiciGruppo)
                {
                    var itemGruppo = lista
    .Where(f => f.CodGruppo == cod)
    .DistinctBy(f => f.Codice)
    .ToList();

                    //controlliamo se esiste un sottogruppo uguale al gruppo
                    //bool isAncheSottogruppo = codiciSottogruppi.Count(f => f == cod) > 0;

                    if (cod.Contains("3999097"))
                    {

                        Debug.WriteLine("");
                    }


                    if (itemGruppo.Count < 2)
                    {
                        throw new Exception("Errore, elementi del gruppo "+ cod +" non trovati");
                    }
                    var descrizioneNazDelGruppo = descrGruppi.FirstOrDefault(f => f.Area == null && f.Canale == null && f.CodiceGruppo == cod);
                    if (descrizioneNazDelGruppo == null)
                    {
                        counterRevisioniAssenti++;
                        //if (isAncheSottogruppo)
                        //{
                        //    counterRevisioniAssentiSottogruppi++;
                        //}
                        //listCodici.Add(cod);
                        foreach (var k in conteggioPerTracciato)
                        {
                            if (!cacheTracciati.ContainsKey(k.Key))
                            {
                                cacheTracciati[k.Key] = lista.Where(l => l.idTracciato == k.Key).ToList();
                            }

                            var _list = cacheTracciati[k.Key];

                            //if (lista.Count(l => l.CodGruppo == cod && l.idTracciato == k.Key) > 0)
                            if (_list.Count(l => l.CodGruppo == cod) > 0)
                            {
                                conteggioPerTracciato[k.Key][0]++; 

                            }
                        }

                    }
                    else
                    {
                        //var _membriGruppo = itemGruppo.Select(s => s.RecInTracciato).ToList();
                        //var hash = Utility.Main.getFirmaTracciatoGruppo(_membriGruppo);
                        var recordsGruppo = rec
    .Where(r => r.CodiceGruppo == cod)
    .ToList();

                        var hash = Utility.Main.getFirmaTracciatoGruppoDaRecords(
                            recordsGruppo,
                            cod,
                            false
                        );
                        //if (descrizioneNazDelGruppo.FirmaTracciato != hash)
                        //{
                        //    counterRevisioniAssenti++;

                        //    foreach (var k in conteggioPerTracciato)
                        //    {
                        //        if (!cacheTracciati.ContainsKey(k.Key))
                        //        {
                        //            cacheTracciati[k.Key] = lista.Where(l => l.idTracciato == k.Key).ToList();
                        //        }

                        //        var _list = cacheTracciati[k.Key];

                        //        if (_list.Count(l => l.CodGruppo == cod) > 0)
                        //        {
                        //            conteggioPerTracciato[k.Key][0]++;
                        //        }
                        //    }
                        //}

                        if (descrizioneNazDelGruppo.FirmaTracciato != hash)
                        {
                            var recordsGruppoPerGarante = lista
                                .Where(l => l.CodGruppo == cod)
                                .ToList();

                            AggiungiPendingGarante(
                                key: "G|" + cod,
                                codice: cod,
                                tipo: "G",
                                meta: descrizioneNazDelGruppo.Meta,
                                recordsGarante: recordsGruppoPerGarante
                            );
                        }
                    }
                }

                Console.WriteLine($"Step5 {sw.ElapsedMilliseconds}");

                //sottogruppi

                //rimuoviamo dai codici sottogruppi tutti quelli già processati in gruppi
                codiciSottogruppi.RemoveAll(x => codiciGruppo.Contains(x));

                var descrSottogruppi = this.ctx.ArticoliDescrizionis.AsSplitQuery().Where(f => codiciSottogruppi.Contains(f.CodiceGruppo) && !codiciGruppo.Contains(f.CodiceGruppo)).ToList();

                foreach (var cod in codiciSottogruppi)
                {
                    var itemGruppo = lista
    .Where(f =>f.RecInTracciato.ContainsKey(kSottogruppo) && f.RecInTracciato[kSottogruppo].ToString() == cod)
    .DistinctBy(f => f.Codice)
    .ToList();

                    if (itemGruppo.Count < 2)
                    {
                        throw new Exception("Errore, elementi del sottogruppo " + cod + " non trovati");
                    }
                    var descrizioneNazDelGruppo = descrSottogruppi.FirstOrDefault(f => f.Area == null && f.Canale == null && f.CodiceGruppo == cod);
                    if (descrizioneNazDelGruppo == null)
                    {
                        counterRevisioniAssentiSottogruppi++;

                        foreach (var k in conteggioPerTracciato)
                        {

                            if (!cacheTracciati.ContainsKey(k.Key))
                            {
                                cacheTracciati[k.Key] = lista.Where(l => l.idTracciato == k.Key).ToList();
                            }

                            var _list = cacheTracciati[k.Key];

                            //if (lista.Count(l => l.RecInTracciato.ContainsKey(kSottogruppo) && l.RecInTracciato[kSottogruppo].ToString() == cod && l.idTracciato == k.Key) > 0)
                            if (_list.Count(l => l.RecInTracciato.ContainsKey(kSottogruppo) && l.RecInTracciato[kSottogruppo].ToString() == cod) > 0)
                            {
                                conteggioPerTracciato[k.Key][1]++;
                            }
                        }

                    }
                    else
                    {
                        //var _membriGruppo = itemGruppo.Select(s => s.RecInTracciato).ToList();
                        //var hash = Utility.Main.getFirmaTracciatoGruppo(_membriGruppo);
                        var codiciSingoliSottogruppo = cod
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
    .Where(x => !string.IsNullOrWhiteSpace(x))
    .Distinct(StringComparer.OrdinalIgnoreCase)
    .ToList();

                        var recordsSottogruppo = rec
                            .Where(r => codiciSingoliSottogruppo.Contains(r.Codice))
                            .ToList();

                        var hash = Utility.Main.getFirmaTracciatoGruppoDaRecords(
                            recordsSottogruppo,
                            cod,
                            true
                        );
                        //if (descrizioneNazDelGruppo.FirmaTracciato != hash)
                        //{
                        //    counterRevisioniAssentiSottogruppi++;       

                        //    foreach (var k in conteggioPerTracciato)
                        //    {
                        //        if (!cacheTracciati.ContainsKey(k.Key))
                        //        {
                        //            cacheTracciati[k.Key] = lista.Where(l => l.idTracciato == k.Key).ToList();
                        //        }

                        //        var _list = cacheTracciati[k.Key];

                        //        //if (lista.Count(l => l.RecInTracciato.ContainsKey(kSottogruppo) && l.RecInTracciato[kSottogruppo].ToString() == cod && l.idTracciato == k.Key) > 0)
                        //        if (_list.Count(l => l.RecInTracciato.ContainsKey(kSottogruppo) && l.RecInTracciato[kSottogruppo].ToString() == cod) > 0)
                        //        {
                        //            conteggioPerTracciato[k.Key][1]++;
                        //        }                                
                        //    }
                        //}

                        if (descrizioneNazDelGruppo.FirmaTracciato != hash)
                        {
                            var recordsSottogruppoPerGarante = lista
                                .Where(l =>
                                    l.RecInTracciato.ContainsKey(kSottogruppo) &&
                                    l.RecInTracciato[kSottogruppo]?.ToString() == cod)
                                .ToList();

                            AggiungiPendingGarante(
                                key: "SG|" + cod,
                                codice: cod,
                                tipo: "SG",
                                meta: descrizioneNazDelGruppo.Meta,
                                recordsGarante: recordsSottogruppoPerGarante
                            );
                        }
                    }
                }

                if (batchGaranteConteggio.items.Count > 0)
                {
                    Dictionary<string, object> _pass = new Dictionary<string, object>();
                    _pass["batch"] = batchGaranteConteggio;

                    string resultJson = icCtrl.execLibFunction(
                        $"AgenziaLib.{this._fico_conf.Value.nomeCliente}.GetMetaPerRevisioneDaGruppiMultipliBatch",
                        _pass
                    ) as string;

                    var batchResult = !string.IsNullOrWhiteSpace(resultJson)
                        ? JsonConvert.DeserializeObject<RitornoBatchGarante>(resultJson)
                        : null;

                    var risultatiGarante = batchResult?.items != null
                        ? batchResult.items
                            .Where(x => !string.IsNullOrWhiteSpace(x.key))
                            .GroupBy(x => x.key)
                            .ToDictionary(g => g.Key, g => g.First())
                        : new Dictionary<string, RitornoItemGarante>();

                    foreach (var pending in pendingConteggioGarante)
                    {
                        bool firmaGarantita = false;

                        if (risultatiGarante.TryGetValue(pending.key, out var esitoGarante))
                        {
                            firmaGarantita = esitoGarante.firmaGarantita;
                        }

                        // Se NON è garantita, allora il vecchio comportamento resta valido:
                        // è da confermare e va conteggiata.
                        if (!firmaGarantita)
                        {
                            if (pending.tipo == "S")
                            {
                                IncrementaConteggioSingolo(pending.codice);
                            }
                            else if (pending.tipo == "G")
                            {
                                IncrementaConteggioGruppo(pending.codice);
                            }
                            else if (pending.tipo == "SG")
                            {
                                IncrementaConteggioSottogruppo(pending.codice);
                            }
                        }
                    }
                }

                Console.WriteLine($"Step6 {sw.ElapsedMilliseconds}");

                int[] res = new int[2];

                //listCodici.Order();
                res = [counterRevisioniAssenti, counterRevisioniAssentiSottogruppi];
                result.globalCount = res;
                result.countTracciati = conteggioPerTracciato;

                sw.Stop();

                Console.WriteLine($"Step1 {sw.ElapsedMilliseconds}");

                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(
                    StatusCodes.Status500InternalServerError,
                    new
                    {
                        error = "Errore durante il conteggio della revisione",
                        detail = ex.Message
                    }
                );
            }
        }

        private ArticoloInRevisione? FindArticoloGarante(
    List<ArticoloInRevisione> candidati,
    RitornoItemGarante garante)
        {
            if (candidati == null || candidati.Count == 0 || garante == null)
            {
                return null;
            }

            if (garante.gruppo == null || garante.gruppo.Count == 0)
            {
                return null;
            }

            var primoGarante = garante.gruppo[0];

            if (primoGarante.ContainsKey("idRec"))
            {
                string idRecGarante = primoGarante["idRec"]?.ToString() ?? "";

                var matchByIdRec = candidati.FirstOrDefault(x =>
                    x.recordInTracciato != null &&
                    x.recordInTracciato.ContainsKey("idRec") &&
                    string.Equals(
                        x.recordInTracciato["idRec"]?.ToString(),
                        idRecGarante,
                        StringComparison.OrdinalIgnoreCase
                    )
                );

                if (matchByIdRec != null)
                {
                    return matchByIdRec;
                }
            }

            var matchByTracciato = candidati.FirstOrDefault(x =>
                x.recordInTracciato != null &&
                x.recordInTracciato.ContainsKey("idTracciato") &&
                GetIntSafe(x.recordInTracciato, "idTracciato") == garante.idTracciato
            );

            return matchByTracciato;
        }

        private bool HasMismatchFirma(
    IEnumerable<ArticoloInRevisione> articoli,
    string kFirmaTracciato)
        {
            if (articoli == null)
            {
                return false;
            }

            var firme = articoli
                .Where(x => x.recordInTracciato != null && x.recordInTracciato.ContainsKey(kFirmaTracciato))
                .Select(x => x.recordInTracciato[kFirmaTracciato]?.ToString() ?? "")
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Distinct()
                .ToList();

            return firme.Count > 1;
        }

        private List<WrapperGruppoConTracciato> BuildGruppiGaranteDaArticoli(
    List<ArticoloInRevisione> articoli)
        {
            var result = new List<WrapperGruppoConTracciato>();

            if (articoli == null || articoli.Count == 0)
            {
                return result;
            }

            var gruppi = articoli
                .Where(x => x.recordInTracciato != null)
                .GroupBy(x => new
                {
                    IdTracciato = GetIntSafe(x.recordInTracciato!, "idTracciato"),
                    Label = x.label ?? ""
                })
                .ToList();

            foreach (var grp in gruppi)
            {
                var first = grp.FirstOrDefault();
                if (first == null || first.recordInTracciato == null)
                {
                    continue;
                }

                result.Add(new WrapperGruppoConTracciato
                {
                    idTracciato = grp.Key.IdTracciato,
                    siglaTracciato = first.recordInTracciato.ContainsKey("siglaTracciato")
                        ? first.recordInTracciato["siglaTracciato"]?.ToString() ?? ""
                        : "",
                    gruppo = grp
                        .Where(x => x.recordInTracciato != null)
                        .Select(x => x.recordInTracciato!)
                        .ToList()
                });
            }

            return result;
        }
        private int GetIntSafe(Dictionary<string, object> dict, string key)
        {
            if (dict == null || !dict.ContainsKey(key) || dict[key] == null)
            {
                return 0;
            }

            int value;
            return int.TryParse(dict[key].ToString(), out value)
                ? value
                : 0;
        }

        private ArticoloInRevisione CreaSingoloRappresentanteDaGarante(
    ArticoloInRevisione itemContesto,
    ArticoloInRevisione itemGarante,
    string keyCodiceGruppo,
    string keyCodiceRef)
        {
            var result = new ArticoloInRevisione();

            result.recordInTracciato = RefCloner.Clona(itemGarante.recordInTracciato!);

            // Mantengo il contesto della riga finale.
            // Questo è importante per i gruppi misti:
            // il dato descrittivo/firma viene dal garante,
            // ma il codice gruppo deve restare quello della riga che stai aggiungendo.
            if (itemContesto.recordInTracciato != null)
            {
                if (itemContesto.recordInTracciato.ContainsKey(keyCodiceGruppo))
                {
                    result.recordInTracciato[keyCodiceGruppo] = itemContesto.recordInTracciato[keyCodiceGruppo];
                }

                if (itemContesto.recordInTracciato.ContainsKey(keyCodiceRef))
                {
                    result.recordInTracciato[keyCodiceRef] = itemContesto.recordInTracciato[keyCodiceRef];
                }

                if (itemContesto.recordInTracciato.ContainsKey(GLOBAL_VARIABLES.keyArea))
                {
                    result.recordInTracciato[GLOBAL_VARIABLES.keyArea] = itemContesto.recordInTracciato[GLOBAL_VARIABLES.keyArea];
                }

                if (itemContesto.recordInTracciato.ContainsKey(GLOBAL_VARIABLES.keyCanale))
                {
                    result.recordInTracciato[GLOBAL_VARIABLES.keyCanale] = itemContesto.recordInTracciato[GLOBAL_VARIABLES.keyCanale];
                }

                if (itemContesto.recordInTracciato.ContainsKey(GLOBAL_VARIABLES.keyACComuni))
                {
                    result.recordInTracciato[GLOBAL_VARIABLES.keyACComuni] = itemContesto.recordInTracciato[GLOBAL_VARIABLES.keyACComuni];
                }

                itemContesto.recordInTracciato.TryGetValue(
    "metaKeyInMismatch",
    out var mismatch);

                result.recordInTracciato["metaKeyInMismatch"] =
                    CloneMismatchDetails(mismatch);

                if (itemContesto.recordInTracciato.ContainsKey("origine"))
                {
                    result.recordInTracciato["origine"] = itemContesto.recordInTracciato["origine"];
                }
            }

            result.idRec = itemGarante.idRec;
            result.label = itemGarante.label;

            // Qui terrei il contesto originale, non quello del garante.
            // Il garante serve a scegliere il recordInTracciato migliore.
            result.recordRevisionato = itemContesto.recordRevisionato;
            result.recordRevisionatiRegionali = itemContesto.recordRevisionatiRegionali;

            result.isGruppo = false;
            result.customLabelForDescrizioneRegionale = itemContesto.customLabelForDescrizioneRegionale;

            return result;
        }

        private ArticoloInRevisione CreaGruppoRappresentanteDaGarante(
    ArticoloInRevisione itemContesto,
    ArticoloInRevisione itemGarante,
    string keyCodiceGruppo)
        {
            var result = new ArticoloInRevisione();

            result.recordInTracciato = RefCloner.Clona(itemGarante.recordInTracciato!);

            // Mantengo il contesto del gruppo finale.
            // Per ora dovrebbe coincidere quasi sempre, ma è meglio non rischiare.
            if (itemContesto.recordInTracciato != null)
            {
                if (itemContesto.recordInTracciato.ContainsKey(keyCodiceGruppo))
                {
                    result.recordInTracciato[keyCodiceGruppo] = itemContesto.recordInTracciato[keyCodiceGruppo];
                }

                if (itemContesto.recordInTracciato.ContainsKey(GLOBAL_VARIABLES.keyArea))
                {
                    result.recordInTracciato[GLOBAL_VARIABLES.keyArea] = itemContesto.recordInTracciato[GLOBAL_VARIABLES.keyArea];
                }

                if (itemContesto.recordInTracciato.ContainsKey(GLOBAL_VARIABLES.keyCanale))
                {
                    result.recordInTracciato[GLOBAL_VARIABLES.keyCanale] = itemContesto.recordInTracciato[GLOBAL_VARIABLES.keyCanale];
                }

                if (itemContesto.recordInTracciato.ContainsKey(GLOBAL_VARIABLES.keyACComuni))
                {
                    result.recordInTracciato[GLOBAL_VARIABLES.keyACComuni] = itemContesto.recordInTracciato[GLOBAL_VARIABLES.keyACComuni];
                }

                itemContesto.recordInTracciato.TryGetValue(
"metaKeyInMismatch",
out var mismatch);

                result.recordInTracciato["metaKeyInMismatch"] =
                    CloneMismatchDetails(mismatch);

                if (itemContesto.recordInTracciato.ContainsKey("origine"))
                {
                    result.recordInTracciato["origine"] = itemContesto.recordInTracciato["origine"];
                }

                if (itemContesto.recordInTracciato.ContainsKey("PrimarioGruppo"))
                {
                    result.recordInTracciato["PrimarioGruppo"] = itemContesto.recordInTracciato["PrimarioGruppo"];
                }

                if (itemContesto.recordInTracciato.ContainsKey("SecondariGruppo"))
                {
                    result.recordInTracciato["SecondariGruppo"] = itemContesto.recordInTracciato["SecondariGruppo"];
                }
            }

            result.idRec = itemGarante.idRec;
            result.label = itemGarante.label;

            // Mantengo il record revisionato del contesto.
            // Il garante serve a scegliere il recordInTracciato rappresentante.
            result.recordRevisionato = itemContesto.recordRevisionato;
            result.recordRevisionatiRegionali = itemContesto.recordRevisionatiRegionali;

            result.isGruppo = true;
            result.customLabelForDescrizioneRegionale = itemContesto.customLabelForDescrizioneRegionale;

            return result;
        }

        private static List<Dictionary<string, object>> CloneMismatchDetails(
    object? source)
        {
            if (source is not IEnumerable<Dictionary<string, object>> details)
            {
                return new List<Dictionary<string, object>>();
            }

            return details.Select(detail =>
            {
                var clonedDetail = new Dictionary<string, object>();

                if (detail.TryGetValue("key", out var key))
                {
                    clonedDetail["key"] = key;
                }

                if (detail.TryGetValue("values", out var valuesObject) &&
                    valuesObject is IEnumerable<Dictionary<string, object>> values)
                {
                    clonedDetail["values"] = values.Select(valueDetail =>
                    {
                        var clonedValue = new Dictionary<string, object>();

                        if (valueDetail.TryGetValue("value", out var value))
                        {
                            clonedValue["value"] = value;
                        }

                        if (valueDetail.TryGetValue("origins", out var originsObject) &&
                            originsObject is IEnumerable<string> origins)
                        {
                            clonedValue["origins"] = origins.ToList();
                        }
                        else
                        {
                            clonedValue["origins"] = new List<string>();
                        }

                        return clonedValue;
                    }).ToList();
                }
                else
                {
                    clonedDetail["values"] =
                        new List<Dictionary<string, object>>();
                }

                return clonedDetail;
            }).ToList();
        }

        [HttpPost]
        [Route("Revisore/getListaRevisione2")]
        public async Task<IActionResult> getListaRevisione2(RevisoreRequest req)
        {
            Console.WriteLine("Richiesta getListaRevisione2 ricevuta");

            RevisoreResult result = new RevisoreResult();

            Stopwatch sw = new Stopwatch();

            DateTime dStart = DateTime.Now;
            ExternalSourceClass exClass = new ExternalSourceClass(this.path_external_source, new string[] { "SourceOrdinamentoLista" });
            IstantaController icCtrl = new IstantaController(this._config.GetConnectionString("IstandaConnectionDb")!, this.path_external_lib, this.path_external_source, this._dbContextFactory);
            try
            {
                if (req.IdTracciatiRichiesti == null)
                {
                    req.IdTracciatiRichiesti = new List<int>();
                    req.IdTracciatiRichiesti.Add(0);
                }
                Promo? imp;

                DateTime dtStart = DateTime.Now;

                int idPromo = 0;

                sw.Start();

                if (req.IdPromo == 0)
                {
                    if (req.IdTracciatiPartenza!.Count >= 1)
                    {
                        PromoTracciati? PromoTracciato = this.ctx2.PromoTracciatis.Where(f => f.Id == req.IdTracciatiPartenza[0]).FirstOrDefault();
                        if (PromoTracciato == null)
                        {
                            throw new Exception("Tracciato non trovato nel database");
                        }
                        idPromo = PromoTracciato.IdPromo;
                    }
                    else
                    {
                        throw new Exception("Nessun tracciato inviato");
                    }
                }
                else
                {
                    idPromo = req.IdPromo;
                }

                sw.Stop();

                Console.WriteLine($"STEP 1: {sw.ElapsedMilliseconds.ToString()}");

                sw = new Stopwatch();
                sw.Start();

                imp = await this.ctx2.Promos.Include(x => x.PromoTracciatis)/*.ThenInclude(i2 => i2.IdImportazioneNavigation)*/
                    .Include(f => f.PromoTracciatis).ThenInclude(i2 => i2.PromoTracciatiRecords).AsSplitQuery().Where(i => i.Id == idPromo).FirstOrDefaultAsync();
                
                string key_codice_ref = Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice;
                string key_codice_gruppo = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppo;
                string key_descrizione_gruppo = GLOBAL_VARIABLES.keyDescrGruppo;
                string key_stato_selezione = GLOBAL_VARIABLES.keyXMLSelezione;
                string keyNomeFoto = Enum.GetName(AddestramentoRuoli.Foto) + "." + GLOBAL_VARIABLES.keyFotoNome;
                string keyGuidFoto = Enum.GetName(AddestramentoRuoli.Foto) + "." + GLOBAL_VARIABLES.keyFotoGuidId;

                DateTime d2 = DateTime.Now;
                double msStep1 = d2.Subtract(dStart).TotalMilliseconds;

                var promoRecords = new List<PromoTracciatiRecord>();
                var areaCanaleMap = new Dictionary<long, (string Area, string Canale, long IdTracciato)>();
                var q_records = new List<q_records_per_getListaRevisione>();

                // Estrazione iniziale
                foreach (PromoTracciati tracciato in imp!.PromoTracciatis
                    .Where(f => req.IdTracciatiRichiesti.Contains(f.Id) || req.IdTracciatiRichiesti[0] == 0))
                {
                    foreach (var record in tracciato.PromoTracciatiRecords
                        .Where(s => s.Stato == (byte)StatoRecord.Attivo && IstantaJson.FindIn(s.Dato!, req.formRequest!)))
                    {
                        promoRecords.Add(record);
                        areaCanaleMap[record.Id] = (tracciato.Area!, tracciato.Canale!, tracciato.Id);
                    }
                }

                sw.Stop();
                Console.WriteLine($"STEP 2: {sw.ElapsedMilliseconds.ToString()}");

                sw = new Stopwatch();
                sw.Start();
                // Filtraggio
                promoRecords = promoRecords
                    .GroupBy(r => (r.Label, areaCanaleMap[r.Id].IdTracciato)) // 🧠 Raggruppi per Label + IdTracciato
                    .SelectMany(g => g.Where(r => r.Versione == g.Max(r => r.Versione))) // 🔍 Prendi la versione massima
                    .ToList();

                // Preparazione dati
                List<Dictionary<string, object>> dati = new List<Dictionary<string, object>>();

                foreach (var record in promoRecords)
                {
                    var datoSingolo = Utility.Main.getJsonObject(record.Dato!)!;
                    datoSingolo["idRec"] = record.Id.ToString();
                    datoSingolo["label"] = record.Label!;
                    datoSingolo["idTracciato"] = record.IdTracciato;
                    datoSingolo["siglaTracciato"] = record.IdTracciatoNavigation?.Sigla ?? "";
                    //datoSingolo[GLOBAL_VARIABLES_FICO.keyXlsxTracciato] = record.IdTracciatoNavigation.IdImportazioneNavigation != null ? record.IdTracciatoNavigation.IdImportazioneNavigation.NomeFile : "";

                    dati.Add(datoSingolo);
                }

                sw.Stop();
                Console.WriteLine($"STEP 3: {sw.ElapsedMilliseconds.ToString()}");

                sw = new Stopwatch();
                sw.Start();
                // Ordinamento
                dati = Ordinamento.ordinaRecordsTracciato(dati, exClass, icCtrl, this.path_external_source, this._fico_conf.Value.nomeCliente);


                sw.Stop();
                Console.WriteLine($"STEP 4: {sw.ElapsedMilliseconds.ToString()}");

                sw = new Stopwatch();
                sw.Start();
                // Creazione q_records
                q_records.AddRange(dati.Select(s =>
                {
                    var id = int.Parse(s["idRec"].ToString()!);
                    var (area, canale, idTrac) = areaCanaleMap.ContainsKey(id) ? areaCanaleMap[id] : (null, null, 0);

                    return new q_records_per_getListaRevisione
                    {
                        Dato = s,
                        Id = id,
                        Label = s["label"].ToString(),
                        Area = area,
                        Canale = canale
                    };
                }).ToList());

                sw.Stop();
                Console.WriteLine($"STEP 5: {sw.ElapsedMilliseconds.ToString()}");

                DateTime d5 = DateTime.Now;

                sw = new Stopwatch();
                sw.Start();

                //q_records = q_records.Where(f => f.Dato[key_codice_gruppo].ToString() == "4525536").ToList();

                //Dictionary<string, ArticoloInRevisione> dictCache = new Dictionary<string, ArticoloInRevisione>();
                List<string> codesCache = new List<string>();
                //int debug_count_gruppi = 0;
                string debug_last_cod_gruppo = "4696706,4696730";
                List<string> q_records_codici = q_records.Select(s => s.Dato[key_codice_ref].ToString()!).ToList();
                List<string> q_records_codiciGruppi = q_records.Select(s => s.Dato[key_codice_gruppo].ToString()!).ToList();


                List<Articoli> arts = await this.ctx.Articolis.Include(i => i.ArticoliDescrizionis).Include(i => i.ArticoliFotos).AsSplitQuery().Where(r => q_records_codici.Contains(r.Codice)).ToListAsync();
                List<ArticoliDescrizioni> descrGruppi = await this.ctx.ArticoliDescrizionis.Where(r => q_records_codiciGruppi.Contains(r.CodiceGruppo)).ToListAsync();
                
                Console.WriteLine($"STEP 6_intermedio1: {sw.ElapsedMilliseconds.ToString()}");

                string kFirmaTracciato = Enum.GetName(AddestramentoRuoli.Tracciato) + "." + GLOBAL_VARIABLES.keyTracciatoFirma;
                bool swSpaccato = true;
                Stopwatch swGruppo = new Stopwatch();

                Dictionary<string, List<q_records_per_getListaRevisione>> cacheListe = new Dictionary<string, List<q_records_per_getListaRevisione>>();
                Dictionary<string, List<Int64>> cache_idRecs = new Dictionary<string, List<long>>();




                foreach (var qItem in q_records)
                {
                    string cod = qItem.Dato[key_codice_ref].ToString()!;
                    string cod_gruppo = qItem.Dato[key_codice_gruppo].ToString()!;
                    string[] cod_refs = cod_gruppo.Split(',');

                    if (!cache_idRecs.ContainsKey(cod))
                    {
                        cache_idRecs[cod] = new List<long>();
                    }
                    if (qItem.Id > 0)
                    {
                        cache_idRecs[cod].Add(qItem.Id);
                    }
                    

                    string codSingoloCache = $"{cod}|{qItem.Area}_{qItem.Canale}";
                    string codGruppoCache = $"{cod_gruppo}|{qItem.Area}_{qItem.Canale}";

                    if (cod == "4525536")
                    {
                        Console.WriteLine("");
                    }

                    if (!codesCache.Contains(codSingoloCache))
                    {
                        //Prima formo i singoli
                        //Nuovo articolo singolo da formar
                        ArticoloInRevisione item = new ArticoloInRevisione();
                        item.recordInTracciato = qItem.Dato;
                        item.idRec = qItem.Id;
                        item.label = qItem.Label;

                        item.recordInTracciato[GLOBAL_VARIABLES.keyArea] = qItem.Area;
                        item.recordInTracciato[GLOBAL_VARIABLES.keyCanale] = qItem.Canale;

                        string firma = "";
                        if (item.recordInTracciato!.ContainsKey(kFirmaTracciato))
                            firma = item.recordInTracciato[kFirmaTracciato]!.ToString()!;

                        Articoli artItem = arts.FirstOrDefault(a => a.Codice == cod)!;
                        if (artItem != null)
                        {
                            var foto = artItem.ArticoliFotos!.Where(d => (!d.Tipo.HasValue || d.Tipo == (Byte)TipoFoto.Foto)).OrderByDescending(o => o.DataModifica).FirstOrDefault();
                            item.recordInTracciato[keyNomeFoto] = foto != null ? foto.NomeReale : "";
                            item.recordInTracciato[keyGuidFoto] = foto != null ? foto.GuidId : "";

                            ArticoliDescrizioni? naz = artItem.ArticoliDescrizionis!.Where(f => f.Area == null && f.Canale == null && f.Custom != null && f.FirmaTracciato == firma).FirstOrDefault();
                            if (naz == null)
                            {
                                naz = artItem.ArticoliDescrizionis!.Where(f => f.Area == null && f.Canale == null && f.Custom == null && f.FirmaTracciato == firma).FirstOrDefault();
                            }

                            item.recordRevisionato = naz!;
                            if (item.recordRevisionato == null)
                            {
                                item.recordRevisionato = artItem.ArticoliDescrizionis!.Where(f => f.Area == null && f.Canale == null && f.Custom != null).OrderByDescending(o => o.DataUltimaRicezione).FirstOrDefault()!;

                                if (item.recordRevisionato == null)
                                {
                                    item.recordRevisionato = artItem.ArticoliDescrizionis!.Where(f => f.Area == null && f.Canale == null && f.Custom == null).OrderByDescending(o => o.DataUltimaRicezione).FirstOrDefault()!;
                                }
                            }
                            var descrReg = artItem.ArticoliDescrizionis!.Where(f => f.Canale != null || f.Area != null).OrderByDescending(o => o.DataUltimaRicezione).ToList();
                            item.recordRevisionatiRegionali = convertiDaArticoliDescrizioniARevisioneRegionale(descrReg);
                        }
                        item.isGruppo = false;
                        item.customLabelForDescrizioneRegionale = antlrController.ParseInputByPattern(item.recordInTracciato);



                        result.Data.Add(item);

                        codesCache.Add(codSingoloCache);
                    }

                }

                string codiceDebug = "4525536";

                var primaSelezione = result.Data
                    .Where(x =>
                        !x.isGruppo &&
                        Canon(GetDatoValueOrNull(
                            x.recordInTracciato!,
                            key_codice_ref)!) == codiceDebug)
                    .Select(x => new
                    {
                        x.idRec,
                        CodiceRefRaw = GetDatoValueOrNull(
                            x.recordInTracciato!,
                            key_codice_ref),
                        CodiceGruppoRaw = GetDatoValueOrNull(
                            x.recordInTracciato!,
                            key_codice_gruppo),
                        CodiceRefCanon = Canon(GetDatoValueOrNull(
                            x.recordInTracciato!,
                            key_codice_ref)!),
                        CodiceGruppoCanon = Canon(GetDatoValueOrNull(
                            x.recordInTracciato!,
                            key_codice_gruppo)!),
                        Area = GetDatoValueOrNull(
                            x.recordInTracciato!,
                            GLOBAL_VARIABLES.keyArea),
                        Canale = GetDatoValueOrNull(
                            x.recordInTracciato!,
                            GLOBAL_VARIABLES.keyCanale)
                    })
                    .ToList();

                //await Utility.Selezionatore.selezioneAutomaticaRefInMenaboConDifferenzialeAreaCanale(result.Data, this.ctx2, this._fico_conf.Value.nomeCliente, this.path_external_lib, true);
                var selezioneResult =
    await Utility.Selezionatore
        .selezioneAutomaticaRefInMenaboConDifferenzialeAreaCanale(
            result.Data,
            this.ctx2,
            this._fico_conf.Value.nomeCliente,
            this.path_external_lib,
            true
        );
                if (!selezioneResult.Esito)
                {
                    throw new InvalidOperationException(
                        $"Errore durante l'autoselezione: {selezioneResult.error}"
                    );
                }

                var dopoSelezione = result.Data
    .Where(x =>
        !x.isGruppo &&
        Canon(GetDatoValueOrNull(
            x.recordInTracciato!,
            key_codice_ref)!) == codiceDebug)
    .Select(x => new
    {
        x.idRec,
        CodiceRefRaw = GetDatoValueOrNull(
            x.recordInTracciato!,
            key_codice_ref),
        CodiceGruppoRaw = GetDatoValueOrNull(
            x.recordInTracciato!,
            key_codice_gruppo),
        CodiceRefCanon = Canon(GetDatoValueOrNull(
            x.recordInTracciato!,
            key_codice_ref)!),
        CodiceGruppoCanon = Canon(GetDatoValueOrNull(
            x.recordInTracciato!,
            key_codice_gruppo)!),
        Area = GetDatoValueOrNull(
            x.recordInTracciato!,
            GLOBAL_VARIABLES.keyArea),
        Canale = GetDatoValueOrNull(
            x.recordInTracciato!,
            GLOBAL_VARIABLES.keyCanale)
    })
    .ToList();

                var differenzeSelezione = primaSelezione
    .Join(
        dopoSelezione,
        prima => prima.idRec,
        dopo => dopo.idRec,
        (prima, dopo) => new
        {
            prima.idRec,
            PrimaRef = prima.CodiceRefRaw,
            DopoRef = dopo.CodiceRefRaw,
            PrimaGruppo = prima.CodiceGruppoRaw,
            DopoGruppo = dopo.CodiceGruppoRaw,
            RefCambiata =
                prima.CodiceRefCanon != dopo.CodiceRefCanon,
            GruppoCambiato =
                prima.CodiceGruppoCanon != dopo.CodiceGruppoCanon
        })
    .Where(x => x.RefCambiata || x.GruppoCambiato)
    .ToList();

                foreach (var qItem in q_records)
                {
                    string cod = qItem.Dato[key_codice_ref].ToString()!;
                    string cod_gruppo = qItem.Dato[key_codice_gruppo].ToString()!;
                    string[] cod_refs = cod_gruppo.Split(',');

                    if (!cache_idRecs.ContainsKey(cod))
                    {
                        cache_idRecs[cod] = new List<long>();
                    }
                    if (qItem.Id > 0)
                    {
                        cache_idRecs[cod].Add(qItem.Id);
                    }

                    if (cod == "6371374")
                    {
                        Console.WriteLine("");
                    }


                    string codSingoloCache = $"{cod}|{qItem.Area}_{qItem.Canale}";
                    string codGruppoCache = $"{cod_gruppo}|{qItem.Area}_{qItem.Canale}";

                    //Poi formo il gruppo
                    if (!cacheListe.ContainsKey($"{qItem.Area}_{qItem.Canale}"))
                    {
                        cacheListe[$"{qItem.Area}_{qItem.Canale}"] = q_records.Where(t => t.Area == qItem.Area && t.Canale == qItem.Canale).ToList();
                    }

                    List<q_records_per_getListaRevisione> _listaAC = cacheListe[$"{qItem.Area}_{qItem.Canale}"];



                    if (cod_refs.Length > 1 && !codesCache.Contains(codGruppoCache))
                    {

                        if (swSpaccato)
                        {
                            swGruppo.Start();
                        }

                        ArticoloInRevisione itemG = new ArticoloInRevisione();


                        //var itemGruppo = q_records!.Where(t => t.Dato[key_codice_gruppo].ToString() == cod_gruppo && t.Area == qItem.Area && t.Canale == qItem.Canale).ToList()!;
                        var itemGruppo = _listaAC.Where(t => t.Dato[key_codice_gruppo].ToString() == cod_gruppo).ToList()!;
                        if (itemGruppo.Any(f => !f.Dato.ContainsKey(key_stato_selezione)))
                        {
                            Console.WriteLine("Stato selezione non trovato");
                        }
                        //var itemSingolo = itemGruppo.FirstOrDefault(od => od.Dato[key_stato_selezione].ToString() == "1");


                        var itemSingolo = itemGruppo.FirstOrDefault(od =>
                        {
                            if (!od.Dato.TryGetValue(
                                    key_stato_selezione,
                                    out var statoValue) ||
                                statoValue == null)
                            {
                                return false;
                            }

                            return byte.TryParse(
                                       statoValue.ToString(),
                                       out var stato) &&
                                   stato == (byte)TipoSelezioneMenabo.Primaria;
                        });

                        itemSingolo ??= itemGruppo
                            .OrderBy(f =>
                                f.Dato.TryGetValue(key_codice_ref, out var codice)
                                    ? codice?.ToString()
                                    : string.Empty)
                            .FirstOrDefault();

                        if (itemSingolo == null)
                        {
                            itemSingolo = itemGruppo.OrderBy(f => f.Dato[key_codice_ref].ToString()).FirstOrDefault();
                        }
                        itemG.recordInTracciato = RefCloner.Clona(itemSingolo?.Dato!);
                        if (itemG.recordInTracciato == null)
                        {
                            itemG.recordInTracciato = new Dictionary<string, object>();
                            itemG.recordInTracciato[Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppo] = cod_gruppo;
                        }

                        if (swSpaccato)
                        {
                            Console.WriteLine($"STEP 6_1 SPACCATO GRUPPO: {swGruppo.ElapsedMilliseconds.ToString()}");
                        }

                        itemG.recordInTracciato[GLOBAL_VARIABLES.keyArea] = qItem.Area;
                        itemG.recordInTracciato[GLOBAL_VARIABLES.keyCanale] = qItem.Canale;
                        //var _membriGruppo = itemGruppo.Select(s => s.Dato).ToList();
                        //itemG.recordInTracciato[Enum.GetName(AddestramentoRuoli.Tracciato) + "." + GLOBAL_VARIABLES.keyTracciatoFirma] = Utility.Main.getFirmaTracciatoGruppo(_membriGruppo);

                        var recordsGruppo = promoRecords
    .Where(r =>
        r.CodiceGruppo == cod_gruppo &&
        areaCanaleMap.ContainsKey(r.Id) &&
        areaCanaleMap[r.Id].Area == qItem.Area &&
        areaCanaleMap[r.Id].Canale == qItem.Canale)
    .ToList();

                        var firmaGruppo = Utility.Main.getFirmaTracciatoGruppoDaRecords(
                            recordsGruppo,
                            cod_gruppo,
                            false
                        );

                        itemG.recordInTracciato[kFirmaTracciato] = firmaGruppo;

                        //Tento di recuperare una revisione di gruppo se c'è
                        var naz = descrGruppi.Where(ar => ar.CodiceGruppo == cod_gruppo && ar.Area == null && ar.Canale == null && ar.Custom != null).FirstOrDefault();
                        if (naz == null)
                        {
                            naz = descrGruppi.Where(ar => ar.CodiceGruppo == cod_gruppo && ar.Area == null && ar.Canale == null && ar.Custom == null).FirstOrDefault();
                        }

                        if (swSpaccato)
                        {
                            Console.WriteLine($"STEP 6_2 SPACCATO GRUPPO: {swGruppo.ElapsedMilliseconds.ToString()}");
                        }

                        itemG.recordRevisionato = naz!;
                        var descrReg = descrGruppi.Where(f => f.Canale != null || f.Area != null).OrderByDescending(o => o.DataUltimaRicezione).ToList();
                        itemG.recordRevisionatiRegionali = convertiDaArticoliDescrizioniARevisioneRegionale(descrReg);
                        itemG.isGruppo = true;

                        if (swSpaccato)
                        {
                            Console.WriteLine($"STEP 6_3 SPACCATO GRUPPO: {swGruppo.ElapsedMilliseconds.ToString()}");
                        }

                        result.Data.Add(itemG);
                        codesCache.Add(codGruppoCache);

                        if (swSpaccato)
                        {
                            swGruppo.Stop();
                            if (swSpaccato)
                            {
                                Console.WriteLine($"STEP 6_4 SPACCATO GRUPPO: {swGruppo.ElapsedMilliseconds.ToString()}");
                            }
                        }

                        swSpaccato = false;
                    }
                }

                    sw.Stop();
                Console.WriteLine($"STEP 6: {sw.ElapsedMilliseconds.ToString()}");

                sw = new Stopwatch();
                //sw.Start();

                //await Utility.Selezionatore.selezioneAutomaticaRefInMenaboConDifferenzialeAreaCanale(result.Data, this.ctx2, this._fico_conf.Value.nomeCliente, this.path_external_lib, true);
                //sw.Stop();
                //Console.WriteLine($"STEP 7: {sw.ElapsedMilliseconds.ToString()}");

                sw = new Stopwatch();
                sw.Start();

                q_records_codici = q_records_codici.GroupBy(g => g).Select(s => s.Key).ToList();

                var codici_gruppi = new List<string>();
                codici_gruppi = result.Data.GroupBy(g => g.recordInTracciato[key_codice_gruppo]).Select(s => s.Key.ToString()).ToList()!;

                Console.WriteLine($"STEP 8_parziale1: {sw.ElapsedMilliseconds.ToString()}");

                foreach (string cod_gruppo in codici_gruppi)
                {

                    string[] cod_refs = cod_gruppo.Split(',');

                    foreach (var cod in cod_refs)
                    {
                        var _tutti = result.Data.Where(t => t.recordInTracciato != null && t.recordInTracciato[key_codice_ref].ToString() == cod).ToList();
                        //var _tutti = result.Data.Where(t =>t.idRec.HasValue && cache_idRecs[cod].Contains(t.idRec.Value)).ToList();

                        //var listaACComuni = _tutti.Where(t => !t.isGruppo).Select(s => new ACcomuni
                        //{
                        //    NomeAC = s.recordInTracciato[GLOBAL_VARIABLES.keyCanale].ToString() + s.recordInTracciato[GLOBAL_VARIABLES.keyArea].ToString(),
                        //    canale = s.recordInTracciato[GLOBAL_VARIABLES.keyCanale].ToString(),
                        //    area = s.recordInTracciato[GLOBAL_VARIABLES.keyArea].ToString(),
                        //    label = s.label,
                        //    InVol = true
                        //}
                        //).ToList();

                        var listaACComuni = _tutti
    .Where(t => !t.isGruppo)
    .Select(s => new ACcomuni
    {
        NomeAC = s.recordInTracciato[GLOBAL_VARIABLES.keyCanale].ToString() + s.recordInTracciato[GLOBAL_VARIABLES.keyArea].ToString(),
        canale = s.recordInTracciato[GLOBAL_VARIABLES.keyCanale].ToString(),
        area = s.recordInTracciato[GLOBAL_VARIABLES.keyArea].ToString(),
        label = s.label,
        InVol = true
    })
    .GroupBy(x => new
    {
        x.canale,
        x.area,
        x.label
    })
    .Select(g => g.First())
    .ToList();

                        _tutti.ForEach(f => f.recordInTracciato[GLOBAL_VARIABLES.keyACComuni] = listaACComuni);

                        if(cod == "2597266")
                        {
                            Debug.WriteLine("\"2597266\"");
                        }
                    }
                }


                var gruppiPerACComuni = result.Data
    .Where(t => t.isGruppo && t.recordInTracciato != null)
    .GroupBy(t => t.recordInTracciato[key_codice_gruppo].ToString())
    .ToList();

                foreach (var grp in gruppiPerACComuni)
                {
                    string codiceGruppo = grp.Key;

                    if (string.IsNullOrWhiteSpace(codiceGruppo))
                    {
                        continue;
                    }

                    var membriGruppo = codiceGruppo
                        .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                        .Where(x => !string.IsNullOrWhiteSpace(x))
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .ToList();

                    if (membriGruppo.Count == 0)
                    {
                        continue;
                    }

                    // Il gruppo deve avere solo gli AC in cui esiste in quella forma.
                    // Quindi uso gli elementi gruppo stessi come base degli AC disponibili.
                    var acDelGruppo = grp
                        .Select(g => new ACcomuni
                        {
                            NomeAC = g.recordInTracciato[GLOBAL_VARIABLES.keyCanale].ToString() + g.recordInTracciato[GLOBAL_VARIABLES.keyArea].ToString(),
                            canale = g.recordInTracciato[GLOBAL_VARIABLES.keyCanale].ToString(),
                            area = g.recordInTracciato[GLOBAL_VARIABLES.keyArea].ToString(),
                            label = g.label,
                            InVol = true
                        })
                        .GroupBy(x => new
                        {
                            x.canale,
                            x.area,
                            x.label
                        })
                        .Select(g => g.First())
                        .ToList();

                    foreach (var gruppoItem in grp)
                    {
                        gruppoItem.recordInTracciato[GLOBAL_VARIABLES.keyACComuni] = acDelGruppo;
                    }
                }

                Console.WriteLine($"STEP 8_parziale2: {sw.ElapsedMilliseconds.ToString()}");

                var gruppi = result.Data.Where(g=>g.isGruppo).GroupBy(r => new
                {
                    Gruppo = (string)r.recordInTracciato[key_codice_gruppo],                   
                    Canale=r.recordInTracciato[GLOBAL_VARIABLES.keyCanale].ToString(),
                    Area=r.recordInTracciato[GLOBAL_VARIABLES.keyArea].ToString()
                });


                foreach (var g in gruppi)
                {
                    var gruppoRev = g.ToList();
                    if (g.FirstOrDefault(f => !f.recordInTracciato.ContainsKey(GLOBAL_VARIABLES.keyXMLSelezione) && !f.isGruppo) != null)
                    {
                        continue;
                    }
                    // Primario: prendi il primo (se esiste), altrimenti stringa vuota
                    var primario = g.FirstOrDefault(r => r.recordInTracciato!.ContainsKey(GLOBAL_VARIABLES.keyXMLSelezione) && (byte)r.recordInTracciato[GLOBAL_VARIABLES.keyXMLSelezione] == 1);
                    var primarioRef = primario != null ? (string)primario.recordInTracciato![key_codice_ref] : string.Empty;

                    // Secondari: tutti con StatoSelezione == 2
                    var secondariJoin = string.Join(",",
                        g.Where(r => r.recordInTracciato!.ContainsKey(GLOBAL_VARIABLES.keyXMLSelezione) && (byte)r.recordInTracciato[GLOBAL_VARIABLES.keyXMLSelezione] == 2)
                         .Select(r => (string)r.recordInTracciato![key_codice_ref])
                    );

                    foreach (var r in g)
                    {
                        r.recordInTracciato!["PrimarioGruppo"] = primarioRef;      // "" se assente
                        r.recordInTracciato!["SecondariGruppo"] = secondariJoin;    // "" se nessun secondario
                    }
                }

                sw.Stop();
                Console.WriteLine($"STEP 8: {sw.ElapsedMilliseconds.ToString()}");

                sw = new Stopwatch();
                sw.Start();

                var groups = result.Data
                    .GroupBy(g => (
                        Canon(GetDatoValueOrNull(g.recordInTracciato!, key_codice_ref)!),
                        Canon(GetDatoValueOrNull(g.recordInTracciato!, key_codice_gruppo)!)
                    ));

                foreach (var grp in groups)
                {                   
                    var metaKeys = req.metaPerSuggerimento ?? Array.Empty<string>();

                    var mismatchDetails = new List<Dictionary<string, object>>();
                    var mismatchKeysOnly = new List<string>(); // opzionale per retrocompatibilità

                    foreach (var k in metaKeys)
                    {
                        // Raggruppo gli elementi del gruppo per VALORE della chiave k, usando la Canon string
                        var valueGroups = grp.Where(f=>!f.isGruppo)
                            .GroupBy(r => Canon(GetDatoValueOrNull(r.recordInTracciato, k)!))
                            .ToList();

                        if (valueGroups.Count > 1)
                        {
                            mismatchKeysOnly.Add(k);

                            var valuesPayload = valueGroups.Select(vg =>
                            {
                                // “raw sample” del valore originale (il primo che trovo), utile per debug/UI
                                var raw = GetDatoValueOrNull(vg.First().recordInTracciato, k);

                                return new Dictionary<string, object>
                                {
                                    ["value"] = raw!,                    // un esempio “raw” del valore
                                    ["origins"] = vg.Select(r => r.recordInTracciato![GLOBAL_VARIABLES.keyCanale].ToString() + r.recordInTracciato![GLOBAL_VARIABLES.keyArea].ToString())
                                                     .Distinct()
                                                     .ToList()
                                };
                            }).ToList();

                            mismatchDetails.Add(new Dictionary<string, object>
                            {
                                ["key"] = k,
                                ["values"] = valuesPayload
                            });
                        }
                    }

                    // scrivo nei record del gruppo
                    foreach (var r in grp)
                    {
                        r.recordInTracciato["origine"] = r.recordInTracciato[GLOBAL_VARIABLES.keyCanale].ToString() + r.recordInTracciato[GLOBAL_VARIABLES.keyArea].ToString();
                        r.recordInTracciato["metaKeyInMismatch"] = mismatchDetails
                            .Select(d => new Dictionary<string, object>(d)) // clone shallow per sicurezza
                            .ToList();
                    }
                }

                var _test = result.Data.Where(t => t.recordInTracciato[key_codice_gruppo].ToString()== "5484897,7064674,7064689,7064693").ToList();

                //Togliamo i doppioni per cod ref e cod grupo da result.Data
                List<ArticoloInRevisione> finalList = new List<ArticoloInRevisione>();

                var groupsFinal = result.Data.Where(g=>g.isGruppo)
                .GroupBy(g => (
                    Canon(GetDatoValueOrNull(g.recordInTracciato!, key_codice_gruppo)!)
                ));

                            var singlesFinal = result.Data.Where(g=>!g.isGruppo)
                .GroupBy(g => (
                    Canon(GetDatoValueOrNull(g.recordInTracciato!, key_codice_ref)!),
                    Canon(GetDatoValueOrNull(g.recordInTracciato!, key_codice_gruppo)!)
                ));

                var singlesFinalDebug = result.Data
    .Where(g => !g.isGruppo)
    .GroupBy(g => new
    {
        CodiceRef = Canon(GetDatoValueOrNull(
            g.recordInTracciato!,
            key_codice_ref)!),

        CodiceGruppo = Canon(GetDatoValueOrNull(
            g.recordInTracciato!,
            key_codice_gruppo)!)
    })
    .Select(g => new
    {
        g.Key.CodiceRef,
        g.Key.CodiceGruppo,
        Count = g.Count(),

        Records = g.Select(x => new
        {
            x.idRec,
            Area = GetDatoValueOrNull(
                x.recordInTracciato!,
                GLOBAL_VARIABLES.keyArea),
            Canale = GetDatoValueOrNull(
                x.recordInTracciato!,
                GLOBAL_VARIABLES.keyCanale)
        }).ToList()
    })
    .Where(g =>
        g.CodiceRef == "4525536" ||
        g.CodiceGruppo == "4525536")
    .ToList();

                //foreach (var grp in singlesFinal)
                //{
                //    var first = grp.First();
                //    finalList.Add(first);
                //}
                //foreach (var grp in groupsFinal)
                //{
                //    var first = grp.First();
                //    finalList.Add(first);
                //}

                var batchGarante = new WrapperBatchPerGetGarante();

                // Cache singoli.
                // Chiave: "S|392236"
                var cacheSingoliGarante = new Dictionary<string, List<ArticoloInRevisione>>();

                // Cache gruppi.
                // Chiave: "G|392236,392260,4696660"
                var cacheGruppiGarante = new Dictionary<string, List<ArticoloInRevisione>>();


                //
                // 1. Costruisco il batch garante per i SINGOLI,
                //    raggruppando solo per CodiceRef.
                //
                var singlesPerCodiceRef = result.Data
                    .Where(g => !g.isGruppo)
                    .GroupBy(g =>
                        Canon(GetDatoValueOrNull(g.recordInTracciato!, key_codice_ref)!)
                    );

                foreach (var grpCodiceRef in singlesPerCodiceRef)
                {
                    var listaArticoliStessoCodice = grpCodiceRef.ToList();

                    if (listaArticoliStessoCodice.Count == 0)
                    {
                        continue;
                    }

                    var first = listaArticoliStessoCodice.First();

                    string codiceRef = grpCodiceRef.Key;
                    string key = "S|" + codiceRef;

                    if (codiceRef.Contains("6985320"))
                    {
                        Console.WriteLine("");
                    }

                    cacheSingoliGarante[key] = listaArticoliStessoCodice;

                    // Mismatch tra tutti i record dello stesso codice,
                    // anche se appartengono a gruppi misti diversi.
                    if (!HasMismatchFirma(listaArticoliStessoCodice, kFirmaTracciato))
                    {
                        if (listaArticoliStessoCodice[0].recordRevisionato == null ||
                            listaArticoliStessoCodice[0].recordInTracciato[kFirmaTracciato].ToString() == listaArticoliStessoCodice[0].recordRevisionato.FirmaTracciato ||
                            listaArticoliStessoCodice[0].recordRevisionato.FirmaTracciato == null)
                        {
                            continue;
                        }
                    }

                    string meta = first.recordRevisionato?.Meta ?? "";

                    batchGarante.items.Add(new WrapperItemPerGetGarante
                    {
                        key = key,
                        meta = meta,
                        wrap = new WrapperPerGetGarante
                        {
                            idPromo = idPromo,
                            gruppiPerTracciato = BuildGruppiGaranteDaArticoli(listaArticoliStessoCodice)
                        }
                    });
                }


                //
                // 2. Costruisco il batch garante per i GRUPPI,
                //    raggruppando per CodiceGruppo.
                //
                foreach (var grp in groupsFinal)
                {
                    var listaGruppiStessoCodice = grp.ToList();

                    if (listaGruppiStessoCodice.Count == 0)
                    {
                        continue;
                    }

                    var first = listaGruppiStessoCodice.First();

                    string codiceGruppo = Canon(GetDatoValueOrNull(first.recordInTracciato!, key_codice_gruppo)!);
                    string key = "G|" + codiceGruppo;

                    if (codiceGruppo.Contains("4696660"))
                    {
                        Console.WriteLine("");
                    }

                    cacheGruppiGarante[key] = listaGruppiStessoCodice;

                    // Qui il mismatch è tra i rappresentanti gruppo nei vari tracciati.
                    // Ogni rappresentante gruppo contiene le info del primario, e per il nostro scopo bastano.
                    if (!HasMismatchFirma(listaGruppiStessoCodice, kFirmaTracciato))
                    {
                        if (listaGruppiStessoCodice[0].recordRevisionato == null ||
                            listaGruppiStessoCodice[0].recordInTracciato[kFirmaTracciato].ToString() == listaGruppiStessoCodice[0].recordRevisionato.FirmaTracciato ||
                            listaGruppiStessoCodice[0].recordRevisionato.FirmaTracciato == null)
                        {
                            continue;
                        }
                    }

                    string meta = first.recordRevisionato?.Meta ?? "";

                    batchGarante.items.Add(new WrapperItemPerGetGarante
                    {
                        key = key,
                        meta = meta,
                        wrap = new WrapperPerGetGarante
                        {
                            idPromo = idPromo,
                            gruppiPerTracciato = BuildGruppiGaranteDaArticoli(listaGruppiStessoCodice)
                        }
                    });
                }


                //
                // 3. Chiamata batch unica all'agenzia.
                //
                var risultatiGarante = new Dictionary<string, RitornoItemGarante>();

                if (batchGarante.items.Count > 0)
                {
                    Dictionary<string, object> _pass = new Dictionary<string, object>();
                    _pass["batch"] = batchGarante;

                    string resultJson = icCtrl.execLibFunction(
                        $"AgenziaLib.{this._fico_conf.Value.nomeCliente}.GetMetaPerRevisioneDaGruppiMultipliBatch",
                        _pass
                    ) as string;

                    var batchResult = !string.IsNullOrWhiteSpace(resultJson)
                        ? JsonConvert.DeserializeObject<RitornoBatchGarante>(resultJson)
                        : null;

                    if (batchResult != null && batchResult.items != null)
                    {
                        risultatiGarante = batchResult.items
                            .Where(x => !string.IsNullOrWhiteSpace(x.key))
                            .GroupBy(x => x.key)
                            .ToDictionary(g => g.Key, g => g.First());
                    }
                }


                //
                // 4. Popolo finalList per i SINGOLI.
                //    La lista resta distinta per CodiceRef + CodiceGruppo,
                //    ma il garante viene cercato per solo CodiceRef.
                //
                foreach (var grp in singlesFinal)
                {
                    var listaArticoliRigaFinale = grp.ToList();

                    if (listaArticoliRigaFinale.Count == 0)
                    {
                        continue;
                    }

                    var first = listaArticoliRigaFinale.First();

                    string codiceRef = Canon(GetDatoValueOrNull(first.recordInTracciato!, key_codice_ref)!);
                    string keyGarante = "S|" + codiceRef;

                    if (codiceRef.Contains("4525536"))
                    {
                        Console.WriteLine("");
                    }

                    ArticoloInRevisione itemDaAggiungere = first;

                    if (risultatiGarante.ContainsKey(keyGarante))
                    {
                        var garante = risultatiGarante[keyGarante];

                        if (cacheSingoliGarante.TryGetValue(keyGarante, out var candidatiGarante))
                        {
                            var match = FindArticoloGarante(candidatiGarante, garante);

                            if (match != null)
                            {
                                itemDaAggiungere = CreaSingoloRappresentanteDaGarante(
                                    first,
                                    match,
                                    key_codice_gruppo,
                                    key_codice_ref
                                );

                                if (garante.firmaGarantita)
                                {
                                    itemDaAggiungere.recordInTracciato["FirmaGarantita"] =
                                        garante.siglaTracciatoFirmaGarantita ?? "";
                                }
                                else
                                {
                                    itemDaAggiungere.recordInTracciato["FirmaGarantita"] = "";
                                }
                            }
                        }
                    }

                    finalList.Add(itemDaAggiungere);
                }


                //
                // 5. Popolo finalList per i GRUPPI.
                //    Qui invece il garante viene cercato per CodiceGruppo.
                //
                foreach (var grp in groupsFinal)
                {
                    var listaGruppiStessoCodice = grp.ToList();

                    if (listaGruppiStessoCodice.Count == 0)
                    {
                        continue;
                    }

                    var first = listaGruppiStessoCodice.First();

                    string codiceGruppo = Canon(GetDatoValueOrNull(first.recordInTracciato!, key_codice_gruppo)!);
                    string keyGarante = "G|" + codiceGruppo;


                    if (codiceGruppo.Contains("4696660"))
                    {
                        Console.WriteLine("");
                    }

                    ArticoloInRevisione itemDaAggiungere = first;

                    if (risultatiGarante.ContainsKey(keyGarante))
                    {
                        var garante = risultatiGarante[keyGarante];

                        if (cacheGruppiGarante.TryGetValue(keyGarante, out var candidatiGarante))
                        {
                            var match = FindArticoloGarante(candidatiGarante, garante);

                            if (match != null)
                            {
                                itemDaAggiungere = CreaGruppoRappresentanteDaGarante(
                                    first,
                                    match,
                                    key_codice_gruppo
                                );

                                if (garante.firmaGarantita)
                                {
                                    itemDaAggiungere.recordInTracciato["FirmaGarantita"] =
                                        garante.siglaTracciatoFirmaGarantita ?? "";
                                }
                                else
                                {
                                    itemDaAggiungere.recordInTracciato["FirmaGarantita"] = "";
                                }
                            }
                        }
                    }

                    finalList.Add(itemDaAggiungere);
                }

                //Accodo i gruppi alla fine della lista
                //var soloRecordGruppi = finalList.Where(f => f.isGruppo).ToList();
                //result.Data = finalList.Where(f => !f.isGruppo).ToList();
                //result.Data.AddRange(soloRecordGruppi);
                result.Data = finalList;

                // Ora selezioni come facevi tu il primo per gruppo
                //var tracciatoSingoli = result.Data.Where(d=>!d.isGruppo).Select(s => new q_records_per_getListaRevisione()
                //{
                //    Dato = s.recordInTracciato!,
                //    Id = s.idRec.Value,
                //    Label = s.label,
                //    Area = s.recordInTracciato![GLOBAL_VARIABLES.keyArea].ToString(),
                //    Canale = s.recordInTracciato![GLOBAL_VARIABLES.keyCanale].ToString()
                //}).ToList();

                int idxTracciatoRevisione = 0;

                var tracciatoRevisione = result.Data.Select(s =>
                {
                    string keyItem = "REV_" + idxTracciatoRevisione;
                    idxTracciatoRevisione++;

                    s.recordInTracciato!["_keyRevisioneRuntime"] = keyItem;

                    return new q_records_per_getListaRevisione()
                    {
                        Dato = s.recordInTracciato!,
                        Id = s.idRec.HasValue ? s.idRec.Value : 0,
                        Label = s.label,
                        Area = s.recordInTracciato![GLOBAL_VARIABLES.keyArea].ToString(),
                        Canale = s.recordInTracciato![GLOBAL_VARIABLES.keyCanale].ToString(),
                        isGruppo = s.isGruppo
                    };
                }).ToList();


                IstantaController icItem = new IstantaController(this.connString, this.path_external_lib, this.path_external_source, this._dbContextFactory);
                Dictionary<string, object> objParams = new Dictionary<string, object>();
                objParams.Add("tracciatoRevisione", tracciatoRevisione);
                objParams.Add("listaOrigine", q_records);
                objParams.Add("tracciatoSingoli", tracciatoRevisione);   // il parametro di IAgenzia si chiama ancora tracciatoSingoli:
                                                            // execLibFunction lega per NOME, non per posizione.


                tracciatoRevisione = (icItem.execLibFunction($"AgenziaLib.{this._fico_conf.Value.nomeCliente}.specificaInOutVol", objParams) as List<q_records_per_getListaRevisione>);

                //Aggoirno Meta.keyACComuni su result.Data.recordInTraciato
                //foreach (var item in result.Data)
                //{
                //    var traccItem = tracciatoRevisione.Where(t => t.Id == item.idRec).FirstOrDefault();
                //    if (traccItem != null && traccItem.Dato.ContainsKey(GLOBAL_VARIABLES.keyACComuni))
                //    {
                //        item.recordInTracciato[GLOBAL_VARIABLES.keyACComuni] = traccItem.Dato[GLOBAL_VARIABLES.keyACComuni];
                //    }
                //}

                var mapTracciatoRevisione = tracciatoRevisione
    .Where(t => t.Dato != null && t.Dato.ContainsKey("_keyRevisioneRuntime"))
    .ToDictionary(
        t => t.Dato["_keyRevisioneRuntime"].ToString(),
        t => t
    );

                foreach (var item in result.Data)
                {
                    if (item.recordInTracciato == null || !item.recordInTracciato.ContainsKey("_keyRevisioneRuntime"))
                    {
                        continue;
                    }

                    string keyRuntime = item.recordInTracciato["_keyRevisioneRuntime"].ToString();

                    if (mapTracciatoRevisione.TryGetValue(keyRuntime, out var traccItem) &&
                        traccItem.Dato.ContainsKey(GLOBAL_VARIABLES.keyACComuni))
                    {
                        item.recordInTracciato[GLOBAL_VARIABLES.keyACComuni] = traccItem.Dato[GLOBAL_VARIABLES.keyACComuni];
                    }
                }

                sw.Stop();
                Console.WriteLine($"STEP 9: {sw.ElapsedMilliseconds.ToString()}");


            }
            catch (Exception ex)
            {
                result.Error = ex.ToString();
                Console.WriteLine($"Errore in getListaRevisione: {ex.ToString()}");
            }

            return Ok(result);
        }

        public List<RevisioneRegionale> convertiDaArticoliDescrizioniARevisioneRegionale(List<ArticoliDescrizioni> list)
        {
            List<RevisioneRegionale> result = new List<RevisioneRegionale>();

            foreach (var item in list)
            {
                RevisioneRegionale el = new RevisioneRegionale();
                el.Area = item.Area;
                el.Canale = item.Canale;
                el.CodiceGruppo = item.CodiceGruppo;
                el.Approvata = item.Approvata;
                el.Attiva = item.Attiva;
                el.Descrizione1 = item.Descrizione1;
                el.Descrizione2 = item.Descrizione2;
                el.Descrizione3 = item.Descrizione3;
                el.Descrizione4 = item.Descrizione4;
                el.DescrizioneIndd = item.DescrizioneIndd;
                el.Um = item.Um;
                el.Peso = item.Peso;
                el.DataUltimaRicezione = item.DataUltimaRicezione;
                el.Extra = item.Extra;
                el.FirmaTracciato = item.FirmaTracciato;
                el.Id = item.Id;
                el.IdArticolo = item.IdArticolo;
                el.IdArticoloNavigation = item.IdArticoloNavigation;
                result.Add(el);
            }

            return result;
        }

        [HttpPut]
        [Route("Revisore/getArticoliDescrizioniSottogruppi/{idPromo}")]
        public async Task<IActionResult> getArticoliDescrizioniSottogruppi(StringList codiciList, int idPromo)
        {
            var sottogruppi = codiciList.stringhe?
                .Where(s => !string.IsNullOrWhiteSpace(s))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList() ?? new List<string>();

            if (sottogruppi.Count == 0)
            {
                return Ok(new List<DescrizioniSottogruppi>());
            }

            var codiciSingoli = sottogruppi
                .SelectMany(sg => sg.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var promoTracciatiRecords = await this.ctx2.PromoTracciatiRecords
                .Include(r => r.IdTracciatoNavigation)
                .Where(r =>
                    r.IdTracciatoNavigation.IdPromo == idPromo &&
                    codiciSingoli.Contains(r.Codice))
                .ToListAsync();

            var items = await this.ctx.ArticoliDescrizionis
                .Where(a => sottogruppi.Contains(a.CodiceGruppo!))
                .ToListAsync();

            var output = sottogruppi
                .Select(sg => new DescrizioniSottogruppi
                {
                    codiceSottogruppo = sg,
                    descrizioni = items
                        .Where(a => string.Equals(a.CodiceGruppo, sg, StringComparison.OrdinalIgnoreCase))
                        .ToList(),
                    firmaTracciatoSottogruppo = Utility.Main.getFirmaTracciatoGruppoDaRecords(
                        promoTracciatiRecords,
                        sg,
                        true
                    )
                })
                .ToList();

            return Ok(output);
        }

        [HttpPut]
        [Route("Revisore/salva/{idTracciato}/{idOperazione}/{sender}")]
        public async Task<IActionResult> salva(RevisioniActions acts, int idTracciato = 0, int idOperazione = 0, senderOperazione sender = senderOperazione.istanta)
        {
            BoolResult result = new BoolResult();
            IstantaController icCtrl = new IstantaController(this._config.GetConnectionString("IstandaConnectionDb")!, this.path_external_lib, this.path_external_source, this._dbContextFactory);

            var session = SessionIstantaObject.GetSession(HttpContext);
            if (session.ToLower() == "no session" || session == null || session == "")
            {
                result.Esito = false;
                result.error = "no session";
                return Ok(result);
            }
            List<ArticoliDescrizioni> descrItemList = new List<ArticoliDescrizioni>();
            Exception? erroreDuranteIlSalvataggio = null;   // se il ciclo fallisce, l'errore deve arrivare al chiamante
            foreach (RevisioneAction act in acts.coda)
            {
                

                try
                {
                    var actArea = act.revRegionale != null ? act.revRegionale.area : null;
                    var actCanale = act.revRegionale != null ? act.revRegionale.canale : null;
                    var actCustom = act.revRegionale != null ? act.revRegionale.custom : null;


                    ////Dictionary<string, object> _pass = new Dictionary<string, object>();
                    ////_pass["records"] = _recDicts;
                    ////_pass["kit"] = kit;

                    ////List<Dictionary<string, object>> resultExternal = icCtrl.execLibFunction($"AgenziaLib.{this._fico_conf.Value.nomeCliente}.elaboraTracciatiRecords", _pass) as List<Dictionary<string, object>>;
                    
                    
                    
                    string codice = "";
                    string? metaRev = null;

                    if (act.Codice != "")
                    {


                        Articoli? artItem = await this.ctx.Articolis.Include(f => f.ArticoliDescrizionis).Where(f => f.Codice == act.Codice).FirstOrDefaultAsync();
                        if (artItem == null)
                        {
                            throw new Exception("Articolo " + act.Codice + " non trovato in articoli descrizioni");
                        }

                        List<PromoTracciatiRecord> promoRecordsArt = new List<PromoTracciatiRecord>();
                        var idPromoItem = 0;
                        var idTracciatoItem = 0;
                        var siglaTracciatoItem = 0;
                        if (idTracciato <= 0 && acts.idPromo > 0)
                        {
                            idPromoItem = acts.idPromo;
                            var promo = this.ctx2.Promos.Include(f => f.PromoTracciatis).ThenInclude(f => f.PromoTracciatiRecords).Where(f => f.Id == acts.idPromo).FirstOrDefault();
                            if (promo == null)
                            {
                                result.Esito = false;
                                result.error = "Nessuna promo con trovata con ID: " + acts.idPromo;
                                return Ok(result);
                            }

                            foreach (var trac in promo.PromoTracciatis)
                            {
                                var item = trac.PromoTracciatiRecords.Where(f => f.Codice == act.Codice).OrderByDescending(f => f.DataRegistrazione).FirstOrDefault();
                                if (item != null)
                                {
                                    promoRecordsArt.Add(item);
                                }
                            }
                        }
                        else
                        {
                            var item = this.ctx2.PromoTracciatiRecords.Include(f=>f.IdTracciatoNavigation).FirstOrDefault(f => f.Id == act.IdRecord);
                            if (item != null)
                            {
                                promoRecordsArt.Add(item);
                            }
                        }

                        string firma_complessiva_gruppo = Utility.Main.getFirmaTracciatoGruppoDaRecords(
                                promoRecordsArt,
                                act.Codice,
                                act.IsSottogruppo
                        );

                        if (firma_complessiva_gruppo == GLOBAL_VARIABLES.keyMismatchFirma)
                        {
                            var gruppiPerTracciato = new List<WrapperGruppoConTracciato>();

                            // Raggruppiamo tutti i record per IdTracciato + Label
                            var gruppiRecords = promoRecordsArt
                                .GroupBy(f => new
                                {
                                    f.IdTracciato,
                                    f.Label
                                })
                                .ToList();

                            foreach (var gruppoRecords in gruppiRecords)
                            {
                                var firstRecord = gruppoRecords.FirstOrDefault();
                                if (firstRecord == null)
                                {
                                    continue;
                                }

                                var tracciato = this.ctx2.PromoTracciatis
                                    .Where(f => f.Id == firstRecord.IdTracciato)
                                    .FirstOrDefault();

                                var metaGruppo = new List<Dictionary<string, object>>();

                                foreach (var rec in gruppoRecords)
                                {
                                    var meta = Utility.Main.getJsonObject(rec.Dato);
                                    if (meta != null)
                                    {
                                        metaGruppo.Add(meta);
                                    }
                                }

                                if (metaGruppo.Count == 0)
                                {
                                    continue;
                                }

                                gruppiPerTracciato.Add(new WrapperGruppoConTracciato
                                {
                                    idTracciato = firstRecord.IdTracciato,
                                    gruppo = metaGruppo,
                                    siglaTracciato = tracciato?.Sigla ?? ""
                                });
                            }

                            var wrap = new WrapperPerGetGarante
                            {
                                idPromo = acts.idPromo,
                                gruppiPerTracciato = gruppiPerTracciato
                            };

                            Dictionary<string, object> _pass = new Dictionary<string, object>();

                            _pass["wrap"] = wrap;
                            string resultJson = icCtrl.execLibFunction(
                                $"AgenziaLib.{this._fico_conf.Value.nomeCliente}.GetMetaPerRevisioneDaGruppiMultipli",
                                _pass
                            ) as string;

                            var resultGarante = !string.IsNullOrWhiteSpace(resultJson)
                                ? JsonConvert.DeserializeObject<RitornoMetaPerRevisioneGarante>(resultJson)
                                : null;

                            metaRev = resultGarante?.metaRev ?? "";
                            string kFirmaTracciato = Enum.GetName(AddestramentoRuoli.Tracciato) + "." + GLOBAL_VARIABLES.keyTracciatoFirma;

                            if (resultGarante?.gruppo != null && resultGarante.gruppo.Count > 0)
                            {
                                firma_complessiva_gruppo = resultGarante.gruppo[0][kFirmaTracciato].ToString();
                            }
                            else
                            {
                                throw new Exception("Elemento con codice " + act.Codice + " non trovato durante l'estrazione del garante");
                            }
                        }
                        else
                        {
                            var el = promoRecordsArt[0];

                            // troviamo tutti i records con stesso idTracciato
                            var recordsStessoTracciato = promoRecordsArt
                                .Where(f => f.IdTracciato == el.IdTracciato && f.Label == el.Label)
                                .ToList();

                            // estraiamo i Meta di tutti i records con stesso idTracciato come List<Dictionary<string, object>>
                            List<Dictionary<string, object>> metaRecordsStessoTracciato = new List<Dictionary<string, object>>();

                            if (recordsStessoTracciato.Count > 0)
                            {
                                foreach (var rec in recordsStessoTracciato)
                                {
                                    var meta = Utility.Main.getJsonObject(rec.Dato);
                                    if (meta != null)
                                    {
                                        metaRecordsStessoTracciato.Add(meta);
                                    }
                                }
                            }

                            var tracciato = this.ctx2.PromoTracciatis
                                .Where(f => f.Id == el.IdTracciato)
                                .FirstOrDefault();

                            Dictionary<string, object> _pass = new Dictionary<string, object>();
                            _pass["recordsGruppo"] = metaRecordsStessoTracciato;
                            _pass["idPromo"] = acts.idPromo;
                            _pass["idTracciato"] = el.IdTracciato;
                            _pass["siglaTracciato"] = tracciato?.Sigla ?? "";

                            string metaResult = icCtrl.execLibFunction(
                                $"AgenziaLib.{this._fico_conf.Value.nomeCliente}.MetaPerRevisione",
                                _pass
                            ) as string;

                            metaRev = metaResult ?? null;
                        }


                        //ArticoliDescrizioni descrItem = artItem.ArticoliDescrizionis.Where(d => (act.areaRichiesta && act.Area != null && act.Area != "" ? d.Area == act.Area : d.Area == null) && (act.areaRichiesta && act.canaleRichiesto && act.Canale != null && act.Canale != "" ? d.Canale == act.Canale : d.Canale == null)).FirstOrDefault();
                        ArticoliDescrizioni descrItem = artItem!.ArticoliDescrizionis!.Where(d => (d.Area == actArea  || (d.Area == null && actArea == null)) && (d.Canale == actCanale || (d.Canale == null && actCanale == null)) /*inserire custom */).FirstOrDefault()!;
                        if (descrItem == null)
                        {
                            //Creo priama revisione dell'articolo
                            descrItem = new ArticoliDescrizioni();
                            descrItem.IdArticolo = artItem.Id;
                            descrItem.Approvata = false;//Per ora è messo statico MA andrebbe messo controllo dac lient che ci dica se lo ha ereditato pari apri da tracciato
                            descrItem.Descrizione1 = act.Descrizione1;
                            descrItem.Descrizione2 = act.Descrizione2;
                            descrItem.Descrizione3 = act.Descrizione3;
                            descrItem.Descrizione4 = act.Descrizione4;
                            descrItem.Extra = componiExtraAutoFields(act.Extra, descrItem.Extra!);
                            if (act.DescrizioneIndd == null)
                                descrItem.DescrizioneIndd = "";
                            else
                                descrItem.DescrizioneIndd = act.DescrizioneIndd;

                            if (act.Peso > 0)
                                descrItem.Peso = act.Peso;
                            if (act.Um != null && act.Um != "")
                                descrItem.Um = act.Um;
                            descrItem.DataUltimaRicezione = DateTime.Now;
                            descrItem.FirmaTracciato = act.FirmaTracciato;
                            descrItem.Area = actArea;
                            //descrItem.Area = act.Area != null && act.Area != "" ? act.Area : null;
                            descrItem.Canale = actCanale;
                            //descrItem.Canale = act.Canale != null && act.Canale != "" ? act.Canale : null;

                            //inserire custom
                            descrItem.FirmaTracciato = firma_complessiva_gruppo;
                            descrItem.Meta = metaRev;
                            this.ctx.Add(descrItem);

                            descrItem.IdArticoloNavigation = this.ctx.Articolis.Where(a => a.Id == artItem.Id).FirstOrDefault()!;
                            codice = act.CodiceGruppo == "" ? descrItem.IdArticoloNavigation.Codice! : act.CodiceGruppo!;

                        }
                        else
                        {
                            codice = act.CodiceGruppo == "" ? descrItem.IdArticoloNavigation.Codice! : act.CodiceGruppo!;
                            descrItem.Descrizione1 = act.Descrizione1;
                            descrItem.Descrizione2 = act.Descrizione2;
                            descrItem.Descrizione3 = act.Descrizione3;
                            descrItem.Descrizione4 = act.Descrizione4;
                            descrItem.Extra = componiExtraAutoFields(act.Extra, descrItem.Extra!);

                            if (act.DescrizioneIndd == null)
                                descrItem.DescrizioneIndd = "";
                            else
                                descrItem.DescrizioneIndd = act.DescrizioneIndd;

                            if (act.Peso > 0)
                                descrItem.Peso = act.Peso;
                            if (act.Um != null && act.Um != "")
                                descrItem.Um = act.Um;
                            descrItem.DataUltimaRicezione = DateTime.Now;
                            descrItem.Area = actArea;
                            //descrItem.Area = act.Area != null && act.Area != "" ? act.Area : null;
                            descrItem.Canale = actCanale;
                            //descrItem.Canale = act.Canale != null && act.Canale != "" ? act.Canale : null;
                            descrItem.FirmaTracciato = firma_complessiva_gruppo;
                            descrItem.Meta = metaRev;
                        }


                        this.ctx.SaveChanges();

                        descrItemList.Add(descrItem);
                    }
                    else if (act.CodiceGruppo != null)
                    {
                        ArticoliDescrizioni? descrItem = await this.ctx.ArticoliDescrizionis.Where(d => d.CodiceGruppo == act.CodiceGruppo && (d.Area == actArea || (d.Area == null && actArea == null)) && (d.Canale == actCanale || (d.Canale == null && actCanale == null)) /*inserire custom */).FirstOrDefaultAsync();
                        //ArticoliDescrizioni descrItem = await this.ctx.ArticoliDescrizionis.Where(d => d.CodiceGruppo == act.CodiceGruppo && (act.areaRichiesta && act.Area != null && act.Area != "" ? d.Area == act.Area : d.Area == null) && (act.areaRichiesta && act.canaleRichiesto && act.Canale != null && act.Canale != "" ? d.Canale == act.Canale : d.Canale == null)).FirstOrDefaultAsync();

                        string firma_complessiva_gruppo = "";
                        List<PromoTracciatiRecord> recordsFirma = new List<PromoTracciatiRecord>();

                        if (idTracciato <= 0)
                        {
                            recordsFirma = GetRecordsFirmaGruppo(
                                acts.idPromo,
                                act.CodiceGruppo,
                                act.IsSottogruppo
                            );
                        }
                        else if (idTracciato > 0)
                        {
                            recordsFirma = GetRecordsFirmaGruppoDaTracciato(
                                idTracciato,
                                act.CodiceGruppo,
                                act.IsSottogruppo
                            );
                        }
                        else
                        {
                            result.error = "idPromo e idTracciato non validi";
                            result.Esito = false;
                            return Ok(result);
                        }

                        firma_complessiva_gruppo = Utility.Main.getFirmaTracciatoGruppoDaRecords(
                            recordsFirma,
                            act.CodiceGruppo,
                            act.IsSottogruppo
                        );


                        if (firma_complessiva_gruppo == GLOBAL_VARIABLES.keyMismatchFirma)
                        {
                            var gruppiPerTracciato = new List<WrapperGruppoConTracciato>();

                            // Raggruppiamo tutti i record per IdTracciato + Label
                            var gruppiRecords = recordsFirma
                                .GroupBy(f => new
                                {
                                    f.IdTracciato,
                                    f.Label
                                })
                                .ToList();

                            foreach (var gruppoRecords in gruppiRecords)
                            {
                                var firstRecord = gruppoRecords.FirstOrDefault();
                                if (firstRecord == null)
                                {
                                    continue;
                                }

                                var tracciato = this.ctx2.PromoTracciatis
                                    .Where(f => f.Id == firstRecord.IdTracciato)
                                    .FirstOrDefault();

                                var metaGruppo = new List<Dictionary<string, object>>();

                                foreach (var rec in gruppoRecords)
                                {
                                    var meta = Utility.Main.getJsonObject(rec.Dato);
                                    if (meta != null)
                                    {
                                        metaGruppo.Add(meta);
                                    }
                                }

                                if (metaGruppo.Count == 0)
                                {
                                    continue;
                                }

                                gruppiPerTracciato.Add(new WrapperGruppoConTracciato
                                {
                                    idTracciato = firstRecord.IdTracciato,
                                    gruppo = metaGruppo,
                                    siglaTracciato = tracciato?.Sigla ?? ""
                                });
                            }

                            var wrap = new WrapperPerGetGarante
                            {
                                idPromo = acts.idPromo,
                                gruppiPerTracciato = gruppiPerTracciato
                            };

                            Dictionary<string, object> _pass = new Dictionary<string, object>();

                            _pass["wrap"] = wrap;
                            string resultJson = icCtrl.execLibFunction(
                                $"AgenziaLib.{this._fico_conf.Value.nomeCliente}.GetMetaPerRevisioneDaGruppiMultipli",
                                _pass
                            ) as string;

                            var resultGarante = !string.IsNullOrWhiteSpace(resultJson)
                                ? JsonConvert.DeserializeObject<RitornoMetaPerRevisioneGarante>(resultJson)
                                : null;

                            metaRev = resultGarante?.metaRev ?? null;

                            if (resultGarante?.gruppo != null && resultGarante.gruppo.Count > 0)
                            {
                                firma_complessiva_gruppo = Utility.Main.getFirmaTracciatoGruppo(resultGarante.gruppo);
                            }
                            else
                            {
                                throw new Exception("Gruppo con codice " + act.CodiceGruppo + " non trovato durante l'estrazione del garante");
                            }
                        }
                        else
                        {
                            var el = recordsFirma[0];

                            // troviamo tutti i records con stesso idTracciato
                            var recordsStessoTracciato = recordsFirma
                                .Where(f => f.IdTracciato == el.IdTracciato && f.Label == el.Label)
                                .ToList();

                            // estraiamo i Meta di tutti i records con stesso idTracciato come List<Dictionary<string, object>>
                            List<Dictionary<string, object>> metaRecordsStessoTracciato = new List<Dictionary<string, object>>();

                            if (recordsStessoTracciato.Count > 0)
                            {
                                foreach (var rec in recordsStessoTracciato)
                                {
                                    var meta = Utility.Main.getJsonObject(rec.Dato);
                                    if (meta != null)
                                    {
                                        metaRecordsStessoTracciato.Add(meta);
                                    }
                                }
                            }

                            var tracciato = this.ctx2.PromoTracciatis
                                .Where(f => f.Id == el.IdTracciato)
                                .FirstOrDefault();

                            Dictionary<string, object> _pass = new Dictionary<string, object>();
                            _pass["recordsGruppo"] = metaRecordsStessoTracciato;
                            _pass["idPromo"] = acts.idPromo;
                            _pass["idTracciato"] = el.IdTracciato;
                            _pass["siglaTracciato"] = tracciato?.Sigla ?? "";

                            string metaResult = icCtrl.execLibFunction(
                                $"AgenziaLib.{this._fico_conf.Value.nomeCliente}.MetaPerRevisione",
                                _pass
                            ) as string;

                            metaRev = metaResult ?? null;
                        }



                        if (descrItem == null)
                        {
                            //recuperiamo il recordInTracciato per formare la firma con hash
                            //var recsInTrac = await this.ctx2.PromoTracciatiRecords.Where(r => r.CodiceGruppo == act.CodiceGruppo && r.IdTracciato == idTracciato).ToListAsync();
                            //List<Dictionary<string, object>> recsInTracData = recsInTrac.Select(s => Utility.Main.getJsonObject(s.Dato!)!).ToList(); 


                            //Creo priama revisione dell'articolo
                            descrItem = new ArticoliDescrizioni();
                            descrItem.CodiceGruppo = act.CodiceGruppo;
                            descrItem.Approvata = false;//Per ora è messo statico MA andrebbe messo controllo dac lient che ci dica se lo ha ereditato pari apri da tracciato
                            descrItem.Descrizione1 = act.Descrizione1;
                            descrItem.Descrizione2 = act.Descrizione2;
                            descrItem.Descrizione3 = act.Descrizione3;
                            descrItem.Descrizione4 = act.Descrizione4;
                            descrItem.DescrizioneIndd = act.DescrizioneIndd;
                            descrItem.Extra = componiExtraAutoFields(act.Extra, descrItem.Extra!);

                            if (act.Peso > 0)
                                descrItem.Peso = act.Peso;
                            if (act.Um != null && act.Um != "")
                                descrItem.Um = act.Um;
                            descrItem.DataUltimaRicezione = DateTime.Now;
                            descrItem.Area = actArea;
                            //descrItem.Area = act.areaRichiesta && act.Area != null && act.Area != "" ? act.Area : null;
                            descrItem.Canale = actCanale;
                            descrItem.Meta = metaRev;
                            descrItem.FirmaTracciato = firma_complessiva_gruppo;

                            //descrItem.Canale = act.canaleRichiesto && act.Canale != null && act.Canale != "" ? act.Canale : null;

                            //if (idTracciato > 0)
                            //{
                            //    var promoTracciatiGruppo = GetRecordsFirmaGruppoDaTracciato(
                            //        idTracciato,
                            //        act.CodiceGruppo,
                            //        act.IsSottogruppo
                            //    );

                            //    descrItem.FirmaTracciato = Utility.Main.getFirmaTracciatoGruppoDaRecords(
                            //        promoTracciatiGruppo,
                            //        act.CodiceGruppo,
                            //        act.IsSottogruppo
                            //    );
                            //}
                            //else
                            //{
                            //    descrItem.FirmaTracciato = firma_complessiva_gruppo != ""
                            //        ? firma_complessiva_gruppo
                            //        : GLOBAL_VARIABLES.keyMismatchFirma;

                            //}



                            this.ctx.Add(descrItem);

                        }
                        else
                        {
                            descrItem.Descrizione1 = act.Descrizione1;
                            descrItem.Descrizione2 = act.Descrizione2;
                            descrItem.Descrizione3 = act.Descrizione3;
                            descrItem.Descrizione4 = act.Descrizione4;
                            descrItem.DescrizioneIndd = act.DescrizioneIndd;
                            descrItem.Extra = componiExtraAutoFields(act.Extra, descrItem.Extra!);

                            if (act.Peso > 0)
                                descrItem.Peso = act.Peso;
                            if (act.Um != null && act.Um != "")
                                descrItem.Um = act.Um;
                            descrItem.DataUltimaRicezione = DateTime.Now;
                            descrItem.Area = actArea;
                            //descrItem.Area = act.areaRichiesta && act.Area != null && act.Area != "" ? act.Area : null;
                            descrItem.Canale = actCanale;
                            descrItem.Meta = metaRev;
                            descrItem.FirmaTracciato = firma_complessiva_gruppo;
                            //descrItem.Canale = act.canaleRichiesto && act.Canale != null && act.Canale != "" ? act.Canale : null;
                            //descrItem.FirmaTracciato = act.FirmaTracciato;
                            //if (idTracciato > 0)
                            //{                                 
                            //    List<Dictionary<string, object>> _membriGruppo = this.ctx2.PromoTracciatiRecords.Where(p => p.IdTracciato == idTracciato && p.CodiceGruppo == act.CodiceGruppo).ToList().Select(s => Utility.Main.getJsonObject(s.Dato!)).ToList()!;
                            //    descrItem.FirmaTracciato = Utility.Main.getFirmaTracciatoGruppo(_membriGruppo);
                            //}
                            //else
                            //{
                            //    if (firma_complessiva_gruppo != "")
                            //        descrItem.FirmaTracciato = firma_complessiva_gruppo;// act.FirmaTracciato;
                            //    else
                            //        descrItem.FirmaTracciato = null;// act.FirmaTracciato;
                            //}
                            //if (idTracciato > 0)
                            //{
                            //    var promoTracciatiGruppo = GetRecordsFirmaGruppoDaTracciato(
                            //        idTracciato,
                            //        act.CodiceGruppo,
                            //        act.IsSottogruppo
                            //    );

                            //    descrItem.FirmaTracciato = Utility.Main.getFirmaTracciatoGruppoDaRecords(
                            //        promoTracciatiGruppo,
                            //        act.CodiceGruppo,
                            //        act.IsSottogruppo
                            //    );
                            //}
                            //else
                            //{
                            //    descrItem.FirmaTracciato = firma_complessiva_gruppo != ""
                            //    ? firma_complessiva_gruppo
                            //    : GLOBAL_VARIABLES.keyMismatchFirma;
                            //}

                        }


                        this.ctx.SaveChanges();

                        descrItemList.Add(descrItem);
                        //return Ok(descrItem);
                    }
                    


                    var register = new Register(_config.GetConnectionString("IstandaConnectionDb")!, this._dbContextFactory, dbContextFactory2: this._dbContextFactory2);
                    if (idOperazione == 0)
                    {
                        //l'operazione è stata autorizzata per cui procediamo a creare l'operazione sul DB
                        var nuovaOperazione = new RegistroOperazioni();
                        nuovaOperazione.Area = actArea != null ? actArea : "";
                        //nuovaOperazione.Area = act.areaRichiesta ? act.Area : "";
                        nuovaOperazione.Canale = actCanale != null ? actCanale : "";
                        //nuovaOperazione.Canale = act.canaleRichiesto ? act.Canale : "";
                        nuovaOperazione.Stato = (byte)statoOperazioni.risolta;
                        nuovaOperazione.Autore = int.Parse(session);
                        var data = DateTime.Now;
                        nuovaOperazione.TipoOperazione = (byte)tipoOperazione.revisione;
                        nuovaOperazione.IdTracciato = idTracciato;
                        nuovaOperazione.CodiceAssociato = codice != "" ? codice! : act.CodiceGruppo!;

                        RevisioneDescrizione revReg = new RevisioneDescrizione();
                        revReg.descrizione1 = act.Descrizione1;
                        revReg.descrizione2 = act.Descrizione2;
                        revReg.descrizione3 = act.Descrizione3;
                        revReg.descrizione4 = act.Descrizione4;
                        revReg.valoreIndd = act.DescrizioneIndd;
                        revReg.valore = "";
                        revReg.meta = metaRev;


                        nuovaOperazione.FormData = JsonConvert.SerializeObject(revReg);
                        nuovaOperazione.Url = sender == senderOperazione.indd ? "Revisore/SincronizzaModificheIndd" : "Revisore/salva";
                        register.addOperazione(nuovaOperazione, true, session, DateTime.Now);
                    }
                    else
                    {
                        register.updateOperazione(idOperazione, statoOperazioni.risolta, session);
                    }
                }
                catch (Exception ex)
                {
                    result.error = ex.ToString();
                    erroreDuranteIlSalvataggio = ex;
                }    
            }
            if (erroreDuranteIlSalvataggio != null)
            {
                // Prima questo errore finiva in result.error, che non veniva mai restituito:
                // il chiamante riceveva 200 con una lista vuota e non sapeva che era fallito.
                var _radice = erroreDuranteIlSalvataggio;
                while (_radice.InnerException != null) _radice = _radice.InnerException;
                return StatusCode(500, new { error = _radice.Message, tipo = _radice.GetType().Name });
            }
            return Ok(descrItemList);
        }


        private List<PromoTracciatiRecord> GetRecordsFirmaGruppo(
    int idPromo,
    string codiceGruppo,
    bool isSottogruppo)
        {
            var query = this.ctx2.PromoTracciatiRecords
                .Include(r => r.IdTracciatoNavigation)
                .Where(r => r.IdTracciatoNavigation.IdPromo == idPromo);

            if (!isSottogruppo)
            {
                return query
                    .Where(r => r.CodiceGruppo == codiceGruppo)
                    .ToList();
            }

            var codiciSingoliAttesi = codiceGruppo
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            return query
                .Where(r => codiciSingoliAttesi.Contains(r.Codice))
                .ToList();
        }

        private List<PromoTracciatiRecord> GetRecordsFirmaGruppoDaTracciato(
    int idTracciato,
    string codiceGruppo,
    bool isSottogruppo)
        {
            var query = this.ctx2.PromoTracciatiRecords
                .Include(r => r.IdTracciatoNavigation)
                .Where(r => r.IdTracciato == idTracciato);

            if (!isSottogruppo)
            {
                return query
                    .Where(r => r.CodiceGruppo == codiceGruppo)
                    .ToList();
            }

            var codiciSingoliAttesi = codiceGruppo
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            return query
                .Where(r => codiciSingoliAttesi.Contains(r.Codice))
                .ToList();
        }

        public string componiExtraAutoFields(Dictionary<string, ExtraAutoFIelds> nuoviExtraAuto, string extraAttuali)
        {
            // 1) Carico l'eventuale JSON esistente; se vuoto creo un oggetto vuoto
            JObject jExtra =
                string.IsNullOrWhiteSpace(extraAttuali)
                    ? new JObject()
                    : JObject.Parse(extraAttuali);

            // 2) Itero su tutti i nuovi campi da aggiornare/aggiungere
            foreach (var kvp in nuoviExtraAuto)
            {
                string key = kvp.Key;
                ExtraAutoFIelds field = kvp.Value;

                // 3) Se il content è null, rimuovo la chiave dal JObject (se esiste)
                if (field.content == null)
                {
                    jExtra.Remove(key);
                    continue;
                }

                // 4) Serializzo 'content' in modo corretto a seconda del tipo
                JToken contentToken;
                switch (field.type)
                {
                    case extraAutoTypeContent.stringa:
                        contentToken = new JValue(field.content);
                        break;

                    default:
                        contentToken = JToken.Parse(field.content);
                        break;
                }

                // 5) Costruisco l'oggetto da inserire/aggiornare
                var fieldObj = new JObject
                {
                    ["type"] = field.type.ToString(),
                    ["content"] = contentToken
                };

                // 6) Aggiungo o sovrascrivo la chiave
                jExtra[key] = fieldObj;
            }

            // 7) Ritorno tutto come stringa JSON compatta
            return jExtra.ToString(Newtonsoft.Json.Formatting.None);
        }

        [HttpPut]
        [Route("Revisore/elimina/{idTracciato}/{idOperazione}/{sender}")]
        public async Task<IActionResult> elimina(RevisioniActions acts, int idTracciato = 0, int idOperazione = 0, senderOperazione sender = senderOperazione.istanta)
        {
            BoolResult result = new BoolResult();
            var session = SessionIstantaObject.GetSession(HttpContext);
            if (session.ToLower() == "no session" || session == null || session == "")
            {
                result.Esito = false;
                result.error = "no session";
                return Ok(result);
            }
            List<ArticoliDescrizioni> descrItemList = new List<ArticoliDescrizioni>();
            foreach (RevisioneAction act in acts.coda)
            {
                try
                {
                    var actArea = act.revRegionale != null ? act.revRegionale.area : null;
                    var actCanale = act.revRegionale != null ? act.revRegionale.canale : null;
                    var actCustom = act.revRegionale != null ? act.revRegionale.custom : null;
                    /*List<RevisioneAction> coda = pkg.coda;

                    foreach (RevisioneAction act in coda)
                    {*/
                    string codice = "";
                    if (act.Codice != "")
                    {

                        Articoli? artItem = await this.ctx.Articolis.Include(f => f.ArticoliDescrizionis).Where(f => f.Codice == act.Codice).FirstOrDefaultAsync();
                        if (artItem == null)
                        {
                            throw new Exception("Articolo " + act.Codice + " non trovato in articoli descrizioni");
                        }


                        //ArticoliDescrizioni descrItem = artItem.ArticoliDescrizionis.Where(d => (act.areaRichiesta && act.Area != null && act.Area != "" ? d.Area == act.Area : d.Area == null) && (act.areaRichiesta && act.canaleRichiesto && act.Canale != null && act.Canale != "" ? d.Canale == act.Canale : d.Canale == null)).FirstOrDefault();
                        ArticoliDescrizioni? descrItem = artItem.ArticoliDescrizionis!.Where(d => (d.Area == actArea || (d.Area == null && actArea == null)) && (d.Canale == actCanale || (d.Canale == null && actCanale == null)) /*inserire custom */).FirstOrDefault();
                        if (descrItem == null)
                        {
                            throw new Exception("Revisione non trovata");

                        }
                        else
                        {
                            this.ctx.ArticoliDescrizionis.Remove(descrItem);
                        }

                        this.ctx.SaveChanges();
                    }
                    else if (act.CodiceGruppo != null)
                    {
                        ArticoliDescrizioni? descrItem = await this.ctx.ArticoliDescrizionis.Where(d => d.CodiceGruppo == act.CodiceGruppo && (d.Area == actArea || (d.Area == null && actArea == null)) && (d.Canale == actCanale || (d.Canale == null && actCanale == null)) /*inserire custom */).FirstOrDefaultAsync();
                        //ArticoliDescrizioni descrItem = await this.ctx.ArticoliDescrizionis.Where(d => d.CodiceGruppo == act.CodiceGruppo && (act.areaRichiesta && act.Area != null && act.Area != "" ? d.Area == act.Area : d.Area == null) && (act.areaRichiesta && act.canaleRichiesto && act.Canale != null && act.Canale != "" ? d.Canale == act.Canale : d.Canale == null)).FirstOrDefaultAsync();
                        if (descrItem == null)
                        {
                            throw new Exception("Revisione non trovata");
                        }
                        else
                        {
                            this.ctx.ArticoliDescrizionis.Remove(descrItem);
                        }

                            this.ctx.SaveChanges();
                    }



                    var register = new Register(_config.GetConnectionString("IstandaConnectionDb")!, this._dbContextFactory, dbContextFactory2: this._dbContextFactory2);
                    if (idOperazione == 0)
                    {
                        //l'operazione è stata autorizzata per cui procediamo a creare l'operazione sul DB
                        var nuovaOperazione = new RegistroOperazioni();
                        nuovaOperazione.Area = actArea != null ? actArea : "";
                        //nuovaOperazione.Area = act.areaRichiesta ? act.Area : "";
                        nuovaOperazione.Canale = actCanale != null ? actCanale : "";
                        //nuovaOperazione.Canale = act.canaleRichiesto ? act.Canale : "";
                        nuovaOperazione.Stato = (byte)statoOperazioni.risolta;
                        nuovaOperazione.Autore = int.Parse(session);
                        var data = DateTime.Now;
                        nuovaOperazione.TipoOperazione = (byte)tipoOperazione.revisione;
                        nuovaOperazione.IdTracciato = idTracciato;
                        nuovaOperazione.CodiceAssociato = codice != "" ? codice! : act.CodiceGruppo!;

                        RevisioneDescrizione revReg = new RevisioneDescrizione();
                        revReg.descrizione1 = "";
                        revReg.descrizione2 = "";
                        revReg.descrizione3 = "";
                        revReg.descrizione4 ="";
                        revReg.valoreIndd = "";
                        revReg.valore = "";


                        nuovaOperazione.FormData = JsonConvert.SerializeObject(revReg);
                        nuovaOperazione.Url = sender == senderOperazione.indd ? "Revisore/SincronizzaModificheIndd" : "Revisore/salva";
                        register.addOperazione(nuovaOperazione, true, session, DateTime.Now);
                    }
                    else
                    {
                        register.updateOperazione(idOperazione, statoOperazioni.risolta, session);
                    }
                    result.Esito = true;
                }
                catch (Exception ex)
                {
                    result.error = ex.ToString();
                }
            }
            return Ok(result);
        }


        public IActionResult Sync()
        {

            ViewBag.listaPromoAttive = this.ctx2.Promos.Include(i => i.PromoTracciatis).Include(i2 => i2.PromoImportazionis).Where(p => p.DataScadenza.HasValue && p.DataScadenza.Value >= DateTime.Now).ToList();            
            return View("Sync");
        }

        [HttpPut]
        [Route("Revisore/searchTracciatoByTitle")]
        public async Task<IActionResult> searchTracciatoByTitle([FromForm] string title)
        {

            try
            {
                
                string titleParsed = title.Substring(0, title.IndexOf("."));
                var tracciati = await this.ctx2.PromoTracciatis.Include(i=>i.IdPromoNavigation).Where(t=>t.Sigla==titleParsed).ToListAsync();

                return Ok(tracciati);
            }
            catch(Exception ex)
            {
               return Ok(ex.ToString());
            }

        }

        [HttpGet]
        [Route("Revisore/searchTracciatoByPromo/{idPromo}")]
        public async Task<IActionResult> searchTracciatoByPromo(int idPromo)
        {

            try
            {

                var tracciati = await this.ctx2.PromoTracciatis.Where(t => t.IdPromo==idPromo).ToListAsync();

                return Ok(tracciati);
            }
            catch (Exception ex)
            {
                return Ok(ex.ToString());
            }

        }
        
        [HttpGet]
        [Route("Revisore/AggiungiASottogruppo/{id_rec}/{id_rec_pilota}/{id_tracciato}/{propaga}")]

        public async Task<IActionResult> AggiungiSottogruppo(Int64 id_rec, Int64 id_rec_pilota, int id_tracciato, bool propaga)
        {
            CodiciConSottogruppo result = new CodiciConSottogruppo();
            if (id_tracciato == 0)
            {
                result.error = "tracciato non arrivato";
                return Ok(result);
            }

            string codiceGruppo;
            string key_codice_sottogruppo = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceSottogruppo;
            string key_codice_referenza = Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice;

            List<PromoTracciatiRecord> RecordDaAnalizzare = new List<PromoTracciatiRecord>();
            try
            {
                //cerco se il pilota fa già parte di un sottogruppo
                PromoTracciatiRecord? pilota = ctx2.PromoTracciatiRecords.Where(f => f.Id== id_rec_pilota).FirstOrDefault();
                Dictionary<string, object>? DatoPilota = JsonConvert.DeserializeObject<Dictionary<string, object>>(pilota!.Dato!);
                List<PromoTracciatiRecord> RecordDaModificare = new List<PromoTracciatiRecord>();
                List<PromoTracciatiRecord> recordDaRitornare = new List<PromoTracciatiRecord>();
                
                List<string> codici = new List<string>();
                PromoTracciatiRecord? element = ctx2.PromoTracciatiRecords.Include(f=>f.IdTracciatoNavigation).Where(f => f.Id == id_rec).FirstOrDefault();
                Dictionary<string, object>? Dato = JsonConvert.DeserializeObject<Dictionary<string, object>>(element!.Dato!);
                recordDaRitornare.Add(element);
                List<int> idsTracciatiPromo = ctx2.PromoTracciatis.Where(f => f.IdPromo == element.IdTracciatoNavigation.IdPromo).Select(f => f.Id).ToList();
                string codiceSottogruppo = "";
                if (DatoPilota!.ContainsKey(key_codice_sottogruppo))
                {
                    codiceSottogruppo = DatoPilota[key_codice_sottogruppo].ToString()!;
                    codiceGruppo = pilota.CodiceGruppo!;

                    if (propaga)
                    {
                        RecordDaAnalizzare.AddRange(ctx2.PromoTracciatiRecords.Where(f => f.CodiceGruppo == codiceGruppo && idsTracciatiPromo.Contains(f.IdTracciato)));
                        RecordDaAnalizzare = RecordDaAnalizzare.OrderBy(f => f.IdTracciato).ToList();

                        foreach (PromoTracciatiRecord r in RecordDaAnalizzare)
                        {
                            Dictionary<string, object>? DatoAnalisi = JsonConvert.DeserializeObject<Dictionary<string, object>>(r.Dato!);
                            if (DatoAnalisi!.ContainsKey(key_codice_sottogruppo) && DatoAnalisi[key_codice_sottogruppo].ToString() == codiceSottogruppo && r.IdTracciato == id_tracciato)
                            {
                                recordDaRitornare.Add(r);
                            }
                        }

                        List<PromoTracciatiRecord> tmpListDaAnalizzare = new List<PromoTracciatiRecord>();
                        foreach(PromoTracciatiRecord r in recordDaRitornare)
                        {
                            tmpListDaAnalizzare.AddRange(RecordDaAnalizzare.Where(f => Utility.Main.getJsonObjectAndGetValueOfKey(f.Dato!, key_codice_referenza) == Utility.Main.getJsonObjectAndGetValueOfKey(r.Dato!, key_codice_referenza)));
                        }
                        RecordDaAnalizzare = tmpListDaAnalizzare;

                        List<int> ids = new List<int>();
                        foreach (PromoTracciatiRecord r in RecordDaAnalizzare) //rimuovo i tracciati che non posso modificare
                        {
                            Dictionary<string, object>? DatoTmp = JsonConvert.DeserializeObject<Dictionary<string, object>>(r.Dato!);
                            if (DatoTmp!.ContainsKey(key_codice_sottogruppo) && DatoTmp[key_codice_sottogruppo].ToString() != DatoPilota[key_codice_sottogruppo].ToString() && !ids.Contains(r.IdTracciato))
                            {
                                ids.Add(r.IdTracciato);
                            }
                        }
                        foreach (int id in ids)
                        {
                            RecordDaAnalizzare.RemoveAll(f => f.IdTracciato == id);
                            result.tracciatiNonModificati!.Add(ctx2.PromoTracciatis.Where(f => f.Id == id).FirstOrDefault()!.Sigla!);
                        }

                        RecordDaModificare.AddRange(recordDaRitornare);
                        List<PromoTracciatiRecord> tmpList= new List<PromoTracciatiRecord>();
                        foreach (PromoTracciatiRecord p in RecordDaModificare)
                        {
                            string? CodRef = Utility.Main.getJsonObjectAndGetValueOfKey(p.Dato!, key_codice_referenza);
                            tmpList.AddRange(RecordDaAnalizzare.Where(f => (Utility.Main.getJsonObjectAndGetValueOfKey(f.Dato!, key_codice_referenza) == CodRef) && f.IdTracciato != id_tracciato));
                        }
                        RecordDaModificare.AddRange(tmpList);
                    }
                    else
                    {
                        RecordDaModificare.Add(element);
                        RecordDaAnalizzare.AddRange(ctx2.PromoTracciatiRecords.Where(f => f.CodiceGruppo == codiceGruppo && idsTracciatiPromo.Contains(f.IdTracciato)));
                        foreach (PromoTracciatiRecord r in RecordDaAnalizzare)
                        {
                            Dictionary<string, object>? DatoDaAnalizzare = JsonConvert.DeserializeObject<Dictionary<string, object>>(r.Dato!);
                            if (DatoDaAnalizzare!.ContainsKey(key_codice_sottogruppo) && DatoDaAnalizzare[key_codice_sottogruppo].ToString() == codiceSottogruppo)
                            {
                                RecordDaModificare.Add(r);
                                recordDaRitornare.Add(r);
                            }
                        }
                    }
                }
                else
                {
                    codiceGruppo = pilota.CodiceGruppo!;
                    if (propaga)
                    {
                        recordDaRitornare.Add(pilota);
                        RecordDaAnalizzare.AddRange(ctx2.PromoTracciatiRecords.Where(f => f.CodiceGruppo == codiceGruppo && idsTracciatiPromo.Contains(f.IdTracciato)));

                        List<PromoTracciatiRecord> tmpListDaAnalizzare = new List<PromoTracciatiRecord>();
                        foreach (PromoTracciatiRecord r in recordDaRitornare)
                        {
                            tmpListDaAnalizzare.AddRange(RecordDaAnalizzare.Where(f => Utility.Main.getJsonObjectAndGetValueOfKey(f.Dato!, key_codice_referenza) == Utility.Main.getJsonObjectAndGetValueOfKey(r.Dato!, key_codice_referenza)));
                        }
                        RecordDaAnalizzare = tmpListDaAnalizzare;

                        List<int> ids = new List<int>();
                        foreach (PromoTracciatiRecord r in RecordDaAnalizzare)
                        {
                            Dictionary<string, object>? DatoTmp = JsonConvert.DeserializeObject<Dictionary<string, object>>(r.Dato!);
                            if (DatoTmp!.ContainsKey(key_codice_sottogruppo) && !ids.Contains(r.IdTracciato))
                            {
                                ids.Add(r.IdTracciato);
                            }
                        }
                        foreach(int id in ids)
                        {
                            RecordDaAnalizzare.RemoveAll(f=>f.IdTracciato==id);
                            result.tracciatiNonModificati!.Add(ctx2.PromoTracciatis.Where(f => f.Id == id).FirstOrDefault()!.Sigla!);
                        }

                        RecordDaModificare.AddRange(RecordDaAnalizzare.Where(r => (Utility.Main.getJsonObjectAndGetValueOfKey(r.Dato!, key_codice_referenza) == DatoPilota[key_codice_referenza].ToString() && Utility.Main.getJsonObjectAndGetValueOfKey(r.Dato!, key_codice_sottogruppo) == "" || Utility.Main.getJsonObjectAndGetValueOfKey(r.Dato!, key_codice_referenza) == Dato![key_codice_referenza].ToString()) && Utility.Main.getJsonObjectAndGetValueOfKey(r.Dato!, key_codice_sottogruppo) == ""));
                        
                    }
                    else
                    {
                        RecordDaModificare.Add(element);
                        RecordDaModificare.Add(pilota);
                        recordDaRitornare.Add(pilota);
                    }                    
                }

                foreach (PromoTracciatiRecord D in RecordDaModificare)
                {
                    Dictionary<string, object>? DatoRecord = JsonConvert.DeserializeObject<Dictionary<string, object>>(D.Dato!);
                    codici.Add(DatoRecord![key_codice_referenza].ToString()!);
                }
                codici = codici.GroupBy(s => s).Select(g => g.Key).ToList();
                codici.Sort();

                codiceSottogruppo = "";
                foreach (string cod in codici)
                {
                    codiceSottogruppo += cod + ",";
                }
                codiceSottogruppo = codiceSottogruppo.Substring(0, codiceSottogruppo.Length - 1);

                foreach (PromoTracciatiRecord D in RecordDaModificare)
                {
                    Dictionary<string, object>? DatoRecord = JsonConvert.DeserializeObject<Dictionary<string, object>>(D.Dato!);
                    DatoRecord![key_codice_sottogruppo] = codiceSottogruppo;
                    D.Dato = JsonConvert.SerializeObject(DatoRecord);
                }
                this.ctx2.SaveChanges();
                foreach (PromoTracciatiRecord r in recordDaRitornare)
                {
                    result.idRecDaModificare!.Add(r.Id);
                }
                result.codiceSottogruppo = codiceSottogruppo;
            }
            catch (Exception ex)
            {
                result.error = ex.Message;
            }

            return Ok(result);
        }


        [HttpGet]
        [Route("Revisore/RimuoviDaSottogruppo/{id_rec}/{id_rec_pilota}/{id_tracciato}/{propaga}")]

        public async Task<IActionResult> RimuoviDaSottogruppo(Int64 id_rec, Int64 id_rec_pilota, int id_tracciato, bool propaga)
        {
            CodiciConSottogruppo result = new CodiciConSottogruppo();
            if (id_tracciato == 0)
            {
                result.error = "tracciato non inviato in rimozione";
                return Ok(result);
            }
            string codiceGruppo;
            string key_codice_sottogruppo = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceSottogruppo;
            string key_codice_referenza = Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice;

            List<PromoTracciatiRecord> RecordDaAnalizzare = new List<PromoTracciatiRecord>();
            try
            {
                PromoTracciatiRecord? pilota = ctx2.PromoTracciatiRecords.Where(f => f.Id == id_rec_pilota).FirstOrDefault();
                Dictionary<string, object>? DatoPilota = JsonConvert.DeserializeObject<Dictionary<string, object>>(pilota!.Dato!);
                List<PromoTracciatiRecord> RecordDaModificare = new List<PromoTracciatiRecord>();
                List<PromoTracciatiRecord> recordDaRitornare = new List<PromoTracciatiRecord>();

                List<string> codici = new List<string>();
                PromoTracciatiRecord? element = ctx2.PromoTracciatiRecords.Include(f => f.IdTracciatoNavigation).Where(f => f.Id == id_rec).FirstOrDefault();
                Dictionary<string, object>? Dato = JsonConvert.DeserializeObject<Dictionary<string, object>>(element!.Dato!);
                string? codiceSottogruppoRimosso = Dato![key_codice_sottogruppo].ToString();
                Dato.Remove(key_codice_sottogruppo);
                element.Dato = JsonConvert.SerializeObject(Dato);
                this.ctx2.SaveChanges();

                List<int> idsTracciatiPromo = ctx2.PromoTracciatis.Where(f => f.IdPromo == element.IdTracciatoNavigation.IdPromo).Select(f => f.Id).ToList();
                codiceGruppo = pilota.CodiceGruppo!;
                if (propaga)
                {
                    RecordDaAnalizzare.AddRange(ctx2.PromoTracciatiRecords.Where(f => f.CodiceGruppo == codiceGruppo && idsTracciatiPromo.Contains(f.IdTracciato)));
                    List<PromoTracciatiRecord> tmpListDaAnalizzare = new List<PromoTracciatiRecord>();

                    tmpListDaAnalizzare.AddRange(RecordDaAnalizzare.Where(f => Utility.Main.getJsonObjectAndGetValueOfKey(f.Dato!, key_codice_referenza) == Utility.Main.getJsonObjectAndGetValueOfKey(element.Dato, key_codice_referenza)));

                    RecordDaAnalizzare = tmpListDaAnalizzare;
                    RecordDaModificare.AddRange(RecordDaAnalizzare.Where(r => Utility.Main.getJsonObjectAndGetValueOfKey(r.Dato!, key_codice_referenza) == Dato[key_codice_referenza].ToString() && Utility.Main.getJsonObjectAndGetValueOfKey(r.Dato!, key_codice_sottogruppo) == codiceSottogruppoRimosso));
                    foreach (PromoTracciatiRecord r in RecordDaModificare)
                    {
                        Dictionary<string, object>? DatoRimossoDaCopie = JsonConvert.DeserializeObject<Dictionary<string, object>>(r.Dato!);
                        DatoRimossoDaCopie!.Remove(key_codice_sottogruppo);
                        r.Dato = JsonConvert.SerializeObject(DatoRimossoDaCopie);
                    }
                    this.ctx2.SaveChanges();
                    RecordDaAnalizzare.Clear();
                    RecordDaModificare.Clear();
                }

                string codiceSottogruppo = "";
                if (DatoPilota!.ContainsKey(key_codice_sottogruppo))
                {
                    codiceSottogruppo = DatoPilota[key_codice_sottogruppo].ToString()!;
                    codiceGruppo = pilota.CodiceGruppo!;

                    if (propaga)
                    {

                        RecordDaAnalizzare.AddRange(ctx2.PromoTracciatiRecords.Where(f => f.CodiceGruppo == codiceGruppo && idsTracciatiPromo.Contains(f.IdTracciato)));
                        RecordDaAnalizzare = RecordDaAnalizzare.OrderBy(f => f.IdTracciato).ToList();

                        foreach (PromoTracciatiRecord r in RecordDaAnalizzare)
                        {
                            Dictionary<string, object>? DatoDaAnalizzare = JsonConvert.DeserializeObject<Dictionary<string, object>>(r.Dato!);
                            if (DatoDaAnalizzare!.ContainsKey(key_codice_sottogruppo) && DatoDaAnalizzare[key_codice_sottogruppo].ToString() == codiceSottogruppo && r.IdTracciato == id_tracciato)
                            {
                                RecordDaModificare.Add(r);
                                recordDaRitornare.Add(r);
                            }
                        }



                        List<PromoTracciatiRecord> tmpListDaAnalizzare = new List<PromoTracciatiRecord>();
                        foreach (PromoTracciatiRecord r in recordDaRitornare)
                        {
                            tmpListDaAnalizzare.AddRange(RecordDaAnalizzare.Where(f => Utility.Main.getJsonObjectAndGetValueOfKey(f.Dato!, key_codice_referenza) == Utility.Main.getJsonObjectAndGetValueOfKey(r.Dato!, key_codice_referenza)));
                        }
                        RecordDaAnalizzare = tmpListDaAnalizzare;

                        List<int> ids = new List<int>();
                        foreach (PromoTracciatiRecord r in RecordDaAnalizzare)
                        {
                            Dictionary<string, object>? DatoTmp = JsonConvert.DeserializeObject<Dictionary<string, object>>(r.Dato!);
                            if (DatoTmp!.ContainsKey(key_codice_sottogruppo) && DatoTmp[key_codice_sottogruppo].ToString() != codiceSottogruppoRimosso && !ids.Contains(r.IdTracciato))
                            {
                                ids.Add(r.IdTracciato);
                            }
                        }
                        foreach (int id in ids)
                        {
                            RecordDaAnalizzare.RemoveAll(f => f.IdTracciato == id);
                            result.tracciatiNonModificati!.Add(ctx2.PromoTracciatis.Where(f => f.Id == id).FirstOrDefault()!.Sigla!);
                        }

                        List<PromoTracciatiRecord> tmpList = new List<PromoTracciatiRecord>();
                        foreach (PromoTracciatiRecord p in RecordDaModificare)
                        {
                            string? CodRef = Utility.Main.getJsonObjectAndGetValueOfKey(p.Dato!, key_codice_referenza);
                            tmpList.AddRange(RecordDaAnalizzare.Where(f => (Utility.Main.getJsonObjectAndGetValueOfKey(f.Dato!, key_codice_referenza) == CodRef) && f.IdTracciato != id_tracciato));
                        }
                        RecordDaModificare.AddRange(tmpList);
                    }
                    else
                    {
                        RecordDaAnalizzare.AddRange(ctx2.PromoTracciatiRecords.Where(f => f.CodiceGruppo == codiceGruppo && f.IdTracciato == id_tracciato));
                        foreach (PromoTracciatiRecord r in RecordDaAnalizzare)
                        {
                            Dictionary<string, object>? DatoDaAnalizzare = JsonConvert.DeserializeObject<Dictionary<string, object>>(r.Dato!);
                            if (DatoDaAnalizzare!.ContainsKey(key_codice_sottogruppo) && DatoDaAnalizzare[key_codice_sottogruppo].ToString() == codiceSottogruppo)
                            {
                                RecordDaModificare.Add(r);
                                recordDaRitornare.Add(r);
                            }
                        }
                    }

                }
                else
                {
                    throw new Exception("Il pilota non risulta parte di un gruppo, incongruenza fra database e dato locale");
                }

                if (recordDaRitornare.Count > 1)
                {
                    foreach (PromoTracciatiRecord D in RecordDaModificare)
                    {
                        Dictionary<string, object>? DatoRecord = JsonConvert.DeserializeObject<Dictionary<string, object>>(D.Dato!);
                        codici.Add(DatoRecord![key_codice_referenza].ToString()!);
                    }
                    codici = codici.GroupBy(s => s).Select(g => g.Key).ToList();
                    codici.Sort();
                    codiceSottogruppo = "";
                    foreach (string cod in codici)
                    {
                        codiceSottogruppo += cod + ",";
                    }
                    codiceSottogruppo = codiceSottogruppo.Substring(0, codiceSottogruppo.Length - 1);

                    foreach (PromoTracciatiRecord D in RecordDaModificare)
                    {
                        Dictionary<string, object>? DatoRecord = JsonConvert.DeserializeObject<Dictionary<string, object>>(D.Dato!);
                        DatoRecord![key_codice_sottogruppo] = codiceSottogruppo;
                        D.Dato = JsonConvert.SerializeObject(DatoRecord);
                    }
                }
                else
                {
                    codiceSottogruppo = "";
                    foreach (PromoTracciatiRecord D in RecordDaModificare)
                    {
                        Dictionary<string, object>? DatoDaRimuovere = JsonConvert.DeserializeObject<Dictionary<string, object>>(D.Dato!);
                        DatoDaRimuovere!.Remove(key_codice_sottogruppo);
                        D.Dato = JsonConvert.SerializeObject(DatoDaRimuovere);
                    }
                }
                this.ctx2.SaveChanges();
                foreach(PromoTracciatiRecord r in recordDaRitornare)
                {
                    result.idRecDaModificare!.Add(r.Id);
                }
                result.codiceSottogruppo = codiceSottogruppo;
            }
            catch (Exception ex)
            {
                result.error = ex.Message;
            }

            return Ok(result);
        }

        [HttpGet]
        [Route("Revisore/ControllaRevisioniPromo/{idpromo}")]

        public async Task<IActionResult> ControllaRevisioniPromo(Int64 idpromo)
        {
            int revisioniDaEseguire = 0;
            var firma = Enum.GetName(AddestramentoRuoli.Tracciato) + "." + GLOBAL_VARIABLES.keyTracciatoFirma;
            try
            {
                List<PromoTracciatiRecord> tracciato = await this.ctx2.Promos
                    .Include(p => p.PromoTracciatis)
                        .ThenInclude(p => p.PromoTracciatiRecords)
                    .Where(f => f.Id == idpromo)
                    .SelectMany(p => p.PromoTracciatis.SelectMany(t => t.PromoTracciatiRecords))
                    .GroupBy(t => t.Codice) // Raggruppa per il campo "Codice"
                    .Select(g => new PromoTracciatiRecord
                    {
                        Codice = g.Key!.ToString(), // Converti il campo "Codice" in una stringa confrontabile
                                                   // Seleziona gli altri campi che desideri includere
                        CodiceGruppo = g.First().CodiceGruppo!.ToString(),
                        Dato = g.First().Dato!.ToString()
                    })
                    .ToListAsync();
                List<PromoTracciatiRecord> codiciGruppoDistinti = tracciato
                    .Where(t => t.CodiceGruppo != t.Codice)
                    .GroupBy(t => t.CodiceGruppo)
                    .Select(g => g.First()) // Seleziona il primo elemento di ciascun gruppo
                    .ToList();

                // Crea gli elementi "gruppo" e aggiungili al tracciato
                foreach (var codiceGruppo in codiciGruppoDistinti)
                {
                    //creo dei finti gruppi come tracciati record locali
                    tracciato.Add(new PromoTracciatiRecord
                    {
                        Codice = null, // Imposta il campo "Codice" come null
                        CodiceGruppo = codiceGruppo.CodiceGruppo, // Imposta il codice gruppo corrente
                        Dato = null // Imposta il campo "Dato" come null
                                    // Aggiungi altri campi se necessario e impostali a null
                    });
                }

                // Esegui la query con la conversione del campo FirmaTracciato in nvarchar(max)
                List<string> firmaTracciatoList = this.ctx.ArticoliDescrizionis
                    .Where(a => !string.IsNullOrEmpty(a.FirmaTracciato!))
                    .Select(a => a.FirmaTracciato!)
                    .ToList();

                foreach (var element in tracciato)
                {
                    if (element.Codice == null)
                    {
                        // Se element.Codice è null, è un elemento "gruppo" e puoi eseguire la ricerca
                        bool codiceGruppoPresente = this.ctx.ArticoliDescrizionis
                            .Any(a => a.CodiceGruppo == element.CodiceGruppo);

                        if (!codiceGruppoPresente)
                        {
                            revisioniDaEseguire++;
                        }
                    }
                    else
                    {
                        object? firmaElemento;
                        Dictionary<string, object>? Dato = JsonConvert.DeserializeObject<Dictionary<string, object>>(element.Dato!);   
                        if (Dato!.TryGetValue(firma, out firmaElemento))
                        {
                            string firmaEl = firmaElemento!.ToString()!;

                            // Confronta i valori con la lista in memoria
                            bool firmaPresente = firmaTracciatoList.Contains(firmaEl);


                            if (!firmaPresente)
                            {
                                revisioniDaEseguire++;
                            }
                        }
                        else
                        {
                            revisioniDaEseguire++;  
                        }

                    }
                }
                return Ok(revisioniDaEseguire);
            }
            catch (Exception ex)
            {
                return Ok(ex.Message);
            }
        }

        [HttpPut]
        [Route("Revisore/salvaRefFromIndd")]
        public async Task<IActionResult> salvaRefFromIndd(string reqStr, int idOperazione = 0)
        {
           
            BoolResult result = new BoolResult();
            
            try
            {

                //Console.WriteLine("RevisioneFromInddRequest RICEVUTO: " + reqStr);

                RevisioneFromInddRequest? req = JsonConvert.DeserializeObject<RevisioneFromInddRequest>(reqStr);

                PromoLavorazioniRecord plrItem = this.ctx2.PromoLavorazioniRecords.Include(inc=>inc.IdPromoTracciatiRecordNavigation).FirstOrDefault(f => f.IdLavorazione == req!.idLavorazione && f.CodiceGruppo == req.codice_gruppo)!;
                string kyeFirma = Enum.GetName(AddestramentoRuoli.Tracciato) + "." + GLOBAL_VARIABLES.keyTracciatoFirma;

                if (plrItem == null)
                    throw new Exception("Ref non impaginata per Istanta");

                string firmaTracciato = "";
                
                PromoTracciatiRecord? recInTracciato = this.ctx2.PromoTracciatiRecords.FirstOrDefault(i => i.Id == plrItem.IdRecordTracciato);
                var dict = JsonConvert.DeserializeObject<Dictionary<string, object>>(recInTracciato!.Dato!);
                firmaTracciato = dict![kyeFirma].ToString()!;
                


                string codice = "";
                bool isGruppo = (req!.codice != req.codice_gruppo);

                if (req.revisione!.valore!="")
                {

                    //Recupero la firma tracciato
                    //plrItem.Id


                    //C'è una revisione descrizione
                    ArticoliDescrizioni? adItem = null;
                    Int64 idArt = 0;

                    if (!isGruppo)
                    {
                        //Singolo
                        Articoli? artItem = this.ctx.Articolis.Include(i => i.ArticoliDescrizionis).FirstOrDefault(a => a.Codice == req.codice);
                        if (artItem!=null)
                        {
                            idArt = artItem.Id;
                            //Per ora prendo la prima, ATTENZIONE per quando verranno sbloccate le descrizioni regionali
                            adItem = artItem.ArticoliDescrizionis!.FirstOrDefault();

                            codice = artItem.Codice;
                        }
                    }
                    else 
                    {
                        codice = req.codice_gruppo!;

                        adItem = this.ctx.ArticoliDescrizionis.FirstOrDefault(a => a.CodiceGruppo == req.codice_gruppo);
                    }

                    if(adItem!=null)
                    {
                        if (req.revisione.descrizione1 != null && req.revisione.descrizione1 != "<untouched>")
                            adItem.Descrizione1 = req.revisione.descrizione1;
                        if (req.revisione.descrizione2 != null && req.revisione.descrizione2 != "<untouched>")
                            adItem.Descrizione2 = req.revisione.descrizione2;
                        if (req.revisione.descrizione3 != null && req.revisione.descrizione3 != "<untouched>")
                            adItem.Descrizione3 = req.revisione.descrizione3;
                        if (req.revisione.descrizione4 != null && req.revisione.descrizione4 != "<untouched>")
                            adItem.Descrizione4 = req.revisione.descrizione4;

                        adItem.DescrizioneIndd= req.revisione.valoreInddSoloFondamentali;

                        if (!plrItem.CodiceGruppo!.Contains(","))
                        {
                            //Si tratta di un signolo per cui convalido la firma
                            //PromoTracciatiRecord recInTracciato = this.ctx2.PromoTracciatiRecords.FirstOrDefault(i=>i.Id==plrItem.IdRecordTracciato.Value);
                            //var dict = JsonConvert.DeserializeObject<Dictionary<string, object>>(recInTracciato.Dato);
                            adItem.FirmaTracciato = firmaTracciato;
                        }
                        else
                        {
                            //Firma del gruppo
                            List<Dictionary<string,object>> _membriGruppo = this.ctx2.PromoTracciatiRecords.Where(p => p.IdTracciato == recInTracciato.IdTracciato && p.CodiceGruppo == plrItem.CodiceGruppo).ToList().Select(s => Utility.Main.getJsonObject(s.Dato!)).ToList()!; 
                            adItem.FirmaTracciato = Utility.Main.getFirmaTracciatoGruppo(_membriGruppo);
                        }

                        adItem.DataUltimaRicezione = DateTime.Now;


                       
                        this.ctx.SaveChanges();
                        var register = new Register(_config.GetConnectionString("IstandaConnectionDb")!, this._dbContextFactory, dbContextFactory2: this._dbContextFactory2);
                        var session = SessionIstantaObject.GetSession(HttpContext);
                        if (idOperazione == 0)
                        {
                            //l'operazione è stata autorizzata per cui procediamo a creare l'operazione sul DB
                            var nuovaOperazione = new RegistroOperazioni();
                            nuovaOperazione.Area = "";//actArea != null ? actArea : ""; //per ora è disattivata l'opzione di fare revisioni di area o di canale dal plugin
                            nuovaOperazione.Canale = ""; // actCanale != null ? actCanale : ""; 
                            nuovaOperazione.Stato = (byte)statoOperazioni.risolta;
                            nuovaOperazione.Autore = int.Parse(session);
                            var data = DateTime.Now;
                            nuovaOperazione.TipoOperazione = (byte)tipoOperazione.revisione;
                            nuovaOperazione.IdTracciato = null;
                            nuovaOperazione.CodiceAssociato = codice;

                            RevisioneDescrizione revReg = new RevisioneDescrizione();
                            revReg.descrizione1 = req.revisione.descrizione1;
                            revReg.descrizione2 = req.revisione.descrizione2;
                            revReg.descrizione3 = req.revisione.descrizione3;
                            revReg.descrizione4 = req.revisione.descrizione4;
                            revReg.valoreIndd = req.revisione.valoreIndd;
                            revReg.valore = "";


                            nuovaOperazione.FormData = JsonConvert.SerializeObject(revReg);
                            nuovaOperazione.Url = "Revisore/salvaRefFromIndd";
                            register.addOperazione(nuovaOperazione, true, session, DateTime.Now);
                        }
                        else
                        {
                            register.updateOperazione(idOperazione, statoOperazioni.risolta, session);
                        }
                        //BoolResult bRes = registraOperazioneDiRevisioneDescrizioneSuLavorazioni(plrItem, codice,  req.revisione);
                        //if (!bRes.Esito)
                        //    throw new Exception("Registro operazione error - " + bRes.error);
                    }
                    else
                    {
                        //la creo
                        ArticoliDescrizioni newAdItem = new ArticoliDescrizioni();
                        if (!isGruppo)
                        {
                            newAdItem.IdArticolo = idArt;
                        }
                        else
                        {
                            newAdItem.CodiceGruppo = req.codice_gruppo;
                        }

                        newAdItem.Descrizione1 = "";
                        newAdItem.Descrizione2 = "";
                        newAdItem.Descrizione3 = "";
                        newAdItem.Descrizione4 = "";
                        newAdItem.DescrizioneIndd = req.revisione.valoreInddSoloFondamentali;

                        if (req.revisione.descrizione1 != null && req.revisione.descrizione1 != "<untouched>")
                            newAdItem.Descrizione1 = req.revisione.descrizione1;
                        if (req.revisione.descrizione2 != null && req.revisione.descrizione2 != "<untouched>")
                            newAdItem.Descrizione2 = req.revisione.descrizione2;
                        if (req.revisione.descrizione3 != null && req.revisione.descrizione3 != "<untouched>")
                            newAdItem.Descrizione3 = req.revisione.descrizione3;
                        if (req.revisione.descrizione4 != null && req.revisione.descrizione4 != "<untouched>")
                            newAdItem.Descrizione4 = req.revisione.descrizione4;

                        newAdItem.DataUltimaRicezione = DateTime.Now;
                        if (!plrItem.CodiceGruppo!.Contains(","))
                        {
                            //Si tratta di un signolo per cui convalido la firma
                            //PromoTracciatiRecord recInTracciato = this.ctx2.PromoTracciatiRecords.FirstOrDefault(i=>i.Id==plrItem.IdRecordTracciato.Value);
                            //var dict = JsonConvert.DeserializeObject<Dictionary<string, object>>(recInTracciato.Dato);
                            newAdItem.FirmaTracciato = firmaTracciato;
                        }
                        else
                        {
                            //Firma del gruppo
                            List<Dictionary<string, object>> _membriGruppo = this.ctx2.PromoTracciatiRecords.Where(p => p.IdTracciato == recInTracciato.IdTracciato && p.CodiceGruppo == plrItem.CodiceGruppo).ToList().Select(s => Utility.Main.getJsonObject(s.Dato!)).ToList()!;
                            newAdItem.FirmaTracciato = Utility.Main.getFirmaTracciatoGruppo(_membriGruppo);
                        }
                        //newAdItem.FirmaTracciato= firmaTracciato;
                        newAdItem.Approvata = true;

                        this.ctx.ArticoliDescrizionis.Add(newAdItem);

                        this.ctx.SaveChanges();

                        //BoolResult bRes = registraOperazioneDiRevisioneDescrizioneSuLavorazioni(plrItem, codice, req.revisione);
                        var register = new Register(_config.GetConnectionString("IstandaConnectionDb")!, this._dbContextFactory, dbContextFactory2: this._dbContextFactory2);
                        var session = SessionIstantaObject.GetSession(HttpContext);
                        if (idOperazione == 0)
                        {
                            //l'operazione è stata autorizzata per cui procediamo a creare l'operazione sul DB
                            var nuovaOperazione = new RegistroOperazioni();
                            nuovaOperazione.Area = "";//actArea != null ? actArea : ""; //per ora è disattivata l'opzione di fare revisioni di area o di canale dal plugin
                            nuovaOperazione.Canale = ""; // actCanale != null ? actCanale : ""; 
                            nuovaOperazione.Stato = (byte)statoOperazioni.risolta;
                            nuovaOperazione.Autore = int.Parse(session);
                            var data = DateTime.Now;
                            nuovaOperazione.TipoOperazione = (byte)tipoOperazione.revisione;
                            nuovaOperazione.IdTracciato = null;
                            nuovaOperazione.CodiceAssociato = codice;

                            RevisioneDescrizione revReg = new RevisioneDescrizione();
                            revReg.descrizione1 = req.revisione.descrizione1;
                            revReg.descrizione2 = req.revisione.descrizione2;
                            revReg.descrizione3 = req.revisione.descrizione3;
                            revReg.descrizione4 = req.revisione.descrizione4;
                            revReg.valoreIndd = req.revisione.valoreIndd;
                            revReg.valore = "";


                            nuovaOperazione.FormData = JsonConvert.SerializeObject(revReg);
                            nuovaOperazione.Url = "Revisore/salvaRefFromIndd";
                            register.addOperazione(nuovaOperazione, true, session, DateTime.Now);
                        }
                        else
                        {
                            register.updateOperazione(idOperazione, statoOperazioni.risolta, session);
                        }

                    }

                }
                else
                {
                    if (isGruppo)
                    {
                        codice=req.codice_gruppo!;
                    }
                    else
                    {
                        codice = req.codice!;
                    }
                }
                

                for (int i = 0; i < req.campi_offerta!.Count; i++)
                {
                    RevisioneCampiOffertaFromIndd revField = req.campi_offerta[i];

                    //BoolResult bRes = registraOperazioneDiRevisioneCampiOffertaSuLavorazioni(plrItem, codice, revField);
                    registraAttivitaRevisore(0, codice, "salvaRefFromIndd", tipoOperazione.revisioneCampiOfferta);

                    //if (!bRes.Esito)
                    //    throw new Exception("Registro operazione error - " + bRes.error);
                }




                result.Esito = true;

            }
            catch(Exception ex)
            {
                //Console.WriteLine(ex.ToString());
                result.error = ex.ToString();
            }


            return Ok(result);
        }

        private string registraAttivitaRevisore(int id_operazione, string codRef, string url, tipoOperazione tipo, Int64 id_lavorazione_record = 0)
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


        [HttpPost]
        public CheckLastModificaResult checkLastModifica(ElementiInput input)
        {
            var overallResult = new CheckLastModificaResult();

            if (input?.elementiRichiesti == null || input.elementiRichiesti.Count == 0)
            {
                overallResult.EsitoGlobale = false;
                overallResult.Errori.Add("Nessun dato fornito.");
                return overallResult;
            }

            foreach (var elemento in input.elementiRichiesti)
            {
                var opResult = new OperazioniResult();
                string codice = elemento.codici!;
                string? canale = elemento.canale;
                string? area = elemento.area;
                bool found = false;
                string? foundArea = area;
                string? foundCanale = canale;
                string codiceForQuery = codice;

                if (codice.IndexOf(",") > 0)
                {
                    var ad = this.ctx.ArticoliDescrizionis.FirstOrDefault(x =>
                        x.CodiceGruppo == codice &&
                        (x.Area != null ? x.Area.ToLower() : x.Area) == (area != null ? area.ToLower() : area) &&
                        (x.Canale != null ? x.Canale.ToLower() : x.Canale) == (canale != null ? canale.ToLower() : canale));

                    if (ad != null)
                    {
                        found = true;
                    }
                }
                else
                {
                    var art = this.ctx.Articolis.Include(f=>f.ArticoliDescrizionis).FirstOrDefault(x => x.Codice == codice);
                    if (art != null)
                    {
                        var ad = art.ArticoliDescrizionis!.FirstOrDefault(x =>
                            (x.Area != null ? x.Area.ToLower() : x.Area) == (area != null ? area.ToLower() : area) &&
                            (x.Canale != null ? x.Canale.ToLower() : x.Canale) == (canale != null ? canale.ToLower() : canale));

                        if (ad != null)
                        {
                            found = true;
                        }
                    }
                }

                if (!found)
                {
                    opResult.esito = false;
                    opResult.errors.Add("Nessun elemento trovato per il codice: " + codice);
                }
                else
                {
                    var query = new OperazioneQuery
                    {
                        TipoOperazione = 1,
                        CodiceAssociato = codiceForQuery,
                        IdTracciato = null,
                        idPromoLavorazione = null,
                        idPromoLavorazioniRecord = null,
                        Area = foundArea,
                        Canale = foundCanale
                    };

                    var register = new Register(_config.GetConnectionString("IstandaConnectionDb")!, this._dbContextFactory, dbContextFactory2: this._dbContextFactory2);
                    opResult = register.getOperazioni(query);
                }

                overallResult.Risultati.Add(new CodiceOperazioniResult
                {
                    Codice = codice,
                    OperazioniResult = opResult
                });
            }

            overallResult.EsitoGlobale = overallResult.Risultati.All(r => r.OperazioniResult!.esito);
            foreach (var r in overallResult.Risultati)
            {
                overallResult.Errori.AddRange(r.OperazioniResult!.errors);
            }

            return overallResult;
        }
                
        
        [HttpPut]
        [Route("Revisore/salvaCampoInDatoTracciato/{idTracciato}/{idPromo}")]
        public BoolResult salvaCampoInDatoTracciato(StringList campi, int idTracciato, int idPromo)
        {
            var res = new BoolResult();

            try
            {
                string codice = campi.stringhe![0];
                string key = campi.stringhe[1];
                string value = campi.stringhe[2];

                bool isGruppo = codice.Contains(",");

                if (idPromo != 0)
                {
                    var tracciati = this.ctx2.PromoTracciatis.Where(f => f.IdPromo == idPromo).Select(f => f.Id).ToList();
                    if (tracciati.Count == 0)
                    {
                        throw new Exception("Nessun tracciato associato all'id promo " + idPromo + " trovato");

                    }
                    List<PromoTracciatiRecord> elementiDaModificare = new List<PromoTracciatiRecord>();

                    foreach (var idTrac in tracciati)
                    {
                        var elements = this.ctx2.PromoTracciatiRecords.Where(f => f.IdTracciato == idTrac && (isGruppo ? f.CodiceGruppo == codice : f.Codice == codice)).ToList();
                        elementiDaModificare.AddRange(elements);
                    }

                    if (elementiDaModificare.Count == 0)
                    {
                        if (isGruppo)
                        {
                            throw new Exception("Elementi appartenenti al gruppo " + codice + " non trovati");
                        }
                        else
                        {
                            throw new Exception("Elemento " + codice + " non trovato");
                        }
                    }

                    foreach (var item in elementiDaModificare)
                    {
                        var tItemDato = Utility.Main.getJsonObject(item.Dato!);
                        if (value != null && value != "")
                        {
                            tItemDato![key] = value;
                        }
                        else
                        {
                            tItemDato!.Remove(key);
                        }
                        item.Dato = JsonConvert.SerializeObject(tItemDato);
                    }

                    this.ctx2.SaveChanges();
                    res.Esito = true;
                }
                else if (idTracciato != 0)
                {
                    //non si dovrebbe mai entrare qui per ora perchè l'id promo sarà sempre specificato ma lascio il codice in caso in futuro si voglia riabilitare la possibilità di salvare per un singolo canale area
                    throw new Exception("Not implemented");
                    //var elements = this.ctx2.PromoTracciatiRecords.Where(f => f.IdTracciato == idTracciato && (isGruppo ? f.CodiceGruppo == codice : f.Codice == codice)).ToList();
                    //if(elements.Count == 0)
                    //{
                    //    if (isGruppo)
                    //    {
                    //        throw new Exception("Elementi appartenenti al gruppo " + codice + " non trovati");
                    //    }
                    //    else
                    //    {
                    //        throw new Exception("Elemento " + codice + " non trovato");
                    //    }
                    //}

                    //foreach (var item in elements)
                    //{
                    //    var tItemDato = Utility.Main.getJsonObject(item.Dato);
                    //    tItemDato[key] = value;
                    //    item.Dato = JsonConvert.SerializeObject(tItemDato);
                    //}

                    //this.ctx2.SaveChanges();
                }
                
            }
            catch (Exception ex)
            {
                res.Esito = false;
                res.error = ex.ToString();
            }


            return res;
        }

    }
}
