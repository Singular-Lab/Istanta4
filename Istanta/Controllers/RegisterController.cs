using DocumentFormat.OpenXml.Spreadsheet;
using DocumentFormat.OpenXml.Wordprocessing;
using Istanta.Models;
using Istanta.Models_2;
using Istanta.Utility;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json.Bson.Converters;

namespace Istanta.Controllers
{
    public class RegisterController : Controller
    {
        private readonly edro21_dbContext ctx;
        private readonly Edro21_DbContext2 ctx2;
        private readonly string _conn_string = "";
        private readonly IDbContextFactory<edro21_dbContext> _dbContextFactory;
        private readonly IDbContextFactory<Edro21_DbContext2> _dbContextFactory2;
        public RegisterController(IConfiguration configuration, IDbContextFactory<edro21_dbContext> dbContextFactory, IDbContextFactory<Edro21_DbContext2> dbContextFactory2)
        {
            this._dbContextFactory2 = dbContextFactory2;
            _conn_string = configuration.GetConnectionString("IstandaConnectionDb")!;
            this._dbContextFactory = dbContextFactory;
            this.ctx = this._dbContextFactory.CreateDbContext();
            //this.ctx = new edro21_dbContext(_conn_string);
            this.ctx2 = this._dbContextFactory2.CreateDbContext();
        }

        public IActionResult Index()
        {
            //Impacchetto utenti per la tendina di filtro
            var utenti = this.ctx.Utentis.Select(s => new { s.Id, s.NomeUtente }).OrderBy(o=>o.NomeUtente).ToList();
            ViewBag.Utenti = utenti;

            //Ciclo i valorei di una enumerazione
            tipoOperazione[] tipiOperazione = (tipoOperazione[])Enum.GetValues(typeof(tipoOperazione));

            /*
             

        cambioPagina = 11,
        rimuoviMetaFoto = 12, //CHE SENSO HA QUESTA AZIONE??? 
            
             */

            Func<string,string> daiVerbositaAEnumTitle = (string s) =>
            {
                switch (s)
                {
                    case "errore":
                        return "Segnalazioni di errore";
                    case "revisione":
                        return "Revisione articolo";
                    case "updatePS":
                        return "Aggiornamento primario/secondario";
                    case "updateNoRender":
                        return "Aggiornamento elementi in norender";
                    case "updateFoto":
                        return "Aggiornamento foto";
                    case "gruppa":
                        return "Raggruppamento referenze";
                    case "sgruppa":
                        return "Sgruppamento referenze";
                    case "syncPacchettoFoto":
                        return "Sincronizzazione foto";
                    case "eliminaFotoExtra":
                        return "Eliminazione foto extra";
                    case "cambioMeta":
                        return "Cambio strutturale";
                    case "login":
                        return "Login";
                    default:
                        return s;
                }
            };

            var tipiOperazioneList = tipiOperazione.Where(i=>
            i.ToString() != "revisioneCampiOfferta" && 
            i.ToString()!="syncFoto" &&
            i.ToString() != "cambioPagina" &&
            i.ToString() != "rimuoviMetaFoto"
            ).Select(s => new
            {
                Id = s,
                Nome = daiVerbositaAEnumTitle(s.ToString())
            }).ToList();

            ViewBag.TipiOperazione = tipiOperazioneList;

            return View();
        }

        public class idResult
        {
            public string error = "";
            public bool Esito = false;
            public int id = 0;
        }

        [HttpPut]
        [Route("RegisterController/autorizzaOperazioneDaSync")]
        public async Task<IActionResult> autorizzaOperazioneDaSync(operazioneRegistro operazione)
        {
            idResult res = new idResult();
            try
            {
                if (operazione == null)
                {
                    res.error = "Nessuna operazione ricevuta";
                    res.Esito = false;
                    return Ok(res);
                }

                if (operazione.idTracciato == 0)
                {
                    res.error = "L'IdTracciato richiesto (0) non è un id valido";
                    res.Esito = false;
                    return Ok(res);
                }


                if ((operazione.area || operazione.canale) && operazione.idTracciato == null)
                {
                    res.error = "Richiesta di canale e/o area senza specifica di idTracciato, impossibile eseguire";
                    res.Esito = false;
                    return Ok(res);
                }

                PromoTracciati? tracciato = null;
                if (operazione.idTracciato != null)
                {
                    tracciato = this.ctx2.PromoTracciatis.Where(f => f.Id == operazione.idTracciato).FirstOrDefault();

                    if (tracciato == null)
                    {
                        res.error = "idTracciato " + operazione.idTracciato + " non trovato";
                        res.Esito = false;
                        return Ok(res);
                    }
                }

                List<string> codiciDaControllareIntegrita = new List<string>();
                if (operazione.codiciDaControllareIntegrita != "" && operazione.codiciDaControllareIntegrita != null)
                {
                    codiciDaControllareIntegrita = operazione.codiciDaControllareIntegrita.Split('-').ToList();
                }
                //controllareIntegrità codici
                if (codiciDaControllareIntegrita.Count > 0)
                {
                    if (operazione.idTracciato == null)
                    {
                        res.error = "L'id tracciato associato ai codici da controllare non è stato specificato";
                        res.Esito = false;
                        return Ok(res);
                    }
                    foreach (var codiceInEsame in codiciDaControllareIntegrita)
                    {
                        var codiceGruppo = codiceInEsame.Split(",");

                        //adesso il codiceGruppo contiene la lista dei suoi singoli o se è un singolo un solo codice
                        foreach (var cod in codiceGruppo)
                        {
                            bool check = this.ctx2.PromoTracciatiRecords.Where(f => f.Codice == cod && f.CodiceGruppo == codiceInEsame && f.IdTracciato == operazione.idTracciato).FirstOrDefault() != null;
                            if (!check)
                            {
                                res.error = "L'elemento " + codiceInEsame + " non ha passato il controllo di integrità";
                                res.Esito = false;
                                return Ok(res);
                            }
                        }
                    }
                }

                if (operazione.dataControl)
                {
                    DateTime dataReg = DateTime.ParseExact(operazione.dataRegistrazione!, "dd/MM/yyyy HH:mm:ss", null);

                    List<RegistroOperazioni> operazioniConcorrenti = this.ctx.RegistroOperazionis
                        .Where(f =>
                            (tracciato != null ? f.IdTracciato == tracciato.Id : true) &&
                            (operazione.area ? f.Area == tracciato!.Area : true) &&
                            (operazione.canale ? f.Canale == tracciato!.Canale : true) &&
                            operazione.tipoOperazione == f.TipoOperazione &&
                            operazione.codice == f.CodiceAssociato)
                        .AsEnumerable() // Passa la query al lato client
                        .Where(f => f.Data_Esecuzione >= dataReg)
                        .ToList();

                    operazioniConcorrenti = operazioniConcorrenti.OrderByDescending(f => f.Data_Registrazione).ToList();

                    if (operazioniConcorrenti.Count > 0)
                    {
                        res.error = "L'operazione richiesta sull'elemento " + operazione.codice + " è obsoleta poichè già stata eseguita dall'utente " + operazioniConcorrenti[0].Autore + " richiesta in data: " + operazioniConcorrenti[0].Data_Registrazione + " ed eseguita in data: " + operazioniConcorrenti[0].Data_Esecuzione;
                        res.Esito = true;
                        return Ok(res);
                    }
                }

                var register = new Register(_conn_string, this._dbContextFactory, dbContextFactory2: this._dbContextFactory2);

                //l'operazione è stata autorizzata per cui procediamo a creare l'operazione sul DB
                var nuovaOperazione = new RegistroOperazioni();
                nuovaOperazione.Area = operazione.area ? tracciato!.Area : "";
                nuovaOperazione.Canale = operazione.canale ? tracciato!.Canale : "";
                nuovaOperazione.Stato = (byte)statoOperazioni.inAttesa;
                nuovaOperazione.Autore = operazione.autore;
                //nuovaOperazione.Data_Registrazione = operazione.dataRegistrazione;
                nuovaOperazione.TipoOperazione = (byte)operazione.tipoOperazione;
                nuovaOperazione.IdTracciato = operazione.idTracciato;
                nuovaOperazione.CodiceAssociato = operazione.codice;
                nuovaOperazione.FormData = operazione.formData;
                nuovaOperazione.Url = operazione.url;
                nuovaOperazione.Data_Esecuzione = null;

                var session = SessionIstantaObject.GetSession(HttpContext);
                res.id = (int)register.addOperazione(nuovaOperazione, false, session, DateTime.Parse(operazione.dataRegistrazione!));
                if (res.id != 0)
                {
                    res.error = "";
                    res.Esito = true;
                }
                else
                {
                    res.error = "Impossibile aggiungere l'operazione ai task del registro operazioni";
                    res.Esito = false;
                }


            }
            catch (Exception ex)
            {
                res.error = ex.Message;
                res.Esito = false;
            }
            return Ok(res);
        }

        [HttpGet]
        [Route("RegisterController/getLogFiles")]
        public async Task<IActionResult> readLogFilesDiSistema()
        {
            LogsDiSistemaFileResult result = new LogsDiSistemaFileResult();
            try
            {
                LogAssistent logAssistent = new LogAssistent();

                string readPath = Path.Combine(Directory.GetCurrentDirectory(), "logs");
                string[] files = Directory.GetFiles(readPath);
                result.content = files.Select(f => new LogsDiSistemaFileEntry
                {
                    nome = Path.GetFileName(f),
                    lastModifiedDate = System.IO.File.GetLastWriteTime(f)
                }).OrderByDescending(o=>o.lastModifiedDate).ToList();
            }
            catch (Exception ex)
            {
                result.error = ex.ToString();
            }

            return Ok(result);
        }

        [HttpGet]
        [Route("RegisterController/ricercaLogs/{file}/{nLines}")]
        public async Task<IActionResult> readLogsDiSistema(string file, int nLines)
        {
            LogsDiSistemaResult result = new LogsDiSistemaResult();
            try
            {
                LogAssistent logAssistent = new LogAssistent();
                string fullPath = Path.Combine(Directory.GetCurrentDirectory(),"logs", file+".txt");
                string[] _source = await logAssistent.ReadLatestLogLinesAsync(fullPath, nLines);
                result.lista = _source;
            }
            catch (Exception ex)
            {
                result.error = ex.ToString();
            }

            return Ok(result);
        }

        [HttpPost]
        [Route("RegisterController/ricercaAudits")]
        public async Task<IActionResult> ricercaAudits(RicercaAuditsRequest request)
        {
            RicercaAuditsResult result = new RicercaAuditsResult();
            try
            {
                 Enum.TryParse(request.tipoOperazione, out tipoOperazione tipoOpParsed);



                //Query dinamica in base ai campi forniti
                var query = this.ctx.RegistroOperazionis.Where(f =>
                    (request.dataInizio != null ? f.Data_Registrazione >= request.dataInizio : true) &&
                    (request.dataFine != null ? f.Data_Registrazione <= request.dataFine : true) &&
                    (request.idUtente != 0 ? f.Autore == request.idUtente : true) &&
                    (request.tipoOperazione != "all" ? f.TipoOperazione == (Byte)tipoOpParsed : true)
                )
                .OrderByDescending(s => s.Data_Registrazione)
                .Select(s => new AuditEntry()
                {
                    id = s.Id,
                    idUtente = s.Autore,
                    dataRegistrazione = s.Data_Registrazione.ToString("dd/MM/yyyy HH:mm:ss"),
                    tipoOperazione = ((tipoOperazione)s.TipoOperazione).ToString(),
                    codiceAssociato = s.CodiceAssociato
                });

                int total = query.Count();  
                result.totalCount = total;

                result.lista = query.Skip((request.page - 1) * request.pageSize)
                .Take(request.pageSize)
                .ToList();
            }
            catch (Exception ex)
            {
                result.error = ex.ToString();
            }

            return Ok(result);
        }
    }
}
