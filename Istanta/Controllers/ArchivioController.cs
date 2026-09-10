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
        // ------------------------------------------------------------------
        private static Dictionary<string, string[]>? _cacheMerceologia = null;
        private static DateTime _cacheMerceologiaScadenza = DateTime.MinValue;
        private static readonly object _lockMerceologia = new object();

        private Dictionary<string, string[]> getMerceologia()
        {
            lock (_lockMerceologia)
            {
                if (_cacheMerceologia != null && DateTime.Now < _cacheMerceologiaScadenza)
                    return _cacheMerceologia;
            }

            var mappa = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);

            try
            {
                using (var ctxLocale = this._dbContextFactory.CreateDbContext())
                {
                    var conn = ctxLocale.Database.GetDbConnection();
                    if (conn.State != System.Data.ConnectionState.Open) conn.Open();
                    using (var cmd = conn.CreateCommand())
                    {
                        // CORREZIONE 7/9/2026. Questa query era scritta solo in T-SQL:
                        //   JSON_VALUE(CAST(dato AS nvarchar(max)), '$.reparto')
                        // Su PostgreSQL non esiste ne JSON_VALUE ne il tipo nvarchar, quindi la
                        // lettura falliva. L'eccezione veniva inghiottita dal catch qui sotto e la
                        // pagina rispondeva lo stesso, ma SENZA i filtri per reparto, settore e
                        // categoria: un guasto silenzioso. Ora la query si sceglie in base al motore.
                        bool suPostgres = (ctxLocale.Database.ProviderName ?? "").Contains("Npgsql");
                        cmd.CommandText = suPostgres
                            ? "WITH ultimo AS (" +
                              "  SELECT codice," +
                              "         (dato::json ->> 'reparto')   AS reparto," +
                              "         (dato::json ->> 'settore')   AS settore," +
                              "         (dato::json ->> 'categoria') AS categoria," +
                              "         ROW_NUMBER() OVER (PARTITION BY codice ORDER BY id DESC) AS rn" +
                              "  FROM promo_tracciati_records WHERE codice IS NOT NULL AND dato IS JSON" +
                              ") SELECT codice, reparto, settore, categoria FROM ultimo WHERE rn = 1"
                            : "WITH ultimo AS (" +
                              "  SELECT codice," +
                              "         JSON_VALUE(CAST(dato AS nvarchar(max)), '$.reparto')   AS reparto," +
                              "         JSON_VALUE(CAST(dato AS nvarchar(max)), '$.settore')   AS settore," +
                              "         JSON_VALUE(CAST(dato AS nvarchar(max)), '$.categoria') AS categoria," +
                              "         ROW_NUMBER() OVER (PARTITION BY codice ORDER BY id DESC) AS rn" +
                              "  FROM promo_tracciati_records WHERE codice IS NOT NULL" +
                              ") SELECT codice, reparto, settore, categoria FROM ultimo WHERE rn = 1";
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
            }
            catch (Exception ex)
            {
                // Senza merceologia la pagina funziona lo stesso, solo senza
                // i filtri per reparto: non e' un motivo per non rispondere.
                Console.WriteLine("Archivio: merceologia non disponibile -> " + ex.Message);
            }

            lock (_lockMerceologia)
            {
                _cacheMerceologia = mappa;
                _cacheMerceologiaScadenza = DateTime.Now.AddMinutes(5);
            }
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

            var merceologia = getMerceologia();
            ViewBag.merceologia = merceologia;

            // Le tendine si popolano da quello che c'e' davvero, non da un
            // elenco fisso: se una lista non e' mai stata importata, il filtro
            // semplicemente non compare.
            ViewBag.elencoReparti = merceologia.Values.Select(v => v[0]).Where(v => v != "").Distinct().OrderBy(v => v).ToList();
            ViewBag.elencoSettori = merceologia.Values.Select(v => v[1]).Where(v => v != "").Distinct().OrderBy(v => v).ToList();
            ViewBag.elencoCategorie = merceologia.Values.Select(v => v[2]).Where(v => v != "").Distinct().OrderBy(v => v).ToList();

            // AsSplitQuery aggiunto il 9/9/2026. Con due Include di collezioni EF
            // costruisce UNA query con due giunzioni, e ogni articolo esce ripetuto
            // (numero foto x numero descrizioni). EF stesso lo segnala a ogni chiamata:
            //   "Compiling a query which loads related collections for more than one
            //    collection navigation ... no QuerySplittingBehavior"
            // Con lo split diventano tre query piccole e le righe non si moltiplicano.
            var query = ctx.Articolis.Include(a => a.ArticoliFotos)
                .Include(a => a.ArticoliDescrizionis)
                .AsSplitQuery()
                .Where(a => a.ArticoliDescrizionis.Any());

            ViewBag.totaleArchivio = await ctx.Articolis.CountAsync();

            if (!string.IsNullOrEmpty(search_codice))
            {
                query = query.Where(a => a.Codice.Contains(search_codice));
            }

            if (!string.IsNullOrEmpty(search_generic))
            {
                // RISCRITTA 7/9/2026 come unione di due insiemi di id, invece che come OR
                // fra una colonna di 'articoli' e una sottoquery su 'articoli_descrizioni'.
                // Con l'OR il motore non puo usare gli indici: deve valutare la sottoquery
                // riga per riga, 200.051 volte. Misurato su 200.000 articoli:
                //     forma con OR       1,03 s
                //     forma con unione   0,15 s
                // Il risultato e lo stesso insieme di articoli: cambia solo come lo si chiede.
                // Perche l'unione sia veloce servono gli indici a trigrammi (pg_trgm) su
                // articoli.codice e su articoli_descrizioni.descrizione_1..4.
                var idPerCodice = ctx.Articolis
                    .Where(a => a.Codice!.Contains(search_generic))
                    .Select(a => (Int64?)a.Id);
            
                var idPerDescrizione = ctx.ArticoliDescrizionis
                    .Where(d => d.Descrizione1!.Contains(search_generic) ||
                                d.Descrizione2!.Contains(search_generic) ||
                                d.Descrizione3!.Contains(search_generic) ||
                                d.Descrizione4!.Contains(search_generic))
                    .Select(d => (Int64?)d.IdArticolo);
            
                var idTrovati = idPerCodice.Union(idPerDescrizione);
            
                query = query.Where(a => idTrovati.Contains((Int64?)a.Id));
            }

            if (!string.IsNullOrEmpty(search_nome))
            {
                query = query.Where(a => a.ArticoliDescrizionis.Any(d => d.Descrizione1.Contains(search_nome)));
            }

            if (!string.IsNullOrEmpty(search_brand))
            {
                query = query.Where(a => a.ArticoliDescrizionis.Any(d => d.Descrizione2.Contains(search_brand)));
            }

            if (!string.IsNullOrEmpty(search_tipogusto))
            {
                query = query.Where(a => a.ArticoliDescrizionis.Any(d => d.Descrizione3.Contains(search_tipogusto)));
            }

            if (!string.IsNullOrEmpty(search_gramm))
            {
                query = query.Where(a => a.ArticoliDescrizionis.Any(d => d.Descrizione4.Contains(search_gramm)));
            }

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

            switch (ordinamento)
            {
                case "codice_desc":
                    query = query.OrderByDescending(a => a.Codice);
                    break;
                case "recenti":
                    query = query.OrderByDescending(a => a.DataModifica ?? a.DataInserimento);
                    break;
                case "descrizione":
                    // RISCRITTO 7/9/2026 come giunzione con la riga base, non come sottoquery.
                    //
                    // Cosa si e visto sui dati veri: articoli.descrizione1..4 sono VUOTE su tutti
                    // e 51 gli articoli del demo, sia su SQL Server sia su PostgreSQL. Il nome del
                    // prodotto sta solo in articoli_descrizioni.descrizione_1 della riga 'base',
                    // quella con area e canale vuoti. Ordinare per articoli.descrizione1 sarebbe
                    // stato istantaneo e SBAGLIATO: avrebbe ordinato per una colonna vuota.
                    //
                    // La forma precedente chiedeva quella descrizione con una sottoquery correlata:
                    // il motore la eseguiva una volta per articolo, 200.051 volte, ~730 ms a volume
                    // pieno, e nessun indice poteva evitarlo. Chiesta come giunzione, il motore
                    // percorre l'indice gia in ordine e si ferma dopo quaranta righe.
                    //
                    // Serve l'indice: articoli_descrizioni (descrizione_1, id_articolo)
                    //                 WHERE area IS NULL AND canale IS NULL     -> ix_ad_ordine
                    //
                    // Nota: la giunzione duplicherebbe un articolo che avesse piu di una riga base.
                    // Verificato sui dati veri: nessun articolo ne ha piu di una.
                    query = from a in query
                            join d in ctx.ArticoliDescrizionis.Where(x => x.Area == null && x.Canale == null)
                                 on (Int64?)a.Id equals d.IdArticolo
                            orderby d.Descrizione1
                            select a;
                    break;
                default:
                    query = query.OrderBy(a => a.Codice);
                    break;
            }

            ViewBag.conteggio = await query.CountAsync();

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

            var result = await query.Skip(skip).Take(recordPerPage).ToListAsync();
            ViewBag.lista_ricerca = result;

            // Contatori di testata, calcolati sull'intero risultato della
            // ricerca e non sulla sola pagina mostrata.
            ViewBag.kpiConFoto = await query.CountAsync(a => a.ArticoliFotos.Any());
            ViewBag.kpiSenzaFoto = (Int32)ViewBag.conteggio - (Int32)ViewBag.kpiConFoto;

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

                articolo.ArticoliFotos!.Add(nuovaFoto);
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
