using Istanta.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Newtonsoft.Json;

namespace Istanta.Controllers
{


    public class RegoleMastroController : Controller
    {
        private readonly ILogger<RegoleMastroController> _logger;
        //private readonly edro21_dbContext ctx;
        private readonly string extarnalSourcePath;
        private ExternalSourceClass exClass;

        public RegoleMastroController(ILogger<RegoleMastroController> logger, IConfiguration configuration, IOptions<PathExternal> external_lib)
        {
            //this.ctx = new edro21_dbContext(configuration.GetConnectionString("IstandaConnectionDb")!);
            _logger = logger;
            this.extarnalSourcePath = external_lib.Value.pathSource;
            exClass = new ExternalSourceClass(this.extarnalSourcePath);
        }

        //public async Task<IActionResult> Index()
        //{
        //    await this.Bind();

           

        //    return View();
        //}

        //[HttpPost]
        //public async Task<IActionResult> Index(string Nome)
        //{
        //    if (Nome == null || Nome == "")
        //    {
        //        return Redirect("RegoleMastro");
        //    }
        //    var _new = exClass.getRegoleMastroByName(Nome);
        //    if (_new != null)
        //    {
        //        this.ViewBag.error = "Mastro già esistente";
        //        await this.Bind();
        //        return View();
        //    }

        //    RegoleMastro mNew = new RegoleMastro();
        //    mNew.Nome = Nome;// newItem.NomeOrigine;
        //    exClass.addRegoleMastro(mNew);
            

        //    await this.Bind();

        //    return Redirect("RegoleMastro");
        //}

        //[HttpPost]
        //[Route("RegoleMastro/Update/{id}")]
        //public async Task<IActionResult> Index(Int16 id, RegoleMastro item)
        //{
        //    var edit = exClass.getRegoleMastroById(id);            
        //    //var edit = await this.ctx.Meccaniches.FindAsync(id);
        //    if (edit != null)
        //    {
        //        edit.Nome = (item.Nome != null && item.Nome != "" ? item.Nome : edit.Nome);
        //        edit.Regole = item.Regole != null ? item.Regole : edit.Regole;
        //        edit.Specifiche = item.Specifiche != null ? item.Specifiche : edit.Specifiche;
        //        exClass.editRegoleMastro(edit);
        //        //this.ctx.SaveChanges();
        //    }
            
        //    await this.Bind();

        //    return Redirect("../../RegoleMastro");
        //}

        //[HttpGet]
        //[Route("RegoleMastro/Delete/{id}")]
        //public async Task<IActionResult> Index(Int16 id)
        //{

        //    //var item = await this.ctx.Meccaniches.FindAsync(id);
        //    var item = exClass.getRegoleMastroById(id);
        //    if (item != null)
        //    {
        //        exClass.deleteRegoleMastro(item);
        //        //this.ctx.Meccaniches.Remove(item);
        //        //this.ctx.SaveChanges();
        //    }

        //    return Redirect("../../RegoleMastro");

        //}
        //private async Task Bind()
        //{
        //    var _list = exClass.getDbRegoleMastro();// await this.ctx.Meccaniches.ToListAsync();
        //    this.ViewBag.lista_regole_mastro = _list.source;

        //}

    }
}
