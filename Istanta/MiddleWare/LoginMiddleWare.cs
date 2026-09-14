using Istanta.Models;
using IstantaLib;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Newtonsoft.Json;
using System.Configuration;
//using System.Data.Entity;
using System.Diagnostics;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Security.Policy;

namespace Istanta.MiddleWare
{
    public class LoginResult
    {
        public bool login { get; set; }
        public string error { get; set; } = "";
    }

    public class LoginMiddleWare
    {

        private RequestDelegate _next;
        private string[] pagine = { "", "/" ,"/Tracciati", "/Confronti", "/SyncFoto","/Archivio", "/Aree", "/MenaboSettings", "/Etichette", "/DeclinazioniMeccaniche", "/FrameworkCss", "/TaskManager", "/AllineamentiBox" };
        private edro21_dbContext ctx;
        private readonly string olUrl;
        private readonly OlympusUserPolicyRequest[] olympusUserPolycy;
        private readonly string conn_string;
        private readonly HttpClient httpClient;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IDbContextFactory<edro21_dbContext> _dbContextFactory;
        public LoginMiddleWare(RequestDelegate next, IConfiguration configuration, IOptions<FicoConfig> olympusConf, IHttpClientFactory httpClietFactory, IServiceScopeFactory scopeFactory, IDbContextFactory<edro21_dbContext> dbContextFactory)
        {
            conn_string = configuration.GetConnectionString("IstandaConnectionDb")!;
            _next = next;

            olUrl = olympusConf.Value.olympusServerUrl;
            olympusUserPolycy = olympusConf.Value.userDataPolicy!;
            httpClient = httpClietFactory.CreateClient();
            
            this._dbContextFactory = dbContextFactory;
            this.ctx = this._dbContextFactory.CreateDbContext();
            //ctx = new edro21_dbContext(conn_string);
            _scopeFactory = scopeFactory;
        }

        public async Task Invoke(HttpContext context)
        {
            

            var req = context.Request;
            //Console.WriteLine($"nuova chiamata " + req.Path);
            //var pathBase = ("/" +req.PathBase != "" ? "/" + req.PathBase : "");

            if (
                req.Path.ToString().IndexOf("/Login")>=0 || req.Path.ToString() == "/Login" || req.Path.ToString() == "/LoginController/login" || req.Path.ToString() == "/LoginController/InviaEmailPerRecuperaPassword" || req.Path.ToString().IndexOf("/recuperoPassword")>=0 || req.Path.ToString()== "/LoginController/ResetPassword" || req.Path.ToString() == "/LoginController/getSession" || req.Path.ToString() == "/ping")
            {
                //Debug.WriteLine(req.Path);

                await _next(context);
            }
            else if (
                req.Path.ToString().IndexOf("/ACPV/")>=0 ||
                req.Path.ToString().IndexOf("/FicoProcess/") >= 0)
            {

                //Write log in console
                //Console.WriteLine(DateTime.Now.ToString("dd/MM/yyyy HH:mm:ss fff") + " -- " + req.Path);

                //Console.WriteLine($"{DateTime.Now.ToString("dd/MM/yyyy hh:mm:ss")} nuova chiamata " + req.Path);
                //Chiamata che può provenire da interno o da esterno al server

                if (SessionIstantaObject.GetSession(context) != "no session")
                {  
                    await _next(context);
                }
                else
                {
                    using (var scope = _scopeFactory.CreateScope())
                    {
                        //edro21_dbContext ctx = new edro21_dbContext(conn_string);
                        var ctx = scope.ServiceProvider.GetRequiredService<edro21_dbContext>();

                        //Non essendo un utente loggato internamente devo verificare tramite olympus se la chiave pubblica inviata è valida

                        try
                        {


                            context.Request.Headers.TryGetValue("Authorization", out var publicToken);
                            //Analizzo Bearer
                            if (publicToken.Count > 0)
                            {
                                publicToken = publicToken[0]!.Replace("Bearer ", "");
                            }
                            else
                            {
                                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                                context.Response.ContentType = "application/json";
                                await context.Response.WriteAsJsonAsync(new LoginResult() { login = false, error = "no_login public token empty" });
                                return;
                            }

                            string bearer = publicToken.ToString();
                            var request = new HttpRequestMessage(HttpMethod.Get, $"{olUrl}/auth/checkIdentity");
                            //Analizzo il bearer tramite chiamata ad Olympus
                            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", bearer);
                            //httpClient.DefaultRequestHeaders.Clear();
                            //try
                            //{
                            //    httpClient.DefaultRequestHeaders.Add("Authorization", "Bearer " + bearer);
                            //}
                            //catch { }

                            var response = await httpClient.SendAsync(request);//.GetAsync($"{olUrl}/auth/checkIdentity");
                            if (response.IsSuccessStatusCode)
                            {

                                var content = await response.Content.ReadAsStringAsync();
                                var utente = JsonConvert.DeserializeObject<OlympusChekIdentity>(content);

                                //Console.WriteLine("--->OK 1 : " + req.Path);

                                if (utente!.autorizzato)
                                {
                                    Int16 id_utente = 0;
                                    ////Appurato da Olympous che l'utente è conosciuto
                                    var userInternoInLoopback = await ctx.Utentis.FirstOrDefaultAsync(u => u.Email == utente.username);
                                    if (userInternoInLoopback != null)
                                    {
                                        id_utente = userInternoInLoopback.Id;
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

                                        uIstanta.NomeUtente =$"{uIstanta.Nome} {uIstanta.Cognome}";

                                        uIstanta.Email = utente.username;
                                        uIstanta.Password = "";
                                        uIstanta.Ruolo = (byte)utente.tipoUtente;
                                        uIstanta.Stato = (byte)statoUtente.FicoOAuth;
                                        uIstanta.Data_Registrazione = DateTime.Now;

                                        ctx.Add(uIstanta);
                                        //Inserire qui gestione dell'errore una volta messo campo email UNICO
                                        try
                                        {
                                            _ = await ctx.SaveChangesAsync();
                                            id_utente = uIstanta.Id;
                                        }
                                        catch (DbUpdateException ex)
                                        {
                                            // Gestione dell'errore in caso di email duplicata
                                            Console.WriteLine(ex.Message);
                                            //Tutto ok Qualcuno lo ha creato nel frattempo.
                                            // Pulisco il tracking dell'entità fallita.
                                            ctx.Entry(uIstanta).State = EntityState.Detached;

                                            var utenteEsistente = await ctx.Utentis
                                                .FirstOrDefaultAsync(u => u.Email == utente.username);

                                            id_utente = utenteEsistente.Id;
                                            //throw new Exception("Errore durante la registrazione dell'utente: email già esistente.", ex);
                                        }

                                        

                                    }

                                    //Console.WriteLine($"Guest autenticata con ID {id_utente}");

                                    //Per le policy di istnata faciamo che si crea automaticamente una session
                                    context.Session.SetString("id", id_utente.ToString());
                                    await _next(context);

                                }
                                else
                                {
                                    //Response with Unauthorized                                    
                                    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                                    context.Response.ContentType = "application/json";
                                    await context.Response.WriteAsJsonAsync(new LoginResult() { login = false, error = "no_login" });
                                    return;
                                }



                            }
                            else
                            {
                                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                                context.Response.ContentType = "application/json";
                                await context.Response.WriteAsJsonAsync(new LoginResult() { login = false, error = "no_login_byolympus" });
                                return;
                            }
                        }
                        catch (Exception ex)
                        {
                            //Console.WriteLine("--->NO OK " + ex.ToString());
                            context.Response.StatusCode = StatusCodes.Status400BadRequest;
                            context.Response.ContentType = "application/json";
                            await context.Response.WriteAsJsonAsync(new LoginResult() { login = false, error = "no_login:" + ex.ToString() });
                            return;

                        }
                    }

                }
            }
            else
            {
                if (SessionIstantaObject.GetSession(context) == "no session")
                {
                    if (pagine.Contains(req.Path.ToString()))
                    {
                        context.Response.Redirect(req.PathBase + "/Login");
                    }
                    else
                    {
                        context.Response.StatusCode = StatusCodes.Status400BadRequest;
                        context.Response.ContentType = "application/json";
                        await context.Response.WriteAsJsonAsync(new LoginResult() { login = false, error="no_login" });
                        return;
                    }
                }
                else
                {
                    await _next(context);
                }
            }


        }

    }

}
