using DocumentFormat.OpenXml.Drawing;
using DocumentFormat.OpenXml.ExtendedProperties;
using ExcelDataReader.Log;
using Istanta.Models;
using Istanta.Models_2;
using IstantaLib;
using LinqKit;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.AspNetCore.Routing.Matching;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System.Configuration;
using System.Data;
using System.Diagnostics;
using System.Security.Cryptography.Xml;
using System.Timers;
using System.Xml;

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

        public RevisoreController(ILogger<RevisoreController> logger, IConfiguration configuration, IOptions<PathOperationImport> option_import, IOptions<PathExternal> external_paths)
        {
            this.ctx = new edro21_dbContext(configuration.GetConnectionString("IstandaConnectionDb"));
            this.ctx2 = new Edro21_DbContext2(configuration.GetConnectionString("IstandaConnectionDb"));
            _logger = logger;
            _config = configuration;
            path_to_import = option_import.Value.path;
            path_external_source = external_paths.Value.pathSource;
            path_external_lib = external_paths.Value.pathLib;
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
            }
            if (id_promo != 0)
            {
                var promo = await this.ctx2.Promos.Where(i => i.Id == id_promo).FirstOrDefaultAsync();
                ViewBag.Promo = promo;
            }

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


        [HttpPost]
        [Route("Revisore/getListaRevisione")]
        public async Task<IActionResult> getListaRevisione(RevisoreRequest req)
        {
            RevisoreResult result = new RevisoreResult();

            DateTime dStart = DateTime.Now;
            
            try
            {
                if (req.IdTracciatiRichiesti == null)
                {
                    req.IdTracciatiRichiesti = new List<int>();
                    req.IdTracciatiRichiesti.Add(0);
                }
                Promo imp;
                //PromoImportazioni imp;
                DateTime dtStart = DateTime.Now;
                /* if (req.IdTracciato>0)
                 {
                     imp = await this.ctx2.PromoImportazionis.Include(i => i.PromoTracciatis).ThenInclude(i2 => i2.PromoTracciatiRecords).Where(t => t.PromoTracciatis.Where(f=>f.Id==req.IdTracciato).Count()>0).FirstOrDefaultAsync();

                 }
                 else
                 {*/
                int idPromo = 0;

                if (req.IdPromo == 0)
                {
                    if (req.IdTracciatiPartenza.Count >= 1)
                    {
                        PromoTracciati PromoTracciato = this.ctx2.PromoTracciatis.Where(f => f.Id == req.IdTracciatiPartenza[0]).FirstOrDefault();
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

                imp = await this.ctx2.Promos.Include(f => f.PromoTracciatis).ThenInclude(i2 => i2.PromoTracciatiRecords).Where(i => i.Id == idPromo).FirstOrDefaultAsync();


                //imp = await this.ctx2.PromoImportazionis.Include(i => i.PromoTracciatis).ThenInclude(i2 => i2.PromoTracciatiRecords).Where(t => t.Id == req.IdImportazione).FirstOrDefaultAsync();
                //}

                //AddestramentoExcel training = await this.ctx2.AddestramentoExcels.Include(t=>t.SchemaCampiExcels).Where(a => a.Id == imp.PromoImportazionis.First().IdAddestramento).FirstOrDefaultAsync();

                //SchemaCampiExcel campo_codice_ref = training.SchemaCampiExcels.Where(sc => sc.Ruolo == ((Byte)(AddestramentoRuoli.Referenza)).ToString()).FirstOrDefault();
                string key_codice_ref = Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice;
                string key_codice_gruppo = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppo;
                string key_descrizione_gruppo = GLOBAL_VARIABLES.keyDescrGruppo;
                //SchemaCampiExcel campo_codice_gruppo = training.SchemaCampiExcels.Where(sc => sc.NomeColonna==key_codice_gruppo).FirstOrDefault();

                DateTime d2 = DateTime.Now;
                double msStep1 =  d2.Subtract(dStart).TotalMilliseconds;

                //List<PromoTracciatiRecord> q_records = new List<PromoTracciatiRecord>();
                var q_records = new List<dynamic>();
                foreach (PromoTracciati tracciato in imp.PromoTracciatis.Where(f => req.IdTracciatiRichiesti.Contains(f.Id) || req.IdTracciatiRichiesti[0] == 0))
                //foreach (PromoTracciati tracciato in imp.PromoTracciatis.Where(f => f.Id == req.IdTracciatoRichiesto || req.IdTracciatoRichiesto == 0))
                {
                    q_records.AddRange(tracciato.PromoTracciatiRecords.Where(s => s.Stato == (byte)StatoRecord.Attivo && IstantaJson.FindIn(s.Dato, req.formRequest)).Select(s => new { Dato = Utility.Main.getJsonObject(s.Dato), Id = s.Id }).ToList());//).ToList());
                }


                DateTime d3 = DateTime.Now;
                double msStep2 = d3.Subtract(d2).TotalMilliseconds;

                List<dynamic> q_records_codici = q_records.Select(s => s.Dato[key_codice_ref].ToString()).ToList();
                //List<dynamic> q_records_codici = q_records.Where(r => r.Dato["reparto"]=="84").Select(s => s.Dato[key_codice_ref].ToString()).ToList();
                q_records_codici = q_records_codici.GroupBy(g => g).Select(s => s.Key).ToList();

                List<Articoli> arts = await this.ctx.Articolis.Include(i => i.ArticoliDescrizionis).Where(r => q_records_codici.Contains(r.Codice)).ToListAsync();

                DateTime d4 = DateTime.Now;
                double msStep3 = d4.Subtract(d3).TotalMilliseconds;


                var codici_gruppi = new List<dynamic>();
                codici_gruppi = q_records.GroupBy(g => g.Dato[key_codice_gruppo]).Select(s => s.Key.ToString()).ToList();
                var tracciatoSingoli = new List<dynamic>();
                tracciatoSingoli = q_records
                .GroupBy(g => (g.Dato[key_codice_ref], g.Dato[key_codice_gruppo]))
                .Select(s => s.FirstOrDefault())
                .ToList();

                string scope_descrizioni = Enum.GetName(AddestramentoRuoli.Descrizioni);

                var archDecrGruppo = this.ctx.ArticoliDescrizionis.Where(d => codici_gruppi.Contains(d.CodiceGruppo)).ToList(); 

                DateTime d5 = DateTime.Now;
                double msStep4 = d5.Subtract(d4).TotalMilliseconds;


                foreach (string cod_gruppo in codici_gruppi)
                {
                    string[] cod_refs = cod_gruppo.Split(',');

                    foreach (string codRef in cod_refs)
                    {
                        if (codRef == "4974822")
                            "debug".ToString(); 

                        ArticoloInRevisione item = new ArticoloInRevisione();
                        var item2 = tracciatoSingoli.Where(t => t.Dato[key_codice_ref].ToString() == codRef && t.Dato[key_codice_gruppo] == cod_gruppo).FirstOrDefault()!;
                        item.recordInTracciato = item2.Dato;
                        item.idRec = item2.Id;

                        string firma = "";
                        if (item.recordInTracciato!.ContainsKey(Enum.GetName(AddestramentoRuoli.Tracciato) + "." + GLOBAL_VARIABLES.keyTracciatoFirma))
                            firma = item.recordInTracciato[Enum.GetName(AddestramentoRuoli.Tracciato) + "." + GLOBAL_VARIABLES.keyTracciatoFirma]!.ToString()!;

                        Articoli artItem = arts.Where(a => a.Codice == codRef).FirstOrDefault()!;
                        if (artItem != null)
                        {
                            item.recordRevisionato = artItem.ArticoliDescrizionis.Where(ad => ad.FirmaTracciato == firma).FirstOrDefault();
                            if (item.recordRevisionato==null)
                            {
                                item.recordRevisionato = artItem.ArticoliDescrizionis.OrderByDescending(o => o.DataUltimaRicezione).FirstOrDefault();
                            }
                        }
                        item.isGruppo = false;

                        result.Data.Add(item);

                    }

                    if (cod_refs.Length > 1)
                    {

                        ArticoloInRevisione itemG = new ArticoloInRevisione();

                        if (cod_gruppo == "4094715,4094717,4094719,4094720")
                            "debug".ToString();

                        //Tento di recuperare il gruppo da tracciato (se specificato)
                        itemG.recordInTracciato = tracciatoSingoli.Where(t => t.Dato[key_codice_gruppo]! == cod_gruppo && t.Dato.ContainsKey(scope_descrizioni!) && (t.Dato[scope_descrizioni!]! as JObject)!.ToObject<DescrittivaArticolo>()!.gruppo != null).FirstOrDefault()!;
                        if (itemG.recordInTracciato == null)
                        {
                            itemG.recordInTracciato = new Dictionary<string, object>();
                            itemG.recordInTracciato[Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppo] = cod_gruppo;
                        }
                        //Tento di recuperare una revisione di gruppo se c'è
                        //itemG.recordRevisionato = this.ctx.ArticoliDescrizionis.Where(ar => ar.CodiceGruppo == cod_gruppo).FirstOrDefault();
                        itemG.recordRevisionato = archDecrGruppo.Where(ar => ar.CodiceGruppo == cod_gruppo).FirstOrDefault();
                        itemG.isGruppo = true;

                        result.Data.Add(itemG);
                    }

                }

                DateTime d6 = DateTime.Now;
                double msStep5 = d6.Subtract(d5).TotalMilliseconds;


                double msOp = DateTime.Now.Subtract(dtStart).TotalMilliseconds;
                msOp.ToString();
                

            }
            catch (Exception ex)
            {
                ex.ToString();
            }

            return Ok(result);
        }



        //[HttpPut]
        //[Route("Revisore/salvaTutto")]

        //public Task<IActionResult> salvaTutto(List<RevisioneAction> act)
        //{
        //    foreach(RevisioneAction action in act) 
        //    {
        //        //salva(act);
        //    }
        //    return null;
        //}

        [HttpPut]
        [Route("Revisore/salva")]
        public async Task<IActionResult> salva(RevisioniActions acts)
        {
            BoolResult result = new BoolResult();
            List<ArticoliDescrizioni> descrItemList = new List<ArticoliDescrizioni>();
            foreach (RevisioneAction act in acts.coda)
            {
                

                try
                {
                    /*List<RevisioneAction> coda = pkg.coda;

                    foreach (RevisioneAction act in coda)
                    {*/
                    if (act.IdRef > 0)
                    {
                        ArticoliDescrizioni descrItem = await this.ctx.ArticoliDescrizionis.Include(i => i.IdArticoloNavigation).Where(d => d.IdArticolo == act.IdRef).FirstOrDefaultAsync();
                        if (descrItem == null)
                        {
                            //Creo priama revisione dell'articolo
                            descrItem = new ArticoliDescrizioni();
                            if (act.Area != null && act.Area != "")
                                descrItem.Area = act.Area;
                            descrItem.IdArticolo = act.IdRef;
                            descrItem.Approvata = false;//Per ora è messo statico MA andrebbe messo controllo dac lient che ci dica se lo ha ereditato pari apri da tracciato
                            descrItem.Descrizione1 = act.Descrizione1;
                            descrItem.Descrizione2 = act.Descrizione2;
                            descrItem.Descrizione3 = act.Descrizione3;
                            descrItem.Descrizione4 = act.Descrizione4;
                            if (act.DescrizioneIndd == null)
                                descrItem.DescrizioneIndd = "";
                            else
                                descrItem.DescrizioneIndd = act.DescrizioneIndd;

                            if (act.Peso != null && act.Peso > 0)
                                descrItem.Peso = act.Peso;
                            if (act.Um != null && act.Um != "")
                                descrItem.Um = act.Um;
                            descrItem.DataUltimaRicezione = DateTime.Now;
                            descrItem.FirmaTracciato = act.FirmaTracciato;
                            this.ctx.Add(descrItem);

                            descrItem.IdArticoloNavigation = this.ctx.Articolis.Where(a => a.Id == act.IdRef).FirstOrDefault();
                        }
                        else
                        {
                            descrItem.Descrizione1 = act.Descrizione1;
                            descrItem.Descrizione2 = act.Descrizione2;
                            descrItem.Descrizione3 = act.Descrizione3;
                            descrItem.Descrizione4 = act.Descrizione4;
                            if (act.DescrizioneIndd == null)
                                descrItem.DescrizioneIndd = "";
                            else
                                descrItem.DescrizioneIndd = act.DescrizioneIndd;

                            if (act.Peso!=null && act.Peso>0)
                                descrItem.Peso = act.Peso;
                            if (act.Um != null && act.Um != "")
                                descrItem.Um = act.Um;
                            descrItem.DataUltimaRicezione = DateTime.Now;
                            descrItem.FirmaTracciato = act.FirmaTracciato;
                        }

                        this.ctx.SaveChanges();

                        descrItemList.Add(descrItem);
                    }
                    else if (act.CodiceGruppo != null)
                    {
                        ArticoliDescrizioni descrItem = await this.ctx.ArticoliDescrizionis.Where(d => d.CodiceGruppo == act.CodiceGruppo).FirstOrDefaultAsync();
                        if (descrItem == null)
                        {
                            //Creo priama revisione dell'articolo
                            descrItem = new ArticoliDescrizioni();
                            if (act.Area != null && act.Area != "")
                                descrItem.Area = act.Area;
                            descrItem.CodiceGruppo = act.CodiceGruppo;
                            descrItem.Approvata = false;//Per ora è messo statico MA andrebbe messo controllo dac lient che ci dica se lo ha ereditato pari apri da tracciato
                            descrItem.Descrizione1 = act.Descrizione1;
                            descrItem.Descrizione2 = act.Descrizione2;
                            descrItem.Descrizione3 = act.Descrizione3;
                            descrItem.Descrizione4 = act.Descrizione4;
                            descrItem.DescrizioneIndd = act.DescrizioneIndd;
                            if (act.Peso != null && act.Peso > 0)
                                descrItem.Peso = act.Peso;
                            if (act.Um != null && act.Um != "")
                                descrItem.Um = act.Um;
                            descrItem.DataUltimaRicezione = DateTime.Now;
                            descrItem.FirmaTracciato = act.FirmaTracciato;
                            this.ctx.Add(descrItem);

                        }
                        else
                        {
                            descrItem.Descrizione1 = act.Descrizione1;
                            descrItem.Descrizione2 = act.Descrizione2;
                            descrItem.Descrizione3 = act.Descrizione3;
                            descrItem.Descrizione4 = act.Descrizione4;
                            descrItem.DescrizioneIndd = act.DescrizioneIndd;
                            if (act.Peso != null && act.Peso > 0)
                                descrItem.Peso = act.Peso;
                            if (act.Um != null && act.Um != "")
                                descrItem.Um = act.Um;
                            descrItem.DataUltimaRicezione = DateTime.Now;
                            descrItem.FirmaTracciato = act.FirmaTracciato;
                        }

                        this.ctx.SaveChanges();

                        descrItemList.Add(descrItem);
                        //return Ok(descrItem);
                    }
                    //}
                }
                catch (Exception ex)
                {
                    result.error = ex.ToString();
                }    
            }
            return Ok(descrItemList);
        }


        public IActionResult Sync()
        {

            ViewBag.listaPromoAttive = this.ctx2.Promos.Include(i => i.PromoTracciatis).Include(i2 => i2.PromoImportazionis).Where(p => p.DataScadenza.HasValue && p.DataScadenza.Value >= DateTime.Now).ToList();            
            return View("Sync");
        }

        [HttpPost]
        [RequestSizeLimit(45454545454)]
        public async Task<IActionResult> syncFromIndd([FromForm] FileXml fileXml, bool syncDb)
        {
            SyncInddReport result = new SyncInddReport();

            try
            {          
                IstantaController icItem = new IstantaController("", this.path_external_lib, this.path_external_source);

                string file_xml = path_to_import + fileXml.file.FileName;

                //Riconoscimento del tracciato dal nome del file
                //string onlyname = fileXml.file.FileName.Replace(".xml", "");
                //PromoTracciati pItem = this.ctx2.PromoTracciatis.Include(i => i.IdPromoNavigation).AsEnumerable().Where(p => p.IdPromoNavigation.ValiditaAl > DateTime.Now && Utility.Main.getJsonObjectAndGetValueOfKey(p.Meta, "NomeEsportazione") == onlyname).FirstOrDefault();
                PromoTracciati pList = await this.ctx2.PromoTracciatis.Include(i=>i.PromoTracciatiRecords).Where(p => p.Id == fileXml.IdTracciato).FirstOrDefaultAsync();
                List<string> _labels = pList.PromoTracciatiRecords.GroupBy(g => g.Label).Select(s => s.Key).ToList();

                //Colleziono il tracciato di controllo stanto ben attento a filtrare SOLO le ultime verisoni di goni LABEL di importazione (Edro21 ad es . ne ha una sola MA DocRoma ha Origine,Macelleria,Ortofrutta, ecc...)
                List<PromoTracciatiRecord> lastTracciatoDiControllo = new List<PromoTracciatiRecord>();
                foreach(string _lab in _labels)
                {
                    Byte vLab = pList.PromoTracciatiRecords.Where(tr => tr.Label == _lab).OrderByDescending(o=>o.Versione).FirstOrDefault().Versione;
                    lastTracciatoDiControllo.AddRange(pList.PromoTracciatiRecords.Where(tr => tr.Label == _lab && tr.Versione==vLab).ToList());
                }


                if (pList==null)
                {
                    result.error += ("Nessun traccaito di confronto trovato per la promo selezionata");
                }

                //Dovrei azzerare per ogni record tracciato recuperato
                //il campo GLOBAL_VARIABLES.keySyncIndd del Dato, visto che si tratta di un nuovo SYNC, il precedente devo automaticamente azzerarlo
                foreach(var tItem in lastTracciatoDiControllo.Where(t=>Utility.Main.getJsonObjectAndGetValueOfKey(t.Dato, GLOBAL_VARIABLES.keySyncIndd)!=""))
                {
                    var tItemDato = Utility.Main.getJsonObject(tItem.Dato);
                    tItemDato.Remove(GLOBAL_VARIABLES.keySyncIndd);
                    tItem.Dato = JsonConvert.SerializeObject(tItemDato);
                }

                string kSottogruppo= Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceSottogruppo;
                string kMultiplex = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppoMultiplex;

                using (FileStream fs = new FileStream(file_xml, FileMode.Create))
                {
                    await fileXml.file.CopyToAsync(fs);
                }

                XmlReaderSettings settings = new XmlReaderSettings();
                settings.IgnoreWhitespace = true;


                JObject o1 = JObject.Parse(System.IO.File.ReadAllText(this.path_external_source + "InterpreterXmlFromIndd.json"));
                //Questa è la base dati
                InterpreterXmlFromIndd interpreter = o1.ToObject<InterpreterXmlFromIndd>();

                //Questo è l'elemento che uso per ciclare
                InterpreterRuleFromIndd current = interpreter.syncRevisione[0];



                JObject o_unita = JObject.Parse(System.IO.File.ReadAllText(this.path_external_source + "SourceUnita.json"));
                DbUnita archiviDB = o_unita.ToObject<DbUnita>();
                List<DbUnitaItem> sync_folders = archiviDB.source.Where(s => s.syncFolder).ToList();
                DbUnitaItem web_folder = archiviDB.source.Where(s => s.webFolder).FirstOrDefault();
                DbUnitaItem alta_folder = archiviDB.source.Where(s => !s.webFolder && !s.syncFolder && !s.exportFolder).FirstOrDefault();

                string jsonRequest = Newtonsoft.Json.JsonConvert.SerializeObject(sync_folders);
                List<Dictionary<string, object>> req = Newtonsoft.Json.JsonConvert.DeserializeObject<List<Dictionary<string, object>>>(jsonRequest);

                IstantaLib.PhotoManager photoManager = new  PhotoManager(req);


                string cod_current = "";
                Dictionary<string, object> meta = new Dictionary<string, object>();
                Dictionary<string, object> extraXTracciato = new Dictionary<string, object>();

                using (var fileStream = System.IO.File.OpenText(file_xml))
                using (XmlReader reader = XmlReader.Create(fileStream, settings))
                {
                    SyncInddLog itemToSync = new SyncInddLog();
                    ArticoliDescrizioni itemToSyncDescr = new ArticoliDescrizioni();

                    while (reader.Read())
                    {
                        switch (reader.NodeType)
                        {
                            case XmlNodeType.Element:

                                string _readEl = reader.Name;
                                Console.WriteLine("Next read " + _readEl);

                                if (current == null)
                                {
                                    current = interpreter.syncRevisione[0];
                                    if (current.name != _readEl)
                                    {
                                        bool flag = false;
                                        while (true)
                                        {
                                            foreach (var s in current.children)
                                            {
                                                current = s;

                                                if (s.name == _readEl)
                                                {
                                                    flag = true;

                                                    break;
                                                }
                                            }

                                            if (flag)
                                            {
                                                break;
                                            }

                                        }
                                    }
                                }
                                else
                                {
                                    Console.WriteLine("Current " + current.name);
                                    foreach (var x in current.children)
                                    {
                                        if (x.name == _readEl || x.name == "extra")
                                        {
                                            //Console.WriteLine(_readEl);
                                            if (x.take)
                                            {
                                                Console.WriteLine("--taked");
                                                reader.Read();
                                                string _val = reader.Value;//.ReadElementContentAsString();

                                                //Tutto quel che arriva da indd lo salvo dentro questo dictionary del log
                                                if (x.name != "extra")
                                                    itemToSync.indd[x.name] = _val;
                                                else
                                                    itemToSync.indd[_readEl] = _val;

                                                if (_val == "3021788")
                                                    "debug".ToString();

                                                //Leggo il dato
                                                switch (x.bind)
                                                {
                                                    case "descrizione1":
                                                        itemToSyncDescr.Descrizione1 = _val; break;
                                                    case "descrizione2":
                                                        itemToSyncDescr.Descrizione2 = _val; break;
                                                    case "descrizione3":
                                                        itemToSyncDescr.Descrizione3 = _val; break;
                                                    case "descrizione4":
                                                        itemToSyncDescr.Descrizione4 = _val; break;
                                                    case "descrizione_indd":
                                                        itemToSyncDescr.DescrizioneIndd = _val;
                                                        break;
                                                    case "codice":

                                                        var art = await this.ctx.Articolis.Where(a => a.Codice == _val).FirstOrDefaultAsync();


                                                        if (art != null)
                                                        {
                                                            itemToSyncDescr.IdArticolo = art.Id;
                                                            itemToSyncDescr.IdArticoloNavigation = art;
                                                            cod_current = art.Codice;
                                                            itemToSync.codice = art.Codice;

                                                        }
                                                        else
                                                        {
                                                            //Un codice in arrivo da InDesign NON è negli archivi
                                                            //Assurdo MA se vero è causa di una manomissione a Indd o al db
                                                            //La situazione ad ogni modo va riparata
                                                            if (syncDb)
                                                            {
                                                                if (_val != "")
                                                                {
                                                                    Articoli newArt = new Articoli();
                                                                    newArt.Codice = _val;
                                                                    newArt.Descrizione1 = "";
                                                                    newArt.Descrizione2 = "";
                                                                    newArt.Descrizione3 = "";
                                                                    newArt.Descrizione4 = "";
                                                                    newArt.StatoRevisione = (Byte)StatoRevisioneArticolo.NonProcessato;
                                                                    newArt.DataInserimento = DateTime.Now;
                                                                    this.ctx.Articolis.Add(newArt);
                                                                    this.ctx.SaveChanges();

                                                                    itemToSyncDescr.IdArticolo = newArt.Id;
                                                                    itemToSyncDescr.IdArticoloNavigation = newArt;
                                                                    cod_current = newArt.Codice;
                                                                    itemToSync.codice = newArt.Codice;
                                                                }
                                                            }
                                                        }
                                                        break;

                                                    case "codice_gruppo":

                                                        itemToSyncDescr.CodiceGruppo = _val;
                                                        cod_current = itemToSyncDescr.CodiceGruppo;
                                                        itemToSync.codice = _val;
                                                        break;
                                                    case "foto_primaria":
                                                        /*
                                                        //Mi aspetto una stringa che rappresenta la foto primaria impaginata per la ref
                                                        var art_foto = await this.ctx.ArticoliFotos.Where(a => a.NomeReale == _val).FirstOrDefaultAsync();
                                                        if (art_foto != null)
                                                        {
                                                            if (syncDb)
                                                            {
                                                                //In questo modo questa foto prende la priorità alla prossima selezione
                                                                art_foto.DataModifica = DateTime.Now;
                                                                art_foto.StatoSelezione = (Byte)StatoSelezioneFoto.Primaria;
                                                                this.ctx.SaveChanges();
                                                                itemToSync.fotoStato = SyncFotoStatus.Updated;
                                                            }
                                                            else
                                                            {
                                                                itemToSync.fotoStato = SyncFotoStatus.WillUpdated;
                                                            }
                                                        }
                                                        else
                                                        {
                                                            //E' nuova e quindi a chi appartiene?
                                                            //Per questa ragione è necessario che nell'xml si scriva prima i riferimenti (cod ref o cod gruppo) di modo che arrivati a questo punto sappiamo a chi ci stiamo rivolgendo
                                                            if (itemToSyncDescr.IdArticolo > 0)
                                                            {
                                                                if (syncDb)
                                                                {
                                                                    art_foto = new ArticoliFoto();
                                                                    art_foto.Attiva = true;
                                                                    art_foto.DataModifica = DateTime.Now;
                                                                    art_foto.DataInserimento = art_foto.DataModifica.Value;
                                                                    art_foto.Hash = "";
                                                                    art_foto.PathFoto = _val;
                                                                    art_foto.NomeReale = _val;
                                                                    art_foto.StatoSelezione = (Byte)StatoSelezioneFoto.Primaria;
                                                                    this.ctx.ArticoliFotos.Add(art_foto);
                                                                    this.ctx.SaveChanges();

                                                                    itemToSync.fotoStato = SyncFotoStatus.New;
                                                                }
                                                                else
                                                                {
                                                                    itemToSync.fotoStato = SyncFotoStatus.WillNew;
                                                                }
                                                            }
                                                            else if (itemToSyncDescr.CodiceGruppo != null && itemToSyncDescr.CodiceGruppo != "")
                                                            {
                                                                //E' un gruppo, allora questa info va a finire negli extra
                                                                meta[x.bind] = _val;
                                                            }
                                                        }
                                                        */
                                                        break;
                                                    case "lista_foto":
                                                        //Mi aspetto una string con separatore "," che separa ogni foto coinvolta nel box
                                                        //Siccome si tratta di una lista, Istanta detta una specifica:
                                                        //Si tratta di una lista di altre foto, dette anche secondarie

                                                        List<Dictionary<string, object>> _lista_foto = JsonConvert.DeserializeObject<JArray>(_val).ToObject<List<Dictionary<string, object>>>();
                                                        List<Dictionary<string, object>> _lista_foto_valide = new List<Dictionary<string, object>>();



                                                        //var lista_foto = _val.Split(',');
                                                        foreach (Dictionary<string, object> foto in _lista_foto)
                                                        {
                                                            string codArtNewFoto = foto[GLOBAL_VARIABLES.keySyncFotoInddCodice].ToString();
                                                            Int64 idArtNewFoto = await this.ctx.Articolis.Where(afn => afn.Codice == codArtNewFoto).Select(s => s.Id).FirstOrDefaultAsync();

                                                            //Qui prima dovrei controllare se la foto in questione letta nel dato INDD, è presente anche nel pacchetto foto
                                                            //trasmesso tramite il seguente form
                                                            string nome_foto = foto[GLOBAL_VARIABLES.keySyncFotoInddNome].ToString();
                                                            var art_foto2 = await this.ctx.ArticoliFotos.Where(a =>a.IdArticolo== idArtNewFoto && a.NomeReale == nome_foto).FirstOrDefaultAsync();

                                                            string fileInSyncFolder_result = photoManager.scanFile(nome_foto);
                                                            if (fileInSyncFolder_result != "no found")
                                                            {
                                                                try
                                                                {
                                                                    SyncFile fileInSyncFolder = Newtonsoft.Json.JsonConvert.DeserializeObject<JObject>(fileInSyncFolder_result).ToObject<SyncFile>();
                                                                    string md5FileInSync = fileInSyncFolder.md5;
                                                                    //Se la foto esiste nel pacchetto foto allora controllo che esista anche in archivio

                                                                    if (art_foto2 != null)
                                                                    {

                                                                        //La foto è presente anche in archivio e qui scopriamo sotto quale articolo
                                                                        if (syncDb)
                                                                        {
                                                                            //In questo modo questa foto prende la priorità alla prossima selezione                                                                        

                                                                            fileInSyncFolder_result = photoManager.sync(fileInSyncFolder.idPath, fileInSyncFolder.filename, alta_folder.path, web_folder.path);

                                                                            fileInSyncFolder = Newtonsoft.Json.JsonConvert.DeserializeObject<SyncFile>(fileInSyncFolder_result);
                                                                            if (fileInSyncFolder.stato == StatoSyncFile.Synced)
                                                                            {
                                                                                art_foto2.DataModifica = DateTime.Now;
                                                                                art_foto2.StatoSelezione = (Byte)StatoSelezioneFoto.Primaria;
                                                                                art_foto2.Hash = md5FileInSync;

                                                                                this.ctx.SaveChanges();
                                                                                itemToSync.fotoStato = SyncFotoStatus.Updated;

                                                                                foto[GLOBAL_VARIABLES.keySyncFotoInddStato] = (Byte)SyncFotoStatus.Updated;
                                                                                if (fileInSyncFolder.md5 == art_foto2.Hash)
                                                                                {
                                                                                    foto[GLOBAL_VARIABLES.keySyncFotoInddStato] = (Byte)SyncFotoStatus.Overwrite;
                                                                                }
                                                                            }
                                                                            else
                                                                            {
                                                                                foto[GLOBAL_VARIABLES.keySyncFotoInddStato] = (Byte)SyncFotoStatus.SyncError;
                                                                            }
                                                                        }
                                                                        else
                                                                        {
                                                                            itemToSync.fotoStato = SyncFotoStatus.WillUpdated;
                                                                            foto[GLOBAL_VARIABLES.keySyncFotoInddStato] = (Byte)SyncFotoStatus.WillUpdated;
                                                                            if (md5FileInSync == art_foto2.Hash)
                                                                            {
                                                                                foto[GLOBAL_VARIABLES.keySyncFotoInddStato] = (Byte)SyncFotoStatus.WillOverwrite;
                                                                            }
                                                                        }

                                                                        if (foto[GLOBAL_VARIABLES.keySyncFotoInddCodice] == null || foto[GLOBAL_VARIABLES.keySyncFotoInddCodice].ToString() == "")
                                                                        {
                                                                            //Indd per qualche ragione non ha messo il codice a questa foto. Problema di manomissione dell'impaginato
                                                                            //In questo caso, grazie al ritrovamento della foto per NOME, posso riassociargli il codice.
                                                                            foto[GLOBAL_VARIABLES.keySyncFotoInddCodice] = this.ctx.Articolis.Find(art_foto2.IdArticolo).Codice;
                                                                        }

                                                                        _lista_foto_valide.Add(foto);

                                                                    }
                                                                    else
                                                                    {
                                                                        //Se il codice articolo è impostato nel dictionary SO che quella foto appartiene a quella referenza
                                                                        //In caso contrario non posso trattare questa foto come valida da archivio
                                                                        if (foto[GLOBAL_VARIABLES.keySyncFotoInddCodice] != null && foto[GLOBAL_VARIABLES.keySyncFotoInddCodice].ToString() != "")
                                                                        {
                                                                            itemToSync.fotoStato = SyncFotoStatus.New;
                                                                            foto[GLOBAL_VARIABLES.keySyncFotoInddStato] = (Byte)SyncFotoStatus.New;
                                                                            _lista_foto_valide.Add(foto);

                                                                            if (syncDb)
                                                                            {
                                                                                //Creazione foto SE l'articolo è esistente
                                                                                if (idArtNewFoto > 0)
                                                                                {
                                                                                    fileInSyncFolder_result = photoManager.sync(fileInSyncFolder.idPath, fileInSyncFolder.filename, alta_folder.path, web_folder.path);

                                                                                    fileInSyncFolder = Newtonsoft.Json.JsonConvert.DeserializeObject<SyncFile>(fileInSyncFolder_result);
                                                                                    if (fileInSyncFolder.stato == StatoSyncFile.Synced)
                                                                                    {

                                                                                        ArticoliFoto dbNewFoto = new ArticoliFoto();
                                                                                        dbNewFoto.Attiva = true;
                                                                                        dbNewFoto.DataInserimento = DateTime.Now;
                                                                                        dbNewFoto.DataModifica = DateTime.Now;
                                                                                        dbNewFoto.PathFoto = fileInSyncFolder.filename;
                                                                                        dbNewFoto.NomeReale = fileInSyncFolder.filename;
                                                                                        dbNewFoto.Hash = md5FileInSync;
                                                                                        dbNewFoto.StatoSelezione = (Byte)StatoSelezioneFoto.Primaria;
                                                                                        dbNewFoto.IdArticolo = idArtNewFoto;
                                                                                        this.ctx.ArticoliFotos.Add(dbNewFoto);
                                                                                        this.ctx.SaveChanges();
                                                                                    }

                                                                                }
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                                catch (Exception ex)
                                                                {
                                                                    throw new Exception("FOTO SYNC ERROR " + ex.ToString());
                                                                }
                                                            }
                                                            else
                                                            {
                                                                if (art_foto2 == null)
                                                                {
                                                                    if (foto[GLOBAL_VARIABLES.keySyncFotoInddCodice] != null && foto[GLOBAL_VARIABLES.keySyncFotoInddCodice].ToString() != "")
                                                                    {
                                                                        foto[GLOBAL_VARIABLES.keySyncFotoInddStato] = (Byte)SyncFotoStatus.NoFoundInSyncFolder;
                                                                        _lista_foto_valide.Add(foto);
                                                                    }
                                                                }
                                                                else
                                                                {
                                                                    foto[GLOBAL_VARIABLES.keySyncFotoInddStato] = (Byte)SyncFotoStatus.NoFoundInSyncFolder;
                                                                    _lista_foto_valide.Add(foto);
                                                                }
                                                            }
                                                        }

                                                        itemToSync.inddFoto.AddRange(_lista_foto_valide);


                                                        if (itemToSyncDescr.CodiceGruppo != null && itemToSyncDescr.CodiceGruppo != "")
                                                        {
                                                            //E' un gruppo, allora questa info va a finire negli extra
                                                            meta[x.bind] = _val;
                                                        }
                                                        break;
                                                    /*case "dna":
                                                        //Sappiamo che il DNA per sua natura è strtturato così
                                                        //<scatto>,<codRef>,<codRefInGruppo>_1,<codRefInGruppo>_2,<codRefInGruppo>_n,
                                                        //Quindi ci deve essere almeno un separatore "," che indichi al primo posto lo scatto (se non presente è vuoto)
                                                        //Al secondo posto il codice della ref
                                                        //Se seguono altri separatori e altri codici, allora si tratta di un codice gruppo, a partire ovviamente dall'elemento 1 della split string

                                                        string[] _elements = _val.Split(',');
                                                        if (_elements.Length == 2)
                                                        {
                                                            string cod = _elements[1];
                                                            var art2 = await this.ctx.Articolis.Where(a => a.Codice == cod).FirstOrDefaultAsync();
                                                            if (art2 != null)
                                                            {
                                                                itemToSyncDescr.IdArticolo = art2.Id;
                                                                cod_current = cod;
                                                                itemToSync.codice = cod;
                                                            }
                                                        }
                                                        else if (_elements.Length > 2)
                                                        {

                                                            itemToSyncDescr.CodiceGruppo = String.Join(',', _elements.Where(e => _elements.ElementAt(0) != e).ToArray());
                                                            cod_current = itemToSyncDescr.CodiceGruppo;
                                                            itemToSync.codice = itemToSyncDescr.CodiceGruppo;
                                                        }
                                                        else
                                                        {
                                                            //no valid
                                                        }

                                                        break;
                                                    */
                                                    case "extra":
                                                        //Dati da incorporare permanentemente nell'ArticoloDescrizioni come extra
                                                        //meta[x.bind] = _val;
                                                        if (!x.integrativo)
                                                            meta[_readEl] = _val;
                                                        else
                                                            meta[_readEl] = new CampoExtraIntegrativo() { valore = _val, separatore=x.separatoreDiValore!=null?x.separatoreDiValore:"|" };

                                                        break;

                                                    default:
                                                        //Il campo è un extra
                                                        //Console.WriteLine("-----extra");
                                                        //extraXTracciato[x.bind] = _val;
                                                        break;

                                                }

                                                break;

                                            }
                                            else
                                            {
                                                //next read
                                                current = x;
                                                break;
                                            }
                                        }
                                    }
                                }
                                


                                

                                break;
                            case XmlNodeType.Text:

                                break;
                            case XmlNodeType.EndElement:

                                Console.WriteLine("End read " + reader.Name);
                                //Console.WriteLine("Current " + current.name);

                                if (current !=null && current.name==reader.Name && current.itemTag)
                                {
                                    //Allora è la chiusura di un tag item che devo mettere nel log

                                    if ((itemToSyncDescr.IdArticolo != null || itemToSyncDescr.CodiceGruppo != null) && (itemToSyncDescr.IdArticolo > 0 || itemToSyncDescr.CodiceGruppo != ""))
                                    {
                                        bool ref_singola = true;

                                        if (itemToSyncDescr.CodiceGruppo != null)
                                        {
                                            if (itemToSyncDescr.CodiceGruppo.Contains("4024457,6775176,7585341"))
                                            {
                                                "debug".ToString();
                                            }
                                            ref_singola = (itemToSyncDescr.IdArticoloNavigation != null && itemToSyncDescr.IdArticoloNavigation.Codice == itemToSyncDescr.CodiceGruppo);
                                        }


                                        //Ho riempito qualcosa
                                        Int64 id_art_query = (itemToSyncDescr.IdArticolo != null ? itemToSyncDescr.IdArticolo.Value : 0);
                                        string cod_gruppo_query = (itemToSyncDescr.CodiceGruppo != null ? itemToSyncDescr.CodiceGruppo : "");

                                        //ATTENZIONE
                                        //Devo controllare che la descrizione revisionata sia la stessa dell'archivio
                                        //Altrimenti devo notificarlo
                                        itemToSync.descrStato = SyncDescrizioneStatus.None;

                                        ArticoliDescrizioni revisione = new ArticoliDescrizioni();
                                        if (ref_singola && id_art_query>0)
                                            revisione = await this.ctx.ArticoliDescrizionis.Where(ad => ad.IdArticolo == id_art_query).FirstOrDefaultAsync();
                                        else if (cod_gruppo_query!="")
                                            revisione = await this.ctx.ArticoliDescrizionis.Where(ad => ad.CodiceGruppo == cod_gruppo_query).FirstOrDefaultAsync();

                                        if (revisione!=null && revisione.Id>0)
                                        {
                                            //L'articolo aveva già una revisione precedente.
                                            //Sovrascrivo MA soltanto la descrizione INDD perchè mi fido solo di quella di ritorno da un file in lavorazione

                                            if (revisione.DescrizioneIndd != itemToSyncDescr.DescrizioneIndd)
                                            {
                                                if (syncDb)
                                                    itemToSync.descrStato = SyncDescrizioneStatus.Updated;
                                                else
                                                    itemToSync.descrStato = SyncDescrizioneStatus.WillUpdate;
                                            }

                                            if (syncDb)
                                            {
                                                revisione.DescrizioneIndd = itemToSyncDescr.DescrizioneIndd;


                                                if (meta.Keys.Count > 0)
                                                {
                                                    if (revisione.Extra != null && revisione.Extra != "")
                                                    {
                                                        //Salvo su quello già esistente
                                                        Dictionary<string, object> _extra_exist = Utility.Main.getJsonObject(revisione.Extra);
                                                        meta.Keys.ForEach(x =>
                                                        {
                                                            //Se meta[x] è un tipo di dato CampoExtraIntegrativo
                                                            //Devo tenere di conto del fatto che il dato è integrativo. Questo per evitare di sovrascrivere roba che c'era prima
                                                            //Questa modifica è venuta fuori dal momento che sono state tirate in ballo le foto ambientate.
                                                            //nel VOL 1 potrebbe esserci ma nel VOL 2 no e io devo poter sapere tutto del passato. Nel caso non volessi più qualcosa
                                                            //Da questo campo, devo forzare l'utente a eliminarla a mano dalla scheda articolo
                                                            if (meta[x] is CampoExtraIntegrativo)
                                                            {
                                                                if (_extra_exist.ContainsKey(x))
                                                                {
                                                                    string sep = (meta[x] as CampoExtraIntegrativo).separatore;
                                                                    string val = (meta[x] as CampoExtraIntegrativo).valore;
                                                                    //Prendo ogni singolo campo facendo split, per vedere se il valore che sto per inserire è già contenuto
                                                                    string[] _p = _extra_exist[x].ToString().Split(sep, StringSplitOptions.RemoveEmptyEntries);
                                                                    //Se il valore esiste già NON lo sto ad aggiungere
                                                                    if (!_p.Contains(val))
                                                                        _extra_exist[x] = _extra_exist[x].ToString() + sep + val;

                                                                }
                                                                else
                                                                {
                                                                    _extra_exist[x] = (meta[x] as CampoExtraIntegrativo).valore;
                                                                }
                                                            }
                                                            else
                                                            {
                                                                _extra_exist[x] = meta[x];
                                                            }
                                                        });

                                                        revisione.Extra = JsonConvert.SerializeObject(_extra_exist);

                                                    }
                                                    else
                                                    {
                                                        Dictionary<string, object> _extra_new = new Dictionary<string, object>();
                                                        meta.Keys.ForEach(x =>
                                                        {
                                                            //Se meta[x] è un tipo di dato CampoExtraIntegrativo
                                                            //Devo tenere di conto del fatto che il dato è integrativo. Questo per evitare di sovrascrivere roba che c'era prima
                                                            //Questa modifica è venuta fuori dal momento che sono state tirate in ballo le foto ambientate.
                                                            //nel VOL 1 potrebbe esserci ma nel VOL 2 no e io devo poter sapere tutto del passato. Nel caso non volessi più qualcosa
                                                            //Da questo campo, devo forzare l'utente a eliminarla a mano dalla scheda articolo
                                                            if (meta[x] is CampoExtraIntegrativo)
                                                            {
                                                                _extra_new[x] = (meta[x] as CampoExtraIntegrativo).valore;

                                                            }
                                                            else
                                                            {
                                                                _extra_new[x] = meta[x];
                                                            }
                                                        });

                                                        revisione.Extra = JsonConvert.SerializeObject(_extra_new);

                                                    }

                                                    itemToSyncDescr.Extra = revisione.Extra;

                                                }

                                                //revisione.FirmaTracciato = "";
                                                revisione.DataUltimaRicezione = DateTime.Now;
                                                this.ctx.SaveChanges();
                                            }

                                        }
                                        else
                                        {
                                            if (syncDb)
                                            {
                                                itemToSync.descrStato = SyncDescrizioneStatus.New;
                                            }
                                            else
                                            {
                                                itemToSync.descrStato = SyncDescrizioneStatus.WillNew;
                                            }

                                            if (itemToSyncDescr.CodiceGruppo == "3021788")
                                                "debug".ToString();

                                            if (itemToSyncDescr.IdArticoloNavigation != null)
                                            {
                                                if (itemToSyncDescr.IdArticoloNavigation.Codice == "3021788")
                                                    "debug".ToString();

                                                if (itemToSyncDescr.IdArticoloNavigation.Codice != itemToSyncDescr.CodiceGruppo)
                                                {
                                                    //Si tratta di un gruppo
                                                    itemToSyncDescr.IdArticoloNavigation = null;
                                                    itemToSyncDescr.IdArticolo = null;
                                                }
                                                else
                                                {
                                                    //Si tratta di un gruppo
                                                    itemToSyncDescr.CodiceGruppo = null;
                                                }
                                            }
                                           
   

                                            if (syncDb)
                                            {

                                                if (itemToSyncDescr.Descrizione1 == null)
                                                    itemToSyncDescr.Descrizione1 = "";
                                                if (itemToSyncDescr.Descrizione2 == null)
                                                    itemToSyncDescr.Descrizione2 = "";
                                                if (itemToSyncDescr.Descrizione3 == null)
                                                    itemToSyncDescr.Descrizione3 = "";
                                                if (itemToSyncDescr.Descrizione4 == null)
                                                    itemToSyncDescr.Descrizione4 = "";

                                                itemToSyncDescr.DataUltimaRicezione = DateTime.Now;

                                                if (meta.Keys.Count > 0)
                                                {
                                                    itemToSyncDescr.Extra = JsonConvert.SerializeObject(meta);

                                                }


                                                
                                                this.ctx.ArticoliDescrizionis.Add(itemToSyncDescr);
                                                this.ctx.SaveChanges();
                                                
                                            }
                                        }
                                        


                                        itemToSync.item = itemToSyncDescr;
                                        SyncInddLog log = new SyncInddLog() { item = itemToSync.item, descrStato = itemToSync.descrStato, fotoStato = itemToSync.fotoStato, codice = itemToSync.codice, indd=itemToSync.indd, inddFoto=itemToSync.inddFoto };
                                        result.logs.Add(log);


                                        //Poi faccio reset dell'oggetto
                                        itemToSyncDescr = new ArticoliDescrizioni();
                                        itemToSync = new SyncInddLog();
                                        meta = new Dictionary<string, object>();
                                    }

                                    current = null;
                                }
                                
                                break;
                            default:

                                break;
                        }
                    }
                }
                
                //Adesso confronto i due titani, ultimo tracciato con esportazione INDD
                foreach(var log in result.logs)
                {
                    //Questo codice rappresenta il codice gruppo
                    //I casi possono essere 4 a questo punto

                    //1. Ref singola codice_gruppo=codice
                    //2. Gruppo come letto da tracciato (cod,cod,cod,cod) 
                    //3. Gruppo Multiplex formato da menabo (cod,cod,cod2,cod3,cod3)
                    //4. Codice non trovato in nessun modo

                    if (log.codice == "5042239")
                    {
                        "debug".ToString();
                    }

                    List<PromoTracciatiRecord> gruppo_refs = lastTracciatoDiControllo.Where(t => t.CodiceGruppo == log.codice).ToList();
                    if (gruppo_refs.Count==0)
                    {
                        //Non ho trovato niente per cui escludiamo subito i casi 1. e 2.
                        //Cerco allora tra i multiplex
                        gruppo_refs = lastTracciatoDiControllo.Where(t => Utility.Main.getJsonObjectAndGetValueOfKey(t.Dato, Enum.GetName(AddestramentoRuoli.Scatto)+"."+GLOBAL_VARIABLES.keyScattoCodiceGruppoMultiplex) == log.codice).ToList();
                        if (gruppo_refs.Count==0)
                        {
                            //caso 4.
                            //In questa situazion devo scomporre i codici e fare dei controlli finalizzati a
                            //Ricostruire un gruppo con le ref che trovo
                            //Evidenziare le ref fuori gioco, ovvero NON trovate in tracciato

                            //Deduco che non ci sia
                            log.stato = SyncStatus.NotFound;
                            //Però poi controllo record per record per vedere se lo ricompongo prendendo singolo per singolo
                            //Prendo quindi in considerazione di creare un multiplex temporane in arrivo da Indd
                            int recovered = 0;
                            gruppo_refs = new List<PromoTracciatiRecord>();
                            string ref_non_trovate = "";
                            string ref_ricostruite = "";

                            foreach (string _ref_no_found in log.codice.Split(','))
                            {
                                var recRecover = lastTracciatoDiControllo.Where(t => Utility.Main.getJsonObjectAndGetValueOfKey(t.Dato, Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice) == _ref_no_found).FirstOrDefault();
                                if (recRecover != null)
                                {
                                    recovered++;

                                    //PromoTracciatiRecord pReMultiplex = new PromoTracciatiRecord();
                                    //pReMultiplex.Id = recRecover.Id;
                                    //pReMultiplex.CodiceGruppo = log.codice;
                                    //Dictionary<string, object> _dato = new Dictionary<string, object>
                                    //{
                                    //    { Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice, _ref_no_found },
                                    //    { Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppo, log.codice },           
                                    //    { "IdRec", 0 }
                                    //};

                                    Dictionary<string, object> _dato = JsonConvert.DeserializeObject<Dictionary<string, object>>(recRecover.Dato);
                                    //Aggiungo la chiave MULTIPLEX a questo record
                                    //ATTENZIONE, questa operazione 99.9% danneggia il menabo
                                    //Da questo momento in poi, l'utente vedrà le corruzioni evidenziate in menabo e potrà a quel punto decidere cosa fare.
                                    //  1. Lasciare le corruzioni per poter mantenere una coerenza con l'indd
                                    //  2. Risolvere le corruzioni: Questa scelta è rischiosa perchèp poi deve far tornare i multiplex riscontrati in INDD se vuole rimanere coerente

                                    //Metto/Sovrascrivo la chiave multiplex
                                    _dato[kMultiplex] = log.codice;
                                    recRecover.Dato = JsonConvert.SerializeObject(_dato);
                                    gruppo_refs.Add(recRecover);
                                    ref_ricostruite += "," + _ref_no_found;

                                    //Lo rimuovo dalla lista, tanto è generato in altra forma da un'altra parte
                                    //lastTracciatoDiControllo.Remove(recRecover);
                                    //lastTracciatoDiControllo.Add(pReMultiplex);
                                }
                                else
                                {
                                    //L'articolo non esiste nel tracciato neppure singolarmente
                                    //Ai fini del logs lo inserisco come nuovo e quindi con ID 0 perchè non è mai esistito

                                    //ATTENZIONE: Questo scenario dovrebbe addirittura INVALIDARE il torna indietro, NON deve accadere che da INDD ci sia un codice NUOVO
                                    //non riscontrato in lista tracciato. Sarebbe una violazione pesante.
                                    PromoTracciatiRecord pNotFound = new PromoTracciatiRecord();
                                    pNotFound.Id = 0;
                                    pNotFound.CodiceGruppo = log.codice;
                                    Dictionary<string, object> _dato = new Dictionary<string, object>
                                    {
                                        { Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice, _ref_no_found },
                                        { Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppo, log.codice },
                                        { "IdRec", 0 }
                                    };
                                    pNotFound.Dato = JsonConvert.SerializeObject(_dato);
                                    gruppo_refs.Add(pNotFound);

                                    ref_non_trovate += "," + _ref_no_found;

                                    lastTracciatoDiControllo.Add(pNotFound);
                                }
                                
                            }

                            if (recovered>0)
                            {
                                if (log.codice.Split(',').Length==recovered)
                                {
                                    log.stato = SyncStatus.MultiplexReversed;
                                    var _lReversedMultiplex = ref_ricostruite.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList();
                                    _lReversedMultiplex.Sort();
                                    log.codice = String.Join(',', _lReversedMultiplex);
                                    log.note = "Nuovo multiplex intercettato da Indd: " + log.codice;

                                    //A questo punto dovrei inserire la chiave multiplex ai records del gruppo su db
                                    //Attenzione perchè lo sto già facendo sopra.
                                    //Qui sarebbe più corretto perchè è definitivo esclusi i NON TROVATI
                                    //Che PERO come dico sopra è una casistica che NON dovrebbe essere neppure presa in considerazione. La questione rimane aperta. Facciamo attenzione!
                                    if (syncDb)
                                    {
                                        //foreach(string codSingoloInMultiplex )
                                    }
                                }
                                else
                                {
                                    log.stato = SyncStatus.Corrupted;
                                    log.note = "Ref non trovate: " +ref_non_trovate + " Ref recuperate " + ref_ricostruite;
                                }

                            }
                        }
                        else
                        {
                            //Esiste già confezionato questo multiplex nel menabo del tracciato
                            //Questo fa rimanere tutto invariato, ecco il motivo per cui diciamo RIMASTO INTATTO
                            log.stato = SyncStatus.MultiplexReversed;// SyncStatus.Ok;
                            log.note = "Multiplex rimasto intatto in Indd: " + log.codice;
                        }
                    }
                    else
                    {

   
                        //Se questo gruppo/ref singola aveva un MULTIPLEX, lo devo annullare. Non è più così
                        foreach(PromoTracciatiRecord ptr in gruppo_refs)
                        {
                            Dictionary<string, object> _dato = JsonConvert.DeserializeObject<Dictionary<string, object>>(ptr.Dato);
                            if (_dato.ContainsKey(kMultiplex))
                            {
                                _dato.Remove(kMultiplex);
                                ptr.Dato = JsonConvert.SerializeObject(_dato);
                            }
                        }

                    
                        log.stato = SyncStatus.Ok;
                    }

                    List<Dictionary<string, object>> objListForExternalCall = new List<Dictionary<string, object>>();
                    foreach(var item in gruppo_refs)
                    {
                        Dictionary<string, object> item_dato = Utility.Main.getJsonObject(item.Dato!);
                        item_dato["IdRec"] = item.Id;//Per far capire che se è >0 è un record trovato altrimenti NO
                        objListForExternalCall.Add(item_dato);
                    }

                    //Adesso passo la palla all'agenzia per l'interpretazione e analisi dei records letti da INDD
                    Dictionary<string, object> _pass = new Dictionary<string, object>();
                    _pass["gruppo"] = objListForExternalCall;
                    _pass["articoloIndd"] = log.indd;
                    string resultExternalFunction = icItem.execLibFunction(interpreter.lib, _pass).ToString();
                    Dictionary<string, object> parseAnalisi = JsonConvert.DeserializeObject<Dictionary<string, object>>(resultExternalFunction);
                    List<Dictionary<string, object>> gruppoAnalizzato = (parseAnalisi["alterazioniInIndd"] as JArray).ToObject<List<Dictionary<string, object>>>();

                    int _prog = -1;
                    foreach (var item in gruppoAnalizzato)
                    {
                        Int64 idRec = (Int64)item["IdRec"];
                        Dictionary<string, object> reqItem = (item[GLOBAL_VARIABLES.keySyncInddRequisiti] as JObject).ToObject<Dictionary<string, object>>();
                        string sottogruppo = "";
                        if (reqItem.ContainsKey(kSottogruppo))
                        {
                            sottogruppo = reqItem[kSottogruppo].ToString();
                        }
                     
                        if (idRec>0)
                        {
                            var itemRec = lastTracciatoDiControllo.Where(t => t.Id == idRec).FirstOrDefault();
                            var itemRecDato = Utility.Main.getJsonObject(itemRec.Dato);
                            /*if(!itemRecDato.ContainsKey(GLOBAL_VARIABLES.keySyncIndd))
                            {
                                itemRecDato[GLOBAL_VARIABLES.keySyncIndd] = new Dictionary<string, string>();
                                itemRecDato[GLOBAL_VARIABLES.keySyncIndd] = item;
                                
                            }*/
                            itemRecDato[GLOBAL_VARIABLES.keySyncIndd] = item;

                            if(sottogruppo!="")
                                itemRecDato[kSottogruppo] = sottogruppo;
                            

                            itemRec.Dato=JsonConvert.SerializeObject(itemRecDato);
                            
                            if (syncDb)
                            {
                                //Aggiorno il record in tracciato con le info chiave analizzate da agenzia
                                this.ctx2.SaveChanges();
                            }

                        }
                        else
                        {
                            _prog++;
                            var itemRecDato = Utility.Main.getJsonObject(gruppo_refs[_prog].Dato);
                            //if (!itemRecDato.ContainsKey(GLOBAL_VARIABLES.keySyncIndd))
                            //{
                            //    itemRecDato[GLOBAL_VARIABLES.keySyncIndd] = new Dictionary<string, string>();
                            //    itemRecDato[GLOBAL_VARIABLES.keySyncIndd] = item;

                            //}
                            itemRecDato[GLOBAL_VARIABLES.keySyncIndd] = item;
                            if (sottogruppo != "")
                                itemRecDato[kSottogruppo] = sottogruppo;

                            gruppo_refs[_prog].Dato = JsonConvert.SerializeObject(itemRecDato);
                        }
                        
                        
                    }

                }

                

                var _lResult = lastTracciatoDiControllo.Select(s => new SyncInddReportMeshupItem { 
                    Id = s.Id, 
                    Dato = JsonConvert.DeserializeObject<Dictionary<string, object>>(s.Dato), 
                    CodiceGruppo = Utility.Main.getJsonObjectAndGetValueOfKey(s.Dato, kMultiplex)==""?s.CodiceGruppo: Utility.Main.getJsonObjectAndGetValueOfKey(s.Dato, kMultiplex), 
                    DescrizioneDaEsportare="", 
                    DaRevisionare=false,
                    Log = searchLogByCodice(result.logs, s.CodiceGruppo, Utility.Main.getJsonObjectAndGetValueOfKey(s.Dato, Enum.GetName(AddestramentoRuoli.Referenza)+"."+GLOBAL_VARIABLES.keyRefCodice), Utility.Main.getJsonObjectAndGetValueOfKey(s.Dato, Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppoMultiplex)) 
                }).ToList();

                //Ciclo di nuovo tutto per fare bind delle descrizioni richieste
                foreach(var item in _lResult)
                {
                    if (item.CodiceGruppo.IndexOf(",") >= 0)
                        "gruppo".ToString();

                    if (item.Dato!=null && item.Dato.ContainsKey(GLOBAL_VARIABLES.keySyncIndd))
                    {
                        string cod = item.Dato[Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice].ToString();

                        //Solo se ho un sync provenniente da INDD tratto i requisiti
                        var dictSync = (item.Dato[GLOBAL_VARIABLES.keySyncIndd] as JObject).ToObject<Dictionary<string,object>>();
                        if(dictSync.ContainsKey(GLOBAL_VARIABLES.keySyncInddRequisiti))
                        {
                            var dictSyncReq = (dictSync[GLOBAL_VARIABLES.keySyncInddRequisiti] as JObject).ToObject<Dictionary<string, object>>();


                            
                            if (cod == "7368738")
                                "taked".ToString();

                            //Qui adesso devo controllare tutte le richieste di descrizione.
                            //Al momento implementiamo solo il recupero della descrizione singola se richiesta
                            if (dictSyncReq.ContainsKey(GLOBAL_VARIABLES.keyRequisitoDescrizioneSingola) &&
                                (bool)dictSyncReq[GLOBAL_VARIABLES.keyRequisitoDescrizioneSingola])
                            {
                                //Recupero descrizione dall'archivio



                                var art =await this.ctx.Articolis.Include(i => i.ArticoliDescrizionis).Where(a => a.Codice == cod).FirstOrDefaultAsync();
                                if(art!=null)
                                {
                                    if (art.ArticoliDescrizionis.Count > 0)
                                    {
                                        var revArt = art.ArticoliDescrizionis.OrderByDescending(o => o.DataUltimaRicezione).FirstOrDefault();
                                        if (revArt.DescrizioneIndd != null && revArt.DescrizioneIndd != "")
                                            item.DescrizioneDaEsportare = revArt.DescrizioneIndd;
                                        else
                                            item.DescrizioneDaEsportare = String.Format("{0}{1}{2}{3}", revArt.Descrizione1, revArt.Descrizione2, revArt.Descrizione3, revArt.Descrizione4);
                                    }
                                    else
                                    {
                                        if (cod!=item.CodiceGruppo)
                                            item.DaRevisionare = true;
                                    }
                                }

                            }
                            else
                            {
                                //Referenza raggruppata.
                                //Dovrebbe avere il codice sottogruppo


                            }

                        }

                        /*
                        if (cod != item.CodiceGruppo)
                        {
                            //Si tratta di gruppo per cui stabilisco se è da revisionare oppure no
                            var gGiaRev = _lResult.Where(lr => lr.CodiceGruppo == item.CodiceGruppo && lr.GruppoDaRevisionare != null).FirstOrDefault();
                            if (gGiaRev == null)
                            {
                                var gRev = await this.ctx.ArticoliDescrizionis.Where(a => a.CodiceGruppo == item.CodiceGruppo).FirstOrDefaultAsync();
                                if (gRev != null)
                                {
                                    item.GruppoDaRevisionare = false;
                                }
                                else
                                {
                                    item.GruppoDaRevisionare = true;
                                }
                            }
                            else
                            {
                                item.GruppoDaRevisionare = gGiaRev.GruppoDaRevisionare;
                            }
                        }*/
                    }
                }

                return Ok(_lResult.OrderBy(o => o.CodiceGruppo));//.GroupBy(g=>g.CodiceGruppo).Select(s=>s.FirstOrDefault()).ToList());


            }
            catch(Exception ex)
            {
                return Ok(ex.ToString());
            }

        }

        SyncInddLog searchLogByCodice(List<SyncInddLog> lista, string codice_gruppo, string codice_singola, string codice_multiplex)
        {
            if (codice_gruppo == "5040696")
                "debug".ToString();
            if (codice_multiplex== "5040696,5054788")
                "debug".ToString();

            var syncGruppo = lista.Where(l => l.codice == codice_gruppo).FirstOrDefault();
            if (syncGruppo == null)
            {
                if (codice_multiplex != null && codice_multiplex != "")
                //Controllo log del multiplex
                { 
                    var syncGMPlex = lista.Where(l => l.codice == codice_multiplex).FirstOrDefault();
                    if (syncGMPlex!=null)
                        return syncGMPlex;
                }
                //Allora devo controllare la singola
                var syncSingola = lista.Where(l => l.codice == codice_singola).FirstOrDefault();
                return syncSingola;
            }

            return syncGruppo;
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

            return Ok();
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

            return Ok();
        }


        [HttpPut]
        [Route("Revisore/approva")]
        public async Task<IActionResult> approva(RevisioniActions acts)
        {
            BoolResult result = new BoolResult();
            
            List<ArticoliDescrizioni> descrItemList = new List<ArticoliDescrizioni>();
            foreach (RevisioneAction act in acts.coda)
            {
                try
                {                    
                    if (act.IdRef > 0)
                    {
                        ArticoliDescrizioni descrItem = await this.ctx.ArticoliDescrizionis.Include(i => i.IdArticoloNavigation).Where(d => d.IdArticolo == act.IdRef).FirstOrDefaultAsync();
                        PromoTracciatiRecord TracRecord = await this.ctx2.PromoTracciatiRecords.Where(d => d.Id == act.IdRecord).FirstOrDefaultAsync();

                        if (descrItem!= null)
                        {
                            Dictionary<string, object> Dato = JsonConvert.DeserializeObject<Dictionary<string, object>>(TracRecord.Dato);
                            string firmaTracciato = Dato["Tracciato.Firma"].ToString();
                            string firmaRevisione = descrItem.FirmaTracciato;
                            if (firmaRevisione != firmaTracciato)
                            {
                                //descrItem.FirmaTracciato = firmaTracciato;
                            }                            
                        }
                        else
                        {
                            //Creo priama revisione dell'articolo
                            descrItem = new ArticoliDescrizioni();
                            descrItem.IdArticolo = act.IdRef;
                            descrItem.Approvata = true;//Per ora è messo statico MA andrebbe messo controllo dac lient che ci dica se lo ha ereditato pari apri da tracciato
                            descrItem.Descrizione1 = act.Descrizione1;
                            descrItem.Descrizione2 = act.Descrizione2;
                            descrItem.Descrizione3 = act.Descrizione3;
                            descrItem.Descrizione4 = act.Descrizione4;
                            descrItem.Peso = act.Peso;
                            descrItem.Um = act.Um;
                            descrItem.DataUltimaRicezione = DateTime.Now;
                            descrItem.FirmaTracciato = act.FirmaTracciato;
                            this.ctx.Add(descrItem);

                            descrItem.IdArticoloNavigation = this.ctx.Articolis.Where(a => a.Id == act.IdRef).FirstOrDefault();
                        }
                        descrItemList.Add(descrItem);
                    }
                    else
                    {
                        ArticoliDescrizioni descrItem = await this.ctx.ArticoliDescrizionis.Include(i => i.IdArticoloNavigation).Where(d => d.CodiceGruppo == act.CodiceGruppo).FirstOrDefaultAsync();
                        PromoTracciatiRecord TracRecord = await this.ctx2.PromoTracciatiRecords.Where(d => d.Id == act.IdRecord).FirstOrDefaultAsync();

                        if (descrItem != null)
                        {
                            Dictionary<string, object> Dato = JsonConvert.DeserializeObject<Dictionary<string, object>>(TracRecord.Dato);
                            string firmaTracciato = Dato["Tracciato.Firma"].ToString();
                            string firmaRevisione = descrItem.FirmaTracciato;
                            if (firmaRevisione != firmaTracciato)
                            {
                                descrItem.FirmaTracciato = firmaTracciato;
                            }
                        }
                        else
                        {
                            //Creo prima revisione dell'articolo
                            descrItem = new ArticoliDescrizioni();
                            descrItem.CodiceGruppo = act.CodiceGruppo;
                            descrItem.Approvata = true;//Per ora è messo statico MA andrebbe messo controllo dac lient che ci dica se lo ha ereditato pari apri da tracciato
                            descrItem.Descrizione1 = act.Descrizione1;
                            descrItem.Descrizione2 = act.Descrizione2;
                            descrItem.Descrizione3 = act.Descrizione3;
                            descrItem.Descrizione4 = act.Descrizione4;
                            descrItem.Peso = act.Peso;
                            descrItem.Um = act.Um;
                            descrItem.DataUltimaRicezione = DateTime.Now;
                            descrItem.FirmaTracciato = act.FirmaTracciato;
                            this.ctx.Add(descrItem);

                            descrItem.IdArticoloNavigation = this.ctx.Articolis.Where(a => a.Codice == act.CodiceGruppo).FirstOrDefault();
                        }
                        descrItemList.Add(descrItem);
                    }
                }
                catch (Exception ex)
                {
                    result.Esito = false;
                    result.error = ex.ToString();
                    return Ok(result);
                }
            }
            try
            {
                this.ctx.SaveChanges();
            }
            catch (Exception ex)
            {
                result.Esito = false;
                result.error = ex.ToString();
                return Ok(result);
            }

            result.Esito = true;
            return Ok(descrItemList);
        }

        
        [HttpGet]
        [Route("Revisore/AggiungiASottogruppo/{id_rec}/{id_rec_pilota}/{id_tracciato}/{propaga}")]

        public async Task<IActionResult> AggiungiSottogruppo(Int64 id_rec, Int64 id_rec_pilota, int id_tracciato, bool propaga)
        {
            CodiciConSottogruppo result = new CodiciConSottogruppo();
            if (id_tracciato == null || id_tracciato == 0)
            {
                result.error = "tracciato non arrivato";
                return Ok(result);
            }

            string codiceGruppo;
            string key_codice_sottogruppo = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceSottogruppo;
            string key_codice_referenza = Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice;
            string codiceMultiplex = "";
            List<PromoTracciatiRecord> RecordDaAnalizzare = new List<PromoTracciatiRecord>();
            try
            {
                //cerco se il pilota fa già parte di un sottogruppo
                PromoTracciatiRecord pilota = ctx2.PromoTracciatiRecords.Where(f => f.Id== id_rec_pilota).FirstOrDefault();
                Dictionary<string, object> DatoPilota = JsonConvert.DeserializeObject<Dictionary<string, object>>(pilota.Dato);
                List<PromoTracciatiRecord> RecordDaModificare = new List<PromoTracciatiRecord>();
                List<PromoTracciatiRecord> recordDaRitornare = new List<PromoTracciatiRecord>();
                
                List<string> codici = new List<string>();
                PromoTracciatiRecord element = ctx2.PromoTracciatiRecords.Include(f=>f.IdTracciatoNavigation).Where(f => f.Id == id_rec).FirstOrDefault();
                Dictionary<string, object> Dato = JsonConvert.DeserializeObject<Dictionary<string, object>>(element.Dato);
                recordDaRitornare.Add(element);
                List<int> idsTracciatiPromo = ctx2.PromoTracciatis.Where(f => f.IdPromo == element.IdTracciatoNavigation.IdPromo).Select(f => f.Id).ToList();
                string codiceSottogruppo = "";
                if (DatoPilota.ContainsKey(key_codice_sottogruppo))
                {
                    codiceSottogruppo = DatoPilota[key_codice_sottogruppo].ToString();
                    codiceGruppo = pilota.CodiceGruppo;

                    if (propaga)
                    {
                        RecordDaAnalizzare.AddRange(ctx2.PromoTracciatiRecords.Where(f => f.CodiceGruppo == codiceGruppo && idsTracciatiPromo.Contains(f.IdTracciato)));
                        RecordDaAnalizzare = RecordDaAnalizzare.OrderBy(f => f.IdTracciato).ToList();

                        foreach (PromoTracciatiRecord r in RecordDaAnalizzare)
                        {
                            Dictionary<string, object> DatoAnalisi = JsonConvert.DeserializeObject<Dictionary<string, object>>(r.Dato);
                            if (DatoAnalisi.ContainsKey(key_codice_sottogruppo) && DatoAnalisi[key_codice_sottogruppo].ToString() == codiceSottogruppo && r.IdTracciato == id_tracciato)
                            {
                                recordDaRitornare.Add(r);
                            }
                        }

                        List<PromoTracciatiRecord> tmpListDaAnalizzare = new List<PromoTracciatiRecord>();
                        foreach(PromoTracciatiRecord r in recordDaRitornare)
                        {
                            tmpListDaAnalizzare.AddRange(RecordDaAnalizzare.Where(f => Utility.Main.getJsonObjectAndGetValueOfKey(f.Dato, key_codice_referenza) == Utility.Main.getJsonObjectAndGetValueOfKey(r.Dato, key_codice_referenza)));
                        }
                        RecordDaAnalizzare = tmpListDaAnalizzare;

                        List<int> ids = new List<int>();
                        foreach (PromoTracciatiRecord r in RecordDaAnalizzare) //rimuovo i tracciati che non posso modificare
                        {
                            Dictionary<string, object> DatoTmp = JsonConvert.DeserializeObject<Dictionary<string, object>>(r.Dato);
                            if (DatoTmp.ContainsKey(key_codice_sottogruppo) && DatoTmp[key_codice_sottogruppo].ToString() != DatoPilota[key_codice_sottogruppo].ToString() && !ids.Contains(r.IdTracciato))
                            {
                                ids.Add(r.IdTracciato);
                            }
                        }
                        foreach (int id in ids)
                        {
                            RecordDaAnalizzare.RemoveAll(f => f.IdTracciato == id);
                            result.tracciatiNonModificati.Add(ctx2.PromoTracciatis.Where(f => f.Id == id).FirstOrDefault().Sigla);
                        }

                        RecordDaModificare.AddRange(recordDaRitornare);
                        List<PromoTracciatiRecord> tmpList= new List<PromoTracciatiRecord>();
                        foreach (PromoTracciatiRecord p in RecordDaModificare)
                        {
                            string CodRef = Utility.Main.getJsonObjectAndGetValueOfKey(p.Dato, key_codice_referenza);
                            tmpList.AddRange(RecordDaAnalizzare.Where(f => (Utility.Main.getJsonObjectAndGetValueOfKey(f.Dato, key_codice_referenza) == CodRef) && f.IdTracciato != id_tracciato));
                        }
                        RecordDaModificare.AddRange(tmpList);
                    }
                    else
                    {
                        RecordDaModificare.Add(element);
                        RecordDaAnalizzare.AddRange(ctx2.PromoTracciatiRecords.Where(f => f.CodiceGruppo == codiceGruppo && idsTracciatiPromo.Contains(f.IdTracciato)));
                        foreach (PromoTracciatiRecord r in RecordDaAnalizzare)
                        {
                            Dictionary<string, object> DatoDaAnalizzare = JsonConvert.DeserializeObject<Dictionary<string, object>>(r.Dato);
                            if (DatoDaAnalizzare.ContainsKey(key_codice_sottogruppo) && DatoDaAnalizzare[key_codice_sottogruppo].ToString() == codiceSottogruppo)
                            {
                                RecordDaModificare.Add(r);
                                recordDaRitornare.Add(r);
                            }
                        }
                    }
                }
                else
                {
                    codiceGruppo = pilota.CodiceGruppo;
                    if (propaga)
                    {
                        recordDaRitornare.Add(pilota);
                        RecordDaAnalizzare.AddRange(ctx2.PromoTracciatiRecords.Where(f => f.CodiceGruppo == codiceGruppo && idsTracciatiPromo.Contains(f.IdTracciato)));

                        List<PromoTracciatiRecord> tmpListDaAnalizzare = new List<PromoTracciatiRecord>();
                        foreach (PromoTracciatiRecord r in recordDaRitornare)
                        {
                            tmpListDaAnalizzare.AddRange(RecordDaAnalizzare.Where(f => Utility.Main.getJsonObjectAndGetValueOfKey(f.Dato, key_codice_referenza) == Utility.Main.getJsonObjectAndGetValueOfKey(r.Dato, key_codice_referenza)));
                        }
                        RecordDaAnalizzare = tmpListDaAnalizzare;

                        List<int> ids = new List<int>();
                        foreach (PromoTracciatiRecord r in RecordDaAnalizzare)
                        {
                            Dictionary<string, object> DatoTmp = JsonConvert.DeserializeObject<Dictionary<string, object>>(r.Dato);
                            if (DatoTmp.ContainsKey(key_codice_sottogruppo) && !ids.Contains(r.IdTracciato))
                            {
                                ids.Add(r.IdTracciato);
                            }
                        }
                        foreach(int id in ids)
                        {
                            RecordDaAnalizzare.RemoveAll(f=>f.IdTracciato==id);
                            result.tracciatiNonModificati.Add(ctx2.PromoTracciatis.Where(f => f.Id == id).FirstOrDefault().Sigla);
                        }

                        RecordDaModificare.AddRange(RecordDaAnalizzare.Where(r => (Utility.Main.getJsonObjectAndGetValueOfKey(r.Dato, key_codice_referenza) == DatoPilota[key_codice_referenza].ToString() && Utility.Main.getJsonObjectAndGetValueOfKey(r.Dato, key_codice_sottogruppo) == "" || Utility.Main.getJsonObjectAndGetValueOfKey(r.Dato, key_codice_referenza) == Dato[key_codice_referenza].ToString()) && Utility.Main.getJsonObjectAndGetValueOfKey(r.Dato, key_codice_sottogruppo) == ""));
                        
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
                    Dictionary<string, object> DatoRecord = JsonConvert.DeserializeObject<Dictionary<string, object>>(D.Dato);
                    codici.Add(DatoRecord[key_codice_referenza].ToString());
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
                    Dictionary<string, object> DatoRecord = JsonConvert.DeserializeObject<Dictionary<string, object>>(D.Dato);
                    DatoRecord[key_codice_sottogruppo] = codiceSottogruppo;
                    D.Dato = JsonConvert.SerializeObject(DatoRecord);
                }
                this.ctx2.SaveChanges();
                foreach (PromoTracciatiRecord r in recordDaRitornare)
                {
                    result.idRecDaModificare.Add(r.Id);
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
            if (id_tracciato == null || id_tracciato == 0)
            {
                result.error = "tracciato non inviato in rimozione";
                return Ok(result);
            }
            string codiceGruppo;
            string key_codice_sottogruppo = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceSottogruppo;
            string key_codice_referenza = Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice;
            string codiceMultiplex = "";
            List<PromoTracciatiRecord> RecordDaAnalizzare = new List<PromoTracciatiRecord>();
            try
            {
                PromoTracciatiRecord pilota = ctx2.PromoTracciatiRecords.Where(f => f.Id == id_rec_pilota).FirstOrDefault();
                Dictionary<string, object> DatoPilota = JsonConvert.DeserializeObject<Dictionary<string, object>>(pilota.Dato);
                List<PromoTracciatiRecord> RecordDaModificare = new List<PromoTracciatiRecord>();
                List<PromoTracciatiRecord> recordDaRitornare = new List<PromoTracciatiRecord>();

                List<string> codici = new List<string>();
                PromoTracciatiRecord element = ctx2.PromoTracciatiRecords.Include(f => f.IdTracciatoNavigation).Where(f => f.Id == id_rec).FirstOrDefault();
                Dictionary<string, object> Dato = JsonConvert.DeserializeObject<Dictionary<string, object>>(element.Dato);
                string codiceSottogruppoRimosso = Dato[key_codice_sottogruppo].ToString();
                Dato.Remove(key_codice_sottogruppo);
                element.Dato = JsonConvert.SerializeObject(Dato);
                this.ctx2.SaveChanges();

                List<int> idsTracciatiPromo = ctx2.PromoTracciatis.Where(f => f.IdPromo == element.IdTracciatoNavigation.IdPromo).Select(f => f.Id).ToList();
                codiceGruppo = pilota.CodiceGruppo;
                if (propaga)
                {
                    RecordDaAnalizzare.AddRange(ctx2.PromoTracciatiRecords.Where(f => f.CodiceGruppo == codiceGruppo && idsTracciatiPromo.Contains(f.IdTracciato)));
                    List<PromoTracciatiRecord> tmpListDaAnalizzare = new List<PromoTracciatiRecord>();

                    tmpListDaAnalizzare.AddRange(RecordDaAnalizzare.Where(f => Utility.Main.getJsonObjectAndGetValueOfKey(f.Dato, key_codice_referenza) == Utility.Main.getJsonObjectAndGetValueOfKey(element.Dato, key_codice_referenza)));

                    RecordDaAnalizzare = tmpListDaAnalizzare;
                    RecordDaModificare.AddRange(RecordDaAnalizzare.Where(r => Utility.Main.getJsonObjectAndGetValueOfKey(r.Dato, key_codice_referenza) == Dato[key_codice_referenza].ToString() && Utility.Main.getJsonObjectAndGetValueOfKey(r.Dato, key_codice_sottogruppo) == codiceSottogruppoRimosso));
                    foreach (PromoTracciatiRecord r in RecordDaModificare)
                    {
                        Dictionary<string, object> DatoRimossoDaCopie = JsonConvert.DeserializeObject<Dictionary<string, object>>(r.Dato);
                        DatoRimossoDaCopie.Remove(key_codice_sottogruppo);
                        r.Dato = JsonConvert.SerializeObject(DatoRimossoDaCopie);
                    }
                    this.ctx2.SaveChanges();
                    RecordDaAnalizzare.Clear();
                    RecordDaModificare.Clear();
                }

                string codiceSottogruppo = "";
                if (DatoPilota.ContainsKey(key_codice_sottogruppo))
                {
                    codiceSottogruppo = DatoPilota[key_codice_sottogruppo].ToString();
                    codiceGruppo = pilota.CodiceGruppo;

                    if (propaga)
                    {

                        RecordDaAnalizzare.AddRange(ctx2.PromoTracciatiRecords.Where(f => f.CodiceGruppo == codiceGruppo && idsTracciatiPromo.Contains(f.IdTracciato)));
                        RecordDaAnalizzare = RecordDaAnalizzare.OrderBy(f => f.IdTracciato).ToList();

                        foreach (PromoTracciatiRecord r in RecordDaAnalizzare)
                        {
                            Dictionary<string, object> DatoDaAnalizzare = JsonConvert.DeserializeObject<Dictionary<string, object>>(r.Dato);
                            if (DatoDaAnalizzare.ContainsKey(key_codice_sottogruppo) && DatoDaAnalizzare[key_codice_sottogruppo].ToString() == codiceSottogruppo && r.IdTracciato == id_tracciato)
                            {
                                RecordDaModificare.Add(r);
                                recordDaRitornare.Add(r);
                            }
                        }



                        List<PromoTracciatiRecord> tmpListDaAnalizzare = new List<PromoTracciatiRecord>();
                        foreach (PromoTracciatiRecord r in recordDaRitornare)
                        {
                            tmpListDaAnalizzare.AddRange(RecordDaAnalizzare.Where(f => Utility.Main.getJsonObjectAndGetValueOfKey(f.Dato, key_codice_referenza) == Utility.Main.getJsonObjectAndGetValueOfKey(r.Dato, key_codice_referenza)));
                        }
                        RecordDaAnalizzare = tmpListDaAnalizzare;

                        List<int> ids = new List<int>();
                        foreach (PromoTracciatiRecord r in RecordDaAnalizzare)
                        {
                            Dictionary<string, object> DatoTmp = JsonConvert.DeserializeObject<Dictionary<string, object>>(r.Dato);
                            if (DatoTmp.ContainsKey(key_codice_sottogruppo) && DatoTmp[key_codice_sottogruppo].ToString() != codiceSottogruppoRimosso && !ids.Contains(r.IdTracciato))
                            {
                                ids.Add(r.IdTracciato);
                            }
                        }
                        foreach (int id in ids)
                        {
                            RecordDaAnalizzare.RemoveAll(f => f.IdTracciato == id);
                            result.tracciatiNonModificati.Add(ctx2.PromoTracciatis.Where(f => f.Id == id).FirstOrDefault().Sigla);
                        }

                        List<PromoTracciatiRecord> tmpList = new List<PromoTracciatiRecord>();
                        foreach (PromoTracciatiRecord p in RecordDaModificare)
                        {
                            string CodRef = Utility.Main.getJsonObjectAndGetValueOfKey(p.Dato, key_codice_referenza);
                            tmpList.AddRange(RecordDaAnalizzare.Where(f => (Utility.Main.getJsonObjectAndGetValueOfKey(f.Dato, key_codice_referenza) == CodRef) && f.IdTracciato != id_tracciato));
                        }
                        RecordDaModificare.AddRange(tmpList);
                    }
                    else
                    {
                        RecordDaAnalizzare.AddRange(ctx2.PromoTracciatiRecords.Where(f => f.CodiceGruppo == codiceGruppo && f.IdTracciato == id_tracciato));
                        foreach (PromoTracciatiRecord r in RecordDaAnalizzare)
                        {
                            Dictionary<string, object> DatoDaAnalizzare = JsonConvert.DeserializeObject<Dictionary<string, object>>(r.Dato);
                            if (DatoDaAnalizzare.ContainsKey(key_codice_sottogruppo) && DatoDaAnalizzare[key_codice_sottogruppo].ToString() == codiceSottogruppo)
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
                        Dictionary<string, object> DatoRecord = JsonConvert.DeserializeObject<Dictionary<string, object>>(D.Dato);
                        codici.Add(DatoRecord[key_codice_referenza].ToString());
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
                        Dictionary<string, object> DatoRecord = JsonConvert.DeserializeObject<Dictionary<string, object>>(D.Dato);
                        DatoRecord[key_codice_sottogruppo] = codiceSottogruppo;
                        D.Dato = JsonConvert.SerializeObject(DatoRecord);
                    }
                }
                else
                {
                    codiceSottogruppo = "";
                    foreach (PromoTracciatiRecord D in RecordDaModificare)
                    {
                        Dictionary<string, object> DatoDaRimuovere = JsonConvert.DeserializeObject<Dictionary<string, object>>(D.Dato);
                        DatoDaRimuovere.Remove(key_codice_sottogruppo);
                        D.Dato = JsonConvert.SerializeObject(DatoDaRimuovere);
                    }
                }
                this.ctx2.SaveChanges();
                foreach(PromoTracciatiRecord r in recordDaRitornare)
                {
                    result.idRecDaModificare.Add(r.Id);
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
                        Codice = g.Key.ToString(), // Converti il campo "Codice" in una stringa confrontabile
                                                   // Seleziona gli altri campi che desideri includere
                        CodiceGruppo = g.First().CodiceGruppo.ToString(),
                        Dato = g.First().Dato.ToString()
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
                    .Where(a => !string.IsNullOrEmpty(a.FirmaTracciato))
                    .Select(a => a.FirmaTracciato)
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
                        object firmaElemento;
                        Dictionary<string, object> Dato = JsonConvert.DeserializeObject<Dictionary<string, object>>(element.Dato);                        
                        if (Dato.TryGetValue(firma, out firmaElemento))
                        {
                            string firmaEl = firmaElemento.ToString();

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
    }
}
