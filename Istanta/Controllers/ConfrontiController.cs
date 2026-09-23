using ClosedXML.Excel;
using CsvHelper;
using CsvHelper.Configuration;
using DocumentFormat.OpenXml.Bibliography;
using DocumentFormat.OpenXml.Drawing;
using DocumentFormat.OpenXml.Drawing.Diagrams;
using DocumentFormat.OpenXml.InkML;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Spreadsheet;
using DocumentFormat.OpenXml.Vml;
using ExcelDataReader;
using Istanta.Models;
using Istanta.Models_2;
using Istanta.Utility;
using IstantaLib;
using LinqKit;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Newtonsoft;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System.Data;
using System.Data.Entity.Core.Common.CommandTrees.ExpressionBuilder;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.IO;
using System.Reflection.Metadata;

namespace Istanta.Controllers
{
    public class ConfrontiController : Controller
    {
        private readonly ILogger<ArchivioController> _logger;
        private readonly edro21_dbContext ctx;
        private readonly Edro21_DbContext2 ctx2;
        private readonly IConfiguration _config;
        private readonly string path_to_import = "";
        private readonly string path_to_export = "";
        private readonly string path_external_lib = "";
        private readonly string path_external_source = "";
        private readonly IOptions<FicoConfig> _fico_conf;
        private readonly IDbContextFactory<edro21_dbContext> _dbContextFactory;

        private readonly IDbContextFactory<Edro21_DbContext2> _dbContextFactory2;
        public ConfrontiController(ILogger<ArchivioController> logger, IConfiguration configuration, IOptions<PathOperationImport> option_import, IOptions<PathOperationExport> option_export, IOptions<PathExternal> external_lib, IOptions<FicoConfig> ficoConf, IDbContextFactory<edro21_dbContext> dbContextFactory, IDbContextFactory<Edro21_DbContext2> dbContextFactory2)
        {
            this._dbContextFactory2 = dbContextFactory2;
            this._dbContextFactory = dbContextFactory;
            this.ctx = this._dbContextFactory.CreateDbContext();//new edro21_dbContext(configuration.GetConnectionString("IstandaConnectionDb")!);
            this.ctx2 = this._dbContextFactory2.CreateDbContext();
           
            _logger = logger; 
            _config = configuration;
            path_to_import = option_import.Value.path;
            if (option_export!=null)
                path_to_export = option_export.Value.path;
            path_external_lib = external_lib.Value.pathLib;
            path_external_source = external_lib.Value.pathSource;
            _fico_conf = ficoConf;
        }

        public IActionResult Index()
        {
            return View();
        }

        [HttpGet]
        [Route("Confronti/CheckCombinazioni/{idPromo1}/{idPromo2}")]
        public async Task<IActionResult> CheckCombinazioni(int idPromo1, int idPromo2)
        {
            ConfrontoCheckResponse result = new ConfrontoCheckResponse();

            try
            {
                if (idPromo1 <= 0)
                    throw new Exception("primaria_necessaria");


                var pItem = this.ctx2.Promos.Include(i => i.PromoTracciatis).FirstOrDefault(f => f.Id == idPromo1);

                if (pItem==null)
                    throw new Exception("promo_primaria_non_trovata");

                var combinazioniResult = pItem.PromoTracciatis.Select(s => new Dictionary<string,string>
                {
                    { $"id", $"{s.guidCanale}_{s.guidArea}" },
                    { $"titolo", $"{s.Canale}_{s.Area}" }
                }
                ).ToList();

                result.combinazioni_master = combinazioniResult;

                if (idPromo1 == idPromo2 || idPromo2==0)
                {
                    //Si prende tutte le combinazioni della promo1
                    result.combinazioni_slave= combinazioniResult;
                }
                else
                {
                    //Prendo il secondario
                    var pItemSec = this.ctx2.Promos.Include(i => i.PromoTracciatis).FirstOrDefault(f => f.Id == idPromo2);
                    var combinazioniSecondario = pItemSec!.PromoTracciatis.Select(s => new Dictionary<string, string>
                    {
                        { $"id", $"{s.guidCanale}_{s.guidArea}" },
                        { $"titolo", $"{s.Canale}_{s.Area}" }
                    }
                    ).ToList();

                    //Si prendono le aree canali in comune
                    //reduce tenendo solo quelli in comune
                    result.combinazioni_slave = combinazioniSecondario;

                }

            }
            catch (Exception ex)
            {
                result.error = ex.ToString();
            }

            return Ok(result);
        }

        [HttpPut]
        [Route("Confronti/ConfrontaListe2")]
        public async Task<IActionResult> ConfrontaListe2(InputForConfronto2 req)
        {
            ResponseConfronto2 result = new ResponseConfronto2();

            try
            {

                if (req.idImportazioneSlave<=0 && 
                    req.IdPromoSlave==req.IdPromoMaster && 
                    req.filtroCombinazioneMaster==req.filtroCombinazioneSlave &&
                    req.versioneMaster==req.versioneSlave
                    )
                {
                    throw new Exception("confronto_tra_due_liste_identiche");
                }

                Promo? p = this.ctx2.Promos.Include(i => i.PromoTracciatis).ThenInclude(i2=>i2.PromoTracciatiRecords).FirstOrDefault(f => f.Id == req.IdPromoMaster);

                if (p == null)
                    throw new Exception("promo_master_non_trovata");


                Attivitum? aItem = null;
                OperationRequest? opReq=null;
                InputFormTracciato? packet = null;

                string idLabel = "";

                if (req.idImportazioneSlave > 0)
                {
                    aItem = this.ctx.Attivita.FirstOrDefault(a => a.Id == req.idImportazioneSlave);

                    if (aItem == null)
                        throw new Exception("attivita_importazione_non_trovata");

                    //Si recupera queste informazioni perchè se siamo in questa casistica, tutto quello che viene raccolto dai tracciati GIA importati
                    //E' bene sapere che il tracciato importato ha per sua logica una sola LABEL e intende confrontare SOLO quella
                    opReq = JsonConvert.DeserializeObject<OperationRequest>(aItem.Contract)!;
                    string? strpkg = opReq!.Packet.ToString();
                    packet = JsonConvert.DeserializeObject<InputFormTracciato>(strpkg!)!;
                    idLabel = packet.getFieldByKey("idLabel");


                }


                List<PromoTracciatiRecord> ptrMaster = new List<PromoTracciatiRecord>();
                List<PromoTracciatiRecord> ptrSlave = new List<PromoTracciatiRecord>();

                if (req.filtroCombinazioneMaster != "0")
                {
                    string[] p_c_a = req.filtroCombinazioneMaster.Split('_');
                    string guidCanale = p_c_a[0];
                    string guidArea = p_c_a[1];

                    //Filtro i ptr per guid are e canale come da filtro
                    var pt = p.PromoTracciatis.Where(f => f.guidArea == guidArea && f.guidCanale == guidCanale);
                    if (pt != null)
                    {                       
                        pt.Select(s => s.PromoTracciatiRecords).ToList().ForEach(f =>
                        {
                            var tracciatoObj = f.FirstOrDefault()!.IdTracciatoNavigation;

                            f.GroupBy(g=>g.Label).ForEach(g=>
                            {
                                if (req.idImportazioneSlave <= 0 || g.Key ==idLabel)
                                {
                                    //Prendo solo l'ultima versione per ogni label
                                    var vers = g.GroupBy(o => o.Versione).Select(s => s.Key).ToList();
                                    vers.Sort();
                                    Byte lastVer = vers.LastOrDefault();
                                    ptrMaster.AddRange(g.Where(t =>t.Label==g.Key && t.Versione == lastVer));
                                    
                                    if (lastVer>1)
                                    {
                                        //Prendo anche i record uscenti per questa label e lo faccio prendendo la versione lastVer-1 di questa etichetta
                                        ptrMaster.AddRange(g.Where(t => t.Label == g.Key && t.Versione == lastVer - 1));
                                    }
                                }
                            });
                        });
                    }
                }
                else
                {
                   p.PromoTracciatis.Select(s => s.PromoTracciatiRecords).ToList().ForEach(f =>
                   {
                       f.GroupBy(g => g.Label).ForEach(g =>
                       {
                           if (req.idImportazioneSlave <= 0 || g.Key == idLabel)
                           {
                               //Prendo solo l'ultima versione per ogni label
                               var vers = g.GroupBy(o => o.Versione).Select(s => s.Key).ToList();
                               vers.Sort();
                               Byte lastVer = vers.LastOrDefault();
                               ptrMaster.AddRange(g.Where(t => t.Label == g.Key && t.Versione == lastVer));

                               if (lastVer > 1)
                               {
                                   //Prendo anche i record uscenti per questa label e lo faccio prendendo la versione lastVer-1 di questa etichetta
                                   ptrMaster.AddRange(g.Where(t => t.Label == g.Key && t.Versione == lastVer - 1));
                               }
                           }
                       });
                   });
                }

                Promo? pSec = this.ctx2.Promos.Include(i => i.PromoTracciatis).ThenInclude(i2 => i2.PromoTracciatiRecords).FirstOrDefault(f => f.Id == req.IdPromoSlave);

                if (req.idImportazioneSlave<=0)
                {
                    //Tracciato gia esistente

                    if (pSec == null)
                        throw new Exception("promo_slave_non_trovata");

                    if (req.filtroCombinazioneSlave != "0")
                    {
                        string[] p_c_a = req.filtroCombinazioneSlave.Split('_');
                        string guidCanale = p_c_a[0];
                        string guidArea = p_c_a[1];

                        //Filtro i ptr per guid are e canale come da filtro
                        var pt = pSec.PromoTracciatis.Where(f => f.guidArea == guidArea && f.guidCanale == guidCanale);
                        if (pt != null)
                        {
                            pt.Select(s => s.PromoTracciatiRecords).ToList().ForEach(f =>
                            {
                                f.GroupBy(g => g.Label).ForEach(g =>
                                {
                                    //Prendo solo l'ultima versione per ogni label
                                    var vers = g.GroupBy(o => o.Versione).Select(s => s.Key).ToList();
                                    vers.Sort();
                                    Byte lastVer = vers.LastOrDefault();

                                    ptrSlave.AddRange(g.Where(t => t.Label == g.Key && t.Versione == lastVer));

                                    if (lastVer > 1)
                                    {
                                        //Prendo anche i record uscenti per questa label e lo faccio prendendo la versione lastVer-1 di questa etichetta
                                        ptrSlave.AddRange(g.Where(t => t.Label == g.Key && t.Versione == lastVer - 1));
                                    }

                                });
                            });
                        }
                    }
                    else
                    {
                        pSec.PromoTracciatis.Select(s => s.PromoTracciatiRecords).ToList().ForEach(f =>
                        {
                            f.GroupBy(g => g.Label).ForEach(g =>
                            {
                                if (req.idImportazioneSlave <= 0 || g.Key == idLabel)
                                {
                                    if (req.idImportazioneSlave <= 0 || g.Key == idLabel)
                                    {
                                        //Prendo solo l'ultima versione per ogni label
                                        var vers = g.GroupBy(o => o.Versione).Select(s => s.Key).ToList();
                                        vers.Sort();
                                        Byte lastVer = vers.LastOrDefault();

                                        ptrSlave.AddRange(g.Where(t => t.Label == g.Key && t.Versione == lastVer));

                                        if (lastVer > 1)
                                        {
                                            //Prendo anche i record uscenti per questa label e lo faccio prendendo la versione lastVer-1 di questa etichetta
                                            ptrSlave.AddRange(g.Where(t => t.Label == g.Key && t.Versione == lastVer - 1));
                                        }
                                    }
                                }
                            });
                        });
                    }
                }
                else
                {
                    //Logiche di lettura excel

                    List<FicoContextField> context = opReq!.context;
                    string path_attivita = path_to_import + req.idImportazioneSlave + System.IO.Path.DirectorySeparatorChar;
                    string source = path_attivita + packet!.filename;

                    int idAdstr;
                    Int32.TryParse(packet.getFieldByKey("idAddestramento"), out idAdstr);
                    

                    try
                    {

                        string nome_colonna_scatto = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodice;
                        string nome_colonna_codGruppo = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppo;
                        string kRefCod = Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice;

                        PromoImportazioni? pImp = this.ctx2.PromoImportazionis.Where(imp => imp.Id == packet.idImportazione).FirstOrDefault();

                        ImportResult? parsingRes = leggiDatoExcel(pImp!, source, idLabel, packet, context, idAdstr);

                        if (parsingRes!.errors != "")
                        {
                            throw new Exception($"LIB ERROR#{parsingRes.errors}#");
                        }

     

                        Func<object, object, bool> SonoUguali = (object a, object b) =>
                        {
                            var tokenA = a != null ? JToken.FromObject(a) : null;
                            var tokenB = b != null ? JToken.FromObject(b) : null;
                            return JToken.DeepEquals(tokenA, tokenB);
                        };

                        List<PromoTracciati> _promo_tracciati_esistenti = this.ctx2.PromoTracciatis.Where(p => p.IdPromo == pImp!.IdPromo).ToList();


                        foreach (Dictionary<string, object> lista in parsingRes.liste!)
                        {
                            //var str1 = "Inserisco nel db " + lista["Area"].ToString();
                            var _recs = lista["Records"];
                                
                            var recs = (_recs as JArray)!.ToObject<List<Dictionary<string, object>>>();

                            string areaKey = GLOBAL_VARIABLES.keyArea;
                            string canaleKey = GLOBAL_VARIABLES.keyCanale;
                            string areaKeyGuid = GLOBAL_VARIABLES.keyAreaGuid;
                            string canaleKeyGuid = GLOBAL_VARIABLES.keyCanaleGuid;

                            //Controllo se esiste il tracciato
                            List<PromoTracciati> pTrList = _promo_tracciati_esistenti.Where(pt => pt.guidArea == lista[areaKeyGuid].ToString() && pt.guidCanale == lista[canaleKeyGuid].ToString()).ToList();
                            PromoTracciati? pTr = null;// _promo_tracciati_esistenti.Where(pt => pt.guidArea==lista[areaKey].ToString() && pt.guidCanale == lista[canaleKey].ToString()).FirstOrDefault();

                            //Console.WriteLine($"Tracciati esistenti per {lista[canaleKeyGuid].ToString()}/{lista[areaKeyGuid].ToString()}: {pTrList.Count}");

                            if (pTrList.Count > 0)
                            {
                                //Facciamo il controllo del contesto Tracciato, di tutti i tracciati CANALE/AREA trovati per questa promo
                                //Quello promo ovviamente è lo stesso ma se c'è anche una sola chiave che differisce nel contesto traccaito, va importato come Tracciato diverso


                                foreach (PromoTracciati pTrItem in pTrList)
                                {
                                    List<FicoContextField> _ctxEsistente = JsonConvert.DeserializeObject<List<FicoContextField>>(pTrItem.Context!)!;

                                    //Console.WriteLine($"Fields contesti a confronto {context.Count}/{_ctxEsistente.Count}");

                                    if (context.Count != _ctxEsistente.Count)
                                    {
                                        //E' sicuramente diverso il contesto, ci sono numeri di elementi differenti
                                        //saltiamo questo Tracciato
                                        //Console.WriteLine($"NO MATCH");
                                    }
                                    else
                                    {
                                        //Ogni campo del cotnesto deve combaciare altrimenti faccio saltare il match
                                        bool match = true;
                                        foreach (FicoContextField fCtk in context)
                                        {
                                            //Console.WriteLine($"Check {fCtk.nome_field}");
                                            FicoContextField? fCtkEsistente = _ctxEsistente.Where(f => f.nome_field == fCtk.nome_field).FirstOrDefault();
                                            if (fCtkEsistente == null)
                                            {
                                                match = false;
                                                //Console.WriteLine($"NO MATCH {fCtk.nome_field}");
                                                break;
                                            }
                                            else
                                            {
                                                if (fCtkEsistente.user_value != fCtk.user_value)
                                                {
                                                    match = false;
                                                    //Console.WriteLine($"NO MATCH {fCtk.nome_field}");
                                                    break;
                                                }
                                            }

                                            //Console.WriteLine($">MATCH !!");
                                        }

                                        if (match)
                                        {
                                            //Console.WriteLine($"Tracciatro MATCH: {pTrItem.Id}");
                                            pTr = pTrItem;
                                        }
                                    }
                                }

                            }

#warning Versione Tracciato Obsoleta
                            //Attenzione
                            //La versione del tracciato con l'introduzione e diversificazione delle LABEL,
                            //Diventa obsoleta perchè da una versione progressiva assoluta che non so quanto possa fare comodo


                            if (req.filtroCombinazioneSlave != "0")
                            {
                                //Controllo se questo tracciato devo filtrarlo oppure no
                                string[] p_c_a = req.filtroCombinazioneSlave.Split('_');
                                string guidCanale = p_c_a[0];
                                string guidArea = p_c_a[1];

                                //Filtro i ptr per guid are e canale come da filtro
                                if (lista[areaKeyGuid].ToString() != guidArea || lista[canaleKeyGuid].ToString() != guidCanale)
                                { 
                                    //Salto questo tracciat tanto non rientra nel confronto
                                    continue;
                                }

                            }


                            if (pTr == null)
                            {
                                pTr = new PromoTracciati();
                                pTr.IdImportazione = pImp!.Id;
                                pTr.IdPromo = pImp.IdPromo;
                                pTr.Canale = lista[canaleKey].ToString();
                                pTr.Area = lista[areaKey].ToString();

                                if (lista.ContainsKey(areaKeyGuid))
                                    pTr.guidArea = lista[areaKeyGuid].ToString();
                                if (lista.ContainsKey(canaleKeyGuid))
                                    pTr.guidCanale = lista[canaleKeyGuid].ToString();

                                pTr.Versione = (Byte)1;
                                pTr.Sigla = pTr.Canale + pTr.Area;

                            }
                            else
                            {                                
                                //pTr.IdImportazione = pImp.Id;//Non aggiorniamo l'id importazione, così se il traciato è fatto da più origini, rimaniamo con la prima COME Origine principale
                                pTr.Versione = (Byte)(pTr.Versione + 1);

                            }

                            pTr.PromoTracciatiRecords=new List<PromoTracciatiRecord>();

                            string keyRefCode = Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice;

                            var _rec_esistenti = this.ctx2.PromoTracciatiRecords.Where(ptr => ptr.IdTracciato == pTr.Id /*&& ptr.Label==pkg.cmbLabels*/).Select(
                                s => new
                                {
                                    Codice = Utility.Main.getJsonObject(s.Dato!)![keyRefCode].ToString(),
                                    Rec = s,
                                    Label = s.Label,
                                    Versione = s.Versione
                                }
                                ).ToList();

                            Byte versioneLab = 0;
                            
                            var versioneLabLast = _rec_esistenti.Where(r => r.Label == idLabel).OrderByDescending(o => o.Versione).FirstOrDefault();
                            if (versioneLabLast != null)
                            {
                                versioneLab = (Byte)(versioneLabLast.Versione + 1);
                            }
                            else
                            {
                                versioneLab = 1;
                            }


                            foreach (Dictionary<string, object> item in recs!)
                            {

                                #region ANALISI REC e FLUSSO CREAZIONE/AGGIORNAMENTO ARTICOLO e FOTO ARTICOLO

                                string? codArticolo = item[keyRefCode].ToString();
                                if (codArticolo == "")
                                    continue;

                                PromoTracciatiRecord? _rec = null;
                                var rec_esistente = _rec_esistenti.FirstOrDefault(i => i.Codice == codArticolo);
                                if (rec_esistente != null)
                                    _rec = rec_esistente.Rec;

                                #endregion


                                if (_rec == null)
                                {
                                    _rec = new PromoTracciatiRecord();
                                    _rec.IdTracciato = pTr.Id;
                                    _rec.IdAddestramento = idAdstr;// packet.cmbAddestramenti;
                                    _rec.IndiceLettura = 0;
                                    _rec.IndiceEsportazione = 0;
                                    _rec.Versione = versioneLab;
                                    _rec.Label = idLabel;
                                    _rec.DataRegistrazione = DateTime.Now;
                                    _rec.ModalitaInserimento = (Byte)ModalitaInserimento.Sistema;
                                    _rec.Stato = (Byte)StatoRecord.Attivo;

                                    if (item.ContainsKey(kRefCod))
                                    {
                                        _rec.Codice = item[kRefCod].ToString();
                                    }

                                    if (item.ContainsKey(nome_colonna_codGruppo))
                                    {
                                        _rec.CodiceGruppo = _rec.Codice;
                                        item[nome_colonna_codGruppo] = _rec.CodiceGruppo!;
                                    }

                                    item[GLOBAL_VARIABLES.keyContextPromo] = JsonConvert.DeserializeObject<List<FicoContextField>>(pSec!.Context!)!;
                                    item[GLOBAL_VARIABLES.keyContextTracciato] = context;

                                    _rec.Dato = JsonConvert.SerializeObject(item);
                                }
                                else
                                {
                                    //Trovo le differenze

                                    var alterazioni = new Dictionary<string, object>();

                                    Dictionary<string, object> oldItem = JsonConvert.DeserializeObject<Dictionary<string, object>>(_rec.Dato!)!;

                                    foreach (string _k in item.Keys)
                                    {
                                        if (!oldItem.ContainsKey(_k) || (!(item[_k] is JArray) && !(item[_k] is JObject) && !(item[_k] is Dictionary<string, object>)))
                                        {
                                            //Se è un tipo nativo
                                            //if (!oldItem.ContainsKey(_k) || oldItem[_k].ToString() != item[_k].ToString())
                                            if (!oldItem.ContainsKey(_k) || !SonoUguali(oldItem[_k], item[_k]))
                                            {
                                                //Differenza trovata
                                                if (oldItem.ContainsKey(_k))
                                                {
                                                    alterazioni[_k] = oldItem[_k];
                                                }

                                                oldItem[_k] = item[_k];

                                                if (_k == nome_colonna_scatto)
                                                {
                                                    _rec.Scatto = item[nome_colonna_scatto].ToString();
                                                }
                                                else if (_k == nome_colonna_codGruppo)
                                                {
                                                    _rec.CodiceGruppo = item[nome_colonna_codGruppo].ToString();
                                                }


                                            }
                                        }
                                    }

                                    //Salvo le alterazioni
                                    item[GLOBAL_VARIABLES.keyAlterazioni] = alterazioni;
                                }

                                _rec.Dato = JsonConvert.SerializeObject(item);
                                _rec.IdTracciatoNavigation = pTr;

                                pTr.PromoTracciatiRecords.Add(_rec);

                            }

                            ptrSlave.AddRange(pTr.PromoTracciatiRecords.ToList());

                            //Aggiungo anche la versione prima della label caricata
                            if (versioneLab>1)
                            {
                                ptrSlave.AddRange(
                                    this.ctx2.PromoTracciatiRecords.Where(pTr => pTr.IdTracciato == pTr.Id && pTr.Label == idLabel && pTr.Versione == (versioneLab - 1)).ToList()
                                    );
                            }
                        }



                    }
                    catch (Exception ex)
                    {
                        result.error = ex.ToString();
                        //return Ok(result);
                    }

                }


                Func<List<PromoTracciatiRecord>, Dictionary<string, List<PromoTracciatiRecord>>> organizzaConfronto = (sorgente) =>
                {
                    Dictionary<string, List<PromoTracciatiRecord>> result = new Dictionary<string, List<PromoTracciatiRecord>>();

                    sorgente.GroupBy(g => g.Label).ForEach(f =>
                    {
                        List<PromoTracciatiRecord> listaPerLabel = sorgente.Where(s => s.Label == f.Key).ToList();
                        List<Byte> vers = listaPerLabel.GroupBy(g2 => g2.Versione).OrderByDescending(o => o.Key).Select(s=>s.Key).ToList();

                        for (int v = 0; v < vers.Count; v++)
                        {
                            if (v==0)
                            {
                                if (!result.ContainsKey("new"))
                                {
                                    result["new"] = new List<PromoTracciatiRecord>();
                                }
                                result["new"].AddRange(listaPerLabel.Where(ll => ll.Versione == vers[v]).ToList());
                            }
                            else
                            {
                                if (!result.ContainsKey("old"))
                                {
                                    result["old"] = new List<PromoTracciatiRecord>();
                                }
                                result["old"].AddRange(listaPerLabel.Where(ll => ll.Versione == vers[v]).ToList());
                            }
                            
                        }
                    });
                
                    
                    return result;
                };

                ExternalSourceClass extSource=new ExternalSourceClass(this.path_external_source);
                DbConfronto dbConfExt = extSource.getConfronto();

                //x Demo COOP l mettiamo statici
                string[] campiDaControllare = dbConfExt.campiDiControllo.Select(s => s.nome).ToArray();

                result.campiDiControllo = campiDaControllare.ToList() ;

                //Adesso abbiamo due liste di PrmoTracciatiRecords da mettere a confronto
                if (req.IdPromoMaster==req.IdPromoSlave && req.filtroCombinazioneMaster==req.filtroCombinazioneSlave)
                {
                    //Si tratta di un confronto di se stesso
                    result.tipo = TipoConfronto.Self;
                    Dictionary<string, List<PromoTracciatiRecord>> listeDaConfrontare=new Dictionary<string, List<PromoTracciatiRecord>>();
                    string titoloPromo = "";
                    if (req.idImportazioneSlave>0)
                    {
                        //E' stata importata una lista e siccome è la stessa del master possiamo agire su ptrSlave per capire tutte le differenze                        
                        //ptrSlave
                        titoloPromo = pSec!.NomePromo;
                        listeDaConfrontare = organizzaConfronto(ptrSlave);
                    }
                    else
                    {
                        titoloPromo = p.NomePromo;
                        //ptrMaster
                        listeDaConfrontare = organizzaConfronto(ptrMaster);
                    }

                    result.acMaster = "-";
                    result.acSlave = "-";

                    //Esecuzione del confronto su se stesso
                    List<PromoTracciatiRecord> listaPrincipale = listeDaConfrontare["new"];
                    List<PromoTracciatiRecord> listaUscenti = new List<PromoTracciatiRecord>();
                    
                    if (listeDaConfrontare.ContainsKey("old"))
                        listaUscenti = listeDaConfrontare["old"];

                    //Ciclo la lista principale per evidenziare le ALTERAZIONI e gli ENTRANTI
                    foreach( PromoTracciatiRecord ptr in listaPrincipale )
                    {
                        Dictionary<string, object> recDato = JsonConvert.DeserializeObject<Dictionary<string, object>>(ptr.Dato!)!;

                        ResponseRecordConfronto rec = new ResponseRecordConfronto();
                        rec.data = recDato;

                        if (rec.data.ContainsKey(GLOBAL_VARIABLES.keyAlterazioni))
                        {
                            //Record NON entrante
                            Dictionary<string,object>? dictAlterazione = (rec.data[GLOBAL_VARIABLES.keyAlterazioni] as JObject)!.ToObject<Dictionary<string, object>>();
                            if (dictAlterazione!.Keys.Count>0)
                            {
                                rec.stato= StatoRecordConfronto.Alterato;

                                //Analisi alterazione
                                foreach (string c in campiDaControllare)
                                {
                                    if (dictAlterazione.ContainsKey(c))
                                    {
                                        
                                        ResponseRecordConfrontFieldDiff responseRecordConfrontFieldDiff = new ResponseRecordConfrontFieldDiff();
                                        responseRecordConfrontFieldDiff.campo = c;
                                        if (req.versioneMaster == 2)
                                        {
                                            //E' il master ha essere la versione old
                                            responseRecordConfrontFieldDiff.valoreMaster = dictAlterazione[c];
                                            responseRecordConfrontFieldDiff.valoreSlave = recDato[c];
                                        }
                                        else
                                        {
                                            //E' lo slave ad essere la versione old
                                            responseRecordConfrontFieldDiff.valoreMaster = recDato[c];
                                            responseRecordConfrontFieldDiff.valoreSlave = dictAlterazione[c];
                                        }
                                        rec.campiDifferenti.Add(responseRecordConfrontFieldDiff);
                                        
                                    }
                                }


                            }
                            else
                            {
                                rec.stato = StatoRecordConfronto.Inalterato;
                            }
                        }
                        else
                        {
                            //Entrante
                            rec.stato=StatoRecordConfronto.Entrante;
                        }

                        rec.statoContesto = StatoContestoRecordConfronto.None;//Non esiste contesto quando si confronta se stesso
                        rec.promo = titoloPromo;
                        rec.canale = ptr.IdTracciatoNavigation.Canale;
                        rec.area = ptr.IdTracciatoNavigation.Area;
                       
                        result.lista.Add(rec);

                    }

                    //Ciclo gli uscenti per evidenziare le referenze uscite dalla lista
                    foreach (PromoTracciatiRecord ptr in listaUscenti)
                    {
                        Dictionary<string, object> recDato = JsonConvert.DeserializeObject<Dictionary<string, object>>(ptr.Dato!)!;

                        ResponseRecordConfronto rec = new ResponseRecordConfronto();
                        rec.data = recDato;
                        rec.stato = StatoRecordConfronto.Uscente;
                        rec.statoContesto = StatoContestoRecordConfronto.None;//Non esiste contesto quando si confronta se stesso
                        rec.promo = titoloPromo;
                        rec.canale = ptr.IdTracciatoNavigation.Canale;
                        rec.area = ptr.IdTracciatoNavigation.Area;

                        result.lista.Add(rec);
                    }

                }
                else
                {
                    //Promo o tracciati a confronto diversi
                    //In questo caso si guardano le due liste senza accedere alle versioni precedenti
                    result.tipo = TipoConfronto.Different;

                    //Check dei campi differenza che deve fornirci l'agenzia

                    

                    //Escuzione del confronto tra due liste diverse
                    foreach (PromoTracciatiRecord ptr in ptrMaster)
                    {
                        ResponseRecordConfronto rec = new ResponseRecordConfronto();
                        Dictionary<string, object> recDato = JsonConvert.DeserializeObject<Dictionary<string, object>>(ptr.Dato!)!;

                        
                        rec.promo = p.NomePromo;
                        rec.canale = ptr.IdTracciatoNavigation.Canale;
                        rec.area = ptr.IdTracciatoNavigation.Area;

                        result.acMaster = $"{rec.canale}/{rec.area}";

                        //Controllo se è presente anche in slave
                        PromoTracciatiRecord? recInSlave = ptrSlave.FirstOrDefault(c => c.Codice == ptr.Codice);
                        if (recInSlave!=null)
                        {
                            Dictionary<string, object> recConfronto = JsonConvert.DeserializeObject<Dictionary<string, object>>(recInSlave.Dato!)!;

                            foreach (string c in campiDaControllare)
                            {
                                if (recDato.ContainsKey(c) && recConfronto.ContainsKey(c))
                                {
                                    //Comparazione valore
                                    if (recDato[c].ToString() != recConfronto[c].ToString())
                                    {
                                        ResponseRecordConfrontFieldDiff responseRecordConfrontFieldDiff = new ResponseRecordConfrontFieldDiff();
                                        responseRecordConfrontFieldDiff.campo = c;
                                        responseRecordConfrontFieldDiff.valoreMaster = recDato[c];
                                        responseRecordConfrontFieldDiff.valoreSlave = recConfronto[c];
                                        rec.campiDifferenti.Add(responseRecordConfrontFieldDiff);
                                    }
                                }
                                else if (!recDato.ContainsKey(c) && recConfronto.ContainsKey(c))
                                {
                                    //Campo mancante in master
                                    ResponseRecordConfrontFieldDiff responseRecordConfrontFieldDiff = new ResponseRecordConfrontFieldDiff();
                                    responseRecordConfrontFieldDiff.campo = c;
                                    responseRecordConfrontFieldDiff.valoreMaster = recDato[c];
                                    responseRecordConfrontFieldDiff.valoreSlave = "no_exist";
                                    rec.campiDifferenti.Add(responseRecordConfrontFieldDiff);
                                }
                                else if (recDato.ContainsKey(c) && !recConfronto.ContainsKey(c))
                                {
                                    //Campo mancante in master
                                    ResponseRecordConfrontFieldDiff responseRecordConfrontFieldDiff = new ResponseRecordConfrontFieldDiff();
                                    responseRecordConfrontFieldDiff.campo = c;
                                    responseRecordConfrontFieldDiff.valoreMaster = "no_exist";
                                    responseRecordConfrontFieldDiff.valoreSlave = recConfronto[c];
                                    rec.campiDifferenti.Add(responseRecordConfrontFieldDiff);
                                }
                            }

                            if (rec.campiDifferenti.Count==0)
                            {
                                rec.stato = StatoRecordConfronto.Inalterato;
                            }
                            else
                            {
                                rec.stato = StatoRecordConfronto.Alterato;
                            }

                            rec.statoContesto = StatoContestoRecordConfronto.InComune;
                        }
                        else
                        {
                            rec.stato = StatoRecordConfronto.None;//Non c'è stato se manca la comparazione
                            rec.statoContesto = StatoContestoRecordConfronto.SoloMaster;
                            
                        }



                        rec.data = recDato;
                        result.lista.Add(rec);
                    }

                    foreach (PromoTracciatiRecord ptr in ptrSlave)
                    {
                        //Devo solo cercare i record che sono SOLO in slave

                        PromoTracciatiRecord? recInMaster = ptrMaster.FirstOrDefault(c => c.Codice == ptr.Codice);

                        //Controllo se è presente anche in slave
                        if (recInMaster == null)
                        {
                            ResponseRecordConfronto rec = new ResponseRecordConfronto();
                            Dictionary<string, object> recDato = JsonConvert.DeserializeObject<Dictionary<string, object>>(ptr.Dato!)!;


                            rec.promo = p.NomePromo;
                            rec.canale = ptr.IdTracciatoNavigation.Canale;
                            rec.area = ptr.IdTracciatoNavigation.Area;

                            result.acSlave = $"{rec.canale}/{rec.area}";

                            rec.stato = StatoRecordConfronto.None;//Non c'è stato se manca la comparazione
                            rec.statoContesto = StatoContestoRecordConfronto.SoloSlave;


                            rec.data = recDato;
                            result.lista.Add(rec);

                        }

                    }


                }

                Func<object, string> scirviDatoPerColonnaExcel = (object data) =>
                {
                    if (data is double || data is decimal)
                    {
                        string strVal = data.ToString()!;
                        strVal = strVal.Replace('.', ',');
                        return strVal;
                    }
                    else
                    {
                        return data.ToString()!;
                    }
                };

                string guidid = Guid.NewGuid().ToString();
                result.csvGuidid = guidid;

                string nome_file_csv = $"{path_to_export}/{guidid}.csv";

                using (var writer = new StreamWriter(nome_file_csv))
                using (var csv = new CsvWriter(writer, new CsvConfiguration(CultureInfo.InvariantCulture) { 
                
                    Delimiter=";",
                }))
                {
                    List<string> headerFields = new List<string>();
                    if (result.tipo==TipoConfronto.Self)
                    {

                        //head                

                        headerFields.Add("Stato");
                        headerFields.Add("Codice Ref");
                        headerFields.Add("Codice Gruppo");
                        headerFields.Add("Descrizione");
                        for (int i = 0; i < result.campiDiControllo.Count; i++)
                        {
                            string c = result.campiDiControllo[i];
                            headerFields.Add(c + "(prima)");
                            headerFields.Add(c + "(dopo)");
                        }


                        //csv.WriteHeader(headerFields);

                        foreach (string kvp in headerFields)
                        {
                            csv.WriteField(kvp);
                        }



                        foreach (var rec in result.lista)
                        {
                            csv.NextRecord();

                            string stato = "";
                            if (rec.stato == StatoRecordConfronto.Inalterato)
                            {
                                stato = "Inalterato";
                            }
                            else if (rec.stato == StatoRecordConfronto.Alterato)
                            {
                                stato = "Cambiato";
                            }
                            if (rec.stato == StatoRecordConfronto.Entrante)//Entrante
                            {
                                stato = "Entrante";
                            }
                            else if (rec.stato == StatoRecordConfronto.Uscente)//Uscente
                            {
                                stato = "Uscente";
                            }

                            csv.WriteField(stato);

                            csv.WriteField(rec.data![GLOBAL_VARIABLES_FICO.keyRefCodice].ToString());
                            csv.WriteField(rec.data[GLOBAL_VARIABLES_FICO.keyCodiceGruppo].ToString());
                            csv.WriteField(rec.data[GLOBAL_VARIABLES_FICO.keyDescrizione1].ToString());


                            for (int i = 0; i < result.campiDiControllo.Count; i++)
                            {

                                string nome_campo = result.campiDiControllo[i];
                                var diffFieldItem = rec.campiDifferenti.FirstOrDefault(f => f.campo == nome_campo);


                                if (diffFieldItem != null)
                                {
                                    //Sicuramente alterato                                    
                                    csv.WriteField(scirviDatoPerColonnaExcel(diffFieldItem.valoreMaster!));
                                    csv.WriteField(scirviDatoPerColonnaExcel(diffFieldItem.valoreSlave!));

                                }
                                else if (rec.stato == StatoRecordConfronto.Entrante)//Entrante o uscente
                                {
                                    csv.WriteField("-");
                                    csv.WriteField(scirviDatoPerColonnaExcel(rec.data[nome_campo]));
                                }
                                else if (rec.stato == StatoRecordConfronto.Uscente)
                                {
                                    csv.WriteField(scirviDatoPerColonnaExcel(rec.data[nome_campo]));
                                    csv.WriteField("-");
                                }    
                                else
                                {
                                    //Uguale
                                    csv.WriteField(scirviDatoPerColonnaExcel(rec.data[nome_campo]));
                                    csv.WriteField(scirviDatoPerColonnaExcel(rec.data[nome_campo]));
                                }

                            }

                        }

                        csv.Flush();

                    }
                    else if (result.tipo==TipoConfronto.Different)
                    {

                        //headerFields.Add("Canale/Area");


                        headerFields.Add("Presenza");
                        headerFields.Add("Stato");
                        headerFields.Add("Codice Ref");
                        headerFields.Add("Codice Gruppo");
                        headerFields.Add("Descrizione");

                        for (int i = 0; i < result.campiDiControllo.Count; i++)
                        {
                            string c = result.campiDiControllo[i];
                            headerFields.Add(c + "("+result.acMaster+")");
                            headerFields.Add(c + "("+result.acSlave+")");
                        }


                        //csv.WriteHeader(headerFields);

                        foreach (string kvp in headerFields)
                        {
                            csv.WriteField(kvp);
                        }



                        foreach (var rec in result.lista)
                        {
                            csv.NextRecord();


                            //csv.WriteField($"{rec.canale}/{rec.area}");

                            csv.WriteField(rec.statoContesto == StatoContestoRecordConfronto.InComune ? "In Comune" : $"Solo in {rec.canale}/{rec.area}");


                            string stato = "-";
                            if (rec.stato == StatoRecordConfronto.Inalterato)
                            {
                                stato = "Inalterato";
                            }
                            else if (rec.stato == StatoRecordConfronto.Alterato)
                            {
                                stato = "Cambiato";
                            }
                            if (rec.stato == StatoRecordConfronto.Entrante)//Entrante
                            {
                                stato = "Entrante";
                            }
                            else if (rec.stato == StatoRecordConfronto.Uscente)//Uscente
                            {
                                stato = "Uscente";
                            }

                            csv.WriteField(stato);

                            csv.WriteField(rec.data![GLOBAL_VARIABLES_FICO.keyRefCodice].ToString());
                            csv.WriteField(rec.data[GLOBAL_VARIABLES_FICO.keyCodiceGruppo].ToString());
                            csv.WriteField(rec.data[GLOBAL_VARIABLES_FICO.keyDescrizione1].ToString());


                            for (int i = 0; i < result.campiDiControllo.Count; i++)
                            {

                                string nome_campo = result.campiDiControllo[i];
                                if (rec.statoContesto == StatoContestoRecordConfronto.InComune)
                                {
                                    var diffFieldItem = rec.campiDifferenti.FirstOrDefault(f => f.campo == nome_campo);
                                    if (diffFieldItem != null)
                                    {
                                        //Sicuramente alterato
                                        csv.WriteField(scirviDatoPerColonnaExcel(diffFieldItem.valoreMaster!));
                                        csv.WriteField(scirviDatoPerColonnaExcel(diffFieldItem.valoreSlave!));

                                    }
                                    else
                                    {
                                        csv.WriteField(scirviDatoPerColonnaExcel(rec.data[nome_campo]));
                                        csv.WriteField(scirviDatoPerColonnaExcel(rec.data[nome_campo]));
                                    }
                                }
                                else if (rec.statoContesto==StatoContestoRecordConfronto.SoloMaster)
                                {
                                    csv.WriteField(scirviDatoPerColonnaExcel(rec.data[nome_campo]));
                                    csv.WriteField("-");
                                }
                                else if (rec.statoContesto == StatoContestoRecordConfronto.SoloSlave)
                                {
                                    csv.WriteField("-");
                                    csv.WriteField(scirviDatoPerColonnaExcel(rec.data[nome_campo]));
                                }

                            }

                        }

                        csv.Flush();
                    }
                   

                }

            }
            catch (Exception ex)
            {
                result.error = ex.ToString();
            }

            return Ok(result);
        }

        public ImportResult leggiDatoExcel(PromoImportazioni pImp, string source, string idLabel, InputFormTracciato packet, List<FicoContextField> context, int idAddestramento)
        {
            //Recupero import
            //Recupero lo schema di addestramento
            AddestramentoExcel? addestramento = this.ctx2.AddestramentoExcels.Include(i => i.SchemaCampiExcels).ThenInclude(i2 => i2.AddestramentoExcelRelazionis).Where(a => a.Id == idAddestramento).FirstOrDefault();
            List<SchemaCampiExcel> _campi = addestramento!.SchemaCampiExcels.ToList();

            string kRefCod = Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice;
            string kRefEan = Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefEan;

            string kDescr1 = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr1;
            string kDescr2 = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr2;
            string kDescr3 = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr3;
            string kDescr4 = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr4;
            string kDescr1Gruppo = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr1Gruppo;
            string kDescr2Gruppo = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr2Gruppo;
            string kDescr3Gruppo = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr3Gruppo;
            string kDescr4Gruppo = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr4Gruppo;
            string kCodGruppo = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppo;



            string kDescrUm = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescrUm;
            string kDescrPeso = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescrPeso;

            string kFoto = Enum.GetName(AddestramentoRuoli.Foto) + "." + GLOBAL_VARIABLES.keyFotoNome;

            SchemaCampiExcel? cRefCod = _campi.Where(c => c.NomeColonna == kRefCod).FirstOrDefault();
            SchemaCampiExcel? cRefEan = _campi.Where(c => c.NomeColonna == kRefEan).FirstOrDefault();

            List<SchemaCampiExcel> campi_aggiuntivi = addestramento.SchemaCampiExcels.Where(
                ce => ce.AddestramentoExcelRelazionis.Count > 0 &&
                (ce.AddestramentoExcelRelazionis.FirstOrDefault()!.TipoCompilazione == (Byte)TipoCompilazione.DuranteImportazione || ce.AddestramentoExcelRelazionis.FirstOrDefault()!.TipoCompilazione == (Byte)TipoCompilazione.FineImportazione)).ToList();


            Promo? promoItem = this.ctx2.Promos.Where(p => p.Id == pImp!.IdPromo).FirstOrDefault();

            //Adesso leggo lo schema
            bool headerIsFound = false;

            List<Dictionary<string, object>> tracciato = new List<Dictionary<string, object>>();

            IstantaController icCtrl = new IstantaController("", this.path_external_lib, this.path_external_source, this._dbContextFactory);

            List<Articoli> _articoli_cache = new List<Articoli>();

            double media_processo_item = 0;
            int count_items = 0;

            string nome_colonna_scatto = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodice;
            string nome_colonna_codGruppo = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppo;


            using (var stream = System.IO.File.Open(source, FileMode.Open, FileAccess.Read))
            {
                using (var reader = ExcelReaderFactory.CreateReader(stream))
                {
                    int count = 0;
                    //int count_elaborati = 0;

                    int totRows = reader.RowCount;


                    while (reader.Read())
                    {
                        count++;

                        if (count == 170)
                            "break".ToString();



                        DateTime inizio_processo_item = DateTime.Now;

                        Dictionary<string, object> rec = new Dictionary<string, object>();

                        int fieldRead = 0;

                        Articoli? artRecord = null;

                        bool rowInvalidated = false;

                        for (int c = 0; c < reader.FieldCount; c++)
                        {
                            fieldRead++;

                            if (!headerIsFound)
                            {

                            }
                            else
                            {
                                SchemaCampiExcel? schema_campo = _campi.Where(f => f.Indice == c).FirstOrDefault();

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


                                    try
                                    {
                                        rec[schema_campo.NomeColonna] = icCtrl.parseAddesttramentoValue(_val!, schema_campo);
                                    }
                                    catch (Exception ex)
                                    {
                                        ex.ToString();
                                        throw new Exception($"Errore di conversione campo Campo {schema_campo.NomeColonna}, valore: {_val} tipo {schema_campo.TipoDato} ");
                                    }


                                    if (scope != "")
                                    {
                                        //Altro ragionamento, basato su unità logiche
                                        if (scope == Enum.GetName(AddestramentoRuoli.Area))
                                        {

                                        }
                                        else if (scope == Enum.GetName(AddestramentoRuoli.Referenza))
                                        {
                                            if (artRecord == null)
                                            {
                                                if (scope_chiave == GLOBAL_VARIABLES.keyRefCodice)
                                                {


                                                    if (_val == "7784854")
                                                    {
                                                        "stop".ToString();
                                                    }

                                                    if (_val != "")
                                                    {

                                                        artRecord = _articoli_cache.Where(ac => ac.Codice == _val).FirstOrDefault();
                                                        if (artRecord == null)
                                                        {
                                                            artRecord = this.ctx.Articolis.Where(a => a.Codice == _val).FirstOrDefault();
                                                            if (artRecord != null)
                                                                _articoli_cache.Add(artRecord);
                                                        }
                                                        else
                                                        {
                                                            //E' stato prse da un EAN o un ID. Controllo di congruenza del codice
                                                            if (artRecord.Codice != _val)
                                                            {
                                                                rowInvalidated = true;
                                                                break;
                                                            }
                                                        }
                                                    }
                                                    else
                                                    {
                                                        //SE IL COD REF è vuoto, è possibile che sia 
                                                        //. Un separatore nell'excel, per cui un record da scartare probabilmente
                                                        //. Puo però anche essere un separatore di GRUPPO. (es. ARENA)
                                                        //Per cui non è crretto interrompere la lettura, bensì è meglio passare il tutto al custom che al più deciderà lui di filtrare/interpretare/elimianare come meglio crede

                                                        rowInvalidated = true;
                                                        break;
                                                    }
                                                }
                                                else if (scope_chiave == GLOBAL_VARIABLES.keyRefId)
                                                {
                                                    artRecord = this.ctx.Articolis.Where(a => a.Id == Int64.Parse(_val!)).FirstOrDefault()!;
                                                }
                                                else if (scope_chiave == GLOBAL_VARIABLES.keyRefEan)
                                                {
                                                    if (_val != "")
                                                    {

                                                        artRecord = _articoli_cache.Where(ac => ac.Ean == _val).FirstOrDefault()!;
                                                        if (artRecord == null)
                                                        {
                                                            artRecord = this.ctx.Articolis.Where(a => a.Ean == _val).FirstOrDefault()!;
                                                            if (artRecord != null)
                                                            {
                                                                //Se ho già letto il codice ref di questa riga, devo verificare se corrisponde con questo articolo preso con EAN
                                                                //PERO rispndo a distanza di tempo, questa regola NON va più bene.
                                                                //In seguito al cliente PAC che forma il codice REF combinando il campo primario Referenza.Codice con un altro cod ext
                                                                //viene meno questo controllo perchè im questo momento (non conoscendo l'elaborazione finale del codice) NON puo invalidare questo codice che è temporaneo
                                                                if (rec.ContainsKey(kRefCod))
                                                                {
                                                                    //if (rec[kRefCod].ToString()!=artRecord.Codice)
                                                                    //{
                                                                    //    rowInvalidated = true;
                                                                    //    break;
                                                                    //}
                                                                }
                                                                else
                                                                    _articoli_cache.Add(artRecord);
                                                            }
                                                        }

                                                    }
                                                }
                                            }
                                            else
                                            {
                                                if (scope_chiave == GLOBAL_VARIABLES.keyRefEan)
                                                {
                                                    //I20-988: stessa misura della colonna, dichiarata una volta sola.
                                                    _val = Utility.Main.eanTroncato(_val)!;
                                                    artRecord.Ean = _val;
                                                }
                                            }


                                        }
                                        else if (scope == Enum.GetName(AddestramentoRuoli.Descrizioni))
                                        {

                                        }
                                    }
                                }
                            }

                        }

                        if (!rowInvalidated)
                        {

                            if (headerIsFound)
                            {
                                media_processo_item += DateTime.Now.Subtract(inizio_processo_item).TotalMilliseconds;

                                count_items++;

                            }

                            if (fieldRead > 0)
                                headerIsFound = true;

                            if (rec.Keys.Count > 0)
                            {
                                if (rec.ContainsKey(kRefCod))
                                {
                                    #region generazione firma

                                    string kFirma = Enum.GetName(AddestramentoRuoli.Tracciato) + "." + GLOBAL_VARIABLES.keyTracciatoFirma;
                                    if (!rec.ContainsKey(kFirma))
                                    {
                                        string firma = Utility.Main.getFirmaTracciato(rec);
                                        rec[kFirma] = firma;
                                    }

                                    #endregion

                                    tracciato.Add(rec);
                                }
                            }
                        }

                    }
                }
            }


            Dictionary<string, object> _pass = new Dictionary<string, object>();
            _pass["label"] = idLabel;
            _pass["tracciato"] = tracciato;
            _pass["formRequest"] = packet.fields!;
            _pass["context"] = context;//ATTENZIONE! Adeguare questo parmaetro nella chiamata di import
            _pass["contextPromo"] = JsonConvert.DeserializeObject<List<FicoContextField>>(promoItem!.Context!)!;//ATTENZIONE! Adeguare questo parmaetro nella chiamata di import
                                                                                                                //string resultExternal = icCtrl.execLibFunction(addestramento.externalCallPerImport, _pass).ToString();
            string resultExternal = (icCtrl.execLibFunction($"AgenziaLib.{this._fico_conf.Value.nomeCliente!}.importaTracciato", _pass).ToString())!;


            ImportResult? parsingRes = JsonConvert.DeserializeObject<ImportResult>(resultExternal!);
            return parsingRes!;
        }

        [HttpPut]
        [Route("Confronti/esportaComeListaDiImportazione")]
        public async Task<IActionResult> esportaComeListaDiImportazione([FromBody]  InputForFiltroExcel req)
        {
            int id_importazione = req.idImportazioneSlave;
            string resultName = "";

            if (id_importazione<=0)
                return BadRequest("Importazione non valida");
            //Questa funzione chiede tassativamente di puntare all'excel specifico per prelevare i records

            System.Text.Encoding.RegisterProvider(System.Text.CodePagesEncodingProvider.Instance);

            MemoryStream? excelStream=new MemoryStream();

            try
            {

                //Interpretazione dati importaizone
                Attivitum? aItem = await this.ctx.Attivita.FirstOrDefaultAsync(a => a.Id == req.idImportazioneSlave);
                
                if (aItem == null)
                    throw new Exception("attivita_importazione_non_trovata");

                //Si recupera queste informazioni perchè se siamo in questa casistica, tutto quello che viene raccolto dai tracciati GIA importati
                //E' bene sapere che il tracciato importato ha per sua logica una sola LABEL e intende confrontare SOLO quella
                OperationRequest opReq = JsonConvert.DeserializeObject<OperationRequest>(aItem.Contract)!;
                string? strpkg = opReq!.Packet.ToString();
                InputFormTracciato packet = JsonConvert.DeserializeObject<InputFormTracciato>(strpkg!)!;
                
                string path_attivita = path_to_import + req.idImportazioneSlave + System.IO.Path.DirectorySeparatorChar;
                string source = path_attivita + packet!.filename;

                resultName = packet!.filename;

                int idAdstr;
                Int32.TryParse(packet.getFieldByKey("idAddestramento"), out idAdstr);

                //Recupero lo schema di addestramento
                AddestramentoExcel? addestramento = await this.ctx2.AddestramentoExcels.Include(i => i.SchemaCampiExcels).ThenInclude(i2 => i2.AddestramentoExcelRelazionis).Where(a => a.Id == idAdstr).FirstOrDefaultAsync();
                List<SchemaCampiExcel> _campi = addestramento!.SchemaCampiExcels.ToList();


                //Intrpreto il filtro
                List<int> indiciDiFiltro = new List<int>();
                req.Filtro.Select(s=>s.chiave).ToList().ForEach(fk =>
                {
                    SchemaCampiExcel? sc = _campi.FirstOrDefault(c => c.NomeColonna == fk);
                    if (sc != null)
                    {
                        if(!indiciDiFiltro.Contains(sc.Indice))
                            indiciDiFiltro.Add(sc.Indice);
                    }
                });

                //// 1. Leggo l'excel origine

                Func<List<object>, bool> matchFiltro = (List<object> reader) =>
                {
                    for (int i = 0; i < reader.Count; i++)
                    {
                        if (indiciDiFiltro.Contains(i))
                        {
                            string[] _valoriAccettati =  req.Filtro.FirstOrDefault(f=>f.chiave== _campi.FirstOrDefault(c => c.Indice == i).NomeColonna).valori;
                            string _val = reader[i].ToString();                            
                            if (!_valoriAccettati.Contains(_val))//Questo cerca esattamente quel valore, potrebbe esserci il bisogno di fare un Contains
                            {
                                return false;//Mi basta che uno dei cmapi del filtro non risponda per escludere il record
                            }

                        }
                    }
                    //Se non ci sono filtri match è sempre true
                    return true;
                };

                PromoImportazioni? pImp = this.ctx2.PromoImportazionis.Where(imp => imp.Id == packet.idImportazione).FirstOrDefault();
                List<FicoContextField> context = opReq!.context;

                ImportResult impRes = leggiDatoExcel(pImp!, source, packet.getFieldByKey("idLabel"), packet, context, idAdstr);


                var rows = new List<List<object>>();
                foreach (Dictionary<string, object> lista in impRes.liste!)
                {
                    //var str1 = "Inserisco nel db " + lista["Area"].ToString();
                    var _recs = lista["Records"];
                    var recs = (_recs as JArray)!.ToObject<List<Dictionary<string, object>>>();
                    foreach (Dictionary<string, object> _rec in recs!)
                    {
                        var row = new List<object>();
                        foreach (SchemaCampiExcel sh_campo in _campi)
                        {
                            row.Add(_rec.ContainsKey(sh_campo.NomeColonna!) ?_rec[sh_campo.NomeColonna!]!:"");
                        }
                        if (matchFiltro(row))
                        {
                            rows.Add(row);
                        }
                    }
                }

                //using (var streamExcel = System.IO.File.Open(source, FileMode.Open, FileAccess.Read))
                //using (var reader = ExcelReaderFactory.CreateReader(streamExcel))
                //{
                //    while (reader.Read())
                //    {
                //        var row = new List<string>();
                        
                //        for (int i = 0; i < reader.FieldCount; i++)
                //        {
                //            row.Add(reader.GetValue(i)?.ToString() ?? "");
                //        }

                //        if (matchFiltro(row))
                //        {
                //            rows.Add(row);
                //        }
                //    }
                //}

                // 3. Creo nuovo Excel
                using (var wb = new XLWorkbook())
                {
                    var ws = wb.AddWorksheet("Filtrato");

                    // Inserisco intestazioni
                    for (int c = 0; c < _campi.Count; c++)
                        ws.Cell(1, c + 1).Value = _campi[c].NomeColonnaOriginale;

                    // Inserisco righe filtrate
                    int rowIndex = 2;
                    foreach (var row in rows)
                    {
                        for (int c = 0; c < _campi.Count; c++)
                        {
                            SchemaCampiExcel schemaCampo = _campi[c];
                            object _val = "";
                            if (schemaCampo.NomeColonna != "")
                            {
                                _val = row[c];
                            }

                            switch (_val)
                            {
                                case double d:
                                    ws.Cell(rowIndex, c + 1).Value = d;
                                    //ws.Cell(rowIndex, c + 1).Style.Fill.BackgroundColor = XLColor.Yellow;
                                    break;

                                case int i:
                                    ws.Cell(rowIndex, c + 1).Value = i;
                                    break;

                                case decimal dec:
                                    ws.Cell(rowIndex, c + 1).Value = dec;
                                    break;

                                case DateTime dt:
                                    ws.Cell(rowIndex, c + 1).Value = dt;
                                    break;

                                case bool b:
                                    ws.Cell(rowIndex, c + 1).Value = b;
                                    break;
                                default:
                                    ws.Cell(rowIndex, c + 1).Value = _val?.ToString() ?? "";
                                    break;
                            }

                            
                            
                        }
                        rowIndex++;
                    }

                    // Ritorno come array di bytes per il download

                    wb.SaveAs(excelStream);
                    excelStream.Position = 0;

                    //using (var writer = new FileStream(path_attivita +"\\" +"test.xlsx", FileMode.Create))
                    //{
                    //    //Scrivo dentro il writer il contenuto di excelStream
                    //    excelStream.CopyTo(writer);                        
                    //}
                }
            }
            catch (Exception ex)
            {
                return BadRequest(ex.ToString());
            }

            return File(excelStream!, "application/vnd.ms-excel", resultName, enableRangeProcessing: true);

        }

        #region FicoContext Editor
        public IActionResult Settings()
        {
            return View("Settings");
        }

        [HttpPut]
        [Route("Confronti/salvaSourceJsonCode")]
        public async Task<IActionResult> salvaSourceJsonCode([FromBody] SourceJsonRequest request)
        {
            BoolResult bRes = new BoolResult();

            if (request != null)
            {
                SingletonConfiguration.DbConfronto.SetJsonSource(request.jsoncode);

                bRes.Esito = true;
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
