using DocumentFormat.OpenXml.Office.CustomUI;
using DocumentFormat.OpenXml.Spreadsheet;
using DocumentFormat.OpenXml.Wordprocessing;
using Istanta.Antlr;
using Istanta.Models;
using Istanta.Models_2;
using Istanta.Utility;
using IstantaLib;
using LinqKit;
using Microsoft.AspNetCore.JsonPatch.Operations;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO.Compression;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Security.Policy;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks.Dataflow;
using static System.Net.WebRequestMethods;

namespace Istanta.Controllers
{
    public class SyncFotoController : Controller
    {

        private readonly ILogger<SyncFotoController> _logger;
        private readonly edro21_dbContext ctx;
        private readonly Edro21_DbContext2 ctx2;
        private readonly IConfiguration _config;
        private readonly string path_external_source = "";
        private readonly string extract_sync_path;
        private readonly string[] ext_pre_lavorazione;
        private readonly string[] ext_post_lavorazione;
        private readonly string connstring;
        private readonly string olympusServerUrl;
        private readonly HttpClient httpClient;
        private readonly IOptions<SyncOptions> _syncOptions;
        private FicoProcessController? ficoController;
        private readonly IMemoryCache? _cache;
        private readonly IOptions<PathExternal> _external_lib;
        private readonly IOptions<FicoConfig> _olConfig;
        private readonly IOptions<PathOperationExport> _exportPath;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IDbContextFactory<edro21_dbContext> _dbContextFactory;

        private readonly IDbContextFactory<Edro21_DbContext2> _dbContextFactory2;
        public SyncFotoController(ILogger<SyncFotoController> logger, IConfiguration configuration, IOptions<PathOperationExport> option_export, IOptions<PathExternal> external_lib, IOptions<SyncOptions> sync_options, IOptions<FicoConfig> olConfig, IHttpClientFactory httpClientFactory,  IMemoryCache memoryCache, IOptions<AntlrOptions> antlr_options, IDbContextFactory<edro21_dbContext> dbContextFactory, IDbContextFactory<Edro21_DbContext2> dbContextFactory2)
        {
            this._dbContextFactory2 = dbContextFactory2;
            this._dbContextFactory = dbContextFactory;
            this.ctx = this._dbContextFactory.CreateDbContext();
            //this.ctx = new edro21_dbContext(configuration.GetConnectionString("IstandaConnectionDb")!);
            this.ctx2 = this._dbContextFactory2.CreateDbContext();
            _logger = logger;
            _config = configuration;
            path_external_source = external_lib.Value.pathSource;

            extract_sync_path = sync_options.Value.extractPath;
            ext_pre_lavorazione = sync_options.Value.extPreLavorazione!;
            ext_post_lavorazione = sync_options.Value.extPostLavorazione!;

            connstring = configuration.GetConnectionString("IstandaConnectionDb")!;
            olympusServerUrl = olConfig.Value.olympusServerUrl;

            httpClient = httpClientFactory.CreateClient();
            this._syncOptions = sync_options;

            if (memoryCache != null)
                this._cache = memoryCache;

            this._external_lib = external_lib;
            this._exportPath = option_export;
            this._olConfig = olConfig;
            this._httpClientFactory = httpClientFactory;


            ViewData["jsGuid"] = Guid.NewGuid().ToString();
        }

        public IActionResult Index()
        {
            this.Bind();

            return View();
        }

        public IActionResult LoghiBolli()
        {
            ViewBag.ipOlympus = this.olympusServerUrl;
            return View();
        }

        public IActionResult Registro()
        {
            return View();
        }


        private void Bind()
        {
            List<PromoTracciati> tuttiITracciati = new List<PromoTracciati>();
            List<Promo> tutteLePromo = new List<Promo>();
            //foreach (Promo pItem in this.ctx2.Promos.Include(i => i.PromoTracciatis).Include(i2 => i2.PromoImportazionis).Where(p => p.DataScadenza.HasValue && p.DataScadenza.Value >= DateTime.Now))
            foreach (Promo pItem in this.ctx2.Promos.Where(p => p.DataScadenza.HasValue && p.DataScadenza.Value >= DateTime.Now))
            {
                //tuttiITracciati.AddRange(pItem.PromoTracciatis.ToList());
                tutteLePromo.Add(pItem);
            }

            //ViewBag.TracciatiAperti = tuttiITracciati;
            ViewBag.PromoAperte = tutteLePromo;
            ViewBag.ipUploadGate = this._syncOptions.Value.ipUploadGate;
            ViewBag.ipOlympus = this.olympusServerUrl;
        }

        //Funzione che riceve uno zip e lo salva su disco
        [HttpPost]
        [Route("SyncFoto/UploadFileZip")]
        [DisableRequestSizeLimit]
        [RequestFormLimits(MultipartBodyLengthLimit = long.MaxValue)]
        public async Task<IActionResult> UploadFileZip([FromForm] InputFotoSync fileObj)
        {
            ScanResult result = new ScanResult();

            LogAssistent logAss=new LogAssistent();

            try
            {

                Stream str = fileObj.file!.OpenReadStream();
                byte[] arrBytes = new byte[str.Length];
                str.ReadExactly(arrBytes, 0, (int)str.Length);

                string filename = DateTime.Now.ToString("dd_MM_yyyy_HH_mm_ss") + "_" + Guid.NewGuid();
                string pathToExtract = Path.Combine(extract_sync_path, filename + ".zip");

                using (var stream = new FileStream(pathToExtract, FileMode.Create))
                {
                    stream.Write(arrBytes,0,arrBytes.Length);//.CopyToAsync(stream);
                }

                result.filename = filename;


            }
            catch (Exception ex)
            {
                result.error = ex.ToString();

            }


            return Json(result);
        }
        
        //[RequestSizeLimit(long.MaxValue)]
        //[RequestFormLimits(MultipartBodyLengthLimit = long.MaxValue)]
        [HttpPut]//[HttpPost]
        ///[Route("SyncFoto/ScanPacchettoFoto/{idFiltroTracciato}/{packageName}/{workDir}")]
        [Route("SyncFoto/ScanPacchettoFoto")]
        public async Task<IActionResult> ScanPacchettoFoto(ScanFileRequest req)//Int32 idFiltroTracciato,string packageName, string workDir)//([FromForm] IFormFile fileZip, Int32 idFiltroTracciato)
        {
            SyncFileOperation result = new SyncFileOperation();
            result.guidid = Guid.NewGuid().ToString();
            // Volutamente NON atteso: il client riceve subito il guid e poi interroga lo stato.
            // Senza questo ContinueWith, un'eccezione dentro il lavoro in background sparirebbe.
            _ = ScanPacchettoFoto_do(req, result.guidid).ContinueWith(t =>
                _logger.LogError(t.Exception, "ScanPacchettoFoto_do fallita, guid {Guid}", result.guidid),
                TaskContinuationOptions.OnlyOnFaulted);

            return Ok(result);
        }

        private async Task ScanPacchettoFoto_do(ScanFileRequest req, string guidid)
        {

            SyncFileOperation result = new SyncFileOperation();
            result.guidid = guidid;

            string debugString_filename = "";
            result.originDir = req.originDir;

            LogAssistent logAss = new LogAssistent();

            //Creo pattern delle queryIndexRules
            AntlrPattern patt = new AntlrPattern();
            List<int> lista_indici_a_sistema = new List<int>();
            if (this._syncOptions.Value.delimitersIndexRules != null && this._syncOptions.Value.delimitersIndexRules.Count() > 0)
            {
                lista_indici_a_sistema = this._syncOptions.Value.delimitersIndexRules.GroupBy(g => g.indice).Select(s => s.Key).ToList();

                patt.livelli = new List<AntlrPatternLevels>();

                AntlrPatternLevels level = new AntlrPatternLevels();
                level.patterns = new List<AntlrPatternLevelsNode>();
                level.nome = "IndexRules";
                _syncOptions.Value.delimitersIndexRules?.ForEach(delimRule =>
                {
                    AntlrPatternLevelsNode node = new AntlrPatternLevelsNode()
                    {
                        condizione = delimRule.rule,
                        valore = delimRule.output
                    };
                    level.patterns.Add(node);
                });
                patt.livelli.Add(level);
            }

            AntlrController antlrController = new AntlrController(patt);
            //Creo pattern delle queryIndexRules

            try
            {

                List<SyncFile> scan_result = new List<SyncFile>();

                //string staticFolderTest = packageName;// "";
                List<SyncFile> fileProcessatiDict = new List<SyncFile>();

                logAss.WriteLine($"Richiesta scansione foto");

                //if (staticFolderTest == "")
                //{
                //    result.jobName = DateTime.Now.ToString("dd_MM_yyyy_HH_mm_ss");
                //    string pathToExtract = Path.Combine(extract_sync_path, result.jobName);
                //    Directory.CreateDirectory(pathToExtract);
                if (req.workDir == "0")
                {
                    foreach (string zipFilePkgName in req.packagesName!)
                    {

                        logAss.WriteLine($"Pacchetto {zipFilePkgName}");

                        try
                        {
                            string zipFilePath = System.IO.Path.Combine(extract_sync_path, zipFilePkgName + ".zip");
                            string pathToExtract = System.IO.Path.Combine(extract_sync_path, zipFilePkgName);
                            logAss.WriteLine($"Estrazione {zipFilePath} in {pathToExtract}");

                            Directory.CreateDirectory(pathToExtract);


                            using (Stream strZip = new FileStream(zipFilePath, FileMode.Open))
                            {
                                using (ZipArchive archive = new ZipArchive(strZip))
                                {
                                    foreach (ZipArchiveEntry entry in archive.Entries)
                                    {
                                        try
                                        {
                                            string fsName = Path.Combine(pathToExtract, entry.FullName);

                                            if (!Directory.Exists(fsName))
                                            {
                                                //Estraggo dallo zip poichè ancora non è stata estratta
                                                await entry.ExtractToFileAsync(fsName);
                                            }

                                            string onlyName = Path.GetFileName(fsName);


                                            SyncFile fs = new SyncFile()
                                            {
                                                filename = onlyName,
                                                queryFilename = "",// (onlyName.IndexOf('_') > 0) ? onlyName.Substring(1, onlyName.IndexOf('_') - 1) : "",
                                                md5 = Crypto.GetMD5HashFromFile(System.IO.File.ReadAllBytes(fsName)),
                                                stato = StatoSyncFile.Scanned,
                                                id = 0,
                                                zipDirOrigin = zipFilePkgName
                                            };

                                            fileProcessatiDict.Add(fs);
                                        }
                                        catch (Exception exSilenzioso)
                                        {
                                            _logger.LogWarning(exSilenzioso, "eccezione ingoiata in SyncFotoController.cs riga ~282");
                                        }
                                    }
                                }
                            }
                        }
                        catch (Exception ex)
                        {
                            logAss.WriteLine("Errore estrazione del pacchetto: " + ex.ToString());
                            result.error += "Errore estrazione del pacchetto: " + ex.ToString() + "\n";
                        }

                    }
                }
                else
                {

                    //result.jobName = req.workDir;

                    foreach (string zipFilePkgName in req.packagesName!)
                    {
                        //string path = Path.Combine(extract_sync_path, req.workDir);
                        string path = Path.Combine(extract_sync_path, zipFilePkgName);
                        foreach (string entry in Directory.GetFiles(path))
                        {

                            string onlyName = Path.GetFileNameWithoutExtension(entry);
                            string fullname = Path.GetFileName(entry);
                            SyncFile fs = new SyncFile()
                            {
                                filename = fullname,
                                queryFilename = onlyName,//(onlyName.IndexOf('_') > 0) ? onlyName.Substring(1, onlyName.IndexOf('_') - 1) : "",
                                md5 = Crypto.GetMD5HashFromFile(System.IO.File.ReadAllBytes(entry)),
                                stato = StatoSyncFile.Scanned,
                                id = 0,
                                zipDirOrigin = zipFilePkgName
                            };

                            fileProcessatiDict.Add(fs);

                        }
                    }
                }


                List<string> filtro_nomeFoto_tracciato = new List<string>();
                List<string> filtro_codici_tracciato = new List<string>();
                List<string> filtro_ean_tracciato = new List<string>();
                //var filtro_codici_tracciato = new List<dynamic>();
                if (req.idFiltroTracciato > 0)
                {
                    List<string> codiciDaTracciato = this.ctx2.PromoTracciatiRecords.Where(ptr => ptr.IdTracciato == req.idFiltroTracciato).Select(s => s.Codice).ToList()!;

                    var filtro_art_tracciato = this.ctx.Articolis.Where(art2 => codiciDaTracciato.Contains(art2.Codice)).Select(
                        s => new
                        {
                            id = s.Id,
                            codice = s.Codice,
                            ean = s.Ean != null ? s.Ean : "<null>"
                        }
                    ).ToList();

                    filtro_codici_tracciato = filtro_art_tracciato.Select(s => s.codice).ToList();
                    filtro_ean_tracciato = filtro_art_tracciato.Select(s => s.ean).ToList();

                    List<Int64> inx_filtro_ids = filtro_art_tracciato.Select(s => s.id).ToList();
                    //this.ctx2.PromoTracciatiRecords.Where(ptr => ptr.IdTracciato == idFiltroTracciato).Select(s => s.Codice).ToList();
                    filtro_nomeFoto_tracciato = this.ctx.ArticoliFotos.Include(i => i.IdArticoloNavigation).Where(af => inx_filtro_ids.Contains(af.IdArticolo)).Select(s => s.NomeReale).ToList();// filtro_codici_tracciato.Contains(af.IdArticoloNavigation.Codice)).Select(s => s.NomeReale).ToList();
                }

                var isFiltroTraccaitoMatched = (string nome_reale, Articoli? artArchivio, string codiceNuovo) =>
                {
                    bool testNomeFoto = filtro_nomeFoto_tracciato.Contains(nome_reale);
                    if (artArchivio != null)
                    {
                        bool testCod1 = filtro_codici_tracciato.Contains(artArchivio.Codice);
                        bool testEan1 = filtro_ean_tracciato.Contains(artArchivio.Ean!);
                    }
                    else
                    {
                        bool testCod2 = filtro_codici_tracciato.Contains(codiceNuovo);
                        bool testEan2 = filtro_ean_tracciato.Contains(codiceNuovo);
                    }

                    return (req.idFiltroTracciato == 0 ||
                     (
                         filtro_nomeFoto_tracciato.Contains(nome_reale) ||

                         (
                             artArchivio != null &&
                             (
                                filtro_codici_tracciato.Contains(artArchivio.Codice) ||
                                filtro_ean_tracciato.Contains(artArchivio.Ean!)
                             )
                         )

                         ||

                         (
                             artArchivio == null &&
                             (
                                filtro_codici_tracciato.Contains(codiceNuovo) ||
                                filtro_ean_tracciato.Contains(codiceNuovo)
                             )

                         )

                     ));
                };


                foreach (SyncFile file in fileProcessatiDict)
                {
                    //Escludo dal nome, l'estensione del file
                    debugString_filename = file.filename;

                    string name = "";

                    try
                    {

                        name = file.filename.Substring(0, file.filename.LastIndexOf("."));
                        if (file.queryFilename != null && file.queryFilename != "")
                        {
                            name = file.queryFilename;
                        }
                    }
                    catch (Exception ex)
                    {
                        logAss.WriteLine("Errore di elaborazione file " + file.filename + ":" + ex.ToString());
                    }

                    if (name == "")
                        continue;

                    //Console.WriteLine("Cerco il la foto per CODICE: " + name);

                    if (this._syncOptions.Value.delimitersQuery!.Count() > 0)
                    {
                        foreach (string delimiter in this._syncOptions.Value.delimitersQuery!)
                        {
                            //Console.WriteLine("Splitto per: " + delimiter);

                            string[] p_name = name.Split(delimiter, StringSplitOptions.RemoveEmptyEntries);
                            if (p_name.Length > 0)
                            {
                                //Di defualt prendiamo il primo elemento del nome splittato
                                name = p_name[0];
                                //Ma controlliamo se esistono delle regole specifiche per indici diversi e accodiamo tutti i loro output a questo risultato consolidato
                                if (this._syncOptions.Value.delimitersIndexRules != null && this._syncOptions.Value.delimitersIndexRules.Count() > 0)
                                {

                                    foreach (int indice in lista_indici_a_sistema.OrderBy(o => o))
                                    {
                                        if (p_name.Length > indice)
                                        {
                                            string outputRule = antlrController.ParseInputByPattern(new Dictionary<string, object>()
                                            {
                                                { "indice", indice },
                                                { "val" , p_name[indice]}
                                            });

                                            if (outputRule != "")
                                            {
                                                name += outputRule;
                                            }

                                        }
                                    }

                                }
                            }
                        }
                    }

                    //Console.WriteLine("Dopo analisi delimiter il nome cercato è: " + name);

                    //Controllo per ogni file se c'è corrispondenza in archivio e quindi possibilità di aggancio



                    Articoli? artArchivio = null;

                    string nome_reale = file.filename;
                    var _candidatiConQuestoNome = await this.ctx.ArticoliFotos.Include(ii => ii.IdArticoloNavigation).Where(f => f.NomeReale == nome_reale).ToListAsync();
                    ArticoliFoto? afItemSearch = null;

                    if (_candidatiConQuestoNome.Count > 0)
                    {
                        if (_candidatiConQuestoNome.Count == 1)
                            afItemSearch = _candidatiConQuestoNome.FirstOrDefault();
                        else
                        {

                            //Dato che sono >1 allora cerco tra i candidati quello che corrisponde anche al codice articolo specifico
                            afItemSearch = _candidatiConQuestoNome.Where(c => c.IdArticoloNavigation.Codice == name).FirstOrDefault();

                        }
                    }

                    //if (file.queryFilename != null && file.queryFilename != "")
                    //{
                    //    //Il nome del file non è quello che ho preso da sync ma devo partire dal primo "_" che trovo
                    //    nome_reale = file.filename.Substring(file.filename.IndexOf("_") + 1);
                    //}

                    //Qui serve un controllo che puo sembrare ridondante MA che per un errore commesso nel dato di Edro21 è necessario fare
                    //a cuasa di una NON gestione del vv2 e vv3 alcune foto che si chiameranno sempre in un determinato modo potrebbero essere andate all'articolo sbagliato e ormai rimanerci
                    if (afItemSearch != null)
                    {
                        //Riprova del codice
                        if (afItemSearch.IdArticoloNavigation.Codice != name)
                        {
                            afItemSearch = null;
                        }
                    }

                    if (afItemSearch == null)
                    {
                        //Se non trovo la foto con il suo nome originale allora la cerco per MD5
                        afItemSearch = await this.ctx.ArticoliFotos.Where(f => f.Hash == file.md5).FirstOrDefaultAsync();

                        //A questo punto però SE davvero lo trovo qui devo anche fare un'altra verifica, ovvero capire se il nome della foto si riferisce ad un articolo diverso da questo trovato tramite md5
                        if (afItemSearch != null)
                        {
                            artArchivio = await this.ctx.Articolis.Where(art => art.Codice == name).FirstOrDefaultAsync();
                            //Se il codice scritto nel nome FOTO è un codice esistente su DB quindi si rivolge ad un articolo, va per forza controllato
                            //Se è lo stesso articolo trovato tramite MD5
                            if (artArchivio != null)
                            {
                                if (afItemSearch.IdArticolo != artArchivio.Id)
                                {
                                    //Se il codice dell'articolo non corrisponde all'articolo trovato
                                    afItemSearch = null;
                                }
                            }
                            else
                            {
                                //Non trovo neanche il codice, la ricerca è da invalidare
                                afItemSearch = null;
                            }
                        }
                    }


                    //Definizione dell'esistenza della ref in archivio
                    if (afItemSearch == null)
                    {
                        //Per nome foto non è stato trovato niente
                        //Allora cerco per codice
                        artArchivio = await this.ctx.Articolis.Where(art => art.Codice == name).FirstOrDefaultAsync();
                        if (artArchivio == null)
                        {
                            //Se non trovo l'articolo, allora cerco per EAN
                            artArchivio = await this.ctx.Articolis.Where(f => f.Ean == name).FirstOrDefaultAsync();
                        }

                    }
                    else
                    {
                        artArchivio = await this.ctx.Articolis.Include(i => i.ArticoliFotos).Where(a => a.Id == afItemSearch.IdArticolo).FirstOrDefaultAsync();
                    }


                    bool esitoFiltroTracciato = isFiltroTraccaitoMatched(nome_reale, artArchivio, "notDefined");

                    if (esitoFiltroTracciato)
                    {
                        //Definizione dello stato e collocazione della foto
                        if (afItemSearch != null)
                        {
                            //var artOfAfItem = await this.ctx.Articolis.FindAsync(afItemSearch.IdArticolo);

                            //Controllo hash per capire se è da aggiornare oppure no
                            if (afItemSearch.Hash == file.md5)
                            {
                                //Il file esiste già ed è identico a quello messo in sync
                                file.stato = StatoSyncFile.AlreadyExist;
                                file.details = "Foto già esistente. Articolo: " + artArchivio!.Codice;

                            }
                            else
                            {
                                //Il file verrà sovrascritto
                                file.stato = StatoSyncFile.SyncableAsOverwrite;
                                file.details = "La foto è cambiata. Articolo: " + artArchivio!.Codice;
                            }

                            file.id = afItemSearch.Id;
                            file.idArticolo = afItemSearch.IdArticolo;
                            file.guidid = afItemSearch.GuidId;
                        }
                        else if (artArchivio != null)
                        {
                            //afItemSearch = artArchivio.ArticoliFotos.Where(f => f.NomeReale == nome_reale).FirstOrDefault();
                            //if (afItemSearch == null)
                            //{
                            file.stato = StatoSyncFile.SyncableAsNew;
                            file.idArticolo = artArchivio.Id;
                            file.details = "Nuova foto per articolo: " + artArchivio.Codice;
                            //}
                            //else
                            //{
                            //    file.details = (afItemSearch.Hash == file.md5) ? "La foto esiste già" : "La foto è cambiata";
                            //    file.guidid = afItemSearch.GuidId;
                            //    //Controllo hash per capire se è da aggiornare oppure no
                            //    if (afItemSearch.Hash == file.md5)
                            //    {
                            //        //Il file esiste già ed è identico a quello messo in sync
                            //        file.stato = StatoSyncFile.AlreadyExist;
                            //        file.details = "File già esistente. Articolo:" + artArchivio.Codice;
                            //    }
                            //    else
                            //    {

                            //        file.id = afItemSearch.Id;
                            //        file.idArticolo = afItemSearch.IdArticolo;
                            //        file.stato = StatoSyncFile.SyncableAsOverwrite;
                            //        file.details = "Sovrascrittura di: " + artArchivio.Codice;
                            //    }                                
                            //}
                        }
                        else
                        {
                            //Controlliamo dunque se si tratta di una foto ambientata/logo/bollino in base alle regole SE specificate
                            bool foundSolution = false;

                            if (this._syncOptions.Value.fotoAmbientateKeyWordsToSearch != null)
                            {
                                string[] faKeys = this._syncOptions.Value.fotoAmbientateKeyWordsToSearch;
                                if (faKeys.Length > 0)
                                {
                                    foreach (string k in faKeys)
                                    {
                                        if (nome_reale.Contains(k))
                                        {
                                            string codPotenziale = nome_reale.Substring(0, nome_reale.IndexOf(k));
                                            Articoli? artPot = this.ctx.Articolis.Where(a => a.Codice == codPotenziale).FirstOrDefault();
                                            if (artPot != null)
                                            {
                                                file.stato = StatoSyncFile.SyncableAsNew;
                                                file.details = $"Nuova Foto ambientata per codice {artPot!.Codice}";
                                                file.tipo = TipoFoto.Ambientata;
                                                file.idArticolo = artPot.Id;
                                                foundSolution = true;
                                                break;
                                            }
                                        }
                                    }
                                }
                            }

                            if (this._syncOptions.Value.loghiKeyWordsToSearch != null)
                            {

                                string[] loghiKeys = this._syncOptions.Value.loghiKeyWordsToSearch;
                                if (loghiKeys.Length > 0 && !foundSolution)
                                {
                                    foreach (string k in loghiKeys)
                                    {
                                        if (nome_reale.Contains(k))
                                        {
                                            string codPotenziale = nome_reale.Substring(0, nome_reale.IndexOf(k));
                                            Articoli? artPot = this.ctx.Articolis.Where(a => a.Codice == codPotenziale).FirstOrDefault();
                                            if (artPot != null)
                                            {
                                                file.stato = StatoSyncFile.SyncableAsNew;
                                                file.details = $"Nuovo Logo per codice {artPot.Codice}";
                                                file.tipo = TipoFoto.Logo;
                                                file.idArticolo = artPot.Id;
                                                foundSolution = true;
                                                break;
                                            }
                                        }
                                    }
                                }
                            }

                            if (this._syncOptions.Value.bolliniKeyWordsToSearch != null)
                            {
                                string[] bolliniKeys = this._syncOptions.Value.bolliniKeyWordsToSearch;
                                if (bolliniKeys.Length > 0 && !foundSolution)
                                {
                                    foreach (string k in bolliniKeys)
                                    {
                                        if (nome_reale.Contains(k))
                                        {
                                            string codPotenziale = nome_reale.Substring(0, nome_reale.IndexOf(k));
                                            Articoli? artPot = this.ctx.Articolis.Where(a => a.Codice == codPotenziale).FirstOrDefault();
                                            if (artPot != null)
                                            {
                                                file.stato = StatoSyncFile.SyncableAsNew;
                                                file.details = $"Nuovo Bollino per codice {artPot.Codice}";
                                                file.tipo = TipoFoto.Bollino;
                                                file.idArticolo = artPot.Id;
                                                foundSolution = true;
                                                break;
                                            }
                                        }
                                    }
                                }
                            }

                            if (!foundSolution)
                            {
                                //Possiamo ufficialmente dire che non ha trovato alcuna corrispondenza
                                file.stato = StatoSyncFile.NoMatch;
                                file.details = "Nessuna corrispondenza";
                                if (_candidatiConQuestoNome.Count > 1)
                                {
                                    file.details = $"Piu di una corrispondeza del nome {nome_reale} ({_candidatiConQuestoNome.Count})";
                                }

                            }
                        }
                    }
                    else
                    {
                        file.stato = StatoSyncFile.NotInTracciato;
                        if (artArchivio != null)
                        {
                            file.details = artArchivio.Codice + " non presente in tracciato";
                        }
                    }

                    //Controllo se il sistgema espone una estenzione di post produzione
                    //file.isGrezzo = false;
                    file.daPostProdurre = false;

                    if (file.stato == StatoSyncFile.AlreadyExist)
                    {
                        //Per i casi di foto già esistenti controllo se esiste una estensione di post produzione
                        //E si controlla se ad ognimodo è al momento selezionata come foto primaria della ref (data modifica più recente di tutte le altre foto della ref)
                        if (ext_post_lavorazione != null && ext_post_lavorazione.Length > 0)
                        {
                            string fileExt = Path.GetExtension(file.filename);

                            if (!ext_post_lavorazione.Contains(fileExt))
                            {
                                //Questo file è un file grezzo per cui controlliao se esiste il suo omonimo con estensione da produzione                                

                                //Se esiste il file con estensione di post produzione allora lo mettiamo in sovrascrittura
                                bool foundPP = false;
                                foreach (string ppExt in ext_post_lavorazione)
                                {
                                    string filePostProd = file.filename.Replace(fileExt, ppExt);
                                    ArticoliFoto? afPP = artArchivio!.ArticoliFotos!.Where(f => f.NomeReale == filePostProd).FirstOrDefault();
                                    if (afPP != null)
                                    {
                                        bool afPPNotSelected = (artArchivio.ArticoliFotos!.Where(af => af.DataModifica > afPP.DataModifica).Count() > 0);
                                        if (afPPNotSelected)
                                        {
                                            file.stato = StatoSyncFile.AlreadyExistButNotSelected;
                                            //file.isGrezzo = true;//Questo comanda al processo di SYNC che a dover andare in selezione è la verisone PP di questo grezzo
                                            file.details = $"Foto post prodotta ({afPP.NomeReale}) -> grezzo {file.filename} non più selezionata. Articolo: " + artArchivio.Codice + $"<br>Sincronizzando questo grezzo si seleziona automaticamente la post produzione {afPP.NomeReale}";

                                        }
                                        else
                                        {
                                            //rIMANE INALTERATO LO STATO
                                            file.details = $"Foto post prodotta ({afPP.NomeReale}) -> grezzo {file.filename} già selezionata. Articolo: " + artArchivio.Codice;
                                        }

                                        foundPP = true;

                                        break;

                                    }
                                }

                                if (!foundPP)
                                {
                                    file.details = $"Foto grezza {file.filename} non ancora post prodotta. Articolo: " + artArchivio!.Codice;

                                    bool afPPNotSelected = (artArchivio.ArticoliFotos!.Where(af => af.DataModifica > afItemSearch!.DataModifica).Count() > 0);
                                    if (afPPNotSelected)
                                    {
                                        file.stato = StatoSyncFile.AlreadyExistButNotSelected;
                                        file.details = $"Foto grezza (non ancora post prodotta) {file.filename} non più selezionata. Articolo: " + artArchivio.Codice;

                                    }
                                    else
                                    {
                                        //RIMANE INALTERATO LO STATO
                                        file.details = $"Foto grezza (non ancora post prodotta) {file.filename} già selezionata. Articolo: " + artArchivio.Codice;
                                    }

                                    file.daPostProdurre = true;

                                }
                            }
                            else
                            {
                                //Questo file è già post prodotto
                                bool afPPNotSelected = (artArchivio!.ArticoliFotos!.Where(af => af.DataModifica > afItemSearch!.DataModifica).Count() > 0);
                                if (afPPNotSelected)
                                {
                                    file.stato = StatoSyncFile.AlreadyExistButNotSelected;
                                    file.details = $"Foto {file.filename} non più selezionata. Articolo: " + artArchivio.Codice;

                                }
                                else
                                {
                                    //RIMANE INALTERATO LO STATO
                                    file.details = $"Foto {file.filename} già selezionata. Articolo: " + artArchivio.Codice;
                                }
                            }

                        }
                        else
                        {
                            //Non ci sono specifiche di post produzione per cui controlliamo direttamente se questo file 
                            bool afPPNotSelected = (artArchivio!.ArticoliFotos!.Where(af => af.DataModifica > afItemSearch!.DataModifica).Count() > 0);
                            if (afPPNotSelected)
                            {
                                file.stato = StatoSyncFile.AlreadyExistButNotSelected;
                                file.details = $"Foto {file.filename} non più selezionata. Articolo: " + artArchivio.Codice;

                            }
                            else
                            {
                                //rIMANE INALTERATO LO STATO
                                file.details = $"Foto {file.filename} già selezionata. Articolo: " + artArchivio.Codice;
                            }
                        }
                    }
                    else if (file.stato == StatoSyncFile.SyncableAsOverwrite || file.stato == StatoSyncFile.SyncableAsNew)
                    {
                        if (ext_post_lavorazione != null && ext_post_lavorazione.Length > 0)
                        {
                            string fileExt = Path.GetExtension(file.filename);

                            if (!ext_post_lavorazione.Contains(fileExt))
                            {
                                //In queste circostanze l'operatore sarà costretto a POST PRODURRE di nuovo il file
                                //Questo file è grezzo e non è conosiuto come MD5
                                //file.isGrezzo = true;
                                bool foundPP = false;
                                foreach (string ppExt in ext_post_lavorazione)
                                {
                                    string filePostProd = file.filename.Replace(fileExt, ppExt);
                                    ArticoliFoto? afPP = artArchivio!.ArticoliFotos!.Where(f => f.NomeReale == filePostProd).FirstOrDefault();
                                    if (afPP != null)
                                    {
                                        foundPP = true;
                                        bool afPPNotSelected = (artArchivio.ArticoliFotos!.Where(af => af.DataModifica > afPP.DataModifica).Count() > 0);
                                        if (afPPNotSelected)
                                        {
                                            file.details = $"Nuovo grezzo del file post prodotto: {afPP.NomeReale}, non più selezionato. Articolo: " + artArchivio.Codice;

                                        }
                                        else
                                        {
                                            //rIMANE INALTERATO LO STATO
                                            file.details = $"Nuovo grezzo del file post prodotto: {afPP.NomeReale} -> attualmente già selezionato. Articolo: " + artArchivio.Codice;
                                        }

                                        break;

                                    }
                                }

                                //Che sia stato trovato il file post prodotto o no, in ogni caso questo file è da post produrre di nuovo
                                file.daPostProdurre = true;

                            }
                        }
                    }


                    scan_result.Add(file);
             

                }

                result.files = scan_result;
                result.isScan = true;                

            }
            catch (Exception ex)
            {
                logAss.WriteLine(ex.ToString());

                result.error = ex.ToString();
            }
            finally
            {
                //A prescindere salvo il risultato in un file JSON per poterlo recuperare poi nella fase di SYNC
                string jsonFilePath = System.IO.Path.Combine(extract_sync_path, guidid + ".json");
                System.IO.File.WriteAllText(jsonFilePath, JsonConvert.SerializeObject(result));
            }
            

        }

        [HttpGet]
        [Route("SyncFoto/ScanPacchettoFotoCheck/{guidid}")]
        public async Task<IActionResult> ScanPacchettoFotoCheck(string guidid)
        {
            string jsonFilePath = System.IO.Path.Combine(extract_sync_path, guidid+".json");
            if (System.IO.File.Exists(jsonFilePath))
            {
                SyncFileOperation result = JsonConvert.DeserializeObject<SyncFileOperation>(System.IO.File.ReadAllText(jsonFilePath))!;
                return Ok(result);
            }
            else
            {
                return NotFound();
            }

        }

        [HttpGet]//[HttpPost]
        [Route("SyncFoto/ScanPacchettoFotoByFotoUri/{idPromo}/{idTracciato}")]
        public async Task<IActionResult> ScanPacchettoFotoByFotoUri(int idPromo, int idTracciato)
        {
            SyncFileOperation result = new SyncFileOperation();

            LogAssistent logAss = new LogAssistent();

            try
            {
                List<PromoTracciati> tracciati = new List<PromoTracciati>();

                if (idPromo>0)
                {
                    tracciati = this.ctx2.PromoTracciatis.Where(p => p.IdPromo == idPromo).ToList();

                }
                else if (idTracciato>0)
                {
                    tracciati = this.ctx2.PromoTracciatis.Where(p => p.Id == idTracciato).ToList();
                }


                //A questo unto estraiamo le singole foto da goni tracciato, evitando duplicati

                //List<SyncFile> fileProcessatiDict = new List<SyncFile>();
                //List<SyncFile> scan_result = new List<SyncFile>();
                List<string> codesCache = new List<string>();
                List<Dictionary<string, object>> urisFoto = new List<Dictionary<string,object>>();
                foreach (PromoTracciati tr in tracciati)
                {
                    //Prendo le foto del tracciato
                    List<PromoTracciatiRecord> records = await this.ctx2.PromoTracciatiRecords.Where(r => r.IdTracciato == tr.Id).ToListAsync();

                    foreach (PromoTracciatiRecord rec in records)
                    {
                        var objRec = Utility.Main.getJsonObject(rec.Dato!)!;
                        string cod = objRec[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString()!;
                        if (!codesCache.Contains(cod))
                        {
                            if (objRec.ContainsKey(GLOBAL_VARIABLES_FICO.keyFotoUri))
                            {
                                urisFoto.Add(objRec);
                                codesCache.Add(cod);
                            }
                        }

                    }
                }

                string newGuid = Guid.NewGuid().ToString();
                Directory.CreateDirectory($"{this.extract_sync_path}{System.IO.Path.DirectorySeparatorChar}{newGuid}");
                //Adesso scarichiamo tutti gli uri nella cartella di fotogate
                foreach (var rec in urisFoto)
                {
                    //Scarica foto da http uri e salva immagine su disco

                    string uri = rec[GLOBAL_VARIABLES_FICO.keyFotoUri].ToString()!;
                    //uri = "https://google.com";
                    try
                    {
                        string filename = rec[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString() + ".jpg";//Attenzioe, l'estensione andrebbe fatta specificare come standard nell'app config

                        string pathEstrazione = $"{this.extract_sync_path}{System.IO.Path.DirectorySeparatorChar}{newGuid}";
                        string path = Path.Combine(pathEstrazione, filename);

                        using (var client = new HttpClient())
                        {
                            //client.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0");
                            var response = await client.GetAsync(uri);
                            if (response.IsSuccessStatusCode)
                            {
                                var fileBytes = await response.Content.ReadAsByteArrayAsync();
                                System.IO.File.WriteAllBytes(path, fileBytes);
                            }
                        }


                            
                    }
                    catch (Exception ex)
                    {
                        logAss.WriteLine($"Error downloading {uri}: {ex.Message}");
                    }
                    
                }

                ScanFileRequest scanRequest = new ScanFileRequest();
                scanRequest.packagesName = new string[] { newGuid };
                scanRequest.workDir = "-1";
                var promise = await ScanPacchettoFoto(scanRequest);
                var okResult = promise as OkObjectResult;
                result = (okResult!.Value as SyncFileOperation)!;


                return Ok(result);

            }
            catch (Exception ex)
            {
                logAss.WriteLine(ex.ToString());
                result.error = ex.ToString();
            }

            return Ok(result);
        }

        [DisableRequestSizeLimit]
        [HttpPut]
        [Route("SyncFoto/downloadPacchettoFoto")]
        //public async Task<IActionResult> downloadPacchettoFoto([FromBody] SyncFileDownloadRequest request)
        public async Task<IActionResult> downloadPacchettoFoto( SyncFileDownloadRequest request)
        {

            string zipName = request.dirOperatore;
            string path = "";


            try
            {

                string statoMatched = "";
                //var stati =  request.files!.GroupBy(g => g.daPostProdurre).Select(s => s.Key).ToList();
                //if (stati.Count==1 && stati.FirstOrDefault())
                //{

                switch (request.tipoFiltro)
                {
                    case 5:
                         statoMatched = "_DA_POST_PRODURRE";
                        break;
                    case 0:
                        statoMatched = "_TUTTE";
                        break;
                    case 1:
                        statoMatched = "_NUOVE";
                        break;
                    case 2:
                        statoMatched = "_CAMBIATE";
                        break;
                    case 3:
                        statoMatched = "_INALTERATE";
                        break;
                    case 4:
                        statoMatched = "_NON_CORRISPONDENTI";
                        break;
                    default:
                         statoMatched = "";
                        break;
                }


                //}

                zipName += $"{statoMatched}.zip";
                path = Path.Combine(this.extract_sync_path, zipName);

                using (ZipArchive archive = await ZipFile.OpenAsync(path, ZipArchiveMode.Update))
                {

                    //foreach (string entry in Directory.GetFiles(originPath))
                    foreach (SyncFile sf in request.files!)
                    //foreach (SyncFile sf in listFiles)
                    {
                        if (!sf.daPostProdurre)
                        {
                            statoMatched = "";
                        }

                        string entry = Path.Combine(this.extract_sync_path + System.IO.Path.DirectorySeparatorChar + sf.zipDirOrigin, sf.filename);

                        FileInfo fi = new FileInfo(entry);
                        //_ = await archive.CreateEntryFromFileAsync(entry, fi.Name);                        
                        archive.CreateEntryFromFile(entry, fi.Name);

                    }

                }


                

            }
            catch(Exception ex)
            {
                return BadRequest(ex.ToString());
            }   

            Thread.Sleep(1000);

            System.IO.FileInfo fInfo = new FileInfo(path);
            string destPath = Path.Combine(this._exportPath.Value.path, fInfo.Name);
            System.IO.File.Move(path, destPath, true);

            var result = new
            {
                fileName = fInfo.Name,
                url = $"{HttpContext.Request.PathBase}/exported_files/{fInfo.Name}"
            };
            return Ok(result);


            //var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
            //var fileName = Path.GetFileName(path);




            ////var result = new FileContentResult(content, "application/zip")
            //return File(stream, "application/zip", fileName, enableRangeProcessing: true);
        }
        
        [HttpPut]
        [Route("SyncFoto/SyncPacchettoFoto/{overwriteOption}")]
        public async Task<IActionResult> SyncPacchettoFoto(SyncFileOperation op, bool overwriteOption)
        {
            SyncFileOperation result = new SyncFileOperation();
            
            try
            {
                //List<SyncFile> scan_result = op.files;

                //result.jobName = op.jobName;
                result.files = op.files;

                string pathToRead = extract_sync_path;//Path.Combine(extract_sync_path,op.jobName);

               string guidID = Guid.NewGuid().ToString();

                string upload_file = $"upload_{guidID}.zip";

                var tempFile = Path.Combine(pathToRead, upload_file);
                List<FileOlympoSync> olympoJson = new List<FileOlympoSync>();

              
                using (var zipFile = System.IO.File.Create(tempFile))
                {
                    using (var zipArchive = new ZipArchive(zipFile, ZipArchiveMode.Create))
                    {
                        //Call massiva verso Olympus
                        foreach (SyncFile syF in result.files!)
                        {
                            bool noGuidId= (syF.guidid == null || syF.guidid == "");

                            if (syF.stato == StatoSyncFile.Syncable /*||  noGuidId*/ || (syF.stato == StatoSyncFile.SyncableAsOverwrite  && overwriteOption) || syF.stato == StatoSyncFile.SyncableAsNew)
                            {
                                //Faccio passare solo quelli con lo stato adeguato
                                string pathFile = Path.Combine(extract_sync_path, syF.zipDirOrigin);

                                var filepath = Path.Combine(pathFile, syF.filename);
                                zipArchive.CreateEntryFromFile(filepath, syF.filename);

                                olympoJson.Add(new FileOlympoSync()
                                {
                                    Id = "0",
                                    FileHash = syF.md5,
                                    FileName = syF.filename,
                                    IdRef=syF.id.ToString(),
                                    Size=0
                                });


                            }
                            else if (syF.stato==StatoSyncFile.AlreadyExistButNotSelected)
                            {
                                if (overwriteOption)
                                {
                                    //Dato che è entrata in sync, mi limito a selezionarla
                                    ArticoliFoto? fotoIstanta = this.ctx.ArticoliFotos.Include(inc => inc.IdArticoloNavigation).Where(s => s.Id == syF.id).FirstOrDefault();

                                    //Se la post produzione è flaggata
                                    if (ext_post_lavorazione != null && ext_post_lavorazione.Length > 0)
                                    {
                                        //Controlliamo se si tratta di un grezzo
                                        string filename = fotoIstanta!.NomeReale;
                                        string fileExt = Path.GetExtension(filename);

                                        if (!ext_post_lavorazione.Contains(fileExt))
                                        {
                                            //Questo file è un file grezzo per cui siccome esisteva già e NON è selezionato ALLORA vediamo se esiste il fle post prodotto
                                            foreach (string ppExt in ext_post_lavorazione)
                                            {
                                                string filePostProd = filename.Replace(fileExt, ppExt);
                                                ArticoliFoto? afPP = this.ctx.ArticoliFotos.Where(f => f.IdArticolo == fotoIstanta.IdArticolo && f.NomeReale == filePostProd).FirstOrDefault();
                                                if (afPP != null)
                                                {
                                                    ////Va attivato lui al suo posto
                                                    fotoIstanta = afPP;
                                                    break;

                                                }
                                            }
                                        }

                                    }

                                    //fotoIstanta.DataModifica = DateTime.Now;
                                    //fotoIstanta.Attiva = true;
                                    //fotoIstanta.StatoSelezione = (Byte)StatoSelezioneFoto.Primaria;

                                    string pathFile = Path.Combine(extract_sync_path, syF.zipDirOrigin);
                                    var filepath = Path.Combine(pathFile, syF.filename);

                                    //var filepath = Path.Combine(pathToRead, syF.filename);
                                    zipArchive.CreateEntryFromFile(filepath, syF.filename);

                                    olympoJson.Add(new FileOlympoSync()
                                    {
                                        Id = "0",
                                        FileHash = syF.md5,
                                        FileName = syF.filename,
                                        IdRef = fotoIstanta!.Id.ToString(),//syF.id.ToString(),
                                        Size = 0
                                    });


                                    //this.ctx.SaveChanges();

                                    //registraAttivitaDiSyncFoto(0, fotoIstanta.IdArticoloNavigation.Codice, "SyncPacchettoFoto_overwrite", tipoOperazione.syncPacchettoFoto);
                                }
                            }
                            else
                            {
                                syF.filename.ToString();
                            }
                        }

                    }
                }
                
                if (olympoJson.Count == 0)
                    return Ok(result);


                //using var httpClient = new HttpClient();
                string uri = olympusServerUrl+"/foto/uploadPacchettoFoto";


                //msg.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

                byte[] arrBytes = System.IO.File.ReadAllBytes(tempFile);

                var form = new MultipartFormDataContent();

                var fileContent = new ByteArrayContent(arrBytes);
                fileContent.Headers.ContentType = MediaTypeHeaderValue.Parse("multipart/form-data");

                form.Add(fileContent, "file", Path.GetFileName(tempFile));

                string jsString = JsonConvert.SerializeObject(olympoJson);
                var contentJson = new StringContent(jsString, Encoding.UTF8, "application/json");
                form.Add(contentJson, "json_meta_foto");

                var response = await httpClient.PostAsync(uri, form);

                //result.error="Olympus response " + response.IsSuccessStatusCode;

                if (response.IsSuccessStatusCode)
                {
                    var responseBody = await response.Content.ReadAsStringAsync();
                    var dataOlympo = JsonConvert.DeserializeObject<FileOlympoOperazioneMassiva>(responseBody);

                    //Qui ciclo i dati per poter fare l'update dei dati su Istanta (in teoria perchè in pratica aimè li ho gia fatti MA non andrebbe bene
                    //e assegnare il guidID di olympus
                    List<ShortSyncFile> _listRegistro = new List<ShortSyncFile>();
                    foreach(FileOlympoSync f in dataOlympo!.lista!)
                    {
                        //result.error += " -> Olympus file " + f.FileName + "  ID " + f.Id + " ID REF " + f.IdRef;

                        if (f.Id != "")
                        {
                            try
                            {
                                //Olympus ha elaborato bene
                                Int64 idRef = Int64.Parse(f.IdRef!);
                                ArticoliFoto? fotoIstanta = null;

                                SyncFile? syncDetail = result.files.Where(fs => fs.filename == f.FileName).FirstOrDefault();
                                syncDetail!.guidid= f.Id;

                                if (syncDetail != null)
                                {
                                    if (idRef > 0)
                                    {

                                        fotoIstanta = this.ctx.ArticoliFotos.Include(inc=>inc.IdArticoloNavigation).Where(s => s.Id == idRef).FirstOrDefault();
                                        fotoIstanta!.GuidId = f.Id!;
                                        fotoIstanta.PathFoto= f.FileName!;
                                        fotoIstanta.NomeReale = f.FileName!;
                                        fotoIstanta.DataModifica = DateTime.Now;
                                        fotoIstanta.Hash = f.FileHash;
                                        fotoIstanta.Attiva = true;
                                        fotoIstanta.StatoSelezione = (Byte)StatoSelezioneFoto.Primaria;

                                        this.ctx.SaveChanges();

                                        //registraAttivitaDiSyncFoto(0, fotoIstanta.IdArticoloNavigation.Codice + " ID: "  + idRef, "SyncPacchettoFoto_fotoChanged", tipoOperazione.syncPacchettoFoto);
                                    }
                                    else
                                    {


                                        fotoIstanta = new ArticoliFoto();
                                        fotoIstanta.Attiva = true;
                                        fotoIstanta.PathFoto = f.FileName!;
                                        fotoIstanta.NomeReale = f.FileName!;
                                        fotoIstanta.DataInserimento = DateTime.Now;
                                        fotoIstanta.DataModifica = DateTime.Now;
                                        fotoIstanta.StatoSelezione = (Byte)StatoSelezioneFoto.Primaria;
                                        fotoIstanta.IdArticolo = syncDetail.idArticolo;
                                        fotoIstanta.Hash = f.FileHash;
                                        fotoIstanta.GuidId = f.Id!;
                                        fotoIstanta.Tipo = (Byte)syncDetail.tipo;
                                        this.ctx.ArticoliFotos.Add(fotoIstanta);
                                        this.ctx.SaveChanges();

                                        //result.error += " -> Registrata la foto " + fotoIstanta.Id;
                                        syncDetail.id = fotoIstanta.Id;

                                        //registraAttivitaDiSyncFoto(0, "new", "SyncPacchettoFoto_new", tipoOperazione.syncPacchettoFoto);

                                        //}
                                    }


                                    _listRegistro.Add(new ShortSyncFile() { 
                                        filename= syncDetail.filename,
                                        zipOriginDir = syncDetail.zipDirOrigin,
                                        stato = syncDetail.stato,
                                        daPostProdurre= syncDetail.daPostProdurre,
                                    } );

                                    if (fotoIstanta != null && fotoIstanta.Id>0)
                                    {
                                        //Flaggo questa foto come sincronizzata ufficialemente
                                        result.files.Where(fs => fs.filename == f.FileName).FirstOrDefault()!.stato = StatoSyncFile.Synced;

                                        //Elimino il file dal filesystem
                                        var filepath = Path.Combine(pathToRead, f.FileName!);
                                        if (System.IO.File.Exists(filepath))
                                        {
                                            System.IO.File.Delete(filepath);
                                        }   
                                    }


                                }


                            }catch(Exception ex)
                            {
                                //result.error += " -> Errore salvataggio foto " + ex.ToString();
                                //ex.ToString();
                                throw new Exception("Errore salvataggio foto " + ex.ToString());
                            }
                        }
                        else
                        {
                            //Olymps ha avuto un problema
                            //Da capire come gestirlo
                            "?".ToString();
                        }
                    }

                    StringResult esitoReg = registraAttivitaMassivaDiSyncFoto(new RevisioneSyncFoto{ dir=op.originDir, fileSynced = _listRegistro, totalFilesScanned = op.totalFilesScanned });
                    Int32 id_att;
                    Int32.TryParse(esitoReg.Esito, out id_att);
                    if (id_att<=0)
                        throw new Exception("Errore registrazione attività di sync foto: " + esitoReg.error);

                    ////Console.WriteLine(responseBody);
                    if (dataOlympo.error!="" && dataOlympo.error!=null)
                    {
                        throw new Exception("Olympo error gestito: " + dataOlympo.error);
                    }

                    //Registro attività
                    result.id_attivita = id_att;
                }
                else
                {
                    ////Console.WriteLine("Error: " + response.StatusCode);
                    throw new Exception("Olympo error " + response.StatusCode);
                }

                //result.error += " FINE";

                result.isScan = false;

                DateTime dtStart = DateTime.Now;
                while (true)
                {
                    try
                    {
                        System.IO.File.Delete(tempFile);
                        break;
                    }
                    catch
                    {
                        if (DateTime.Now.Subtract(dtStart).TotalSeconds > 30)
                        {

                            throw new Exception("Errore eliminazione file temporaneo. Timeout!");
                        }

                        Thread.Sleep(1000);
                    }
                }

                return Ok(result);

            }
            catch (Exception ex)
            {
                result.error = ex.Message;
            }

            return Ok(result);
        }

        [HttpGet]
        [Route("SyncFoto/attivaDisattivaFotoExtra/{guidId}/{attiva}")]
        public async Task<IActionResult> attivaDisattivaFotoExtra(string guidId, bool attiva)
        {
            BoolResult result = new BoolResult();
            try
            {
                var foto = this.ctx.ArticoliFotos.Where(f => f.GuidId == guidId).FirstOrDefault();
                if(foto == null)
                {
                    throw new Exception("Foto con guidId ("+guidId+")non trovata nel Database");
                }

                if(foto.Tipo == (byte)TipoFoto.Foto)
                {
                    throw new Exception("L'operazione può essere effettuata solo per foto Extra");
                }

                foto.Attiva = attiva;
                this.ctx.SaveChanges();
                result.Esito = true;
            }
            catch (Exception ex)
            {
                result.Esito = false;
                result.error = ex.Message;
            }

            return Ok(result);
        }


        [HttpGet]
        [Route("SyncFoto/scanSyncFromDb")]
        public async Task<IActionResult> scanSyncFromDb()
        {
            SyncResult result = new SyncResult();

            try
            {

                JObject? o1 = JObject.Parse(System.IO.File.ReadAllText(this.path_external_source + "SourceUnita.json"));
                DbUnita archiviDB = o1.ToObject<DbUnita>()!;
                List<DbUnitaItem> sync_folders = archiviDB.source.Where(s => s.syncFolder).ToList();
                DbUnitaItem web_folder = archiviDB!.source.Where(s => s.webFolder).FirstOrDefault()!;
                DbUnitaItem alta_folder = archiviDB!.source.Where(s => !s.webFolder && !s.syncFolder && !s.exportFolder).FirstOrDefault()!;

                if (web_folder == null)
                {
                    throw new Exception("Web folder not found");
                }
                if (alta_folder == null)
                {
                    throw new Exception("Alta folder not found");
                }

                string jsonRequest = Newtonsoft.Json.JsonConvert.SerializeObject(sync_folders);
                List<Dictionary<string, object>>? req = Newtonsoft.Json.JsonConvert.DeserializeObject<List<Dictionary<string, object>>>(jsonRequest);
                PhotoManager phManager = new PhotoManager(req);

                List<string> fotoDb = this.ctx.ArticoliFotos.Select(s => s.NomeReale).ToList();

                string opRes = phManager.scanSyncFotoFromDb(fotoDb);
                result = JsonConvert.DeserializeObject<SyncResult>(opRes)!;

            }
            catch (Exception ex)
            {
                result.error = ex.ToString();
            }

            return Ok(result);
        }

        List<ArticoliFoto> TrovaIstanzeStessaImmagine(
    Articoli articolo,
    string nomeReale,
    string? hash)
        {
            return articolo.ArticoliFotos!
                .Where(f =>
                    string.Equals(f.NomeReale, nomeReale, StringComparison.OrdinalIgnoreCase) &&
                    string.Equals(f.Hash, hash, StringComparison.OrdinalIgnoreCase)) 
                .ToList();
        }

        [Route("SyncFoto/updateFotoFromIndd/{id_operazione}")]
        public async Task<IActionResult> updateFotoFromIndd([FromForm] FileIndd _file, int id_operazione=0)
        {
            ArticoliFoto result = new ArticoliFoto();
            try
            {
                Stopwatch stopwatch = Stopwatch.StartNew();
                stopwatch.Start();
                Console.WriteLine($"1. updateFotoFromIndd {DateTime.Now}");

                _file.Normalize();
                List<string> codiciList = new List<string>();
                codiciList.AddRange(_file.codice!.Split(","));
                string guidOlympo = "";
                //Che senso ha questo array?
                //Sto facendo upload foto e sarà per forza solo su singolo, non posso invaire una foto che vale per più codici REF
                string md5 = "";
                long idLavorazioneRec = 0;

                Console.WriteLine($"2. updateFotoFromIndd {stopwatch.ElapsedMilliseconds}");

                if (_file.idLavorazione != 0)
                {
                    PromoLavorazioniRecord? plrItem = this.ctx2.PromoLavorazioniRecords.Include(i1 => i1.IdPromoTracciatiRecordNavigation).Where(plr => plr.IdLavorazione == _file.idLavorazione && plr.CodiceGruppo!.Contains(_file.codice)).FirstOrDefault();

                    if (plrItem == null)
                        throw new Exception($"Nessun elemento trovato con ID Record Tracciato {_file.idRec} trovato, Codice {_file.codice} non disponibile");
                    idLavorazioneRec = plrItem.Id;
                }


                //Collegamento ad Olympus
                //using var httpClient = new HttpClient();
                string uri = olympusServerUrl + "/foto/uploadFoto";


                //msg.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

                byte[] arrBytes = new byte[_file.file!.Length];
                _file.file.OpenReadStream().ReadExactly(arrBytes, 0, (int)_file.file.Length);

                md5 = Crypto.GetMD5HashFromFile(arrBytes);

                var form = new MultipartFormDataContent();

                Console.WriteLine($"3. updateFotoFromIndd {stopwatch.ElapsedMilliseconds}");

                var fileContent = new ByteArrayContent(arrBytes);
                fileContent.Headers.ContentType = MediaTypeHeaderValue.Parse("multipart/form-data");

                FileOlympoSync olympoJson = new FileOlympoSync()
                {
                    Id = "0",
                    FileHash = md5,
                    FileName = _file.nomeFile,
                    IdRef = "0",//articolo.Id.ToString(),
                    Size = 0
                };

                form.Add(fileContent, "file", _file.nomeFile!);
                //form.Add(new StringContent(md5), "hash");

                string jsString = JsonConvert.SerializeObject(olympoJson);
                var contentJson = new StringContent(jsString, Encoding.UTF8, "application/json");
                form.Add(contentJson, "json_meta_foto");


                var response = await httpClient.PostAsync(uri, form);           

                
                if (response.IsSuccessStatusCode)
                {
                    Console.WriteLine($"4. updateFotoFromIndd {stopwatch.ElapsedMilliseconds}");

                    var responseBody = await response.Content.ReadAsStringAsync();
                    var dataOlympo = JsonConvert.DeserializeObject<FileOlympoOperazioneSingola>(responseBody);
                    guidOlympo = dataOlympo!.record!.Id!;

                    ////Console.WriteLine(responseBody);
                }
                else
                {
                    ////Console.WriteLine("Error: " + response.StatusCode);
                    throw new Exception("Olympo error " + response.StatusCode);
                }



                if (guidOlympo != "")
                {
                    foreach (string codice in codiciList)
                    {


                        if (_file.uploadMethod == FileInddUploadMethod.RelativoAllaLavorazione)
                        {
                            Articoli? articolo = this.ctx.Articolis.Include(f => f.ArticoliFotos).Where(f => f.Codice == codice).FirstOrDefault();

                            ArticoliFoto nuovaFoto = new ArticoliFoto();
                            nuovaFoto.IdArticolo = articolo!.Id;
                            nuovaFoto.Area = _file.area!;
                            nuovaFoto.Canale = _file.canale!;
                            nuovaFoto.NomeReale = _file.nomeFile!;
                            nuovaFoto.PathFoto = _file.nomeFile!;
                            nuovaFoto.StatoSelezione = (byte)StatoSelezioneFoto.Primaria;
                            nuovaFoto.Attiva = true;
                            nuovaFoto.Hash = md5;//resSync["hash"].ToString();
                            nuovaFoto.DataInserimento = DateTime.Now;
                            nuovaFoto.DataModifica = DateTime.Now;
                            nuovaFoto.GuidId = guidOlympo;
                            nuovaFoto.Tipo = (Byte)_file.tipo;

                            result = nuovaFoto;
                        }
                        else
                        {
                            Articoli? articolo = this.ctx.Articolis.Include(f => f.ArticoliFotos).Where(f => f.Codice == codice).FirstOrDefault();

                            if (articolo == null)
                            {
                                throw new Exception($"Articolo {codice} non trovato nel database");
                            }

                            if (articolo.ArticoliFotos!.Count > 0)
                            {
                                var artFoto = articolo.ArticoliFotos!
    .Where(f => string.Equals(f.NomeReale, _file.nomeFile, StringComparison.OrdinalIgnoreCase))
    .Where(f => IsCompatibleWithCurrentBranch(f, _file.tracciatoArea, _file.tracciatoCanale))
    .OrderByDescending(f => GetSpecificity(f.Area, f.Canale))
    .ThenByDescending(f => f.DataModifica)
    .FirstOrDefault();

                                if (_file.tracciatoArea != null && _file.tracciatoCanale != null)
                                {
                                    var targetRank = GetSpecificity(_file.area, _file.canale);

                                    var artFotoSDaDisattivare = articolo.ArticoliFotos
                                        .Where(f => f.Attiva == true)
                                        .Where(f => IsCompatibleWithCurrentBranch(f, _file.tracciatoArea, _file.tracciatoCanale))
                                        .Where(f => GetSpecificity(f.Area, f.Canale) > targetRank)
                                        .ToList();

                                    foreach (var item in artFotoSDaDisattivare)
                                    {
                                        item.Attiva = false;
                                    }
                                }


                                if (artFoto != null && _file.uploadMethod == FileInddUploadMethod.Sovrascrivi)
                                {
                                    string oldNomeReale = artFoto.NomeReale;
                                    string? oldHash = artFoto.Hash;

                                    var istanzeDaSostituire = TrovaIstanzeStessaImmagine(
                                        articolo,
                                        oldNomeReale,
                                        oldHash
                                    );

                                    foreach (var foto in istanzeDaSostituire)
                                    {
                                        foto.DataModifica = DateTime.Now;
                                        foto.Hash = md5;
                                        foto.GuidId = guidOlympo;
                                        foto.Tipo = (byte)_file.tipo;

                                        // Probabilmente corretto tenerlo uguale, ma lo esplicito.
                                        foto.NomeReale = _file.nomeFile!;
                                        foto.PathFoto = _file.nomeFile!;
                                    }

                                    artFoto.Attiva = true;
                                    artFoto.Area = _file.area!;
                                    artFoto.Canale = _file.canale!;
                                    artFoto.StatoSelezione = (byte)StatoSelezioneFoto.Primaria;

                                    RimuoviDuplicatiRiassorbiti(
                                        articolo,
                                        artFoto,
                                        _file.area,
                                        _file.canale
                                    );

                                    result = artFoto;
                                }
                                else if (_file.uploadMethod == FileInddUploadMethod.Mantieni)
                                {
                                    string nomeFile = _file.nomeFile!;
                                    if (artFoto != null)
                                    {
                                        //Devo alterare il nome perchè esiste già ma l'utente non vuole sovrascriverlo
                                        string ext = Path.GetExtension(_file.nomeFile!);
                                        nomeFile = _file.nomeFile!.Replace(ext, "") + "_";
                                        int prog = 2;
                                        while (true)
                                        {
                                            string tryName = nomeFile + prog.ToString() + ext;
                                            if (articolo.ArticoliFotos.Count(f => f.NomeReale == tryName) <= 0)
                                            {
                                                nomeFile = tryName;
                                                break;
                                            }
                                            prog++;
                                        }
                                    }

                                    ArticoliFoto nuovaFoto = new ArticoliFoto();
                                    nuovaFoto.IdArticolo = articolo.Id;
                                    nuovaFoto.NomeReale = nomeFile;
                                    nuovaFoto.PathFoto = nomeFile;
                                    nuovaFoto.Area = _file.area!;
                                    nuovaFoto.Canale = _file.canale!;
                                    nuovaFoto.StatoSelezione = (byte)StatoSelezioneFoto.Primaria;
                                    nuovaFoto.Attiva = true;
                                    nuovaFoto.Hash = md5;//resSync["hash"].ToString();
                                    nuovaFoto.DataInserimento = DateTime.Now;
                                    nuovaFoto.DataModifica = DateTime.Now;
                                    nuovaFoto.Tipo = (Byte)_file.tipo;
                                    nuovaFoto.GuidId = guidOlympo;

                                    articolo.ArticoliFotos.Add(nuovaFoto);

                                    

                                    result = nuovaFoto;


                                }
                                else
                                {
                                    if (artFoto != null)
                                    {
                                        if (articolo.ArticoliFotos.Where(f=>f.Attiva == true).OrderByDescending(ord => ord.DataModifica).FirstOrDefault()!.Id == artFoto.Id)
                                        {
                                            //Il caso è singolare.
                                            //Questo denota un fuori sync tra indesign e Istanta.
                                            //Il plugin infatti non dovrebbe mai inviare un file con la foto attualmente selezionata per la ref.
                                            //Appuriamolo confrontando appunto il file aggiornato lato idd con quello inviato
                                            if (_file.nomeFile != _file.nomeFileOld)
                                            {
                                                //Si i file sono diversi, indd è fuori sync per cui dobbiamo intanto vedere se l'md5 di questo file è identico a quello su istanta
                                                if (md5 == artFoto.Hash)
                                                {
                                                    //Facciamo finta di niente e diciamo a Indesign che è tutto ok e puo cambiare la foto
                                                    result = artFoto;
                                                }
                                                else
                                                {
                                                    //InDesign deve ricevere il warning di fuori sync e deve decidere se sovrascirvere o mantenere
                                                    throw new Exception("fuori_sync");

                                                    //BoolResult bRes = new BoolResult()
                                                    //{
                                                    //    Esito = false,
                                                    //    error = "fuori_sync",
                                                    //};
                                                }
                                            }
                                        }
                                        else
                                        {
                                            string oldNomeReale = artFoto.NomeReale;
                                            string? oldHash = artFoto.Hash;

                                            var istanzeDaSostituire = TrovaIstanzeStessaImmagine(
                                                articolo,
                                                oldNomeReale,
                                                oldHash
                                            );

                                            foreach (var foto in istanzeDaSostituire)
                                            {
                                                foto.DataModifica = DateTime.Now;
                                                foto.Hash = md5;
                                                foto.GuidId = guidOlympo;
                                                foto.Tipo = (byte)_file.tipo;
                                                foto.NomeReale = _file.nomeFile!;
                                                foto.PathFoto = _file.nomeFile!;
                                            }

                                            artFoto.StatoSelezione = (byte)StatoSelezioneFoto.Primaria;
                                            artFoto.Attiva = true;
                                            artFoto.Area = _file.area!;
                                            artFoto.Canale = _file.canale!;

                                            result = artFoto;

                                            //artFoto.DataModifica = DateTime.Now;
                                            //artFoto.Hash = md5;
                                            //artFoto.GuidId = guidOlympo;
                                            //artFoto.StatoSelezione = (byte)StatoSelezioneFoto.Primaria;
                                            //artFoto.Attiva = true;
                                            //artFoto.Area = _file.area!;
                                            //artFoto.Canale = _file.canale!;



                                            //result = artFoto;
                                        }
                                    }
                                    else
                                    {
                                        ArticoliFoto nuovaFoto = new ArticoliFoto();
                                        nuovaFoto.IdArticolo = articolo.Id;
                                        nuovaFoto.NomeReale = _file.nomeFile!;
                                        nuovaFoto.PathFoto = _file.nomeFile!;
                                        nuovaFoto.Area = _file.area!;
                                        nuovaFoto.Canale = _file.canale!;
                                        nuovaFoto.StatoSelezione = (byte)StatoSelezioneFoto.Primaria;
                                        nuovaFoto.Attiva = true;
                                        nuovaFoto.Hash = md5;//resSync["hash"].ToString();
                                        nuovaFoto.DataInserimento = DateTime.Now;
                                        nuovaFoto.DataModifica = DateTime.Now;
                                        nuovaFoto.Tipo = (Byte)_file.tipo;
                                        nuovaFoto.GuidId = guidOlympo;

                                        articolo.ArticoliFotos.Add(nuovaFoto);

                                   

                                        result = nuovaFoto;
                                    }

                                }
                            }
                            else
                            {
                                ArticoliFoto nuovaFoto = new ArticoliFoto();
                                nuovaFoto.IdArticolo = articolo.Id;
                                nuovaFoto.NomeReale = _file.nomeFile!;
                                nuovaFoto.PathFoto = _file.nomeFile!;
                                nuovaFoto.Area = _file.area!;
                                nuovaFoto.Canale = _file.canale!;
                                nuovaFoto.StatoSelezione = (byte)StatoSelezioneFoto.Primaria;
                                nuovaFoto.Attiva = true;
                                nuovaFoto.Hash = md5;//resSync["hash"].ToString();
                                nuovaFoto.DataInserimento = DateTime.Now;
                                nuovaFoto.DataModifica = DateTime.Now;
                                nuovaFoto.GuidId = guidOlympo;
                                nuovaFoto.Tipo = (Byte)_file.tipo;


                                articolo.ArticoliFotos.Add(nuovaFoto);

                                result = nuovaFoto;
                            }

                            //await this.RimuoviFotoDaMeta(_file, id_operazione);
                            await this.RimuoviFotoDaMeta(_file.codice, _file.tipo, _file.idLavorazione, _file.idRec, id_operazione);

                        }

                    }
                    
                    this.ctx.SaveChanges();

                    Console.WriteLine($"5. updateFotoFromIndd {stopwatch.ElapsedMilliseconds}");

                    registraAttivitaDiSyncFoto(id_operazione, _file.codice, "updateFotoFromIndd", tipoOperazione.updateFoto, new RevisioneFotoFromIndd() { codRef = _file.codice, nomeFoto = _file.nomeFile, tipo = _file.tipo, guidId=guidOlympo}, (_file.uploadMethod == FileInddUploadMethod.RelativoAllaLavorazione ? idLavorazioneRec : 0));

                    stopwatch.Stop();
                    Console.WriteLine($"6. updateFotoFromIndd FINE OPERAZIONE {stopwatch.ElapsedMilliseconds}");
                }
                else
                {
                    throw new Exception("Errore nel caricamento della foto su Olympus");
                }
            }
            catch (Exception ex)
            {
                BoolResult bRes = new BoolResult();
                bRes.Esito = false;
                bRes.error = ex.Message;
                return Ok(bRes);
            }


            return Ok(result);
        }

        int GetSpecificity(string area, string canale)
        {
            bool hasArea = !string.IsNullOrWhiteSpace(area);
            bool hasCanale = !string.IsNullOrWhiteSpace(canale);

            if (hasArea && hasCanale) return 3;
            if (hasArea) return 2;
            if (hasCanale) return 1;
            return 0;
        }

        bool IsCompatibleWithCurrentBranch(ArticoliFoto f, string tracciatoArea, string tracciatoCanale)
        {
            bool sameArea = string.IsNullOrWhiteSpace(f.Area) || f.Area == tracciatoArea;
            bool sameCanale = string.IsNullOrWhiteSpace(f.Canale) || f.Canale == tracciatoCanale;

            return sameArea && sameCanale;
        }

        [Route("SyncFoto/updateImmagineEsistente/{id_operazione}")]
        public async Task<IActionResult> updateImmagineEsistente([FromForm] UpdateImmagineEsistenteModel data, int id_operazione = 0)
        {
            fotoResult result = new fotoResult();
            try
            {
                data.Normalize();
                long idLavorazioneRec = 0;

                if (data.idLavorazione != 0)
                {
                    PromoLavorazioniRecord? plrItem = this.ctx2.PromoLavorazioniRecords.Include(i1 => i1.IdPromoTracciatiRecordNavigation).Where(plr => plr.IdLavorazione == data.idLavorazione && plr.CodiceGruppo!.Contains(data.Codice)).FirstOrDefault();

                    if (plrItem == null)
                        throw new Exception($"Nessun elemento trovato con Codice {data.Codice}");
                    idLavorazioneRec = plrItem.Id;
                }
                Articoli? articolo = this.ctx.Articolis.Include(f => f.ArticoliFotos).Where(f => f.Codice == data.Codice).FirstOrDefault();

                if (articolo == null)
                {
                    throw new Exception($"Articolo {data.Codice} non trovato nel database");
                }

                if (articolo.ArticoliFotos!.Count > 0)
                {

                    var fotoCercata = articolo.ArticoliFotos.Where(f => f.Id == data.id).FirstOrDefault();


                    if (fotoCercata == null)
                    {
                        throw new Exception("Foto non trovata sul database");
                    }

                    ArticoliFoto fotoTarget = null;

                    if (data.validaSoloPerLavorazione)
                    {

                    }
                    else
                    {

                        if (data.tracciatoArea != null && data.tracciatoCanale != null)
                        {
                            var targetRank = GetSpecificity(data.scopeArea, data.scopeCanale);

                            var artFotoSDaDisattivare = articolo.ArticoliFotos
                                .Where(f => f.Attiva == true)
                                .Where(f => IsCompatibleWithCurrentBranch(f, data.tracciatoArea, data.tracciatoCanale))
                                .Where(f => GetSpecificity(f.Area, f.Canale) > targetRank)
                                .ToList();

                            foreach (var item in artFotoSDaDisattivare)
                            {
                                item.Attiva = false;
                            }
                        }


                        if (data.propaga)
                        {
                            ArticoliFoto nuovaFoto = new ArticoliFoto();
                            nuovaFoto.IdArticolo = articolo.Id;
                            nuovaFoto.NomeReale = fotoCercata.NomeReale;
                            nuovaFoto.PathFoto = fotoCercata.NomeReale;
                            nuovaFoto.Area = data.scopeArea;
                            nuovaFoto.Canale = data.scopeCanale;
                            nuovaFoto.StatoSelezione = (byte)StatoSelezioneFoto.Primaria;
                            nuovaFoto.Attiva = true;
                            nuovaFoto.Hash = fotoCercata.Hash;//resSync["hash"].ToString();
                            nuovaFoto.DataInserimento = DateTime.Now;
                            nuovaFoto.DataModifica = DateTime.Now;
                            nuovaFoto.Tipo = fotoCercata.Tipo;
                            nuovaFoto.GuidId = fotoCercata.GuidId;

                            articolo.ArticoliFotos.Add(nuovaFoto);

                            fotoTarget = nuovaFoto;
                        }
                        else
                        {

                            fotoCercata.Attiva = true;
                            fotoCercata.DataModifica = DateTime.Now;
                            fotoCercata.Area = data.scopeArea;
                            fotoCercata.Canale = data.scopeCanale;
                            fotoCercata.StatoSelezione = (byte)StatoSelezioneFoto.Primaria;

                            fotoTarget = fotoCercata;
                        }

                        RimuoviDuplicatiRiassorbiti(
                            articolo,
                            fotoTarget,
                            data.scopeArea,
                            data.scopeCanale
                        );

                        if (data.idLavorazione != 0)
                        {
                            //rimuovo il meta solo se arrivo da una lavorazione
                            var _file = new FileIndd();
                            _file.canale = data.scopeCanale;
                            _file.area = data.scopeArea;
                            _file.tracciatoCanale = data.tracciatoCanale;
                            _file.tracciatoArea = data.tracciatoArea;
                            _file.codice = data.Codice;
                            _file.idLavorazione = data.idLavorazione;
                            _file.idRec = 0; //non ci interessa
                            _file.tipo = TipoFoto.Foto;

                            await this.RimuoviFotoDaMeta(_file.codice, _file.tipo, _file.idLavorazione, _file.idRec, id_operazione);
                        }
                    }

                    result.nomeReale = fotoTarget != null ? fotoTarget.NomeReale : fotoCercata.NomeReale;
                    result.tipo = fotoTarget != null ? (TipoFoto)fotoTarget.Tipo : (TipoFoto)fotoCercata.Tipo;
                    result.guidId = fotoTarget != null ? fotoTarget.GuidId : fotoCercata.GuidId;
                    result.Id = fotoTarget != null ? fotoTarget.Id : fotoCercata.Id;
                    result.hash = fotoTarget != null ? fotoTarget.Hash : fotoCercata.Hash;

                    this.ctx.SaveChanges();
                    registraAttivitaDiSyncFoto(id_operazione, data.Codice, "updateImmagineEsistente", tipoOperazione.updateFoto, new RevisioneFotoFromIndd() { codRef = data.Codice, nomeFoto = fotoCercata.NomeReale, tipo = (TipoFoto)fotoCercata.Tipo, guidId = fotoCercata.GuidId }, (data.validaSoloPerLavorazione ? idLavorazioneRec : 0));
                    result.esito = true;
                }
            }
            catch (Exception ex)
            {
                fotoResult bRes = new fotoResult();
                bRes.esito = false;
                bRes.error = ex.Message;
                result.nomeReale = "";
                result.tipo = (TipoFoto)1;
                result.guidId = "";
                result.Id = 0;
                return Ok(bRes);
            }


            return Ok(result);
        }

        bool SameImage(ArticoliFoto a, ArticoliFoto b)
        {
            return string.Equals(a.NomeReale, b.NomeReale, StringComparison.OrdinalIgnoreCase)
                && string.Equals(a.Hash, b.Hash, StringComparison.OrdinalIgnoreCase);
        }

        bool IsAbsorbedByScope(ArticoliFoto candidate, string? targetArea, string? targetCanale)
        {
            bool targetHasArea = !string.IsNullOrWhiteSpace(targetArea);
            bool targetHasCanale = !string.IsNullOrWhiteSpace(targetCanale);

            bool areaCovered =
                !targetHasArea ||
                string.Equals(candidate.Area, targetArea, StringComparison.OrdinalIgnoreCase);

            bool canaleCovered =
                !targetHasCanale ||
                string.Equals(candidate.Canale, targetCanale, StringComparison.OrdinalIgnoreCase);

            return areaCovered && canaleCovered;
        }

        void RimuoviDuplicatiRiassorbiti(
            Articoli articolo,
            ArticoliFoto fotoTarget,
            string? targetArea,
            string? targetCanale)
        {
            int targetRank = GetSpecificity(targetArea, targetCanale);

            var duplicatiDaRimuovere = articolo.ArticoliFotos!
                .Where(f => !ReferenceEquals(f, fotoTarget))
                .Where(f => fotoTarget.Id == 0 || f.Id != fotoTarget.Id)
                .Where(f => SameImage(f, fotoTarget))
                .Where(f => GetSpecificity(f.Area, f.Canale) > targetRank)
                .Where(f => IsAbsorbedByScope(f, targetArea, targetCanale))
                .ToList();

            foreach (var dup in duplicatiDaRimuovere)
            {
                articolo.ArticoliFotos.Remove(dup);
                ctx.ArticoliFotos.Remove(dup);
            }
        }

        [HttpPut]
        [Route("SyncFoto/linkLogoBollo")]
        public async Task<IActionResult> linkLogoBollo(string guidId, string nomeReale, string fileHash, string codiceReferenza, TipoFoto tipo, int id_operazione = 0)
        {
            ArticoliFoto result = new ArticoliFoto();
            try
            {

                var logoBolloResult = getLogoBolloByGuidId(guidId);

                if (logoBolloResult == null || !logoBolloResult.esito)
                {
                    throw new Exception("Errore nel tentativo di effettuare il link al guidId: " + guidId + ". " + logoBolloResult.error);
                }

                Articoli? articolo = this.ctx.Articolis.Include(f => f.ArticoliFotos).Where(f => f.Codice == codiceReferenza).FirstOrDefault();

                var logoGiaAssociato = articolo.ArticoliFotos.Where(f => f.GuidId == guidId).FirstOrDefault();

                if(logoGiaAssociato != null)
                {
                    throw new Exception("Immagine già associata al prodotto");
                }

                ArticoliFoto nuovaFoto = new ArticoliFoto();
                nuovaFoto.IdArticolo = articolo!.Id;
                nuovaFoto.NomeReale = nomeReale;
                nuovaFoto.PathFoto = logoBolloResult.item.sigla;
                nuovaFoto.StatoSelezione = (byte)StatoSelezioneFoto.Primaria;
                nuovaFoto.Attiva = true;
                nuovaFoto.Hash = fileHash;
                nuovaFoto.DataInserimento = DateTime.Now;
                nuovaFoto.DataModifica = DateTime.Now;
                nuovaFoto.GuidId = guidId;
                nuovaFoto.Tipo = (Byte)logoBolloResult.item.tipo;
                nuovaFoto.Puntatore = true;

                articolo.ArticoliFotos.Add(nuovaFoto);
                this.ctx.SaveChanges();
                result = nuovaFoto;
            }
            catch (Exception ex)
            {
                BoolResult bRes = new BoolResult();
                bRes.Esito = false;
                bRes.error = ex.Message;
                return Ok(bRes);
            }


            return Ok(result);
        }


        [HttpGet]
        [Route("SyncFoto/RimuoviFotoDaMeta/{codice}/{tipo}/{idLavorazione}/{idRec}/{id_operazione}")]
        public async Task<IActionResult> RimuoviFotoDaMeta(string codice, TipoFoto tipo, Int32 idLavorazione, Int64 idRec, int id_operazione = 0)
        {
            fotoResult result = new fotoResult();
            try
            {
                long idLavorazioneRec = 0;

                if (idLavorazione != 0)
                {
                    PromoLavorazioniRecord? plrItem = this.ctx2.PromoLavorazioniRecords.Include(i1 => i1.IdPromoTracciatiRecordNavigation).Where(plr => plr.IdLavorazione == idLavorazione && plr.CodiceGruppo!.Contains(codice)).FirstOrDefault();

                    if (plrItem == null)
                        throw new Exception($"Nessun elemento trovato con ID Record Tracciato {idRec} trovato, Codice {codice} non disponibile");
                    idLavorazioneRec = plrItem.Id;

                    Articoli _art = this.ctx.Articolis.First(f => f.Codice == codice);

                    if (_art != null)
                    {
                        var foto = this.ctx.ArticoliFotos.Where(d => d.IdArticolo == _art.Id && d.Tipo == (Byte)TipoFoto.Foto)/* NULL-ORDER 7/9/2026: su PostgreSQL i NULL vengono PRIMA in ORDER BY DESC, su SQL Server dopo. Senza HasValue una foto con data_modifica vuota risulterebbe "la piu recente" e finirebbe nel volantino al posto di quella giusta. Vedi migrazione-mssql-postgres.md §12. */ .OrderByDescending(o => o.DataModifica.HasValue).ThenByDescending(o => o.DataModifica).FirstOrDefault();
                        if(foto != null)
                        {
                            result.nomeReale = foto!.NomeReale;
                            result.tipo = TipoFoto.Foto;
                            result.guidId = foto.GuidId;
                            result.Id = foto.Id;
                            result.hash = foto.Hash;
                        }

                    }
                    else
                    {
                        throw new Exception("Articolo non trovato");
                    }
                }

                if (idLavorazione == 0)
                {
                    throw new Exception($"Non è possibile eliminare il Meta di una foto senza la sua lavorazione");
                }



                //CHE SENSO HA QUESTA AZIONE??? Dici RIMUOVI MA POI NON FAI NIENTE!
                //Di sicuro questa è un funzione di recupero dati che POI (forse) PERMETTE DI FARE QUALCOSA A QUALCUNO ma QUESTO non PUO essere un RIMUOVI
                registraAttivitaDiRimozioneMeta(id_operazione, codice, "RimuoviFotoDaMeta", new RevisioneFotoFromIndd() { codRef = codice, tipo = tipo}, idLavorazioneRec);

                result.esito = true;

            }
            catch (Exception ex)
            {
                result.error = ex.ToString();
                result.esito = false;
                return Ok(result);
            }


            return Ok(result);
        }

        [HttpPut]
        [Route("SyncFoto/RimuoviFoto/{id_operazione}")]
        public async Task<IActionResult> RimuoviFoto([FromForm] FileIndd dato, int id_operazione)
        {
            BoolResult result = new BoolResult();
            List<int> idFotosInt = new List<int>();
            try
            {

                string[] cods =  dato.codice!.Split(',');

                foreach (string cod in cods)
                {
                    var foto = this.ctx.ArticoliFotos.Include(f => f.IdArticoloNavigation).Where(f => f.GuidId == dato.guidId && f.IdArticoloNavigation.Codice==cod).FirstOrDefault();
                    if (foto != null)
                    {
                        this.ctx.ArticoliFotos.Remove(foto);
                        result.Esito = true;
                        result.error += "";
                    }
                    else
                    {
                        result.Esito = true;
                        result.error += "Foto " + dato.guidId + " non presente sul database, ";
                    }
                }

                long promoLavorazioneRecId = 0;

                if(dato.tipo == TipoFoto.Foto)
                {
                    PromoLavorazioniRecord? plrItem = this.ctx2.PromoLavorazioniRecords.Include(i1 => i1.IdPromoTracciatiRecordNavigation).Where(plr => plr.IdLavorazione == dato.idLavorazione && plr.CodiceGruppo == dato.codice).FirstOrDefault();

                    if (plrItem == null)
                        throw new Exception($"Nessun elemento trovato, Codice {dato.codice} non disponibile");
                    else
                        promoLavorazioneRecId = plrItem.Id;
                }


                this.ctx.SaveChanges();

                registraAttivitaDiSyncFoto(id_operazione, dato.codice /*foto.IdArticoloNavigation.Codice*/ , "RimuoviFoto", tipoOperazione.eliminaFotoExtra, new RevisioneFotoFromIndd() { codRef = dato.codice/* foto.IdArticoloNavigation.Codice*/, nomeFoto = dato.nomeFile/* foto.NomeReale*/, guidId= dato.guidId!/*foto.GuidId*/, tipo = (TipoFoto)dato.tipo/* foto.Tipo*/ }, promoLavorazioneRecId);

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
        [Route("SyncFoto/escludiIncludiFotoExtraAuto/{escludi}")]
        public async Task<IActionResult> escludiIncludiFotoExtraAuto(string codiceGruppo, string nomeFoto, bool escludi)
        {
            BoolResult result = new BoolResult();
            var codici = codiceGruppo.Split(",");
            if (escludi)
            {
                try
                {
                    foreach (var codice in codici)
                    {
                        var articolo = this.ctx.Articolis.Include(f => f.FotoEscluses).Where(f => f.Codice == codice).FirstOrDefault();
                        if (articolo!.FotoEscluses != null)
                        {
                            var fotoEsclusa = articolo.FotoEscluses.Where(f => f.NomeReale == nomeFoto).FirstOrDefault();
                            if (fotoEsclusa == null)
                            {
                                FotoEscluse nuovaFotoEsclusa = new FotoEscluse();
                                nuovaFotoEsclusa.IdArticolo = articolo.Id;
                                nuovaFotoEsclusa.DataInserimento = DateTime.Now;
                                nuovaFotoEsclusa.NomeReale = nomeFoto;
                                articolo.FotoEscluses.Add(nuovaFotoEsclusa);
                            }
                        }
                    }
                    this.ctx.SaveChanges();
                }
                catch(Exception ex)
                {
                    result.Esito = false;
                    result.error = ex.ToString();
                    return Ok(result);
                }
            }
            else
            {
                try
                {
                    foreach (var codice in codici)
                    {
                        var articolo = this.ctx.Articolis.Include(f => f.FotoEscluses).Where(f => f.Codice == codice).FirstOrDefault();
                        if (articolo!.FotoEscluses != null)
                        {
                            var fotoEsclusa = articolo.FotoEscluses.Where(f => f.NomeReale == nomeFoto).FirstOrDefault();
                            if (fotoEsclusa != null)
                            {
                                articolo.FotoEscluses.Remove(fotoEsclusa);
                                this.ctx.FotoEscluses.Remove(fotoEsclusa);
                            }
                        }
                    }
                    this.ctx.SaveChanges();
                }
                catch (Exception ex)
                {
                    result.Esito = false;
                    result.error = ex.ToString();
                    return Ok(result);
                }
            }
            result.Esito = true;
            return Ok(result);
        }

        [HttpGet]
        [Route("SyncFoto/caricamentoFotoMassivoOld/{elementiPagine}/{pagina}")]
        public async Task<IActionResult> caricamentoFotoMassivoOld(int elementiPagine, int pagina)
        {
            Stopwatch stopwatch = new Stopwatch();
            stopwatch.Start();
            int skip = (pagina - 1) * elementiPagine;

            var listaNomiFoto = this.ctx.ArticoliFotos
                .Select(f => new { f.Id, f.NomeReale }) // Seleziona sia l'ID che il Nome
                .ToList();

            var dictionarySupporto = listaNomiFoto
                .Skip(skip)
                .Take(elementiPagine)
                .ToDictionary(foto => foto.Id.ToString(), foto => foto.NomeReale);


            //using (var md5 = System.Security.Cryptography.MD5.Create())
            //{
            //    //var codici = element[key_codice_gruppo].ToString().Split(",");
            //    elementiGruppo = elementiGruppo.OrderBy(f => f[keyCodiceRef].ToString()).ToList();
            //    foreach (var elSingGruppo in elementiGruppo)
            //    {
            //        if (elSingGruppo.ContainsKey(_key_tracciato_firma))
            //        {
            //            firmaGruppo += elSingGruppo[_key_tracciato_firma].ToString();
            //        }
            //        else
            //        {
            //            throw new Exception("Elemento non trovato durante la ricerca dei membri del gruppo");
            //        }
            //    }
            //    byte[] bString = System.Text.ASCIIEncoding.UTF8.GetBytes(firmaGruppo);
            //    firmaGruppo = BitConverter.ToString(md5.ComputeHash(bString)).Replace("-", string.Empty);
            //}


            JObject o1 = JObject.Parse(System.IO.File.ReadAllText(this.path_external_source + "SourceUnita.json"));
            DbUnita? archiviDB = o1.ToObject<DbUnita>();

            DbUnitaItem alta_folder = archiviDB!.source.Where(s => !s.webFolder && !s.syncFolder && !s.exportFolder).FirstOrDefault()!;

            Dictionary<string, object> altaPathObject = new Dictionary<string, object>();
            string altapathJsonRString = "";
            altapathJsonRString = Newtonsoft.Json.JsonConvert.SerializeObject(alta_folder);
            altaPathObject = Newtonsoft.Json.JsonConvert.DeserializeObject<Dictionary<string, object>>(altapathJsonRString)!;

            IstantaLib.PhotoManager ph = new IstantaLib.PhotoManager();

            var resSync = ph.generaPacchettoFoto(dictionarySupporto, altaPathObject);



            // Ottieni il tempo trascorso
            TimeSpan ts = stopwatch.Elapsed;
            return Ok(new { tempoTrascorso = ts.TotalMilliseconds });
        }

        [HttpGet]
        [Route("SyncFoto/getPacchettoFotoTracciatoAsContract/{id_lavorazione}")]
        public async Task<IActionResult> getPacchettoFotoAsContract(int id_lavorazione)
        {

            try
            {

                if (ficoController == null)
                {
                    ficoController = new FicoProcessController(_config, this._external_lib, this._olConfig, null, this._httpClientFactory, _cache, this._dbContextFactory, null, dbContextFactory2: this._dbContextFactory2);
                }

                string k_cod = Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice;
                string k_guidid_foto = Enum.GetName(AddestramentoRuoli.Foto) + "." + GLOBAL_VARIABLES.keyFotoGuidId;
                string k_nome_foto = Enum.GetName(AddestramentoRuoli.Foto) + "." + GLOBAL_VARIABLES.keyFotoNome;

                LogAssistent las = new LogAssistent();
                las.WriteLine($"> getPacchettoFotoAsContract step1");
                ficoController.HttpContextInRent = HttpContext;
                var promise = await ficoController.processaKit(id_lavorazione, FicoCombinazioneKitReadMode.Advanced, true);
                las.WriteLine($"> getPacchettoFotoAsContract step2");
                var okResult = promise as OkObjectResult;
                ArticoloInRevisioneKitResult result = (okResult!.Value as ArticoloInRevisioneKitResult)!;

                //Scarico tutti i dati json di tutti gli articoli in tracciato
                List<string> tRecordsJson = result.records.Select(s => s.recordInTracciato[k_cod].ToString()!).ToList();
                las.WriteLine($"> getPacchettoFotoAsContract step3");
                //Console.WriteLine($"Codici per ricerca foto {String.Join(',', tRecordsJson)}");

                //Qui devo prendere la descrizione revisionata dell'articolo singolo piazzato in menabo
                List<Articoli> artItems = this.ctx.Articolis
                .Include(s => s.ArticoliFotos)
                .Where(a => tRecordsJson.Contains(a.Codice))
                .ToList();

                las.WriteLine($"> getPacchettoFotoAsContract step4");

                ////Console.WriteLine($"Kit {result.records.Count} , {result.error}");
                ////Console.WriteLine($"Articoli trovati nel kit {artItems.Count}");



                List<FileOlympoSync> fotoRichieste = new List<FileOlympoSync>();
                //fotoRichieste.Add(new FileOlympoSync
                //{
                //    Id = "e592df39-12eb-4ffb-9f02-dddd49bfaf1a",
                //    FileName = "ciao.psd"
                //});
                foreach (var art in artItems)
                {
                    ArticoliFoto? af = art.ArticoliFotos!.Where(f => (!f.Tipo.HasValue || f.Tipo == (Byte)TipoFoto.Foto) && f.Attiva == true).OrderByDescending(o => o.DataModifica).FirstOrDefault();//.Where(af => af.StatoSelezione == (Byte)StatoSelezioneFoto.Primaria).OrderByDescending(o => o.DataModifica).ThenByDescending(o2 => o2.DataInserimento).FirstOrDefault();

                    if (af != null)
                    {
                        var inTrackItem = result.records.FirstOrDefault(t => t.recordInTracciato[k_cod].ToString() == art.Codice);

                        if (inTrackItem != null && inTrackItem.recordInTracciato.ContainsKey(k_guidid_foto))
                        {

                            if (af.GuidId != inTrackItem.recordInTracciato[k_guidid_foto].ToString())
                            {
                                af = art.ArticoliFotos!.FirstOrDefault(af2 => af2.GuidId == inTrackItem.recordInTracciato[k_guidid_foto].ToString());
                            }
                        }


                        if (af != null)
                        {
                            //Console.WriteLine($"{af.NomeReale} - {af.GuidId}");
                            //ATTENZIONE: controlliamo che qui non incida sul db realmente
                            fotoRichieste.Add(new FileOlympoSync
                            {
                                Id = af.GuidId,
                                FileName = af.NomeReale,
                                IdRef = af.Id.ToString()
                            });
                        }
                        else
                        {
                            //ATTENZIONE: se si entra qui significa che questa ref NON ha foto, questo deve essre gesitto da plugin NON più con una foto fittizia fatta di cod.psd con un NOFOTO.
                        }
                    }
                }

                List<FileOlympoSync> fotoNoValide = fotoRichieste.Where(f => f.Id == "").ToList();
                fotoRichieste = fotoRichieste.Where(f => f.Id != null && f.Id != "").ToList();
                //int skip = (pagina - 1) * elementiPagine;

                //var listaNomiFoto = this.ctx.ArticoliFotos
                //    .Select(f => new { f.Id, f.NomeReale, f.GuidId }) // Seleziona sia l'ID che il Nome
                //    .ToList();

                //var dictionarySupporto = listaNomiFoto
                //    .Skip(skip)
                //    .Take(elementiPagine).Select(s => new FileOlympoSync
                //    {
                //        Id = s.GuidId
                //    }).ToList();


                //Console.WriteLine($"Richiesta di FOTO ad OLYMPO {fotoRichieste.Count}");

                //var resSync = ph.generaPacchettoFoto(dictionarySupporto, altaPathObject);
                //using var httpClient = new HttpClient();
                string uri = olympusServerUrl + "/foto/getInfoMassivo";

                var content = new StringContent(JsonConvert.SerializeObject(fotoRichieste), Encoding.UTF8, "application/json");
                // Effettua la richiesta PUT
                HttpResponseMessage response = await httpClient.PutAsync(uri, content);

                if (response.IsSuccessStatusCode)
                {
                    var responseBody = await response.Content.ReadAsStringAsync();
                    var dataOlympo = JsonConvert.DeserializeObject<List<FileOlympoSync>>(responseBody);

                    //Console.WriteLine($"RRisposta di OLYMPO {dataOlympo.Count}");
                    return Ok(dataOlympo);
                    ////Console.WriteLine(responseBody);
                }
                else
                {
                    ////Console.WriteLine("Error: " + response.StatusCode);
                    return Ok(response.StatusCode);
                }
            }
            catch(Exception ex)
            {
                BoolResult br=new BoolResult();
                br.Esito = false;            
                br.error = ex.ToString();
                return Ok(br);
            }

        }

        [HttpPut]
        [Route("SyncFoto/getFotosAsContractNew/{id_lavorazione}")]
        [Route("SyncFoto/getFotosAsContract/{id_lavorazione}")]

        public async Task<IActionResult> getFotosAsContractNew(int id_lavorazione, string codici)
        {

            FileOlympoOperazioneMassiva result = new FileOlympoOperazioneMassiva();
            string k_cod = Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice;

            //Scarico tutti i dati json di tutti gli articoli in tracciato

            var codiciList = codici.Split(",").ToList();

            Console.WriteLine($"getFotosAsContract {codiciList.Count} codici {String.Join(", ", codiciList)}");

            var lavorazione = this.ctx2.PromoLavorazionis.FirstOrDefault(f => f.Id == id_lavorazione);

            if(lavorazione == null)
            {
                result.error = "Lavorazione con id " + id_lavorazione + " non trovata";
                return Ok(result);
            }

            var guidCanale = lavorazione.GuidCanale;
            var guidArea = lavorazione.GuidArea;

            var tracciatoDaCuiEstrarreAreaECanale = this.ctx2.PromoTracciatis.FirstOrDefault(f => f.guidCanale == guidCanale && f.guidArea == guidArea);

            if(tracciatoDaCuiEstrarreAreaECanale == null)
            {
                result.error = "Nessun tracciato tracciato usando i guid area e canale della lavorazione con id " + id_lavorazione + " non trovata";
                return Ok(result);
            }

            var canale = tracciatoDaCuiEstrarreAreaECanale.Canale;
            var area = tracciatoDaCuiEstrarreAreaECanale.Area;

            //Qui devo prendere la descrizione revisionata dell'articolo singolo piazzato in menabo
            List<Articoli> artItems = this.ctx.Articolis
            .Include(s => s.ArticoliFotos)
            .Where(a => codiciList.Contains(a.Codice))
            .ToList();


            Console.WriteLine($"getFotosAsContract {artItems.Count}");

            List<FileOlympoSync> fotoRichieste = new List<FileOlympoSync>();
            foreach (var art in artItems)
            {
                List<ArticoliFoto> afList = art.ArticoliFotos!.Where(f => (!f.Tipo.HasValue || 
                f.Tipo == (Byte)TipoFoto.Foto) && f.Attiva == true)
                    .OrderByDescending(o => o.DataModifica).ToList();

                ArticoliFoto af = getFoto(afList, area, canale);

                if (af != null)
                {
                    //ATTENZIONE: controlliamo che qui non incida sul db realmente
                    fotoRichieste.Add(new FileOlympoSync
                    {
                        Id = af.GuidId,
                        FileName = af.NomeReale,
                        IdRef = af.Id.ToString()
                    });
                }
                else
                {
                    //ATTENZIONE: se si entra qui significa che questa ref NON ha foto, questo deve essre gesitto da plugin NON più con una foto fittizia fatta di cod.psd con un NOFOTO.
                }
            }

            fotoRichieste = fotoRichieste.Where(f => f.Id != null && f.Id != "").ToList();

            Console.WriteLine($"Richiesta di FOTO ad OLYMPO {fotoRichieste.Count}");
            string uri = olympusServerUrl + "/foto/getInfoMassivo";

            var content = new StringContent(JsonConvert.SerializeObject(fotoRichieste), Encoding.UTF8, "application/json");
            // Effettua la richiesta PUT
            HttpResponseMessage response = await httpClient.PutAsync(uri, content);

            if (response.IsSuccessStatusCode)
            {
                var responseBody = await response.Content.ReadAsStringAsync();
                var dataOlympo = JsonConvert.DeserializeObject<List<FileOlympoSync>>(responseBody);

                Console.WriteLine($"RRisposta di OLYMPO {dataOlympo.Count}");
                result.lista = dataOlympo;
                return Ok(result);
            }
            else
            {
                Console.WriteLine("Error: " + response.StatusCode);
                result.error = "Error: " + response.StatusCode;
                return Ok(result);
            }

        }

        public ArticoliFoto getFoto(List<ArticoliFoto> artFotoList, string area, string canale)
        {

            string keyFotoRegionale = GLOBAL_VARIABLES.keyFotoRegionale;
            string keyFotoCanale = GLOBAL_VARIABLES.keyFotoCanale;
            string _key_foto = Enum.GetName(AddestramentoRuoli.Foto) + "." + GLOBAL_VARIABLES.keyFotoNome;
            string keyGuidFoto = Enum.GetName(AddestramentoRuoli.Foto) + "." + GLOBAL_VARIABLES.keyFotoGuidId;
            string keyHash = Enum.GetName(AddestramentoRuoli.Foto) + "." + GLOBAL_VARIABLES.keyFotoHash;
            string keyIdFoto = Enum.GetName(AddestramentoRuoli.Foto) + "." + GLOBAL_VARIABLES.keyId;

            ArticoliFoto? naz = null;

            if (artFotoList == null || artFotoList.Count == 0)
            {
                return null;

            }

            naz = artFotoList.Find(f => f.Area == null && f.Canale == null && f.Attiva == true);

            ArticoliFoto? artFoto = null;

            List<ArticoliFoto> fotoListPerCustom = new List<ArticoliFoto>();
            //si prova una ricerca annidata a partire dal tracciato
            fotoListPerCustom = artFotoList!.Where(g => g.Area == area && g.Canale == canale && g.Attiva == true).OrderByDescending(o => o.DataModifica).ToList();
            if (fotoListPerCustom.Count > 0)
            {
                artFoto = fotoListPerCustom[0];
            }


            if (artFoto == null)
            {
                //se siamo qui non esiste una corrispondenza per area/canale della foto
                //proviamo solo per area poichè noi abbiamo deciso che avrà la precedenza sul solo canale
                fotoListPerCustom = artFotoList!.Where(g => g.Area == area && g.Canale == null && g.Attiva == true).OrderByDescending(o => o.DataModifica).ToList();
                if (fotoListPerCustom.Count > 0)
                {
                    artFoto = fotoListPerCustom[0];
                }

                if (artFoto == null)
                {
                    //proviamo a cercarla solo per canale
                    fotoListPerCustom = artFotoList!.Where(g => g.Canale == canale && g.Area == null && g.Attiva == true).OrderByDescending(o => o.DataModifica).ToList();
                    if (fotoListPerCustom.Count > 0)
                    {
                        artFoto = fotoListPerCustom[0];
                    }

                    if (artFoto == null)
                    {
                        //usiamo la nazionale già impostata (Se esiste davvero)
                        artFoto = naz;
                    }

                }

            }

            return artFoto;
        }




        [HttpGet]
        [Route("SyncFoto/getPacchettoLoghiBolliAsContract")]
        public async Task<IActionResult> getPacchettoLoghiBolliAsContract()
        {

            if (ficoController == null)
            {
                ficoController = new FicoProcessController(_config, this._external_lib, this._olConfig, null,  this._httpClientFactory, _cache, this._dbContextFactory, null, dbContextFactory2: this._dbContextFactory2);
            }

            List<FileOlympoSync> fotoRichieste = new List<FileOlympoSync>();
            foreach (var logobollo in SingletonConfiguration.DBLOGHIBOLLI!.source)
            {

                fotoRichieste.Add(new FileOlympoSync
                {
                    Id = logobollo.guidId,
                    FileName = logobollo.nome,
                    IdRef = "0"
                });

            }

            //var resSync = ph.generaPacchettoFoto(dictionarySupporto, altaPathObject);
            //using var httpClient = new HttpClient();
            string uri = olympusServerUrl + "/foto/getInfoMassivo";

            var content = new StringContent(JsonConvert.SerializeObject(fotoRichieste), Encoding.UTF8, "application/json");
            // Effettua la richiesta PUT
            HttpResponseMessage response = await httpClient.PutAsync(uri, content);

            if (response.IsSuccessStatusCode)
            {
                var responseBody = await response.Content.ReadAsStringAsync();
                var dataOlympo = JsonConvert.DeserializeObject<List<FileOlympoSync>>(responseBody);

                foreach (var item in dataOlympo)
                {
                    var logo = getLogoBolloByGuidId(item.Id);
                    if (logo.esito)
                    {
                        item.Tipo = logo.item.tipo;
                    }
                }
                
                return Ok(dataOlympo);
                ////Console.WriteLine(responseBody);
            }
            else
            {
                ////Console.WriteLine("Error: " + response.StatusCode);
                return Ok(response.StatusCode);
            }

        }

        [HttpGet]
        [Route("SyncFoto/getInfoFoto/{guid}")]
        public async Task<IActionResult> getInfoFoto(string guid)
        {
            ArticoliFoto? afItem =  this.ctx.ArticoliFotos.Where(f=>f.GuidId==guid).FirstOrDefault();
            if (afItem != null)
            {
                List<FileOlympoSync> fotoRichieste = new List<FileOlympoSync>();
                fotoRichieste.Add(new FileOlympoSync
                {
                    Id = afItem.GuidId,
                    FileName = afItem.NomeReale,
                    IdRef=afItem.Id.ToString()
                });


                //var resSync = ph.generaPacchettoFoto(dictionarySupporto, altaPathObject);
                //using var httpClient = new HttpClient();
                string uri = olympusServerUrl + "/foto/getInfoMassivo";

                var content = new StringContent(JsonConvert.SerializeObject(fotoRichieste), Encoding.UTF8, "application/json");
                // Effettua la richiesta PUT
                HttpResponseMessage response = await httpClient.PutAsync(uri, content);

                if (response.IsSuccessStatusCode)
                {
                    var responseBody = await response.Content.ReadAsStringAsync();
                    var dataOlympo = JsonConvert.DeserializeObject<List<FileOlympoSync>>(responseBody)!;
                    if (dataOlympo.Count > 0)
                        return Ok(dataOlympo.FirstOrDefault());
                    ////Console.WriteLine(responseBody);
                }
                else
                {
                    ////Console.WriteLine("Error: " + response.StatusCode);
                    return BadRequest(response.StatusCode);
                }
            }

            return NoContent();

        }

        #region Loghi/Bolli

        [HttpGet]
        [Route("LoghiBolli/get")]
        public async Task<IActionResult> getLoghiBolli()
        {
            DbLoghiBolli? objLoghiBolli = Utility.SingletonConfiguration.DBLOGHIBOLLI;
            var res = objLoghiBolli!.source.Where(lb => 
            lb.tipo == TipoFoto.Logo ||
            lb.tipo == TipoFoto.Bollino ||
            lb.tipo == TipoFoto.Sfondo
            ).ToList();
            return Ok(res);

        }

        [HttpGet]
        [Route("LoghiBolli/getBySigla/{codice}")]
        public async Task<IActionResult> getLogoBolloBySigla(string codice)
        {
            LogoBolloOperationResult result = new LogoBolloOperationResult();
            try
            {
                DbLoghiBolli? objLoghiBolli = Utility.SingletonConfiguration.DBLOGHIBOLLI;
                LogoBollo lb = objLoghiBolli!.source.FirstOrDefault(l => l.sigla == codice)!;
                if (lb == null)
                    throw new Exception("not_found");

                result.item = lb;
                result.esito = true;
            }

            catch(Exception ex)
            {
                result.esito = false;
                result.error = ex.ToString();
            }

            return Ok(result);

        }

        public static LogoBolloOperationResult getLogoBolloByGuidId(string guidId)
        {
            LogoBolloOperationResult result = new LogoBolloOperationResult();
            try
            {
                DbLoghiBolli? objLoghiBolli = Utility.SingletonConfiguration.DBLOGHIBOLLI;
                LogoBollo lb = objLoghiBolli!.source.FirstOrDefault(l => l.guidId == guidId)!;
                if (lb == null)
                    throw new Exception("not_found");

                result.item = lb;
                result.esito = true;
            }

            catch (Exception ex)
            {
                result.esito = false;
                result.error = ex.ToString();
            }

            return result;

        }

        /// <summary>
        /// Controlla i campi obbligatori PRIMA di toccare Olimpo o il Source.
        /// Ritorna null se va tutto bene, altrimenti il messaggio da mostrare all'utente.
        /// Non solleva eccezioni: qui i problemi sono previsti, non eccezionali.
        /// Il controllo c'e' anche nel javascript, ma questo endpoint e' raggiungibile
        /// direttamente, quindi la validazione che conta e' questa.
        /// </summary>
        private string? validaLogoBollo(InputLogoBollo obj, bool fileObbligatorio)
        {
            if (string.IsNullOrWhiteSpace(obj.Sigla))
                return "La sigla e' obbligatoria.";

            // La tendina parte da "Seleziona tipo", che vale 0: senza questo controllo
            // un tipo fuori elenco arrivava in fondo al metodo senza che nessun ramo lo
            // gestisse, e la risposta era esito=true pur non avendo salvato niente.
            if (obj.Tipo != TipoFoto.Logo && obj.Tipo != TipoFoto.Bollino &&
                obj.Tipo != TipoFoto.Sfondo && obj.Tipo != TipoFoto.Artwork)
                return "Tipo non valido: scegliere Logo, Bollo o Sfondo.";

            if (obj.file == null)
                return fileObbligatorio ? "Nessuna immagine caricata." : null;

            if (obj.file.Length == 0)
                return $"Il file '{obj.file.FileName}' e' vuoto.";

            // Il FORMATO non si controlla: da qui si accetta qualunque tipo di file, e
            // se non va bene e' Olimpo a rifiutarlo. L'errore che torna da lui arriva
            // comunque all'utente, con il prefisso "Caricamento dell'immagine su Olimpo
            // non riuscito". Qui si ferma solo il file vuoto, che non e' una questione
            // di formato ma di caricamento andato storto.

            return null;
        }

        [HttpPost]
        [Route("LoghiBolli/salva")]
        public async Task<IActionResult> salvaLogoBollo([FromForm] InputLogoBollo obj)
        {


            
            LogoBolloOperationResult result = new LogoBolloOperationResult();


            try
            {
                DbLoghiBolli objLoghiBolli = Utility.SingletonConfiguration.DBLOGHIBOLLI!;

                // Si valida prima di tutto: se qualcosa non va, l'utente deve saperlo
                // senza che sia gia' finito un file su Olimpo. Per un elemento nuovo il
                // file e' obbligatorio, per uno esistente e' facoltativo (si puo' voler
                // cambiare solo sigla o tipo).
                bool isNuovo = string.IsNullOrEmpty(obj.Id);
                string? erroreValidazione = validaLogoBollo(obj, isNuovo);
                if (erroreValidazione != null)
                {
                    result.error = erroreValidazione;
                    return Ok(result);
                }

                if (obj.Id != null && obj.Id != "")
                {
                    result.item = objLoghiBolli.source.FirstOrDefault(l => l.id == obj.Id)!;
                    if (result.item == null)
                    {
                        throw new Exception("logobollo not found");
                    }


                    if (obj.file!=null/* && result.item.Nome!= obj.file.FileName*/)
                    {
                        //Upoload su Olympo e cambio di guidid


                        StringResult resUpload = await uploadLogoBollo(obj);
                        if (!resUpload.boolEsito)
                        {
                            throw new Exception("Caricamento dell'immagine su Olimpo non riuscito: " + resUpload.error);
                        }
                        else
                        {
                            result.item.guidId = resUpload.Esito;
                            result.item.nome = obj.file.FileName;
                        }
                    }    

                    result.item.dataModifica = DateTime.Now.ToString("dd/MM/yyyy HH:mm:ss");

                    result.item.tipo = obj.Tipo;
                    result.item.sigla = obj.Sigla;

                    Utility.SingletonConfiguration.SaveLoghiBolli();
                }
                else
                {
                    // (il file obbligatorio per il nuovo elemento lo verifica validaLogoBollo)
                    //E' nuovo
                    LogoBollo item = new LogoBollo();

                    StringResult resUpload = await uploadLogoBollo(obj);

                    if (obj.Tipo == TipoFoto.Bollino || obj.Tipo == TipoFoto.Logo || obj.Tipo == TipoFoto.Sfondo)
                    {
                        if (!resUpload.boolEsito)
                        {
                            throw new Exception("Caricamento dell'immagine su Olimpo non riuscito: " + resUpload.error);
                        }

                        item.guidId = resUpload.Esito;

                        item.id = Guid.NewGuid().ToString();
                        item.dataModifica = DateTime.Now.ToString("dd/MM/yyyy HH:mm:ss");
                        item.nome = obj.file!.FileName;
                        item.tipo = obj.Tipo;
                        item.sigla = obj.Sigla;

                        result.item = item;

                        //Upoload su Olympo e set di guidid
                        //item.GuidId = Olympo result

                        objLoghiBolli.source.Add(item);
                        Utility.SingletonConfiguration.SaveLoghiBolli();
                    }
                    else if (obj.Tipo == TipoFoto.Artwork)
                    {
                        if (!resUpload.boolEsito)
                        {
                            throw new Exception("Caricamento dell'immagine su Olimpo non riuscito: " + resUpload.error);
                        }

                        item.guidId = resUpload.Esito;

                        result.item = item;
                    }
                    else
                    {
                        // Non dovrebbe accadere, perche' validaLogoBollo ammette solo i
                        // quattro tipi gestiti qui sopra. Prima questo ramo non c'era e un
                        // tipo fuori elenco usciva con esito=true senza aver salvato nulla.
                        throw new Exception($"Tipo non gestito: {obj.Tipo}.");
                    }

                }

                result.esito = true;
            }
            catch(Exception ex)
            {
                // Il dettaglio completo va nel log (la Console e' dirottata su Serilog),
                // all'utente il solo messaggio: prima in interfaccia arrivava lo stack
                // trace intero, illeggibile e inutile per chi sta caricando un logo.
                Console.WriteLine("Errore in LoghiBolli/salva: " + ex.ToString());
                result.error = ex.Message;
            }
            
            return Ok(result);

        }

        async private Task<StringResult> uploadLogoBollo(InputLogoBollo logobollo)
        {

            StringResult result = new StringResult();
            try
            {

                Stream str = logobollo.file!.OpenReadStream();
                byte[] arrBytes = new byte[str.Length];
                str.ReadExactly(arrBytes, 0, (int)str.Length);



                //using var httpClient = new HttpClient();
                string uri = olympusServerUrl + "/foto/uploadFoto";


                //msg.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

                var form = new MultipartFormDataContent();

                var fileContent = new ByteArrayContent(arrBytes);
                fileContent.Headers.ContentType = MediaTypeHeaderValue.Parse("multipart/form-data");

                string filename = logobollo.file.FileName;

                if (logobollo.Tipo == TipoFoto.Artwork)
                {
                    filename = logobollo.Sigla + ".png";

                }

                form.Add(fileContent, "file", filename);

                FileOlympoSync olympoJson =  new FileOlympoSync()
                {
                    Id = "0",
                    FileHash = Crypto.GetMD5HashFromFile(arrBytes),
                    FileName = filename,
                    IdRef = "0",
                    Size = 0
                };

                string jsString = JsonConvert.SerializeObject(olympoJson);
                var contentJson = new StringContent(jsString, Encoding.UTF8, "application/json");
                form.Add(contentJson, "json_meta_foto");

                var response = await httpClient.PostAsync(uri, form);


                if (response.IsSuccessStatusCode)
                {
                    var responseBody = await response.Content.ReadAsStringAsync();
                    var dataOlympo = JsonConvert.DeserializeObject<FileOlympoOperazioneSingola>(responseBody)!;
                    if(dataOlympo.error!= null && dataOlympo.error!="")
                    {
                        throw new Exception(dataOlympo.error);
                    }

                    FileOlympoSync fileOlympo = dataOlympo.record!;
                    result.Esito = fileOlympo.Id;
                    result.boolEsito = true;
                }
                else
                {
                    throw new Exception("Error Olympo: " + response.StatusCode);
                }                

            }
            catch (Exception ex)
            {
                Console.WriteLine("Errore nel caricamento su Olimpo: " + ex.ToString());
                result.error = ex.Message;
            }

            return result;
        }

        [HttpGet]
        [Route("LoghiBolli/elimina/{id}")]
        public async Task<IActionResult> eliminaLogoBollo(string id)
        {

            BoolResult result = new BoolResult();

            try
            {
                DbLoghiBolli objLoghiBolli = Utility.SingletonConfiguration.DBLOGHIBOLLI!;


                LogoBollo logoToDel = objLoghiBolli.source.FirstOrDefault(l => l.id == id)!;
                if (logoToDel == null)
                {
                    throw new Exception("logobollo not found");
                }

                objLoghiBolli.source.Remove(logoToDel);

                Utility.SingletonConfiguration.DBLOGHIBOLLI.SaveChanges();


                result.Esito = true;
            }
            catch (Exception ex)
            {
                result.error = ex.ToString();
            }

            return Ok(result);

        }

        #endregion


        #region ricerca nel registro

        [HttpPost]
        [Route("SyncFoto/ricercaNelRegistro")]
        public async Task<IActionResult> ricercaNelRegistro([FromForm] RicercaRegitroRequest req)
        {
            RicercaRegistroSyncFotoResponse result = new RicercaRegistroSyncFotoResponse();
            try
            {

                DateTime? dtDa = req.dataDa;
                DateTime? dtA = req.dataA;

                if (!dtDa.HasValue || !dtA.HasValue)
                {
                    result.error = "Date not valid";
                    return BadRequest(result);
                }
                else
                {
                    double dayDiff = dtA.Value.Subtract(dtDa.Value).TotalDays;
                    if (dayDiff > 40)
                    {
                        result.error = "not_more_40";
                        return BadRequest(result);
                    }
                    else if (dayDiff < 0)
                    {
                        result.error = "a_maggiore_di_da";
                        return BadRequest(result);
                    }
                    else
                    {
                        result.list = await this.ctx.RegistroOperazionis
                            .Where(r => r.Data_Registrazione >= dtDa.Value && r.Data_Registrazione <= dtA.Value && r.TipoOperazione == (Byte)tipoOperazione.syncPacchettoFoto)
                            .OrderByDescending(o=>o.Data_Registrazione)
                            .Select(s => new RicercaRecordRegistroSyncFotoResponse()
                            {
                                DataRegistrazione=s.Data_Registrazione,
                                FormData=s.FormData!,
                                Stato=s.Stato,
                                Autore=s.Autore,
                                CodiceAssociativo=s.CodiceAssociato!,
                                TipoOperazione = s.TipoOperazione,
                                Url=s.Url!,
                                Meta=JsonConvert.DeserializeObject<RevisioneSyncFoto>(s.FormData!)!
                            }).ToListAsync();                        
                    }
                }
                    
            }
            catch (Exception ex)
            {
                result.error = ex.ToString();
                return BadRequest(result);
            }

            return Ok(result);
        }

        #endregion

        private string registraAttivitaDiSyncFoto(int id_operazione, string codRef, string url, tipoOperazione tipo, RevisioneFotoFromIndd? upFotoRev=null, Int64 id_lavorazione_record=0)
        {
            Register register = new Register(connstring, this._dbContextFactory, dbContextFactory2: this._dbContextFactory2);
            var session = SessionIstantaObject.GetSession(HttpContext);

            if (id_operazione == 0)
            {
                var nuovaOperazione = new RegistroOperazioni();
                nuovaOperazione.Autore = int.Parse(session);
                nuovaOperazione.TipoOperazione = (byte)tipo;// tipoOperazione.updateFoto;
                nuovaOperazione.CodiceAssociato = codRef;
                nuovaOperazione.Url = url;
                if (upFotoRev != null)
                {
                    nuovaOperazione.FormData = JsonConvert.SerializeObject(upFotoRev);
                }
                if (id_lavorazione_record>0)
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

        private StringResult registraAttivitaMassivaDiSyncFoto(RevisioneSyncFoto rev)
        {
            StringResult res = new StringResult();

            Register register = new Register(connstring, this._dbContextFactory, dbContextFactory2: this._dbContextFactory2);
            var session = SessionIstantaObject.GetSession(HttpContext);


            var nuovaOperazione = new RegistroOperazioni();
            nuovaOperazione.Autore = int.Parse(session);
            nuovaOperazione.TipoOperazione = (Byte)tipoOperazione.syncPacchettoFoto;
            nuovaOperazione.CodiceAssociato = "syncMassivo";
            nuovaOperazione.Url = rev.dir;//Directory di sync sfogliata dal computer dell'operatore
            nuovaOperazione.FormData = JsonConvert.SerializeObject(rev);
            

            Int64 idAttivita = register.addOperazione(nuovaOperazione, true, session, DateTime.Now);
            if (idAttivita == 0)
            {
                res.error = "Impossibile aggiungere l'operazione ai task del registro operazioni";
                res.Esito = "0";
                res.boolEsito = false;
            }
            else
            {
                res.Esito = idAttivita.ToString();
                res.boolEsito = true;
            }

            return res;
        }

        private string registraAttivitaDiRimozioneMeta(int id_operazione, string codRef, string url, RevisioneFotoFromIndd? upFotoRev = null, Int64 id_lavorazione_record = 0)
        {
            Register register = new Register(connstring, this._dbContextFactory, dbContextFactory2: this._dbContextFactory2);
            var session = SessionIstantaObject.GetSession(HttpContext);

            if (id_operazione == 0)
            {
                var nuovaOperazione = new RegistroOperazioni();
                nuovaOperazione.Autore = int.Parse(session);
                nuovaOperazione.TipoOperazione = (byte)tipoOperazione.rimuoviMetaFoto;
                nuovaOperazione.CodiceAssociato = codRef;
                nuovaOperazione.Url = url;
                if (upFotoRev != null)
                {
                    nuovaOperazione.FormData = JsonConvert.SerializeObject(upFotoRev);
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


    }

}
