using AgenziaLib.Tipi;
using IstantaLib;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Security.Policy;
using System.Text;
using System.Threading.Tasks;
using System.Text.RegularExpressions;


namespace AgenziaLib
{
    internal class Pac : IAgenzia
    {
        private readonly string Key_PrezzoPromo = "prezzo_promo";
        private readonly string Key_PrezzoPromoKgL = "prezzo_kgl";
        private readonly string Key_PrezzoPromoCompilato = "prezzo_promo_std";
        private readonly string Key_PrezzoPromoKgLCompilato = "prezzo_kgl_std";
        private readonly string Key_titolariTuDay = "titolari_tuday";

        private readonly string Key_UM2 = "um2";
        private readonly string Key_Settore = "settore";
        private readonly string Key_Meccanica = "meccanica";
        private readonly string Key_prestazione = "prestazione";
        private readonly string Key_ruolo = "ruolo";
        private readonly string Key_bollo = "bollo";
        private readonly string Key_conad = "marchio_conad";
        private readonly string Key_note = "note";


        // substring da cercare in DESCR1  ->  sigla logo in DbLoghiBolli
        private static readonly (string pattern, string siglaLogo)[] RegoleBolliniDescr1 = new[]
        {
            ("S&D", "Logo_S&D"),
            ("S&I", "Logo_S&I"),
            ("CPQ", "Logo_CPQ"),
            ("C.P.Q.", "Logo_CPQ"),

        };

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
            string keyXMLSelezione = GLOBAL_VARIABLES.keyXMLSelezione;
            string keyNomeFoto = GLOBAL_VARIABLES.keyFotoNome;


            string cGruppo = gruppo.FirstOrDefault()[GLOBAL_VARIABLES.keyScattoCodiceGruppo].ToString();
            //if (cGruppo == "721784,721784")
            //{
            //    "debug".ToString();
            //}

            //Imposto il primo come primario
            var primoDelGruppo = gruppo.FirstOrDefault();
            primoDelGruppo[keyXMLSelezione] = (Byte)TipoSelezioneMenabo.Primaria;
            string tema= primoDelGruppo["tema"].ToString();

            bool flag_ex=false;

            if (gruppo.Count > 1)
            {
                int Count_Sec=0;
                for (int i = 1; i<gruppo.Count; i++)
                {
                    var item = gruppo[i];
                    
                    
                    if (!primoDelGruppo.ContainsKey(keyNomeFoto) || primoDelGruppo[keyNomeFoto]=="")
                    {
                        if (item.ContainsKey(keyNomeFoto) && item[keyNomeFoto]!="")
                        {
                            if (!flag_ex)
                            {
                                primoDelGruppo[keyXMLSelezione] = (Byte)TipoSelezioneMenabo.None;
                                item[keyXMLSelezione] = (Byte)TipoSelezioneMenabo.Primaria;
                                flag_ex=true;
                            }
                            else
                            {
                                if (Count_Sec<2 && tema!="1+1")
                                {
                                    item[keyXMLSelezione] = (Byte)TipoSelezioneMenabo.Secondaria;
                                    Count_Sec++;
                                } else 
                                {
                                    item[keyXMLSelezione] = (Byte)TipoSelezioneMenabo.None;
                                }
                            }
                        }
                        else
                        {
                            item[keyXMLSelezione] = (Byte)TipoSelezioneMenabo.None;
                        }
                    }
                    else
                    {

                        if (item.ContainsKey(keyNomeFoto) && item[keyNomeFoto]!="")
                        {
                            if (Count_Sec<2 && tema!="1+1")
                            {
                                item[keyXMLSelezione] = (Byte)TipoSelezioneMenabo.Secondaria;
                                Count_Sec++;
                            } else 
                            {
                                item[keyXMLSelezione] = (Byte)TipoSelezioneMenabo.None;
                            }
                        } else  {
                                item[keyXMLSelezione] = (Byte)TipoSelezioneMenabo.None;
                        }    
                        
                    }
                    //if ((Byte)item[keyXMLSelezione] == (Byte)TipoSelezioneMenabo.Secondaria)
                    //{
                    //    conteggioSecondarie++;
                    //}

                    //if (conteggioSecondarie > 1)
                    //{
                    //    item[keyXMLSelezione] = (Byte)TipoSelezioneMenabo.None;
                    //}

                }

            }

            //throw new NotImplementedException();
            return JsonConvert.SerializeObject(gruppo);
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
                Canale ctem = dbCanali.FirstOrDefault();



                foreach (Dictionary<string, object> item in tracciato)
                {

                    string tema = item["tema"].ToString().ToLower();
                    string codExt = item["cod_ext"].ToString().Trim();

                    int codExtInt;
                    int.TryParse(codExt, out codExtInt);

                    if (codExt != "" && codExtInt>0)
                    {
                        item[GLOBAL_VARIABLES_FICO.keyRefCodice] = item[GLOBAL_VARIABLES_FICO.keyRefCodice] + (codExtInt<10?"0":"")+codExtInt;
                    }

                    if (tema == "fvol")
                        continue;
                    //Associazione dell'area/canale
                    //Individuo CANALE
                    //string canaleInLista = item["canale"].ToString();
                    ////Console.WriteLine("Cerco il canale " + canaleInLista);
                    ////Console.WriteLine("db canali count " + dbCanali.Count);
                    foreach (Canale c in dbCanali)
                    {
                        foreach (Area a in dbAree)
                        {
                            Tracciato tItem = result.FirstOrDefault(r => r.guidCanale == c.guidID && r.guidArea == a.guidID);
                            if (tItem == null)
                            {
                                tItem = new Tracciato();
                                tItem.guidArea = a.guidID;
                                tItem.guidCanale = c.guidID;
                                tItem.Area = a.nome;
                                tItem.Canale = c.nome;
                                tItem.DataDa = DateTime.Now;
                                tItem.DataA = DateTime.Now;
                                tItem.Records = new List<Dictionary<string, object>>();

                                result.Add(tItem);

                            }


                            tItem.Records.Add(item);
                        }
                    }


                }

                //Assegnazione gruppi
                foreach (Tracciato t in result)
                {
                    t.Records.Where(y=>y.ContainsKey("prestazione") && (int)y["prestazione"]>0).GroupBy(x => (int)x["prestazione"]).ToList().ForEach(g =>
                    {
                        int prestazione = g.Key;
                        List<Dictionary<string, object>> recordsGruppo = t.Records.Where(x => (int)x["prestazione"] == prestazione).ToList();
                        string cod_gruppo = String.Join(",", recordsGruppo.Select(s => s[GLOBAL_VARIABLES.keyRefCodice]).OrderBy(o => o.ToString()).ToArray());
                        foreach (Dictionary<string, object> r in recordsGruppo)
                        {
                            r[GLOBAL_VARIABLES.keyScattoCodiceGruppo] = cod_gruppo;
                            //Assegno sottogruppo ereditandolo dal codice gruppo
                            if (r[GLOBAL_VARIABLES.keyScattoCodiceGruppo].ToString() != r[GLOBAL_VARIABLES.keyRefCodice].ToString())
                                r[GLOBAL_VARIABLES.keyScattoCodiceSottogruppo] = r[GLOBAL_VARIABLES.keyScattoCodiceGruppo];

                        }
                    });
                }



                impResult.liste = result;

            }
            catch (Exception ex)
            {
                //Console.WriteLine("AGENZIA ERRORE IMPORTAZIONE TRACCIATO: " + ex.ToString());
                impResult.errors = ex.ToString();
            }

            return JsonConvert.SerializeObject(impResult);
        }

        public TracciatoResultKit esportaVolantino(List<FicoContextField> promoContext, List<FicoContextField> tracciatoContext, List<ArticoloInKit> tracciato, FicoRuntimeKit kit, string pathNamingConvention, string pathACPV, string pathTipiDiExport, string pathOrdinamentoLista, string pathMeccaniche, string pathLoghiBolli, string pathMappaStili, FicoCombinazioneKitReadMode readMode)
        {
            //Console.WriteLine("--------esporta con logiche di agenzia-------------");

            System.Globalization.CultureInfo culture = new System.Globalization.CultureInfo("it-IT");
            CultureInfo.CurrentCulture = culture;

            TracciatoResultKit result = new TracciatoResultKit();
            //return result;

            JObject o5 = JObject.Parse(File.ReadAllText(pathLoghiBolli));
            DbLoghiBolli loghibolliDB = o5.ToObject<DbLoghiBolli>();

            string logs = "";

            try
            {

                CompiledFieldInterpreter interprete = new CompiledFieldInterpreter();

                TracciatoKit tracciato_da_esportare = new TracciatoKit();
                result.liste = new List<TracciatoKit>() { tracciato_da_esportare };
                result.liste[0].Records = new List<ArticoloInKit>();
                result.liste[0].errors = "";


                for (int i = 0; i < tracciato.Count; i++) //lista_tracciato.Count; i++)
                {
                    ////Console.WriteLine($"esporta item: {i} di {tracciato.Count}");
                    List<LogoBollo> _bolliloghi = new List<LogoBollo>();
                    
                    Dictionary<string, object> item = tracciato[i].recordInTracciato;// lista_tracciato[i];
                                                                                     //Compilazione dei campi
                                                                                     //Da mettere in esportazione

                    decimal prezzo_promo = MathExt.Round(item["prezzo_promo"].ToDecimal(), 2, MidpointRounding.AwayFromZero);
                    decimal prezzo_promo_kgl = MathExt.Round(item["prezzo_promo_kgl"].ToDecimal(), 2, MidpointRounding.AwayFromZero);
                    decimal prezzo_continuo = MathExt.Round(item["prezzo_continuo"].ToDecimal(), 2, MidpointRounding.AwayFromZero);
                    decimal prezzo_kgl = MathExt.Round(item["prezzo_kgl"].ToDecimal(), 2, MidpointRounding.AwayFromZero);
                    decimal sconto = item["sconto"].ToDecimal();
                    string um= item[GLOBAL_VARIABLES.keyDescrUm].ToString().ToLower();
                    string um_str = (um == "lt" ? "L" : "Kg");
                    string fidelity= item["fidelity"].ToString().ToLower();
                    string tema= item["tema"].ToString();
                    decimal peso= item[GLOBAL_VARIABLES.keyDescrPeso].ToDecimal();
                    string marchio_conad= item["marchio_conad"].ToString();
                    string reparto= item["reparto"].ToString();
                    string codice_gruppo= item[GLOBAL_VARIABLES_FICO.keyCodiceGruppo].ToString();


                    string note= item["note"].ToString().ToLower();
                    //Console.WriteLine("DESCR1-> "  + item[GLOBAL_VARIABLES.keyDescr1].ToString());
                    ////Console.WriteLine(JsonConvert.SerializeObject(item));
                    string codBox = "";

                    //stringa per ricarca bollini
                    string descr1 = item.ContainsKey(GLOBAL_VARIABLES.keyDescr1) && item[GLOBAL_VARIABLES.keyDescr1] != null
                        ? item[GLOBAL_VARIABLES.keyDescr1].ToString()
                        : string.Empty;

                    string  descr1Tracciato = item.ContainsKey(GLOBAL_VARIABLES.keyDescr1Tracciato) && item[GLOBAL_VARIABLES.keyDescr1Tracciato] != null
                        ? item[GLOBAL_VARIABLES.keyDescr1Tracciato].ToString()
                        : string.Empty;



                    //Imposto le foto secondarie del gruppo
                    var _group = tracciato.Where(t => t.recordInTracciato[GLOBAL_VARIABLES_FICO.keyCodiceGruppo].ToString() == codice_gruppo).Select(s => s.recordInTracciato).ToList();
                    List<FotoElementoGruppo> membriGruppoFoto = RefsHelper.getFotoSecondarieDelGruppo(_group);
                    item[GLOBAL_VARIABLES_FICO.keyMembriGruppoFoto] = membriGruppoFoto;



                    if (item.ContainsKey(GLOBAL_VARIABLES.codiceBox))
                    {

                        if (item[GLOBAL_VARIABLES.codiceBox] == null)
                        {
                            logs += " è NULL ";
                            //Console.WriteLine($"{item[GLOBAL_VARIABLES.keyRefCodice].ToString()} non ha BOX assegnato");
                        }
                        else
                        {
                            codBox = item[GLOBAL_VARIABLES.codiceBox].ToString();
                        }
                    }
                    
                    //definizione degli stili
                    string styDescr1 = "DESCRIZIONE_TITOLO";
                    string styDescr3 = "DESCRIZIONE_TIPO";
                    string styDescr2 = "DESCRIZIONE_BRAND";
                    string styDescr4 = "DESCRIZIONE_GRAMMATURA";

                    string prezzo_promo_style = "PREZZO_PROMO";
                    string prezzo_promo_kgl_style = "PREZZO_PROMO_KGL";
                    string prezzo_continuo_style = "PREZZO_CONTINUO";


                    if (codBox == "BOX_FG")
                    {
                        prezzo_promo_kgl_style += "_FG";
                        prezzo_promo_style += "_FG";
                        styDescr1 += "_FG";
                        styDescr2 += "_FG";
                        styDescr3 += "_FG";
                        styDescr4 += "_FG";

                    }
                    else if (codBox == "BOX_COLLECTION")
                    {
                        prezzo_promo_kgl_style += "_COLLECTION";
                        prezzo_promo_style += "_COLLECTION";
                        styDescr1 += "_COLLECTION";
                        styDescr2 += "_COLLECTION";
                        styDescr3 += "_COLLECTION";
                        styDescr4 += "_COLLECTION";
                    }
                    else if (codBox == "BOX_NOFOOD")
                    {
                        prezzo_promo_kgl_style += "_NOFOOD";
                        //prezzo_promo_kgl non esiste in questo box

                        styDescr1 += "_NOFOOD";
                        styDescr2 += "_NOFOOD";
                        styDescr3 += "_NOFOOD";
                        styDescr4 += "_NOFOOD";

                    }
                    else if (codBox == "BOX_SG")
                    {
                        styDescr1 += "_SG";
                        styDescr2 += "_SG";
                        styDescr3 += "_SG";
                        styDescr4 += "_SG";
                    }

                    List<CompiledField> _listCompiled = new List<CompiledField>();

                    var Descrizione1 = "";
                    var Descrizione2 = "";
                    var Descrizione3 = "";
                    var Descrizione4 = "";
                    var Peso = "";
                    var Um = "";

                    if (item.ContainsKey("descrizione_gruppo"))
                    {
                        Descrizione1 = (item["descrizione_gruppo"] as Dictionary<string, object>)["Descrizioni.Descrizione1"].ToString();
                        Descrizione2 = (item["descrizione_gruppo"] as Dictionary<string, object>)["Descrizioni.Descrizione2"].ToString();
                        Descrizione3 = (item["descrizione_gruppo"] as Dictionary<string, object>)["Descrizioni.Descrizione3"].ToString();
                        Descrizione4 = (item["descrizione_gruppo"] as Dictionary<string, object>)["Descrizioni.Descrizione4"].ToString();
                        Peso = item["Descrizioni.Peso"].ToString();
                        Um = item["Descrizioni.Um"].ToString();
                    }
                    else
                    {
                        Descrizione1 = item["Descrizioni.Descrizione1"].ToString();
                        Descrizione2 = item["Descrizioni.Descrizione2"].ToString();
                        Descrizione3 = item["Descrizioni.Descrizione3"].ToString();
                        Descrizione4 = item["Descrizioni.Descrizione4"].ToString();
                        Peso = item["Descrizioni.Peso"].ToString();
                        Um = item["Descrizioni.Um"].ToString();
                    }

                    string descr_prog = Descrizione1;

                    if (Descrizione2!="" && (!Descrizione2.Contains("$br") || Descrizione1.IndexOf("$br")>0))
                    {
                        if (descr_prog != "")
                            Descrizione2 = " " + Descrizione2;
                    }

                    descr_prog += Descrizione2;

                    if (Descrizione3 != "" && (!Descrizione3.Contains("$br") || Descrizione3.IndexOf("$br") <= 0))
                    {
                        //Se descrizione 1 non ha br oppure non ce l'ha all'inizio e quindi per forza alla fine
                        Descrizione3 = " " + Descrizione3;
                    }

                    descr_prog += Descrizione3;

                    if (Descrizione4!="" && (!Descrizione4.Contains("$br") || Descrizione4.IndexOf("$br") > 0))
                    {
                        //Se descrizione 1 non ha br oppure non ce l'ha all'inizio e quindi per forza alla fine
                        Descrizione4 = " " + Descrizione4;
                    }

                    descr_prog += Descrizione4;


                    interprete.assignCompiledField("descrizione",
                        "",
                        $"{new FieldTagContent(styDescr1, Descrizione1).ToString()}" +
                        $"{new FieldTagContent(styDescr2, Descrizione2).ToString()}" +
                        $"{new FieldTagContent(styDescr3, Descrizione3).ToString()}" +
                        $"{new FieldTagContent(styDescr4, Descrizione4).ToString()}"
                    );

                    if (codBox=="BOX_COLLECTION")
                        {
                        interprete.assignCompiledField("prezzo_promo",
                            prezzo_promo_style,
                            $"{MathExt.DecimalRoundToString(prezzo_promo)}"
                        );
                    } 
                    else if (reparto=="GASTRONOMIA")
                        {
                        interprete.assignCompiledField("prezzo_promo",
                            prezzo_promo_style,
                            $"€ {MathExt.DecimalRoundToString(prezzo_promo/10)}"
                        );
                    } 
                    else 
                    {
                        interprete.assignCompiledField("prezzo_promo",
                            prezzo_promo_style,
                            $"€ {MathExt.DecimalRoundToString(prezzo_promo)}"
                        );
                    }

                    //gestione prezzo KGL
                    bool alkg=false;

                    
                    interprete.assignCompiledField("prezzo_promo_kgl",
                            "",
                            $"<{prezzo_promo_kgl_style}>€/{um_str} {MathExt.DecimalRoundToString(prezzo_kgl)}</{prezzo_promo_kgl_style}>");


                    if (prezzo_kgl!=0)
                    {

                        if ((reparto=="MACELLERIA" || reparto=="ORTOFRUTTA") && peso==1)
                        {
                            interprete.removeCompiledField("prezzo_promo_kgl");
                        } else {
                            interprete.assignCompiledField("prezzo_promo_kgl",
                            "",
                            $"<{prezzo_promo_kgl_style}>€/{um_str} {MathExt.DecimalRoundToString(prezzo_kgl)}</{prezzo_promo_kgl_style}>"
                        );
                        }

                    }  else {

                        if ((reparto=="MACELLERIA" || reparto=="ORTOFRUTTA") && peso==1)
                        {
                           interprete.assignCompiledField("prezzo_promo_kgl",
                            "",
                            $"<{prezzo_promo_kgl_style}>al kg</{prezzo_promo_kgl_style}>");
                            alkg=true;
                    

                        } else  {
                            interprete.removeCompiledField("prezzo_promo_kgl");
                            interprete.removeCompiledField("prezzo_promo_kgl_1pezzo");

                        }

                    }

                     //gestione sfondi e loghi per tutte le meccaniche

                    if (marchio_conad=="versonatura")
                    {
                        LogoBollo lbItem = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Logo_VN");
                            if (lbItem != null)
                            {
                                _bolliloghi.Add(lbItem);
                            }

                        lbItem = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Sfondo_VN");
                            if (lbItem != null)
                            {
                                _bolliloghi.Add(lbItem);
                            }                        
                    }

                    if (marchio_conad=="BDP")
                    {
                        LogoBollo lbItem = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Logo_BDP");
                            if (lbItem != null)
                            {
                                _bolliloghi.Add(lbItem);
                            }

                        lbItem = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Sfondo_BDP");
                            if (lbItem != null)
                            {
                                _bolliloghi.Add(lbItem);
                            }                        
                    }
                    if (marchio_conad=="SaporiE")
                    {
                        LogoBollo lbItem = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Logo_SaporiE");
                            if (lbItem != null)
                            {
                                _bolliloghi.Add(lbItem);
                            }

                        lbItem = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Sfondo_BDP");
                            if (lbItem != null)
                            {
                                _bolliloghi.Add(lbItem);
                            }                        
                    }

                    if (marchio_conad=="11 PARALLELI")
                    {
                        LogoBollo lbItem = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Logo_11Paralleli");
                            if (lbItem != null)
                            {
                                _bolliloghi.Add(lbItem);
                            }                      
                    }

                    if (marchio_conad=="CONAD")
                    {
                        LogoBollo lbItem = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Logo_Conad");
                            if (lbItem != null)
                            {
                                _bolliloghi.Add(lbItem);
                                //Console.WriteLine("HO APPLICATO IL BOLLINO CONAD");
                            }                      
                    }

                    if (marchio_conad=="CONAD ALIMENTUM SL")
                    {
                        LogoBollo lbItem = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Logo_Alimentum_SenzaLattosio");
                            if (lbItem != null)
                            {
                                _bolliloghi.Add(lbItem);
                            }                      
                    }

                    if (marchio_conad=="CONAD BABY")
                    {
                        LogoBollo lbItem = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Logo_Baby");
                            if (lbItem != null)
                            {
                                _bolliloghi.Add(lbItem);
                            }                      
                    }
                    if (marchio_conad=="CONAD ESSENTIAE")
                    {
                        LogoBollo lbItem = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Logo_conad_essentiae");
                            if (lbItem != null)
                            {
                                _bolliloghi.Add(lbItem);
                            }                      
                    }

                    if (marchio_conad=="CONAD PET")
                    {
                        LogoBollo lbItem = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Logo_Petfriends");
                            if (lbItem != null)
                            {
                                _bolliloghi.Add(lbItem);
                            }                      
                    }

                    if (marchio_conad=="CONAD PET PLUS")
                    {
                        LogoBollo lbItem = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Logo_PetfriendsPlus");
                            if (lbItem != null)
                            {
                                _bolliloghi.Add(lbItem);
                            }                      
                    }

                    if (marchio_conad=="PARAFARMACIA")
                    {
                        LogoBollo lbItem = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Logo_Parafarmacia");
                            if (lbItem != null)
                            {
                                _bolliloghi.Add(lbItem);
                            }                      
                    }

                    //bollini OF

                    if (note.Contains("prodotto italiano"))
                    {
                        LogoBollo lbItem = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Logo_Prodottoitaliano");
                            if (lbItem != null)
                            {
                                _bolliloghi.Add(lbItem);
                            }
                    }

                    if (note.Contains("prodotto 100% italiano"))
                    {
                        LogoBollo lbItem = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Logo_100italiano");
                            if (lbItem != null)
                            {
                                _bolliloghi.Add(lbItem);
                            }
                    }

                    // GESTIONE CUSTOM  MECCANICHE
                    if (codBox=="BOX_STD")
                    {


                        if (note.Contains("max "))
                        {
                        // Estrae il primo numero dentro la stringa
                        var match = Regex.Match(note, @"\b(\d+)\b");
                        var numero = match.Success ? match.Groups[1].Value : "N";

                        interprete.assignCompiledField(
                            "txt_max_pezzi",
                            "",
                            $"<MAX_PEZZI>MAX {numero} CONF. ASS.</MAX_PEZZI>"
                        );

                        }
                        else
                        {
                            interprete.removeCompiledField("max_pezzi");
                        }

                        if (fidelity.Trim()!="s")
                        {
                            interprete.removeCompiledField("fidelity");
                        }   
                         
                         if (!alkg){
                         interprete.assignCompiledField("prezzo_promo_kgl",
                            "",
                           $"<PREZZO_PROMO_KGL>€/{um_str} {MathExt.DecimalRoundToString(prezzo_kgl)}</PREZZO_PROMO_KGL>"
                        );
                        }

                    }                      
                    else if (codBox=="BOX_1+1")
                    {

                        if (peso!=1) {
                        interprete.assignCompiledField("prezzo_promo_kgl_1pezzo","",$"<PREZZO_PROMO_KGL_1PEZZO>€/{um_str} {MathExt.DecimalRoundToString(prezzo_kgl)}</PREZZO_PROMO_KGL_1PEZZO>"); 
                        } 
                        else {
                            interprete.removeCompiledField("prezzo_promo_kgl_1pezzo");
                        }

                        interprete.assignCompiledField("prezzo_promo_1pezzo",
                            "",
                            $"<PREZZO_1PEZZO>1 PEZZO € {MathExt.DecimalRoundToString(prezzo_promo)}</PREZZO_1PEZZO>"
                        );


                        if (fidelity.Trim()!="s")
                        {
                            interprete.removeCompiledField("fidelity");
                        }   

                        if (!alkg){      
                        interprete.assignCompiledField("prezzo_promo_kgl",
                            "",
                           $"<PREZZO_PROMO_KGL>€/{um_str} {MathExt.DecimalRoundToString(Math.Round(prezzo_kgl / 2, 2, MidpointRounding.AwayFromZero))}</PREZZO_PROMO_KGL>");
                        
                        if (reparto=="MACELLERIA"){
                            interprete.assignCompiledField("prezzo_promo_kgl","",$"<PREZZO_PROMO_KGL>€/{um_str} {MathExt.DecimalRoundToString(prezzo_kgl)}</PREZZO_PROMO_KGL>");
                        }                        
                        
                        }

                        if (reparto=="MACELLERIA") {
                            interprete.removeCompiledField("prezzo_promo_1pezzo");
                            interprete.removeCompiledField("prezzo_promo_kgl_1pezzo");
                            interprete.removeCompiledField("2pezzi");
                        }  

                        if (tema=="1+1")
                        {
                            interprete.removeCompiledField("logo_1+1");
                        }  

                    }
                    else if (codBox == "BOX_COLLECTION")
                    {
                        interprete.assignCompiledField("bollino",
                            "",
                           $"<BOLLINI>{note}</BOLLINI>"
                        );

                    }
                    else if (codBox == "BOX_NOFOOD")
                    {
                        interprete.assignCompiledField("txt_sconto",
                            "SCONTO",
                           $"-{(int)sconto}%"
                        );
                        interprete.assignCompiledField("txt_sconto_linea",
                            "SCONTO_LINEA",
                           $"SCONTO\n{(int)sconto} % SU TUTTA LA LINEA"
                        );

                        interprete.assignCompiledField("prezzo_continuo",
                            "",
                           $"<PREZZO_CONTINUO>€ {MathExt.DecimalRoundToString(prezzo_continuo)}</PREZZO_CONTINUO>"
                        );

                    }

                    // BOLLINI DA DESCR1 (ricerca testo)
                    foreach (var regola in RegoleBolliniDescr1)
                    {
                        // ricerca case-insensitive
                        if (!string.IsNullOrEmpty(descr1Tracciato) &&
                            descr1Tracciato.IndexOf(regola.pattern, StringComparison.OrdinalIgnoreCase) >= 0)
                        {
                            LogoBollo lbItem = loghibolliDB.source
                                .FirstOrDefault(lb => lb.sigla == regola.siglaLogo);

                            if (lbItem != null && !_bolliloghi.Any(b => b.sigla == lbItem.sigla))
                            {
                                _bolliloghi.Add(lbItem);
                                Console.WriteLine($"HO APPLICATO IL BOLLINO {lbItem.sigla.ToString()} ALLA REF {descr1Tracciato}");
                            }
                        }
                    }

                    //Console.WriteLine("REFERENZA: " + descr1.ToString() + " Prezzo promo: " + prezzo_promo.ToString() + " PrezzoKGL: " + prezzo_promo_kgl.ToString());
                    //Console.WriteLine("REFERENZA: " + descr1.ToString() + " Prezzo promo: " + prezzo_promo.ToString() + " PrezzoKGL: " + prezzo_kgl.ToString());

                    var fields = interprete.getFields();
                    item["compiledFields"] = fields.compiledFields;
                    item["deletedFields"] = fields.deletedFields;
                    interprete.clearInterpreter();
                    item[GLOBAL_VARIABLES.keyFotoExtraAuto] = _bolliloghi;
                    result.liste[0].Records.Add(tracciato[i]);
                }




            }
            catch (Exception ex)
            {
                result.errors = ex.ToString();
                //Console.WriteLine("ERRROR AGENZIA: " + ex.ToString() + " LOGS: " + logs);
            }

            return result;
        }

        public TracciatoResultKit esportaPoP(List<FicoContextField> promoContext, List<FicoContextField> tracciatoContext, List<ArticoloInKit> tracciato, FicoRuntimeKit kit, string pathNamingConvention, string pathACPV, string pathTipiDiExport, string pathOrdinamentoLista, string pathMeccaniche, string pathLoghiBolli, string pathFormati, string pathMappaStili, FicoCombinazioneKitReadMode readMode)
        {
            string keySottogruppo = GLOBAL_VARIABLES.keyScattoCodiceSottogruppo;
            List<string> _cacheSottogruppi = new List<string>();
            //Console.WriteLine("--------esporta con logiche di agenzia-------------");

            System.Globalization.CultureInfo culture = new System.Globalization.CultureInfo("it-IT");
            CultureInfo.CurrentCulture = culture;

            TracciatoResultKit result = new TracciatoResultKit();
            //return result;

            JObject o5 = JObject.Parse(File.ReadAllText(pathLoghiBolli));
            DbLoghiBolli loghibolliDB = o5.ToObject<DbLoghiBolli>();

            JObject o6 = JObject.Parse(File.ReadAllText(pathTipiDiExport));
            DbTipoDiExport tipiExportDB = o6.ToObject<DbTipoDiExport>();

            JObject o1 = JObject.Parse(File.ReadAllText(pathACPV));
            DbACPV acpvDB = o1.ToObject<DbACPV>();

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

            string tipoExport = "";
            //foreach (TipoDiExport tItem in tipiExportDB.source)
            //{
            //    IstantaLib.ArticoloInKitExportName codifica = new IstantaLib.ArticoloInKitExportName();
            //    codifica.guidIdTipoExport = tItem.guidID;
            //    codifica.nomeFile = NamingConventionUtility.Decode(tItem, promoContext, tracciatoContext, kit, acpvDB, ncDB, null, null, null, null);
            //    exportNames.Add(codifica);
            //}

            var tipoDiExpWeb = tipiExportDB.source.Find(f => f.codice == "WEB");

            if (kit.tipiDiExportInKit.Count == 1 && kit.tipiDiExportInKit[0].tipoDiExportGuidID == tipoDiExpWeb.guidID)
            {
                tipoExport = "WEB";
            }

            string logs = "";

            try
            {

                CompiledFieldInterpreter interprete = new CompiledFieldInterpreter();

                TracciatoKit tracciato_da_esportare = new TracciatoKit();
                result.liste = new List<TracciatoKit>() { tracciato_da_esportare };
                result.liste[0].Records = new List<ArticoloInKit>();
                result.liste[0].errors = "";



                for (int i = 0; i < tracciato.Count; i++) //lista_tracciato.Count; i++)
                {
                    ////Console.WriteLine($"esporta item: {i} di {tracciato.Count}");
                    ArticoloInKit artInKit = tracciato[i];





                    List<LogoBollo> _bolliloghi = new List<LogoBollo>();
                    
                    Dictionary<string, object> item = tracciato[i].recordInTracciato;// lista_tracciato[i];
                                                                                     //Compilazione dei campi
                                                                                     //Da mettere in esportazione

                    string codice_gruppo = item[GLOBAL_VARIABLES.keyScattoCodiceGruppo].ToString();
                    string codice_referenza = item[GLOBAL_VARIABLES.keyRefCodice].ToString();


                    decimal prezzo_promo = MathExt.Round(item["prezzo_promo"].ToDecimal(), 2, MidpointRounding.AwayFromZero);
                    decimal prezzo_promo_kgl = MathExt.Round(item["prezzo_promo_kgl"].ToDecimal(), 2, MidpointRounding.AwayFromZero);
                    decimal prezzo_continuo = MathExt.Round(item["prezzo_continuo"].ToDecimal(), 2, MidpointRounding.AwayFromZero);
                    decimal prezzo_kgl = MathExt.Round(item["prezzo_kgl"].ToDecimal(), 2, MidpointRounding.AwayFromZero);
                    decimal sconto = item["sconto"].ToDecimal();
                    string um= item[GLOBAL_VARIABLES.keyDescrUm].ToString().ToLower();
                    string um_str = (um == "lt" ? "L" : "Kg");
                    string fidelity= item["fidelity"].ToString().ToLower();
                    string tema= item["tema"].ToString();
                    decimal peso= item[GLOBAL_VARIABLES.keyDescrPeso].ToDecimal();
                    string marchio_conad= item["marchio_conad"].ToString();
                    string reparto= item["reparto"].ToString();

                    
                    string note= item["note"].ToString().ToLower();
                    //Console.WriteLine("DESCR1-> "  + item[GLOBAL_VARIABLES.keyDescr1].ToString());
                    ////Console.WriteLine(JsonConvert.SerializeObject(item));
                    string codBox = "";

                    //stringa per ricarca bollini
                    string descr1 = item.ContainsKey(GLOBAL_VARIABLES.keyDescr1) && item[GLOBAL_VARIABLES.keyDescr1] != null
                        ? item[GLOBAL_VARIABLES.keyDescr1].ToString()
                        : string.Empty;

                    string  descr1Tracciato = item.ContainsKey(GLOBAL_VARIABLES.keyDescr1Tracciato) && item[GLOBAL_VARIABLES.keyDescr1Tracciato] != null
                        ? item[GLOBAL_VARIABLES.keyDescr1Tracciato].ToString()
                        : string.Empty;


                    //Imposto le foto secondarie del gruppo
                    var _group = tracciato.Where(t => t.recordInTracciato[GLOBAL_VARIABLES_FICO.keyCodiceGruppo].ToString() == codice_gruppo).Select(s => s.recordInTracciato).ToList();
                    List<FotoElementoGruppo> membriGruppoFoto = RefsHelper.getFotoSecondarieDelGruppo(_group);
                    item[GLOBAL_VARIABLES_FICO.keyMembriGruppoFoto] = membriGruppoFoto;


                    if (item.ContainsKey(GLOBAL_VARIABLES.codiceBox))
                    {

                        if (item[GLOBAL_VARIABLES.codiceBox] == null)
                        {
                            logs += " è NULL ";
                            //Console.WriteLine($"{item[GLOBAL_VARIABLES.keyRefCodice].ToString()} non ha BOX assegnato");
                        }
                        else
                        {
                            codBox = item[GLOBAL_VARIABLES.codiceBox].ToString();
                        }
                    }
                    
                    //definizione degli stili
                    string styDescr1 = "DESCRIZIONE_TITOLO";
                    string styDescr3 = "DESCRIZIONE_TIPO";
                    string styDescr2 = "DESCRIZIONE_BRAND";
                    string styDescr4 = "DESCRIZIONE_GRAMMATURA";

                    string prezzo_promo_style = "PREZZO_PROMO";
                    string prezzo_promo_kgl_style = "PREZZO_PROMO_KGL";
                    string prezzo_continuo_style = "PREZZO_CONTINUO";
                    
                    //associa mastro standard
                    interprete.assignCompiledField(GLOBAL_VARIABLES_FICO.compiledFieldKeyMastro, "", "ma-STD");

                    if (codBox == "BOX_FG")
                    {
                        prezzo_promo_kgl_style += "_FG";
                        prezzo_promo_style += "_FG";
                        styDescr1 += "_FG";
                        styDescr2 += "_FG";
                        styDescr3 += "_FG";
                        styDescr4 += "_FG";

                    }
                    else if (codBox == "BOX_COLLECTION")
                    {
                        prezzo_promo_kgl_style += "_COLLECTION";
                        prezzo_promo_style += "_COLLECTION";
                        styDescr1 += "_COLLECTION";
                        styDescr2 += "_COLLECTION";
                        styDescr3 += "_COLLECTION";
                        styDescr4 += "_COLLECTION";

                        interprete.assignCompiledField(GLOBAL_VARIABLES_FICO.compiledFieldKeyMastro, "", "ma-StrangerThings");
                    }
                    else if (codBox == "BOX_NOFOOD")
                    {
                        prezzo_promo_kgl_style += "_NOFOOD";
                        //prezzo_promo_kgl non esiste in questo box

                        styDescr1 += "_NOFOOD";
                        styDescr2 += "_NOFOOD";
                        styDescr3 += "_NOFOOD";
                        styDescr4 += "_NOFOOD";

                    }
                    else if (codBox == "BOX_SG")
                    {
                        styDescr1 += "_SG";
                        styDescr2 += "_SG";
                        styDescr3 += "_SG";
                        styDescr4 += "_SG";
                    }
                    else if (codBox == "BOX_B&F")
                    {
                        interprete.assignCompiledField(GLOBAL_VARIABLES_FICO.compiledFieldKeyMastro, "", "ma-B&F");
                    }

                    List<CompiledField> _listCompiled = new List<CompiledField>();

                    var Descrizione1 = "";
                    var Descrizione2 = "";
                    var Descrizione3 = "";
                    var Descrizione4 = "";
                    var Peso = "";
                    var Um = "";

                    if (item.ContainsKey("descrizione_gruppo"))
                    {
                        Descrizione1 = (item["descrizione_gruppo"] as Dictionary<string, object>)["Descrizioni.Descrizione1"].ToString();
                        Descrizione2 = (item["descrizione_gruppo"] as Dictionary<string, object>)["Descrizioni.Descrizione2"].ToString();
                        Descrizione3 = (item["descrizione_gruppo"] as Dictionary<string, object>)["Descrizioni.Descrizione3"].ToString();
                        Descrizione4 = (item["descrizione_gruppo"] as Dictionary<string, object>)["Descrizioni.Descrizione4"].ToString();
                        Peso = item["Descrizioni.Peso"].ToString();
                        Um = item["Descrizioni.Um"].ToString();
                    }
                    else
                    {
                        Descrizione1 = item["Descrizioni.Descrizione1"].ToString();
                        Descrizione2 = item["Descrizioni.Descrizione2"].ToString();
                        Descrizione3 = item["Descrizioni.Descrizione3"].ToString();
                        Descrizione4 = item["Descrizioni.Descrizione4"].ToString();
                        Peso = item["Descrizioni.Peso"].ToString();
                        Um = item["Descrizioni.Um"].ToString();
                    }

                    string descr_prog = Descrizione1;

                    if (Descrizione2!="" && (!Descrizione2.Contains("$br") || Descrizione1.IndexOf("$br")>0))
                    {
                        if (descr_prog != "")
                            Descrizione2 = " " + Descrizione2;
                    }

                    descr_prog += Descrizione2;

                    if (Descrizione3 != "" && (!Descrizione3.Contains("$br") || Descrizione3.IndexOf("$br") <= 0))
                    {
                        //Se descrizione 1 non ha br oppure non ce l'ha all'inizio e quindi per forza alla fine
                        Descrizione3 = " " + Descrizione3;
                    }

                    descr_prog += Descrizione3;

                    if (Descrizione4!="" && (!Descrizione4.Contains("$br") || Descrizione4.IndexOf("$br") > 0))
                    {
                        //Se descrizione 1 non ha br oppure non ce l'ha all'inizio e quindi per forza alla fine
                        Descrizione4 = " " + Descrizione4;
                    }

                    descr_prog += Descrizione4;


                    interprete.assignCompiledField("descrizione",
                        "",
                        $"{new FieldTagContent(styDescr1, Descrizione1).ToString()}" +
                        $"{new FieldTagContent(styDescr2, Descrizione2).ToString()}" +
                        $"{new FieldTagContent(styDescr3, Descrizione3).ToString()}" +
                        $"{new FieldTagContent(styDescr4, Descrizione4).ToString()}"
                    );

                    if (codBox=="BOX_COLLECTION")
                        {
                        interprete.assignCompiledField("prezzo_promo",
                            prezzo_promo_style,
                            $"{MathExt.DecimalRoundToString(prezzo_promo)}"
                        );
                    } 

                    if (reparto=="GASTRONOMIA")
                        {
                        interprete.assignCompiledField("prezzo_promo",
                            prezzo_promo_style,
                            $"€ {MathExt.DecimalRoundToString(prezzo_promo/10)}"
                        );
                    } 
                    else 
                    {
                        interprete.assignCompiledField("prezzo_promo",
                            prezzo_promo_style,
                            $"€ {MathExt.DecimalRoundToString(prezzo_promo)}"
                        );
                    }

                    //gestione prezzo KGL
                    bool alkg=false;

                    
                    interprete.assignCompiledField("prezzo_promo_kgl",
                            "",
                            $"<{prezzo_promo_kgl_style}>€/{um_str} {MathExt.DecimalRoundToString(prezzo_kgl)}</{prezzo_promo_kgl_style}>");


                    if (prezzo_kgl!=0)
                    {

                        if ((reparto=="MACELLERIA" || reparto=="ORTOFRUTTA") && peso==1)
                        {
                            interprete.removeCompiledField("prezzo_promo_kgl");
                        } else {
                            interprete.assignCompiledField("prezzo_promo_kgl",
                            "",
                            $"<{prezzo_promo_kgl_style}>€/{um_str} {MathExt.DecimalRoundToString(prezzo_kgl)}</{prezzo_promo_kgl_style}>"
                        );
                        }

                    }  else {

                        if ((reparto=="MACELLERIA" || reparto=="ORTOFRUTTA") && peso==1)
                        {
                           interprete.assignCompiledField("prezzo_promo_kgl",
                            "",
                            $"<{prezzo_promo_kgl_style}>al kg</{prezzo_promo_kgl_style}>");
                            alkg=true;
                    

                        } else  {
                            interprete.removeCompiledField("prezzo_promo_kgl");
                            interprete.removeCompiledField("prezzo_promo_kgl_1pezzo");

                        }

                    }

                     //gestione sfondi e loghi per tutte le meccaniche

                    if (marchio_conad=="versonatura")
                    {
                        LogoBollo lbItem = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Logo_VN");
                            if (lbItem != null)
                            {
                                _bolliloghi.Add(lbItem);
                            }

                        lbItem = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Sfondo_VN");
                            if (lbItem != null)
                            {
                                _bolliloghi.Add(lbItem);
                            }                        
                    }

                    if (marchio_conad=="BDP")
                    {
                    interprete.assignCompiledField(GLOBAL_VARIABLES_FICO.compiledFieldKeyMastro, "", "ma-BDP");                        
                        LogoBollo lbItem = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Logo_BDP");
                            if (lbItem != null)
                            {
                                _bolliloghi.Add(lbItem);
                            }

                        lbItem = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Sfondo_BDP");
                            if (lbItem != null)
                            {
                                _bolliloghi.Add(lbItem);
                            }                        
                    }
                    if (marchio_conad=="SaporiE")
                    {
                        LogoBollo lbItem = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Logo_SaporiE");
                            if (lbItem != null)
                            {
                                _bolliloghi.Add(lbItem);
                            }

                        lbItem = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Sfondo_BDP");
                            if (lbItem != null)
                            {
                                _bolliloghi.Add(lbItem);
                            }                        
                    }

                    if (marchio_conad=="11 PARALLELI")
                    {
                        LogoBollo lbItem = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Logo_11Paralleli");
                            if (lbItem != null)
                            {
                                _bolliloghi.Add(lbItem);
                            }                      
                    }

                    if (marchio_conad=="CONAD")
                    {
                        LogoBollo lbItem = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Logo_Conad");
                            if (lbItem != null)
                            {
                                _bolliloghi.Add(lbItem);
                                //Console.WriteLine("HO APPLICATO IL BOLLINO CONAD");
                            }                      
                    }

                    if (marchio_conad=="CONAD ALIMENTUM SL")
                    {
                        LogoBollo lbItem = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Logo_Alimentum_SenzaLattosio");
                            if (lbItem != null)
                            {
                                _bolliloghi.Add(lbItem);
                            }                      
                    }

                    if (marchio_conad=="CONAD BABY")
                    {
                        LogoBollo lbItem = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Logo_Baby");
                            if (lbItem != null)
                            {
                                _bolliloghi.Add(lbItem);
                            }                      
                    }
                    if (marchio_conad=="CONAD ESSENTIAE")
                    {
                        LogoBollo lbItem = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Logo_conad_essentiae");
                            if (lbItem != null)
                            {
                                _bolliloghi.Add(lbItem);
                            }                      
                    }

                    if (marchio_conad=="CONAD PET")
                    {
                        LogoBollo lbItem = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Logo_Petfriends");
                            if (lbItem != null)
                            {
                                _bolliloghi.Add(lbItem);
                            }                      
                    }

                    if (marchio_conad=="CONAD PET PLUS")
                    {
                        LogoBollo lbItem = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Logo_PetfriendsPlus");
                            if (lbItem != null)
                            {
                                _bolliloghi.Add(lbItem);
                            }                      
                    }

                    if (marchio_conad=="PARAFARMACIA")
                    {
                        LogoBollo lbItem = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Logo_Parafarmacia");
                            if (lbItem != null)
                            {
                                _bolliloghi.Add(lbItem);
                            }                      
                    }

                    //bollini OF

                    if (note.Contains("prodotto italiano"))
                    {
                        LogoBollo lbItem = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Logo_Prodottoitaliano");
                            if (lbItem != null)
                            {
                                _bolliloghi.Add(lbItem);
                            }
                    }

                    if (note.Contains("prodotto 100% italiano"))
                    {
                        LogoBollo lbItem = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Logo_100italiano");
                            if (lbItem != null)
                            {
                                _bolliloghi.Add(lbItem);
                            }
                    }

                    // GESTIONE CUSTOM  MECCANICHE
                    if (codBox=="BOX_STD")
                    {


                        if (note.Contains("max "))
                        {
                        // Estrae il primo numero dentro la stringa
                        var match = Regex.Match(note, @"\b(\d+)\b");
                        var numero = match.Success ? match.Groups[1].Value : "N";

                        interprete.assignCompiledField(
                            "txt_max_pezzi",
                            "",
                            $"<MAX_PEZZI>MAX {numero} CONF. ASS.</MAX_PEZZI>"
                        );

                        }
                        else
                        {
                            interprete.removeCompiledField("max_pezzi");
                        }

                        if (fidelity.Trim()!="s")
                        {
                            interprete.removeCompiledField("fidelity");
                        }   
                         
                         if (!alkg){
                         interprete.assignCompiledField("prezzo_promo_kgl",
                            "",
                           $"<PREZZO_PROMO_KGL>€/{um_str} {MathExt.DecimalRoundToString(prezzo_kgl)}</PREZZO_PROMO_KGL>"
                        );
                        }

                    }             
                    else if (codBox=="BOX_1+1")
                    {

                        interprete.assignCompiledField(GLOBAL_VARIABLES_FICO.compiledFieldKeyMastro, "", "ma-1+1");

                        if (peso!=1) {
                        interprete.assignCompiledField("prezzo_promo_kgl_1pezzo","",$"<PREZZO_PROMO_KGL_1PEZZO>€/{um_str} {MathExt.DecimalRoundToString(prezzo_kgl)}</PREZZO_PROMO_KGL_1PEZZO>"); 
                        } 
                        else {
                            interprete.removeCompiledField("prezzo_promo_kgl_1pezzo");
                        }

                        interprete.assignCompiledField("prezzo_promo_1pezzo",
                            "",
                            $"<PREZZO_1PEZZO>1 PEZZO € {MathExt.DecimalRoundToString(prezzo_promo)}</PREZZO_1PEZZO>"
                        );


                        if (fidelity.Trim()!="s")
                        {
                            interprete.removeCompiledField("fidelity");
                        }   

                        if (!alkg){      
                        interprete.assignCompiledField("prezzo_promo_kgl",
                            "",
                           $"<PREZZO_PROMO_KGL>€/{um_str} {MathExt.DecimalRoundToString(Math.Round(prezzo_kgl / 2, 2, MidpointRounding.AwayFromZero))}</PREZZO_PROMO_KGL>");
                        
                        if (reparto=="MACELLERIA"){
                            interprete.assignCompiledField("prezzo_promo_kgl","",$"<PREZZO_PROMO_KGL>€/{um_str} {MathExt.DecimalRoundToString(prezzo_kgl)}</PREZZO_PROMO_KGL>");
                        }                        
                        
                        }

                        if (reparto=="MACELLERIA") {
                            interprete.removeCompiledField("prezzo_promo_1pezzo");
                            interprete.removeCompiledField("prezzo_promo_kgl_1pezzo");
                            interprete.removeCompiledField("2pezzi");
                        }  

                        if (tema=="1+1")
                        {
                            interprete.removeCompiledField("logo_1+1");
                        }  

                    }                             
                    else if (codBox == "BOX_COLLECTION")
                    {
                        interprete.assignCompiledField("bollino",
                            "",
                           $"<BOLLINI>{note}</BOLLINI>"
                        );
                        interprete.assignCompiledField("prezzo_promo",
                            prezzo_promo_style,
                            $"{MathExt.DecimalRoundToString(prezzo_promo)}"
                        );
                    }                 
                    else if (codBox == "BOX_NOFOOD")
                    {
                        interprete.assignCompiledField("txt_sconto",
                            "SCONTO",
                           $"-{(int)sconto}%"
                        );
                        interprete.assignCompiledField("txt_sconto_linea",
                            "SCONTO_LINEA",
                           $"SCONTO\n{(int)sconto} % SU TUTTA LA LINEA"
                        );

                        interprete.assignCompiledField("prezzo_continuo",
                            "",
                           $"<PREZZO_CONTINUO>€ {MathExt.DecimalRoundToString(prezzo_continuo)}</PREZZO_CONTINUO>"
                        );

                    }

                    // BOLLINI DA DESCR1 (ricerca testo)
                    foreach (var regola in RegoleBolliniDescr1)
                    {
                        // ricerca case-insensitive
                        if (!string.IsNullOrEmpty(descr1Tracciato) &&
                            descr1Tracciato.IndexOf(regola.pattern, StringComparison.OrdinalIgnoreCase) >= 0)
                        {
                            LogoBollo lbItem = loghibolliDB.source
                                .FirstOrDefault(lb => lb.sigla == regola.siglaLogo);

                            if (lbItem != null && !_bolliloghi.Any(b => b.sigla == lbItem.sigla))
                            {
                                _bolliloghi.Add(lbItem);
                                //Console.WriteLine($"HO APPLICATO IL BOLLINO {lbItem.sigla.ToString()} ALLA REF {descr1Tracciato}");
                            }
                        }
                    }



                    var fields = interprete.getFields();
                    item["compiledFields"] = fields.compiledFields;
                    item["deletedFields"] = fields.deletedFields;
                    interprete.clearInterpreter();
                    item[GLOBAL_VARIABLES.keyFotoExtraAuto] = _bolliloghi;




                    Console.WriteLine("REFERENZA: " + descr1.ToString() + " Prezzo promo: " + prezzo_promo.ToString() + " PrezzoKGL: " + prezzo_promo_kgl.ToString());

                    //NAMING SINGOLO
                    List<ArticoloInKitExportName> _names = new List<ArticoloInKitExportName>();
                    foreach (TipoDiExport tItem in tipiExportDelKit)
                    {
                        IstantaLib.ArticoloInKitExportName codifica = new IstantaLib.ArticoloInKitExportName();
                        codifica.guidIdTipoExport = tItem.guidID;
                        codifica.nomeFile = NamingConventionUtility.Decode(tItem, promoContext, tracciatoContext, kit, acpvDB, ncDB, null, artInKit.recordInTracciato, this, null);
                        _names.Add(codifica);
                    }

                    artInKit.recordInTracciato[GLOBAL_VARIABLES_FICO.keyFicoNames] = _names;

                    result.liste[0].Records.Add(tracciato[i]);
                }



            }
            catch (Exception ex)
            {
                result.errors = ex.ToString();
                //Console.WriteLine("ERRROR AGENZIA: " + ex.ToString() + " LOGS: " + logs);
            }

            return result;
        }

        public string getAlterazioniTracciatoFromIndd(List<Dictionary<string, object>> gruppo, Dictionary<string, object> articoloIndd)
        {
            throw new NotImplementedException();
        }


        public string ordinaLista(List<Dictionary<string, object>> listRecs, string pathOrdinamentoLista)
        {
            throw new NotImplementedException();
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
            foreach (var gruppoSingolo in gruppo)
            {
                string resGruppo = eseguiAutoSelezioneGruppo(gruppoSingolo, ghost);
                List<Dictionary<string, object>> resultExtDict = JsonConvert.DeserializeObject<List<Dictionary<string, object>>>(resGruppo);
                foreach (var el in resultExtDict)
                {
                    if (el.ContainsKey(GLOBAL_VARIABLES.keyXMLSelezione))
                    {
                        var refSingola = gruppoSingolo.FirstOrDefault(g => g[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString() == el[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString());
                        refSingola[GLOBAL_VARIABLES.keyXMLSelezione] = Byte.Parse(el[GLOBAL_VARIABLES.keyXMLSelezione].ToString());
                    }
                }
            }

            return gruppo;
        }

        public string callbackNamingConventionDynamicField(string campo, Dictionary<string, object> rec, List<FicoCombinazioniKitDeclinazioneProprieta> propsDeclinazione)
        {
            if (rec == null)
                return "NaN";

            if (campo=="isGruppo")
            {
                if (rec[GLOBAL_VARIABLES_FICO.keyCodiceGruppo].ToString().Split(',').Count()>1)
                {
                    return "_G";
                }
            }
            else if (campo == "codiceRef")
            {                
                if (rec.ContainsKey(GLOBAL_VARIABLES_FICO.keyRefCodiceOrigin))
                {
                    //Si trata di un sottogruppo che ha dovuto preservare il cod singolo di origine
                    string codSingolo = rec[GLOBAL_VARIABLES_FICO.keyRefCodiceOrigin].ToString();

                    return codSingolo;
                }
                else
                {
                    return rec[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString();
                }
            }

            return "";
        }

        public List<Dictionary<string, object>> elaboraTracciatiRecords(List<Dictionary<string, object>> records, FicoRuntimeKit kit, string siglaAreaKit)
        {
            return records;
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
List<Dictionary<string, object>> records, string utente)
        {
            return records;
        }
        public string CheckFirmaPluginGarantitaBatch(WrapperBatchCheckFirmaPlugin batch)
        {
            return null;
        }
    }
}
