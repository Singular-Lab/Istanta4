using Microsoft.AspNetCore.Mvc;
using Istanta.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Query.SqlExpressions;
using Microsoft.Extensions.Options;
using Newtonsoft.Json.Linq;
using DocumentFormat.OpenXml.Office2010.Excel;

namespace Istanta.Controllers
{
    public class MastroController : Controller
    {
        private readonly ILogger<MastroController> _logger;
        private readonly edro21_dbContext ctx;
        private readonly string extarnalSourcePath;
        private ExternalSourceClass exClass;
        private readonly IDbContextFactory<edro21_dbContext> _dbContextFactory;
        public MastroController(ILogger<MastroController> logger, IConfiguration configuration, IOptions<PathExternal> external_lib, IDbContextFactory<edro21_dbContext> dbContextFactory)
        {
            _logger = logger;
            this.extarnalSourcePath = external_lib.Value.pathSource;
            exClass = new ExternalSourceClass(this.extarnalSourcePath);

            this._dbContextFactory = dbContextFactory;
            this.ctx = this._dbContextFactory.CreateDbContext();
            //this.ctx = new edro21_dbContext(configuration.GetConnectionString("IstandaConnectionDb")!);
        }
        public async Task<IActionResult> Index()
        {
            await this.Bind();
            return View();
        }



        [HttpPost]        
        public async Task<IActionResult> Index(string Nome, string Formato, string MeccanicaDefault = "")
        {
            if (Nome == null || Nome == "" || Formato == null || Formato == "" || Formato == "0")
            {
                this.ViewBag.error = "Specificare nome e formato della nuova mastro";
                await this.Bind();
                return View();
            }
            //var _new = await this.ctx.Mastros.Where(m => m.Nome == newItem.Nome).FirstOrDefaultAsync();
            var _new = exClass.getMastroByNameAndFormato(Nome, Formato);
            if (_new != null && _new.Active)
            {
                this.ViewBag.error = "Mastro già esistente";
                await this.Bind();
                return View();
            }
            else if (_new != null && !_new.Active)
            {
                _new.Active = true;
                exClass.editMastro(_new);
            }
            else
            {
                DbMastroItem mNew = new DbMastroItem();
                mNew.Id = exClass.getLastMastroId();
                mNew.Nome = Nome;
                mNew.Formato = Formato;
                mNew.MeccanicaDefault = MeccanicaDefault;
                mNew.Active = true;
                exClass.addMastro(mNew);
            }

           // await this.Bind();

            return Redirect("Mastro");
        }

        
        [HttpPost]
        [Route("Mastro/Update/{id}")]
        public async Task<IActionResult> Index(Int16 id, string Nome, string Formato, string MeccanicaDefault, string Associazioni)
        {
            var edit = exClass.getMastroById(id);//await this.ctx.Mastros.FindAsync(id);
            if (edit != null)
            {
                edit.Nome = Nome;
                edit.Formato = Formato;
                edit.MeccanicaDefault = MeccanicaDefault;
                edit.Associazioni = (Associazioni != null && Associazioni != "" ? Associazioni.Split(",").ToList() : new List<string>());
                exClass.editMastro(edit);
            }

            await this.Bind();

            return Redirect("../../Mastro");
        }
        

        [HttpGet]
        [Route("Mastro/Delete/{id}")]
        public async Task<IActionResult> Index(Int16 id)
        {
            BoolResult result = new BoolResult();
            try {
                var item = exClass.getMastroById(id);// await this.ctx.Mastros.FindAsync(id);
                if (item != null)
                {
                    var menabos = exClass.getMenabos();
                    List<DbMenaboPagineItem> schemi = new List<DbMenaboPagineItem>();
                    foreach (var mItem in menabos)
                    {
                        var schema = exClass.getSchemaMenabo(mItem.IdMenaboPagine);
                        schemi.Add(schema);
                    }

                    var schemiWhereMastroIsUsed = schemi.Where(f => f.Pagine.Find(f => f.IdMastro == item.Id) != null).ToList();

                    if (schemiWhereMastroIsUsed != null && schemiWhereMastroIsUsed.Count > 0)
                    {
                        string errorMessage = "La mastro che si vuole eliminare è già usata negli schemi: ";
                        foreach (var schemaItem in schemiWhereMastroIsUsed)
                        {
                            errorMessage += schemaItem.Titolo +", ";
                        }
                        errorMessage = errorMessage.Substring(0, errorMessage.Length - 2);
                        throw new Exception(errorMessage);
                    }
                    exClass.deleteMastro(item);//this.ctx.Mastros.Remove(item);
                    this.ctx.SaveChanges();
                }

                result.Esito = true;
            }
            catch(Exception ex)
            {
                result.error = ex.Message;
            }            

            return Ok(result);
            //return Redirect("../../Mastro");
        }

        private async Task Bind()
        {
            List<DbMastroItem> _list = exClass.getMastro().source;//await this.ctx.Mastros.ToListAsync();
            this.ViewBag.lista = _list;

            JObject? o1 = JObject.Parse(System.IO.File.ReadAllText(this.extarnalSourcePath + "SourceMenabo.json"));
            DbMenabo? menaboDB = o1.ToObject<DbMenabo>();
            ViewBag.formati = menaboDB!.formatiMenaboPagina;

            List<Meccaniche> meccanicheSource = exClass.getMeccaniche().source;//await this.ctx.Mastros.ToListAsync();
            this.ViewBag.meccanicheSource = meccanicheSource;
        }

        //[HttpPut]
        //[Route("Mastro/UpdateAssociazioni/{idMastro}")]
        //public async Task<IActionResult> UpdateAssociazioni(MastroAssociazioni mastroAssociazioni, int idMastro)
        //{
        //    BoolResult result = new BoolResult();
        //    try
        //    {
        //        var edit = exClass.getMastroById(idMastro);//await this.ctx.Mastros.FindAsync(id);
        //        if (edit != null)
        //        {
        //            edit.Associazioni = mastroAssociazioni.Associazioni;
        //            exClass.editMastro(edit);
        //        }
        //        await this.Bind();
        //        result.Esito = true;

        //    }
        //    catch (Exception ex)
        //    {
        //        result.error = ex.Message;
        //        result.Esito = false;
        //    }


        //    return Ok(result);
        //}

    }
}
