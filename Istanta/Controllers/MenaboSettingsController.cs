using Microsoft.AspNetCore.Mvc;
using Istanta.Models;
using Microsoft.Extensions.Options;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System.Security.Cryptography.Xml;
using Istanta.Models_2;
using DocumentFormat.OpenXml.Office2010.Excel;
using LinqKit;
using Istanta.Utility;
using Microsoft.EntityFrameworkCore;

namespace Istanta.Controllers
{
    public class MenaboSettingsController : Controller
    {
        private readonly string extarnalSourcePath;
        private ExternalSourceClass exClass;
        private readonly ILogger<MastroController> _logger;
        private readonly Edro21_DbContext2 ctx2;

        private readonly IDbContextFactory<Edro21_DbContext2> _dbContextFactory2;
        public MenaboSettingsController(ILogger<MastroController> logger, IConfiguration configuration, IOptions<PathExternal> external_lib, IDbContextFactory<Edro21_DbContext2> dbContextFactory2)
        {
            this._dbContextFactory2 = dbContextFactory2;
            this.ctx2 = this._dbContextFactory2.CreateDbContext();
            _logger = logger;
            this.extarnalSourcePath = external_lib.Value.pathSource;
            exClass = new ExternalSourceClass(this.extarnalSourcePath, new string[] { /*"SourceMenabo", "SourceMenaboPagine"*/ });
        }


        public async Task<IActionResult> Index()
        {
            
            await this.Bind();

            return View();
        }

        [HttpPost]
        [Route("MenaboSettings/Update/{id}")]
        public async Task<IActionResult> Index(Int16 id, string Titolo, string Aree)
        {
            var edit = exClass.getMenaboById(id);//await this.ctx.Mastros.FindAsync(id);
            if (edit != null)
            {
                edit.Titolo = Titolo;
                edit.Aree = Aree.Split(",").ToList();
                exClass.editMenabo(edit);
            }

            await this.Bind();

            return Redirect("../../MenaboSettings");
        }

        [HttpGet]
        [Route("MenaboSettings/Delete/{id}")]
        public async Task<IActionResult> Index(Int16 id)
        {
            var item = exClass.getMenaboById(id);// await this.ctx.Mastros.FindAsync(id);
            if (item != null)
            {
                exClass.deleteMenabo(item);//this.ctx.Mastros.Remove(item);
                
            }

            return Redirect("../../MenaboSettings");
        }

        [HttpPost]
        [Route("MenaboSettings/Insert")]
        public async Task<IActionResult> Insert(string Titolo, string Aree)
        {
            DbMenaboItem schema = new DbMenaboItem();
            schema.Aree = Aree.Split(',').ToList();
            schema.Titolo = Titolo;

            exClass.addRegolaMenabo(schema);


            return Redirect("../MenaboSettings");
        }

        [HttpPut]
        [Route("MenaboSettings/salvaPaginaSchema/{id_schema}")]
        public async Task<IActionResult> salvaPaginaSchema(DbMenaboPagineItemPagina pagItem, Int64 id_schema)
        {
            BoolResult res = new BoolResult();

            var edit = exClass.getSchemaMenabo(id_schema);
            if (edit != null)
            {
                var pItem = edit.Pagine.Where(p => p.Numero == pagItem.Numero).FirstOrDefault();
                if (pItem != null)
                {
                    //Aggiorno mastro
                    pItem.IdMastro = pagItem.IdMastro;
                }
                else
                {
                    //Pagian nuova
                    edit.Pagine.Add(pagItem);

                }

                exClass.editSchemaMenabo(edit);
                res.Esito = true;
            }
            else
            {
                res.Esito = false;
                res.error = "Schema non trovato";
            }


            return Ok(res);
        }

        [HttpPut]
        [Route("MenaboSettings/eliminaPaginaSchema/{id_schema}")]
        public async Task<IActionResult> eliminaPaginaSchema(DbMenaboPagineItemPagina pagItem, Int64 id_schema)
        {
            BoolResult res = new BoolResult();

            var edit = exClass.getSchemaMenabo(id_schema);
            if (edit != null)
            {
                bool del = edit.Pagine.Remove(edit.Pagine.Where(p => p.Numero == pagItem.Numero).FirstOrDefault()!);
                if (del)
                {
                    exClass.editSchemaMenabo(edit);
                }

                res.Esito = del;
            }
            else
            {
                res.Esito = false;
                res.error = "Schema non trovato";
            }


            return Ok(res);
        }

        private async Task Bind()
        {
            var menabos =  exClass.getMenabos();
            ViewBag.ListaMenabo = menabos;

            List<DbMenaboPagineItem> schemi = new List<DbMenaboPagineItem>();
            foreach(var mItem in menabos)
            {
                var schema = exClass.getSchemaMenabo(mItem.IdMenaboPagine);
                schemi.Add(schema);
            }

            ViewBag.ListaSchemi = schemi;

            List<DbMastroItem> _listMastro = exClass.getMastro().source;//await this.ctx.Mastros.ToListAsync();
            this.ViewBag.ListaMastro = _listMastro;

            var formatiPagine = exClass.getFormatiPagina();
            ViewBag.FormatiPagina = formatiPagine;
        }

        public IActionResult Ordinamento()
        {
            return View("Ordinamento");
        }


        [HttpPost]
        [Route("MenaboSettings/salvaSchemaOrdinamento")]
        public async Task<IActionResult> salvaSchemaOrdinamento([FromForm] string schema)
        {
            BoolResult res = new BoolResult();

            try
            {
                if (schema == null)
                    throw new Exception("schema null");
                
                if (schema == "")
                    throw new Exception("schema empty");

                using (StreamWriter sw = new StreamWriter(this.extarnalSourcePath + "SourceOrdinamentoLista.json", false))
                {
                    sw.WriteLine(schema);
                }

                res.Esito = true;
            }
            catch(Exception ex)
            {
                res.error = ex.ToString();
                
            }


            return Ok(res);
        }

		[HttpPut]
		[Route("MenaboSettings/addRuleToClassificatoreUniversale")]
		public async Task<IActionResult> addRuleToClassificatoreUniversale(string bindingName, string definizione, string valoriDaCercare)
		{
			StringResult res = new StringResult();

			try
			{
                int newid = exClass.addRuleToClassificatore(bindingName, definizione, valoriDaCercare);

				res.Esito = newid.ToString();
			}
			catch (Exception ex)
			{
                res.Esito = "";
				res.error = ex.ToString();

			}


			return Ok(res);
		}

		[HttpPut]
		[Route("MenaboSettings/editRuleOfClassificatoreUniversale")]
		public async Task<IActionResult> editRuleOfClassificatoreUniversale(string bindingName, int id, string valoriDaCercare)
		{
			BoolResult res = new BoolResult();

			try
			{
				exClass.editRuleOfClassificatore(bindingName, id, valoriDaCercare);
                
				res.Esito = true;
			}
			catch (Exception ex)
			{
				res.error = ex.ToString();

			}


			return Ok(res);
		}

		[HttpPut]
		[Route("MenaboSettings/deleteRuleOfClassificatoreUniversale")]
		public async Task<IActionResult> deleteRuleOfClassificatoreUniversale(string bindingName, int id)
		{
			BoolResult res = new BoolResult();

			try
			{
                exClass.deleteRuleOfClassificatore(bindingName, id);

				res.Esito = true;
			}
			catch (Exception ex)
			{
				res.error = ex.ToString();

			}


			return Ok(res);
		}

        [HttpPut]
        [Route("MenaboSettings/addOrdinamento")]
        public async Task<IActionResult> addOrdinamento(string area, string settore, string reparto)
        {
            BoolResult res = new BoolResult();

            try
            {
                exClass.addOrdinamento(area, settore, reparto);

                res.Esito = true;
            }
            catch (Exception ex)
            {
                res.error = ex.ToString();

            }


            return Ok(res);
        }

        [HttpPut]
		[Route("MenaboSettings/editOrdinamentoUniversale")]
		public async Task<IActionResult> editOrdinamentoUniversale(int areaIndex, int settoreIndex, int repartoIndex, int newGlobalOrderIndex)
		{
			BoolResult res = new BoolResult();

			try
			{
				exClass.editOrdinamento(areaIndex, settoreIndex, repartoIndex, newGlobalOrderIndex);

				res.Esito = true;
			}
			catch (Exception ex)
			{
				res.error = ex.ToString();

			}


			return Ok(res);
		}

		[HttpPut]
		[Route("MenaboSettings/multiEditOrdinamentoUniversale")]
		public async Task<IActionResult> editOrdinamentoUniversale(JsonDbClassificazioneUniversale objList)
		{
			BoolResult res = new BoolResult();

            try
            {
                JsonDbClassificazioneUniversale ordinamento = exClass.getClassificazioneUniversale();
                int indiceMinimoNuovaLista = objList.lista.Min(n => n.orderIndex);
                int indiceMassimoNuovaLista = objList.lista.Max(n => n.orderIndex);

                // Trova gli elementi da spostare nella lista originale
                //var elementiDaSpostare = ordinamento.lista.Where(e => e.orderIndex >= indiceMinimoNuovaLista && e.orderIndex <= indiceMassimoNuovaLista).ToList();

                // Sposta gli indici degli elementi successivi agli elementi da spostare
                foreach (var elemento in ordinamento.lista.Where(e => e.orderIndex >= indiceMinimoNuovaLista))
                {
                    elemento.orderIndex += objList.lista.Count;
                }

                // Aggiorna gli indici degli elementi corrispondenti nella lista originale
                foreach (var elemento in objList.lista)
                {
                    var elementoOriginale = ordinamento.lista.Find(e => e.areaIndex == elemento.areaIndex && e.repartoIndex == elemento.repartoIndex && e.settoreIndex == elemento.settoreIndex && e.categoriaIndex == elemento.categoriaIndex);
                    if (elementoOriginale != null)
                    {
                        elementoOriginale.orderIndex = elemento.orderIndex;
                    }
                }
                ordinamento.lista = ordinamento.lista.OrderBy(f => f.orderIndex).ToList();
                // Riassegna gli indici in modo che siano contigui e progressivi
                int nuovoIndiceProgressivo = 1;
                foreach (var elemento in ordinamento.lista)
                {
                    elemento.orderIndex = nuovoIndiceProgressivo;
                    nuovoIndiceProgressivo++;
                }

                exClass.saveClassificazioneUniversale(ordinamento);
				res.Esito = true;
			}
            catch (Exception ex)
			{
				res.error = ex.ToString();
			}

			return Ok(res);
		}


		[HttpGet]
        [Route("MenaboSettings/salvaFormatiPagine/{formatiPagine}")]
        public async Task<IActionResult> salvaFormatiPagine(string formatiPagine)
        {
            BoolResult res = new BoolResult();

            try
            {
                List<string> listaFormati = formatiPagine.Split(',').ToList();
                exClass.saveFormatiPagina(listaFormati);
                res.Esito = true;
            }
            catch (Exception ex)
            {
                res.error = ex.ToString();
            }


            return Ok(res);
        }

        [HttpGet]
        [Route("MenaboSettings/creaOrdinamentoAutomatico")]
        public async Task<IActionResult> creaOrdinamentoAutomatico()
        {
            BoolResult res = new BoolResult();

            //Console.WriteLine($"MenaboSettings/creaOrdinamentoAutomatico -> INIZIO");

            try
            {
                JsonDbClassificazioneUniversale nuovaClassificazione = exClass.getClassificazioneUniversale();
                List<ClassificazioneUniversale> nuovoOrdinamento = new List<ClassificazioneUniversale>();
                List<string> listChiavi = new List<string>();
                if (nuovaClassificazione.bindings!.area!.campoMeta != null)
                    listChiavi.Add(nuovaClassificazione.bindings.area.campoMeta);
                else
                    listChiavi.Add("");

                if (nuovaClassificazione.bindings!.settore!.campoMeta != null)
                {
                    //Console.WriteLine($"MenaboSettings/creaOrdinamentoAutomatico -> {nuovaClassificazione.bindings.settore.campoMeta}");
                    listChiavi.Add(nuovaClassificazione.bindings.settore.campoMeta);
                }
                else
                    listChiavi.Add("");

                if (nuovaClassificazione.bindings!.reparto!.campoMeta != null)
					listChiavi.Add(nuovaClassificazione.bindings.reparto.campoMeta);
                else
                    listChiavi.Add("");

                if (nuovaClassificazione.bindings!.categoria!.campoMeta != null)
					listChiavi.Add(nuovaClassificazione.bindings.categoria.campoMeta);
                else
                    listChiavi.Add("");

                

                Dictionary<string, List<string>> valoriPerChiave = new Dictionary<string, List<string>>();

                var promoTracciatiRecords = this.ctx2.PromoTracciatiRecords.Select(x => x.Dato).ToList();
                List<JObject> datiList = new List<JObject>();

                //Console.WriteLine ($"MenaboSettings/creaOrdinamentoAutomatico analisi campione records-> {promoTracciatiRecords.Count}");

                foreach (var datoString in promoTracciatiRecords)
                {
                    JObject datoJson = JObject.Parse(datoString!);
                    datiList.Add(datoJson);

                    ////Console.WriteLine($"Contains key {listChiavi[1]}?{datoJson.ContainsKey(listChiavi[1])} = {datoJson[listChiavi[1]].ToString()}");

                    ClassificazioneUniversale nuovoElementoClassificazione = new ClassificazioneUniversale();
                    if (listChiavi.Count > 0 && listChiavi[0] != null && listChiavi[0] != "" && datoJson.ContainsKey(listChiavi[0]) && !string.IsNullOrWhiteSpace(datoJson[listChiavi[0]]!.ToString()))
                    {
                        nuovoElementoClassificazione.area = datoJson[listChiavi[0]]!.ToString().ToLower();
                    }
                    else
                    {
                        //continue;
                    }

                    if (listChiavi.Count > 1 && listChiavi[1] != null && listChiavi[1] != "" && datoJson.ContainsKey(listChiavi[1]) && !string.IsNullOrWhiteSpace(datoJson[listChiavi[1]]!.ToString()))
                    {
                        ////Console.WriteLine($"SETTORE -> {datoJson[listChiavi[1]].ToString()}");
                        nuovoElementoClassificazione.settore = datoJson[listChiavi[1]]!.ToString().ToLower();
                    }
                    else
                    {
                        //continue;
                    }

                    if (listChiavi.Count > 2 && listChiavi[2] != null && listChiavi[2] != "" && datoJson.ContainsKey(listChiavi[2]) && !string.IsNullOrWhiteSpace(datoJson[listChiavi[2]]!.ToString()))
                    {
                        nuovoElementoClassificazione.reparto = datoJson[listChiavi[2]]!.ToString().ToLower();
                    }
                    else
                    {
                        //continue;
                    }

                    if (listChiavi.Count > 3 && listChiavi[3] != null && listChiavi[3] != "" && datoJson.ContainsKey(listChiavi[3]) && !string.IsNullOrWhiteSpace(datoJson[listChiavi[3]]!.ToString()))
                    {
                        nuovoElementoClassificazione.categoria = datoJson[listChiavi[3]]!.ToString().ToLower();
                    }

                    if (nuovoElementoClassificazione.reparto == "049")
                    {
                        //Console.WriteLine();
                    }
                    if (nuovoElementoClassificazione.reparto == "053")
                    {
                        //Console.WriteLine();
                    }
                    if (nuovoElementoClassificazione.reparto == "094")
                    {
                        //Console.WriteLine();
                    }
                    if (nuovoElementoClassificazione.reparto == "108")
                    {
                        //Console.WriteLine();
                    }

                    bool elementoDuplicato = nuovoOrdinamento.Any(elem =>
    elem.area == nuovoElementoClassificazione.area &&
    elem.settore == nuovoElementoClassificazione.settore &&
    elem.reparto == nuovoElementoClassificazione.reparto &&
    elem.categoria == nuovoElementoClassificazione.categoria);

                    // Se non esiste un elemento duplicato, aggiungi il nuovo elemento all'ordinamento
                    if (!elementoDuplicato)
                    {
                        //Console.WriteLine($"NUOVO ORDINAMENTO -> {nuovoElementoClassificazione.settore}");
                        nuovoOrdinamento.Add(nuovoElementoClassificazione);
                    }
                }

				nuovoOrdinamento = nuovoOrdinamento
	.OrderBy(elem => elem.area)
	.ThenBy(elem => elem.settore)
	.ThenBy(elem => elem.reparto)
	.ThenBy(elem => elem.categoria)
	.ToList();

                int areaIndex = 0;
                string area = "";

                int settoreIndex = 0;
				string settore = "";

				int repartoIndex = 0;
				string reparto = "";

				int categoriaIndex = 0;
                string categoria = "";

                int orderIndex = 1;
				foreach (var item in nuovoOrdinamento)
                {
                    if (area != item.area)
                    {
                        areaIndex++;
                        area = item.area;
                        settoreIndex = 0;
						settore = "";
						repartoIndex = 0;
						reparto = "";
						categoriaIndex = 0;
						categoria = "";
					}
					if (settore != item.settore)
					{
						settoreIndex++;
						settore = item.settore;
						repartoIndex = 0;
						reparto = "";
						categoriaIndex = 0;
						categoria = "";
					}
					if (reparto != item.reparto)
					{
						repartoIndex++;
						reparto = item.reparto;
						categoriaIndex = 0;
						categoria = "";
					}
					if (categoria != item.categoria)
					{
						categoriaIndex++;
						categoria = item.categoria;
					}

                    item.areaIndex = areaIndex;
                    item.settoreIndex = settoreIndex;
                    item.repartoIndex = repartoIndex;
                    item.categoriaIndex = categoriaIndex;
                    item.orderIndex = orderIndex;
                    orderIndex++;
                }

                //Console.WriteLine("Salvo ordinamento!");
                if (nuovaClassificazione.lista != null && nuovaClassificazione.lista.Count > 0)
                {
                    int lastOrderIndex = nuovaClassificazione.lista.OrderByDescending(o => o.orderIndex).FirstOrDefault()!.orderIndex + 1;

                    //Devo integrare il nuovo con questa lista esistente senza rimuovere nulla di quello che già è stato fatto
                    foreach (var item in nuovoOrdinamento)
                    {
                        ClassificazioneUniversale? itemClass = nuovaClassificazione.lista.FirstOrDefault(n => n.area == item.area && n.settore == item.settore && n.reparto == item.reparto && n.categoria == item.categoria);
                        if (itemClass==null)
                        {
                            //Aggiungo l'elemento che non esiste
                            //nuovoOrdinamento.Add(item);
                            item.orderIndex = lastOrderIndex;
                            nuovaClassificazione.lista.Add(item);

                            lastOrderIndex++;
                        }
                        else
                        {
                            itemClass.repartoIndex = item.repartoIndex;
                            itemClass.settoreIndex = item.settoreIndex;
                            itemClass.areaIndex = item.areaIndex;
                            itemClass.categoriaIndex = item.categoriaIndex;
                        }
                    }
                }
                else
                {
                    nuovaClassificazione.lista = nuovoOrdinamento;
                }

                exClass.saveClassificazioneUniversale(nuovaClassificazione);

				res.Esito = true;
            }
            catch (Exception ex)
            {
                //Console.WriteLine(ex.ToString());

                res.error = ex.ToString();
            }


            //Console.WriteLine($"MenaboSettings/creaOrdinamentoAutomatico -> FINE");

            return Ok(res);
        }

        [HttpPut]
        [Route("MenaboSettings/salvaSourceJsonCode")]
        public async Task<IActionResult> salvaSourceJsonCodeForOrdinamentoLista([FromBody] SourceJsonRequest request)
        {
            BoolResult bRes = new BoolResult();

            if (request != null)
            {
                if (request.origin == "SourceOrdinamentoLista")
                {
                    bRes = SingletonConfiguration.dbOrdinamentoLista!.SetJsonSource(request.jsoncode);
                }
                else if (request.origin == "SourceNamingConvention")
                {
                    bRes = SingletonConfiguration.DBNamingConvention!.SetJsonSource(request.jsoncode);
                }
                else if (request.origin == "SourceTipiDiExport")
                {
                    bRes = SingletonConfiguration.DBTipiDiExport!.SetJsonSource(request.jsoncode);
                }
                else if (request.origin == "SourceFormati")
                {
                    bRes = SingletonConfiguration.DBFORMATI!.SetJsonSource(request.jsoncode);                    
                }
            }
            else
            {
                bRes.error = "Parametro null";
            }



            return Ok(bRes);
        }

        public IActionResult Formati()
        {
            return View("Formati");
        }
        public IActionResult TipiDiExport()
        {
            return View("TipiDiExport");
        }
        public IActionResult NamingConventions()
        {
            return View("NamingConventions");
        }
    }
}
