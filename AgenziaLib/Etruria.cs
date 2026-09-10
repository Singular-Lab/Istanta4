using AgenziaLib.Tipi;
using IstantaLib;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

using System.IO;

using Newtonsoft;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System.Data.SqlTypes;

namespace AgenziaLib
{
    internal class Etruria : IAgenzia
    {
        private readonly string Key_PrezzoPromo = "prezzo_promo";
        private readonly string Key_PrezzoPromoKgL = "prezzo_kgl";
        private readonly string Key_PrezzoPromoCompilato = "prezzo_promo_std";
        private readonly string Key_PrezzoPromoKgLCompilato = "prezzo_kgl_std";
        private readonly string Key_PrezzoContinuo = "prezzo_continuo";
        private readonly string Key_PrezzoContinuoCompilato = "prezzo_continuo_std";
        private readonly string Key_ScontoCompilato = "sconto";

        private readonly string Key_UM2 = "um2";
        private readonly string Key_Settore = "settore";
        private readonly string Key_Meccanica = "meccanica";
        private readonly string Key_Off = "off";

        public string ordinaLista(List<Dictionary<string, object>> listRecs, string pathOrdinamentoLista)
        {
            throw new NotImplementedException();
        }

        public string confrontaListatoVolantino(List<Dictionary<string, object>> primario, Dictionary<string, string> reqParams)
        {
            throw new NotImplementedException();
        }

        public AnalisiConfrontoResponse confrontaListe(AnalisiConfrontoTracciatoDetails primario, AnalisiConfrontoTracciatoDetails secondario, bool controlloVersione, Dictionary<string, string> reqParams)
        {
            throw new NotImplementedException();
        }

        public string eseguiAutoSelezioneGruppo(List<Dictionary<string, object>> gruppo, List<Dictionary<string, object>> ghost)
        {
            //Seleziono la primaria e AL MASSIMO una secondaria
            string keyXMLSelezione = GLOBAL_VARIABLES.keyXMLSelezione;
            if (gruppo.Count > 1)
            {
                int conteggioSecondarie = 0;
                foreach (var item in gruppo)
                {
                    if ((Byte)item[keyXMLSelezione] == (Byte)TipoSelezioneMenabo.Secondaria)
                    {
                        conteggioSecondarie++;
                    }

                    if (conteggioSecondarie>1)
                    {
                        item[keyXMLSelezione] = (Byte)TipoSelezioneMenabo.None;
                    }

                }

            }

            //throw new NotImplementedException();
            return JsonConvert.SerializeObject(gruppo);
        }

        public TracciatoResultKit esportaVolantino(List<FicoContextField> promoContext, List<FicoContextField> tracciatoContext, List<ArticoloInKit> tracciato, FicoRuntimeKit kit, string pathNamingConvention, string pathACPV, string pathTipiDiExport, string pathOrdinamentoLista, string pathMeccaniche, string pathLoghiBolli, string pathMappaStili, FicoCombinazioneKitReadMode readMode)
        {
            //Console.WriteLine("--------esporta con logiche di agenzia-------------");

           
            TracciatoResultKit result = new TracciatoResultKit();
            //return result;

            string logs = "";

            try
            {
                

                TracciatoKit tracciato_da_esportare = new TracciatoKit();
                result.liste = new List<TracciatoKit>() { tracciato_da_esportare };
                result.liste[0].Records = new List<ArticoloInKit>();
                result.liste[0].errors = "";
                



                List<IstantaLib.ArticoloInKitExportName> exportNames = new List<IstantaLib.ArticoloInKitExportName>();


                JObject o1 = JObject.Parse(File.ReadAllText(pathACPV));
                DbACPV acpvDB = o1.ToObject<DbACPV>();

                JObject o6 = JObject.Parse(File.ReadAllText(pathTipiDiExport));
                DbTipoDiExport tipiExportDB = o6.ToObject<DbTipoDiExport>();

                string ncContentFile = File.ReadAllText(pathNamingConvention);
                JArray o7 = JArray.Parse(ncContentFile);
                FicoNamingConvention ncDB = JsonConvert.DeserializeObject<FicoNamingConvention>(ncContentFile);
                foreach (TipoDiExport tItem in tipiExportDB.source)
                {
                    IstantaLib.ArticoloInKitExportName codifica = new IstantaLib.ArticoloInKitExportName();
                    codifica.guidIdTipoExport = tItem.guidID;
                    codifica.nomeFile = NamingConventionUtility.Decode(tItem, promoContext, tracciatoContext, kit, acpvDB, ncDB, null, null, null, null);
                    exportNames.Add(codifica);
                }


                for (int i = 0; i < tracciato.Count; i++) //lista_tracciato.Count; i++)
                {
                    ////Console.WriteLine($"esporta item: {i} di {tracciato.Count}");

                    Dictionary<string, object> item = tracciato[i].recordInTracciato;// lista_tracciato[i];
                                                                                     //Compilazione dei campi
                                                                                     //Da mettere in esportazione

                    ////Console.WriteLine("REF AGENZIA-> "  + item[GLOBAL_VARIABLES.keyRefCodice].ToString());
                    ////Console.WriteLine(JsonConvert.SerializeObject(item));

                    CompiledField descrizioneCompiled = new CompiledField()
                    {
                        labelName = "descrizione",
                        paragraphName = "",
                        content = $"{new FieldTagContent("DESCRIZIONE_TITOLO", item[GLOBAL_VARIABLES.keyDescr1].ToString()).ToString()}" +
                        $"{new FieldTagContent("DESCRIZIONE_BRAND", item[GLOBAL_VARIABLES.keyDescr2].ToString()).ToString()}" +
                        $"{new FieldTagContent("DESCRIZIONE_TIPO", item[GLOBAL_VARIABLES.keyDescr3].ToString()).ToString()}"+
                        $"{new FieldTagContent("DESCRIZIONE_GRAMMATURA", item[GLOBAL_VARIABLES.keyDescr4].ToString()).ToString()}"
                    };


                    List<CompiledField> _listCompiled = new List<CompiledField>();

                    _listCompiled.Add(descrizioneCompiled);


                    decimal prezzoPromoNum = item[this.Key_PrezzoPromo].ToDecimal();
                    //item[Key_PrezzoPromoCompilato] = $"€ {MathExt.DecimalRoundToString(prezzoPromoNum)}";
                    string prezzo_promo_content = $"€{MathExt.DecimalRoundMidpoint(prezzoPromoNum)}";
                    decimal prezzoPromoKgLNum = item[this.Key_PrezzoPromoKgL].ToDecimal();
                    string umLista = item[GLOBAL_VARIABLES.keyDescrUm].ToString();
                    string um2Lista = item[this.Key_UM2].ToString();
                    string off = item[this.Key_Off].ToString();
                    
                    
                    if (off == "FT" || off == "SS")
                        continue;



                    CompiledField prezzo_promoCompiled = new CompiledField()
                    {
                        labelName = this.Key_PrezzoPromoCompilato,
                        paragraphName = "PREZZO_PROMO",
                        content = prezzo_promo_content
                    };

                    logs += $"{item[GLOBAL_VARIABLES.keyRefCodice].ToString()} codice BOX presente ? {item.ContainsKey(GLOBAL_VARIABLES.codiceBox)}";

                    string codBox = "";

                    if (item.ContainsKey(GLOBAL_VARIABLES.codiceBox))
                    {
                        if (item[GLOBAL_VARIABLES.codiceBox] == null)
                        {
                            logs += " è NULL ";
                            //Console.WriteLine($"{item[GLOBAL_VARIABLES.keyRefCodice].ToString()} non ha BOX assegnato");
                        }
                        else
                        {
                            codBox= item[GLOBAL_VARIABLES.codiceBox].ToString();

                            if (codBox == "BOX_SCONTO")
                                prezzo_promoCompiled.paragraphName = "PREZZO_PROMO_SCONTO";
                            else if (codBox == "BOX_SCONTO_FID")
                                prezzo_promoCompiled.paragraphName = "PREZZO_PROMO_SCONTO_TITOLARI";

                            logs += " lo scrivo ";
                            logs += $" -> {codBox}";
                        }
                     
                    }




                    ////Console.WriteLine("Step 1");


                    string um = umLista == "LT" ? "lt" : "kg";
                    //item[this.Key_PrezzoPromoKgLCompilato] = $"al {um} € {MathExt.DecimalRoundToString(prezzoPromoKgLNum)}";
                    string prezzo_promo_kgj_content = $"al {um} € {MathExt.DecimalRoundMidpoint(prezzoPromoKgLNum)}";

                    CompiledField prezzo_promo_kglCompiled = new CompiledField()
                    {
                        labelName = this.Key_PrezzoPromoKgLCompilato,
                        paragraphName = "",
                        content = prezzo_promo_kgj_content
                    };


                    string sett = item[this.Key_Settore].ToString();
                    if (umLista == "KG" && um2Lista == "KG")
                    {
                        if (sett == "54" || sett == "52")
                        {

                            decimal prezzo_etto = prezzoPromoNum / 10;
                            //item[this.Key_PrezzoPromoCompilato] = $"€ {MathExt.DecimalRoundToString(prezzo_etto)}";
                            prezzo_promoCompiled.content = $"€{MathExt.DecimalRoundMidpoint(prezzo_etto)}";

                        }
                        else if (sett == "56" || sett == "58")
                        {
                            //item[this.Key_PrezzoPromoKgLCompilato] = $"al {um}";
                            prezzo_promo_kglCompiled.content = $"al {um}";
                        }
                    }

                    ////Console.WriteLine("Step 2");

                    string meccanica = item[this.Key_Meccanica].ToString();
                    if (meccanica.Contains("%"))
                    {
                        //item[this.Key_ScontoCompilato] = $"- {meccanica.ToLower().Replace("sconto ","")}";
                        string sconto_content = $"-{meccanica.ToLower().Replace("sconto ", "")}";

                        decimal prezzoContinuoNum = item[this.Key_PrezzoContinuo].ToDecimal();
                        //item[this.Key_PrezzoContinuoCompilato] = $"invece di\n€ {MathExt.DecimalRoundToString(prezzoContinuoNum)}";
                        string prezzo_continuo_content = $"invece di\n€ {MathExt.DecimalRoundMidpoint(prezzoContinuoNum)}";

                        CompiledField scontoCompiled = new CompiledField()
                        {
                            labelName = this.Key_ScontoCompilato,
                            paragraphName = "SCONTO",
                            content = sconto_content
                        };

                        if (codBox == "BOX_SCONTO_FID")
                        {
                            scontoCompiled.paragraphName = "SCONTO_titolari";
                        }

                        CompiledField prezzo_continuoCompiled = new CompiledField()
                        {
                            labelName = this.Key_PrezzoContinuoCompilato,
                            paragraphName = "",
                            content = prezzo_continuo_content
                        };

                        _listCompiled.Add(scontoCompiled);
                        _listCompiled.Add(prezzo_continuoCompiled);

                    }

                    if (sett == "46" || sett == "44")
                    {
                        //Cura persona e Cura casa NON esce questa info
                        prezzo_promo_kglCompiled.content = "";
                    }

                    ////Console.WriteLine("Step 3");
                    _listCompiled.Add(prezzo_promoCompiled);
                    _listCompiled.Add(prezzo_promo_kglCompiled);


                    item[GLOBAL_VARIABLES.keyCompiled] = _listCompiled;

                    tracciato[i].recordInTracciato[GLOBAL_VARIABLES_FICO.keyFicoNames] = exportNames;
                    result.liste[0].Records.Add(tracciato[i]);
                }
            }
            catch(Exception ex)
            {
                result.errors= ex.ToString();
                //Console.WriteLine("ERRROR AGENZIA: " + ex.ToString() + " LOGS: " + logs);
            }   

            return result;

        }

        public string getAlterazioniTracciatoFromIndd(List<Dictionary<string, object>> gruppo, Dictionary<string, object> articoloIndd)
        {
            throw new NotImplementedException();
        }

        public string importaTracciato(List<Dictionary<string, object>> tracciato, Dictionary<string, string> formRequest, List<FicoContextField> context, List<FicoContextField> contextPromo, string pathACPV, string pathOrdinamentoLista, string pathMeccaniche, string pathTraduttoreAC)
        {
            ImportResult impResult = new ImportResult();

            List<Tracciato> result = new List<Tracciato>();
            string errors = "";


            System.Globalization.CultureInfo culture = new System.Globalization.CultureInfo("it-IT");
            //Voglio impostare la cultura italiana per il parsing delle date


            try
            {

                bool flag_error = false;
                Byte imp_tipo_tracciato = (Byte)1;// Byte.Parse(formRequest["cmbTipoTracciato"].ToString());

                JObject o1 = JObject.Parse(File.ReadAllText(pathACPV));
                DbACPV areeDB = o1.ToObject<DbACPV>();


                List<Area> dbAree = areeDB.aree;
                //Di area ce n'è una soltanto
                Area aItem = dbAree.FirstOrDefault();


                List<Canale> dbCanali = areeDB.canali;

                

                foreach (Dictionary<string, object> item in tracciato )
                {
                    //Associazione dell'area/canale
                    //Individuo CANALE
                    string canaleInLista = item["canale"].ToString();
                    Canale canale = dbCanali.FirstOrDefault(x => canaleInLista.Contains(x.nome));
                    if (canale == null)
                    {
                        throw new Exception("Canale non trovato: " + canaleInLista);
                    }

                    Tracciato tItem = result.FirstOrDefault(r => r.guidCanale == canale.guidID && r.guidArea == aItem.guidID);
                    if (tItem==null)
                    {
                        tItem = new Tracciato();
                        tItem.guidArea = aItem.guidID;
                        tItem.guidCanale = canale.guidID;
                        tItem.Canale = canale.nome;
                        tItem.Area = aItem.nome;
                        tItem.DataDa = DateTime.Now;
                        tItem.DataA = DateTime.Now;
                        tItem.Records = new List<Dictionary<string,object>>();

                        result.Add(tItem);
                       
                    }

                    
                    tItem.Records.Add(item);

                }

                //Assegnazione gruppi
                foreach(Tracciato t in result)
                {
                    t.Records.GroupBy(x => x["prestazione"].ToString()).ToList().ForEach(g =>
                    {
                        string prestazione = g.Key;
                        List<Dictionary<string, object>> recordsGruppo = t.Records.Where(x => x["prestazione"].ToString() == prestazione).ToList();
                        string cod_gruppo = String.Join(",", recordsGruppo.Select(s => s[GLOBAL_VARIABLES.keyRefCodice]).OrderBy(o => o.ToString()).ToArray());
                        foreach (Dictionary<string,object> r in recordsGruppo)
                        {
                            r[GLOBAL_VARIABLES.keyScattoCodiceGruppo] = cod_gruppo;
                        }
                    }); 
                }

                              

                impResult.liste = result;

            }
            catch(Exception ex)
            {
                impResult.errors = ex.ToString();
            }
            
            return JsonConvert.SerializeObject(impResult);
        }

        public AnalisiPorpagazioneResult analizzaPropagazionePerCambioMeta(AnalisiPorpagazione analisiAzione, List<CambioMetaRecordTracciatoAzione> azione)
        {
            throw new NotImplementedException();
        }

        public AnalisiPorpagazioneResult analizzaPropagazionePerModificaCampiOfferta(AnalisiPorpagazione analisiAzione, RevisioneCampiOffertaFromIndd azione)
        {
            throw new NotImplementedException();
        }

        public AnalisiPorpagazioneResult analizzaPropagazionePerRevisione(AnalisiPorpagazione analisiAzione, RevisioneDescrizione azione)
        {
            throw new NotImplementedException();
        }

        TracciatoResultKit IAgenzia.esportaPoP(List<FicoContextField> promoContext, List<FicoContextField> tracciatoContext, List<ArticoloInKit> tracciato, FicoRuntimeKit kit, string pathNamingConvention, string pathACPV, string pathTipiDiExport, string pathOrdinamentoLista, string pathMeccaniche, string pathLoghiBolli, string pathFormati, string pathMappaStili, FicoCombinazioneKitReadMode readMode)
        {
            throw new NotImplementedException();
        }

        public List<q_records_per_getListaRevisione> specificaInOutVol(List<q_records_per_getListaRevisione> tracciatoSingoli, List<q_records_per_getListaRevisione> listaOrigine)
        {
            throw new NotImplementedException();
        }
        public List<colonnaReportImportazione> getColonneReportImportaziones()
        {
            List<colonnaReportImportazione> colonneRichieste = new List<colonnaReportImportazione>();
            return colonneRichieste;
        }

        public List<List<Dictionary<string, object>>> eseguiAutoSelezioneGruppoMassiva(List<List<Dictionary<string, object>>> gruppo, List<Dictionary<string, object>> ghost)
        {
            throw new NotImplementedException();
        }

        public string callbackNamingConventionDynamicField(string campo, Dictionary<string, object> rec, List<FicoCombinazioniKitDeclinazioneProprieta> propsDeclinazione)
        {
            return "";
        }

        public List<Dictionary<string, object>> elaboraTracciatiRecords(List<Dictionary<string, object>> records, FicoRuntimeKit kit, string siglaAreaKit)
        {
            throw new NotImplementedException();
        }

        public Dictionary<string, object> elaboraRecordDaClonare(Dictionary<string, object> origin, Dictionary<string, object> chiaviEliminate, SampleKitDiDestinazioneClone sample, string codiceBox, string pathOrdinamentoLista)
        {
            throw new NotImplementedException();
        }

        public List<CambioStrutturale> GetCambioStrutturalePath()
        {
            throw new NotImplementedException();
        }

        public string MetaPerRevisione(
List<Dictionary<string, object>> recordsGruppo,
int idPromo,
int idTracciato,
string siglaTracciato)
        {
            return null;
        }

        public EsitoFirmaGarantita CheckFirmaGarantita(List<Dictionary<string, object>> recordsGruppo, string meta)
        {
            return new EsitoFirmaGarantita();
        }

        public string GetMetaPerRevisioneDaGruppiMultipli(WrapperPerGetGarante wrap)
        {
            return null;

        }
        public string GetMetaPerRevisioneDaGruppiMultipliBatch(WrapperBatchPerGetGarante batch)
        {
            return null;
        }

        public List<Dictionary<string, object>> FiltraRecordsPerConteggioRevisione(
List<Dictionary<string, object>> records)
        {
            return records;
        }

        public string CheckFirmaPluginGarantitaBatch(WrapperBatchCheckFirmaPlugin batch)
        {
            return null;
        }
    }
}
