using Istanta.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Newtonsoft.Json;

namespace Istanta.Controllers
{


    public class MeccanicheController : Controller
    {
        private readonly ILogger<MeccanicheController> _logger;
        private readonly edro21_dbContext ctx;
        private readonly string extarnalSourcePath;
        private ExternalSourceClass exClass;
        private readonly IDbContextFactory<edro21_dbContext> _dbContextFactory;
        public MeccanicheController(ILogger<MeccanicheController> logger, IConfiguration configuration, IOptions<PathExternal> external_lib, IDbContextFactory<edro21_dbContext> dbContextFactory)
        {
            this._dbContextFactory = dbContextFactory;
            this.ctx = this._dbContextFactory.CreateDbContext();
            //this.ctx = new edro21_dbContext(configuration.GetConnectionString("IstandaConnectionDb")!);
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

            var _new = exClass.getMeccanicaByName(NomeOrigine);//newItem.NomeOrigine);// await this.ctx.Meccaniches.Where(m => m.NomeOrigine==newItem.NomeOrigine).FirstOrDefaultAsync();
            if (_new != null)
            {
                this.ViewBag.error = "Meccanica già esistente";
                await this.Bind();
                return View();
            }

            Meccaniche mNew = new Meccaniche();
            mNew.NomeOrigine = NomeOrigine;// newItem.NomeOrigine;
            mNew.NomeTraduzione = NomeTraduzione;// newItem.NomeTraduzione;
            mNew.Formato = Formato;
            if (Aree != null)
                mNew.Aree = Aree.Split(',').ToList();
            else
                mNew.Aree = new List<string>();

            exClass.addMeccanica(mNew);
            

            await this.Bind();

            return Redirect("Meccaniche");
        }


        [HttpPost]
        [Route("Meccaniche/Update/{id}")]
        public async Task<IActionResult> Index(Int16 id, Meccaniche item)
        {
            var edit = exClass.getMeccanicaById(id);            
            //var edit = await this.ctx.Meccaniches.FindAsync(id);
            if (edit != null)
            {
                edit.NomeOrigine = item.NomeOrigine;
                edit.NomeTraduzione = item.NomeTraduzione;
                edit.Formato = item.Formato;
                edit.Aree = (item.Aree!.Count > 0 && item.Aree[0]!=null) ? item.Aree[0].Split(',').ToList() :new List<string>();
                exClass.editMeccanica(edit);
                //this.ctx.SaveChanges();
            }
            
            await this.Bind();

            return Redirect("../../Meccaniche");
        }

        [HttpGet]
        [Route("Meccaniche/Delete/{id}")]
        public async Task<IActionResult> Index(Int16 id)
        {

            //var item = await this.ctx.Meccaniches.FindAsync(id);
            var item = exClass.getMeccanicaById(id);
            if (item != null)
            {
                exClass.deleteMeccanica(item);
                //this.ctx.Meccaniches.Remove(item);
                //this.ctx.SaveChanges();
            }

            return Redirect("../../Meccaniche");

        }
        private async Task Bind()
        {
            var _list = exClass.getMeccaniche();// await this.ctx.Meccaniches.ToListAsync();
            this.ViewBag.lista_meccaniche = _list.source;

        }

    }
}
