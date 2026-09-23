using Antlr4.Runtime;
//using DocumentFormat.OpenXml.Drawing;
using DocumentFormat.OpenXml.InkML;
using DocumentFormat.OpenXml.Office.CoverPageProps;
using DocumentFormat.OpenXml.Office2013.Drawing.ChartStyle;
using Istanta.MiddleWare;
using Istanta.Models;
using Istanta.Models_2;
using Istanta.Utility;
using IstantaLib;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System.Configuration;
using System.Net.Http.Headers;
using System.Net.Mail;
using System.Net.WebSockets;
using System.Reflection;
using System.Security.Claims;
using System.Text;
using System.Text.RegularExpressions;
using static Istanta.Controllers.RegisterController;
using static System.Net.WebRequestMethods;

namespace Istanta.Controllers
{
    public class ChangePasswordAction
    {
        public string oldPassword { get; set; } = "";
        public string newPassword { get; set; } = "";       
    }

    public class ResetPasswordAction
    {
        public string newPassword { get; set; } = "";
    }


    public class RecoveryPasswordAction
    {
        public string email { get; set; } = "";
    }

    public class RecoveryPasswordParam
    {
        public int id { get; set; } = 0;
        public string email { get; set; } = "";
        public DateTime timestamp { get; set; }


    }
    

    public class LoginController : Controller
    {
        private edro21_dbContext ctx;
        private readonly Edro21_DbContext2 ctx2;
        private readonly ILogger<LoginController> _logger;
        private readonly string externalSourcePath = "";
        private readonly string passKeyRecovery = "istn_recoveryP";
        private readonly IOptions<AuthADOptions> _authAD_options;
        private readonly FicoConfig ficoConfig;
        private readonly IHttpClientFactory httpClientFactory;
        private readonly string conn_string = "";

        IConfiguration _config;
        private readonly IDbContextFactory<edro21_dbContext> _dbContextFactory;
        private readonly IDbContextFactory<Edro21_DbContext2> _dbContextFactory2;
        public LoginController(IConfiguration configuration, ILogger<LoginController> logger, IDbContextFactory<edro21_dbContext> dbContextFactory, IOptions<PathExternal> external_lib, IOptions<AuthADOptions> authAD_options, IOptions<FicoConfig>fico_config, IHttpClientFactory httpClientFactory, IDbContextFactory<Edro21_DbContext2> dbContextFactory2)
        {
            this._dbContextFactory2 = dbContextFactory2;
            this._dbContextFactory = dbContextFactory;
            this.ctx = this._dbContextFactory.CreateDbContext();

            conn_string = configuration.GetConnectionString("IstandaConnectionDb")!;
            this.ctx2 = this._dbContextFactory2.CreateDbContext();

            _config = configuration;
            ViewData["jsGuid"] = Guid.NewGuid().ToString();
            _logger = logger;

            _authAD_options = authAD_options;

            externalSourcePath = external_lib.Value.pathSource;
            ficoConfig = fico_config.Value;
            this.httpClientFactory = httpClientFactory;
            

        }

        public IActionResult Index()
        {
            _logger.LogInformation("LoginController.Index");

            if (_authAD_options != null)
            {
                bool adRequired = false;
                AuthADOptions optAuth = _authAD_options.Value;
                switch (optAuth.Provider)
                {
                    case "EntraID":
                        adRequired = true;
                        break;
                    default:
                        break;
                }

                if (adRequired)
                {
                    ViewBag.ADLoginUrl = HttpContext.Request.PathBase + "/LoginController/auth/entra";
                }
            }

            ViewBag.versione = getVersionDo();
            ViewBag.versioneAgenziaLib = getAgenziaVersionDo();

            return View();
        }

        [HttpPost]
        //[ValidateAntiForgeryToken]
        [Route("LoginController/login")]
        public IActionResult Index(string username, string password, bool fromPlugin = false)
        {
            Console.WriteLine("Attempt to login...");

            if (username == null || password == null || username == "" || password == "")
            {
                if (!fromPlugin)
                {
                    return Redirect(HttpContext.Request.PathBase + "/Login");
                }
                else
                {
                    BoolResult result = new BoolResult();
                    result.Esito = false;
                    if (username == null || username == "")
                    {
                        if (password == null || password == "")
                        {
                            result.error = "Username e Password non specificati";
                            return BadRequest(result);
                        }
                        else
                        {
                            result.error = "Username non specificato";
                            return BadRequest(result);
                        }
                    }
                    else if (password == null || password == "")
                    {
                        result.error = "Password non specificata";
                        return BadRequest(result);

                    }
                    return Ok(result);
                }
            }

            try
            {
                var utenteNonAutenticato = this.ctx.Utentis.FirstOrDefault(f => username == f.Email && f.Stato!=(Byte)statoUtente.Disattivo);

                if (utenteNonAutenticato==null)
                {
                    if (!fromPlugin)
                        return Redirect(HttpContext.Request.PathBase + "/Login");

                    BoolResult result = new BoolResult();
                    result.error = "Credenziali errate";
                    return BadRequest(result);
                }

                Utenti utente = null;//this.ctx.Utentis.Where(f => f.Password == password && (username == f.Email || username == f.NomeUtente)).FirstOrDefault();
                if (utenteNonAutenticato!=null && utenteNonAutenticato.Stato == (Byte)statoUtente.Attivo)
                {
                    if (utenteNonAutenticato.Password==password)
                    {
                        utente = utenteNonAutenticato;
                    }
                }

                if (utente == null)
                {
                    //Dato che l'utnet enon è trovato, vediamo se è login con token
                    if (fromPlugin)
                    {
                        if (utenteNonAutenticato.Stato == (Byte)statoUtente.Attivo)
                        {
                            //Se è un normale utente con coppia username e password su Istnata allora se qui è null 
                            //le credenziali sono sbaglaite
                            BoolResult result = new BoolResult();
                            result.error = "Credenziali errate";
                            return BadRequest(result);
                        }

                        //E' un utente OAuth Fico
                        //Solo da plugin si entra con il token
                        utente = this.ctx.Utentis.Where(f => username == f.Email && f.ADToken == password).FirstOrDefault();
                        if (utente != null)
                        {
                            //Controllo scadenza token
                            if (!utente.ADTokenExpiration.HasValue || utente.ADTokenExpiration.Value < DateTime.Now)
                            {
                                BoolResult result = new BoolResult();
                                result.Esito = false;
                                result.error = "token_expired";
                                //Not Authorized
                                return Unauthorized(result);
                            }
                        }
                        else
                        {
                            BoolResult result = new BoolResult();
                            result.Esito = false;
                            result.error = "token_wrong";
                            //Not Authorized
                            return Unauthorized(result);
                        }
                    }
                    else
                    {
                        if (utenteNonAutenticato.Ruolo != (Byte)ruoloUtente.GDO)
                        {
                            return Redirect(HttpContext.Request.PathBase + "/Login");
                        }

                        BoolResult result = new BoolResult();
                        result.Esito = false;
                        result.error = "login_plugin_exclusive";
                        //Not Authorized
                        return Unauthorized(result);
                    }
                }
                else
                {
                    if (utente.Stato != (Byte)statoUtente.Attivo)
                    {
                        BoolResult result = new BoolResult();
                        result.Esito = false;
                        result.error = "utente_non_attivo";
                        //Not Authorized
                        return Unauthorized(result);
                    }

                    bool adRequired = false;
                    if (_authAD_options != null)
                    {
                        AuthADOptions optAuth = _authAD_options.Value;
                        switch (optAuth.Provider)
                        {
                            case "EntraID":
                                adRequired = true;
                                break;
                            default:
                                break;
                        }
                    }

                    //Se l'utente è GDO e ho un meccanismo di AD token lo respingo e lo invito a entrare da browser
                    if (adRequired && utente.Ruolo != (Byte)ruoloUtente.Superadmin && utente.Ruolo != (Byte)ruoloUtente.Agenzia)
                    {
                        //BoolResult result = new BoolResult();
                        //result.Esito = false;
                        //result.error = "token_required";
                        ////Not Authorized
                        //return Unauthorized(result);

                        return Redirect(HttpContext.Request.PathBase + "/LoginController/auth/entra");
                    }
                }

                if (utente == null)
                {
                    if (!fromPlugin)
                    {
                        return Redirect("/Login");
                    }
                    else
                    {
                        BoolResult result = new BoolResult();
                        result.Esito = false;
                        result.error = "Utente non trovato";
                        //Not Authorized
                        return Unauthorized(result);
                    }
                }
                else
                {

                    //if (ADValidator!=null)
                    //{
                    //    try
                    //    {
                    //        var validationResult = ADValidator.ValidateAsync(utente.Id.ToString(), utente.Email).GetAwaiter().GetResult();
                    //        if (!validationResult.Allowed)
                    //        {
                    //            if (!fromPlugin)
                    //            {
                    //                return Redirect(HttpContext.Request.PathBase + "/Login");
                    //            }
                    //            else
                    //            {
                    //                BoolResult result = new BoolResult();
                    //                result.Esito = false;
                    //                result.error = validationResult.Reason ?? "Utente non autorizzato";
                    //                //Not Authorized
                    //                return Unauthorized(result);
                    //            }
                    //        }
                    //    }
                    //    catch (Exception ex)
                    //    {
                    //        _logger.LogError("Errore durante la validazione esterna dell'utente: " + ex.ToString());
                    //        if (!fromPlugin)
                    //        {
                    //            return Redirect(HttpContext.Request.PathBase + "/Login");
                    //        }
                    //        else
                    //        {
                    //            BoolResult result = new BoolResult();
                    //            result.Esito = false;
                    //            result.error = "Errore durante la validazione esterna dell'utente";
                    //            //Not Authorized
                    //            return Unauthorized(result);
                    //        }
                    //    }
                    //}

                    _ = setSession(utente.Id.ToString());
                    _ = setSessionName(utente.NomeUtente);

                    //Registro attività
                    Register regItem =  new Register(conn_string, this._dbContextFactory, dbContextFactory2: this._dbContextFactory2);
                    regItem.addOperazione(new RegistroOperazioni()
                    {
                        TipoOperazione = (Byte)tipoOperazione.login,
                        Stato = (Byte)statoOperazioni.risolta,
                        Autore = utente.Id,
                        CodiceAssociato="",
                        FormData="",
                        Url="login",
                        Data_Registrazione = DateTime.Now
                    }, true, utente.Id.ToString(), DateTime.Now);

                    if (!fromPlugin)
                    {
                        return Redirect(HttpContext.Request.PathBase + "/Tracciati");
                    }
                    else
                    {
                        BoolResult result = new BoolResult();
                        result.Esito = true;
                        return Ok(result);
                    }
                }

            }
            catch(Exception ex)
            {
                ex.ToString();
            }

            return BadRequest();

            
        }


        [HttpGet]
        [Route("LoginController/auth/entra")]
        public IActionResult Start()
        {
            var scheme = Request.Scheme;           // "http" o "https"
            var host = Request.Host.Value;          // "www.miosito.it" oppure "localhost:5001"
            var pathBase = Request.PathBase.Value;

            var baseUrl = $"{scheme}://{host}{pathBase}";

            Console.WriteLine($"Redirecting to AD for authentication to {baseUrl}/LoginController/oauth/complete\"");

            return Challenge(new AuthenticationProperties
            {
                RedirectUri = $"{baseUrl}/LoginController/oauth/complete"
            }, OpenIdConnectDefaults.AuthenticationScheme);
        }

        [HttpGet("/LoginController/oauth/complete")]
        public async Task<IActionResult> Complete()
        {
            if (!User.Identity.IsAuthenticated)
            {
                return Unauthorized("AD not authenticated");
            }

            var accessToken = await HttpContext.GetTokenAsync("access_token");
            var idToken = await HttpContext.GetTokenAsync("id_token");
            var refreshToken = await HttpContext.GetTokenAsync("refresh_token");

            // Qui l'utente è già autenticato lato OIDC (cookie middleware),
            var email =
                User.FindFirstValue(ClaimTypes.Email)
                ?? User.FindFirstValue("preferred_username")
                ?? User.FindFirstValue("upn");

            var oid = User.FindFirstValue("oid") ?? User.FindFirstValue("sub"); // fallback;
            if (oid!=null)
            {
                Console.WriteLine($"Trovato OID nei cliams {oid}");
            }
            else
            {
                Console.WriteLine($"OID NON TROVATO");
            }

            foreach (var claim in User.Claims)
            {
                Console.WriteLine($"Claim {claim.Type} = {claim.Value}");
            }

            //email = "admin@correggo.it";

            if (string.IsNullOrWhiteSpace(email))
                return Unauthorized("Email non trovata nei claims");

            // 1) verifica che esiste nel mio DB
            //Utenti userItem = this.ctx.Utentis.FirstOrDefault(u => u.Email == email &&
            //(u.Ruolo == (Byte)FicoUserType.GDO || u.Ruolo == (Byte)FicoUserType.PuntoVendita || u.Ruolo == (Byte)FicoUserType.Category) &&
            //u.Stato == (Byte)statoUtente.Attivo);

            Utenti userItem = this.ctx.Utentis.FirstOrDefault(u => u.Email == email);

            if (userItem==null)
            {
                userItem = new Utenti();
                userItem.Email = email;
                userItem.NomeUtente = email.Split('@')[0];
                userItem.Cognome = userItem.NomeUtente;
                userItem.Nome = userItem.NomeUtente;
                userItem.Data_Registrazione = DateTime.Now;
                userItem.Stato = (Byte)statoUtente.FicoOAuth;
                userItem.Ruolo = (Byte)FicoUserType.GDO;//Questo è statico ma a regime deve essere passato il group policy da entra ID
                userItem.Password = "";
                this.ctx.Utentis.Add(userItem);
                 _= await this.ctx.SaveChangesAsync();
            }

            if (userItem!=null)
            {
               
                //Login efffettuato, possiamo assegnare la sessine
                _ = setSession(userItem!.Id.ToString());
                _ = setSessionName(userItem!.NomeUtente);

                if (!userItem.ADTokenExpiration.HasValue || userItem.ADTokenExpiration.Value < DateTime.Now)
                {
                    //Rinnovo
                    userItem.ADToken = Guid.NewGuid().ToString();
                    userItem.ADTokenExpiration = DateTime.Now.AddMinutes(5);
                }


                if (oid != null)
                    userItem.Password = oid;

                ViewBag.NomeUtente = $"{userItem.Nome} {userItem.Cognome}";
                ViewBag.Token= userItem.ADToken;
                ViewBag.DataScadenzaToken = userItem.ADTokenExpiration;
                ViewBag.RedirectDest = "";
                if (userItem.Ruolo==(Byte)FicoUserType.GDO)
                {
                    ViewBag.RedirectDest = "fp";
                }
                else if (userItem.Ruolo == (Byte)FicoUserType.Category)
                {
                    ViewBag.RedirectDest = "correggo";
                }


                _ = await this.ctx.SaveChangesAsync();
            }
            else
            {
                //return Unauthorized("Utente non trovato!");
            }

            return View(); // o dove vuoi
        }

        [HttpGet("/LoginController/oauth/landed")]
        public async Task<IActionResult> OAuthLanded(string context)
        {


            string decryptedMessage = Crypto.DecryptString(context, ficoConfig.secretKey);
            FicoAuthUrlMetaData ficoUrlMeta = JsonConvert.DeserializeObject<FicoAuthUrlMetaData>(decryptedMessage);

            if (ficoUrlMeta != null)
            {
                HttpClient httpClient = httpClientFactory.CreateClient();

                httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", ficoUrlMeta.publicKey);
                //Analizzo Bearer
                string url = $"{ficoConfig.olympusServerUrl}/auth/checkIdentity";
                try
                {
                    var response = await httpClient.GetAsync(url);

                    if (response.IsSuccessStatusCode)
                    {

                        var contentResponse = await response.Content.ReadAsStringAsync();
                        OlympusChekIdentity utente = JsonConvert.DeserializeObject<OlympusChekIdentity>(contentResponse)!;

                        int id_utente = 0;
                        string nomeUtente = "";
                        if (utente!.autorizzato)
                        {
                            this.ctx = this._dbContextFactory.CreateDbContext();
                            var userInternoInLoopback = ctx.Utentis.FirstOrDefault(u => u.Email == utente.username);
                            if (userInternoInLoopback != null)
                            {
                                id_utente = userInternoInLoopback.Id;
                                nomeUtente = userInternoInLoopback.NomeUtente;
                            }
                            else
                            {
                                //Lo creo!
                                //Essendo autorizzat FICO, possiamo registrarlo e creare una sessione
                                Utenti uIstanta = new Utenti();

                                foreach (string k in utente.userPolicy!.campi_essenziali!.Keys)
                                {

                                    if (k == "nome")
                                    {
                                        uIstanta.Nome = utente.userPolicy.campi_essenziali[k];
                                    }
                                    else if (k == "cognome")
                                    {
                                        uIstanta.Cognome = utente.userPolicy.campi_essenziali[k];
                                    }
                                }

                                uIstanta.NomeUtente = $"{uIstanta.Nome} {uIstanta.Cognome}";

                                uIstanta.Email = utente.username;
                                uIstanta.Password = "";
                                uIstanta.Ruolo = (byte)utente.tipoUtente;
                                uIstanta.Stato = (byte)statoUtente.FicoOAuth;
                                uIstanta.Data_Registrazione = DateTime.Now;


                                ctx.Add(uIstanta);

                                try
                                {
                                    _ = await ctx.SaveChangesAsync();
                                    
                                    id_utente = uIstanta.Id;
                                    nomeUtente = uIstanta.NomeUtente;
                                }
                                catch (DbUpdateException ex)
                                {
                                    // Gestione dell'errore in caso di email duplicata
                                    Console.WriteLine(ex.Message);
                                    //Tutto ok Qualcuno lo ha creato nel frattempo.
                                    // Pulisco il tracking dell'entità fallita.
                                    //ctx.Entry(uIstanta).State = (Microsoft.EntityFrameworkCore.EntityState)System.Data.Entity.EntityState.Detached;

                                    var utenteEsistente = ctx.Utentis
                                        .FirstOrDefault(u => u.Email == utente.username);

                                    id_utente = utenteEsistente.Id;
                                    //throw new Exception("Errore durante la registrazione dell'utente: email già esistente.", ex);
                                }



                            }

                            //Lettura delle policy per aggiornamento
                            //Se necessario
                            //Al momento ISTANTA non ha bisogno di conoscere nel dettaglio il ruolo dell'utente, gli basta il macro tipo

                            _ = setSession(id_utente.ToString());
                            _ = setSessionName(nomeUtente);

                            if (ficoUrlMeta.route != null && ficoUrlMeta.route != "")
                            {
                                return Redirect(HttpContext.Request.PathBase + "/" + ficoUrlMeta.route);
                            }
                            else
                            {
                                return Redirect(HttpContext.Request.PathBase + "/Tracciati");
                            }
                        }
                        else
                        {
                            //Response with Unauthorized                                    
                            return Unauthorized(new LoginResult() { login = false, error = "no_login" });
                        }

                    }
                    else
                    {
                        string err = await response.Content.ReadAsStringAsync();
                        return Unauthorized(new LoginResult() { login = false, error = err});
                    }
                }
                catch (Exception ex)
                {
                    return Unauthorized(new LoginResult() { login = false, error = ex.ToString() });
                }

            }
            else
            {
                return Unauthorized(new LoginResult() { login = false, error = "Pagina non valida" });
            }
        }

        [HttpPost]
        //[ValidateAntiForgeryToken]
        [Route("LoginController/ChangePassword")]
        public async Task<IActionResult> ChangePassword(ChangePasswordAction act)
        {
            string oldPwd = act.oldPassword;
            string newPwd = act.newPassword;


            BoolResult result = new BoolResult();
            result.Esito = false;

            try
            {

                int idSession = int.Parse(SessionIstantaObject.GetSession(HttpContext));

                var utente = this.ctx.Utentis.Where(f => f.Id == idSession && f.Password == oldPwd).FirstOrDefault();
                //var utentiList = this.ctx.Utentis.ToList();
                if (utente == null)
                {
                    result.error = "Password attuale specificata non corretta";
                }
                else
                {
                    //RegEx requisiti almeno una lettera maiuscola, almeno un numero, almeno un carattere speciale
                    if (newPwd.Length < 8)
                    {
                        result.error = "Nuova password troppo corta, la password deve contenere almeno 8 caratteri";
                        return Ok(result);
                    }

                    //Deve contenere almeno una lettera maiuscola, un numero e un carattere speciale
                    string pattern = @"^(?=.*[A-Z])(?=.*\d)(?=.*[@!=%$\^_-]).{8,}$";
                    bool isValid = Regex.IsMatch(newPwd, pattern);

                    if (!isValid)
                    {
                        result.error = "Password non valida, deve contenere almeno un numero, un carattere maiuscolo e uno carattere speciale";
                        return Ok(result);
                    }

                    utente.Password = newPwd;
                    result.Esito = true;
                    await this.ctx.SaveChangesAsync();
                }
            }
            catch(Exception ex)
            {
                result.error = ex.ToString();
            }

            return Ok(result);
        }

        [HttpPost]
        //[ValidateAntiForgeryToken]
        [Route("LoginController/ResetPassword")]
        public async Task<IActionResult> ResetPassword(ResetPasswordAction act)
        {
            string newPwd = act.newPassword;


            BoolResult result = new BoolResult();
            result.Esito = false;

            try
            {

           
                //Cerco il recovery session
                string jsonGuid = SessionIstantaObject.GetRecoverySession(HttpContext);
                string json = Crypto.DecryptString(jsonGuid, passKeyRecovery);
                var _p = JsonConvert.DeserializeObject<RecoveryPasswordParam>(json);
                int idSession = _p.id;
                

                var utente = this.ctx.Utentis.Where(f => f.Id == idSession).FirstOrDefault();

                if (utente == null)
                {
                    result.error = "Utente non trovato";
                }
                else
                {
                    //RegEx requisiti almeno una lettera maiuscola, almeno un numero, almeno un carattere speciale
                    if (newPwd.Length < 8)
                    {
                        result.error = "Nuova password troppo corta, la password deve contenere almeno 8 caratteri";
                        return Ok(result);
                    }

                    //Deve contenere almeno una lettera maiuscola, un numero e un carattere speciale
                    string pattern = @"^(?=.*[A-Z])(?=.*\d)(?=.*[@!=%$\^_-]).{8,}$";
                    bool isValid = Regex.IsMatch(newPwd, pattern);

                    if (!isValid)
                    {
                        result.error = "Password non valida, deve contenere almeno un numero, un carattere maiuscolo e uno carattere speciale";
                        return Ok(result);
                    }

                    utente.Password = newPwd;
                    result.Esito = true;
                    await this.ctx.SaveChangesAsync();
                }
            }
            catch (Exception ex)
            {
                result.error = ex.ToString();
            }

            return Ok(result);
        }

        [HttpPost]
        //[ValidateAntiForgeryToken]
        [Route("LoginController/InviaEmailPerRecuperaPassword")]
        public async Task<IActionResult> InviaEmailPerRecuperaPassword(RecoveryPasswordAction act)
        {
         
            BoolResult result = new BoolResult();
            result.Esito = false;

            var utente = this.ctx.Utentis.Where(f => f.Email==act.email).FirstOrDefault();

            //var utentiList = this.ctx.Utentis.ToList();
            if (utente == null)
            {
                result.error = "E-mail inesistente";
            }
            else
            {
                var scheme = Request.Scheme;           // "http" o "https"
                var host = Request.Host.Value;          // "www.miosito.it" oppure "localhost:5001"
                var pathBase = Request.PathBase.Value;

                var baseUrl = $"{scheme}://{host}{pathBase}";

                //RegEx requisiti almeno una lettera maiuscola, almeno un numero, almeno un carattere speciale

                string emailPattern = @"^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$";
                if (!Regex.IsMatch(act.email, emailPattern, RegexOptions.IgnoreCase))
                {
                    result.error = "E-mail non valida";
                    return Ok(result);
                }

                //Inviamo invito a cambiare
                string email_recovery = await System.IO.File.ReadAllTextAsync(Path.Combine(externalSourcePath, "index_recovery_pwd.html"));

                email_recovery = email_recovery.Replace("$nome_utente", utente.Nome);

                RecoveryPasswordParam _p = new RecoveryPasswordParam();
                _p.id = utente.Id;
                _p.email = act.email;
                _p.timestamp = DateTime.Now;

                string _s = JsonConvert.SerializeObject(_p);
                _s = Crypto.EncryptString(_s, passKeyRecovery);

                email_recovery = email_recovery.Replace("$link_recupero", baseUrl+"/LoginController/recuperoPassword/"+_s);


                result = Mailer.inviaEmail("Recupero password Istanta", _p.email, email_recovery);

            }


            return Ok(result);
        }

        [HttpGet]
        //[ValidateAntiForgeryToken]
        [Route("LoginController/recuperoPassword/{codifica}")]
        public IActionResult RecuperoPassword(string codifica)
        {
            ViewBag.Error = "";
            ViewBag.EmailUtente = "";

            try
            {
                string json = Crypto.DecryptString(codifica, passKeyRecovery);
                var _p = JsonConvert.DeserializeObject<RecoveryPasswordParam>(json);
                

                Utenti u = this.ctx.Utentis.FirstOrDefault(u => u.Id == _p.id);

                if (u == null)
                {
                    ViewBag.Error = "Utente non riconosciuto";
                }
                else
                {
                    if (u.Email == _p.email)
                    {
                        if (DateTime.Now.Subtract(_p.timestamp).TotalMinutes > 60000)
                        {
                            ViewBag.Error = "Link scaduto";
                        }
                        else
                        {
                            _ = setRecoverySession(codifica);
                            ViewBag.EmailUtente = u.Email;
                            ViewBag.NomeUtente = $"{u.Nome} {u.Cognome}";
                        }
                    }
                    else
                    {
                        ViewBag.Error = "Mismatch e-mail";
                    }
                }
            }
            catch(Exception ex)
            {
                ViewBag.Error = ex.ToString();
            }



            return View();
        }

        [HttpGet]
        [Route("LoginController/getTokenDiAccesso")]
        public async Task<IActionResult> getTokenDiAccesso()
        {
            UserAccessToken result = new UserAccessToken();


            try
            {
                var session = SessionIstantaObject.GetSession(HttpContext);
                if (session != null && session.ToLower() != "no session")
                {
                    if (Int32.TryParse(session, out int userId))
                    {
                        Utenti u = this.ctx.Utentis.FirstOrDefault(u => u.Id == userId);
                        if (u != null)
                        {
                            if (u.Stato != (Byte)statoUtente.FicoOAuth)
                            {
                                result.error = "user_no_need_token";
                            }
                            else if (u.ADToken!=null)
                            {
                                double duration = u.ADTokenExpiration.Value.Subtract(DateTime.Now).TotalMilliseconds;
                                if (duration < 0)
                                {
                                    result.token = Guid.NewGuid().ToString();
                                    result.expiration = DateTime.Now.AddMinutes(5);
                                    result.duration = (int)result.expiration.Subtract(DateTime.Now).TotalMilliseconds;

                                    u.ADToken = result.token;
                                    u.ADTokenExpiration = result.expiration;

                                    _ = await ctx.SaveChangesAsync();
                                }
                                else
                                {
                                    result.token = u.ADToken;
                                    result.expiration = u.ADTokenExpiration.Value;
                                    result.duration = (int)duration;
                                }
                            }
                            else
                            {
                                //Rigenero token e exipration
                                result.token = Guid.NewGuid().ToString();
                                result.expiration = DateTime.Now.AddMinutes(5);
                                result.duration = (int)result.expiration.Subtract(DateTime.Now).TotalMilliseconds;

                                u.ADToken = result.token;
                                u.ADTokenExpiration = result.expiration;
                                _ = await ctx.SaveChangesAsync();
                            }

                        }
                        else
                        {
                            ViewBag.Error = "Utente non trovato";
                        }
                    }
                }

            }
            catch (Exception ex)
            {
                result.error=ex.ToString();
            }



            return Ok(result);
        }

        class Session
        {
            public string nomeUtente { get; set; } = "";
            public int idUtente { get; set; }
            //public FicoUserType ruolo { get; set; }
            public byte ruoloUtente { get; set; } = 0;
            public string error { get; set; } = "";
            public bool esito { get; set; }
        }

        [HttpGet]
        [Route("LoginController/getSession")]
        public async Task<IActionResult> getSession()
        {
            var session = SessionIstantaObject.GetSession(HttpContext);
            if (session.ToLower() == "no session")
            {
                Session sessione = new Session();
                sessione.error = "no_login";
                sessione.esito = false;
                //sessione.ruolo = TipoUtenteFico.FicoGuest;
                sessione.nomeUtente = "";
                sessione.idUtente = 0;

                return Ok(sessione);
            }
            else
            {
                var utente = this.ctx.Utentis.Where(f => int.Parse(session) == f.Id).FirstOrDefault();

                Session sessione = new Session();
                if (utente == null)
                {
                    sessione.error = "utente_non_trovato";
                    sessione.esito = false;
                    //sessione.ruolo = TipoUtenteFico.FicoGuest;
                    sessione.nomeUtente = "";
                    sessione.idUtente = 0;

                    return Ok(sessione);
                }

                sessione.error = "";
                sessione.esito = true;
                //sessione.ruolo = (TipoUtenteFico)utente.Ruolo;
                sessione.nomeUtente = utente.NomeUtente;
                sessione.idUtente = utente.Id;
                sessione.ruoloUtente = utente.Ruolo;

                return Ok(sessione);
            }
        }

        //[HttpGet]
        //[Route("LoginController/setSession")]
        public async Task<IActionResult> setSession(string nomeUtente)
        {
            HttpContext.Session.SetString("id", nomeUtente);
            return Ok();
        }

        public async Task<IActionResult> setSessionName(string nomeUtente)
        {
            HttpContext.Session.SetString("nomeUtente", nomeUtente);
            return Ok();
        }

        public async Task<IActionResult> setRecoverySession(string jsonguid)
        {
            HttpContext.Session.SetString("recoveryGuid", jsonguid);
            return Ok();
        }

        [HttpGet]
        [Route("LoginController/logoutFromPage")]
        public async Task<IActionResult> logoutFromPage()
        {
            await logout();   // era senza await: il Redirect poteva partire prima della chiusura sessione
            return Redirect(HttpContext.Request.PathBase + "/Login");
        }

        [HttpGet]
        [Route("LoginController/logout")]
        public async Task<IActionResult> logout()
        {

            BoolResult result = new BoolResult();
            result.Esito = true;
            HttpContext.Session.Remove("id");
            HttpContext.Session.Remove("nomeUtente");
            HttpContext.Session.Remove("recoveryGuid");
            return Ok(result);
        }

        [HttpPost]
        [Route("LoginController/register")]
        public async Task<IActionResult> register(string email,string nomeUtente, string password)
        {
            try
            {
                if (email == null)
                {
                    return Ok("Email non specificata");
                }

                if (nomeUtente == null)
                {
                    return Ok("Nome utente non specificato");
                }

                if (password == null)
                {
                    return Ok("Password non specificata");
                }

                if (IsConsecutive(password))
                {
                    return Ok("Password non valida, non ci devono essere tutti caratteri consecutivi come 1234 o abcde");
                }

                if (password.Length < 8)
                {
                    return Ok("Password troppo corta, la password deve contenere almeno 8 caratteri");
                }

                if (nomeUtente.Length < 3)
                {
                    return Ok("Nome utente troppo corto, il nome utente deve essere di almeno 3 caratteri");
                }

                var utenteGiaRegistrato = this.ctx.Utentis.Where(f => f.Email == email).FirstOrDefault();
                if (utenteGiaRegistrato != null)
                {
                    return Ok("L'email selezionata è già registrata");
                }

                utenteGiaRegistrato = this.ctx.Utentis.Where(f => f.NomeUtente == nomeUtente).FirstOrDefault();
                if (utenteGiaRegistrato != null)
                {
                    return Ok("Il nome utente selezionato è già stato preso, selezionare un nome utente diverso");
                }

                Utenti nuovoUtente = new Utenti();
                nuovoUtente.Email = email;
                nuovoUtente.NomeUtente = nomeUtente;
                nuovoUtente.Password = password;
                nuovoUtente.Ruolo = (byte)FicoUserType.Agenzia;
                nuovoUtente.Stato = (byte)statoUtente.Attivo;
                nuovoUtente.Data_Registrazione = DateTime.Now;

                this.ctx.Utentis.Add(nuovoUtente);
                this.ctx.SaveChanges();

                return Ok();
            }
            catch(Exception ex)
            {
                return Ok(ex.Message);
            }
        }


        public static bool IsConsecutive(string str)
        {
            // Se la stringa è vuota o ha un solo carattere, è considerata consecutiva
            if (string.IsNullOrEmpty(str) || str.Length == 1)
                return true;

            for (int i = 1; i < str.Length; i++)
            {
                // Confronta i valori ASCII dei caratteri consecutivi
                if (str[i] != str[i - 1] + 1)
                {
                    return false;
                }
            }

            return true;
        }

        [HttpGet]
        [Route("LoginController/ping")]
        public async Task<IActionResult> ping()
        {
            return Ok("Connected");
        }

        #region Upgrade Agent

        [HttpPost]
        [Route("LoginController/Upgrade")]
        public async Task<IActionResult> Upgrade([FromForm] FicoUpgradePackRequest request)
        {
            FicoUpgradePackResponse result = new FicoUpgradePackResponse();

            try
            {
                //Check del bearer
                //DA FARE


                Stream str = request.file!.OpenReadStream();
                byte[] arrBytes = new byte[str.Length];
                str.ReadExactly(arrBytes, 0, (int)str.Length);

                //Salvo il file
                string dirUpgrade = Path.Combine(AppContext.BaseDirectory, "upgrade");
                if (!Directory.Exists(dirUpgrade))
                {
                    Directory.CreateDirectory(dirUpgrade);
                }

                string pathFile = System.IO.Path.Combine(dirUpgrade, request.file.FileName);
                System.IO.File.WriteAllBytes(pathFile, arrBytes);

                //Apro connessione socket con l'agnet
                ClientWebSocket cws = new ClientWebSocket();
                await cws.ConnectAsync(new Uri(ficoConfig.agent), CancellationToken.None);

                var msg=new    
                {
                    command = "upgrade",
                    sender = "istanta",
                    idTarget=request.idTarget,
                    filePath = pathFile
                };

                await cws.SendAsync(Encoding.ASCII.GetBytes($"{JsonConvert.SerializeObject(msg)}"), WebSocketMessageType.Text, true, CancellationToken.None);

                //Invio esito positivo
                result.Esito = true;

            }
            catch (Exception exProKit)
            {
                result.error = exProKit.ToString();
            }

            return Ok(result);
        }

        [HttpGet]
        [Route("LoginController/UpgradeCheck/{sessionId}")]
        public async Task<IActionResult> UpgradeCheck(string sessionId)
        {
            FicoUpgradeCheckResponse result = new FicoUpgradeCheckResponse();

            try
            {
                //Check del bearer
                //DA FARE
                string dirUpgrade = Path.Combine(AppContext.BaseDirectory, "upgrade");
                string pathSessionSummaryFile = Path.Combine(dirUpgrade, sessionId, "summary.json");
                if (System.IO.File.Exists(pathSessionSummaryFile))
                {                    
                    //File summary creto per cui aggiornamento terminato
                    result.result = System.IO.File.ReadAllText(pathSessionSummaryFile);
                    result.message = "completed";
                }
                else
                {
                    //Controlliamo se è gia stata istanziata la cartella si sessione
                    string pathSessionFolder = Path.Combine(dirUpgrade, sessionId);
                    if (!Directory.Exists(pathSessionFolder))
                    {
                        //Vediamo se almeno il file .singular è atterrato
                        string pathSessionSingularFile = Path.Combine(dirUpgrade, sessionId + ".singular");
                        if (System.IO.File.Exists(pathSessionSingularFile))
                        {
                            //Pacchetto atterrato per cui si aspetta che l'agent inizi a processare
                            result.message = "processing";
                        }
                        else
                        {
                            //Il pacchetto non è mai stato ricevuto
                            result.error = "Session not exist";
                        }
                    }
                    else
                    {
                        //Sessione in lavorazione, creata la cartella per cui si inizia a eseguire le pipelines
                        result.message = "pipilines_workings";
                    }
                }

            }
            catch (Exception exProKit)
            {
                result.error = exProKit.ToString();
            }

            return Ok(result);
        }

        [HttpGet]
        [Route("LoginController/getVersion")]
        public async Task<IActionResult> getVersion()
        {
            string result = getVersionDo();



            return Ok(result);
        }

        private string getVersionDo ()
        {
            string result = "";
            //Come recupero la versione della dll
            var assembly = System.Reflection.Assembly.GetExecutingAssembly();
            var versionAttribute = assembly.GetCustomAttribute<System.Reflection.AssemblyInformationalVersionAttribute>();
            if (versionAttribute != null)
            {
                result = versionAttribute.InformationalVersion;
                if (result.IndexOf("+") > 0)
                {
                    result = result.Substring(0, result.IndexOf("+"));
                }
            }
            else
            {
                result = "Version not found";
            }

            return result;
        }

        [HttpGet]
        [Route("LoginController/getAgenziaLibVersion")]
        public async Task<IActionResult> getAgenziaLibVersion()
        {
            string result = getAgenziaVersionDo();
            return Ok(result);
        }

        private string getAgenziaVersionDo()
        {
            string result = "";
            //Come recupero la versione di una dll su disco
            string pathDll = Path.Combine(AppContext.BaseDirectory, "wwwroot", "external_lib", "AgenziaLib.dll");
            if (System.IO.File.Exists(pathDll))
            {
                var bytes = System.IO.File.ReadAllBytes(pathDll);
                var assembly = Assembly.Load(bytes);
                var versionAttribute = assembly.GetName().Version;

                if (versionAttribute != null)
                {
                    result = $"{versionAttribute.Major}.{versionAttribute.Minor}.{versionAttribute.Build}";
                    if (result.IndexOf("+") > 0)
                    {
                        result = result.Substring(0, result.IndexOf("+"));
                    }
                }
                else
                {

                    result = "Version not found";
                }

            }

            return result;

        }

        /// <summary>
        /// I20-987: il manifest del Plugin pubblicato per questo cliente, oppure niente se non
        /// si riesce a leggerlo.
        ///
        /// La lettura sta in un posto solo perche' la usano sia il link di scaricamento sia il
        /// controllo della versione: due copie prenderebbero strade diverse alla prima modifica.
        /// </summary>
        private async Task<PluginManifest?> manifestPluginPubblicato()
        {
            Random rnd = new Random(999999);
            int rndNum = rnd.Next();
            string k = Crypto.EncryptString(ficoConfig.nomeCliente, ficoConfig.secretKey);
            string linkManifest = $"https://www.istanta.it/plugin/{k}/manifest.json?c={rndNum}";

            HttpClient httpClient = httpClientFactory.CreateClient();
            var responseManifest = await httpClient.GetAsync(linkManifest);

            if (!responseManifest.IsSuccessStatusCode)
            {
                return null;
            }

            string manifestContent = await responseManifest.Content.ReadAsStringAsync();
            return JsonConvert.DeserializeObject<PluginManifest>(manifestContent);
        }

        /// <summary>
        /// I20-987: la versione del Plugin pubblicata per questo cliente.
        ///
        /// La chiede il Plugin all'avvio per confrontarla con la propria. Se il manifest non si
        /// legge si risponde senza versione invece di inventarne una: il Plugin, in quel caso,
        /// non blocca niente, perche' un disservizio di rete non deve fermare il lavoro.
        /// </summary>
        [HttpGet]
        [Route("LoginController/getVersionePluginPubblicata")]
        public async Task<IActionResult> getVersionePluginPubblicata()
        {
            StringResult str = new StringResult();

            try
            {
                PluginManifest? manifest = await manifestPluginPubblicato();

                if (manifest == null || string.IsNullOrWhiteSpace(manifest.version))
                {
                    str.error = "Versione del Plugin non disponibile";
                    return Ok(str);
                }

                str.Esito = manifest.version;
                str.boolEsito = true;
            }
            catch (Exception ex)
            {
                str.error = ex.Message;
            }

            return Ok(str);
        }

        [HttpGet]
        [Route("LoginController/getDownloadLinkOfPlugin")]
        public async Task<IActionResult> getDownloadLinkOfPlugin()
        {
            StringResult str = new StringResult();

            try
            {
                //Voglio ottenere un numero randomico
                Random rnd = new Random(999999);
                int rndNum = rnd.Next();
                string k = Crypto.EncryptString(ficoConfig.nomeCliente, ficoConfig.secretKey);

                PluginManifest? manifest = await manifestPluginPubblicato();

                string _version = "";
                string sourcename = "";
                if (manifest == null)
                {
                    str.error = "Plugin non disponibile";
                    return Ok(str);
                }
                else
                {
                    _version = manifest.version!;
                    sourcename = $"{manifest.id}_{manifest.host.FirstOrDefault().app}_{_version}";
                }

                if (_version=="")
                {
                    str.error = "No version found";
                    return Ok(str);
                }
                

                //string crypt = Crypto.EncryptString(ficoConfig.nomeCliente, "0191ff22-4b1a-7b80-8cb5-8759a1548e02");
                string link = $"https://www.istanta.it/plugin/{k}/{sourcename}.zip?c={rndNum}";
                //Controllo se la risrsa esiste

                HttpClient httpClient = httpClientFactory.CreateClient();
                var response = await httpClient.GetAsync(link);
                if (!response.IsSuccessStatusCode)
                {
                    str.error = $"Trovata versione {_version} ma nessun file disponibile. Contattare Singular per assistenza.";
                    return Ok(str);
                }

                str.Esito = link;
                str.boolEsito = true;
            }
            catch (Exception ex) {
                str.error = ex.ToString();
            }

            return Ok(str);
        }

        #endregion
    }

}
