using Istanta.Models;
using Microsoft.AspNetCore.JsonPatch.Operations;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore.Query.Internal;
using Microsoft.Extensions.Options;
using Newtonsoft.Json;
using System.Configuration;
using System.Reflection.Emit;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Spreadsheet;
using System.Data.OleDb;
using DocumentFormat.OpenXml.Office2016.Excel;
using System.Runtime.Intrinsics.X86;
using ExcelDataReader;
using DocumentFormat.OpenXml.Bibliography;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Formats.Asn1;
using System.Xml;
using CsvHelper;
using System.ComponentModel.Design.Serialization;
using DocumentFormat.OpenXml.Drawing;
using System.Data;
using Istanta.Models_2;
using Newtonsoft.Json.Linq;
using System.Reflection;
using System.Security.Cryptography;
using DocumentFormat.OpenXml.Drawing.Charts;
using System.Runtime.Intrinsics.Arm;
using System.Net;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion.Internal;
using System.Linq;
using System.Security.Principal;
using IstantaLib;
using DocumentFormat.OpenXml.Vml;
using CsvHelper.Configuration;
using System.Globalization;
using System.Xml.Linq;
using LinqKit;
using System.Diagnostics;
using DocumentFormat.OpenXml.EMMA;
using System.Collections.Generic;
using Istanta.Utility;

namespace Istanta.Controllers
{
    public class OperationsController : Controller
    {
        private readonly string _path_to_export = "";
        private readonly string _path_to_import = "";
        private readonly string _path_external_lib = "";
        private readonly string _path_external_source = "";
        private readonly edro21_dbContext ctx;
        private readonly Edro21_DbContext2 ctx2;
        private readonly string _conn_string = "";
        private readonly string _ficoClientName = "";
        private readonly IDbContextFactory<edro21_dbContext> _dbContextFactory;

        private readonly IDbContextFactory<Edro21_DbContext2> _dbContextFactory2;
        public OperationsController(string conn_string, string path_to_import, string path_to_export, string external_lib = "", string external_source = "", string ficoClientName="", IDbContextFactory<edro21_dbContext> dbContextFactory=null, IDbContextFactory<Edro21_DbContext2> dbContextFactory2 = null)
        {
            this._dbContextFactory2 = dbContextFactory2;
            this.ctx = dbContextFactory.CreateDbContext();// new edro21_dbContext(conn_string);
            this.ctx2 = this._dbContextFactory2.CreateDbContext();

            this._path_to_export = path_to_export;
            this._path_to_import = path_to_import;

            this._conn_string = conn_string;

            this._path_external_lib = external_lib;
            this._path_external_source = external_source;

            this._ficoClientName = ficoClientName;

            this._dbContextFactory = dbContextFactory;
        }

        public IActionResult Index()
        {
            return View();
        }

        public async Task<IActionResult> Add(OperationRequest request)
        {
            BoolResult result = new BoolResult();

            try
            {
                //Test di registrazione operazione
                Attivitum att = new Attivitum();

                //Generazione del titolo
                string titolo = "";
                if (request.Command == OperationCommand.ImportazioneVol)
                {
                    titolo = "Importazione VOL " + ((InputFormTracciato)request.Packet!).filename;
                }
                else if (request.Command == OperationCommand.ImportazionePoP)
                {
                    //Operazione che in teoria dovrebbe non esistere più, dal momento che inizierà ad esistere la funzionalità di inegrazione e aggiornamento lista
                    titolo = "Importazione POP";
                }
                else if (request.Command == OperationCommand.EsportazioneVol)
                {
                    titolo = "Esportazione VOL";
                    InputForExport inExp = (InputForExport)request.Packet!;
                    if (inExp.fields!.ContainsKey("Titolo"))
                    {
                        titolo += " " + inExp.fields["Titolo"];
                    }
                }
                else if (request.Command == OperationCommand.ConfrontoLista)
                {

                }
                else if (request.Command == OperationCommand.SyncFoto)
                {
                    //Per il momento è implementato in maniera sincrona da SyncController
                }
                else if (request.Command == OperationCommand.CopiaFiles)
                {
                    InputForI_O io = (InputForI_O)request.Packet!;
                    titolo = "Copia files relativi a " + io.Titolo;
                    att.TipoProcesso = (Byte)TipoProcesso.FileSystem;

                }
                else if (request.Command == OperationCommand.EsportazionePoP)
                {
                    titolo = "Esportazione POP";
                    InputForExport inExp = (InputForExport)request.Packet!;
                    if (inExp.fields!.ContainsKey("Titolo"))
                    {
                        titolo += " " + inExp.fields["Titolo"];
                    }
                }
                else
                {
                    //Da capire se permetterla
                    titolo = "Azione sconosciuta";
                }


                string contract = JsonConvert.SerializeObject(request);



                att.Priorita = (Byte)0;//Viene assegnata successivamente dall'utente se vuole
                att.Progress = 0;
                att.Stato = (Byte)OperationStauts.InAttesaDiAssegnazione;
                if (request.RichiestaAutorizzazioneUtenteIstantanea)
                    att.Stato = (Byte)OperationStauts.InAttesaDiConfermaUtente;

                att.DataInserimento = DateTime.Now;
                att.Contract = contract;
                att.Tipo = (Byte)request.Command;
                att.Titolo = titolo;
                if (request.AttivitaParent > 0)
                    att.IdParent = request.AttivitaParent;


                //Controllo coda e assegnazione eventuale a seconda del tipo di peso di attività
                Byte[] operation_queue = getFamigliaOperativa(request.Command);

                Console.WriteLine($"Add Operation step 1 {String.Join(',',operation_queue)}");

                //var _attivita_in_corso = this.ctx.Attivita.Where(a => a.Stato != (Byte)OperationStauts.Terminata && a.Stato != (Byte)OperationStauts.TerminataConErrori && operation_queue.Contains<Byte>(a.Tipo)).ToList();
                var _attivita_in_corso = this.ctx.Attivita.Where(a => a.Stato != (Byte)OperationStauts.Terminata && a.Stato != (Byte)OperationStauts.TerminataConErrori).ToList();
                Attivitum? _last_in_coda = _attivita_in_corso.OrderByDescending(ord => ord.Coda).FirstOrDefault();
                
                Console.WriteLine($"Add Operation step 2");


                if (_last_in_coda != null)
                {
                    if (_last_in_coda!.Coda > 0)
                    {
                        //L'operazione corrente si accoda all'ultima
                        att.Coda = (Byte)(_last_in_coda!.Coda + 1);
                    }
                    else
                    {
                        int _simultaneous = (int)getSimultaneousFactor(request.Command);
                        if (_simultaneous - _attivita_in_corso.Count <= 0)
                        {
                            att.Coda = (Byte)(_attivita_in_corso.Count - _simultaneous + 1);
                        }
                        else
                        {
                            att.Coda = (Byte)0;
                        }

                    }
                }
                else
                {
                    //Nessuna operazione davanti
                    att.Coda = (Byte)0;
                }

                Console.WriteLine($"Add Operation step 3");
                await this.ctx.Attivita.AddAsync(att);
                await this.ctx.SaveChangesAsync();

                request.AttivitaAssegnata = att.Id;
                contract = JsonConvert.SerializeObject(request);
                att.Contract = contract;

                Console.WriteLine($"Add Operation step 4");

                await this.ctx.SaveChangesAsync();


                return Ok(att);

            }
            catch (Exception ex)
            {
                Console.WriteLine($"Errore OperationsController.Add: {ex.ToString()}");

                result.Esito = false;
                result.errorCode = ErrorCodes.Generic;
                result.error = ex.ToString();

            }


            return Ok(result);
        }

        public async Task<IActionResult> EseguiByID(Int64 id)
        {
            AttivitaResult result = new AttivitaResult();
            try
            {
                var _item = await this.ctx.Attivita.Include(i => i.IdParentNavigation).Where(p => p.Id == id).FirstOrDefaultAsync();
                if (_item != null)
                {
                    OperationRequest? opReq = JsonConvert.DeserializeObject<OperationRequest>(_item!.Contract);
                    string? strpkg = opReq!.Packet.ToString();


                    //var fotoArr = JsonConvert.DeserializeObject<Array>("");
                    //Response.Write("FOTO TROVATE: " + fotoArr.GetType().Name.Name);


                    if (_item.Tipo == (Byte)OperationCommand.ImportazioneVol /*|| _item.Tipo == (Byte)OperationCommand.ImportazionePoP*/)
                    {
                        InputFormTracciato? packet = JsonConvert.DeserializeObject<InputFormTracciato>(strpkg!);
                        if (packet != null)
                        {

                            OkObjectResult _import_result = (OkObjectResult)await importaVolantino(opReq.AttivitaAssegnata, packet, opReq!.context, true, false);
                            if (_import_result.Value is AttivitaResult)
                            {
                                result = (AttivitaResult)_import_result.Value;
                            }
                        }

                    }
                    //else if (_item.Tipo == (Byte)OperationCommand.EsportazioneVol || _item.Tipo == (Byte)OperationCommand.EsportazionePoP)
                    //{
                    //    InputForExport? packet = JsonConvert.DeserializeObject<InputForExport>(strpkg);
                    //    if (packet != null)
                    //    {
                    //        if (_item.Tipo == (Byte)OperationCommand.EsportazioneVol)
                    //        {
                    //            OkObjectResult _exp_result = (OkObjectResult)await esportaVolantino(opReq.AttivitaAssegnata, packet);
                    //            if (_exp_result.Value is AttivitaResult)
                    //            {
                    //                result = (AttivitaResult)_exp_result.Value;
                    //            }
                    //        }
                    //        else
                    //        {
                    //            OkObjectResult _exp_result = (OkObjectResult)await esportaPoP(opReq.AttivitaAssegnata, packet);
                    //            if (_exp_result.Value is AttivitaResult)
                    //            {
                    //                result = (AttivitaResult)_exp_result.Value;
                    //            }
                    //        }
                    //    }
                    //}
                    //else if (_item.Tipo == (Byte)OperationCommand.CopiaFiles)
                    //{
                    //    InputForI_O? packet = JsonConvert.DeserializeObject<InputForI_O>(strpkg);
                    //    if (packet != null)
                    //    {
                    //        OkObjectResult _exp_result = (OkObjectResult)await copiaFiles(opReq.AttivitaAssegnata, packet);
                    //        if (_exp_result.Value is AttivitaResult)
                    //        {
                    //            result = (AttivitaResult)_exp_result.Value;
                    //        }
                    //    }
                    //}


                }
                else
                {
                    //result.Esito = false;
                    result.errorCode = ErrorCodes.ItemNotFound;
                    result.error = "Attività non trovata";
                }
            }
            catch (Exception ex)
            {
                result.error = ex.ToString();
            }

            return Ok(result);
        }

        private async Task<IActionResult> importaVolantino(Int64 id_attivita, InputFormTracciato pkg, List<FicoContextField> context, bool persistent, bool report)
        {

            AttivitaResult res = new AttivitaResult();
            IstantaController icItem = new IstantaController(this._conn_string,"","", this._dbContextFactory);

            edro21_dbContext ctx_1 = this._dbContextFactory.CreateDbContext();//new edro21_dbContext(this._conn_string);
            Edro21_DbContext2 ctx_2 = this._dbContextFactory2.CreateDbContext();

            try
            {
                System.Globalization.CultureInfo culture = new System.Globalization.CultureInfo("it-IT");


                BoolResult result = new BoolResult();               

                string path_attivita = _path_to_import + id_attivita + System.IO.Path.DirectorySeparatorChar;
                string source = path_attivita + pkg.filename;



                res.Attivita = ctx_1.Attivita.Find(id_attivita)!;
                res.Attivita.Stato = (Byte)OperationStauts.ElaborazioneDati;
                res.Attivita.DataInizio = DateTime.Now;
                //ctx_1.SaveChanges();
                _=await ctx_1.SaveChangesAsync();

                if (!pkg.persistent && !pkg.askReport)
                    throw new Exception("Non è possibile eseguire l'importazione senza report e senza persistente");


                int idAdstr;
                Int32.TryParse(pkg.getFieldByKey("idAddestramento"), out idAdstr);
                
                //Recupero lo schema di addestramento
                AddestramentoExcel? addestramento = await ctx_2.AddestramentoExcels.Include(i => i.SchemaCampiExcels).ThenInclude(i2 => i2.AddestramentoExcelRelazionis).Where(a => a.Id == idAdstr).FirstOrDefaultAsync();
                List<SchemaCampiExcel> _campi = addestramento!.SchemaCampiExcels.ToList();

                string kRefCod = Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice;
                string kRefEan = Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefEan;

                string kDescr1 = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr1;
                string kDescr2 = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr2;
                string kDescr3 = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr3;
                string kDescr4 = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr4;
                string kDescr1Gruppo = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr1Gruppo;
                string kDescr2Gruppo = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr2Gruppo;
                string kDescr3Gruppo = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr3Gruppo;
                string kDescr4Gruppo = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr4Gruppo;
                string kCodGruppo = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppo;

                //string kSelezioneMenabo = GLOBAL_VARIABLES.keySelezioneMenabo;

                string kDescrUm = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescrUm;
                string kDescrPeso = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescrPeso;

                string kFoto = Enum.GetName(AddestramentoRuoli.Foto) + "." + GLOBAL_VARIABLES.keyFotoNome;

                SchemaCampiExcel cRefCod = _campi.Where(c => c.NomeColonna == kRefCod).FirstOrDefault()!;
                SchemaCampiExcel cRefEan = _campi.Where(c => c.NomeColonna == kRefEan).FirstOrDefault()!;

                //if (addestramento.externalCallPerImport == null)
                //{
                //    throw new Exception("interpreteImportNonDefinito");
                //}
                //if (addestramento.esportaSubito && addestramento.externalCallPerExport == null)
                //{
                //    throw new Exception("interpreteExportNonDefinito");
                //}

                //Campi aggiuntivi riferiti al processo di importazione (Durante o a fine)
                List<SchemaCampiExcel> campi_aggiuntivi = addestramento.SchemaCampiExcels.Where(
                    ce => ce.AddestramentoExcelRelazionis.Count > 0 &&
                    (ce.AddestramentoExcelRelazionis.FirstOrDefault()!.TipoCompilazione == (Byte)TipoCompilazione.DuranteImportazione || ce.AddestramentoExcelRelazionis.FirstOrDefault()!.TipoCompilazione == (Byte)TipoCompilazione.FineImportazione)).ToList();


                try
                {


                    //Recupero import
                    PromoImportazioni? pImp = ctx_2.PromoImportazionis.Where(imp=>imp.Id==pkg.idImportazione).FirstOrDefault();
                    //this.ctx2.SaveChanges();
                    Promo? promoItem = ctx_2.Promos.Where(p => p.Id == pImp!.IdPromo).FirstOrDefault();

                    //Adesso leggo lo schema
                    bool headerIsFound = false;

                    List<Dictionary<string, object>> tracciato = new List<Dictionary<string, object>>();


                    //JObject o1 = JObject.Parse(System.IO.File.ReadAllText(this._path_external_source + "SourceAree.json"));
                    //DbAree areeDB = o1.ToObject<DbAree>();
                    //List<Aree> aree = areeDB.source;

                    IstantaController icCtrl = new IstantaController("", this._path_external_lib, this._path_external_source, this._dbContextFactory);

                    List<Articoli> _articoli_cache = new List<Articoli>();

                    double media_processo_item = 0;
                    int count_items = 0;

                    string nome_colonna_scatto = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodice;
                    string nome_colonna_codGruppo = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppo;

                    Int16 lettura_tot_perc = 80;

                    res.Attivita.Progress = 0;
                    res.Attivita.StatoMsg = "Inizio lettura del file excel";
                    //ctx_1.SaveChanges();
                    _ = await ctx_1.SaveChangesAsync();



                    using (var stream = System.IO.File.Open(source, FileMode.Open, FileAccess.Read))
                    {
                        using (var reader = ExcelReaderFactory.CreateReader(stream))
                        {
                            int count = 0;
                            //int count_elaborati = 0;

                            int totRows = reader.RowCount;
                            Int16 perc_prog_lettura = 0;

                            while (reader.Read())
                            {
                                count++;

                                if (count == 170)
                                    "break".ToString();

                                Int16 _new_prog = (Int16)(((decimal)count / (decimal)totRows) * 100);
                                if (_new_prog - perc_prog_lettura >= GLOBAL_VARIABLES.updateToPercentageRange)
                                {
                                    perc_prog_lettura = _new_prog;
                                    res.Attivita.Progress = (Int16)(lettura_tot_perc * ((decimal)perc_prog_lettura / 100));
                                    res.Attivita.StatoMsg = "Lettura lista " + count + "/" + totRows;
                                    //ctx_1.SaveChanges();
                                    _ = await ctx_1.SaveChangesAsync();
                                }

                                DateTime inizio_processo_item = DateTime.Now;

                                Dictionary<string, object> rec = new Dictionary<string, object>();

                                int fieldRead = 0;

                                Articoli? artRecord = null;

                                //Intanto metto subito con quale excel è stato importato questo record
                                rec[GLOBAL_VARIABLES_FICO.keyXlsxTracciato] = pImp.NomeFile;

                                bool rowInvalidated = false;

                                for (int c = 0; c < reader.FieldCount; c++)
                                {
                                    fieldRead++;

                                    if (!headerIsFound)
                                    {

                                    }
                                    else
                                    {
                                        SchemaCampiExcel? schema_campo = _campi.Where(f => f.Indice == c).FirstOrDefault();

                                        if (schema_campo != null && schema_campo.NomeColonna != null)
                                        {
                                            //Analisi del nome della colonna
                                            string scope = "";
                                            string scope_chiave = "";
                                            if (schema_campo.NomeColonna.IndexOf(".") > 0)
                                            {
                                                //Campo strutturale
                                                string[] scopes = schema_campo.NomeColonna.Split('.');
                                                scope = scopes[0];
                                                scope_chiave = scopes[1];
                                            }


                                            string? _val = "";
                                            if (!reader.IsDBNull(c))
                                                _val = reader.GetValue(c).ToString();

                                            /*if (schema_campo.Ruolo == Enum.GetName(AddestramentoRuoli.Scatto))
                                            {
                                                nome_colonna_scatto = schema_campo.NomeColonna;
                                            }*/

                                            if (_val == "6541593")
                                            {
                                                "stop".ToString();
                                            }


                                            try
                                            {
                                                rec[schema_campo.NomeColonna] = icCtrl.parseAddesttramentoValue(_val!, schema_campo);
                                            }
                                            catch(Exception ex)
                                            {
                                                throw new Exception($"Errore di conversione campo Campo {schema_campo.NomeColonna}, valore: {_val} tipo {schema_campo.TipoDato}: error {ex.ToString()}");
                                            }


                                            if (scope != "")
                                            {
                                                //Altro ragionamento, basato su unità logiche
                                                if (scope == Enum.GetName(AddestramentoRuoli.Area))
                                                {
                                                    //if (scope_chiave == GLOBAL_VARIABLES.keyAreaCodice)
                                                    //{
                                                    //    Aree aItem = aree.Where(a => a.Area == _val).FirstOrDefault();
                                                    //    var dict = new Dictionary<string, object>();
                                                    //    dict.Add(GLOBAL_VARIABLES.keyAreaCodice, aItem!.Area);
                                                    //    dict.Add("Id", aItem!.Id);

                                                    //    rec[scope] = dict;

                                                    //}
                                                    //else
                                                    //{
                                                    //    if (rec[scope] != null)
                                                    //    {
                                                    //        (rec[scope] as Dictionary<string, object>).Add(scope_chiave, icCtrl.parseAddesttramentoValue(_val, schema_campo));
                                                    //    }
                                                    //}

                                                    /*if (!rec.ContainsKey("Area"))
                                                        rec["Area"] = new Dictionary<string, object>();

                                                    (rec["Area"] as Dictionary<string, object>).Add(scope_chiave, _val);*/
                                                }
                                                else if (scope == Enum.GetName(AddestramentoRuoli.Referenza))
                                                {
                                                    if (artRecord == null)
                                                    {
                                                        if (scope_chiave == GLOBAL_VARIABLES.keyRefCodice)
                                                        {
                                                            //if (_val == "")
                                                            //{
                                                            //    //Codice ref non presente, la lettura si interrompe
                                                            //    rec = new Dictionary<string, object>();
                                                            //    break;
                                                            //}

                                                            if (_val == "7784854")
                                                            {
                                                                "stop".ToString();
                                                            }

                                                            if (_val != "")
                                                            {
                                                              
                                                                artRecord = _articoli_cache.Where(ac => ac.Codice == _val).FirstOrDefault();
                                                                if (artRecord == null)
                                                                {
                                                                    artRecord = ctx_1.Articolis.Where(a => a.Codice == _val).FirstOrDefault();
                                                                    if (artRecord != null)
                                                                        _articoli_cache.Add(artRecord);
                                                                }
                                                                else
                                                                {
                                                                    //E' stato prse da un EAN o un ID. Controllo di congruenza del codice
                                                                    if (artRecord.Codice!=_val)
                                                                    {
                                                                        rowInvalidated = true;
                                                                        break;
                                                                    }
                                                                }
                                                            }
                                                            else
                                                            {
                                                                //SE IL COD REF è vuoto, è possibile che sia 
                                                                //. Un separatore nell'excel, per cui un record da scartare probabilmente
                                                                //. Puo però anche essere un separatore di GRUPPO. (es. ARENA)
                                                                //Per cui non è crretto interrompere la lettura, bensì è meglio passare il tutto al custom che al più deciderà lui di filtrare/interpretare/elimianare come meglio crede

                                                                rowInvalidated = true;
                                                                break;
                                                            }
                                                        }
                                                        else if (scope_chiave == GLOBAL_VARIABLES.keyRefId)
                                                        {                                                           
                                                            artRecord = ctx_1.Articolis.Where(a => a.Id == Int64.Parse(_val!)).FirstOrDefault();
                                                        }
                                                        else if (scope_chiave == GLOBAL_VARIABLES.keyRefEan)
                                                        {
                                                            if (_val != "")
                                                            {

                                                                if (_val == "8057018222537")
                                                                    "stop".ToString();

                                                                artRecord = _articoli_cache.Where(ac => ac.Ean == _val).FirstOrDefault();
                                                                if (artRecord == null)
                                                                {
                                                                    artRecord = ctx_1.Articolis.Where(a => a.Ean == _val).FirstOrDefault();
                                                                    if (artRecord != null)
                                                                    {
                                                                        //Se ho già letto il codice ref di questa riga, devo verificare se corrisponde con questo articolo preso con EAN
                                                                        //PERO rispndo a distanza di tempo, questa regola NON va più bene.
                                                                        //In seguito al cliente PAC che forma il codice REF combinando il campo primario Referenza.Codice con un altro cod ext
                                                                        //viene meno questo controllo perchè im questo momento (non conoscendo l'elaborazione finale del codice) NON puo invalidare questo codice che è temporaneo
                                                                        if (rec.ContainsKey(kRefCod))
                                                                        {
                                                                            //if (rec[kRefCod].ToString()!=artRecord.Codice)
                                                                            //{
                                                                            //    rowInvalidated = true;
                                                                            //    break;
                                                                            //}
                                                                        }
                                                                        else
                                                                            _articoli_cache.Add(artRecord);
                                                                    }
                                                                }
 
                                                            }
                                                        }
                                                    }
                                                    else
                                                    {
                                                        if (scope_chiave == GLOBAL_VARIABLES.keyRefEan)
                                                        {
                                                            if (_val!.Length>30)
                                                            {
                                                                _val = _val.Substring(0, 30);
                                                            }    
                                                            artRecord.Ean = _val;
                                                            //ctx_1.SaveChanges();
                                                            _ = await ctx_1.SaveChangesAsync();
                                                        }
                                                    }

                                                    //A seguito di cambi importanti apportati al progetto, si è rivelato inutile salvare questa informazione sul record
                                                    //Aumenta il peso e da una info ridondante che puo essere rintracciata a partire da codice.
                                                    //Sembrerebbe più comodo esporre l'ID diretto dell'archivio ma ai fini di indicizzazione avremmo due dati forti: codice e ID. A quale dare retta? CAOS
                                                    //if (artRecord != null && !rec.ContainsKey(scope))
                                                    //{
                                                        //var artRecordToSerialize = new { 
                                                        //    Id=artRecord.Id,
                                                        //    Codice = artRecord.Codice, 
                                                        //    Descrizione1 = artRecord.Descrizione1,
                                                        //    Descrizione2 = artRecord.Descrizione2,
                                                        //    Descrizione3 = artRecord.Descrizione3,
                                                        //    Descrizione4 = artRecord.Descrizione4
                                                        //};
                                                        //string refJson = JsonConvert.SerializeObject(artRecordToSerialize);
                                                        //rec.Add(scope, JsonConvert.DeserializeObject<Dictionary<string, object>>(refJson));
                                                    //}

                                                }
                                                else if (scope == Enum.GetName(AddestramentoRuoli.Descrizioni))
                                                {
                                                    //if (!rec.ContainsKey(scope))
                                                    //{
                                                    //    rec.Add(scope, new Dictionary<string, object>());
                                                    //}

                                                    //(rec[scope] as Dictionary<string, object>).Add(scope_chiave, _val);
                                                }
                                            }
                                        }
                                    }

                                }

                                if (!rowInvalidated)
                                {

                                    if (headerIsFound)
                                    {
                                        media_processo_item += DateTime.Now.Subtract(inizio_processo_item).TotalMilliseconds;

                                        count_items++;
                                        /*if (count_items >= 100)
                                        {
                                            break;
                                        }*/
                                    }

                                    if (fieldRead > 0)
                                        headerIsFound = true;

                                    if (rec.Keys.Count > 0)
                                    {
                                        //if (triedToFindRef && artRecord == null)
                                        //{
                                        //    //Nonostante il tentativo di cercare la ref corrisponendete in archivio, il sistema non
                                        //    //ha trovato niente, è quindi il momento di creare la ref vuota con il codice e ean specificato
                                        //    //SEMPRE se il codice referenza NON è vuoto
                                        //    //E aggiornare il record del tracciato


                                        //    //SchemaCampiExcel cRefCod = _campi.Where(c => c.NomeColonna == kRefCod).FirstOrDefault();
                                        //    //SchemaCampiExcel cRefEan = _campi.Where(c => c.NomeColonna == kRefEan).FirstOrDefault();

                                        //    if (cRefCod != null && rec[kRefCod].ToString() != "")
                                        //    {
                                        //        if (rec.ContainsKey(kRefEan) && rec[kRefEan].ToString().Length > 30)
                                        //        {
                                        //            rec[kRefEan] = rec[kRefEan].ToString().Substring(0, 30);
                                        //        }

                                        //        artRecord = new Articoli();
                                        //        artRecord.Descrizione1 = "";
                                        //        artRecord.Descrizione2 = "";
                                        //        artRecord.Descrizione3 = "";
                                        //        artRecord.Descrizione4 = "";
                                        //        artRecord.Codice = rec[kRefCod].ToString();
                                        //        if (cRefEan != null && rec.ContainsKey(kRefEan))
                                        //        {
                                        //            artRecord.Ean = rec[kRefEan].ToString();
                                        //        }
                                        //        artRecord.StatoRevisione = (Byte)StatoRevisioneArticolo.NonProcessato;
                                        //        artRecord.DataInserimento = DateTime.Now;
                                        //        this.ctx.Articolis.Add(artRecord);
                                        //        this.ctx.SaveChanges();

                                        //        _articoli_cache.Add(artRecord);
                                        //        string refJson = JsonConvert.SerializeObject(artRecord);

                                        //        //Inserito il NUOVO articolo, è anche il caso di fare una revisione senza valenza di firma per far si che venga cmq ricontrollato dall'operatore
                                        //        //Ma almeno potrebbe essere facilitato e velocizzato il meccanismo di revisione
                                        //        //Questo sempre e solo se espone almeno uno dei 4 campi descrittivi base 
                                        //        if (rec.ContainsKey(kDescr1) || rec.ContainsKey(kDescr2) || rec.ContainsKey(kDescr3) || rec.ContainsKey(kDescr4))
                                        //        {
                                        //            ArticoliDescrizioni ad = new ArticoliDescrizioni();

                                        //            ad.Descrizione1 = rec.ContainsKey(kDescr1) ? rec[kDescr1].ToString() : "";
                                        //            ad.Descrizione2 = rec.ContainsKey(kDescr2) ? rec[kDescr2].ToString() : "";
                                        //            ad.Descrizione3 = rec.ContainsKey(kDescr3) ? rec[kDescr3].ToString() : "";
                                        //            ad.Descrizione4 = rec.ContainsKey(kDescr4) ? rec[kDescr4].ToString() : "";
                                        //            ad.Um = rec.ContainsKey(kDescrUm) ? rec[kDescrUm].ToString() : "";
                                        //            if (rec.ContainsKey(kDescrPeso))
                                        //                ad.Peso = (decimal)rec[kDescrPeso];
                                        //            ad.Approvata = false;
                                        //            ad.DataUltimaRicezione = DateTime.Now;
                                        //            ad.IdArticolo = artRecord.Id;
                                        //            this.ctx.Add(ad);
                                        //            this.ctx.SaveChanges();
                                        //        }




                                        //        rec.Add(Enum.GetName(AddestramentoRuoli.Referenza), JsonConvert.DeserializeObject<Dictionary<string, object>>(refJson));

                                        //    }
                                        //}
                                        //else if (artRecord != null)
                                        //{
                                        //    //Vediamo se ho da aggiornare qualche campo
                                        //    //L'ean per adesso è l'unico campo rimasto indietro e da controllare
                                        //    if (cRefEan != null && rec.ContainsKey(kRefEan))
                                        //    {
                                        //        if (rec[kRefEan].ToString().Length > 30)
                                        //        {
                                        //            rec[kRefEan] = rec[kRefEan].ToString().Substring(0, 30);
                                        //        }

                                        //        if (artRecord.Ean != rec[kRefEan].ToString())
                                        //        {
                                        //            if (rec[kRefEan].ToString().Length <= 30)
                                        //            {
                                        //                artRecord.Ean = rec[kRefEan].ToString();
                                        //                artRecord.DataModifica = DateTime.Now;
                                        //                this.ctx.SaveChanges();
                                        //            }
                                        //        }
                                        //    }

                                        //    if (pkg.AutoRevisione)
                                        //    {
                                        //        ArticoliDescrizioni ad = this.ctx.ArticoliDescrizionis.Where(a => a.IdArticolo == artRecord.Id && a.Area == null && a.Canale == null).FirstOrDefault();
                                        //        if (ad != null)
                                        //        {
                                        //            ad.Descrizione1 = rec.ContainsKey(kDescr1) ? rec[kDescr1].ToString() : "";
                                        //            ad.Descrizione2 = rec.ContainsKey(kDescr2) ? rec[kDescr2].ToString() : "";
                                        //            ad.Descrizione3 = rec.ContainsKey(kDescr3) ? rec[kDescr3].ToString() : "";
                                        //            ad.Descrizione4 = rec.ContainsKey(kDescr4) ? rec[kDescr4].ToString() : "";
                                        //            ad.Um = rec.ContainsKey(kDescrUm) ? rec[kDescrUm].ToString() : "";
                                        //            if (rec.ContainsKey(kDescrPeso))
                                        //                ad.Peso = (decimal)rec[kDescr1];

                                        //            this.ctx.SaveChanges();
                                        //        }
                                        //        else
                                        //        {
                                        //            //Questa è una condizione che non dovrebbe MAI avverarsi MA allo stato attuale che prevede, per gli articoli inseriti per la prma volta, già una revisione automatica.
                                        //            //MA per roba del passato? Quindi meglio ridondare il processo
                                        //            ad = new ArticoliDescrizioni();

                                        //            ad.Descrizione1 = rec.ContainsKey(kDescr1) ? rec[kDescr1].ToString() : "";
                                        //            ad.Descrizione2 = rec.ContainsKey(kDescr2) ? rec[kDescr2].ToString() : "";
                                        //            ad.Descrizione3 = rec.ContainsKey(kDescr3) ? rec[kDescr3].ToString() : "";
                                        //            ad.Descrizione4 = rec.ContainsKey(kDescr4) ? rec[kDescr4].ToString() : "";
                                        //            ad.Um = rec.ContainsKey(kDescrUm) ? rec[kDescrUm].ToString() : "";
                                        //            if (rec.ContainsKey(kDescrPeso))
                                        //                ad.Peso = (decimal)rec[kDescr1];
                                        //            ad.Approvata = false;
                                        //            ad.DataUltimaRicezione = DateTime.Now;
                                        //            ad.IdArticolo = artRecord.Id;
                                        //            this.ctx.Add(ad);
                                        //            this.ctx.SaveChanges();
                                        //        }

                                        //    }

                                        //}

                                        if (rec.ContainsKey(kRefCod))
                                        {
                                            #region Descrizione gruppo

                                            //Verifico se tale referenza dichiara una descrizione gruppo proveniente da lista

                                            //if (rec.ContainsKey(kCodGruppo) &&
                                            //    (rec.ContainsKey(kDescr1Gruppo) || rec.ContainsKey(kDescr2Gruppo) || rec.ContainsKey(kDescr3Gruppo) || rec.ContainsKey(kDescr4Gruppo)))
                                            //{
                                            //    //Ne specifica una, adesso vediamo se esiste un gruppo così già revisionato. 
                                            //    //Se non esiste allora è corretto inserirlo per comodità
                                            //    string codGruppo = rec[kCodGruppo].ToString();
                                            //    var descrGruppoRevisione = this.ctx.ArticoliDescrizionis.Where(ad => ad.CodiceGruppo == codGruppo && ad.Area == null && ad.Canale == null).FirstOrDefault();
                                            //    if (descrGruppoRevisione == null)
                                            //    {
                                            //        ArticoliDescrizioni ad = new ArticoliDescrizioni();

                                            //        ad.Descrizione1 = rec.ContainsKey(kDescr1Gruppo) ? rec[kDescr1Gruppo].ToString() : "";
                                            //        ad.Descrizione2 = rec.ContainsKey(kDescr2Gruppo) ? rec[kDescr2Gruppo].ToString() : "";
                                            //        ad.Descrizione3 = rec.ContainsKey(kDescr3Gruppo) ? rec[kDescr3Gruppo].ToString() : "";
                                            //        ad.Descrizione4 = rec.ContainsKey(kDescr4Gruppo) ? rec[kDescr4Gruppo].ToString() : "";

                                            //        ad.Approvata = false;
                                            //        ad.DataUltimaRicezione = DateTime.Now;
                                            //        ad.CodiceGruppo = codGruppo;
                                            //        this.ctx.Add(ad);
                                            //        this.ctx.SaveChanges();
                                            //    }
                                            //    else if (pkg.AutoRevisione)
                                            //    {
                                            //        descrGruppoRevisione.Descrizione1 = rec.ContainsKey(kDescr1Gruppo) ? rec[kDescr1Gruppo].ToString() : "";
                                            //        descrGruppoRevisione.Descrizione2 = rec.ContainsKey(kDescr2Gruppo) ? rec[kDescr2Gruppo].ToString() : "";
                                            //        descrGruppoRevisione.Descrizione3 = rec.ContainsKey(kDescr3Gruppo) ? rec[kDescr3Gruppo].ToString() : "";
                                            //        descrGruppoRevisione.Descrizione4 = rec.ContainsKey(kDescr4Gruppo) ? rec[kDescr4Gruppo].ToString() : "";
                                            //        descrGruppoRevisione.Approvata = false;
                                            //        descrGruppoRevisione.DataUltimaRicezione = DateTime.Now;

                                            //        this.ctx.SaveChanges();
                                            //    }
                                            //}

                                            #endregion

                                            #region Foto

//#warning La logica della foto estratta dal tracciato, necessita di poter essere intercettata PRIMA (esattamente in questo punto) e DOPO interpretazione agenzia

//                                            if (artRecord != null && rec.ContainsKey(kFoto) && rec[kFoto].ToString() != "")
//                                            {
//                                                //La referenza dichiara il nome della foto.
//                                                string fullName = rec[kFoto].ToString();
//                                                string nomeFoto = Utility.Main.getOnlyNameOfFile(fullName);
//                                                ArticoliFoto fItem = this.ctx.ArticoliFotos.Where(f => f.NomeReale == nomeFoto && f.IdArticolo == artRecord.Id).FirstOrDefault();
//                                                if (fItem == null)
//                                                {
//                                                    //Preparo già la foto al SYNC postumo
//                                                    fItem = new ArticoliFoto();
//                                                    fItem.Attiva = true;
//                                                    fItem.StatoSelezione = (Byte)StatoSelezioneFoto.Selezionata;
//                                                    fItem.IdArticolo = artRecord.Id;
//                                                    fItem.PathFoto = fullName;
//                                                    fItem.NomeReale = nomeFoto;
//                                                    fItem.DataInserimento = DateTime.Now;
//                                                    fItem.DataModifica = DateTime.Now;

//                                                    this.ctx.ArticoliFotos.Add(fItem);
//                                                    this.ctx.SaveChanges();
//                                                }
//                                                else if (pkg.AutoRevisione)
//                                                {
//                                                    fItem.StatoSelezione = (Byte)StatoSelezioneFoto.Selezionata;
//                                                    fItem.DataModifica = DateTime.Now;
//                                                    this.ctx.SaveChanges();
//                                                }

//                                            }

                                            #endregion

                                            #region generazione firma

                                            string kFirma = Enum.GetName(AddestramentoRuoli.Tracciato) + "." + GLOBAL_VARIABLES.keyTracciatoFirma;
                                            if (!rec.ContainsKey(kFirma))
                                            {
                                                string firma = Utility.Main.getFirmaTracciato(rec);
                                                rec[kFirma] = firma;
                                            }

                                            #endregion

                                            tracciato.Add(rec);
                                        }
                                    }
                                }

                            }
                        }
                    }

                    media_processo_item = media_processo_item / count_items;



                    //if (addestramento.externalCallPerImport != null)
                    //{
                    res.Attivita.Progress = lettura_tot_perc;
                    res.Attivita.StatoMsg = "Interpretazione del dato...";
                   //ctx_1.SaveChanges();
                    _ = await ctx_1.SaveChangesAsync();

                    //Console.WriteLine($"Chiamo la libreria esterna per l'importazione del tracciato AgenziaLib.{this._ficoClientName}.importaTracciato passando come LABEL:{pkg.cmbLabels}");

                    string idLabel = pkg.getFieldByKey("idLabel");
                    Dictionary<string, object> _pass = new Dictionary<string, object>();
                    //_pass["label"] = idLabel;// pkg.cmbLabels!;
                    _pass["tracciato"] = tracciato;
                    _pass["formRequest"] = pkg.fields!;
                    _pass["context"] = context;//ATTENZIONE! Adeguare questo parmaetro nella chiamata di import
                    _pass["contextPromo"] = JsonConvert.DeserializeObject<List<FicoContextField>>(promoItem!.Context!)!;//ATTENZIONE! Adeguare questo parmaetro nella chiamata di import
                    //string resultExternal = icCtrl.execLibFunction(addestramento.externalCallPerImport, _pass).ToString();
                    string resultExternal = icCtrl.execLibFunction($"AgenziaLib.{this._ficoClientName}.importaTracciato", _pass).ToString()!;


                    ImportResult? parsingRes = JsonConvert.DeserializeObject<ImportResult>(resultExternal!);

                    if (parsingRes!.errors != "")
                    {
                        throw new Exception($"LIB ERROR#{parsingRes.errors}#");
                    }

                    if (addestramento.salvaSuDb)
                    {
                        res.Attivita.Progress = 90;
                        res.Attivita.Stato = (Byte)OperationStauts.ElaborazioneDati;
                        if (pkg.persistent)
                        {
                            res.Attivita.StatoMsg = "Salvataggio nel database";
                        }
                        else
                        {
                            res.Attivita.StatoMsg = "Esame in corso....";
                        }

                        //ctx_1.SaveChanges();
                        _ = await ctx_1.SaveChangesAsync();

                        List<PromoTracciati> _promo_tracciati_esistenti = ctx_2.PromoTracciatis.Where(p => p.IdPromo == pImp!.IdPromo).ToList();


                        Register regContext = new Register(this._conn_string, this._dbContextFactory, dbContextFactory2: this._dbContextFactory2);

                        List<Dictionary<string,object>> _report=new List<Dictionary<string, object>>();

                        ExternalSourceClass extSource = new ExternalSourceClass(this._path_external_source);
                        DbConfronto dbConfExt = extSource.getConfronto();

                        foreach (Dictionary<string, object> lista in parsingRes.liste!)
                        {
                            Stopwatch sw = new Stopwatch();
                            sw.Start();

                            
                            //var str1 = "Inserisco nel db " + lista["Area"].ToString();
                            var _recs = lista["Records"];
                            var recs = (_recs as JArray)!.ToObject<List<Dictionary<string, object>>>();

                            string areaKey = GLOBAL_VARIABLES.keyArea;
                            string canaleKey = GLOBAL_VARIABLES.keyCanale;
                            string areaKeyGuid = GLOBAL_VARIABLES.keyAreaGuid;
                            string canaleKeyGuid = GLOBAL_VARIABLES.keyCanaleGuid;

                            //Controllo se esiste il tracciato
                            List<PromoTracciati> pTrList = _promo_tracciati_esistenti.Where(pt => pt.guidArea==lista[areaKeyGuid].ToString() && pt.guidCanale == lista[canaleKeyGuid].ToString()).ToList();
                            PromoTracciati? pTr = null;// _promo_tracciati_esistenti.Where(pt => pt.guidArea==lista[areaKey].ToString() && pt.guidCanale == lista[canaleKey].ToString()).FirstOrDefault();

                            //Console.WriteLine($"Tracciati esistenti per {lista[canaleKeyGuid].ToString()}/{lista[areaKeyGuid].ToString()}: {pTrList.Count}");

                            if (pTrList.Count>0)
                            {
                                //Facciamo il controllo del contesto Tracciato, di tutti i tracciati CANALE/AREA trovati per questa promo
                                //Quello promo ovviamente è lo stesso ma se c'è anche una sola chiave che differisce nel contesto traccaito, va importato come Tracciato diverso
                                

                                foreach (PromoTracciati pTrItem in pTrList)
                                { 
                                    List<FicoContextField>? _ctxEsistente = JsonConvert.DeserializeObject<List<FicoContextField>>(pTrItem.Context!);
                                    
                                    //Console.WriteLine($"Fields contesti a confronto {context.Count}/{_ctxEsistente.Count}");

                                    if (context.Count!=_ctxEsistente!.Count)
                                    {
                                        //E' sicuramente diverso il contesto, ci sono numeri di elementi differenti
                                        //saltiamo questo Tracciato
                                        //Console.WriteLine($"NO MATCH");
                                    }
                                    else
                                    {
                                        //Ogni campo del cotnesto deve combaciare altrimenti faccio saltare il match
                                        bool match = true;
                                        foreach(FicoContextField fCtk in context)
                                        {
                                            //Console.WriteLine($"Check {fCtk.nome_field}");
                                            FicoContextField? fCtkEsistente = _ctxEsistente.Where(f => f.nome_field == fCtk.nome_field).FirstOrDefault();
                                            if (fCtkEsistente==null)
                                            {
                                                match = false;
                                                //Console.WriteLine($"NO MATCH {fCtk.nome_field}");
                                                break;
                                            }
                                            else
                                            {
                                                if (fCtkEsistente.user_value!=fCtk.user_value)
                                                {
                                                    match = false;
                                                    //Console.WriteLine($"NO MATCH {fCtk.nome_field}");
                                                    break;
                                                }
                                            }

                                            //Console.WriteLine($">MATCH !!");
                                        }   

                                        if (match)
                                        {
                                            //Console.WriteLine($"Tracciatro MATCH: {pTrItem.Id}");
                                            pTr = pTrItem;
                                        }
                                    }
                                }
                                
                            }

                            bool tracciatoNuovo = true;

#warning Versione Tracciato Obsoleta
                            //Attenzione
                            //La versione del tracciato con l'introduzione e diversificazione delle LABEL,
                            //Diventa obsoleta perchè da una versione progressiva assoluta che non so quanto possa fare comodo


                            if (pTr == null)
                            {
                                pTr = new PromoTracciati();
                                pTr.IdImportazione = pImp!.Id;
                                pTr.IdPromo = pImp.IdPromo;
                                pTr.Canale = lista[canaleKey].ToString();                                    
                                pTr.Area = lista[areaKey].ToString();

                                if (lista.ContainsKey(areaKeyGuid))
                                    pTr.guidArea = lista[areaKeyGuid].ToString();
                                if (lista.ContainsKey(canaleKeyGuid))
                                    pTr.guidCanale = lista[canaleKeyGuid].ToString();

                                pTr.Versione = (Byte)1;
                                pTr.Sigla = pTr.Canale + pTr.Area;
                                //if (lista.ContainsKey(GLOBAL_VARIABLES.keySiglaTracciato))
                                //    pTr.Sigla = lista[GLOBAL_VARIABLES.keySiglaTracciato].ToString();

                                lista.Remove("Records");
                                lista.Add("formRequest",pkg.fields!);

                                if (pkg.persistent)
                                {
                                    pTr.Meta = JsonConvert.SerializeObject(lista);
                                    pTr.Context = JsonConvert.SerializeObject(context);

                                    ctx_2.Add(pTr);
                                    //ctx_2.SaveChanges();
                                    _ = await ctx_2.SaveChangesAsync();
                                }
                            }
                            else
                            {
                                //Aggiorniamo solo l'id importazione a quello nuovo attuale
                                tracciatoNuovo = false;
                                //pTr.IdImportazione = pImp.Id;//Non aggiorniamo l'id importazione, così se il traciato è fatto da più origini, rimaniamo con la prima COME Origine principale
                                pTr.Versione = (Byte)(pTr.Versione + 1);
                                pTr.IdImportazione = pImp!.Id;//Aggiornaimao sempre l'excel con l'ultimo ricevuto per aggiornare le versioni dei dati
                                if (pkg.persistent)
                                {
                                    //ctx_2.SaveChanges();
                                    _ = await ctx_2.SaveChangesAsync();
                                }

                            }

                            string keyRefCode = Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice;
                            
                            var _rec_esistenti = ctx_2.PromoTracciatiRecords.Where(ptr => ptr.IdTracciato == pTr.Id && ptr.Label==idLabel).Select(
                                s => new
                                {
                                    Codice = Utility.Main.getJsonObject(s.Dato!)![keyRefCode].ToString(),
                                    Rec = s,
                                    Label = s.Label,
                                    Versione = s.Versione
                                }
                                ).ToList();

                            Byte versioneLab = 0;

                            var versioneLabLast = _rec_esistenti.Where(r => r.Label == idLabel).OrderByDescending(o => o.Versione).FirstOrDefault();
                            if (versioneLabLast != null)
                            {
                                versioneLab = (Byte)(versioneLabLast.Versione + 1);
                            }
                            else
                            {
                                versioneLab = 1;
                            }




                            foreach (Dictionary<string, object> item in recs!)
                            {


                                #region ANALISI REC e FLUSSO CREAZIONE/AGGIORNAMENTO ARTICOLO e FOTO ARTICOLO

                                string? codArticolo = item[keyRefCode].ToString();
                                string? codGruppo = item.ContainsKey(GLOBAL_VARIABLES_FICO.keyCodiceGruppo)?item[GLOBAL_VARIABLES_FICO.keyCodiceGruppo].ToString(): codArticolo;

                                if (codArticolo == "")
                                    continue;

                                if (pkg.persistent)//!pkg.askReport)
                                {
                                    //Provo a cercare il codice in archivio
                                    Articoli? artRecord = ctx_1.Articolis.FirstOrDefault(a => a.Codice == codArticolo);
                                    if (artRecord == null)
                                    {
                                        //Nonostante il tentativo di cercare la ref corrisponendete in archivio, il sistema non
                                        //ha trovato niente, è quindi il momento di creare la ref vuota con il codice e ean specificato
                                        //SEMPRE se il codice referenza NON è vuoto
                                        //E aggiornare il record del tracciato


                                        if (item.ContainsKey(kRefEan) && item[kRefEan].ToString()!.Length > 30)
                                        {
                                            item[kRefEan] = item[kRefEan].ToString()!.Substring(0, 30);
                                        }

                                        artRecord = new Articoli();
                                        artRecord.Descrizione1 = "";
                                        artRecord.Descrizione2 = "";
                                        artRecord.Descrizione3 = "";
                                        artRecord.Descrizione4 = "";
                                        artRecord.Codice = item[kRefCod].ToString()!;
                                        if (cRefEan != null && item.ContainsKey(kRefEan))
                                        {
                                            artRecord.Ean = item[kRefEan].ToString();
                                        }
                                        artRecord.StatoRevisione = (Byte)StatoRevisioneArticolo.NonProcessato;
                                        artRecord.DataInserimento = DateTime.Now;
                                        ctx_1.Articolis.Add(artRecord);
                                        //ctx_1.SaveChanges();
                                        _ = await ctx_1.SaveChangesAsync();

                                        _articoli_cache.Add(artRecord);
                                        string refJson = JsonConvert.SerializeObject(artRecord);

                                        //Inserito il NUOVO articolo, è anche il caso di fare una revisione senza valenza di firma per far si che venga cmq ricontrollato dall'operatore
                                        //Ma almeno potrebbe essere facilitato e velocizzato il meccanismo di revisione
                                        //Questo sempre e solo se espone almeno uno dei 4 campi descrittivi base 
                                        if (item.ContainsKey(kDescr1) || item.ContainsKey(kDescr2) || item.ContainsKey(kDescr3) || item.ContainsKey(kDescr4))
                                        {
                                            ArticoliDescrizioni ad = new ArticoliDescrizioni();

                                            if (item.ContainsKey(GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizione1) ||
                                                item.ContainsKey(GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizione2) ||
                                                item.ContainsKey(GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizione3) ||
                                                item.ContainsKey(GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizione4))
                                            {
                                                //C'è un sugerimento che quindi ha la priorità
                                                ad.Descrizione1 = item.ContainsKey(GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizione1) ? item[GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizione1].ToString() : "";
                                                ad.Descrizione2 = item.ContainsKey(GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizione2) ? item[GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizione2].ToString() : "";
                                                ad.Descrizione3 = item.ContainsKey(GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizione3) ? item[GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizione3].ToString() : "";
                                                ad.Descrizione4 = item.ContainsKey(GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizione4) ? item[GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizione4].ToString() : "";
                                                ad.FirmaTracciato = GLOBAL_VARIABLES.keySuggerimentoFirma;
                                            }
                                            else
                                            {
                                                ad.Descrizione1 = item.ContainsKey(kDescr1) ? item[kDescr1].ToString() : "";
                                                ad.Descrizione2 = item.ContainsKey(kDescr2) ? item[kDescr2].ToString() : "";
                                                ad.Descrizione3 = item.ContainsKey(kDescr3) ? item[kDescr3].ToString() : "";
                                                ad.Descrizione4 = item.ContainsKey(kDescr4) ? item[kDescr4].ToString() : "";
                                            }

                                            ad.Um = item.ContainsKey(kDescrUm) ? item[kDescrUm].ToString() : "";
                                            if (item.ContainsKey(kDescrPeso))
                                            {
                                                if (item[kDescrPeso] is double)
                                                    ad.Peso = (decimal)((double)item[kDescrPeso]);
                                                else if (item[kDescrPeso] is decimal)
                                                    ad.Peso = (decimal)item[kDescrPeso];
                                            }
                                            ad.Approvata = false;
                                            ad.DataUltimaRicezione = DateTime.Now;
                                            ad.IdArticolo = artRecord.Id;
                                            ctx_1.Add(ad);
                                            //ctx_1.SaveChanges();
                                            _ = await ctx_1.SaveChangesAsync();
                                        }

                                        item[Enum.GetName(AddestramentoRuoli.Referenza)!] = JsonConvert.DeserializeObject<Dictionary<string, object>>(refJson)!;


                                    }
                                    else if (artRecord != null)
                                    {
                                        //string refJson = JsonConvert.SerializeObject(artRecord);

                                        //Vediamo se ho da aggiornare qualche campo
                                        //L'ean per adesso è l'unico campo rimasto indietro e da controllare
                                        if (cRefEan != null && item.ContainsKey(kRefEan))
                                        {
                                            //va aumentato a 150 il substring
                                            if (item[kRefEan].ToString()!.Length > 30)
                                            {
                                                item[kRefEan] = item[kRefEan].ToString()!.Substring(0, 30);
                                            }

                                            if (artRecord.Ean != item[kRefEan].ToString())
                                            {
                                                if (item[kRefEan].ToString()!.Length <= 30)
                                                {
                                                    artRecord.Ean = item[kRefEan].ToString();
                                                    artRecord.DataModifica = DateTime.Now;
                                                    //ctx_1.SaveChanges();
                                                    _ = await ctx_1.SaveChangesAsync();
                                                }
                                            }
                                        }

                                        //Descrizione singola
                                        ArticoliDescrizioni? ad = ctx_1.ArticoliDescrizionis.Where(a => a.IdArticolo == artRecord.Id && a.Area == null && a.Canale == null).FirstOrDefault();

                                        if (ad == null)
                                        {
                                            //Questa è una condizione che non dovrebbe MAI avverarsi MA allo stato attuale che prevede, per gli articoli inseriti per la prma volta, già una revisione automatica.
                                            //MA per roba del passato? Quindi meglio ridondare il processo
                                            ad = new ArticoliDescrizioni();


                                            if (item.ContainsKey(GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizione1) ||
                                                item.ContainsKey(GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizione2) ||
                                                item.ContainsKey(GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizione3) ||
                                                item.ContainsKey(GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizione4))
                                            {
                                                //C'è un sugerimento che quindi ha la priorità
                                                ad.Descrizione1 = item.ContainsKey(GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizione1) ? item[GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizione1].ToString() : "";
                                                ad.Descrizione2 = item.ContainsKey(GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizione2) ? item[GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizione2].ToString() : "";
                                                ad.Descrizione3 = item.ContainsKey(GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizione3) ? item[GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizione3].ToString() : "";
                                                ad.Descrizione4 = item.ContainsKey(GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizione4) ? item[GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizione4].ToString() : "";
                                                ad.FirmaTracciato=GLOBAL_VARIABLES.keySuggerimentoFirma;
                                            }
                                            else
                                            {
                                                ad.Descrizione1 = item.ContainsKey(kDescr1) ? item[kDescr1].ToString() : "";
                                                ad.Descrizione2 = item.ContainsKey(kDescr2) ? item[kDescr2].ToString() : "";
                                                ad.Descrizione3 = item.ContainsKey(kDescr3) ? item[kDescr3].ToString() : "";
                                                ad.Descrizione4 = item.ContainsKey(kDescr4) ? item[kDescr4].ToString() : "";
                                            }

                                            ad.Um = item.ContainsKey(kDescrUm) ? item[kDescrUm].ToString() : "";
                                            if (item.ContainsKey(kDescrPeso))
                                            {
                                                if (item[kDescrPeso] is double)
                                                    ad.Peso = (decimal)((double)item[kDescrPeso]);
                                                else if (item[kDescrPeso] is decimal)
                                                    ad.Peso = (decimal)item[kDescrPeso];
                                            }
                                            ad.Approvata = false;
                                            ad.DataUltimaRicezione = DateTime.Now;
                                            ad.IdArticolo = artRecord.Id;
                                            ctx_1.Add(ad);
                                            //ctx_1.SaveChanges();
                                            _ = await ctx_1.SaveChangesAsync();
                                        }
                                        else
                                        {
                                            //Se ho suggerimenti di descrizione E non ho una firma stabile sulla revisione allora aggirn con i dat d suggerimento
                                            //Per firma instabile si intende SOLO
                                            //1. NULL
                                            //poichè
                                            //2. mismatch_firme-> si rivolge ai gruppi e ad ogni modo è stata fatta da revisore e quindi con ragionamneto umano
                                            //3. daArchivio -> epure queste sono umane anche se fatte da archivio e quindi senza certificazione di lista
                                            if (ad.FirmaTracciato==null || ad.FirmaTracciato == "")
                                            {
                                                if (item.ContainsKey(GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizione1) ||
                                                    item.ContainsKey(GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizione2) ||
                                                    item.ContainsKey(GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizione3) ||
                                                    item.ContainsKey(GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizione4))
                                                {
                                                    ad.Descrizione1 = item.ContainsKey(GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizione1) ? item[GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizione1].ToString() : "";
                                                    ad.Descrizione2 = item.ContainsKey(GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizione2) ? item[GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizione2].ToString() : "";
                                                    ad.Descrizione3 = item.ContainsKey(GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizione3) ? item[GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizione3].ToString() : "";
                                                    ad.Descrizione4 = item.ContainsKey(GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizione4) ? item[GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizione4].ToString() : "";
                                                    ad.DataUltimaRicezione = DateTime.Now;
                                                    ad.FirmaTracciato = GLOBAL_VARIABLES.keySuggerimentoFirma;

                                                    _ = await ctx_1.SaveChangesAsync();
                                                }
                                            }
                                        }

                                        //Vediamo se è presente la descrizione di gruppo gia dallìimport per cui significa che è stata compilata (suggerita)
                                        if (item.ContainsKey(GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizioneGruppo1) ||
                                            item.ContainsKey(GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizioneGruppo2) ||
                                            item.ContainsKey(GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizioneGruppo3) ||
                                            item.ContainsKey(GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizioneGruppo4))
                                        {
                                            
                                            
                                            ArticoliDescrizioni? ad_gruppo = ctx_1.ArticoliDescrizionis.Where(a => a.CodiceGruppo == codGruppo && a.Area == null && a.Canale == null).FirstOrDefault();
                                            if (ad_gruppo == null)
                                            {
                                                //Non è mai stato revisionato questo gruppo, allora accolgo il suggerimentoe  lo faccio diventare descrizione ufficiale
                                                ad = new ArticoliDescrizioni();

                                                ad.Descrizione1 = item.ContainsKey(GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizioneGruppo1) ? item[GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizioneGruppo1].ToString() : "";
                                                ad.Descrizione2 = item.ContainsKey(GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizioneGruppo2) ? item[GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizioneGruppo2].ToString() : "";
                                                ad.Descrizione3 = item.ContainsKey(GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizioneGruppo3) ? item[GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizioneGruppo3].ToString() : "";
                                                ad.Descrizione4 = item.ContainsKey(GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizioneGruppo4) ? item[GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizioneGruppo4].ToString() : "";


                                                ad.FirmaTracciato = "suggerimento";// Utility.Main.getFirmaTracciatoGruppo(recs.Where(sr => sr.ContainsKey(GLOBAL_VARIABLES_FICO.keyCodiceGruppo) && sr[GLOBAL_VARIABLES_FICO.keyCodiceGruppo].ToString() == codGruppo).ToList());

                                                ad.Um = item.ContainsKey(kDescrUm) ? item[kDescrUm].ToString() : "";
                                                if (item.ContainsKey(kDescrPeso))
                                                {
                                                    if (item[kDescrPeso] is double)
                                                        ad.Peso = (decimal)((double)item[kDescrPeso]);
                                                    else if (item[kDescrPeso] is decimal)
                                                        ad.Peso = (decimal)item[kDescrPeso];
                                                }

                                                ad.Approvata = true;
                                                ad.DataUltimaRicezione = DateTime.Now;
                                                ad.CodiceGruppo = codGruppo;
                                                ctx_1.Add(ad);

                                                _ = await ctx_1.SaveChangesAsync();
                                            }
                                            
                                        }


                                    }


   
                                    #region Descrizione gruppo

                                    //Verifico se tale referenza dichiara una descrizione gruppo proveniente da lista

                                    if (item.ContainsKey(kCodGruppo) &&
                                        (item.ContainsKey(kDescr1Gruppo) || item.ContainsKey(kDescr2Gruppo) || item.ContainsKey(kDescr3Gruppo) || item.ContainsKey(kDescr4Gruppo)))
                                    {
                                        //Ne specifica una, adesso vediamo se esiste un gruppo così già revisionato. 
                                        //Se non esiste allora è corretto inserirlo per comodità
                                        
                                        var descrGruppoRevisione = ctx_1.ArticoliDescrizionis.Where(ad => ad.CodiceGruppo == codGruppo && ad.Area == null && ad.Canale == null).FirstOrDefault();
                                        if (descrGruppoRevisione == null)
                                        {
                                            ArticoliDescrizioni ad = new ArticoliDescrizioni();

                                            ad.Descrizione1 = item.ContainsKey(kDescr1Gruppo) ? item[kDescr1Gruppo].ToString() : "";
                                            ad.Descrizione2 = item.ContainsKey(kDescr2Gruppo) ? item[kDescr2Gruppo].ToString() : "";
                                            ad.Descrizione3 = item.ContainsKey(kDescr3Gruppo) ? item[kDescr3Gruppo].ToString() : "";
                                            ad.Descrizione4 = item.ContainsKey(kDescr4Gruppo) ? item[kDescr4Gruppo].ToString() : "";

                                            ad.Approvata = false;
                                            ad.DataUltimaRicezione = DateTime.Now;
                                            ad.CodiceGruppo = codGruppo;
                                            ctx_1.Add(ad);
                                            //ctx_1.SaveChanges();
                                            _ = await ctx_1.SaveChangesAsync();
                                        }
                                        //else if (pkg.AutoRevisione)
                                        //{
                                        //    descrGruppoRevisione.Descrizione1 = rec.ContainsKey(kDescr1Gruppo) ? rec[kDescr1Gruppo].ToString() : "";
                                        //    descrGruppoRevisione.Descrizione2 = rec.ContainsKey(kDescr2Gruppo) ? rec[kDescr2Gruppo].ToString() : "";
                                        //    descrGruppoRevisione.Descrizione3 = rec.ContainsKey(kDescr3Gruppo) ? rec[kDescr3Gruppo].ToString() : "";
                                        //    descrGruppoRevisione.Descrizione4 = rec.ContainsKey(kDescr4Gruppo) ? rec[kDescr4Gruppo].ToString() : "";
                                        //    descrGruppoRevisione.Approvata = false;
                                        //    descrGruppoRevisione.DataUltimaRicezione = DateTime.Now;

                                        //    this.ctx.SaveChanges();
                                        //}
                                    }

                                    #endregion

                                   
                                    #region Foto

                                    //Per far si che questo si attivi serve un addestramento che dichiari con coraggio Foto.Nome come campo di excel
                                    //Questo costringe il sistema ad assegnarla anche se da subito fuori sync perchè poi è necessario associarle un file reale
                                    if (artRecord != null && item.ContainsKey(kFoto) && item[kFoto].ToString() != "")
                                    {
                                        //La referenza dichiara il nome della foto.
                                        string? fullName = item[kFoto].ToString();
                                        string nomeFoto = Utility.Main.getOnlyNameOfFile(fullName!);
                                        ArticoliFoto? fItem = ctx_1.ArticoliFotos.Where(f => f.NomeReale == nomeFoto && f.IdArticolo == artRecord.Id).FirstOrDefault();
                                        if (fItem == null)
                                        {
                                            //Preparo già la foto al SYNC postumo
                                            fItem = new ArticoliFoto();
                                            fItem.Attiva = true;
                                            fItem.StatoSelezione = (Byte)StatoSelezioneFoto.Selezionata;
                                            fItem.IdArticolo = artRecord.Id;
                                            fItem.PathFoto = fullName!;
                                            fItem.NomeReale = nomeFoto;
                                            fItem.DataInserimento = DateTime.Now;
                                            fItem.DataModifica = DateTime.Now;

                                            ctx_1.ArticoliFotos.Add(fItem);
                                            //ctx_1.SaveChanges();
                                            _ = await ctx_1.SaveChangesAsync();
                                        }
                                        else
                                        {
                                            fItem.StatoSelezione = (Byte)StatoSelezioneFoto.Selezionata;
                                            fItem.DataModifica = DateTime.Now;
                                            fItem.Attiva = true;
                                            //ctx_1.SaveChanges();
                                            _ = await ctx_1.SaveChangesAsync();
                                        }

                                    }

                                    #endregion

                                }
                                

                                #endregion

                                PromoTracciatiRecord? _rec = null;

                                Stopwatch sw2 = new Stopwatch();
                                sw2.Start();

                                if (!tracciatoNuovo)
                                {

                                    string? codRef = item[keyRefCode].ToString();                                    
                                    var rec_esistente = _rec_esistenti.Where(i => i.Codice == codRef).FirstOrDefault();
                                    if (rec_esistente != null)
                                        _rec = rec_esistente.Rec;
                                }
                                sw2.Stop();

                                if (_rec == null)
                                {
                                    Stopwatch sw3 = new Stopwatch();
                                    sw3.Start();
                                    _rec = new PromoTracciatiRecord();
                                    _rec.IdTracciato = pTr.Id;
                                    _rec.IdAddestramento = idAdstr;
                                    _rec.IndiceLettura = 0;
                                    _rec.IndiceEsportazione = 0;
                                    _rec.Versione = versioneLab;
                                    _rec.Label = idLabel;
                                    _rec.DataRegistrazione = DateTime.Now;
                                  
                                    _rec.ModalitaInserimento = (Byte)ModalitaInserimento.Sistema;
                                    _rec.Stato = (Byte)StatoRecord.Attivo;


                                    if (item.ContainsKey(nome_colonna_scatto))
                                    {
                                        _rec.Scatto = item[nome_colonna_scatto].ToString();
                                    }

                                    if (item.ContainsKey(kRefCod))
                                    {
                                        _rec.Codice = item[kRefCod].ToString();
                                    }

                                    if (item.ContainsKey(nome_colonna_codGruppo))
                                    {
                                        if (item[nome_colonna_codGruppo].ToString()!.Count() > 4000)
                                        {
                                            throw new Exception("Codice gruppo troppo lungo: " + item[nome_colonna_codGruppo].ToString()!.Count() + " caratteri:" + item[nome_colonna_codGruppo].ToString());
                                        }
                                        else
                                            _rec.CodiceGruppo = item[nome_colonna_codGruppo].ToString();
                                    }
                                    else
                                    {
                                        //Se il codice gruppo NON è stato messo, acquisisce il cod referenza
                                        _rec.CodiceGruppo = _rec.Codice;
                                        item[nome_colonna_codGruppo] = _rec.CodiceGruppo!;
                                    }


                                    //Ordinamneto
                                    if (!item.ContainsKey(GLOBAL_VARIABLES.keyIndiceOrdinamento))
                                    {
                                        item[GLOBAL_VARIABLES.keyIndiceOrdinamento] = (Int16)9999;
                                    }



                                    item[GLOBAL_VARIABLES.keyContextPromo] = JsonConvert.DeserializeObject<List<FicoContextField>>(promoItem.Context!)!;
                                    item[GLOBAL_VARIABLES.keyContextTracciato] = context;
                                    item[GLOBAL_VARIABLES_FICO.keyVersioneTracciato] = _rec.Versione;
                                    //item[GLOBAL_VARIABLES_FICO.keyXlsxTracciato] = pImp.NomeFile;


                                    _rec.Dato = JsonConvert.SerializeObject(item);

                                    if (pkg.persistent)
                                    {
                                        ctx_2.Add(_rec);
                                    }

                                    if (pkg.askReport)
                                    {
                                        //ENTRANTE
                                        //aggiungiamo canale e area al record per una lettura più facile del report
                                        item["AC"] = pTr.Canale + pTr.Area;
                                        item["versione"] = 1;
                                        item["guidIdCanale"] = pTr.guidCanale;
                                        item["guidIdArea"] = pTr.guidArea;
                                        _report.Add(item);
                                    }

                                    sw3.Stop();

                                }
                                else
                                {
                                    
                                    Stopwatch sw1 = new Stopwatch();
                                    sw1.Start();
                                    if (item.ContainsKey(nome_colonna_codGruppo))
                                    {
                                        if (item[nome_colonna_codGruppo].ToString()!.Count() > 4000)
                                        {                                         
                                            _rec.CodiceGruppo = item[nome_colonna_codGruppo].ToString()!.Substring(0, 4000);
                                        }
                                        else
                                            _rec.CodiceGruppo = item[nome_colonna_codGruppo].ToString();
                                    }
                                    else
                                    {

                                        //Se il codice gruppo NON è stato messo, acquisisce il cod referenza
                                        _rec.CodiceGruppo = _rec.Codice;
                                        item[nome_colonna_codGruppo] = _rec.CodiceGruppo!;
                                    }

                                    item[GLOBAL_VARIABLES.keyContextPromo] = JsonConvert.DeserializeObject<List<FicoContextField>>(promoItem.Context!)!;
                                    item[GLOBAL_VARIABLES.keyContextTracciato] = context;
                                    item[GLOBAL_VARIABLES_FICO.keyVersioneTracciato] = _rec.Versione;
                                    //item[GLOBAL_VARIABLES_FICO.keyXlsxTracciato] = pImp.NomeFile;

                                    //Trovo le differenze

                                    var alterazioni = new Dictionary<string, object>();

                                    Dictionary<string, object> oldItem = JsonConvert.DeserializeObject<Dictionary<string, object>>(_rec.Dato!)!;

                                    sw1.Stop();
                                    Stopwatch sw4 = new Stopwatch();
                                    sw4.Start();
                                    foreach (string _k in item.Keys)
                                    {
                                        if (!oldItem.ContainsKey(_k) || (!(item[_k] is JArray) && !(item[_k] is JObject) && !(item[_k] is Dictionary<string, object>)))
                                        {
                                            //Se è un tipo nativo
                                            if (!oldItem.ContainsKey(_k) || !SonoUguali(oldItem[_k], item[_k]))
                                            {
                                                //Differenza trovata
                                                if (oldItem.ContainsKey(_k))
                                                {
                                                    alterazioni[_k] = oldItem[_k];
                                                }

                                                oldItem[_k] = item[_k];

                                                if (_k == nome_colonna_scatto)
                                                {
                                                    _rec.Scatto = item[nome_colonna_scatto].ToString();
                                                }
                                                else if (_k == nome_colonna_codGruppo)
                                                {
                                                    _rec.CodiceGruppo = item[nome_colonna_codGruppo].ToString();
                                                }


                                            }
                                        }
                                    }
                                    sw4.Stop();
                                    Stopwatch sw6 = new Stopwatch();
                                    sw6.Start();
                                    if (alterazioni.Count > 0 && !pkg.askReport)
                                    {
                                        //Si deve prepararre il registro del cambio meta per informare il servizio di propagazione


                                        RegistroOperazioni regOp = new RegistroOperazioni();

                                        regOp.IdTracciato = _rec.IdTracciato;
                                        regOp.TipoOperazione = (byte)tipoOperazione.cambioMeta;

                                        CambioMetaRecordTracciatoAzione az = new CambioMetaRecordTracciatoAzione();
                                        az.codice = _rec.Codice;
                                        az.attributi = new Dictionary<string, object>();

                                        List<CambioMetaRecordTracciatoAzione> formData = new List<CambioMetaRecordTracciatoAzione>();
                                        foreach (string k in alterazioni.Keys)
                                        {
                                            az.attributi[k] = alterazioni[k];
                                        }

                                        regOp.FormData = JsonConvert.SerializeObject(formData);
                                        regOp.CodiceAssociato = _rec.CodiceGruppo;//Portiamo sempre dietro il codice gruppo di provenienza
                                                                                  //Registro alterazione meta dovuta ad aggiornamento massivo del tracciato
                                        regContext.addOperazione(regOp, true, "0", DateTime.Now);
                                    }

                                    item[GLOBAL_VARIABLES.keyAlterazioni] = alterazioni;

                                    _rec.Versione = versioneLab;

                                    var dictDato = JsonConvert.DeserializeObject<Dictionary<string, object>>(_rec.Dato!)!;
                                    Dictionary<string, object> dictSyncFromIndd = new Dictionary<string, object>();


                                    if (dictDato.ContainsKey(GLOBAL_VARIABLES.keySyncIndd))
                                    {
                                        dictSyncFromIndd = (dictDato[GLOBAL_VARIABLES.keySyncIndd] as JObject)!.ToObject<Dictionary<string, object>>()!;
                                        item[GLOBAL_VARIABLES.keySyncIndd] = dictSyncFromIndd;

                                    }

                                    _rec.Dato = JsonConvert.SerializeObject(item);
                                    _rec.Label = idLabel;


                                    if (pkg.askReport)
                                    {
                                        //ESISTENTE
                                        //aggiungiamo canale e area al record per una lettura più facile del report
                                        item["AC"] = pTr.Canale + pTr.Area;
                                        item["versione"] = _rec.Versione;
                                        item["guidIdCanale"] = pTr.guidCanale;
                                        item["guidIdArea"] = pTr.guidArea;

                                        //Togliamo dalle alterazioni i campi che sono di controllo e non di reale interesse per l'utente, altrimenti si rischia di generare confusione
                                        foreach (DbConfrontoCampoDiControllo campo in dbConfExt.campiDiControllo)
                                        {
                                            if (!alterazioni.ContainsKey(campo.nome))
                                            {
                                                alterazioni.Remove(campo.nome);
                                            }
                                        }
                                        item[GLOBAL_VARIABLES.keyAlterazioni] = alterazioni;

                                        _report.Add(item);
                                    }
                                    sw6.Stop();
                                    Debug.WriteLine("");

                                }

                                Stopwatch sw5 = new Stopwatch();
                                sw5.Start();
                                #region Descrizione gruppo

                                //Verifico se tale referenza suggerisce una descrizione gruppo proveniente da lista
                                if (item.ContainsKey(kCodGruppo) &&
                                    (item.ContainsKey(kDescr1Gruppo) || item.ContainsKey(kDescr2Gruppo) || item.ContainsKey(kDescr3Gruppo) || item.ContainsKey(kDescr4Gruppo)))
                                {
                                    //Ne specifica una, adesso vediamo se esiste un gruppo così già revisionato. 
                                    //Se non esiste allora è corretto inserirlo per comodità
                                    
                                    var descrGruppoRevisione = ctx_1.ArticoliDescrizionis.Where(ad => ad.CodiceGruppo == codGruppo).FirstOrDefault();
                                    if (descrGruppoRevisione == null)
                                    {
                                        ArticoliDescrizioni ad = new ArticoliDescrizioni();

                                        ad.Descrizione1 = item.ContainsKey(kDescr1Gruppo) ? item[kDescr1Gruppo].ToString() : "";
                                        ad.Descrizione2 = item.ContainsKey(kDescr2Gruppo) ? item[kDescr2Gruppo].ToString() : "";
                                        ad.Descrizione3 = item.ContainsKey(kDescr3Gruppo) ? item[kDescr3Gruppo].ToString() : "";
                                        ad.Descrizione4 = item.ContainsKey(kDescr4Gruppo) ? item[kDescr4Gruppo].ToString() : "";

                                        ad.Approvata = false;
                                        ad.DataUltimaRicezione = DateTime.Now;
                                        ad.CodiceGruppo = codGruppo;

                                        //string firma = "";

                                        //if (pkg.AutoRevisione)//Funzionalità potenzialmente deprecabile
                                        //{
                                        //    var recsGruppo = recs.Where(f => f.ContainsKey(kCodGruppo) && f[kCodGruppo].ToString() == item[kCodGruppo].ToString()).ToList();
                                        //    firma = Utility.Main.getFirmaTracciatoGruppo(recsGruppo);
                                        //}

                                        //ad.FirmaTracciato = firma;

                                        string firma = "";

                                        if (pkg.AutoRevisione) // Funzionalità potenzialmente deprecabile
                                        {
                                            var codGruppoCorrente = item[kCodGruppo].ToString()!;

                                            var codiciAttesi = codGruppoCorrente
                                                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                                                .Where(x => !string.IsNullOrWhiteSpace(x))
                                                .Distinct(StringComparer.OrdinalIgnoreCase)
                                                .ToList();

                                            var recsGruppoByCodice = new Dictionary<string, Dictionary<string, object>>(StringComparer.OrdinalIgnoreCase);

                                            foreach (var recGruppo in recs)
                                            {
                                                if (!recGruppo.ContainsKey(kCodGruppo) ||
                                                    recGruppo[kCodGruppo]?.ToString() != codGruppoCorrente ||
                                                    !recGruppo.ContainsKey(keyRefCode))
                                                {
                                                    continue;
                                                }

                                                var codice = recGruppo[keyRefCode]?.ToString();

                                                if (string.IsNullOrWhiteSpace(codice))
                                                    continue;

                                                if (!codiciAttesi.Contains(codice, StringComparer.OrdinalIgnoreCase))
                                                    continue;

                                                if (!recsGruppoByCodice.ContainsKey(codice))
                                                    recsGruppoByCodice[codice] = recGruppo;
                                            }

                                            if (recsGruppoByCodice.Count == codiciAttesi.Count &&
                                                codiciAttesi.All(c => recsGruppoByCodice.ContainsKey(c)))
                                            {
                                                var recsGruppo = codiciAttesi
                                                    .OrderBy(x => x, StringComparer.OrdinalIgnoreCase)
                                                    .Select(c => recsGruppoByCodice[c])
                                                    .ToList();

                                                firma = Utility.Main.getFirmaTracciatoGruppo(recsGruppo);
                                            }
                                            else
                                            {
                                                firma = GLOBAL_VARIABLES.keyMismatchFirma;
                                            }
                                        }

                                        ad.FirmaTracciato = firma;

                                        ctx_1.Add(ad);
                                        //ctx_1.SaveChanges();
                                        _ = await ctx_1.SaveChangesAsync();
                                    }
                                    //else if (pkg.AutoRevisione)//Funzionalità potenzialmente deprecabile
                                    //{
                                    //    descrGruppoRevisione.Descrizione1 = item.ContainsKey(kDescr1Gruppo) ? item[kDescr1Gruppo].ToString() : "";
                                    //    descrGruppoRevisione.Descrizione2 = item.ContainsKey(kDescr2Gruppo) ? item[kDescr2Gruppo].ToString() : "";
                                    //    descrGruppoRevisione.Descrizione3 = item.ContainsKey(kDescr3Gruppo) ? item[kDescr3Gruppo].ToString() : "";
                                    //    descrGruppoRevisione.Descrizione4 = item.ContainsKey(kDescr4Gruppo) ? item[kDescr4Gruppo].ToString() : "";
                                    //    descrGruppoRevisione.Approvata = false;
                                    //    descrGruppoRevisione.DataUltimaRicezione = DateTime.Now;
                                    //    var recsGruppo = recs.Where(f => f.ContainsKey(kCodGruppo) && f[kCodGruppo].ToString() == item[kCodGruppo].ToString()).ToList();
                                    //    var firma = Utility.Main.getFirmaTracciatoGruppo(recsGruppo, ctx_1);
                                    //    using (var md5 = System.Security.Cryptography.MD5.Create())
                                    //    {
                                    //        byte[] bString = System.Text.ASCIIEncoding.UTF8.GetBytes(firma);
                                    //        firma = BitConverter.ToString(md5.ComputeHash(bString)).Replace("-", string.Empty);
                                    //    }
                                    //    descrGruppoRevisione.FirmaTracciato = firma;
                                    //    //ctx_1.SaveChanges();
                                    //    _ = await ctx_1.SaveChangesAsync();
                                    //}
                                }

                                #endregion
                                sw5.Stop();
                                Debug.WriteLine("");

                            }


                            if (pkg.askReport)
                            {
                                //Devo selezionare anche i record uscenti
                                List<string> codRefLetteNelTracciato = _report.Select(s => s[keyRefCode].ToString()!).ToList();
                                var recUsciti = ctx_2.PromoTracciatiRecords
                                    .Where(ptr => ptr.IdTracciato == pTr.Id && !codRefLetteNelTracciato.Contains(ptr.Codice!) && ptr.Label== idLabel && ptr.Versione==(versioneLab-1))
                                    .Select(s => Utility.Main.getJsonObject(s.Dato!)).ToList()
                                    .Select(s2 => {
                                        s2!["AC"] = pTr.Canale + pTr.Area;
                                        s2!["versione"] = -1;
                                        s2!["guidIdCanale"] = pTr.guidCanale;
                                        s2!["guidIdArea"] = pTr.guidArea;
                                        return s2;
                                    }).ToList();

                                if (recUsciti.Count > 0)
                                {
                                    _report.AddRange(recUsciti);
                                }
                            }

                            if (pkg.persistent)
                            {
                                //ctx_2.SaveChanges();
                                _ = await ctx_2.SaveChangesAsync();
                            }

                            sw.Stop();
                            Debug.WriteLine("");
                        }

                        

                        if (pkg.askReport && _report.Count > 0)
                        {
                            //Salvo il json su file, nella stessa cartella dove è stato salvato l'excel di lettura
                            string pathReport = System.IO.Path.Combine(path_attivita, "Report.json");
                            await System.IO.File.WriteAllTextAsync(pathReport, JsonConvert.SerializeObject(_report));
                        }
                    }
                    else
                    {
                        //Potrebbe essere lo scenario di un confronto!
                    }

                    if (addestramento.esportaSubito)
                    {
                        if (addestramento.externalCallPerExport != null)
                        {
                            //Creo nuova attività di esportazione e l'avvio perchè acquisisce automaticamente la priorità
                            //E gli assgno l'idParent dell'attività appena svolta di importazione
                            //Questo è naturalmente uno scenario PoP, lo vedremo più avanti
                        }
                    }

                    res.Attivita.Progress = 100;
                    if (pkg.persistent)
                    {
                        res.Attivita.Stato = (Byte)OperationStauts.Terminata;
                        res.Attivita.DataFine = DateTime.Now;
                        res.Attivita.StatoMsg = "Importazione terminata con successo";
                    }
                    else
                    {
                        res.Attivita.Stato = (Byte)OperationStauts.Esaminata;
                        res.Attivita.DataFine = DateTime.Now;
                        res.Attivita.StatoMsg = "Esaminata con successo";

                    }

                    //ctx_1.SaveChanges();
                    _ = await ctx_1.SaveChangesAsync();



                    result.Esito = true;
                }
                catch (Exception ex)
                {

                    ctx_1.AttivitaLogs.Add(icItem.addLog(id_attivita, TipoDiLog.Error, "EX1: " + ex.ToString()));
                    res.Attivita.Stato = (Byte)OperationStauts.TerminataConErrori;
                    res.Attivita.DataFine = DateTime.Now;
                    //ctx_1.SaveChanges();
                    _ = await ctx_1.SaveChangesAsync();

                    result.Esito = false;
                    result.errorCode = ErrorCodes.Generic;
                    result.error = ex.ToString();
                   
                }

            }
            catch (Exception ex2)
            {
                res.error = ex2.ToString();

                Console.WriteLine("importaovlantino EX2 -> " + ex2.ToString());

                res.Attivita!.Progress = 0;
                res.Attivita.Stato = (Byte)OperationStauts.TerminataConErrori;
                res.Attivita.DataFine = DateTime.Now;
                ctx_1.AttivitaLogs.Add(icItem.addLog(id_attivita, TipoDiLog.Error, "EX2: " + ex2.ToString()));
                //ctx_1.SaveChanges();
                _ = await ctx_1.SaveChangesAsync();
            }

            return Ok(res);
        }


        bool SonoUguali(object a, object b)
        {
            var tokenA = a != null ? JToken.FromObject(a) : null;
            var tokenB = b != null ? JToken.FromObject(b) : null;
            return JToken.DeepEquals(tokenA, tokenB);
        }


        protected void eseguiEsportazione(TracciatoResult lista, InputForExport req, Attivitum attivita)
        {
            
            //Raggruppamento per pagine e scrittura dell'xml e del csv nella cartella di destinazione indicata
            lista.ToString();

            //List<LogoBollo> lista_foto = new List<LogoBollo>();
            List<string> lista_foto = new List<string>();
            //List<string> lista_loghi = new List<string>();

            string nome_file_csv = this._path_to_export + lista.NomeEsportazione + ".csv";
            string nome_file_xml = this._path_to_export + lista.NomeEsportazione + ".xml";

            if (System.IO.File.Exists(this._path_to_export + nome_file_csv))
                System.IO.File.Delete(this._path_to_export + nome_file_csv);
            if (System.IO.File.Exists(this._path_to_export + nome_file_xml))
                System.IO.File.Delete(this._path_to_export + nome_file_xml);


            JObject inddInterpreter = JObject.Parse(System.IO.File.ReadAllText(this._path_external_source + "InterpreterXmlFromIndd.json"));
            InterpreterXmlFromIndd? inddInterpreterObj = inddInterpreter.ToObject<InterpreterXmlFromIndd>();
            InterpreterRuleFromIndd[] inddRules = inddInterpreterObj!.syncRevisione!;

            List<InterpreterRuleFromIndd> listaRegoleFromIndd = new List<InterpreterRuleFromIndd>();
            foreach (var rule in inddRules!)
            {
                bool take = rule.take;
                InterpreterRuleFromIndd currRule = rule;
                while (!take)
                {
                    foreach (var rule2 in currRule.children!)
                    {
                        take = rule2.take;
                        if (take)
                        {
                            //Aggiungo alla lista di interesse
                            listaRegoleFromIndd.Add(rule2);
                        }
                        else
                        {
                            //Per adesso questa struttura è pensata ad albero ma con un unico figlio NON take se il livello non è l'ultimo
                            //Quando arriva la rule TAKe significa che siamo arrivati al livello interessato
                            //Per cui in questa condizione posso subito passare al prossimo livello
                            currRule = rule2;
                            break;
                        }
                    }
                }
            }


            XmlWriterSettings xml_writer_settings = new XmlWriterSettings();
            xml_writer_settings.Indent = true;
            XmlWriter xml_writer = XmlWriter.Create(nome_file_xml);
            xml_writer.WriteComment("Export for InDesign");

            // Apro ROOT.
            xml_writer.WriteStartElement("Root");
            xml_writer.WriteAttributeString("sigla", lista.Area);
            xml_writer.WriteAttributeString("titolo", lista.NomeEsportazione);


            Int64 curpag = -1;
            int count_no_exp = 0;
            int count_exp = 0;
            foreach (Dictionary<string, object> item in lista.Records)
            {
                Int64 pag = (Int64)item["numero_pagina"];
                if (pag != curpag)
                {
                    if (curpag >= 0)
                    {
                        //Chiudo elemento pag
                        xml_writer.WriteEndElement();
                    }

                    curpag = pag;
                    //Inserimento tag pagina

                    //Apro elemento pag
                    xml_writer.WriteStartElement("pag");
                    xml_writer.WriteAttributeString("numero", pag.ToString());
                    if (req.ChEsportaDaMenabo)
                    {
                        xml_writer.WriteAttributeString("mastro", item["mastro"].ToString());
                    }

                }

                xml_writer.WriteStartElement("item");
                xml_writer.WriteAttributeString("posizione", item["posizione"].ToString());
                if (req.ChEsportaDaMenabo)
                {
                    xml_writer.WriteAttributeString("formato", item["formato"].ToString());
                }


                string tagName_descr_gruppo = GLOBAL_VARIABLES.keyXMLDescrizioneGruppo;
                if (item.ContainsKey(tagName_descr_gruppo))
                {
                    var JdescrGruppo = item[tagName_descr_gruppo] as JObject;
                    var descrGruppo = JdescrGruppo!.ToObject<Dictionary<string, object>>();
                    xml_writer.WriteStartElement(tagName_descr_gruppo);
                    foreach (string _k in descrGruppo!.Keys)
                    {
                        if (descrGruppo[_k] != null)
                            xml_writer.WriteElementString(_k, descrGruppo[_k].ToString());
                        else
                            xml_writer.WriteElementString(_k, "");
                    }
                    xml_writer.WriteEndElement();
                }

                string tagName_descr_gruppoMultiplex = "descrizione_gruppo_multiplex";
                if (item.ContainsKey(tagName_descr_gruppoMultiplex))
                {
                    var JdescrGruppoMultiplex = item[tagName_descr_gruppoMultiplex] as JObject;
                    var descrGruppoMultiplex = JdescrGruppoMultiplex!.ToObject<Dictionary<string, object>>();
                    xml_writer.WriteStartElement(tagName_descr_gruppoMultiplex);
                    foreach (string _k in descrGruppoMultiplex!.Keys)
                    {
                        if (descrGruppoMultiplex[_k] != null)
                            xml_writer.WriteElementString(_k, descrGruppoMultiplex[_k].ToString());
                        else
                            xml_writer.WriteElementString(_k, "");
                    }
                    xml_writer.WriteEndElement();
                }

                //xml_writer.WriteAttributeString("formato", pag.ToString());
                var jArr = item["refs"] as JArray;
                var _list_ref = jArr!.ToObject<List<Dictionary<string, object>>>();
                if (_list_ref!.Count > 0)
                {
                    xml_writer.WriteStartElement("refs");

                    foreach (var _ref in _list_ref)
                    {
                        if (_ref.ContainsKey("NoXml"))
                        {
                            count_no_exp++;
                            continue;
                        }
                        count_exp++;


                        Int64 stato_selezione = (Byte)TipoSelezioneMenabo.None;
                        if (_ref.ContainsKey(GLOBAL_VARIABLES.keyXMLSelezione))
                        {
                            stato_selezione = (Int64)_ref[GLOBAL_VARIABLES.keyXMLSelezione];
                        }
                        /*else if (_list_ref.Count==1)
                        {
                            stato_selezione = (Byte)TipoSelezioneMenabo.Primaria;
                        }*/

                        //if (stato_selezione == (Byte)TipoSelezioneMenabo.None)
                        //continue;


                        xml_writer.WriteStartElement("ref");

                        xml_writer.WriteAttributeString("selezione", stato_selezione.ToString());

                        int count = 0;

                        foreach (string k in _ref.Keys)
                        {
                            count++;
                            //if (count > 90)
                            //continue;

                            if (k == Enum.GetName(AddestramentoRuoli.Foto) + "." + GLOBAL_VARIABLES.keyFotoNome)
                            {
                                //Se qusto attributo lo leggo allora vuol dire che tale ref ha una foto che deve uscire
                                lista_foto.Add(_ref[k].ToString()!);
                            }

                            /*if (stato_selezione==(Byte)TipoSelezioneMenabo.EsportaSoloFoto)
                            {
                                if (k!= Enum.GetName(AddestramentoRuoli.Foto) + "." + GLOBAL_VARIABLES.keyFotoNome)
                                {
                                    //Se ho deciso di esportare solo la foto, questa ref mi esce solo con il riferimento della foto e basta
                                    continue;
                                }
                            }*/

                            if (_ref[k] is decimal)
                            {
                                xml_writer.WriteElementString(k, Decimal.Round((decimal)_ref[k], 2).ToString());
                            }
                            else if (_ref[k] is double || _ref[k] is byte)
                            {
                                xml_writer.WriteElementString(k, _ref[k].ToString());
                            }
                            else if (_ref[k] is DateTime)
                            {
                                xml_writer.WriteElementString(k, ((DateTime)_ref[k]).ToString("dd/MM/yyyy"));
                            }
                            else if (_ref[k] is int || _ref[k] is Int64 || _ref[k] is Int16)
                            {
                                xml_writer.WriteElementString(k, _ref[k].ToString());
                            }
                            else if (_ref[k] is string || _ref[k] is bool)
                            {
                                xml_writer.WriteStartElement(k);
                                //xml_writer.WriteCData(_ref[k].ToString().ConvertACapoConBrTagPerXml());
                                xml_writer.WriteEndElement();
                            }
                            else
                            {
                                //Tipo complesso
                                string[] ignore = new string[] { Enum.GetName(AddestramentoRuoli.Area)!, Enum.GetName(AddestramentoRuoli.Scatto)!, Enum.GetName(AddestramentoRuoli.Descrizioni)!, Enum.GetName(AddestramentoRuoli.Referenza)! };
                                if (!ignore.Contains(k))
                                {
                                    if (_ref[k] is JArray)
                                    {
                                        JArray? _arr = _ref[k] as JArray;
                                        var _arrDict = _arr!.ToObject<List<JObject>>();
                                        xml_writer.WriteStartElement(k);
                                        foreach (JObject _obj in _arrDict!)
                                        {
                                            var _objDict = _obj.ToObject<Dictionary<string, string>>();
                                            foreach (string _k in _objDict!.Keys)
                                            {
                                                //Qui serve di implementare un metodo recursivo che legga gli elementi complessi annidati senza un limite di livello
                                                string _val = _objDict[_k].ToString();
                                                xml_writer.WriteElementString(_k, _val);


                                                var regolaIndd = listaRegoleFromIndd.Where(r => r.name == _k).FirstOrDefault();
                                                if (regolaIndd != null && regolaIndd.indicaFoto)
                                                {
                                                    _val.Split(regolaIndd.separatoreDiValore, StringSplitOptions.RemoveEmptyEntries).Where(f => !lista_foto.Contains(f)).ForEach(f2 =>
                                                        lista_foto.Add(f2)
                                                    );

                                                }
           
                                            }
                                        }
                                        xml_writer.WriteEndElement();
                                    }
                                    if (_ref[k] is JObject)
                                    {
                                        xml_writer.WriteStartElement(k);
                                        var _objDict = (_ref[k] as JObject)!.ToObject<Dictionary<string, object>>();

                                        foreach (string _k in _objDict!.Keys)
                                        {
                                            if (_objDict[_k] is JObject)
                                            {
                                                //Qui serve di implementare un metodo recursivo che legga gli elementi complessi annidati senza un limite di livello
                                                //Per adesso, data la necessità di leggere l'oggetto complesso ultilivello SyncIndd, mi limito a scansionare il secondo livello
                                                var _objDict2 = (_objDict[_k] as JObject)!.ToObject<Dictionary<string, string>>();
                                                foreach (string _k2 in _objDict2!.Keys)
                                                {
                                                    string _val2 = _objDict2[_k2].ToString();
                                                    xml_writer.WriteElementString(_k2, _val2);

                                                    var regolaIndd = listaRegoleFromIndd.Where(r => r.name == _k).FirstOrDefault();
                                                    if (regolaIndd != null && regolaIndd.indicaFoto)
                                                    {
                                                        _val2.Split(regolaIndd.separatoreDiValore, StringSplitOptions.RemoveEmptyEntries).Where(f => !lista_foto.Contains(f)).ForEach(f2 =>
                                                            lista_foto.Add(f2)
                                                        );

                                                    }
                                                }
                                            }
                                            else
                                            {
                                                string? _val = _objDict[_k].ToString();
                                                xml_writer.WriteElementString(_k, _val);


                                                var regolaIndd = listaRegoleFromIndd.Where(r => r.name == _k).FirstOrDefault();
                                                if (regolaIndd != null && regolaIndd.indicaFoto)
                                                {
                                                    _val!.Split(regolaIndd.separatoreDiValore, StringSplitOptions.RemoveEmptyEntries).Where(f => !lista_foto.Contains(f)).ForEach(f2 =>
                                                        lista_foto.Add(f2)
                                                    );

                                                }
                                            }
                                        }

                                        xml_writer.WriteEndElement();
                                    }
                                }
                            }


                        }

                        xml_writer.WriteEndElement();
                    }

                    xml_writer.WriteEndElement();
                }


                xml_writer.WriteEndElement();

            }

            if (curpag >= 0)
            {
                //Chiudo ultimo elemento pag
                xml_writer.WriteEndElement();
            }

            //Chiudo elemento Root
            xml_writer.WriteEndElement();
            xml_writer.Flush();
            xml_writer.Close();

            if (count_exp > 0)
            {
                //if (lista_loghi.Count > 0)
                //{
                //    lista_foto.AddRange(lista_loghi);
                //}

                //Aggiungo loghi e bolli
                JObject? oLB = JObject.Parse(System.IO.File.ReadAllText(this._path_external_source + "SourceLoghiBolli.json"));
                DbLoghiBolli? loghibolli = oLB!.ToObject<DbLoghiBolli>();
                lista_foto.AddRange(loghibolli!.source.Select(s=>s.nome).ToArray());


                //Recupero path alta del progetto
                JObject o1 = JObject.Parse(System.IO.File.ReadAllText(this._path_external_source + "SourceUnita.json"));
                DbUnita? archiviDB = o1.ToObject<DbUnita>();
                DbUnitaItem? alta_folder = archiviDB!.source.Where(s => !s.webFolder && !s.syncFolder && !s.exportFolder).FirstOrDefault();
                DbUnitaItem? export_folder = archiviDB.source.Where(s => s.exportFolder).FirstOrDefault();


                //Faccio partire l'operazione I/O figlia dell'attività di esportazione
                OperationRequest op = new OperationRequest();
                op.Command = OperationCommand.CopiaFiles;
                op.AttivitaParent = attivita.Id;

                InputForI_O io_command = new InputForI_O();
                io_command.csvFile = "";
                io_command.xmlFile = nome_file_xml;
                io_command.foto = lista_foto;
                io_command.folder = export_folder!.path + System.IO.Path.DirectorySeparatorChar + req.CartellaDiEsportazione;
                io_command.Titolo = lista.NomeEsportazione;
                io_command.IdUnitaExport = export_folder.id;

                op.Packet = io_command;




                //Aggiungo attività da svolgere collegata all'attività padre di esportazione
                OperationsController op_ctrl = new OperationsController(this._conn_string, "", "", dbContextFactory2: this._dbContextFactory2);
                _= op_ctrl.Add(op);

            }


        }

        protected void eseguiEsportazionePoP(TracciatoResult lista, InputForExport req, Attivitum attivita)
        {
            //Raggruppamento per pagine e scrittura dell'xml e del csv nella cartella di destinazione indicata
            lista.ToString();

            List<string> lista_foto = new List<string>();
            //List<string> lista_loghi = new List<string>();

            string nome_file_xml = this._path_to_export + lista.NomeEsportazione + "_PoP.xml";

            if (System.IO.File.Exists(this._path_to_export + nome_file_xml))
                System.IO.File.Delete(this._path_to_export + nome_file_xml);



            XmlWriterSettings xml_writer_settings = new XmlWriterSettings();
            xml_writer_settings.Indent = true;
            XmlWriter xml_writer = XmlWriter.Create(nome_file_xml);
            xml_writer.WriteComment("Export for InDesign");

            // Apro ROOT.
            xml_writer.WriteStartElement("Root");
            if (req.fields!.ContainsKey("tracciatoFieldsStringfy"))
            {
                var dictTMeta = JsonConvert.DeserializeObject<Dictionary<string, object>>(req.fields["tracciatoFieldsStringfy"]);
                xml_writer.WriteAttributeString("sigla", dictTMeta!["Area"].ToString());
            }
            if (req.fields.ContainsKey("addestramento"))
            {
                xml_writer.WriteAttributeString("addestramento", req.fields["addestramento"]);
            }

            xml_writer.WriteAttributeString("titolo", lista.NomeEsportazione);


            JObject inddInterpreter = JObject.Parse(System.IO.File.ReadAllText(this._path_external_source + "InterpreterXmlFromIndd.json"));
            InterpreterXmlFromIndd? inddInterpreterObj = inddInterpreter.ToObject<InterpreterXmlFromIndd>();
            InterpreterRuleFromIndd[] inddRules = inddInterpreterObj!.syncRevisione!;

            List<InterpreterRuleFromIndd> listaRegoleFromIndd = new List<InterpreterRuleFromIndd>();
            foreach(var rule in inddRules)
            {
                bool take = rule.take;
                InterpreterRuleFromIndd currRule = rule;
                while (!take) 
                {
                    foreach (var rule2 in currRule.children!)
                    {
                        take = rule2.take;
                        if (take)
                        {
                            //Aggiungo alla lista di interesse
                            listaRegoleFromIndd.Add(rule2);
                        }
                        else
                        {
                            //Per adesso questa struttura è pensata ad albero ma con un unico figlio NON take se il livello non è l'ultimo
                            //Quando arriva la rule TAKe significa che siamo arrivati al livello interessato
                            //Per cui in questa condizione posso subito passare al prossimo livello
                            currRule = rule2;
                            break;
                        }
                    }
                }
            }


            
            int count_no_exp = 0;
            int count_exp = 0;
            foreach (Dictionary<string, object> item in lista.Records)
            {

                if (item.ContainsKey("NoXml"))
                {
                    count_no_exp++;
                    continue;
                }
                count_exp++;



                xml_writer.WriteStartElement("ref");


                int count = 0;

                foreach (string k in item.Keys)
                {
                    count++;
                    //if (count > 90)
                    //continue;
                    if (k == "SyncFromIndd")
                        "trace".ToString();

                    if (k == Enum.GetName(AddestramentoRuoli.Foto) + "." + GLOBAL_VARIABLES.keyFotoNome)
                    {
                        //Se qusto attributo lo leggo allora vuol dire che tale ref ha una foto che deve uscire
                        lista_foto.Add(item[k]!.ToString()!);
                    }



					if (item[k] is decimal)
                    {
                        xml_writer.WriteElementString(k, Decimal.Round((decimal)item[k], 2).ToString());
                    }
                    else if (item[k] is double || item[k] is byte)
                    {
                        xml_writer.WriteElementString(k, item[k].ToString());
                    }
                    else if (item[k] is DateTime)
                    {
                        xml_writer.WriteElementString(k, ((DateTime)item[k]).ToString("dd/MM/yyyy"));
                    }
                    else if (item[k] is int || item[k] is Int64 || item[k] is Int16)
                    {
                        xml_writer.WriteElementString(k, item[k].ToString());
                    }
                    else if (item[k] is string || item[k] is bool)
                    {
                        xml_writer.WriteStartElement(k);
                        xml_writer.WriteCData(item[k].ToString());
                        xml_writer.WriteEndElement();
                    }
                    else
                    {
                        //Tipo complesso
                        string[] ignore = new string[] { Enum.GetName(AddestramentoRuoli.Area)!, Enum.GetName(AddestramentoRuoli.Scatto)!, Enum.GetName(AddestramentoRuoli.Descrizioni)!, Enum.GetName(AddestramentoRuoli.Referenza)! };
                        if (!ignore.Contains(k))
                        {
                            if (item[k] is JArray)
                            {
                                JArray? _arr = item[k] as JArray;
                                var _arrDict = _arr!.ToObject<List<JObject>>();
                                xml_writer.WriteStartElement(k);
                                foreach (JObject _obj in _arrDict!)
                                {
                                    var _objDict = _obj.ToObject<Dictionary<string, string>>();
                                    foreach (string _k in _objDict!.Keys)
                                    {
                                        //Qui serve di implementare un metodo recursivo che legga gli elementi complessi annidati senza un limite di livello
                                        string _val = _objDict[_k].ToString();
                                        xml_writer.WriteElementString(_k, _val);

                                        var regolaIndd = listaRegoleFromIndd.Where(r => r.name == _k).FirstOrDefault();
                                        if (regolaIndd!=null && regolaIndd.indicaFoto)
                                        {
                                            _val.Split(regolaIndd.separatoreDiValore, StringSplitOptions.RemoveEmptyEntries).Where(f => !lista_foto.Contains(f)).ForEach(f2 =>
                                                lista_foto.Add(f2)
                                            );
                                            
                                        }

                                    }
                                }
                                xml_writer.WriteEndElement();
                            }
                            if (item[k] is JObject)
                            {
                                xml_writer.WriteStartElement(k);
                                var _objDict = (item[k] as JObject)!.ToObject<Dictionary<string, object>>();

                                foreach (string _k in _objDict!.Keys)
                                {
                                    if (_objDict[_k] is JObject)
                                    {
                                        //Qui serve di implementare un metodo recursivo che legga gli elementi complessi annidati senza un limite di livello
                                        //Per adesso, data la necessità di leggere l'oggetto complesso ultilivello SyncIndd, mi limito a scansionare il secondo livello
                                        var _objDict2 = (_objDict[_k] as JObject)!.ToObject<Dictionary<string, string>>();
                                        foreach (string _k2 in _objDict2!.Keys)
                                        {
                                            string _val2 = _objDict2[_k2].ToString();
                                            xml_writer.WriteElementString(_k2, _val2);

                                            var regolaIndd = listaRegoleFromIndd.Where(r => r.name == _k2).FirstOrDefault();
                                            if (regolaIndd != null && regolaIndd.indicaFoto)
                                            {
                                                _val2.Split(regolaIndd.separatoreDiValore, StringSplitOptions.RemoveEmptyEntries).Where(f => !lista_foto.Contains(f)).ForEach(f2 =>
                                                    lista_foto.Add(f2)
                                                );
                                            }

                                        }
                                    }
                                    else
                                    {
                                        string? _val = _objDict[_k]!.ToString();
                                        xml_writer.WriteElementString(_k, _val);

                                        var regolaIndd = listaRegoleFromIndd.Where(r => r.name == _k).FirstOrDefault();
                                        if (regolaIndd != null && regolaIndd.indicaFoto)
                                        {
                                            _val!.Split(regolaIndd.separatoreDiValore, StringSplitOptions.RemoveEmptyEntries).Where(f => !lista_foto.Contains(f)).ForEach(f2 =>
                                                lista_foto.Add(f2)
                                            );
                                        }
                                    }
                                }

                                xml_writer.WriteEndElement();
                            }
                        }
                    }


                }

                xml_writer.WriteEndElement();


            }


            //Chiudo elemento Root
            xml_writer.WriteEndElement();
            xml_writer.Flush();
            xml_writer.Close();

            if (count_exp > 0)
            {
                //if (lista_loghi.Count > 0)
                //{
                //    lista_foto.AddRange(lista_loghi);
                //}

                //Aggiungo loghi e bolli
                JObject? oLB = JObject.Parse(System.IO.File.ReadAllText(this._path_external_source + "SourceLoghiBolli.json"));
                DbLoghiBolli? loghibolli = oLB.ToObject<DbLoghiBolli>();
                lista_foto.AddRange(loghibolli!.source.Select(s=>s.nome).ToArray());


                //Recupero path alta del progetto
                JObject? o1 = JObject.Parse(System.IO.File.ReadAllText(this._path_external_source + "SourceUnita.json"));
                DbUnita? archiviDB = o1.ToObject<DbUnita>();
                DbUnitaItem? alta_folder = archiviDB!.source.Where(s => !s.webFolder && !s.syncFolder && !s.exportFolder).FirstOrDefault();
                DbUnitaItem? export_folder = archiviDB!.source.Where(s => s.exportFolder).FirstOrDefault();


                //Faccio partire l'operazione I/O figlia dell'attività di esportazione
                OperationRequest op = new OperationRequest();
                op.Command = OperationCommand.CopiaFiles;
                op.AttivitaParent = attivita.Id;

                InputForI_O io_command = new InputForI_O();
                io_command.csvFile = "";
                io_command.xmlFile = nome_file_xml;
                io_command.foto = lista_foto;
                io_command.folder = export_folder!.path + System.IO.Path.DirectorySeparatorChar + req.CartellaDiEsportazione;
                io_command.Titolo = lista.NomeEsportazione;
                io_command.IdUnitaExport = export_folder.id;

                op.Packet = io_command;




                //Aggiungo attività da svolgere collegata all'attività padre di esportazione
                OperationsController op_ctrl = new OperationsController(this._conn_string, "", "", dbContextFactory2: this._dbContextFactory2);
                _=op_ctrl.Add(op);

            }


        }



        private Byte[] getFamigliaOperativa(OperationCommand cmd)
        {
            switch ((Byte)cmd)
            {
                case (Byte)OperationCommand.EsportazioneVol:
                case (Byte)OperationCommand.EsportazionePoP:
                case (Byte)OperationCommand.EsportazioneConfronto:
                case (Byte)OperationCommand.SyncFoto:
                    return new Byte[] { (Byte)OperationCommand.EsportazioneVol, (Byte)OperationCommand.EsportazionePoP, (Byte)OperationCommand.EsportazioneConfronto, (Byte)OperationCommand.SyncFoto };
                default:
                    return new Byte[] { (Byte)OperationCommand.ImportazioneVol, (Byte)OperationCommand.ImportazionePoP, (Byte)OperationCommand.ConfrontoLista };
            }

        }

        private Byte getSimultaneousFactor(OperationCommand cmd)
        {
            switch ((Byte)cmd)
            {
                case (Byte)OperationCommand.EsportazioneVol:
                case (Byte)OperationCommand.EsportazionePoP:
                case (Byte)OperationCommand.EsportazioneConfronto:
                case (Byte)OperationCommand.SyncFoto:
                    return GLOBAL_VARIABLES.maxSimultaneousOperationRequestOfIO;
                default:
                    return GLOBAL_VARIABLES.maxSimultaneousOperationRequestOfElaboration;
            }

        }
    }
}
