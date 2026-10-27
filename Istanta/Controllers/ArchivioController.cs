using Microsoft.AspNetCore.Mvc;
using Istanta.Models;
using Microsoft.EntityFrameworkCore;
using LinqKit;
using Newtonsoft;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using System.Reflection;
using Microsoft.Extensions.Options;
using DocumentFormat.OpenXml.Presentation;
using System;
using Newtonsoft.Json.Linq;
using System.IO.Compression;
using DocumentFormat.OpenXml.Spreadsheet;
using IstantaLib;
using Register = Istanta.Utility.Register;
using System.Net;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using Newtonsoft.Json;
using Istanta.Models_2;

namespace Istanta.Controllers
{
    public enum StatusOfRevisioneArticolo
    {
        NonProcessato = 0,
        DescrizioneConadApprovata = 1,
        DescrizioneConadRigettata = 2,
        Obsoleto = 3,
        ProcessatoDaEdro = 4
    }

    public class ArchivioController : Controller
    {
        private readonly ILogger<ArchivioController> _logger;
        private readonly edro21_dbContext ctx;
        private readonly Int32 recordPerPage = 20;
        private readonly string path_external_source = "";
        private readonly IDbContextFactory<edro21_dbContext> _dbContextFactory;
        private readonly string olympusServerUrl;
        private readonly string connstring;
        private readonly HttpClient httpClient;

        private readonly IDbContextFactory<Edro21_DbContext2> _dbContextFactory2;
        public ArchivioController(ILogger<ArchivioController> logger, IConfiguration configuration, IOptions<PathExternal> external_lib, IOptions<FicoConfig> olConfig, IDbContextFactory<edro21_dbContext> dbContextFactory, IHttpClientFactory httpClientFactory, IDbContextFactory<Edro21_DbContext2> dbContextFactory2)
        {
            this._dbContextFactory2 = dbContextFactory2;
            this._dbContextFactory = dbContextFactory;
            this.ctx = this._dbContextFactory.CreateDbContext(); //new edro21_dbContext(configuration.GetConnectionString("IstandaConnectionDb")!);
            _logger = logger;
            path_external_source = external_lib.Value.pathSource;
            olympusServerUrl = olConfig.Value.olympusServerUrl;
            connstring = configuration.GetConnectionString("IstandaConnectionDb")!;
            httpClient = httpClientFactory.CreateClient();

            ViewData["jsGuid"] = Guid.NewGuid().ToString();
        }

        // ------------------------------------------------------------------
        // Istanta4 - reparto / settore / categoria
        // In archivio questi campi non esistono (articoli.reparto e segmento
        // restano NULL: li riempie il Revisore). Il dato pero' c'e', dentro il
        // JSON di ogni riga di lista. Qui costruisco la corrispondenza
        // codice -> merceologia leggendo l'ultimo tracciato che cita il codice.
        // La mappa cambia solo a ogni importazione, quindi la tengo in memoria
        // per qualche minuto invece di rileggerla a ogni ricerca.
        //
        // TASK-a77bd7b2: scaduta, non la aspetta piu' la richiesta che la trova:
        // si risponde con quella di prima e la si rilegge in background
        // (CacheConRinnovo). Solo la prima apertura dopo l'avvio aspetta.
        // ------------------------------------------------------------------
        private static Utility.CacheConRinnovo<Dictionary<string, string[]>>? _cacheMerceologia = null;
        private static readonly object _lockMerceologia = new object();

        private Dictionary<string, string[]> getMerceologia()
        {
            Utility.CacheConRinnovo<Dictionary<string, string[]>> cache;
            lock (_lockMerceologia)
            {
                // La fabbrica dei contesti e il logger sono singleton: il rinnovo in background puo'
                // usarli anche dopo la fine di questa richiesta.
                var fabbrica = this._dbContextFactory;
                var logger = this._logger;
                _cacheMerceologia ??= new Utility.CacheConRinnovo<Dictionary<string, string[]>>(
                    () => caricaMerceologia(fabbrica, logger),
                    // Senza merceologia la pagina funziona lo stesso, solo senza
                    // i filtri per reparto: non e' un motivo per non rispondere.
                    () => new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase),
                    TimeSpan.FromMinutes(5),
                    ex => logger.LogWarning("Archivio: merceologia non disponibile -> {Messaggio}", ex.Message));
                cache = _cacheMerceologia;
            }
            return cache.Leggi();
        }

        private static Dictionary<string, string[]> caricaMerceologia(IDbContextFactory<edro21_dbContext> fabbrica, ILogger logger)
        {
            var cronometro = System.Diagnostics.Stopwatch.StartNew();
            var mappa = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);

            using (var ctxLocale = fabbrica.CreateDbContext())
            {
                var conn = ctxLocale.Database.GetDbConnection();
                if (conn.State != System.Data.ConnectionState.Open) conn.Open();
                using (var cmd = conn.CreateCommand())
                {
                    // CORREZIONE 7/9/2026: la query si sceglie in base al motore (RicercaArchivio.QueryMerceologia).
                    bool suPostgres = (ctxLocale.Database.ProviderName ?? "").Contains("Npgsql");
                    cmd.CommandText = Utility.RicercaArchivio.QueryMerceologia(suPostgres);
                    cmd.CommandTimeout = 30;
                    using (var rd = cmd.ExecuteReader())
                    {
                        while (rd.Read())
                        {
                            string cod = rd.GetString(0);
                            if (string.IsNullOrEmpty(cod)) continue;
                            mappa[cod] = new string[] {
                                rd.IsDBNull(1) ? "" : rd.GetString(1),
                                rd.IsDBNull(2) ? "" : rd.GetString(2),
                                rd.IsDBNull(3) ? "" : rd.GetString(3)
                            };
                        }
                    }
                }
            }

            logger.LogInformation("Archivio: merceologia di {Codici} codici letta in {Millisecondi} ms", mappa.Count, cronometro.ElapsedMilliseconds);
            return mappa;
        }

        public async Task<IActionResult> Index()
        {
            // Prima la GET restituiva la pagina senza risultati: per una pagina
            // che serve a trovare in fretta una referenza, mostrare subito la
            // prima pagina dell'archivio e' piu' utile di un modulo vuoto.
            return await eseguiRicerca(null, null, null, null, null, null,
                                       null, null, null, null, null, 0, 0);
        }

        [HttpPost]
        public async Task<IActionResult> Index(string search_generic, string search_codice, string search_brand, string search_tipogusto, string search_gramm, string search_nome, string search_reparto, string search_settore, string search_categoria, string search_foto, string ordinamento, Int32 Page, int any_changed)
        {
            return await eseguiRicerca(search_generic, search_codice, search_brand,
                                       search_tipogusto, search_gramm, search_nome,
                                       search_reparto, search_settore, search_categoria,
                                       search_foto, ordinamento, Page, any_changed);
        }

        private async Task<IActionResult> eseguiRicerca(string? search_generic, string? search_codice, string? search_brand, string? search_tipogusto, string? search_gramm, string? search_nome, string? search_reparto, string? search_settore, string? search_categoria, string? search_foto, string? ordinamento, Int32 Page, int any_changed)
        {
            ViewBag.ipOlympus = olympusServerUrl;

            ViewBag.search_generic = search_generic;
            ViewBag.search_codice = search_codice;
            ViewBag.search_nome = search_nome;
            ViewBag.search_brand = search_brand;
            ViewBag.search_tipogusto = search_tipogusto;
            ViewBag.search_gramm = search_gramm;
            ViewBag.search_reparto = search_reparto;
            ViewBag.search_settore = search_settore;
            ViewBag.search_categoria = search_categoria;
            ViewBag.search_foto = search_foto;
            ViewBag.ordinamento = ordinamento;

            // TASK-a77bd7b2: quanto dura ogni fase, nel log, per sapere dove va il tempo della pagina.
            var cronometro = System.Diagnostics.Stopwatch.StartNew();
            long msMerceologia, msTotaleArchivio, msConteggi, msPagina;

            var merceologia = getMerceologia();
            msMerceologia = cronometro.ElapsedMilliseconds;
            ViewBag.merceologia = merceologia;

            // Le tendine si popolano da quello che c'e' davvero, non da un
            // elenco fisso: se una lista non e' mai stata importata, il filtro
            // semplicemente non compare.
            ViewBag.elencoReparti = merceologia.Values.Select(v => v[0]).Where(v => v != "").Distinct().OrderBy(v => v).ToList();
            ViewBag.elencoSettori = merceologia.Values.Select(v => v[1]).Where(v => v != "").Distinct().OrderBy(v => v).ToList();
            ViewBag.elencoCategorie = merceologia.Values.Select(v => v[2]).Where(v => v != "").Distinct().OrderBy(v => v).ToList();

            // TASK-a77bd7b2: la ricerca senza Include. Descrizioni e foto si leggono solo per gli
            // articoli della pagina (RicercaArchivio.PaginaAsync): incluse qui, le loro query
            // ripetevano tutta la ricerca.
            IQueryable<Articoli> query = ctx.Articolis.Where(a => a.ArticoliDescrizionis!.Any());

            var inizioFase = cronometro.ElapsedMilliseconds;
            ViewBag.totaleArchivio = await ctx.Articolis.CountAsync();
            msTotaleArchivio = cronometro.ElapsedMilliseconds - inizioFase;

            // TASK-6e4320b7: i filtri di testo non distinguono maiuscole e minuscole: ILIKE invece di
            // Contains, che su PostgreSQL le distingueva. Stanno in RicercaArchivio, che i test provano.
            query = Utility.RicercaArchivio.FiltraPerTesto(ctx, query, search_codice, search_generic,
                                                           search_nome, search_brand, search_tipogusto, search_gramm);

            if (search_foto == "con")
            {
                query = query.Where(a => a.ArticoliFotos.Any());
            }
            else if (search_foto == "senza")
            {
                query = query.Where(a => !a.ArticoliFotos.Any());
            }

            // I filtri merceologici non sono colonne: traduco il filtro in un
            // elenco di codici e lo passo alla query.
            bool filtroMerceologico = !string.IsNullOrEmpty(search_reparto)
                                   || !string.IsNullOrEmpty(search_settore)
                                   || !string.IsNullOrEmpty(search_categoria);
            if (filtroMerceologico)
            {
                var codici = merceologia
                    .Where(kv =>
                        (string.IsNullOrEmpty(search_reparto) || kv.Value[0] == search_reparto) &&
                        (string.IsNullOrEmpty(search_settore) || kv.Value[1] == search_settore) &&
                        (string.IsNullOrEmpty(search_categoria) || kv.Value[2] == search_categoria))
                    .Select(kv => kv.Key)
                    .ToList();

                query = query.Where(a => codici.Contains(a.Codice));
            }

            query = Utility.RicercaArchivio.Ordina(ctx, query, ordinamento);

            // TASK-a77bd7b2: i contatori di testata, sull'intero risultato della ricerca e non sulla
            // sola pagina, in una query sola: prima erano due, ognuna con tutti i filtri.
            inizioFase = cronometro.ElapsedMilliseconds;
            var conteggi = await Utility.RicercaArchivio.ContaAsync(query);
            msConteggi = cronometro.ElapsedMilliseconds - inizioFase;
            ViewBag.conteggio = conteggi.Totale;

            ViewBag.TotPagine = (Int32)ViewBag.conteggio / this.recordPerPage;
            if ((Int32)ViewBag.conteggio % this.recordPerPage != 0)
            {
                ViewBag.TotPagine = ViewBag.TotPagine + 1;
            }

            Int32 skip = 0;
            if (Page == 0 || any_changed == 1)
            {
                ViewBag.CurrentPage = 1;
            }
            else
            {
                skip = recordPerPage * (Page - 1);
                ViewBag.CurrentPage = Page;
            }

            inizioFase = cronometro.ElapsedMilliseconds;
            var result = await Utility.RicercaArchivio.PaginaAsync(ctx, query, skip, recordPerPage);
            msPagina = cronometro.ElapsedMilliseconds - inizioFase;
            ViewBag.lista_ricerca = result;

            ViewBag.kpiConFoto = conteggi.ConFoto;
            ViewBag.kpiSenzaFoto = conteggi.Totale - conteggi.ConFoto;

            // I campi compilati, non il loro testo.
            var campi = new[] {
                ("codice", search_codice), ("generico", search_generic), ("nome", search_nome), ("brand", search_brand),
                ("tipogusto", search_tipogusto), ("grammatura", search_gramm), ("reparto", search_reparto),
                ("settore", search_settore), ("categoria", search_categoria), ("foto", search_foto)
            }.Where(c => !string.IsNullOrEmpty(c.Item2)).Select(c => c.Item1);
            _logger.LogInformation("Archivio: pagina {Pagina} in {Tutto} ms (merceologia {Merceologia} ms, totale archivio {TotaleArchivio} ms, conteggi {Conteggi} ms, articoli della pagina {ArticoliPagina} ms); filtri: {Filtri}; ordinamento: {Ordinamento}; trovati {Trovati}",
                (Int32)ViewBag.CurrentPage, cronometro.ElapsedMilliseconds, msMerceologia, msTotaleArchivio, msConteggi, msPagina,
                string.Join(",", campi), ordinamento ?? "codice", conteggi.Totale);

            return View();
        }

        /*
          [HttpPut]
        [Route("Archivio/Update")]
        public async Task<IActionResult> Index(Articoli art)
        {
            var item =  await this.ctx.Articolis.FindAsync(art.Id);
            if (item!=null)
            {
                if (art.Descrizione1 == null)
                    art.Descrizione1 = "";
                if (art.Descrizione2 == null)
                    art.Descrizione2 = "";
                if (art.Descrizione3 == null)
                    art.Descrizione3 = "";
                if (art.Descrizione4 == null)
                    art.Descrizione4 = "";

                item.Descrizione1 = art.Descrizione1;
                item.Descrizione2 = art.Descrizione2;
                item.Descrizione4 = art.Descrizione4;
                item.Descrizione3 = art.Descrizione3;
                item.UltimaRevisione = DateTime.Now;
                item.StatoRevisione = (Byte)StatusOfRevisioneArticolo.ProcessatoDaEdro;
                this.ctx.SaveChanges();
            }


            return Ok(item);
        }
         */

        [HttpPut]
        [Route("Archivio/Update")]
        public async Task<IActionResult> Index(ArticoliDescrizioni art)
        {
            var item =  await this.ctx.ArticoliDescrizionis.FindAsync(art.Id);
            if (item!=null)
            {
                if (art.Descrizione1 == null)
                    art.Descrizione1 = "";
                if (art.Descrizione2 == null)
                    art.Descrizione2 = "";
                if (art.Descrizione3 == null)
                    art.Descrizione3 = "";
                if (art.Descrizione4 == null)
                    art.Descrizione4 = "";

                item.Descrizione1 = art.Descrizione1;
                item.Descrizione2 = art.Descrizione2;
                item.Descrizione4 = art.Descrizione4;
                item.Descrizione3 = art.Descrizione3;
                item.DataUltimaRicezione = DateTime.Now;
                item.Area = art.Area != null && art.Area != "" ? art.Area : null;
                item.Canale = art.Canale != null && art.Canale != "" ? art.Canale : null;
                item.FirmaTracciato = "";
                this.ctx.SaveChanges();
            }


            return Ok(item);
        }

        [HttpPut]
        [Route("Archivio/salvaArticoloByCodice/{codice}")]
        public async Task<IActionResult> salvaArticoloByCodice(ArticoliDescrizioni art, string codice)
        {
            var itemArt = await this.ctx.Articolis.Where(a => a.Codice == codice).FirstOrDefaultAsync();
            ArticoliDescrizioni? item = null;

            if (art.Descrizione1 == null)
                art.Descrizione1 = "";
            if (art.Descrizione2 == null)
                art.Descrizione2 = "";
            if (art.Descrizione3 == null)
                art.Descrizione3 = "";
            if (art.Descrizione4 == null)
                art.Descrizione4 = "";
            if (art.DescrizioneIndd == null)
                art.DescrizioneIndd = "";

            if (itemArt != null)
            {
                item = await this.ctx.ArticoliDescrizionis.Where(ad => ad.IdArticolo == itemArt.Id).FirstOrDefaultAsync();
            }
            else
            {
                //Potrebbe essere un gruppo
                item = await this.ctx.ArticoliDescrizionis.Where(ad => ad.CodiceGruppo == codice).FirstOrDefaultAsync();
            }

            if (item != null)
            {


                item.Descrizione1 = art.Descrizione1;
                item.Descrizione2 = art.Descrizione2;
                item.Descrizione4 = art.Descrizione4;
                item.Descrizione3 = art.Descrizione3;
                item.DescrizioneIndd = art.DescrizioneIndd;
                item.Peso = art.Peso;
                item.Um = art.Um;
                item.Area = art.Area != null && art.Area != "" ? art.Area : null;
                item.Canale = art.Canale != null && art.Canale != "" ? art.Canale : null;

                item.DataUltimaRicezione = DateTime.Now;
                item.FirmaTracciato = "";
                this.ctx.SaveChanges();
            }
            else
            {
                //Articolo non trovato, va creato
                if (codice.Split(",").Count()==1)
                {
                    //Singolo
                    if (itemArt == null)
                    {
                        //Questa è una casistica che non dovrebbe mai accadere, al momento non la implementiamo
                        //Se dovesse essere che passiamo di qui è perchè da InDesign arriva qualche codice sconosciuto frutto di una manomissione delle referenze al 100%
                    }
                    else
                    {
                        item = new ArticoliDescrizioni();
                        item.IdArticolo = itemArt.Id;
                        item.Approvata = true;
                        item.Descrizione1 = art.Descrizione1;
                        item.Descrizione2 = art.Descrizione2;
                        item.Descrizione4 = art.Descrizione4;
                        item.Descrizione3 = art.Descrizione3;
                        item.DescrizioneIndd = art.DescrizioneIndd;
                        item.Peso = art.Peso;
                        item.Um = art.Um;
                        item.Area = art.Area != null && art.Area != "" ? art.Area : null;
                        item.Canale = art.Canale != null && art.Canale != "" ? art.Canale : null;

                        item.DataUltimaRicezione = DateTime.Now;
                        item.FirmaTracciato = "";

                        this.ctx.ArticoliDescrizionis.Add(item);
                        this.ctx.SaveChanges();
                    }

                }
                else
                {
                    //Gruppo
                    item = new ArticoliDescrizioni();
                    item.CodiceGruppo = codice;
                    item.Approvata = true;
                    item.Descrizione1 = art.Descrizione1;
                    item.Descrizione2 = art.Descrizione2;
                    item.Descrizione4 = art.Descrizione4;
                    item.Descrizione3 = art.Descrizione3;
                    item.DescrizioneIndd = art.DescrizioneIndd;
                    item.Peso = art.Peso;
                    item.Um = art.Um;
                    item.Area = art.Area != null && art.Area != "" ? art.Area : null;
                    item.Canale = art.Canale != null && art.Canale != "" ? art.Canale : null;

                    item.DataUltimaRicezione = DateTime.Now;
                    item.FirmaTracciato = "";

                    this.ctx.ArticoliDescrizionis.Add(item);
                    this.ctx.SaveChanges();

                   
                }

                //return Ok("item_not_found");
            }


            return Ok(item);
        }

        [HttpPut]
        [Route("Archivio/GetDescrizioneByCodice")]
        public async Task<IActionResult> GetDescrizioneByCodice([FromForm]string codice)
        {

            if (codice.IndexOf(",") < 0)
            {
                Int64 idArticolo = await this.ctx.Articolis.Where(c => c.Codice == codice).Select(s => s.Id).FirstOrDefaultAsync();
                ArticoliDescrizioni? item = await this.ctx.ArticoliDescrizionis.Where(f => f.IdArticolo == idArticolo).FirstOrDefaultAsync();
                return Ok(item);
            }
            else
            {
                ArticoliDescrizioni? item = await this.ctx.ArticoliDescrizionis.Where(f => f.CodiceGruppo == codice).FirstOrDefaultAsync();
                return Ok(item);
            }
        }

        [HttpPut]
        [Route("Archivio/GetDescrizioneByAreaCanale")]
        public async Task<IActionResult> GetDescrizioneByAreaCanale([FromForm] string codice, [FromForm] string? area = null, [FromForm] string? canale=null)
        {

            if (codice.IndexOf(",") < 0)
            {
                Int64 idArticolo = await this.ctx.Articolis.Where(c => c.Codice == codice).Select(s => s.Id).FirstOrDefaultAsync();
                ArticoliDescrizioni? item = await this.ctx.ArticoliDescrizionis.Where(f => f.IdArticolo == idArticolo && (area != null && area != "" ? f.Area == area : f.Area == null) && (canale != null && canale != "" ? f.Canale == canale : f.Canale == null)).FirstOrDefaultAsync();
                return Ok(item);
            }
            else
            {
                ArticoliDescrizioni? item = await this.ctx.ArticoliDescrizionis.Where(f => f.CodiceGruppo == codice && (area != null && area != "" ? f.Area == area : f.Area == null) && (canale != null && canale != "" ? f.Canale == canale : f.Canale == null)).FirstOrDefaultAsync();
                return Ok(item);
            }
        }

        [HttpGet]
        [Route("Archivio/downloadFoto/{id}")]
        public async Task<IActionResult> downloadFotoByIdArticolo(int id)
        {
            Articoli? itemArt = await this.ctx.Articolis.Include(inc=>inc.ArticoliFotos).Where(a => a.Id== id).FirstOrDefaultAsync();

            if (itemArt!.ArticoliFotos!.Count > 0)
            {
                try
                {
                    List<string> files = new List<string>();
                    foreach(ArticoliFoto fItem in itemArt.ArticoliFotos)
                    {
                        files.Add(fItem.NomeReale);
                    }

                    JObject o1 = JObject.Parse(System.IO.File.ReadAllText(this.path_external_source + "SourceUnita.json"));
                    DbUnita? archiviDB = o1.ToObject<DbUnita>();
                    List<DbUnitaItem> sync_folders = archiviDB!.source.Where(s => s.syncFolder).ToList();
                    DbUnitaItem? alta_folder = archiviDB!.source.Where(s => !s.webFolder && !s.syncFolder && !s.exportFolder).FirstOrDefault();

                    /*using (var memoryStream = new MemoryStream())
                    {
                        using (var zipArchive = new ZipArchive(memoryStream, ZipArchiveMode.Create, true))
                        {
                            foreach (var file in files)
                            {
                                var filepath = Path.Combine(alta_folder.path, "", file);
                                zipArchive.CreateEntryFromFile(filepath, Path.GetFileName(filepath));
                            }
                        }

                        memoryStream.Position = 0;
                        //return File(memoryStream, "application/zip", "pack.zip");

                    }*/

                    var tempFile = Path.GetTempFileName();

                    using (var zipFile = System.IO.File.Create(tempFile))
                    using (var zipArchive = new ZipArchive(zipFile, ZipArchiveMode.Create))
                    {
                        foreach (var file in files)
                        {
                            var filepath = Path.Combine(alta_folder!.path, "", file);

                            if (alta_folder.credentials != "")
                            {
                                string[] creds = alta_folder.credentials.Split('@');
                                System.Net.NetworkCredential readCredentials = new NetworkCredential(creds[0], creds[1]);
                                
                                using (new NetworkConnection(alta_folder.path, readCredentials))
                                {                                    
                                    zipArchive.CreateEntryFromFile(filepath, Path.GetFileName(filepath));
                                }
                            }
                            else
                            {
                                zipArchive.CreateEntryFromFile(filepath, Path.GetFileName(filepath));
                            }

                        }
                    }

                    var stream = new FileStream(tempFile, FileMode.Open);
                    return File(stream, "application/zip", "pacchettoFoto_"+itemArt.Codice+".zip");




                    //var primaria = itemArt.ArticoliFotos.FirstOrDefault();
                    //var filepath = Path.Combine(alta_folder.path, "", primaria.NomeReale);
                    //return File(System.IO.File.ReadAllBytes(filepath), "image/png", System.IO.Path.GetFileName(filepath));
                }
                catch(Exception ex)
                {
                    return Ok(ex.ToString());
                }
            }

            return NotFound();
        }

        // ------------------------------------------------------------------
        // Istanta4 - caricamento manuale di una foto da Archivio.
        // Stesso principio del sync foto dal plugin InDesign (vedi
        // updateFotoFromIndd in SyncFotoController): il file va prima a
        // Olimpo (che lo elabora), poi si registra il risultato in
        // articoli_foto. Nessuna Area/Canale: e' la foto "di base" della
        // referenza, valida ovunque finche' una promo specifica non ne
        // carica una piu' mirata (vedi GetSpecificity in SyncFotoController.cs).
        // ------------------------------------------------------------------
        [HttpPost]
        [Route("Archivio/caricaFotoManuale")]
        [DisableRequestSizeLimit]
        public async Task<IActionResult> caricaFotoManuale([FromForm] InputFotoArchivio dato)
        {
            try
            {
                if (dato.file == null || dato.file.Length <= 0)
                    throw new Exception("Nessun file ricevuto");

                if (string.IsNullOrWhiteSpace(dato.codice))
                    throw new Exception("Codice referenza mancante");

                Articoli? articolo = await this.ctx.Articolis.Include(a => a.ArticoliFotos)
                    .Where(a => a.Codice == dato.codice).FirstOrDefaultAsync();

                if (articolo == null)
                    throw new Exception($"Articolo {dato.codice} non trovato nel database");

                byte[] arrBytes = new byte[dato.file.Length];
                dato.file.OpenReadStream().ReadExactly(arrBytes, 0, (int)dato.file.Length);
                string md5 = Crypto.GetMD5HashFromFile(arrBytes);

                // Stesso circuito del sync foto: upload a Olimpo, poi registrazione locale.
                string uri = olympusServerUrl + "/foto/uploadFoto";
                var form = new MultipartFormDataContent();
                var fileContent = new ByteArrayContent(arrBytes);
                fileContent.Headers.ContentType = MediaTypeHeaderValue.Parse("multipart/form-data");

                FileOlympoSync olympoJson = new FileOlympoSync()
                {
                    Id = "0",
                    FileHash = md5,
                    FileName = dato.file.FileName,
                    IdRef = "0",
                    Size = 0
                };

                form.Add(fileContent, "file", dato.file.FileName);
                form.Add(new StringContent(JsonConvert.SerializeObject(olympoJson), Encoding.UTF8, "application/json"), "json_meta_foto");

                var response = await httpClient.PostAsync(uri, form);

                if (!response.IsSuccessStatusCode)
                    throw new Exception("Olimpo error " + response.StatusCode);

                var responseBody = await response.Content.ReadAsStringAsync();
                var dataOlympo = JsonConvert.DeserializeObject<FileOlympoOperazioneSingola>(responseBody);
                string guidOlympo = dataOlympo?.record?.Id ?? "";

                if (guidOlympo == "")
                    throw new Exception("Olimpo non ha restituito un guid valido");

                string? areaVal = string.IsNullOrWhiteSpace(dato.area) ? null : dato.area.Trim();
                string? canaleVal = string.IsNullOrWhiteSpace(dato.canale) ? null : dato.canale.Trim();

                ArticoliFoto nuovaFoto = new ArticoliFoto();
                nuovaFoto.IdArticolo = articolo.Id;
                nuovaFoto.Area = areaVal;
                nuovaFoto.Canale = canaleVal;
                nuovaFoto.NomeReale = dato.file.FileName;
                nuovaFoto.PathFoto = dato.file.FileName;
                nuovaFoto.StatoSelezione = (byte)StatoSelezioneFoto.Primaria;
                nuovaFoto.Attiva = true;
                nuovaFoto.Hash = md5;
                nuovaFoto.DataInserimento = DateTime.Now;
                nuovaFoto.DataModifica = DateTime.Now;
                nuovaFoto.GuidId = guidOlympo;
                nuovaFoto.Tipo = (byte)TipoFoto.Foto;

                // TASK-56428659: Olimpo restituisce il guid esistente a un file gia' noto; se l'articolo
                // ha gia' quel guid nello stesso ambito si aggiorna quella riga invece di aggiungerne una.
                var giaRegistrata = RegistroFotoArticolo.GiaRegistrata(articolo.ArticoliFotos!, guidOlympo, areaVal, canaleVal);
                if (giaRegistrata != null)
                {
                    nuovaFoto = RegistroFotoArticolo.Riusa(giaRegistrata, nuovaFoto);
                }
                else
                {
                    articolo.ArticoliFotos!.Add(nuovaFoto);
                }
                await this.ctx.SaveChangesAsync();

                registraAttivitaCaricoFotoArchivio(dato.codice!, dato.file.FileName, guidOlympo);

                return Ok(new
                {
                    esito = true,
                    id = nuovaFoto.Id,
                    guidId = guidOlympo,
                    nomeReale = nuovaFoto.NomeReale,
                    nFoto = articolo.ArticoliFotos!.Count,
                    thumbnail = olympusServerUrl + "/foto/getThumbNailOnDemand?width=88&guidId=" + guidOlympo
                });
            }
            catch (Exception ex)
            {
                return Ok(new { esito = false, error = ex.Message });
            }
        }

        private void registraAttivitaCaricoFotoArchivio(string codRef, string nomeFoto, string guidId)
        {
            try
            {
                Register register = new Register(connstring, this._dbContextFactory, dbContextFactory2: this._dbContextFactory2);
                var session = SessionIstantaObject.GetSession(HttpContext);

                var nuovaOperazione = new RegistroOperazioni();
                nuovaOperazione.Autore = int.Parse(session);
                nuovaOperazione.TipoOperazione = (byte)tipoOperazione.updateFoto;
                nuovaOperazione.CodiceAssociato = codRef;
                nuovaOperazione.Url = "Archivio/caricaFotoManuale";
                nuovaOperazione.FormData = JsonConvert.SerializeObject(new RevisioneFotoFromIndd()
                {
                    codRef = codRef,
                    nomeFoto = nomeFoto,
                    tipo = TipoFoto.Foto,
                    guidId = guidId
                });

                register.addOperazione(nuovaOperazione, true, session, DateTime.Now);
            }
            catch (Exception ex)
            {
                // Il log dell'attivita' non deve far fallire l'upload: la foto e' gia' salvata.
                Console.WriteLine("Archivio: impossibile registrare l'attivita' di upload foto -> " + ex.Message);
            }
        }

        [HttpPost]
        [Route("Archivio/caricaDump")]
        public async Task<IActionResult> caricaDump([FromForm] InputDump obj)
        {
            DumpOperationResult result = new DumpOperationResult();

            string errors = "";

            try
            {
                Stream? str = obj.file!.OpenReadStream();
                byte[] arrBytes = new byte[str.Length];
                str.ReadExactly(arrBytes, 0, (int)str.Length);

                //Convertire i butes in stringa
                string? strDump = System.Text.Encoding.UTF8.GetString(arrBytes);
                ModuloCompilazionePerDataDump? modulo = Newtonsoft.Json.JsonConvert.DeserializeObject<ModuloCompilazionePerDataDump>(strDump);


                foreach (RefForModuloCompilazionePerDataDump item in modulo!.source!)
                {
                    ArticoliDescrizioni? artDescr = null;

                    Int64 id_articolo_senza_revisione = 0;

                    bool isGruppo = item.codice!.Split(',').Length>1;

                    if (isGruppo)
                    {
                        artDescr = this.ctx.ArticoliDescrizionis.Include(inc => inc.IdArticoloNavigation).FirstOrDefault(a => a.CodiceGruppo == item.codice);
                        
                    }
                    else
                    {
                        artDescr = this.ctx.ArticoliDescrizionis.Include(inc => inc.IdArticoloNavigation).FirstOrDefault(a => a.IdArticoloNavigation.Codice == item.codice);
                        if (artDescr == null)
                        {
                            try
                            {
                                id_articolo_senza_revisione = this.ctx.Articolis.FirstOrDefault(a => a.Codice == item.codice)!.Id;
                            }
                            catch
                            {
                                errors += $"Codice {item.codice} non trovato in archivio";
                                //Sarebbe assurdo dal momento che i codici li ha passati proprio istanta al processo di dumping
                                continue;
                            }
                        }
                    }

                    bool isNew = artDescr == null;
                    if (isNew)
                    {
                        artDescr = new ArticoliDescrizioni();
                        if (!isGruppo)
                        {
                            artDescr.IdArticolo = id_articolo_senza_revisione;
                        }
                        else
                        {
                            artDescr.CodiceGruppo = item.codice;
                        }
                    }

                   
                    artDescr!.Descrizione1 = item.descrizione1;
                    artDescr!.Descrizione2 = item.descrizione2;
                    artDescr!.Descrizione3 = item.descrizione3;
                    artDescr.Descrizione4 = item.descrizione4;
                    artDescr!.Peso = item.peso;
                    artDescr!.Um = item.um;
                    artDescr!.DataUltimaRicezione = DateTime.Now;
                    artDescr!.FirmaTracciato = "dump";
                    artDescr!.Approvata = true;

                    if (isNew)
                    {
                        this.ctx.ArticoliDescrizionis.Add(artDescr);
                        result.countNew++;
                    }
                    else
                    { 
                        result.countUpdated++;
                    }


                }

                this.ctx.SaveChanges();

                result.error = errors;
                result.esito = true;
                
            }catch(Exception ex)
            {
                result.error = ex.ToString() + " -- Process errors " + errors;
            }

            return Ok(result);
        }
    }
}
