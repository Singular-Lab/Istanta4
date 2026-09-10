using System;
using System.CodeDom;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using AgenziaLib.Tipi;
using IstantaLib;
using Newtonsoft;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace AgenziaLib
{
    public class Interpreter
    {
        public Interpreter()
        {

        }

        private string traduciNomeMeccanica(string meccanica_excel)
        {
            try
            {
                string traduzione = meccanica_excel.Replace("%", "PERCENTO");
                traduzione = traduzione.Replace("+ ", "");
                traduzione = traduzione.Replace(" ", "_");
                return traduzione.ToUpper();
            }
            catch
            {

            }

            return "";
        }

        public string interpretaMeccanica(Dictionary<string, object> tracciato, Dictionary<string, object> rec, List<Dictionary<string, object>> schema_food_nofood)
        {
            try
            {
                string meccanica_originale = rec["meccanica_originale"].ToString();
                string meccanica = traduciNomeMeccanica(meccanica_originale);

                decimal peso = Decimal.Parse(rec["peso"].ToString());
                string um_fatt = rec["um_fatt"].ToString();
                string myTema = rec["tema"].ToString();
                string tipo_tema = rec["tipo_tema"].ToString();
                string reparto = rec["reparto"].ToString();
                string tipo_volantino = rec["tipo_volantino"].ToString();
                string sconto_agenzia = rec["sconto_agenzia"].ToString();
                string range_1 = rec["range_1"].ToString();
                string range_2 = rec["range_2"].ToString();
                string punti_1 = rec["punti_1"].ToString();
                string punti_2 = rec["punti_2"].ToString();

                Byte tipo_tracciato = 1;//Al momento trattiamo solo VOL

                if (meccanica != "")
                {

                    string settore = rec["settore"].ToString();
                    string segmento = rec["segmento"].ToString();
                    string unita = "";


                    Dictionary<string, object> itemFood = schema_food_nofood.Where(s => s["REPARTO"].ToString() == reparto &&
                    s["SETTORE"].ToString() == settore &&
                    s["SEGMENTO"].ToString() == segmento).FirstOrDefault();


                    if (itemFood != null && itemFood["FOOD"].ToString().ToLower() == "x")
                    {
                        if (peso != 1 && peso != 0.1M)
                        {
                            if (um_fatt.ToLower() != "peso")
                            {
                                unita = "_KgL";
                            }
                        }
                    }



                    string tipo_materiale = tracciato["tipo_materiale"].ToString();

                    if (tipo_materiale == "sott")
                        meccanica = "sottocosto";


                    #region controllo tema

                    string tema = "";
                    if (tipo_tema != null && ((tipo_tracciato == 1 && tipo_materiale != "mz") || tipo_tracciato != 1))
                    {
                        string tipo_tema_check = tipo_tema.ToLower();
                        string tema_check = "";
                        if (myTema != null)
                            tema_check = myTema.ToLower();


                        if (tipo_tracciato != 2 || (tipo_tracciato == 2 && tipo_materiale != "mz" && tipo_materiale != "fec"))
                        {
                            if (tipo_tema_check.IndexOf("focus") >= 0 && tema_check.IndexOf("ffresc.local.") < 0)
                            {
                                if (tipo_materiale != "mc" &&
                                    tipo_materiale != "bb" &&
                                    tipo_tracciato != 3)
                                {
                                    //Trovato focus
                                    if (tema_check.IndexOf("s % d") >= 0
                                        && tipo_materiale != "fec" && tipo_materiale != "mc" && tipo_materiale != "bb")
                                    {
                                        //Trovato sapori
                                        if (tipo_tracciato != 2)
                                            tema = "_sapori";
                                    }
                                    else if (tipo_tracciato == 1)
                                    {
                                        if ((tema_check.Contains("puglia") ||
                                         tema_check.Contains("sicilia") ||
                                         tema_check.Contains("trentino") ||
                                         tema_check.Contains("fsicilia") ||
                                         tema_check.Contains("ftrent.a.adig") ||
                                         tema_check.Contains("emiliaromagn") ||
                                         tema_check.Contains("emilia")) && tipo_materiale != "mz")
                                        {
                                            tema = "_regionale";
                                        }
                                        else
                                            tema = "_focus";


                                        if (tipo_tema_check == "focus" && tema_check.IndexOf("fbuono dpaese") >= 0)
                                        {
                                            //Trovato B. del paese
                                            tema = "_bdp";
                                        }
                                        else if (tipo_tema_check == "focus" && tema_check.IndexOf("fscelte benes") >= 0)
                                        {
                                            //Trovato S. di benessere
                                            tema = "_sdb";
                                        }
                                    }
                                }
                            }
                            else if ((tipo_tema_check.IndexOf("mini coll") >= 0 ||
                                tipo_tema_check.IndexOf("minicoll") >= 0)
                                && tipo_materiale != "bb" &&
                                tipo_tracciato != 3)
                            {
                                tema = "_minicoll";
                            }
                            else if ((tipo_tema_check.IndexOf("extra bonus") >= 0 ||
                                tipo_tema_check.IndexOf("extrabonus") >= 0 ||
                                tipo_tema_check.IndexOf("punti extra") >= 0 ||
                                tipo_tema_check.IndexOf("puntiextra") >= 0)
                                && tipo_materiale != "mc")
                            {
                                tema = "_bonus";
                            }
                            else if (tipo_tema_check.IndexOf("parafarm") >= 0 ||
                                tipo_tema_check.IndexOf("pfarmacia") >= 0
                                && tipo_materiale != "mc" && tipo_materiale != "bb" &&
                                tipo_tracciato != 3)
                            {
                                tema = "_parafarmacia";
                            }
                            else if ((tipo_tema_check.IndexOf("event") >= 0 || tema_check.IndexOf("ffresc.local.") >= 0) && tipo_tracciato == 1
                                && tipo_materiale != "mc" && tipo_materiale != "bb" &&
                                tipo_tracciato != 3)
                            {
                                //Trovato evento
                                tema = "_evento";
                            }
                            else if (tipo_tema_check.IndexOf("ricorrenz") >= 0 && tipo_tracciato == 1
                                && tipo_materiale != "mc" && tipo_materiale != "bb" &&
                                tipo_tracciato != 3)
                            {
                                //Trovato ricorrenza
                                tema = "_ricorrenza";
                            }

                            if (reparto == "86" && tipo_tracciato != 2)
                                tema = "_parafarmacia";
                        }

                        if (tipo_tema_check.IndexOf("sottocosto") >= 0
                            && tipo_materiale != "fec" && !tipo_volantino.ToLower().Contains("fuori volantino"))
                        {
                            meccanica = "sottocosto";
                        }

                    }

                    if (myTema.ToLower() == "msec.meta pr" && (meccanica_originale == "NM FID" || meccanica_originale == "NM Mix FID"))
                    {
                        meccanica = "50sulSecondo";
                    }

                    if (
                        (tipo_tracciato == 1 && (tipo_materiale == "vol" || tipo_materiale == "ap")) ||
                        (tipo_tracciato == 2 && (tipo_materiale == "vol" || tipo_materiale == "ap"))
                        )
                    {
                        if (myTema.ToLower() == "1-2-3 euro" ||
                            myTema.ToLower() == "m1-2-3 euro" ||
                            myTema.ToLower() == "mfasce euro")
                        {
                            tema = "_123";
                        }
                    }


                    #endregion

                    #region controllo regole

                    string codice_area = tracciato["codice_area"].ToString();

                    //int gruppo_sito = tItem.gruppo_siti;
                    bool area_valida = (codice_area != "");//entities.aree.Where(a => a.gruppo_siti == gruppo_sito).Count() > 0;

                    string regola = "";


                    if (meccanica != "sottocosto")
                    {

                        #region regola 50al50
                        //if (tItem.tracciati.promozione_50_al_50.HasValue && tItem.tracciati.promozione_50_al_50.Value)
                        //{
                        //Siamo nel caso 50 al 50
                        //ma devo verificare se il record rispetta la prommozione.
                        //CONAD deve ancora dare le regole precise, per il momento abbiamo solo supposto                    

                        if ((meccanica == "PERCENTO_MM_ALL" || meccanica == "PERCENTO_MM") &&
                            (myTema.ToLower().IndexOf("mt.prod.50%fi") >= 0 ||
                             myTema.ToLower().IndexOf("m50pr.50%fid") >= 0 ||
                             myTema.ToLower().IndexOf("m50prod.50%fi") >= 0 ||
                             myTema.ToLower().IndexOf("m50prodsc50%") >= 0))
                        {
                            if (meccanica == "PERCENTO_MM_ALL")
                            {
                                /*if (combinazione_pop != null && combinazione_pop.dup_fidelity)
                                {
                                    meccanica = "50al50Fid";
                                }
                                else
                                {*/
                                meccanica = "50al50Norm";
                                //}
                            }
                        }
                        else if ((meccanica == "PERCENTO_FID" || meccanica == "PERCENTO_FID_ALL") &&
                             (myTema.ToLower().IndexOf("mt.prod.50%fi") >= 0 ||
                             myTema.ToLower().IndexOf("m50pr.50%fid") >= 0 ||
                             myTema.ToLower().IndexOf("m50prod.50%fi") >= 0 ||
                             (myTema.ToLower().IndexOf("m50prodsc50%") >= 0 && tipo_tracciato == 2)))
                        {
                            //NOTA: m50prodsc50% NON varia nel caso di FID MA sullo script ID invece deve essere prevista la condizione
                            if (meccanica == "PERCENTO_FID_ALL")
                                meccanica = "50al50Fid";
                        }
                        //}

                        #endregion

                        #region regola mercato

                        //Response.Write("Interpreto meccanica " + tipo_tracciato + "," + tema+"<br>");
                        if (tipo_tracciato == 1 &&
                            tema == "" &&
                            meccanica != "50al50Norm" && meccanica != "50al50Fid" &&
                            tipo_materiale != "mz" && tipo_materiale != "mc" && tipo_materiale != "bb")
                        {
                            //Response.Write("Reparto " + tItem.reparto + "<br>");
                            //Controllo dei reparti compresi nella regola
                            if (reparto == "25" ||
                                reparto == "27" ||
                                reparto == "29" ||
                                reparto == "31" ||
                                reparto == "33"
                                )
                            {
                                regola = "_mercato";
                            }
                        }

                        #endregion

                        #region regola boxetto

                        //Controllo del gruppo sito con area 
                        if (area_valida && meccanica != "50al50Norm" && meccanica != "50al50Fid" &&
                             tipo_materiale != "fec" && tipo_materiale != "mc" && tipo_materiale != "bb" &&
                                tipo_tracciato != 3)
                        {
                            //Ok il codice area corrisponde al suo relativo gruppo sito
                            //Cosa che deve SEMPRE tornare a meno che CONAD non commetta un errore
                            //nella scrittura del tracciato

                            if (
                                (codice_area.IndexOf("SA") == 2) &&
                                peso == 1 &&
                                um_fatt.ToLower() == "peso"
                                )
                            {
                                //Ok, l'area c'è
                                if (reparto == "25")
                                {
                                    //Ok il settore è quello considerato nella regola
                                    regola += "_boxetto";
                                }
                            }
                        }

                        if (area_valida && meccanica != "50al50Norm" && meccanica != "50al50Fid" &&
                            (codice_area.IndexOf("TO") == 2 ||
                            codice_area.IndexOf("SL") == 2 ||
                            codice_area.IndexOf("LA") == 2 ||
                            codice_area.IndexOf("EM") == 2 ||
                            codice_area.IndexOf("PI") == 2 ||
                            codice_area.IndexOf("LI") == 2) &&
                                (settore == "2507" || settore == "2505") && peso == 1 &&
                                um_fatt.ToLower() == "peso" && tipo_tracciato != 3)
                        {
                            //if ((tipo_tracciato==1 && tipo_materiale!="mz") || tipo_tracciato != 1)
                            regola += "_boxetto";
                        }


                        #endregion

                        #region regola _ofalkg

                        if (peso > 1 &&
                            tipo_tracciato != 3 &&
                            (tipo_tracciato != 1 || (tipo_tracciato == 1 && tipo_materiale != "mc" && tipo_materiale != "bb")) &&
                            (tipo_tracciato != 2 || (tipo_tracciato == 2 && tipo_materiale != "mc" && tipo_materiale != "bb"))
                            )
                        {
                            if (reparto == "33")
                            {

                                regola += "_ofaconf";
                            }
                        }

                        #endregion

                        #region regola prodalkg sir_sconto e boxetto

                        //Response.Write("tipo_tracciato... " + tipo_tracciato);

                        decimal sc_agenzia;
                        Decimal.TryParse(sconto_agenzia, out sc_agenzia);

                        if (tipo_tracciato == 1 &&
                            codice_area.IndexOf("LA") == 2)
                        {
                            if (meccanica == "TP_MM" && (Decimal.TryParse(sconto_agenzia, out sc_agenzia) && sc_agenzia != 0))
                            {
                                if (reparto != "29" &&
                                            reparto != "31" &&
                                            reparto != "33" &&
                                            codice_area.ToLower() != "mgla" && codice_area.ToLower() != "cnla" &&
                                            codice_area.ToLower() != "ssla" && codice_area.ToLower() != "cyla" &&
                                            codice_area.ToLower() != "avla" && codice_area.ToLower() != "gsla" &&
                                            codice_area.ToLower() != "psla" && codice_area.ToLower() != "ipla" &&
                                            codice_area.ToLower() != "gssl" && codice_area.ToLower() != "mala" &&
                                            codice_area.ToLower() != "scla")
                                {
                                    meccanica = "sir_sconto";
                                }
                            }
                        }
                        else if (tipo_tracciato == 2)
                        {
                            //Response.Write("meccanica... " + meccanica);

                            if (meccanica == "TP_MM")
                            {
                                if (
                                    Decimal.TryParse(sconto_agenzia, out sc_agenzia) && sc_agenzia != 0 &&
                                    (meccanica != "50al50Norm" && meccanica != "50al50Fid")
                                    )
                                {
                                    //if (combinazione_pop == null || (combinazione_pop != null && !combinazione_pop.dup_fidelity))
                                    //{
                                    meccanica = "sir_sconto";
                                    //}
                                    /*}
                                    else if (combinazione_pop != null && combinazione_pop.dup_fidelity)
                                    {

                                        meccanica = "sir_sconto";
                                    }*/
                                }
                            }


                            #region regola cambiata il 14/08/2014 alle 16:01

                            ////Nuove regole inserite il 14/08/2014 alle 16:01
                            if (um_fatt.ToLower() == "peso"
                                && regola == "" &&
                                tipo_materiale != "mc" &&
                                tipo_materiale != "bb")
                            {
                                if (codice_area.IndexOf("SA") == 2)
                                {
                                    if (reparto == "25")
                                    {
                                        regola = "_boxetto";
                                    }
                                    else
                                    {
                                        regola = "_prodalkg";
                                    }
                                }
                                else if (codice_area.IndexOf("TO") == 2 &&
                                settore == "2507" && peso == 1 &&
                                um_fatt.ToLower() == "peso" && tipo_materiale == "mz")
                                {
                                    regola = "_boxetto";
                                }
                                else
                                {
                                    regola = "_prodalkg";
                                }
                            }

                            #endregion

                        }

                        #endregion

                        #region controllo meccanica POP fidelity

                        if (tipo_tracciato == 2)
                        {

                            if (regola.IndexOf("_boxetto") < 0 && regola.IndexOf("_prodalkg") < 0)
                            {
                                if ((reparto == "29" || reparto == "33") &&
                                        um_fatt.ToLower() == "pezzo" &&
                                        meccanica_originale == "TP MM" && sc_agenzia != 0)
                                {
                                    meccanica = "TP_FID";//meccanica = "sir_sconto"; //cambiato il 20/12/2018 su richiesta di Laura
                                }
                            }

                            if (tipo_materiale == "fec" &&
                                (reparto == "24" ||
                                reparto == "27" ||
                                reparto == "29" ||
                                reparto == "31" ||
                                reparto == "33"
                                ) &&
                                um_fatt.ToLower() == "peso"
                                )
                            {
                                regola = "_prodalkg";
                            }


                        }

                        #endregion

                        #region 1,2,3 EURO

                        if ((meccanica == "NM_MM" || meccanica == "NM_MIX_MM")
                            && tema == "_123" &&
                            peso == 0.5M)
                        {
                            unita = "";
                        }
                        #endregion

                    }

                    if (tema == "_bonus" || tema == "_minicoll")
                    {
                        if (punti_2 == null || punti_2 == "")
                        {
                            if (meccanica == "PERCENTO_FID_ALL")
                            {
                                meccanica = "PUNTI_PERCENTO";
                            }
                            else if (meccanica == "TP_FID")
                            {
                                meccanica = "PUNTI_TP";
                            }
                        }
                        else if (punti_2 != null && punti_2 != "" && range_2 != null && range_2 != "")
                        {
                            if (meccanica == "PERCENTO_FID_ALL")
                            {
                                meccanica = "PUNTI_MULTI_PERCENTO";
                            }
                            else if (meccanica == "TP_FID")
                            {
                                meccanica = "PUNTI_MULTI_TP";
                            }
                        }
                    }


                    #endregion


                    string result = meccanica + unita + tema + regola;

                    return result;
                }
                else
                {
                    return "";
                }
            }
            catch (Exception ex)
            {
                return ex.ToString();
            }
        }

        public string getNoteCrocettamento(Dictionary<string, object> rec)
        {
            string note = "test";
            return note;
        }

        public string getNotaEsempio(List<Dictionary<string, object>> group, string u_fatt)
        {
            string result = "";

            if (group.Where(g => g["esempio"].ToString() != "").Count() > 0)
            {
                result = "OK";
            }

            return result;
        }

        public string getCodiceScatto(Dictionary<string, object> rec)
        {
            string cat = (rec.ContainsKey("categoria") ? rec["categoria"].ToString() : "");
            string rep = (rec.ContainsKey("reparto") ? rec["reparto"].ToString() : "");
            string set = (rec.ContainsKey("settore") ? rec["settore"].ToString() : "");
            string rs = (rec.ContainsKey("ragione_sociale") ? rec["ragione_sociale"].ToString() : "");
            string prest = (rec.ContainsKey("prestazione") ? rec["prestazione"].ToString() : "");
            string spec = (rec.ContainsKey("speciale") ? rec["speciale"].ToString() : "nospecial");

            string result = String.Format("{0}_{1}_{2}_{3}_{4}_{5}", spec, cat, rep, set, rs, prest);
            return result;
        }

        public string isGruppo(string tipo_record)
        {
            return (tipo_record == "AVV" ? "si" : "no");
        }

        public string isRegionale(string descr)
        {
            return (descr != "" ? "si" : "no");
        }

        public string isPilota(string foto)
        {
            return (foto.ToLower() == "s" ? "si" : "no");
        }

        public string getCodiceGruppo(List<Dictionary<string, object>> group)
        {
            string cod = "";
            foreach (Dictionary<string, object> item in group)
            {
                if (cod != "")
                    cod += ",";

                cod += item["codice_referenza"].ToString();
            }
            return cod;
        }

        //xCoop.FI
        /*
        public string getBollini(Dictionary<string, object> rec)
        {
            string boll = "";

            string segmento = rec["segmento"].ToString().ToLower();
            string descrizione = rec["descrizione"].ToString().ToLower();
            string sottomarchio = rec["sottomarchio"].ToString().ToLower();
            string reparto = rec["reparto"].ToString().ToLower();

            bool sl = (rec["is_senzalattosio"].ToString().ToLower()=="x");
            bool sg = (rec["is_senzaglut"].ToString().ToLower()=="x" || rec["is_senzaglut2"].ToString().ToLower() == "x" || rec["is_senzaglut3"].ToString().ToLower() == "x");
            bool vg = (rec["is_vegano"].ToString().ToLower()=="x");
            bool pt = (rec["is_prod_toscana"].ToString().ToLower()=="x" || rec["is_prod_toscana2"].ToString().ToLower() == "x");

            if (segmento.Contains("senza glutine"))
                boll += "senza glutine,";
            if (descrizione.Contains("igp"))
                boll += "igp,";
            if (descrizione.Contains(" dop "))
                boll += "dop,";
            if (descrizione.Contains(" no palma"))
                boll += "no palma,";
            if (sottomarchio.Contains("vivi verde"))
                boll += "viviverde,";
            if (reparto.Contains("surgelati"))
                boll += "surgelati,";
            if (sl)
                boll += "senza lattosio,";
            if (sg)
                boll += "senza glutine,";
            if (vg)
                boll += "vegano,";
            if (pt)
                boll += "prodotto in toscana,";

            if (boll != "")
                boll = boll.Substring(0, boll.LastIndexOf(","));

            return boll;
        }

        */
        //xDOC ROMA
        public List<string> checkArea(string rm, string rv, string rp)
        {
            List<string> result = new List<string>();

            if (rm.ToLower() == "true")
            {
                result.Add("MARKET");
                result.Add("TORRINO");
            }
            if (rv.ToLower() == "true")
            {
                result.Add("ORO");
            }
            if (rp.ToLower() == "true")
            {
                result.Add("PROSSIMITA");
            }

            return result;
        }

        public string getRepartoParafarmacia()
        {
            return "Parafarmacia";
        }

        #region  Sviluppo con modello Edro per Suite Istanta 2.0
       
        public string importaVolantino(Dictionary<string, string> formRequest, List<Dictionary<string, object>> tracciato, string pathAree, string pathOrdinamentoLista)
        {
            ImportResult impResult = new ImportResult();

            List<Tracciato> result = new List<Tracciato>();
            string errors = "";

            try
            {

                bool flag_error = false;
                Byte imp_tipo_tracciato = Byte.Parse(formRequest["cmbTipoTracciato"].ToString());

                JObject o1 = JObject.Parse(File.ReadAllText(pathAree));
                DbAree areeDB = o1.ToObject<DbAree>();
                List<AreaItem> aree = areeDB.source;

                JObject o2 = JObject.Parse(File.ReadAllText(pathOrdinamentoLista));
                DbOrdinamento ordDB = o2.ToObject<DbOrdinamento>();
                List<Ordinamento> schemaOrd = ordDB.source;

                if (!formRequest.ContainsKey("cmbMaterialeVol"))
                {
                    formRequest["cmbMaterialeVol"] = "vol";//.ToString();
                }

                string sigla_materiale = formRequest["cmbMaterialeVol"].ToString();
                if (imp_tipo_tracciato==(Byte)TipoImportazione.PoP)
                {
                    sigla_materiale = formRequest["cmbMaterialePoP"].ToString();
                }
                else if (imp_tipo_tracciato == (Byte)TipoImportazione.Manifesto)
                {
                    sigla_materiale = formRequest["cmbMaterialeManifesto"].ToString();
                }

                Int32 gruppo_siti = 0;
                string codice_area_custom = "";
                if ((sigla_materiale.ToLower().IndexOf("ap") == 0) || (sigla_materiale.ToLower().IndexOf("mz") == 0))
                {

                    Int16 id_area_custom;
                    AreaItem a_custom_item = null;

                    if (Int16.TryParse(formRequest["cmbCanaleArea"].ToString(), out id_area_custom))
                    {
                        //Ho selezionato una custom
                        if (id_area_custom > 0)
                        {
                            a_custom_item = aree.Where(a => a.Id == id_area_custom).FirstOrDefault();
                            if (a_custom_item != null)
                                gruppo_siti = a_custom_item.GruppoSiti;
                        }

                    }



                    if (sigla_materiale.ToLower() == "mz")
                    {
                        sigla_materiale += "_" + formRequest["MzApName"];
                        if (a_custom_item != null)
                        {
                            sigla_materiale += "_" + a_custom_item.Area.Substring(0, 2) + "_" + a_custom_item.Area.Substring(2, 2);
                        }
                        else
                        {
                            errors = "CANALE/AREA MAGAZINE non trovato per il gruppo siti " + gruppo_siti;
                        }
                    }
                    else
                    {
                        sigla_materiale += "_" + formRequest["MzApName"];
                    }

                    if (a_custom_item != null)
                        codice_area_custom = a_custom_item.Area;
                }


                int counter = 0;
                int counter2 = 0;

                DateTime tracciato_date_da = new DateTime(1900, 1, 1);
                DateTime tracciato_date_a = new DateTime(1900, 1, 1);



                Dictionary<string, int> cod_scatto_index = new Dictionary<string, int>();



                string report_read_error = "";

                bool area_found = false;
                Int16 perc_prog_lettura = 0;

                Tracciato tracciato_item = null;
                


                errors += "Leggo lista di " + tracciato.Count + " refs\n";

                double media_processo_item = 0;
                int count_items = 0;

                for (int i = 0; i < tracciato.Count; i++)
                {
                    DateTime inizio_processo_item = DateTime.Now;

                    try
                    {

                        Dictionary<string, object> item = tracciato[i];

                        //dynamic myObject = new DynamicDictionaryWrapper(item);


                        string codice_area = "";
                        string codice_area_originale_xls = "";
                        string codice_area_originale_xls_x_pop = "";

                        //codice_area = item["area"].ToString();
                        //JsonConvert.DeserializeObject<List<Area>>()
                        //Response.Write(cmb_area_custom.SelectedIndex +" SIGLA " + sigla_materiale.ToLower() + "<br>");
                        if (codice_area_custom == "")
                        {
                            Dictionary<string, object> area = item["Area"] as Dictionary<string, object>;
                            codice_area = area["Codice"].ToString();

                            if (!area.ContainsKey("Id"))
                            {
                                errors += "CANALE/AREA non trovato: " + codice_area;
                                break;
                            }

                            gruppo_siti = (Int32)area["GruppoSiti"];

                        }
                        else
                        {
                            codice_area = codice_area_custom;
                        }

                        //errors += "Cod area  " + codice_area  + " GS " + gruppo_siti+"\n";

                        codice_area_originale_xls = codice_area;
                        codice_area_originale_xls_x_pop = codice_area_originale_xls;

                        if (codice_area_originale_xls.Length > 10)
                            codice_area_originale_xls = codice_area_originale_xls.Substring(0, 10);


                        if (codice_area_originale_xls_x_pop.Length > 10)
                            codice_area_originale_xls_x_pop = codice_area_originale_xls_x_pop.Substring(0, 10);



                        DateTime local_data_da_dt = (DateTime)item["data_da"];

                        DateTime local_data_a_dt = (DateTime)item["data_a"];


                        DateTime d_tracciato = local_data_da_dt;

                        if (codice_area_originale_xls.ToLower() == "gsto")
                            codice_area_originale_xls_x_pop = "AVTO";
                        if (codice_area_originale_xls.ToLower() == "gsla")
                            codice_area_originale_xls_x_pop = "AVLA";
                        if (codice_area_originale_xls.ToLower() == "gssa")
                            codice_area_originale_xls_x_pop = "AVSA";


                        if (codice_area == "")
                            break;

                        tracciato_date_da = local_data_da_dt;
                        tracciato_date_a = local_data_a_dt;


                        if (codice_area != "")
                        {

                            string iniziativa = item["iniziativa"].ToString();
                            string descr_iniziativa = item["descr_iniz"].ToString();

                            //Posso identificare il tipo di volantino!
                            //Area item_area = aree.Where(a => a.gruppo_siti == gruppo_siti).FirstOrDefault();

                            string nome_esportazione = d_tracciato.ToString("dd-MM-yy");


                            if (codice_area.Length == 4 &&
                                (sigla_materiale.ToLower().IndexOf("mz") != 0 && sigla_materiale.ToLower().IndexOf("ap") != 0))
                            {
                                nome_esportazione = sigla_materiale + "_" + codice_area.Substring(0, 2) + "_" + codice_area.Substring(2, 2) + "_" + nome_esportazione;
                                if (imp_tipo_tracciato == (Byte)TipoImportazione.Manifesto && sigla_materiale != "MANIF")
                                    nome_esportazione = "MANIF_" + nome_esportazione;
                            }
                            else
                            {
                                nome_esportazione = sigla_materiale + "_" + nome_esportazione;
                            }



                            area_found = true;


                            int conta = result.Where(l => l.Area == codice_area_originale_xls).Count();
                            if (imp_tipo_tracciato == (Byte)TipoImportazione.PoP && codice_area_originale_xls != codice_area_originale_xls_x_pop)
                            {
                                conta = result.Where(l => l.Area == codice_area_originale_xls_x_pop).Count();
                            }


                            if (conta <= 0)
                            {
                                //Aggiungo il tracciato

                                try
                                {
                                    if (tracciato_date_da.Year > 1900)
                                    {

                                        Tracciato t_item = new Tracciato();

                                        t_item.NomeEsportazione = nome_esportazione /*+ (importazione_coda_nomefile.Text!=""?"_":"") + importazione_coda_nomefile.Text*/;
                                        if (imp_tipo_tracciato == (Byte)TipoImportazione.PoP && codice_area_originale_xls != codice_area_originale_xls_x_pop)
                                            t_item.Area = codice_area_originale_xls_x_pop;
                                        else
                                            t_item.Area = codice_area_originale_xls;

                                        t_item.DataDa = tracciato_date_da;
                                        t_item.DataA = tracciato_date_a;
                                        t_item.DescrizioneIniziativa = descr_iniziativa;
                                        t_item.Iniziativa = iniziativa;
                                        t_item.Tipo = imp_tipo_tracciato;
                                        t_item.Promozione50Al50 = false;

                                        if (imp_tipo_tracciato == (Byte)TipoImportazione.Vol || imp_tipo_tracciato != (Byte)TipoImportazione.PoP)
                                        {
                                            tracciato_item = t_item;
                                        }

                                        result.Add(t_item);
                                    }
                                    else
                                    {
                                        break;
                                    }
                                }
                                catch
                                {
                                    break;
                                }

                            }
                            else
                            {
                                string cod = codice_area_originale_xls;
                                if (imp_tipo_tracciato == 2 && codice_area_originale_xls != codice_area_originale_xls_x_pop)
                                    cod = codice_area_originale_xls_x_pop;

                                //NOTA: Per far in modo che esca sempre il codice area originale da excel per ogni referenza.
                                //nella query liste_x_area bisogna specificare anche "|| l.Key.area==codice_area_originale_xls"
                                tracciato_item = result.Where(l => l.Area == cod).FirstOrDefault();
                            }

                        }



                        if (area_found)
                        {

                            counter2++;

                            #region lettura dettagli signolo record



                            string nome_foto = item["nome_foto"].ToString();// (item["Foto"] as Dictionary<string, object>)["PathFoto"].ToString();

                            Dictionary<string, object> ref_archivio = item["Referenza"] as Dictionary<string, object>;
                            string codice_radice = ref_archivio["Codice"].ToString();

                            if (codice_radice == "")
                            {
                                errors += "Interruzione lettura: Codice Articolo non trovato: " + codice_radice;
                                break;
                            }


                            Dictionary<string, object> descrizioni = item["Descrizioni"] as Dictionary<string, object>;
                            string descrizione1 = descrizioni["Descrizione1"].ToString();
                            descrizione1 = descrizione1.Replace("\n", Environment.NewLine);


                            string tema = item["tema"].ToString();


                            decimal sconto_massmarket = 0;
                            string str_sconto_mm = item["scontoMM"].ToString();
                            str_sconto_mm = str_sconto_mm.Replace(" ", "");
                            Decimal.TryParse(str_sconto_mm, out sconto_massmarket);
                            sconto_massmarket = Math.Abs(sconto_massmarket);
                            item["scontoMM"] = sconto_massmarket;

      

                            decimal sconto_fidelity = 0;
                            string str_sconto_fid = item["scontoFID"].ToString();
                            str_sconto_fid = str_sconto_fid.Replace(" ", "");
                            Decimal.TryParse(str_sconto_fid, out sconto_fidelity);
                            sconto_fidelity = Math.Abs(sconto_fidelity);
                            item["scontoFID"] = sconto_fidelity;

                            string tipo_sconto_fidelity = item["tipo_scontoFID"].ToString();
                            string tipo_sconto_MM = item["tipo_scontoMM"].ToString();

                            string punti1 = item["punti1"].ToString();

                            string range1 = item["range1"].ToString();

                            if (punti1 != "" && range1 == "")
                                range1 = "1";

                            item["range1"] = range1;

                            string punti2 = item["punti2"].ToString();

                            string range2 = item["range2"].ToString();

                            if (punti2 != "" && range2 == "")
                                range2 = "1";

                            item["range2"] = range1;


                          

                            decimal sconto_agenzia = 0;
                            string str_sconto_agenzia = item["sconto_agenzia"].ToString();
                            str_sconto_agenzia = str_sconto_agenzia.Replace(" ", "");
                            Decimal.TryParse(str_sconto_agenzia, out sconto_agenzia);
                            sconto_agenzia = Math.Abs(sconto_agenzia);
                            item["sconto_agenzia"] = sconto_agenzia;


                            string brand = descrizioni["Descrizione2"].ToString();
                            brand = brand.Replace("\n", Environment.NewLine);

                            string tipo_gusto = descrizioni["Descrizione3"].ToString();
                            tipo_gusto = tipo_gusto.Replace("\n", Environment.NewLine);

                            string grammatura = descrizioni["Descrizione4"].ToString();
                            grammatura = grammatura.Replace("\n", Environment.NewLine);

                            if (item["tipo_riga"].ToString()=="AVV")
                            {
                                //Inserisco descrizione gruppo come dato per far capire al sistema che questo record è riferito al gruppo stesso di appartenenza
                                descrizioni["Gruppo"] = new Dictionary<string, object>();
                                Dictionary<string, object> _descr_gruppo = descrizioni["Gruppo"] as Dictionary<string, object>;
                                _descr_gruppo.Add("Descrizione1", descrizione1);
                                _descr_gruppo.Add("Descrizione2", brand);
                                _descr_gruppo.Add("Descrizione3", tipo_gusto);
                                _descr_gruppo.Add("Descrizione4", grammatura);
                                _descr_gruppo.Add("Um", item["unita_misura"]);
                                _descr_gruppo.Add("Peso", item["peso"]);

                            }


                            string tipo_volantino = item["tipo_volantino"].ToString().ToLower();

                            if (tipo_volantino.IndexOf("f - fuori volantino") < 0 &&
                                tipo_volantino.IndexOf("v - volantino") < 0 &&
                                tipo_volantino.IndexOf("o - opportunit") < 0)
                            {
                                errors += "Interruzione lettura: Tipo Volantino sconosciuto: " + tipo_volantino + " per l'articolo " + codice_radice;
                                break;
                            }

                            string tipo_tema = item["tipo_tema"].ToString();

          
                            string segmento = item["segmento"].ToString();
                            if (segmento.Length < "0101001001".Length)
                            {
                                segmento = "0" + segmento;//Questo valore ad oggi ha lunghezza fissaa 10, il giorno che questa regola cambierà questa porzione dovrà essere cambiata
                            }
                            

                            #endregion

                            #region creazione record


                            if (nome_foto.Length > 50)
                            {
                                flag_error = true;
                                //report_op += "Nome foto supera i 50 caratteri: " + nome_foto + "<br>codice " + codice_radice;
                                errors += "Nome foto supera i 50 caratteri: " + nome_foto + "<br>codice " + codice_radice;

                                break;
                            }


                            if (tema.Length > 40)
                            {
                                flag_error = true;
                                //report_op += "Tema supera i 40 caratteri: " + tema + "<br>codice " + codice_radice;
                                errors += "Tema supera i 40 caratteri: " + tema + "<br>codice " + codice_radice;
                                break;
                            }


                            if (tipo_sconto_fidelity.Length > 30)
                            {
                                flag_error = true;
                                //report_op += "Tipo sconto fidelity supera i 30 caratteri: " + tipo_sconto_fidelity + "<br>codice " + codice_radice;
                                errors += "Tipo sconto fidelity supera i 30 caratteri: " + tipo_sconto_fidelity + "<br>codice " + codice_radice;
                                break;
                            }


                            if (tipo_sconto_MM.Length > 30)
                            {
                                flag_error = true;

                                //report_op += "Tipo sconto massmarket supera i 30 caratteri: " + tipo_sconto_massmarket + "<br>codice " + codice_radice;
                                errors += "Tipo sconto massmarket supera i 30 caratteri: " + tipo_sconto_MM + "<br>codice " + codice_radice;
                                break;
                            }


                            if (tipo_tema.Length > 40)
                            {
                                flag_error = true;
                                errors += "Tipo tema supera i 40 caratteri: " + tipo_tema + "<br>codice " + codice_radice;
                                break;
                            }


                            if (segmento != "")
                            {
                                if (ref_archivio.ContainsKey("Segmento"))
                                {
                                    ref_archivio["Segmento"] = segmento;
                                }
                                else
                                {
                                    ref_archivio.Add("Segmento", segmento);
                                }
                            }


                            if (imp_tipo_tracciato == (Byte)TipoImportazione.Vol || imp_tipo_tracciato != (Byte)TipoImportazione.PoP)
                            {
                                tracciato_item.Records.Add(item);
                            }
                            else
                            {
                                //metto l'oggetto a mano
                                Dictionary<string, object> gia_presente = tracciato_item.Records.Where(r => (r["Referenza"] as Dictionary<string, object>)["Codice"].ToString() == codice_radice).FirstOrDefault();

                                string cod = codice_area_originale_xls;
                                if (imp_tipo_tracciato == (Byte)TipoImportazione.PoP && codice_area_originale_xls != codice_area_originale_xls_x_pop)
                                {
                                    cod = codice_area_originale_xls_x_pop;
                                    //siamo nello scenario POP # accorpamento AV GS
                                    // Siccome differisce il codice_area allora questo è u GS e va controllato se è presente nella lista AV
                                    if (gia_presente == null)
                                    {
                                        tracciato_item.Records.Add(item);
                                    }
                                }
                                else
                                {
                                    //&& codice_area_originale_xls != codice_area_originale_xls_x_pop ---- aggiunta il 10/06/2015
                                    if (gia_presente != null && codice_area_originale_xls != codice_area_originale_xls_x_pop)
                                    {
                                        //Se c'è, significa che è un caso POP - accorpamento AV GS perciò lo sostituisco perchè la priorità è di AV

                                        int inx = tracciato_item.Records.IndexOf(gia_presente);
                                        tracciato_item.Records[inx] = item;
                                    }
                                    else
                                    {
                                        tracciato_item.Records.Add(item);
                                    }
                                }

                            }



                            #endregion
                        }
                        else
                        {

                        }


                    }
                    catch (Exception ex)
                    {
                        errors += ex.StackTrace + "\n";
                    }

                    media_processo_item += DateTime.Now.Subtract(inizio_processo_item).TotalMilliseconds;
                    count_items++;
                }

                media_processo_item = media_processo_item / count_items;
                errors += "MEDIA: " + media_processo_item+"\n";

                string key_codice_scatto = "Scatto.Codice";
                string key_codice_scatto_gruppo = "Scatto.CodiceGruppo";
                if (!flag_error)
                {
                    
                    #region Ordinamento liste

                    for (int i = 0; i < result.Count; i++)
                    {

                        Tracciato tItem = result[i];
                        //Response.Write("<br>ANALIZZO AREA " + tracciato_item.area);

                        //ad ogni passaggio devo ripulire tutti gli item messi dentro la lista ordinata
                        /*for (int b = 0; b < schemaOrd.Count; b++)
                        {
                            for (int z = 0; z < schemaOrd[b].indici.Count; z++)
                            {
                                schemaOrd[b].indici[z] = new List<TracciatiRecord>();
                            }
                        }*/
                        

                        for (int z = 0; z < tItem.Records.Count; z++)
                        {

                            Dictionary<string, object> tr_item = tItem.Records[z];

                            int reparto = (int)tr_item["reparto"];
                            int settore = (int)tr_item["settore"];

                            string seg_ordinamento = tr_item["segmento"].ToString();
                            string cod_scatto = tr_item[key_codice_scatto].ToString();
                            var _ref = tr_item["Referenza"] as Dictionary<string, object>;

                            if (cod_scatto == "676150")
                                "Attenzione".ToString();

                            string cod_ref = _ref["Codice"].ToString();
                            //Response.Write("<br>Cerco reparto " + reparto + " e settore " + settore + "<br>");
                            Ordinamento rs_item = schemaOrd.Where(it => it.CodiceSegmento == tr_item["segmento"].ToString()).FirstOrDefault();

                            if (imp_tipo_tracciato == (Byte)TipoImportazione.Vol)
                            {

                                #region Analisi codice scatto
                                if (cod_scatto != "")
                                {
                                    List<Dictionary<string, object>> l_cod_scatto = tItem.Records.Where(l => l[key_codice_scatto].ToString() == cod_scatto).ToList();

                                    if (l_cod_scatto.Count > 1)
                                    {
                                        //Casistica complessa

                                        //Prendo solo le ref con foto e/o esempio
                                        //ordino le ref metterno ai primi posti quelle che hanno specificato l'esempio
                                        List<Dictionary<string, object>> solo_foto_esempio = l_cod_scatto.Where(l2 => (bool)l2["foto"] || (bool)l2["esempio"]).OrderByDescending(o => (bool)o["esempio"]).ToList();

                                        if (solo_foto_esempio.Count > 0)
                                        {
                                            Dictionary<string, object> tr_item_primario = solo_foto_esempio.FirstOrDefault();


                                            int check_esempio = solo_foto_esempio.Where(l3 => (bool)l3["esempio"]).Count();
                                            int check_foto = solo_foto_esempio.Where(l3 => (bool)l3["foto"]).Count();
                                            var _ref_primario = tr_item_primario["Referenza"] as Dictionary<string, object>;

                                            if (check_esempio > 0)
                                            {
                                                //Casistica ESEMPIO

                                                if (check_esempio <= 2)
                                                {
                                                    seg_ordinamento = tr_item_primario["segmento"].ToString();
                                                    cod_ref = _ref_primario["Codice"].ToString();
                                                    rs_item = schemaOrd.Where(it => it.CodiceSegmento == tr_item_primario["segmento"].ToString()).FirstOrDefault();
                                                }
                                                else
                                                {
                                                    if (check_esempio > 2)
                                                    {
                                                        //conteggio dei segmenti
                                                        List<string> solo_esempi = solo_foto_esempio.Where(l3 => (bool)l3["esempio"]).Select(s => s["segmento"].ToString()).ToList();
                                                        Dictionary<string, int> conteggio = new Dictionary<string, int>();
                                                        string leader = "";
                                                        int leader_count = 0;
                                                        foreach (string s in solo_esempi)
                                                        {
                                                            if (!conteggio.ContainsKey(s))
                                                                conteggio.Add(s, 1);
                                                            else
                                                            {
                                                                conteggio[s] = conteggio[s] + 1;
                                                            }

                                                            if (leader == "" || conteggio[s] > leader_count)
                                                            {
                                                                leader = s;
                                                                leader_count = conteggio[s];
                                                            }
                                                        }

                                                        seg_ordinamento = leader;
                                                        rs_item = schemaOrd.Where(it => it.CodiceSegmento == leader).FirstOrDefault();
                                                    }
                                                }
                                            }
                                            else if (check_foto > 0)
                                            {
                                                //Casistica FOTO

                                                if (check_foto <= 2)
                                                {
                                                    seg_ordinamento = tr_item_primario["segmento"].ToString();
                                                    cod_ref = tr_item_primario["Referenza.Codice"].ToString();
                                                    rs_item = schemaOrd.Where(it => it.CodiceSegmento == tr_item_primario["segmento"].ToString()).FirstOrDefault();
                                                }
                                                else
                                                {
                                                    if (check_foto > 2)
                                                    {
                                                        //conteggio dei segmenti
                                                        List<string> solo_foto = solo_foto_esempio.Where(l3 => (bool)l3["foto"]).Select(s => s["segmento"].ToString()).ToList();
                                                        Dictionary<string, int> conteggio = new Dictionary<string, int>();
                                                        string leader = "";
                                                        int leader_count = 0;
                                                        foreach (string s in solo_foto)
                                                        {
                                                            if (!conteggio.ContainsKey(s))
                                                                conteggio.Add(s, 1);
                                                            else
                                                            {
                                                                conteggio[s] = conteggio[s] + 1;
                                                            }

                                                            if (leader == "" || conteggio[s] > leader_count)
                                                            {
                                                                leader = s;
                                                                leader_count = conteggio[s];
                                                            }
                                                        }

                                                        seg_ordinamento = leader;
                                                        rs_item = schemaOrd.Where(it => it.CodiceSegmento == leader).FirstOrDefault();

                                                    }
                                                }
                                            }
                                        }
                                        else if (l_cod_scatto.Count > 2)
                                        {
                                            //Casistica Nè FOTO nè ESEMPIO
                                            List<string> all_seg = l_cod_scatto.Select(s => s["segmento"].ToString()).ToList();
                                            Dictionary<string, int> conteggio = new Dictionary<string, int>();
                                            string leader = "";
                                            int leader_count = 0;
                                            foreach (string s in all_seg)
                                            {
                                                if (!conteggio.ContainsKey(s))
                                                    conteggio.Add(s, 1);
                                                else
                                                {
                                                    conteggio[s] = conteggio[s] + 1;
                                                }

                                                if (leader == "" || conteggio[s] > leader_count)
                                                {
                                                    leader = s;
                                                    leader_count = conteggio[s];
                                                }
                                            }

                                            seg_ordinamento = leader;
                                            rs_item = schemaOrd.Where(it => it.CodiceSegmento == leader).FirstOrDefault();
                                        }

                                    }



                                    List<string> codici_gruppo = new List<string>();
                                    foreach(Dictionary<string, object> itemGroup in l_cod_scatto)
                                    {
                                        if (itemGroup.ContainsKey("Referenza"))
                                        {
                                            var _refItemGroup = itemGroup["Referenza"] as Dictionary<string, object>;
                                            codici_gruppo.Add(_refItemGroup["Codice"].ToString());
                                        }
                                        else
                                        {
                                            codici_gruppo.Add(itemGroup["Referenza.Codice"].ToString());
                                        }
                                    }
                                    
                                    string codice_gruppo = String.Join(",", codici_gruppo.OrderBy(o => o).ToArray());
                                    tr_item[key_codice_scatto_gruppo] = codice_gruppo;
                                }
                                #endregion

                            }

                            if (rs_item != null)
                            {
                                Ordinamento g_details = schemaOrd.Where(g => g.CodiceSegmento == seg_ordinamento).FirstOrDefault();// rs_item.item_gruppo.grammature.Where(g => g.numero_reparto == reparto && g.numero_settore == settore && (g.codice_segmento == null || g.codice_segmento == tr_item.segmento)).FirstOrDefault();
                                if (imp_tipo_tracciato == 2)
                                    g_details = schemaOrd.Where(g => g.CodiceSegmento == null || g.CodiceSegmento == tr_item["segmento"].ToString()).FirstOrDefault();

                                Int32 indice = g_details.Id;

                                tr_item["indice"] = indice;

                                /*
                                if (imp_tipo_tracciato != (Byte)TipoImportazione.PoP)
                                {
                                    int count_cs = rs_item.indici[indice].Where(s => s.CodiceScatto == cod_scatto).Count();
                                    if (count_cs <= 0)
                                    {
                                        if (!cod_scatto_index.ContainsKey(seg_ordinamento + "_" + cod_scatto))
                                            cod_scatto_index.Add(seg_ordinamento + "_" + cod_scatto, rs_item.indici[indice].Count);
                                        else
                                            cod_scatto_index[seg_ordinamento + "_" + cod_scatto] = rs_item.indici[indice].Count;
                                    }

                                    if (cod_scatto != "" && tr_item.Segmento == seg_ordinamento)
                                    {
                                        int inx_offset = cod_scatto_index[seg_ordinamento + "_" + cod_scatto];
                                        //deve essere il primo
                                        int c = rs_item.indici[indice].Where(s => s.Segmento == seg_ordinamento && s.Foto).Count();
                                        if (tr_item.Esempio)//c == rs_item.indici[indice].Count)
                                            rs_item.indici[indice].Insert(inx_offset, tr_item);
                                        else if (tr_item.Foto)
                                            rs_item.indici[indice].Insert(inx_offset + count_cs, tr_item);
                                        else
                                        {
                                            rs_item.indici[indice].Insert(inx_offset + count_cs, tr_item);

                                        }

                                        //rs_item.indici[indice].Insert(0, tr_item);
                                    }
                                    else
                                    {
                                        rs_item.indici[indice].Add(tr_item);
                                    }
                                }
                                else
                                {
                                    rs_item.indici[indice].Add(tr_item);
                                }  
                                */
                            }
                            else
                            {
                                errors += "Cod. " + _ref + " Reparto/Settore/Segmento non trovato " + reparto + " (reparto), " + settore + " (settore), " + (seg_ordinamento != "" ? seg_ordinamento : "0") + " (segmento)<br>";
                            }
                        }


                        tItem.Records = tItem.Records.OrderBy(ord1 => (Int32)ord1["indice"]).ThenBy(ord2 => ord2[key_codice_scatto].ToString()).ThenBy(ord2 => (bool)ord2["esempio"]).ThenBy(ord2 => (bool)ord2["foto"]).ToList();

                        #region inserisco la lista ordinata nel DB

                        /*
                        Dictionary<string, List<TracciatiRecord>> tracciati_items_pop = new Dictionary<string, List<TracciatiRecord>>();

                        tracciati_items_pop.Add("classic", new List<TracciatiRecord>());


                        res.Attivita.StatoMsg = "Importazione " + tracciato_item.Area;
                        this.ctx.SaveChanges();


                        int prog_rec = 0;
                        int prog_perc = 0;
                        Int16 start_prog_attivita = res.Attivita.Progress;

                        for (int b = 0; b < lista_ordinata.Count; b++)
                        {
                            for (int z = 0; z < lista_ordinata[b].indici.Count; z++)
                            {

                                List<TracciatiRecord> list_items = lista_ordinata[b].indici[z].OrderByDescending(o => o.Esempio).ThenByDescending(o => o.Foto).ToList();
                                if (pkg.cmbTipoTracciato == 2)
                                {
                                    list_items = new List<TracciatiRecord>();
                                    if (lista_ordinata[b].indici[z].Count > 0)
                                    {
                                        TracciatiRecord capo = lista_ordinata[b].indici[z].FirstOrDefault();
                                        List<TracciatiRecord> capi = lista_ordinata[b].indici[z].Where(s => s.Segmento == capo.Segmento).ToList();
                                        list_items.AddRange(capi);
                                        list_items.AddRange(lista_ordinata[b].indici[z].Skip(capi.Count).OrderByDescending(o => o.Esempio).ThenByDescending(o => o.Foto).ToList());
                                    }
                                }


                                for (int y = 0; y < list_items.Count; y++)
                                {
                                    TracciatiRecord t_item = list_items[y];
                                    if (pkg.cmbTipoTracciato == (Byte)TipoImportazione.Vol || pkg.cmbTipoTracciato != (Byte)TipoImportazione.PoP)
                                    {
                                        //Aggiorno percentuale solo per importazione lista classica
                                        //Nel POP partono sub processi con esportazioni annesse
                                        this.ctx.TracciatiRecords.Add(t_item);
                                    }
                                    else
                                    {
                                        // Per il POP il dato non si deposita, viene però lavorato subito andando in esportazione

                                        //response.write("tracciato item " + tracciato_item.importazioni.tipo_materiale.tolower() + "<br>");
                                        if (tracciato_item.IdImportazioneNavigation!.TipoMateriale.ToLower() == "vol" ||
                                            tracciato_item.IdImportazioneNavigation!.TipoMateriale.ToLower() == "ap")
                                        {
                                            #region faccio lo split degli articoli a seconda di sapori e sottocosto
                                            //questa regola si applica al momento alla colonna tema in attesa di nuove istruzioni

                                            string tipo_lista = icItem.getTipoListaPerTema(t_item);

                                            if (tipo_lista != "SAP")
                                            {
                                                if (!tracciati_items_pop.ContainsKey(tipo_lista))
                                                    tracciati_items_pop.Add(tipo_lista, new List<TracciatiRecord>());

                                                tracciati_items_pop[tipo_lista].Add(t_item);
                                            }

                                            #endregion
                                        }
                                        else
                                        {
                                            tracciati_items_pop["classic"].Add(t_item);
                                        }

                                    }


                                    prog_rec++;
                                }

                            }
                        }
                        */

                        #endregion
                        

                        if (imp_tipo_tracciato == (Byte)TipoImportazione.Vol || imp_tipo_tracciato != (Byte)TipoImportazione.PoP)
                        {

                        }
                        else
                        {
                            // Per il POP cambia il tipo di attività, si azzera la percentuale e inizia il lavoro di esportazione di ogni singolo frammento
                            /*
                            Int16 id_mastro = this.ctx.Mastros.Where(m => m.Nome == "A-Mastro_001").FirstOrDefault().Id;
                            //La mastro è da capire!
                            List<string> key_list = tracciati_items_pop.Keys.ToList();

                            Int16 perc = 0;
                            Int16 prog = 0;
                            foreach (string s in key_list)
                            {
                                //Response.Write("<br>ESPORTO LISTA " + s + " COUNT: " + tracciati_items_pop[s].Count);

                                perc = (Int16)((decimal)prog / (decimal)key_list.Count);

                                if (tracciati_items_pop[s].Count == 0)
                                    continue;

                                string path_export = _path_to_export + id_attivita;



                                prog++;
                            }
                            */
                        }
                    }

                    #endregion
                    


                    if (counter2 == 0 && counter > 0)
                    {
                        errors += "Nessun CANALE/AREA valido per l'importazione";

                    }
                    else
                    {

                    }

                }
                else
                {

                }
            }
            catch (Exception ex)
            {
                errors += ex.StackTrace;
            }

            impResult.liste = result;
            impResult.errors = errors;

            return JsonConvert.SerializeObject(impResult);
        }

        public string getFirma(Dictionary<string, object> rec, List<Dictionary<string, object>> tracciato)
        {
            if (rec.ContainsKey("Area"))
            {
                string codScatto = rec["codice_scatto"].ToString();
                List<Dictionary<string, object>> gruppo = tracciato.Where(t => t["codice_scatto"] == codScatto).ToList();

                string codice_gruppo = "";
                foreach(Dictionary<string, object> itemGroup in gruppo)
                {
                    if (codice_gruppo!="")
                    {
                        codice_gruppo += ",";
                    }
                    if (itemGroup.ContainsKey("Referenza"))
                    {
                        var _ref = itemGroup["Referenza"];// as Dictionary<string, object>;
                        codice_gruppo += "##";// _ref["Codice"].ToString();
                    }
                    else
                    {
                        codice_gruppo += itemGroup["Referenza.Codice"].ToString();
                    }
                }

                return codice_gruppo;
            }
            return "";
        }

        #endregion
    }
}
