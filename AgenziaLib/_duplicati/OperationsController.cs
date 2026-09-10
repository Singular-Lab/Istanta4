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

        public OperationsController(string conn_string, string path_to_import, string path_to_export, string external_lib = "", string external_source = "")
        {
            this.ctx = new edro21_dbContext(conn_string);
            this.ctx2 = new Edro21_DbContext2(conn_string);

            this._path_to_export = path_to_export;
            this._path_to_import = path_to_import;

            this._conn_string = conn_string;

            this._path_external_lib = external_lib;
            this._path_external_source = external_source;
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
                    if (inExp.fields.ContainsKey("Titolo"))
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
                    if (inExp.fields.ContainsKey("Titolo"))
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
                att.DataInserimento = DateTime.Now;
                att.Contract = contract;
                att.Tipo = (Byte)request.Command;
                att.Titolo = titolo;
                if (request.AttivitaParent > 0)
                    att.IdParent = request.AttivitaParent;


                //Controllo coda e assegnazione eventuale a seconda del tipo di peso di attività
                Byte[] operation_queue = getFamigliaOperativa(request.Command);
                var _attivita_in_corso = this.ctx.Attivita.Where(a => a.Stato != (Byte)OperationStauts.Terminata && a.Stato != (Byte)OperationStauts.TerminataConErrori && operation_queue.Contains<Byte>(a.Tipo)).ToList();
                Attivitum? _last_in_coda = _attivita_in_corso.OrderByDescending(ord => ord.Coda).FirstOrDefault();
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

                await this.ctx.Attivita.AddAsync(att);
                await this.ctx.SaveChangesAsync();

                request.AttivitaAssegnata = att.Id;
                contract = JsonConvert.SerializeObject(request);
                att.Contract = contract;

                await this.ctx.SaveChangesAsync();


                return Ok(att);

            }
            catch (Exception ex)
            {
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
                    string strpkg = opReq!.Packet.ToString();


                    //var fotoArr = JsonConvert.DeserializeObject<Array>("");
                    //Response.Write("FOTO TROVATE: " + fotoArr.GetType().Name.Name);


                    if (_item.Tipo == (Byte)OperationCommand.ImportazioneVol /*|| _item.Tipo == (Byte)OperationCommand.ImportazionePoP*/)
                    {
                        InputFormTracciato? packet = JsonConvert.DeserializeObject<InputFormTracciato>(strpkg);
                        if (packet != null)
                        {

                            OkObjectResult _import_result = (OkObjectResult)await importaVolantino(opReq.AttivitaAssegnata, packet);
                            if (_import_result.Value is AttivitaResult)
                            {
                                result = (AttivitaResult)_import_result.Value;
                            }
                        }

                    }
                    else if (_item.Tipo == (Byte)OperationCommand.EsportazioneVol || _item.Tipo == (Byte)OperationCommand.EsportazionePoP)
                    {
                        InputForExport? packet = JsonConvert.DeserializeObject<InputForExport>(strpkg);
                        if (packet != null)
                        {
                            if (_item.Tipo == (Byte)OperationCommand.EsportazioneVol)
                            {
                                OkObjectResult _exp_result = (OkObjectResult)await esportaVolantino(opReq.AttivitaAssegnata, packet);
                                if (_exp_result.Value is AttivitaResult)
                                {
                                    result = (AttivitaResult)_exp_result.Value;
                                }
                            }
                            else
                            {
                                OkObjectResult _exp_result = (OkObjectResult)await esportaPoP(opReq.AttivitaAssegnata, packet);
                                if (_exp_result.Value is AttivitaResult)
                                {
                                    result = (AttivitaResult)_exp_result.Value;
                                }
                            }
                        }
                    }
                    else if (_item.Tipo == (Byte)OperationCommand.CopiaFiles)
                    {
                        InputForI_O? packet = JsonConvert.DeserializeObject<InputForI_O>(strpkg);
                        if (packet != null)
                        {
                            OkObjectResult _exp_result = (OkObjectResult)await copiaFiles(opReq.AttivitaAssegnata, packet);
                            if (_exp_result.Value is AttivitaResult)
                            {
                                result = (AttivitaResult)_exp_result.Value;
                            }
                        }
                    }
                    else if (_item.Tipo == (Byte)OperationCommand.ConfrontoLista)
                    {
                        InputForConfronto? packet = JsonConvert.DeserializeObject<InputForConfronto>(strpkg);
                        if (packet != null)
                        {
                            OkObjectResult _conf_result = (OkObjectResult)await confontaListe(opReq.AttivitaAssegnata, packet);
                            if (_conf_result.Value is AttivitaResult)
                            {
                                result = (AttivitaResult)_conf_result.Value;
                            }
                        }
                    }

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

        private async Task<IActionResult> importaVolantino(Int64 id_attivita, InputFormTracciato pkg)
        {

            AttivitaResult res = new AttivitaResult();
            IstantaController icItem = new IstantaController(this._conn_string);

            try
            {

                BoolResult result = new BoolResult();

                string path_attivita = _path_to_import + id_attivita + "\\";
                string source = path_attivita + pkg.filename;


                res.Attivita = this.ctx.Attivita.Find(id_attivita);
                res.Attivita.Stato = (Byte)OperationStauts.ElaborazioneDati;
                res.Attivita.DataInizio = DateTime.Now;
                this.ctx.SaveChanges();

                //Recupero lo schema di addestramento
                AddestramentoExcel addestramento = await this.ctx2.AddestramentoExcels.Include(i => i.SchemaCampiExcels).ThenInclude(i2 => i2.AddestramentoExcelRelazionis).Where(a => a.Id == pkg.cmbAddestramenti).FirstOrDefaultAsync();
                List<SchemaCampiExcel> _campi = addestramento.SchemaCampiExcels.ToList();

                string kRefCod = Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice;
                string kRefEan = Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefEan;
                SchemaCampiExcel cRefCod = _campi.Where(c => c.NomeColonna == kRefCod).FirstOrDefault();
                SchemaCampiExcel cRefEan = _campi.Where(c => c.NomeColonna == kRefEan).FirstOrDefault();

                if (addestramento.externalCallPerImport == null)
                {
                    throw new Exception("interpreteImportNonDefinito");
                }
                if (addestramento.esportaSubito && addestramento.externalCallPerExport == null)
                {
                    throw new Exception("interpreteExportNonDefinito");
                }

                //Campi aggiuntivi riferiti al processo di importazione (Durante o a fine)
                List<SchemaCampiExcel> campi_aggiuntivi = addestramento.SchemaCampiExcels.Where(
                    ce => ce.AddestramentoExcelRelazionis.Count > 0 &&
                    (ce.AddestramentoExcelRelazionis.FirstOrDefault().TipoCompilazione == (Byte)TipoCompilazione.DuranteImportazione || ce.AddestramentoExcelRelazionis.FirstOrDefault().TipoCompilazione == (Byte)TipoCompilazione.FineImportazione)).ToList();


                try
                {

                    //Simulazione Importazione
                    //Con parametri

                    PromoImportazioni pImp = new PromoImportazioni();
                    pImp.DataCaricamento = DateTime.Now;
                    pImp.ParamsRequest = JsonConvert.SerializeObject(pkg.fields);
                    pImp.IdPromo = pkg.idPromo;
                    pImp.IdAddestramento = addestramento.Id;
                    pImp.NomeFile = pkg.filename;
                    this.ctx2.Add(pImp);


                    this.ctx2.SaveChanges();


                    //Adesso leggo lo schema
                    bool headerIsFound = false;

                    List<Dictionary<string, object>> tracciato = new List<Dictionary<string, object>>();


                    JObject o1 = JObject.Parse(System.IO.File.ReadAllText(this._path_external_source + "SourceAree.json"));
                    DbAree areeDB = o1.ToObject<DbAree>();
                    List<Aree> aree = areeDB.source;

                    IstantaController icCtrl = new IstantaController("", this._path_external_lib, this._path_external_source);

                    List<Articoli> _articoli_cache = new List<Articoli>();

                    double media_processo_item = 0;
                    int count_items = 0;

                    string nome_colonna_scatto = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodice;
                    string nome_colonna_codGruppo = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppo;

                    Int16 lettura_tot_perc = 80;

                    res.Attivita.Progress = 0;
                    res.Attivita.StatoMsg = "Inizio lettura del file excel";
                    this.ctx.SaveChanges();



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
                                    this.ctx.SaveChanges();
                                }

                                DateTime inizio_processo_item = DateTime.Now;

                                Dictionary<string, object> rec = new Dictionary<string, object>();

                                int fieldRead = 0;

                                Articoli artRecord = null;

                                bool triedToFindRef = false;

                                for (int c = 0; c < reader.FieldCount; c++)
                                {
                                    fieldRead++;

                                    if (!headerIsFound)
                                    {

                                    }
                                    else
                                    {
                                        SchemaCampiExcel schema_campo = _campi.Where(f => f.Indice == c).FirstOrDefault();

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


                                            string _val = "";
                                            if (!reader.IsDBNull(c))
                                                _val = reader.GetValue(c).ToString();

                                            /*if (schema_campo.Ruolo == Enum.GetName(AddestramentoRuoli.Scatto))
                                            {
                                                nome_colonna_scatto = schema_campo.NomeColonna;
                                            }*/


                                            rec[schema_campo.NomeColonna] = icCtrl.parseAddesttramentoValue(_val, schema_campo);

                                            if (scope != "")
                                            {
                                                //Altro ragionamento, basato su unità logiche
                                                if (scope == Enum.GetName(AddestramentoRuoli.Area))
                                                {
                                                    if (scope_chiave == GLOBAL_VARIABLES.keyAreaCodice)
                                                    {
                                                        Aree aItem = aree.Where(a => a.Codice == _val).FirstOrDefault();
                                                        var dict = new Dictionary<string, object>();
                                                        dict.Add(GLOBAL_VARIABLES.keyAreaCodice, aItem!.Codice);
                                                        dict.Add("Id", aItem!.Id);

                                                        rec[scope] = dict;

                                                    }
                                                    else
                                                    {
                                                        if (rec[scope] != null)
                                                        {
                                                            (rec[scope] as Dictionary<string, object>).Add(scope_chiave, icCtrl.parseAddesttramentoValue(_val, schema_campo));
                                                        }
                                                    }

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
                                                            if (_val == "")
                                                            {
                                                                //Codice ref non presente, la lettura si interrompe
                                                                rec = new Dictionary<string, object>();
                                                                break;
                                                            }

                                                            triedToFindRef = true;
                                                            artRecord = _articoli_cache.Where(ac => ac.Codice == _val).FirstOrDefault();
                                                            if (artRecord == null)
                                                            {
                                                                artRecord = this.ctx.Articolis.Where(a => a.Codice == _val).FirstOrDefault();
                                                                if (artRecord != null)
                                                                    _articoli_cache.Add(artRecord);
                                                            }
                                                        }
                                                        else if (scope_chiave == GLOBAL_VARIABLES.keyRefId)
                                                        {
                                                            triedToFindRef = true;
                                                            artRecord = this.ctx.Articolis.Where(a => a.Id == Int64.Parse(_val)).FirstOrDefault();
                                                        }
                                                        else if (scope_chiave == GLOBAL_VARIABLES.keyRefEan)
                                                        {
                                                            if (_val != "")
                                                            {
                                                                triedToFindRef = true;
                                                                artRecord = _articoli_cache.Where(ac => ac.Ean == _val).FirstOrDefault();
                                                                if (artRecord == null)
                                                                {
                                                                    artRecord = this.ctx.Articolis.Where(a => a.Ean == _val).FirstOrDefault();
                                                                    if (artRecord != null)
                                                                        _articoli_cache.Add(artRecord);
                                                                }
                                                            }
                                                        }
                                                    }
                                                    else
                                                    {
                                                        if (scope_chiave == GLOBAL_VARIABLES.keyRefEan)
                                                        {
                                                            if (_val.Length>30)
                                                            {
                                                                _val = _val.Substring(0, 30);
                                                            }    
                                                            artRecord.Ean = _val;
                                                            this.ctx.SaveChanges();
                                                        }
                                                    }

                                                    if (artRecord != null && !rec.ContainsKey(scope))
                                                    {
                                                        string refJson = JsonConvert.SerializeObject(artRecord);
                                                        rec.Add(scope, JsonConvert.DeserializeObject<Dictionary<string, object>>(refJson));
                                                    }

                                                }
                                                else if (scope == Enum.GetName(AddestramentoRuoli.Descrizioni))
                                                {
                                                    if (!rec.ContainsKey(scope))
                                                    {
                                                        rec.Add(scope, new Dictionary<string, object>());
                                                    }

                                                    (rec[scope] as Dictionary<string, object>).Add(scope_chiave, _val);
                                                }
                                            }
                                        }
                                    }

                                }

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
                                    //Impostazione campi aggiuntivi DURANTE IMPORTAZIONE da compilare tramite call esterna
                                    /* Scrivere codice qui */
                                    /*foreach (SchemaCampiExcel campoExt in campi_aggiuntivi)
                                    {
                                        if (campoExt.AddestramentoExcelRelazionis.FirstOrDefault().TipoCompilazione == (Byte)TipoCompilazione.DuranteImportazione)
                                        {

                                        }
                                    }*/

                                    if (triedToFindRef && artRecord == null)
                                    {
                                        //Nonostante ilk tentativo di cercare la ref corrisponendete in archivio, il sistema non
                                        //ha trovato niente, è quindi il momento di creare la ref vuota con il codice e ean specificato
                                        //E aggiornare il record del tracciato


                                        //SchemaCampiExcel cRefCod = _campi.Where(c => c.NomeColonna == kRefCod).FirstOrDefault();
                                        //SchemaCampiExcel cRefEan = _campi.Where(c => c.NomeColonna == kRefEan).FirstOrDefault();

                                        if (cRefCod != null)
                                        {
                                            if (rec[kRefEan].ToString().Length > 30)
                                            {
                                                rec[kRefEan] = rec[kRefEan].ToString().Substring(0, 30);
                                            }

                                            Articoli newArt = new Articoli();
                                            newArt.Descrizione1 = "";
                                            newArt.Descrizione2 = "";
                                            newArt.Descrizione3 = "";
                                            newArt.Descrizione4 = "";
                                            newArt.Codice = rec[kRefCod].ToString();
                                            if (cRefEan != null && rec.ContainsKey(kRefEan))
                                            {
                                                newArt.Ean = rec[kRefEan].ToString();
                                            }
                                            newArt.StatoRevisione = (Byte)StatoRevisioneArticolo.NonProcessato;
                                            newArt.DataInserimento = DateTime.Now;
                                            this.ctx.Add(newArt);
                                            this.ctx.SaveChanges();

                                            _articoli_cache.Add(newArt);
                                            string refJson = JsonConvert.SerializeObject(newArt);
                                            rec.Add(Enum.GetName(AddestramentoRuoli.Referenza), JsonConvert.DeserializeObject<Dictionary<string, object>>(refJson));

                                        }
                                    }
                                    else if (artRecord != null)
                                    {
                                        //Vediamo se ho da aggiornare qualche campo
                                        //L'ean per adesso è l'unico campo rimasto indietro e da controllare
                                        if (cRefEan != null && rec.ContainsKey(kRefEan))
                                        {
                                            if (rec[kRefEan].ToString().Length > 30)
                                            {
                                                rec[kRefEan] = rec[kRefEan].ToString().Substring(0, 30);
                                            }
                       
                                            if (artRecord.Ean != rec[kRefEan].ToString())
                                            {
                                                if (rec[kRefEan].ToString().Length <= 30)
                                                {
                                                    artRecord.Ean = rec[kRefEan].ToString();
                                                    artRecord.DataModifica = DateTime.Now;
                                                    this.ctx.SaveChanges();
                                                }
                                            }
                                        }
                                    }

                                    if (rec.ContainsKey(kRefCod))
                                    {
                                        //Estraggo la firma del tracciato importato
                                        //string firma = "#";
                                        //string dyScopeDescr = Enum.GetName(AddestramentoRuoli.Descrizioni) + ".{0}";
                                        //if (rec.ContainsKey(String.Format(dyScopeDescr, GLOBAL_VARIABLES.keyDescr1)))
                                        //    firma += rec[String.Format(dyScopeDescr, GLOBAL_VARIABLES.keyDescr1)].ToString() + "#";
                                        //if (rec.ContainsKey(String.Format(dyScopeDescr, GLOBAL_VARIABLES.keyDescr2)))
                                        //    firma += rec[String.Format(dyScopeDescr, GLOBAL_VARIABLES.keyDescr2)].ToString() + "#";
                                        //if (rec.ContainsKey(String.Format(dyScopeDescr, GLOBAL_VARIABLES.keyDescr3)))
                                        //    firma += rec[String.Format(dyScopeDescr, GLOBAL_VARIABLES.keyDescr3)].ToString() + "#";
                                        //if (rec.ContainsKey(String.Format(dyScopeDescr, GLOBAL_VARIABLES.keyDescr4)))
                                        //    firma += rec[String.Format(dyScopeDescr, GLOBAL_VARIABLES.keyDescr4)].ToString() + "#";
                                        string kFirma = Enum.GetName(AddestramentoRuoli.Tracciato) + "." + GLOBAL_VARIABLES.keyTracciatoFirma;
                                        if (!rec.ContainsKey(kFirma))
                                        {
                                            string firma = Utility.Main.getFirmaTracciato(rec);
                                            rec[kFirma] = firma;
                                        }

                                        tracciato.Add(rec);
                                    }
                                }

                            }
                        }
                    }

                    media_processo_item = media_processo_item / count_items;



                    if (addestramento.externalCallPerImport != null)
                    {
                        res.Attivita.Progress = lettura_tot_perc;
                        res.Attivita.StatoMsg = "Interpretazione del dato...";
                        this.ctx.SaveChanges();

                        Dictionary<string, object> _pass = new Dictionary<string, object>();
                        _pass["tracciato"] = tracciato;
                        _pass["formRequest"] = pkg.fields;
                        string resultExternal = icCtrl.execLibFunction(addestramento.externalCallPerImport, _pass).ToString();


                        ImportResult parsingRes = JsonConvert.DeserializeObject<ImportResult>(resultExternal!);

                        if (parsingRes.errors != "")
                        {
                            throw new Exception(parsingRes.errors);
                        }

                        if (addestramento.salvaSuDb)
                        {
                            res.Attivita.Progress = 90;
                            res.Attivita.Stato = (Byte)OperationStauts.ElaborazioneDati;
                            res.Attivita.StatoMsg = "Salvataggio nel database";
                            this.ctx.SaveChanges();

                            List<PromoTracciati> _promo_tracciati_esistenti = this.ctx2.PromoTracciatis.Where(p => p.IdPromo == pImp.IdPromo).ToList();




                            foreach (Dictionary<string, object> lista in parsingRes.liste)
                            {
                                //var str1 = "Inserisco nel db " + lista["Area"].ToString();
                                var _recs = lista["Records"];
                                var recs = (_recs as JArray).ToObject<List<Dictionary<string, object>>>();

                                string areaKey = Enum.GetName(AddestramentoRuoli.Area);

                                //Controllo se esiste il tracciato
                                PromoTracciati pTr = _promo_tracciati_esistenti.Where(pt => Utility.Main.getJsonObject(pt.Meta)[areaKey].ToString() == lista[areaKey].ToString()).FirstOrDefault();

                                bool tracciatoNuovo = true;

#warning Versione Tracciato Obsoleta
                                //Attenzione
                                //La versione del tracciato con l'introduzione e diversificazione delle LABEL,
                                //Diventa obsoleta perchè da una versione progressiva assoluta che non so quanto possa fare comodo

                                if (pTr == null)
                                {
                                    pTr = new PromoTracciati();
                                    pTr.IdImportazione = pImp.Id;
                                    pTr.IdPromo = pImp.IdPromo;
                                    pTr.Versione = (Byte)1;
                                    if (lista.ContainsKey(GLOBAL_VARIABLES.keySiglaTracciato))
                                        pTr.Sigla = lista[GLOBAL_VARIABLES.keySiglaTracciato].ToString();

                                    lista.Remove("Records");
                                    pTr.Meta = JsonConvert.SerializeObject(lista);


                                    this.ctx2.Add(pTr);
                                    this.ctx2.SaveChanges();
                                }
                                else
                                {
                                    //Aggiorniamo solo l'id importazione a quello nuovo attuale
                                    tracciatoNuovo = false;
                                    //pTr.IdImportazione = pImp.Id;//Non aggiorniamo l'id importazione, così se il traciato è fatto da più origini, rimaniamo con la prima COME Origine principale
                                    pTr.Versione = (Byte)(pTr.Versione + 1);
                                    this.ctx2.SaveChanges();

                                }

                                string keyRefCode = Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice;

                                var _rec_esistenti = this.ctx2.PromoTracciatiRecords.Where(ptr => ptr.IdTracciato == pTr.Id /*&& ptr.Label==pkg.cmbLabels*/).Select(
                                    s => new
                                    {
                                        Codice = Utility.Main.getJsonObject(s.Dato)[keyRefCode].ToString(),
                                        Rec = s,
                                        Label = s.Label,
                                        Versione = s.Versione
                                    }
                                    ).ToList();

                                Byte versioneLab = 0;

                                var versioneLabLast = _rec_esistenti.Where(r => r.Label == pkg.cmbLabels).OrderByDescending(o => o.Versione).FirstOrDefault();
                                if (versioneLabLast != null)
                                {
                                    versioneLab = (Byte)(versioneLabLast.Versione + 1);
                                }
                                else
                                {
                                    versioneLab = 1;
                                }

                                foreach (Dictionary<string, object> item in recs)
                                {
                                    bool recNuovo = true;
                                    PromoTracciatiRecord _rec = null;


                                    if (!tracciatoNuovo)
                                    {

                                        string codRef = item[keyRefCode].ToString();
                                        if (codRef == "396186")
                                            "test".ToString();
                                        //_rec = _rec_esistenti.Where(i => Utility.Main.getJsonObject(i.Dato)[keyRefCode].ToString()==codRef).FirstOrDefault();
                                        var rec_esistente = _rec_esistenti.Where(i => i.Codice == codRef).FirstOrDefault();
                                        if (rec_esistente != null)
                                            _rec = rec_esistente.Rec;
                                    }

                                    if (_rec == null)
                                    {

                                        _rec = new PromoTracciatiRecord();
                                        _rec.IdTracciato = pTr.Id;
                                        _rec.IndiceLettura = 0;
                                        _rec.IndiceEsportazione = 0;
                                        _rec.Versione = versioneLab;
                                        _rec.Label = pkg.cmbLabels;
                                        _rec.DataRegistrazione = DateTime.Now;
                                        _rec.SelezioneMenabo = (Byte)TipoSelezioneMenabo.None;
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
                                            if (item[nome_colonna_codGruppo].ToString().Count() > 500)
                                            {
                                                "notifica".ToString();
                                                _rec.CodiceGruppo = item[nome_colonna_codGruppo].ToString().Substring(0, 500);
                                            }
                                            else
                                                _rec.CodiceGruppo = item[nome_colonna_codGruppo].ToString();
                                        }
                                        else
                                        {
                                            //Se il codice gruppo NON è stato messo, acquisisce il cod referenza
                                            _rec.CodiceGruppo = _rec.Codice;
                                            item[nome_colonna_codGruppo] = _rec.CodiceGruppo;
                                        }



                                        //Impostazione campi aggiuntivi da compilare A FINE IMPORTAZIONE tramite call esterna
                                        //Scrivere codice qui
                                        //Abbiamo notato una grande latenza in questa operazione, per cui è preferibile fare tutto dall'external call globale
                                        //foreach (SchemaCampiExcel campoExt in campi_aggiuntivi)
                                        //{
                                        //    if (campoExt.AddestramentoExcelRelazionis.FirstOrDefault().TipoCompilazione==(Byte)TipoCompilazione.FineImportazione)
                                        //    {
                                        //        try
                                        //        {
                                        //            AddestramentoExcelRelazioni rel = campoExt.AddestramentoExcelRelazionis.FirstOrDefault();

                                        //            Dictionary<string, object> _pass2 = new Dictionary<string, object>();
                                        //            _pass2["rec"] = item;
                                        //            _pass2["tracciato"] = recs;
                                        //            item[campoExt.NomeColonna] = icCtrl.execLibFunction(rel.Algoritmo, _pass2);
                                        //        }
                                        //        catch(Exception ex_lib)
                                        //        {
                                        //            //this.ctx.AttivitaLogs.Add(icItem.addLog(id_attivita, TipoDiLog.Error, "EX LIB: " + ex_lib.ToString()));
                                        //            //this.ctx.SaveChanges();
                                        //        }
                                        //    }
                                        //}


                                        _rec.Dato = JsonConvert.SerializeObject(item);
                                        this.ctx2.Add(_rec);

                                    }
                                    else
                                    {

                                        if (item.ContainsKey(nome_colonna_codGruppo))
                                        {
                                            if (item[nome_colonna_codGruppo].ToString().Count() > 500)
                                            {
                                                "notifica".ToString();
                                                _rec.CodiceGruppo = item[nome_colonna_codGruppo].ToString().Substring(0, 500);
                                            }
                                            else
                                                _rec.CodiceGruppo = item[nome_colonna_codGruppo].ToString();
                                        }
                                        else
                                        {
                                            //Se il codice gruppo NON è stato messo, acquisisce il cod referenza
                                            _rec.CodiceGruppo = _rec.Codice;
                                            item[nome_colonna_codGruppo] = _rec.CodiceGruppo;
                                        }

                                        //Trovo le differenze

                                        var alterazioni = new Dictionary<string, object>();

                                        Dictionary<string, object> oldItem = JsonConvert.DeserializeObject<Dictionary<string, object>>(_rec.Dato);
                                        foreach (string _k in item.Keys)
                                        {
                                            if (!oldItem.ContainsKey(_k) || (!(item[_k] is JArray) && !(item[_k] is JObject) && !(item[_k] is Dictionary<string, object>)))
                                            {
                                                //Se è un tipo nativo
                                                if (!oldItem.ContainsKey(_k) || oldItem[_k].ToString() != item[_k].ToString())
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

                                        //if (alterazioni.Count>0)
                                        //{
                                        item["Alterazioni"] = alterazioni;
                                        //}

                                        _rec.Versione = versioneLab;// pTr.Versione;
                                        //_rec.Dato = JsonConvert.SerializeObject(oldItem);

                                        var dictDato = JsonConvert.DeserializeObject<Dictionary<string, object>>(_rec.Dato);
                                        Dictionary<string, object> dictSyncFromIndd = new Dictionary<string, object>();


                                        if (dictDato.ContainsKey(GLOBAL_VARIABLES.keySyncIndd))
                                        {
                                            dictSyncFromIndd = (dictDato[GLOBAL_VARIABLES.keySyncIndd] as JObject).ToObject<Dictionary<string, object>>();
                                            item[GLOBAL_VARIABLES.keySyncIndd] = dictSyncFromIndd;

                                        }

                                        _rec.Dato = JsonConvert.SerializeObject(item);


                                        _rec.Label = pkg.cmbLabels;

                                    }
                                }

                                this.ctx2.SaveChanges();

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

                        "Fine".ToString();

                        res.Attivita.Progress = 100;
                        res.Attivita.Stato = (Byte)OperationStauts.Terminata;
                        res.Attivita.DataFine = DateTime.Now;
                        res.Attivita.StatoMsg = "Importazione terminata con successo";
                        this.ctx.SaveChanges();


                    }

                    result.Esito = true;
                }
                catch (Exception ex)
                {
                    this.ctx.AttivitaLogs.Add(icItem.addLog(id_attivita, TipoDiLog.Error, "EX1: " + ex.ToString()));
                    res.Attivita.Stato = (Byte)OperationStauts.TerminataConErrori;
                    res.Attivita.DataFine = DateTime.Now;
                    this.ctx.SaveChanges();

                    result.Esito = false;
                    result.errorCode = ErrorCodes.Generic;
                    result.error = ex.ToString();
                    //return Ok(result);
                }

            }
            catch (Exception ex2)
            {
                res.error = ex2.ToString();

                res.Attivita.Progress = 0;
                res.Attivita.Stato = (Byte)OperationStauts.TerminataConErrori;
                res.Attivita.DataFine = DateTime.Now;
                this.ctx.AttivitaLogs.Add(icItem.addLog(id_attivita, TipoDiLog.Error, "EX2: " + ex2.ToString()));
                this.ctx.SaveChanges();
            }

            return Ok(res);
        }
        private async Task<IActionResult> esportaVolantino(Int64 id_attivita, InputForExport req)
        {
            AttivitaResult result = new AttivitaResult();
            IstantaController icItem = new IstantaController(this._conn_string, this._path_external_lib, this._path_external_source);
            //Response.Write("ESPORTAZIONE PER " + tItem.area + " - " + tItem.nome_esportazione + " materiale " + materiale_pop_singolo + "  conteggio liste =" + parco_liste.Count+"<br>");

            try
            {
                JObject o1 = JObject.Parse(System.IO.File.ReadAllText(this._path_external_source + "SourceMastro.json"));
                DbMastro mastroDB = o1.ToObject<DbMastro>();
                List<DbMastroItem> listaMastro = mastroDB.source;

                string descr1Key = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr1;
                string descr2Key = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr2;
                string descr3Key = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr3;
                string descr4Key = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr4;

                result.Attivita = this.ctx.Attivita.Find(id_attivita)!;
                result.Attivita.StatoMsg = "Esportazione in elaborazione";


                result.Attivita.Progress = 5;
                result.Attivita.Stato = (Byte)OperationStauts.ElaborazioneDati;
                result.Attivita.DataInizio = DateTime.Now;
                this.ctx.SaveChanges();

                Int32 id_tracciato = Int32.Parse(req.fields["id_tracciato"].ToString());
                PromoTracciati tItem = await this.ctx2.PromoTracciatis.Include(i => i.IdImportazioneNavigation).Where(t => t.Id == id_tracciato).FirstOrDefaultAsync();

                List<Int16> filtroPagsArray = new List<Int16>();
                string filtro_pags = "";
                if (req.fields.ContainsKey("filtro_pagine") && req.fields["filtro_pagine"] != null)
                    filtro_pags = req.fields["filtro_pagine"].ToString();

                if (filtro_pags != "")
                {
                    //E' stato specificato un filtro pagine
                    if (filtro_pags.IndexOf("-") > 0)
                    {
                        //Filtro di tipo range
                        string[] tempSplit = filtro_pags.Split('-');

                        int pagStart = Int32.Parse(tempSplit[0]);
                        int pagFine = Int32.Parse(tempSplit[1]);

                        for (int p = pagStart; p <= pagFine; p++)
                        {
                            filtroPagsArray.Add(Int16.Parse(p.ToString()));
                        }


                    }
                    else if (filtro_pags.IndexOf(",") > 0)
                    {
                        //Filtro di tipo skip
                        filtroPagsArray = filtro_pags.Split(',').Select(Int16.Parse).ToList();
                    }
                    else
                    {
                        //Singola pagina
                        filtroPagsArray.Add(Int16.Parse(filtro_pags));
                    }
                }

                if (tItem == null)
                    throw new Exception("Tracciato non trovato");

                Dictionary<string, object> impRequest = Utility.Main.getJsonObject(tItem.IdImportazioneNavigation.ParamsRequest);


                if (req.CartellaDiEsportazione == null || req.CartellaDiEsportazione == "")
                {
                    this.ctx.AttivitaLogs.Add(icItem.addLog(id_attivita, TipoDiLog.Error, "Specificare una cartella di esportazione per questo tipo di materiale"));
                    this.ctx.SaveChanges();

                    result.error = "Specificare una cartella di esportazione per questo tipo di materiale";
                    result.errorCode = ErrorCodes.DirectoryNotFound;

                    return Ok(result);
                }

                string k_multiplex = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppoMultiplex;
                string k_codgruppo = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppo;
                string k_cod = Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice;

                List<MenaboPagine> pag_menabo = new List<MenaboPagine>();
                if (req.ChEsportaDaMenabo)
                {
                    pag_menabo = this.ctx2.MenaboPagines.Where(p => filtroPagsArray.Count == 0 || filtroPagsArray.Contains(p.Numero)).Include(i => i.MenaboRefs).ThenInclude(i2 => i2.IdRecordNavigation).Where(mp => mp.IdTracciato == id_tracciato).ToList();
                }

                //Scarico tutti i dati json di tutti gli articoli in tracciato
                var tRecordsJson = this.ctx2.PromoTracciatiRecords.Include(pt1 => pt1.MenaboRefs).ThenInclude(pt2 => pt2.IdPaginaNavigation).Where(t => t.IdTracciato == id_tracciato //&&
                //esisteRefOSuoGruppoInMenabo(t, pag_menabo, filtroPagsArray)
                /*(pag_menabo.Count<=0 || 
                (t.MenaboRefs.Count>0 && filtroPagsArray.Contains(t.MenaboRefs.FirstOrDefault().IdPaginaNavigation.Numero) ||
                (pag_menabo.Where(pm3=>pm3.MenaboRefs.Where(pm4=>pm4.CodiceGruppo==t.CodiceGruppo).Count()>0 && filtroPagsArray.Contains(pag_menabo.Where(pm3 => pm3.MenaboRefs.Where(pm4 => pm4.CodiceGruppo == t.CodiceGruppo).FirstOrDefault().IdPaginaNavigation.Numero))))
                ))*/)
                .Select(t => new
                {
                    Selezione = t.SelezioneMenabo,
                    Dato = Utility.Main.getJsonObject(t.Dato)
                }).ToList();

                List<Dictionary<string, object>> exportList = new List<Dictionary<string, object>>();

                List<Articoli> archivio_refs = new List<Articoli>();
                List<ArticoliDescrizioni> archivio_descr_gruppo = new List<ArticoliDescrizioni>();
                List<ArticoliDescrizioni> archivio_descr_gruppoMultiplex = new List<ArticoliDescrizioni>();

                if (req.ChEsportaDaArchivio)
                {
                    result.Attivita.StatoMsg = "Recupero descrizioni da archivio";

                    Int16 tot_perc = 75;
                    Int16 curr_perc = 0;

                    //Se esco con Menabo probabilmente mi interessano solo le descrizioni delle ref singole e dei gruppi inseriti

                    List<string> cod_refs_in_tracciato = tRecordsJson.GroupBy(g => g.Dato[Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice].ToString()).Select(s => s.Key).ToList();
                    List<string> codGruppo_in_tracciato = tRecordsJson.GroupBy(g => g.Dato[Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppo].ToString()).Select(s => s.Key).ToList();
                    List<string> codGruppoMultiplex_in_tracciato = tRecordsJson.Where(g => g.Dato.ContainsKey(k_multiplex)).GroupBy(g => g.Dato[k_multiplex].ToString()).Select(s => s.Key).ToList();

                    /*
                    //ATTENZIONE
                    Quando si esporta da menabo si puo ottimizzare lo scaricamento dei dati di opgni singola ref in archivio SOLO per gli item coivolti nell'esportazione
                    Nel fare q  uesta ottimizzazione dobbiamo fare attenzione a non ignorare le ref incluse in gruppi, e di queste ref va preso solo lo stato di selezione 
                    per cui so che è necessaria l'info (descrizione e/o foto)
                    if (req.ChEsportaDaMenabo)
                    {
                        var m_refs= this.ctx2.MenaboRefs.Include(r=>r.IdRecordNavigation).Include(m => m.IdPaginaNavigation).Where(p => p.IdPaginaNavigation.IdTracciato == id_tracciato).ToList();
                        cod_refs_in_tracciato = m_refs.Where(m => m.IdRecord.HasValue).Select(s => Utility.Main.getJsonObject(s.IdRecordNavigation.Dato)[Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice].ToString()).ToList();
                        codGruppo_in_tracciato = m_refs.Where(m => m.CodiceGruppo!=null).Select(s => s.CodiceGruppo).ToList();
                    }
                    */

                    Int16 _tot_descr = (Int16)(cod_refs_in_tracciato.Count + codGruppo_in_tracciato.Count);

                    Int16 count_progress = 0;

                    DateTime dDiagnostic = DateTime.Now;
                    List<double> diagnostic_arts = new List<double>();
                    List<double> diagnostic_descr = new List<double>();


                    DateTime dDiagnosticArt = DateTime.Now;
                    foreach (string _cod in cod_refs_in_tracciato)
                    {
                        DateTime dMediaArt = DateTime.Now;

                        //var _item = this.ctx.Articolis.Include(i => i.ArticoliDescrizionis).Include(i2 => i2.ArticoliFotos).Where(a => a.Codice==_cod).FirstOrDefault();//cod_refs_in_tracciato.Contains(a.Codice))

                        /*if (_item != null)
                        {
                            archivio_refs.Add(_item);
                        }*/

                        Articoli art = new Articoli();

                        DateTime _d1 = DateTime.Now;
                        if (archivio_refs.Where(a => a.Codice == _cod).Count() <= 0)
                        {
                            var _art = this.ctx.Articolis.Where(a => a.Codice == _cod).Select(s => new { Id = s.Id, Codice = s.Codice }).FirstOrDefault();//cod_refs_in_tracciato.Contains(a.Codice))

                            if (_art != null)
                            {
                                art.Id = _art.Id;
                                art.Codice = _art.Codice;
                                ArticoliDescrizioni descr = this.ctx.ArticoliDescrizionis.Where(d => d.IdArticolo == _art.Id).FirstOrDefault();
                                if (descr != null)
                                    art.ArticoliDescrizionis.Add(descr);

                                if (req.ChEsportaFoto)
                                {
                                    ArticoliFoto foto = this.ctx.ArticoliFotos.Where(d => d.IdArticolo == _art.Id).OrderByDescending(o => o.DataModifica).FirstOrDefault();
                                    if (foto != null)
                                        art.ArticoliFotos.Add(foto);
                                }

                                archivio_refs.Add(art);
                            }
                        }

                        double performance = DateTime.Now.Subtract(_d1).TotalMilliseconds;

                        diagnostic_arts.Add(DateTime.Now.Subtract(dMediaArt).TotalMilliseconds);

                        count_progress++;

                        Int16 _perc = (Int16)(75 * ((decimal)count_progress / (decimal)_tot_descr));
                        if (_perc - curr_perc >= 5)
                        {
                            //Ogni 5% di progresso aggiorno
                            result.Attivita.Progress = (Int16)(5 + _perc);
                            this.ctx.SaveChanges();
                        }
                        //this.ctx.SaveChanges();
                    }

                    double tempoArt = DateTime.Now.Subtract(dDiagnosticArt).TotalMilliseconds;

                    DateTime dDiagnosticGruppi = DateTime.Now;
                    foreach (string _cod in codGruppo_in_tracciato)
                    {
                        DateTime dMediaDescr = DateTime.Now;

                        var _item = this.ctx.ArticoliDescrizionis.Where(a => a.CodiceGruppo == _cod).FirstOrDefault();
                        if (_item != null)
                            archivio_descr_gruppo.Add(_item);

                        diagnostic_descr.Add(DateTime.Now.Subtract(dMediaDescr).TotalMilliseconds);

                        count_progress++;

                        Int16 _perc = (Int16)(75 * ((decimal)count_progress / (decimal)_tot_descr));
                        if (_perc - curr_perc >= 5)
                        {
                            //Ogni 5% di progresso aggiorno
                            result.Attivita.Progress = (Int16)(5 + _perc);
                            this.ctx.SaveChanges();
                        }

                    }

                    //Non asssegno alcun valore di percentuale attività per i multiplex, tanto saranno sempre pochi
                    foreach (string _cod in codGruppoMultiplex_in_tracciato)
                    {
                        DateTime dMediaDescr = DateTime.Now;

                        var _item = this.ctx.ArticoliDescrizionis.Where(a => a.CodiceGruppo == _cod).FirstOrDefault();
                        if (_item != null)
                            archivio_descr_gruppoMultiplex.Add(_item);

                        diagnostic_descr.Add(DateTime.Now.Subtract(dMediaDescr).TotalMilliseconds);

                    }

                    double tempoGruppi = DateTime.Now.Subtract(dDiagnosticGruppi).TotalMilliseconds;

                    double ms = DateTime.Now.Subtract(dDiagnostic).TotalMilliseconds;
                    double mediaArt = diagnostic_arts.Sum() / diagnostic_arts.Count;
                    double mediaDescr = diagnostic_descr.Sum() / diagnostic_descr.Count;
                    ms.ToString();
                }
                else
                {


                }

                if (req.ChEsportaDaMenabo)
                {
                    result.Attivita.StatoMsg = "Esportazione da menabò";
                    result.Attivita.Progress = 80;
                    this.ctx.SaveChanges();

                    //List<MenaboPagine> pag_menabo = this.ctx2.MenaboPagines.Include(i => i.MenaboRefs).ThenInclude(i2 => i2.IdRecordNavigation).Where(mp => mp.IdTracciato == id_tracciato).ToList();
                    if (pag_menabo.Count <= 0)
                    {
                        throw new Exception("Nessuna pagina trovata in menabo");
                    }
                    else
                    {
                        foreach (MenaboPagine pItem in pag_menabo)
                        {
                            //if (filtroPagsArray.Contains(pItem.Numero.ToString()))
                            //{
                            foreach (MenaboRef rItem in pItem.MenaboRefs)
                            {
                                Dictionary<string, object> mObj = new Dictionary<string, object>();
                                mObj.Add("numero_pagina", pItem.Numero);
                                mObj.Add("mastro", listaMastro.Where(m => m.Id == pItem.IdMastro).FirstOrDefault().Nome);

                                mObj.Add("posizione", rItem.Indice);
                                mObj.Add("formato", rItem.Formato);


                                if (rItem.IdRecord > 0)
                                {
                                    Dictionary<string, object> item = new Dictionary<string, object>();
                                    item = Utility.Main.getJsonObject(rItem.IdRecordNavigation.Dato);
                                    item[GLOBAL_VARIABLES.keyXMLSelezione] = (Byte)TipoSelezioneMenabo.Primaria;

                                    if (req.ChEsportaDaArchivio)
                                    {
                                        //Salvo le descrizioni nelle chiavi relative Tracciato
                                        item[Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr1Tracciato] = item.ContainsKey(descr1Key)?item[descr1Key]:"";
                                        item[Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr2Tracciato] = item.ContainsKey(descr2Key) ? item[descr2Key] : "";
                                        item[Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr3Tracciato] = item.ContainsKey(descr3Key) ? item[descr3Key] : "";
                                        item[Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr4Tracciato] = item.ContainsKey(descr4Key) ? item[descr4Key] : "";
                                    }

                                    //Se la ref in questione arriva da un gruppo MA è stata inserita come singola
                                    //E' necessario che il suo codice_gruppo diventi il suo codice
                                    //perchè a tutti gli effetti è come se fosse stata sgruppata
                                    item[k_codgruppo] = item[k_cod].ToString();

                                    if (req.ChEsportaDaArchivio || req.ChEsportaFoto)
                                    {
                                        string myMultiplexGroup = "";
                                        if (item.ContainsKey(k_multiplex))
                                        {
                                            myMultiplexGroup = item[k_multiplex].ToString();
                                            ArticoliDescrizioni descrGruppoMultiplex = archivio_descr_gruppoMultiplex.Where(g => g.CodiceGruppo == myMultiplexGroup).OrderByDescending(o => o.DataUltimaRicezione).FirstOrDefault();
                                            if (descrGruppoMultiplex != null)
                                            {

                                                Dictionary<string, object> dictDescrGruppoMultiplex = new Dictionary<string, object>();
                                                dictDescrGruppoMultiplex.Add(GLOBAL_VARIABLES.keyDescr1, descrGruppoMultiplex.Descrizione1);
                                                dictDescrGruppoMultiplex.Add(GLOBAL_VARIABLES.keyDescr2, descrGruppoMultiplex.Descrizione2);
                                                dictDescrGruppoMultiplex.Add(GLOBAL_VARIABLES.keyDescr3, descrGruppoMultiplex.Descrizione3);
                                                dictDescrGruppoMultiplex.Add(GLOBAL_VARIABLES.keyDescr4, descrGruppoMultiplex.Descrizione4);
                                                if (descrGruppoMultiplex.DescrizioneIndd != null)
                                                    dictDescrGruppoMultiplex[GLOBAL_VARIABLES.keyDescrIndd] = descrGruppoMultiplex.DescrizioneIndd;
                                                if (descrGruppoMultiplex.Peso != null)
                                                    dictDescrGruppoMultiplex[Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescrPeso] = descrGruppoMultiplex.Peso.Value;
                                                if (descrGruppoMultiplex.Um != null)
                                                    dictDescrGruppoMultiplex[Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescrUm] = descrGruppoMultiplex.Um;
                                                if (descrGruppoMultiplex.Extra != null)
                                                    dictDescrGruppoMultiplex[GLOBAL_VARIABLES.keyDescrExtra] = JsonConvert.DeserializeObject<JObject>(descrGruppoMultiplex.Extra);

                                                mObj.Add("descrizione_gruppo_multiplex", dictDescrGruppoMultiplex);

                                                //item[GLOBAL_VARIABLES.keyXMLSelezione] = rItem.Selezione;
                                                item[GLOBAL_VARIABLES.keyXMLSelezione] = rItem.IdRecordNavigation.SelezioneMenabo;


                                            }
                                        }

                                        //Qui devo prendere la descrizione revisionata dell'articolo singolo piazzato in menabo
                                        Articoli artItem = archivio_refs.Where(a => a.Codice == item[Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice].ToString()).FirstOrDefault();

                                        if (artItem != null && artItem.ArticoliDescrizionis.Count > 0 && req.ChEsportaDaArchivio)
                                        {
                                            ArticoliDescrizioni artDescr = artItem.ArticoliDescrizionis.OrderByDescending(o => o.DataUltimaRicezione).FirstOrDefault();
                                            item[descr1Key] = artDescr.Descrizione1;
                                            item[descr2Key] = artDescr.Descrizione2;
                                            item[descr3Key] = artDescr.Descrizione3;
                                            item[descr4Key] = artDescr.Descrizione4;
                                            if (artDescr.DescrizioneIndd != null)
                                                item[Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescrIndd] = artDescr.DescrizioneIndd;
                                            if (artDescr.Peso != null)
                                                item[Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescrPeso] = artDescr.Peso.Value;
                                            if (artDescr.Um != null)
                                                item[Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescrUm] = artDescr.Um;
                                            if (artDescr.Extra != null)
                                                item[Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescrExtra] = JsonConvert.DeserializeObject<JObject>(artDescr.Extra);

                                        }

                                        if (artItem != null && req.ChEsportaFoto)
                                        {
                                            string _key_foto = Enum.GetName(AddestramentoRuoli.Foto) + "." + GLOBAL_VARIABLES.keyFotoNome;

                                            //ATTENZIONE,
                                            //Al momento l'opzione è binaria. Opzione 1 non far uscire foto, opzione 2 farle uscire da archivio
                                            //Ma potrebbe in effetti esserfci un'opzione 3 ovvero farle uscire così come sono riportate su tracciato
                                            //infatti il modello di addestramento potrebbe intercettare da solo il parametro Foto.Codice
                                            //Con l'opzione 2 si direbbe esplicitamente al sistema di andare a legggere quella colonna piuttosto che fare come facciamo adesso
                                            //con questo controllo, che invece esclude da solo
                                            if (!item.ContainsKey(_key_foto))
                                            {

                                                ArticoliFoto af = artItem.ArticoliFotos.OrderByDescending(o => o.DataModifica).FirstOrDefault();//.Where(af => af.StatoSelezione == (Byte)StatoSelezioneFoto.Primaria).OrderByDescending(o => o.DataModifica).ThenByDescending(o2 => o2.DataInserimento).FirstOrDefault();
                                                if (af != null)
                                                {
                                                    //ATTENZIONE: controlliamo che qui non incida sul db realmente
                                                    item[_key_foto] = af.NomeReale;
                                                }
                                                else
                                                {
                                                    item[_key_foto] = artItem.Codice + ".psd";
                                                }
                                            }
                                        }

                                    }



                                    //CASO 1
                                    mObj.Add("refs", new List<Dictionary<string, object>>() { item });
                                }
                                else
                                {
                                    //Si tratta di un gruppo per cui devo metterci dentro le selezioni
                                    var _gruppo = tRecordsJson.Where(t => t.Dato[Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppo].ToString() == rItem.CodiceGruppo).OrderBy(o => o.Selezione);
                                    int countTot = _gruppo.Count();
                                    int countNoSelezione = _gruppo.Where(r => r.Selezione == (Byte)TipoSelezioneMenabo.None).Count();
                                    //bool nessuna_specifica_di_selezione = (countTot == countNoSelezione);

                                    bool found_descr_gruppo = false;
                                    if (req.ChEsportaDaArchivio && _gruppo.Count() > 1)
                                    {
                                        //Cerco descrizione di gruppo se c'è
                                        //Cerco la descrizione di gruppo se c'è
                                        ArticoliDescrizioni descrGruppo = archivio_descr_gruppo.Where(g => g.CodiceGruppo == rItem.CodiceGruppo).OrderByDescending(o => o.DataUltimaRicezione).FirstOrDefault();
                                        if (descrGruppo != null)
                                        {
                                            found_descr_gruppo = true;

                                            Dictionary<string, object> dictDescrGruppo = new Dictionary<string, object>();
                                            dictDescrGruppo.Add(descr1Key, descrGruppo.Descrizione1.ConvertACapoConBrTagPerXml());
                                            dictDescrGruppo.Add(descr2Key, descrGruppo.Descrizione2.ConvertACapoConBrTagPerXml());
                                            dictDescrGruppo.Add(descr3Key, descrGruppo.Descrizione3.ConvertACapoConBrTagPerXml());
                                            dictDescrGruppo.Add(descr4Key, descrGruppo.Descrizione4.ConvertACapoConBrTagPerXml());
                                            if (descrGruppo.DescrizioneIndd != null)
                                                dictDescrGruppo[GLOBAL_VARIABLES.keyDescrIndd] = descrGruppo.DescrizioneIndd;
                                            if (descrGruppo.Peso != null)
                                                dictDescrGruppo[Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescrPeso] = descrGruppo.Peso.Value;
                                            if (descrGruppo.Um != null)
                                                dictDescrGruppo[Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescrUm] = descrGruppo.Um;
                                            if (descrGruppo.Extra != null)
                                                dictDescrGruppo[GLOBAL_VARIABLES.keyDescrExtra] = JsonConvert.DeserializeObject<JObject>(descrGruppo.Extra);

                                            mObj[GLOBAL_VARIABLES.keyXMLDescrizioneGruppo] = dictDescrGruppo;
                                        }


                                        string myMultiplexGroup = "";
                                        if (_gruppo.FirstOrDefault().Dato.ContainsKey(k_multiplex))
                                        {
                                            myMultiplexGroup = _gruppo.FirstOrDefault().Dato[k_multiplex].ToString();
                                            ArticoliDescrizioni descrGruppoMultiplex = archivio_descr_gruppoMultiplex.Where(g => g.CodiceGruppo == myMultiplexGroup).OrderByDescending(o => o.DataUltimaRicezione).FirstOrDefault();
                                            if (descrGruppoMultiplex != null)
                                            {

                                                Dictionary<string, object> dictDescrGruppoMultiplex = new Dictionary<string, object>();
                                                dictDescrGruppoMultiplex.Add(GLOBAL_VARIABLES.keyDescr1, descrGruppoMultiplex.Descrizione1);
                                                dictDescrGruppoMultiplex.Add(GLOBAL_VARIABLES.keyDescr2, descrGruppoMultiplex.Descrizione2);
                                                dictDescrGruppoMultiplex.Add(GLOBAL_VARIABLES.keyDescr3, descrGruppoMultiplex.Descrizione3);
                                                dictDescrGruppoMultiplex.Add(GLOBAL_VARIABLES.keyDescr4, descrGruppoMultiplex.Descrizione4);
                                                if (descrGruppoMultiplex.DescrizioneIndd != null)
                                                    dictDescrGruppoMultiplex[GLOBAL_VARIABLES.keyDescrIndd] = descrGruppoMultiplex.DescrizioneIndd;
                                                if (descrGruppoMultiplex.Peso != null)
                                                    dictDescrGruppoMultiplex[Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescrPeso] = descrGruppoMultiplex.Peso.Value;
                                                if (descrGruppoMultiplex.Um != null)
                                                    dictDescrGruppoMultiplex[Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescrUm] = descrGruppoMultiplex.Um;
                                                if (descrGruppoMultiplex.Extra != null)
                                                    dictDescrGruppoMultiplex[GLOBAL_VARIABLES.keyDescrExtra] = JsonConvert.DeserializeObject<JObject>(descrGruppoMultiplex.Extra);

                                                mObj.Add("descrizione_gruppo_multiplex", dictDescrGruppoMultiplex);
                                            }
                                        }
                                    }

                                    //CASO 3
                                    List<Dictionary<string, object>> _gruppoResult = new List<Dictionary<string, object>>();
                                    foreach (var itemGruppo in _gruppo)//.Where(g => g.Selezione != (Byte)TipoSelezioneMenabo.None))
                                    {
                                        //if (nessuna_specifica_di_selezione || itemGruppo.Selezione != (Byte)TipoSelezioneMenabo.None)
                                        //{

                                        Dictionary<string, object> itemGruppoData = itemGruppo.Dato;

                                        if ((req.ChEsportaDaArchivio && !found_descr_gruppo) || req.ChEsportaFoto)
                                        {
                                            Articoli artItem = archivio_refs.Where(a => a.Codice == itemGruppoData[Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice].ToString()).FirstOrDefault();
                                            if (artItem != null)
                                            {
                                                if (req.ChEsportaFoto)
                                                {
                                                    string _key_foto = Enum.GetName(AddestramentoRuoli.Foto) + "." + GLOBAL_VARIABLES.keyFotoNome;

                                                    //ATTENZIONE,
                                                    //Al momento l'opzione è binaria. Opzione 1 non far uscire foto, opzione 2 farle uscire da archivio
                                                    //Ma potrebbe in effetti esserfci un'opzione 3 ovvero farle uscire così come sono riportate su tracciato
                                                    //infatti il modello di addestramento potrebbe intercettare da solo il parametro Foto.Codice
                                                    //Con l'opzione 2 si direbbe esplicitamente al sistema di andare a legggere quella colonna piuttosto che fare come facciamo adesso
                                                    //con questo controllo, che invece esclude da solo
                                                    if (!itemGruppoData.ContainsKey(_key_foto))
                                                    {

                                                        //Controllo se esiste la foto primaria
                                                        ArticoliFoto af = artItem.ArticoliFotos.OrderByDescending(o => o.DataModifica).FirstOrDefault();// .Where(af => af.StatoSelezione == (Byte)StatoSelezioneFoto.Primaria).OrderByDescending(o => o.DataModifica).ThenByDescending(o2 => o2.DataInserimento).FirstOrDefault();
                                                        if (af != null)
                                                        {
                                                            //ATTENZIONE: controlliamo che qui non incida sul db realmente
                                                            itemGruppoData[_key_foto] = af.NomeReale;
                                                        }
                                                        else
                                                        {
                                                            itemGruppoData[_key_foto] = artItem.Codice + ".psd";
                                                        }
                                                    }
                                                }

                                                if (artItem.ArticoliDescrizionis.Count() > 0 && req.ChEsportaDaArchivio)
                                                {
                                                    //Cerco la descrizione revisionata solo se NON faccio parte di un gruppo o
                                                    //se quest'ultimo non è stato revisionato

                                                    ArticoliDescrizioni artDescr = artItem.ArticoliDescrizionis.OrderByDescending(o => o.DataUltimaRicezione).FirstOrDefault();
                                                    itemGruppoData[descr1Key] = artDescr.Descrizione1;
                                                    itemGruppoData[descr2Key] = artDescr.Descrizione2;
                                                    itemGruppoData[descr3Key] = artDescr.Descrizione3;
                                                    itemGruppoData[descr4Key] = artDescr.Descrizione4;
                                                    if (artDescr.DescrizioneIndd != null)
                                                        itemGruppoData[Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescrIndd] = artDescr.DescrizioneIndd;
                                                    if (artDescr.Peso != null)
                                                        itemGruppoData[Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescrPeso] = artDescr.Peso.Value;
                                                    if (artDescr.Um != null)
                                                        itemGruppoData[Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescrUm] = artDescr.Um;
                                                    if (artDescr.Extra != null)
                                                    {
                                                        itemGruppoData[Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescrExtra] = JsonConvert.DeserializeObject<JObject>(artDescr.Extra);
                                                    }
                                                }
                                            }
                                        }

                                        if (found_descr_gruppo)
                                        {
                                            Dictionary<string, object> dictDescrGruppo = mObj[GLOBAL_VARIABLES.keyXMLDescrizioneGruppo] as Dictionary<string, object>;

                                            //Quando esce una descrizione di gruppo, propago le info PESO e UM su tutte le ref del gruppo
                                            string kUmGruppo = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescrUmGruppo;
                                            string kPesoGruppo = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescrPesoGruppo;
                                            string kPeso = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescrPeso;
                                            string kUm = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescrUm;
                                            if (dictDescrGruppo.ContainsKey(kPeso))
                                                itemGruppoData[kPesoGruppo] = dictDescrGruppo[kPeso];
                                            if (dictDescrGruppo.ContainsKey(kUm))
                                                itemGruppoData[kUmGruppo] = dictDescrGruppo[kUm];
                                        }

                                        //Il tipo_selezione verrà specificato solo in questo caso.
                                        //Nei casi sopra (1 e 2) e quello sotto (4) non è necessario specificarlo, è sottinteso che uscirà tutta la ref quindi Stato selezione 1 per il caso 1 e 2 e per il caso 4
                                        itemGruppoData.Add(GLOBAL_VARIABLES.keyXMLSelezione, itemGruppo.Selezione);// == (Byte)TipoSelezioneMenabo.Primaria ? (Byte)TipoSelezioneMenabo.Primaria : itemGruppo.Selezione);

                                        _gruppoResult.Add(itemGruppoData);
                                        //}
                                    }

                                    mObj.Add("refs", _gruppoResult);

                                }

                                exportList.Add(mObj);
                            }
                            //}
                        }
                    }
                }
                else
                {
                    result.Attivita.StatoMsg = "Esportazione totale";
                    result.Attivita.Progress = 80;
                    this.ctx.SaveChanges();



                    //CASO 4
                    //Chiamo direttamente la funzione esterna di esportazione ed esporterò la lista tornata mettendo tutte le ref a pag 0
                    //Che per lo script di impaginazione è come impaginarle sequenzialmente con creazione pagina progressiva
                    string propCodScatto = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppo;
                    List<string> codici_gruppo = tRecordsJson.Where(w => w.Dato.ContainsKey(propCodScatto)).GroupBy(g => g.Dato[propCodScatto].ToString()).Select(s => s.Key.ToString()).ToList();
                    foreach (string cod in codici_gruppo)
                    {
                        Dictionary<string, object> mObj = new Dictionary<string, object>();
                        mObj.Add("numero_pagina", 0);
                        mObj.Add("posizione", 0);


                        var itemGruppo = tRecordsJson.Where(r => r.Dato[propCodScatto].ToString() == cod).ToList();
                        List<Dictionary<string, object>> _gruppoResult = new List<Dictionary<string, object>>();


                        bool found_descr_gruppo = false;
                        if (itemGruppo.Count > 1)
                        {
                            //Cerco la descrizione di gruppo se c'è
                            ArticoliDescrizioni descrGruppo = archivio_descr_gruppo.Where(g => g.CodiceGruppo == cod).OrderByDescending(o => o.DataUltimaRicezione).FirstOrDefault();
                            if (descrGruppo != null)
                            {
                                found_descr_gruppo = true;

                                Dictionary<string, object> dictDescrGruppo = new Dictionary<string, object>();
                                dictDescrGruppo.Add(descr1Key, descrGruppo.Descrizione1.ConvertACapoConBrTagPerXml());
                                dictDescrGruppo.Add(descr2Key, descrGruppo.Descrizione2.ConvertACapoConBrTagPerXml());
                                dictDescrGruppo.Add(descr3Key, descrGruppo.Descrizione3.ConvertACapoConBrTagPerXml());
                                dictDescrGruppo.Add(descr4Key, descrGruppo.Descrizione4.ConvertACapoConBrTagPerXml());
                                if (descrGruppo.DescrizioneIndd != null)
                                    dictDescrGruppo[Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescrIndd] = descrGruppo.DescrizioneIndd;
                                if (descrGruppo.Peso != null)
                                    dictDescrGruppo[Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescrPeso] = descrGruppo.Peso.Value;
                                if (descrGruppo.Um != null)
                                    dictDescrGruppo[Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescrUm] = descrGruppo.Um;

                                mObj[GLOBAL_VARIABLES.keyXMLDescrizioneGruppo] = dictDescrGruppo;
                            }
                        }

                        foreach (var item in itemGruppo)
                        {
                            if ((req.ChEsportaDaArchivio && !found_descr_gruppo) || req.ChEsportaFoto)
                            {
                                //Qui devo prendere la descrizione revisionata dell'articolo in questione se non c'è una versione del gruppo in cui è contenuta

                                Articoli artItem = archivio_refs.Where(a => a.Codice == item.Dato[Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice].ToString()).FirstOrDefault();
                                if (artItem != null)
                                {
                                    if (req.ChEsportaFoto)
                                    {
                                        string _key_foto = Enum.GetName(AddestramentoRuoli.Foto) + "." + GLOBAL_VARIABLES.keyFotoNome;

                                        //ATTENZIONE,
                                        //Al momento l'opzione è binaria. Opzione 1 non far uscire foto, opzione 2 farle uscire da archivio
                                        //Ma potrebbe in effetti esserfci un'opzione 3 ovvero farle uscire così come sono riportate su tracciato
                                        //infatti il modello di addestramento potrebbe intercettare da solo il parametro Foto.Codice
                                        //Con l'opzione 2 si direbbe esplicitamente al sistema di andare a legggere quella colonna piuttosto che fare come facciamo adesso
                                        //con questo controllo, che invece esclude da solo
                                        if (!item.Dato.ContainsKey(_key_foto))
                                        {
                                            //Controllo se esiste la foto primaria
                                            ArticoliFoto af = artItem.ArticoliFotos.OrderByDescending(o => o.DataModifica).FirstOrDefault();//.Where(af => af.StatoSelezione == (Byte)StatoSelezioneFoto.Primaria).OrderByDescending(o => o.DataModifica).ThenByDescending(o2 => o2.DataInserimento).FirstOrDefault();
                                            if (af != null)
                                            {
                                                //ATTENZIONE: controlliamo che qui non incida sul db realmente
                                                item.Dato[_key_foto] = af.NomeReale;
                                            }
                                            else
                                            {
                                                item.Dato[_key_foto] = artItem.Codice + ".psd";
                                            }
                                        }
                                    }

                                    if (artItem.ArticoliDescrizionis.Count > 0 && req.ChEsportaDaArchivio)
                                    {
                                        //Cerco la descrizione revisionata solo se NON faccio parte di un gruppo o
                                        //se quest'ultimo non è stato revisionato

                                        //Salvo le descrizioni nelle chiavi relative Tracciato
                                        item.Dato[Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr1Tracciato] = item.Dato.ContainsKey(descr1Key)?item.Dato[descr1Key]:"";
                                        item.Dato[Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr2Tracciato] = item.Dato.ContainsKey(descr2Key)?item.Dato[descr2Key]:"";
                                        item.Dato[Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr3Tracciato] = item.Dato.ContainsKey(descr3Key)?item.Dato[descr3Key]:"";
                                        item.Dato[Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr4Tracciato] = item.Dato.ContainsKey(descr4Key)?item.Dato[descr4Key]:"";
                                        

                                        ArticoliDescrizioni artDescr = artItem.ArticoliDescrizionis.OrderByDescending(o => o.DataUltimaRicezione).FirstOrDefault();
                                        item.Dato[descr1Key] = artDescr.Descrizione1;
                                        item.Dato[descr2Key] = artDescr.Descrizione2;
                                        item.Dato[descr3Key] = artDescr.Descrizione3;
                                        item.Dato[descr4Key] = artDescr.Descrizione4;
                                        if (artDescr.Peso != null)
                                            item.Dato[Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescrPeso] = artDescr.Peso.Value;
                                        if (artDescr.Um != null)
                                            item.Dato[Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescrUm] = artDescr.Um;
                                    }
                                }
                            }

                            //Nella selezione in esportazione di TUTTO, ovvero quando in effetti si da per scontato NON ci sia alcuna ref messa in menabo
                            //I gruppi li mando con la selezione ricevuta dal processo di auto selezione
                            //I singoli ricevono per loro natura la selezione primaria
                            if (itemGruppo.Count > 1)
                                item.Dato[GLOBAL_VARIABLES.keyXMLSelezione] = item.Selezione;
                            else
                                item.Dato[GLOBAL_VARIABLES.keyXMLSelezione] = (Byte)TipoSelezioneMenabo.Primaria;
    
                            _gruppoResult.Add(item.Dato);
                        }

                        mObj.Add("refs", _gruppoResult);
                        exportList.Add(mObj);
                    }

                }


                result.Attivita.StatoMsg = "Elaborazione con logiche di agenzia";
                result.Attivita.Progress = 90;
                this.ctx.SaveChanges();

                //Chiamata esterna della funzione (SE ESISTE)
                AddestramentoExcel addestramento = this.ctx2.AddestramentoExcels.Find(tItem.IdImportazioneNavigation.IdAddestramento);

                if (addestramento.externalCallPerExport != null)
                {
                    //Ai request field, aggiungo la request field dell'import, potrebbe servire alla chiamata esterna, come dettaglio storico                    
                    req.fields["importFieldsStringfy"] = tItem.IdImportazioneNavigation.ParamsRequest;
                    req.fields["tracciatoFieldsStringfy"] = tItem.Meta;
                    req.fields["esportaDaArchivio"] = req.ChEsportaDaArchivio.ToString().ToLower();
                    req.fields["esportaDaMenabo"] = req.ChEsportaDaMenabo.ToString().ToLower();
                    req.fields["esportaFoto"] = req.ChEsportaFoto.ToString().ToLower();

                    Dictionary<string, object> _pass = new Dictionary<string, object>();
                    _pass["tracciato"] = exportList;
                    _pass["formRequest"] = req.fields;
                    string resultExternal = icItem.execLibFunction(addestramento.externalCallPerExport, _pass).ToString();

                    //Aggiorno dataset elaborato
                    ExportResult parsingRes = JsonConvert.DeserializeObject<ExportResult>(resultExternal!);


                    if (parsingRes.errors != "")
                    {
                        throw new Exception(parsingRes.errors);
                    }


                    foreach (TracciatoResult _lista in parsingRes.liste)
                    {
                        if (filtroPagsArray.Count > 0)
                        {
                            _lista.NomeEsportazione = _lista.NomeEsportazione + "_" + req.fields["filtro_pagine"].ToString();
                        }

                        result.Attivita.StatoMsg = "Scrittura xml/csv " + _lista.NomeEsportazione;
                        this.ctx.SaveChanges();

                        eseguiEsportazione(_lista, req, result.Attivita);
                    }

                    result.Attivita.StatoMsg = "Esportazione terminata";
                    result.Attivita.Stato = (Byte)OperationStauts.Terminata;
                    result.Attivita.DataFine = DateTime.Now;
                    result.Attivita.Progress = 100;
                    this.ctx.SaveChanges();

                    //return Ok(parsingRes);
                }
                else
                {
                    //In tal caso non autorizziamo all'esportazione perchè manca proprio l'authority dell'agenzia
                    result.error = "Nessuna callback di esportazione presso l'agenzia";

                    this.ctx.AttivitaLogs.Add(icItem.addLog(id_attivita, TipoDiLog.Error, result.error));

                    result.Attivita.Stato = (Byte)OperationStauts.TerminataConErrori;
                    result.Attivita.DataFine = DateTime.Now;
                    result.Attivita.Progress = 100;

                    this.ctx.SaveChanges();

                }

            }
            catch (Exception ex)
            {
                result.error = ex.ToString();

                this.ctx.AttivitaLogs.Add(icItem.addLog(id_attivita, TipoDiLog.Error, result.error));

                result.Attivita.Stato = (Byte)OperationStauts.TerminataConErrori;
                result.Attivita.DataFine = DateTime.Now;
                result.Attivita.Progress = 100;

                this.ctx.SaveChanges();

            }

            return Ok(result);
        }

        private bool esisteRefOSuoGruppoInMenabo(PromoTracciatiRecord _rec, List<MenaboPagine> pags, List<Int16> filtroPagsArray)
        {
            if (pags.Count <= 0)
            {
                return true;
            }
            if (_rec.MenaboRefs.Count > 0 && filtroPagsArray.Contains(_rec.MenaboRefs.FirstOrDefault().IdPaginaNavigation.Numero))
            {
                return true;
            }

            MenaboPagine menaboPag_ref_di_gruppo = pags.Where(pm3 => pm3.MenaboRefs.Where(pm4 => pm4.CodiceGruppo == _rec.CodiceGruppo).Count() > 0).FirstOrDefault();
            if (menaboPag_ref_di_gruppo != null)
            {
                return filtroPagsArray.Contains(menaboPag_ref_di_gruppo.Numero);
            }

            return false;
        }

        private async Task<IActionResult> esportaPoP(Int64 id_attivita, InputForExport req)
        {
            AttivitaResult result = new AttivitaResult();
            IstantaController icItem = new IstantaController(this._conn_string, this._path_external_lib, this._path_external_source);
            //Response.Write("ESPORTAZIONE PER " + tItem.area + " - " + tItem.nome_esportazione + " materiale " + materiale_pop_singolo + "  conteggio liste =" + parco_liste.Count+"<br>");

            int prog_exp = 0;

            try
            {
                result.Attivita = this.ctx.Attivita.Find(id_attivita)!;
                result.Attivita.StatoMsg = "Esportazione in elaborazione";


                result.Attivita.Progress = 5;
                result.Attivita.Stato = (Byte)OperationStauts.ElaborazioneDati;
                result.Attivita.DataInizio = DateTime.Now;
                this.ctx.SaveChanges();

                string descr1Key = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr1;
                string descr2Key = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr2;
                string descr3Key = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr3;
                string descr4Key = Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr4;


                List<PromoTracciati> work = new List<PromoTracciati>();


                if (req.fields.ContainsKey("id_importazione"))
                {
                    Int32 id_imp = Int32.Parse(req.fields["id_importazione"].ToString());
                    work = await this.ctx2.PromoTracciatis.Include(i => i.IdImportazioneNavigation).Where(t => t.IdImportazione == id_imp).ToListAsync();

                }
                else
                {
                    Int32 id_tracciato = Int32.Parse(req.fields["id_tracciato"].ToString());
                    PromoTracciati tItem = await this.ctx2.PromoTracciatis.Include(i => i.IdImportazioneNavigation).Where(t => t.Id == id_tracciato).FirstOrDefaultAsync();
                    if (tItem != null)
                        work.Add(tItem);
                }

                if (work.Count <= 0)
                    throw new Exception("Tracciato non trovato");



                List<Articoli> archivio_refs = new List<Articoli>();
                List<ArticoliDescrizioni> archivio_descr_gruppo = new List<ArticoliDescrizioni>();

                foreach (PromoTracciati tItem in work)
                {

                    Dictionary<string, object> impRequest = Utility.Main.getJsonObject(tItem.IdImportazioneNavigation.ParamsRequest);


                    if (req.CartellaDiEsportazione == null || req.CartellaDiEsportazione == "")
                    {
                        this.ctx.AttivitaLogs.Add(icItem.addLog(id_attivita, TipoDiLog.Error, "Specificare una cartella di esportazione per questo tipo di materiale"));
                        this.ctx.SaveChanges();

                        result.error = "Specificare una cartella di esportazione per questo tipo di materiale";
                        result.errorCode = ErrorCodes.DirectoryNotFound;

                        return Ok(result);
                    }

                    List<string> _labels = this.ctx2.PromoTracciatiRecords.Where(t => t.IdTracciato == tItem.Id).GroupBy(r => r.Label).Select(s => s.Key).ToList();

                    //Colleziono il tracciato di controllo stanto ben attento a filtrare SOLO le ultime verisoni di goni LABEL di importazione (Edro21 ad es . ne ha una sola MA DocRoma ha Origine,Macelleria,Ortofrutta, ecc...)
                    List<PromoTracciatiRecord> lastTracciatoDiControllo = new List<PromoTracciatiRecord>();
                    foreach (string _lab in _labels)
                    {
                        Byte vLab = this.ctx2.PromoTracciatiRecords.Where(tr => tr.IdTracciato == tItem.Id && tr.Label == _lab).Max(m => m.Versione);
                        lastTracciatoDiControllo.AddRange(this.ctx2.PromoTracciatiRecords.Where(tr => tr.IdTracciato == tItem.Id && tr.Label == _lab && tr.Versione == vLab).ToList());
                    }

                    //Scarico tutti i dati json di tutti gli articoli in tracciato con ultima versione per ogni label caricata
                    var tRecordsJson = lastTracciatoDiControllo
                        .Select(t => new
                        {
                            Selezione = t.SelezioneMenabo,
                            Dato = Utility.Main.getJsonObject(t.Dato)
                        }).ToList();

                    //Scarico tutti i dati json di tutti gli articoli in tracciato
                    /*var tRecordsJson = this.ctx2.PromoTracciatiRecords.Where(t => t.IdTracciato == tItem.Id).Select(t => new
                    {
                        Selezione = t.SelezioneMenabo,
                        Dato = Utility.Main.getJsonObject(t.Dato)
                    }).ToList();*/
                    tRecordsJson = tRecordsJson.Where(t => !t.Dato.ContainsKey(GLOBAL_VARIABLES.keyFuoriPoP) || !(bool)t.Dato[GLOBAL_VARIABLES.keyFuoriPoP]).ToList();

                    List<Dictionary<string, object>> exportList = new List<Dictionary<string, object>>();


                    if (req.ChEsportaDaArchivio)
                    {
                        var meta = Utility.Main.getJsonObject(tItem.Meta);
                        result.Attivita.StatoMsg = meta["NomeEsportazione"].ToString() + " - Recupero descrizioni da archivio";

                        Int16 tot_perc = 75;
                        Int16 curr_perc = 0;

                        //Se esco con Menabo probabilmente mi interessano solo le descrizioni delle ref singole e dei gruppi inseriti

                        List<string> cod_refs_in_tracciato = tRecordsJson.GroupBy(g => g.Dato[Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice].ToString()).Select(s => s.Key).ToList();
                        List<string> codGruppo_in_tracciato = tRecordsJson.GroupBy(g => g.Dato[Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppo].ToString()).Select(s => s.Key).ToList();


                        Int16 _tot_descr = (Int16)(cod_refs_in_tracciato.Count + codGruppo_in_tracciato.Count);

                        Int16 count_progress = 0;

                        DateTime dDiagnostic = DateTime.Now;
                        List<double> diagnostic_arts = new List<double>();
                        List<double> diagnostic_descr = new List<double>();


                        DateTime dDiagnosticArt = DateTime.Now;
                        foreach (string _cod in cod_refs_in_tracciato)
                        {
                            DateTime dMediaArt = DateTime.Now;

                            //var _item = this.ctx.Articolis.Include(i => i.ArticoliDescrizionis).Include(i2 => i2.ArticoliFotos).Where(a => a.Codice==_cod).FirstOrDefault();//cod_refs_in_tracciato.Contains(a.Codice))

                            /*if (_item != null)
                            {
                                archivio_refs.Add(_item);
                            }*/

                            Articoli art = new Articoli();

                            DateTime _d1 = DateTime.Now;

                            if (archivio_refs.Where(a => a.Codice == _cod).Count() <= 0)
                            {
                                var _art = this.ctx.Articolis.Where(a => a.Codice == _cod).Select(s => new { Id = s.Id, Codice = s.Codice }).FirstOrDefault();//cod_refs_in_tracciato.Contains(a.Codice))
                                                                                                                                                              //cache_archivio.Add(_cod, _art);
                                if (_art != null)
                                {
                                    art.Id = _art.Id;
                                    art.Codice = _art.Codice;
                                    ArticoliDescrizioni descr = this.ctx.ArticoliDescrizionis.Where(d => d.IdArticolo == _art.Id).FirstOrDefault();
                                    if (descr != null)
                                        art.ArticoliDescrizionis.Add(descr);

                                    if (req.ChEsportaFoto)
                                    {
                                        ArticoliFoto foto = this.ctx.ArticoliFotos.Where(d => d.IdArticolo == _art.Id).OrderByDescending(o => o.DataModifica).FirstOrDefault();
                                        if (foto != null)
                                            art.ArticoliFotos.Add(foto);
                                    }

                                    archivio_refs.Add(art);
                                }

                            }

                            double performance = DateTime.Now.Subtract(_d1).TotalMilliseconds;

                            diagnostic_arts.Add(DateTime.Now.Subtract(dMediaArt).TotalMilliseconds);

                            count_progress++;

                            Int16 _perc = (Int16)(75 * ((decimal)count_progress / (decimal)_tot_descr));
                            if (_perc - curr_perc >= 5)
                            {
                                //Ogni 5% di progresso aggiorno
                                result.Attivita.Progress = (Int16)(5 + _perc);
                                this.ctx.SaveChanges();
                            }
                            //this.ctx.SaveChanges();
                        }

                        double tempoArt = DateTime.Now.Subtract(dDiagnosticArt).TotalMilliseconds;

                        DateTime dDiagnosticGruppi = DateTime.Now;
                        foreach (string _cod in codGruppo_in_tracciato)
                        {
                            DateTime dMediaDescr = DateTime.Now;

                            var _item = this.ctx.ArticoliDescrizionis.Where(a => a.CodiceGruppo == _cod).FirstOrDefault();
                            if (_item != null)
                                archivio_descr_gruppo.Add(_item);

                            diagnostic_descr.Add(DateTime.Now.Subtract(dMediaDescr).TotalMilliseconds);

                            count_progress++;

                            Int16 _perc = (Int16)(75 * ((decimal)count_progress / (decimal)_tot_descr));
                            if (_perc - curr_perc >= 5)
                            {
                                //Ogni 5% di progresso aggiorno
                                result.Attivita.Progress = (Int16)(5 + _perc);
                                this.ctx.SaveChanges();
                            }

                        }


                        double tempoGruppi = DateTime.Now.Subtract(dDiagnosticGruppi).TotalMilliseconds;

                        double ms = DateTime.Now.Subtract(dDiagnostic).TotalMilliseconds;
                        double mediaArt = diagnostic_arts.Sum() / diagnostic_arts.Count;
                        double mediaDescr = diagnostic_descr.Sum() / diagnostic_descr.Count;
                        ms.ToString();
                    }
                    else
                    {


                    }


                    result.Attivita.StatoMsg = "Esportazione totale";
                    result.Attivita.Progress = 80;
                    this.ctx.SaveChanges();



                    //Raccoglo i codici gruppo dando priorità ai sottogruppi nel caso ci siano
                    string propCodScatto = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppo;
                    string propCodSottogruppo = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceSottogruppo;
                    string propCodGruppo = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppo;

                    List<string> codici_gruppo = tRecordsJson.Where(w => w.Dato.ContainsKey(propCodScatto) && !w.Dato.ContainsKey(propCodSottogruppo)).GroupBy(g => g.Dato[propCodScatto].ToString()).Select(s => s.Key.ToString()).ToList();
                    List<string> codici_sottogruppo = tRecordsJson.Where(w => w.Dato.ContainsKey(propCodSottogruppo)).GroupBy(g => g.Dato[propCodSottogruppo].ToString()).Select(s => s.Key.ToString()).ToList();

                    codici_gruppo.AddRange(codici_sottogruppo);

                    foreach (string cod in codici_gruppo)
                    {


                        //Prima vedo se il gruppo è in realtà un sottogruppo
                        var itemGruppo = tRecordsJson.Where(r => r.Dato.ContainsKey(propCodSottogruppo) && r.Dato[propCodSottogruppo].ToString() == cod).ToList();
                        bool isSottogruppo = true;
                        if (itemGruppo.Count <= 0)
                        {
                            //altrimenti lo cerco per codice gruppo tradizionale
                            itemGruppo = tRecordsJson.Where(r => r.Dato[propCodScatto].ToString() == cod).ToList();
                            isSottogruppo = false;
                        }

                        List<Dictionary<string, object>> _gruppoResult = new List<Dictionary<string, object>>();


                        bool found_descr_gruppo = false;
                        Dictionary<string, object> dictDescrGruppo = new Dictionary<string, object>();

                        //Cerco la descrizione del sottogruppo se c'è
                        if (itemGruppo.Count() > 1 && (isSottogruppo || !itemGruppo.FirstOrDefault().Dato.ContainsKey(GLOBAL_VARIABLES.keySyncIndd)))
                        {

                            ArticoliDescrizioni descrGruppo = archivio_descr_gruppo.Where(g => g.CodiceGruppo == cod).OrderByDescending(o => o.DataUltimaRicezione).FirstOrDefault();
                            if (descrGruppo != null)
                            {
                                found_descr_gruppo = true;


                                dictDescrGruppo.Add(descr1Key, descrGruppo.Descrizione1);
                                dictDescrGruppo.Add(descr2Key, descrGruppo.Descrizione2);
                                dictDescrGruppo.Add(descr3Key, descrGruppo.Descrizione3);
                                dictDescrGruppo.Add(descr4Key, descrGruppo.Descrizione4);
                                if (descrGruppo.DescrizioneIndd != null)
                                    dictDescrGruppo[Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescrIndd] = descrGruppo.DescrizioneIndd;
                                if (descrGruppo.Peso != null)
                                    dictDescrGruppo[Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescrPeso] = descrGruppo.Peso.Value;
                                if (descrGruppo.Um != null)
                                    dictDescrGruppo[Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescrUm] = descrGruppo.Um;
                                if (descrGruppo.Extra != null)
                                {
                                    dictDescrGruppo[Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescrExtra] = JsonConvert.DeserializeObject<JObject>(descrGruppo.Extra);
                                }



                            }
                        }

                        foreach (var item in itemGruppo)
                        {
                            Dictionary<string, object> mObj = new Dictionary<string, object>();

                            if (dictDescrGruppo.Keys.Count > 0)
                                item.Dato[GLOBAL_VARIABLES.keyXMLDescrizioneGruppo]= dictDescrGruppo;

                            //if ((req.ChEsportaDaArchivio && !found_descr_gruppo) || req.ChEsportaFoto)
                            if (req.ChEsportaDaArchivio || req.ChEsportaFoto)
                            {
                                //Qui devo prendere la descrizione revisionata dell'articolo in questione se non c'è una versione del gruppo in cui è contenuta

                                Articoli artItem = archivio_refs.Where(a => a.Codice == item.Dato[Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice].ToString()).FirstOrDefault();
                                if (artItem != null)
                                {
                                    if (req.ChEsportaFoto)
                                    {
                                        string _key_foto = Enum.GetName(AddestramentoRuoli.Foto) + "." + GLOBAL_VARIABLES.keyFotoNome;

                                        //ATTENZIONE,
                                        //Al momento l'opzione è binaria. Opzione 1 non far uscire foto, opzione 2 farle uscire da archivio
                                        //Ma potrebbe in effetti esserfci un'opzione 3 ovvero farle uscire così come sono riportate su tracciato
                                        //infatti il modello di addestramento potrebbe intercettare da solo il parametro Foto.Codice
                                        //Con l'opzione 2 si direbbe esplicitamente al sistema di andare a legggere quella colonna piuttosto che fare come facciamo adesso
                                        //con questo controllo, che invece esclude da solo
                                        if (!item.Dato.ContainsKey(_key_foto))
                                        {
                                            //Controllo se esiste la foto primaria
                                            ArticoliFoto af = artItem.ArticoliFotos.OrderByDescending(o => o.DataModifica).FirstOrDefault();//.Where(af => af.StatoSelezione == (Byte)StatoSelezioneFoto.Primaria).OrderByDescending(o => o.DataModifica).ThenByDescending(o2 => o2.DataInserimento).FirstOrDefault();
                                            if (af != null)
                                            {
                                                //ATTENZIONE: controlliamo che qui non incida sul db realmente
                                                item.Dato[_key_foto] = af.NomeReale;
                                            }
                                            else
                                            {
                                                item.Dato[_key_foto] = artItem.Codice + ".psd";
                                            }
                                        }
                                    }

                                    //if (artItem.ArticoliDescrizionis.Count > 0 && (req.ChEsportaDaArchivio && !found_descr_gruppo))
                                    if (artItem.ArticoliDescrizionis.Count > 0 && req.ChEsportaDaArchivio)
                                    {
                                        //Disabilitato questo controllo//Cerco la descrizione revisionata solo se NON faccio parte di un gruppo o
                                        //Disabilitato questo controllo//se quest'ultimo non è stato revisionato

                                        //anzi, conservo descrizione da tracciato e mi porto SEMPRE dietro la descrizione revisionata del singolo
                                        item.Dato[Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr1Tracciato] = item.Dato.ContainsKey(descr1Key)?item.Dato[descr1Key]:"";
                                        item.Dato[Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr2Tracciato] = item.Dato.ContainsKey(descr2Key)?item.Dato[descr2Key]:"";
                                        item.Dato[Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr3Tracciato] = item.Dato.ContainsKey(descr3Key)?item.Dato[descr3Key]: "";
                                        item.Dato[Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescr4Tracciato] = item.Dato.ContainsKey(descr4Key)?item.Dato[descr4Key]: "";


                                        ArticoliDescrizioni artDescr = artItem.ArticoliDescrizionis.OrderByDescending(o => o.DataUltimaRicezione).FirstOrDefault();
                                        item.Dato[descr1Key] = artDescr.Descrizione1;
                                        item.Dato[descr2Key] = artDescr.Descrizione2;
                                        item.Dato[descr3Key] = artDescr.Descrizione3;
                                        item.Dato[descr4Key] = artDescr.Descrizione4;
                                        if (artDescr.DescrizioneIndd != null)
                                            item.Dato[Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescrIndd] = artDescr.DescrizioneIndd;
                                        if (artDescr.Peso != null)
                                            item.Dato[Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescrPeso] = artDescr.Peso.Value;
                                        if (artDescr.Um != null)
                                            item.Dato[Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescrUm] = artDescr.Um;
                                        if (artDescr.Extra != null)
                                        {
                                            item.Dato[Enum.GetName(AddestramentoRuoli.Descrizioni) + "." + GLOBAL_VARIABLES.keyDescrExtra] = JsonConvert.DeserializeObject<JObject>(artDescr.Extra);
                                        }


                                    }
                                }
                            }

                            item.Dato[GLOBAL_VARIABLES.keyXMLSelezione] = (Byte)TipoSelezioneMenabo.Primaria;

                            exportList.Add(item.Dato);
                            //_gruppoResult.Add(item.Dato);
                        }

                    }

                    result.Attivita.StatoMsg = "Elaborazione con logiche di agenzia";
                    result.Attivita.Progress = 90;
                    this.ctx.SaveChanges();

                    //Chiamata esterna della funzione (SE ESISTE)
                    AddestramentoExcel addestramento = this.ctx2.AddestramentoExcels.Find(tItem.IdImportazioneNavigation.IdAddestramento);

                    if (addestramento.externalCallPerExportPoP != null)
                    {
                        //Ai request field, aggiungo la request field dell'import, potrebbe servire alla chiamata esterna, come dettaglio storico                    
                        req.fields["importFieldsStringfy"] = tItem.IdImportazioneNavigation.ParamsRequest;
                        req.fields["tracciatoFieldsStringfy"] = tItem.Meta;
                        req.fields["esportaDaArchivio"] = req.ChEsportaDaArchivio.ToString().ToLower();
                        req.fields["esportaDaMenabo"] = req.ChEsportaDaMenabo.ToString().ToLower();
                        req.fields["esportaFoto"] = req.ChEsportaFoto.ToString().ToLower();
                        req.fields["addestramento"] = addestramento.Titolo;

                        Dictionary<string, object> _pass = new Dictionary<string, object>();
                        _pass["tracciato"] = exportList;
                        _pass["formRequest"] = req.fields;
                        string resultExternal = icItem.execLibFunction(addestramento.externalCallPerExportPoP, _pass).ToString();

                        //Aggiorno dataset elaborato
                        ExportResult parsingRes = JsonConvert.DeserializeObject<ExportResult>(resultExternal!);

                        if (parsingRes.errors != "")
                        {
                            throw new Exception(parsingRes.errors);
                        }

                        foreach (TracciatoResult _lista in parsingRes.liste)
                        {
                            result.Attivita.StatoMsg = "Scrittura xml/csv " + _lista.NomeEsportazione;
                            this.ctx.SaveChanges();


                            eseguiEsportazionePoP(_lista, req, result.Attivita);
                            prog_exp++;
                        }


                        result.Attivita.StatoMsg = "Esportazione PoP terminata";
                        result.Attivita.Stato = (Byte)OperationStauts.Terminata;
                        result.Attivita.DataFine = DateTime.Now;
                        result.Attivita.Progress = 100;
                        this.ctx.SaveChanges();

                    }
                    else
                    {
                        //In tal caso non autorizziamo all'esportazione perchè manca proprio l'authority dell'agenzia
                        result.error = "Nessuna callback di esportazione presso l'agenzia";

                        this.ctx.AttivitaLogs.Add(icItem.addLog(id_attivita, TipoDiLog.Error, result.error));

                        result.Attivita.Stato = (Byte)OperationStauts.TerminataConErrori;
                        result.Attivita.DataFine = DateTime.Now;
                        result.Attivita.Progress = 100;

                        this.ctx.SaveChanges();

                    }
                }


            }
            catch (Exception ex)
            {
                result.error = ex.ToString();

                this.ctx.AttivitaLogs.Add(icItem.addLog(id_attivita, TipoDiLog.Error, result.error));

                result.Attivita.Stato = (Byte)OperationStauts.TerminataConErrori;
                result.Attivita.DataFine = DateTime.Now;
                result.Attivita.Progress = 100;

                this.ctx.SaveChanges();

            }

            prog_exp.ToString();

            return Ok(result);
        }

        protected void eseguiEsportazione(TracciatoResult lista, InputForExport req, Attivitum attivita)
        {
            //Raggruppamento per pagine e scrittura dell'xml e del csv nella cartella di destinazione indicata
            lista.ToString();

            List<string> lista_foto = new List<string>();
            //List<string> lista_loghi = new List<string>();

            string nome_file_csv = this._path_to_export + lista.NomeEsportazione + ".csv";
            string nome_file_xml = this._path_to_export + lista.NomeEsportazione + ".xml";

            if (System.IO.File.Exists(this._path_to_export + nome_file_csv))
                System.IO.File.Delete(this._path_to_export + nome_file_csv);
            if (System.IO.File.Exists(this._path_to_export + nome_file_xml))
                System.IO.File.Delete(this._path_to_export + nome_file_xml);


            JObject inddInterpreter = JObject.Parse(System.IO.File.ReadAllText(this._path_external_source + "InterpreterXmlFromIndd.json"));
            InterpreterXmlFromIndd inddInterpreterObj = inddInterpreter.ToObject<InterpreterXmlFromIndd>();
            InterpreterRuleFromIndd[] inddRules = inddInterpreterObj.syncRevisione;

            List<InterpreterRuleFromIndd> listaRegoleFromIndd = new List<InterpreterRuleFromIndd>();
            foreach (var rule in inddRules)
            {
                bool take = rule.take;
                InterpreterRuleFromIndd currRule = rule;
                while (!take)
                {
                    foreach (var rule2 in currRule.children)
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
                    var descrGruppo = JdescrGruppo.ToObject<Dictionary<string, object>>();
                    xml_writer.WriteStartElement(tagName_descr_gruppo);
                    foreach (string _k in descrGruppo.Keys)
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
                    var descrGruppoMultiplex = JdescrGruppoMultiplex.ToObject<Dictionary<string, object>>();
                    xml_writer.WriteStartElement(tagName_descr_gruppoMultiplex);
                    foreach (string _k in descrGruppoMultiplex.Keys)
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
                var _list_ref = jArr.ToObject<List<Dictionary<string, object>>>();
                if (_list_ref.Count > 0)
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
                        if (_ref[Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice].ToString() == "2594150")
                            "debug".ToString();

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
                                lista_foto.Add(_ref[k].ToString());
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
                                xml_writer.WriteCData(_ref[k].ToString().ConvertACapoConBrTagPerXml());
                                xml_writer.WriteEndElement();
                            }
                            else
                            {
                                //Tipo complesso
                                string[] ignore = new string[] { Enum.GetName(AddestramentoRuoli.Area), Enum.GetName(AddestramentoRuoli.Scatto), Enum.GetName(AddestramentoRuoli.Descrizioni), Enum.GetName(AddestramentoRuoli.Referenza) };
                                if (!ignore.Contains(k))
                                {
                                    if (_ref[k] is JArray)
                                    {
                                        JArray _arr = _ref[k] as JArray;
                                        var _arrDict = _arr.ToObject<List<JObject>>();
                                        xml_writer.WriteStartElement(k);
                                        foreach (JObject _obj in _arrDict)
                                        {
                                            var _objDict = _obj.ToObject<Dictionary<string, string>>();
                                            foreach (string _k in _objDict.Keys)
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
                                        var _objDict = (_ref[k] as JObject).ToObject<Dictionary<string, object>>();

                                        foreach (string _k in _objDict.Keys)
                                        {
                                            if (_objDict[_k] is JObject)
                                            {
                                                //Qui serve di implementare un metodo recursivo che legga gli elementi complessi annidati senza un limite di livello
                                                //Per adesso, data la necessità di leggere l'oggetto complesso ultilivello SyncIndd, mi limito a scansionare il secondo livello
                                                var _objDict2 = (_objDict[_k] as JObject).ToObject<Dictionary<string, string>>();
                                                foreach (string _k2 in _objDict2.Keys)
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
                JObject oLB = JObject.Parse(System.IO.File.ReadAllText(this._path_external_source + "SourceLoghiBolli.json"));
                DbLoghiBolli loghibolli = oLB.ToObject<DbLoghiBolli>();
                lista_foto.AddRange(loghibolli.source);


                //Recupero path alta del progetto
                JObject o1 = JObject.Parse(System.IO.File.ReadAllText(this._path_external_source + "SourceUnita.json"));
                DbUnita archiviDB = o1.ToObject<DbUnita>();
                DbUnitaItem alta_folder = archiviDB.source.Where(s => !s.webFolder && !s.syncFolder && !s.exportFolder).FirstOrDefault();
                DbUnitaItem export_folder = archiviDB.source.Where(s => s.exportFolder).FirstOrDefault();


                //Faccio partire l'operazione I/O figlia dell'attività di esportazione
                OperationRequest op = new OperationRequest();
                op.Command = OperationCommand.CopiaFiles;
                op.AttivitaParent = attivita.Id;

                InputForI_O io_command = new InputForI_O();
                io_command.csvFile = "";
                io_command.xmlFile = nome_file_xml;
                io_command.foto = lista_foto;
                io_command.folder = export_folder.path + "\\" + req.CartellaDiEsportazione;
                io_command.Titolo = lista.NomeEsportazione;
                io_command.IdUnitaExport = export_folder.id;

                op.Packet = io_command;




                //Aggiungo attività da svolgere collegata all'attività padre di esportazione
                OperationsController op_ctrl = new OperationsController(this._conn_string, "", "");
                op_ctrl.Add(op);

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
            if (req.fields.ContainsKey("tracciatoFieldsStringfy"))
            {
                var dictTMeta = JsonConvert.DeserializeObject<Dictionary<string, object>>(req.fields["tracciatoFieldsStringfy"]);
                xml_writer.WriteAttributeString("sigla", dictTMeta["Area"].ToString());
            }
            if (req.fields.ContainsKey("addestramento"))
            {
                xml_writer.WriteAttributeString("addestramento", req.fields["addestramento"]);
            }

            xml_writer.WriteAttributeString("titolo", lista.NomeEsportazione);


            JObject inddInterpreter = JObject.Parse(System.IO.File.ReadAllText(this._path_external_source + "InterpreterXmlFromIndd.json"));
            InterpreterXmlFromIndd inddInterpreterObj = inddInterpreter.ToObject<InterpreterXmlFromIndd>();
            InterpreterRuleFromIndd[] inddRules = inddInterpreterObj.syncRevisione;

            List<InterpreterRuleFromIndd> listaRegoleFromIndd = new List<InterpreterRuleFromIndd>();
            foreach(var rule in inddRules)
            {
                bool take = rule.take;
                InterpreterRuleFromIndd currRule = rule;
                while (!take) 
                {
                    foreach (var rule2 in currRule.children)
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


            Int64 curpag = -1;
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
                        lista_foto.Add(item[k].ToString());
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
                        string[] ignore = new string[] { Enum.GetName(AddestramentoRuoli.Area), Enum.GetName(AddestramentoRuoli.Scatto), Enum.GetName(AddestramentoRuoli.Descrizioni), Enum.GetName(AddestramentoRuoli.Referenza) };
                        if (!ignore.Contains(k))
                        {
                            if (item[k] is JArray)
                            {
                                JArray _arr = item[k] as JArray;
                                var _arrDict = _arr.ToObject<List<JObject>>();
                                xml_writer.WriteStartElement(k);
                                foreach (JObject _obj in _arrDict)
                                {
                                    var _objDict = _obj.ToObject<Dictionary<string, string>>();
                                    foreach (string _k in _objDict.Keys)
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
                                var _objDict = (item[k] as JObject).ToObject<Dictionary<string, object>>();

                                foreach (string _k in _objDict.Keys)
                                {
                                    if (_objDict[_k] is JObject)
                                    {
                                        //Qui serve di implementare un metodo recursivo che legga gli elementi complessi annidati senza un limite di livello
                                        //Per adesso, data la necessità di leggere l'oggetto complesso ultilivello SyncIndd, mi limito a scansionare il secondo livello
                                        var _objDict2 = (_objDict[_k] as JObject).ToObject<Dictionary<string, string>>();
                                        foreach (string _k2 in _objDict2.Keys)
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
                JObject oLB = JObject.Parse(System.IO.File.ReadAllText(this._path_external_source + "SourceLoghiBolli.json"));
                DbLoghiBolli loghibolli = oLB.ToObject<DbLoghiBolli>();
                lista_foto.AddRange(loghibolli.source);


                //Recupero path alta del progetto
                JObject o1 = JObject.Parse(System.IO.File.ReadAllText(this._path_external_source + "SourceUnita.json"));
                DbUnita archiviDB = o1.ToObject<DbUnita>();
                DbUnitaItem alta_folder = archiviDB.source.Where(s => !s.webFolder && !s.syncFolder && !s.exportFolder).FirstOrDefault();
                DbUnitaItem export_folder = archiviDB.source.Where(s => s.exportFolder).FirstOrDefault();


                //Faccio partire l'operazione I/O figlia dell'attività di esportazione
                OperationRequest op = new OperationRequest();
                op.Command = OperationCommand.CopiaFiles;
                op.AttivitaParent = attivita.Id;

                InputForI_O io_command = new InputForI_O();
                io_command.csvFile = "";
                io_command.xmlFile = nome_file_xml;
                io_command.foto = lista_foto;
                io_command.folder = export_folder.path + "\\" + req.CartellaDiEsportazione;
                io_command.Titolo = lista.NomeEsportazione;
                io_command.IdUnitaExport = export_folder.id;

                op.Packet = io_command;




                //Aggiungo attività da svolgere collegata all'attività padre di esportazione
                OperationsController op_ctrl = new OperationsController(this._conn_string, "", "");
                op_ctrl.Add(op);

            }


        }

        private async Task<IActionResult> copiaFiles(Int64 id_attivita, InputForI_O req)
        {
            AttivitaResult res = new AttivitaResult();
            res.Attivita = this.ctx.Attivita.Find(id_attivita);

            try
            {
                res.Attivita.Stato = (Byte)OperationStauts.ElaborazioneDati;
                res.Attivita.DataInizio = DateTime.Now;
                res.Attivita.StatoMsg = "Copia dei files in corso...";
                this.ctx.SaveChanges();

                if (req.folder == null || req.folder == "")
                {
                    throw new Exception("La cartella di destinazione non è valida");
                }
                else
                {
                    JObject o1 = JObject.Parse(System.IO.File.ReadAllText(this._path_external_source + "SourceUnita.json"));
                    DbUnita archiviDB = o1.ToObject<DbUnita>();
                    DbUnitaItem expFolder = archiviDB.source.Where(u => u.exportFolder).FirstOrDefault();
                    DbUnitaItem altaFolder = archiviDB.source.Where(u => !u.exportFolder && !u.webFolder && !u.syncFolder).FirstOrDefault();

                    if (expFolder != null)
                    {
                        if (expFolder.credentials != null && expFolder.credentials.IndexOf("@") > 0)
                        {

                            string[] credenziali = expFolder.credentials.Split('@');
                            string user = credenziali[0];
                            string pass = credenziali[1];

                            /*
                            var credentials = new SimpleImpersonation.UserCredentials(user, pass);
                            var files =  SimpleImpersonation.Impersonation.RunAsUser(credentials, SimpleImpersonation.LogonType.Network, () =>
                            {
                                bool esito = eseguiCopia(req, altaFolder, res.Attivita);
                                res.Attivita.DataFine = DateTime.Now;
                                if (!esito)
                                {
                                    res.Attivita.Stato = (Byte)OperationStauts.TerminataConErrori;
                                    res.Attivita.Progress = 100;
                                    res.Attivita.StatoMsg = "Operazione terminata con errori";
                                }
                                else
                                {
                                    res.Attivita.Stato = (Byte)OperationStauts.Terminata;
                                    res.Attivita.Progress = 100;
                                    res.Attivita.StatoMsg = "Operazione terminata";
                                }
                                this.ctx.SaveChanges();
                                return esito;

                            });
                            */


                            System.Net.NetworkCredential readCredentials = new NetworkCredential(user, pass);
                            using (new Utility.NetworkConnection(expFolder.path, readCredentials))
                            {
                                bool esito = eseguiCopia(req, altaFolder, res.Attivita);
                                res.Attivita.DataFine = DateTime.Now;
                                if (!esito)
                                {
                                    res.Attivita.Stato = (Byte)OperationStauts.TerminataConErrori;
                                    res.Attivita.Progress = 100;
                                    res.Attivita.StatoMsg = "Operazione terminata con errori";
                                }
                                else
                                {
                                    res.Attivita.Stato = (Byte)OperationStauts.Terminata;
                                    res.Attivita.Progress = 100;
                                    res.Attivita.StatoMsg = "Operazione terminata";
                                }
                                this.ctx.SaveChanges();
                            }

                        }
                        else
                        {
                            bool esito = eseguiCopia(req, altaFolder, res.Attivita);

                            res.Attivita.DataFine = DateTime.Now;
                            if (!esito)
                            {
                                res.Attivita.Stato = (Byte)OperationStauts.TerminataConErrori;
                                res.Attivita.Progress = 100;
                                res.Attivita.StatoMsg = "Operazione terminata con errori";

                            }
                            else
                            {
                                res.Attivita.Stato = (Byte)OperationStauts.Terminata;
                                res.Attivita.Progress = 100;
                                res.Attivita.StatoMsg = "Operazione terminata";
                            }
                            this.ctx.SaveChanges();
                        }
                    }
                    else
                    {
                        throw new Exception("Unità di esportazione non valida");
                    }
                }


            }
            catch (Exception ex)
            {
                res.error = ex.ToString();
                IstantaController icItem = new IstantaController(this._conn_string, this._path_external_lib, this._path_external_source);
                this.ctx.AttivitaLogs.Add(icItem.addLog(id_attivita, TipoDiLog.Error, ex.ToString()));

                res.Attivita.Stato = (Byte)OperationStauts.TerminataConErrori;
                res.Attivita.DataFine = DateTime.Now;
                res.Attivita.StatoMsg = "Operazione terminata con errori";
                this.ctx.SaveChanges();
            }

            return Ok(res);
        }

        protected bool eseguiCopia(InputForI_O req, DbUnitaItem altaFolder, Attivitum attivita)
        {
            IstantaController icItem = new IstantaController(this._conn_string, this._path_external_lib, this._path_external_source);

            JObject o1 = JObject.Parse(System.IO.File.ReadAllText(this._path_external_source + "SourceUnita.json"));
            DbUnita archiviDB = o1.ToObject<DbUnita>();
            List<DbUnitaItem> sync_folders = archiviDB.source.Where(s => s.syncFolder).ToList();
            DbUnitaItem exp_folder = archiviDB.source.Where(s => s.exportFolder).FirstOrDefault();
            DbUnitaItem alta_folder = archiviDB.source.Where(s => !s.webFolder && !s.syncFolder && !s.exportFolder).FirstOrDefault();

            if (exp_folder == null)
            {
                throw new Exception("Web folder not found");
            }
            if (alta_folder == null)
            {
                throw new Exception("Alta folder not found");
            }

            string jsonRequestExpFolder = Newtonsoft.Json.JsonConvert.SerializeObject(exp_folder);
            Dictionary<string, object> RequestExpFolder = Newtonsoft.Json.JsonConvert.DeserializeObject<Dictionary<string, object>>(jsonRequestExpFolder);
            string jsonRequestAltaFolder = Newtonsoft.Json.JsonConvert.SerializeObject(alta_folder);
            Dictionary<string, object> RequestAltaFolder = Newtonsoft.Json.JsonConvert.DeserializeObject<Dictionary<string, object>>(jsonRequestAltaFolder);

            PhotoManager phManager = new PhotoManager();


            List<string> sysListFiles = new List<string>();
            /*if (!Directory.Exists(req.folder))
            {
                Directory.CreateDirectory(req.folder);
            }*/

            bool flag_esito = true;

            try
            {

                if (req.xmlFile != null && req.xmlFile != "")
                {
                    sysListFiles.Add(req.xmlFile);

                    //FileInfo fi = new FileInfo(req.xmlFile);
                    //string dest = req.folder + "\\" + fi.Name;
                    //System.IO.File.Copy(req.xmlFile, req.folder + "\\" + fi.Name);


                    //using (FileStream fs_source = new FileStream(req.xmlFile, FileMode.Open, FileAccess.Read, FileShare.Read))
                    //{
                    //    byte[] bytes_source = new byte[fs_source.Length];
                    //    fs_source.Read(bytes_source, 0, bytes_source.Length);
                    //    using (FileStream fs_copy = new FileStream(dest, FileMode.CreateNew))
                    //    {
                    //        fs_copy.Write(bytes_source, 0, bytes_source.Length);
                    //    }
                    //}


                    //attivita.Progress = 5;
                    //attivita.StatoMsg = "Salvataggio XML";
                    //this.ctx.SaveChanges();

                }

                if (req.csvFile != null && req.csvFile != "")
                {
                    sysListFiles.Add(req.csvFile);

                    //FileInfo fi = new FileInfo(req.csvFile);
                    //string dest = req.folder + "\\" + fi.Name;

                    //using (FileStream fs_source = new FileStream(req.csvFile, FileMode.Open, FileAccess.Read, FileShare.Read))
                    //{
                    //    byte[] bytes_source = new byte[fs_source.Length];
                    //    fs_source.Read(bytes_source, 0, bytes_source.Length);
                    //    using (FileStream fs_copy = new FileStream(dest, FileMode.CreateNew))
                    //    {
                    //        fs_copy.Write(bytes_source, 0, bytes_source.Length);
                    //    }
                    //}

                    //attivita.Progress = 10;
                    //attivita.StatoMsg = "Salvataggio CSV";
                    //this.ctx.SaveChanges();

                }
            }
            catch (Exception ex)
            {
                this.ctx.AttivitaLogs.Add(icItem.addLog(attivita.Id, TipoDiLog.Error, ex.ToString()));
                this.ctx.SaveChanges();
                flag_esito = false;
            }

            phManager.startExport(RequestExpFolder, RequestAltaFolder, req.folder, sysListFiles.ToArray());

            int start_prog = 10;

            int tot = req.foto.Count;
            int prog = 0;
            int prog_perc = 0;

            //Creo cartella links se ancora non esiste
            string links_folder = req.folder + "\\links";
            //if (!Directory.Exists(links_folder))
            //{
            //    Directory.CreateDirectory(links_folder);
            //}

            foreach (string file in req.foto)
            {
                try
                {
                    //System.IO.File.Copy(altaFolder.path + "\\" + file, req.folder + "\\" + file);

                    string fileDef = file;
                    string sourceAlta = altaFolder.path + "\\" + file;
                    string dest = links_folder + "\\" + fileDef;


                    phManager.exportFileFromAltaTo(sourceAlta, dest);

                    //if (!System.IO.File.Exists(links_folder + "\\" + file))
                    //{



                    //    if (!System.IO.File.Exists(sourceAlta))
                    //    {
                    //        sourceAlta = altaFolder.path + "\\nofoto.psd";
                    //        FileInfo fi_no_ex = new FileInfo(file);
                    //        fileDef = file.Replace(fi_no_ex.Extension, ".psd");
                    //    }

                    //    using (FileStream fs_source = new FileStream(sourceAlta, FileMode.Open, FileAccess.Read, FileShare.Read))
                    //    {
                    //        byte[] bytes_source = new byte[fs_source.Length];
                    //        fs_source.Read(bytes_source, 0, bytes_source.Length);
                    //        using (FileStream fs_copy = new FileStream(links_folder + "\\" + fileDef, FileMode.CreateNew))
                    //        {
                    //            fs_copy.Write(bytes_source, 0, bytes_source.Length);
                    //        }
                    //    }


                    //}

                }
                catch (Exception ex)
                {
                    this.ctx.AttivitaLogs.Add(icItem.addLog(attivita.Id, TipoDiLog.Error, "Errore copia foto: " + ex.ToString()));
                    this.ctx.SaveChanges();
                    flag_esito = false;
                }


                prog++;
                int _perc = (int)(((decimal)prog / (decimal)tot) * 100);
                if (_perc - prog_perc >= 5)
                {
                    //Ogni 5% aggiorno stato attivita
                    attivita.Progress = (Int16)(start_prog + (90 * ((decimal)_perc / 100)));
                    attivita.StatoMsg = "Copia in corso...";
                    this.ctx.SaveChanges();

                    prog_perc = _perc;
                }

            }


            return flag_esito;

        }

        protected async Task<IActionResult> confontaListe(Int64 id_attivita, InputForConfronto req)
        {
            AttivitaResult result = new AttivitaResult();
            IstantaController icItem = new IstantaController(this._conn_string, this._path_external_lib, this._path_external_source);
            //Response.Write("ESPORTAZIONE PER " + tItem.area + " - " + tItem.nome_esportazione + " materiale " + materiale_pop_singolo + "  conteggio liste =" + parco_liste.Count+"<br>");

            try
            {
                JObject o1 = JObject.Parse(System.IO.File.ReadAllText(this._path_external_source + "InterpreterConfronto.json"));
                InterpreterConfronto interpreter = o1.ToObject<InterpreterConfronto>();

                result.Attivita = this.ctx.Attivita.Find(id_attivita)!;
                result.Attivita.StatoMsg = "Recupero tracciati";


                result.Attivita.Progress = 5;
                result.Attivita.Stato = (Byte)OperationStauts.ElaborazioneDati;
                result.Attivita.DataInizio = DateTime.Now;
                this.ctx.SaveChanges();



                if (req.CartellaDiEsportazione == null || req.CartellaDiEsportazione == "")
                {
                    this.ctx.AttivitaLogs.Add(icItem.addLog(id_attivita, TipoDiLog.Error, "Specificare una cartella di esportazione per questo tipo di materiale"));

                    result.error = "Specificare una cartella di esportazione per questo tipo di materiale";
                    result.errorCode = ErrorCodes.DirectoryNotFound;

                    result.Attivita.Stato = (Byte)OperationStauts.TerminataConErrori;
                    result.Attivita.StatoMsg = "Nessuna cartella specificata";
                    result.Attivita.DataFine = DateTime.Now;
                    result.Attivita.Progress = 100;

                    this.ctx.SaveChanges();
                    return Ok(result);
                }

                string nomePromoPrimaria = "";
                string nomePromoSecondaria = "";
                string nomeTracciatoPrimario = "";
                string nomeTracciatoSecondario = "";
                Promo promoPrimaria = new();
                Promo promoSecondaria = new();
                PromoTracciati tracciatoPrimario = new();
                PromoTracciati tracciatoSecondario = new();
                List<PromoTracciatiRecord> q_records = new List<PromoTracciatiRecord>();
                List<PromoTracciatiRecord> q_records_secondaria = new List<PromoTracciatiRecord>();
                //Recupero dei dati di tracciato in funzione dei parametri utente
                if (req.VersionePrecedente) //se stiamo confrontando con la versione precedente
                {
                    if (req.IdTracciatoPrimario[0] == 0 && req.IdTracciatoPrimario.Count <= 1) //se stiamo confrontando la promo con la versione precedente di se stessa
                    {
                        promoPrimaria = await this.ctx2.Promos.Include(f => f.PromoTracciatis).ThenInclude(f => f.PromoTracciatiRecords).Where(f => f.Id == req.IdPromoPrimaria).FirstOrDefaultAsync();
                        nomePromoPrimaria = promoPrimaria.NomePromo;
                        foreach (var tracciato in promoPrimaria.PromoTracciatis)
                        {
                            var tmpVar = tracciato.PromoTracciatiRecords.Where(f => f.Stato == (byte)StatoRecord.Attivo).ToList();
                            var tmpVar2 = tmpVar;
                            tmpVar = tmpVar
                            .GroupBy(r => r.Label) // Raggruppa per label
                            .SelectMany(g => g.Where(r => r.Versione == g.Max(r => r.Versione))) // Seleziona gli elementi con la versione massima in ogni gruppo
                            .ToList();
                            q_records.AddRange(tmpVar);
                            tmpVar2 = tmpVar2
                            .GroupBy(r => r.Label) // Raggruppa per label
                            .SelectMany(g => g.Where(r => r.Versione == g.Max(v => v.Versione) - 1)
                            .Union(g.Where(r => r.Versione == g.Max(v => v.Versione)))).ToList();

                            q_records_secondaria.AddRange(tmpVar2);
                        }
                    }
                    else //se stiamo confrontando il tracciato con la versione precedente se stesso
                    {
                        foreach (var item in req.IdTracciatoPrimario)
                        {
                            tracciatoPrimario = await this.ctx2.PromoTracciatis.Include(f => f.PromoTracciatiRecords).Where(f => f.Id == item).FirstOrDefaultAsync();
                            var tmpVar = tracciatoPrimario.PromoTracciatiRecords.Where(f => f.Stato == (byte)StatoRecord.Attivo).ToList();
                            var tmpVar2 = tmpVar;
                            tmpVar = tmpVar
                            .GroupBy(r => r.Label) // Raggruppa per label
                            .SelectMany(g => g.Where(r => r.Versione == g.Max(r => r.Versione))) // Seleziona gli elementi con la versione massima in ogni gruppo
                            .ToList();
                            q_records.AddRange(tmpVar);
                            tmpVar2 = tmpVar2
                            .GroupBy(r => r.Label) // Raggruppa per label
                            .SelectMany(g => g.Where(r => r.Versione == g.Max(v => v.Versione) - 1)
                            .Union(g.Where(r => r.Versione == g.Max(v => v.Versione)))).ToList();
                            q_records_secondaria.AddRange(tmpVar2);            
                        }
                    }
                    //q_records_secondaria = q_records
                    //    .GroupBy(r => r.Label) // Raggruppa per label
                    //    .SelectMany(g => g.Where(r => r.Versione == g.Max(v => v.Versione) - 1)) // Seleziona gli elementi con la versione massima e una versione più indietro in ogni gruppo
                    //    .ToList();
                    //q_records = q_records
                    //    .GroupBy(r => r.Label) // Raggruppa per label
                    //    .SelectMany(g => g.Where(r => r.Versione == g.Max(r => r.Versione))) // Seleziona gli elementi con la versione massima in ogni gruppo
                    //    .ToList();
                }
                else //se stiamo confrontando due elementi differenti
                {
                    if (req.IdTracciatoPrimario[0] == 0 && req.IdTracciatoPrimario.Count <= 1) //se stiamo confrontando la promo con un'altra promo
                    {
                        promoPrimaria = await this.ctx2.Promos.Include(f => f.PromoTracciatis).ThenInclude(f => f.PromoTracciatiRecords).Where(f => f.Id == req.IdPromoPrimaria).FirstOrDefaultAsync();
                        nomePromoPrimaria = promoPrimaria.NomePromo;
                        foreach (var tracciato in promoPrimaria.PromoTracciatis)
                        {
                            var tmpVar = tracciato.PromoTracciatiRecords.Where(f => f.Stato == (byte)StatoRecord.Attivo).ToList();
                            tmpVar = tmpVar
                            .GroupBy(r => r.Label) // Raggruppa per label
                            .SelectMany(g => g.Where(r => r.Versione == g.Max(r => r.Versione))) // Seleziona gli elementi con la versione massima in ogni gruppo
                            .ToList();
                            q_records.AddRange(tmpVar);
                        }
                        promoSecondaria = await this.ctx2.Promos.Include(f => f.PromoTracciatis).ThenInclude(f => f.PromoTracciatiRecords).Where(f => f.Id == req.IdPromoSecondaria).FirstOrDefaultAsync();
                        nomePromoSecondaria = promoSecondaria.NomePromo;
                        foreach (var tracciato in promoSecondaria.PromoTracciatis)
                        {
                            var tmpVar = tracciato.PromoTracciatiRecords.Where(f => f.Stato == (byte)StatoRecord.Attivo).ToList();
                            tmpVar = tmpVar
                            .GroupBy(r => r.Label) // Raggruppa per label
                            .SelectMany(g => g.Where(r => r.Versione == g.Max(r => r.Versione))) // Seleziona gli elementi con la versione massima in ogni gruppo
                            .ToList();
                            q_records_secondaria.AddRange(tmpVar);
                        }
                        //q_records = q_records
                        //    .GroupBy(r => r.Label) // Raggruppa per label
                        //    .SelectMany(g => g.Where(r => r.Versione == g.Max(r => r.Versione))) // Seleziona gli elementi con la versione massima in ogni gruppo
                        //    .ToList();
                        //q_records_secondaria = q_records_secondaria
                        //    .GroupBy(r => r.Label) // Raggruppa per label
                        //    .SelectMany(g => g.Where(r => r.Versione == g.Max(r => r.Versione))) // Seleziona gli elementi con la versione massima in ogni gruppo
                        //    .ToList();
                    }
                    else //se stiamo confrontando il tracciato con un altro tracciato
                    {
                        foreach (var item in req.IdTracciatoPrimario)
                        {
                            promoPrimaria = await this.ctx2.Promos.Where(f => f.Id == req.IdPromoPrimaria).FirstOrDefaultAsync();
                            nomePromoPrimaria = promoPrimaria.NomePromo;
                            tracciatoPrimario = await this.ctx2.PromoTracciatis.Include(f => f.PromoTracciatiRecords).Where(f => f.Id == item).FirstOrDefaultAsync();
                            nomeTracciatoPrimario = tracciatoPrimario.Sigla;
                            var tmpVar = tracciatoPrimario.PromoTracciatiRecords.Where(f => f.Stato == (byte)StatoRecord.Attivo).ToList();
                            tmpVar = tmpVar
                            .GroupBy(r => r.Label) // Raggruppa per label
                            .SelectMany(g => g.Where(r => r.Versione == g.Max(r => r.Versione))) // Seleziona gli elementi con la versione massima in ogni gruppo
                            .ToList();
                            q_records.AddRange(tracciatoPrimario.PromoTracciatiRecords.Where(f => f.Stato == (byte)StatoRecord.Attivo).ToList());
                        }

                        foreach (var item in req.IdTracciatoSecondario)
                        {
                            promoSecondaria = await this.ctx2.Promos.Where(f => f.Id == req.IdPromoSecondaria).FirstOrDefaultAsync();
                            nomePromoSecondaria = promoSecondaria.NomePromo;
                            tracciatoSecondario = await this.ctx2.PromoTracciatis.Include(f => f.PromoTracciatiRecords).Where(f => f.Id == item).FirstOrDefaultAsync();
                            nomeTracciatoSecondario = tracciatoSecondario.Sigla;
                            var tmpVar = tracciatoSecondario.PromoTracciatiRecords.Where(f => f.Stato == (byte)StatoRecord.Attivo).ToList();
                            tmpVar = tmpVar
                            .GroupBy(r => r.Label) // Raggruppa per label
                            .SelectMany(g => g.Where(r => r.Versione == g.Max(r => r.Versione))) // Seleziona gli elementi con la versione massima in ogni gruppo
                            .ToList();
                            q_records_secondaria.AddRange(tmpVar);
                        }
                        
                        //q_records = q_records
                        //.GroupBy(r => r.Label) // Raggruppa per label
                        //.SelectMany(g => g.Where(r => r.Versione == g.Max(r => r.Versione))) // Seleziona gli elementi con la versione massima in ogni gruppo
                        //.ToList();
                        //q_records_secondaria = q_records_secondaria
                        //.GroupBy(r => r.Label) // Raggruppa per label
                        //.SelectMany(g => g.Where(r => r.Versione == g.Max(r => r.Versione))) // Seleziona gli elementi con la versione massima in ogni gruppo
                        //.ToList();
                    }
                }

                List<Dictionary<string, object>> DatoListaPrimaria = new();
                List<Dictionary<string, object>> DatoListaSecondaria = new();
                //estraggo i dictionary dalle due liste
                foreach (var record in q_records)
                {
                    var jsonRecord = IstantaJson.getJsonObject(record.Dato);
                    jsonRecord["id_tracciato"] = record.IdTracciato;
                    DatoListaPrimaria.Add(jsonRecord);
                }
                foreach (var record in q_records_secondaria)
                {
                    var jsonRecord = IstantaJson.getJsonObject(record.Dato);
                    jsonRecord["id_tracciato"] = record.IdTracciato;
                    if (req.VersionePrecedente)
                    {
                        //foreach (var recordPrim in q_records)
                        //{
                        //    if (IstantaJson.getJsonObject(recordPrim.Dato).ContainsKey("Alterazioni"))
                        //    {
                        //        jsonRecord = IstantaJson.getJsonObject(recordPrim.Dato);
                        //        jsonRecord["id_tracciato"] = recordPrim.IdTracciato;
                        //        DatoListaSecondaria.Add(jsonRecord);
                        //    }
                        //}

                        if (jsonRecord.ContainsKey("Alterazioni") || q_records.Find(f=>f.Id == record.Id) == null)
                        {
                            DatoListaSecondaria.Add(jsonRecord);
                        }
                    }
                    else
                    {
                        DatoListaSecondaria.Add(jsonRecord);
                    }
                }
                result.Attivita.StatoMsg = "Inizio confronto";
                result.Attivita.Progress = 50;
                result.Attivita.Stato = (Byte)OperationStauts.ElaborazioneDati;
                result.Attivita.DataInizio = DateTime.Now;
                this.ctx.SaveChanges();


                if (interpreter.lib != null && interpreter.lib != "")
                {
                    //Ai request field, aggiungo la request field dell'import, potrebbe servire alla chiamata esterna, come dettaglio storico                    

                    Dictionary<string, object> _pass = new Dictionary<string, object>();
                    _pass["primario"] = new List<Dictionary<string, object>>();
                    _pass["primario"] = DatoListaPrimaria;
                    _pass["secondario"] = new List<Dictionary<string, object>>();
                    _pass["secondario"] = DatoListaSecondaria;
                    _pass["controlloVersione"] = req.VersionePrecedente;
                    _pass["reqParams"] = req.fields;
                    string resultExternal = icItem.execLibFunction(interpreter.lib, _pass).ToString();

                    result.Attivita.StatoMsg = "Creo i file";
                    result.Attivita.Progress = 90;
                    result.Attivita.Stato = (Byte)OperationStauts.ElaborazioneDati;
                    result.Attivita.DataInizio = DateTime.Now;
                    this.ctx.SaveChanges();

                    //Gestione del risultato
                    //List<ElementoListaConfrontata> data = JsonConvert.DeserializeObject<List<ElementoListaConfrontata>>(resultExternal);
                    csvDataset data = JsonConvert.DeserializeObject<csvDataset>(resultExternal);
                    // Salva il CSV
                    string nome_file_csv = "";
                    if (!req.VersionePrecedente)
                    {
                        nome_file_csv = this._path_to_export + (req.fields.ContainsKey("confrontoLocandine") && req.fields["confrontoLocandine"] == "true" ? "Locandine_": "") + nomePromoPrimaria +(nomeTracciatoPrimario != "" ? "_"+ nomeTracciatoPrimario : "") +"_DIFF_" + (nomePromoSecondaria != nomePromoPrimaria ? nomePromoSecondaria+"_" : "") + (nomeTracciatoSecondario != "" ? nomeTracciatoSecondario : "")+".csv";
                    }
                    else
                    {
                        nome_file_csv = this._path_to_export + (req.fields.ContainsKey("confrontoLocandine") && req.fields["confrontoLocandine"] == "true" ? "Locandine_" : "") + nomePromoPrimaria + (nomeTracciatoPrimario != "" ? "_" + nomeTracciatoPrimario : "") + "_DIFF_versione_precedente.csv";
                    }
                    using (var writer = new StreamWriter(nome_file_csv))
                    using (var csv = new CsvWriter(writer, new CsvConfiguration(CultureInfo.InvariantCulture)))
                    {
                        var records = data.records;

                        //foreach (var row in data)
                        //{
                        //    foreach (var k in data.headerField)
                        //    {

                        //    }
                        //    var record = new ElementoListaConfrontata
                        //    {
                        //        Codice = row[0],
                        //        Descrizione = row[1],
                        //        PrezzoContinuo1 = row[2],
                        //        PrezzoContinuo2 = row[3],
                        //        Sconto1 = row[4],
                        //        Sconto2 = row[5],
                        //        PrezzoPromo1 = row[6],
                        //        PrezzoPromo2 = row[7],
                        //        PrezzoKGL1 = row[8],
                        //        PrezzoKGL2 = row[9],
                        //    };
                        //    records.Add(record);
                        //}
                        //csv.WriteRecords(records.AsEnumerable());
                        foreach (var kvp in data.headerField)
                        {
                            csv.WriteField(kvp);
                        }

                        csv.NextRecord();

                        foreach (var rec in data.records)
                        {
                            foreach (var kvp2 in data.headerField)
                            {
                                if (!rec.ContainsKey(kvp2))
                                {
                                    Debug.Print("");
                                    csv.WriteField("");
                                }
                                else
                                {
                                    csv.WriteField(rec[kvp2]);
                                }
                            }
                            csv.NextRecord();

                        }

                    }

                    if (req.VersionePrecedente)
                    {
                        req.IdPromoSecondaria = req.IdPromoPrimaria;
                        tracciatoSecondario = tracciatoPrimario;
                    }

                    //Preparo operazione di copia del csv
                    OperationRequest opCsv = new OperationRequest();
                    opCsv.Command = OperationCommand.CopiaFiles;
                    opCsv.AttivitaParent = id_attivita;

                    //Recupero path alta del progetto
                    JObject oUnita = JObject.Parse(System.IO.File.ReadAllText(this._path_external_source + "SourceUnita.json"));
                    DbUnita archiviDB = oUnita.ToObject<DbUnita>();
                    DbUnitaItem export_folder = archiviDB.source.Where(s => s.exportFolder).FirstOrDefault();


                    InputForI_O io_command = new InputForI_O();
                    io_command.csvFile = nome_file_csv;
                    io_command.xmlFile = "";
                    io_command.foto = new List<string>();//Nessuna foto da esportare
                    io_command.folder = export_folder.path + "\\" + req.CartellaDiEsportazione;
                    io_command.Titolo = "Copia del csv nella cartella di lavorazione";
                    io_command.IdUnitaExport = export_folder.id;

                    opCsv.Packet = io_command;

                    await this.Add(opCsv);


                    //Adesso facciamo partire il processo di esportazione della lista secondaria
                    //Da procedura di confronto SOLO la lista secondaria necessita di essere esportate per l'indd, in quanto è la lista secondaria a subire le modifiche
                    //Naturalmente questa procedura parte SOLO nel caso di confronti tra tracciati e non tra tutta la promo
                    if (req.IdTracciatoPrimario[0] > 0 && req.IdTracciatoSecondario[0] >0 && !req.fields.ContainsKey("confrontoLocandine"))
                    {
                        OperationRequest op = new OperationRequest();
                        op.Command = OperationCommand.EsportazioneVol;

                        //if (req.fields.ContainsKey("id_tracciato"))
                        //{
                        //    Int32 id_tracciato = Int32.Parse(req.fields["id_tracciato"]);
                        //    req.fields.Add("Titolo", Utility.Main.getJsonObject(tracciatoSecondario.Meta)["NomeEsportazione"].ToString());
                        //}

                        op.AttivitaParent = id_attivita;
                        InputForExport iForExp = new InputForExport()
                        {
                            ChEsportaDaArchivio = true,
                            ChEsportaFoto = true,
                            CartellaDiEsportazione = req.CartellaDiEsportazione,
                            ChEsportaDaMenabo = false,
                            fields = req.fields
                        };

                        iForExp.fields["id_tracciato"] = req.IdTracciatoSecondario[0].ToString();
                        iForExp.fields["Titolo"] = Utility.Main.getJsonObject(tracciatoSecondario.Meta)["NomeEsportazione"].ToString();

                        op.Packet = iForExp;


                        //Registro l'operazione, Ottengo così l'ID e preparo la cartella per l'elaborazione
                        var actionResult = await this.Add(op);
                    }



                    //In base ai dati ricevuti dalla chiamata esterrna, costruisco il csv e l'xml
                    //Creazione CSV
                    //Per la scirttura di questo hai già eseperienza derivata da M.L.

                    //Creazione XML
                    //var xmlDocument = new XDocument(
                    //    new XElement("Root",
                    //        new XAttribute("Titolo", "Titolo"),
                    //        data.Select(row =>
                    //            new XElement("Item",
                    //               new XElement("Codice", new XCData(row[0])),
                    //               new XElement("Descrizione", new XCData(row[1])),
                    //               new XElement("PrezzoContinuo1", new XCData(row[2])),
                    //               new XElement("PrezzoContinuo2", new XCData(row[3])),
                    //               new XElement("Sconto1", new XCData(row[4])),
                    //               new XElement("Sconto2", new XCData(row[5])),
                    //               new XElement("PrezzoPromo1", new XCData(row[6])),
                    //               new XElement("PrezzoPromo2", new XCData(row[7])),
                    //               new XElement("PrezzoKGL1", new XCData(row[8])),
                    //               new XElement("PrezzoKGL2", new XCData(row[9]))
                    //            )
                    //        )
                    //    )
                    //);
                    //xmlDocument.Save(nome_file_xml);




                    result.Attivita.StatoMsg = "Confronto terminato";
                    result.Attivita.Stato = (Byte)OperationStauts.Terminata;
                    result.Attivita.DataFine = DateTime.Now;
                    result.Attivita.Progress = 100;
                    this.ctx.SaveChanges();

                    //return Ok(parsingRes);
                }
                else
                {
                    //In tal caso non autorizziamo all'esportazione perchè manca proprio l'authority dell'agenzia
                    result.error = "Nessuna callback di esportazione presso l'agenzia";

                    this.ctx.AttivitaLogs.Add(icItem.addLog(id_attivita, TipoDiLog.Error, result.error));

                    result.Attivita.Stato = (Byte)OperationStauts.TerminataConErrori;
                    result.Attivita.DataFine = DateTime.Now;
                    result.Attivita.Progress = 100;

                    this.ctx.SaveChanges();

                }

            }
            catch (Exception ex)
            {
                result.error = ex.ToString();

                this.ctx.AttivitaLogs.Add(icItem.addLog(id_attivita, TipoDiLog.Error, result.error));

                result.Attivita.StatoMsg = "Errore";
                result.Attivita.Stato = (Byte)OperationStauts.TerminataConErrori;
                result.Attivita.DataFine = DateTime.Now;
                result.Attivita.Progress = 100;

                this.ctx.SaveChanges();

            }

            return Ok(result);
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
