using DocumentFormat.OpenXml.EMMA;
using Istanta.Models;
using Istanta.Utility;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Newtonsoft.Json;
using System.Security.Policy;

namespace Istanta.Controllers
{


    public class EtichetteController : Controller
    {
        private readonly ILogger<MeccanicheController> _logger;
        private readonly edro21_dbContext ctx;
        private readonly string extarnalSourcePath;
        private ExternalSourceClass exClass;
        private readonly IDbContextFactory<edro21_dbContext> _dbContextFactory;

        public EtichetteController(ILogger<MeccanicheController> logger, IConfiguration configuration, IOptions<PathExternal> external_lib, IDbContextFactory<edro21_dbContext> dbContextFactory)
        {
            this._dbContextFactory = dbContextFactory;
            this.ctx = this._dbContextFactory.CreateDbContext();//new edro21_dbContext(configuration.GetConnectionString("IstandaConnectionDb")!);
            _logger = logger;
            this.extarnalSourcePath = external_lib.Value.pathSource;
            exClass = new ExternalSourceClass(this.extarnalSourcePath);
        }

        public async Task<IActionResult> Index()
        {
            await this.Bind();



            return View();
        }

        [HttpPost]
        public async Task<IActionResult> Index(string NomeOrigine, string NomeTraduzione, string Formato, string Aree)//Meccaniche newItem)
        {

            //var _new = exClass.getMeccanicaByName(NomeOrigine);//newItem.NomeOrigine);// await this.ctx.Meccaniches.Where(m => m.NomeOrigine==newItem.NomeOrigine).FirstOrDefaultAsync();
            //if (_new != null)
            //{
            //    this.ViewBag.error = "Meccanica già esistente";
            //    await this.Bind();
            //    return View();
            //}

            //Meccaniche mNew = new Meccaniche();
            //mNew.NomeOrigine = NomeOrigine;// newItem.NomeOrigine;
            //mNew.NomeTraduzione = NomeTraduzione;// newItem.NomeTraduzione;
            //mNew.Formato = Formato;
            //if (Aree != null)
            //    mNew.Aree = Aree.Split(',').ToList();
            //else
            //    mNew.Aree = new List<string>();

            //exClass.addMeccanica(mNew);
            

            //await this.Bind();

            return Redirect("Etichette");
        }


        [HttpPost]
        [Route("Etichette/Update/{id}")]
        public async Task<IActionResult> Update(Int16 id, EtichettaItem item)
        {
            var edit = exClass.getEtichettaById(id);
            //var edit = await this.ctx.Meccaniches.FindAsync(id);
            if (edit != null)
            {
                edit.Etichetta = item.Etichetta.ToUpper();
                edit.Visual = item.Visual;
                edit.Raccolta = item.Raccolta;
                if (edit.Raccolta == null)
                {
                    edit.Raccolta = "";
                }
                edit.Raccolta = edit.Raccolta.Replace(" ", "_");
                exClass.editEtichetta(edit);
                //this.ctx.SaveChanges();
            }

            await this.Bind();
            return Ok(null);
            //return Redirect("../../Etichette");
        }

        [HttpPost]
        [Route("Etichette/UpdateRegole/{id}")]
        public async Task<IActionResult> UpdateRegole(Int16 id, EtichettaItem item)
        {
            var edit = exClass.getEtichettaById(id);
            //var edit = await this.ctx.Meccaniches.FindAsync(id);
            if (edit != null)
            {
                edit.Regole = item.Regole;
                exClass.editEtichetta(edit);
                //this.ctx.SaveChanges();
            }

            await this.Bind();

            return Ok(true);
        }

        [HttpPost]
        [Route("Etichette/Add")]
        public async Task<IActionResult> Add(EtichettaItem item)
        {
            var url = $"{HttpContext.Request.PathBase}/Etichette";
            if (item.Etichetta == null || item.Etichetta == "")
            {
                return Redirect(url);
            }
            var edit = exClass.geEtichettaByName(item.Etichetta.ToUpper());
            //var edit = await this.ctx.Meccaniches.FindAsync(id);
            if (edit == null)
            {
                EtichettaItem nuovaEtichetta = new EtichettaItem();
                nuovaEtichetta.Etichetta = item.Etichetta.ToUpper();
                nuovaEtichetta.Visual = item.Visual != null ? item.Visual : "";
                nuovaEtichetta.Raccolta = item.Raccolta != null ? item.Raccolta : "";
                nuovaEtichetta.Raccolta = nuovaEtichetta.Raccolta.Replace(" ", "_");
                exClass.addEtichetta(nuovaEtichetta);
                //this.ctx.SaveChanges();
            }
            else
            {
                return Redirect(url);

            }

            await this.Bind();

            return Redirect(url);
        }

        [HttpGet]
        [Route("Etichette/Delete/{id}")]
        public async Task<IActionResult> Delete(Int16 id)
        {
            var url = $"{HttpContext.Request.PathBase}/Etichette";

            //var item = await this.ctx.Meccaniches.FindAsync(id);
            var item = exClass.getEtichettaById(id);
            if (item != null)
            {
                exClass.deleteEtichetta(item);
            }

            return Redirect(url);

        }

        [HttpGet]
        [Route("Etichette/scaricaEtichette")]
        public async Task<IActionResult> scaricaEtichette()
        {
            var _list = exClass.getEtichette();// await this.ctx.Meccaniches.ToListAsync();
            return Ok(_list.source);

        }

        private async Task Bind()
        {
            var _list = exClass.getEtichette();// await this.ctx.Meccaniches.ToListAsync();
            this.ViewBag.lista_etichette = _list.source;

        }


        [HttpPut]
        [Route("Etichette/salvaSourceJsonCode")]
        public async Task<IActionResult> salvaSourceJsonCode([FromBody] SourceJsonRequest request)
        {
            BoolResult bRes = new BoolResult();

            bRes = SingletonConfiguration.DbEtichette!.SetJsonSource(request.jsoncode);
                
            return Ok(bRes);
        }


    }
}
