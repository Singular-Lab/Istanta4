using DocumentFormat.OpenXml.Spreadsheet;
using DocumentFormat.OpenXml.Vml.Spreadsheet;
using Istanta.Models;
using IstantaLib;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Conventions;
using Microsoft.Extensions.Options;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using SMBLibrary.Authentication.NTLM;
using System.Configuration;
using System.Net;

namespace Istanta.Controllers
{
    public class SchedaArticoloController : Controller
    {
        private readonly ILogger<MeccanicheController> _logger;
        private readonly edro21_dbContext ctx;
        private readonly string path_external_source = "";
        private readonly string olympusServerUrl;
        private readonly IDbContextFactory<edro21_dbContext> _dbContextFactory;
        private readonly string[] ext_post_lavorazione;

        public SchedaArticoloController(ILogger<MeccanicheController> logger, IConfiguration configuration, IOptions<PathExternal> external_lib, IOptions<FicoConfig> olConfig, IDbContextFactory<edro21_dbContext> dbContextFactory, IOptions<SyncOptions> sync_options)
        {
            this._dbContextFactory = dbContextFactory;
            this.ctx = this._dbContextFactory.CreateDbContext();
            //this.ctx = new edro21_dbContext(configuration.GetConnectionString("IstandaConnectionDb")!);
            _logger = logger;
            path_external_source = external_lib.Value.pathSource;
            ViewData["jsGuid"] = Guid.NewGuid().ToString();
            olympusServerUrl = olConfig.Value.olympusServerUrl;
            ext_post_lavorazione = sync_options.Value.extPostLavorazione!;

        }

        public IActionResult Index()
        {
            return View();
        }

        [HttpGet]

        public async Task<IActionResult> Index(string id, string codice)
        {

            if (id!= null && id!= "")
            {
                Int64 id_art = 0;
                Int64.TryParse(id, out id_art);

                if (id_art <= 0)
                    NotFound();

                var _item = await this.ctx.Articolis.Include(i => i.ArticoliFotos).Include(i2 => i2.ArticoliDescrizionis).Where(a => a.Id == id_art).FirstOrDefaultAsync();
                if (_item == null)
                {
                    NotFound();
                }
                ViewBag.Item = _item!;
            }
            else if (codice!=null && codice!="")
            {

                var _item = await this.ctx.Articolis.Include(i => i.ArticoliFotos).Include(i2 => i2.ArticoliDescrizionis).Where(a => a.Codice==codice).FirstOrDefaultAsync();
                if (_item == null)
                {
                    NotFound();
                }
                ViewBag.Item = _item!;
            }
            ViewBag.ipOlympus = olympusServerUrl;
            ViewBag.extPostProduzione = ext_post_lavorazione;

            return View();
        }

        [HttpGet]
        [Route("SchedaArticolo/getAllFotoByCodice/{codice}")]
        public async Task<IActionResult> getAllFotoDByCodice(string codice)
        {
            AllFotoRequestByCorreggo_Response result = new AllFotoRequestByCorreggo_Response();

            Articoli? artItem = await this.ctx.Articolis.Include(i => i.ArticoliFotos).FirstOrDefaultAsync(a => a.Codice == codice);

            if (artItem != null)
            {
                var obj = artItem.ArticoliFotos!.Where(f => f.Tipo == (Byte)TipoFoto.Foto).OrderByDescending(ord => ord.DataModifica).Select(s => new
                {
                    Id = s.Id,
                    GuidId = s.GuidId,
                    Nome = s.NomeReale,
                    Area = s.Area,
                    Canale = s.Canale,
                    Attiva = s.Attiva,
                    //I20-971: la schermata di cambio foto mostra la data di caricamento su ogni
                    //foto. DataModifica viaggia perche' e' il criterio con cui l'elenco e' ordinato.
                    DataInserimento = s.DataInserimento,
                    DataModifica = s.DataModifica
                });

                result.result = JsonConvert.SerializeObject(obj);
            }
            else
            {
                throw new Exception($"{codice} non trovato");
            }

            return Ok(result);
        }



        [HttpPost]
        public async Task<IActionResult> Index(Articoli art)
        {
            var _item = await this.ctx.Articolis.Include(i=>i.ArticoliDescrizionis).Include(i2=>i2.ArticoliFotos).Where(a => a.Id == art.Id).FirstOrDefaultAsync();
            if (_item == null || _item.ArticoliDescrizionis!.Count<=0)
            {
                NotFound();
            }

            try
            {
                ViewBag.Item = _item!;

                if (art.Codice != _item!.Codice)
                {
                    //Si sta tentando di cambiare il codice
                    //Devo controllare se ne esiste già uno che ha quel codice
                    int countCheck = await this.ctx.Articolis.Where(a => a.Id != _item!.Id && a.Codice == art.Codice).CountAsync();
                    if (countCheck > 0)
                    {                        
                        throw new Exception("Articolo già esistente con il codice specificato");
                    }
                    else
                    {
                        _item!.Codice = art.Codice;
                    }
                }

                var descrtem = _item!.ArticoliDescrizionis!.FirstOrDefault()!;
                descrtem.Descrizione1 = art.Descrizione1 != null ? art.Descrizione1 : "";
                descrtem.Descrizione3 = art.Descrizione3 != null ? art.Descrizione3 : "";
                descrtem.Descrizione2 = art.Descrizione2 != null ? art.Descrizione2 : "";
                descrtem.Descrizione4 = art.Descrizione4 != null ? art.Descrizione4 : "";
                descrtem.DataUltimaRicezione = DateTime.Now;

                this.ctx.SaveChanges();
            }
            catch(Exception ex)
            {
                ex.ToString();
                ViewBag.error = ex.Message;
            }

            return View();
        }

        [HttpPost]
        [Route("SchedaArticolo/DeleteFoto/{id}")]
        public async Task<IActionResult> DeleteFoto(Int64 id)
        {
            var articolo_foto = await ctx.ArticoliFotos.Include(i => i.IdArticoloNavigation).Where(a => a.Id == id).FirstOrDefaultAsync();

            if (articolo_foto!=null)
            {
                this.ctx.ArticoliFotos.Remove(articolo_foto);
                this.ctx.SaveChanges();
            }

            

            return Redirect("~/SchedaArticolo?id=" + articolo_foto!.IdArticolo);
        }


        [HttpPut]
        [Route("SchedaArticolo/AggiornaPrimario")]
        public async Task<IActionResult> AggiornaPrimario(string guidId, string codice)
        {

            Articoli? artItem = await this.ctx.Articolis.Include(f=>f.ArticoliFotos).Where(f => f.Codice == codice).FirstOrDefaultAsync();

            //Controllo che esista l'articolo
            if (artItem != null)
            {
                var el = artItem.ArticoliFotos!.First(f=>f.GuidId == guidId);
                el.DataModifica = DateTime.Now;
                ctx.SaveChanges();
            }

            return Ok();
        }
    }
}
