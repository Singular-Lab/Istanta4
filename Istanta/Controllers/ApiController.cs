using Microsoft.AspNetCore.Mvc;
using Istanta.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Newtonsoft.Json;
using IstantaLib;
using Istanta.Models_2;
using LinqKit;

namespace Istanta.Controllers
{
    [ApiController]
    [Route("[controller]/")]
    public class ApiController : Controller
    {
        /*public IActionResult Index()
        {
            return View();
        }*/

        private readonly ILogger<ApiController> _logger;
        private readonly string path_to_export = "";
        private readonly string path_to_import = "";
        private readonly string path_external_lib = "";
        private readonly string path_external_source = "";
        private readonly edro21_dbContext ctx;
        private readonly Edro21_DbContext2 ctx2;
        IConfiguration _config;
        private readonly IOptions<FicoConfig> _ficoConfig;

        private readonly IDbContextFactory<edro21_dbContext> _dbContextFactory;
        private readonly IDbContextFactory<Edro21_DbContext2> _dbContextFactory2;
        public ApiController(ILogger<ApiController> logger, IConfiguration configuration, IOptions<PathOperationExport> option_export, IOptions<PathOperationImport> option_import, IOptions<PathExternal> external_paths, IOptions<FicoConfig> ficoConfig, IDbContextFactory<edro21_dbContext> dbContextFactory, IDbContextFactory<Edro21_DbContext2> dbContextFactory2)
        {
            this._dbContextFactory2 = dbContextFactory2;
            this._dbContextFactory = dbContextFactory;
            this.ctx = this._dbContextFactory.CreateDbContext();//new edro21_dbContext(configuration.GetConnectionString("IstandaConnectionDb")!);
            this.ctx2 = this._dbContextFactory2.CreateDbContext();
            _logger = logger;

            _config = configuration;

            path_to_export = option_export.Value.path;
            path_to_import = option_import.Value.path;
            path_external_lib = external_paths.Value.pathLib;
            path_external_source = external_paths.Value.pathSource;

            this._ficoConfig = ficoConfig;
        }

        /*
        [HttpGet]
        public async Task<IActionResult> doSync()
        {
            return Ok(await this.ctx.Articolis.Take(100).ToListAsync());
        }*/


        [HttpGet]
        [Route("attivita/doById/{id}")]
        public async Task<IActionResult> doAttivitaByID(Int64 id)
        {
            OperationsController op_ctrl = new OperationsController(_config.GetConnectionString("IstandaConnectionDb")!, path_to_import, path_to_export, path_external_lib, path_external_source, this._ficoConfig.Value.nomeCliente, this._dbContextFactory, dbContextFactory2: this._dbContextFactory2);
            OkObjectResult actionResult = (OkObjectResult) await op_ctrl.EseguiByID(id);

            return Ok(actionResult.Value);
        }

        [HttpGet]
        [Route("attivita/confermaAttivitaByUtente/{id}/{persistenza}/{report}")]
        public async Task<IActionResult> confermaAttivitaByUtente(Int64 id, bool persistenza, bool report)
        {
            BoolResult res = new BoolResult();
            try
            {
                Attivitum attItem = this.ctx.Attivita.Where(i => i.Id == id).FirstOrDefault()!;
                

                
                OperationRequest opReq = JsonConvert.DeserializeObject<OperationRequest>(attItem!.Contract)!;
                string? strpkg = opReq.Packet!.ToString();

                InputFormTracciato? packet = JsonConvert.DeserializeObject<InputFormTracciato>(strpkg!);
                
                packet!.persistent = persistenza;
                packet!.askReport = report;
                opReq.Packet = packet;


                attItem.Contract = JsonConvert.SerializeObject(opReq);
                attItem.Stato = (Byte)OperationStauts.InAttesaDiAssegnazione;
                attItem.Progress = 0;
                attItem.StatoMsg = "";

                this.ctx.SaveChanges();
                res.Esito = true;

            }catch(Exception ex)
            {
                res.error = ex.ToString();
            }

            return Ok(res);
        }

        [HttpGet]
        [Route("attivita/confermaAttivitaDellaPromoByUtente/{id}/{persistenza}/{report}")]
        public async Task<IActionResult> ConfermaAttivitaDellaPromoByUtente(int id, bool persistenza, bool report)
        {
            StringResult res = new StringResult();
            try
            {
                var pItem = await this.ctx2.Promos.Include(i=>i.PromoImportazionis).FirstOrDefaultAsync(p => p.Id == id);
                if (pItem!=null)
                {
                    res.Esito = "";
                    pItem.PromoImportazionis.Select(s => s.IdAttivita).ToList().ForEach(idAttivita =>
                    {
                        Attivitum attItem = this.ctx.Attivita.Where(i => i.Id == idAttivita).FirstOrDefault()!;
                        if (attItem.Stato == (Byte)OperationStauts.InAttesaDiConfermaUtente || attItem.Stato == (Byte)OperationStauts.Esaminata || attItem.Stato == (Byte)OperationStauts.TerminataConErrori)
                        {
                            OperationRequest opReq = JsonConvert.DeserializeObject<OperationRequest>(attItem!.Contract)!;
                            string? strpkg = opReq.Packet!.ToString();

                            InputFormTracciato? packet = JsonConvert.DeserializeObject<InputFormTracciato>(strpkg!);

                            packet!.persistent = persistenza;
                            packet!.askReport = report;
                            opReq.Packet = packet;


                            attItem.Contract = JsonConvert.SerializeObject(opReq);
                            attItem.Stato = (Byte)OperationStauts.InAttesaDiAssegnazione;
                            attItem.Progress = 0;
                            attItem.StatoMsg = "";

                            res.Esito += (res.Esito != "") ? "," + idAttivita.ToString() : idAttivita.ToString();
                        }
                    });

                    await this.ctx.SaveChangesAsync();
                    res.boolEsito = true;

                }
                else
                {
                    res.error="Promozione non trovata";
                    return BadRequest(res);
                }

                 
                

            }
            catch (Exception ex)
            {
                res.error = ex.ToString();
            }

            return Ok(res);
        }

        [HttpGet]
        [Route("attivita/scartaAttivitaByUtente/{id}")]
        public async Task<IActionResult> scartaAttivitaByUtente(Int64 id)
        {
            BoolResult res = new BoolResult();
            try
            {
                Attivitum? attItem = this.ctx.Attivita.Where(i => i.Id == id).FirstOrDefault();

                if (attItem != null)
                {
                    attItem.Stato = (Byte)OperationStauts.Scartata;
                    res.Esito = true;
                    ////Rimuovo i logs
                    //foreach(var log in attItem.AttivitaLogs)
                    //{
                    //    this.ctx.AttivitaLogs.Remove(log);
                    //}
                    this.ctx.SaveChanges();

                    //this.ctx.Attivita.Remove(attItem);

                    //this.ctx.SaveChanges();

                    //res.Esito = true;

                }
                else
                {
                    res.Esito = false;
                    res.error = "Attività non trovata";
                }
            }
            catch (Exception ex)
            {
                res.error = ex.ToString();
            }

            return Ok(res);
        }

        [HttpGet]
        [Route("attivita/getStato/{id}")]
        public async Task<IActionResult> getStatoAttivitaByID(Int64 id)
        {
            var item = await this.ctx.Attivita.Include(i=>i.SubAttivita).Where(i=>i.Id==id).Select(s=>new { 
            
                Id=s.Id,
                StatoMsg=s.StatoMsg,
                Progress=s.Progress,
                Stato=s.Stato,
                Coda=s.Coda,
                SubAttivita =s.SubAttivita!.Select(s2=>new
                {
                    Id = s2.Id,
                    StatoMsg = s2.StatoMsg,
                    Progress = s2.Progress,
                    Stato=s2.Stato,
                    Coda=s2.Coda,
                }).ToList()


            }).FirstOrDefaultAsync();

            return Ok(item);
        }

        [HttpGet]
        [Route("attivita/getAttivitaByTimeRange/{minutiDaSottrarre}/{includeAllPending}/{includeAllOngoing}")]
        public async Task<IActionResult> getAttivitaByTimeRange(int minutiDaSottrarre, bool includeAllPending, bool includeAllOngoing)
        {
            double millisecondiDaSottrarre = minutiDaSottrarre * 60 * 1000;

            var query = this.ctx.Attivita.Include(i => i.SubAttivita)
                .Where(i => i.IdParent == null && i.DataInserimento >= DateTime.Now.AddMilliseconds(-millisecondiDaSottrarre));

            if (includeAllPending && includeAllOngoing)
            {
                query = this.ctx.Attivita.Include(i => i.SubAttivita)
                .Where(i => i.IdParent == null && ((i.DataInserimento >= DateTime.Now.AddMilliseconds(-millisecondiDaSottrarre)) || (i.Stato == (byte)OperationStauts.InAttesaDiAssegnazione || i.Stato == (byte)OperationStauts.InCoda) || (i.Stato == (byte)OperationStauts.ElaborazioneDati || i.Stato == (byte)OperationStauts.AttesaI_O)));
            }
            else if (includeAllPending)
            {
                query = this.ctx.Attivita.Include(i => i.SubAttivita)
                .Where(i => i.IdParent == null && ((i.DataInserimento >= DateTime.Now.AddMilliseconds(-millisecondiDaSottrarre)) || (i.Stato == (byte)OperationStauts.InAttesaDiAssegnazione || i.Stato == (byte)OperationStauts.InCoda)));
            }
            else if (includeAllOngoing)
            {
                query = this.ctx.Attivita.Include(i => i.SubAttivita)
                .Where(i => i.IdParent == null && ((i.DataInserimento >= DateTime.Now.AddMilliseconds(-millisecondiDaSottrarre)) || (i.Stato == (byte)OperationStauts.ElaborazioneDati || i.Stato == (byte)OperationStauts.AttesaI_O)));
            }

            var attivitaPrincipali = await query
                    .OrderByDescending(a => a.DataInserimento)
                    .ToListAsync();

            // Carica ricorsivamente le sottoattività
            LoadSubAttivita(attivitaPrincipali);

            return Ok(attivitaPrincipali);

            //foreach (var attivita in attivitaTrovate)
            //{
            //    if (attivita.SubAttivita.Count > 0)
            //    {
            //        foreach (var subAct in attivita.SubAttivita)
            //        {
            //            attivita.SubAttivita = this.ctx.Attivita.Where(f=>f.IdParent == attivita.Id).Select(s => new
            //            {
            //                Id = s.Id,
            //                StatoMsg = s.StatoMsg,
            //                Progress = s.Progress,
            //                Titolo = s.Titolo,
            //                DataInserimento = s.DataInserimento,
            //                DataInizio = s.DataInizio,
            //                DataFine = s.DataFine,
            //                Stato = s.Stato,
            //                SubAttivita = s.SubAttivita.Select(s2 => new
            //                {
            //                    Id = s2.Id,
            //                    StatoMsg = s2.StatoMsg,
            //                    Progress = s2.Progress,
            //                    Titolo = s.Titolo,
            //                    DataInserimento = s.DataInserimento,
            //                    DataInizio = s.DataInizio,
            //                    DataFine = s.DataFine,
            //                    Stato = s2.Stato,
            //                    SubAttivita = new List<Attivitum>()
            //                }).ToList()
            //            })
            //    .OrderByDescending(s => s.DataInserimento)
            //    .ToListAsync();
            //        }
            //    }

            //}

            //return Ok(attivitaTrovate);
        }
        private void LoadSubAttivita(List<Attivitum> attivitaList)
        {
            foreach (var attivita in attivitaList)
            {
                attivita.SubAttivita = ctx.Attivita
                    .Where(s => s.IdParent == attivita.Id)
                    .ToList();

                // Ricorsione
                LoadSubAttivita((List<Attivitum>)attivita.SubAttivita);
            }
        }

        [HttpGet]
        [Route("attivita/getLogErrorAttivita/{id_attivita}")]
        public async Task<IActionResult> getLogErrorAttivita(Int64 id_attivita)
        {
            var item = await this.ctx.AttivitaLogs.Where(i => i.IdAttivita == id_attivita).Select(s => s.Note).ToListAsync();
            return Ok(item);
        }

        

    }

}
