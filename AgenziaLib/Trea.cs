using IstantaLib;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using AgenziaLib.Tipi;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System.IO;
using System.ComponentModel;
using System.Data.SqlTypes;
using System.Collections;
using System.Diagnostics;
using System.Runtime.CompilerServices;
using System.Text.RegularExpressions;
using System.Globalization;

namespace AgenziaLib
{


    internal class Trea
    {


        public string importaTracciato(List<Dictionary<string, object>> tracciato, Dictionary<string, string> formRequest, List<FicoContextField> context, List<FicoContextField> contextPromo, string pathACPV, string pathOrdinamentoLista, string pathMeccaniche, string pathTraduttoreAC)
        {
            ImportResult impResult = new ImportResult();

            string errors = "";

            try
            {
                JObject o1 = JObject.Parse(File.ReadAllText(pathACPV));
                DbACPV areeDB = o1.ToObject<DbACPV>();

                Area areaDb = areeDB.aree.FirstOrDefault(c => c.sigla == "3A");

                impResult.liste = new List<Tracciato>();
                int currPrestazione = 0;

                for (int i = 0; i < tracciato.Count; i++)
                {
                    DateTime inizio_processo_item = DateTime.Now;

                    try
                    {
                        var itemInLista = tracciato[i];                        

                        string codRef = itemInLista[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString();
                        int prestazione = Int32.Parse(itemInLista["prestazione"].ToString());
                        string canale = itemInLista["canale"].ToString();


                        Tracciato t_item = impResult.liste.FirstOrDefault(l => l.Canale == canale);
                        if (t_item == null)
                        {
                            Canale canaleDb = areeDB.canali.FirstOrDefault(c => c.sigla == canale);
                            if (canaleDb==null)
                                throw new Exception($"Canale {canale} non trovato nel DB Aree");

                            t_item = new Tracciato();
                            t_item.Area = areaDb.sigla;
                            t_item.guidArea = areaDb.guidID;
                            t_item.Canale = canaleDb.sigla;
                            t_item.guidCanale = canaleDb.guidID;

                            //Obsoleti
                            t_item.DataDa = DateTime.Now;
                            t_item.DataA = DateTime.Now;
                            t_item.DescrizioneIniziativa = "";
                            t_item.Iniziativa = "";
                            t_item.Tipo = 0;
                            t_item.Promozione50Al50 = false;

                            impResult.liste.Add(t_item);

                        }

                        //Non salviamo un codice che è già previsto per questo tracciato
                        if (t_item.Records.Count(c => c[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString() == codRef) > 0)
                            continue;

                        if (prestazione<=0)
                        {
                            itemInLista["prestazione"] = currPrestazione;
                        }
                        else
                        {
                            currPrestazione = prestazione;
                        }

                        
                        t_item.Records.Add(itemInLista);

                    }
                    catch (Exception ex)
                    {
                        errors += ex.ToString() + "\n";
                    }

                }

                //Formazione dei gruppi per tracciato
                foreach(Tracciato tItem in impResult.liste) 
                { 
                    List<int> cod_scatti = tItem.Records.Select(s => (int)s["prestazione"]).ToList();

                    //Adesso devo ciclare tutto per stabilire i codici gruppi secondo assegnazione scatto
                    cod_scatti.ForEach(x =>
                    {
                        try
                        {

                            var _gruppo = tItem.Records.Where(s => (int)s["prestazione"] == x).ToList();
                            bool is_copertina = _gruppo.Count(g => g["copertina"].ToString().ToLower() == "x")>0;

                            List<string> codici_gruppo = new List<string>();
                            _gruppo.ForEach(g =>
                            {

                                if (g.ContainsKey(GLOBAL_VARIABLES.keyRefCodice))
                                {
                                    codici_gruppo.Add(g[GLOBAL_VARIABLES.keyRefCodice].ToString());
                                }
                            });

                            string codice_gruppo = String.Join(",", codici_gruppo.OrderBy(o => o).ToArray());

                            _gruppo.ForEach(g =>
                            {
                                g[GLOBAL_VARIABLES.keyScattoCodiceGruppo] = codice_gruppo;
                                g["copertina"]=is_copertina ? "X" : "";
                            });

                        }
                        catch (Exception ex)
                        {
                            errors += ex.ToString() + "\n";
                        }
                    });
                }

                
            }
            catch (Exception ex)
            {
                errors += ex.ToString();
            }

            impResult.errors = errors;

            return JsonConvert.SerializeObject(impResult);

        }

        public string importaVolantinoBisettimanale(Dictionary<string, string> formRequest, List<Dictionary<string, object>> tracciato, string pathAree)
        {

            ImportResult impResult = new ImportResult();

            string errors = "";

            try
            {
                JObject o1 = JObject.Parse(File.ReadAllText(pathAree));
                DbAree areeDB = o1.ToObject<DbAree>();
                List<AreaItem> aree = areeDB.source;

                //sappiamo che Doc importa per singola area.
                //Qui ci sarà MARKET,ORO,PROSSIMITA o FRATTINI
                //int id_area = Int32.Parse(formRequest["cmbCanaleArea"]);

                /*List<Area> aList = aree.Where(a => a.Codice == "ORO" || a.Codice == "MARKET" || a.Codice == "PROSSIMITA").ToList();
                if (aList.Count <= 0)
                    throw new Exception("area not found");*/

                foreach (AreaItem aItem in aree)
                {

                    string area = aItem.Area;

                    Tracciato tItem = new Tracciato();
                    tItem.Area = area;
                    if (formRequest.ContainsKey("nomePromo"))
                    {
                        tItem.NomeEsportazione = formRequest["nomePromo"].ToString() + " " + area;
                    }
                    else
                    {
                        tItem.NomeEsportazione = area;
                    }

                    int curr_prestazione = 0;

                    //Serve perchè le liste 3A hanno dei codici duplicati nella lista
                    List<string> codici_chache = new List<string>();

                    for (int i = 0; i < tracciato.Count; i++)
                    {
                        DateTime inizio_processo_item = DateTime.Now;

                        try
                        {
                            string codRef = tracciato[i][GLOBAL_VARIABLES.keyRefCodice].ToString();
                            if (codici_chache.Contains(codRef))
                            {
                                continue;
                            }


                            Dictionary<string, object> item = new Dictionary<string, object>();
                            foreach (string key in tracciato[i].Keys)
                            {
                                item[key] = tracciato[i][key];
                            }

                            bool in_eurospar = item["in_eurospar"].ToString().ToLower()=="x";
                            bool in_despar = item["in_despar"].ToString().ToLower()=="x";
                            bool in_express = item["in_express"].ToString().ToLower()=="x";

                            bool check_area = false;
                            if ((area=="EUROSPAR" || area == "FANTINATO" || area == "FANTINATO_SMMD") && in_eurospar)
                            {
                                check_area = true;
                            }
                            else if (area=="DESPAR" && in_despar)
                            {
                                check_area = true;
                            }
                            else if ((area == "EXPRESS" || area == "BOTTEGA") && in_express)
                            {
                                check_area = true;
                            }

                            if (check_area)
                            {
                                //Il record è valido per i parametri di importazione richiesti
                                //string cod_scatto = item[Tipi.GLOBAL_VARIABLES.keyScattoCodice];

                                //Elaborazione della descrizione prezzo in funzione di vari parametri e regole
                                int prestazione = (int)item["prestazione"];
                                if (prestazione > 0)
                                {
                                    curr_prestazione = prestazione;
                                }
                                else
                                {
                                    item["prestazione"] = curr_prestazione;
                                }

                                if (area.IndexOf("FANTINATO")>=0)
                                {
                                    //levo FID se c'è
                                    if (item["note"].ToString() == "FID")
                                    {
                                        item["note"] = "";
                                    }
                                }

                                tItem.Records.Add(item);
                                codici_chache.Add(codRef);

                            }
                        }
                        catch (Exception ex)
                        {
                            errors += ex.ToString() + "\n";
                        }

                    }

                    List<int> cod_scatti = tItem.Records.Select(s => (int)s["prestazione"]).ToList();

                    //Adesso devo ciclare tutto per stabilire i codici gruppi secondo assegnazione scatto
                    cod_scatti.ForEach(x =>
                    {
                        try
                        {

                            var _gruppo = tItem.Records.Where(s => (int)s["prestazione"] == x).ToList();
                            List<string> codici_gruppo = new List<string>();
                            _gruppo.ForEach(g =>
                            {

                                if (g.ContainsKey(GLOBAL_VARIABLES.keyRefCodice))
                                {
                                    codici_gruppo.Add(g[GLOBAL_VARIABLES.keyRefCodice].ToString());
                                }
                            });

                            string codice_gruppo = String.Join(",", codici_gruppo.OrderBy(o => o).ToArray());

                            _gruppo.ForEach(g =>
                            {

                                g[GLOBAL_VARIABLES.keyScattoCodiceGruppo] = codice_gruppo;
                            });

                        }
                        catch (Exception ex)
                        {
                            errors += ex.ToString() + "\n";
                        }
                    });

                    //Esguo ordinamento secondo schema, che per doc al momento è semplicemente per SCATTO
                    //tItem.Records = tItem.Records.OrderBy(o => o[GLOBAL_VARIABLES.keyScattoCodice]).ToList();
                    impResult.liste.Add(tItem);
                }
            }
            catch (Exception ex)
            {
                errors += ex.ToString();
            }

            impResult.errors = errors;

            return JsonConvert.SerializeObject(impResult);

        }

        public string getBollini(Dictionary<string, object> rec)
        {
            string boll = "";          

            return boll;
        }

        public TracciatoResultKit esportaVolantino(List<FicoContextField> promoContext, List<FicoContextField> tracciatoContext, List<ArticoloInKit> tracciato, FicoRuntimeKit kit, string pathNamingConvention, string pathACPV, string pathTipiDiExport, string pathOrdinamentoLista, string pathMeccaniche, string pathLoghiBolli, string pathMappaStili, FicoCombinazioneKitReadMode readMode)
        {
            System.Globalization.CultureInfo culture = new System.Globalization.CultureInfo("it-IT");
            CultureInfo.CurrentCulture = culture;


            TracciatoResultKit result = new TracciatoResultKit();

            string keyStatoSelezione = Edro21Context.Meta.keyStatoSelezione;

            TracciatoKit tracciato_da_esportare = new TracciatoKit();
            string referenza_pilota = Edro21Context.Meta.referenza_pilota;
            result.liste = new List<TracciatoKit>() { tracciato_da_esportare };
            result.liste[0].Records = new List<ArticoloInKit>();
            result.liste[0].errors = "";// = new List<Dictionary<string, object>>();
            try
            {

                List<Dictionary<string,object>> lista_tracciato = tracciato.Select(s => s.recordInTracciato).ToList();

                string tipo_materiale = "vol";
                Byte tipo_volantino = 1;

                JObject o2 = JObject.Parse(File.ReadAllText(pathOrdinamentoLista));
                DbOrdinamento ordDB = o2.ToObject<DbOrdinamento>();
                List<Ordinamento> dbGrammature = ordDB.source;


                JObject o1 = JObject.Parse(File.ReadAllText(pathACPV));
                DbACPV acpvDB = o1.ToObject<DbACPV>();

                JObject o5 = JObject.Parse(File.ReadAllText(pathLoghiBolli));
                DbLoghiBolli loghibolliDB = o5.ToObject<DbLoghiBolli>();

                JObject o6 = JObject.Parse(File.ReadAllText(pathTipiDiExport));
                DbTipoDiExport tipiExportDB = o6.ToObject<DbTipoDiExport>();


                string ncContentFile = File.ReadAllText(pathNamingConvention);
                FicoNamingConvention ncDB = JsonConvert.DeserializeObject<FicoNamingConvention>(ncContentFile);

                //I nomi saranno per tutte le ref identici quindi lo estraggouna volta soltanto
                List<IstantaLib.ArticoloInKitExportName> exportNames = new List<IstantaLib.ArticoloInKitExportName>();

                string tipoExport = "";
                foreach (TipoDiExport tItem in tipiExportDB.source)
                {
                    IstantaLib.ArticoloInKitExportName codifica = new IstantaLib.ArticoloInKitExportName();
                    codifica.guidIdTipoExport = tItem.guidID;
                    codifica.nomeFile = NamingConventionUtility.Decode(tItem, promoContext, tracciatoContext, kit, acpvDB, ncDB, null, null, null, null);
                    exportNames.Add(codifica);
                }

                var tipoDiExpWeb = tipiExportDB.source.Find(f => f.codice == "WEB");

                if (tipoDiExpWeb != null)
                {
                    if (kit.tipiDiExportInKit.Count == 1 && kit.tipiDiExportInKit[0].tipoDiExportGuidID == tipoDiExpWeb.guidID)
                    {
                        tipoExport = "WEB";
                    }
                }

                CompiledFieldInterpreter interprete = new CompiledFieldInterpreter();

                int counter = 0;
                for (int i = 0; i < tracciato.Count; i++) //lista_tracciato.Count; i++)
                {

                    Dictionary<string, object> recItem = tracciato[i].recordInTracciato;// lista_tracciato[i];

                    string codice_referenza = recItem[GLOBAL_VARIABLES.keyRefCodice].ToString();
                    string codice_gruppo = recItem[GLOBAL_VARIABLES.keyScattoCodiceGruppo].ToString();

                    //if (codice_referenza == "881763")
                    //    "break".ToString();

                    decimal peso = recItem[GLOBAL_VARIABLES.keyDescrPeso].ToDecimal();
                    string um = recItem[GLOBAL_VARIABLES.keyDescrUm].ToString();
                    string descr_1 = "";
                    string descr_brand = "";
                    string descr_tipo = "";
                    string descr_gramm = "";
                    string note = recItem["note"].ToString();
                    string confezione = recItem["confezione"].ToString();
                    string marchio = recItem["marchio"].ToString();
                    string categoria = recItem["categoria"].ToString();

                    if (note.ToLower()=="no vol")
                    {
                        continue; //skip articoli che non sono volantino
                    }


                    if (codice_gruppo.Contains(",") && recItem.ContainsKey(GLOBAL_VARIABLES.keyXMLDescrizioneGruppo))
                    {
                        descr_1 = (recItem[GLOBAL_VARIABLES.keyXMLDescrizioneGruppo] as Dictionary<string, object>)[GLOBAL_VARIABLES.keyDescr1].ToString();
                        descr_brand = (recItem[GLOBAL_VARIABLES.keyXMLDescrizioneGruppo] as Dictionary<string, object>)[GLOBAL_VARIABLES.keyDescr2].ToString();
                        descr_tipo = (recItem[GLOBAL_VARIABLES.keyXMLDescrizioneGruppo] as Dictionary<string, object>)[GLOBAL_VARIABLES.keyDescr3].ToString();
                        descr_gramm = (recItem[GLOBAL_VARIABLES.keyXMLDescrizioneGruppo] as Dictionary<string, object>)[GLOBAL_VARIABLES.keyDescr4].ToString();
                    }
                    else
                    {
                        descr_1 = recItem[GLOBAL_VARIABLES.keyDescr1].ToString();
                        descr_brand = recItem[GLOBAL_VARIABLES.keyDescr2].ToString();
                        descr_tipo = recItem[GLOBAL_VARIABLES.keyDescr3].ToString();
                        descr_gramm = recItem[GLOBAL_VARIABLES.keyDescr4].ToString();
                    }



                    //if ()
                    string descr_gr_copy = descr_gramm;


                    //recItem[keyDescrizioniDescrizione4] = descrizioni_articolo[3];
                    //Meccanica mec2 = interpretaMeccanica(recItem, flag_meccanica_unita);
                    //string meccanica_tradotta = mec2.NomeTraduzione;

                    byte[] str_desc2_bytes = System.Text.Encoding.UTF8.GetBytes(descr_brand);
                    string _brand = System.Text.Encoding.UTF8.GetString(str_desc2_bytes);
                    byte[] str_desc3_bytes = System.Text.Encoding.UTF8.GetBytes(descr_tipo);
                    string _tipogusto = System.Text.Encoding.UTF8.GetString(str_desc3_bytes);
                    byte[] str_desc4_bytes = System.Text.Encoding.UTF8.GetBytes(descr_gr_copy);
                    string _gramm = System.Text.Encoding.UTF8.GetString(str_desc4_bytes);




                    int statoSelezione = 3;
                    if (recItem.ContainsKey(keyStatoSelezione))
                    {

                        statoSelezione = int.Parse(recItem[keyStatoSelezione].ToString());
                    }
                    else
                    {
                        //Console.WriteLine($"Attenzione {codice_referenza} non ha la SELEZIONE!");
                    }



                    //if (foto || esempio)// || req.confronta_liste)
                    if (statoSelezione == 1 || statoSelezione == 2)
                    {


                        if (counter == 0)
                        {


                        }


                        counter++;


                        var codiceBox = recItem[GLOBAL_VARIABLES_FICO.codiceBox].ToString();
                        string stile_prezzo_promo = "PREZZO_PROMO";

                        decimal prezzo_promo = MathExt.Round(recItem["prezzo_promo"].ToDecimal(), 2, MidpointRounding.AwayFromZero);
                        decimal prezzo_continuo = MathExt.Round(recItem["prezzo_continuo"].ToDecimal(), 2, MidpointRounding.AwayFromZero);
                        decimal prezzo_promo_kgl = MathExt.Round(recItem["prezzo_promo_kgl"].ToDecimal(), 2, MidpointRounding.AwayFromZero);
                        decimal sconto = 0;// MathExt.Round(recItem["txt_sconto"].ToDecimal(), 2, MidpointRounding.AwayFromZero);



                        tracciato[i].recordInTracciato[GLOBAL_VARIABLES_FICO.keyFicoNames] = exportNames;

                        #region compiledfield

                        //Assegno compiled field 




                        if (sconto > 0)
                        {
                            string sconto_str = $"-{(int)sconto}%";
                            interprete.assignCompiledField("txt_sconto", "SCONTO", sconto_str);
                        }
                        else
                        {
                            interprete.removeCompiledField("sconto_fumetto");
                        }



                        string specialDescr_max_pezzi_accodato_a_descrizione = "";
                        string specialDescr_superprezziOF = "";

                        string stileDescr1 = "DESCRIZIONE_TITOLO";
                        string stileDescr2 = "DESCRIZIONE_BRAND";
                        string stileDescr3 = "DESCRIZIONE_TIPO";
                        string stileDescr4 = "DESCRIZIONE_GRAMMATURA";

                        string stile_prezzo_kgl = "PREZZO_KGL";

                        string prezzo_promo_kgl_str = "";

                        if (codiceBox == "BOX_FID")
                        {

                            stile_prezzo_promo = "FID_PREZZO";
                            stile_prezzo_kgl = "FID_PREZZO_KGL";

                            if (peso == 1000 || peso == 1 || prezzo_promo_kgl == 0)
                            {
                                interprete.removeCompiledField("prezzo_promo_kgl");
                            }

                        }
                        else if (codiceBox == "BOX_MACE_BANCO")
                        {
                            stile_prezzo_promo = "PREZZO_PROMO_MACELLERIA";
                            stile_prezzo_kgl = "PREZZO_KGL_MACELLERIA";

                            interprete.assignCompiledField("prezzo_info_pack", "", "<PREZZO_KGLT MACELLERIA>AL KG</PREZZO_KGLT MACELLERIA>");

                        }
                        else if (codiceBox == "BOX_PESCHERIA")
                        {
                            stile_prezzo_promo = "PREZZO_PROMO_PESCHERIA";
                            stile_prezzo_kgl = "PREZZO_KGL_PESCHERIA";

                            /*
                             Se CONF= KG e UM= GR e PESO= 1000 e KGLT=(vuoto) allora in prezzo_promo_kgl ci deve venire scritto SOLO “AL KG”
                             */
                            if (confezione=="KG" && um=="GR" && peso==1000 && prezzo_promo_kgl==0)
                            {
                                prezzo_promo_kgl_str = "AL KG";
                            }
                        }
                        else if (codiceBox == "BOX_OF")
                        {
                            stileDescr1 += "_ORTOFRUTTA";
                            stileDescr2 += "_ORTOFRUTTA";
                            stileDescr3 += "_ORTOFRUTTA";
                            stileDescr4 += "_ORTOFRUTTA";

                            stile_prezzo_promo = "PREZZO_PROMO_ORTOFRUTTA";
                            stile_prezzo_kgl = "PREZZO_KGL_ORTOFRUTTA";

                            if (confezione == "KG" && um == "GR" && peso == 1000 && prezzo_promo_kgl == 0)
                            {
                                prezzo_promo_kgl_str = "AL KG";
                            }

                        }
                        else if (codiceBox == "BOX_OF_SUPER")
                        {
                            stileDescr1 += "_SUPER";
                            stileDescr2 += "_SUPER";
                            stileDescr3 += "_SUPER";
                            stileDescr4 += "_SUPER";

                            stile_prezzo_promo = "PREZZO_PROMO_ORTOFRUTTA_SUPER";
                            stile_prezzo_kgl = "PREZZO_KGL_ORTOFRUTTA_SUPER";
                        }
                        else if (codiceBox == "BOX_BOMBA")
                        {

                            stileDescr1 += "_BOMBA";
                            stileDescr2 += "_BOMBA";
                            stileDescr3 += "_BOMBA";
                            stileDescr4 += "_BOMBA";

                            stile_prezzo_promo = "PREZZO_PROMO_BOMBA";
                            stile_prezzo_kgl = "PREZZO_KGL_BOMBA";

                            if (peso == 1000 || peso == 1)
                            {
                                interprete.removeCompiledField("prezzo_promo_kgl");
                            }

                        }
                        else if (codiceBox== "BOX_GASTRO")
                        {
                            stile_prezzo_promo = "PREZZO_PROMO_GASTRO";
                            prezzo_promo = MathExt.Round(prezzo_promo / 10, 2, MidpointRounding.AwayFromZero);
                            stile_prezzo_kgl = "PREZZO_KGL_GASTRO";
                            interprete.assignCompiledField("prezzo_info_pack", "", "<ETTO_GASTRO>l'etto</ETTO_GASTRO>");
                        }
                        else
                        {
                            stile_prezzo_promo = "PREZZO_PROMO_STD";
                            if (peso == 1000 || peso == 1 || prezzo_promo_kgl==0)
                            {
                                interprete.removeCompiledField("prezzo_promo_kgl");
                            }
                        }


                        interprete.assignCompiledField("prezzo_promo", stile_prezzo_promo, $"€ {MathExt.DecimalRoundToString(prezzo_promo)}");

                        if (um != "" && codiceBox != "BOX_MACE_BANCO")
                        {
                            if (prezzo_promo_kgl_str == "")
                            {
                                prezzo_promo_kgl_str = $"<{stile_prezzo_kgl}>€ {MathExt.DecimalRoundToString(prezzo_promo_kgl)} {((um == "KG" || um == "GR") ? "AL KG" : "AL LT")}</{stile_prezzo_kgl}>";
                            }
                           
                            interprete.assignCompiledField("prezzo_promo_kgl", "", prezzo_promo_kgl_str);
                        }

                        //if (prezzo_continuo > 0)
                        //{
                        //    if (prezzo_continuo != prezzo_promo)
                        //    {

                        //        string prezzo_continuo_str = $"<prezzo continuo>invece di € {MathExt.DecimalRoundToString(prezzo_continuo)} {((um == "KG") ? "al kg" : "")}</prezzo continuo>";
                        //        if (prezzo_info_pack != "")
                        //        {
                        //            prezzo_continuo_str = $"<prezzo continuo>invece di € {MathExt.DecimalRoundToString(prezzo_continuo)} a conf</prezzo continuo>";
                        //        }
                        //        interprete.assignCompiledField("prezzo_continuo", "", prezzo_continuo_str);
                        //    }
                        //    else
                        //    {
                        //        interprete.removeCompiledField("prezzo_continuo");
                        //    }
                        //}

                        if (categoria.Contains("DETERSIVI - IGIENE"))
                        {
                            interprete.removeCompiledField("prezzo_promo_kgl");
                        }

                        #endregion





                        #region descrizione


                        var descrizione = "";

                        //ATTENZIONE
                        //posizionare la descirizione allineandola a prezzo offerta TOP o 
                        //SCONTO TOP se si tratta di meccanica percentuale o sir
                        var Descrizione1 = "";
                        var Descrizione2 = "";
                        var Descrizione3 = "";
                        var Descrizione4 = "";
                        var Peso = "";
                        var Um = "";
                        string stileParagDescr = "";


                        if (recItem.ContainsKey("descrizione_gruppo"))
                        {
                            Descrizione1 = (recItem["descrizione_gruppo"] as Dictionary<string, object>)["Descrizioni.Descrizione1"].ToString();
                            Descrizione2 = (recItem["descrizione_gruppo"] as Dictionary<string, object>)["Descrizioni.Descrizione2"].ToString();
                            Descrizione3 = (recItem["descrizione_gruppo"] as Dictionary<string, object>)["Descrizioni.Descrizione3"].ToString();
                            Descrizione4 = (recItem["descrizione_gruppo"] as Dictionary<string, object>)["Descrizioni.Descrizione4"].ToString();
                            Peso = recItem["Descrizioni.Peso"].ToString();
                            Um = recItem["Descrizioni.Um"].ToString();
                        }
                        else
                        {
                            Descrizione1 = recItem["Descrizioni.Descrizione1"].ToString();
                            Descrizione2 = recItem["Descrizioni.Descrizione2"].ToString();
                            Descrizione3 = recItem["Descrizioni.Descrizione3"].ToString();
                            Descrizione4 = recItem["Descrizioni.Descrizione4"].ToString();
                            Peso = recItem["Descrizioni.Peso"].ToString();
                            Um = recItem["Descrizioni.Um"].ToString();
                        }


                      
                        Descrizione1 = Descrizione1.Replace("<br>", "\n");                       
                        Descrizione2 = Descrizione2.Replace("<br>", "\n");
                        Descrizione3 = Descrizione3.Replace("<br>", "\n");
                        Descrizione4 = Descrizione4.Replace("<br>", "\n");
                        

                        descrizione = $"<{stileDescr1}>{Descrizione1}";
                        if (Descrizione1 != "" && (Descrizione2 != "" || Descrizione3 != "" || Descrizione4!=""))
                            descrizione += " ";
                        descrizione+= $"</{stileDescr1}>";

                        descrizione += $"<{stileDescr2}>{Descrizione2}";
                        if (Descrizione2!="" && (Descrizione3!="" || Descrizione4 != ""))
                            descrizione += " ";
                        descrizione += $"</{stileDescr2}>";

                        descrizione += $"<{stileDescr3}>{Descrizione3}</{stileDescr3}>";

                        descrizione += $"<{stileDescr4}>";
                        if (Descrizione4!="")
                            descrizione +=$"\n{Descrizione4}";
                        descrizione += $"</{stileDescr4}>";



                        if (specialDescr_max_pezzi_accodato_a_descrizione != "")
                        {
                            descrizione += specialDescr_max_pezzi_accodato_a_descrizione;
                        }
                        if (specialDescr_superprezziOF != "")
                        {
                            descrizione += specialDescr_superprezziOF;
                        }


                        interprete.assignCompiledField("descrizione", stileParagDescr, descrizione);


                        #endregion descrizione

                        //Gestione dei loghi e bolli EXTRA - Messi in automatico secondo regole di agenzia

                        List<LogoBollo> _bolliloghi = new List<LogoBollo>();



                        if (Descrizione1.ToLower().Contains("abbinamento perfetto") || Descrizione3.ToLower().Contains("abbinamento perfetto"))
                        {
                            LogoBollo lAbbPerf = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Logo_abbinamento_perfetto");
                            if (lAbbPerf != null)
                            {
                                _bolliloghi.Add(lAbbPerf);
                            }
                        }

                        if (Descrizione1.ToLower().Contains("scelta verde") || Descrizione3.ToLower().Contains("scelta verde"))
                        {
                            LogoBollo lScVer = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Logo_SceltaVerde");
                            if (lScVer != null)
                            {
                                _bolliloghi.Add(lScVer);
                            }
                        }

                        if (Descrizione1.ToLower().Contains("parmigiano reggiano") || Descrizione2.ToLower().Contains("parmigiano reggiano"))
                        {
                            LogoBollo lPReg = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Logo_Parmigiano_Reggiano");
                            if (lPReg != null)
                            {
                                _bolliloghi.Add(lPReg);
                            }
                        }

                        if (Descrizione1.ToLower().Contains("oltre 20 mesi") || Descrizione3.ToLower().Contains("oltre 20 mesi"))
                        {
                            LogoBollo lOl20 = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Logo_Riserva_Oltre20Mesi");
                            if (lOl20 != null)
                            {
                                _bolliloghi.Add(lOl20);
                            }
                        }

                        if (Descrizione1.ToLower().Contains("grana padano") || Descrizione2.ToLower().Contains("grana padano"))
                        {
                            LogoBollo lGP = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Logo_Grana_Padano");
                            if (lGP != null)
                            {
                                _bolliloghi.Add(lGP);
                            }
                        }


                        if (Descrizione1.ToLower().Contains("passo dopo passo") || Descrizione2.ToLower().Contains("passo dopo passo") || Descrizione3.ToLower().Contains("passo dopo passo"))
                        {
                            LogoBollo lPdP = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Logo_PassoDopoPasso");
                            if (lPdP != null)
                            {
                                _bolliloghi.Add(lPdP);
                            }
                        }

                        if (Descrizione2.ToLower()=="despar")
                        {
                            LogoBollo lDesp = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Logo_ScegliDespar");
                            if (lDesp != null)
                            {
                                _bolliloghi.Add(lDesp);
                            }
                        }

                        if (Descrizione2.ToLower().Contains("molly"))
                        {
                            LogoBollo lMolly = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Logo_Molly");
                            if (lMolly != null)
                            {
                                _bolliloghi.Add(lMolly);
                            }
                        }

                        if (marchio.Contains("ITA"))
                        {                                                   
                            LogoBollo lIta = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Logo_BandieraItalia");
                            if (lIta != null)
                            {
                                _bolliloghi.Add(lIta);
                            }
                        }

                        if (Descrizione2.Contains("Melinda"))
                        {
                            LogoBollo lMel = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Logo_Melinda");
                            if (lMel != null)
                            {
                                _bolliloghi.Add(lMel);
                            }
                           
                        }

                        recItem[GLOBAL_VARIABLES.keyFotoExtraAuto] = _bolliloghi;


                        var fields = interprete.getFields();
                        recItem["compiledFields"] = fields.compiledFields;
                        recItem["deletedFields"] = fields.deletedFields;
                        interprete.clearInterpreter();

                    }
                    else
                    {
                        //recItem["NoXml"] = true;

                    }





                    result.liste[0].Records.Add(tracciato[i]);



                }


                if (counter <= 0)
                {
                    result.errors += "Nessun articolo della lista corrisponde ai requisiti di esportazione. Controllare la lista e ripetere l'importazione";
                }


            }
            catch (Exception ex)
            {
                result.errors = ex.ToString();
            }

            //impResult.liste = result;
            //impResult.errors = errors;

            return result;
        }        

        private static List<Dictionary<string, object>> _db;


        private List<Tag> getDescrizioneHtmlTags(string descr)
        {
            List<Tag> result = new List<Tag>();

            var parsing = descr;
            var next_tag = getNextTag(parsing);
            var n_iter = 0;
            try
            {


                while (next_tag != null && parsing != "")
                {
                    //alert("while " + parsing);

                    var da = next_tag.inx_start + next_tag.tag_apertura.Length;
                    var a = parsing.IndexOf(next_tag.tag_chiusura);
                    var end = a + next_tag.tag_chiusura.Length;

                    //alert(da + " -> " + (a-da));
                    var content = parsing.Substring(da, a - da);
                    //alert(content);

                    next_tag.content = content;
                    result.Add(next_tag);

                    //alert("riparto da " + end + " dopo chiusura " + next_tag.tag_chiusura);
                    parsing = parsing.Substring(end);

                    next_tag = getNextTag(parsing);
                    n_iter++;
                    if (n_iter > 500)
                        break;
                }

            }
            catch (Exception ex)
            {
                ex.ToString();
                //alert(err);
            }

            //alert(result);
            return result;
        }

        static string DESCRIZIONE_TITOLO = "<DESCRIZIONE TITOLO>";
        static string DESCRIZIONE_TITOLO_end = "</DESCRIZIONE TITOLO>";
        static string DESCRIZIONE_GRAMMATURA = "<DESCRIZIONE GRAMMATURA>";
        static string DESCRIZIONE_GRAMMATURA_end = "</DESCRIZIONE GRAMMATURA>";
        static string DESCRIZIONE_TIPO = "<DESCRIZIONE TIPO>";
        static string DESCRIZIONE_TIPO_end = "</DESCRIZIONE TIPO>";
        static string DESCRIZIONE_CARTA = "<DESCRIZIONE CARTA>";
        static string DESCRIZIONE_CARTA_end = "</DESCRIZIONE CARTA>";
        static string DESCRIZIONE_11 = "<DESCRIZIONE 1+1>";
        static string DESCRIZIONE_11_end = "</DESCRIZIONE 1+1>";
        static string ESEMPIO = "<ESEMPIO>";
        static string ESEMPIO_end = "</ESEMPIO>";
        static string DESCRIZIONE_ESEMPIO = "<DESCRIZIONE ESEMPIO>";
        static string DESCRIZIONE_ESEMPIO_end = "</DESCRIZIONE ESEMPIO>";
        static string PEZZI_DISPONIBILI = "<PEZZI DISPONIBILI>";
        static string PEZZI_DISPONIBILI_end = "</PEZZI DISPONIBILI>";
        static string DESCRIZIONE_LINEA = "<DESCRIZIONE LINEA 2018>";
        static string DESCRIZIONE_LINEA_end = "</DESCRIZIONE LINEA 2018>";
        static string DESCRIZIONE_LINEASCONTO = "<NUMERO SCONTO LINEA 2018>";
        static string DESCRIZIONE_LINEASCONTO_end = "</NUMERO SCONTO LINEA 2018>";
        static string DESCRIZIONE_LINEAPREZZI = "<DESCRIZIONE SOCI 2018>";
        static string DESCRIZIONE_LINEAPREZZI_end = "</DESCRIZIONE SOCI 2018>";

        private Tag getNextTag(string descr)
        {
            Tag next_tag = new Tag();

            var inx_descr = descr.IndexOf(DESCRIZIONE_TITOLO);
            var inx_gramm = descr.IndexOf(DESCRIZIONE_GRAMMATURA);
            var inx_tipo = descr.IndexOf(DESCRIZIONE_TIPO);
            var inx_carta = descr.IndexOf(DESCRIZIONE_CARTA);
            var inx_esempio = descr.IndexOf(ESEMPIO);
            var inx_descr_esempio = descr.IndexOf(DESCRIZIONE_ESEMPIO);
            var inx_pezzi_disp = descr.IndexOf(PEZZI_DISPONIBILI);
            var inx_11 = descr.IndexOf(DESCRIZIONE_11);
            var inx_linea = descr.IndexOf(DESCRIZIONE_LINEA);
            var inx_lineasconto = descr.IndexOf(DESCRIZIONE_LINEASCONTO);
            var inx_lineaprezzi = descr.IndexOf(DESCRIZIONE_LINEAPREZZI);



            //alert(inx_descr + "," + inx_gramm + "," + inx_tipo + "," + inx_carta + "," + inx_esempio + "," + inx_descr_esempio);

            var inx_leader = 99999999;
            if (inx_descr >= 0)
                inx_leader = inx_descr;

            next_tag.tag_apertura = DESCRIZIONE_TITOLO;
            next_tag.tag_chiusura = DESCRIZIONE_TITOLO_end;
            next_tag.stile = "DESCRIZIONE TITOLO";
            if (inx_gramm >= 0 && inx_gramm < inx_leader)
            {
                inx_leader = inx_gramm;
                next_tag.tag_apertura = DESCRIZIONE_GRAMMATURA;
                next_tag.tag_chiusura = DESCRIZIONE_GRAMMATURA_end;
                next_tag.stile = "DESCRIZIONE GRAMMATURA";
            }
            if (inx_tipo >= 0 && inx_tipo < inx_leader)
            {
                inx_leader = inx_tipo;
                next_tag.tag_apertura = DESCRIZIONE_TIPO;
                next_tag.tag_chiusura = DESCRIZIONE_TIPO_end;
                next_tag.stile = "DESCRIZIONE TIPO";
            }
            if (inx_carta >= 0 && inx_carta < inx_leader)
            {
                inx_leader = inx_carta;
                next_tag.tag_apertura = DESCRIZIONE_CARTA;
                next_tag.tag_chiusura = DESCRIZIONE_CARTA_end;
                next_tag.stile = "DESCRIZIONE CARTA";
            }
            if (inx_esempio >= 0 && inx_esempio < inx_leader)
            {
                inx_leader = inx_esempio;
                next_tag.tag_apertura = ESEMPIO;
                next_tag.tag_chiusura = ESEMPIO_end;
                next_tag.stile = "ESEMPIO";
            }
            if (inx_descr_esempio >= 0 && inx_descr_esempio < inx_leader)
            {
                inx_leader = inx_descr_esempio;
                next_tag.tag_apertura = DESCRIZIONE_ESEMPIO;
                next_tag.tag_chiusura = DESCRIZIONE_ESEMPIO_end;
                next_tag.stile = "DESCRIZIONE ESEMPIO";
            }

            if (inx_pezzi_disp >= 0 && inx_pezzi_disp < inx_leader)
            {
                inx_leader = inx_pezzi_disp;
                next_tag.tag_apertura = PEZZI_DISPONIBILI;
                next_tag.tag_chiusura = PEZZI_DISPONIBILI_end;
                next_tag.stile = "PEZZI DISPONIBILI";
            }

            if (inx_11 >= 0 && inx_11 < inx_leader)
            {
                inx_leader = inx_11;
                next_tag.tag_apertura = DESCRIZIONE_11;
                next_tag.tag_chiusura = DESCRIZIONE_11_end;
                next_tag.stile = "DESCRIZIONE 1+1";
            }

            if (inx_linea >= 0 && inx_linea < inx_leader)
            {
                inx_leader = inx_linea;
                next_tag.tag_apertura = DESCRIZIONE_LINEA;
                next_tag.tag_chiusura = DESCRIZIONE_LINEA_end;
                next_tag.stile = "DESCRIZIONE LINEA 2018";
            }

            if (inx_lineasconto >= 0 && inx_lineasconto < inx_leader)
            {
                inx_leader = inx_lineasconto;
                next_tag.tag_apertura = DESCRIZIONE_LINEASCONTO;
                next_tag.tag_chiusura = DESCRIZIONE_LINEASCONTO_end;
                next_tag.stile = "DESCRIZIONE SCONTO LINEA 2018";
            }

            if (inx_lineaprezzi >= 0 && inx_lineaprezzi < inx_leader)
            {
                inx_leader = inx_lineaprezzi;
                next_tag.tag_apertura = DESCRIZIONE_LINEAPREZZI;
                next_tag.tag_chiusura = DESCRIZIONE_LINEAPREZZI_end;
                next_tag.stile = "DESCRIZIONE SOCI 2018";
            }

            next_tag.inx_start = inx_leader;

            if (next_tag.inx_start >= 0)
                return next_tag;

            return null;
        }

        public string getAlterazioniTracciatoFromIndd(List<Dictionary<string, object>> gruppo, Dictionary<string, object> articoloIndd)
        {
            RisultatoAlterazioniTracciatoFromIndd result = new RisultatoAlterazioniTracciatoFromIndd();

            try
            {


                string descrizione = articoloIndd["descrizione_html"].ToString();
                string mastro = articoloIndd["reparto_codificato"].ToString();//Sapere in che zona del volantino si trova è una info utile per le mastro POP

                List<Tag> descrTags = getDescrizioneHtmlTags(descrizione);

                string prezzo_promo = "";
                if (articoloIndd.ContainsKey("prezzo_promo"))
                    articoloIndd["prezzo_promo"].ToString();

                string prezzo_promo_kgl = "";
                if (articoloIndd.ContainsKey("prezzo_promo_kgl"))
                    prezzo_promo_kgl = articoloIndd["prezzo_promo_kgl"].ToString();

                string prima_di_prezzo = "";
                if (articoloIndd.ContainsKey("prima_di_prezzo2"))
                    prima_di_prezzo = articoloIndd["prima_di_prezzo2"].ToString();

                bool isLinea = descrTags.Where(t => t.tag_apertura == DESCRIZIONE_LINEA).Count() > 0;



                if (gruppo.Count > 1)
                {
                    List<double> _sconto_gruppo = gruppo.Where(g => g.ContainsKey("sconto")).Select(s => (double)s["sconto"]).ToList();
                    //Da capire come gestire i prezzi ORO

                    bool sconti_diversi = (_sconto_gruppo.Distinct().Count() > 1 || _sconto_gruppo.Distinct().Count() > 1);

                    //Per Trea, tutto ciò che è rappresentato come gruppo, nel POP mi esce con descrizione di gruppo moltiplicata gli elmenti del gruppo
                    foreach (Dictionary<string, object> _ref in gruppo)
                    {
                        AlterazioniRecFromIndd altRec = new AlterazioniRecFromIndd();
                        altRec.codice = _ref[GLOBAL_VARIABLES.keyRefCodice].ToString();
                        altRec.codiceGruppo = _ref[GLOBAL_VARIABLES.keyScattoCodiceGruppo].ToString();
                        altRec.requisiti = new Dictionary<string, object>();
                        altRec.requisiti["descrizione"] = descrizione;
                        //altRec.requisiti["mastro"] = mastro;
                        altRec.requisiti[GLOBAL_VARIABLES.keyRequisitoDescrizioneSingola] = false;
                        altRec.requisiti[GLOBAL_VARIABLES.keyRequisitoScontiDiversi] = sconti_diversi;
                        altRec.IdRec = (Int64)_ref["IdRec"];

                        altRec.indd = articoloIndd;

                        if (altRec.requisiti.ContainsKey(GLOBAL_VARIABLES.keyScattoCodiceSottogruppo))
                            altRec.requisiti.Remove(GLOBAL_VARIABLES.keyScattoCodiceSottogruppo);

                        //Commentato il controllo su sconti e prezzi di partenza diversi
                        //Dal 26/01/2024 i gruppi nel POP usciranno tutti uguali ereditando dalla prima ref del gruppo

						//if (!sconti_diversi)
						//{
						//    //Per impostare il codice sottogruppo, è necessario prima capire se questo elemento fa parte di un MULTIPLEX,
						//    //In tal caso il sottogruppo eredita da MULTIPLEX e non dal deprecato Codice Gruppo di partenza
						//    if (_ref[GLOBAL_VARIABLES.keyScattoCodiceGruppo].ToString().IndexOf("612358,612366") >= 0)
						//    {
						//        "debug".ToString();
						//    }

						//    if (_ref.ContainsKey(GLOBAL_VARIABLES.keyScattoCodiceMultiplex) &&
						//        _ref[GLOBAL_VARIABLES.keyScattoCodiceMultiplex].ToString() != ""
						//        )
						//    {
						//        altRec.requisiti[GLOBAL_VARIABLES.keyScattoCodiceSottogruppo] = _ref[GLOBAL_VARIABLES.keyScattoCodiceMultiplex].ToString();
						//    }
						//    else
						//    {
						//        altRec.requisiti[GLOBAL_VARIABLES.keyScattoCodiceSottogruppo] = _ref[GLOBAL_VARIABLES.keyScattoCodiceGruppo].ToString();
						//    }
						//}

						if (_ref.ContainsKey(GLOBAL_VARIABLES.keyScattoCodiceMultiplex) &&
	                    _ref[GLOBAL_VARIABLES.keyScattoCodiceMultiplex].ToString() != ""
	                    )
						{
							altRec.requisiti[GLOBAL_VARIABLES.keyScattoCodiceSottogruppo] = _ref[GLOBAL_VARIABLES.keyScattoCodiceMultiplex].ToString();
						}
						else
						{
							altRec.requisiti[GLOBAL_VARIABLES.keyScattoCodiceSottogruppo] = _ref[GLOBAL_VARIABLES.keyScattoCodiceGruppo].ToString();
						}

						result.alterazioniInIndd.Add(altRec);
                    }

                       

                }
                else
                {
                    //Ref singola
                    AlterazioniRecFromIndd altRec = new AlterazioniRecFromIndd();
                    altRec.codice = gruppo[0][GLOBAL_VARIABLES.keyRefCodice].ToString();
                    altRec.codiceGruppo = gruppo[0][GLOBAL_VARIABLES.keyScattoCodiceGruppo].ToString();
                    altRec.requisiti = new Dictionary<string, object>();
                    altRec.requisiti["descrizione"] = descrizione;//Prendo in automatico la descrizione da volantino che è di sicuro l'ultima revisionata
                    //altRec.requisiti["mastro"] = mastro;
                    altRec.requisiti[GLOBAL_VARIABLES.keyRequisitoDescrizioneSingola] = true;
                    altRec.IdRec = (Int64)gruppo[0]["IdRec"];

                    altRec.indd = articoloIndd;

                    if (altRec.requisiti.ContainsKey(GLOBAL_VARIABLES.keyScattoCodiceSottogruppo))
                        altRec.requisiti.Remove(GLOBAL_VARIABLES.keyScattoCodiceSottogruppo);

                    result.alterazioniInIndd.Add(altRec);
                }
            }
            catch { }

            return JsonConvert.SerializeObject(result);
        }

        public string eseguiAutoSelezioneGruppo(List<Dictionary<string, object>> gruppo, List<Dictionary<string, object>> ghost)
        {
            string keyXMLSelezione = GLOBAL_VARIABLES.keyXMLSelezione;
            string keyHasFoto = GLOBAL_VARIABLES.keyHasFoto;
            bool primariaTrovata = false;
            int secondarieSelezionate = 0;

            var primarioPrimaDiElaborare = gruppo.FirstOrDefault(c => (Byte)c[keyXMLSelezione] == (Byte)TipoSelezioneMenabo.Primaria);
            int countSecondarie = gruppo.Count(c => (Byte)c[keyXMLSelezione] == (Byte)TipoSelezioneMenabo.Secondaria);

            if (gruppo.Count(g => g[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString()== "2142651") >0)
            {
                "debug".ToString();
            }

            foreach (var item in gruppo)
            {
                string valHasFoto = item[keyHasFoto].ToString();
                Boolean.TryParse(valHasFoto, out bool hasFoto);
                if (item.ContainsKey(keyHasFoto) && hasFoto)
                {
                    if (!primariaTrovata)
                    {
                        item[keyXMLSelezione] = (Byte)TipoSelezioneMenabo.Primaria;
                        primariaTrovata = true;
                    }
                    else if (secondarieSelezionate < 3)
                    {
                        item[keyXMLSelezione] = (Byte)TipoSelezioneMenabo.Secondaria;
                        secondarieSelezionate++;
                    }
                }
                else
                {
                    item[keyXMLSelezione] = (Byte)TipoSelezioneMenabo.None;
                }
            }

            if (!primariaTrovata)
            {
                //Rimetto la primaria quella di origien dato che non è stata trovata con logica di agenzia
                primarioPrimaDiElaborare[keyXMLSelezione] = (Byte)TipoSelezioneMenabo.Primaria;
            }

            if (secondarieSelezionate==0 && gruppo.Count > 1)
            {
                //Assegno cmq almeno una secodnaria in un gruppo
                Dictionary<string, object> secondariaPotenziale = gruppo.FirstOrDefault(c => (Byte)c[keyXMLSelezione] != (Byte)TipoSelezioneMenabo.Primaria && (bool)c[keyHasFoto]);
                if (secondariaPotenziale != null)
                {
                    secondariaPotenziale[keyXMLSelezione] = (Byte)TipoSelezioneMenabo.Secondaria;
                    secondarieSelezionate++;
                }
            }

            return JsonConvert.SerializeObject(gruppo);
            
        }


        public AnalisiConfrontoResponse confrontaListe(AnalisiConfrontoTracciatoDetails primario, AnalisiConfrontoTracciatoDetails secondario, bool controlloVersione, Dictionary<string, string> reqParams)
        {

            throw new NotImplementedException();
        }

        public string confrontaListeLocandina(List<Dictionary<string, object>> elementsList, Dictionary<string, string> reqParams)
        {
            csvDataset csvResultData = new csvDataset();

            List<Dictionary<string, string>> csvResult = new List<Dictionary<string, string>>();

            //mi ricavo i tracciati
            Dictionary<string,string> Tracciati = new Dictionary<string, string>();
            foreach (var item in elementsList)
            {
                if (item.ContainsKey("id_tracciato"))
                {
                    string idTracciato = item["id_tracciato"].ToString();
                    if (/*reqParams.ContainsKey(idTracciato) && */!Tracciati.ContainsKey(idTracciato))
                    {
                        Tracciati[idTracciato] = item["nome_tracciato"].ToString(); /*reqParams[idTracciato];*/
                    }
                }
            }

            //creo la riga di testata con i campi codice, descrizione, l1, a4, manifesto
            Dictionary<string, string> csvRecEmpty = new Dictionary<string, string>();
            csvRecEmpty["Codice"] = "-";
            csvRecEmpty["Descrizione"] = "";
            csvRecEmpty["|"] = "";
            foreach (var item in Tracciati)
            {
                csvRecEmpty["L1_"+item.Value] = "";
            }
            csvRecEmpty["||"] = "";
            foreach (var item in Tracciati)
            {
                csvRecEmpty["A4_" + item.Value] = "";
            }
            //csvRecEmpty["|||"] = "";
            //foreach (var item in Tracciati)
            //{
            //    csvRecEmpty["Manifesto_" + item.Value] = "";
            //}

            List<string> colonneValori = new List<string>();
            foreach (var item in csvRecEmpty)
            {
                colonneValori.Add(item.Key);
            }
            csvResultData.header.AddRange(colonneValori);
            csvResultData.headerField.AddRange(colonneValori);

            bool almenoUno = false;
            List<string> codiciEsaminati = new List<string>();
            foreach (var elemento in elementsList)
            {
                if (elemento["Referenza.Codice"].ToString() == "859827")
                {
                    Debug.WriteLine("");
                }
                if (codiciEsaminati.Contains(elemento["Referenza.Codice"].ToString()))
                {
                    continue;
                }
                else
                {
                    codiciEsaminati.Add(elemento["Referenza.Codice"].ToString());
                }
                Dictionary<string, string> csvRec = new Dictionary<string, string>();
                List<Dictionary<string, object>> elementsWithSameCode = new List<Dictionary<string, object>>();
                elementsWithSameCode.AddRange(elementsList.Where(f => f["Referenza.Codice"].ToString() == elemento["Referenza.Codice"].ToString()));
                csvRec["Codice"] = elemento["Referenza.Codice"].ToString();
                csvRec["Descrizione"] = elemento["Descrizioni.Descrizione1"].ToString();
                csvRec["|"] = "";
                almenoUno = false;
                foreach (var singoloElementoConStessoCodice in elementsWithSameCode)
                {
                    foreach (var item in Tracciati)
                    {
                        if (singoloElementoConStessoCodice.ContainsKey("l1") && singoloElementoConStessoCodice["id_tracciato"].ToString() == item.Key)
                        {
                            csvRec["L1_" + item.Value] = (singoloElementoConStessoCodice["l1"].ToString() != "0" ? "X" : "");
                            almenoUno = (singoloElementoConStessoCodice["l1"].ToString() != "0" ? true : almenoUno);
                        }
                        else if (!singoloElementoConStessoCodice.ContainsKey("l1") && singoloElementoConStessoCodice["id_tracciato"].ToString() == item.Key)
                        {
                            csvRec["L1_" + item.Value] = "L1 non trovato";
                        }
                    }
                }
                csvRec["||"] = "";
                foreach (var singoloElementoConStessoCodice in elementsWithSameCode)
                {
                    foreach (var item in Tracciati)
                    {
                        if (singoloElementoConStessoCodice.ContainsKey("a4") && singoloElementoConStessoCodice["id_tracciato"].ToString() == item.Key)
                        {
                            csvRec["A4_" + item.Value] = (singoloElementoConStessoCodice["a4"].ToString() != "0" ? "X" : "");
                            almenoUno = (singoloElementoConStessoCodice["a4"].ToString() != "0" ? true : almenoUno);
                        }
                        else if (!singoloElementoConStessoCodice.ContainsKey("a4") && singoloElementoConStessoCodice["id_tracciato"].ToString() == item.Key)
                        {
                            csvRec["A4_" + item.Value] = "A4 non trovato";
                        }
                    }
                }
                //    csvRec["|||"] = "";
                //foreach (var singoloElementoConStessoCodice in elementsWithSameCode)
                //{
                //    foreach (var item in Tracciati)
                //    {
                //        if (singoloElementoConStessoCodice.ContainsKey("manifesto") && singoloElementoConStessoCodice["id_tracciato"].ToString() == item.Key)
                //        {
                //            csvRec["Manifesto_" + item.Value] = (singoloElementoConStessoCodice["manifesto"].ToString() != "0" ? "X" : "");
                //            almenoUno = (singoloElementoConStessoCodice["l1"].ToString() != "0" ? true : almenoUno);
                //        }
                //        else if (!singoloElementoConStessoCodice.ContainsKey("manifesto") && singoloElementoConStessoCodice["id_tracciato"].ToString() == item.Key)
                //        {
                //            csvRec["Manifesto_" + item.Value] = "";
                //        }
                //    }
                //}
                if (almenoUno)
                {
                    csvResultData.records.Add(csvRec);
                    csvResultData.records.Add(csvRecEmpty);
                }
            }               
            if(csvResultData.records.Count == 0)
            {
                csvRecEmpty["Codice"] = "Nessun elemento trovato";
                csvRecEmpty["Descrizione"] = "";
                csvRecEmpty["|"] = "";
                foreach (var item in Tracciati)
                {
                    csvRecEmpty["L1_" + item.Value] = "";
                }
                csvRecEmpty["||"] = "";
                foreach (var item in Tracciati)
                {
                    csvRecEmpty["A4_" + item.Value] = "";
                }
                //csvRecEmpty["|||"] = "";
                //foreach (var item in Tracciati)
                //{
                //    csvRecEmpty["Manifesto_" + item.Value] = "";
                //}
                csvResultData.records.Add(csvRecEmpty);
            }
            string jsonResult = JsonConvert.SerializeObject(csvResultData);
            return jsonResult;
        }
        public class RegoleMeccanica
        {
            public List<string> Value = new List<string>();
            public string campo;
            public string Operatore;
        }

        public class DbMeccaniche
        {
            public List<Meccaniche> source;
        }

        public class Meccaniche
        {
            public Int64 Id;
            public string NomeOrigine;
            public string NomeTraduzione;
            public string Formato;
            public List<string> Aree = new List<string>();
            public string Etichetta;
            public List<RegoleMeccanica> Regole = new List<RegoleMeccanica>();
        }

        public string AutoImpaginazioneMeccanicaByRef(List<Dictionary<string, object>> gruppo, Dictionary<string, object> mastro, Dictionary<string, object> meccaniche)
        {
            try
            {
                //JArray jassociazioni = JsonConvert.DeserializeObject<JArray>(JsonConvert.SerializeObject(mastro["Associazioni"]));
                JArray jassociazioni = JArray.Parse(mastro["Associazioni"].ToString());
                //var associazioni = jassociazioni.ToObject<List<Dictionary<string, object>>>();
                var associazioni = jassociazioni.ToObject<List<string>>();


                JArray jMeccaniche = JArray.Parse(meccaniche["source"].ToString());
                var meccanicheList = jMeccaniche.ToObject<List<Meccaniche>>();

                string meccanicaRequired = "0";

                var singolo = gruppo[0];
                //var recordInTracciato = singolo["Meta"].ToObject<List<Dictionary<string, object>>>();

                Dictionary<string, object> recordInTracciato = new Dictionary<string, object>();
                if (singolo.TryGetValue("Dato", out object metaObject) && metaObject is string metaString)
                {
                    recordInTracciato = JsonConvert.DeserializeObject<Dictionary<string, object>>(metaString);
                }
                else
                {
                    throw new Exception("Campo 'Dato' non trovato");
                }
                string nota = recordInTracciato["note"].ToString().ToLower();

                if (associazioni != null && associazioni.Count > 0 && nota != "")
                {

                    foreach (var mecc in associazioni)
                    {
                        bool meccanicaValida = true;
                        if (meccanicaRequired == "0")
                        {
                            var meccanicaSourceCorrispondente = meccanicheList.Find(f => f.NomeTraduzione.ToLower() == mecc.ToLower());
                            if (meccanicaSourceCorrispondente == null)
                            {
                                continue;
                            }
                            foreach (var regola in meccanicaSourceCorrispondente.Regole)
                            {
                                if (meccanicaRequired == "0")
                                {
                                    foreach (var notaConfronto in regola.Value)
                                    {
                                        if (regola.Operatore == "IN" && !nota.Contains(notaConfronto.ToLower()) && meccanicaRequired == "0")
                                        {
                                            meccanicaValida = false;
                                        }
                                        else if (regola.Operatore == "!IN" && nota.Contains(notaConfronto.ToLower()) && meccanicaRequired == "0")
                                        {
                                            meccanicaValida = false;
                                        }
                                        else if (regola.Operatore == "==" && nota != notaConfronto.ToLower() && meccanicaRequired == "0")
                                        {
                                            meccanicaValida = false;
                                        }
                                        else if (regola.Operatore == "!=" && nota == notaConfronto.ToLower() && meccanicaRequired == "0")
                                        {
                                            meccanicaValida = false;
                                        }
                                    }
                                    if (meccanicaValida)
                                    {
                                        meccanicaRequired = mecc;
                                    }
                                }
                            }
                        }
                    }

                    if (meccanicaRequired != "0")
                    {
                        return meccanicaRequired;
                    }
                }

                if (mastro["MeccanicaDefault"].ToString() == null || mastro["MeccanicaDefault"].ToString() == "")
                {
                    return meccanicaRequired;
                }
                else
                {
                    return mastro["MeccanicaDefault"].ToString();
                }
            }
            catch(Exception ex)
            {
                return "0";
            }
        }

        public string confrontaListatoVolantino(List<Dictionary<string, object>> primario, Dictionary<string, string> reqParams)
        {
            string keySyncFromIndd = GLOBAL_VARIABLES.keySyncFromIndd;
            string keyRefCodice = GLOBAL_VARIABLES.keyRefCodice;
            string keyDescr = GLOBAL_VARIABLES.keyDescr1;

            csvDataset csvResultData = new csvDataset();
            Dictionary<string, string> csvRecEmpty = new Dictionary<string, string>();
            csvRecEmpty["Codice"] = "-";
            csvRecEmpty["Descrizione"] = "";
            csvRecEmpty["|"] = "";

            csvRecEmpty["Lista prezzo promo"] = "";
            csvRecEmpty["Lista prezzo kgl"] = "";

            csvRecEmpty["||"] = "";

            csvRecEmpty["Indd prezzo promo"] = "";
            csvRecEmpty["Indd prezzo kgl"] = "";

            csvRecEmpty["|||"] = "";

            csvRecEmpty["Categoria"] = "";
            csvRecEmpty["Error"] = "";
            //csvRecEmpty["|||"] = "";
            //foreach (var item in Tracciati)
            //{
            //    csvRecEmpty["Manifesto_" + item.Value] = "";
            //}

            List<string> colonneValori = new List<string>();
            foreach (var item in csvRecEmpty)
            {
                colonneValori.Add(item.Key);
            }
            csvResultData.header.AddRange(colonneValori);
            csvResultData.headerField.AddRange(colonneValori);

            List<string> codiciGruppiAnalizzati = new List<string>();
            bool elementoInserito = false;
            foreach (var elemento in primario)
            {
                if (elemento[keyRefCodice].ToString() == "338624" || elemento[keyRefCodice].ToString() == "395087" || elemento[keyRefCodice].ToString() == "395103" || elemento[keyRefCodice].ToString() == "395137" || elemento[keyRefCodice].ToString() == "714576" || elemento[keyRefCodice].ToString() == "747121" || elemento[keyRefCodice].ToString() == "809558" || elemento[keyRefCodice].ToString() == "853697" || elemento[keyRefCodice].ToString() == "853705")
                {
                    //Console.WriteLine("");
                }
                if (elementoInserito)
                {
                    elementoInserito = false;
                    csvResultData.records.Add(csvRecEmpty);
                }
                Dictionary<string, string> csvRec = new Dictionary<string, string>();
                // Verifica se il dizionario contiene la chiave "SyncFromIndd"
                if (elemento.ContainsKey(keySyncFromIndd))
                {
                    
                    if (elemento[keySyncFromIndd] is JObject)
                    {
                        var SyncInddJobj = elemento[keySyncFromIndd] as JObject;
                        var syncFromIndd = SyncInddJobj.ToObject<Dictionary<string, object>>();
                        if (syncFromIndd.ContainsKey("codiceGruppo"))
                        {
                            if (codiciGruppiAnalizzati.Contains(syncFromIndd["codiceGruppo"].ToString()))
                            {
                                continue;
                            }
                            else
                            {
                                codiciGruppiAnalizzati.Add(syncFromIndd["codiceGruppo"].ToString());
                            }
                        }
                        else
                        {
                            continue;
                        }
                        // Accedi al dizionario "SyncFromIndd" all'interno dell'elemento corrente
                        if (syncFromIndd.ContainsKey("indd") && syncFromIndd["indd"] is JObject)
                        {
                            var InddJobj = syncFromIndd["indd"] as JObject;
                            var indd = InddJobj.ToObject<Dictionary<string, object>>();

                            // Accedi alle sottochiavi necessarie e fai qualcosa con esse
                            if (indd.ContainsKey("codice_gruppo") && indd["codice_gruppo"].ToString().Contains(","))
                            {
                                List<string> elementiGruppo = indd["codice_gruppo"].ToString().Split(',').ToList();
                                List<Dictionary<string, object>> gruppo = new List<Dictionary<string, object>>();
                                gruppo = primario.Where(f => elementiGruppo.Contains(f[keyRefCodice].ToString())).ToList();

                                if (!indd.ContainsKey("prezzo_promo") || !elemento.ContainsKey("prezzo_promo"))
                                {
                                    try
                                    {
                                        csvRec["Codice"] = "Indd:" + indd["codice_gruppo"].ToString() + ", lista: " + elemento["codice"].ToString();
                                        csvRec["Descrizione"] = indd.ContainsKey("descrizione") ? indd["descrizione"].ToString() : "";
                                        csvRec["|"] = "";
                                        csvRec["Lista prezzo promo"] = "";
                                        csvRec["Lista prezzo kgl"] = "";

                                        csvRec["||"] = "";

                                        csvRec["Indd prezzo promo"] = "";
                                        csvRec["Indd prezzo kgl"] = "";

                                        csvRec["|||"] = "";

                                        csvRec["Categoria"] = "";
                                        csvRec["Error"] = "Prezzo promo assente";
                                        elementoInserito = true;
                                        csvResultData.records.Add(csvRec);
                                        continue;

                                    }
                                    catch(Exception ex) {
                                        try
                                        {
                                            csvRec["Codice"] = elemento.ContainsKey("codice") ? elemento["codice"].ToString() : "";
                                            csvRec["Descrizione"] = "";
                                            csvRec["|"] = "";
                                            csvRec["Lista prezzo promo"] = "";
                                            csvRec["Lista prezzo kgl"] = "";

                                            csvRec["||"] = "";

                                            csvRec["Indd prezzo promo"] = "";
                                            csvRec["Indd prezzo kgl"] = "";

                                            csvRec["|||"] = "";

                                            csvRec["Categoria"] = "";
                                            csvRec["Error"] = "Dati corrotti";
                                            elementoInserito = true;
                                            csvResultData.records.Add(csvRec);
                                            continue;
                                        }
                                        catch(Exception ex2)
                                        {
                                            csvRec["Codice"] = "";
                                            csvRec["Descrizione"] = "";
                                            csvRec["|"] = "";
                                            csvRec["Lista prezzo promo"] = "";
                                            csvRec["Lista prezzo kgl"] = "";

                                            csvRec["||"] = "";

                                            csvRec["Indd prezzo promo"] = "";
                                            csvRec["Indd prezzo kgl"] = "";

                                            csvRec["|||"] = "";

                                            csvRec["Categoria"] = "";
                                            csvRec["Error"] = "Dati corrotti";
                                            elementoInserito = true;
                                            csvResultData.records.Add(csvRec);
                                            continue;
                                        }
                                    }
                                }
                                else if (!indd.ContainsKey("prezzo_promo_kgl") || !elemento.ContainsKey("prezzo_kgl"))
                                {
                                    if (indd.ContainsKey("prezzo_promo"))
                                    {
                                        Regex regex = new Regex(@"€ (\d{1,3}(?:,\d{2})*(?:\.\d{2})?)");
                                        Match match = regex.Match(indd["prezzo_promo"].ToString());

                                        try
                                        {
                                            if (match.Success)
                                            {
                                                Double prezzoPromoEstratto = Convert.ToDouble(match.Groups[1].Value);
                                                if (Math.Round(Convert.ToDouble(elemento["prezzo_promo"]),2) != Math.Round(prezzoPromoEstratto, 2))
                                                {
                                                    csvRec["Codice"] = elemento[keyRefCodice].ToString();
                                                    csvRec["Descrizione"] = elemento[keyDescr].ToString();
                                                    csvRec["|"] = "";
                                                    csvRec["Lista prezzo promo"] = elemento["prezzo_promo"].ToString();
                                                    csvRec["Lista prezzo kgl"] = "Not found";

                                                    csvRec["||"] = "";

                                                    csvRec["Indd prezzo promo"] = indd["prezzo_promo"].ToString();
                                                    csvRec["Indd prezzo kgl"] = "Not found";

                                                    csvRec["|||"] = "";

                                                    csvRec["Categoria"] = elemento["categoria"].ToString();
                                                    csvRec["Error"] = "";
                                                    elementoInserito = true;
                                                    csvResultData.records.Add(csvRec);

                                                    continue;
                                                }
                                            }
                                            else
                                            {
                                                csvRec["Codice"] = elemento.ContainsKey(keyRefCodice) ? elemento[keyRefCodice].ToString() : "";
                                                csvRec["Descrizione"] = elemento.ContainsKey(keyDescr) ? elemento[keyDescr].ToString() : "";
                                                csvRec["|"] = "";
                                                csvRec["Lista prezzo promo"] = elemento.ContainsKey("prezzo_promo") ? elemento["prezzo_promo"].ToString() : "";
                                                csvRec["Lista prezzo kgl"] = elemento.ContainsKey("prezzo_kgl") ? elemento["prezzo_kgl"].ToString() : "Not found";

                                                csvRec["||"] = "";

                                                csvRec["Indd prezzo promo"] = indd.ContainsKey("prezzo_promo") ? indd["prezzo_promo"].ToString() : "";
                                                csvRec["Indd prezzo kgl"] = indd.ContainsKey("prezzo_promo_kgl") ? indd["prezzo_promo_kgl"].ToString() : "Not found";

                                                csvRec["|||"] = "";

                                                csvRec["Categoria"] = elemento["categoria"].ToString();
                                                csvRec["Error"] = "Impossibile leggere il prezzo promo";
                                                elementoInserito = true;
                                                csvResultData.records.Add(csvRec);

                                                continue;

                                            }
                                        }
                                        catch (Exception ex)
                                        {

                                            csvRec["Codice"] = (elemento.ContainsKey(keyRefCodice) ? elemento[keyRefCodice].ToString() : "");
                                            csvRec["Descrizione"] = (elemento.ContainsKey(keyDescr) ? elemento[keyDescr].ToString() : "");
                                            csvRec["|"] = "";
                                            csvRec["Lista prezzo promo"] = "";
                                            csvRec["Lista prezzo kgl"] = "Not found";

                                            csvRec["||"] = "";

                                            csvRec["Indd prezzo promo"] = "";
                                            csvRec["Indd prezzo kgl"] = "Not found";

                                            csvRec["|||"] = "";

                                            csvRec["Categoria"] = "";
                                            csvRec["Error"] = ex.Message;
                                            elementoInserito = true;
                                            csvResultData.records.Add(csvRec);

                                            continue;
                                        }
                                    }
                                }
                                else if (indd["prezzo_promo_kgl"].ToString().ToLower().Contains("da"))
                                {
                                    if (indd.ContainsKey("prezzo_promo_kgl"))
                                    {
                                        Regex regex = new Regex(@"Da € (\d{1,3}(?:,\d{2})*(?:\.\d{2})?) a € (\d{1,3}(?:,\d{3})*(?:\.\d{2})?) (?:al kg|al lt)");
                                        Match match = regex.Match(indd["prezzo_promo_kgl"].ToString());


                                        try
                                        {
                                            if (match.Success)
                                            {
                                                Double prezzoInizio = Convert.ToDouble(match.Groups[1].Value);
                                                Double prezzoFine = Convert.ToDouble(match.Groups[2].Value);
                                                string unitaMisura = match.Groups[3].Value;

                                                var prezzoInizioGruppo = Convert.ToDouble(gruppo.OrderBy(d => Convert.ToDouble(d["prezzo_kgl"])).First()["prezzo_kgl"]);
                                                var prezzoFineGruppo = Convert.ToDouble(gruppo.OrderBy(d => Convert.ToDouble(d["prezzo_kgl"])).Last()["prezzo_kgl"]);

                                                if (Math.Round(prezzoInizio,2) != Math.Round(prezzoInizioGruppo,2) || Math.Round(prezzoFine,2) != Math.Round(prezzoFineGruppo,2))
                                                {
                                                    csvRec["Codice"] = indd.ContainsKey("codice_gruppo") ? indd["codice_gruppo"].ToString() : "";
                                                    csvRec["Descrizione"] = indd.ContainsKey("descrizione") ? indd["descrizione"].ToString() : "";
                                                    csvRec["|"] = "";
                                                    csvRec["Lista prezzo promo"] = elemento.ContainsKey("prezzo_promo") ? elemento["prezzo_promo"].ToString() : "";
                                                    csvRec["Lista prezzo kgl"] = "Da " + prezzoInizioGruppo + " a " + prezzoFineGruppo;

                                                    csvRec["||"] = "";

                                                    csvRec["Indd prezzo promo"] = indd.ContainsKey("prezzo_promo") ? indd["prezzo_promo"].ToString() : "";
                                                    csvRec["Indd prezzo kgl"] = indd.ContainsKey("prezzo_promo_kgl") ? indd["prezzo_promo_kgl"].ToString() : "";

                                                    csvRec["|||"] = "";

                                                    csvRec["Categoria"] = elemento["categoria"].ToString();
                                                    csvRec["Error"] = "";
                                                    elementoInserito = true;
                                                    csvResultData.records.Add(csvRec);
                                                    continue;
                                                }
                                            }
                                            else if (!match.Success && indd["prezzo_promo_kgl"].ToString() != "a confezione" && indd["prezzo_promo_kgl"].ToString() != "al kg")
                                            {
                                                var prezzoInizioGruppo = Convert.ToDouble(gruppo.OrderBy(d => Convert.ToDouble(d["prezzo_kgl"])).First()["prezzo_kgl"]);
                                                var prezzoFineGruppo = Convert.ToDouble(gruppo.OrderBy(d => Convert.ToDouble(d["prezzo_kgl"])).Last()["prezzo_kgl"]);

                                                csvRec["Codice"] = indd.ContainsKey("codice_gruppo") ? indd["codice_gruppo"].ToString() : "";
                                                csvRec["Descrizione"] = indd.ContainsKey("descrizione") ? indd["descrizione"].ToString() : "";
                                                csvRec["|"] = "";
                                                csvRec["Lista prezzo promo"] = elemento.ContainsKey("prezzo_promo") ? elemento["prezzo_promo"].ToString() : "";
                                                csvRec["Lista prezzo kgl"] = "Da " + prezzoInizioGruppo + " a " + prezzoFineGruppo;

                                                csvRec["||"] = "";

                                                csvRec["Indd prezzo promo"] = indd.ContainsKey("prezzo_promo") ? indd["prezzo_promo"].ToString() : "";
                                                csvRec["Indd prezzo kgl"] = indd.ContainsKey("prezzo_promo_kgl") ? indd["prezzo_promo_kgl"].ToString() : "";

                                                csvRec["|||"] = "";

                                                csvRec["Categoria"] = elemento["categoria"].ToString();
                                                csvRec["Error"] = "Impossibile leggere il prezzo kgl indd";
                                                elementoInserito = true;
                                                csvResultData.records.Add(csvRec);
                                                continue;
                                            }
                                        }
                                        catch (Exception ex)
                                        {
                                            csvRec["Codice"] = (elemento.ContainsKey(keyRefCodice) ? elemento[keyRefCodice].ToString() : "");
                                            csvRec["Descrizione"] = (elemento.ContainsKey(keyDescr) ? elemento[keyDescr].ToString() : "");
                                            csvRec["|"] = "";
                                            csvRec["Lista prezzo promo"] = "";
                                            csvRec["Lista prezzo kgl"] = "";

                                            csvRec["||"] = "";

                                            csvRec["Indd prezzo promo"] = "";
                                            csvRec["Indd prezzo kgl"] = "";

                                            csvRec["|||"] = "";

                                            csvRec["Categoria"] = (elemento.ContainsKey("categoria") ? elemento["categoria"].ToString() : "");
                                            csvRec["Error"] = ex.Message;
                                            elementoInserito = true;
                                            csvResultData.records.Add(csvRec);
                                            continue;
                                        }
                                    }
                                    if (indd.ContainsKey("prezzo_promo"))
                                    {
                                        Regex regex = new Regex(@"€ (\d{1,3}(?:,\d{2})*(?:\.\d{2})?)");
                                        Match match = regex.Match(indd["prezzo_promo"].ToString());

                                        try
                                        {
                                            if (match.Success)
                                            {
                                                Double prezzoPromoEstratto = Convert.ToDouble(match.Groups[1].Value);
                                                if (Math.Round(Convert.ToDouble(elemento["prezzo_promo"]), 2) != Math.Round(prezzoPromoEstratto, 2))
                                                {
                                                    var prezzoInizioGruppo = Convert.ToDouble(gruppo.OrderBy(d => Convert.ToDouble(d["prezzo_kgl"])).First()["prezzo_kgl"]);
                                                    var prezzoFineGruppo = Convert.ToDouble(gruppo.OrderBy(d => Convert.ToDouble(d["prezzo_kgl"])).Last()["prezzo_kgl"]);

                                                    csvRec["Codice"] = elemento.ContainsKey(keyRefCodice) ? elemento[keyRefCodice].ToString() : "";
                                                    csvRec["Descrizione"] = elemento.ContainsKey(keyDescr) ? elemento[keyDescr].ToString() : "";
                                                    csvRec["|"] = "";
                                                    csvRec["Lista prezzo promo"] = elemento.ContainsKey("prezzo_promo") ? elemento["prezzo_promo"].ToString() : "";
                                                    csvRec["Lista prezzo kgl"] = "Da " + prezzoInizioGruppo + " a " + prezzoFineGruppo;

                                                    csvRec["||"] = "";

                                                    csvRec["Indd prezzo promo"] = indd.ContainsKey("prezzo_promo") ? indd["prezzo_promo"].ToString() : "";
                                                    csvRec["Indd prezzo kgl"] = indd.ContainsKey("prezzo_promo_kgl") ? indd["prezzo_promo_kgl"].ToString() : "";

                                                    csvRec["|||"] = "";

                                                    csvRec["Categoria"] = elemento["categoria"].ToString();
                                                    csvRec["Error"] = "";
                                                    elementoInserito = true;
                                                    csvResultData.records.Add(csvRec);

                                                    continue;
                                                }
                                            }
                                            else
                                            {
                                                var prezzoInizioGruppo = Convert.ToDouble(gruppo.OrderBy(d => Convert.ToDouble(d["prezzo_kgl"])).First()["prezzo_kgl"]);
                                                var prezzoFineGruppo = Convert.ToDouble(gruppo.OrderBy(d => Convert.ToDouble(d["prezzo_kgl"])).Last()["prezzo_kgl"]);
                                                csvRec["Codice"] = elemento.ContainsKey(keyRefCodice) ? elemento[keyRefCodice].ToString() : "";
                                                csvRec["Descrizione"] = elemento.ContainsKey(keyDescr) ? elemento[keyDescr].ToString() : "";
                                                csvRec["|"] = "";
                                                csvRec["Lista prezzo promo"] = elemento.ContainsKey("prezzo_promo") ? elemento["prezzo_promo"].ToString() : "";
                                                csvRec["Lista prezzo kgl"] = "Da " + prezzoInizioGruppo + " a " + prezzoFineGruppo;

                                                csvRec["||"] = "";

                                                csvRec["Indd prezzo promo"] = indd.ContainsKey("prezzo_promo") ? indd["prezzo_promo"].ToString() : "";
                                                csvRec["Indd prezzo kgl"] = indd.ContainsKey("prezzo_promo_kgl") ? indd["prezzo_promo_kgl"].ToString() : "";

                                                csvRec["|||"] = "";

                                                csvRec["Categoria"] = elemento["categoria"].ToString();
                                                csvRec["Error"] = "Impossibile leggere il prezzo promo";
                                                elementoInserito = true;
                                                csvResultData.records.Add(csvRec);

                                                continue;

                                            }
                                        }
                                        catch (Exception ex)
                                        {

                                            csvRec["Codice"] = (elemento.ContainsKey(keyRefCodice) ? elemento[keyRefCodice].ToString() : "");
                                            csvRec["Descrizione"] = (elemento.ContainsKey(keyDescr) ? elemento[keyDescr].ToString() : "");
                                            csvRec["|"] = "";
                                            csvRec["Lista prezzo promo"] = "";
                                            csvRec["Lista prezzo kgl"] = "";

                                            csvRec["||"] = "";

                                            csvRec["Indd prezzo promo"] = "";
                                            csvRec["Indd prezzo kgl"] = "";

                                            csvRec["|||"] = "";

                                            csvRec["Categoria"] = (elemento.ContainsKey("categoria") ? elemento["categoria"].ToString() : "");
                                            csvRec["Error"] = ex.Message;
                                            elementoInserito = true;
                                            csvResultData.records.Add(csvRec);

                                            continue;
                                        }
                                    }
                                }
                                else if (indd["prezzo_promo_kgl"].ToString().ToLower().Contains("/"))
                                {
                                    if (indd.ContainsKey("prezzo_promo_kgl"))
                                    {
                                        Regex regex = new Regex(@"€\s*(\d+(?:,\d+)?)\/(\d+(?:,\d+)?)\s*al\s*(kg|lt)");
                                        Match match = regex.Match(indd["prezzo_promo_kgl"].ToString());

                                        try
                                        {
                                            if (match.Success)
                                            {
                                                string tuttiIPrezzi = match.Groups[1].Value +"/"+ match.Groups[2].Value;
                                                List<Double> prezziKgl = new List<Double>();
                                                if (!string.IsNullOrEmpty(tuttiIPrezzi))
                                                {
                                                    string[] prezziArray = tuttiIPrezzi.Split('/');

                                                    foreach (var prezzo in prezziArray)
                                                    {
                                                        prezziKgl.Add(Math.Round(Convert.ToDouble(prezzo),2));
                                                    }
                                                }

                                                bool prezzoKglTrovato = true;
                                                string prezzoKglLista = "";
                                                foreach (var single in gruppo)
                                                {
                                                    prezzoKglLista += single["prezzo_kgl"].ToString() + "/";
                                                    if (!prezziKgl.Contains(Math.Round(Convert.ToDouble(single["prezzo_kgl"]),2)))
                                                    {
                                                        prezzoKglTrovato = false;
                                                    }
                                                }

                                                if (!prezzoKglTrovato)
                                                {
                                                    if (prezzoKglLista.Length > 0)
                                                    {
                                                        prezzoKglLista = prezzoKglLista.Substring(0, prezzoKglLista.Length - 1);
                                                    }

                                                    csvRec["Codice"] = indd.ContainsKey("codice_gruppo") ? indd["codice_gruppo"].ToString() : "";
                                                    csvRec["Descrizione"] = indd.ContainsKey("descrizione") ? indd["descrizione"].ToString() : "";
                                                    csvRec["|"] = "";
                                                    csvRec["Lista prezzo promo"] = elemento.ContainsKey("prezzo_promo") ? elemento["prezzo_promo"].ToString() : "";
                                                    csvRec["Lista prezzo kgl"] = prezzoKglLista;

                                                    csvRec["||"] = "";

                                                    csvRec["Indd prezzo promo"] = indd.ContainsKey("prezzo_promo") ? indd["prezzo_promo"].ToString() : "";
                                                    csvRec["Indd prezzo kgl"] = indd.ContainsKey("prezzo_promo_kgl") ? indd["prezzo_promo_kgl"].ToString() : "";

                                                    csvRec["|||"] = "";

                                                    csvRec["Categoria"] = elemento["categoria"].ToString();
                                                    csvRec["Error"] = "";
                                                    elementoInserito = true;
                                                    csvResultData.records.Add(csvRec);

                                                    continue;
                                                }
                                            }
                                            else if (!match.Success && indd["prezzo_promo_kgl"].ToString() != "a confezione" && indd["prezzo_promo_kgl"].ToString() != "al kg")
                                            {
                                                string prezzoKglLista = "";
                                                foreach (var single in gruppo)
                                                {
                                                    prezzoKglLista += single["prezzo_kgl"].ToString() + "/";
                                                }
                                                if (prezzoKglLista.Length > 0)
                                                {
                                                    prezzoKglLista = prezzoKglLista.Substring(0, prezzoKglLista.Length - 1);
                                                }

                                                csvRec["Codice"] = indd.ContainsKey("codice_gruppo") ? indd["codice_gruppo"].ToString() : "";
                                                csvRec["Descrizione"] = indd.ContainsKey("descrizione") ? indd["descrizione"].ToString() : "";
                                                csvRec["|"] = "";
                                                csvRec["Lista prezzo promo"] = elemento.ContainsKey("prezzo_promo") ? elemento["prezzo_promo"].ToString() : "";
                                                csvRec["Lista prezzo kgl"] = prezzoKglLista;

                                                csvRec["||"] = "";

                                                csvRec["Indd prezzo promo"] = indd.ContainsKey("prezzo_promo") ? indd["prezzo_promo"].ToString() : "";
                                                csvRec["Indd prezzo kgl"] = indd.ContainsKey("prezzo_promo_kgl") ? indd["prezzo_promo_kgl"].ToString() : "";

                                                csvRec["|||"] = "";

                                                csvRec["Categoria"] = elemento["categoria"].ToString();
                                                csvRec["Error"] = "Impossibile leggere prezzo kgl indd";
                                                elementoInserito = true;
                                                csvResultData.records.Add(csvRec);

                                                continue;
                                            }
                                        }
                                        catch (Exception ex)
                                        {
                                            csvRec["Codice"] = indd.ContainsKey("codice_gruppo") ? indd["codice_gruppo"].ToString() : "";
                                            csvRec["Descrizione"] = indd.ContainsKey("descrizione") ? indd["descrizione"].ToString() : "";
                                            csvRec["|"] = "";
                                            csvRec["Lista prezzo promo"] = "";
                                            csvRec["Lista prezzo kgl"] = "";

                                            csvRec["||"] = "";

                                            csvRec["Indd prezzo promo"] = "";
                                            csvRec["Indd prezzo kgl"] = "";

                                            csvRec["|||"] = "";

                                            csvRec["Categoria"] = (elemento.ContainsKey("categoria") ? elemento["categoria"].ToString() : "");
                                            csvRec["Error"] = ex.Message;
                                            elementoInserito = true;
                                            csvResultData.records.Add(csvRec);

                                            continue;
                                        }
                                    }
                                    if (indd.ContainsKey("prezzo_promo"))
                                    {
                                        Regex regex = new Regex(@"€ (\d{1,3}(?:,\d{2})*(?:\.\d{2})?)");
                                        Match match = regex.Match(indd["prezzo_promo"].ToString());

                                        try
                                        {
                                            if (match.Success)
                                            {
                                                Double prezzoPromoEstratto = Convert.ToDouble(match.Groups[1].Value);
                                                if (Math.Round(Convert.ToDouble(elemento["prezzo_promo"]), 2) != Math.Round(prezzoPromoEstratto, 2))
                                                {
                                                    string prezzoKglLista = "";
                                                    foreach (var single in gruppo)
                                                    {
                                                        prezzoKglLista += single["prezzo_kgl"].ToString() + "/";
                                                    }
                                                    if (prezzoKglLista.Length > 0)
                                                    {
                                                        prezzoKglLista = prezzoKglLista.Substring(0, prezzoKglLista.Length - 1);
                                                    }
                                                    csvRec["Codice"] = elemento.ContainsKey(keyRefCodice) ? elemento[keyRefCodice].ToString() : "";
                                                    csvRec["Descrizione"] = elemento[keyDescr].ToString();
                                                    csvRec["|"] = "";
                                                    csvRec["Lista prezzo promo"] = elemento["prezzo_promo"].ToString();
                                                    csvRec["Lista prezzo kgl"] = prezzoKglLista;

                                                    csvRec["||"] = "";

                                                    csvRec["Indd prezzo promo"] = indd["prezzo_promo"].ToString();
                                                    csvRec["Indd prezzo kgl"] = indd["prezzo_promo_kgl"].ToString();

                                                    csvRec["|||"] = "";

                                                    csvRec["Categoria"] = elemento["categoria"].ToString();
                                                    csvRec["Error"] = "";
                                                    elementoInserito = true;
                                                    csvResultData.records.Add(csvRec);

                                                    continue;
                                                }
                                            }
                                            else
                                            {
                                                string prezzoKglLista = "";
                                                foreach (var single in gruppo)
                                                {
                                                    prezzoKglLista += single["prezzo_kgl"].ToString() + "/";
                                                }
                                                if (prezzoKglLista.Length > 0)
                                                {
                                                    prezzoKglLista = prezzoKglLista.Substring(0, prezzoKglLista.Length - 1);
                                                }

                                                csvRec["Codice"] = elemento.ContainsKey(keyRefCodice) ? elemento[keyRefCodice].ToString() : "";
                                                csvRec["Descrizione"] = elemento[keyDescr].ToString();
                                                csvRec["|"] = "";
                                                csvRec["Lista prezzo promo"] = elemento["prezzo_promo"].ToString();
                                                csvRec["Lista prezzo kgl"] = prezzoKglLista;

                                                csvRec["||"] = "";

                                                csvRec["Indd prezzo promo"] = indd["prezzo_promo"].ToString();
                                                csvRec["Indd prezzo kgl"] = indd["prezzo_promo_kgl"].ToString();

                                                csvRec["|||"] = "";

                                                csvRec["Categoria"] = elemento["categoria"].ToString();
                                                csvRec["Error"] = "Impossibile leggere il prezzo promo indd";
                                                elementoInserito = true;
                                                csvResultData.records.Add(csvRec);

                                                continue;
                                            }
                                        }
                                        catch (Exception ex)
                                        {

                                            csvRec["Codice"] = elemento.ContainsKey(keyRefCodice) ? elemento[keyRefCodice].ToString() : "";
                                            csvRec["Descrizione"] = elemento.ContainsKey(keyDescr) ? elemento[keyDescr].ToString() : "";
                                            csvRec["|"] = "";
                                            csvRec["Lista prezzo promo"] = "";
                                            csvRec["Lista prezzo kgl"] = "";

                                            csvRec["||"] = "";

                                            csvRec["Indd prezzo promo"] = "";
                                            csvRec["Indd prezzo kgl"] = "";

                                            csvRec["|||"] = "";

                                            csvRec["Categoria"] = (elemento.ContainsKey("categoria") ? elemento["categoria"].ToString() : "");
                                            csvRec["Error"] = ex.Message;
                                            elementoInserito = true;
                                            csvResultData.records.Add(csvRec);

                                            continue;
                                        }
                                    }
                                }
                                else
                                {
                                    if (indd.ContainsKey("prezzo_promo_kgl"))
                                    {
                                        Regex regex = new Regex(@"€ (\d{1,3}(?:,\d{2})*(?:\.\d{2})?) (?:al kg|al lt)");
                                        Match match = regex.Match(indd["prezzo_promo_kgl"].ToString());

                                        try
                                        {
                                            if (match.Success)
                                            {
                                                Double prezzoKglEstratto = Convert.ToDouble(match.Groups[1].Value);
                                                bool categoriaEtto = false;
                                                if (elemento.ContainsKey("categoria") && (elemento["categoria"].ToString().ToLower() == "gastronomia" || elemento["categoria"].ToString().ToLower() == "pescheria"))
                                                {
                                                    categoriaEtto = true;
                                                }
                                                if (Math.Round(Convert.ToDouble(elemento["prezzo_kgl"]), 2) != Math.Round(prezzoKglEstratto, 2))
                                                {
                                                    csvRec["Codice"] = elemento.ContainsKey(keyRefCodice) ? elemento[keyRefCodice].ToString() : "";
                                                    csvRec["Descrizione"] = elemento[keyDescr].ToString();
                                                    csvRec["|"] = "";
                                                    csvRec["Lista prezzo promo"] = (categoriaEtto ? (Convert.ToDouble(elemento["prezzo_promo"]) / 10d).ToString() : elemento["prezzo_promo"]).ToString();
                                                    csvRec["Lista prezzo kgl"] = elemento.ContainsKey("prezzo_kgl") ? elemento["prezzo_kgl"].ToString() : "";

                                                    csvRec["||"] = "";

                                                    csvRec["Indd prezzo promo"] = indd.ContainsKey("prezzo_promo") ? indd["prezzo_promo"].ToString() : "";
                                                    csvRec["Indd prezzo kgl"] = indd.ContainsKey("prezzo_promo_kgl") ? indd["prezzo_promo_kgl"].ToString() : "";

                                                    csvRec["|||"] = "";

                                                    csvRec["Categoria"] = elemento["categoria"].ToString();
                                                    csvRec["Error"] = "";
                                                    elementoInserito = true;
                                                    csvResultData.records.Add(csvRec);

                                                    continue;
                                                }
                                            }
                                            else if (!match.Success && indd["prezzo_promo_kgl"].ToString() != "a confezione" && indd["prezzo_promo_kgl"].ToString() != "al kg")
                                            {
                                                csvRec["Codice"] = elemento.ContainsKey(keyRefCodice) ? elemento[keyRefCodice].ToString() : "";
                                                csvRec["Descrizione"] = elemento[keyDescr].ToString();
                                                csvRec["|"] = "";
                                                csvRec["Lista prezzo promo"] = elemento.ContainsKey("prezzo_promo") ? elemento["prezzo_promo"].ToString() : "";
                                                csvRec["Lista prezzo kgl"] = elemento.ContainsKey("prezzo_kgl") ? elemento["prezzo_kgl"].ToString() : "";

                                                csvRec["||"] = "";

                                                csvRec["Indd prezzo promo"] = indd.ContainsKey("prezzo_promo") ? indd["prezzo_promo"].ToString() : "";
                                                csvRec["Indd prezzo kgl"] = indd.ContainsKey("prezzo_promo_kgl") ? indd["prezzo_promo_kgl"].ToString() : "";

                                                csvRec["|||"] = "";

                                                csvRec["Categoria"] = elemento["categoria"].ToString();
                                                csvRec["Error"] = "Impossibile leggere il prezzo kgl indd";
                                                elementoInserito = true;
                                                csvResultData.records.Add(csvRec);

                                                continue;

                                            }
                                        }
                                        catch (Exception ex)
                                        {
                                                
                                            csvRec["Codice"] = elemento.ContainsKey(keyRefCodice) ? elemento[keyRefCodice].ToString() : "";
                                            csvRec["Descrizione"] = elemento.ContainsKey(keyDescr) ? elemento[keyDescr].ToString() : "";
                                            csvRec["|"] = "";
                                            csvRec["Lista prezzo promo"] = "";
                                            csvRec["Lista prezzo kgl"] = "";

                                            csvRec["||"] = "";

                                            csvRec["Indd prezzo promo"] = "";
                                            csvRec["Indd prezzo kgl"] = "";

                                            csvRec["|||"] = "";

                                            csvRec["Categoria"] = (elemento.ContainsKey("categoria") ? elemento["categoria"].ToString() : "");
                                            csvRec["Error"] = ex.Message;
                                            elementoInserito = true;
                                            csvResultData.records.Add(csvRec);

                                            continue;
                                        }
                                    }
                                    if (indd.ContainsKey("prezzo_promo"))
                                    {
                                        Regex regex = new Regex(@"€ (\d{1,3}(?:,\d{2})*(?:\.\d{2})?)");
                                        Match match = regex.Match(indd["prezzo_promo"].ToString());

                                        try
                                        {
                                            if (match.Success)
                                            {
                                                Double prezzoPromoEstratto = Convert.ToDouble(match.Groups[1].Value);
                                                bool categoriaEtto = false;
                                                if (elemento.ContainsKey("categoria") && (elemento["categoria"].ToString().ToLower() == "gastronomia" || elemento["categoria"].ToString().ToLower() == "pescheria"))
                                                {
                                                    categoriaEtto = true;
                                                    prezzoPromoEstratto = prezzoPromoEstratto * 10d;
                                                }
                                                if (Math.Round(Convert.ToDouble(elemento["prezzo_promo"]), 2) != Math.Round(prezzoPromoEstratto, 2))
                                                {
                                                    csvRec["Codice"] = elemento.ContainsKey(keyRefCodice) ? elemento[keyRefCodice].ToString() : "";
                                                    csvRec["Descrizione"] = elemento[keyDescr].ToString();
                                                    csvRec["|"] = "";
                                                    csvRec["Lista prezzo promo"] = (categoriaEtto ? (Convert.ToDouble(elemento["prezzo_promo"]) / 10d).ToString() : elemento["prezzo_promo"].ToString());
                                                    csvRec["Lista prezzo kgl"] = elemento.ContainsKey("prezzo_kgl") ? elemento["prezzo_kgl"].ToString() : "";

                                                    csvRec["||"] = "";

                                                    csvRec["Indd prezzo promo"] = indd.ContainsKey("prezzo_promo") ? indd["prezzo_promo"].ToString() : "";
                                                    csvRec["Indd prezzo kgl"] = indd.ContainsKey("prezzo_promo_kgl") ? indd["prezzo_promo_kgl"].ToString() : "";

                                                    csvRec["|||"] = "";

                                                    csvRec["Categoria"] = elemento["categoria"].ToString();
                                                    csvRec["Error"] = "";
                                                    elementoInserito = true;
                                                    csvResultData.records.Add(csvRec);

                                                    continue;
                                                }
                                            }
                                            else
                                            {
                                                csvRec["Codice"] = elemento.ContainsKey(keyRefCodice) ? elemento[keyRefCodice].ToString() : "";
                                                csvRec["Descrizione"] = elemento[keyDescr].ToString();
                                                csvRec["|"] = "";
                                                csvRec["Lista prezzo promo"] = elemento.ContainsKey("prezzo_promo") ? elemento["prezzo_promo"].ToString() : "";
                                                csvRec["Lista prezzo kgl"] = elemento.ContainsKey("prezzo_kgl") ? elemento["prezzo_kgl"].ToString() : "";

                                                csvRec["||"] = "";

                                                csvRec["Indd prezzo promo"] = indd.ContainsKey("prezzo_promo") ? indd["prezzo_promo"].ToString() : "";
                                                csvRec["Indd prezzo kgl"] = indd.ContainsKey("prezzo_promo_kgl") ? indd["prezzo_promo_kgl"].ToString() : "";

                                                csvRec["|||"] = "";

                                                csvRec["Categoria"] = elemento["categoria"].ToString();
                                                csvRec["Error"] = "Impossibile leggere il prezzo promo indd";
                                                elementoInserito = true;
                                                csvResultData.records.Add(csvRec);

                                                continue;

                                            }
                                        }
                                        catch (Exception ex)
                                        {

                                            csvRec["Codice"] = elemento.ContainsKey(keyRefCodice) ? elemento[keyRefCodice].ToString() : "";
                                            csvRec["Descrizione"] = elemento.ContainsKey(keyDescr) ? elemento[keyDescr].ToString() : "";
                                            csvRec["|"] = "";
                                            csvRec["Lista prezzo promo"] = "";
                                            csvRec["Lista prezzo kgl"] = "";

                                            csvRec["||"] = "";

                                            csvRec["Indd prezzo promo"] = "";
                                            csvRec["Indd prezzo kgl"] = "";

                                            csvRec["|||"] = "";

                                            csvRec["Categoria"] = (elemento.ContainsKey("categoria") ? elemento["categoria"].ToString() : "");
                                            csvRec["Error"] = ex.Message;
                                            elementoInserito = true;
                                            csvResultData.records.Add(csvRec);

                                            continue;
                                        }
                                    }
                                }
                            }
                            else if (indd.ContainsKey("codice_gruppo") && !indd["codice_gruppo"].ToString().Contains(","))
                            {
                                if (indd.ContainsKey("prezzo_promo_kgl"))
                                {
                                    Regex regex = new Regex(@"€ (\d{1,3}(?:,\d{2})*(?:\.\d{2})?) (?:al kg|al lt)");
                                    Match match = regex.Match(indd["prezzo_promo_kgl"].ToString());
                                    //string matchString = MathExt.DoubleRoundMidpoint(Convert.ToDouble(indd["prezzo_promo_kgl"]));

                                    try
                                    {
                                        if (match.Success)
                                        {
                                            Double prezzoKglEstratto = Convert.ToDouble(match.Groups[1].Value);
                                            bool categoriaEtto = false;
                                            if (elemento.ContainsKey("categoria") && (elemento["categoria"].ToString().ToLower() == "gastronomia" || elemento["categoria"].ToString().ToLower() == "pescheria"))
                                            {
                                                categoriaEtto = true;
                                            }
                                            if (Math.Round(Convert.ToDouble(elemento["prezzo_kgl"]), 2) != Math.Round(prezzoKglEstratto, 2))
                                            {
                                                csvRec["Codice"] = elemento.ContainsKey(keyRefCodice) ? elemento[keyRefCodice].ToString() : "";
                                                csvRec["Descrizione"] = elemento[keyDescr].ToString();
                                                csvRec["|"] = "";
                                                csvRec["Lista prezzo promo"] = (categoriaEtto ? (Convert.ToDouble(elemento["prezzo_promo"]) / 10d).ToString() : elemento["prezzo_promo"]).ToString();
                                                csvRec["Lista prezzo kgl"] = elemento["prezzo_kgl"].ToString();

                                                csvRec["||"] = "";

                                                csvRec["Indd prezzo promo"] = indd["prezzo_promo"].ToString();
                                                csvRec["Indd prezzo kgl"] = indd["prezzo_promo_kgl"].ToString();

                                                csvRec["|||"] = "";

                                                csvRec["Categoria"] = elemento["categoria"].ToString();
                                                csvRec["Error"] = "";
                                                elementoInserito = true;
                                                csvResultData.records.Add(csvRec);

                                                continue;
                                            }
                                        }
                                        else if (!match.Success && indd["prezzo_promo_kgl"].ToString() != "a confezione" && indd["prezzo_promo_kgl"].ToString() != "al kg")
                                        {
                                            csvRec["Codice"] = elemento.ContainsKey(keyRefCodice) ? elemento[keyRefCodice].ToString() : "";
                                            csvRec["Descrizione"] = elemento[keyDescr].ToString();
                                            csvRec["|"] = "";
                                            csvRec["Lista prezzo promo"] = elemento.ContainsKey("prezzo_promo") ? elemento["prezzo_promo"].ToString() : "";
                                            csvRec["Lista prezzo kgl"] = elemento.ContainsKey("prezzo_kgl") ? elemento["prezzo_kgl"].ToString() : "";

                                            csvRec["||"] = "";

                                            csvRec["Indd prezzo promo"] = indd.ContainsKey("prezzo_promo") ? indd["prezzo_promo"].ToString() : "";
                                            csvRec["Indd prezzo kgl"] = indd.ContainsKey("prezzo_promo_kgl") ? indd["prezzo_promo_kgl"].ToString() : "";

                                            csvRec["|||"] = "";

                                            csvRec["Categoria"] = elemento["categoria"].ToString();
                                            csvRec["Error"] = "Impossibile leggere il prezzo kgl indd";
                                            elementoInserito = true;
                                            csvResultData.records.Add(csvRec);

                                            continue;

                                        }
                                    }
                                    catch (Exception ex)
                                    {

                                        csvRec["Codice"] = elemento.ContainsKey(keyRefCodice) ? elemento[keyRefCodice].ToString() : "";
                                        csvRec["Descrizione"] = elemento.ContainsKey(keyDescr) ? elemento[keyDescr].ToString() : "";
                                        csvRec["|"] = "";
                                        csvRec["Lista prezzo promo"] = "";
                                        csvRec["Lista prezzo kgl"] = "";

                                        csvRec["||"] = "";

                                        csvRec["Indd prezzo promo"] = "";
                                        csvRec["Indd prezzo kgl"] = "";

                                        csvRec["|||"] = "";

                                        csvRec["Categoria"] = (elemento.ContainsKey("categoria") ? elemento["categoria"].ToString() : "");
                                        csvRec["Error"] = ex.Message;
                                        elementoInserito = true;
                                        csvResultData.records.Add(csvRec);

                                        continue;
                                    }
                                }

                                if (indd.ContainsKey("prezzo_promo"))
                                {
                                    Regex regex = new Regex(@"€ (\d{1,3}(?:,\d{2})*(?:\.\d{2})?)");
                                    Match match = regex.Match(indd["prezzo_promo"].ToString());

                                    try
                                    {
                                        if (match.Success)
                                        {
                                            Double prezzoPromoEstratto = Convert.ToDouble(match.Groups[1].Value);
                                            bool categoriaEtto = false;
                                            if (elemento.ContainsKey("categoria") && (elemento["categoria"].ToString().ToLower() == "gastronomia" || elemento["categoria"].ToString().ToLower() == "pescheria"))
                                            {
                                                categoriaEtto = true;
                                                prezzoPromoEstratto = prezzoPromoEstratto * 10d;
                                            }
                                            if (Math.Round(Convert.ToDouble(elemento["prezzo_promo"]), 2) != Math.Round(prezzoPromoEstratto, 2))
                                            {
                                                csvRec["Codice"] = elemento.ContainsKey(keyRefCodice) ? elemento[keyRefCodice].ToString() : "";
                                                csvRec["Descrizione"] = elemento[keyDescr].ToString();
                                                csvRec["|"] = "";
                                                csvRec["Lista prezzo promo"] = (categoriaEtto ? (Convert.ToDouble(elemento["prezzo_promo"]) / 10d).ToString() : elemento["prezzo_promo"]).ToString();
                                                csvRec["Lista prezzo kgl"] = elemento.ContainsKey("prezzo_kgl") ? elemento["prezzo_kgl"].ToString() : "";

                                                csvRec["||"] = "";

                                                csvRec["Indd prezzo promo"] = indd["prezzo_promo"].ToString();
                                                csvRec["Indd prezzo kgl"] = indd.ContainsKey("prezzo_promo_kgl") ? indd["prezzo_promo_kgl"].ToString() : "";

                                                csvRec["|||"] = "";

                                                csvRec["Categoria"] = elemento["categoria"].ToString();
                                                csvRec["Error"] = "";
                                                elementoInserito = true;
                                                csvResultData.records.Add(csvRec);

                                                continue;
                                            }
                                        }
                                        else
                                        {
                                            csvRec["Codice"] = elemento.ContainsKey(keyRefCodice) ? elemento[keyRefCodice].ToString() : "";
                                            csvRec["Descrizione"] = elemento[keyDescr].ToString();
                                            csvRec["|"] = "";
                                            csvRec["Lista prezzo promo"] = elemento["prezzo_promo"].ToString();
                                            csvRec["Lista prezzo kgl"] = elemento.ContainsKey("prezzo_kgl") ? elemento["prezzo_kgl"].ToString() : "";

                                            csvRec["||"] = "";

                                            csvRec["Indd prezzo promo"] = indd["prezzo_promo"].ToString();
                                            csvRec["Indd prezzo kgl"] = indd.ContainsKey("prezzo_promo_kgl") ? indd["prezzo_promo_kgl"].ToString() : "";

                                            csvRec["|||"] = "";

                                            csvRec["Categoria"] = elemento["categoria"].ToString();
                                            csvRec["Error"] = "Impossibile leggere il prezzo promo indd";
                                            elementoInserito = true;
                                            csvResultData.records.Add(csvRec);

                                            continue;

                                        }
                                    }
                                    catch (Exception ex)
                                    {

                                        csvRec["Codice"] = elemento.ContainsKey(keyRefCodice) ? elemento[keyRefCodice].ToString() : "";
                                        csvRec["Descrizione"] = elemento.ContainsKey(keyDescr) ? elemento[keyDescr].ToString() : "";
                                        csvRec["|"] = "";
                                        csvRec["Lista prezzo promo"] = "";
                                        csvRec["Lista prezzo kgl"] = "";

                                        csvRec["||"] = "";

                                        csvRec["Indd prezzo promo"] = "";
                                        csvRec["Indd prezzo kgl"] = "";

                                        csvRec["|||"] = "";

                                        csvRec["Categoria"] = (elemento.ContainsKey("categoria") ? elemento["categoria"].ToString() : "");
                                        csvRec["Error"] = ex.Message;
                                        elementoInserito = true;
                                        csvResultData.records.Add(csvRec);

                                        continue;
                                    }
                                }
                            }
                        }
                    }           
                }
            }

            if (csvResultData.records.Count == 0)
            {
                csvRecEmpty["Codice"] = "Nessun elemento trovato";
                csvRecEmpty["Descrizione"] = "";
                csvRecEmpty["|"] = "";
                csvRecEmpty["|"] = "";

                csvRecEmpty["Lista prezzo promo"] = "";
                csvRecEmpty["Lista prezzo kgl"] = "";

                csvRecEmpty["||"] = "";

                csvRecEmpty["Indd prezzo promo"] = "";
                csvRecEmpty["Indd prezzo kgl"] = "";

                csvRecEmpty["|||"] = "";

                csvRecEmpty["Categoria"] = "";
                csvRecEmpty["Error"] = "";
                csvResultData.records.Add(csvRecEmpty);
            }
            string jsonResult = JsonConvert.SerializeObject(csvResultData);
            return jsonResult;
        }

        


        public TracciatoResultKit esportaPoP(List<FicoContextField> promoContext, List<FicoContextField> tracciatoContext, List<ArticoloInKit> tracciato, FicoRuntimeKit kit, string pathNamingConvention, string pathACPV, string pathTipiDiExport, string pathOrdinamentoLista, string pathMeccaniche, string pathLoghiBolli, string pathFormati, string pathMappaStili, FicoCombinazioneKitReadMode readMode)
        {
            System.Globalization.CultureInfo culture = new System.Globalization.CultureInfo("it-IT");
            CultureInfo.CurrentCulture = culture;


            TracciatoResultKit result = new TracciatoResultKit();

            string keyStatoSelezione = Edro21Context.Meta.keyStatoSelezione;

            TracciatoKit tracciato_da_esportare = new TracciatoKit();
            string referenza_pilota = Edro21Context.Meta.referenza_pilota;
            result.liste = new List<TracciatoKit>() { tracciato_da_esportare };
            result.liste[0].Records = new List<ArticoloInKit>();
            result.liste[0].errors = "";// = new List<Dictionary<string, object>>();
            try
            {

                List<Dictionary<string, object>> lista_tracciato = tracciato.Select(s => s.recordInTracciato).ToList();

                string tipo_materiale = "vol";
                Byte tipo_volantino = 1;

                JObject o2 = JObject.Parse(File.ReadAllText(pathOrdinamentoLista));
                DbOrdinamento ordDB = o2.ToObject<DbOrdinamento>();
                List<Ordinamento> dbGrammature = ordDB.source;


                JObject o1 = JObject.Parse(File.ReadAllText(pathACPV));
                DbACPV acpvDB = o1.ToObject<DbACPV>();

                JObject o5 = JObject.Parse(File.ReadAllText(pathLoghiBolli));
                DbLoghiBolli loghibolliDB = o5.ToObject<DbLoghiBolli>();

                JObject o6 = JObject.Parse(File.ReadAllText(pathTipiDiExport));
                DbTipoDiExport tipiExportDB = o6.ToObject<DbTipoDiExport>();

                JObject o7 = JObject.Parse(File.ReadAllText(pathFormati));
                DbFormati formatiDB = o7.ToObject<DbFormati>();

                string ncContentFile = File.ReadAllText(pathNamingConvention);
                FicoNamingConvention ncDB = JsonConvert.DeserializeObject<FicoNamingConvention>(ncContentFile);

                //I nomi saranno per tutte le ref identici quindi lo estraggouna volta soltanto
                List<IstantaLib.ArticoloInKitExportName> exportNames = new List<IstantaLib.ArticoloInKitExportName>();

                List<TipoDiExport> tipiExportDelKit = new List<TipoDiExport>();
                foreach (TipoDiExportInKit tItemInKit in kit.tipiDiExportInKit)
                {
                    TipoDiExport tItem = tipiExportDB.source.FirstOrDefault(w => w.guidID == tItemInKit.tipoDiExportGuidID);
                    if (tItem != null)
                    {
                        tipiExportDelKit.Add(tItem);
                    }
                }


                CompiledFieldInterpreter interprete = new CompiledFieldInterpreter();
                List<string> _cacheSottogruppi = new List<string>();

                int counter = 0;
                for (int i = 0; i < tracciato.Count; i++) //lista_tracciato.Count; i++)
                {
                    ArticoloInKit artInKit = tracciato[i];
                    Dictionary<string, object> recItem = artInKit.recordInTracciato;// lista_tracciato[i];

                    string codice_referenza = recItem[GLOBAL_VARIABLES.keyRefCodice].ToString();
                    string codice_gruppo = recItem[GLOBAL_VARIABLES.keyScattoCodiceGruppo].ToString();



                    counter++;


                    var codiceBox = recItem[GLOBAL_VARIABLES_FICO.codiceBox].ToString();
                    string stile_prezzo_promo = "PREZZO_PROMO";


                    //Qui devo prendere il rec PRIMARIO di questo gruppo
                    int statoSelezione = 3;
                    if (recItem.ContainsKey(keyStatoSelezione))
                    {

                        statoSelezione = int.Parse(recItem[keyStatoSelezione].ToString());
                    }

                    var recItemPrimario = recItem;
                    if (statoSelezione!=1)
                    {
                        //Devo prendere il primario
                        //recItemPrimario = tracciato.FirstOrDefault(w => 
                        //w.recordInTracciato[GLOBAL_VARIABLES.keyScattoCodiceGruppo].ToString() == codice_gruppo && 
                        //w.recordInTracciato.ContainsKey(keyStatoSelezione) && 
                        //w.recordInTracciato[keyStatoSelezione].ToString() == "1")?.recordInTracciato;

                        //Eredito la foto principale dal primario
                        //if (recItemPrimario != null && recItemPrimario.ContainsKey(GLOBAL_VARIABLES_FICO.keyFotoNome))
                        //{
                        //    recItem[GLOBAL_VARIABLES_FICO.keyFotoNome] = recItemPrimario[GLOBAL_VARIABLES_FICO.keyFotoNome];
                        //}

                        //if (recItemPrimario == null)
                        //    throw new Exception($"Errore recupero primario della ref {codice_referenza}. Nessun primario per il gruppo {codice_gruppo}");
                    }


                    decimal peso = recItemPrimario[GLOBAL_VARIABLES.keyDescrPeso].ToDecimal();
                    string um = recItemPrimario[GLOBAL_VARIABLES.keyDescrUm].ToString();
                    string note = recItemPrimario["note"].ToString();
                    string confezione = recItemPrimario["confezione"].ToString();
                    string marchio = recItemPrimario["marchio"].ToString();
                    string categoria = recItemPrimario["categoria"].ToString();
                    decimal prezzo_promo = MathExt.Round(recItemPrimario["prezzo_promo"].ToDecimal(), 2, MidpointRounding.AwayFromZero);
                    decimal prezzo_continuo = MathExt.Round(recItemPrimario["prezzo_continuo"].ToDecimal(), 2, MidpointRounding.AwayFromZero);
                    decimal prezzo_promo_kgl = MathExt.Round(recItemPrimario["prezzo_promo_kgl"].ToDecimal(), 2, MidpointRounding.AwayFromZero);
                    decimal sconto = 0;// MathExt.Round(recItem["txt_sconto"].ToDecimal(), 2, MidpointRounding.AwayFromZero);



                    tracciato[i].recordInTracciato[GLOBAL_VARIABLES_FICO.keyFicoNames] = exportNames;

                    #region compiledfield

                    //Assegno compiled field 




                    if (sconto > 0)
                    {
                        string sconto_str = $"-{(int)sconto}%";
                        interprete.assignCompiledField("txt_sconto", "SCONTO", sconto_str);
                    }
                    else
                    {
                        interprete.removeCompiledField("sconto_fumetto");
                    }



                    string specialDescr_max_pezzi_accodato_a_descrizione = "";
                    string specialDescr_superprezziOF = "";

                    string stileDescr1 = "DESCRIZIONE_TITOLO";
                    string stileDescr2 = "DESCRIZIONE_BRAND";
                    string stileDescr3 = "DESCRIZIONE_TIPO";
                    string stileDescr4 = "DESCRIZIONE_GRAMMATURA";

                    string stile_prezzo_kgl = "PREZZO_KGL";

                    string prezzo_promo_kgl_str = "";
                    string mastro = "ma-STD";


                    if (codiceBox == "BOX_FID")
                    {

                        stile_prezzo_promo = "FID_PREZZO";
                        stile_prezzo_kgl = "FID_PREZZO_KGL";

                        if (peso == 1000 || peso == 1 || prezzo_promo_kgl == 0)
                        {
                            interprete.removeCompiledField("prezzo_promo_kgl");
                        }

                        mastro = "ma-FID"; 

                    }
                    else if (codiceBox == "BOX_MACE_BANCO")
                    {
                        stile_prezzo_promo = "PREZZO_PROMO_MACELLERIA";
                        stile_prezzo_kgl = "PREZZO_KGL_MACELLERIA";
                    }
                    else if (codiceBox == "BOX_PESCHERIA")
                    {
                        stile_prezzo_promo = "PREZZO_PROMO_PESCHERIA";
                        stile_prezzo_kgl = "PREZZO_KGL_PESCHERIA";

                        /*
                         Se CONF= KG e UM= GR e PESO= 1000 e KGLT=(vuoto) allora in prezzo_promo_kgl ci deve venire scritto SOLO “AL KG”
                         */
                        if (confezione == "KG" && um == "GR" && peso == 1000 && prezzo_promo_kgl == 0)
                        {
                            prezzo_promo_kgl_str = "AL KG";
                        }
                    }
                    else if (codiceBox.Contains("BOX_OF"))
                    {
                        stileDescr1 += "_ORTOFRUTTA";
                        stileDescr2 += "_ORTOFRUTTA";
                        stileDescr3 += "_ORTOFRUTTA";
                        stileDescr4 += "_ORTOFRUTTA";

                        stile_prezzo_promo = "PREZZO_PROMO_ORTOFRUTTA";
                        stile_prezzo_kgl = "PREZZO_KGL_ORTOFRUTTA";

                        if (confezione == "KG" && um == "GR" && peso == 1000 && prezzo_promo_kgl == 0)
                        {
                            prezzo_promo_kgl_str = "AL KG";
                        }

                        if (note.ToLower().Contains("settimana1"))
                            mastro = "ma-OF_Sett1";
                        else if (note.ToLower().Contains("settimana2"))
                            mastro = "ma-OF_Sett2";
                    }
                    else if (codiceBox == "BOX_OF_SUPER")
                    {
                        stileDescr1 += "_SUPER";
                        stileDescr2 += "_SUPER";
                        stileDescr3 += "_SUPER";
                        stileDescr4 += "_SUPER";

                        stile_prezzo_promo = "PREZZO_PROMO_ORTOFRUTTA_SUPER";
                        stile_prezzo_kgl = "PREZZO_KGL_ORTOFRUTTA_SUPER";
                    }
                    else if (codiceBox == "BOX_BOMBA")
                    {

                        stileDescr1 += "_BOMBA";
                        stileDescr2 += "_BOMBA";
                        stileDescr3 += "_BOMBA";
                        stileDescr4 += "_BOMBA";

                        stile_prezzo_promo = "PREZZO_PROMO_BOMBA";
                        stile_prezzo_kgl = "PREZZO_KGL_BOMBA";

                        if (peso == 1000 || peso == 1)
                        {
                            interprete.removeCompiledField("prezzo_promo_kgl");
                        }

                    }
                    else if (codiceBox == "BOX_GASTRO")
                    {
                        stile_prezzo_promo = "PREZZO_PROMO_GASTRO";
                        prezzo_promo = MathExt.Round(prezzo_promo / 10, 2, MidpointRounding.AwayFromZero);
                        stile_prezzo_kgl = "PREZZO_KGL_GASTRO";
                    }
                    else
                    {
                        stile_prezzo_promo = "PREZZO_PROMO_STD";
                        if (peso == 1000 || peso == 1 || prezzo_promo_kgl == 0)
                        {
                            interprete.removeCompiledField("prezzo_promo_kgl");
                        }
                    }


                    interprete.assignCompiledField("prezzo_promo", stile_prezzo_promo, $"€ {MathExt.DecimalRoundToString(prezzo_promo)}");

                    if (um != "")
                    {
                        if (prezzo_promo_kgl_str == "")
                        {
                            prezzo_promo_kgl_str = $"<{stile_prezzo_kgl}>€ {MathExt.DecimalRoundToString(prezzo_promo_kgl)} {((um == "KG" || um == "GR") ? "AL KG" : "AL LT")}</{stile_prezzo_kgl}>";
                        }

                        interprete.assignCompiledField("prezzo_promo_kgl", "", prezzo_promo_kgl_str);
                    }

                    //if (prezzo_continuo > 0)
                    //{
                    //    if (prezzo_continuo != prezzo_promo)
                    //    {

                    //        string prezzo_continuo_str = $"<prezzo continuo>invece di € {MathExt.DecimalRoundToString(prezzo_continuo)} {((um == "KG") ? "al kg" : "")}</prezzo continuo>";
                    //        if (prezzo_info_pack != "")
                    //        {
                    //            prezzo_continuo_str = $"<prezzo continuo>invece di € {MathExt.DecimalRoundToString(prezzo_continuo)} a conf</prezzo continuo>";
                    //        }
                    //        interprete.assignCompiledField("prezzo_continuo", "", prezzo_continuo_str);
                    //    }
                    //    else
                    //    {
                    //        interprete.removeCompiledField("prezzo_continuo");
                    //    }
                    //}

                    if (categoria.Contains("DETERSIVI - IGIENE"))
                    {
                        interprete.removeCompiledField("prezzo_promo_kgl");
                    }

                    interprete.assignCompiledField(GLOBAL_VARIABLES_FICO.compiledFieldKeyMastro, "", $"{mastro}");

                    #endregion


                    #region descrizione


                    var descrizione = "";

                    //ATTENZIONE
                    //posizionare la descirizione allineandola a prezzo offerta TOP o 
                    //SCONTO TOP se si tratta di meccanica percentuale o sir
                    var Descrizione1 = "";
                    var Descrizione2 = "";
                    var Descrizione3 = "";
                    var Descrizione4 = "";
                    var Peso = "";
                    var Um = "";
                    string stileParagDescr = "";


                    if (recItem.ContainsKey("descrizione_gruppo"))
                    {
                        Descrizione1 = (recItem["descrizione_gruppo"] as Dictionary<string, object>)["Descrizioni.Descrizione1"].ToString();
                        Descrizione2 = (recItem["descrizione_gruppo"] as Dictionary<string, object>)["Descrizioni.Descrizione2"].ToString();
                        Descrizione3 = (recItem["descrizione_gruppo"] as Dictionary<string, object>)["Descrizioni.Descrizione3"].ToString();
                        Descrizione4 = (recItem["descrizione_gruppo"] as Dictionary<string, object>)["Descrizioni.Descrizione4"].ToString();
                        Peso = recItem["Descrizioni.Peso"].ToString();
                        Um = recItem["Descrizioni.Um"].ToString();
                    }
                    else
                    {
                        Descrizione1 = recItem["Descrizioni.Descrizione1"].ToString();
                        Descrizione2 = recItem["Descrizioni.Descrizione2"].ToString();
                        Descrizione3 = recItem["Descrizioni.Descrizione3"].ToString();
                        Descrizione4 = recItem["Descrizioni.Descrizione4"].ToString();
                        Peso = recItem["Descrizioni.Peso"].ToString();
                        Um = recItem["Descrizioni.Um"].ToString();
                    }



                    Descrizione1 = Descrizione1.Replace("<br>", "\n");
                    Descrizione2 = Descrizione2.Replace("<br>", "\n");
                    Descrizione3 = Descrizione3.Replace("<br>", "\n");
                    Descrizione4 = Descrizione4.Replace("<br>", "\n");


                    descrizione = $"<{stileDescr1}>{Descrizione1}";
                    if (Descrizione1 != "" && (Descrizione2 != "" || Descrizione3 != "" || Descrizione4 != ""))
                        descrizione += " ";
                    descrizione += $"</{stileDescr1}>";

                    descrizione += $"<{stileDescr2}>{Descrizione2}";
                    if (Descrizione2 != "" && (Descrizione3 != "" || Descrizione4 != ""))
                        descrizione += " ";
                    descrizione += $"</{stileDescr2}>";

                    descrizione += $"<{stileDescr3}>{Descrizione3}</{stileDescr3}>";

                    descrizione += $"<{stileDescr4}>";
                    if (Descrizione4 != "")
                        descrizione += $"\n{Descrizione4}";
                    descrizione += $"</{stileDescr4}>";



                    if (specialDescr_max_pezzi_accodato_a_descrizione != "")
                    {
                        descrizione += specialDescr_max_pezzi_accodato_a_descrizione;
                    }
                    if (specialDescr_superprezziOF != "")
                    {
                        descrizione += specialDescr_superprezziOF;
                    }


                    interprete.assignCompiledField("descrizione", stileParagDescr, descrizione);


                    #endregion descrizione

                    //Gestione dei loghi e bolli EXTRA - Messi in automatico secondo regole di agenzia

                    #region loghi/bolli
                    List<LogoBollo> _bolliloghi = new List<LogoBollo>();


                    if (Descrizione1.ToLower().Contains("abbinamento perfetto") || Descrizione3.ToLower().Contains("abbinamento perfetto"))
                    {
                        LogoBollo lAbbPerf = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Logo_abbinamento_perfetto");
                        if (lAbbPerf != null)
                        {
                            _bolliloghi.Add(lAbbPerf);
                        }
                    }

                    if (Descrizione1.ToLower().Contains("scelta verde") || Descrizione3.ToLower().Contains("scelta verde"))
                    {
                        LogoBollo lScVer = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Logo_SceltaVerde");
                        if (lScVer != null)
                        {
                            _bolliloghi.Add(lScVer);
                        }
                    }

                    if (Descrizione1.ToLower().Contains("parmigiano reggiano") || Descrizione2.ToLower().Contains("parmigiano reggiano"))
                    {
                        LogoBollo lPReg = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Logo_Parmigiano_Reggiano");
                        if (lPReg != null)
                        {
                            _bolliloghi.Add(lPReg);
                        }
                    }

                    if (Descrizione1.ToLower().Contains("oltre 20 mesi") || Descrizione3.ToLower().Contains("oltre 20 mesi"))
                    {
                        LogoBollo lOl20 = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Logo_Riserva_Oltre20Mesi");
                        if (lOl20 != null)
                        {
                            _bolliloghi.Add(lOl20);
                        }
                    }

                    if (Descrizione1.ToLower().Contains("grana padano") || Descrizione2.ToLower().Contains("grana padano"))
                    {
                        LogoBollo lGP = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Logo_Grana_Padano");
                        if (lGP != null)
                        {
                            _bolliloghi.Add(lGP);
                        }
                    }

                    if (Descrizione1.ToLower().Contains("passo dopo passo") || Descrizione2.ToLower().Contains("passo dopo passo") || Descrizione3.ToLower().Contains("passo dopo passo"))
                    {
                        LogoBollo lPdP = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Logo_PassoDopoPasso");
                        if (lPdP != null)
                        {
                            _bolliloghi.Add(lPdP);
                        }
                    }

                    if (Descrizione2.ToLower() == "despar")
                    {
                        LogoBollo lDesp = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Logo_ScegliDespar");
                        if (lDesp != null)
                        {
                            _bolliloghi.Add(lDesp);
                        }
                    }

                    if (Descrizione2.ToLower().Contains("molly"))
                    {
                        LogoBollo lMolly = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Logo_Molly");
                        if (lMolly != null)
                        {
                            _bolliloghi.Add(lMolly);
                        }
                    }

                    if (marchio.Contains("ITA"))
                    {
                        LogoBollo lIta = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Logo_BandieraItalia");
                        if (lIta != null)
                        {
                            _bolliloghi.Add(lIta);
                        }
                    }

                    if (Descrizione2.Contains("Melinda"))
                    {
                        LogoBollo lMel = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Logo_Melinda");
                        if (lMel != null)
                        {
                            _bolliloghi.Add(lMel);
                        }

                    }

                    recItem[GLOBAL_VARIABLES.keyFotoExtraAuto] = _bolliloghi;

                    #endregion


                    var fields = interprete.getFields();
                    recItem["compiledFields"] = fields.compiledFields;
                    recItem["deletedFields"] = fields.deletedFields;
                    interprete.clearInterpreter();

                    //Se si tratta di un gruppo, fisso le info sottogruppo e sgancio il singolo
                    if (codice_gruppo!=codice_referenza)
                    {
                        recItem[GLOBAL_VARIABLES_FICO.keySottoGruppo] = codice_gruppo;

                        var sottogruppo = RefCloner.CopiaETrasformaObjSingoloInObjSottogruppo(recItem);

                        if (recItem.ContainsKey(GLOBAL_VARIABLES.keyXMLDescrizioneGruppo))
                        {
                            recItem.Remove(GLOBAL_VARIABLES.keyXMLDescrizioneGruppo);
                        }

                        //Alterazione dati del sottogruppo secondo logiche Edro21, se necessario
                        //Code
                        //Devo recuperare gli elementi singoli del gruppo dalla lista di origine
                        List<Dictionary<string, object>> elementiSottogruppo = tracciato.Where(t => t.recordInTracciato[GLOBAL_VARIABLES_FICO.keyCodiceGruppo].ToString() == codice_gruppo).Select(s => s.recordInTracciato).ToList();
                        string selezionePSDelSottogruppo = eseguiAutoSelezioneGruppo(elementiSottogruppo, null);
                        List<Dictionary<string, object>> gruppoPSDelSottogruppo = JsonConvert.DeserializeObject<List<Dictionary<string, object>>>(selezionePSDelSottogruppo);

                        if (codice_gruppo.Contains("2142651"))
                        {
                            "debug".ToString();
                        }

                        if (gruppoPSDelSottogruppo.Count > 0)
                        {
                            //Modifico foto primaria che automaticamente il OCRE identifica in Foto.Nome senza stare a ricontrollare lo stato selezione
                            sottogruppo[GLOBAL_VARIABLES_FICO.keyFotoNome] = gruppoPSDelSottogruppo.Where(g => g.ContainsKey(keyStatoSelezione) && Byte.Parse(g[keyStatoSelezione].ToString())==(Byte)TipoSelezioneMenabo.Primaria).FirstOrDefault()[GLOBAL_VARIABLES_FICO.keyFotoNome];
                        }

                        //Alterazione dati del sottogruppo secondo logiche Edro21, se necessario
                        //NAMING SINGOLO
                        artInKit.sottogruppo = sottogruppo;
                        artInKit.forzaSoloUscitaSottogruppo = true;//Questo permette di dire al CORE che deve uscire solo il sottogruppo e non anche la ref singola

                        List<ArticoloInKitExportName> _names_sott = new List<ArticoloInKitExportName>();
                        foreach (TipoDiExport tItem in tipiExportDelKit)
                        {
                            IstantaLib.ArticoloInKitExportName codifica = new IstantaLib.ArticoloInKitExportName();
                            codifica.guidIdTipoExport = tItem.guidID;
                            codifica.nomeFile = NamingConventionUtility.Decode(tItem, promoContext, tracciatoContext, kit, acpvDB, ncDB, formatiDB, artInKit.sottogruppo, null, null);
                            _names_sott.Add(codifica);
                        }

                        artInKit.sottogruppo[GLOBAL_VARIABLES_FICO.keyFicoNames] = _names_sott;



                    }


                    //NAMING SINGOLO
                    List<ArticoloInKitExportName> _names = new List<ArticoloInKitExportName>();
                    foreach (TipoDiExport tItem in tipiExportDelKit)
                    {
                        IstantaLib.ArticoloInKitExportName codifica = new IstantaLib.ArticoloInKitExportName();
                        codifica.guidIdTipoExport = tItem.guidID;
                        codifica.nomeFile = NamingConventionUtility.Decode(tItem, promoContext, tracciatoContext, kit, acpvDB, ncDB, formatiDB, artInKit.recordInTracciato, null, null);
                        _names.Add(codifica);
                    }

                    artInKit.recordInTracciato[GLOBAL_VARIABLES_FICO.keyFicoNames] = _names;


                    result.liste[0].Records.Add(tracciato[i]);



                }


                if (counter <= 0)
                {
                    result.errors += "Nessun articolo della lista corrisponde ai requisiti di esportazione. Controllare la lista e ripetere l'importazione";
                }


            }
            catch (Exception ex)
            {
                result.errors = ex.ToString();
            }


            return result;
        }

        public string ordinaLista(List<Dictionary<string, object>> listRecs, string pathOrdinamentoLista)
        {
            throw new NotImplementedException();
        }

        public AnalisiPorpagazioneResult analizzaPropagazionePerCambioMeta(AnalisiPorpagazione analisiAzione, List<CambioMetaRecordTracciatoAzione> azione)
        {
            AnalisiPorpagazioneResult res = new AnalisiPorpagazioneResult();
            res.priorita = PrioritaPropagazione.Safe;
            return res;
        }

        public AnalisiPorpagazioneResult analizzaPropagazionePerModificaCampiOfferta(AnalisiPorpagazione analisiAzione, RevisioneCampiOffertaFromIndd azione)
        {
            AnalisiPorpagazioneResult res = new AnalisiPorpagazioneResult();
            res.priorita = PrioritaPropagazione.Safe;
            return res;
        }

        public AnalisiPorpagazioneResult analizzaPropagazionePerRevisione(AnalisiPorpagazione analisiAzione, RevisioneDescrizione azione)
        {
            AnalisiPorpagazioneResult res = new AnalisiPorpagazioneResult();
            res.priorita = PrioritaPropagazione.Safe;
            return res;
        }

        public List<q_records_per_getListaRevisione> specificaInOutVol(List<q_records_per_getListaRevisione> tracciatoSingoli, List<q_records_per_getListaRevisione> listaOrigine)
        {
            return tracciatoSingoli;
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
            throw new NotImplementedException();
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
    }
}
