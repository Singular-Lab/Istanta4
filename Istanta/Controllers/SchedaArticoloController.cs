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
                    Attiva = s.Attiva
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

        //[HttpPost]
        //[Route("SchedaArticolo/EditFoto/{id}")]
        //public async Task<IActionResult> Index(Int64 id, string check_primario, string check_selezione)
        //{
        //    ArticoliFoto? articolo_foto = await ctx.ArticoliFotos.Include(i=>i.IdArticoloNavigation).Where(a => a.Id == id).FirstOrDefaultAsync();

        //    bool is_primario = false;
        //    bool is_selezione = false;

        //    if (check_primario=="on")
        //    {
        //        //Devo togliere il primario vecchio se c'è
        //        is_primario = true;

        //        var foto_primaria = await this.ctx.ArticoliFotos.Where(f => f.IdArticolo == articolo_foto!.IdArticolo && f.StatoSelezione == (Byte)StatoSelezioneFoto.Primaria).FirstOrDefaultAsync();
        //        if (foto_primaria!=null)
        //        {
        //            foto_primaria.StatoSelezione = (Byte)StatoSelezioneFoto.NonSelezionata;
        //        }

        //    }
        //    else
        //    {
        //        if (articolo_foto!.StatoSelezione==(Byte)StatoSelezioneFoto.Primaria &&  this.ctx.ArticoliFotos.Where(f => f.IdArticolo != articolo_foto.IdArticolo && f.StatoSelezione == (Byte)StatoSelezioneFoto.Primaria).Count()<=0)
        //        {
        //            //Non ci sono altri primari oltre a questo.
        //            //Non possiamo permettere di perdere il primario
        //            return Redirect("~/SchedaArticolo?id=" + articolo_foto!.IdArticolo);
        //        }

        //    }


        //    if (check_selezione == "on")
        //    {
        //        //Devo togliere il primario vecchio se c'è
        //        is_selezione = true;
        //    }

        //    if (is_primario)
        //        articolo_foto!.StatoSelezione = (Byte)StatoSelezioneFoto.Primaria;
        //    else if (is_selezione)
        //        articolo_foto!.StatoSelezione = (Byte)StatoSelezioneFoto.Selezionata;
        //    else
        //        articolo_foto!.StatoSelezione = (Byte)StatoSelezioneFoto.NonSelezionata;

        //    if (is_primario)
        //    {
        //        //Disattivo tutti gli altri primari se ci sono
        //        foreach (var item in this.ctx.ArticoliFotos.Where(f => f.IdArticolo != articolo_foto.IdArticolo && f.StatoSelezione == (Byte)StatoSelezioneFoto.Primaria))
        //        {
        //            item.StatoSelezione = (Byte)StatoSelezioneFoto.NonSelezionata;
        //        }
        //    }

        //    this.ctx.SaveChanges();

        //    return Redirect("~/SchedaArticolo?id=" + articolo_foto!.IdArticolo);
        //}

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


        //[HttpPost]
        //[RequestSizeLimit(45454545454)]
        //[Route("SchedaArticolo/UploadFoto")]
        //public async Task<IActionResult> Upload2([FromForm] FileFoto file)
        //{
        //    string file_foto = file.file.FileName;

        //    Articoli artItem = await this.ctx.Articolis.Where(f => f.Id == file.idArticolo).FirstOrDefaultAsync();

        //    //Controllo che esista l'articolo
        //    if (artItem!=null)
        //    {

        //        string prima_parte = file_foto.Substring(0, file_foto.LastIndexOf(".")).Split('_')[0];
        //        if (prima_parte==artItem.Codice || prima_parte==artItem.Ean)
        //        {
        //            try
        //            {
        //                //Copio il file nella cartella di sync
        //                JObject o1 = JObject.Parse(System.IO.File.ReadAllText(this.path_external_source + "SourceUnita.json"));
        //                DbUnita archiviDB = o1.ToObject<DbUnita>();
        //                DbUnitaItem sync_folder = archiviDB.source.Where(s => s.syncFolder).FirstOrDefault();

        //                string jsonRequest = Newtonsoft.Json.JsonConvert.SerializeObject(sync_folder);
        //                Dictionary<string, object> req = Newtonsoft.Json.JsonConvert.DeserializeObject<Dictionary<string, object>>(jsonRequest);

        //                IstantaLib.PhotoManager phM = new IstantaLib.PhotoManager(new List<Dictionary<string, object>>() { req });

        //                using (MemoryStream fs = new MemoryStream())
        //                {
        //                    await file.file.CopyToAsync(fs);
        //                    phM.uploadSyncFile(fs.GetBuffer(), file.file.FileName);
        //                }

        //                DbUnitaItem web_folder = archiviDB.source.Where(s => s.webFolder).FirstOrDefault();
        //                DbUnitaItem alta_folder = archiviDB.source.Where(s => !s.webFolder && !s.syncFolder && !s.exportFolder).FirstOrDefault();
        //                //adesso che il file è salvato nella cartella, posso fare sync
        //                string syncFileResult = phM.sync(sync_folder.id, file.file.FileName, alta_folder.path, web_folder.path);

        //                SyncFile fileSynced = Newtonsoft.Json.JsonConvert.DeserializeObject<SyncFile>(syncFileResult);
        //                if (fileSynced.stato == StatoSyncFile.Synced)
        //                {
        //                    //Controllo record foto su db e nel caso aggiungo
        //                    ArticoliFoto fItem = await this.ctx.ArticoliFotos.Where(f => f.IdArticolo == file.idArticolo && f.NomeReale == file.file.FileName).FirstOrDefaultAsync();
        //                    if (fItem!=null)
        //                    {
        //                        fItem.DataModifica = DateTime.Now;
        //                        fItem.Hash = fileSynced.md5;
                               
        //                    }
        //                    else
        //                    {
        //                        fItem = new ArticoliFoto();
        //                        fItem.Attiva = true;
        //                        fItem.DataModifica = DateTime.Now;
        //                        fItem.DataInserimento = DateTime.Now;
        //                        fItem.NomeReale = file.file.FileName;
        //                        fItem.StatoSelezione = (Byte)StatoSelezioneFoto.Primaria;
        //                        fItem.PathFoto = alta_folder.path + "\\" + fItem.NomeReale;
        //                        fItem.IdArticolo = file.idArticolo;
        //                        this.ctx.ArticoliFotos.Add(fItem);
        //                    }

        //                    this.ctx.SaveChanges();
        //                }

        //            }
        //            catch(Exception ex)
        //            {
        //                ex.ToString();
        //            }

        //        }

        //    }
        //    else
        //    {

        //    }


        //    return Ok();
        //}

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
