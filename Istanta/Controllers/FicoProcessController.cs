using Antlr4.Runtime.Tree;
using DocumentFormat.OpenXml.Bibliography;
using DocumentFormat.OpenXml.Drawing;
using DocumentFormat.OpenXml.Drawing.Charts;
using DocumentFormat.OpenXml.InkML;
using DocumentFormat.OpenXml.Office2016.Drawing.Command;
using DocumentFormat.OpenXml.Office2016.Excel;
using DocumentFormat.OpenXml.Presentation;
using DocumentFormat.OpenXml.Vml.Office;
using DocumentFormat.OpenXml.Wordprocessing;
using Istanta.MiddleWare;
using Istanta.Models;
using Istanta.Models_2;
using Istanta.Utility;
using Istanta.Views.SyncFoto;
using Istanta.Views.Tracciati;
using IstantaLib;
using LinqKit;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion.Internal;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using Microsoft.Identity.Client;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System.Buffers.Text;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Reflection.Metadata;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json.Nodes;
using System.Xml;

namespace Istanta.Controllers
{
    class PreparazioneListaResult
    {
        public List<ArticoloInKit> records = new List<ArticoloInKit>();
        //public List<ArticoloInRevisione> records=new List<ArticoloInRevisione>();

        public List<Articoli> archivio_refs = new List<Articoli>();
        public List<ArticoliDescrizioni> archivio_descr_gruppo = new List<ArticoliDescrizioni>();
        public TipoLavorazione tipoLavorazione { get; set; }
        public string? error;
    }

    class LoghiBolliPerCorreggo
    {
        public List<LogoBollo> list { get; set; } = new List<LogoBollo>();
        public string error { get; set; } = "";
    }


    public class FicoProcessController : Controller
    {
        private readonly edro21_dbContext ctx;
        private Edro21_DbContext2 ctx2;
        private readonly string extarnalSourcePath;
        private readonly string extarnalLibPath;
        private ExternalSourceClass exClass;
        private readonly string olUrl;
        private readonly string fpUrl;
        private readonly OlympusUserPolicyRequest[] olympusUserPolycy;
        private readonly string secretKey;
        private readonly string contextsPath;
        private readonly string? pathToImport;
        private readonly string connString;
        private readonly HttpClient httpClient;
        private readonly IOptions<PathExternal> optionExternalLib;
        private readonly IMemoryCache _cache;
        private readonly IOptions<FicoConfig> ficoConf;
        //private readonly IOptions<SyncOptions> syncOptions;
        private readonly IConfiguration config;
        private readonly IHttpClientFactory httpClientFactory;
        private readonly IDbContextFactory<edro21_dbContext> _dbContextFactory;
        private readonly IOptions<AuthADOptions> _authAD_options;
        private readonly IOptions<PathOperationImport> _option_import;

        private HttpContext? httpContextInRent = null;
        public HttpContext HttpContextInRent
        {
            set { httpContextInRent = value; }
        }
        private readonly IDbContextFactory<Edro21_DbContext2> _dbContextFactory2;
        public FicoProcessController(IConfiguration configuration, IOptions<PathExternal> external_lib, IOptions<FicoConfig> ficoConf, IOptions<PathOperationImport>? option_import, IHttpClientFactory httpClientFactory, IMemoryCache? memoryCache, IDbContextFactory<edro21_dbContext> dbContextFactory, IOptions<AuthADOptions> authAD_options, IDbContextFactory<Edro21_DbContext2> dbContextFactory2 = null)
        {
            this._dbContextFactory2 = dbContextFactory2;
            connString = configuration.GetConnectionString("IstandaConnectionDb")!;
            this._dbContextFactory = dbContextFactory;
            this.ctx = this._dbContextFactory.CreateDbContext();//new edro21_dbContext(connString);
            this.ctx2 = this._dbContextFactory2.CreateDbContext();

            this.config = configuration;

            this.extarnalSourcePath = external_lib.Value.pathSource;
            this.extarnalLibPath = external_lib.Value.pathLib;
            this.optionExternalLib = external_lib;
            this._authAD_options = authAD_options;
            this._option_import = option_import;

            exClass = new ExternalSourceClass(this.extarnalSourcePath);
            olUrl = ficoConf.Value.olympusServerUrl;
            fpUrl = ficoConf.Value.fpServerUrl;
            olympusUserPolycy = ficoConf.Value.userDataPolicy!;
            secretKey = ficoConf.Value.secretKey;
            contextsPath = ficoConf.Value.contextsPath;
            if (option_import != null)
                pathToImport = option_import.Value.path;

            this.httpClientFactory = httpClientFactory;
            httpClient = httpClientFactory.CreateClient();

            this._cache = memoryCache!;
            this.ficoConf = ficoConf;
            //this.syncOptions = syncOptions;

        }
        public IActionResult Index()
        {
            return View();
        }

        public List<int> getTracciatiFromIdkitLavorazione(int idKitLavorazione)
        {
            try
            {
                var promoLavorazione = this.ctx2.PromoLavorazionis.Where(f => f.Id == idKitLavorazione).FirstOrDefault();
                if (promoLavorazione == null)
                {
                    throw new Exception("Promo lavorazione non trovata");
                }

                var promo = this.ctx2.Promos.Where(f => f.guidID == promoLavorazione.GuidPromo).FirstOrDefault();
                if (promo == null)
                {
                    throw new Exception("Promo non trovata");
                }

                var tracciati = this.ctx2.PromoTracciatis
    .Include(t => t.IdPromoNavigation)
    .Where(t => t.IdPromo == promo.Id
             && t.guidCanale == promoLavorazione.GuidCanale
             && t.guidArea == promoLavorazione.GuidArea).Select(s => s.Id).ToList();

                //var tracciato = promo.PromoTracciatis.Where(f => f.guidCanale == promoLavorazione.GuidCanale && f.guidArea == promoLavorazione.GuidArea).FirstOrDefault();

                return tracciati;
            }
            catch (Exception ex)
            {
                ex.ToString();
                return new List<int>();
            }

        }


        private async Task<FICOAccessLevel> getAccesslevel()
        {
            string session = SessionIstantaObject.GetSession(HttpContext != null ? HttpContext! : httpContextInRent!);

            if (session != "no session")
            {
                Int16 id_utente = Convert.ToInt16(session);
                var utente = await this.ctx.Utentis.FindAsync(id_utente);
                //if (utente!.Stato == (Byte)statoUtente.FicoGuestAttivo || utente.Stato == (Byte)statoUtente.FicoGuestDisttivo)
                //{
                //    return FICOAccessLevel.guestFico;
                //}
                //else
                //{
                return FICOAccessLevel.adminLocal;
                //}
            }
            else
            {
                return FICOAccessLevel.noSession;
            }
        }


        #region Source & Context Forms 

        [HttpGet]
        [Route("FicoProcess/getFormContext/{type}")]
        public async Task<IActionResult> getFormContext(Byte type)
        {
            FicoContextResult bRes = new FicoContextResult();

            FICOContexts tipoContesto = (FICOContexts)Enum.Parse(typeof(FICOContexts), type.ToString());
            FICOAccessLevel acLevel = await getAccesslevel();

            if (acLevel != FICOAccessLevel.noSession)
            {

                //La chiamata arriva da circuito FICO.
                //Esego l'azione

                try
                {
                    //Genero codice random
                    Random rnd = new Random(9999999);

                    string pathFile = contextsPath + tipoContesto.ToString() + ".json";
                    if (tipoContesto == FICOContexts.nuovaLavorazione)
                        pathFile = $"{this.extarnalSourcePath}/ficoContext/{tipoContesto.ToString()}.json";

                    if (!System.IO.File.Exists(pathFile))
                    {
                        bRes.error = $"{pathFile} - File non trovato!";
                        bRes.esito = false;
                        return BadRequest(bRes);
                    }

                    bRes.content = System.IO.File.ReadAllText(pathFile);
                    bRes.esito = true;
                }
                catch (Exception ex)
                {
                    bRes.error = ex.Message;
                    bRes.esito = false;
                    return BadRequest(bRes);
                }


            }
            else
            {
                bRes.error = "no_login";
                bRes.esito = false;
                return Unauthorized(bRes);
            }


            return Ok(bRes);
        }

        [HttpGet]
        [Route("FicoProcess/getSchemasContext")]
        public async Task<IActionResult> getSchemasContext()
        {
            FicoContextSchemeResult bRes = new FicoContextSchemeResult();

            FICOAccessLevel acLevel = await getAccesslevel();

            if (acLevel != FICOAccessLevel.noSession)
            {


                //La chiamata arriva da circuito FICO.
                //Esego l'azione

                try
                {

                    bRes.schemi = new List<FicoContextScheme>();



                    //Aggiungo il contesto di Promo
                    OkObjectResult iaction_ctxPromo = (OkObjectResult)await getFormContext((Byte)FICOContexts.nuovaLavorazione);
                    FicoContextResult ctxPromo = (FicoContextResult)iaction_ctxPromo.Value!;
                    List<FicoContextSchemeField> jAr = JsonConvert.DeserializeObject<List<FicoContextSchemeField>>(ctxPromo.content)!;

                    bRes.schemi.Add(new FicoContextScheme() { titolo = "Promo", ficoContextFields = jAr });

                    //Aggiungo il contesto di Tracciato
                    OkObjectResult iaction_ctxTracciato = (OkObjectResult)await getFormContext((Byte)FICOContexts.importInLavorazione);
                    FicoContextResult ctxTracciato = (FicoContextResult)iaction_ctxTracciato.Value!;
                    List<FicoContextSchemeField> jAr2 = JsonConvert.DeserializeObject<List<FicoContextSchemeField>>(ctxTracciato.content)!;

                    bRes.schemi.Add(new FicoContextScheme() { titolo = "Tracciato", ficoContextFields = jAr2.Where(f => f.nome_field != "idAddestramento" && f.nome_field != "idLabel").ToList() });
                    bRes.esito = true;

                }
                catch (Exception ex)
                {
                    bRes.error = ex.Message;
                    bRes.esito = false;
                    return BadRequest(bRes);
                }


            }
            else
            {
                bRes.error = "no_login";
                bRes.esito = false;
                return Unauthorized(bRes);
            }


            return Ok(bRes);
        }

        [HttpGet]
        [Route("FicoProcess/getSourceFields/{guidId}")]
        public async Task<IActionResult> getSourceFields_deprecata(string guidId)
        {
            FicoDataSourceResult bRes = new FicoDataSourceResult();


            FICOAccessLevel acLevel = await getAccesslevel();

            if (acLevel != FICOAccessLevel.noSession)
            {
                //La chiamata arriva da circuito FICO.
                //Esego l'azione
                try
                {
                    string sourceListStr = await System.IO.File.ReadAllTextAsync(contextsPath + "sourceImportInLavorazione.json");
                    List<FicoDataSourcePacket> sourceList = JsonConvert.DeserializeObject<List<FicoDataSourcePacket>>(sourceListStr)!;
                    foreach (FicoDataSourcePacket source in sourceList)
                    {
                        if (source.idField == "idLabel")
                        {
                            ExternalSourceClass exClass2 = new ExternalSourceClass(this.extarnalSourcePath);
                            DbLabels db = exClass2.getLabels();
                            source.content = db.source.Select(s => new FicoDataSourceItem { titolo = s.Nome, valore = s.Codice.ToString() }).ToList();

                            List<int> tracciati = await this.ctx2.PromoTracciatis.Include(i => i.IdPromoNavigation).Where(p => p.IdPromoNavigation.guidID == guidId).Select(s => s.Id).ToListAsync();
                            var etichetteCaricate = await this.ctx2.PromoTracciatiRecords.Where(tr => tracciati.Contains(tr.IdTracciato)).GroupBy(g => g.Label).Select(s => s.Key).ToListAsync();



                            List<FicoDataSourceItem> etichetteNonPresenti = etichetteCaricate
                            .Where(etichetta => !source.content!.Any(a => a.valore == etichetta))
                            .Select(etichetta => new FicoDataSourceItem() { titolo = etichetta, valore = etichetta }).ToList();

                            if (etichetteNonPresenti.Count > 0)
                                source.content!.AddRange(etichetteNonPresenti);

                            source.content.Add(new FicoDataSourceItem() { titolo = "Scegli label personalizzata", valore = "lblpers" });


                        }
                        else if (source.idField == "idAddestramento")
                        {
                            source.content = await this.ctx2.AddestramentoExcels.Select(s => new FicoDataSourceItem()
                            {
                                valore = s.Id.ToString(),
                                titolo = s.Titolo
                            }).ToListAsync();


                        }
                        else if (source.idField == "guidIdArea")
                        {
                            source.content = SingletonConfiguration.DBACPV!.aree.Select(s => new FicoDataSourceItem()
                            {
                                titolo = s.sigla,
                                valore = s.guidID
                            }).ToList();
                        }
                        else if (source.idField == "guidIdCanale")
                        {
                            source.content = SingletonConfiguration.DBACPV!.canali.Select(s => new FicoDataSourceItem()
                            {
                                titolo = s.sigla,
                                valore = s.guidID
                            }).ToList();
                        }
                        else
                        {
                            //Prendo direttamente la definizione di content specificato nel json
                        }

                        bRes.list.Add(source);

                    }

                    bRes.esito = true;
                }
                catch (Exception ex)
                {
                    bRes.error = ex.Message;
                    bRes.esito = false;
                    return BadRequest(bRes);
                }
            }
            else
            {
                bRes.error = "no_login";
                bRes.esito = false;
                return Unauthorized(bRes);
            }


            return Ok(bRes);
        }
        [HttpGet]
        [Route("FicoProcess/getSourceFields/{guidId}/{scope}")]
        public async Task<IActionResult> getSourceFields(string guidId, string scope)
        {
            FicoDataSourceResult bRes = new FicoDataSourceResult();


            FICOAccessLevel acLevel = await getAccesslevel();

            if (acLevel != FICOAccessLevel.noSession)
            {
                //La chiamata arriva da circuito FICO.
                //Esego l'azione
                try
                {
                    string sourceListStr = await System.IO.File.ReadAllTextAsync(contextsPath + "source" + scope + ".json");
                    List<FicoDataSourcePacket> sourceList = JsonConvert.DeserializeObject<List<FicoDataSourcePacket>>(sourceListStr)!;
                    foreach (FicoDataSourcePacket source in sourceList)
                    {
                        if (source.binding == "labels")
                        {
                            ExternalSourceClass exClass2 = new ExternalSourceClass(this.extarnalSourcePath);
                            DbLabels db = exClass2.getLabels();
                            source.content = db.source.Select(s => new FicoDataSourceItem { titolo = s.Nome, valore = s.Codice.ToString() }).ToList();

                            List<int> tracciati = await this.ctx2.PromoTracciatis.Include(i => i.IdPromoNavigation).Where(p => p.IdPromoNavigation.guidID == guidId).Select(s => s.Id).ToListAsync();
                            var etichetteCaricate = await this.ctx2.PromoTracciatiRecords.Where(tr => tracciati.Contains(tr.IdTracciato)).GroupBy(g => g.Label).Select(s => s.Key).ToListAsync();



                            List<FicoDataSourceItem> etichetteNonPresenti = etichetteCaricate
                            .Where(etichetta => !source.content!.Any(a => a.valore == etichetta))
                            .Select(etichetta => new FicoDataSourceItem() { titolo = etichetta, valore = etichetta }).ToList();

                            if (etichetteNonPresenti.Count > 0)
                                source.content!.AddRange(etichetteNonPresenti);

                            source.content.Add(new FicoDataSourceItem() { titolo = "Scegli label personalizzata", valore = "lblpers" });


                        }
                        else if (source.binding == "addestramenti")
                        {
                            source.content = await this.ctx2.AddestramentoExcels.Select(s => new FicoDataSourceItem()
                            {
                                valore = s.Id.ToString(),
                                titolo = s.Titolo
                            }).ToListAsync();


                        }
                        else if (source.binding == "aree")
                        {
                            source.content = SingletonConfiguration.DBACPV!.aree.Select(s => new FicoDataSourceItem()
                            {
                                titolo = s.sigla,
                                valore = s.guidID
                            }).ToList();
                        }
                        else if (source.binding == "canali")
                        {
                            source.content = SingletonConfiguration.DBACPV!.canali.Select(s => new FicoDataSourceItem()
                            {
                                titolo = s.sigla,
                                valore = s.guidID
                            }).ToList();
                        }
                        else
                        {
                            //Prendo direttamente la definizione di content specificato nel json
                        }

                        bRes.list.Add(source);

                    }

                    bRes.esito = true;
                }
                catch (Exception ex)
                {
                    bRes.error = ex.Message;
                    bRes.esito = false;
                    return BadRequest(bRes);
                }
            }
            else
            {
                bRes.error = "no_login";
                bRes.esito = false;
                return Unauthorized(bRes);
            }


            return Ok(bRes);
        }

        #endregion

        #region Promo process

        [HttpGet]
        [Route("FicoProcess/getCombinazioniLavorazioneByPromo/{guidId}")]
        public async Task<IActionResult> getCombinazioniLavorazioneByPromo(string guidId)
        {
            FicoCombinazioniLavorazioneResponse bRes = new FicoCombinazioniLavorazioneResponse();

            FICOAccessLevel acLevel = await getAccesslevel();

            if (acLevel != FICOAccessLevel.noSession)
            {


                //La chiamata arriva da circuito FICO.
                //Esego l'azione
                try
                {
                    Promo? pItem = this.ctx2.Promos.Include(in1 => in1.PromoTracciatis).FirstOrDefault(p => p.guidID == guidId);
                    if (pItem == null)
                    {
                        throw new Exception($"Promo non trovata con la guid {guidId}");
                    }

                    bRes.lista = new List<FicoCombinazioniLavorazione>();

                    foreach (var tItem in pItem.PromoTracciatis)
                    {
                        string guidArea = tItem.guidArea!;
                        string guidCanale = tItem.guidCanale!;
                        string tracciatoContext = tItem.Context!;

                        List<FicoContextField> _listaContext = new List<FicoContextField>();

                        if (tracciatoContext != null)
                        {
                            _listaContext = JsonConvert.DeserializeObject<List<FicoContextField>>(tracciatoContext)!;
                        }


                        bRes.lista.Add(new FicoCombinazioniLavorazione()
                        {
                            guidIdArea = guidArea,
                            guidIdCanale = guidCanale,
                            tracciatoContext = _listaContext
                        });

                        bRes.esito = true;

                    }


                }
                catch (Exception ex)
                {
                    bRes.error = ex.Message;
                    bRes.esito = false;
                }


            }
            else
            {
                bRes.error = "no_login";
                bRes.esito = false;
                return Unauthorized(bRes);
            }


            return Ok(bRes);
        }

        [HttpGet]
        [Route("FicoProcess/getLabels")]
        public async Task<IActionResult> getLabels()
        {
            // La classe di risposta e' cambiata da quando questo metodo era stato
            // commentato: oggi FicoDataSourceResult contiene una lista di packet,
            // mentre il chiamante si aspetta content/esito in cima. Il packet li ha.
            FicoDataSourcePacket bRes = new FicoDataSourcePacket();

            bRes.idField = "idLabel";
            bRes.visible = true;


            FICOAccessLevel acLevel = await getAccesslevel();

            if (acLevel != FICOAccessLevel.noSession)
            {


                //La chiamata arriva da circuito FICO.
                //Esego l'azione
                try
                {
                    ExternalSourceClass exClass = new ExternalSourceClass(this.extarnalSourcePath);
                    DbLabels db = exClass.getLabels();                      
                    bRes.content = db.source.Select(s => new FicoDataSourceItem { titolo = s.Nome, valore = s.Codice.ToString() }).ToList();
                    bRes.esito = true;
                }
                catch (Exception ex)
                {
                    bRes.error = ex.Message;
                    bRes.esito = false;
                    return BadRequest(bRes);
                }




            }
            else
            {
                bRes.error = "no_login";
                bRes.esito = false;
                return Unauthorized(bRes);
            }


            return Ok(bRes);
        }

        [HttpGet]
        [Route("FicoProcess/getAddestramenti/{all}")]
        public async Task<IActionResult> getAddestramenti(bool all)
        {
            FicoSchemaAddestramentoResult bRes_forKit = new FicoSchemaAddestramentoResult();
            FicoDataSourceResult bRes = new FicoDataSourceResult();

            FICOAccessLevel acLevel = await getAccesslevel();

            if (acLevel != FICOAccessLevel.noSession)
            {

                try
                {

                    //if (all)
                    //{
                    bRes_forKit = new FicoSchemaAddestramentoResult();
                    bRes_forKit.content = new List<FicoSchemaAddestramento>();

                    List<AddestramentoExcel> lista_addestr = this.ctx2.AddestramentoExcels.Include(inc => inc.SchemaCampiExcels).ToList();

                    foreach (AddestramentoExcel addestr in lista_addestr)
                    {
                        bRes_forKit.content.Add(new FicoSchemaAddestramento()
                        {
                            Id = addestr.Id,
                            Nome = addestr.Titolo,
                            fields = addestr.SchemaCampiExcels.Select(s => new FicoSchemaAddestramentoField()
                            {
                                IdCampo = s.Id,
                                IdAddestramento = s.IdAddestramento,
                                NomeColonnaOriginale = s.NomeColonnaOriginale,
                                NomeColonna = s.NomeColonna,
                                NomeVisualizzato = s.NomeVisualizzato,
                                Indice = s.Indice
                            }).ToList()
                        });
                    }

                    FICOContexts tipoContesto = (FICOContexts)Enum.Parse(typeof(FICOContexts), FICOContexts.nuovaLavorazione.ToString());
                    string contentNuovaLavContext = System.IO.File.ReadAllText(contextsPath + tipoContesto.ToString() + ".json");
                    List<FicoContextField> _fcf_NuovaLav = JsonConvert.DeserializeObject<List<FicoContextField>>(contentNuovaLavContext)!;

                    tipoContesto = (FICOContexts)Enum.Parse(typeof(FICOContexts), FICOContexts.importInLavorazione.ToString());
                    string contentImpTracContext = System.IO.File.ReadAllText(contextsPath + tipoContesto.ToString() + ".json");
                    List<FicoContextField> _fcf_ImpTrac = JsonConvert.DeserializeObject<List<FicoContextField>>(contentImpTracContext)!;


                    //Aggiungo a tutti gli addestramenti trovati forzatamente il campo allEtichette per permettere la query anche sulle etichette
                    foreach (FicoSchemaAddestramento addestr in bRes_forKit.content)
                    {
                        addestr.fields.Add(new FicoSchemaAddestramentoField()
                        {
                            IdCampo = 0,
                            IdAddestramento = (int)addestr.Id,
                            NomeColonnaOriginale = "allEtichette",
                            NomeColonna = "allEtichette",
                            NomeVisualizzato = "Etichette",
                            Indice = 0
                        });

                        foreach (FicoContextField fcf in _fcf_NuovaLav)
                        {

                            addestr.fields.Add(new FicoSchemaAddestramentoField()
                            {
                                IdCampo = 0,
                                IdAddestramento = (int)addestr.Id,
                                NomeColonnaOriginale = $"Context.Promo.{fcf.nome_field}",
                                NomeColonna = $"Context.Promo.{fcf.nome_field}",
                                NomeVisualizzato = $"{fcf.nome_field} di Contesto promo",
                                Indice = 0
                            });

                        }
                        foreach (FicoContextField fcf in _fcf_ImpTrac)
                        {
                            addestr.fields.Add(new FicoSchemaAddestramentoField()
                            {
                                IdCampo = 0,
                                IdAddestramento = (int)addestr.Id,
                                NomeColonnaOriginale = $"Context.Tracciato.{fcf.nome_field}",
                                NomeColonna = $"Context.Tracciato.{fcf.nome_field}",
                                NomeVisualizzato = $"{fcf.nome_field} di Contesto tracciato",
                                Indice = 0
                            });

                        }

                    }


                    bRes_forKit.esito = true;

                    return Ok(bRes_forKit);


                    //}
                    //else
                    //{
                    //    bRes.content = new List<FicoDataSourceItem>();
                    //    bRes.content = this.ctx2.AddestramentoExcels.Select(s => new FicoDataSourceItem()
                    //    {
                    //        valore = s.Id.ToString(),
                    //        titolo = s.Titolo
                    //    }).ToList();
                    //    bRes.esito = true;

                    //    return Ok(bRes);
                    //}

                }
                catch (Exception ex)
                {
                    bRes.error = ex.Message;
                    bRes.esito = false;
                    return BadRequest(bRes);
                }

            }
            else
            {
                bRes.error = "no_login";
                bRes.esito = false;
                return Unauthorized(bRes);
            }

        }

        [HttpGet]
        [Route("FicoProcess/getFormati")]
        public async Task<IActionResult> getFormati()
        {
            FicoFormatoResult bRes = new FicoFormatoResult();

            FICOAccessLevel acLevel = await getAccesslevel();

            if (acLevel != FICOAccessLevel.noSession)
            {
                try
                {

                    bRes.content = SingletonConfiguration.DBFORMATI!.source;
                    bRes.esito = true;
                }
                catch (Exception ex)
                {
                    bRes.error = ex.Message;
                    bRes.esito = false;
                    return BadRequest(bRes);
                }

            }
            else
            {
                bRes.error = "no_login";
                bRes.esito = false;
                return Unauthorized(bRes);
            }


            return Ok(bRes);
        }

        [HttpPut]
        [Route("FicoProcess/salvaFormato")]
        public async Task<IActionResult> salvaFormato([FromBody] Formato obj)
        {
            BoolResult bRes = new BoolResult();

            FICOAccessLevel acLevel = await getAccesslevel();

            if (acLevel != FICOAccessLevel.noSession)
            {


                try
                {
                    bRes.Esito = salvaFormatoAction(obj);
                }
                catch (Exception ex)
                {
                    bRes.error = ex.Message;
                    bRes.Esito = false;
                    return BadRequest(bRes);
                }

            }
            else
            {
                bRes.error = "no_login";
                bRes.Esito = false;
                return Unauthorized(bRes);
            }


            return Ok(bRes);
        }

        [HttpPut]
        [Route("FicoProcess/eliminaFormato/{idFormato}")]
        public async Task<IActionResult> eliminaFormato(string idFormato)
        {
            BoolResult bRes = new BoolResult();

            FICOAccessLevel acLevel = await getAccesslevel();

            if (acLevel != FICOAccessLevel.noSession)
            {

                try
                {
                    bRes.Esito = eliminaFormatoAction(idFormato);
                }
                catch (Exception ex)
                {
                    bRes.error = ex.Message;
                    bRes.Esito = false;
                    return BadRequest(bRes);
                }
            }
            else
            {
                bRes.error = "no_login";
                bRes.Esito = false;
                return Unauthorized(bRes);
            }


            return Ok(bRes);
        }

        private bool salvaFormatoAction(Formato obj)
        {
            DbFormati? db = SingletonConfiguration.DBFORMATI;// exClass.getFormati();
            db!.SetExternalPath(this.extarnalSourcePath);
            Formato? fItem = db.source.Where(f => f.guidID == obj.guidID).FirstOrDefault();
            if (fItem != null)
            {

                fItem.descrizione = obj.descrizione;
                fItem.codice = obj.codice;
                fItem.titolo = obj.titolo;
                fItem.tipo = obj.tipo;
            }
            else
            {
                db.source.Add(obj);
            }

            db.SaveChanges();

            return true;
        }

        private bool eliminaFormatoAction(string idFormato)
        {
            DbFormati? db = SingletonConfiguration.DBFORMATI;// exClass.getFormati();
            db!.SetExternalPath(this.extarnalSourcePath);
            Formato? fItem = db.source.Where(f => f.guidID == idFormato).FirstOrDefault();
            if (fItem != null)
            {
                if (this.ctx2.PromoLavorazionis.Where(p => p.GuidFormato == idFormato).Count() > 0)
                    throw new Exception("Impossibile eliminare il formato, esistono lavorazioni che lo utilizzano");

                db.source.Remove(fItem);
            }
            else
            {
                throw new Exception("Formato non trovato");
            }

            db.SaveChanges();

            return true;
        }


        [HttpPut]
        [Route("FicoProcess/inizioNuovaLavorazione")]
        public async Task<IActionResult> inizioNuovaLavorazione([FromBody] FICOInizioLavorazioneObject obj)
        {
            BoolResult bRes = new BoolResult();


            FICOAccessLevel acLevel = await getAccesslevel();

            if (acLevel != FICOAccessLevel.noSession)
            {


                //La chiamata arriva da circuito FICO.
                //Esego l'azione

                try
                {
                    Promo p = new Promo();
                    p.guidID = obj.guid_id;
                    p.DataScadenza = DateTime.Parse(obj.dataScadenza!);
                    p.ValiditaDal = DateTime.Parse(obj.validitaDal!);
                    p.ValiditaAl = DateTime.Parse(obj.validitaAl!);
                    p.NomePromo = obj.nomePromo!;
                    p.Stato = (Byte)StatoPromo.Aperta;
                    p.Context = JsonConvert.SerializeObject(obj.context);

                    p.DataRegistrazione = DateTime.Now;

                    this.ctx2.Promos.Add(p);
                    this.ctx2.SaveChanges();

                    bRes.Esito = true;
                }
                catch (Exception ex)
                {
                    bRes.error = ex.Message;
                    bRes.Esito = false;
                    return BadRequest(bRes);
                }


            }
            else
            {
                bRes.error = "no_login";
                bRes.Esito = false;
                return Unauthorized(bRes);
            }


            return Ok(bRes);


        }

        [HttpPut]
        [Route("FicoProcess/aggiornaPromo")]
        public async Task<IActionResult> aggiornaPromo([FromBody] FICOInizioLavorazioneObject obj)
        {
            BoolResult bRes = new BoolResult();


            FICOAccessLevel acLevel = await getAccesslevel();

            if (acLevel != FICOAccessLevel.noSession)
            {


                //La chiamata arriva da circuito FICO.
                //Esego l'azione

                try
                {

                    Promo? p = this.ctx2.Promos.FirstOrDefault(p => p.guidID == obj.guid_id);

                    if (p == null)
                        throw new Exception("promo_not_found");


                    p.DataScadenza = DateTime.Parse(obj.dataScadenza!);
                    p.ValiditaDal = DateTime.Parse(obj.validitaDal!);
                    p.ValiditaAl = DateTime.Parse(obj.validitaAl!);
                    p.NomePromo = obj.nomePromo!;
                    if (obj.context == null)
                        obj.context = new List<FicoContextField>();

                    string ctx_serialized = JsonConvert.SerializeObject(obj.context);
                    bool ctxCambiato = (p.Context != ctx_serialized);
                    p.Context = ctx_serialized;

                    if (ctxCambiato)
                    {
                        //Dobbiamo aggiornare tutti i ctx promo di tutti i record tracciato di tutti i tracciati
                        foreach (PromoTracciatiRecord ptr in this.ctx2.PromoTracciatiRecords
                            .Include(i2 => i2.IdTracciatoNavigation)
                            .ThenInclude(i3 => i3.IdPromoNavigation)
                            .Where(r => r.IdTracciatoNavigation.IdPromoNavigation.guidID == obj.guid_id))
                        {
                            var objMeta = Utility.Main.getJsonObject(ptr.Dato);
                            objMeta[GLOBAL_VARIABLES.keyContextPromo] = JsonConvert.DeserializeObject<List<FicoContextField>>(ctx_serialized)!;
                            ptr.Dato = JsonConvert.SerializeObject(objMeta);
                        }
                        await this.ctx2.SaveChangesAsync();

                    }


                    this.ctx2.SaveChanges();

                    bRes.Esito = true;
                }
                catch (Exception ex)
                {
                    bRes.error = ex.Message;
                    bRes.Esito = false;
                    return Ok(bRes);
                }


            }
            else
            {
                bRes.error = "no_login";
                bRes.Esito = false;
                return Unauthorized(bRes);
            }


            return Ok(bRes);


        }

        [HttpDelete]
        [Route("FicoProcess/eliminaPromo/{guidPromo}/{eliminazioneTotale}")]
        public async Task<IActionResult> eliminaPromo(string guidPromo, bool eliminazioneTotale)
        {
            BoolResult bRes = new BoolResult();


            FICOAccessLevel acLevel = await getAccesslevel();

            if (acLevel != FICOAccessLevel.noSession)
            {


                //La chiamata arriva da circuito FICO.
                //Esego l'azione

                try
                {

                    Promo? p = this.ctx2.Promos.FirstOrDefault(p => p.guidID == guidPromo);

                    if (p == null)
                        throw new Exception("promo_not_found");


                    if (eliminazioneTotale)
                    {
                        if (this.ctx2.PromoImportazionis.Count(c => c.IdPromo == p.Id) > 0)
                            throw new Exception("importazioni_esistenti_per_questa_promo");

                        if (this.ctx2.PromoTracciatis.Count(c => c.IdPromo == p.Id) > 0)
                            throw new Exception("tracciati_esistenti_per_questa_promo");

                        if (this.ctx2.PromoLavorazionis.Count(c => c.GuidPromo == p.guidID) > 0)
                            throw new Exception("lavorazioni_esistenti_per_questa_promo");

                        this.ctx2.Promos.Remove(p);
                    }
                    else
                    {
                        p.Stato = (Byte)StatoPromo.Eliminata;
                    }

                    this.ctx2.SaveChanges();

                    bRes.Esito = true;
                }
                catch (Exception ex)
                {
                    bRes.error = ex.Message;
                    bRes.Esito = false;
                    return Ok(bRes);
                }


            }
            else
            {
                bRes.error = "no_login";
                bRes.Esito = false;
                return Unauthorized(bRes);
            }


            return Ok(bRes);
        }

        [HttpGet]
        [Route("FicoProcess/restore/{guidPromo}")]
        public async Task<IActionResult> restorePromo(string guidPromo)
        {
            BoolResult bRes = new BoolResult();


            FICOAccessLevel acLevel = await getAccesslevel();

            if (acLevel != FICOAccessLevel.noSession)
            {


                //La chiamata arriva da circuito FICO.
                //Esego l'azione

                try
                {

                    Promo? p = this.ctx2.Promos.FirstOrDefault(p => p.guidID == guidPromo);

                    if (p == null)
                        throw new Exception("promo_not_found");


                    p.Stato = (Byte)StatoPromo.Aperta;


                    this.ctx2.SaveChanges();

                    bRes.Esito = true;
                }
                catch (Exception ex)
                {
                    bRes.error = ex.Message;
                    bRes.Esito = false;
                    return Ok(bRes);
                }


            }
            else
            {
                bRes.error = "no_login";
                bRes.Esito = false;
                return Unauthorized(bRes);
            }


            return Ok(bRes);


        }

        [HttpPost]
        [Route("FicoProcess/uploadTracciato")]
        public async Task<IActionResult> Upload([FromForm] FicoInputImportInLavorazione request)
        {

            BoolResult result = new BoolResult();


            try
            {

                if (request.fileContent != null && request.fileContent.Length > 0)//_f != String.Empty)
                {
                    //Il file è presente                   
                    try
                    {
                        string file_xls = pathToImport + request.fileName;

                        System.IO.FileInfo fi = new FileInfo(file_xls);
                        if (fi.Extension.ToLower() != ".xls" && fi.Extension.ToLower() != ".xlsx")
                        {
                            result.errorCode = ErrorCodes.FormatoIncorretto;
                            result.error = "Formato del file non corretto";
                            return Ok(result);
                        }

                        using (FileStream fs = new FileStream(file_xls, FileMode.Create))
                        {
                            await request.fileContent.CopyToAsync(fs);
                        }

                        Promo? pItem = this.ctx2.Promos.Where(p => p.guidID == request.idPromo).FirstOrDefault();
                        if (pItem == null)
                            throw new Exception("Promo non trovata GUID: " + request.idPromo);

                        //Creo l'importazione
                        PromoImportazioni pImp = new PromoImportazioni();
                        pImp.DataCaricamento = DateTime.Now;
                        pImp.ParamsRequest = request.context;
                        pImp.IdPromo = pItem.Id;
                        pImp.NomeFile = request.fileName!;
                        pImp.guidID = request.guid_id;


                        InputFormTracciato pkg = new InputFormTracciato();
                        pkg.fields = new Dictionary<string, string>();
                        pkg.idPromo = pItem.Id;
                        pkg.filename = request.fileName;

                        JArray oContext = JArray.Parse(request.context!);
                        List<FicoContextField>? context = oContext.ToObject<List<FicoContextField>>();//JsonConvert.DeserializeObject<List<Edro21AreaCanale>>(oTrad.ToString());

                        foreach (FicoContextField _p in context!)
                        {
                            pkg.fields[_p.nome_field] = _p.user_value;
                        }

                        int idAdstr;
                        Int32.TryParse(pkg.getFieldByKey("idAddestramento"), out idAdstr);
                        pImp.IdAddestramento = idAdstr;


                        //Queste chiavi, nonostante siano transitate per necessità, dalprocesso di Upload,
                        //Vanno poi eliminate dopo essere state scrupolosamente conservate, perchè non consentono successivamente l'univocità di contesto quando verranno incrociati con i contesti di KIT

                        string sourceListStr = await System.IO.File.ReadAllTextAsync(contextsPath + "sourceImportInLavorazione.json");
                        List<string> sourceList = JsonConvert.DeserializeObject<List<FicoDataSourcePacket>>(sourceListStr)!.Select(s => s.idField).ToList(); ;

                        context.RemoveAll(r => sourceList.Contains(r.nome_field));



                        this.ctx2.Add(pImp);
                        this.ctx2.SaveChanges();


                        pkg.idImportazione = pImp.Id;


                        //request.file = new string[]{ };
                        OperationRequest op = new OperationRequest();
                        //if ((Byte)request.cmbTipoTracciato == (Byte)TipoImportazione.Vol)
                        op.Command = OperationCommand.ImportazioneVol;
                        //else
                        //op.Command = OperationCommand.ImportazionePoP;

                        //request.files = new string[]{ };//Azzero i files per non far pesare troppo l'oggetto inutilmente quando verrà salvato su db
                        request.fileContent = null;//Azzero i files per non far pesare troppo l'oggetto inutilmente quando verrà salvato su db


                        op.Packet = pkg;
                        op.context = context;

                        op.RichiestaAutorizzazioneUtenteIstantanea = true;

                        //Registro l'operazione, Ottengo così l'ID e preparo la cartella per l'elaborazione
                        OperationsController op_ctrl = new OperationsController(connString, pathToImport!, "", this.extarnalLibPath, this.extarnalSourcePath, this.ficoConf.Value.nomeCliente, this._dbContextFactory, dbContextFactory2: this._dbContextFactory2);
                        var actionResult = await op_ctrl.Add(op);

                        try
                        {
                            OkObjectResult res = (OkObjectResult)actionResult;
                            if (res.Value is Attivitum)
                            {
                                Attivitum obj = (Attivitum)res.Value!;

                                Console.WriteLine($"Attività creata ID : {obj.Id}");

                                pImp.IdAttivita = obj.Id;
                                this.ctx2.SaveChanges();



                                string op_folder = pathToImport + obj.Id.ToString() + System.IO.Path.DirectorySeparatorChar;
                                Directory.CreateDirectory(op_folder);
                                System.IO.File.Move(file_xls, op_folder + request.fileName);

                            }
                            else if (res.Value is BoolResult)
                            {
                                Console.WriteLine($"Operazione creata con errore {result.error}");
                                throw new Exception("Operazione annullata : " + result.error);
                                //BoolResult obj = (BoolResult)res.Value!;
                                //result = obj;
                            }
                            else
                            {

                            }


                        }
                        catch (Exception ex)
                        {
                            result.errorCode = ErrorCodes.Generic;
                            result.error = ex.ToString();
                            result.Esito = false;
                            return Ok(result);
                        }

                        result.Esito = true;

                    }
                    catch (Exception ex)
                    {
                        result.errorCode = ErrorCodes.Generic;
                        result.error = ex.ToString();
                        result.Esito = false;
                        return Ok(result);
                    }


                }
                else
                {
                    result.errorCode = ErrorCodes.FileNotFound;
                    result.error = "File excel non presente";
                    result.Esito = false;
                    return Ok(result);
                }
            }
            catch (Exception exErr)
            {
                return Ok(exErr.ToString());
            }

            return Ok(result);
        }

        [HttpGet]
        [Route("FicoProcess/getStatoImportazione/{guidID}")]
        public async Task<IActionResult> getStatoImportazione(string guidID)
        {
            FicoStatoImportazioneResult bRes = new FicoStatoImportazioneResult();

            FICOAccessLevel acLevel = await getAccesslevel();

            if (acLevel != FICOAccessLevel.noSession)
            {

                //La chiamata arriva da circuito FICO.
                //Esego l'azione

                try
                {
                    PromoImportazioni? impItem = await this.ctx2.PromoImportazionis.Where(p => p.guidID == guidID).FirstOrDefaultAsync();
                    if (impItem != null)
                    {
                        if (impItem.IdAttivita.HasValue)
                        {
                            //Leggo lo stato dell'attività legata a questa importazione
                            Attivitum? attItem = await this.ctx.Attivita.Where(p => p.Id == impItem.IdAttivita.Value).FirstOrDefaultAsync();

                            bRes.stato = (OperationStauts)attItem!.Stato;
                            if (bRes.stato == OperationStauts.TerminataConErrori)
                            {
                                //Leggiamo gli errori
                                this.ctx.AttivitaLogs.Where(p => p.IdAttivita == attItem.Id).ToList().ForEach(p =>
                                {
                                    bRes.error += p.Note + "\n";
                                });
                            }

                            bRes.esito = true;
                        }
                        else
                        {
                            throw new Exception("Nessuna attività si è innescata con l'importazione Guid: " + guidID);
                        }
                    }
                    else
                    {
                        throw new Exception("Importazione non trovata Guid: " + guidID);
                    }
                }
                catch (Exception ex)
                {
                    bRes.error = ex.Message;
                    bRes.esito = false;
                    return BadRequest(bRes);
                }


            }
            else
            {
                bRes.error = "no_login";
                bRes.esito = false;
                return Unauthorized(bRes);
            }


            return Ok(bRes);
        }


        #endregion

        #region Tipi di Export

        [HttpGet]
        [Route("FicoProcess/getTipiDiExport")]
        public async Task<IActionResult> getTipiDiExport()
        {
            FicoTipiDiExportResult bRes = new FicoTipiDiExportResult();

            FICOAccessLevel acLevel = await getAccesslevel();

            if (acLevel != FICOAccessLevel.noSession)
            {
                try
                {
                    bRes.content = SingletonConfiguration.DBTipiDiExport!.source;
                    bRes.esito = true;
                }
                catch (Exception ex)
                {
                    bRes.error = ex.Message;
                    bRes.esito = false;
                    return BadRequest(bRes);
                }
            }
            else
            {
                bRes.error = "no_login";
                bRes.esito = false;
                return Unauthorized(bRes);
            }


            return Ok(bRes);
        }

        [HttpPut]
        [Route("FicoProcess/salvaTipoDiExport")]
        public async Task<IActionResult> salvaTipoDiExport([FromBody] TipoDiExport obj)
        {
            BoolResult bRes = new BoolResult();

            FICOAccessLevel acLevel = await getAccesslevel();

            if (acLevel != FICOAccessLevel.noSession)
            {

                //La chiamata arriva da circuito FICO.
                //Esego l'azione

                try
                {
                    bRes.Esito = salvaTipoDiExportAction(obj);
                }
                catch (Exception ex)
                {
                    bRes.error = ex.Message;
                    bRes.Esito = false;
                    return BadRequest(bRes);
                }
            }
            else
            {
                bRes.error = "no_login";
                bRes.Esito = false;
                return Unauthorized(bRes);
            }


            return Ok(bRes);
        }

        [HttpPut]
        [Route("FicoProcess/eliminaTipoDiExport/{guidId}")]
        public async Task<IActionResult> eliminaTipoDiExport(string guidId)
        {
            BoolResult bRes = new BoolResult();

            FICOAccessLevel acLevel = await getAccesslevel();

            if (acLevel != FICOAccessLevel.noSession)
            {
                try
                {
                    eliminaTipoDiExportAction(guidId);
                    bRes.Esito = true;
                    return Ok(bRes);
                }
                catch (Exception ex)
                {
                    bRes.error = ex.Message;
                    bRes.Esito = false;
                    return BadRequest(bRes);
                }
            }
            else
            {
                bRes.error = "no_login";
                bRes.Esito = false;
                return Unauthorized(bRes);
            }


            return Ok(bRes);
        }


        private bool salvaTipoDiExportAction(TipoDiExport obj)
        {
            DbTipoDiExport? dbTE = SingletonConfiguration.DBTipiDiExport;
            TipoDiExport? fItem = dbTE!.source.Where(f => f.guidID == obj.guidID).FirstOrDefault();
            if (fItem != null)
            {
                fItem.codice = obj.codice;
                fItem.titolo = obj.titolo;
                fItem.modalita = obj.modalita;
                fItem.guidIdNamingConvention = obj.guidIdNamingConvention;
                fItem.filtro = obj.filtro;
            }
            else
            {
                dbTE.source.Add(obj);
            }

            dbTE.SaveChanges();

            return true;
        }

        private bool eliminaTipoDiExportAction(string guidId)
        {
            DbTipoDiExport? db = SingletonConfiguration.DBTipiDiExport;// exClass.getFormati();
            db!.SetExternalPath(this.extarnalSourcePath);
            TipoDiExport? fItem = db!.source.Where(f => f.guidID == guidId).FirstOrDefault();
            if (fItem != null)
            {
                db.source.Remove(fItem);
            }
            else
            {
                throw new Exception("Tipo di export non trovato");
            }


            db.SaveChanges();

            return true;
        }

        #endregion

        #region NamingConvention
        [HttpGet]
        [Route("FicoProcess/getAllNamingConventionComponents")]
        public async Task<IActionResult> getAllNamingConventionComponents(string guid)
        {
            FicoNamingConventionResult bRes = new FicoNamingConventionResult();

            FICOAccessLevel acLevel = await getAccesslevel();

            if (acLevel != FICOAccessLevel.noSession)
            {

                //if (acLevel == FICOAccessLevel.guestFico)
                //{
                try
                {
                    bRes.content = SingletonConfiguration.DBNamingConvention!.components;// jArr.ToObject<List<FicoNamingConventionField>>();
                    bRes.esito = true;
                }
                catch (Exception ex)
                {
                    bRes.error = ex.ToString();
                    bRes.esito = false;
                    return BadRequest(bRes);
                }
                //}
            }

            return Ok(bRes);
        }

        [HttpPut]
        [Route("FicoProcess/salvaNamingConvention")]
        public async Task<IActionResult> salvaNamingConvention([FromBody] FicoNamingConventionCombinazione obj)
        {
            BoolResult bRes = new BoolResult();

            FICOAccessLevel acLevel = await getAccesslevel();

            Console.WriteLine(">> salvaNamingConvention");
            if (acLevel != FICOAccessLevel.noSession)
            {
                Console.WriteLine($">> {acLevel}");

                try
                {
                    Console.WriteLine($">> salvo...");
                    Console.WriteLine($">> " + JsonConvert.SerializeObject(obj));
                    bRes.Esito = salvaNamingConventionAction(obj);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($">> " + ex.ToString());
                    bRes.error = ex.Message;
                    bRes.Esito = false;
                    return BadRequest(bRes);
                }

            }
            else
            {
                bRes.error = "no_login";
                bRes.Esito = false;
                return Unauthorized(bRes);
            }


            return Ok(bRes);
        }

        [HttpPut]
        [Route("FicoProcess/eliminaNamingConvention/{guidId}")]
        public async Task<IActionResult> eliminaNamingConvention(string guidId)
        {
            BoolResult bRes = new BoolResult();

            FICOAccessLevel acLevel = await getAccesslevel();

            if (acLevel != FICOAccessLevel.noSession)
            {

                try
                {
                    eliminaNamingConventionAction(guidId);
                    bRes.Esito = true;
                    return Ok(bRes);
                }
                catch (Exception ex)
                {
                    bRes.error = ex.Message;
                    bRes.Esito = false;
                    return BadRequest(bRes);
                }

            }
            else
            {
                bRes.error = "no_login";
                bRes.Esito = false;
                return Unauthorized(bRes);
            }


            return Ok(bRes);
        }

        private bool eliminaNamingConventionAction(string guidId)
        {
            DbNamingConvention? db = SingletonConfiguration.DBNamingConvention;
            FicoNamingConventionCombinazione? fItem = db!.combinazioni.Where(f => f.guidId == guidId).FirstOrDefault();
            if (fItem != null)
            {
                //Controllo se è impiegato in qualche tipo di export
                if (SingletonConfiguration.DBTipiDiExport!.source.Where(te => te.guidIdNamingConvention == guidId).Count() > 0)
                    throw new Exception("impiegata_in_tipo_export");

                db.combinazioni.Remove(fItem);
            }
            else
            {
                throw new Exception("Naming convention non trovata");
            }


            db.SaveChanges();

            return true;
        }

        private bool salvaNamingConventionAction(FicoNamingConventionCombinazione obj)
        {
            DbNamingConvention? db = SingletonConfiguration.DBNamingConvention;
            FicoNamingConventionCombinazione? ncItem = db!.combinazioni.Where(f => f.guidId == obj.guidId).FirstOrDefault();
            if (ncItem != null)
            {
                ncItem.combinazione = obj.combinazione;
            }
            else
            {
                db.combinazioni.Add(obj);
            }

            db.SaveChanges();

            return true;
        }

        #endregion

        #region Matrice di produzione

        [HttpGet]
        [Route("FicoProcess/getSchemaAddestramentoById/{id}")]
        public async Task<IActionResult> getSchemaAddestramentoById(int id)
        {
            FicoSchemaAddestramentoFieldResult bRes = new FicoSchemaAddestramentoFieldResult();

            FICOAccessLevel acLevel = await getAccesslevel();

            if (acLevel != FICOAccessLevel.noSession)
            {
                try
                {
                    AddestramentoExcel? addestr = this.ctx2.AddestramentoExcels.Include(i1 => i1.SchemaCampiExcels).FirstOrDefault(f => f.Id == id);
                    if (addestr == null)
                    {
                        bRes.error = "Addestramento non trovato";
                        bRes.esito = false;
                        return NotFound(bRes);
                    }



                    bRes.content = addestr.SchemaCampiExcels.Select(s => new FicoSchemaAddestramentoField()
                    {
                        IdCampo = s.Id,
                        IdAddestramento = s.IdAddestramento,
                        NomeColonnaOriginale = s.NomeColonnaOriginale,
                        NomeColonna = s.NomeColonna,
                        NomeVisualizzato = s.NomeVisualizzato,
                        Indice = s.Indice
                    }).ToList();
                    bRes.esito = true;
                }
                catch (Exception ex)
                {
                    bRes.error = ex.Message;
                    bRes.esito = false;
                    return BadRequest(bRes);
                }
            }
            else
            {
                bRes.error = "no_login";
                bRes.esito = false;
                return Unauthorized(bRes);
            }


            return Ok(bRes);
        }


        [HttpGet]
        [Route("FicoProcess/getAllDeclinazioniKit")]
        public async Task<IActionResult> getAllDeclinazioniKit(string guid)
        {
            FicoDeclinazioneKitResult bRes = new FicoDeclinazioneKitResult();

            FICOAccessLevel acLevel = await getAccesslevel();

            if (acLevel != FICOAccessLevel.noSession)
            {

                //if (acLevel == FICOAccessLevel.guestFico)
                //{
                try
                {
                    //JArray jArr = JsonConvert.DeserializeObject<JArray>(System.IO.File.ReadAllText(extarnalSourcePath + "\\SourceDeclinazioniKit.json"));
                    bRes.content = SingletonConfiguration.DbDeclinazioniKit!.source; // jArr.ToObject<List<FicoDeclinazioneKit>>();
                    bRes.esito = true;
                }
                catch (Exception ex)
                {
                    bRes.error = ex.ToString();
                    bRes.esito = false;
                    return BadRequest(bRes);
                }
                //}
            }

            return Ok(bRes);
        }

        //Chiamata effettuata da InDsign per cercare i KIT in base al filtro
        [HttpGet]
        [Route("FicoProcess/getCombinazioniByPromo/{guidPromo}/{guidFormato}/{guidCanale}/{guidArea}")]
        public async Task<IActionResult> getCombinazioniByPromo(string guidPromo, string guidFormato, string guidCanale, string guidArea)
        {
            FicoCombinazioneKitLocaleResult result = new FicoCombinazioneKitLocaleResult();
            result.esito = false;

            FICOAccessLevel acLevel = await getAccesslevel();

            if (acLevel != FICOAccessLevel.noSession)
            {
                try
                {
                    //La chiamata è fatta localmente
                    Int16 session = Int16.Parse(SessionIstantaObject.GetSession(HttpContext != null ? HttpContext! : httpContextInRent!));
                    Utenti? me = this.ctx.Utentis.Where(w => w.Id == session).FirstOrDefault();
                    FICOLoginResponse loginFico = await FICOMiddleware.login(olUrl, me!, secretKey, olympusUserPolycy, this.ctx, httpClient);
                    if (loginFico.esito)
                    {
                        result.records = new List<PromoLavorazioni>();

                        string? contextPromo = this.ctx2.Promos.Where(p => p.guidID == guidPromo).Select(s => s.Context).FirstOrDefault();
                        List<FicoContextField> listContext = JsonConvert.DeserializeObject<List<FicoContextField>>(contextPromo!)!;

                        Console.WriteLine($"Richiesta combinazioni con context promo: {contextPromo}");
                        FicoCombinazioneKitRequest req = new FicoCombinazioneKitRequest() { idPromo = guidPromo, idFormato = guidFormato != "0" ? guidFormato : "", idCanale = guidCanale != "0" ? guidCanale : "", idArea = guidArea != "0" ? guidArea : "", promoContext = listContext, lettura = true };

                        //Se la combinazione è già inclusa nella chiamata (E DEVE ESSERE INCLUSA), allora evito di recuperarla
                        var contentParam = new StringContent(JsonConvert.SerializeObject(req), Encoding.UTF8, "application/json");

                        //FicoCombinazioniKitResponse resultFP = await doActionGetCombinazioniOnFP(loginFico.publicKey, "getKitByPromo", contentParam);

                        FicoRuntimeKitResponse resultFP = new FicoRuntimeKitResponse();

                        httpClient.DefaultRequestHeaders.Clear();
                        httpClient.DefaultRequestHeaders.Add("Authorization", "Bearer " + loginFico.publicKey);
                        //HttpClient hCli = new HttpClient();
                        //hCli.DefaultRequestHeaders.Add("Authorization", "Bearer " + pubKey);

                        string url = $"{fpUrl}/getKitByPromo";
                        var response = await httpClient.PutAsync(url, contentParam);
                        //var response = await hCli.PutAsync(url, content);

                        if (response.IsSuccessStatusCode)
                        {

                            var contentResponse = await response.Content.ReadAsStringAsync();
                            resultFP = JsonConvert.DeserializeObject<FicoRuntimeKitResponse>(contentResponse)!;


                        }
                        else
                        {
                            result.esito = false;
                            result.error = await response.Content.ReadAsStringAsync();
                        }


                        //FP risponde con una lista di kit che vanno spediti ciascuno alla routine di esportazione VOL o POP (questo a seconda del formato)
                        if (resultFP.esito)
                        {
                            if (resultFP.content.Count <= 0)
                            {
                                throw new Exception("Nessuna combinazione trovata su FP");
                            }

                            foreach (FicoRuntimeKit kit in resultFP.content)
                            {

                                //Controllo se esiste già
                                PromoLavorazioni? plItem = this.ctx2.PromoLavorazionis.FirstOrDefault(w =>
                                    w.GuidPromo == guidPromo &&
                                    w.GuidRaccoglitore == kit.guidIdRaccoglitore &&
                                    w.GuidCanale == kit.guidCanale &&
                                    w.GuidArea == kit.guidArea &&
                                    w.GuidFormato == kit.guidFormato
                                );

                                Promo? prItem = this.ctx2.Promos.FirstOrDefault(pr => pr.guidID == guidPromo);
                                string ctxtStr = prItem!.ToStringContext();
                                string newTitolo = $"{prItem.NomePromo} {SingletonConfiguration.DBACPV!.canali.FirstOrDefault(c => c.guidID == kit.guidCanale)!.sigla}/{SingletonConfiguration.DBACPV.aree.FirstOrDefault(c => c.guidID == kit.guidArea)!.sigla}{(ctxtStr == "" ? " " + ctxtStr : "")}";
                                kit.titolo = newTitolo;

                                if (plItem == null)
                                {
                                    plItem = new PromoLavorazioni();
                                    plItem.GuidId = kit.guidId;
                                    plItem.GuidRaccoglitore = kit.guidIdRaccoglitore;
                                    plItem.GuidPromo = guidPromo;
                                    plItem.GuidArea = kit.guidArea;
                                    plItem.GuidCanale = kit.guidCanale;
                                    plItem.GuidFormato = kit.guidFormato;

                                    plItem.RegisterDate = DateTime.Now;
                                    plItem.Stato = (Byte)FICOPromoLavorazioneStato.InLavorazione;



                                    plItem.Meta = JsonConvert.SerializeObject(kit);
                                }
                                else
                                {
                                    kit.titolo = newTitolo;
                                    plItem.Meta = JsonConvert.SerializeObject(kit);
                                }

                                result.records.Add(plItem);


                            }

                            result.esito = true;

                            return Ok(result);

                        }
                        else
                        {
                            result.error = "FP error: " + resultFP.error;
                            return Ok(result);
                        }

                    }
                    else
                    {
                        result.error = "Login fico Failed: " + loginFico.error;
                    }

                }
                catch (Exception ex)
                {
                    result.error = ex.ToString();
                }

            }
            else
            {
                result.error = "No session";
            }

            return Ok(result);
        }

        //Questa chiamata avviene da plugin indd per dichiarare inizizata la lavorazione di un kit
        [HttpGet]
        [Route("FicoProcess/iniziaLavorazione/{guidPromo}/{guidId}")]
        public async Task<IActionResult> iniziaLavorazione(string guidPromo, string guidId)
        {
            FicoCombinazioneKitLocaleResult result = new FicoCombinazioneKitLocaleResult();
            result.esito = false;


            FICOAccessLevel acLevel = await getAccesslevel();

            if (acLevel != FICOAccessLevel.noSession)
            {
                try
                {
                    //La chiamata è fatta localmente
                    Int16 session = Int16.Parse(SessionIstantaObject.GetSession(HttpContext != null ? HttpContext! : httpContextInRent!));
                    Utenti? me = this.ctx.Utentis.Where(w => w.Id == session).FirstOrDefault();
                    FICOLoginResponse loginFico = await FICOMiddleware.login(olUrl, me!, secretKey, olympusUserPolycy, this.ctx, httpClient);
                    if (loginFico.esito)
                    {
                        result.records = new List<PromoLavorazioni>();

                        FicoCombinazioneKitRequest req = new FicoCombinazioneKitRequest() { id = guidId, idPromo = guidPromo, lettura = false };

                        //Se la combinazione è già inclusa nella chiamata (E DEVE ESSERE INCLUSA), allora evito di recuperarla
                        var contentParam = new StringContent(JsonConvert.SerializeObject(req), Encoding.UTF8, "application/json");


                        //FicoCombinazioniKitResponse resultFP = await doActionGetCombinazioniOnFP(loginFico.publicKey, "getKitByPromo", contentParam);

                        FicoRuntimeKitResponse resultFP = new FicoRuntimeKitResponse();

                        httpClient.DefaultRequestHeaders.Clear();
                        httpClient.DefaultRequestHeaders.Add("Authorization", "Bearer " + loginFico.publicKey);
                        //HttpClient hCli = new HttpClient();
                        //hCli.DefaultRequestHeaders.Add("Authorization", "Bearer " + pubKey);

                        string url = $"{fpUrl}/getKitByPromo";
                        var response = await httpClient.PutAsync(url, contentParam);
                        //var response = await hCli.PutAsync(url, content);

                        if (response.IsSuccessStatusCode)
                        {

                            var contentResponse = await response.Content.ReadAsStringAsync();
                            resultFP = JsonConvert.DeserializeObject<FicoRuntimeKitResponse>(contentResponse)!;


                        }
                        else
                        {
                            result.esito = false;
                            result.error = await response.Content.ReadAsStringAsync();
                        }


                        //FP risponde con una lista di kit che vanno spediti ciascuno alla routine di esportazione VOL o POP (questo a seconda del formato)
                        if (resultFP.esito)
                        {


                            FicoRuntimeKit? kit = resultFP.content.FirstOrDefault();
                            if (kit != null)
                            {

                                //Controllo se esiste già
                                PromoLavorazioni? plItem = this.ctx2.PromoLavorazionis.FirstOrDefault(w =>
                                    w.GuidPromo == guidPromo &&
                                    w.GuidRaccoglitore == kit.guidIdRaccoglitore &&
                                    w.GuidCanale == kit.guidCanale &&
                                    w.GuidArea == kit.guidArea &&
                                    w.GuidFormato == kit.guidFormato
                                );

                                if (plItem == null)
                                {
                                    plItem = new PromoLavorazioni();
                                    plItem.GuidId = kit.guidId;
                                    plItem.GuidRaccoglitore = kit.guidIdRaccoglitore;
                                    plItem.GuidPromo = guidPromo;
                                    plItem.GuidArea = kit.guidArea;
                                    plItem.GuidCanale = kit.guidCanale;
                                    plItem.GuidFormato = kit.guidFormato;
                                    plItem.IdAutore = session;

                                    plItem.RegisterDate = DateTime.Now;
                                    plItem.Stato = (Byte)FICOPromoLavorazioneStato.InLavorazione;

                                    Promo? prItem = this.ctx2.Promos.FirstOrDefault(pr => pr.guidID == guidPromo);
                                    //Da cambiare e codificare per l'operatività di istanta. Ovvero -> NOME PROMO - CANALE - AREA - {eventuale codifica contesto}
                                    string ctxtStr = prItem!.ToStringContext();
                                    string newTitolo = $"{prItem.NomePromo} {SingletonConfiguration.DBACPV!.canali.FirstOrDefault(c => c.guidID == kit.guidCanale)!.sigla}/{SingletonConfiguration.DBACPV.aree.FirstOrDefault(c => c.guidID == kit.guidArea)!.sigla}{(ctxtStr != "" ? " " + ctxtStr : "")}";

                                    kit.titolo = newTitolo;
                                    plItem.Meta = JsonConvert.SerializeObject(kit);

                                    this.ctx2.PromoLavorazionis.Add(plItem);
                                    this.ctx2.SaveChanges();
                                }


                                result.records.Add(plItem);


                            }
                            result.esito = true;

                            //this.ctx2.SaveChanges();

                            return Ok(result);

                        }
                        else
                        {
                            return BadRequest();
                        }

                    }
                }
                catch (Exception ex)
                {
                    result.error = ex.ToString();
                }

            }

            return Ok(result);
        }

        //Chiamata effettuata da diverse parti per effettuare il processo di un kit
        [HttpGet]
        [Route("FicoProcess/processaKit/{id}/{mode}/{noCache}")]//{guidId}/{guidRaccoglitore}/{guidPromo}/{guidArea}/{guidCanale}/{guidFormato}")]
        public async Task<IActionResult> processaKit(int id, FicoCombinazioneKitReadMode mode, bool noCache = false, string guidIdTipiDiExport = ""/*, bool confronto = false*/)//string guidId, string guidRaccoglitore, string guidPromo, string guidArea, string guidCanale, string guidFormato)
        {
            string error_report = "";

            ArticoloInRevisioneKitResult result = new ArticoloInRevisioneKitResult();


            FICOAccessLevel acLevel = await getAccesslevel();

            if (acLevel != FICOAccessLevel.noSession)
            {
                //Console.WriteLine($"Step 1");

                //La chiamata è fatta localmente
                Int16 session = Int16.Parse(SessionIstantaObject.GetSession(HttpContext != null ? HttpContext! : httpContextInRent!));
                Utenti? me = this.ctx.Utentis.Where(w => w.Id == session).FirstOrDefault();
                //FICOLoginResponse loginFico = await FICOMiddleware.login(olUrl, me, secretKey, olympusUserPolycy, this.ctx, httpClient);
                if (/*loginFico.esito*/ true)
                {
                    try
                    {
                        //Console.WriteLine($"Step 2 go to {id}");

                        List<Articoli> archivio_refs = new List<Articoli>();
                        List<ArticoliDescrizioni> archivio_descr_gruppo = new List<ArticoliDescrizioni>();

                        IstantaLib.Utility.Logger.Log($"Processo Lavorazione {id}");

                        PromoLavorazioni? plItem = this.ctx2.PromoLavorazionis.FirstOrDefault(pl => pl.Id == id);

                        //Console.WriteLine($"Step 2_1 go to {plItem.GuidPromo}");

                        //FicoCombinazioneKitRequest req = new FicoCombinazioneKitRequest() {
                        //    idPromo  = guidPromo!="0"?guidPromo:"" ,
                        //    id = guidId!="0"?guidId:"",
                        //    idRaccoglitore  = guidRaccoglitore!="0"?guidRaccoglitore:"" ,
                        //    idArea  = guidArea!="0"?guidArea:"" ,
                        //    idCanale  = guidCanale!="0"?guidCanale:"",
                        //    idFormato = guidFormato!="0"?guidFormato:"",
                        //};

                        ////Prima la cerco localmente
                        ////Se la trovo deserializzo i meta e ricostruisco l'intero filtro e quindi posso fare subito PROCESSA KIT
                        ////Questo puo accadere durante una lavorazione volantino che richiede ripetute chiamate di impaginazione
                        //List<PromoLavorazioni> lavorazioniInLocale = this.ctx2.PromoLavorazionis.Where(w =>
                        //w.GuidPromo == guidPromo &&
                        //w.GuidRaccoglitore == guidRaccoglitore &&
                        //w.GuidCanale == guidCanale &&
                        //w.GuidArea == guidArea).ToList();

                        IstantaLib.Utility.Logger.Log($"Guid promo {plItem!.GuidPromo}");

                        Promo? promo = this.ctx2.Promos.Where(w => w.guidID == plItem.GuidPromo).FirstOrDefault();

                        //Console.WriteLine($"Step 2_2");

                        List<FicoContextField> promoContext = JsonConvert.DeserializeObject<List<FicoContextField>>(promo!.Context!)!;

                        FicoCombinazioniKitResponse resultFP = new FicoCombinazioniKitResponse();


                        //Console.WriteLine($"Step 3");

                        //FicoCombinazioneKit kit = JsonConvert.DeserializeObject<FicoCombinazioneKit>(plItem.Meta);
                        FicoRuntimeKit? kit = JsonConvert.DeserializeObject<FicoRuntimeKit>(plItem.Meta!);

                        if (guidIdTipiDiExport != "")
                        {
                            kit!.tipiDiExportInKit = kit.tipiDiExportInKit.Where(f => f.tipoDiExportGuidID == guidIdTipiDiExport).ToList();

                            if (kit.tipiDiExportInKit.Count > 1)
                            {
                                throw new Exception("guidIdTipiDiExport: " + guidIdTipiDiExport + " associato a più tipi di export");
                            }
                            else if (kit.tipiDiExportInKit.Count == 0)
                            {
                                throw new Exception("guidIdTipiDiExport: " + guidIdTipiDiExport + " non associato a nessun tipo di export");

                            }
                        }
                        var CombsETracciati = this.ctx2.PromoTracciatis.Where(w =>
                                w.IdPromo == promo.Id &&
                                (w.guidCanale == kit!.guidCanale || kit.guidCanale == null) &&
                                (w.guidArea == kit.guidArea || kit.guidArea == null) &&
                                (w.guidPV == kit.guidPV || kit.guidPV == null)
                            ).ToList();


                        IstantaLib.Utility.Logger.Log($"Tracciati trovati {CombsETracciati.Count}");

                        //Calcolo dei punteggi per KIT in base al filtro contesto
                        var punteggioTracciati = CombsETracciati.Select(s => new
                        {
                            IdTracciato = s.Id,
                            Context = JsonConvert.DeserializeObject<List<FicoContextField>>(s.Context!)
                        });

                        if (punteggioTracciati.Count() <= 0)
                            throw new Exception("no tracciati found");

                        //Console.WriteLine($"Step 4");

                        Dictionary<int, int> scores = new Dictionary<int, int>();

                        foreach (var tItemScore in punteggioTracciati)
                        {
                            if (kit!.filtroContesto != null && kit.filtroContesto.Count > 0)
                            {
                                Console.WriteLine($"Check filtro contesto kit: {JsonConvert.SerializeObject(kit!.filtroContesto)}");
                                if (checkFiltroContesto(promoContext, tItemScore.Context!, kit.filtroContesto))
                                {
                                    //tItemScore.Punteggio += 1;
                                    IstantaLib.Utility.Logger.Log($"Punteggio Tracciato {tItemScore.IdTracciato}:1");
                                    scores.Add(tItemScore.IdTracciato, 1);
                                }
                                else
                                {
                                    //tItemScore.Punteggio -= 1;
                                    IstantaLib.Utility.Logger.Log($"Punteggio Tracciato {tItemScore.IdTracciato}:-1");
                                    scores.Add(tItemScore.IdTracciato, -1);
                                }
                            }
                            else
                            {
                                if (promoContext.Count + tItemScore.Context!.Count == 0)
                                {
                                    //Il punteggio rimane a 0
                                    IstantaLib.Utility.Logger.Log($"Punteggio Tracciato {tItemScore.IdTracciato}:0 b");
                                    scores.Add(tItemScore.IdTracciato, 0);
                                }
                                else
                                {
                                    IstantaLib.Utility.Logger.Log($"Punteggio Tracciato {tItemScore.IdTracciato}:-1 b");
                                    scores.Add(tItemScore.IdTracciato, -1);
                                }
                            }

                        }

                        //adesso andiamo a vedere la classifica
                        int maxVal = scores.Max(m => m.Value);
                        if (maxVal < 0)
                        {
                            IstantaLib.Utility.Logger.Log($"Nessun vincitore");
                            throw new Exception("Nessun punteggio valido");
                            //Nessun vincitore
                            ////si passa oltre
                            //Console.WriteLine("Nessun vincitore!");
                        }
                        else
                        {
                            int[] idsTrVincitori = scores.Where(s => s.Value == maxVal).Select(s => s.Key).ToArray();

                            //Console.WriteLine("Punteggio vincitori: " + idsTrVincitori.Count());

                            kit!.records = new List<ArticoloInKit>();
                            try
                            {
                                string kitCacheId = $"{String.Join('-', idsTrVincitori)}${kit.guidIdRaccoglitore}${mode}";
                                if (!this._cache.TryGetValue(kitCacheId, out PreparazioneListaResult? kitResult) || noCache/* || confronto*/)
                                {
                                    /*PreparazioneListaResult*/
                                    IstantaLib.Utility.Logger.Log($"Processo kit");

                                    kitResult = await processaKitDo(kit, CombsETracciati.Where(tr => idsTrVincitori.Contains(tr.Id)).ToList(), promo, archivio_refs, archivio_descr_gruppo, id, mode/*, confronto*/);
                                    //Console.WriteLine("Kit processato: " + kitResult.records.Count + " , " + kitResult.error);
                                    //if (confronto)
                                    //{
                                    //    //se il processo è di confronto non possiamo impostare la cache poichè sarebbe falsata
                                    //    this._cache.Remove(kitCacheId);
                                    //}
                                    //else
                                    //{
                                        this._cache.Set(kitCacheId, kitResult, new MemoryCacheEntryOptions().SetSlidingExpiration(TimeSpan.FromMinutes(60)));
                                    //}
                                }

                                result.tipoLavorazione = kitResult!.tipoLavorazione;

                                if (kitResult.error != null && kitResult.error != "")
                                {
                                    result.error = kitResult.error;
                                    error_report += $"{result.error}\n";
                                    this._cache.Remove(kitCacheId);
                                }
                                else
                                {
                                    //Qui decido adesso cosa far vedere
                                    //kitResult.records //QUI HO TUTTO

                                    result.records.AddRange(kitResult.records);


                                    result.esito = true;
                                }

                            }
                            catch (Exception exProKit)
                            {
                                error_report += $"{exProKit.ToString()}\n";
                            }
                        }


                        result.error = error_report;

                        //Console.WriteLine($"Step error report {error_report}");

                        if (result.error.Length > 0)
                        {
                            return Ok(result);
                        }

                        return Ok(result);
                    }
                    catch (Exception ex)
                    {
                        //Console.WriteLine($"Step error {ex.ToString()}");

                        result.error = "processaKit -> " + ex.ToString();
                        result.esito = false;
                        return Ok(result);
                    }
                }

            }

            result.error = "noLogin";
            return Ok(result);
        }

        public List<PromoTracciati> getTracciatiDelKit(Promo promo, FicoRuntimeKit kit)
        {
            var CombsETracciati = this.ctx2.PromoTracciatis.Where(w =>
                                w.IdPromo == promo.Id &&
                                (w.guidCanale == kit!.guidCanale || kit.guidCanale == null) &&
                                (w.guidArea == kit.guidArea || kit.guidArea == null) &&
                                (w.guidPV == kit.guidPV || kit.guidPV == null)
                            ).ToList();


            IstantaLib.Utility.Logger.Log($"Tracciati trovati {CombsETracciati.Count}");
            List<FicoContextField> promoContext = JsonConvert.DeserializeObject<List<FicoContextField>>(promo!.Context!)!;

            //Calcolo dei punteggi per KIT in base al filtro contesto
            var punteggioTracciati = CombsETracciati.Select(s => new
            {
                IdTracciato = s.Id,
                Context = JsonConvert.DeserializeObject<List<FicoContextField>>(s.Context!)
            });

            if (punteggioTracciati.Count() <= 0)
                throw new Exception("no tracciati found");

            //Console.WriteLine($"Step 4");

            Dictionary<int, int> scores = new Dictionary<int, int>();

            foreach (var tItemScore in punteggioTracciati)
            {
                if (kit!.filtroContesto != null && kit.filtroContesto.Count > 0)
                {
                    //Console.WriteLine($"Check filtro contesto kit: {JsonConvert.SerializeObject(kit!.filtroContesto)}");
                    if (checkFiltroContesto(promoContext, tItemScore.Context!, kit.filtroContesto))
                    {
                        //tItemScore.Punteggio += 1;
                        //IstantaLib.Utility.Logger.Log($"Punteggio Tracciato {tItemScore.IdTracciato}:1");
                        scores.Add(tItemScore.IdTracciato, 1);
                    }
                    else
                    {
                        //tItemScore.Punteggio -= 1;
                        //IstantaLib.Utility.Logger.Log($"Punteggio Tracciato {tItemScore.IdTracciato}:-1");
                        scores.Add(tItemScore.IdTracciato, -1);
                    }
                }
                else
                {
                    if (promoContext.Count + tItemScore.Context!.Count == 0)
                    {
                        //Il punteggio rimane a 0
                        //IstantaLib.Utility.Logger.Log($"Punteggio Tracciato {tItemScore.IdTracciato}:0 b");
                        scores.Add(tItemScore.IdTracciato, 0);
                    }
                    else
                    {
                        //IstantaLib.Utility.Logger.Log($"Punteggio Tracciato {tItemScore.IdTracciato}:-1 b");
                        scores.Add(tItemScore.IdTracciato, -1);
                    }
                }

            }

            int maxVal = scores.Max(m => m.Value);
            int[] idsTrVincitori = scores.Where(s => s.Value == maxVal).Select(s => s.Key).ToArray();
            return CombsETracciati.Where(tr => idsTrVincitori.Contains(tr.Id)).ToList();

        }

        [HttpGet]
        [Route("FicoProcess/svuotaMaterialeKitFP/{idKit}/{guidIdTipoExport}")]
        public async Task<IActionResult> svuotaMaterialeKitFP(int idKit, string guidIdTipoExport)
        {
            BoolResult result = new BoolResult();

            try
            {
                FICOAccessLevel acLevel = await getAccesslevel();

                if (acLevel != FICOAccessLevel.noSession)
                {
                    try
                    {
                        Int64 sw1 = 0;
                        Int64 sw2 = 0;

                        Stopwatch sw = new Stopwatch();

                        sw.Start();

                        //La chiamata è fatta localmente
                        Int16 session = Int16.Parse(SessionIstantaObject.GetSession(HttpContext != null ? HttpContext! : httpContextInRent!));
                        Utenti? me = this.ctx.Utentis.Where(w => w.Id == session).FirstOrDefault();
                        FICOLoginResponse loginFico = await FICOMiddleware.login(olUrl, me!, secretKey, olympusUserPolycy, this.ctx, httpClient);
                        if (loginFico.esito)
                        {

                            sw.Stop();
                            sw1 = sw.ElapsedMilliseconds;


                            sw.Start();



                            httpClient.DefaultRequestHeaders.Clear();
                            httpClient.DefaultRequestHeaders.Add("Authorization", "Bearer " + loginFico.publicKey);

                            sw.Stop();
                            sw2 = sw.ElapsedMilliseconds;

                            sw.Start();

                            string? guidId = this.ctx2.PromoLavorazionis.FirstOrDefault(pl => pl.Id == idKit)!.GuidId;

                            string url = $"{fpUrl}/clearAllFilesKitRuntime/{guidId}/{guidIdTipoExport}";
                            var response = await httpClient.DeleteAsync(url);
                            //var response = await hCli.PutAsync(url, content);

                            if (response.IsSuccessStatusCode)
                            {
                                result.Esito = true;
                            }
                            else
                            {
                                string fpError = await response.Content.ReadAsStringAsync();
                                result.error = "FP error: " + fpError;
                            }

                            sw.Stop();
                            sw2 = sw.ElapsedMilliseconds;
                        }
                    }
                    catch (Exception exProKit2)
                    {
                        result.error = "IS error: " + exProKit2.ToString();
                    }
                }


            }
            catch (Exception exProKit)
            {
                result.error = exProKit.ToString();
            }

            return Ok(result);
        }

        /// <summary>
        /// Istanta4 - manda a Correggo4 una copia del materiale destinato a Correggo,
        /// nella stessa forma in cui parte verso fidelity-promotion: il PDF e il meta
        /// gia' completo della sezione promo.
        /// Attiva solo se in configurazione esiste "correggo4:url"; se manca, non fa nulla.
        /// Volutamente non propaga eccezioni: al massimo non arriva la copia.
        /// </summary>
        private async Task inviaCopiaACorreggo4(string metaJson, byte[] pdf, string nomeFile, string guidKitRuntime)
        {
            string? urlCorreggo4 = config["correggo4:url"];
            if (string.IsNullOrWhiteSpace(urlCorreggo4))
                return;

            try
            {
                var hc = httpClientFactory.CreateClient();
                hc.Timeout = TimeSpan.FromSeconds(30);

                using var copia = new MultipartFormDataContent();
                var contenutoPdf = new ByteArrayContent(pdf);
                contenutoPdf.Headers.ContentType = MediaTypeHeaderValue.Parse("application/pdf");
                copia.Add(contenutoPdf, "file", nomeFile);
                copia.Add(new StringContent(metaJson, Encoding.UTF8, "application/json"), "meta");
                copia.Add(new StringContent(nomeFile ?? ""), "nomeFile");
                copia.Add(new StringContent(guidKitRuntime ?? ""), "guidKitRuntime");

                var esito = await hc.PostAsync(urlCorreggo4, copia);
                string risposta = await esito.Content.ReadAsStringAsync();
                Console.WriteLine($"[Correggo4] copia inviata a {urlCorreggo4}: {(int)esito.StatusCode} -> {risposta}");
            }
            catch (Exception exCopia)
            {
                Console.WriteLine("[Correggo4] copia non riuscita (ignorata): " + exCopia.Message);
            }
        }

        [HttpPost]
        [Route("FicoProcess/esportaMateriale")]
        public async Task<IActionResult> esportaMateriale([FromForm] FicoExportLavorazione request)
        {
            FicoExportLavorazioneResult result = new FicoExportLavorazioneResult();

            try
            {

                FICOAccessLevel acLevel = await getAccesslevel();

                if (acLevel != FICOAccessLevel.noSession)
                {
                    try
                    {
                        Int64 sw1 = 0;
                        Int64 sw2 = 0;

                        Stopwatch sw = new Stopwatch();

                        sw.Start();

                        //La chiamata è fatta localmente
                        Int16 session = Int16.Parse(SessionIstantaObject.GetSession(HttpContext != null ? HttpContext! : httpContextInRent!));
                        Utenti? me = this.ctx.Utentis.Where(w => w.Id == session).FirstOrDefault();
                        FICOLoginResponse loginFico = await FICOMiddleware.login(olUrl, me!, secretKey, olympusUserPolycy, this.ctx, httpClient);
                        if (loginFico.esito)
                        {

                            sw.Stop();
                            sw1 = sw.ElapsedMilliseconds;


                            sw.Start();

                            //Invio a FP
                            var form = new MultipartFormDataContent();

                            Stream str = request.file!.OpenReadStream();
                            byte[] arrBytes = new byte[str.Length];
                            str.ReadExactly(arrBytes, 0, (int)str.Length);


                            var fileContent = new ByteArrayContent(arrBytes);
                            fileContent.Headers.ContentType = MediaTypeHeaderValue.Parse("multipart/form-data");



                            form.Add(fileContent, "file", request.nomeFile!);

                            form.Add(new StringContent(request.nomeFile!), "nomeFile");
                            form.Add(new StringContent(request.guidKitRuntime!), "guidKitRuntime");
                            form.Add(new StringContent(request.tipoExport!), "tipoExport");
                            Console.WriteLine($"[EXPMAT] 1 ingresso: tipoExport={request.tipoExport} nomeFile=[{request.nomeFile}] guidKit={request.guidKitRuntime} metaNull={(request.meta == null)} metaLen={(request.meta == null ? -1 : request.meta.Length)} fileBytes={arrBytes.Length}");

                            //Console.WriteLine($"Meta da inviare per file: {request.nomeFile!}");
                            if (request.meta != null)
                            {

                                //Se si tratta di un export CORREGGO devo intervenire da CORE per mettere i dettagli della promo
                                TipoDiExport? tipoExportObj = SingletonConfiguration.DBTipiDiExport!.source.FirstOrDefault(te => te.guidID == request.tipoExport);
                                Console.WriteLine($"[EXPMAT] 2 tipoExportObj={(tipoExportObj == null ? "NULL" : tipoExportObj.codice)} (ramo {(tipoExportObj != null && tipoExportObj.codice == "CORREGGO" ? "CORREGGO" : "STANDARD")})");
                                //Console.WriteLine($"META: {request.meta} Tipo di EXP: {tipoExportObj!.codice}");
                                if (tipoExportObj!.codice == "CORREGGO")
                                {
                                    try
                                    {
                                        PacchettoCorreggoPerFP? pack = JsonConvert.DeserializeObject<PacchettoCorreggoPerFP>(request.meta);

                                        PromoLavorazioni? plItem = await this.ctx2.PromoLavorazionis.FirstOrDefaultAsync(g => g.GuidId == request.guidKitRuntime);
                                        Promo? pItem = await this.ctx2.Promos.FirstOrDefaultAsync(p => p.guidID == plItem!.GuidPromo);
                                        if (pItem != null)
                                        {
                                            Area? aItem = SingletonConfiguration.DBACPV!.aree.FirstOrDefault(a => a.guidID == plItem!.GuidArea);
                                            Canale? cItem = SingletonConfiguration.DBACPV.canali.FirstOrDefault(c => c.guidID == plItem!.GuidCanale);
                                            Correggo_Promo corrPromo = new Correggo_Promo(
                                                pItem.NomePromo,
                                                pItem.ValiditaDal!.Value,
                                                pItem.ValiditaAl!.Value,
                                                pItem.DataScadenza.Value,
                                                pItem.Context,
                                                cItem.sigla,
                                                aItem.sigla);

                                            //corrPromo.titolo = $"{cItem!.sigla}_{aItem!.sigla}_{pItem!.ValiditaDal!.Value.ToString("dd/MM/yy")}";
                                            corrPromo.classificatore = pItem.NomePromo;
                                            corrPromo.dataInizio = pItem.ValiditaDal.Value;
                                            corrPromo.dataFine = pItem!.ValiditaAl!.Value;
                                            corrPromo.dataScadenza = pItem!.DataScadenza!.Value;
                                            corrPromo.guidIdKitRuntime = plItem!.GuidId;
                                            corrPromo.guidIdPromo = plItem.GuidPromo;
                                            corrPromo.idLavorazioneIstanta = plItem.Id;

                                            pack!.promo = corrPromo;
                                        }
                                        string serializedContent = JsonConvert.SerializeObject(pack);
                                        form.Add(new StringContent(serializedContent, Encoding.UTF8, "application/json"), "meta");

                                        // Istanta4 - copia in parallelo verso Correggo4.
                                        // Si attiva solo se in appsettings esiste "correggo4:url".
                                        // Non puo' influenzare la pubblicazione vera: e' un
                                        // osservatore, non un anello della catena.
                                        await inviaCopiaACorreggo4(serializedContent, arrBytes, request.nomeFile!, request.guidKitRuntime!);
                                    }
                                    catch (Exception ex2)
                                    {
                                        throw new Exception($"Errore di parse meta :{ex2.ToString()}");
                                    }
                                }
                                else
                                {
                                    ArticoloInRevisioneKitResult kitResult = new ArticoloInRevisioneKitResult();
                                    kitResult.esito = true;
                                    kitResult.records = JsonConvert.DeserializeObject<List<ArticoloInKit>>(request.meta);

                                    httpClient.DefaultRequestHeaders.Clear();
                                    httpClient.DefaultRequestHeaders.Add("Authorization", "Bearer " + loginFico.publicKey);

                                    sw.Stop();
                                    sw2 = sw.ElapsedMilliseconds;

                                    sw.Start();

                                    string _df_Url = $"{fpUrl}/richiediConfigMapDatafields";

                                    Console.WriteLine($"Richiedo config fields {_df_Url}");

                                    var response_df = await httpClient.GetAsync(_df_Url);
                                    string _df_corpo = await response_df.Content.ReadAsStringAsync();
                                    Console.WriteLine($"[EXPMAT] 3 richiediConfigMapDatafields -> HTTP {(int)response_df.StatusCode} {response_df.StatusCode} | corpo: {(_df_corpo.Length > 900 ? _df_corpo.Substring(0, 900) + " ...[troncato]" : _df_corpo)}");
                                    if (response_df.IsSuccessStatusCode)
                                    {
                                        var contentResponse = await response_df.Content.ReadAsStringAsync();
                                        Console.WriteLine($"Risposta: {contentResponse}");
                                        List<string> dataFieldsRequest = JsonConvert.DeserializeObject<List<string>>(contentResponse)!;

                                        var resKitFp = componiInformazioniPerKitRuntimeFromFP(kitResult, dataFieldsRequest);
                                        if (!resKitFp.esito)
                                        {
                                            throw new Exception("FP componiInformazioniPerKitRuntimeFromFP error: " + resKitFp.errors + " -> " + (dataFieldsRequest != null ? String.Join(',', dataFieldsRequest) : " NO DF"));

                                        }
                                        //form.Add(new StringContent(request.meta, Encoding.UTF8, "application/json"), "meta");
                                        form.Add(new StringContent(JsonConvert.SerializeObject(resKitFp.results), Encoding.UTF8, "application/json"), "meta");
                                        Console.WriteLine($"[EXPMAT] 5 meta aggiunto al form (ramo standard), lunghezza {JsonConvert.SerializeObject(resKitFp.results).Length}");
                                    }
                                    else
                                    {
                                        string fpError = await response_df.Content.ReadAsStringAsync();
                                        result.error = "FP richiediConfigMapDatafields error: " + fpError;
                                        Console.WriteLine($"[EXPMAT] 4 ATTENZIONE configMap FALLITA: il campo meta NON verra aggiunto al form. {result.error}");
                                    }


                                }

                                //Dictionary<string, string> dictMeta = JsonConvert.DeserializeObject<Dictionary<string, string>>(request.meta)
                            }


                            httpClient.DefaultRequestHeaders.Clear();
                            httpClient.DefaultRequestHeaders.Add("Authorization", "Bearer " + loginFico.publicKey);

                            sw.Stop();
                            sw2 = sw.ElapsedMilliseconds;

                            sw.Start();

                            string url = $"{fpUrl}/invioMaterialeAdFP";
                            Console.WriteLine($"[EXPMAT] 6 campi nel form verso FP: {string.Join(", ", form.Select(c => (c.Headers.ContentDisposition == null || c.Headers.ContentDisposition.Name == null) ? "?" : c.Headers.ContentDisposition.Name.Trim(Convert.ToChar(34))))}");
                            if (!string.IsNullOrEmpty(result.error)) { Console.WriteLine($"[EXPMAT] 6b un errore era GIA presente prima dell'invio: {result.error}"); }
                            var response = await httpClient.PostAsync(url, form);
                            //var response = await hCli.PutAsync(url, content);

                            if (response.IsSuccessStatusCode)
                            {
                                result.esito = true;
                            }
                            else
                            {
                                string fpError = await response.Content.ReadAsStringAsync();
                                result.error = "FP error: " + fpError;
                            }

                            sw.Stop();
                            //sw2 = sw.ElapsedMilliseconds;
                        }
                    }
                    catch (Exception exProKit2)
                    {
                        Console.WriteLine($"Step error {exProKit2.ToString()}");
                        result.error = "IS error: " + exProKit2.ToString();
                    }
                }


            }
            catch (Exception exProKit)
            {
                result.error = exProKit.ToString();
            }

            return Ok(result);
        }


        private async Task<PreparazioneListaResult> processaKitDo(FicoRuntimeKit kit, List<PromoTracciati> tracciati, Promo pItem, List<Articoli> archivio_refs, List<ArticoliDescrizioni> archivio_descr_gruppo, int idLavorazione, FicoCombinazioneKitReadMode mode = FicoCombinazioneKitReadMode.Classic/*, bool confronto = false*/)
        {
            string keyCodiceRef = Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice;
            string keyFotoExtraAuto = Enum.GetName(AddestramentoRuoli.Foto) + "." + GLOBAL_VARIABLES.keyFotoExtraAuto;

            PreparazioneListaResult resultGlobale = new PreparazioneListaResult();
            try
            {
                resultGlobale.records = new List<ArticoloInKit>();

                List<FicoContextField> promoContext = (pItem.Context == null ? new List<FicoContextField>() : JsonConvert.DeserializeObject<List<FicoContextField>>(pItem.Context))!;

                Formato? objFormato = Utility.SingletonConfiguration.DBFORMATI!.source.Where(w => w.guidID == kit.guidFormato).FirstOrDefault();
                resultGlobale.tipoLavorazione = objFormato!.tipo;
                //IstantaController icItem = new IstantaController(this.connString, this.extarnalLibPath, this.extarnalSourcePath);
                string error_report = "";


                foreach (PromoTracciati tracciato in tracciati)
                {

                    Stopwatch swat = new Stopwatch();
                    swat.Start();

                    List<FicoContextField> tracciatoContext = (tracciato.Context == null ? new List<FicoContextField>() : JsonConvert.DeserializeObject<List<FicoContextField>>(tracciato.Context))!;

                    IstantaLib.Utility.Logger.Log($"Impacchetto tracciato");

                    PreparazioneListaResult resultPreparazione = await impacchettaTracciato(pItem, tracciato, archivio_refs, archivio_descr_gruppo, mode, objFormato.tipo, kit.declinazioni, objFormato);

                    if (resultPreparazione.error != null && resultPreparazione.error != "")
                    {
                        throw new Exception(resultPreparazione.error);
                    }

                    ////Console.WriteLine($"Impacchettamento records. Ci sono errori? {resultPreparazione.error}");
                    ///
                    var recTest = resultPreparazione.records.FirstOrDefault(r => r.recordInTracciato[keyCodiceRef].ToString() == "881763");

                    //Adesso è il momento di selezionare in base al FILTRO del kit
                    List<ArticoloInKit> recordsFiltrati = new List<ArticoloInKit>();
                    if (kit.filtro.Count == 0)
                        recordsFiltrati = resultPreparazione.records;

                    else
                    {
                        foreach (var itemPreparato in resultPreparazione.records)
                        {
                            if (checkFiltro(itemPreparato.recordInTracciato, kit.filtro))
                            {
                                recordsFiltrati.Add(itemPreparato);
                            }
                        }
                    }

                    //aggiorno la cache
                    archivio_descr_gruppo = resultPreparazione.archivio_descr_gruppo;
                    archivio_refs = resultPreparazione.archivio_refs;


                    //Aggiungo al contesto la sigla tracciato area/canale/pv
                    if (tracciatoContext.Count(tc => tc.nome_field == GLOBAL_VARIABLES_FICO.keyCanaleContext) == 0)
                        tracciatoContext.Add(new FicoContextField() { nome_field = GLOBAL_VARIABLES_FICO.keyCanaleContext, user_value = tracciato.guidCanale });
                    if (tracciatoContext.Count(tc => tc.nome_field == GLOBAL_VARIABLES_FICO.keyAreaContext) == 0)
                        tracciatoContext.Add(new FicoContextField() { nome_field = GLOBAL_VARIABLES_FICO.keyAreaContext, user_value = tracciato.guidArea });
                    if (tracciatoContext.Count(tc => tc.nome_field == GLOBAL_VARIABLES_FICO.keyPVContext) == 0 && tracciato.guidPV != null && tracciato.guidPV != "")
                        tracciatoContext.Add(new FicoContextField() { nome_field = GLOBAL_VARIABLES_FICO.keyPVContext, user_value = tracciato.guidPV });


                    swat.Stop();

                    swat.ToString();

                    swat = new Stopwatch();
                    swat.Start();

                    //Dictionary<string, object> objParams = new Dictionary<string, object>();
                    //objParams.Add("promoContext", promoContext);
                    //objParams.Add("tracciatoContext", tracciatoContext);
                    //objParams.Add("tracciato", recordsFiltrati);
                    //objParams.Add("kit", kit);
                    //objParams.Add("readMode", mode);
                    if (mode != FicoCombinazioneKitReadMode.OnlyMeta)
                    {
                        string agenziaFunc = "";

                        if (objFormato.tipo == TipoLavorazione.PoP)
                        {
                            agenziaFunc = "esportaPoP";

                        }
                        else if (objFormato.tipo == TipoLavorazione.Volantino)
                        {
                            agenziaFunc = "esportaVolantino";
                        }

                        Dictionary<string, bool> noRenderPerRef = new Dictionary<string, bool>();
                        Dictionary<string, List<RevisioneNoRenderFromIndd>> noRenderElementiPerGruppo = new Dictionary<string, List<RevisioneNoRenderFromIndd>>();

                        if (mode == FicoCombinazioneKitReadMode.Advanced)
                        {
                            var listeModificate = updateDatiFromMetaPromoLavorazioni(recordsFiltrati, idLavorazione, kit/*, confronto*/, noRenderPerRef, noRenderElementiPerGruppo);
                            recordsFiltrati = listeModificate;
                        }

                        IstantaLib.Utility.Logger.Log($"Espoorto con  logiche di agenzia");

                        TracciatoResultKit resultAgenzia = esportaConLogicheDiAgenzia(kit, promoContext, tracciatoContext, recordsFiltrati, mode, agenziaFunc);


                        if (resultAgenzia.errors != "")
                        {
                            error_report += resultAgenzia.errors;
                        }
                        else
                        {
                            foreach (var itemLista in resultAgenzia.liste)
                            {
                                //membriGruppoFoto esiste solo dopo l'export di agenzia: e' qui che
                                //l'opzione di rendering letta dai meta puo' essere applicata alle foto.
                                applicaNoRenderAiMembriGruppoFoto(itemLista.Records, noRenderPerRef);
                                applicaNoRenderAgliElementiDelBox(itemLista.Records, noRenderElementiPerGruppo);
                                resultGlobale.records.AddRange(itemLista.Records);
                            }

                            foreach (var itemLista in resultGlobale.records)
                            {
                                if (itemLista.recordInTracciato.ContainsKey(keyFotoExtraAuto) && (itemLista.recordInTracciato[keyFotoExtraAuto] as List<LogoBollo>)!.Count > 0)
                                {
                                    string codRef = itemLista.recordInTracciato[keyCodiceRef].ToString();

                                    var fotoEscluse = this.ctx.Articolis.Include(f => f.FotoEscluses).Where(f => f.Codice == codRef).FirstOrDefault()!.FotoEscluses;
                                    if (fotoEscluse!.Count > 0)
                                    {

                                        foreach (var logoBollo in (itemLista.recordInTracciato[keyFotoExtraAuto] as List<LogoBollo>)!)
                                        {

                                            if (fotoEscluse.Any(f => f.NomeReale == logoBollo.nome))
                                            {
                                                Console.WriteLine($"FicoProcess 2802 - Escludo foto {logoBollo.nome} per codice ref {codRef}");
                                                logoBollo.escluso = true;
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        if (resultGlobale.tipoLavorazione == TipoLavorazione.PoP)
                        {
                            //Filtro i tipi di export
                            foreach (TipoDiExportInKit expInKit in kit.tipiDiExportInKit)
                            {
                                if (expInKit.filtro != null && expInKit.filtro.Count > 0)
                                {
                                    List<ArticoloInKit> recordsFiltratiExport = new List<ArticoloInKit>();
                                    foreach (var itemLista in resultGlobale.records)
                                    {
                                        List<ArticoloInKitExportName> _artExpNames = (itemLista.recordInTracciato[GLOBAL_VARIABLES_FICO.keyFicoNames] as List<ArticoloInKitExportName>)!;

                                        ArticoloInKitExportName? expArtInKit = _artExpNames.FirstOrDefault(n => n.guidIdTipoExport == expInKit.tipoDiExportGuidID);

                                        if (expArtInKit != null)
                                        {
                                            if (!checkFiltro(itemLista.recordInTracciato, expInKit.filtro))
                                            {
                                                //Devo togliere quel tipoDiExport da questa prestazione
                                                _artExpNames.Remove(expArtInKit);
                                            }
                                        }

                                        if (itemLista.sottogruppo != null)
                                        {
                                            List<ArticoloInKitExportName> _artExpNamesSott = (itemLista.recordInTracciato[GLOBAL_VARIABLES_FICO.keyFicoNames] as List<ArticoloInKitExportName>)!;

                                            ArticoloInKitExportName? expArtInKitSott = _artExpNamesSott.FirstOrDefault(n => n.guidIdTipoExport == expInKit.tipoDiExportGuidID);

                                            if (expArtInKit != null)
                                            {
                                                if (!checkFiltro(itemLista.sottogruppo, expInKit.filtro))
                                                {
                                                    //Devo togliere quel tipoDiExport da questa prestazione
                                                    _artExpNamesSott.Remove(expArtInKitSott!);
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }

                    }
                    else
                    {
                        resultGlobale.records.AddRange(recordsFiltrati);
                    }


                    swat.Stop();

                    swat.ToString();

                }

                resultGlobale.archivio_descr_gruppo = archivio_descr_gruppo;
                resultGlobale.archivio_refs = archivio_refs;
                resultGlobale.error = error_report;

                return resultGlobale;
            }
            catch (Exception ex)
            {
                resultGlobale.error = ex.ToString();
                return resultGlobale;
            }
        }

        private List<Dictionary<string, object>> GetRecordsFirmaPluginPerRec(
    ArticoloInRevisione rec,
    List<ArticoloInRevisione> tRecordsJson,
    string keyCodice,
    string keyCodiceGruppo)
        {
            if (rec == null || rec.recordInTracciato == null)
            {
                return new List<Dictionary<string, object>>();
            }

            string codice = rec.recordInTracciato.ContainsKey(keyCodice)
                ? rec.recordInTracciato[keyCodice]?.ToString() ?? ""
                : "";

            string codiceGruppo = rec.recordInTracciato.ContainsKey(keyCodiceGruppo)
                ? rec.recordInTracciato[keyCodiceGruppo]?.ToString() ?? ""
                : "";

            if (string.IsNullOrWhiteSpace(codiceGruppo) || codiceGruppo == codice)
            {
                return new List<Dictionary<string, object>>
        {
            rec.recordInTracciato
        };
            }

            return tRecordsJson
                .Where(x =>
                    x.recordInTracciato != null &&
                    x.recordInTracciato.ContainsKey(keyCodiceGruppo) &&
                    string.Equals(
                        x.recordInTracciato[keyCodiceGruppo]?.ToString(),
                        codiceGruppo,
                        StringComparison.OrdinalIgnoreCase
                    ))
                .Select(x => x.recordInTracciato!)
                .ToList();
        }

        private async Task<PreparazioneListaResult> impacchettaTracciato(Promo pItem, PromoTracciati tItem, List<Articoli> archivio_refs, List<ArticoliDescrizioni> archivio_descr_gruppo, FicoCombinazioneKitReadMode mode, TipoLavorazione tipoLavorazione, List<FicoCombinazioniKitDeclinazione> declinazioni, Formato formato)
        {
            PreparazioneListaResult result = new PreparazioneListaResult();
            result.error = "";

            Stopwatch part1 = new Stopwatch();
            Stopwatch part2 = new Stopwatch();
            Stopwatch part3 = new Stopwatch();

            try
            {
                string descr1Key = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr1;
                string descr2Key = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr2;
                string descr3Key = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr3;
                string descr4Key = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr4;
                string descrInddKey = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescrIndd;
                string propCodScatto = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppo;
                string propCodSottoGruppo = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceSottogruppo;
                string keyFirmaRevisione = GLOBAL_VARIABLES.keyFirmaRevisione;


                string k_multiplex = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppoMultiplex;
                string k_codgruppo = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppo;
                string k_cod = Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice;


                MenaboController menaboController = new MenaboController(null, this.config, optionExternalLib, null, null, null, null, this.ficoConf, this._dbContextFactory, dbContextFactory2: this._dbContextFactory2);



                if (declinazioni != null)
                {
                    //Compilo i campi declinazione
                    //e aggiorno il source
                    foreach (FicoCombinazioniKitDeclinazione decItem in declinazioni)
                    {
                        foreach (FicoCombinazioniKitDeclinazioneProprieta decProp in decItem.proprieta)
                        {
                            try
                            {
                                decProp.chiaveCompilata = SingletonConfiguration.DbDeclinazioniKit!.source.FirstOrDefault(d => d.Id == decProp.idChiave)!.Codice;
                            }
                            catch (Exception exSilenzioso)
                            {
                                Console.WriteLine($"[catch muto] FicoProcessController.cs riga ~2966: {exSilenzioso.Message}");
                            }
                        }
                    }

                    //SingletonConfiguration.DbDeclinazioniKit!.SaveChanges();
                }



                //Scarico tutti i dati json di tutti gli articoli in tracciato
                //Ricreo il contesto perchè l'autoselezione ha salvato nuove info
                this.ctx2 = this._dbContextFactory2.CreateDbContext();

                var tRecordsDb = this.ctx2.PromoTracciatiRecords
    .Include(r => r.IdTracciatoNavigation)
    .Where(t => t.IdTracciato == tItem.Id)
    .ToList();

                //            var tRecordsJson = tRecordsDb
                //.Select(t => new ArticoloInRevisione
                //{
                //    idRec = t.Id,
                //    label = t.Label,
                //    Versione = t.Versione,
                //    recordInTracciato = Utility.Main.getJsonObject(t.Dato!),
                //    promo = pItem,
                //    promoTracciati = tItem,
                //    formato = formato
                //})
                //.ToList();

                var tRecordsJson = tRecordsDb
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
                            promo = pItem,
                            promoTracciati = tItem,
                            formato = formato
                        };
                    })
                    .ToList();

                //var tRecordsJson = this.ctx2.PromoTracciatiRecords.Where(t => t.IdTracciato == tItem.Id)
                //.Select(t => new ArticoloInRevisione
                //{
                //    //statoSelezione = t.SelezioneMenabo,
                //    idRec = t.Id,
                //    label = t.Label,
                //    Versione = t.Versione,
                //    recordInTracciato = Utility.Main.getJsonObject(t.Dato!),
                //    promo = pItem,
                //    promoTracciati = tItem,
                //    formato = formato
                //}).ToList();

                if (mode != FicoCombinazioneKitReadMode.OnlyMeta)
                {
                    //Da capire bene cosa si intende per CLASSIC e ADVANCED adesso
                    if (mode != FicoCombinazioneKitReadMode.Host)
                    {
                        IstantaController icItem = new IstantaController(this.connString, this.extarnalLibPath, this.extarnalSourcePath, this._dbContextFactory);

                        part1.Start();


                        var dbArticoliDescr = this.ctx.ArticoliDescrizionis;
                        var dbArticoliFoto = this.ctx.ArticoliFotos;


                        var lastVersTraccaitoByLabel = tRecordsJson.GroupBy(g => new { g.label, g.Versione }).Select(s => new
                        {
                            label = s.Key.label,
                            Versione = s.Key.Versione
                        }).ToList();

                        //Console.WriteLine("Impacchettamento info records");

                        //Creare collezione DECLINAZIONI da accodare
                        List<ArticoloInRevisione> recDeclinati = new List<ArticoloInRevisione>();

                        var hashFirmaTracciatoGruppi = new Dictionary<string, string>();

                        foreach (var rec in tRecordsJson)
                        {
                            rec.hasFoto = 0;
                            rec.isObsoleto = (lastVersTraccaitoByLabel.Where(lv => lv.label == rec.label).Max(num => num.Versione) == rec.Versione) ? false : true;



                            string? _cod = rec.recordInTracciato![k_cod].ToString();
                            string? _codGruppo = rec.recordInTracciato[k_codgruppo].ToString();

                            //Controllo se è già stato scaricato nel processo massivo di preparazione tracciati
                            //if (_cod == "6050479")
                            //{
                            //    Debug.WriteLine("");
                            //}
                            //if (_cod != _codGruppo)
                            //{
                            //    string hash = "";

                            //    if (!hashFirmaTracciatoGruppi.ContainsKey(_codGruppo))
                            //    {
                            //        var itemGruppo = tRecordsJson!.Where(t => t.recordInTracciato[Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppo].ToString() == _codGruppo).ToList()!;
                            //        var _membriGruppo = itemGruppo.Select(s => s.recordInTracciato).ToList();
                            //        hash = Utility.Main.getFirmaTracciatoGruppo(_membriGruppo);
                            //        hashFirmaTracciatoGruppi[_codGruppo] = hash;
                            //    }
                            //    else
                            //    {
                            //        hash = hashFirmaTracciatoGruppi[_codGruppo];
                            //    }

                            //    rec.recordInTracciato[Enum.GetName(AddestramentoRuoli.Tracciato) + "." + GLOBAL_VARIABLES.keyTracciatoFirma] = hash;
                            //}

                            if (_cod != _codGruppo)
                            {
                                if (!hashFirmaTracciatoGruppi.TryGetValue(_codGruppo, out var hash))
                                {
                                    var recordsGruppo = tRecordsDb
                                        .Where(r => r.CodiceGruppo == _codGruppo)
                                        .ToList();

                                    hash = Utility.Main.getFirmaTracciatoGruppoDaRecords(
                                        recordsGruppo,
                                        _codGruppo,
                                        false
                                    );

                                    hashFirmaTracciatoGruppi[_codGruppo] = hash;
                                }

                                rec.recordInTracciato[Enum.GetName(AddestramentoRuoli.Tracciato) + "." + GLOBAL_VARIABLES.keyTracciatoFirma] = hash;
                            }

                            if (archivio_refs.Where(a => a.Codice == _cod).Count() <= 0)
                            {
                                //Lo scarico dal contesto per potercelo avere sempre a disposizione in locale
                                var _art = this.ctx.Articolis.Where(a => a.Codice == _cod).Select(s => new { Id = s.Id, Codice = s.Codice }).FirstOrDefault();
                                if (_art != null)
                                {
                                    //Se o trovo recupero tutte le sue descrizioni e la foto
                                    Articoli art = new Articoli();

                                    art.Id = _art.Id;
                                    art.Codice = _art.Codice;
                                    List<ArticoliDescrizioni> descrList = dbArticoliDescr.Where(d => d.IdArticolo == _art.Id).ToList();

                                    if (descrList.Count > 0)
                                    {
                                        art.ArticoliDescrizionis = descrList;
                                    }

                                    List<ArticoliFoto> foto = dbArticoliFoto.Where(d => d.IdArticolo == _art.Id && d.Tipo == (Byte)TipoFoto.Foto && d.Attiva == true).OrderByDescending(o => o.DataModifica).ToList();
                                    List<ArticoliFoto> fotoExtra = dbArticoliFoto.Where(d => d.IdArticolo == _art.Id && d.Tipo != (Byte)TipoFoto.Foto).ToList();
                                    if (foto != null && foto.Count > 0)
                                    {
                                        foreach (var item in foto)
                                        {
                                            art.ArticoliFotos!.Add(item);
                                        }

                                    }
                                    if (fotoExtra != null && fotoExtra.Count > 0)
                                    {
                                        art.ArticoliFotos = (art.ArticoliFotos ?? Enumerable.Empty<ArticoliFoto>())
                                            .Concat(fotoExtra)
                                            .ToList();
                                    }


                                    archivio_refs.Add(art);
                                }

                            }

                            List<ArticoliDescrizioni> lista_descrGruppo = new List<ArticoliDescrizioni>();// archivio_descr_gruppo.Where(g => g.CodiceGruppo == _codGruppo).OrderByDescending(o => o.DataUltimaRicezione).ToList();

                            if (tipoLavorazione == TipoLavorazione.PoP)
                            {
                                if (rec.recordInTracciato.ContainsKey(propCodSottoGruppo))
                                {
                                    string? _codSottoGruppo = rec.recordInTracciato[propCodSottoGruppo].ToString();
                                    if (_codSottoGruppo != "")
                                        _codGruppo = _codSottoGruppo;
                                }
                            }

                            if (archivio_descr_gruppo.Count(c => c.CodiceGruppo == _codGruppo) <= 0)
                            {
                                //Scarico tutte le revisioni di questo gruppo per avercelo sempre a disposizione in locale
                                lista_descrGruppo = dbArticoliDescr.Where(g => g.CodiceGruppo == _codGruppo).OrderByDescending(o => o.DataUltimaRicezione).ToList();

                                if (lista_descrGruppo.Count > 0)
                                {
                                    archivio_descr_gruppo.AddRange(lista_descrGruppo);
                                }

                            }

                            //Preparazione del singolo
                            Articoli? artItem = archivio_refs.Where(a => a.Codice == rec.recordInTracciato[k_cod].ToString()).FirstOrDefault();
                            //Articoli? artItem =            .Where(a => a.Codice == rec.recordInTracciato[k_cod].ToString()).FirstOrDefault();

                            //Console.WriteLine("Impacchetto record " + artItem.Codice);

                            try
                            {
                                ArticoloInRevisione revResult = impacchettaInfoRecord(rec, artItem!, tRecordsJson, tItem, archivio_descr_gruppo, tipoLavorazione);
                                rec.recordInTracciato = revResult.recordInTracciato;
                                rec.recordRevisionato = revResult.recordRevisionato;
                                rec.hasFoto = revResult.hasFoto;


                                if (revResult.recordRevisionato != null)
                                {
                                    rec.recordInTracciato![keyFirmaRevisione] = revResult.recordRevisionato.FirmaTracciato != null ? 
                                        revResult.recordRevisionato.FirmaTracciato : 
                                        ((_codGruppo != _cod) ? GLOBAL_VARIABLES.keyFirmaFiduciaria : "");
                                }
                                else
                                {
                                    rec.recordInTracciato![keyFirmaRevisione] = "";
                                }

                            }
                            catch (Exception ex)
                            {
                                //Console.WriteLine(ex.ToString());
                                ex.ToString();
                                rec.recordInTracciato![keyFirmaRevisione] = "";
                                break;
                            }
                            //Duplico il record per ogni declinazione
                            //Lo faccio qui MA ovviamente è da valutare a chi livello è bene che entri
                            //Prima lo duplichiamo e più sforzo di computazione c'è
                            //A rigor di logica le declinazioni cambiano solo nella parte che va da etichettatura in poi
                            //Quindi per ora lasciamolo qui
                            if (tipoLavorazione == TipoLavorazione.PoP && declinazioni != null && declinazioni.Count > 0)
                            {
                                foreach (FicoCombinazioniKitDeclinazione dec in declinazioni)
                                {
                                    if (checkFiltro(rec.recordInTracciato, dec.filtri))
                                    {
                                        if (!rec.recordInTracciato.ContainsKey(GLOBAL_VARIABLES_FICO.keyKitDeclinazioni))
                                            rec.recordInTracciato[GLOBAL_VARIABLES_FICO.keyKitDeclinazioni] = new List<FicoDeclinazioneKitRuntime>();

                                        (rec.recordInTracciato[GLOBAL_VARIABLES_FICO.keyKitDeclinazioni] as List<FicoDeclinazioneKitRuntime>).Add(new FicoDeclinazioneKitRuntime()
                                        {
                                            Nome = dec.titolo,
                                            Proprieta = dec.proprieta
                                        });
                                    }
                                }
                            }

                        }

                        var batchFirmaPlugin = new WrapperBatchCheckFirmaPlugin();
                        var recordsPerFirmaPlugin = new Dictionary<string, ArticoloInRevisione>();

                        foreach (var rec in tRecordsJson)
                        {
                            if (rec == null || rec.recordInTracciato == null)
                            {
                                continue;
                            }

                            if (rec.recordRevisionato == null)
                            {
                                continue;
                            }

                            string meta = rec.recordRevisionato.Meta ?? "";
                            string firmaRevisione = "";

                            if (rec.recordInTracciato.ContainsKey(keyFirmaRevisione) &&
                                rec.recordInTracciato[keyFirmaRevisione] != null)
                            {
                                firmaRevisione = rec.recordInTracciato[keyFirmaRevisione].ToString() ?? "";
                            }

                            // Serve sia il meta sia una firma revisione.
                            if (string.IsNullOrWhiteSpace(meta) || string.IsNullOrWhiteSpace(firmaRevisione))
                            {
                                continue;
                            }

                            string key = rec.idRec.HasValue
                                ? rec.idRec.Value.ToString()
                                : Guid.NewGuid().ToString();

                            recordsPerFirmaPlugin[key] = rec;

                            batchFirmaPlugin.items.Add(new WrapperItemCheckFirmaPlugin
                            {
                                key = key,
                                meta = meta,

                                // Plugin: il garante è il record che stiamo leggendo.
                                // Per un singolo è una lista da 1.
                                recordsGruppo = GetRecordsFirmaPluginPerRec(
                                    rec,
                                    tRecordsJson,
                                    k_cod,
                                    k_codgruppo
                                )
                            });
                        }

                        if (batchFirmaPlugin.items.Count > 0)
                        {
                            Dictionary<string, object> passFirmaPlugin = new Dictionary<string, object>();
                            passFirmaPlugin["batch"] = batchFirmaPlugin;

                            string resultJsonFirmaPlugin = icItem.execLibFunction(
                                $"AgenziaLib.{this.ficoConf.Value.nomeCliente}.CheckFirmaPluginGarantitaBatch",
                                passFirmaPlugin
                            ) as string;

                            var resultFirmaPlugin = !string.IsNullOrWhiteSpace(resultJsonFirmaPlugin)
                                ? JsonConvert.DeserializeObject<RitornoBatchCheckFirmaPlugin>(resultJsonFirmaPlugin)
                                : null;

                            if (resultFirmaPlugin != null && resultFirmaPlugin.items != null)
                            {
                                foreach (var item in resultFirmaPlugin.items)
                                {
                                    if (item == null || string.IsNullOrWhiteSpace(item.key))
                                    {
                                        continue;
                                    }

                                    if (!item.firmaGarantita)
                                    {
                                        continue;
                                    }

                                    if (!recordsPerFirmaPlugin.TryGetValue(item.key, out var rec))
                                    {
                                        continue;
                                    }

                                    rec.recordInTracciato["FirmaPluginGarantita"] =
                                        item.siglaTracciatoFirmaGarantita ?? "";
                                }
                            }
                        }

                        //Fare AddRange delle DECLINAZIONI
                        if (recDeclinati.Count > 0)
                            tRecordsJson.AddRange(recDeclinati);


                        part1.Stop();
                        part1.ToString();

                        part2.Start();

                        ////Console.WriteLine("Preparazione etichettatura");
                        //Attuo l'etichettatura
                        tRecordsJson = menaboController.Etichettatura(tRecordsJson);

                        part2.Stop();

                        part2.ToString();

                        part3.Start();
                        ////Console.WriteLine("Etichettatura records");
                        tRecordsJson = etichettaRecords(tRecordsJson, menaboController);

                        part3.Stop();

                        part3.ToString();


                    }
                    else
                    {
                        //Sono HOST, per la NAMING CONVENTION potrebbero servire info vitali ad AgenziaLib per tirarmi fuori il nome file?
                        //Qui è tutto da scoprire, altrimenti così com'è adesso rimane come OnlyMeta
                    }



                    //Eseguo selezione di primarie e secondarie
                    var selezioneAutomaticaResult = await Utility.Selezionatore.selezioneAutomaticaRefInMenabo(tRecordsJson, ctx2, ficoConf.Value.nomeCliente, this.extarnalLibPath, true);//Deve essere passsato come parametro
                    if (selezioneAutomaticaResult is BoolResult)
                    {
                        var okResult = selezioneAutomaticaResult as BoolResult;
                        if (okResult.Esito == false)
                        {
                            throw new Exception("Fallimento durante la selezione automatica di primarie/secondarie: " + okResult.error);
                        }
                    }


                }

                //tracciatiSingoliDict = menaboController.ordinaRecordsTracciato(tRecordsJson.Select(s=>s.recordInTracciato).ToList());


                result = new PreparazioneListaResult()
                {
                    records = tRecordsJson.Where(f => !f.isObsoleto).Select(s => new ArticoloInKit()
                    {
                        IdRec = s.idRec!.Value,
                        recordInTracciato = s.recordInTracciato,
                        allEtichette = s.allEtichette,
                        etichetteVisual = s.etichetteVisual,
                        label = s.label
                    }).ToList(),
                    archivio_descr_gruppo = archivio_descr_gruppo,
                    archivio_refs = archivio_refs
                };
            }
            catch (Exception ex)
            {
                //Console.WriteLine(ex.ToString());
                result.error = ex.ToString();
            }

            return result;
        }

        public ArticoloInRevisione impacchettaInfoRecord(ArticoloInRevisione rec, Articoli artItem, List<ArticoloInRevisione> tRecordsJson, PromoTracciati tItem, List<ArticoliDescrizioni> archivio_descr_gruppo, TipoLavorazione tipoLavorazione, DatiRegionali? richiestaDatiReg = null)
        {
            string descr1Key = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr1;
            string descr2Key = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr2;
            string descr3Key = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr3;
            string descr4Key = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr4;
            string descrInddKey = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescrIndd;
            //string propCodScatto = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppo;
            string k_codgruppo = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppo;
            string propCodSottoGruppo = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceSottogruppo;

            string keyDescrizioneRegionale = GLOBAL_VARIABLES.keyDescrizioneRegionale;
            string keyDescrizioneCanale = GLOBAL_VARIABLES.keyDescrizioneCanale;
            string keyDescrizioneCustom = GLOBAL_VARIABLES.keyDescrizioneCustom;



            string k_multiplex = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppoMultiplex;
            string k_cod = Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice;

            string? _cod = rec.recordInTracciato![k_cod].ToString();

            if (_cod == "2617525")
                "break".ToString();

            if (artItem != null)
            {
                ////Console.WriteLine("---> Step 1 descr");
                //Scrittura della revisione singola
                if (artItem.ArticoliDescrizionis!.Count > 0)
                {
                    rec = getDescrizione(artItem.ArticoliDescrizionis.OrderByDescending(o => o.DataUltimaRicezione).ToList(), rec, null, richiestaDatiReg!, tItem);
                }

                //Scrittura della foto

                string _key_foto = Enum.GetName(AddestramentoRuoli.Foto) + "." + GLOBAL_VARIABLES.keyFotoNome;
                string keyGuidFoto = Enum.GetName(AddestramentoRuoli.Foto) + "." + GLOBAL_VARIABLES.keyFotoGuidId;
                string keyIdFoto = Enum.GetName(AddestramentoRuoli.Foto) + "." + GLOBAL_VARIABLES.keyId;


                ////Console.WriteLine("---> Step 2 foto");
                //Metto la chiave della FOTO del prodotto

                //Controlliamo prima se il dato d addestramento espone il campo foto selezionata da lista
                if (rec.recordInTracciato!.ContainsKey(GLOBAL_VARIABLES_FICO.keyFotoSelezioeDaTracciato))
                {
                    //A prescindere da come andrà la foto è quella indicata da tracciato e per chiave dichiarata MI FIDO del tracciato
                    string? nomeFotoSelezionata = rec.recordInTracciato[GLOBAL_VARIABLES_FICO.keyFotoSelezioeDaTracciato].ToString();
                    FileInfo finfo_foto = new FileInfo(nomeFotoSelezionata!);
                    string nomeSenzaEstensione = finfo_foto.Name.Replace(finfo_foto.Extension, "") + ".";
                    //string[] ext_post_produzione = this.syncOptions.Value.extPostLavorazione;
                    //string[] ext_grezzi = this.syncOptions.Value.extPreLavorazione;
                    ArticoliFoto? artFotoSelezionatoDaLista = this.ctx.ArticoliFotos.Where(f => f.IdArticolo == artItem.Id && f.NomeReale.Contains(nomeSenzaEstensione))/* NULL-ORDER 7/9/2026: su PostgreSQL i NULL vengono PRIMA in ORDER BY DESC, su SQL Server dopo. Senza HasValue una foto con data_modifica vuota risulterebbe "la piu recente" e finirebbe nel volantino al posto di quella giusta. Vedi migrazione-mssql-postgres.md §12. */ .OrderByDescending(o => o.DataModifica.HasValue).ThenByDescending(o => o.DataModifica).FirstOrDefault();
                    if (artFotoSelezionatoDaLista != null)
                    {
                        rec.recordInTracciato[_key_foto] = artFotoSelezionatoDaLista.NomeReale;
                        rec.recordInTracciato[keyGuidFoto] = artFotoSelezionatoDaLista.GuidId;
                        rec.recordInTracciato[keyIdFoto] = artFotoSelezionatoDaLista.Id;
                        rec.hasFoto = 1;
                    }
                    else
                    {
                        rec.recordInTracciato[_key_foto] = "";
                        rec.recordInTracciato[keyGuidFoto] = "";
                        rec.recordInTracciato[keyIdFoto] = 0;
                    }
                }
                else
                {
                    rec = getFoto(artItem.ArticoliFotos!.Where(f => !f.Tipo.HasValue || f.Tipo == (Byte)TipoFoto.Foto).OrderByDescending(o => o.DataModifica).ToList(), rec, richiestaDatiReg, tItem);

                    //ArticoliFoto? af = artItem.ArticoliFotos!.Where(f => !f.Tipo.HasValue || f.Tipo == (Byte)TipoFoto.Foto).OrderByDescending(o => o.DataModifica).FirstOrDefault();
                    //if (af != null)
                    //{
                    //    //ATTENZIONE: controlliamo che qui non incida sul db realmente
                    //    rec.recordInTracciato[_key_foto] = af.NomeReale;
                    //    rec.recordInTracciato[keyGuidFoto] = af.GuidId;
                    //    rec.hasFoto = 1;
                    //}
                    //else
                    //{
                    //    //In ottica di Olympus io posso anche mettere un NOFOTO.psd vero da Photoshop, non mi serve di nasconderlo dietro ad un <codart>.psd fittizio
                    //    //Ad ognimodo è un haking che preferirei fare lato InDesign rinominandolo da li come foto con codice come nome
                    //    rec.recordInTracciato[_key_foto] = "";//artItem.Codice + ".psd";
                    //    rec.recordInTracciato[keyGuidFoto] = "";
                    //}
                }

                //Metto tutte le altre foto NON del prodotto
                var fotoExtra = artItem.ArticoliFotos!.Where(f => f.Tipo.HasValue && f.Tipo != (Byte)TipoFoto.Foto).OrderByDescending(o => o.DataModifica).Select(s => new LogoBollo_ExtraNoAuto
                {
                    id = s.Id,
                    nome = s.NomeReale,
                    area = s.Area,
                    canale = s.Canale,
                    guidId = s.GuidId,
                    tipo = s.Tipo!.Value,
                    attiva = s.Attiva!.Value,
                    statoSelezione = (s.StatoSelezione.HasValue ? s.StatoSelezione.Value : (Byte)StatoSelezioneFoto.NonSelezionata),
                    puntatore = s.Puntatore
                }).ToList();

                if (tItem != null)
                {
                    var tItemCanale = tItem.Canale;
                    var tItemArea = tItem.Area;
                    fotoExtra.RemoveAll(f => f.canale != null && f.canale != tItemCanale);
                    fotoExtra.RemoveAll(f => f.area != null && f.area != tItemArea);
                }


                fotoExtra.RemoveAll(foto =>
                {
                    if (!foto.puntatore)
                        return false;

                    var logoBolloResult = SyncFotoController.getLogoBolloByGuidId(foto.guidId);

                    if (logoBolloResult == null || !logoBolloResult.esito)
                        return true; // rimuovi

                    foto.sigla = logoBolloResult.item.sigla;
                    foto.nome = logoBolloResult.item.nome;

                    return false;
                });

                rec.recordInTracciato[Enum.GetName(AddestramentoRuoli.Foto) + "." + GLOBAL_VARIABLES.keyFotoExtra] = fotoExtra;

            }
            else
            {
                //Se non trovo il singolo, non ha ragion di esistere il resto
                //continue;
                //"continue".ToString();
            }


            //Controllo se è parte di un gruppo
            //Per procedere anche con le selezioni

            string? _codGruppo = rec.recordInTracciato[k_codgruppo].ToString();


            if (_cod != _codGruppo)
            {
                rec.isGruppo = true;

                //Preparazione del gruppo
                ////Console.WriteLine("---> Step 3 gruppo");

                //Se siamo in lavorazione PoP prima devo controllare se la ref ha un sottogruppo
                List<ArticoloInRevisione>? itemsGruppo = null;

                string? _codSottoGruppo = "";
                if (rec.recordInTracciato.ContainsKey(propCodSottoGruppo))
                    _codSottoGruppo = rec.recordInTracciato[propCodSottoGruppo].ToString();

                if (tipoLavorazione == TipoLavorazione.PoP && _codSottoGruppo != "")
                {
                    itemsGruppo = tRecordsJson.Where(r => r.recordInTracciato!.ContainsKey(propCodSottoGruppo) && r.recordInTracciato[propCodSottoGruppo].ToString() == _codSottoGruppo).ToList();
                    _codGruppo = _codSottoGruppo;

                }
                else
                {
                    itemsGruppo = tRecordsJson.Where(r => r.recordInTracciato![k_codgruppo].ToString() == _codGruppo).ToList();
                }

                List<ArticoliDescrizioni> lista_descrGruppo = archivio_descr_gruppo.Where(g => g.CodiceGruppo == _codGruppo).OrderByDescending(o => o.DataUltimaRicezione).ToList();

                //Dictionary<string, object> dictDescrGruppo = null;

                ////Console.WriteLine("---> Step 4 descr gruppo " + _codGruppo);
                if (tipoLavorazione == TipoLavorazione.PoP && _codSottoGruppo == "")
                {
                    //Se siamo in PoP e il cod gruppo di questa ref NON è specificato, signifcia che tale ref vuole essere trattata come singolo anche se 
                    //appartenente ad un gruppo.
                    //Per questa ragione NON deve essere soggetta a controllo di revisione gruppo
                }
                else
                {
                    if (lista_descrGruppo.Count > 0)
                    {
                        rec = getDescrizione(lista_descrGruppo, rec, itemsGruppo, richiestaDatiReg, tItem);
                    }
                    else
                    {
                        //Esce come gruppo e di sicuro se sono qui NON è stato revisionato
                        rec.recordRevisionato = null;
                    }
                }

            }
            else
            {
                //E' un singolo prodotto, è per forza primario
                rec.recordInTracciato[GLOBAL_VARIABLES.keyXMLSelezione] = (Byte)TipoSelezioneMenabo.Primaria;
            }

            //if (!rec.recordInTracciato.ContainsKey(GLOBAL_VARIABLES_FICO.keyVersioneTracciato))
            //{
            //    rec.recordInTracciato[GLOBAL_VARIABLES_FICO.keyVersioneTracciato] = rec.Versione;
            //    rec.recordInTracciato[GLOBAL_VARIABLES_FICO.keyXlsxTracciato] = tItem.IdImportazioneNavigation != null ? tItem.IdImportazioneNavigation.NomeFile : "";
            //}
            rec.recordInTracciato[GLOBAL_VARIABLES_FICO.keyLabel] = rec.label;

            return rec;


        }

        public ArticoloInRevisione getDescrizione(List<ArticoliDescrizioni> artDescrList, ArticoloInRevisione rec, List<ArticoloInRevisione>? itemsGruppo, DatiRegionali? richiestaDescrReg = null, PromoTracciati? tItem = null)
        {
            ////Console.WriteLine("### -> getDesccrizioen step1");

            ////Console.WriteLine("### -> getDesccrizioen step2");

            string keyDescrizioneRegionale = GLOBAL_VARIABLES.keyDescrizioneRegionale;
            string keyDescrizioneCanale = GLOBAL_VARIABLES.keyDescrizioneCanale;
            string keyDescrizioneCustom = GLOBAL_VARIABLES.keyDescrizioneCustom;
            string descr1Key = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr1;
            string descr2Key = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr2;
            string descr3Key = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr3;
            string descr4Key = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr4;
            string descrInddKey = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescrIndd;
            string k_codgruppo = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppo;
            string propCodSottoGruppo = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceSottogruppo;

            ArticoliDescrizioni naz = null;

            if (artDescrList != null && artDescrList.Count > 0)
            {
                naz = artDescrList.Find(f => f.Area == null && f.Canale == null && f.Custom != null);
                if (naz == null)
                {
                    naz = artDescrList.Find(f => f.Area == null && f.Canale == null && f.Custom == null);
                }
                rec.recordRevisionato = naz;
            }

            ////Console.WriteLine("### -> getDesccrizioen step3");

            ArticoliDescrizioni? artDescr;
            if (richiestaDescrReg != null)
            {
                artDescr = artDescrList!.Where(g => (g.Area == richiestaDescrReg.area || g.Area == null && richiestaDescrReg.area == null) && (g.Canale == richiestaDescrReg.canale || g.Canale == null && richiestaDescrReg.canale == null) && (g.Custom == richiestaDescrReg.custom || g.Custom == null && richiestaDescrReg.custom == null)).OrderByDescending(o => o.DataUltimaRicezione).FirstOrDefault();
                if (artDescr != null && richiestaDescrReg.area != null)
                {
                    rec.recordInTracciato![keyDescrizioneRegionale] = true;
                }
                else
                {
                    rec.recordInTracciato![keyDescrizioneRegionale] = false;
                }

                if (artDescr != null && richiestaDescrReg.canale != null)
                {
                    rec.recordInTracciato[keyDescrizioneCanale] = true;
                }
                else
                {
                    rec.recordInTracciato[keyDescrizioneCanale] = false;
                }

                if (artDescr != null && richiestaDescrReg.custom != null)
                {
                    rec.recordInTracciato[keyDescrizioneCustom] = true;
                }
                else
                {
                    rec.recordInTracciato[keyDescrizioneCustom] = false;
                }

                if (artDescr != null)
                {
                    rec.recordRevisionato = artDescr;
                }
            }
            else
            {
                ////Console.WriteLine("### -> getDesccrizioen step3_1");

                List<ArticoliDescrizioni> descrListPerCustom = new List<ArticoliDescrizioni>();
                //si prova una ricerca annidata a partire dal tracciato
                descrListPerCustom = artDescrList!.Where(g => g.Area == tItem!.Area && g.Canale == tItem.Canale && g.Custom != null).OrderByDescending(o => o.DataUltimaRicezione).ToList();
                if (descrListPerCustom.Count > 0)
                {
                    artDescr = descrListPerCustom[0];
                }
                else
                {
                    descrListPerCustom = artDescrList!.Where(g => g.Area == tItem!.Area && g.Canale == tItem.Canale && g.Custom == null).OrderByDescending(o => o.DataUltimaRicezione).ToList();

                    if (descrListPerCustom.Count > 0)
                    {
                        artDescr = descrListPerCustom[0];
                    }
                    else
                    {
                        artDescr = null;
                    }
                }

                ////Console.WriteLine("### -> getDesccrizioen step3_2");
                if (artDescr == null)
                {
                    //se siamo qui non esiste una corrispondenza per area/canale della descrizione
                    //proviamo solo per area poichè noi abbiamo deciso che avrà la precedenza sul solo canale
                    ////Console.WriteLine("### -> getDesccrizioen step3_3");
                    descrListPerCustom = artDescrList!.Where(g => g.Area == tItem!.Area && g.Canale == null && g.Custom != null).OrderByDescending(o => o.DataUltimaRicezione).ToList();
                    if (descrListPerCustom.Count > 0)
                    {
                        artDescr = descrListPerCustom[0];
                    }
                    else
                    {
                        descrListPerCustom = artDescrList!.Where(g => g.Area == tItem!.Area && g.Canale == null && g.Custom == null).OrderByDescending(o => o.DataUltimaRicezione).ToList();

                        if (descrListPerCustom.Count > 0)
                        {
                            artDescr = descrListPerCustom[0];
                        }
                        else
                        {
                            artDescr = null;
                        }
                    }
                    //artDescr = artItem.ArticoliDescrizionis.Where(g => g.Area == tItem.Area).OrderByDescending(o => o.DataUltimaRicezione).FirstOrDefault();
                    ////Console.WriteLine("### -> getDesccrizioen step3_4");
                    if (artDescr == null)
                    {
                        //proviamo a cercarla solo per canale
                        descrListPerCustom = artDescrList!.Where(g => g.Canale == tItem!.Canale && g.Area == null && g.Custom != null).OrderByDescending(o => o.DataUltimaRicezione).ToList();
                        if (descrListPerCustom.Count > 0)
                        {
                            artDescr = descrListPerCustom[0];
                        }
                        else
                        {
                            descrListPerCustom = artDescrList!.Where(g => g.Canale == tItem!.Canale && g.Area == null && g.Custom == null).OrderByDescending(o => o.DataUltimaRicezione).ToList();

                            if (descrListPerCustom.Count > 0)
                            {
                                artDescr = descrListPerCustom[0];
                            }
                            else
                            {
                                artDescr = null;
                            }
                        }

                        //artDescr = artItem.ArticoliDescrizionis.Where(g => g.Canale == tItem.Canale).OrderByDescending(o => o.DataUltimaRicezione).FirstOrDefault();
                        ////Console.WriteLine("### -> getDesccrizioen step3_5");
                        if (artDescr == null)
                        {
                            //usiamo la nazionale già impostata (Se esiste davvero)
                            artDescr = naz;// rec.recordRevisionato;
                            //artDescr = artItem.ArticoliDescrizionis.Where(g => g.Canale == null && g.Area == null).OrderByDescending(o => o.DataUltimaRicezione).FirstOrDefault();
                            rec.recordInTracciato![keyDescrizioneRegionale] = false;
                            rec.recordInTracciato[keyDescrizioneCanale] = false;
                            rec.recordInTracciato[keyDescrizioneCustom] = false;
                        }
                        else
                        {
                            rec.recordInTracciato![keyDescrizioneRegionale] = false;
                            rec.recordInTracciato[keyDescrizioneCanale] = true;
                            rec.recordInTracciato[keyDescrizioneCustom] = false;

                        }
                    }
                    else
                    {
                        rec.recordRevisionato = artDescr;
                        rec.recordInTracciato![keyDescrizioneRegionale] = true;
                        rec.recordInTracciato[keyDescrizioneCanale] = false;
                        rec.recordInTracciato[keyDescrizioneCustom] = false;

                    }
                }
                else
                {
                    rec.recordRevisionato = artDescr;
                    rec.recordInTracciato![keyDescrizioneRegionale] = true;
                    rec.recordInTracciato[keyDescrizioneCanale] = true;
                    rec.recordInTracciato[keyDescrizioneCustom] = false;

                }
            }



            //Salvo le descrizioni nelle chiavi relative Tracciato
            rec.recordInTracciato[Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr1Tracciato] = rec.recordInTracciato.ContainsKey(descr1Key) ? rec.recordInTracciato[descr1Key] : "";
            rec.recordInTracciato[Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr2Tracciato] = rec.recordInTracciato.ContainsKey(descr2Key) ? rec.recordInTracciato[descr2Key] : "";
            rec.recordInTracciato[Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr3Tracciato] = rec.recordInTracciato.ContainsKey(descr3Key) ? rec.recordInTracciato[descr3Key] : "";
            rec.recordInTracciato[Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr4Tracciato] = rec.recordInTracciato.ContainsKey(descr4Key) ? rec.recordInTracciato[descr4Key] : "";

            if (artDescr != null)
            {
                if (itemsGruppo == null || itemsGruppo.Count == 0)
                {

                    rec.recordInTracciato[descr1Key] = artDescr.Descrizione1!;
                    rec.recordInTracciato[descr2Key] = artDescr.Descrizione2!;
                    rec.recordInTracciato[descr3Key] = artDescr.Descrizione3!;
                    rec.recordInTracciato[descr4Key] = artDescr.Descrizione4!;

                    ////Console.WriteLine(rec.recordInTracciato[k_cod].ToString() + " . " +  descr2Key + " -> " + artDescr.Descrizione2);

                    if (artDescr.DescrizioneIndd != null)
                        rec.recordInTracciato[Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescrIndd] = artDescr.DescrizioneIndd;
                    if (artDescr.Peso != null)
                        rec.recordInTracciato[Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescrPeso] = artDescr.Peso.Value;
                    if (artDescr.Um != null)
                        rec.recordInTracciato[Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescrUm] = artDescr.Um;
                    if (artDescr.Extra != null)
                        rec.recordInTracciato[Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescrExtra] = JsonConvert.DeserializeObject<JObject>(artDescr.Extra)!;
                }
                else
                {
                    Dictionary<string, object> dictDescrGruppo = new Dictionary<string, object>();
                    dictDescrGruppo[descr1Key] = artDescr.Descrizione1!;
                    dictDescrGruppo[descr2Key] = artDescr.Descrizione2!;
                    dictDescrGruppo[descr3Key] = artDescr.Descrizione3!;
                    dictDescrGruppo[descr4Key] = artDescr.Descrizione4!;

                    ////Console.WriteLine(rec.recordInTracciato[k_cod].ToString() + " . " +  descr2Key + " -> " + artDescr.Descrizione2);

                    if (artDescr.DescrizioneIndd != null)
                        dictDescrGruppo[Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescrIndd] = artDescr.DescrizioneIndd;
                    if (artDescr.Peso != null)
                        dictDescrGruppo[Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescrPeso] = artDescr.Peso.Value;
                    if (artDescr.Um != null)
                        dictDescrGruppo[Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescrUm] = artDescr.Um;
                    if (artDescr.Extra != null)
                        dictDescrGruppo[Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescrExtra] = JsonConvert.DeserializeObject<JObject>(artDescr.Extra)!;
                    rec.recordInTracciato[GLOBAL_VARIABLES.keyXMLDescrizioneGruppo] = dictDescrGruppo;
                }

            }

            if (itemsGruppo != null)
            {

                foreach (var itemGruppo in itemsGruppo)
                {
                    Dictionary<string, object>? itemGruppoData = itemGruppo.recordInTracciato;

                    if (artDescr != null)
                    {
                        //Quando esce una descrizione di gruppo, propago le info PESO e UM su tutte le ref del gruppo
                        string kUmGruppo = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescrUmGruppo;
                        string kPesoGruppo = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescrPesoGruppo;
                        string kPeso = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescrPeso;
                        string kUm = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescrUm;
                        if (rec.recordInTracciato.ContainsKey(kPeso))
                            itemGruppoData![kPesoGruppo] = rec.recordInTracciato[kPeso];
                        if (rec.recordInTracciato.ContainsKey(kUm))
                            itemGruppoData![kUmGruppo] = rec.recordInTracciato[kUm];
                    }

                    //Console.WriteLine($"Imposto lo stato selezione di elemento del gruppo {itemGruppo.recordInTracciato[k_codgruppo].ToString()} a -> {itemGruppo.statoSelezione}");
                    //itemGruppoData[GLOBAL_VARIABLES.keyXMLSelezione] = itemGruppo.statoSelezione;
                }
            }


            return rec;
        }

        public ArticoloInRevisione getFoto(List<ArticoliFoto> artFotoList, ArticoloInRevisione rec, DatiRegionali? richiestaFotoReg = null, PromoTracciati? tItem = null)
        {

            string keyFotoRegionale = GLOBAL_VARIABLES.keyFotoRegionale;
            string keyFotoCanale = GLOBAL_VARIABLES.keyFotoCanale;
            string _key_foto = Enum.GetName(AddestramentoRuoli.Foto) + "." + GLOBAL_VARIABLES.keyFotoNome;
            string keyGuidFoto = Enum.GetName(AddestramentoRuoli.Foto) + "." + GLOBAL_VARIABLES.keyFotoGuidId;
            string keyHash = Enum.GetName(AddestramentoRuoli.Foto) + "." + GLOBAL_VARIABLES.keyFotoHash;
            string keyIdFoto = Enum.GetName(AddestramentoRuoli.Foto) + "." + GLOBAL_VARIABLES.keyId;

            ArticoliFoto? naz = null;

            if (artFotoList != null && artFotoList.Count > 0)
            {
                naz = artFotoList.Find(f => f.Area == null && f.Canale == null && f.Attiva == true);
                if (naz != null)
                {
                    rec.recordInTracciato[_key_foto] = naz.NomeReale;
                    rec.recordInTracciato[keyGuidFoto] = naz.GuidId;
                    rec.recordInTracciato[keyHash] = naz.Hash;
                    rec.recordInTracciato[keyIdFoto] = naz.Id;
                    rec.hasFoto = 1;
                }
                else
                {
                    rec.recordInTracciato[_key_foto] = "";
                    rec.recordInTracciato[keyGuidFoto] = "";
                    rec.recordInTracciato[keyHash] = "";
                    rec.recordInTracciato[keyIdFoto] = 0;
                    return rec;
                }
            }
            else
            {
                rec.recordInTracciato[_key_foto] = "";
                rec.recordInTracciato[keyGuidFoto] = "";
                rec.recordInTracciato[keyHash] = "";
                rec.recordInTracciato[keyIdFoto] = 0;
                return rec;
            }

            ////Console.WriteLine("### -> getDesccrizioen step3");

            ArticoliFoto? artFoto = null;
            if (richiestaFotoReg != null)
            {
                artFoto = artFotoList!.Where(g => (g.Area == richiestaFotoReg.area || g.Area == null && richiestaFotoReg.area == null) && (g.Canale == richiestaFotoReg.canale || g.Canale == null && richiestaFotoReg.canale == null)).OrderByDescending(o => o.DataModifica).FirstOrDefault();
                if (artFoto != null && richiestaFotoReg.area != null)
                {
                    rec.recordInTracciato![keyFotoRegionale] = true;
                }
                else
                {
                    rec.recordInTracciato![keyFotoRegionale] = false;
                }

                if (artFoto != null && richiestaFotoReg.canale != null)
                {
                    rec.recordInTracciato[keyFotoCanale] = true;
                }
                else
                {
                    rec.recordInTracciato[keyFotoCanale] = false;
                }

                if (artFoto != null)
                {
                    rec.recordInTracciato[_key_foto] = artFoto.NomeReale;
                    rec.recordInTracciato[keyGuidFoto] = artFoto.GuidId;
                    rec.recordInTracciato[keyHash] = artFoto.Hash;
                    rec.hasFoto = 1;
                }
            }
            else
            {

                List<ArticoliFoto> fotoListPerCustom = new List<ArticoliFoto>();
                //si prova una ricerca annidata a partire dal tracciato
                fotoListPerCustom = artFotoList!.Where(g => g.Area == tItem!.Area && g.Canale == tItem.Canale && g.Attiva == true).OrderByDescending(o => o.DataModifica).ToList();
                if (fotoListPerCustom.Count > 0)
                {
                    artFoto = fotoListPerCustom[0];
                }


                if (artFoto == null)
                {
                    //se siamo qui non esiste una corrispondenza per area/canale della foto
                    //proviamo solo per area poichè noi abbiamo deciso che avrà la precedenza sul solo canale
                    fotoListPerCustom = artFotoList!.Where(g => g.Area == tItem!.Area && g.Canale == null && g.Attiva == true).OrderByDescending(o => o.DataModifica).ToList();
                    if (fotoListPerCustom.Count > 0)
                    {
                        artFoto = fotoListPerCustom[0];
                    }

                    if (artFoto == null)
                    {
                        //proviamo a cercarla solo per canale
                        fotoListPerCustom = artFotoList!.Where(g => g.Canale == tItem!.Canale && g.Area == null && g.Attiva == true).OrderByDescending(o => o.DataModifica).ToList();
                        if (fotoListPerCustom.Count > 0)
                        {
                            artFoto = fotoListPerCustom[0];
                        }

                        if (artFoto == null)
                        {
                            //usiamo la nazionale già impostata (Se esiste davvero)
                            artFoto = naz;
                            rec.recordInTracciato[_key_foto] = artFoto.NomeReale;
                            rec.recordInTracciato[keyGuidFoto] = artFoto.GuidId;
                            rec.recordInTracciato[keyHash] = artFoto.Hash;
                            rec.hasFoto = 1;
                            rec.recordInTracciato[keyIdFoto] = artFoto.Id;

                            rec.recordInTracciato![keyFotoRegionale] = false;
                            rec.recordInTracciato[keyFotoCanale] = false;
                        }
                        else
                        {
                            rec.recordInTracciato[_key_foto] = artFoto.NomeReale;
                            rec.recordInTracciato[keyGuidFoto] = artFoto.GuidId;
                            rec.recordInTracciato[keyHash] = artFoto.Hash;
                            rec.hasFoto = 1;
                            rec.recordInTracciato[keyIdFoto] = artFoto.Id;

                            rec.recordInTracciato![keyFotoRegionale] = false;
                            rec.recordInTracciato[keyFotoCanale] = true;

                        }
                    }
                    else
                    {
                        rec.recordInTracciato[_key_foto] = artFoto.NomeReale;
                        rec.recordInTracciato[keyGuidFoto] = artFoto.GuidId;
                        rec.recordInTracciato[keyHash] = artFoto.Hash;
                        rec.hasFoto = 1;
                        rec.recordInTracciato[keyIdFoto] = artFoto.Id;

                        rec.recordInTracciato![keyFotoRegionale] = true;
                        rec.recordInTracciato[keyFotoCanale] = false;

                    }
                }
                else
                {
                    rec.recordInTracciato[_key_foto] = artFoto.NomeReale;
                    rec.recordInTracciato[keyGuidFoto] = artFoto.GuidId;
                    rec.recordInTracciato[keyHash] = artFoto.Hash;
                    rec.hasFoto = 1;
                    rec.recordInTracciato[keyIdFoto] = artFoto.Id;

                    rec.recordInTracciato![keyFotoRegionale] = true;
                    rec.recordInTracciato[keyFotoCanale] = true;
                }
            }

            return rec;
        }


        public List<ArticoloInRevisione> etichettaRecords(List<ArticoloInRevisione> tRecordsJson, MenaboController menaboController)
        {

            //Console.WriteLine("Inizio etichettatura records");

            DbDeclinazioneMeccaniche dbMeccs = exClass.getDeclinazioneMeccaniche();
            DbFrameworkCss dbFCss = exClass.getFrameworkCss();

            string error = "";
            int count = 0;

            //Adesso per ogni record definisco meccaniche dato e visual
            for (int i = 0; i < tRecordsJson.Count; i++)
            {
                try
                {
                    var item = tRecordsJson[i];

                    //if (item.isGruppo)
                    //{
                    //    continue;
                    //}

                    Stopwatch part_sub1 = new Stopwatch();
                    Stopwatch part_sub2 = new Stopwatch();

                    part_sub1.Start();
                    //Identifico meccanica
                    var recordPostMecc = menaboController.IdentificaMeccanicaRecord(item, dbMeccs);
                    item.recordInTracciato!.Add(GLOBAL_VARIABLES.combinazioneMeccanica, recordPostMecc.meccanicheValide);
                    item.recordInTracciato.Add(GLOBAL_VARIABLES.combinazioneAssegnata, recordPostMecc.meccanicaAssegnata);
                    item.recordInTracciato.Add(GLOBAL_VARIABLES.meccanicaInvalidata, recordPostMecc.meccanicaInvalidata);

                    part_sub1.Stop();
                    part_sub1.ToString();
                    part_sub2.Start();
                    //Identifico meccanica VISUAL
                    var codiceBox = menaboController.IdentificaCodiceBox(item, dbFCss);
                    item.recordInTracciato.Add(GLOBAL_VARIABLES_FICO.codiceBox, codiceBox);
                    part_sub2.Stop();

                    "res".ToString();
                    count++;
                }
                catch (Exception ex)
                {
                    error = ex.ToString();
                    continue;
                }
            }

            //Console.WriteLine("Fine etichettatura records. ("+count+") - Errori? " + error);

            return tRecordsJson;


        }

        //public TracciatoResultKit esportaConLogicheDiAgenzia(FicoCombinazioneKit kit, List<FicoContextField> promoContext, List<FicoContextField> tracciatoContext, List<ArticoloInKit> recordsFiltrati, FicoCombinazioneKitReadMode mode, string agenziaFunc)
        public TracciatoResultKit esportaConLogicheDiAgenzia(FicoRuntimeKit kit, List<FicoContextField> promoContext, List<FicoContextField> tracciatoContext, List<ArticoloInKit> recordsFiltrati, FicoCombinazioneKitReadMode mode, string agenziaFunc)
        {
            IstantaController icItem = new IstantaController(this.connString, this.extarnalLibPath, this.extarnalSourcePath, this._dbContextFactory);


            Dictionary<string, object> objParams = new Dictionary<string, object>();
            objParams.Add("promoContext", promoContext);
            objParams.Add("tracciatoContext", tracciatoContext);
            objParams.Add("tracciato", recordsFiltrati);
            objParams.Add("kit", kit);
            objParams.Add("readMode", mode);

            TracciatoResultKit result = new TracciatoResultKit();


            try
            {
                result = (icItem.execLibFunction($"AgenziaLib.{this.ficoConf.Value.nomeCliente}.{agenziaFunc}", objParams) as TracciatoResultKit)!;
            }
            catch (Exception ex)
            {
                result.errors = ex.ToString();
            }

            return result;
        }

        /// <summary>
        /// Chiave della mappa noRender: l'opzione appartiene alla singola foto primaria/secondaria
        /// di un box, quindi va qualificata dal codice gruppo oltre che dal codice referenza.
        /// </summary>
        private static string chiaveNoRenderFoto(string? codiceGruppo, string? codRef)
        {
            return (codiceGruppo ?? "") + "|" + (codRef ?? "");
        }

        /// <summary>
        /// Riporta l'opzione noRender letta dai meta della lavorazione sulle voci foto del box.
        /// noRender non e' un dato del record: vive solo dentro membriGruppoFoto, cioe' sulle
        /// primarie/secondarie contenute nel box, mai sul record contenitore.
        /// </summary>
        public static void applicaNoRenderAiMembriGruppoFoto(List<ArticoloInKit>? records, Dictionary<string, bool>? noRenderPerRef)
        {
            if (records == null || noRenderPerRef == null || noRenderPerRef.Count == 0)
                return;

            var keyCodGruppo = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppo;

            foreach (var record in records)
            {
                if (record?.recordInTracciato == null)
                    continue;

                if (!record.recordInTracciato.TryGetValue(GLOBAL_VARIABLES.keyMembriGruppoFoto, out var membriObj))
                    continue;

                if (membriObj is not List<FotoElementoGruppo> membri)
                    continue;

                record.recordInTracciato.TryGetValue(keyCodGruppo, out var codGruppoObj);
                var codGruppo = codGruppoObj?.ToString();

                foreach (var membro in membri)
                {
                    if (noRenderPerRef.TryGetValue(chiaveNoRenderFoto(codGruppo, membro.codRef), out var noRender))
                    {
                        membro.noRender = noRender;
                    }
                }
            }
        }

        /// <summary>
        /// Le foto stanno nella stessa struttura degli altri elementi, con il codice referenza
        /// per chiave: da li' si ricava la mappa che alimenta membriGruppoFoto.
        /// </summary>
        private static void raccogliNoRenderDelleFoto(string? codiceGruppo, List<RevisioneNoRenderFromIndd>? elementi, Dictionary<string, bool>? noRenderPerRef)
        {
            if (elementi == null || noRenderPerRef == null)
                return;

            foreach (var elemento in elementi.Where(e => e.tipo == TipoElementoBox.Foto && !string.IsNullOrEmpty(e.chiave)))
            {
                noRenderPerRef[chiaveNoRenderFoto(codiceGruppo, elemento.chiave)] = true;
            }
        }

        /// <summary>
        /// Riporta sul box gli elementi messi in noRender dall'operatore: campi, loghi, foto extra.
        /// A differenza delle foto primarie/secondarie, che viaggiano dentro membriGruppoFoto,
        /// questi elementi non hanno un contenitore proprio nel record: li consegniamo al Plugin
        /// sotto la chiave noRenderElementi del record del box.
        /// </summary>
        public static void applicaNoRenderAgliElementiDelBox(List<ArticoloInKit>? records, Dictionary<string, List<RevisioneNoRenderFromIndd>>? elementiPerGruppo)
        {
            if (records == null || elementiPerGruppo == null || elementiPerGruppo.Count == 0)
                return;

            var keyCodGruppo = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppo;

            foreach (var record in records)
            {
                if (record?.recordInTracciato == null)
                    continue;

                record.recordInTracciato.TryGetValue(keyCodGruppo, out var codGruppoObj);
                var codGruppo = codGruppoObj?.ToString();
                if (codGruppo == null)
                    continue;

                if (elementiPerGruppo.TryGetValue(codGruppo, out var elementi) && elementi.Count > 0)
                {
                    record.recordInTracciato[GLOBAL_VARIABLES.keyNoRenderElementi] = elementi;
                }
            }
        }

        public List<ArticoloInKit> updateDatiFromMetaPromoLavorazioni(List<ArticoloInKit> artInkit, int idLavorazione, FicoRuntimeKit kit/*, bool confronto = false*/, Dictionary<string, bool>? noRenderPerRef = null, Dictionary<string, List<RevisioneNoRenderFromIndd>>? noRenderElementiPerGruppo = null)
        {
            var keyCodGruppo = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppo;
            var keyRefCodice = Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice;
            var keyStatoSelezione = GLOBAL_VARIABLES.keyXMLSelezione;
            string keyFotoGuid = Enum.GetName(AddestramentoRuoli.Foto) + "." + GLOBAL_VARIABLES.keyFotoGuidId;
            string keyFotoNome = Enum.GetName(AddestramentoRuoli.Foto) + "." + GLOBAL_VARIABLES.keyFotoNome;

            var kitGrouped = artInkit
                .GroupBy(f => new
                {
                    CodiceGruppo = f.recordInTracciato[keyCodGruppo].ToString(),
                    Label = f.label
                });

            PromoLavorazioni? kitResultCache = null;
            //if (confronto)
            //{
            //    string kitCacheId = "PR_" + idLavorazione.ToString();
            //    _cache.TryGetValue(kitCacheId, out kitResultCache);
            //}

            foreach (var group in kitGrouped)
            {
                bool _debug = (group.Key.CodiceGruppo == "3150596,3150599,3150600,4831132,4831135");

                var promoLavorazione = ctx2.PromoLavorazioniRecords.Where(f => f.CodiceGruppo! == group.Key.CodiceGruppo && idLavorazione == f.IdLavorazione).FirstOrDefault();
                if (_debug)
                    Console.WriteLine($"Promo lavorazione di {idLavorazione} = {(promoLavorazione != null)}");
                if (promoLavorazione == null)
                {
                    if (kitResultCache != null)
                    {
                        promoLavorazione = kitResultCache.PromoLavorazioniRecords.FirstOrDefault(f => f.CodiceGruppo! == group.Key.ToString());// && idLavorazione == f.IdLavorazione);
                        if (promoLavorazione == null)
                        {
                            continue;
                        }
                    }
                    //else
                    //{
                    //    continue;
                    //}
                }

                RevisioneMetaPromoLavorazioni storeField = new RevisioneMetaPromoLavorazioni();
                if (promoLavorazione != null && promoLavorazione.Meta != null)
                {
                    //storeField = JsonConvert.DeserializeObject<List<RevisioneCampiOffertaFromIndd>>(plrItem.Meta);
                    storeField = MetaPromoLavorazioni.leggi(promoLavorazione.Meta)!;
                }
                else
                {
                    if (_debug)
                        Console.WriteLine($"Promo a cercare nel passato");

                    //Cerco il passato di questo codice
                    int giorniNelPassato = 365;
                    List<PromoLavorazioniRecord> _listPassato = ctx2.PromoLavorazioniRecords
                        .Include(i2 => i2.IdPromoLavorazioniNavigation).Include(i3 => i3.IdPromoTracciatiRecordNavigation)
                        .Where(f => f.IdLavorazione != idLavorazione && f.CodiceGruppo == group.Key.CodiceGruppo && f.RegisterDate >= DateTime.Now.AddDays(-giorniNelPassato)).OrderByDescending(f => f.RegisterDate).ToList();

                    //Prima cerco canale/area specifico MA lo cerco solo nei tipi di lavorazione VOL, solo li posso aver alterato i meta
                    //PromoLavorazioniRecord? plrInAC = _listPassato.OrderByDescending(o => o.RegisterDate).FirstOrDefault(p =>
                    //p.IdPromoLavorazioniNavigation.GuidArea == kit.guidArea && p.IdPromoLavorazioniNavigation.GuidCanale == kit.guidCanale &&
                    //SingletonConfiguration.DBFORMATI.source.FirstOrDefault(f => f.guidID == Utility.Main.getFicoRuntimeKit(p.IdPromoLavorazioniNavigation!.Meta).guidFormato).tipo == TipoLavorazione.Volantino);
                    
                    
                    List<PromoLavorazioniRecord?> plrInACList = _listPassato.OrderByDescending(o => o.RegisterDate).Where(p =>
                    p.IdPromoLavorazioniNavigation.GuidArea == kit.guidArea && p.IdPromoLavorazioniNavigation.GuidCanale == kit.guidCanale &&
                    SingletonConfiguration.DBFORMATI.source.FirstOrDefault(f => f.guidID == Utility.Main.getFicoRuntimeKit(p.IdPromoLavorazioniNavigation!.Meta).guidFormato).tipo == TipoLavorazione.Volantino).ToList();


                    if (plrInACList.Count > 0)
                    {
                        var promoLavorazioneId = plrInACList[0].IdLavorazione;

                        var plrValidi = plrInACList.Where(f => f.IdLavorazione == promoLavorazioneId).ToList();
                        var plrInAC = plrValidi[0];
                        if (plrValidi.Count > 1)
                        {
                            //controlliamo la label
                            var labelCercata = group.Key.Label;

                            foreach (var plr in plrValidi)
                            {
                                if(plr.IdPromoTracciatiRecordNavigation.Label == labelCercata)
                                {
                                    plrInAC = plr;
                                    break;
                                }
                            }
                        }


                        if (plrInAC != null)
                        {
                            if (plrInAC.Meta != null)
                            {
                                if (_debug)
                                    Console.WriteLine($"Trovata roba");

                                //Prendo la foto e anche per le P/S da questo
                                RevisioneMetaPromoLavorazioni recPassato = MetaPromoLavorazioni.leggi(plrInAC.Meta)!;
                                //Gli elementi in noRender sono del box, non della singola ref: si
                                //ereditano una volta sola per codice gruppo.
                                if (recPassato.noRender != null && recPassato.noRender.Count > 0)
                                {
                                    if (noRenderElementiPerGruppo != null)
                                    {
                                        noRenderElementiPerGruppo[group.Key.CodiceGruppo] = recPassato.noRender;
                                    }
                                    raccogliNoRenderDelleFoto(group.Key.CodiceGruppo, recPassato.noRender, noRenderPerRef);
                                }
                                foreach (var item in group)
                                {
                                    if (recPassato.ps != null && recPassato.ps.Count > 0)
                                    {
                                        var psItem = recPassato.ps.FirstOrDefault(f => f.codRef == item.recordInTracciato[keyRefCodice].ToString());
                                        if (psItem != null)
                                        {
                                            item.recordInTracciato[keyStatoSelezione] = (int)psItem.stato;
                                        }
                                    }

                                    var fotoScelta = recPassato.foto!.FirstOrDefault(f => f.codRef == item.recordInTracciato[keyRefCodice].ToString() && f.tipo == TipoFoto.Foto);
                                    if (fotoScelta != null)
                                    {
                                        var artFotoItem = this.ctx.ArticoliFotos.Include(f => f.IdArticoloNavigation).FirstOrDefault(f => f.IdArticoloNavigation.Codice == fotoScelta.codRef && f.NomeReale == fotoScelta.nomeFoto);
                                        if (artFotoItem != null)
                                        {
                                            item.recordInTracciato[Enum.GetName(AddestramentoRuoli.Foto) + "." + GLOBAL_VARIABLES.keyFotoGuidId] = artFotoItem.GuidId;
                                            item.recordInTracciato[Enum.GetName(AddestramentoRuoli.Foto) + "." + GLOBAL_VARIABLES.keyFotoNome] = artFotoItem.NomeReale;
                                            item.recordInTracciato[Enum.GetName(AddestramentoRuoli.Foto) + "." + GLOBAL_VARIABLES.keyFotoIsMeta] = true;

                                        }
                                        else
                                        {
                                            item.recordInTracciato[Enum.GetName(AddestramentoRuoli.Foto) + "." + GLOBAL_VARIABLES.keyFotoIsMeta] = false;
                                        }
                                    }

                                    //Accorpare foto extra ereditate dalla lavorazione precedente

                                }
                            }
                        }



                    }
                    //else
                    //{
                    //    //Prendo in considerazione i P/S  della prima alterazione che vedo nel passato
                    //    PromoLavorazioniRecord? primodelpassato = _listPassato.FirstOrDefault();
                    //    if (primodelpassato != null)
                    //    {
                    //        if (primodelpassato.Meta != null)
                    //        {
                    //            RevisioneMetaPromoLavorazioni? recPassato = JsonConvert.DeserializeObject<RevisioneMetaPromoLavorazioni>(primodelpassato.Meta);
                    //            foreach (var item in group)
                    //            {
                    //                if (recPassato!.ps != null && recPassato.ps.Count > 0)
                    //                {
                    //                    var psItem = recPassato.ps.FirstOrDefault(f => f.codRef == item.recordInTracciato[keyRefCodice].ToString());
                    //                    if (psItem != null)
                    //                    {
                    //                        item.recordInTracciato[keyStatoSelezione] = (int)psItem.stato;
                    //                    }
                    //                }
                    //            }
                    //        }
                    //    }
                    //}
                }

                if (storeField.noRender != null && storeField.noRender.Count > 0)
                {
                    if (noRenderElementiPerGruppo != null)
                    {
                        noRenderElementiPerGruppo[group.Key.CodiceGruppo] = storeField.noRender;
                    }
                    raccogliNoRenderDelleFoto(group.Key.CodiceGruppo, storeField.noRender, noRenderPerRef);
                }

                foreach (var item in group)
                {
                    if (storeField.ps != null)
                    {
                        var fieldGiaEsistente = storeField.ps!.FirstOrDefault(s => s.codRef == item.recordInTracciato[keyRefCodice].ToString());
                        if (fieldGiaEsistente != null)
                        {
                            item.recordInTracciato[keyStatoSelezione] = (int)fieldGiaEsistente.stato;
                        }
                    }
                    if (storeField.foto != null)
                    {
                        var fotoScelta = storeField.foto!.FirstOrDefault(f => f.codRef == item.recordInTracciato[keyRefCodice].ToString() && f.tipo == TipoFoto.Foto);
                        if (fotoScelta != null)
                        {
                            var artFotoItem = this.ctx.ArticoliFotos.Include(f => f.IdArticoloNavigation).FirstOrDefault(f => f.IdArticoloNavigation.Codice == fotoScelta.codRef && f.NomeReale == fotoScelta.nomeFoto);
                            if (artFotoItem != null)
                            {
                                item.recordInTracciato[Enum.GetName(AddestramentoRuoli.Foto) + "." + GLOBAL_VARIABLES.keyFotoGuidId] = artFotoItem.GuidId;
                                item.recordInTracciato[Enum.GetName(AddestramentoRuoli.Foto) + "." + GLOBAL_VARIABLES.keyFotoNome] = artFotoItem.NomeReale;
                                item.recordInTracciato[Enum.GetName(AddestramentoRuoli.Foto) + "." + GLOBAL_VARIABLES.keyFotoIsMeta] = true;
                            }
                            else
                            {
                                item.recordInTracciato[Enum.GetName(AddestramentoRuoli.Foto) + "." + GLOBAL_VARIABLES.keyFotoIsMeta] = false;
                            }
                        }
                    }
                }

            }
            return artInkit;
        }

        [HttpPut]
        [Route("FicoProcess/downloadKitRuntimeFromFP")]
        public async Task<IActionResult> downloadKitRuntimeFromFP([FromBody] FicoRuntimeFromFPRequest req)
        {
            ArticoloInRevisioneKitResult result = new ArticoloInRevisioneKitResult();

            FICOAccessLevel acLevel = await getAccesslevel();

            PromoLavorazioni pl = new PromoLavorazioni();
            var kit = req.kit;
            //if (acLevel == FICOAccessLevel.guestFico)
            //{
            pl.GuidFormato = kit.guidFormato;
            pl.GuidCanale = kit.guidCanale;
            pl.GuidArea = kit.guidArea;
            pl.GuidId = kit.guidId;
            pl.GuidRaccoglitore = kit.guidIdRaccoglitore;
            pl.GuidPromo = kit.idPromo;
            pl.Meta = JsonConvert.SerializeObject(kit);
            pl.RegisterDate = DateTime.Now;
            pl.Stato = (byte)FicoCombinazioniKitStato.ATTIVO;
            pl.IdAutore = short.Parse(SessionIstantaObject.GetSession(HttpContext));

            this.ctx2.PromoLavorazionis.Add(pl);
            this.ctx2.SaveChanges();

            var idLavorazione = pl.Id;
            if (idLavorazione == 0)
            {
                result.error = "Lavorazione non specificata";
                return Ok(result);
            }
            try
            {

                Stopwatch sw = new Stopwatch();
                sw.Start();

                //PromoLavorazioni plItem = this.ctx2.PromoLavorazionis.FirstOrDefault(p => p.Id == idLavorazione);
                HttpContextInRent = HttpContext;
                //Console.WriteLine($"Scarico kit {idLavorazione}");
                var tipoDiExp = SingletonConfiguration.DBTipiDiExport!.source.Find(f => f.codice == "WEB");
                if (tipoDiExp == null)
                {
                    result.error = "Lavorazione non specifica kit WEB";
                    return Ok(result);
                }
                var promise = await processaKit(idLavorazione, FicoCombinazioneKitReadMode.Advanced, true, tipoDiExp.guidID);
                var okResult = promise as OkObjectResult;
                result = (okResult!.Value as ArticoloInRevisioneKitResult)!;

                if (!result.esito)
                {
                    throw new Exception(result.error);
                }

                var resKitFp = componiInformazioniPerKitRuntimeFromFP(result, req.dataFieldsRequest);


                sw.Stop();
                sw.ToString();
                //return Ok(processKitResult);
                return Ok(resKitFp);

            }
            catch (Exception ex)
            {

                //Console.WriteLine($"Scarico kit error {ex.ToString()}");

                result.error = ex.ToString();
                ex.ToString();
            }
            //}

            return Ok(result);
        }

        public downloadFromFPResult componiInformazioniPerKitRuntimeFromFP(ArticoloInRevisioneKitResult kit, List<string> dataFields)
        {
            downloadFromFPResult res = new downloadFromFPResult();
            res.esito = true;
            try
            {

                string keyXMLSelezione = GLOBAL_VARIABLES.keyXMLSelezione;
                var key_codice_gruppo = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppo;
                //string keyMembriGruppoFoto = GLOBAL_VARIABLES.keyMembriGruppoFoto;
                string keyFotoGuidId = Enum.GetName(AddestramentoRuoli.Foto) + "." + GLOBAL_VARIABLES.keyFotoGuidId;
                string keyNomeFoto = Enum.GetName(AddestramentoRuoli.Foto) + "." + GLOBAL_VARIABLES.keyFotoNome;
                string keyFotoExtra = Enum.GetName(AddestramentoRuoli.Foto) + "." + GLOBAL_VARIABLES.keyFotoExtra;
                string keyFotoExtraAuto = Enum.GetName(AddestramentoRuoli.Foto) + "." + GLOBAL_VARIABLES.keyFotoExtraAuto;
                string key_codiceRef = Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice;
                var groupedRecords = kit.records.GroupBy(f => f.recordInTracciato[key_codice_gruppo]);

                string viewPag = "View.pag";
                string viewX = "View.x";
                string viewY = "View.y";
                string viewW = "View.w";
                string viewH = "View.h";
                string viewWPage = "View.wPag";
                string viewHPage = "View.hPag";
                string viewAR = "View.aspectRatio";
                string viewPERC = "View.percIngombro";


                List<Dictionary<string, object>> listaPrimarieSingoli = new List<Dictionary<string, object>>();
                foreach (var item in groupedRecords)
                {
                    List<string> foto = new List<string>();
                    string cod = item.FirstOrDefault().recordInTracciato[GLOBAL_VARIABLES_FICO.keyCodiceGruppo].ToString();
                    Dictionary<string, object>? primario = kit.records.Where(f => Convert.ToByte(f.recordInTracciato[keyXMLSelezione]) == (Byte)TipoSelezioneMenabo.Primaria && cod == f.recordInTracciato[key_codice_gruppo].ToString()).Select(f => f.recordInTracciato).FirstOrDefault();

                    if (primario == null)
                    {
                        Console.WriteLine($"Non è stato trovato il primario del gruppo: {cod}");
                        continue;
                        //if (item.Count() == 1)
                        //    primario = item.First().recordInTracciato;
                        //else
                        //{
                        //    Console.WriteLine("componiInformazioniPerKitRuntimeFromFP primario non trovato -> step3_error");
                        //    throw new Exception("Primario non trovato");
                        //}
                    }


                    foto.Add(primario[keyFotoGuidId].ToString()!);
                    var secondari = kit.records.Where(f => Convert.ToByte(f.recordInTracciato[keyXMLSelezione]) == (Byte)TipoSelezioneMenabo.Secondaria && f.recordInTracciato[key_codice_gruppo].ToString() == cod).ToList();
                    List<FotoElementoGruppo> membriGruppoFoto = new List<FotoElementoGruppo>();
                    foreach (var singolo in secondari)
                    {
                        foto.Add(singolo.recordInTracciato[keyFotoGuidId].ToString()!);
                    }

                    primario["foto"] = foto;
                    listaPrimarieSingoli.Add(primario);
                }

                try
                {
                    foreach (var item in listaPrimarieSingoli)
                    {

                        recordResultFromFP record = new recordResultFromFP();

                        if (!item.ContainsKey("compiledFields"))
                        {
                            Console.WriteLine($"{item[key_codiceRef].ToString()} NON ha compiledFileds");
                            continue;
                        }

                        var compFields = item["compiledFields"];

                        var _nTets = compFields.GetType().Name;
                        if (compFields is string)
                        {
                            //Deve ancora essere deserializzato
                            record.compiledFields = JsonConvert.DeserializeObject<List<CompiledField>>(compFields.ToString()!)!;
                        }
                        else if (compFields is JArray)
                        {
                            record.compiledFields = (compFields as JArray).ToObject<List<CompiledField>>();
                        }
                        else
                            record.compiledFields = (item["compiledFields"] as List<CompiledField>)!;


                        var delFields = item["deletedFields"];
                        if (delFields is string)
                        {
                            //Deve ancora essere deserializzato
                            record.deletedFields = JsonConvert.DeserializeObject<List<string>>(delFields.ToString()!)!;
                        }
                        else if (delFields is JArray)
                        {
                            record.deletedFields = (delFields as JArray).ToObject<List<string>>();
                        }
                        else
                            record.deletedFields = (item["deletedFields"] as List<string>)!;


                        record.foto = (item["foto"] as List<string>)!;
                        record.meccanica = item[GLOBAL_VARIABLES.combinazioneAssegnata].ToString()!;
                        record.codiceBox = item[GLOBAL_VARIABLES_FICO.codiceBox].ToString()!;


                        if (item.ContainsKey(viewY))
                        {
                            record.y = Convert.ToDecimal(item[viewY]);
                        }
                        if (item.ContainsKey(viewX))
                        {
                            record.x = Convert.ToDecimal(item[viewX]);
                        }
                        if (item.ContainsKey(viewW))
                        {
                            record.w = Convert.ToDecimal(item[viewW]);
                        }
                        if (item.ContainsKey(viewH))
                        {
                            record.h = Convert.ToDecimal(item[viewH]);
                        }
                        if (item.ContainsKey(viewWPage))
                        {
                            record.wPage = Convert.ToDecimal(item[viewWPage]);
                        }
                        if (item.ContainsKey(viewHPage))
                        {
                            record.hPage = Convert.ToDecimal(item[viewHPage]);
                        }
                        if (item.ContainsKey(viewAR))
                        {
                            record.aspectRatio = Convert.ToDecimal(item[viewAR]);
                        }
                        if (item.ContainsKey(viewPERC))
                        {
                            record.percIngombro = Convert.ToDecimal(item[viewPERC]);
                        }
                        if (item.ContainsKey(viewPag))
                        {
                            record.pag = Convert.ToInt16(item[viewPag]);
                        }


                        var fotoExtra = item[keyFotoExtra] as List<LogoBollo_ExtraNoAuto>;
                        if (fotoExtra == null)
                        {
                            //Manca di deserializzare
                            if (item[keyFotoExtra] is string)
                            {
                                fotoExtra = JsonConvert.DeserializeObject<List<LogoBollo_ExtraNoAuto>>(item[keyFotoExtra].ToString()!);
                            }
                            else if (item[keyFotoExtra] is JArray)
                            {
                                fotoExtra = (item[keyFotoExtra] as JArray).ToObject<List<LogoBollo_ExtraNoAuto>>();
                            }
                        }

                        if (fotoExtra != null)
                        {
                            foreach (var foto in fotoExtra!)
                            {
                                fotoExtraForFP f = new fotoExtraForFP();
                                f.tipo = (TipoFoto)foto.tipo;
                                f.attiva = foto.attiva;
                                f.guidId = foto.guidId;
                                f.sigla = "";
                                record.fotoExtra.Add(f);
                            }
                        }

                        var fotoExtraAuto = item[keyFotoExtraAuto] as List<LogoBollo>;
                        if (fotoExtraAuto == null)
                        {
                            //Manca di deserializzare
                            if (item[keyFotoExtraAuto] is string)
                            {
                                fotoExtraAuto = JsonConvert.DeserializeObject<List<LogoBollo>>(item[keyFotoExtraAuto].ToString()!);
                            }
                            else if (item[keyFotoExtraAuto] is JArray)
                            {
                                fotoExtraAuto = (item[keyFotoExtraAuto] as JArray).ToObject<List<LogoBollo>>();
                            }
                        }

                        if (fotoExtraAuto != null)
                        {
                            foreach (var foto in fotoExtraAuto!)
                            {
                                fotoExtraForFP f = new fotoExtraForFP();
                                f.tipo = (TipoFoto)foto.tipo;
                                f.attiva = true;
                                f.guidId = foto.guidId;
                                f.sigla = foto.sigla;
                                record.fotoExtra.Add(f);

                            }
                        }

                        foreach (var chiave in dataFields)
                        {
                            try
                            {
                                if (item.ContainsKey(chiave))
                                {
                                    record.dataFields.Add(chiave, item[chiave]);
                                }
                                else if (chiave == "descrizione")
                                {
                                    record.dataFields.Add(chiave, $"{item[GLOBAL_VARIABLES_FICO.keyDescrizione1]}\n{item[GLOBAL_VARIABLES_FICO.keyDescrizione2]}\n{item[GLOBAL_VARIABLES_FICO.keyDescrizione3]}\n{item[GLOBAL_VARIABLES_FICO.keyDescrizione4]}");
                                }
                            }
                            catch (Exception ex)
                            {
                                Console.WriteLine($"Errore chiave {chiave} -> {ex.ToString()}");
                            }
                        }

                        bool isGruppo = item[key_codiceRef].ToString() != item[key_codice_gruppo].ToString();
                        if (isGruppo)
                        {

                            string? codGruppo = item[key_codice_gruppo].ToString();
                            List<Dictionary<string, object>> groupElementsAllInfo = kit.records.Where(f => f.recordInTracciato[key_codice_gruppo].ToString() == codGruppo).Select(f => f.recordInTracciato).ToList();
                            foreach (Dictionary<string, object> itemInGruppo in groupElementsAllInfo)
                            {
                                Dictionary<string, object> itemGruppoInWebpliant = new Dictionary<string, object>();
                                foreach (var chiave in dataFields)
                                {
                                    if (itemInGruppo.ContainsKey(chiave))
                                    {
                                        itemGruppoInWebpliant[chiave] = itemInGruppo[chiave];
                                    }
                                }
                                record.groupElements.Add(itemGruppoInWebpliant);
                            }


                        }

                        Console.WriteLine($"Aggiungo cod al dataset {record.dataFields[GLOBAL_VARIABLES_FICO.keyRefCodice]}");
                        res.results.Add(record);
                    }
                }
                catch (Exception ex1)
                {
                    Console.WriteLine($"Errore durante composizione informazioni per kit runtime from FP -> {ex1.ToString()}");
                    res.esito = false;
                    res.errors.Add(ex1.ToString());
                }


            }
            catch (Exception ex)
            {
                res.esito = false;
                res.errors.Add(ex.ToString());
            }

            return res;
        }

        public bool checkFiltro(Dictionary<string, object> rec, List<FicoCombinazioniKitFiltro> filtro)
        {

            if (filtro.Count == 0)
            {
                return true;
            }

            foreach (FicoCombinazioniKitFiltro f in filtro)
            {
                //Esecuzione BLOCCO che prevede OPERATORE OR

                bool esitoCondizioni = true;
                foreach (FicoCombinazioniKitFiltroCondizione cond in f.condizioni)
                {
                    /*
                     <option value="=" >Uguale</option>
                    <option value="!=">Diverso da</option>
                    <option value=">">Maggiore di</option>
                    <option value="<">Minore di</option>
                    <option value="Contain">Contiene</option>
                    <option value="NoContain">Non contiene</option>*/

                    //Esecuzione CONDIZIONE che prevede OPERATORE AND
                    cond.operatore = cond.operatore.ToLower();
                    if (rec.ContainsKey(cond.nome_field))
                    {
                        var objVal = rec[cond.nome_field];
                        if (cond.nome_field == GLOBAL_VARIABLES.allEtichette)
                        {
                            Console.WriteLine($"### Filtro su allEtichette che contiene {cond.valore.ToLower()}");
                            try
                            {
                                //L'unica cosa che ad ora posso ricevere come chiave strana è allEtichette che è un array di stringhe
                                List<string> arrVal = (List<string>)objVal;
                                if (cond.operatore == "Contain")
                                {
                                    //Esecuzione CONDIZIONE che prevede OPERATORE contiene
                                    if (!arrVal.Contains(cond.valore.ToLower()))
                                    {
                                        esitoCondizioni = false;
                                        break;
                                    }

                                }
                                else if (cond.operatore == "NoContain")
                                {
                                    //Esecuzione CONDIZIONE che prevede OPERATORE non contiente
                                    if (arrVal.Contains(cond.valore.ToLower()))
                                    {
                                        esitoCondizioni = false;
                                        break;
                                    }

                                }
                            }
                            catch (Exception ex)
                            {
                                Console.WriteLine($"### Filtro su allEtichette errore {ex.ToString()}");
                            }
                        }
                        else
                        {
                            string? val = objVal.ToString()!.ToLower();
                            Console.WriteLine($"### Filtro su {val} {cond.operatore} {cond.valore.ToLower()}");
                            if (cond.operatore == "=")
                            {
                                //Esecuzione CONDIZIONE che prevede OPERATORE uguale a

                                if (val!.ToLower() != cond.valore.ToLower())
                                {
                                    esitoCondizioni = false;
                                    break;
                                }
                            }
                            else if (cond.operatore == "!=")
                            {
                                //Esecuzione CONDIZIONE che prevede OPERATORE diverso da
                                if (val!.ToLower() == cond.valore.ToLower())
                                {
                                    esitoCondizioni = false;
                                    break;
                                }

                            }
                            else if (cond.operatore == "Contain")
                            {
                                //Esecuzione CONDIZIONE che prevede OPERATORE contiene
                                if (!val!.ToLower().Contains(cond.valore.ToLower()))
                                {
                                    esitoCondizioni = false;
                                    break;
                                }

                            }
                            else if (cond.operatore == "NoContain")
                            {
                                //Esecuzione CONDIZIONE che prevede OPERATORE non contiente
                                if (val!.ToLower().Contains(cond.valore.ToLower()))
                                {
                                    esitoCondizioni = false;
                                    break;
                                }

                            }
                            else
                            {
                                //Valore numerico probabilmente
                                double valNum;
                                if (Double.TryParse(val, out valNum))
                                {
                                    double valConfronto;
                                    if (Double.TryParse(cond.valore, out valConfronto))
                                    {
                                        if (cond.operatore == ">")
                                        {
                                            //Esecuzione CONDIZIONE che prevede OPERATORE maggiore di
                                            if (valNum <= valConfronto)
                                            {
                                                esitoCondizioni = false;
                                                break;
                                            }
                                        }
                                        else if (cond.operatore == "<")
                                        {
                                            //Esecuzione CONDIZIONE che prevede OPERATORE minore di
                                            if (valNum >= valConfronto)
                                            {
                                                esitoCondizioni = false;
                                                break;
                                            }

                                        }

                                    }
                                    else
                                    {
                                        //Valore di confronto non numerico
                                        esitoCondizioni = false;
                                        break;
                                    }
                                }
                                else
                                {
                                    //Doveva esserci un valore numerico ma ha trovato vuoto, null o un campo diverso da numerico
                                    esitoCondizioni = false;
                                    break;

                                }

                            }
                        }
                    }
                    else if (cond.nome_field.StartsWith("Context."))
                    {
                        string[] _p = cond.nome_field.Split('.');
                        string scope = $"{_p[0]}.{_p[1]}";
                        string fieldname = _p[2];
                        if (rec.ContainsKey(scope))
                        {
                            List<FicoContextField> contextFields = (rec[scope] as JArray).ToObject<List<FicoContextField>>();
                            var contextField = contextFields.FirstOrDefault(c => c.nome_field == fieldname);
                            if (contextField != null)
                            {
                                if (cond.operatore == "=")
                                {
                                    //Esecuzione CONDIZIONE che prevede OPERATORE uguale a

                                    if (contextField.user_value!.ToLower() != cond.valore.ToLower())
                                    {
                                        esitoCondizioni = false;
                                        break;
                                    }
                                }
                                else if (cond.operatore == "!=")
                                {
                                    //Esecuzione CONDIZIONE che prevede OPERATORE diverso da
                                    if (contextField.user_value!.ToLower() == cond.valore.ToLower())
                                    {
                                        esitoCondizioni = false;
                                        break;
                                    }

                                }
                                else if (cond.operatore == "Contain")
                                {
                                    //Esecuzione CONDIZIONE che prevede OPERATORE contiene
                                    if (!contextField.user_value!.ToLower().Contains(cond.valore.ToLower()))
                                    {
                                        esitoCondizioni = false;
                                        break;
                                    }

                                }
                                else if (cond.operatore == "NoContain")
                                {
                                    //Esecuzione CONDIZIONE che prevede OPERATORE non contiente
                                    if (contextField.user_value!.ToLower().Contains(cond.valore.ToLower()))
                                    {
                                        esitoCondizioni = false;
                                        break;
                                    }

                                }
                            }
                            else
                            {
                                //Qui l'unica condizoine che MI FA RIMANERE VIVO è che il valore sia VUOTO
                                if (
                                    cond.valore == "" && cond.operatore != "=" ||
                                    cond.valore != "" && cond.operatore == "="
                                    )
                                {
                                    esitoCondizioni = false;
                                    break;
                                }
                            }

                        }
                        else
                        {
                            esitoCondizioni = false;
                            break;
                        }
                    }
                    else
                    {
                        esitoCondizioni = false;
                        break;
                    }
                }

                if (esitoCondizioni) // mi basta che un blocco sia vero per convalidare il filtro
                    return true;
            }


            return false;
        }

        private bool checkFiltroContesto(List<FicoContextField> promoContext, List<FicoContextField> tracciatoContext, List<FicoCombinazioniKitFiltro> filtroContext)
        {
            if (filtroContext.Count == 0)
            {
                return true;
            }

            foreach (FicoCombinazioniKitFiltro f in filtroContext)
            {
                //Esecuzione BLOCCO che prevede OPERATORE OR

                bool esitoCondizioni = true;
                foreach (FicoCombinazioniKitFiltroCondizione cond in f.condizioni)
                {
                    string scope = cond.nome_field.Split('.')[0];

                    List<FicoContextField>? scopeContext = null;
                    if (scope == "Promo")
                    {
                        scopeContext = promoContext;
                    }
                    else if (scope == "Tracciato")
                    {
                        scopeContext = tracciatoContext;
                    }

                    if (scopeContext != null)
                    {
                        string fieldname = cond.nome_field.Split('.')[1];

                        cond.operatore = cond.operatore.ToLower();

                        if (scopeContext.Count(sc => sc.nome_field == fieldname) > 0)
                        {
                            string val = scopeContext.FirstOrDefault(sc => sc.nome_field == fieldname)!.user_value;

                            if (cond.operatore == "=")
                            {
                                //Esecuzione CONDIZIONE che prevede OPERATORE uguale a

                                if (val.ToLower() != cond.valore.ToLower())
                                {
                                    esitoCondizioni = false;
                                    break;
                                }
                            }
                            else if (cond.operatore == "!=")
                            {
                                //Esecuzione CONDIZIONE che prevede OPERATORE diverso da
                                if (val.ToLower() == cond.valore.ToLower())
                                {
                                    esitoCondizioni = false;
                                    break;
                                }

                            }
                            else if (cond.operatore == "Contain")
                            {
                                //Esecuzione CONDIZIONE che prevede OPERATORE contiene
                                if (!val.ToLower().Contains(cond.valore.ToLower()))
                                {
                                    esitoCondizioni = false;
                                    break;
                                }

                            }
                            else if (cond.operatore == "NoContain")
                            {
                                //Esecuzione CONDIZIONE che prevede OPERATORE non contiente
                                if (val.ToLower().Contains(cond.valore.ToLower()))
                                {
                                    esitoCondizioni = false;
                                    break;
                                }

                            }
                            else
                            {
                                //Valore numerico probabilmente
                                double valNum;
                                if (Double.TryParse(val, out valNum))
                                {
                                    double valConfronto;
                                    if (Double.TryParse(cond.valore, out valConfronto))
                                    {
                                        if (cond.operatore == ">")
                                        {
                                            //Esecuzione CONDIZIONE che prevede OPERATORE maggiore di
                                            if (valNum <= valConfronto)
                                            {
                                                esitoCondizioni = false;
                                                break;
                                            }
                                        }
                                        else if (cond.operatore == "<")
                                        {
                                            //Esecuzione CONDIZIONE che prevede OPERATORE minore di
                                            if (valNum >= valConfronto)
                                            {
                                                esitoCondizioni = false;
                                                break;
                                            }

                                        }

                                    }
                                    else
                                    {
                                        //Valore di confronto non numerico
                                        esitoCondizioni = false;
                                        break;
                                    }
                                }
                                else
                                {
                                    //Doveva esserci un valore numerico ma ha trovato vuoto, null o un campo diverso da numerico
                                    esitoCondizioni = false;
                                    break;

                                }

                            }
                        }
                        else
                        {
                            esitoCondizioni = false;
                            break;
                        }
                    }
                    else
                    {
                        esitoCondizioni = false;
                        break;
                    }
                }

                if (f.condizioni.Count == 0)
                {
                    //Sto cercando esplicitamente che non ci siano condizioni
                    //Devo quindi assicurarmi che la promo o il tracciato context del record siano vuoti come la richiesta
                    if (promoContext.Count == 0 && tracciatoContext.Count == 0)
                    {
                        esitoCondizioni = true;
                    }

                }

                if (esitoCondizioni) // mi basta che un blocco sia vero per convalidare il filtro
                    return true;
            }


            return false;
        }

        #endregion

        #region Loghi/BolliSfondi

        [HttpGet]
        [Route("FicoProcess/getLoghiBolli")]
        public async Task<IActionResult> getLoghiBolli()
        {
            FicoLoghiBolliResult bRes = new FicoLoghiBolliResult();

            FICOAccessLevel acLevel = await getAccesslevel();

            if (acLevel != FICOAccessLevel.noSession)
            {
                try
                {

                    bRes.content = SingletonConfiguration.DBLOGHIBOLLI!.source;
                    bRes.esito = true;

                }
                catch (Exception ex)
                {
                    bRes.error = ex.Message;
                    bRes.esito = false;
                    return BadRequest(bRes);
                }
            }
            else
            {
                bRes.error = "no_login";
                bRes.esito = false;
                return Unauthorized(bRes);
            }


            return Ok(bRes);
        }
        #endregion

        #region Landing URL Auth
        [HttpPut]
        [Route("FicoProcess/getAuthUrlSchedaPromoLavorazioneToFP")]
        public async Task<IActionResult> getAuthUrlSchedaPromoLavorazioneToFP(FicoRequestSchedaPromoLavorazioneInFP req)
        {
            FicoAuthUrl urlRes = new FicoAuthUrl();

            try
            {

                Int16 session = Int16.Parse(SessionIstantaObject.GetSession(HttpContext));
                if (session > 0)
                {
                    Utenti? me = this.ctx.Utentis.Where(w => w.Id == session).FirstOrDefault();
                    FICOLoginResponse loginFico = await FICOMiddleware.login(olUrl, me!, secretKey, olympusUserPolycy, this.ctx, httpClient);
                    if (loginFico.esito)
                    {

                        //Preparazione
                        FicoAuthUrl ficoUrl = new FicoAuthUrl();


                        FicoAuthUrlMetaData ficoUrlMeta = new FicoAuthUrlMetaData();
                        ficoUrlMeta.queryParams["guidId"] = req.guidIdPromo;
                        ficoUrlMeta.publicKey = loginFico.publicKey!;
                        ficoUrlMeta.route = "/lavorazioni-in-corso/dettagli";

                        string jsonMessage = JsonConvert.SerializeObject(ficoUrlMeta);
                        string cryptedMessage = Crypto.EncryptString(jsonMessage, secretKey);



                        urlRes.url = fpUrl.Replace("/api", "") + "/auth/" + cryptedMessage;


                        urlRes.esito = true;
                    }
                    else
                    {
                        urlRes.error = loginFico.error!;
                    }
                }
                else
                {
                    urlRes.error = "no session";
                    urlRes.esito = false;
                }


            }
            catch (Exception ex)
            {
                urlRes.error = ex.ToString();
            }

            return Ok(urlRes);


        }

        [HttpGet]
        [Route("FicoProcess/getAuthUrlAD/{dest}")]
        public async Task<IActionResult> getAuthUrlAD(string dest)
        {
            FicoAuthUrl urlRes = new FicoAuthUrl();

            if (dest != "fp" && dest != "correggo")
            {
                urlRes.error = "dest_not_valid";
                return Ok(urlRes);
            }

            try
            {
                Int16 session = Int16.Parse(SessionIstantaObject.GetSession(HttpContext));
                if (session > 0)
                {
                    Utenti? me = this.ctx.Utentis.Where(w => w.Id == session).FirstOrDefault();
                    if (/*me.Ruolo == (Byte)ruoloUtente.GDO &&*/ _authAD_options.Value != null && _authAD_options.Value.Provider == "EntraID")
                    {
                        FICOLoginResponse loginFico = await FICOMiddleware.login(olUrl, me!, secretKey, olympusUserPolycy, this.ctx, httpClient);
                        if (loginFico.esito)
                        {
                            me.ADToken = Guid.NewGuid().ToString();
                            me.ADTokenExpiration = DateTime.Now.AddMinutes(5);

                            //Preparazione
                            FicoAuthADUrlMetaData ficoUrlMeta = new FicoAuthADUrlMetaData();
                            ficoUrlMeta.queryParams["email"] = me.Email;
                            ficoUrlMeta.queryParams["policyGroups"] = me.PolicyGroups;
                            ficoUrlMeta.tenantId = _authAD_options.Value.TenantId;
                            ficoUrlMeta.tokenAD = me.ADToken;

                            string jsonMessage = JsonConvert.SerializeObject(ficoUrlMeta);
                            string cryptedMessage = Crypto.EncryptString(jsonMessage, secretKey);
                            if (dest == "fp")
                            {
                                urlRes.url = fpUrl.Replace("/api", "") + "/auth-ad/" + cryptedMessage;
                                Console.WriteLine(urlRes.url);
                            }
                            else if (dest == "correggo")
                            {
                                urlRes.url = ficoConf.Value.correggoServerUrl + "/authAD.ashx?k=" + cryptedMessage;
                            }

                            await this.ctx.SaveChangesAsync();
                            urlRes.esito = true;
                        }
                        else
                        {
                            urlRes.error = loginFico.error!;
                        }
                    }
                    else
                    {
                        if (dest == "fp")
                        {
                            urlRes.url = ficoConf.Value.fpServerUrl.Replace("/api", "/login");
                        }
                        else if (dest == "correggo")
                        {
                            urlRes.url = ficoConf.Value.correggoServerUrl;
                        }
                        urlRes.esito = true;
                    }
                }
                else
                {
                    urlRes.error = "no session";
                    urlRes.esito = false;
                }


            }
            catch (Exception ex)
            {
                urlRes.error = ex.ToString();
            }

            return Ok(urlRes);


        }

        [HttpGet]
        [Route("FicoProcess/Auth/{authUrl}")]
        public async Task<IActionResult> Auth(string authUrl)
        {
            //Da implementare
            return Ok();
        }

        [HttpGet]
        [Route("FicoProcess/AuthLanded")]
        public async Task<IActionResult> AuthLanded()
        {
            //Questa chiamata serve solo per permettere al servizio di registrare l'atterraggoi, è paragonabile al ping pong 
            //ma in uqesto caso passando per il middleware una volta arrivato qui è già assodato che la sessione è stata già registrata
            BoolResult bRes = new BoolResult();
            bRes.Esito = true;

            return Ok(bRes);
        }

        [HttpGet]
        [Route("FicoProcess/AuthADLanded")]
        public async Task<IActionResult> AuthADLanded()
        {
            //Questa chiamata serve solo per permettere al servizio di registrare l'atterraggoi, è paragonabile al ping pong 
            //ma in uqesto caso passando per il middleware una volta arrivato qui è già assodato che la sessione è stata già registrata

            //LEggo il Bearer
            Request.Headers.TryGetValue("ADToken", out var token);
            BoolResult bRes = new BoolResult();
            if (token != "")
            {
                Utenti user = this.ctx.Utentis.FirstOrDefault(f => f.ADToken == token.ToString());
                if (user != null)
                {
                    if (user.ADTokenExpiration < DateTime.Now)
                    {
                        bRes.Esito = false;
                        bRes.error = "token_expired";
                    }
                    else
                    {
                        //Cambio il tken così nessun altro lo puo utilizzare
                        user.ADToken = Guid.NewGuid().ToString();
                        await this.ctx.SaveChangesAsync();

                        bRes.Esito = true;
                    }
                }
                else
                {
                    bRes.Esito = false;
                    bRes.error = "user_not_found";
                }

            }
            else
            {
                bRes.Esito = false;
                bRes.error = "no_token";

            }


            return Ok(bRes);
        }


        #endregion

        #region Correggo

        //Chaiamta che recupera la sched ref di una ref impaginata
        //Chiede guidId di lavorazione e codice gruppo della ref

        [HttpPut]
        [Route("FicoProcess/getSchedaRef")]
        public async Task<IActionResult> getSchedaRef([FromBody] SchedaRefRequestFromCorreggo request)
        {
            ArticoloInRevisioneKitResult result = new ArticoloInRevisioneKitResult();

            FICOAccessLevel acLevel = await getAccesslevel();

            if (acLevel != FICOAccessLevel.noSession)
            {
                try
                {
                    //if (acLevel == FICOAccessLevel.guestFico)
                    //{
                    PromoLavorazioni? plItem = await this.ctx2.PromoLavorazionis.FirstOrDefaultAsync(pl => pl.GuidId == request.guidIdLavorazione);
                    if (plItem != null)
                    {
                        MenaboController menaboController = new MenaboController(null, this.config, optionExternalLib, null, this.httpClientFactory, null, null, this.ficoConf, this._dbContextFactory, dbContextFactory2: this._dbContextFactory2);
                        var resultFromMenabo = await menaboController.getSchedaRef(request.codiceGruppo!, plItem.Id, request.idRec, false, FicoCombinazioneKitReadMode.Advanced);
                        if (resultFromMenabo is OkObjectResult && (resultFromMenabo as OkObjectResult)!.Value is ArticoloInRevisioneKitResult)
                        {
                            result = ((resultFromMenabo as OkObjectResult)!.Value as ArticoloInRevisioneKitResult)!;
                            if (!result.esito)
                            {
                                throw new Exception("Esito negativo dell'operazione: " + result.error);
                            }
                        }
                        else
                        {
                            throw new Exception("Operazione fallita");

                        }
                    }
                    else
                    {
                        throw new Exception($"GuidId {request.guidIdLavorazione} non trvato!");
                    }
                    //}
                }
                catch (Exception ex)
                {
                    result.error = ex.Message;
                    result.esito = false;
                    return Ok(result);
                }
            }
            else
            {
                result.error = "no_login";
                result.esito = false;
                return Unauthorized(result);
            }


            return Ok(result);
        }

        [HttpGet]
        [Route("FicoProcess/getAllFotoByCodice/{codice}")]
        public async Task<IActionResult> getAllFotoDByCodice(string codice)
        {
            AllFotoRequestByCorreggo_Response result = new AllFotoRequestByCorreggo_Response();



            FICOAccessLevel acLevel = await getAccesslevel();

            if (acLevel != FICOAccessLevel.noSession)
            {
                try
                {

                    Articoli? artItem = await this.ctx.Articolis.Include(i => i.ArticoliFotos).FirstOrDefaultAsync(a => a.Codice == codice);

                    if (artItem != null)
                    {
                        var obj = artItem.ArticoliFotos!.Where(f => f.Tipo == (Byte)TipoFoto.Foto).OrderByDescending(ord => ord.DataModifica).Select(s => new
                        {
                            GuidId = s.GuidId,
                            Nome = s.NomeReale,
                        });

                        result.result = JsonConvert.SerializeObject(obj);
                    }
                    else
                    {
                        throw new Exception($"{codice} non trovato");
                    }

                }
                catch (Exception ex)
                {
                    result.error = ex.Message;
                    return BadRequest(result);
                }
            }
            else
            {
                result.error = "no_login";
                return Unauthorized(result);
            }


            return Ok(result);
        }

        //Conferma foto e selezioni p/s
        [HttpPut]
        [Route("FicoProcess/correggiFotoESelezioniFromCorreggo")]
        public async Task<IActionResult> correggiFotoESelezioniFromCorreggo([FromBody] ModificaFotoESelezioneCorreggoRequest request)
        {
            ModificaFotoESelezioneCorreggoResponse result = new ModificaFotoESelezioneCorreggoResponse();

            FICOAccessLevel acLevel = await getAccesslevel();

            if (acLevel != FICOAccessLevel.noSession)
            {
                try
                {
                    PromoLavorazioni? plItem = await this.ctx2.PromoLavorazionis.FirstOrDefaultAsync(pl => pl.GuidId == request.guidIdLavorazione);
                    if (plItem != null)
                    {
                        PromoLavorazioniRecord? plrItem = null;
                        if (request.idRec == 0)
                        {
                            plrItem = await this.ctx2.PromoLavorazioniRecords.FirstOrDefaultAsync(plr => plr.CodiceGruppo == request.codice);
                        }
                        else
                        {
                            plrItem = await this.ctx2.PromoLavorazioniRecords.FirstOrDefaultAsync(plr => plr.IdRecordTracciato == request.idRec && plr.CodiceGruppo == request.codice);
                        }
                        if (plrItem != null)
                        {
                            ArticoloInRevisioneKitResult? resultScheda = null;

                            MenaboController menaboController = new MenaboController(null, this.config, optionExternalLib, null, this.httpClientFactory, null, null, this.ficoConf, this._dbContextFactory, dbContextFactory2: this._dbContextFactory2);
                            var resultFromMenabo = await menaboController.getSchedaRef(request.codice!, plItem.Id, request.idRec, false, FicoCombinazioneKitReadMode.Advanced);
                            if (resultFromMenabo is OkObjectResult && (resultFromMenabo as OkObjectResult)!.Value is ArticoloInRevisioneKitResult)
                            {
                                resultScheda = (resultFromMenabo as OkObjectResult)!.Value as ArticoloInRevisioneKitResult;
                                if (!resultScheda!.esito)
                                {
                                    throw new Exception("Esito negativo della lettura scheda: " + result.error);
                                }
                            }
                            else
                            {
                                throw new Exception("Operazione fallita di lettura scheda");

                            }

                            //Controllo che la foto sia stata caricata
                            foreach (var foto in request.foto!)
                            {
                                var artItem = await this.ctx.Articolis.Include(inc => inc.ArticoliFotos).FirstOrDefaultAsync(f => f.Codice == foto.codice);

                                if (foto.stato != StatoSelezioneFotoCorreggo.ExtraEntrante && foto.stato != StatoSelezioneFotoCorreggo.ExtraUscente)
                                {
                                    ArticoloInKit? artInKit = resultScheda.records.Where(s => s.recordInTracciato[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString() == foto.codice).FirstOrDefault();

                                    string kFoto = Enum.GetName(AddestramentoRuoli.Foto) + "." + GLOBAL_VARIABLES.keyFotoGuidId;
                                    string? guididFoto = artInKit!.recordInTracciato.ContainsKey(kFoto)?artInKit!.recordInTracciato[Enum.GetName(AddestramentoRuoli.Foto) + "." + GLOBAL_VARIABLES.keyFotoGuidId].ToString():"";

                                    //Controllo se la sua foto attuale coincide al guidid, altrimenti devo cambiarla
                                    if (guididFoto != foto.guidid)
                                    {
                                        ArticoliFoto? fotoItemIndicata = this.ctx.ArticoliFotos.FirstOrDefault(f => f.GuidId == foto.guidid);
                                        if (fotoItemIndicata != null)
                                        {
                                            //Cambio solo la data
                                            fotoItemIndicata.StatoSelezione = (byte)StatoSelezioneFoto.Primaria;
                                            fotoItemIndicata.DataModifica = DateTime.Now;
                                            fotoItemIndicata.Attiva = true;
                                        }
                                        else
                                        {
                                            //Altrimenti la genero
                                            ArticoliFoto nuovaFoto = new ArticoliFoto();
                                            nuovaFoto.IdArticolo = artItem!.Id;
                                            nuovaFoto.NomeReale = foto.nomeFile!;
                                            nuovaFoto.PathFoto = foto.nomeFile!;
                                            nuovaFoto.StatoSelezione = (byte)StatoSelezioneFoto.Primaria;
                                            nuovaFoto.Attiva = true;
                                            nuovaFoto.Hash = foto.md5;
                                            nuovaFoto.DataInserimento = DateTime.Now;
                                            nuovaFoto.DataModifica = DateTime.Now;
                                            nuovaFoto.GuidId = foto.guidid!;
                                            nuovaFoto.Tipo = (Byte)TipoFoto.Foto;

                                            this.ctx.ArticoliFotos.Add(nuovaFoto);

                                        }



                                        ////Registro operazione
                                        ////Al momento commentiamola per non rischiare!
                                        //Register register = new Register(this.connString);
                                        //var session = SessionIstantaObject.GetSession(HttpContext);


                                        //var nuovaOperazione = new RegistroOperazioni();
                                        //nuovaOperazione.Autore = int.Parse(session);
                                        //nuovaOperazione.TipoOperazione = (byte)tipoOperazione.updateFoto;// tipoOperazione.updateFoto;
                                        //nuovaOperazione.CodiceAssociato = foto.codice;
                                        //nuovaOperazione.Url = "FicoProcess/correggiFotoESelezioniFromCorreggo";
                                        //nuovaOperazione.FormData = JsonConvert.SerializeObject(new RevisioneFotoFromIndd() { codRef = foto.codice, nomeFoto = foto.nomeFile, tipo = TipoFoto.Foto, guidId = foto.guidid });
                                        //nuovaOperazione.idPromoLavorazioniRecord = plrItem.Id;


                                        //int idAttivita = (int)register.addOperazione(nuovaOperazione, true, session, DateTime.Now);
                                        //if (idAttivita == 0)
                                        //{
                                        //    throw new Exception("Errore generico durante la registrazione dell'operazione di update foto");
                                        //}

                                        this.ctx.SaveChanges();

                                    }
                                }

                                //Quin andrebbe implementata la funzione di agggiungere al reord di lavorazione le alterazioni p/s ed eventuali logi entranti o uscenti quali sno
                            }

                            //Controllo che le selezioni siano state caricate
                            //if (request.selezioni != null && request.selezioni.Count > 0)
                            //{
                            //plrItem.Meta = JsonConvert.SerializeObject(request.selezioni);
                            //}

                            //this.ctx2.PromoLavorazioniRecords.Update(plrItem);
                            await this.ctx2.SaveChangesAsync();
                        }
                        else
                        {
                            throw new Exception($"Codice gruppo {request.codice} non trovato");
                        }
                    }
                    else
                    {
                        throw new Exception($"Lavorazione {request.guidIdLavorazione} non trovata");
                    }

                    result.esito = true;

                }
                catch (Exception ex)
                {
                    result.error = ex.Message;
                    result.esito = false;
                    return BadRequest(result);
                }
            }
            else
            {
                result.error = "no_login";
                result.esito = false;
                return Unauthorized(result);
            }


            return Ok(result);
        }

        [HttpGet]
        [Route("FicoProcess/getAllFotoExtra/{filter}")]
        public async Task<IActionResult> getAllFotoExtra(Byte filter)
        {

            //Filter
            //0:All
            //1: Solo loghi
            //2: Solo bolli
            //3: Solo loghi e bolli
            LoghiBolliPerCorreggo result = new LoghiBolliPerCorreggo();

            FICOAccessLevel acLevel = await getAccesslevel();

            if (acLevel != FICOAccessLevel.noSession)
            {
                try
                {


                    DbLoghiBolli? objLoghiBolli = Utility.SingletonConfiguration.DBLOGHIBOLLI;

                    var tipoMask = new Dictionary<TipoFoto, byte>();
                    if (filter == 1)
                    {
                        tipoMask[TipoFoto.Logo] = 1;
                    }
                    else if (filter == 2)
                    {
                        tipoMask[TipoFoto.Bollino] = 2;
                    }
                    else if (filter == 3)
                    {
                        tipoMask[TipoFoto.Logo] = 1;
                        tipoMask[TipoFoto.Bollino] = 2;
                    }

                    // Usare filter per cambiare la query
                    result.list = objLoghiBolli.source
                        .Where(lb => filter == 0 || (tipoMask.TryGetValue(lb.tipo, out var bit) && (filter & bit) != 0))
                        .ToList();

                }
                catch (Exception ex)
                {
                    result.error = ex.Message;
                    return BadRequest(result);
                }
            }
            else
            {
                result.error = "no_login";
                return Unauthorized(result);
            }

            return Ok(result);
        }

        #endregion

        #region Momenti FP
        [HttpPost("FicoProcess/analisiMomento")]
        public async Task<IActionResult> analisiMomento([FromBody] AnalisiMomentoRequest request)
        {

            AnalisiMomentoResponse result = new AnalisiMomentoResponse();

            try
            {

                FICOAccessLevel acLevel = await getAccesslevel();

                if (acLevel != FICOAccessLevel.noSession)
                {

                    if (request == null)
                    {
                        result.errors = "Request is null";
                        return BadRequest(result);
                    }

                    if (request.snapshot)
                    {
                        //Recupero di tutti i tracciati della promo e dei records meta
                        var pItem = this.ctx2.Promos.Include(i1 => i1.PromoTracciatis).Where(p => p.guidID == request.guidPromo).FirstOrDefault();
                        if (pItem == null)
                        {
                            result.errors = $"Promo con guid {request.guidPromo} non trovata";
                            return BadRequest(result);
                        }

                        foreach (PromoTracciati trItem in pItem.PromoTracciatis)
                        {
                            var _recs = this.ctx2.PromoTracciatiRecords.Where(p => p.IdTracciato == trItem.Id).ToList();
                            var LabVer = _recs.GroupBy(g => new
                            {
                                Label = g.Label,
                                Version = g.Versione
                            }).ToList();

                            //Prendere ultima verisone er ogni label
                            List<PromoTracciatiRecord> _records = new List<PromoTracciatiRecord>();
                            foreach (var _it in LabVer.OrderByDescending(o => o.Key.Version))
                            {
                                if (_records.Count(c => c.Label == _it.Key.Label) <= 0)
                                {
                                    _records.AddRange(_it.ToList());
                                }
                            }

                            AnalisiMomentoTracciatoDetails trDetails = new AnalisiMomentoTracciatoDetails();
                            trDetails.guidArea = trItem.guidArea;
                            trDetails.guidCanale = trItem.guidCanale;
                            trDetails.context = trItem.Context;
                            trDetails.records = _records.Select(s => Utility.Main.getJsonObject(s.Dato)).ToList();
                            result.tracciati.Add(trDetails);

                        }
                    }
                    else
                    {
                        foreach (string guidid in request.listeCaricate)
                        {
                            PromoImportazioni? pImp = this.ctx2.PromoImportazionis.Where(imp => imp.guidID== guidid).FirstOrDefault();

                            if (pImp == null)
                            {
                                result.errors += $"\nImportazione con guid {guidid} non trovata";
                                return BadRequest(result);
                            }

                            Attivitum aItem = this.ctx.Attivita.FirstOrDefault(a => a.Id == pImp.IdAttivita);
                            if (aItem==null)
                            {
                                result.errors += $"\nAttività {pImp.IdAttivita} non trovata";
                                return BadRequest(result);
                            }

                            OperationRequest opReq = JsonConvert.DeserializeObject<OperationRequest>(aItem.Contract)!;
                            string? strpkg = opReq!.Packet.ToString();
                            InputFormTracciato packet = JsonConvert.DeserializeObject<InputFormTracciato>(strpkg!)!;
                            string idLabel = packet.getFieldByKey("idLabel");
                            List<FicoContextField> context = opReq!.context;
                            string path_attivita = pathToImport + pImp.IdAttivita + System.IO.Path.DirectorySeparatorChar;
                            string source = path_attivita + packet!.filename;

                            int idAdstr;
                            Int32.TryParse(packet.getFieldByKey("idAddestramento"), out idAdstr);

                            ConfrontiController cc = new ConfrontiController(null, config, this._option_import, null, this.optionExternalLib, this.ficoConf, this._dbContextFactory, dbContextFactory2: this._dbContextFactory2);
                            ImportResult? parsingRes = cc.leggiDatoExcel(pImp!, source, idLabel, packet, context, idAdstr);

                            if (parsingRes!.errors != "")
                            {
                                result.errors +=$"\nLIB ERROR#{parsingRes.errors}#";
                                return BadRequest(result);
                            }

                            List<PromoTracciati> _promo_tracciati_esistenti = this.ctx2.PromoTracciatis.Where(p => p.IdPromo == pImp!.IdPromo).ToList();


                            foreach (Dictionary<string, object> lista in parsingRes.liste!)
                            {
                                string areaKeyGuid = GLOBAL_VARIABLES.keyAreaGuid;
                                string canaleKeyGuid = GLOBAL_VARIABLES.keyCanaleGuid;

                                //Controllo se esiste il tracciato                                
                                string guidCanale = lista[canaleKeyGuid].ToString();
                                string guidArea = lista[areaKeyGuid].ToString();
                                string ctx = JsonConvert.SerializeObject(context);

                                AnalisiMomentoTracciatoDetails trDetails = result.tracciati.FirstOrDefault(
                                    t=>t.guidArea==guidArea && t.guidCanale==guidCanale && t.context==ctx);

                                var _recs = lista["Records"];
                                var recs = (_recs as JArray)!.ToObject<List<Dictionary<string, object>>>();

                                if (trDetails == null)
                                {
                                    trDetails = new AnalisiMomentoTracciatoDetails();
                                    trDetails.guidArea = guidArea;
                                    trDetails.guidCanale = guidCanale;
                                    trDetails.context = ctx;


                                    trDetails.records = recs;
                                    result.tracciati.Add(trDetails);
                                }
                                else
                                {
                                    trDetails.records.AddRange(recs);
                                }

                            }
                        }
                    }
                }
                else
                {
                    result.errors = $"Sessione utente non valida";
                    return Unauthorized(result);
                }


                result.esito = true;

            }
            catch(Exception ex)
            {
                result.errors = ex.ToString(); 
                return BadRequest(result);
            }

            return Ok(result);
        }

        [HttpPost("FicoProcess/analisiConfronto")]
        public async Task<IActionResult> analisiConfronto()
        {
            AnalisiConfrontoResponse result = new AnalisiConfrontoResponse();
            try
            {
                using var ms = new MemoryStream();
                await Request.Body.CopyToAsync(ms);

                byte[] data = ms.ToArray();

                //Leggi i bytes e converti il json contenuto al suo interno in un oggetto
                string source = System.Text.ASCIIEncoding.UTF8.GetString(data);
                AnalisiConfrontoRequest req = JsonConvert.DeserializeObject<AnalisiConfrontoRequest>(source);

                IstantaController icCtrl = new IstantaController("", this.extarnalLibPath, this.extarnalSourcePath, this._dbContextFactory);
                Dictionary<string, object> _pass = new Dictionary<string, object>();
                _pass["primario"] = req.primario;
                _pass["secondario"] = req.secondario;
                _pass["controlloVersione"] = false;//deprecato           
                _pass["reqParams"] = new Dictionary<string, string>();
                result = icCtrl.execLibFunction($"AgenziaLib.{this.ficoConf.Value.nomeCliente!}.confrontaListe", _pass) as AnalisiConfrontoResponse;

                result.esito = true;
            }
            catch(Exception ex)
            {
                result.esito = false;
                result.errors = ex.ToString();
                return BadRequest(result);
            }

            return Ok(result);
        }

        #endregion

    }
}
