using Microsoft.AspNetCore.Mvc;
using Istanta.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Conventions;
using System.Collections.Generic;
using Newtonsoft.Json;
using Microsoft.Extensions.Options;
using Istanta.MiddleWare;
using DocumentFormat.OpenXml.Spreadsheet;
using System.Text;
using IstantaLib;
using Istanta.Utility;

namespace Istanta.Controllers
{
    public class AreeController : Controller
    {
        private readonly ILogger<AreeController> _logger;
        private readonly edro21_dbContext ctx;
        private readonly string extarnalSourcePath;
        private ExternalSourceClass exClass;
        private readonly string olUrl;
        private readonly string fpUrl;
        private readonly OlympusUserPolicyRequest[] olympusUserPolycy;
        private readonly string secretKey;
        private readonly HttpClient httpClient;
        private readonly LogAssistent logAssistent;
        private readonly IDbContextFactory<edro21_dbContext> _dbContextFactory;
        public AreeController(ILogger<AreeController> logger, IConfiguration configuration, IOptions<PathExternal> external_lib, IOptions<FicoConfig> ficoConf, IHttpClientFactory httpClientFactory, IDbContextFactory<edro21_dbContext> dbContextFactory)
        {
            this._dbContextFactory = dbContextFactory;
            this.ctx = this._dbContextFactory.CreateDbContext(); //new edro21_dbContext(configuration.GetConnectionString("IstandaConnectionDb")!);
            _logger = logger;
            this.extarnalSourcePath = external_lib.Value.pathSource;
            exClass = new ExternalSourceClass(this.extarnalSourcePath);

            olUrl = ficoConf.Value.olympusServerUrl;
            fpUrl= ficoConf.Value.fpServerUrl;
            olympusUserPolycy = ficoConf.Value.userDataPolicy!;
            secretKey = ficoConf.Value.secretKey;

            httpClient=httpClientFactory.CreateClient();

            logAssistent = new LogAssistent();

        }

        public async Task<IActionResult> Index()
        {
            //this.ViewBag.error = "Interfaccia non implementata";

            return View();
        }

        [HttpPost]
        public async Task<IActionResult> Index(Aree newItem)
        {
            
            //var _new = await this.ctx.Arees.Where(m => m.GruppoSiti == newItem.GruppoSiti).FirstOrDefaultAsync();
            var _new = exClass.getAreaByCombinazioneAreaCanale(newItem.Area, newItem.Canale);
            if (_new != null)
            {
                this.ViewBag.error = "Area già esistente";
                await this.Bind();
                return View();
            }

            Aree mNew = new Aree();
            mNew.Canale = newItem.Canale;
            mNew.Area = newItem.Area;
            mNew.GruppoSiti = newItem.GruppoSiti;
            exClass.addArea(mNew);
            //this.ctx.Arees.Add(mNew);
            //this.ctx.SaveChanges();
            

            await this.Bind();

            return Redirect("Aree");
        }


        [HttpPost]
        [Route("Aree/Update/{id}")]
        public async Task<IActionResult> Index(Int16 id, Aree item)
        {

            //var edit = await this.ctx.Arees.FindAsync(id);
            var edit = exClass.getAreaById(id);
            if (edit != null)
            {
                edit.Canale = item.Canale;
                edit.Area = item.Area;
                edit.GruppoSiti = item.GruppoSiti;
                //this.ctx.SaveChanges();
                exClass.editArea(edit);
            }
            

            await this.Bind();

            return Redirect("../../Aree");
        }


        [HttpPost]
        [Route("Aree/Setting")]
        public async Task<IActionResult> Index(Int32 sett, string SettingLazio, string SettingBoxetto, string SettingSirSconto, string SettingTitoloPOP)
        {
            var _sett = await this.ctx.Settings.ToListAsync();
            _sett.Where(w => w.Codice == "aree_boxetto").FirstOrDefault()!.Valore = SettingBoxetto;
            _sett.Where(w => w.Codice == "aree_sirsconto").FirstOrDefault()!.Valore = SettingSirSconto;
            _sett.Where(w => w.Codice == "aree_titoloPOP_xml").FirstOrDefault()!.Valore = SettingTitoloPOP;
            _sett.Where(w => w.Codice == "aree_lazio").FirstOrDefault()!.Valore = SettingLazio;

            this.ctx.SaveChanges();

            await this.Bind();

            return Redirect("../Aree");
        }


        [HttpGet]
        [Route("Aree/Delete/{id}")]
        public async Task<IActionResult> Index(Int16 id)
        {

            //var item = await this.ctx.Arees.FindAsync(id);
            var item = exClass.getAreaById(id);//await this.ctx.Arees.FindAsync(id);
            if (item != null)
            {
                exClass.deleteArea(item);
                //this.ctx.Arees.Remove(item);
                //this.ctx.SaveChanges();
            }

            return Redirect("../../Aree");
        }

        private async Task Bind()
        {
            var _list = exClass.getAree();// await this.ctx.Arees.OrderBy(o=>o.IndiceCombo).ToListAsync();
            this.ViewBag.lista = _list.source;

            //Scrittura AreaSource.json

            /*string jsonStr = JsonConvert.SerializeObject(_list); 
            using (StreamWriter sw=new StreamWriter("E:\\Dropbox\\Progetti\\Edro21\\Istanta\\Istanta\\Istanta\\wwwroot\\external_lib\\SourceArea.json"))
            {
                sw.WriteLine(jsonStr);
            }*/



            /*
            List<Setting> _sett = await this.ctx.Settings.ToListAsync();
            this.ViewBag.SettBoxetto = _sett.Where(w => w.Codice == "aree_boxetto").FirstOrDefault()!.Valore;
            this.ViewBag.SettSirSconto = _sett.Where(w => w.Codice == "aree_sirsconto").FirstOrDefault()!.Valore;
            this.ViewBag.SettPoP = _sett.Where(w => w.Codice == "aree_titoloPOP_xml").FirstOrDefault()!.Valore;
            this.ViewBag.SettLazio = _sett.Where(w => w.Codice == "aree_lazio").FirstOrDefault()!.Valore;*/

        }

        #region integrazione verso Olympus
        private async Task<FICOAccessLevel> getAccesslevel()
        {
            string session = SessionIstantaObject.GetSession(HttpContext);

            if (session != "no session")
            {
                Int16 id_utente = Convert.ToInt16(session);
                Utenti?  utente = await this.ctx.Utentis.FindAsync(id_utente);
                //if (utente!.Stato == (Byte)statoUtente.FicoGuestAttivo || utente!.Stato == (Byte)statoUtente.FicoGuestDisttivo)
                //{
                //    return FICOAccessLevel.guestFico;
                //}else
                //{
                    return FICOAccessLevel.adminLocal;
                //}
            }
            else
            {
                return FICOAccessLevel.noSession;
            }
        }

        [HttpGet]
        [Route("ACPV/getAree")]
        public async Task<IActionResult> getAree()
        {            
            return Ok(SingletonConfiguration.DBACPV!.aree);
        }


        [HttpGet]
        [Route("ACPV/getCanali")]
        public async Task<IActionResult> getCanali()
        {
            return Ok(SingletonConfiguration.DBACPV!.canali);
        }

        [HttpPut]
        [Route("ACPV/salvaCanale")]
        public async Task<IActionResult> salvaCanale([FromBody] Canale obj)
        {
            BoolResult bRes = new BoolResult();

            FICOAccessLevel acLevel = await getAccesslevel();


            if (acLevel!=FICOAccessLevel.noSession)
            {

                //if (acLevel == FICOAccessLevel.guestFico)
                //{
                    //La chiamata arriva da circuito FICO.
                    //Esego l'azione
                    try
                    {
                        salvaCanaleAction(obj);
                        bRes.Esito = true;
                    }
                    catch (Exception ex)
                    {
                        bRes.error = ex.Message;
                        bRes.Esito = false;
                        return BadRequest(bRes);
                    }

                //}
                //else if (acLevel == FICOAccessLevel.adminLocal)
                //{
                //    //La chiamata è fatta localmente
                //    Int16 session = Int16.Parse(SessionIstantaObject.GetSession(HttpContext));
                //    Utenti? me = this.ctx.Utentis.Where(w => w.Id == session).FirstOrDefault();
                //    FICOLoginResponse? loginFico = await FICOMiddleware.login(olUrl, me!, secretKey, olympusUserPolycy, this.ctx, httpClient);
                //    if (loginFico.esito)
                //    {
                //        if (obj.guidID==null || obj.guidID=="")
                //            obj.guidID = Guid.NewGuid().ToString();

                //        ACPVFicoOperationResult result = await doActionOnFP(loginFico!.publicKey!, "salvaCanale", new StringContent(JsonConvert.SerializeObject(obj), Encoding.UTF8, "application/json"));
                //        if (result.esito)
                //        {
                //            try
                //            {
                //                salvaCanaleAction(obj);
                //                bRes.Esito = true;
                //            }
                //            catch (Exception ex)
                //            {
                //                bRes.error = ex.Message;
                //                bRes.Esito = false;
                //                return BadRequest(bRes);
                //            }
                //        }
                //        else
                //        {
                //            throw new Exception("Errore generato da salvaCanale su FP: " + result.error);
                //        }
                //    }
                //    else
                //    {
                //        throw new Exception("Errore di login verso Olympus: " + loginFico.error);
                //    }
                //}
            }
            else
            {
                bRes.error = "no_login";
                bRes.Esito = false;
                return Unauthorized(bRes);
            }


            return Ok(bRes);
        }

        [HttpDelete]
        [Route("ACPV/eliminaCanale/{guidID}")]
        public async Task<IActionResult> eliminaCanale(string guidID)
        {
            BoolResult bRes = new BoolResult();

            FICOAccessLevel acLevel = await getAccesslevel();


            if (acLevel != FICOAccessLevel.noSession)
            {

                //if (acLevel == FICOAccessLevel.guestFico)
                //{
                    //La chiamata arriva da circuito FICO.
                    //Esego l'azione
                    try
                    {
                        eliminaCanaleAction(guidID);
                        bRes.Esito = true;
                    }
                    catch (Exception ex)
                    {
                        bRes.error = ex.Message;
                        bRes.Esito = false;
                        return BadRequest(bRes);
                    }

                //}
                //else if (acLevel == FICOAccessLevel.adminLocal)
                //{
                //    //La chiamata è fatta localmente
                //    Int16 session = Int16.Parse(SessionIstantaObject.GetSession(HttpContext));
                //    Utenti? me = this.ctx.Utentis.Where(w => w.Id == session).FirstOrDefault();
                //    FICOLoginResponse loginFico = await FICOMiddleware.login(olUrl, me!, secretKey, olympusUserPolycy, this.ctx, httpClient);
                //    if (loginFico.esito)
                //    {

                //        ACPVFicoOperationResult result = await doActionOnFP(loginFico!.publicKey!, "eliminaCanale/"+guidID);
                //        if (result.esito)
                //        {
                //            try
                //            {
                //                eliminaCanaleAction(guidID);
                //                bRes.Esito = true;
                //            }
                //            catch (Exception ex)
                //            {
                //                bRes.error = ex.Message;
                //                bRes.Esito = false;
                //                return BadRequest(bRes);
                //            }
                //        }
                //        else
                //        {
                //            throw new Exception("Errore generato da eliminaCanale su FP: " + result.error);
                //        }
                //    }
                //    else
                //    {
                //        throw new Exception("Errore di login verso Olympus: " + loginFico.error);
                //    }
                //}
            }
            else
            {
                bRes.error = "no_login";
                bRes.Esito = false;
                return Unauthorized(bRes);
            }


            return Ok(bRes);
        }

        [HttpPut]
        [Route("ACPV/salvaArea")]
        public async Task<IActionResult> salvaArea([FromBody] Area obj)
        {
            BoolResult bRes = new BoolResult();

            FICOAccessLevel acLevel = await getAccesslevel();

            logAssistent.WriteLine($"ACPV.salvaArea step1");

            if (acLevel != FICOAccessLevel.noSession)
            {

                //if (acLevel == FICOAccessLevel.guestFico)
                //{
                    //La chiamata arriva da circuito FICO.
                    //Esego l'azione

                    logAssistent.WriteLine($"ACPV.salvaArea step2");

                    try
                    {
                        if (obj.guidID==null)
                            throw new Exception("Il campo guidID non può essere vuoto");

                        salvaAreaAction(obj);
                        bRes.Esito = true;
                    }
                    catch (Exception ex)
                    {
                        logAssistent.WriteLine($"ACPV.salvaArea errro1:{ex.ToString()}");

                        bRes.error = ex.Message;
                        bRes.Esito = false;
                        return BadRequest(bRes);
                    }

                //}
                //else if (acLevel == FICOAccessLevel.adminLocal)
                //{
                //    //La chiamata è fatta localmente
                //    Int16 session = Int16.Parse(SessionIstantaObject.GetSession(HttpContext));
                //    Utenti? me = this.ctx.Utentis.Where(w => w.Id == session).FirstOrDefault();
                //    FICOLoginResponse loginFico = await FICOMiddleware.login(olUrl, me!, secretKey, olympusUserPolycy, this.ctx, httpClient);
                //    if (loginFico.esito)
                //    {
                //        if (obj.guidID == null || obj.guidID == "")
                //            obj.guidID = Guid.NewGuid().ToString();

                //        ACPVFicoOperationResult result = await doActionOnFP(loginFico!.publicKey!, "salvaArea", new StringContent(JsonConvert.SerializeObject(obj), Encoding.UTF8, "application/json"));
                //        if (result.esito)
                //        {
                //            try
                //            {
                //                salvaAreaAction(obj);
                //                bRes.Esito = true;
                //            }
                //            catch (Exception ex)
                //            {
                //                bRes.error = ex.Message;
                //                bRes.Esito = false;
                //                return BadRequest(bRes);
                //            }
                //        }
                //        else
                //        {
                //            throw new Exception("Errore generato da salvaArea su FP: " + result.error);
                //        }
                //    }

                //}
            }
            else
            {
                logAssistent.WriteLine($"ACPV.salvaArea no login");

                bRes.error = "no_login";
                bRes.Esito = false;
                return Unauthorized(bRes);
            }


            return Ok(bRes);
        }

        [HttpDelete]
        [Route("ACPV/eliminaArea/{guidID}")]
        public async Task<IActionResult> eliminaArea(string guidID)
        {
            BoolResult bRes = new BoolResult();

            FICOAccessLevel acLevel = await getAccesslevel();


            if (acLevel != FICOAccessLevel.noSession)
            {

                //if (acLevel == FICOAccessLevel.guestFico)
                //{
                    //La chiamata arriva da circuito FICO.
                    //Esego l'azione
                    try
                    {
                        eliminaAreaAction(guidID);
                        bRes.Esito = true;
                    }
                    catch (Exception ex)
                    {
                        bRes.error = ex.Message;
                        bRes.Esito = false;
                        return BadRequest(bRes);
                    }

                //}
                //else if (acLevel == FICOAccessLevel.adminLocal)
                //{
                //    //La chiamata è fatta localmente
                //    Int16 session = Int16.Parse(SessionIstantaObject.GetSession(HttpContext));
                //    Utenti? me = this.ctx.Utentis.Where(w => w.Id == session).FirstOrDefault();
                //    FICOLoginResponse loginFico = await FICOMiddleware.login(olUrl, me!, secretKey, olympusUserPolycy, this.ctx, httpClient);
                //    if (loginFico.esito)
                //    {

                //        ACPVFicoOperationResult result = await doActionOnFP(loginFico!.publicKey!, "eliminaArea/" + guidID);
                //        if (result.esito)
                //        {
                //            try
                //            {
                //                eliminaAreaAction(guidID);
                //                bRes.Esito = true;
                //            }
                //            catch (Exception ex)
                //            {
                //                bRes.error = ex.Message;
                //                bRes.Esito = false;
                //                return BadRequest(bRes);
                //            }
                //        }
                //        else
                //        {
                //            throw new Exception("Errore generato da eliminaArea su FP: " + result.error);
                //        }
                //    }
                //    else
                //    {
                //        throw new Exception("Errore di login verso Olympus: " + loginFico.error);
                //    }
                //}
            }
            else
            {
                bRes.error = "no_login";
                bRes.Esito = false;
                return Unauthorized(bRes);
            }


            return Ok(bRes);
        }

        [HttpPut]
        [Route("ACPV/setCombinazione")]
        public async Task<IActionResult> setCombinazione([FromBody] CombinazioneAreaCanale obj)
        {
            BoolResult bRes = new BoolResult();

            FICOAccessLevel acLevel = await getAccesslevel();


            if (acLevel != FICOAccessLevel.noSession)
            {

                //if (acLevel == FICOAccessLevel.guestFico)
                //{
                    //La chiamata arriva da circuito FICO.
                    //Esego l'azione
                    try
                    {
                        salvaCombinazioneAction(obj);
                        bRes.Esito = true;
                    }
                    catch (Exception ex)
                    {
                        bRes.error = ex.Message;
                        bRes.Esito = false;
                        return BadRequest(bRes);
                    }

                //}
                //else if (acLevel == FICOAccessLevel.adminLocal)
                //{
                //    //La chiamata è fatta localmente
                //    Int16 session = Int16.Parse(SessionIstantaObject.GetSession(HttpContext));
                //    Utenti? me = this.ctx.Utentis.Where(w => w.Id == session).FirstOrDefault();
                //    FICOLoginResponse loginFico = await FICOMiddleware.login(olUrl, me!, secretKey, olympusUserPolycy, this.ctx, httpClient);
                //    if (loginFico.esito)
                //    {
                //        if (obj.guidID == null || obj.guidID == "")
                //            obj.guidID = Guid.NewGuid().ToString();

                //        ACPVFicoOperationResult result = await doActionOnFP(loginFico.publicKey!, "setCombinazione", new StringContent(JsonConvert.SerializeObject(obj), Encoding.UTF8, "application/json"));
                //        if (result.esito)
                //        {
                //            try
                //            {
                //                salvaCombinazioneAction(obj);
                //                bRes.Esito = true;
                //            }
                //            catch (Exception ex)
                //            {
                //                bRes.error = ex.Message;
                //                bRes.Esito = false;
                //                return BadRequest(bRes);
                //            }
                //        }
                //        else
                //        {
                //            throw new Exception("Errore generato da setCombinazione su FP: " + result.error);
                //        }
                //    }
                //}
            }
            else
            {
                bRes.error = "no_login";
                bRes.Esito = false;
                return Unauthorized(bRes);
            }


            return Ok(bRes);
        }

        [HttpDelete]
        [Route("ACPV/eliminaCombinazione/{guidID}")]
        public async Task<IActionResult> eliminaCombinazione(string guidID)
        {
            BoolResult bRes = new BoolResult();

            FICOAccessLevel acLevel = await getAccesslevel();


            if (acLevel != FICOAccessLevel.noSession)
            {

                //if (acLevel == FICOAccessLevel.guestFico)
                //{
                    //La chiamata arriva da circuito FICO.
                    //Esego l'azione
                    try
                    {
                        eliminaCombinazioneAction(guidID);
                        bRes.Esito = true;
                    }
                    catch (Exception ex)
                    {
                        bRes.error = ex.Message;
                        bRes.Esito = false;
                        return BadRequest(bRes);
                    }

                //}
                //else if (acLevel == FICOAccessLevel.adminLocal)
                //{
                //    //La chiamata è fatta localmente
                //    Int16 session = Int16.Parse(SessionIstantaObject.GetSession(HttpContext));
                //    Utenti? me = this.ctx.Utentis.Where(w => w.Id == session).FirstOrDefault();
                //    FICOLoginResponse loginFico = await FICOMiddleware.login(olUrl, me!, secretKey, olympusUserPolycy, this.ctx, httpClient);
                //    if (loginFico.esito)
                //    {

                //        ACPVFicoOperationResult result = await doActionOnFP(loginFico.publicKey!, "eliminaCombinazione/" + guidID);
                //        if (result.esito)
                //        {
                //            try
                //            {
                //                _=eliminaCombinazione(guidID);
                //                bRes.Esito = true;
                //            }
                //            catch (Exception ex)
                //            {
                //                bRes.error = ex.Message;
                //                bRes.Esito = false;
                //                return BadRequest(bRes);
                //            }
                //        }
                //        else
                //        {
                //            throw new Exception("Errore generato da eliminaCombinazione su FP: " + result.error);
                //        }
                //    }
                //    else
                //    {
                //        throw new Exception("Errore di login verso Olympus: " + loginFico.error);
                //    }
                //}
            }
            else
            {
                bRes.error = "no_login";
                bRes.Esito = false;
                return Unauthorized(bRes);
            }


            return Ok(bRes);
        }

        [HttpPut]
        [Route("ACPV/salvaPV")]
        public async Task<IActionResult> salvaPV([FromBody] PV obj)
        {
            BoolResult bRes = new BoolResult();

            FICOAccessLevel acLevel = await getAccesslevel();


            if (acLevel != FICOAccessLevel.noSession)
            {

                //if (acLevel == FICOAccessLevel.guestFico)
                //{
                    //La chiamata arriva da circuito FICO.
                    //Esego l'azione
                    try
                    {
                        salvaPVAction(obj);
                        bRes.Esito = true;
                    }
                    catch (Exception ex)
                    {
                        bRes.error = ex.Message;
                        bRes.Esito = false;
                        return BadRequest(bRes);
                    }

                //}
                //else if (acLevel == FICOAccessLevel.adminLocal)
                //{
                //    //La chiamata è fatta localmente
                //    Int16 session = Int16.Parse(SessionIstantaObject.GetSession(HttpContext));
                //    Utenti? me = this.ctx.Utentis.Where(w => w.Id == session).FirstOrDefault();
                //    FICOLoginResponse loginFico = await FICOMiddleware.login(olUrl, me!, secretKey, olympusUserPolycy, this.ctx, httpClient);
                //    if (loginFico.esito)
                //    {
                //        if (obj.guidID == null || obj.guidID == "")
                //            obj.guidID = Guid.NewGuid().ToString();

                //        ACPVFicoOperationResult result = await doActionOnFP(loginFico.publicKey!, "salvaPV", new StringContent(JsonConvert.SerializeObject(obj), Encoding.UTF8, "application/json"));
                //        if (result.esito)
                //        {
                //            try
                //            {
                //                salvaPVAction(obj);
                //                bRes.Esito = true;
                //            }
                //            catch (Exception ex)
                //            {
                //                bRes.error = ex.Message;
                //                bRes.Esito = false;
                //                return BadRequest(bRes);
                //            }
                //        }
                //        else
                //        {
                //            throw new Exception("Errore generato da salvaPV su FP: " + result.error);
                //        }
                //    }
                //}
            }
            else
            {
                bRes.error = "no_login";
                bRes.Esito = false;
                return Unauthorized(bRes);
            }


            return Ok(bRes);
        }

        [HttpDelete]
        [Route("ACPV/eliminaPV/{guidID}")]
        public async Task<IActionResult> eliminaPV(string guidID)
        {
            BoolResult bRes = new BoolResult();

            FICOAccessLevel acLevel = await getAccesslevel();


            if (acLevel != FICOAccessLevel.noSession)
            {

                //if (acLevel == FICOAccessLevel.guestFico)
                //{
                    //La chiamata arriva da circuito FICO.
                    //Esego l'azione
                    try
                    {
                        eliminaPVAction(guidID);
                        bRes.Esito = true;
                    }
                    catch (Exception ex)
                    {
                        bRes.error = ex.Message;
                        bRes.Esito = false;
                        return BadRequest(bRes);
                    }

                //}
                //else if (acLevel == FICOAccessLevel.adminLocal)
                //{
                //    //La chiamata è fatta localmente
                //    Int16 session = Int16.Parse(SessionIstantaObject.GetSession(HttpContext));
                //    Utenti? me = this.ctx.Utentis.Where(w => w.Id == session).FirstOrDefault();
                //    FICOLoginResponse loginFico = await FICOMiddleware.login(olUrl, me!, secretKey, olympusUserPolycy, this.ctx, httpClient);
                //    if (loginFico.esito)
                //    {

                //        ACPVFicoOperationResult result = await doActionOnFP(loginFico.publicKey!, "eliminaPV/" + guidID);
                //        if (result.esito)
                //        {
                //            try
                //            {
                //                eliminaPVAction(guidID);
                //                bRes.Esito = true;
                //            }
                //            catch (Exception ex)
                //            {
                //                bRes.error = ex.Message;
                //                bRes.Esito = false;
                //                return BadRequest(bRes);
                //            }
                //        }
                //        else
                //        {
                //            throw new Exception("Errore generato da eliminaPV su FP: " + result.error);
                //        }
                //    }
                //    else
                //    {
                //        throw new Exception("Errore di login verso Olympus: " + loginFico.error);
                //    }
                //}
            }
            else
            {
                bRes.error = "no_login";
                bRes.Esito = false;
                return Unauthorized(bRes);
            }


            return Ok(bRes);
        }

        bool salvaCanaleAction(Canale obj)
        {
            DbACPV db = exClass.getACPV();
            db.SetExternalPath(extarnalSourcePath);

            Canale? cn = db.canali.Where(dbCanale => dbCanale.guidID == obj.guidID).FirstOrDefault();
            if (cn==null)
            {
                cn = new Canale();
                cn.guidID = obj.guidID;
                cn.nome = obj.nome;
                cn.sigla= obj.sigla;
                db.canali.Add(cn);
            }
            else
            {
                cn.nome= obj.nome;
                cn.sigla = obj.sigla;
            }
            
            SingletonConfiguration.DBACPV!.canali = db.canali;

            db.SaveChanges();

            return true;
        }
        bool eliminaCanaleAction(string guidID)
        {
            DbACPV db = exClass.getACPV();
            db.SetExternalPath(extarnalSourcePath);

            //Controllo se esiste almeno una combinazione con il guidID Canale
            if (db.combinazioni.Count(dbCombinazione => dbCombinazione.guidIDCanale == guidID)>0)
            {
                throw new Exception("Impossibile eliminare il canale, esistono combinazioni ad esso collegate");
            }
            
            int nDeleted = db.canali.RemoveAll(dbCanale => dbCanale.guidID == guidID);
            if (nDeleted>0)
            {
                SingletonConfiguration.DBACPV!.canali = db.canali;
                db.SaveChanges();
            }
            else
            {
                throw new Exception("Nessun canale corrisponde al guid " + guidID);
            }


            return true;
        }

        bool salvaAreaAction(Area obj)
        {
            logAssistent.WriteLine($"ACPV.salvaAreaAction step 1");
            DbACPV db = exClass.getACPV();
            db.SetExternalPath(extarnalSourcePath);

            logAssistent.WriteLine($"ACPV.salvaAreaAction step 2");

            logAssistent.WriteLine($"ACPV.salvaAreaAction cerco guid {obj.guidID}");

            Area? ar = db.aree.Where(dbArea => dbArea.guidID == obj.guidID).FirstOrDefault();
            if (ar == null)
            {
                logAssistent.WriteLine($"ACPV.salvaAreaAction creo nuova {obj.guidID},{obj.nome},{obj.sigla}");

                ar = new Area();
                ar.guidID = obj.guidID;
                ar.nome = obj.nome;
                ar.sigla = obj.sigla;
                db.aree.Add(ar);
            }
            else
            {
                ar.nome = obj.nome;
                ar.sigla = obj.sigla;
            }
            SingletonConfiguration.DBACPV!.aree = db.aree;
            db.SaveChanges();

            return true;
        }

        bool eliminaAreaAction(string guidID)
        {
            DbACPV db = exClass.getACPV();
            db.SetExternalPath(extarnalSourcePath);

            //Controllo se esiste almeno una combinazione con il guidID Canale
            if (db.combinazioni.Count(dbCombinazione => dbCombinazione.guidIDArea == guidID) > 0)
            {
                throw new Exception("Impossibile eliminare l'area, esistono combinazioni ad essa collegate");
            }

            int nDeleted = db.aree.RemoveAll(dbArea => dbArea.guidID == guidID);
            if (nDeleted > 0)
            {
                SingletonConfiguration.DBACPV!.aree = db.aree;
                db.SaveChanges();
            }
            else
            {
                throw new Exception("Nessuna area corrisponde al guid " + guidID);
            }


            return true;
        }

        bool salvaCombinazioneAction(CombinazioneAreaCanale obj)
        {
            DbACPV db = exClass.getACPV();
            db.SetExternalPath(extarnalSourcePath);

            CombinazioneAreaCanale? cmb = db.combinazioni.Where(dbCmb => dbCmb.guidID == obj.guidID).FirstOrDefault();
            if (cmb == null)
            {
                //Controllo se esiste l'are e il canale specificato
                if (db.canali.Count(dbCanale => dbCanale.guidID == obj.guidIDCanale)<=0)
                {
                    throw new Exception("Il canale specificato non esiste");
                }
                if (db.aree.Count(dbArea => dbArea.guidID == obj.guidIDArea)<=0)
                {
                    throw new Exception("L'area specificata non esiste");
                }

                cmb = new CombinazioneAreaCanale();
                cmb.guidID = obj.guidID;
                cmb.guidIDCanale = obj.guidIDCanale;
                cmb.guidIDArea = obj.guidIDArea;
                cmb.enabled = obj.enabled;

                db.combinazioni.Add(cmb);
            }
            else
            {
                cmb.guidIDCanale = obj.guidIDCanale;
                cmb.guidIDArea = obj.guidIDArea;
                cmb.enabled = obj.enabled;
            }
            SingletonConfiguration.DBACPV!.combinazioni = db.combinazioni;
            db.SaveChanges();

            return true;
        }

        bool eliminaCombinazioneAction(string guidID)
        {
            DbACPV db = exClass.getACPV();
            db.SetExternalPath(extarnalSourcePath);

            int nDeleted = db.combinazioni.RemoveAll(dbComb => dbComb.guidID == guidID);
            if (nDeleted > 0)
            {
                SingletonConfiguration.DBACPV!.combinazioni = db.combinazioni;
                db.SaveChanges();
            }
            else
            {
                throw new Exception("Nessuna combinazione corrisponde al guid " + guidID);
            }


            return true;
        }

        bool salvaPVAction(PV obj)
        {
            DbACPV db = exClass.getACPV();
            db.SetExternalPath(extarnalSourcePath);

            
            PV? pv = db.pv.Where(dbPV => dbPV.guidID == obj.guidID).FirstOrDefault();
            if (pv == null)
            {
                pv = new PV();
                pv.guidID = obj.guidID;
                pv.nome= obj.nome;
                pv.indirizzo= obj.indirizzo;
                pv.guidIDCombinazione = obj.guidIDCombinazione;
                pv.cap = obj.cap;
                pv.citta = obj.citta;
                pv.lon = obj.lon;
                pv.lat = obj.lat;

                db.pv.Add(pv);
            }
            else
            {
                pv.nome = obj.nome;
                pv.indirizzo = obj.indirizzo;
                pv.guidIDCombinazione = obj.guidIDCombinazione;
                pv.cap = obj.cap;
                pv.citta = obj.citta;
                pv.lon = obj.lon;
                pv.lat = obj.lat;
            }

            SingletonConfiguration.DBACPV!.pv = db.pv;
            db.SaveChanges();

            return true;
        }

        bool eliminaPVAction(string guidID)
        {
            DbACPV db = exClass.getACPV();
            db.SetExternalPath(extarnalSourcePath);

            int nDeleted = db.pv.RemoveAll(dbPV => dbPV.guidID == guidID);
            if (nDeleted > 0)
            {
                SingletonConfiguration.DBACPV!.pv = db.pv;
                db.SaveChanges();
            }
            else
            {
                throw new Exception("Nessun punto vendita corrisponde al guid " + guidID);
            }


            return true;
        }


        [HttpPut]
        [Route("ACPV/salvaSourceJsonCode")]
        public async Task<IActionResult> salvaSourceJsonCode([FromBody] SourceJsonRequest request)
        {
            BoolResult bRes = new BoolResult();

            FICOAccessLevel acLevel = await getAccesslevel();


            if (acLevel != FICOAccessLevel.noSession)
            {

                if (acLevel == FICOAccessLevel.adminLocal)
                {
                    bRes = SingletonConfiguration.DBACPV!.SetJsonSource(request.jsoncode);
                }
            }
            else
            {
                bRes.error = "no_login";
                bRes.Esito = false;
                return Unauthorized(bRes);
            }


            return Ok(bRes);
        }

        #endregion
    }
}
