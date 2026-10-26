using Istanta.Models;
using Istanta.Utility;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Newtonsoft.Json;

namespace Istanta.Controllers
{


    public class FrameworkCssController : Controller
    {
        private readonly ILogger<FrameworkCssController> _logger;
        private readonly edro21_dbContext ctx;
        private readonly string extarnalSourcePath;
        private ExternalSourceClass exClass;
        private readonly IDbContextFactory<edro21_dbContext> _dbContextFactory;
        public FrameworkCssController(ILogger<FrameworkCssController> logger, IConfiguration configuration, IOptions<PathExternal> external_lib, IDbContextFactory<edro21_dbContext> dbContextFactory)
        {
            this._dbContextFactory = dbContextFactory;
            this.ctx = this._dbContextFactory.CreateDbContext();// new edro21_dbContext(configuration.GetConnectionString("IstandaConnectionDb")!);
            _logger = logger;
            this.extarnalSourcePath = external_lib.Value.pathSource;
            exClass = new ExternalSourceClass(this.extarnalSourcePath);
        }

        public async Task<IActionResult> Index()
        {
            await this.Bind();


            return View();
        }

        public async Task<IActionResult> MappaStili()
        {

            return View("MappaStili");
        }

        public async Task<IActionResult> AllineamentiBox()
        {

            return View("AllineamentiBox");
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


        [HttpGet]
        [Route("FrameworkCssController/AddLivello/{ordine}")]
        public async Task<IActionResult> AddLivello(int ordine)
        {
            BoolResult res = new BoolResult();
            try
            {
                livelloCssFramework liv = new livelloCssFramework();
                liv.ordine = ordine;
                var operazione = exClass.addLivello(liv);
                if (operazione.Esito)
                {
                    res.Esito = true;
                    return Ok(res);
                }
                else
                {
                    throw new Exception(operazione.error);
                }
            }
            catch (Exception ex)
            {
                res.error = ex.ToString();
                res.Esito = false;
                return Ok(res);
            }
        }

        [HttpGet]
        [Route("FrameworkCssController/EditOrdineLivello/{idLiv}/{nuovoOrdine}")]
        public async Task<IActionResult> EditOrdineLivello(int idLiv, int nuovoOrdine)
        {
            BoolResult res = new BoolResult();
            try
            {
                var operazione = exClass.editOrdineLivello(idLiv, nuovoOrdine);
                if (operazione.Esito)
                {
                    res.Esito = true;
                    return Ok(res);
                }
                else
                {
                    throw new Exception(operazione.error);
                }
            }
            catch (Exception ex)
            {
                res.error = ex.ToString();
                res.Esito = false;
                return Ok(res);
            }
        }

        [HttpPost]
        [Route("FrameworkCssController/AddDefinizione/{idLiv}")]
        public async Task<IActionResult> AddDefinizione(int idLiv, DefinizioniCssFramework def)
        {
            BoolResult res = new BoolResult();
            try
            {
                if (def.result == null || def.result == "")
                {
                    throw new Exception("Nome non assegnato alla definizione");
                }
                var operazione = exClass.addDefinizioneCssFramework(def, idLiv);
                if (operazione.Esito)
                {
                    res.Esito = true;
                    return Ok(res);
                }
                else
                {
                    throw new Exception(operazione.error);
                }
            }
            catch (Exception ex)
            {
                res.error = ex.ToString();
                res.Esito = false;
                return Ok(res);
            }
        }

        [HttpPut]
        [Route("FrameworkCssController/UpdateDefinizione")]
        public async Task<IActionResult> UpdateDefinizione(DefinizioniCssFramework def /*Int16 idDef, int ordine, string nome, string descrizione = ""*/)
        {
            BoolResult res = new BoolResult();
            try
            {
                if (def.descrizione == "null")
                {
                    def.descrizione = "";
                }
                var operazione = exClass.editOrdineDefinizioni(def.id, def.ordine);
                if (operazione.Esito)
                {
                }
                else
                {
                    throw new Exception(operazione.error);
                }

                if (def.result != null && def.result != "")
                {
                    operazione = exClass.editNomeDefinizioni(def.id, def.result);
                    if (operazione.Esito)
                    {
                    }
                    else
                    {
                        throw new Exception(operazione.error);
                    }
                }


                operazione = exClass.editDescrizioneDefinizioni(def.id, def.descrizione);
                if (operazione.Esito)
                {
                    res.Esito = true;
                    return Ok(res);
                }
                else
                {
                    throw new Exception(operazione.error);
                }

            }
            catch (Exception ex)
            {
                res.error = ex.ToString();
                res.Esito = false;
                return Ok(res);
            }
            //return Redirect("../../Etichette");
        }

        [HttpPost]
        [Route("FrameworkCssController/UpdateRegoleDefinizione/{percorso}")]
        public async Task<IActionResult> UpdateRegoleDefinizione(DefinizioniCssFramework item, string percorso)
        {
            BoolResult res = new BoolResult();
            try
            {
                if(percorso == "0")
                {
                    percorso = "";
                }
                var operazione = exClass.editRegoleDefinizione(item.regole, item.id, percorso);
                this.ctx.SaveChanges();

                if (operazione.Esito)
                {
                    res.Esito = true;
                    return Ok(res);
                }
                else
                {
                    throw new Exception(operazione.error);
                }
            
            }
            catch (Exception ex)
            {
                res.error = ex.ToString();
                res.Esito = false;
                return Ok(res);
            }
        }

        [HttpGet]
        [Route("FrameworkCssController/DeleteLivello/{idLivello}")]
        public async Task<IActionResult> DeleteLivello(int idLivello)
        {
            BoolResult res = new BoolResult();
            try
            {
                var operazione = exClass.deleteLivello(idLivello);
                if (operazione.Esito)
                {
                    res.Esito = true;
                    return Ok(res);
                }
                else
                {
                    throw new Exception(operazione.error);
                }
            }
            catch (Exception ex)
            {
                res.error = ex.ToString();
                res.Esito = false;
                return Ok(res);
            }
        }

        [HttpGet]
        [Route("FrameworkCssController/DeleteDefenizione/{idDefinizione}")]
        public async Task<IActionResult> DeleteDefenizione(Int16 idDefinizione)
        {
            BoolResult res = new BoolResult();
            try
            {
                var operazione = exClass.deleteDefinizioneById(idDefinizione);
                if (operazione.Esito)
                {
                    res.Esito = true;
                    return Ok(res);
                }
                else
                {
                    throw new Exception(operazione.error);
                }
            }
            catch (Exception ex)
            {
                res.error = ex.ToString();
                res.Esito = false;
                return Ok(res);
            }
        }



        [HttpGet]
        [Route("FrameworkCssController/scaricaFramework")]
        public async Task<IActionResult> scaricaFramework()
        {
            var _list = exClass.getFrameworkCss();// await this.ctx.Meccaniches.ToListAsync();
            return Ok(_list);

        }

        [HttpGet]
        [Route("FrameworkCssController/scaricaAllineamenti")]
        public async Task<IActionResult> scaricaAllineamenti()
        {
            var _list = exClass.getDbAllineamentiSource();// await this.ctx.Meccaniches.ToListAsync();
            return Ok(_list);

        }



        private async Task Bind()
        {
            var _list = exClass.getFrameworkCss();// await this.ctx.Meccaniches.ToListAsync();
            this.ViewBag.lista_livelli = _list.livelli;
            this.ViewBag.defaultBox = _list.defaultBox;
        }

        //[HttpPut]
        //[Route("FrameworkCssController/salvaSourceJsonCode")]
        //public async Task<IActionResult> salvaSourceJsonCode([FromBody] SourceJsonRequest request)
        //{
        //    BoolResult bRes = new BoolResult();

        //    if (request != null)
        //    {
        //        bRes = SingletonConfiguration.DBFrameworkCss.SetJsonSource(request.jsoncode);
        //    }
        //    else
        //    {
        //        bRes.error = "Parametro null";
        //    }



        //    return Ok(bRes);
        //}

        [HttpPut]
        [Route("FrameworkCssController/salvaSourceJsonCode")]
        public async Task<IActionResult> salvaSourceJsonCode([FromBody] SourceJsonRequest request)
        {
            var bRes = new BoolResult();
            if (request != null)
            {
                bRes = SingletonConfiguration.DBFrameworkCss!.SetJsonSource(request.jsoncode);
            }
            else
            {
                bRes.Esito = false;
                bRes.error = "Parametro null";
            }
            return Ok(bRes);
        }

        [HttpPut]
        [Route("MappaStili/salvaSourceJsonCode")]
        public async Task<IActionResult> salvaSourceJsonCodeForMappaStile([FromBody] SourceJsonRequest request)
        {
            BoolResult bRes = new BoolResult();

            if (request != null)
            {
                bRes = SingletonConfiguration.DBMappaStili!.SetJsonSource(request.jsoncode);
            }
            else
            {
                bRes.error = "Parametro null";
            }



            return Ok(bRes);
        }

        //[HttpPut]
        //[Route("Allineamenti/salvaSourceJsonCode")]
        //public async Task<IActionResult> salvaSourceJsonCodeForAllineamenti([FromBody] SourceJsonRequest request)
        //{
        //    BoolResult bRes = new BoolResult();

        //    if (request != null)
        //    {
        //        bRes = SingletonConfiguration.DbAllineamenti.SetJsonSource(request.jsoncode);
        //    }
        //    else
        //    {
        //        bRes.error = "Parametro null";
        //    }



        //    return Ok(bRes);
        //}



    }
}
