using Istanta.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Newtonsoft.Json;

namespace Istanta.Controllers
{


    public class DeclinazioniMeccanicheController : Controller
    {
        private readonly ILogger<DeclinazioniMeccanicheController> _logger;
        private readonly edro21_dbContext ctx;
        private readonly string extarnalSourcePath;
        private ExternalSourceClass exClass;
        private readonly IDbContextFactory<edro21_dbContext> _dbContextFactory;
        public DeclinazioniMeccanicheController(ILogger<DeclinazioniMeccanicheController> logger, IConfiguration configuration, IOptions<PathExternal> external_lib, IDbContextFactory<edro21_dbContext> dbContextFactory)
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
        public async Task<IActionResult> Index(string Nome, float Livello, string Formato)
        {
            if (Nome == null || Livello <= 0)
            {
                return Redirect("DeclinazioniMeccaniche");
            }
            var _new = exClass.getDeclinazioneMeccanicaByName(Nome);//newItem.NomeOrigine);// await this.ctx.Meccaniches.Where(m => m.NomeOrigine==newItem.NomeOrigine).FirstOrDefaultAsync();
            if (_new != null)
            {
                this.ViewBag.error = "Meccanica già esistente";
                await this.Bind();
                return View();
            }

            DeclinazioneMeccanica mNew = new DeclinazioneMeccanica();
            mNew.Nome = Nome;// newItem.NomeOrigine;
            mNew.Livello = Livello;
            mNew.Formato = Formato != null && Formato != "null" ? Formato.ToLower() : "";

            if (mNew.Formato != "")
            {
                try
                {
                    var formatoCheck = mNew.Formato.ToLower();
                    var valoriFormato = formatoCheck.Split("x");
                    if (valoriFormato.Length == 2)
                    {
                        if (!(Int32.TryParse(valoriFormato[0], out int result) && Int32.TryParse(valoriFormato[1], out int result2)))
                        {
                            throw new Exception();
                        }
                    }
                    else
                    {
                        throw new Exception();
                    }
                }
                catch
                {
                    mNew.Formato = "";
                }
            }
            exClass.addDeclinazioneMeccanica(mNew);
            

            await this.Bind();

            return Redirect("DeclinazioniMeccaniche");
        }

        [HttpGet]
        [Route("DeclinazioniMeccanicheAvanzate/AddDeclinazioneAvanzata/{Nome}/{LivelloMeccanica}/{LivelloEsternoMeccanicaAvanzata}/{Formato}")]
        public async Task<IActionResult> AddDeclinazioneAvanzata(string Nome, float LivelloMeccanica, float LivelloEsternoMeccanicaAvanzata, string Formato = "")
        {
            if (Nome == null)
            {
                return Redirect("DeclinazioniMeccaniche");
            }
            var _new = exClass.getDeclinazioneMeccanicaAvanzataByName(Nome, LivelloEsternoMeccanicaAvanzata);//newItem.NomeOrigine);// await this.ctx.Meccaniches.Where(m => m.NomeOrigine==newItem.NomeOrigine).FirstOrDefaultAsync();
            if (_new != null)
            {
                this.ViewBag.error = "Meccanica già esistente";
                await this.Bind();
                return View();
            }

            DeclinazioneMeccanicaAvanzata mNew = new DeclinazioneMeccanicaAvanzata();
            mNew.Nome = Nome;// newItem.NomeOrigine;
            mNew.LivelloMeccanica = LivelloMeccanica;
            mNew.LivelloEsternoMeccanicaAvanzata = LivelloEsternoMeccanicaAvanzata;
            mNew.Formato = Formato != null && Formato != "null" ? Formato.ToLower() : "";
            if (mNew.Formato != "")
            {
                try
                {
                    var formatoCheck = mNew.Formato.ToLower();
                    var valoriFormato = formatoCheck.Split("x");
                    if (valoriFormato.Length == 2)
                    {
                        if (!(Int32.TryParse(valoriFormato[0], out int result) && Int32.TryParse(valoriFormato[1], out int result2)))
                        {
                            throw new Exception();
                        }
                    }
                    else
                    {
                        throw new Exception();
                    }
                }
                catch
                {
                    mNew.Formato = "";
                }
            }
            exClass.addDeclinazioneMeccanicaAvanzata(mNew);


            await this.Bind();

            return Redirect("DeclinazioniMeccaniche");
        }

        [HttpGet]
        [Route("RimozioneMeccanicheAvanzate/AddRimozioneDeclinazioneAvanzata/{Nome}/{LivelloMeccanica}/{LivelloEsternoMeccanicaAvanzata}/{timeToApplyEnum}")]
        public async Task<IActionResult> AddRimozioneDeclinazioneAvanzata(string Nome, float LivelloMeccanica, float LivelloEsternoMeccanicaAvanzata, int timeToApplyEnum)
        {
            if (Nome == null)
            {
                return Redirect("DeclinazioniMeccaniche");
            }
            var _new = exClass.getRimozioneMeccanicaAvanzataByName(Nome, LivelloEsternoMeccanicaAvanzata);//newItem.NomeOrigine);// await this.ctx.Meccaniches.Where(m => m.NomeOrigine==newItem.NomeOrigine).FirstOrDefaultAsync();
            if (_new != null)
            {
                this.ViewBag.error = "Meccanica già esistente";
                await this.Bind();
                return View();
            }

            RimozioneDeclinazioneMeccanica mNew = new RimozioneDeclinazioneMeccanica();
            mNew.Nome = Nome;// newItem.NomeOrigine;
            mNew.LivelloMeccanica = LivelloMeccanica;
            mNew.LivelloEsternoMeccanicaAvanzata = LivelloEsternoMeccanicaAvanzata;
            mNew.timeToApply = (timeToApplyOperation)timeToApplyEnum;
            exClass.addRimozioneMeccanicaAvanzata(mNew);


            await this.Bind();

            return Redirect("DeclinazioniMeccaniche");
        }

        [HttpGet]
        [Route("CombinazioneMeccanica/AddCombinazione/{Nome}/{Formato}")]
        public async Task<IActionResult> AddCombinazioneMeccanica(string Nome, string Formato)//Meccaniche newItem)
        {
            if (Nome == null || Formato == null)
            {
                return Redirect("DeclinazioniMeccaniche");
            }
            var _new = exClass.getCombinazioneMeccanicaByName(Nome);//newItem.NomeOrigine);// await this.ctx.Meccaniches.Where(m => m.NomeOrigine==newItem.NomeOrigine).FirstOrDefaultAsync();
            if (_new != null)
            {
                this.ViewBag.error = "Meccanica già esistente";
                await this.Bind();
                return View();
            }

            CombinazioniMeccaniche mNew = new CombinazioniMeccaniche();
            mNew.NomeCombinazione = Nome;// newItem.NomeOrigine;
            mNew.Formato = Formato.ToLower();

            try
            {
                var formatoCheck = mNew.Formato.ToLower();
                var valoriFormato = formatoCheck.Split("x");
                if (valoriFormato.Length == 2)
                {
                    if (!(Int32.TryParse(valoriFormato[0], out int result) && Int32.TryParse(valoriFormato[1], out int result2)))
                    {
                        throw new Exception();
                    }
                }
                else
                {
                    throw new Exception();
                }
            }
            catch
            {
                mNew.Formato = "1x1";
            }

            exClass.addCombinazioneMeccanica(mNew);


            await this.Bind();

            return Redirect("DeclinazioniMeccaniche");
        }

        [HttpPost]
        [Route("DeclinazioniMeccaniche/Update/{id}")]
        public async Task<IActionResult> Index(Int16 id, DeclinazioneMeccanica item)
        {
            BoolResult res = new BoolResult();
            try
            {
                var edit = exClass.getDeclinazioneMeccanicaById(id);
                //var edit = await this.ctx.Meccaniches.FindAsync(id);
                if (edit != null)
                {
                    edit.Nome = (item.Nome != null && item.Nome != "" ? item.Nome : edit.Nome);
                    edit.Livello = (item.Livello != 0 ? item.Livello : edit.Livello);
                    edit.Formato = (item.Formato != null ? item.Formato.ToLower() : "");
                    if (edit.Formato != "")
                    {
                        try
                        {
                            var formatoCheck = edit.Formato.ToLower();
                            var valoriFormato = formatoCheck.Split("x");
                            if (valoriFormato.Length == 2)
                            {
                                if (!(Int32.TryParse(valoriFormato[0], out int result) && Int32.TryParse(valoriFormato[1], out int result2)))
                                {
                                    throw new Exception("Formato non corretto");
                                }
                            }
                            else
                            {
                                throw new Exception("Formato non corretto");
                            }
                        }
                        catch
                        {
                            edit.Formato = "";
                        }
                    }
                    edit.Regole = item.Regole != null ? item.Regole : edit.Regole;
                    exClass.editDeclinazioneMeccanica(edit);
                    //this.ctx.SaveChanges();
                }

                await this.Bind();
                res.Esito = true;
                return Ok(res);
            }
            catch(Exception ex)
            {
                res.Esito = false;
                res.error = ex.ToString();
                return Ok(res);
            }
            //return Redirect("../../DeclinazioniMeccaniche");
        }

        [HttpPost]
        [Route("CombinazioneMeccanica/Update/{id}")]
        public async Task<IActionResult> CombinazioniMeccanicheUpdate(Int16 id, CombinazioniMeccaniche item)
        {
            var edit = exClass.getCombinazioneMeccanicaById(id);
            //var edit = await this.ctx.Meccaniches.FindAsync(id);
            if (edit != null)
            {
                edit.NomeCombinazione = (item.NomeCombinazione != null && item.NomeCombinazione != "" ? item.NomeCombinazione : edit.NomeCombinazione);
                edit.Formato = (item.Formato != null ? item.Formato.ToLower() : "1x1");
                try
                {
                    var formatoCheck = edit.Formato.ToLower();
                    var valoriFormato = formatoCheck.Split("x");
                    if (valoriFormato.Length == 2)
                    {
                        if (!(Int32.TryParse(valoriFormato[0], out int result) && Int32.TryParse(valoriFormato[1], out int result2)))
                        {
                            throw new Exception();
                        }
                    }
                    else
                    {
                        throw new Exception();
                    }
                }
                catch
                {
                    edit.Formato = "1x1";
                }
                exClass.editCombinazioneMeccanica(edit);
            }

            await this.Bind();

            return Redirect("../../DeclinazioniMeccaniche");
        }

        [HttpPost]
        [Route("DeclinazioniMeccanicheAvanzate/Update/{id}")]
        public async Task<IActionResult> MeccanicaAvanzataUpdate(Int16 id, DeclinazioneMeccanicaAvanzata item)
        {
            BoolResult res = new BoolResult();
            try
            {
                var edit = exClass.getDeclinazioneMeccanicaAvanzataById(id);
                //var edit = await this.ctx.Meccaniches.FindAsync(id);
                if (edit != null)
                {
                    edit.Nome = (item.Nome != null && item.Nome != "" ? item.Nome : edit.Nome);
                    edit.LivelloMeccanica = (item.LivelloMeccanica != 0 ? item.LivelloMeccanica : edit.LivelloMeccanica);
                    edit.Formato = (item.Formato != null ? item.Formato.ToLower() : "");
                    edit.LivelloEsternoMeccanicaAvanzata = (item.LivelloEsternoMeccanicaAvanzata != 0 ? item.LivelloEsternoMeccanicaAvanzata : edit.LivelloEsternoMeccanicaAvanzata);
                    if (edit.Formato != "")
                    {
                        try
                        {
                            var formatoCheck = edit.Formato.ToLower();
                            var valoriFormato = formatoCheck.Split("x");
                            if (valoriFormato.Length == 2)
                            {
                                if (!(Int32.TryParse(valoriFormato[0], out int result) && Int32.TryParse(valoriFormato[1], out int result2)))
                                {
                                    throw new Exception("Formato non corretto");
                                }
                            }
                            else
                            {
                                throw new Exception("Formato non corretto");
                            }
                        }
                        catch
                        {
                            edit.Formato = "";
                        }
                    }
                    edit.Regole = item.Regole != null ? item.Regole : edit.Regole;
                    exClass.editDeclinazioneMeccanicaAvanzata(edit);
                    //this.ctx.SaveChanges();
                }

                await this.Bind();
                res.Esito = true;
                return Ok(res);
            }
            catch (Exception ex)
            {
                res.Esito = false;
                res.error = ex.ToString();
                return Ok(res);
            }
            //return Redirect("../../DeclinazioniMeccaniche");
        }

        [HttpPost]
        [Route("RimozioneMeccanicheAvanzate/Update/{id}")]
        public async Task<IActionResult> RimozioneMeccanicaAvanzataUpdate(Int16 id, RimozioneDeclinazioneMeccanica item)
        {
            BoolResult res = new BoolResult();
            try
            {
                var edit = exClass.getRimozioneMeccanicaAvanzataById(id);
                //var edit = await this.ctx.Meccaniches.FindAsync(id);
                if (edit != null)
                {
                    edit.Nome = (item.Nome != null && item.Nome != "" ? item.Nome : edit.Nome);
                    edit.LivelloMeccanica = (item.LivelloMeccanica != 0 ? item.LivelloMeccanica : edit.LivelloMeccanica);
                    edit.LivelloEsternoMeccanicaAvanzata = (item.LivelloEsternoMeccanicaAvanzata != 0 ? item.LivelloEsternoMeccanicaAvanzata : edit.LivelloEsternoMeccanicaAvanzata);
                    edit.timeToApply = item.timeToApply != timeToApplyOperation.nonSpecificato ? item.timeToApply : edit.timeToApply;
                    edit.Regole = item.Regole != null ? item.Regole : edit.Regole;
                    exClass.editRimozioneMeccanicaAvanzata(edit);
                    //this.ctx.SaveChanges();
                }

                await this.Bind();
                res.Esito = true;
                return Ok(res);
            }
            catch (Exception ex)
            {
                res.Esito = false;
                res.error = ex.ToString();
                return Ok(res);
            }
            //return Redirect("../../DeclinazioniMeccaniche");
        }

        [HttpGet]
        [Route("DeclinazioniMeccaniche/Delete/{id}")]
        public async Task<IActionResult> Index(Int16 id)
        {
            BoolResult res = new BoolResult();
            try
            {
                //var item = await this.ctx.Meccaniches.FindAsync(id);
                var item = exClass.getDeclinazioneMeccanicaById(id);
                if (item != null)
                {
                    exClass.deleteDeclinazioneMeccanica(item);
                    //this.ctx.Meccaniches.Remove(item);
                    //this.ctx.SaveChanges();
                }
                res.Esito = true;
                return Ok(res);
            }
            catch (Exception ex)
            {
                res.error = ex.ToString();
                res.Esito = false;
                return Ok(res);
            }
        }

        [HttpGet]
        [Route("CombinazioneMeccanica/Delete/{id}")]
        public async Task<IActionResult> CombinazioniMeccanicheDelete(Int16 id)
        {
            var item = exClass.getCombinazioneMeccanicaById(id);
            if (item != null)
            {
                exClass.deleteCombinazioneMeccanica(item);
            }

            return Redirect("../../DeclinazioniMeccaniche");
        }

        [HttpGet]
        [Route("DeclinazioniMeccanicheAvanzate/Delete/{id}")]
        public async Task<IActionResult> MeccanicaAvanzataDelete(Int16 id)
        {
            BoolResult res = new BoolResult();
            try
            {
                //var item = await this.ctx.Meccaniches.FindAsync(id);
                var item = exClass.getDeclinazioneMeccanicaAvanzataById(id);
                if (item != null)
                {
                    exClass.deleteDeclinazioneMeccanicaAvanzata(item);
                    //this.ctx.Meccaniches.Remove(item);
                    //this.ctx.SaveChanges();
                }
                res.Esito = true;
                return Ok(res);
            }
            catch (Exception ex)
            {
                res.error = ex.ToString();
                res.Esito = false;
                return Ok(res);
            }

        }

        [HttpGet]
        [Route("RimozioneMeccanicheAvanzate/Delete/{id}")]
        public async Task<IActionResult> RimozioneMeccanicaAvanzataDelete(Int16 id)
        {
            BoolResult res = new BoolResult();
            try
            {
                //var item = await this.ctx.Meccaniches.FindAsync(id);
                var item = exClass.getRimozioneMeccanicaAvanzataById(id);
                if (item != null)
                {
                    exClass.deleteRimozioneMeccanicaAvanzata(item);
                    //this.ctx.Meccaniches.Remove(item);
                    //this.ctx.SaveChanges();
                }
                res.Esito = true;
                return Ok(res);
            }
            catch (Exception ex)
            {
                res.error = ex.ToString();
                res.Esito = false;
                return Ok(res);
            }

        }
        private async Task Bind()
        {
            var _list = exClass.getDeclinazioneMeccaniche();// await this.ctx.Meccaniches.ToListAsync();
            this.ViewBag.lista_declinazione_meccaniche = _list.source;
            this.ViewBag.lista_combinazioni_meccaniche = _list.combinazioniMeccaniche;
            this.ViewBag.lista_meccaniche_avanzate = _list.meccanicheAvanzate;
            this.ViewBag.lista_meccanicheInRimozione = _list.meccanicheInRimozione;
        }


        [HttpGet]
        [Route("DeclinazioniMeccaniche/scaricaDeclinazioniMeccaniche")]
        public async Task<IActionResult> scaricaDeclinazioniMeccaniche()
        {
            var _list = exClass.getDeclinazioneMeccaniche();// await this.ctx.Meccaniches.ToListAsync();
            return Ok(_list);

        }

        [HttpPut]
        [Route("DeclinazioniMeccaniche/salvaSourceJsonCode")]
        public async Task<IActionResult> salvaSourceJsonCode([FromBody] SourceJsonRequest request)
        {
            BoolResult bRes = new BoolResult();

            bRes = Utility.SingletonConfiguration.DbDeclinazioniMeccaniche!.SetJsonSource(request.jsoncode);

            return Ok(bRes);
        }

    }
}
