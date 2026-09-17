 using AgenziaLib.Tipi;
using IstantaLib;
using Microsoft.SqlServer.Server;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Security.Policy;
using System.Text;

namespace AgenziaLib
{
    public class ISTBusinessSuggerimentiRequest
    {
        public List<string> EANS;
    }
    public class ISTBusinessSuggerimentiItem
    {
        public string EAN;
        public string DESCRIZIONE1; 
        public string DESCRIZIONE2; 
        public string DESCRIZIONE3; 
        public string DESCRIZIONE4;
    }
    public class ISTBusinessSuggerimentiItemWithDetails : ISTBusinessSuggerimentiItem
    {
        public decimal PREZZO_PROMO;
        public decimal PREZZO_CONTINUO;
        public decimal PREZZO_KGL;
        public string UM;
        public decimal PESO;

    }

    public class ISTBusinessSuggerimentiGruppoResult
    {
        public bool ok;
        public ISTBusinessSuggerimentiItem data;
    }

    public class ISTBusinessSuggerimentiResponse
    {        
        public bool ok;
        public int count;
        public List<ISTBusinessSuggerimentiItem> items=new List<ISTBusinessSuggerimentiItem>();

    }

    public class Coopfi : IAgenzia
    {
        List<Dictionary<string, object>> lista_tracciato;
        //Settori/reparti No FOOD
        private readonly string[] settori_no_food = new string[] { "62", "64", "66", "68" };
        private readonly string[] reparti_no_food = new string[] { "01", "02", "03", "04", "05", "06", "07", "09", "11", "12" };
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

        public string confrontaListatoVolantino(List<Dictionary<string, object>> primario, Dictionary<string, string> reqParams)
        {
            throw new NotImplementedException();
        }

        public AnalisiConfrontoResponse confrontaListe(AnalisiConfrontoTracciatoDetails primario, AnalisiConfrontoTracciatoDetails secondario, bool controlloVersione, Dictionary<string, string> reqParams)
        {
            AnalisiConfrontoResponse result = new AnalisiConfrontoResponse();
            //Non ho contenuto aggiuntivo da fornire per cui svuoto le liste
            if (primario != null)
                primario.tracciati.ForEach(f => f.records = new List<Dictionary<string, object>>());
            if (secondario != null)
                secondario.tracciati.ForEach(f => f.records = new List<Dictionary<string, object>>());

            result.primario = primario;
            result.secondario = secondario;


            return result;
        }

        public string eseguiAutoSelezioneGruppo(List<Dictionary<string, object>> gruppo, List<Dictionary<string, object>> ghost)
        {
            string keyXMLSelezione = GLOBAL_VARIABLES.keyXMLSelezione;
            string keyHasFoto = GLOBAL_VARIABLES.keyHasFoto;
            bool primariaTrovata = false;
            int secondarieSelezionate = 0;

            string codGruppo = gruppo.FirstOrDefault()[GLOBAL_VARIABLES_FICO.keyCodiceGruppo].ToString();
            try
            {

                // Console.WriteLine($"Autoselezione {codGruppo}");
                int countPrimariFirst = gruppo.Count(p => p.ContainsKey(keyXMLSelezione) && Convert.ToByte(p[keyXMLSelezione]) == (Byte)TipoSelezioneMenabo.Primaria);
                //Console.WriteLine($"Attualmente sono selezionati {countPrimariFirst} primari");

                var primarioPrimaDiElaborare = gruppo.FirstOrDefault(c => c.ContainsKey(keyXMLSelezione) && Convert.ToByte(c[keyXMLSelezione]) == (Byte)TipoSelezioneMenabo.Primaria);
                if (primarioPrimaDiElaborare == null)
                    primarioPrimaDiElaborare = gruppo.FirstOrDefault();

                string settore = primarioPrimaDiElaborare["settore"].ToString().ToLower();
                int countSconti = gruppo.GroupBy(g => g["txt_sconto"].ToDecimal()).Count();



                int countSecondarie = gruppo.Count(c => c.ContainsKey(keyXMLSelezione) && Convert.ToByte(c[keyXMLSelezione]) == (Byte)TipoSelezioneMenabo.Secondaria);

                bool is_linea = false;
                if (primarioPrimaDiElaborare.ContainsKey("is_linea"))
                    is_linea = primarioPrimaDiElaborare["is_linea"].ToString() == "x";

                if (!is_linea)
                {
                    if (settore == "freschissimi")
                    {
                        //Imposto come primario il primo che ha il prezzo diverso sa zero
                        var primarioFreschissimi = gruppo.FirstOrDefault(i => i["prezzo_promo"].ToDecimal() > 0);
                        if (primarioFreschissimi != null)
                        {
                            gruppo.ForEach(i =>
                            {
                                i[keyXMLSelezione] = (Byte)TipoSelezioneMenabo.None;
                            });

                            //Console.WriteLine($"Impostato primario freschissimi {primarioFreschissimi[GLOBAL_VARIABLES_FICO.keyRefCodice]}");
                            primarioFreschissimi[keyXMLSelezione] = (Byte)TipoSelezioneMenabo.Primaria;
                            //return JsonConvert.SerializeObject(gruppo);



                            primariaTrovata = true;
                        }
                    }
                }

                if (countSconti > 1 && !primariaTrovata)
                {
                    var primarioScontoPiuBasso = gruppo.Where(w => w["txt_sconto"].ToDecimal() > 0).OrderBy(o => o["txt_sconto"].ToDecimal()).FirstOrDefault();
                    if (primarioScontoPiuBasso != null)
                    {
                        gruppo.ForEach(i =>
                        {
                            i[keyXMLSelezione] = (Byte)TipoSelezioneMenabo.None;
                        });

                        primarioScontoPiuBasso[keyXMLSelezione] = (Byte)TipoSelezioneMenabo.Primaria;
                        //Console.WriteLine($"Impostato primario sconto piu basso {primarioScontoPiuBasso[GLOBAL_VARIABLES_FICO.keyRefCodice]}");
                        primariaTrovata = true;
                    }
                }

                if (!primariaTrovata)
                {
                    foreach (var item in gruppo)
                    {
                        //Controllo se è gia assegnato come primario 
                        if (item.ContainsKey(keyXMLSelezione))
                        {
                            if (Convert.ToByte(item[keyXMLSelezione]) == (Byte)TipoSelezioneMenabo.Primaria)
                            {
                                continue;
                            }
                        }

                        string valHasFoto = item.ContainsKey(keyHasFoto) ? item[keyHasFoto].ToString() : "false";
                        Boolean.TryParse(valHasFoto, out bool hasFoto);
                        if (item.ContainsKey(keyHasFoto) && hasFoto)
                        {
                            if (!primariaTrovata)
                            {
                                item[keyXMLSelezione] = (Byte)TipoSelezioneMenabo.Primaria;
                                primariaTrovata = true;
                            }
                            //else if (secondarieSelezionate < 1 || (secondarieSelezionate<2 && is_linea))
                            else if (secondarieSelezionate < 2 && is_linea)
                            {
                                item[keyXMLSelezione] = (Byte)TipoSelezioneMenabo.Secondaria;
                                secondarieSelezionate++;
                            }
                            else
                            {
                                item[keyXMLSelezione] = (Byte)TipoSelezioneMenabo.None;
                            }
                        }
                        else
                        {
                            item[keyXMLSelezione] = (Byte)TipoSelezioneMenabo.None;
                        }
                    }
                }

                //Console.WriteLine($"primario trovato {primariaTrovata}");

                if (!primariaTrovata)
                {
                    //Rimetto la primaria quella di origien dato che non è stata trovata con logica di agenzia
                    primarioPrimaDiElaborare[keyXMLSelezione] = (Byte)TipoSelezioneMenabo.Primaria;
                    //Console.WriteLine($"Impostato primario {primarioPrimaDiElaborare[GLOBAL_VARIABLES_FICO.keyRefCodice]}");
                }

                //if (secondarieSelezionate == 0 && gruppo.Count > 1)
                //{
                //    //Assegno cmq almeno una secodnaria in un gruppo
                //    Dictionary<string, object> secondariaPotenziale = gruppo.FirstOrDefault(c => (Byte)c[keyXMLSelezione] != (Byte)TipoSelezioneMenabo.Primaria && (bool)c[keyHasFoto]);
                //    if (secondariaPotenziale != null)
                //    {
                //        secondariaPotenziale[keyXMLSelezione] = (Byte)TipoSelezioneMenabo.Secondaria;
                //        secondarieSelezionate++;
                //    }
                //}
            } catch (Exception ex)
            {
                Console.WriteLine("AutoSelezione error: " + ex.ToString());
            }


            //int countPrimari = gruppo.Count(p => p.ContainsKey(keyXMLSelezione) && (Byte)p[keyXMLSelezione] == (Byte)TipoSelezioneMenabo.Primaria);
            //bool primarioSelezionato =  countPrimari > 0;
            //if (!primarioSelezionato)
            //    Console.WriteLine($"ATTENZIONE!!!! : Primario assente per {codGruppo}");
            //if (countPrimari > 1)
            //    Console.WriteLine($"ATTENZIONE!!! Selezionati {countPrimari} primari!!!");

            return JsonConvert.SerializeObject(gruppo);
        }

        public TracciatoResultKit esportaPoP(List<FicoContextField> promoContext, List<FicoContextField> tracciatoContext, List<ArticoloInKit> tracciato, FicoRuntimeKit kit, string pathNamingConvention, string pathACPV, string pathTipiDiExport, string pathOrdinamentoLista, string pathMeccaniche, string pathLoghiBolli, string pathFormati, string pathMappaStili, FicoCombinazioneKitReadMode readMode)
        {
            System.Globalization.CultureInfo culture = new System.Globalization.CultureInfo("it-IT");
            CultureInfo.CurrentCulture = culture;
            TracciatoResultKit result = new TracciatoResultKit();

            string potenziale_esempio = Edro21Context.Meta.potenziale_esempio;
            string meccanica_origine = Edro21Context.Meta.meccanica_origine;
            string keyArea = Edro21Context.Meta.area;
            string keyTipo_volantino = Edro21Context.Meta.tipo_volantino;
            string keyRuolo = Edro21Context.Meta.ruolo;
            string keySegmento = Edro21Context.Meta.segmento;
            string keyNote_category = Edro21Context.Meta.note_category;
            string keyDistintivita = Edro21Context.Meta.distintivita;
            string keyReparto = Edro21Context.Meta.reparto;
            string keyCodice_scatto = Edro21Context.Meta.codice_scatto;
            string keyTema = Edro21Context.Meta.tema;
            string keyPrezzo_offerta = Edro21Context.Meta.prezzo_offerta;
            string keyPrezzo_offerta_kgl = Edro21Context.Meta.prezzo_offerta_kgl;
            string keyPaghi_secondo = Edro21Context.Meta.prezzo_offerta_secondo;
            string keySezione = Edro21Context.Meta.sezione;
            string keySconto_agenzia = Edro21Context.Meta.sconto_agenzia;
            string keyTipo_tema = Edro21Context.Meta.tipo_tema;
            string keyRange_1 = Edro21Context.Meta.range_1;
            string keyRange_2 = Edro21Context.Meta.range_2;
            string keyPaghi_kgl_secondo = Edro21Context.Meta.prezzo_offerta_kgl_secondo;
            string keyPunti_1 = Edro21Context.Meta.punti_1;
            string keyPunti_2 = Edro21Context.Meta.punti_2;
            string keySettore = Edro21Context.Meta.settore;
            string keyTipo_punti = Edro21Context.Meta.tipo_punti;
            string keyPrezzo_anziche = Edro21Context.Meta.prezzo_anziche;
            string keyPrezzo_anziche_kgl = Edro21Context.Meta.prezzo_anziche_kgl;
            string keyPaghi_due_pezzi = Edro21Context.Meta.paghi_due_pezzi;
            string keyN_MM = Edro21Context.Meta.N_MM;
            string keyM_MM = Edro21Context.Meta.M_MM;
            string keyRefs = Edro21Context.Meta.refs;
            string keyN_FID = Edro21Context.Meta.N_FID;
            string keyM_FID = Edro21Context.Meta.M_FID;
            string keyM_numero_reparto = Edro21Context.Meta.numero_reparto;
            string keyM_numero_settore = Edro21Context.Meta.numero_settore;
            string keyDicituraReparto = Edro21Context.Meta.dicitura_reparto;
            string keyM_prezzo_offerta_um_com = Edro21Context.Meta.prezzo_offerta_um_com;
            string keyM_prezzo_anziche_um_com = Edro21Context.Meta.prezzo_anziche_um_com;
            string keyM_unita_fatt = Edro21Context.Meta.unita_fatt;
            string keyM_um_com = Edro21Context.Meta.um_com;
            string key_combinazioneAssegnata = Edro21Context.Meta.keyCombinazioneAssegnata;
            string key_codiceBox = Edro21Context.Meta.keyCodiceBox;
            string keySconto_MM = Edro21Context.Meta.sconto_MM;
            string keySconto_FID = Edro21Context.Meta.sconto_FID;
            string keyStatoSelezione = Edro21Context.Meta.keyStatoSelezione;
            string keySottogruppo = GLOBAL_VARIABLES.keyScattoCodiceSottogruppo;



            TracciatoKit tracciato_da_esportare = new TracciatoKit();
            string referenza_pilota = Edro21Context.Meta.referenza_pilota;
            result.liste = new List<TracciatoKit>() { tracciato_da_esportare };
            result.liste[0].Records = new List<ArticoloInKit>();
            result.liste[0].errors = "";// = new List<Dictionary<string, object>>();
            List<string> _cacheSottogruppi = new List<string>();
            try
            {
                //requestParams = formRequest;
                lista_tracciato = tracciato.Select(s => s.recordInTracciato).ToList();

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

                var formatoKit = formatiDB.source.Find(f => f.guidID == kit.guidFormato).codice;

                //I nomi saranno per tutte le ref identici quindi lo estraggouna volta soltanto
                //List<IstantaLib.ArticoloInKitExportName> exportNames = new List<IstantaLib.ArticoloInKitExportName>();

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
                //    codifica.nomeFile = NamingConventionUtility.Decode(tItem, promoContext, tracciatoContext, kit, acpvDB, ncDB, formatiDB, null);
                //    exportNames.Add(codifica);
                //}

                var tipoDiExpWeb = tipiExportDB.source.Find(f => f.codice == "WEB");

                if (kit.tipiDiExportInKit.Count == 1 && kit.tipiDiExportInKit[0].tipoDiExportGuidID == tipoDiExpWeb.guidID)
                {
                    tipoExport = "WEB";
                }

                CompiledFieldInterpreter interprete = new CompiledFieldInterpreter();


                //lettura del tracciato
                int counter = 0;
                int contaRefGruppo = 0;

                string curr_group_processed = "";
                string curr_fotoPgroup_processed = "";
                List<FotoElementoGruppo> _list_membriSecondari_cache = new List<FotoElementoGruppo>();

                string curr_reparto = "";

                tracciato = tracciato.OrderBy(o => o.recordInTracciato["reparto"].ToString()).ToList();

                for (int i = 0; i < tracciato.Count; i++) //lista_tracciato.Count; i++)
                {
                    ArticoloInKit artInKit = tracciato[i];
                    Dictionary<string, object> recItem = tracciato[i].recordInTracciato;// lista_tracciato[i];


                    string codice_gruppo = recItem[GLOBAL_VARIABLES.keyScattoCodiceGruppo].ToString();
                    string codice_referenza = recItem[GLOBAL_VARIABLES.keyRefCodice].ToString();

                    /*DEBUG REFERENZE SINGOLE */
                    string[] _codFiltro = new string[]{
                        /*"2800180",
                        "7155000",
                        "7713874",
                        "3166451",
                        "3166452",
                        "3166454",
                        "3166455",
                        "3166456",
                        "3166457",
                        "3166460",
                        "3166462",
                        "6604115",
                        "6604138",
                        "6604207",
                        "6604211",
                        "6604218",
                        "7179108",*/
                        "2570460",
                        "3396550",
                        "3396370"
                    };

                    if (!_codFiltro.Contains(codice_referenza))
                    {
                        //continue;
                    }

                    /*FINE DEBUG*/



                    string tema = recItem["tema"].ToString().ToLower();
                    bool is_tasto_bilancia = false;
                    bool is_fuori_volantino = (tema.IndexOf("fuori depliant") >= 0);
                    string descr1DaLista = recItem[GLOBAL_VARIABLES_FICO.keyDescr1Tracciato].ToString().ToLower();

                    if (is_fuori_volantino) // !is_fuori_volantino && FuoriVolField.IndexOf("volantino") < 0)
                    {
                        //continue;
                    }

                    if (tema.StartsWith("grandi marche") || tema.StartsWith("grandimarche"))
                    {
                        continue;

                    }
                    /*
                    FORMATI COOP
                    A3_VERTICALI
                    A3_ORIZZONTALI
                    A7
                    */

                    //escludi temi per formato

                    //Console.WriteLine("Debug tematica " + codice_referenza + " -> " + tema);

                    if (formatoKit == "A3_ORIZZONTALI")
                    {
                        if (tema.Contains("jolly") || tema.Contains("sprint") || tema.Replace(" ", "").Contains("extripla"))
                        {
                            //Console.WriteLine("Intercettato!");
                            continue;
                        }
                    }
                    else if (formatoKit == "A3_VERTICALI")
                    {
                        if (tema.Contains("jolly") || tema.Contains("sprint") || tema.Replace(" ", "").Contains("extripla"))
                        {
                            continue;
                        }
                    }
                    else if (formatoKit == "A7")
                    {
                        if (tema.Contains("jolly") || tema.Contains("sprint") || tema.Replace(" ", "").Contains("extripla"))
                        {
                            continue;
                        }
                    }
                    else
                    {
                        continue;
                    }



                    var gruppo = tracciato.Where(t => t.recordInTracciato[GLOBAL_VARIABLES_FICO.keyCodiceGruppo].ToString() == codice_gruppo);

                    decimal peso = recItem[GLOBAL_VARIABLES.keyDescrPeso].ToDecimal();
                    string um = recItem[GLOBAL_VARIABLES.keyDescrUm].ToString();
                    string descr_1 = "";
                    string descr_brand = "";
                    string descr_tipo = "";
                    string descr_gramm = "";
                    bool prezziDiversiInGruppo = false;
                    bool pesiDiversiInGruppo = false;

                    var listaDelGruppo = new List<ArticoloInKit>();

                    //gestione delle tipologie di gruppo
                    if (codice_referenza != codice_gruppo)//codice_gruppo.Contains(",") && recItem.ContainsKey(GLOBAL_VARIABLES.keyXMLDescrizioneGruppo))
                    {
                        listaDelGruppo = tracciato.Where(it => it.recordInTracciato[GLOBAL_VARIABLES_FICO.keyCodiceGruppo].ToString() == codice_gruppo).ToList();

                        prezziDiversiInGruppo = listaDelGruppo.GroupBy(g => g.recordInTracciato["prezzo_promo"].ToDecimal()).Count() > 1;
                        pesiDiversiInGruppo = listaDelGruppo.GroupBy(g => g.recordInTracciato[GLOBAL_VARIABLES_FICO.keyDescrPeso].ToDecimal()).Count() > 1;

                        //Console.WriteLine($">>>>>>>>>>>>>>>Analisi Gruppo: Prezzi diversi: {prezziDiversiInGruppo.ToString()} =>>>> Peso Diverso = {pesiDiversiInGruppo.ToString()}");
                        //conto i numero di elementi nel gruppo
                        int numeroElementi = codice_gruppo
                            .Split(new[] { ',' }, StringSplitOptions.RemoveEmptyEntries)
                            .Length;

                        if (numeroElementi == contaRefGruppo)
                        {
                            contaRefGruppo = 0;
                            continue;
                        } else
                        {
                            contaRefGruppo++;
                        }

                        if (curr_group_processed != codice_gruppo)
                        {

                            //Recupero foto del primario
                            var dictPrimario = gruppo.FirstOrDefault(g => Convert.ToByte(g.recordInTracciato[keyStatoSelezione]) == (Byte)1);
                            curr_fotoPgroup_processed = dictPrimario.recordInTracciato[GLOBAL_VARIABLES_FICO.keyFotoNome].ToString();

                            _list_membriSecondari_cache = RefsHelper.getFotoSecondarieDelGruppo(gruppo.Select(s => s.recordInTracciato).ToList());
                            //Console.WriteLine("Trovate " + _list_membriSecondari_cache.Count + " foto secondarie per il gruppo " + codice_gruppo);
                            recItem[GLOBAL_VARIABLES_FICO.keyMembriGruppoFoto] = _list_membriSecondari_cache;
                            //Console.WriteLine(GLOBAL_VARIABLES_FICO.keyMembriGruppoFoto + " =  " + String.Join(",", _list_membriSecondari_cache.Select(s => s.nomeFoto).ToArray()));

                            curr_group_processed = codice_gruppo;

                        }
                        else
                        {
                            //Prendo dalla cache
                            recItem[GLOBAL_VARIABLES_FICO.keyMembriGruppoFoto] = _list_membriSecondari_cache;
                        }


                        string myFoto = recItem[GLOBAL_VARIABLES_FICO.keyFotoNome].ToString();
                        if (myFoto != curr_fotoPgroup_processed)
                        {
                            //Eredito la foto del primario perchè sarà lei a dover apparire nella mia rappresentazione di gruppo
                            recItem[GLOBAL_VARIABLES_FICO.keyFotoNome] = curr_fotoPgroup_processed;
                        }
                    }


                    bool gruppoDeveUscireConISingoliConDescrizioneGruppo = (codice_referenza != codice_gruppo && prezziDiversiInGruppo == false && pesiDiversiInGruppo == false);

                    if (gruppoDeveUscireConISingoliConDescrizioneGruppo && recItem.ContainsKey(GLOBAL_VARIABLES.keyXMLDescrizioneGruppo))//codice_referenza != codice_gruppo && prezziDiversiInGruppo==false && pesiDiversiInGruppo==false )//codice_gruppo.Contains(",") && recItem.ContainsKey(GLOBAL_VARIABLES.keyXMLDescrizioneGruppo))
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


                    if (peso != 1 && peso != 0.1M)
                    {

                    }


                    string descr_gr_copy = descr_gramm;

                    //recItem[keyDescrizioniDescrizione4] = descrizioni_articolo[3];
                    //Meccanica mec2 = interpretaMeccanica(recItem, flag_meccanica_unita);
                    //string meccanica_tradotta = mec2.NomeTraduzione;
                    string meccanica_tradotta = recItem[key_combinazioneAssegnata].ToString();
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

                    if (counter == 0)
                    {

                    }


                    counter++;

                    string siglaAreaKit = acpvDB.aree.FirstOrDefault(a => a.guidID == kit.guidArea).sigla;
                    string siglaFormatoKit = formatiDB.source.FirstOrDefault(a => a.guidID == kit.guidFormato).codice;

                    var codiceBox = recItem[key_codiceBox].ToString();

                    //forzature meccanica per Codicebox
                    /*if (codiceBox == "BOX_SuperprezziOF")
                    {
                        codiceBox = "BOX_STD";
                    }
                    */
                    bool isLineaMaggioreUguale10 = (codiceBox == "BOX_LINEA" && listaDelGruppo.Count >= 10);
                    if (codiceBox == "BOX_LINEA")
                    {
                        if (!isLineaMaggioreUguale10)
                        {
#warning Trovare una soluzione piu brillante se possibile. Questa forzatura non è mai molto bella
                            codiceBox = "BOX_STD";
                        }
                    }


                    string settore = recItem["settore"].ToString();
                    string stile_prezzo_promo = "PREZZO_PROMO";
                    string cod_segmento = recItem["codice_segmento"].ToString();
                    string segmento = recItem["segmento"].ToString().ToLower();
                    string reparto = recItem["reparto"].ToString();
                    string sottomarchio = recItem["sottomarchio"].ToString();
                    string prodotto_in_toscana = recItem["logo_toscana1"].ToString();
                    string nPunti = recItem["N_Punti"].ToString();

                    decimal prezzo_promo = MathExt.Round(recItem["prezzo_promo"].ToDecimal(), 2, MidpointRounding.AwayFromZero);
                    decimal prezzo_continuo = MathExt.Round(recItem["prezzo_continuo"].ToDecimal(), 2, MidpointRounding.AwayFromZero);
                    decimal prezzo_promo_kgl = MathExt.Round(recItem["prezzo_promo_kgl"].ToDecimal(), 2, MidpointRounding.AwayFromZero);
                    decimal sconto = MathExt.Round(recItem["txt_sconto"].ToDecimal(), 2, MidpointRounding.AwayFromZero);


                    if (reparto != curr_reparto)
                    {
                        //Console.WriteLine($"Aggiungo: reparto: {reparto} separatore corrente {curr_reparto}");
                        //Segnaposto reparto
                        ArticoloInKit separtatoreReparto = new ArticoloInKit();
                        separtatoreReparto.IdRec = artInKit.IdRec;
                        separtatoreReparto.recordInTracciato = new Dictionary<string, object>();
                        separtatoreReparto.recordInTracciato[key_codiceBox] = "BOX_SEPARATORE_REPARTO";
                        string _codSep = $"sep_" + reparto;
                        _codSep = _codSep.Substring(0, Math.Min(_codSep.Length, 100));
                        separtatoreReparto.recordInTracciato[GLOBAL_VARIABLES_FICO.keyRefCodice] = _codSep;
                        separtatoreReparto.recordInTracciato[GLOBAL_VARIABLES_FICO.keyCodiceGruppo] = _codSep;
                        separtatoreReparto.recordInTracciato[GLOBAL_VARIABLES_FICO.keyTracciatoFirma] = "separatore";
                        separtatoreReparto.recordInTracciato[GLOBAL_VARIABLES_FICO.keyFirmaRevisione] = "separatore";

                        CompiledFieldInterpreter interpreteXSegmento = new CompiledFieldInterpreter();
                        interpreteXSegmento.assignCompiledField("titolo", "SEPARATORE_REPARTO", reparto);
                        interpreteXSegmento.assignCompiledField(GLOBAL_VARIABLES_FICO.compiledFieldKeyMastro, "", "[Nessuna]");

                        CompiledFieldInterpreter.fields _fields = interpreteXSegmento.getFields();
                        separtatoreReparto.recordInTracciato["compiledFields"] = _fields.compiledFields;
                        separtatoreReparto.recordInTracciato["deletedFields"] = _fields.deletedFields;


                        result.liste[0].Records.Add(separtatoreReparto);

                        curr_reparto = reparto;
                    }

                    //Console.WriteLine($"Aggiungo ref {codice_referenza}");

                    //Console.WriteLine($"ANALISI DELLA FERERENZA NOFOOD:  {descr_1}");
                    //Console.WriteLine($"TEMA:  {tema}");
                    //Console.WriteLine($"TIPO EVENTO:  {recItem["tipo_evento"].ToString()}");
                    //Console.WriteLine($"IMPIANTO COLLI:  {recItem["QtàImpianto_COLLI"].ToString()}");

                    bool force_infopack = recItem.ContainsKey("force_infopack");
                    string str_force_infopack = "";
                    if (force_infopack)
                        str_force_infopack = recItem["force_infopack"].ToString();

                    //Ricavo del prezzo info pack DA SISTEMA
                    string prezzo_info_pack_VAL = str_force_infopack;
                    if (!force_infopack)
                    {
                        if (codiceBox == "BOX_SuperprezziOF")
                        {
                            if (prezzo_promo_kgl <= prezzo_promo)
                            {
                                prezzo_info_pack_VAL = "al kg";
                                is_tasto_bilancia = true;
                            }
                            else if (prezzo_promo_kgl > prezzo_promo)
                            {
                                prezzo_info_pack_VAL = "a conf.";
                            }
                        }
                        else
                        {
                            //Se il prezzo info pack non è forzato, allor asi va per regole da sistema
                            if (reparto == "ORTOFRUTTA")
                            {
                                if (
                                    prezzo_promo == prezzo_promo_kgl &&
                                    peso == 1 &&
                                    um == "KG" &&
                                    segmento.Contains("sfus") || StringExtension.laParolaSiTrovaDaSola("sf", descr_1.ToLower())
                                    )
                                {
                                    prezzo_info_pack_VAL = "al kg";
                                    is_tasto_bilancia = true;
                                }
                                else
                                {
                                    prezzo_info_pack_VAL = "a conf.";
                                }
                            }
                            else if (
                                reparto.Contains("CARNI") || reparto.Contains("PESCE") ||
                                reparto.Contains("ELABORATI") || reparto.Contains("SALUMI") ||
                                reparto.Contains("GASTRO") || reparto.Contains("PANE") || reparto.Contains("PASTICC")
                                )
                            {

                                if (
                                    prezzo_promo == prezzo_promo_kgl &&
                                    peso == 1 &&
                                    um == "KG"
                                    )
                                {
                                    prezzo_info_pack_VAL = "al kg";
                                }
                                else
                                {
                                    prezzo_info_pack_VAL = "a conf.";
                                }
                            }
                        }
                    }

                    if (siglaAreaKit == "B")
                    {
                        if (sconto % 5 < 3)
                        {
                            //Si approssima al multiplo basso
                            sconto = (int)(sconto / 5) * 5;
                        }
                        else
                        {
                            sconto = ((int)(sconto / 5) + 1) * 5;
                        }
                    }


                    decimal sconto_soci = recItem.ContainsKey("txt_sconto_soci_doppia") ? MathExt.Round(recItem["txt_sconto_soci_doppia"].ToDecimal(), 2, MidpointRounding.AwayFromZero) : 0m;
                    bool is_linea = (recItem["is_linea"].ToString().ToLower() == "x" || recItem["is_linea"].ToString().ToLower() == "xforced");



                    #region BolliLoghi
                    //Gestione dei loghi e bolli EXTRA - Messi in automatico secondo regole di agenzia

                    List<LogoBollo> _bolliloghi = new List<LogoBollo>();

                    //Array di loghi campionati in lista
                    string[] loghiFlagInTracciato = new string[] { "logo_toscana1", "logo_vegano", "logo_senzausoantibiotici", "logo_senzaglutine", "logo_senzaglutineasl", "logo_senzaglutinenonerogabile", "logo_senzazucchero", "logo_senzauova", "logo_senzalattosio", "logo_antibioticfree", "logo_ecologico", "logo_ecolabel", "logo_fscecocert", "logo_ecologico", "logo_aproteico", "logo_certificazioneorigine", "logo_doc", "logo_docg", "logo_igt", "logo_pat", "logo_stg", "logo_solidale" };

                    foreach (string s in loghiFlagInTracciato)
                    {
                        if (recItem.ContainsKey(s))
                        {
                            string valLogo = recItem[s].ToString().ToLower();

                            if (valLogo == "x")
                            {
                                if (s == "logo_toscana1")
                                {
                                    //Controllare la regola di esclusione   
                                    //NON INSERIRE “logo_toscana1” quando “Descrizione Evento” CONTIENE “DEDICATO TOSCANA”
                                    if (tema.ToLower().Contains("dedicato toscana"))
                                    {
                                        continue;
                                    }
                                }


                                LogoBollo lbItem = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == s);
                                if (lbItem != null)
                                {
                                    _bolliloghi.Add((LogoBollo)lbItem.Clone());
                                }

                            }
                        }
                    }

                    //Se “Descrizione Reparto Marketing” = SURGELATI inserire “Bollino_SURGELATI”
                    if (reparto.ToLower().Contains("surgelati"))
                    {
                        LogoBollo lSurg = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Bollino_SURGELATI");
                        if (lSurg != null)
                        {
                            _bolliloghi.Add((LogoBollo)lSurg.Clone());
                        }
                    }

                    //Inserire “Logo_OrigineItalia” quando colonna Sottomarchio (colonna CQ) = ORIGINE
                    if (sottomarchio.ToLower().Contains("origine"))
                    {
                        LogoBollo lOIT = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Logo_OrigineItalia");
                        if (lOIT != null)
                        {
                            _bolliloghi.Add((LogoBollo)lOIT.Clone());
                        }
                    }

                    //Inserire “Logo_FiorFiore” quando colonna Sottomarchio (colonna CQ) = FIOR FIORE
                    if (sottomarchio.ToLower().Contains("fior fiore"))
                    {
                        LogoBollo lFF = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Logo_FiorFiore");
                        if (lFF != null)
                        {
                            _bolliloghi.Add((LogoBollo)lFF.Clone());
                        }
                    }

                    //nserire “Logo_BancodelGusto” quando colonna Sottomarchio (colonna CQ) = BANCO DEL 
                    if (sottomarchio.ToLower().Contains("banco del"))
                    {
                        LogoBollo lBgusto = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Logo_BancodelGusto");
                        if (lBgusto != null)
                        {
                            _bolliloghi.Add((LogoBollo)lBgusto.Clone());
                        }
                    }

                    string descr_tecnica = recItem["descrizione_tecnica"].ToString().ToLower();
                    if (descr_tecnica.StartsWith("acquisto max"))
                    {
                        string restante_testo = descr_tecnica.Substring("acquisto max".Length).Trim();
                        string compNumPezzi = "";
                        foreach (char c in restante_testo)
                        {
                            int valInt;
                            if (Int32.TryParse(c.ToString(), out valInt))
                            {
                                compNumPezzi += c.ToString();
                            }
                            else
                            {
                                if (compNumPezzi != "")
                                    break;
                            }

                        }
                        Int32 numPezziAcquistoMax;
                        Int32.TryParse(compNumPezzi, out numPezziAcquistoMax);
                        if (numPezziAcquistoMax > 0)
                        {
                            string composizioneCodiceLogoBollo = $"max{numPezziAcquistoMax}pezzi";
                            LogoBollo lmaxPezzi = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == composizioneCodiceLogoBollo);
                            if (lmaxPezzi != null)
                            {
                                _bolliloghi.Add((LogoBollo)lmaxPezzi.Clone());
                            }
                        }
                    }


                    //Inserire “Logo_Cerealia” quando descrizione 2 (DESCRIZIONE BRAND) CONTIENE “Cerealia” (può essere scritto sia in maiuscolo che in minuscolo)
                    string descr2 = recItem[GLOBAL_VARIABLES_FICO.keyDescrizione2].ToString().ToLower();
                    string descr3 = recItem[GLOBAL_VARIABLES_FICO.keyDescrizione3].ToString().ToLower();
                    string descr1 = recItem[GLOBAL_VARIABLES_FICO.keyDescrizione1].ToString().ToLower();

                    if (descr2.Contains("cerealia"))
                    {
                        LogoBollo lCerealia = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Logo_Cerealia");
                        if (lCerealia != null)
                        {
                            _bolliloghi.Add((LogoBollo)lCerealia.Clone());
                        }
                    }

                    if (descr2.ContainsWord(new string[] { "igp", "i.g.p." }) ||
                        descr3.ContainsWord(new string[] { "igp", "i.g.p." }) ||
                        descr1.ContainsWord(new string[] { "igp", "i.g.p." }))
                    {
                        LogoBollo lIGP = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "logo_igp");
                        if (lIGP != null)
                        {
                            _bolliloghi.Add((LogoBollo)lIGP.Clone());
                        }
                    }

                    if (descr2.ContainsWord(new string[] { "dop", "d.o.p." }) ||
                        descr3.ContainsWord(new string[] { "dop", "d.o.p." }) ||
                        descr1.ContainsWord(new string[] { "dop", "d.o.p." }))
                    {
                        //Ulteriore controllo per capire se bio è parte di una parola più grande
                        LogoBollo lDOP = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "logo_dop");
                        if (lDOP != null)
                        {
                            _bolliloghi.Add((LogoBollo)lDOP.Clone());
                        }

                    }

                    if (descr2.ContainsWord(new string[] { "bio" }) ||
                        descr3.ContainsWord(new string[] { "bio" }) ||
                        descr1.ContainsWord(new string[] { "bio" }))

                    {
                        //Ulteriore controllo per capire se bio è parte di una parola più grande
                        LogoBollo lBIO = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "logo_bio");
                        if (lBIO != null)
                        {
                            _bolliloghi.Add((LogoBollo)lBIO.Clone());
                        }
                    }


                    recItem[GLOBAL_VARIABLES.keyFotoExtraAuto] = _bolliloghi;


                    //tracciato[i].recordInTracciato[GLOBAL_VARIABLES_FICO.keyFicoNames] = exportNames;

                    #endregion //bolliloghi

                    #region compiledfield

                    #region VariabiliCompiledField
                    string specialDescr_max_pezzi_accodato_a_descrizione = "";
                    string specialDescr_linea_precedente_a_descrizione = "";
                    string specialDescr_superprezziOF = "";
                    string meccanica = recItem["meccanica"].ToString().ToLower();
                    #endregion

                    #region DefinizioneStili
                    //idetificazione della cartella
                    string prefixFolder = "";
                    if (siglaAreaKit != "A")
                    {
                        prefixFolder = $"{(siglaAreaKit != "B1" ? siglaAreaKit : "B")}.";
                    }

                    //variabili
                    string stileDescr1 = "DESCRIZIONE_TITOLO";
                    string stileDescr2 = "DESCRIZIONE_BRAND";
                    string stileDescr3 = "DESCRIZIONE_TIPO";
                    string stileDescr4 = "DESCRIZIONE_GRAMMATURA";
                    string stile_prezzo_info_pack = "PREZZO_INFO_PACK";
                    string stile_prezzo_promo_kgl = "PREZZO_PROMO_KGL";
                    string stile_1piu1 = "1+1";
                    string stile_prezzo_continuo = "PREZZO_CONTINUO";
                    string stile_prezzo_promo_kgl_alternativo = "A-.PREZZO_PROMO_KGL";
                    string stile_punti_jolly = "PUNTI_JOLLY";
                    string stile_punti_sprint = "PUNTI_SPRINT";
                    string stile_bollino_sprint = "BOLLINO";

                    //gestione degli sconti
                    string stile_sconto_non_soci = "SCONTO_NON_SOCI";
                    string stile_sconto_soci_doppia = "SCONTO_SOCI_DOPPIA";
                    string stile_sconto_standard_canale = prefixFolder + "SCONTO";

                    //gestione sconti per box_linea, box_esclusiva_soci e box spendipunti
                    string stile_sconto_speciale = "SCONTO_SOCI_DOPPIA";  //valore di default

                    if (codiceBox == "BOX_LINEA")
                        stile_sconto_speciale = $"{(siglaAreaKit.StartsWith("B") ? "B.SCONTO_LINEA" : $"{(siglaAreaKit == "A-" ? "A-.SCONTO_LINEA" : "SCONTO")}")}";
                    if (codiceBox == "BOX_SpendiPunti")
                        stile_sconto_speciale = "SCONTO_SPENDIPUNTI";
                    if (codiceBox == "BOX_ESCLUSIVA_SOCI")
                        stile_sconto_speciale = "SCONTO_SOCI_DOPPIA";


                    //variazioni stile_prezzo_promo_kgl
                    if (codiceBox == "BOX_ESCLUSIVA_SOCI")
                    {
                        stile_prezzo_promo_kgl = "PREZZO_PROMO_KGL_SOCI_DOPPIA";
                    }

                    // stili info Pack

                    if (codiceBox == "BOX_doppio_SCONTO")
                    {
                        stile_prezzo_info_pack = "PREZZO_INFO_PACK_NON_SOCI";
                    }

                    if (codiceBox == "BOX_SuperprezziOF")
                    {
                        stile_prezzo_info_pack = "PREZZO_INFO_PACK";
                    }
                    if (codiceBox == "BOX_ESCLUSIVA_SOCI" || codiceBox == "BOX_SpendiPunti")
                    {
                        stile_prezzo_info_pack = "PREZZO_INFO_PACK_SOCI";
                    }
                    #endregion

                    #region REGOLE_PrezzoPromoKgl

                    bool regolaNoPrezzoPromoKgl = (
                        //reparto == "IGIENE PERSONA" ||
                        //reparto == "IGIENE AMBIENTI" ||
                        reparto == "PULIZIA" ||
                        //reparto == "PET FOOD/PET CARE" ||
                        reparto == "CALZATURE" ||
                        reparto == "ESTERNO DONNA" ||
                        reparto == "ESTERNO UOMO" ||
                        reparto == "INTIMO" ||
                        reparto == "CALZETTERIA" ||
                        reparto == "FAI DA TE" ||
                        reparto == "CUCINA" ||
                        reparto == "PED" ||
                        reparto == "TESSILE CASA" ||
                        peso == 1);

                    //Console.WriteLine($"Peso del codice {codice_referenza} = {peso} regol no pkgl = {regolaNoPrezzoPromoKgl}");

                    if (!regolaNoPrezzoPromoKgl)
                    {
                        //Controllo che tutti i pesi siano uguali
                        string dic_prezzoInfoPack = ((um == "KG") ? "al kg" : (um == "LT") ? "al litro" : "al pezzo");
                        string prezzo_promo_kgl_str = $"<{stile_prezzo_promo_kgl}>€ {MathExt.DecimalRoundToString(prezzo_promo_kgl)} {dic_prezzoInfoPack}</{stile_prezzo_promo_kgl}>";

                        if (gruppo.GroupBy(g => g.recordInTracciato[GLOBAL_VARIABLES_FICO.keyDescrPeso]).Count() == 1)
                        {
                            interprete.assignCompiledField("prezzo_promo_kgl", "", prezzo_promo_kgl_str);

                        }
                        else
                        {
                            //Qui ci troviamo SOLO se siamo davvero in gruppo piche la condizione di peso.Count()>1 non PUO essere MAI vera se dentro il gruppo c'è solo 1 ref
                            if (gruppoDeveUscireConISingoliConDescrizioneGruppo)
                            {
                                interprete.removeCompiledField("prezzo_promo_kgl");
                            }
                            else
                            {
                                interprete.assignCompiledField("prezzo_promo_kgl", "", prezzo_promo_kgl_str);
                            }



                            //string dic_prezzoInfoPack = ((um == "KG") ? "al kg" : (um == "LT") ? "al litro" : "al pezzo");

                            //string prezzo_promo_kgl_str = $"<{stile_prezzo_promo_kgl}>€ {MathExt.DecimalRoundToString(prezzo_promo_kgl)} {dic_prezzoInfoPack}</{stile_prezzo_promo_kgl}>";
                            //interprete.assignCompiledField("prezzo_promo_kgl", "", prezzo_promo_kgl_str);
                        }
                    }
                    else
                    {
                        interprete.removeCompiledField("prezzo_promo_kgl");
                        // string dic_prezzoInfoPack = ((um == "KG") ? "al kg" : (um == "LT") ? "al litro" : "al pezzo");

                        // string prezzo_promo_kgl_str = $"<{stile_prezzo_promo_kgl}>€ {MathExt.DecimalRoundToString(prezzo_promo_kgl)} {dic_prezzoInfoPack}</{stile_prezzo_promo_kgl}>";

                        // interprete.assignCompiledField("prezzo_promo_kgl", "", prezzo_promo_kgl_str);                        
                    }


                    if (
                        prezzo_promo == prezzo_promo_kgl &&
                        settore.ToLower().Contains("freschissimi") &&
                        peso == 1 &&
                        um == "KG" &&
                        (segmento.ToLower().Contains("produzione") || segmento.ToLower().Contains("sfuso") || segmento.ToLower().Contains("intero") || segmento.ToLower().Contains("freschi"))
                        )
                    {
                        interprete.removeCompiledField("prezzo_promo_kgl");
                    }
                    #endregion

                    #region REGOLE_Sconti
                    if (sconto > 0 || codiceBox.StartsWith("BOX_doppio_SCONTO"))
                    {

                        //Console.WriteLine($"SCONTO STYLE PREFIX {prefixFolder}");

                        string sconto_str = $"{(siglaAreaKit == "A" ? "-" : "")}{(int)sconto}%";

                        if (codiceBox != "BOX_SpendiPunti" && codiceBox != "BOX_ESCLUSIVA_SOCI" && codiceBox != "BOX_LINEA")
                        {
                            if (codiceBox.StartsWith("BOX_doppio_SCONTO"))
                            {
                                sconto_str = $"-{(int)sconto}%";
                                string sconto_soci_str = $"-{(int)sconto_soci}%";

                                interprete.assignCompiledField("txt_sconto", stile_sconto_non_soci, sconto_str);
                                interprete.assignCompiledField("txt_sconto_SOCI_DOPPIA", stile_sconto_soci_doppia, sconto_soci_str);

                                //Controlliamo se questo BOX_doppio_SCONRO è in realtà da declinare con _LINEA
#warning questa forzatura è da gestire meglio e tramite CSS Framework quando sarà il momento
                                if (gruppo.Count() > 3)
                                {
                                    if (gruppo.GroupBy(g => g.recordInTracciato["prezzo_promo"]).Count() > 1)
                                    {
                                        //Allora è linea
                                        recItem[key_codiceBox] = recItem[key_codiceBox] + "_LINEA";
                                        codiceBox = recItem[key_codiceBox].ToString();
                                    }
                                }

                            }
                            else
                            {
                                interprete.assignCompiledField("txt_sconto", stile_sconto_standard_canale, sconto_str);

                            }
                        }
                        else
                        {
                            if (codiceBox == "BOX_SpendiPunti" || codiceBox == "BOX_ESCLUSIVA_SOCI")
                            {
                                sconto_str = $"-{(int)sconto}%";
                            }
                            else if (codiceBox == "BOX_LINEA")
                            {
                                if (siglaAreaKit == "A")
                                {
                                    sconto_str = $"-{(int)sconto}%";
                                }
                                else
                                {
                                    sconto_str = $"SCONTO {(int)sconto}%";

                                }
                            }


                            interprete.assignCompiledField("txt_sconto", stile_sconto_speciale, sconto_str);
                            string sconto_soci_str = $"-{(int)sconto_soci}%";
                            interprete.assignCompiledField("txt_sconto_SOCI_DOPPIA", stile_sconto_soci_doppia, sconto_soci_str);

                        }

                    }
                    else
                    {
                        interprete.removeCompiledField("box_sconto");
                    }
                    #endregion

                    #region FunzioniSpeciali
                    Func<string, bool> contieneUnTemaSpecialeEccezionale = (string _tema) =>
                    {
                        if (
                            !_tema.Contains("PIU VALORE") &&
                            !_tema.Contains("JOLLY") &&
                            !_tema.Contains("CAMPIONI DEL RISPARMIO") &&
                            !_tema.Contains("EXTRA") &&
                            !_tema.Contains("FRESCHI") &&
                            !_tema.Contains("PACC.PAM") &&
                            !_tema.Contains("NEW CLIENTI") &&
                            !_tema.Contains("NEW SOCI") &&
                            !_tema.Contains("VALORE CLIENTI") &&
                            !_tema.Contains("VALORE SOCI") &&
                            !_tema.Contains("PIU VALORE PUNTI") &&
                            !_tema.Contains("SPRINT") &&
                            !_tema.Contains("SUPERPREZZI") &&
                            !_tema.Contains("TEMA BABY") &&
                            !_tema.Contains("TEMA CHIMICA") &&
                            !_tema.Contains("OCCHIO AL PREZZO") &&
                            !_tema.Contains("TEMA VINI") &&
                            !_tema.Contains("TRIPLA CONVENIENZA")
                        )
                        {
                            return true;
                        }
                        return false;

                    };

                    Func<string, string> codificaColoreTemaEccezionale = (string val) =>
                    {
                        int inx_parentesi_aperta = tema.IndexOf("(");

                        if (inx_parentesi_aperta > 0)
                        {
                            val = val.Substring(0, inx_parentesi_aperta);

                        }

                        val = String.Join("_", val.Trim().Split(' '));

                        return val;
                    };
                    #endregion

                    #region REGOLE_PrezzoInfoPack

                    if (prezzo_info_pack_VAL == "")
                    {
                        //Rimuovo forzatamente info pack
                        interprete.removeCompiledField("prezzo_info_pack");
                        interprete.removeCompiledField("prezzo_info_pack_SOCI_DOPPIA");
                    }
                    else
                    {
                        interprete.assignCompiledField("prezzo_info_pack", "", $"<{stile_prezzo_info_pack}>{prezzo_info_pack_VAL}</{stile_prezzo_info_pack}>");
                    }
                    #endregion

                    #region REGOLE_prezzoContinuo
                    if (prezzo_continuo >= 0)
                    {
                        //Console.WriteLine($"VORREI DENTRO A CAMBIO STILE PREZZO CONTINUO PER PROMO REF: {codice_referenza} per codice box: {codiceBox}");
                        if (prezzo_continuo != prezzo_promo || codiceBox == "BOX_SpendiPunti" || codiceBox == "BOX_doppio_SCONTO")
                        {
                            string stile_p_continuo = "PREZZO_CONTINUO";
                            string stile_p_continuo_str2 = "PREZZO_CONTINUO";

                            //Console.WriteLine($"SONO ENTRATO DENTRO A CAMBIO STILE PREZZO CONTINUO PER PROMO REF: {codice_referenza} per codice box: {codiceBox}");

                            if (codiceBox == "BOX_doppio_SCONTO")
                            {
                                //if (siglaAreaKit == "B" || siglaAreaKit == "B1" )
                                //{

                                // if (siglaFormatoKit == "A3_ORIZZONTALI")
                                //  {
                                stile_p_continuo = "PREZZO_CONTINUO_NON_SOCI";
                                stile_p_continuo_str2 = "PREZZO_CONTINUO_SOCI_DOPPIA";
                                // }                                    
                                //}
                            }

                            if (codiceBox == "BOX_SpendiPunti")
                            {
                                stile_p_continuo = "PREZZO_CONTINUO_SPENDIPUNTI";
                            }

                            if (codiceBox == "BOX_ESCLUSIVA_SOCI")
                            {
                                stile_p_continuo = "PREZZO_CONTINUO_ESCLUSIVA_SOCI";
                            }

                            string prezzo_continuo_str = $"<{stile_p_continuo}>invece di € {MathExt.DecimalRoundToString(prezzo_continuo)}{(prezzo_info_pack_VAL != "" ? " " : "")}{prezzo_info_pack_VAL}</{stile_p_continuo}>";
                            string prezzo_continuo_sd_str2 = $"<{stile_p_continuo_str2}>invece di € {MathExt.DecimalRoundToString(prezzo_continuo)}{(prezzo_info_pack_VAL != "" ? " " : "")}{prezzo_info_pack_VAL}</{stile_p_continuo_str2}>";
                            interprete.assignCompiledField("prezzo_continuo", "", prezzo_continuo_str);
                            interprete.assignCompiledField("prezzo_continuo_SOCI_DOPPIA", "", prezzo_continuo_sd_str2);
                        }
                        else
                        {

                            interprete.removeCompiledField("prezzo_continuo");
                        }
                    }
                    #endregion

                    #region REGOLE_Meccaniche

                    if (codiceBox == "BOX_STD" /*|| codiceBox == "BOX_SuperprezziOF"*/)
                    {
                        if (meccanica == "MXN")
                        {
                            interprete.removeCompiledField("txt_sconto");
                            interprete.removeCompiledField("prezzo_continuo");


                            interprete.assignCompiledField("1+1", "", $"<{stile_1piu1}>1+1</{stile_1piu1}>");
                            interprete.assignCompiledField("prezzo_info_pezzi", "", $"<PREZZO_CONTINUO>2 pezzi</PREZZO_CONTINUO>");

                            interprete.assignCompiledField("prezzo_1pezzo", "", $"<PREZZO_CONTINUO>1 pezzo € {MathExt.DecimalRoundToString(prezzo_continuo)}{(prezzo_info_pack_VAL != "" ? " " : "")}{prezzo_info_pack_VAL}</PREZZO_CONTINUO>");

                        }

                        interprete.removeCompiledField("txt_punti_jolly");


                        if (segmento.ToLower().Contains("sfuso"))
                        {
                            interprete.removeCompiledField("prezzo_promo_kgl");
                            if (siglaAreaKit == "A-")
                            {
                                interprete.removeCompiledField("prezzo_promo_kgl_alternativo");
                            }
                        }
                        else
                        {
                            if (siglaAreaKit == "A-")
                            {
                                if (prezzo_promo_kgl < prezzo_promo && reparto == "ORTOFRUTTA")// settore.ToUpper().Contains("FRESCH"))
                                {
                                    //Lo mettiamo in evidenza con la label alternativa
                                    interprete.assignCompiledField("prezzo_promo_kgl_alternativo", stile_prezzo_promo_kgl_alternativo, $"€ {MathExt.DecimalRoundToString(prezzo_promo_kgl)} al kg");
                                    interprete.removeCompiledField("prezzo_promo_kgl");
                                }
                                else
                                {
                                    interprete.removeCompiledField("prezzo_promo_kgl_alternativo");
                                }
                            }
                        }


                        if (tipoExport != "WEB")
                        {


                            bool speciale_toscana = (recItem["logo_toscana1"].ToString() == "X");
                            bool contiene_evento_eccezionale = contieneUnTemaSpecialeEccezionale(tema.ToUpper());
                            //Console.WriteLine($"Regola x sconto: valore {sconto} spec tosc {speciale_toscana} spec evento ecez {contiene_evento_eccezionale} - tema: {tema}  codice box {codiceBox}");

                            if (siglaAreaKit == "A")
                            {
                                if (
                                    /*(settore.ToLower().Contains("freschissimi") || settore.ToLower().Contains("freschi")) &&
                                    tema.ToLower().Contains("freschissimi") &&*/
                                    !speciale_toscana &&
                                    !contiene_evento_eccezionale &&
                                    (sconto < 25 && sconto > 0))
                                {
                                    //Console.WriteLine("Sconto piccolo ok!");
                                    //si mette sconto piccolo
                                    string sconto_str = $"SCONTO {(int)sconto}%";
                                    interprete.assignCompiledField("sconto_piccolo", "", "<SCONTO_PICCOLO>" + sconto_str + "</SCONTO_PICCOLO>");


                                    if (codiceBox == "BOX_STD")
                                    {
                                        interprete.removeCompiledField("box_sconto");
                                    }
                                }
                                else
                                {
                                    //Console.WriteLine("Sconto piccolo K.O.");
                                    interprete.removeCompiledField("sconto_piccolo");
                                }
                            }

                            if (contiene_evento_eccezionale)
                            {
                                //Va creata una nuova chiave che si chiama "colore_sconto_speciale"
                                //Che codifichi il valore grezzo del tema
                                string _codifica = codificaColoreTemaEccezionale(tema);
                                recItem["colore_sconto_speciale"] = _codifica.ToUpper();

                            }
                            if (sconto < 25)
                            {
                                stile_prezzo_promo = "PREZZO_STD_SCONTO_PICCOLO";
                                interprete.assignCompiledField("prezzo_promo", stile_prezzo_promo, $"€ {prezzo_promo}");
                            }

                        }


                    }
                    else if (codiceBox == "BOX_1+1")
                    {
                        prezzo_promo_kgl = prezzo_promo_kgl / 2;
    

                        if (meccanica == "MXN")
                        {
                            interprete.removeCompiledField("txt_sconto");
                            interprete.removeCompiledField("prezzo_continuo");


                            interprete.assignCompiledField("1+1", "", $"<{stile_1piu1}>1+1</{stile_1piu1}>");
                            interprete.assignCompiledField("prezzo_info_pezzi", "", $"<PREZZO_CONTINUO>2 pezzi</PREZZO_CONTINUO>");


                        }
                        interprete.assignCompiledField("prezzo_1pezzo", "", $"<PREZZO_CONTINUO>1 pezzo € {MathExt.DecimalRoundToString(prezzo_promo)}{(prezzo_info_pack_VAL != "" ? " " : "")}{prezzo_info_pack_VAL}</PREZZO_CONTINUO>");

                        if (segmento.ToLower().Contains("sfuso"))
                        {
                            interprete.removeCompiledField("prezzo_promo_kgl");
                            if (siglaAreaKit == "A-")
                            {
                                interprete.removeCompiledField("prezzo_promo_kgl_alternativo");
                            }
                        }
                        else
                        {
                            if (siglaAreaKit == "A-")
                            {

                                interprete.removeCompiledField("prezzo_promo_kgl_alternativo");
                                
                            }
                        }


                        if (tipoExport != "WEB")
                        {


                            bool speciale_toscana = (recItem["logo_toscana1"].ToString() == "X");
                            bool contiene_evento_eccezionale = contieneUnTemaSpecialeEccezionale(tema.ToUpper());
                            //Console.WriteLine($"Regola x sconto: valore {sconto} spec tosc {speciale_toscana} spec evento ecez {contiene_evento_eccezionale} - tema: {tema}  codice box {codiceBox}");

                            if (siglaAreaKit == "A")
                            {
                                if (
                                    /*(settore.ToLower().Contains("freschissimi") || settore.ToLower().Contains("freschi")) &&
                                    tema.ToLower().Contains("freschissimi") &&*/
                                    !speciale_toscana &&
                                    !contiene_evento_eccezionale &&
                                    (sconto < 25 && sconto > 0))
                                {
                                    //Console.WriteLine("Sconto piccolo ok!");
                                    //si mette sconto piccolo
                                    string sconto_str = $"SCONTO {(int)sconto}%";
                                    interprete.assignCompiledField("sconto_piccolo", "", "<SCONTO_PICCOLO>" + sconto_str + "</SCONTO_PICCOLO>");

                                }
                                else
                                {
                                    //Console.WriteLine("Sconto piccolo K.O.");
                                    interprete.removeCompiledField("sconto_piccolo");
                                }
                            }

                            if (contiene_evento_eccezionale)
                            {
                                //Va creata una nuova chiave che si chiama "colore_sconto_speciale"
                                //Che codifichi il valore grezzo del tema
                                string _codifica = codificaColoreTemaEccezionale(tema);
                                recItem["colore_sconto_speciale"] = _codifica.ToUpper();

                            }
                            if (sconto < 25)
                            {
                                stile_prezzo_promo = "PREZZO_STD_SCONTO_PICCOLO";
                                interprete.assignCompiledField("prezzo_promo", stile_prezzo_promo, $"€ {prezzo_promo}");
                            }

                        }

                        interprete.removeCompiledField("box_sconto");
                        interprete.removeCompiledField("sconto_piccolo");

                    }
                    else if (codiceBox == "BOX_SuperprezziOF")
                    {
                        stile_prezzo_promo = $"{(siglaAreaKit == "A-" ? "A-." : "")}PREZZO_PROMO_WHITE";

                        //stile_prezzo_info_pack = "PREZZO_PROMO_KGL_WHITE";

                        interprete.removeCompiledField("txt_punti_jolly");

                        stileDescr1 += "_SP";
                        stileDescr2 += "_SP";
                        stileDescr3 += "_SP";
                        stileDescr4 += "_SP";


                        //caso1
                        if (prezzo_promo != prezzo_promo_kgl)
                            //specialDescr_superprezziOF = $" - € {MathExt.DecimalRoundToString(prezzo_promo_kgl)}{(prezzo_info_pack_VAL != "" ? " " : "")}{(prezzo_info_pack_VAL == "al kg" ? "a conf." : "al kg")}";
                            interprete.assignCompiledField("prezzo_promo_kgl", "PREZZO_PROMO_KGL_SP", MathExt.DecimalRoundToString(prezzo_promo_kgl));

                        if (prezzo_promo_kgl < prezzo_promo)
                            prezzo_promo = prezzo_promo_kgl;//Veicolamento

                        if (siglaAreaKit != "A-")
                        {
                            interprete.removeCompiledField("prezzo_promo_kgl");
                        }
                        interprete.removeCompiledField("prezzo_continuo");

                    }
                    else if (codiceBox == "BOX_LINEA")
                    {
                        interprete.removeCompiledField("txt_punti_jolly");

                        specialDescr_linea_precedente_a_descrizione = "<DESCRIZIONE_LINEA>LINEA </DESCRIZIONE_LINEA>";

                        stileDescr1 += "_LINEA";
                        stileDescr2 += "_LINEA";
                        stileDescr3 += "_LINEA";

                        bool contiene_evento_eccezionale = contieneUnTemaSpecialeEccezionale(tema.ToUpper());
                        if (contiene_evento_eccezionale)
                        {
                            //Va creata una nuova chiave che si chiama "colore_sconto_speciale"
                            //Che codifichi il valore grezzo del tema
                            string _codifica = codificaColoreTemaEccezionale(tema);
                            recItem["colore_sconto_speciale"] = _codifica.ToUpper();

                        }
                        //string sconto_str = $"-{(int)sconto}%";
                        string sconto_str = $"{(int)sconto}%";
                        interprete.assignCompiledField("txt_sconto", "SCONTO_LINEA", sconto_str);
                    }
                    else if (codiceBox == "BOX_JOLLY")
                    {
                        string n_punti = recItem["N_Punti"].ToString();
                        if (n_punti == "")
                        {
                            n_punti = "0";
                        }

                        interprete.assignCompiledField("txt_punti_jolly", stile_punti_jolly, $"{n_punti}");

                        //Al momento non deve mai essere mostrata
                        interprete.removeCompiledField("confezioni");

                        /*stileDescr1 += "_JOLLY";
                        stileDescr2 += "_JOLLY";
                        stileDescr3 += "_JOLLY";
                        stileDescr4 += "_JOLLY";*/
                    }
                    else if (codiceBox == "BOX_SPRINT")
                    {
                        int n_bonus;
                        Int32.TryParse(recItem["N_BonusCartacei"].ToString(), out n_bonus);

                        //interprete.assignCompiledField("txt_punti_sprint", "", $"<{stile_punti_sprint}>+{n_bonus}</{stile_punti_sprint}>");
                        interprete.assignCompiledField("txt_punti_sprint", stile_punti_sprint, $"+{n_bonus}");

                        string scritta_bollino = "bollino";
                        if (n_bonus > 1)
                            scritta_bollino = "bollini";

                        interprete.assignCompiledField("bollino", "", $"<{stile_bollino_sprint}>{scritta_bollino}</{stile_bollino_sprint}>");


                        stileDescr1 += "_JOLLY";
                        stileDescr2 += "_JOLLY";
                        stileDescr3 += "_JOLLY";
                        stileDescr4 += "_JOLLY";
                    }
                    else if (codiceBox == "BOX_SpendiPunti")
                    {

                        stileDescr1 += "_SPENDIPUNTI";
                        stileDescr2 += "_SPENDIPUNTI";
                        stileDescr3 += "_SPENDIPUNTI";
                        stileDescr4 += "_SPENDIPUNTI";

                        stile_prezzo_promo = "PREZZO_PROMO_SPENDIPUNTI";

                        string n_punti = recItem["N_Punti"].ToString();
                        if (n_punti == "")
                        {
                            n_punti = "0";
                        }

                        interprete.assignCompiledField("txt_punti_jolly", "", $"<PUNTI_Spendipunti_scritte>e </PUNTI_Spendipunti_scritte><PUNTI_Spendipunti>{n_punti}</PUNTI_Spendipunti><PUNTI_Spendipunti_scritte> punti</PUNTI_Spendipunti_scritte>");

                        decimal prezzo_promo_s = recItem["prezzo_promo"].ToDecimal();
                        prezzo_promo_s = MathExt.Round(prezzo_promo_s, 2, MidpointRounding.AwayFromZero);
                        interprete.assignCompiledField("prezzo_promo_SOCI", "", $"<PREZZO_PROMO_SpendiPunti>oppure per i soci € {MathExt.DecimalRoundToString(prezzo_promo_s)}{(prezzo_info_pack_VAL != "" ? " " : "")}{prezzo_info_pack_VAL}</PREZZO_PROMO_SpendiPunti>");

                        stile_prezzo_info_pack = "PREZZO_INFO_PACK_SOCI";


                        if (prezzo_info_pack_VAL == "")
                        {
                            interprete.removeCompiledField("prezzo_info_pack_SOCI_DOPPIA");
                        }
                        else
                        {
                            interprete.assignCompiledField("prezzo_info_pack_SOCI_DOPPIA", "", $"<PREZZO_INFO_PACK_SOCI>{prezzo_info_pack_VAL}</PREZZO_INFO_PACK_SOCI>");
                        }



                    }
                    else if (codiceBox == "BOX_doppio_SCONTO")
                    {
                        decimal prezzo_promo_soci = 0m;
                        decimal prezzo_promo_kgl_soci = 0m;

                        if (!recItem.ContainsKey("prezzo_promo_soci_doppia"))
                        {
                            //Console.WriteLine("prezzo_promo_soci_doppia non essite nel rec");
                            if (prezzo_promo > 0)
                            {
                                prezzo_promo_soci = MathExt.Round(prezzo_continuo - (prezzo_continuo * (sconto_soci / 100)), 2, MidpointRounding.AwayFromZero);
                                prezzo_promo_kgl_soci = MathExt.Round((prezzo_promo_soci * prezzo_promo_kgl) / prezzo_promo, 2, MidpointRounding.AwayFromZero);
                            }
                        }
                        else
                        {
                            //Console.WriteLine("prezzo_promo_soci_doppia esiste e vale " + recItem["prezzo_promo_soci_doppia"].ToDecimal());

                            prezzo_promo_soci = recItem["prezzo_promo_soci_doppia"].ToDecimal();
                            prezzo_promo_kgl_soci = recItem["prezzo_promo_kgl_soci_doppia"].ToDecimal();
                        }

                        stileDescr1 += "_SPENDIPUNTI";
                        stileDescr2 += "_SPENDIPUNTI";
                        stileDescr3 += "_SPENDIPUNTI";
                        stileDescr4 += "_SPENDIPUNTI";


                        //Aggiungere MAX PEZZI alla descrizione
                        if (recItem["pezzi_soci"].ToString().ToLower() != "x")
                        {
                            specialDescr_max_pezzi_accodato_a_descrizione = getMaxPezziSociFormat(recItem["N_pezzi_soci"].ToString());// $"MAX {recItem["N_pezzi_soci"].ToString()} PEZZI PER CARTA SOCIO";
                        }
                        interprete.removeCompiledField("txt_punti_jolly");

                        //Da capire dove vengono letti i valori
                        if (!regolaNoPrezzoPromoKgl)
                        {

                            if (!segmento.ToLower().Contains("sfuso"))
                            {
                                string dic_prezzoInfoPack = ((um == "KG") ? "al kg" : (um == "LT") ? "al litro" : "al pezzo");
                                string prezzo_promo_kgl_str2 = $"<PREZZO_PROMO_KGL_SOCI_DOPPIA>€ {MathExt.DecimalRoundToString(prezzo_promo_kgl_soci)} {dic_prezzoInfoPack}</PREZZO_PROMO_KGL_SOCI_DOPPIA>";
                                interprete.assignCompiledField("prezzo_promo_kgl_SOCI_DOPPIA", "", prezzo_promo_kgl_str2);
                            }
                            else
                            {
                                interprete.removeCompiledField("prezzo_promo_kgl_SOCI_DOPPIA");
                            }
                        }
                        else
                        {
                            interprete.removeCompiledField("prezzo_promo_kgl_SOCI_DOPPIA");
                        }


                        prezzo_promo_soci = MathExt.Round(prezzo_promo_soci, 2, MidpointRounding.AwayFromZero);

                        string prezzo_promo_str2 = $"€ {MathExt.DecimalRoundToString(prezzo_promo_soci)}";
                        //Console.WriteLine("Assegnazione -> " +prezzo_promo_str2 );
                        interprete.assignCompiledField("prezzo_promo_SOCI_DOPPIA", "PREZZO_PROMO_SOCI", prezzo_promo_str2);


                        stile_prezzo_promo = "PREZZO_PROMO_NON_SOCI";
                        interprete.assignCompiledField("prezzo_promo", stile_prezzo_promo, $"€ {MathExt.DecimalRoundToString(prezzo_promo)}");



                        string prezzo_continuo_str2 = $"invece di € {MathExt.DecimalRoundToString(prezzo_continuo)}{(prezzo_info_pack_VAL != "" ? " " : "")}{prezzo_info_pack_VAL}";
                        //interprete.assignCompiledField("prezzo_continuo_SOCI_DOPPIA", "PREZZO_CONTINUO_SOCI_DOPPIA", prezzo_continuo_str2);

                        //Console.WriteLine($"SONO DENTRO IN prezzo_continuo_SOCI_DOPPIA- CAMBIO STILE PREZZO CONTINUO PER PROMO REF: {codice_referenza} prezzo_continuo_str2: {prezzo_continuo_str2}");


                        if (prezzo_info_pack_VAL != "")
                        {
                            interprete.assignCompiledField("prezzo_info_pack_SOCI_DOPPIA", "", $"<PREZZO_INFO_PACK_SOCI_DOPPIA>{prezzo_info_pack_VAL}</PREZZO_INFO_PACK_SOCI_DOPPIA>");
                            interprete.assignCompiledField("prezzo_info_pack", "", $"<PREZZO_INFO_PACK_NON_SOCI>{prezzo_info_pack_VAL}</PREZZO_INFO_PACK_NON_SOCI>");
                        }



                        if (is_linea)
                        {
                            ///Console.WriteLine(">>>>>>>>>>>>>>>>>>>>>>>>>>>> SIAMO DENTRO AD UNA LINEA!!!");
                            interprete.removeCompiledField("prezzo_promo");
                            interprete.removeCompiledField("prezzo_info_pack");
                            interprete.removeCompiledField("prezzo_promo_SOCI_DOPPIA");
                            interprete.removeCompiledField("prezzo_info_pack_SOCI_DOPPIA");
                            interprete.removeCompiledField("prezzo_promo_kgl");
                            interprete.removeCompiledField("prezzo_promo_kgl_SOCI_DOPPIA");
                            interprete.removeCompiledField("prezzo_continuo");
                            interprete.removeCompiledField("prezzo_continuo_SOCI_DOPPIA");
                        }


                    }
                    else if (codiceBox == "BOX_doppio_SCONTO_LINEA")
                    {
                        //Aggiungere MAX PEZZI alla descrizione
                        if (recItem["pezzi_soci"].ToString().ToLower() != "x")
                        {
                            specialDescr_max_pezzi_accodato_a_descrizione = getMaxPezziSociFormat(recItem["N_pezzi_soci"].ToString()); //$"MAX {recItem["N_pezzi_soci"].ToString()} PEZZI PER CARTA SOCIO";
                        }

                        stileDescr1 += "_LINEA";
                        stileDescr2 += "_LINEA";
                        stileDescr3 += "_LINEA";
                        stileDescr4 += "_LINEA";



                    }
                    else if (codiceBox == "BOX_ESCLUSIVA_SOCI")
                    {
                        decimal prezzo_risparmi = prezzo_continuo - prezzo_promo;
                        prezzo_risparmi = MathExt.Round(prezzo_risparmi, 2, MidpointRounding.AwayFromZero);
                        interprete.assignCompiledField("risparmi", "", $"<RISPARMI>Risparmi € {MathExt.DecimalRoundToString(prezzo_risparmi)}</RISPARMI>{(prezzo_info_pack_VAL != "" ? $"<RISPARMI_infopack> {prezzo_info_pack_VAL}</RISPARMI_infopack>" : "")}");

                        if (recItem["pezzi_soci"].ToString().ToLower() != "x")
                        {
                            specialDescr_max_pezzi_accodato_a_descrizione = getMaxPezziSociFormat(recItem["N_pezzi_soci"].ToString()); //$"MAX {recItem["N_pezzi_soci"].ToString()} PEZZI PER CARTA SOCIO";
                        }

                        if (peso <= 1)
                        {
                            interprete.removeCompiledField("prezzo_promo_kgl_alternativo");
                        }
                        else if (peso > 1)
                        {
                            interprete.assignCompiledField("prezzo_promo_kgl_alternativo", "A-.PREZZO_PROMO_ESCLUSIVA_SOCI", $"€ {MathExt.DecimalRoundToString(prezzo_promo_kgl)}{(prezzo_info_pack_VAL != "" ? " " : "")}{prezzo_info_pack_VAL}");
                            interprete.removeCompiledField("prezzo_promo_kgl");
                        }
                    }

                    if (codiceBox == "BOX_SpendiPunti")
                    {
                        if (nPunti != "")
                        {
                            int nPuntiNum = Int32.Parse(nPunti);
                            decimal valPunti = (decimal)nPuntiNum * 0.02m;//0.02 è il valore che Coop attribuisce ai punti
                            decimal risultanteConValPunti = MathExt.Round(prezzo_promo - valPunti, 2, MidpointRounding.AwayFromZero);
                            interprete.assignCompiledField("prezzo_promo", stile_prezzo_promo, $"€ {MathExt.DecimalRoundToString(risultanteConValPunti)}");
                        }
                        else
                        {
                            interprete.assignCompiledField("prezzo_promo", stile_prezzo_promo, $"€ {MathExt.DecimalRoundToString(prezzo_promo)}");
                        }

                        if (recItem["pezzi_soci"].ToString().ToLower() != "x")
                        {
                            specialDescr_max_pezzi_accodato_a_descrizione = getMaxPezziSociFormat(recItem["N_pezzi_soci"].ToString()); //$"MAX {recItem["N_pezzi_soci"].ToString()} PEZZI PER CARTA SOCIO";
                        }
                    }
                    else if (codiceBox == "BOX_ESCLUSIVA_SOCI")
                    {
                        stile_prezzo_promo = "PREZZO_PROMO_SOCI_DOPPIA";
                        if (siglaAreaKit.StartsWith("A"))
                            stile_prezzo_promo = "PREZZO_PROMO_ESCLUSIVA_SOCI";


                        stileDescr1 += "_SPENDIPUNTI";
                        stileDescr2 += "_SPENDIPUNTI";
                        stileDescr3 += "_SPENDIPUNTI";
                        stileDescr4 += "_SPENDIPUNTI";

                        interprete.assignCompiledField("prezzo_promo", stile_prezzo_promo, $"€ {MathExt.DecimalRoundToString(prezzo_promo)}");

                        if (siglaAreaKit == "A-")
                        {
                            if (prezzo_promo_kgl < prezzo_promo && reparto == "ORTOFRUTTA")// settore.ToUpper().Contains("FRESCH"))
                            {
                                //Lo mettiamo in evidenza con la label alternativa
                                interprete.assignCompiledField("prezzo_promo_kgl_alternativo", "A-.PREZZO_PROMO_KGL", $"€ {MathExt.DecimalRoundToString(prezzo_promo_kgl)} al kg");
                                interprete.removeCompiledField("prezzo_promo_kgl");
                            }
                            else
                            {
                                interprete.removeCompiledField("prezzo_promo_kgl_alternativo");
                            }
                        }

                        if (prezzo_info_pack_VAL != "")
                        {

                            interprete.assignCompiledField("prezzo_info_pack", "", $"<PREZZO_INFO_PACK_SOCI>{prezzo_info_pack_VAL}</PREZZO_INFO_PACK_SOCI>");
                        }


                        if (!regolaNoPrezzoPromoKgl)
                        {
                            //Controllo che tutti i pesi siano uguali
                            if (gruppo.GroupBy(g => g.recordInTracciato[GLOBAL_VARIABLES_FICO.keyDescrPeso]).Count() == 1 || pesiDiversiInGruppo == true)
                            {
                                string dic_prezzoInfoPack = ((um == "KG") ? "al kg" : (um == "LT") ? "al litro" : "al pezzo");
                                string prezzo_promo_kgl_str = $"<{stile_prezzo_promo_kgl}>€ {MathExt.DecimalRoundToString(prezzo_promo_kgl)} {dic_prezzoInfoPack}</{stile_prezzo_promo_kgl}>";
                                interprete.assignCompiledField("prezzo_promo_kgl", "", prezzo_promo_kgl_str);
                            }
                        }

                    }
                    else
                    {
                        interprete.assignCompiledField("prezzo_promo", stile_prezzo_promo, $"€ {MathExt.DecimalRoundToString(prezzo_promo)}");
                    }

                    #endregion

                    #region FORMATI_GESTIONE_DELLE_MASTRO_E_STILI
                    //Aseegno mastro generica

                    //codiceBox = recItem[key_codiceBox].ToString();

                    if (codiceBox == "BOX_STD")
                    {
                        interprete.assignCompiledField(GLOBAL_VARIABLES_FICO.compiledFieldKeyMastro, "", "ma-Offerta");

                    } else if (codiceBox == "BOX_LINEA") {
                        interprete.assignCompiledField(GLOBAL_VARIABLES_FICO.compiledFieldKeyMastro, "", "ma-Linea");
                    } else if (codiceBox == "BOX_SuperprezziOF") {
                        interprete.assignCompiledField(GLOBAL_VARIABLES_FICO.compiledFieldKeyMastro, "", "ma-Superprezzi");
                    } else if (codiceBox == "BOX_1+1") {
                        interprete.assignCompiledField(GLOBAL_VARIABLES_FICO.compiledFieldKeyMastro, "", "ma-Soci_3x2_1+1");
                    } else if (codiceBox == "BOX_ESCLUSIVA_SOCI") {
                        interprete.assignCompiledField(GLOBAL_VARIABLES_FICO.compiledFieldKeyMastro, "", "ma-EsclusivaSoci");
                        string dic_prezzoInfoPack = ((um == "KG") ? "al kg" : (um == "LT") ? "al litro" : "al pezzo");
                        string prezzo_promo_kgl_str = $"<{stile_prezzo_promo_kgl}>€ {MathExt.DecimalRoundToString(prezzo_promo_kgl)} {dic_prezzoInfoPack}</{stile_prezzo_promo_kgl}>";
                        interprete.assignCompiledField("prezzo_promo_kgl", "", prezzo_promo_kgl_str);
                    } else if (codiceBox == "BOX_SpendiPunti") {
                        interprete.assignCompiledField(GLOBAL_VARIABLES_FICO.compiledFieldKeyMastro, "", "ma-PiùValoreAlSocio");
                    } else if (codiceBox == "BOX_doppio_SCONTO") {
                        interprete.assignCompiledField(GLOBAL_VARIABLES_FICO.compiledFieldKeyMastro, "", "ma-PiùValoreAlSocio");
                    } else if (codiceBox == "BOX_doppio_SCONTO_LINEA") {
                        interprete.assignCompiledField(GLOBAL_VARIABLES_FICO.compiledFieldKeyMastro, "", "ma-PiùValoreAlSocio");
                    } else if (codiceBox == "BOX_JOLLY") {
                        interprete.assignCompiledField(GLOBAL_VARIABLES_FICO.compiledFieldKeyMastro, "", "ma-Jolly");
                    } else {
                        interprete.assignCompiledField(GLOBAL_VARIABLES_FICO.compiledFieldKeyMastro, "", "ma-Offerta");
                    }



                    #endregion


                    //Per rimuoveere i compiled field
                    interprete.removeCompiledField("LBL_Reparto");


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


                    // if (recItem.ContainsKey("descrizione_gruppo"))
                    // {
                    //     Descrizione1 = (recItem["descrizione_gruppo"] as Dictionary<string, object>)["Descrizioni.Descrizione1"].ToString();
                    //     Descrizione2 = (recItem["descrizione_gruppo"] as Dictionary<string, object>)["Descrizioni.Descrizione2"].ToString();
                    //     Descrizione3 = (recItem["descrizione_gruppo"] as Dictionary<string, object>)["Descrizioni.Descrizione3"].ToString();
                    //     Descrizione4 = (recItem["descrizione_gruppo"] as Dictionary<string, object>)["Descrizioni.Descrizione4"].ToString();
                    //     Peso = recItem["Descrizioni.Peso"].ToString();
                    //     Um = recItem["Descrizioni.Um"].ToString();
                    // }
                    // else
                    // {
                    //     Descrizione1 = recItem["Descrizioni.Descrizione1"].ToString();
                    //     Descrizione2 = recItem["Descrizioni.Descrizione2"].ToString();
                    //     Descrizione3 = recItem["Descrizioni.Descrizione3"].ToString();
                    //     Descrizione4 = recItem["Descrizioni.Descrizione4"].ToString();
                    //     Peso = recItem["Descrizioni.Peso"].ToString();
                    //     Um = recItem["Descrizioni.Um"].ToString();
                    // }



                    if (codice_referenza != codice_gruppo && recItem.ContainsKey(GLOBAL_VARIABLES.keyXMLDescrizioneGruppo) && ((prezziDiversiInGruppo == false && pesiDiversiInGruppo == false) || isLineaMaggioreUguale10))//codice_gruppo.Contains(",") && recItem.ContainsKey(GLOBAL_VARIABLES.keyXMLDescrizioneGruppo))
                    {

                        Descrizione1 = (recItem[GLOBAL_VARIABLES.keyXMLDescrizioneGruppo] as Dictionary<string, object>)[GLOBAL_VARIABLES.keyDescr1].ToString();
                        Descrizione2 = (recItem[GLOBAL_VARIABLES.keyXMLDescrizioneGruppo] as Dictionary<string, object>)[GLOBAL_VARIABLES.keyDescr2].ToString();
                        Descrizione3 = (recItem[GLOBAL_VARIABLES.keyXMLDescrizioneGruppo] as Dictionary<string, object>)[GLOBAL_VARIABLES.keyDescr3].ToString();
                        Descrizione4 = (recItem[GLOBAL_VARIABLES.keyXMLDescrizioneGruppo] as Dictionary<string, object>)[GLOBAL_VARIABLES.keyDescr4].ToString();
                        //Console.WriteLine(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>SONO ENTRATO IN UN GRUPPO: " + descr_tipo.ToString());
                    }
                    else
                    {
                        Descrizione1 = recItem[GLOBAL_VARIABLES.keyDescr1].ToString();
                        Descrizione2 = recItem[GLOBAL_VARIABLES.keyDescr2].ToString();
                        Descrizione3 = recItem[GLOBAL_VARIABLES.keyDescr3].ToString();
                        Descrizione4 = recItem[GLOBAL_VARIABLES.keyDescr4].ToString();


                        //Console.WriteLine(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>SONO ENTRATO IN UN SINGOLO: " + descr_tipo.ToString());
                    }

                    //codiceBox
                    //<10 -> Esce record gruppo + tutti i signoli
                    //>10


                    /*
                    if (pesiDiversiInGruppo==true)
                    {
                        interprete.restoreCompiledField("prezzo_promo_kgl");
                       // interprete.assignCompiledField("prezzo_promo_kgl", "", MathExt.Round(recItem["prezzo_promo_kgl"].ToDecimal(), 2, MidpointRounding.AwayFromZero).ToString());
                        interprete.assignCompiledField("prezzo_promo_kgl", "", prezzo_promo_kgl_str);
                        
                        //prezzo_promo_kgl
                    } */


                    while (Descrizione1.Contains("<br>"))
                    {
                        Descrizione1 = Descrizione1.Replace("<br>", "\n");
                    }
                    while (Descrizione2.Contains("<br>"))
                    {
                        Descrizione2 = Descrizione2.Replace("<br>", "\n");
                    }
                    while (Descrizione3.Contains("<br>"))
                    {
                        Descrizione3 = Descrizione3.Replace("<br>", "\n");
                    }
                    while (Descrizione4.Contains("<br>"))
                    {
                        Descrizione4 = Descrizione4.Replace("<br>", "\n");
                    }

                    Descrizione1 = Descrizione1.Replace("$br", "\n");
                    string descr_prog = Descrizione1;

                    if (Descrizione2 != "")
                    {
                        Descrizione2 = Descrizione2.Replace("$br", "\n");
                        //Se descrizione 1 non ha br oppure non ce l'ha all'inizio e quindi per forza alla fine
                        //Metto lo spazio di separazione
                        if (descr_prog != "")
                            Descrizione2 = ((!Descrizione2.StartsWith(" ") && !Descrizione2.StartsWith("\n") && !Descrizione2.StartsWith(Environment.NewLine)) ? " " : "") + Descrizione2;
                    }

                    descr_prog += Descrizione2;


                    if (Descrizione4 != "")
                    {
                        Descrizione4 = Descrizione4.Replace("$br", "\n");
                        //Se descrizione 1 non ha br oppure non ce l'ha all'inizio e quindi per forza alla fine
                        Descrizione4 = ((!Descrizione4.StartsWith(" ") && !Descrizione4.StartsWith("\n") && !Descrizione4.StartsWith(Environment.NewLine)) ? " " : "") + Descrizione4;
                    }

                    descr_prog += Descrizione4;

                    if (Descrizione3 != "")
                    {
                        Descrizione3 = Descrizione3.Replace("$br", "\n");
                        //Se descrizione 1 non ha br oppure non ce l'ha all'inizio e quindi per forza alla fine
                        Descrizione3 = " " + Descrizione3;
                    }

                    descr_prog += Descrizione3;


                    descrizione = $"<{stileDescr1}>{Descrizione1}</{stileDescr1}>";
                    descrizione += $"<{stileDescr2}>{Descrizione2}</{stileDescr2}>";
                    descrizione += $"<{stileDescr4}>{Descrizione4}</{stileDescr4}>";
                    descrizione += $"<{stileDescr3}>{Descrizione3}</{stileDescr3}>";


                    if (specialDescr_max_pezzi_accodato_a_descrizione != "")
                    {
                        if (codiceBox == "BOX_ESCLUSIVA_SOCI") {
                            descrizione += $"<MAX_PEZZI_ESCLUSIVA_SOCI>\n" + specialDescr_max_pezzi_accodato_a_descrizione + "</MAX_PEZZI_ESCLUSIVA_SOCI>";
                        } else if (codiceBox == "BOX_SpendiPunti") {
                            descrizione += $"<MAX_PEZZI_SPENDIPUNTI>\n" + specialDescr_max_pezzi_accodato_a_descrizione + "</MAX_PEZZI_SPENDIPUNTI>";
                        } else if (codiceBox == "BOX_doppio_SCONTO") {
                            descrizione += $"<MAX_PEZZI_SOCI_DOPPIA>\n" + specialDescr_max_pezzi_accodato_a_descrizione + "</MAX_PEZZI_SOCI_DOPPIA>";
                        } else if (codiceBox == "BOX_doppio_SCONTO_LINEA") {
                            descrizione += $"<MAX_PEZZI_LINEA>\n" + specialDescr_max_pezzi_accodato_a_descrizione + "</MAX_PEZZI_LINEA>";
                        } else {
                            descrizione += $"<MAX_PEZZI>\n" + specialDescr_max_pezzi_accodato_a_descrizione + "</MAX_PEZZI>";
                        }



                    }



                    if (specialDescr_superprezziOF != "")
                    {
                        descrizione += $"<DESCRIZIONE_PREZZO_SP>" + specialDescr_superprezziOF + "</DESCRIZIONE_PREZZO_SP>";
                    }

                    if (specialDescr_linea_precedente_a_descrizione != "")
                    {
                        descrizione = $"{specialDescr_linea_precedente_a_descrizione}{descrizione}";
                    }

                    interprete.assignCompiledField("descrizione", stileParagDescr, descrizione);


                    #endregion descrizione

                    #region tasto_bilancia

                    if (is_tasto_bilancia)
                    {
                        interprete.assignCompiledField("tasto_bilancia", "-", "-");

                    } else
                    {
                        interprete.removeCompiledField("tasto_bilancia");
                    }


                    #endregion tasto_bilancia


                    var fields = interprete.getFields();
                    recItem["compiledFields"] = fields.compiledFields;
                    recItem["deletedFields"] = fields.deletedFields;

                    #endregion




                    //Console.WriteLine($">>>>>>>>>>>>>>>> ANALISI DEL GRUPPO/SINGOLO DENTRO FUORI DALL'IF ### {recItem[key_codiceBox].ToString()} ---- {codice_referenza} ---- {codiceBox}");


                    //CREAZIONE DEI GRUPPI (COMMENTA PER POP)
                    bool BOXLINEA_xSingoliBOXSTD = recItem[key_codiceBox].ToString() == "BOX_LINEA" && codiceBox != "BOX_LINEA";

                    bool eludi = false;
                    if (!eludi && codice_gruppo != codice_referenza && !isLineaMaggioreUguale10) // (recItem.ContainsKey(keySottogruppo))
                    {
                        //Console.WriteLine($"Creazione sottogruppo ### {recItem[key_codiceBox].ToString()} ---- {codice_referenza} ---- {codiceBox}");

                        recItem[keySottogruppo] = codice_gruppo;

                        bool inCache = _cacheSottogruppi.Contains(codice_gruppo);

                        if (!inCache)
                        {
                            var sottogruppo = RefCloner.CopiaETrasformaObjSingoloInObjSottogruppo(recItem);

                            if (recItem.ContainsKey(GLOBAL_VARIABLES.keyXMLDescrizioneGruppo))
                            {
                                //Se esiste descrizione di gruppo allora la valido per il sottogruppo che sto creando
                                Descrizione1 = (recItem[GLOBAL_VARIABLES.keyXMLDescrizioneGruppo] as Dictionary<string, object>)[GLOBAL_VARIABLES.keyDescr1].ToString();
                                Descrizione2 = (recItem[GLOBAL_VARIABLES.keyXMLDescrizioneGruppo] as Dictionary<string, object>)[GLOBAL_VARIABLES.keyDescr2].ToString();
                                Descrizione3 = (recItem[GLOBAL_VARIABLES.keyXMLDescrizioneGruppo] as Dictionary<string, object>)[GLOBAL_VARIABLES.keyDescr3].ToString();
                                Descrizione4 = (recItem[GLOBAL_VARIABLES.keyXMLDescrizioneGruppo] as Dictionary<string, object>)[GLOBAL_VARIABLES.keyDescr4].ToString();
                            }
                            else
                            {
                                Descrizione1 = sottogruppo[GLOBAL_VARIABLES.keyDescr1].ToString();
                                Descrizione2 = sottogruppo[GLOBAL_VARIABLES.keyDescr2].ToString();
                                Descrizione3 = sottogruppo[GLOBAL_VARIABLES.keyDescr3].ToString();
                                Descrizione4 = sottogruppo[GLOBAL_VARIABLES.keyDescr4].ToString();
                            }

                            if (recItem.ContainsKey(GLOBAL_VARIABLES.keyXMLDescrizioneGruppo))
                            {
                                //throw new Exception($"Sottogruppo {_codSottoGruppo} con tag descrizione_gruppo non trovato nell'elemento. Questo non deve poter succedere.");
                                //Rimuovo il tag dal singolo
                                //recItem.Remove(GLOBAL_VARIABLES.keyXMLDescrizioneGruppo);
                                //Console.WriteLine("Qui rimuoverei il tag descrizione gruppo di " + codice_gruppo);
                            }

                            #region decrizione sottogruppo

                            //Console.WriteLine($">>>>>>>>>>>>>>>> ANALISI DEL GRUPPO/SINGOLO DENTRO L'IF ### {recItem[key_codiceBox].ToString()} ---- {codice_referenza} ---- {codiceBox}");




                            while (Descrizione1.Contains("<br>"))
                            {
                                Descrizione1 = Descrizione1.Replace("<br>", "\n");
                            }
                            while (Descrizione2.Contains("<br>"))
                            {
                                Descrizione2 = Descrizione2.Replace("<br>", "\n");
                            }
                            while (Descrizione3.Contains("<br>"))
                            {
                                Descrizione3 = Descrizione3.Replace("<br>", "\n");
                            }
                            while (Descrizione4.Contains("<br>"))
                            {
                                Descrizione4 = Descrizione4.Replace("<br>", "\n");
                            }

                            descr_prog = Descrizione1;

                            if (Descrizione2 != "" && (!Descrizione2.Contains("$br") || Descrizione1.IndexOf("$br") > 0))
                            {
                                //Se descrizione 1 non ha br oppure non ce l'ha all'inizio e quindi per forza alla fine
                                //Metto lo spazio di separazione
                                if (descr_prog != "")
                                    Descrizione2 = ((!Descrizione2.StartsWith(" ") && !Descrizione2.StartsWith("\n") && !Descrizione2.StartsWith(Environment.NewLine)) ? " " : "") + Descrizione2;
                            }

                            descr_prog += Descrizione2;


                            if (Descrizione4 != "" && (!Descrizione4.Contains("$br") || Descrizione4.IndexOf("$br") > 0))
                            {
                                //Se descrizione 1 non ha br oppure non ce l'ha all'inizio e quindi per forza alla fine
                                Descrizione4 = ((!Descrizione4.StartsWith(" ") && !Descrizione4.StartsWith("\n") && !Descrizione4.StartsWith(Environment.NewLine)) ? " " : "") + Descrizione4;
                            }

                            descr_prog += Descrizione4;

                            if (Descrizione3 != "" && (!Descrizione3.Contains("$br") || Descrizione3.IndexOf("$br") <= 0))
                            {
                                //Se descrizione 1 non ha br oppure non ce l'ha all'inizio e quindi per forza alla fine
                                Descrizione3 = ((!Descrizione3.StartsWith(" ") && !Descrizione3.StartsWith("\n") && !Descrizione3.StartsWith(Environment.NewLine)) ? " " : "") + Descrizione3;
                            }

                            descr_prog += Descrizione3;


                            if (BOXLINEA_xSingoliBOXSTD)
                            {
                                //Console.WriteLine("Azzero interprete");
                                //Azzero i compiled ed i deleted perchè devo ricostruirlo                                
                                interprete.clearInterpreter();
                            }

                            var interpreteSottogruppo = interprete.Clone();

                            if (is_linea) {
                                descrizione = $"<{stileDescr1}_LINEA>{Descrizione1}</{stileDescr1}_LINEA>";
                                descrizione += $"<{stileDescr2}_LINEA>{Descrizione2}</{stileDescr2}_LINEA>";
                                descrizione += $"<{stileDescr4}_LINEA>{Descrizione4}</{stileDescr4}_LINEA>";
                                descrizione += $"<{stileDescr3}_LINEA>{Descrizione3}</{stileDescr3}_LINEA>";
                            } else
                            {
                                descrizione = $"<{stileDescr1}>{Descrizione1}</{stileDescr1}>";
                                descrizione += $"<{stileDescr2}>{Descrizione2}</{stileDescr2}>";
                                descrizione += $"<{stileDescr4}>{Descrizione4}</{stileDescr4}>";
                                descrizione += $"<{stileDescr3}>{Descrizione3}</{stileDescr3}>";


                                if (pesiDiversiInGruppo)
                                {
                                    interpreteSottogruppo.removeCompiledField("prezzo_promo_kgl");
                                }
                            }

                            //bool _debug = (codice_gruppo == "2570460,3396370,3396550");
                            //if (_debug)
                            //    Console.WriteLine($"Trattamento prezzo_promo_kgl di {codice_gruppo}");

                            if (!regolaNoPrezzoPromoKgl)
                            {
                                //if (_debug)
                                //    Console.WriteLine($"Conteggio pesi {gruppo.GroupBy(g => g.recordInTracciato[GLOBAL_VARIABLES_FICO.keyDescrPeso]).Count()}");
                                if (gruppo.GroupBy(g => g.recordInTracciato[GLOBAL_VARIABLES_FICO.keyDescrPeso]).Count() > 1)
                                {
                                    //if (_debug)
                                    //    Console.WriteLine($"Pesi iversi in gruppo {codice_gruppo} -> rimozione prezzo_promo_kgl");

                                    interpreteSottogruppo.removeCompiledField("prezzo_promo_kgl");
                                }

                            }


                            interpreteSottogruppo.assignCompiledField("descrizione", "", descrizione);

                            if (BOXLINEA_xSingoliBOXSTD)
                            {
                                //Console.WriteLine("Assegno lo sconto");
                                //L'unico altro parametro che devo assegnare è il txt_sconto.
                                //Il box linea non ne ha altri
                                string sconto_str = $"{(int)sconto}%";
                                interpreteSottogruppo.assignCompiledField("txt_sconto", "SCONTO_LINEA", sconto_str);
                                interpreteSottogruppo.assignCompiledField(GLOBAL_VARIABLES_FICO.compiledFieldKeyMastro, "", "ma-Linea");
                            }


                            var fieldsSottogruppo = interpreteSottogruppo.getFields();
                            sottogruppo["compiledFields"] = fieldsSottogruppo.compiledFields;
                            sottogruppo["deletedFields"] = fieldsSottogruppo.deletedFields;

                            #endregion

                            #region validazione logo_toscana1 per il gruppo

                            //Per questo logo TUTTI i singoli del gruppo devono rispettare i requisiti altrimenti non puo uscire il logo
                            if (listaDelGruppo.Count > 1)
                            {
                                bool validazioneDelGruppo = true;
                                foreach (ArticoloInKit elG in listaDelGruppo)
                                {
                                    if (elG.recordInTracciato["tema"].ToString().ToLower().Contains("dedicato toscana") ||
                                    elG.recordInTracciato["logo_toscana1"].ToString().ToLower() != "x")
                                    {
                                        validazioneDelGruppo = false;
                                        break;
                                    }
                                }

                                //Console.WriteLine("Validazione logo_toscana1 -> " + codice_gruppo + " validazioneDelGruppo");

                                if (!validazioneDelGruppo)
                                {
                                    try
                                    {
                                        //Siccome NON è valido mi assicuro di eliminarlo da FotoExtraAuto
                                        List<LogoBollo> lbList = sottogruppo[GLOBAL_VARIABLES.keyFotoExtraAuto] as List<LogoBollo>;
                                        List<LogoBollo> newLLB = new List<LogoBollo>();

                                        var logoToscana = lbList.FirstOrDefault(l => l.sigla == "logo_toscana1");
                                        if (logoToscana != null)
                                        {
                                            foreach (var lbItem in lbList)
                                            {
                                                if (lbItem.sigla != "logo_toscana1")
                                                {
                                                    newLLB.Add(lbItem);
                                                }
                                            }


                                            sottogruppo[GLOBAL_VARIABLES.keyFotoExtraAuto] = newLLB;
                                            sottogruppo["logo_toscana1"] = "";//Invalido l'attributo per il gruppo

                                        }




                                    }
                                    catch (Exception exLB)
                                    {
                                        Console.WriteLine("Error sottogurppo LB -> " + exLB.ToString());
                                    }

                                }
                            }




                            #endregion

                            //Alterazione dati del sottogruppo secondo logiche Edro21, se necessario
                            //Code
                            //Devo recuperare gli elementi singoli del gruppo dalla lista di origine
                            List<Dictionary<string, object>> elementiSottogruppo = tracciato.Where(t => t.recordInTracciato[GLOBAL_VARIABLES.keyScattoCodiceGruppo].ToString() == codice_gruppo).Select(s => s.recordInTracciato).ToList();
                            string selezionePSDelSottogruppo = eseguiAutoSelezioneGruppo(elementiSottogruppo, null);
                            List<Dictionary<string, object>> gruppoPSDelSottogruppo = JsonConvert.DeserializeObject<List<Dictionary<string, object>>>(selezionePSDelSottogruppo);

                            //Adesso potrei estrarre il nuovo primario del gruppo per poter assegnare al sottogruppo la foto primaria
                            //Non lo faccio eprchè Edro non vuole foto nel materiale PoP, per cui vanificherei uno sforzo


                            //Alterazione dati del sottogruppo secondo logiche Edro21, se necessario
                            //NAMING SINGOLO
                            artInKit.sottogruppo = sottogruppo;

                            //CREA CODIFICA DEL NOME
                            List<ArticoloInKitExportName> _names_sott = new List<ArticoloInKitExportName>();
                            foreach (TipoDiExport tItem in tipiExportDelKit)
                            {
                                IstantaLib.ArticoloInKitExportName codifica = new IstantaLib.ArticoloInKitExportName();
                                codifica.guidIdTipoExport = tItem.guidID;
                                codifica.nomeFile = NamingConventionUtility.Decode(tItem, promoContext, tracciatoContext, kit, acpvDB, ncDB, formatiDB, artInKit.sottogruppo, this, null);
                                _names_sott.Add(codifica);
                            }

                            artInKit.sottogruppo[GLOBAL_VARIABLES_FICO.keyFicoNames] = _names_sott;
                            //FINE CODIFICA DEL NOME

                            _cacheSottogruppi.Add(codice_gruppo);

                        }
                        else if (inCache)
                        {
                            //Da questo singolo va tolta la descrizione gruppo dato che è già stata processata
                            if (recItem.ContainsKey(GLOBAL_VARIABLES.keyXMLDescrizioneGruppo))
                                recItem.Remove(GLOBAL_VARIABLES.keyXMLDescrizioneGruppo);
                        }
                    }

                    //Questo lo posso richiamare a prescindere anche se gia richiamato sopra secondo casistica
                    interprete.clearInterpreter();

                    if (BOXLINEA_xSingoliBOXSTD)
                    {
                        //Adesso posso cambiarlo davvero
                        recItem[GLOBAL_VARIABLES.codiceBox] = "BOX_STD";
                    }


                    //NAMING SINGOLO
                    List<ArticoloInKitExportName> _names = new List<ArticoloInKitExportName>();
                    foreach (TipoDiExport tItem in tipiExportDelKit)
                    {
                        IstantaLib.ArticoloInKitExportName codifica = new IstantaLib.ArticoloInKitExportName();
                        codifica.guidIdTipoExport = tItem.guidID;
                        codifica.nomeFile = NamingConventionUtility.Decode(tItem, promoContext, tracciatoContext, kit, acpvDB, ncDB, formatiDB, artInKit.recordInTracciato, this, null);
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
                Console.WriteLine("Export error generic (liv1): " + ex.ToString());
            }

            //impResult.liste = result;
            //impResult.errors = errors

            return result;
        }

        string getMaxPezziSociFormat(string input)
        {
            int maxPezzi = 0;
            if (input == "")
                input = "0";

            string resultMP = $"MAX {input} PEZZI PER CARTA SOCIO";

            if (!int.TryParse(input, out maxPezzi))
            {
                //Se non c'è scritto solo il numero allora
                int firstSpaceIndex = input.IndexOf(" ");
                if (firstSpaceIndex > 0)
                {
                    string newNum = input.Substring(0, firstSpaceIndex);
                    if (int.TryParse(newNum, out maxPezzi))
                    {
                        string ilresto = input.Substring(firstSpaceIndex);
                        resultMP = $"MAX {newNum} PEZZI{ilresto} PER CARTA SOCIO";
                    }
                    else
                    {
                        resultMP = $"invalid input {input}";
                    }
                }
                else
                {
                    resultMP = $"invalid input {input}";
                }
            }

            return resultMP;
        }

        public TracciatoResultKit esportaVolantino(List<FicoContextField> promoContext, List<FicoContextField> tracciatoContext, List<ArticoloInKit> tracciato, FicoRuntimeKit kit, string pathNamingConvention, string pathACPV, string pathTipiDiExport, string pathOrdinamentoLista, string pathMeccaniche, string pathLoghiBolli, string pathMappaStili, FicoCombinazioneKitReadMode readMode)
        {
            System.Globalization.CultureInfo culture = new System.Globalization.CultureInfo("it-IT");
            CultureInfo.CurrentCulture = culture;



            TracciatoResultKit result = new TracciatoResultKit();


            string potenziale_esempio = Edro21Context.Meta.potenziale_esempio;
            string meccanica_origine = Edro21Context.Meta.meccanica_origine;
            string keyArea = Edro21Context.Meta.area;
            string keyTipo_volantino = Edro21Context.Meta.tipo_volantino;
            string keyRuolo = Edro21Context.Meta.ruolo;
            string keySegmento = Edro21Context.Meta.segmento;
            string keyNote_category = Edro21Context.Meta.note_category;
            string keyDistintivita = Edro21Context.Meta.distintivita;
            string keyReparto = Edro21Context.Meta.reparto;
            string keyCodice_scatto = Edro21Context.Meta.codice_scatto;
            string keyCodiceGruppo = Edro21Context.Meta.ScattoCodiceGruppo;
            string keyTema = Edro21Context.Meta.tema;
            string keyPrezzo_offerta = Edro21Context.Meta.prezzo_offerta;
            string keyPrezzo_offerta_kgl = Edro21Context.Meta.prezzo_offerta_kgl;
            string keyPaghi_secondo = Edro21Context.Meta.prezzo_offerta_secondo;
            string keySezione = Edro21Context.Meta.sezione;
            string keySconto_agenzia = Edro21Context.Meta.sconto_agenzia;
            string keyTipo_tema = Edro21Context.Meta.tipo_tema;
            string keyRange_1 = Edro21Context.Meta.range_1;
            string keyRange_2 = Edro21Context.Meta.range_2;
            string keyPaghi_kgl_secondo = Edro21Context.Meta.prezzo_offerta_kgl_secondo;
            string keyPunti_1 = Edro21Context.Meta.punti_1;
            string keyPunti_2 = Edro21Context.Meta.punti_2;
            string keySettore = Edro21Context.Meta.settore;
            string keyTipo_punti = Edro21Context.Meta.tipo_punti;
            string keyPrezzo_anziche = Edro21Context.Meta.prezzo_anziche;
            string keyPrezzo_anziche_kgl = Edro21Context.Meta.prezzo_anziche_kgl;
            string keyPaghi_due_pezzi = Edro21Context.Meta.paghi_due_pezzi;
            string keyN_MM = Edro21Context.Meta.N_MM;
            string keyM_MM = Edro21Context.Meta.M_MM;
            string keyRefs = Edro21Context.Meta.refs;
            string keyN_FID = Edro21Context.Meta.N_FID;
            string keyM_FID = Edro21Context.Meta.M_FID;
            string keyM_numero_reparto = Edro21Context.Meta.numero_reparto;
            string keyM_numero_settore = Edro21Context.Meta.numero_settore;
            string keyDicituraReparto = Edro21Context.Meta.dicitura_reparto;
            string keyM_prezzo_offerta_um_com = Edro21Context.Meta.prezzo_offerta_um_com;
            string keyM_prezzo_anziche_um_com = Edro21Context.Meta.prezzo_anziche_um_com;
            string keyM_unita_fatt = Edro21Context.Meta.unita_fatt;
            string keyM_um_com = Edro21Context.Meta.um_com;
            string key_combinazioneAssegnata = Edro21Context.Meta.keyCombinazioneAssegnata;
            string key_codiceBox = Edro21Context.Meta.keyCodiceBox;
            string keySconto_MM = Edro21Context.Meta.sconto_MM;
            string keySconto_FID = Edro21Context.Meta.sconto_FID;
            string keyStatoSelezione = Edro21Context.Meta.keyStatoSelezione;




            TracciatoKit tracciato_da_esportare = new TracciatoKit();
            string referenza_pilota = Edro21Context.Meta.referenza_pilota;
            result.liste = new List<TracciatoKit>() { tracciato_da_esportare };
            result.liste[0].Records = new List<ArticoloInKit>();
            result.liste[0].errors = "";// = new List<Dictionary<string, object>>();
            try
            {
                //requestParams = formRequest;
                lista_tracciato = tracciato.Select(s => s.recordInTracciato).ToList();

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
                    codifica.nomeFile = NamingConventionUtility.Decode(tItem, promoContext, tracciatoContext, kit, acpvDB, ncDB, null, null);
                    exportNames.Add(codifica);
                }

                var tipoDiExpWeb = tipiExportDB.source.Find(f => f.codice == "WEB");

                if (kit.tipiDiExportInKit.Count == 1 && kit.tipiDiExportInKit[0].tipoDiExportGuidID == tipoDiExpWeb.guidID)
                {
                    tipoExport = "WEB";
                }

                CompiledFieldInterpreter interprete = new CompiledFieldInterpreter();

                int counter = 0;
                for (int i = 0; i < tracciato.Count; i++) //lista_tracciato.Count; i++)
                {

                    Dictionary<string, object> recItem = tracciato[i].recordInTracciato;// lista_tracciato[i];

                    string codice_gruppo = recItem[GLOBAL_VARIABLES.keyScattoCodiceGruppo].ToString();
                    string codice_referenza = recItem[GLOBAL_VARIABLES.keyRefCodice].ToString();
                    //bool debugAttivo = (codice_gruppo == "4096890,4578445");
                    //if (debugAttivo)
                    //{
                    //    Console.WriteLine($"Analisi {codice_gruppo} -> {codice_referenza}");
                    //}


                    string tema = recItem["tema"].ToString().ToLower();

                    bool is_fuori_volantino = (tema.IndexOf("fuori depliant") >= 0);
                    string descr1DaLista = recItem[GLOBAL_VARIABLES_FICO.keyDescr1Tracciato].ToString().ToLower();

                    if (is_fuori_volantino) // !is_fuori_volantino && FuoriVolField.IndexOf("volantino") < 0)
                    {
                        continue;
                    }

                    if (codice_gruppo== "2907018,6922799,7053334,7231599")
                    {
                        "debug".ToString();
                    }

                    var gruppo = tracciato.Where(t => t.recordInTracciato[GLOBAL_VARIABLES_FICO.keyCodiceGruppo].ToString() == codice_gruppo);

                    decimal peso = recItem[GLOBAL_VARIABLES.keyDescrPeso].ToDecimal();
                    string um = recItem[GLOBAL_VARIABLES.keyDescrUm].ToString();
                    string descr_1 = "";
                    string descr_brand = "";
                    string descr_tipo = "";
                    string descr_gramm = "";

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


                    if (peso != 1 && peso != 0.1M)
                    {

                    }



                    //if ()
                    string descr_gr_copy = descr_gramm;


                    //recItem[keyDescrizioniDescrizione4] = descrizioni_articolo[3];
                    //Meccanica mec2 = interpretaMeccanica(recItem, flag_meccanica_unita);
                    //string meccanica_tradotta = mec2.NomeTraduzione;
                    string meccanica_tradotta = recItem[key_combinazioneAssegnata].ToString();
                    byte[] str_desc2_bytes = System.Text.Encoding.UTF8.GetBytes(descr_brand);
                    string _brand = System.Text.Encoding.UTF8.GetString(str_desc2_bytes);
                    byte[] str_desc3_bytes = System.Text.Encoding.UTF8.GetBytes(descr_tipo);
                    string _tipogusto = System.Text.Encoding.UTF8.GetString(str_desc3_bytes);
                    byte[] str_desc4_bytes = System.Text.Encoding.UTF8.GetBytes(descr_gr_copy);
                    string _gramm = System.Text.Encoding.UTF8.GetString(str_desc4_bytes);

                    //Console.WriteLine($"Analisi meccanica {codice_gruppo} -> {codice_referenza} -> {meccanica_tradotta}");

                    int statoSelezione = 3;
                    if (recItem.ContainsKey(keyStatoSelezione))
                    {
                        statoSelezione = Convert.ToInt32(recItem[keyStatoSelezione]);
                        //if (debugAttivo)
                        //{
                        //    Console.WriteLine($"{codice_gruppo} - {codice_referenza} -> {statoSelezione}");
                        //}
                    }
                    //else
                    //{
                    //    //Console.WriteLine($"Attenzione {codice_referenza} non ha la SELEZIONE!");
                    //    if (debugAttivo)
                    //    {
                    //        Console.WriteLine($"{codice_gruppo} - {codice_referenza} -> no key selection");
                    //    }
                    //}

                    List<FotoElementoGruppo> membriGruppoFoto = RefsHelper.getFotoSecondarieDelGruppo(gruppo.Select(s => s.recordInTracciato).ToList());
                    recItem[GLOBAL_VARIABLES_FICO.keyMembriGruppoFoto] = membriGruppoFoto;



                    //if (foto || esempio)// || req.confronta_liste)
                    if (statoSelezione == 1 || statoSelezione == 2)
                    {


                        if (counter == 0)
                        {


                        }


                        counter++;

                        string siglaAreaKit = acpvDB.aree.FirstOrDefault(a => a.guidID == kit.guidArea).sigla;

                        var codiceBox = recItem[key_codiceBox].ToString();
                        string settore = recItem["settore"].ToString();
                        string stile_prezzo_promo = "PREZZO_PROMO";
                        string cod_segmento = recItem["codice_segmento"].ToString();
                        string segmento = recItem["segmento"].ToString().ToLower();
                        string reparto = recItem["reparto"].ToString();
                        string cod_categoria = recItem["codice_categoria"].ToString();
                        string sottomarchio = recItem["sottomarchio"].ToString();
                        string prodotto_in_toscana = recItem["logo_toscana1"].ToString();
                        string nPunti = recItem["N_Punti"].ToString();

                        decimal prezzo_promo = MathExt.Round(recItem["prezzo_promo"].ToDecimal(), 2, MidpointRounding.AwayFromZero);
                        decimal prezzo_continuo = MathExt.Round(recItem["prezzo_continuo"].ToDecimal(), 2, MidpointRounding.AwayFromZero);
                        decimal prezzo_promo_kgl = MathExt.Round(recItem["prezzo_promo_kgl"].ToDecimal(), 2, MidpointRounding.AwayFromZero);
                        decimal sconto = MathExt.Round(recItem["txt_sconto"].ToDecimal(), 2, MidpointRounding.AwayFromZero);

                        bool force_infopack = recItem.ContainsKey("force_infopack");
                        string val_force_scontopiccolo = "";

                        string str_force_infopack = "";
                        if (force_infopack)
                            str_force_infopack = recItem["force_infopack"].ToString();
                        if (recItem.ContainsKey("force_scontopiccolo"))
                            val_force_scontopiccolo = recItem["force_scontopiccolo"].ToString();

                        //Ricavo del prezzo info pack DA SISTEMA
                        string prezzo_info_pack_VAL = str_force_infopack;
                        if (!force_infopack)
                        {
                            if (codiceBox == "BOX_SuperprezziOF")
                            {
                                if (prezzo_promo_kgl <= prezzo_promo)
                                {
                                    prezzo_info_pack_VAL = "al kg";
                                }
                                else if (prezzo_promo_kgl > prezzo_promo)
                                {
                                    prezzo_info_pack_VAL = "a conf.";
                                }
                            }
                            else
                            {
                                //Se il prezzo info pack non è forzato, allor asi va per regole da sistema
                                if (reparto == "ORTOFRUTTA")
                                {
                                    if (
                                        prezzo_promo == prezzo_promo_kgl &&
                                        peso == 1 &&
                                        um == "KG" &&
                                        segmento.Contains("sfus") || StringExtension.laParolaSiTrovaDaSola("sf", descr_1.ToLower())
                                        )
                                    {
                                        prezzo_info_pack_VAL = "al kg";

                                    }
                                    else
                                    {
                                        prezzo_info_pack_VAL = "a conf.";
                                    }
                                }
                                else if (
                                    reparto.Contains("CARNI") || reparto.Contains("PESCE") ||
                                    reparto.Contains("ELABORATI") || reparto.Contains("SALUMI") ||
                                    reparto.Contains("GASTRO") || reparto.Contains("PANE") || reparto.Contains("PASTICC")
                                    )
                                {

                                    if (
                                        prezzo_promo == prezzo_promo_kgl &&
                                        peso == 1 &&
                                        um == "KG"
                                        )
                                    {
                                        prezzo_info_pack_VAL = "al kg";
                                    }
                                    else
                                    {
                                        prezzo_info_pack_VAL = "a conf.";
                                    }
                                }
                            }

                            if (cod_categoria == "294")
                            {
                                prezzo_info_pack_VAL = "cad.";
                            }
                        }

                        if (siglaAreaKit == "B" || siglaAreaKit == "B1" || siglaAreaKit == "A" || siglaAreaKit == "A-")
                        {
                            if (sconto % 5 < 3)
                            {
                                //Si approssima al multiplo basso
                                sconto = (int)(sconto / 5) * 5;
                            }
                            else
                            {
                                sconto = ((int)(sconto / 5) + 1) * 5;
                            }
                        }


                        decimal sconto_soci = recItem.ContainsKey("txt_sconto_soci_doppia") ? MathExt.Round(recItem["txt_sconto_soci_doppia"].ToDecimal(), 2, MidpointRounding.AwayFromZero) : 0m;


                        bool is_linea = (recItem["is_linea"].ToString().ToLower() == "x" || recItem["is_linea"].ToString().ToLower() == "xforced");

                        //Gestione dei loghi e bolli EXTRA - Messi in automatico secondo regole di agenzia

                        List<LogoBollo> _bolliloghi = new List<LogoBollo>();

                        //Array di loghi campionati in lista
                        string[] loghiFlagInTracciato = new string[] { "logo_toscana1", "logo_vegano", "logo_senzausoantibiotici", "logo_senzaglutine", "logo_senzaglutineasl", "logo_senzaglutinenonerogabile", "logo_senzazucchero", "logo_senzauova", "logo_senzalattosio", "logo_antibioticfree", "logo_ecologico", "logo_ecolabel", "logo_fscecocert", "logo_ecologico", "logo_aproteico", "logo_certificazioneorigine", "logo_doc", "logo_docg", "logo_igt", "logo_pat", "logo_stg", "logo_solidale" };

                        foreach (string s in loghiFlagInTracciato)
                        {
                            if (recItem.ContainsKey(s))
                            {
                                string valLogo = recItem[s].ToString().ToLower();

                                if (valLogo == "x")
                                {

                                    if (s == "logo_toscana1")
                                    {
                                        //Controllare la regola di esclusione   
                                        //NON INSERIRE “logo_toscana1” quando “Descrizione Evento” CONTIENE “DEDICATO TOSCANA”
                                        if (tema.ToLower().Contains("dedicato toscana"))
                                        {
                                            continue;
                                        }
                                    }


                                    LogoBollo lbItem = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == s);
                                    if (lbItem != null)
                                    {
                                        _bolliloghi.Add((LogoBollo)lbItem.Clone());
                                    }

                                }
                            }
                        }

                        //Se “Descrizione Reparto Marketing” = SURGELATI inserire “Bollino_SURGELATI”
                        if (reparto.ToLower().Contains("surgelati"))
                        {
                            LogoBollo lSurg = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Bollino_SURGELATI");
                            if (lSurg != null)
                            {

                                _bolliloghi.Add((LogoBollo)lSurg.Clone());
                            }
                        }

                        //Inserire “Logo_OrigineItalia” quando colonna Sottomarchio (colonna CQ) = ORIGINE
                        if (sottomarchio.ToLower().Contains("origine"))
                        {
                            LogoBollo lOIT = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Logo_OrigineItalia");
                            if (lOIT != null)
                            {
                                _bolliloghi.Add((LogoBollo)lOIT.Clone());
                            }
                        }

                        //Inserire “Logo_FiorFiore” quando colonna Sottomarchio (colonna CQ) = FIOR FIORE
                        if (sottomarchio.ToLower().Contains("fior fiore"))
                        {
                            LogoBollo lFF = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Logo_FiorFiore");
                            if (lFF != null)
                            {
                                _bolliloghi.Add((LogoBollo)lFF.Clone());
                            }
                        }

                        //nserire “Logo_BancodelGusto” quando colonna Sottomarchio (colonna CQ) = BANCO DEL 
                        if (sottomarchio.ToLower().Contains("banco del"))
                        {
                            LogoBollo lBgusto = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Logo_BancodelGusto");
                            if (lBgusto != null)
                            {
                                _bolliloghi.Add((LogoBollo)lBgusto.Clone());
                            }
                        }

                        string descr_tecnica = recItem["descrizione_tecnica"].ToString().ToLower();
                        if (descr_tecnica.StartsWith("acquisto max"))
                        {
                            string restante_testo = descr_tecnica.Substring("acquisto max".Length).Trim();
                            string compNumPezzi = "";
                            foreach (char c in restante_testo)
                            {
                                int valInt;
                                if (Int32.TryParse(c.ToString(), out valInt))
                                {
                                    compNumPezzi += c.ToString();
                                }
                                else
                                {
                                    if (compNumPezzi != "")
                                        break;
                                }

                            }
                            Int32 numPezziAcquistoMax;
                            Int32.TryParse(compNumPezzi, out numPezziAcquistoMax);
                            if (numPezziAcquistoMax > 0)
                            {
                                string composizioneCodiceLogoBollo = $"max{numPezziAcquistoMax}pezzi";
                                LogoBollo lmaxPezzi = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == composizioneCodiceLogoBollo);
                                if (lmaxPezzi != null)
                                {
                                    _bolliloghi.Add((LogoBollo)lmaxPezzi.Clone());
                                }
                            }
                        }


                        //Inserire “Logo_Cerealia” quando descrizione 2 (DESCRIZIONE BRAND) CONTIENE “Cerealia” (può essere scritto sia in maiuscolo che in minuscolo)
                        string descr2 = recItem[GLOBAL_VARIABLES_FICO.keyDescrizione2].ToString().ToLower();
                        string descr3 = recItem[GLOBAL_VARIABLES_FICO.keyDescrizione3].ToString().ToLower();
                        string descr1 = recItem[GLOBAL_VARIABLES_FICO.keyDescrizione1].ToString().ToLower();

                        if (descr2.Contains("cerealia"))
                        {
                            LogoBollo lCerealia = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "Logo_Cerealia");
                            if (lCerealia != null)
                            {
                                _bolliloghi.Add((LogoBollo)lCerealia.Clone());
                            }
                        }

                        if (descr2.ContainsWord(new string[] { "igp", "i.g.p." }) ||
                            descr3.ContainsWord(new string[] { "igp", "i.g.p." }) ||
                            descr1.ContainsWord(new string[] { "igp", "i.g.p." }))
                        {
                            LogoBollo lIGP = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "logo_igp");
                            if (lIGP != null)
                            {
                                _bolliloghi.Add((LogoBollo)lIGP.Clone());
                            }
                        }

                        if (descr2.ContainsWord(new string[] { "dop", "d.o.p." }) ||
                            descr3.ContainsWord(new string[] { "dop", "d.o.p." }) ||
                            descr1.ContainsWord(new string[] { "dop", "d.o.p." }))
                        {
                            //Ulteriore controllo per capire se bio è parte di una parola più grande
                            LogoBollo lDOP = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "logo_dop");
                            if (lDOP != null)
                            {
                                _bolliloghi.Add((LogoBollo)lDOP.Clone());
                            }

                        }

                        if (descr2.ContainsWord(new string[] { "bio" }) ||
                            descr3.ContainsWord(new string[] { "bio" }) ||
                            descr1.ContainsWord(new string[] { "bio" }))

                        {
                            //Ulteriore controllo per capire se bio è parte di una parola più grande
                            LogoBollo lBIO = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "logo_bio");
                            if (lBIO != null)
                            {
                                _bolliloghi.Add((LogoBollo)lBIO.Clone());
                            }
                        }


                        recItem[GLOBAL_VARIABLES.keyFotoExtraAuto] = _bolliloghi;





                        tracciato[i].recordInTracciato[GLOBAL_VARIABLES_FICO.keyFicoNames] = exportNames;

                        #region compiledfield

                        //Assegno compiled field 



                        bool regolaNoPrezzoPromoKgl = (
                            //reparto == "IGIENE PERSONA" ||
                            //reparto == "IGIENE AMBIENTI" ||
                            reparto == "PULIZIA" ||
                            //reparto == "PET FOOD/PET CARE" ||
                            reparto == "CALZATURE" ||
                            reparto == "ESTERNO DONNA" ||
                            reparto == "ESTERNO UOMO" ||
                            reparto == "INTIMO" ||
                            reparto == "CALZETTERIA" ||
                            reparto == "FAI DA TE" ||
                            reparto == "CUCINA" ||
                            reparto == "PED" ||
                            reparto == "TESSILE CASA" ||
                            peso == 1);

                        //Console.WriteLine($"Peso del codice {codice_referenza} = {peso} regol no pkgl = {regolaNoPrezzoPromoKgl}");

                        if (!regolaNoPrezzoPromoKgl)
                        {
                            //Controllo che tutti i pesi siano uguali
                            if (gruppo.GroupBy(g => g.recordInTracciato[GLOBAL_VARIABLES_FICO.keyDescrPeso]).Count() == 1)
                            {
                                string dic_prezzoInfoPack = ((um == "KG") ? "al kg" : (um == "LT") ? "al litro" : "al pezzo");
                                //if (force_infopack)
                                //{
                                //    if (str_force_infopack == "")
                                //    {
                                //        dic_prezzoInfoPack = "";
                                //    }
                                //    else
                                //    {
                                //        dic_prezzoInfoPack = str_force_infopack;
                                //    }
                                //}
                                string sty_pkgl = "PREZZO_PROMO_KGL";
                                if (siglaAreaKit == "A" && codiceBox == "BOX_ESCLUSIVA_SOCI")
                                    sty_pkgl = "PREZZO_PROMO_KGL_ESCLUSIVA_SOCI";

                                if (siglaAreaKit == "A-" && codiceBox == "BOX_ESCLUSIVA_SOCI")
                                    sty_pkgl = "PREZZO_PROMO_KGL_SOCI_DOPPIA";

                                if (codiceBox == "BOX_SuperprezziOF")
                                    sty_pkgl = "PREZZO_PROMO_KGL_SP";


                                string prezzo_promo_kgl_str = $"<{sty_pkgl}>€ {MathExt.DecimalRoundToString(prezzo_promo_kgl)} {dic_prezzoInfoPack}</{sty_pkgl}>";
                                interprete.assignCompiledField("prezzo_promo_kgl", "", prezzo_promo_kgl_str);
                            }
                            else
                            {
                                interprete.removeCompiledField("prezzo_promo_kgl");
                            }
                        }
                        else
                        {
                            interprete.removeCompiledField("prezzo_promo_kgl");
                        }



                        if (sconto > 0 || codiceBox.StartsWith("BOX_doppio_SCONTO"))
                        {
                            string prefixFolder = "";
                            if (siglaAreaKit != "A")
                            {
                                prefixFolder = $"{(siglaAreaKit != "B1" ? siglaAreaKit : "B")}.";
                            }

                            //Console.WriteLine($"SCONTO STYLE PREFIX {prefixFolder}");

                            string sconto_str = $"{(siglaAreaKit == "A" ? "-" : "")}{(int)sconto}%";

                            if (codiceBox != "BOX_SpendiPunti" && codiceBox != "BOX_ESCLUSIVA_SOCI" && codiceBox != "BOX_LINEA")
                            {
                                if (codiceBox.StartsWith("BOX_doppio_SCONTO"))
                                {
                                    sconto_str = $"-{(int)sconto}%";
                                    string sconto_soci_str = $"-{(int)sconto_soci}%";

                                    interprete.assignCompiledField("txt_sconto", "SCONTO_NON_SOCI", sconto_str);
                                    interprete.assignCompiledField("txt_sconto_SOCI_DOPPIA", "SCONTO_SOCI_DOPPIA", sconto_soci_str);

                                    //Controlliamo se questo BOX_doppio_SCONRO è in realtà da declinare con _LINEA
#warning questa forzatura è da gestire meglio e tramite CSS Framework quando sarà il momento
                                    if (gruppo.Count() > 3)
                                    {
                                        if (gruppo.GroupBy(g => g.recordInTracciato["prezzo_promo"]).Count() > 1)
                                        {
                                            //Allora è linea
                                            recItem[key_codiceBox] = recItem[key_codiceBox] + "_LINEA";
                                            codiceBox = recItem[key_codiceBox].ToString();
                                        }
                                    }

                                }
                                else
                                {
                                    interprete.assignCompiledField("txt_sconto", prefixFolder + "SCONTO", sconto_str);
                                }
                            }
                            else
                            {
                                if (codiceBox == "BOX_SpendiPunti" || codiceBox == "BOX_ESCLUSIVA_SOCI")
                                {
                                    sconto_str = $"-{(int)sconto}%";
                                }
                                else if (codiceBox == "BOX_LINEA")
                                {
                                    if (siglaAreaKit == "A")
                                    {
                                        sconto_str = $"-{(int)sconto}%";
                                    }
                                    else
                                    {
                                        sconto_str = $"SCONTO {(int)sconto}%";
                                    }
                                }

                                string stile_sconto = "SCONTO_SOCI_DOPPIA";
                                if (codiceBox == "BOX_LINEA")
                                    stile_sconto = $"{(siglaAreaKit.StartsWith("B") ? "B.SCONTO_LINEA" : $"{(siglaAreaKit == "A-" ? "A-.SCONTO_LINEA" : "SCONTO")}")}";
                                if (codiceBox == "BOX_SpendiPunti")
                                    stile_sconto = "SCONTO_SPENDIPUNTI";
                                if (codiceBox == "BOX_ESCLUSIVA_SOCI")
                                    stile_sconto = "SCONTO_ESCLUSIVA_SOCI";

                                interprete.assignCompiledField("txt_sconto", stile_sconto, sconto_str);
                                string sconto_soci_str = $"-{(int)sconto_soci}%";
                                interprete.assignCompiledField("txt_sconto_SOCI_DOPPIA", "SCONTO_SOCI_DOPPIA", sconto_soci_str);

                            }

                        }
                        else
                        {
                            interprete.removeCompiledField("box_sconto");
                            interprete.removeCompiledField("txt_sconto");
                        }



                        string specialDescr_max_pezzi_accodato_a_descrizione = "";
                        string specialDescr_linea_precedente_a_descrizione = "";
                        string specialDescr_superprezziOF = "";

                        string stileDescr1 = "DESCRIZIONE_TITOLO";
                        string stileDescr2 = "DESCRIZIONE_BRAND";
                        string stileDescr3 = "DESCRIZIONE_TIPO";
                        string stileDescr4 = "DESCRIZIONE_GRAMMATURA";

                        string meccanica = recItem["meccanica"].ToString().ToLower();
                        string stile_prezzo_info_pack = "PREZZO_INFO_PACK";


                        if (codiceBox == "BOX_SuperprezziOF")
                        {
                            stile_prezzo_info_pack = "PREZZO_PROMO_KGL_WHITE";
                        }
                        if (codiceBox == "BOX_ESCLUSIVA_SOCI")
                        {
                            stile_prezzo_info_pack = "PREZZO_INFO_PACK_SOCI_DOPPIA";
                        }


                        if (prezzo_info_pack_VAL == "")
                        {
                            //Rimuovo forzatamente info pack
                            interprete.removeCompiledField("prezzo_info_pack");
                            interprete.removeCompiledField("prezzo_info_pack_SOCI_DOPPIA");
                        }
                        else
                        {
                            interprete.assignCompiledField("prezzo_info_pack", "", $"<{stile_prezzo_info_pack}>{prezzo_info_pack_VAL}</{stile_prezzo_info_pack}>");
                        }


                        if (
                            prezzo_promo == prezzo_promo_kgl &&
                            settore.ToLower().Contains("freschissimi") &&
                            peso == 1 &&
                            um == "KG" &&
                            (segmento.ToLower().Contains("produzione") || segmento.ToLower().Contains("sfuso") || segmento.ToLower().Contains("intero") || segmento.ToLower().Contains("freschi"))
                            )
                        {
                            interprete.removeCompiledField("prezzo_promo_kgl");
                        }


                        Func<string, bool> contieneUnTemaSpecialeEccezionale = (string _tema) =>
                        {
                            if (
                                !_tema.Contains("PIU VALORE") &&
                                !_tema.Contains("JOLLY") &&
                                !_tema.Contains("CAMPIONI DEL RISPARMIO") &&
                                !_tema.Contains("EXTRA") &&
                                !_tema.Contains("FRESCHI") &&
                                !_tema.Contains("PACC.PAM") &&
                                !_tema.Contains("NEW CLIENTI") &&
                                !_tema.Contains("NEW SOCI") &&
                                !_tema.Contains("VALORE CLIENTI") &&
                                !_tema.Contains("VALORE SOCI") &&
                                !_tema.Contains("PIU VALORE PUNTI") &&
                                !_tema.Contains("SPRINT") &&
                                !_tema.Contains("SUPERPREZZI") &&
                                !_tema.Contains("TEMA BABY") &&
                                !_tema.Contains("TEMA CHIMICA") &&
                                !_tema.Contains("OCCHIO AL PREZZO") &&
                                !_tema.Contains("TEMA VINI") &&
                                !_tema.Contains("TRIPLA CONVENIENZA")
                            )
                            {
                                return true;
                            }
                            return false;

                        };

                        Func<string, string> codificaColoreTemaEccezionale = (string val) =>
                        {
                            int inx_parentesi_aperta = tema.IndexOf("(");

                            if (inx_parentesi_aperta > 0)
                            {
                                val = val.Substring(0, inx_parentesi_aperta);

                            }

                            val = String.Join("_", val.Trim().Split(' '));

                            return val;
                        };

                        //Console.WriteLine($"Codice BOX: {codiceBox}");

                        if (codiceBox == "BOX_STD")
                        {

                            //if (meccanica!="MXN")
                            //{
                            //    interprete.removeCompiledField("1+1");
                            //    interprete.removeCompiledField("prezzo_info_pezzi");
                            //    interprete.removeCompiledField("prezzo_1pezzo");
                            //}
                            //else
                            if (meccanica == "MXN")
                            {
                                interprete.removeCompiledField("txt_sconto");
                                interprete.removeCompiledField("prezzo_continuo");

                                interprete.assignCompiledField("1+1", "", "<1+1>1+1</1+1>");
                                interprete.assignCompiledField("prezzo_info_pezzi", "", $"<PREZZO_INFO_PACK>2 pezzi</PREZZO_INFO_PACK>");



                                interprete.assignCompiledField("prezzo_1pezzo", "", $"<PREZZO_CONTINUO>1 pezzo € {MathExt.DecimalRoundToString(prezzo_continuo)}{(prezzo_info_pack_VAL != "" ? " " : "")}{prezzo_info_pack_VAL}</PREZZO_CONTINUO>");

                            }

                            interprete.removeCompiledField("txt_punti_jolly");

                            if (segmento.ToLower().Contains("sfuso"))
                            {
                                interprete.removeCompiledField("prezzo_promo_kgl");
                                if (siglaAreaKit == "A-")
                                {
                                    interprete.removeCompiledField("prezzo_promo_kgl_alternativo");
                                }
                            }
                            else
                            {
                                if (siglaAreaKit == "A-")
                                {
                                    if (prezzo_promo_kgl < prezzo_promo && reparto == "ORTOFRUTTA")// settore.ToUpper().Contains("FRESCH"))
                                    {
                                        //Lo mettiamo in evidenza con la label alternativa
                                        interprete.assignCompiledField("prezzo_promo_kgl_alternativo", "A-.PREZZO_PROMO_KGL", $"€ {MathExt.DecimalRoundToString(prezzo_promo_kgl)} al kg");
                                        interprete.removeCompiledField("prezzo_promo_kgl");
                                    }
                                    else
                                    {
                                        interprete.removeCompiledField("prezzo_promo_kgl_alternativo");
                                    }
                                }
                            }


                            if (tipoExport != "WEB")
                            {


                                bool speciale_toscana = tema.ToLower().Contains("toscana");// (recItem["logo_toscana1"].ToString() == "X");
                                bool contiene_evento_eccezionale = contieneUnTemaSpecialeEccezionale(tema.ToUpper());
                                //Console.WriteLine($"Regola x sconto: valore {sconto} spec tosc {speciale_toscana} spec evento ecez {contiene_evento_eccezionale} - tema: {tema}  codice box {codiceBox}");

                                // gestione sconto grande/piccolo nel piano A
                                if (siglaAreaKit == "A")
                                {
                                    if (
                                        ((!speciale_toscana &&
                                        !contiene_evento_eccezionale &&
                                        (sconto < 25 && sconto > 0)) ||
                                        val_force_scontopiccolo != "")
                                        &&
                                        !tema.ToUpper().Contains("CAMPIONI DEL RISPARMIO"))
                                    {
                                        //Console.WriteLine("Sconto piccolo ok!");
                                        //si mette sconto piccolo
                                        string sconto_str = $"SCONTO {(int)sconto}%";
                                        interprete.assignCompiledField("sconto_piccolo", "", "<DESCRIZIONE_TITOLO>" + sconto_str + "</DESCRIZIONE_TITOLO>");

                                        if (codiceBox == "BOX_STD")
                                        {
                                            interprete.removeCompiledField("box_sconto");
                                            interprete.removeCompiledField("txt_sconto");
                                        }
                                    }
                                    else
                                    {
                                        //Console.WriteLine("Sconto piccolo K.O.");
                                        interprete.removeCompiledField("sconto_piccolo");
                                    }
                                }



                                if (contiene_evento_eccezionale)
                                {
                                    //Va creata una nuova chiave che si chiama "colore_sconto_speciale"
                                    //Che codifichi il valore grezzo del tema
                                    string _codifica = codificaColoreTemaEccezionale(tema);
                                    recItem["colore_sconto_speciale"] = _codifica.ToUpper();

                                }
                            }


                        }
                        else if (codiceBox == "BOX_1+1")
                        {
                            prezzo_promo_kgl = prezzo_promo_kgl / 2;
                            interprete.removeCompiledField("box_sconto");
                            interprete.removeCompiledField("sconto_piccolo");
                            if (meccanica == "MXN")
                            {
                                interprete.removeCompiledField("txt_sconto");
                                interprete.removeCompiledField("prezzo_continuo");

                                interprete.assignCompiledField("1+1", "", "<1+1>1+1</1+1>");
                                interprete.assignCompiledField("prezzo_info_pezzi", "", $"<PREZZO_INFO_PACK>2 pezzi</PREZZO_INFO_PACK>");
                            }




                            interprete.assignCompiledField("prezzo_1pezzo", "", $"<PREZZO_CONTINUO>1 pezzo € {MathExt.DecimalRoundToString(prezzo_promo)}{(prezzo_info_pack_VAL != "" ? " " : "")}{prezzo_info_pack_VAL}</PREZZO_CONTINUO>");

                            if (segmento.ToLower().Contains("sfuso"))
                            {
                                interprete.removeCompiledField("prezzo_promo_kgl");
                                if (siglaAreaKit == "A-")
                                {
                                    interprete.removeCompiledField("prezzo_promo_kgl_alternativo");
                                }
                            }
                            else
                            {
                                if (siglaAreaKit == "A-")
                                {
                                    interprete.removeCompiledField("prezzo_promo_kgl_alternativo");
                                }
                            }


                            if (tipoExport != "WEB")
                            {


                                bool speciale_toscana = tema.ToLower().Contains("toscana");// (recItem["logo_toscana1"].ToString() == "X");
                                bool contiene_evento_eccezionale = contieneUnTemaSpecialeEccezionale(tema.ToUpper());
                                //Console.WriteLine($"Regola x sconto: valore {sconto} spec tosc {speciale_toscana} spec evento ecez {contiene_evento_eccezionale} - tema: {tema}  codice box {codiceBox}");

                                // gestione sconto grande/piccolo nel piano A
                                if (siglaAreaKit == "A")
                                {
                                    if (
                                        ((!speciale_toscana &&
                                        !contiene_evento_eccezionale &&
                                        (sconto < 25 && sconto > 0)) ||
                                        val_force_scontopiccolo != "")
                                        &&
                                        !tema.ToUpper().Contains("CAMPIONI DEL RISPARMIO"))
                                    {
                                        //Console.WriteLine("Sconto piccolo ok!");
                                        //si mette sconto piccolo
                                        string sconto_str = $"SCONTO {(int)sconto}%";
                                        interprete.assignCompiledField("sconto_piccolo", "", "<DESCRIZIONE_TITOLO>" + sconto_str + "</DESCRIZIONE_TITOLO>");
                                    }
                                    else
                                    {
                                        //Console.WriteLine("Sconto piccolo K.O.");
                                        interprete.removeCompiledField("sconto_piccolo");
                                    }
                                }



                                if (contiene_evento_eccezionale)
                                {
                                    //Va creata una nuova chiave che si chiama "colore_sconto_speciale"
                                    //Che codifichi il valore grezzo del tema
                                    string _codifica = codificaColoreTemaEccezionale(tema);
                                    recItem["colore_sconto_speciale"] = _codifica.ToUpper();

                                }
                            }


                        }
                        else if (codiceBox == "BOX_SuperprezziOF")
                        {
                            stile_prezzo_promo = $"{(siglaAreaKit == "A-" ? "A-." : "")}PREZZO_PROMO_WHITE";

                            stile_prezzo_info_pack = "PREZZO_PROMO_KGL_WHITE";

                            interprete.removeCompiledField("txt_punti_jolly");

                            stileDescr1 += "_SP";
                            stileDescr2 += "_SP";
                            stileDescr3 += "_SP";
                            stileDescr4 += "_SP";


                            //caso1
                            if (prezzo_promo != prezzo_promo_kgl)
                            {
                                if (prezzo_promo_kgl < prezzo_promo)
                                {
                                    specialDescr_superprezziOF = $"\n€ {MathExt.DecimalRoundToString(prezzo_promo)} a conf.";
                                    prezzo_promo = prezzo_promo_kgl;//Veicolamento
                                }
                                else
                                {
                                    //specialDescr_superprezziOF = $" - € {MathExt.DecimalRoundToString(prezzo_promo_kgl)}{(prezzo_info_pack_VAL != "" ? " " : "")}{(prezzo_info_pack_VAL == "al kg" ? "a conf." : "al kg")}";
                                    specialDescr_superprezziOF = $"\n€ {MathExt.DecimalRoundToString(prezzo_promo_kgl)}{(prezzo_info_pack_VAL != "" ? " " : "")}{(prezzo_info_pack_VAL == "al kg" ? "a conf." : "al kg")}";
                                }
                            }




                            if (siglaAreaKit != "A-")
                            {
                                interprete.removeCompiledField("prezzo_promo_kgl");
                            }


                            interprete.removeCompiledField("prezzo_continuo");
                            interprete.removeCompiledField("txt_sconto");

                        }
                        else if (codiceBox == "BOX_LINEA")
                        {

                            interprete.removeCompiledField("txt_punti_jolly");
                            specialDescr_linea_precedente_a_descrizione = "<DESCRIZIONE_LINEA>LINEA </DESCRIZIONE_LINEA>";

                            //Console.WriteLine("DAMN! BOX_LINEA");
                            stileDescr1 += "_LINEA";
                            stileDescr2 += "_LINEA";
                            stileDescr3 += "_LINEA";

                            bool contiene_evento_eccezionale = contieneUnTemaSpecialeEccezionale(tema.ToUpper());
                            if (contiene_evento_eccezionale)
                            {
                                //Va creata una nuova chiave che si chiama "colore_sconto_speciale"
                                //Che codifichi il valore grezzo del tema
                                string _codifica = codificaColoreTemaEccezionale(tema);
                                recItem["colore_sconto_speciale"] = _codifica.ToUpper();

                            }

                        }
                        else if (codiceBox.StartsWith("BOX_JOLLY"))
                        {

                            string n_punti = recItem["N_Punti"].ToString();
                            if (n_punti == "")
                            {
                                n_punti = "0";
                            }

                            interprete.assignCompiledField("txt_punti_jolly", $"PUNTI_{codiceBox.Replace("BOX_", "")}", $"{n_punti}");

                            //Al momento non deve mai essere mostrata
                            interprete.removeCompiledField("confezioni");

                            stileDescr1 += "_JOLLY";
                            stileDescr2 += "_JOLLY";
                            stileDescr3 += "_JOLLY";
                            stileDescr4 += "_JOLLY";

                        }
                        else if (codiceBox == "BOX_SPRINT")
                        {
                            int n_bonus;
                            Int32.TryParse(recItem["N_BonusCartacei"].ToString(), out n_bonus);

                            //interprete.assignCompiledField("txt_punti_sprint", "", $"<PUNTI_SPRINT>+{n_bonus}</PUNTI_SPRINT>");
                            interprete.assignCompiledField("txt_punti_sprint", "PUNTI_SPRINT", $"+{n_bonus}");

                            string scritta_bollino = "bollino";
                            if (n_bonus > 1)
                                scritta_bollino = "bollini";

                            interprete.assignCompiledField("bollino", "", $"<BOLLINO>{scritta_bollino}</BOLLINO>");


                            stileDescr1 += "_JOLLY";
                            stileDescr2 += "_JOLLY";
                            stileDescr3 += "_JOLLY";
                            stileDescr4 += "_JOLLY";
                        }
                        else if (codiceBox == "BOX_SpendiPunti")
                        {
                            stile_prezzo_promo = "PREZZO_PROMO_SOCI_DOPPIA";

                            string n_punti = recItem["N_Punti"].ToString();
                            if (n_punti == "")
                            {
                                n_punti = "0";
                            }

                            interprete.assignCompiledField("txt_punti_jolly", "", $"<PUNTI_Spendipunti_scritte>e </PUNTI_Spendipunti_scritte><PUNTI_Spendipunti>{n_punti}</PUNTI_Spendipunti><PUNTI_Spendipunti_scritte> punti</PUNTI_Spendipunti_scritte>");

                            decimal prezzo = recItem["prezzo_promo"].ToDecimal();
                            prezzo = MathExt.Round(prezzo, 2, MidpointRounding.AwayFromZero);
                            interprete.assignCompiledField("prezzo_promo_SOCI", "", $"<PREZZO_PROMO_SOCI>oppure per i soci € {MathExt.DecimalRoundToString(prezzo)}{(prezzo_info_pack_VAL != "" ? " " : "")}{prezzo_info_pack_VAL}</PREZZO_PROMO_SOCI>");

                            stile_prezzo_info_pack = "PREZZO_INFO_PACK_SOCI_DOPPIA";


                            if (prezzo_info_pack_VAL == "")
                            {
                                interprete.removeCompiledField("prezzo_info_pack_SOCI_DOPPIA");
                            }
                            else
                            {
                                interprete.assignCompiledField("prezzo_info_pack_SOCI_DOPPIA", "", $"<PREZZO_INFO_PACK_SOCI_DOPPIA>{prezzo_info_pack_VAL}</PREZZO_INFO_PACK_SOCI_DOPPIA>");
                            }

                        }
                        else if (codiceBox == "BOX_doppio_SCONTO")
                        {
                            decimal prezzo_promo_soci = 0m;
                            decimal prezzo_promo_kgl_soci = 0m;

                            if (!recItem.ContainsKey("prezzo_promo_soci_doppia"))
                            {
                                //Console.WriteLine("prezzo_promo_soci_doppia non essite nel rec");
                                if (prezzo_promo > 0)
                                {
                                    prezzo_promo_soci = MathExt.Round(prezzo_continuo - (prezzo_continuo * (sconto_soci / 100)), 2, MidpointRounding.AwayFromZero);
                                    prezzo_promo_kgl_soci = MathExt.Round((prezzo_promo_soci * prezzo_promo_kgl) / prezzo_promo, 2, MidpointRounding.AwayFromZero);
                                }

                            }
                            else
                            {
                                //Console.WriteLine("prezzo_promo_soci_doppia esiste e vale " + recItem["prezzo_promo_soci_doppia"].ToDecimal());

                                prezzo_promo_soci = recItem["prezzo_promo_soci_doppia"].ToDecimal();
                                prezzo_promo_kgl_soci = MathExt.Round(recItem["prezzo_promo_kgl_soci_doppia"].ToDecimal(), 2, MidpointRounding.AwayFromZero);
                            }



                            //Aggiungere MAX PEZZI alla descrizione
                            if (recItem["pezzi_soci"].ToString().ToLower() != "x")
                            {
                                specialDescr_max_pezzi_accodato_a_descrizione = getMaxPezziSociFormat(recItem["N_pezzi_soci"].ToString());// $"MAX {recItem["N_pezzi_soci"].ToString()} PEZZI PER CARTA SOCIO";
                            }

                            interprete.removeCompiledField("txt_punti_jolly");

                            //Da capire dove vengono letti i valori
                            if (!regolaNoPrezzoPromoKgl)
                            {

                                if (!segmento.ToLower().Contains("sfuso"))
                                {
                                    string dic_prezzoInfoPack = ((um == "KG") ? "al kg" : (um == "LT") ? "al litro" : "al pezzo");
                                    //if (force_infopack)
                                    //{
                                    //    if (str_force_infopack == "")
                                    //    {
                                    //        dic_prezzoInfoPack = "";
                                    //    }
                                    //    else
                                    //    {
                                    //        dic_prezzoInfoPack = str_force_infopack;
                                    //    }
                                    //}
                                    string prezzo_promo_kgl_str2 = $"<PREZZO_PROMO_KGL_SOCI_DOPPIA>€ {MathExt.DecimalRoundToString(prezzo_promo_kgl_soci)} {dic_prezzoInfoPack}</PREZZO_PROMO_KGL_SOCI_DOPPIA>";
                                    interprete.assignCompiledField("prezzo_promo_kgl_SOCI_DOPPIA", "", prezzo_promo_kgl_str2);
                                }
                                else
                                {
                                    interprete.removeCompiledField("prezzo_promo_kgl_SOCI_DOPPIA");
                                }
                            }
                            else
                            {
                                interprete.removeCompiledField("prezzo_promo_kgl_SOCI_DOPPIA");
                            }

                            prezzo_promo_soci = MathExt.Round(prezzo_promo_soci, 2, MidpointRounding.AwayFromZero);
                            string prezzo_promo_str2 = $"€ {MathExt.DecimalRoundToString(prezzo_promo_soci)}";
                            interprete.assignCompiledField("prezzo_promo_SOCI_DOPPIA", "PREZZO_PROMO_SOCI_DOPPIA", prezzo_promo_str2);

                            string prezzo_continuo_str2 = $"<PREZZO_CONTINUO_SOCI>invece di € {MathExt.DecimalRoundToString(prezzo_continuo)}{(prezzo_info_pack_VAL != "" ? " " : "")}{prezzo_info_pack_VAL}</PREZZO_CONTINUO_SOCI>";

                            interprete.assignCompiledField("prezzo_continuo_SOCI_DOPPIA", "", prezzo_continuo_str2);

                            if (prezzo_info_pack_VAL != "")
                            {
                                interprete.assignCompiledField("prezzo_info_pack_SOCI_DOPPIA", "", $"<PREZZO_INFO_PACK_SOCI_DOPPIA>{prezzo_info_pack_VAL}</PREZZO_INFO_PACK_SOCI_DOPPIA>");
                            }



                            if (is_linea)
                            {
                                interprete.removeCompiledField("prezzo_promo");
                                interprete.removeCompiledField("prezzo_info_pack");
                                interprete.removeCompiledField("prezzo_promo_SOCI_DOPPIA");
                                interprete.removeCompiledField("prezzo_info_pack_SOCI_DOPPIA");
                                interprete.removeCompiledField("prezzo_promo_kgl");
                                interprete.removeCompiledField("prezzo_promo_kgl_SOCI_DOPPIA");
                                interprete.removeCompiledField("prezzo_continuo");
                                interprete.removeCompiledField("prezzo_continuo_SOCI_DOPPIA");
                            }


                        }
                        else if (codiceBox == "BOX_doppio_SCONTO_LINEA")
                        {
                            //Aggiungere MAX PEZZI alla descrizione
                            if (recItem["pezzi_soci"].ToString().ToLower() != "x")
                            {

                                specialDescr_max_pezzi_accodato_a_descrizione = getMaxPezziSociFormat(recItem["N_pezzi_soci"].ToString());// $"MAX {recItem["N_pezzi_soci"].ToString()} PEZZI PER CARTA SOCIO";
                            }

                            specialDescr_linea_precedente_a_descrizione = "<DESCRIZIONE_LINEA>LINEA </DESCRIZIONE_LINEA>";

                            //Console.WriteLine("DAMN! BOX_doppio_SCONTO_LINEA");
                            stileDescr1 += "_LINEA";
                            stileDescr2 += "_LINEA";
                            stileDescr3 += "_LINEA";
                            stileDescr4 += "_LINEA";

                        }
                        else if (codiceBox == "BOX_ESCLUSIVA_SOCI")
                        {
                            decimal prezzo_risparmi = prezzo_continuo - prezzo_promo;
                            prezzo_risparmi = MathExt.Round(prezzo_risparmi, 2, MidpointRounding.AwayFromZero);
                            interprete.assignCompiledField("risparmi", "", $"<RISPARMI>Risparmi € {MathExt.DecimalRoundToString(prezzo_risparmi)}</RISPARMI>{(prezzo_info_pack_VAL != "" ? $"<RISPARMI_infopack> {prezzo_info_pack_VAL}</RISPARMI_infopack>" : "")}");

                            if (recItem["pezzi_soci"].ToString().ToLower() != "x")
                            {
                                specialDescr_max_pezzi_accodato_a_descrizione = getMaxPezziSociFormat(recItem["N_pezzi_soci"].ToString()); //$"MAX {recItem["N_pezzi_soci"].ToString()} PEZZI PER CARTA SOCIO";
                            }

                            if (peso <= 1)
                            {
                                interprete.removeCompiledField("prezzo_promo_kgl_alternativo");
                            }
                            else if (peso > 1)
                            {
                                if (siglaAreaKit.StartsWith("A"))
                                {
                                    interprete.assignCompiledField("prezzo_promo_kgl_alternativo", "A-.PREZZO_PROMO_ESCLUSIVA_SOCI", $"€ {MathExt.DecimalRoundToString(prezzo_promo_kgl)}{(prezzo_info_pack_VAL != "" ? " " : "")}{prezzo_info_pack_VAL}");
                                    interprete.removeCompiledField("prezzo_promo_kgl");
                                }
                            }
                        }

                        if (codiceBox == "BOX_SpendiPunti")
                        {
                            if (nPunti != "")
                            {
                                int nPuntiNum = Int32.Parse(nPunti);
                                decimal valPunti = (decimal)nPuntiNum * 0.02m;//0.02 è il valore che Coop attribuisce ai punti
                                interprete.assignCompiledField("prezzo_promo", stile_prezzo_promo, $"€ {MathExt.DecimalRoundToString(MathExt.Round((prezzo_promo - valPunti), 2, MidpointRounding.AwayFromZero))}");
                            }
                            else
                            {
                                interprete.assignCompiledField("prezzo_promo", stile_prezzo_promo, $"€ {MathExt.DecimalRoundToString(prezzo_promo)}");
                            }

                            if (recItem["N_pezzi_soci"].ToString() != "")
                            {
                                //Console.WriteLine("N_pezzi_soci provo a convertirlo: " + recItem["N_pezzi_soci"]);
                                int pz_soci = Convert.ToInt32(recItem["N_pezzi_soci"]);
                                if (recItem["pezzi_soci"].ToString().ToLower() != "x" && pz_soci > 0)
                                {
                                    specialDescr_max_pezzi_accodato_a_descrizione = getMaxPezziSociFormat(pz_soci.ToString()); //$"MAX {recItem["N_pezzi_soci"].ToString()} PEZZI PER CARTA SOCIO";
                                }
                            }
                            else
                            {
                                Console.WriteLine("N_pezzi_soci non valorizzato per BOX_SpendiPunti: " + recItem["N_pezzi_soci"] + " per la ref " + codice_referenza);

                            }


                        }
                        else if (codiceBox == "BOX_ESCLUSIVA_SOCI")
                        {
                            stile_prezzo_promo = "PREZZO_PROMO_SOCI_DOPPIA";
                            if (siglaAreaKit == "A")
                                stile_prezzo_promo = "PREZZO_PROMO_ESCLUSIVA_SOCI";

                            interprete.assignCompiledField("prezzo_promo", stile_prezzo_promo, $"€ {MathExt.DecimalRoundToString(prezzo_promo)}");

                            if (siglaAreaKit == "A-")
                            {
                                if (prezzo_promo_kgl < prezzo_promo && reparto == "ORTOFRUTTA")// settore.ToUpper().Contains("FRESCH"))
                                {
                                    //Lo mettiamo in evidenza con la label alternativa
                                    interprete.assignCompiledField("prezzo_promo_kgl_alternativo", "A-.PREZZO_PROMO_KGL", $"€ {MathExt.DecimalRoundToString(prezzo_promo_kgl)} al kg");
                                    interprete.removeCompiledField("prezzo_promo_kgl");
                                }
                                else
                                {
                                    interprete.removeCompiledField("prezzo_promo_kgl_alternativo");
                                }
                            }


                        }
                        else
                        {
                            interprete.assignCompiledField("prezzo_promo", stile_prezzo_promo, $"€ {MathExt.DecimalRoundToString(prezzo_promo)}");
                        }



                        if (prezzo_continuo >= 0)
                        {
                            if (prezzo_continuo != prezzo_promo || codiceBox == "BOX_SpendiPunti" || codiceBox == "BOX_doppio_SCONTO")
                            {
                                string stile_p_continuo = "PREZZO_CONTINUO";
                                if (codiceBox == "BOX_SpendiPunti")
                                {
                                    stile_p_continuo = "PREZZO_CONTINUO_SPENDIPUNTI";
                                }

                                if (codiceBox == "BOX_ESCLUSIVA_SOCI")
                                {
                                    stile_p_continuo = "PREZZO_CONTINUO_SOCI";
                                    if (siglaAreaKit == "A")
                                    {
                                        stile_p_continuo = "PREZZO_CONTINUO_ESCLUSIVA_SOCI";
                                    }
                                }

                                string prezzo_continuo_str = $"<{stile_p_continuo}>invece di € {MathExt.DecimalRoundToString(prezzo_continuo)}{(prezzo_info_pack_VAL != "" ? " " : "")}{prezzo_info_pack_VAL}</{stile_p_continuo}>";
                                interprete.assignCompiledField("prezzo_continuo", "", prezzo_continuo_str);
                            }
                            else
                            {

                                interprete.removeCompiledField("prezzo_continuo");
                            }
                        }


                        #endregion


                        //Console.WriteLine("Finalizzazione...");
                        //Per rimuoveere i compiled field
                        interprete.removeCompiledField("LBL_Reparto");


                        //Pulizia dei campi in base ai box scelti
                        if (codiceBox == "BOX_LINEA")
                        {
                            interprete.removeCompiledField("prezzo_promo");
                            interprete.removeCompiledField("prezzo_continuo");
                            interprete.removeCompiledField("txt_sconto_SOCI_DOPPIA");
                            interprete.removeCompiledField("prezzo_promo_kgl");
                            interprete.removeCompiledField("prezzo_info_pack");
                        }
                        else if (codiceBox == "BOX_SPRINT")
                        {
                            interprete.removeCompiledField("prezzo_promo");
                            interprete.removeCompiledField("prezzo_promo_kgl");
                            interprete.removeCompiledField("prezzo_info_pack");
                        }
                        else if (codiceBox == "BOX_ESCLUSIVA_SOCI")
                        {
                            interprete.removeCompiledField("txt_sconto_SOCI_DOPPIA");
                        }
                        else if (codiceBox == "BOX_JOLLY")
                        {
                            interprete.removeCompiledField("prezzo_promo");
                            interprete.removeCompiledField("prezzo_promo_kgl");
                            interprete.removeCompiledField("prezzo_info_pack");
                        }
                        else if (codiceBox == "BOX_JOLLY_EVIDENZIATO")
                        {
                            interprete.removeCompiledField("prezzo_promo");
                            interprete.removeCompiledField("prezzo_promo_kgl");
                            interprete.removeCompiledField("prezzo_info_pack");

                        }
                        else if (codiceBox == "BOX_SpendiPunti")
                        {
                            interprete.removeCompiledField("txt_sconto_SOCI_DOPPIA");
                            interprete.removeCompiledField("prezzo_promo_kgl");
                        }
                        else if (codiceBox == "BOX_doppio_SCONTO_LINEA")
                        {

                        }

                        #region descrizione

                        //Console.WriteLine("Finalizzazione...descrizione");

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


                        while (Descrizione1.Contains("<br>"))
                        {
                            Descrizione1 = Descrizione1.Replace("<br>", "\n");

                        }
                        while (Descrizione2.Contains("<br>"))
                        {
                            Descrizione2 = Descrizione2.Replace("<br>", "\n");

                        }
                        while (Descrizione3.Contains("<br>"))
                        {
                            Descrizione3 = Descrizione3.Replace("<br>", "\n");

                        }
                        while (Descrizione4.Contains("<br>"))
                        {
                            Descrizione4 = Descrizione4.Replace("<br>", "\n");

                        }

                        Descrizione1 = Descrizione1.Replace("$br", "\n");
                        string descr_prog = Descrizione1;

                        if (Descrizione2 != "")
                        {
                            Descrizione2 = Descrizione2.Replace("$br", "\n");
                            //Se descrizione 1 non ha br oppure non ce l'ha all'inizio e quindi per forza alla fine
                            //Metto lo spazio di separazione
                            if (descr_prog != "")
                                Descrizione2 = ((!Descrizione2.StartsWith(" ") && !Descrizione2.StartsWith("\n") && !Descrizione2.StartsWith(Environment.NewLine)) ? " " : "") + Descrizione2;
                        }

                        descr_prog += Descrizione2;


                        if (Descrizione4 != "")
                        {
                            Descrizione4 = Descrizione4.Replace("$br", "\n");
                            //Se descrizione 1 non ha br oppure non ce l'ha all'inizio e quindi per forza alla fine
                            Descrizione4 = ((!Descrizione4.StartsWith(" ") && !Descrizione4.StartsWith("\n") && !Descrizione4.StartsWith(Environment.NewLine)) ? " " : "") + Descrizione4;
                        }

                        descr_prog += Descrizione4;

                        if (Descrizione3 != "")
                        {
                            Descrizione3 = Descrizione3.Replace("$br", "\n");
                            //Se descrizione 1 non ha br oppure non ce l'ha all'inizio e quindi per forza alla fine
                            Descrizione3 = ((!Descrizione3.StartsWith(" ") && !Descrizione3.StartsWith("\n") && !Descrizione3.StartsWith(Environment.NewLine)) ? " " : "") + Descrizione3;
                            //Descrizione3 = " " + Descrizione3;
                        }

                        descr_prog += Descrizione3;


                        if (Descrizione1 != "")
                            descrizione = $"<{stileDescr1}>{Descrizione1}</{stileDescr1}>";
                        if (Descrizione2 != "")
                            descrizione += $"<{stileDescr2}>{Descrizione2}</{stileDescr2}>";
                        if (Descrizione4 != "")
                            descrizione += $"<{stileDescr4}>{Descrizione4}</{stileDescr4}>";
                        if (Descrizione3 != "")
                            descrizione += $"<{stileDescr3}>{Descrizione3}</{stileDescr3}>";

                        //Console.WriteLine($"Stili Descrizioni {String.Join(",",new string[] { stileDescr1,stileDescr2,stileDescr3,stileDescr4})}");

                        if (specialDescr_max_pezzi_accodato_a_descrizione != "")
                        {
                            if (codiceBox == "BOX_ESCLUSIVA_SOCI")
                            {
                                descrizione += $"<MAX_PEZZI_ESCLUSIVA_SOCI>\n" + specialDescr_max_pezzi_accodato_a_descrizione + "</MAX_PEZZI_ESCLUSIVA_SOCI>";
                            }
                            else
                            {
                                descrizione += $"<MAX_PEZZI>\n" + specialDescr_max_pezzi_accodato_a_descrizione + "</MAX_PEZZI>";
                            }
                        }
                        if (specialDescr_superprezziOF != "")
                        {
                            descrizione += $"<DESCRIZIONE_PREZZO_SP>" + specialDescr_superprezziOF + "</DESCRIZIONE_PREZZO_SP>";
                        }
                        if (specialDescr_linea_precedente_a_descrizione != "")
                        {
                            descrizione = $"{specialDescr_linea_precedente_a_descrizione}{descrizione}";
                        }


                        interprete.assignCompiledField("descrizione", stileParagDescr, descrizione);


                        #endregion descrizione



                        var fields = interprete.getFields();
                        recItem["compiledFields"] = fields.compiledFields;
                        recItem["deletedFields"] = fields.deletedFields;
                        interprete.clearInterpreter();




                        //Hack delle etichette per il trasferimento dati in pluginMiddleware

                        var etichetteCustom = new List<string>();

                        // TODO: verificare che "Scatto.CodiceGruppo" sia il nome corretto del campo nel tracciato C#
                        var codGruppo = recItem[keyCodiceGruppo].ToString();
                        var codiceBoxStr = recItem[GLOBAL_VARIABLES_FICO.codiceBox].ToString();

                        var recordsDelGruppo = tracciato
                            .Where(r => r.recordInTracciato[keyCodiceGruppo].ToString() == codGruppo)
                            .ToList();


                        // Controllare se ci sono prezzi promo differenti e non si tratta di LINEA / SpendiPunti
                        if (
                            codiceBoxStr != "BOX_LINEA" &&
                            codiceBoxStr != "BOX_SpendiPunti"
                        )
                        {
                            var collPrezzi = new HashSet<string>();

                            foreach (var record in recordsDelGruppo)
                            {
                                var prezzoPromo = record.recordInTracciato["prezzo_promo"].ToString();
                                collPrezzi.Add(prezzoPromo);
                            }

                            if (collPrezzi.Count > 1)
                            {
                                etichetteCustom.Add("PIU_PREZZI_PROMO");
                            }
                        }

                        if (
                            codiceBoxStr == "BOX_JOLLY" ||
                            codiceBoxStr == "BOX_JOLLY_EVIDENZIATO" ||
                            codiceBoxStr == "BOX_SPRINT"
                        )
                        {
                            if (recordsDelGruppo.Count >= 5)
                            {
                                var prezzi = new HashSet<string>();

                                foreach (var record in recordsDelGruppo)
                                {
                                    var prezzoPromo = record.recordInTracciato["prezzo_promo"].ToString();
                                    prezzi.Add(prezzoPromo);
                                }

                                var count = prezzi.Count;

                                // TODO: sostituire con il logger del progetto, se presente
                                Console.WriteLine($"{codGruppo} => conta prezzi: {count}");

                                if (count >= 3)
                                {
                                    etichetteCustom.Add("LINEA??");
                                }
                            }
                        }

                        if (recordsDelGruppo.Count > 1)
                        {
                            var prestazione = recItem["prestazione"].ToString();

                            if (prestazione == "")
                            {
                                etichetteCustom.Add("NO_PRESTAZIONE");
                            }
                        }

                        var etichetteOriginal = recItem["allEtichette"] as List<string>;
                        etichetteCustom.AddRange(etichetteOriginal);
                        recItem["allEtichette"] = etichetteCustom;

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
                    result.errorCode = ErrorCodesFico.ListaAzzerataInEsportazione;
                }


            }
            catch (Exception ex)
            {
                result.errors = ex.ToString();
                Console.WriteLine("Export error generic (liv1): " + ex.ToString());
            }

            //impResult.liste = result;
            //impResult.errors = errors;

            return result;
        }

        public string getAlterazioniTracciatoFromIndd(List<Dictionary<string, object>> gruppo, Dictionary<string, object> articoloIndd)
        {
            throw new NotImplementedException();
        }

        //Funzione privata per semplificare il controllo su ref che uscirebbero come box STD
#warning OGNI VOLTA CHE CAMBIA QUALCOSA NELLA FRAMEWORK CSS RIGUARDO LA SCELTA DEI BOX, è NECESSARIO RIPRENDER IN MANO QUESTA FUNZIONE PERCHè PROBABILMENTE LE REGOLE DEVONO ESSERE AGGIORNATE
        private bool haRequisitiDaBoxSTD(Dictionary<string, object> obj)
        {
            bool result = false;

            string tema = obj["tema"].ToString().ToLower();
            string tipo_evento = obj["tipo_evento"].ToString().ToLower();
            string meccanica = obj["meccanica"].ToString().ToLower();

            result = (!tema.Contains("superprezzi of") &&
                !tema.Contains("jolly") &&
                !tema.Contains("new clienti") &&
                !tema.Contains("new soci") &&
                !tema.Contains("valore clienti") &&
                !tema.Contains("valore soci") &&
                !tema.Contains("promo soci escl") &&
                !tema.Contains("sprint") &&
                !tipo_evento.Contains("fidelity") &&
                !tipo_evento.Contains("soci monoprodott") &&
                meccanica != "MXN");

            return result;
        }

        public string importaTracciato(List<Dictionary<string, object>> tracciato, Dictionary<string, string> formRequest, List<FicoContextField> context, List<FicoContextField> contextPromo, string pathACPV, string pathOrdinamentoLista, string pathMeccaniche, string pathTraduttoreAC)
        {

            ImportResult impResult = new ImportResult();

            JObject o1 = JObject.Parse(File.ReadAllText(pathACPV));
            DbACPV areeDB = o1.ToObject<DbACPV>();

            string label = formRequest["idLabel"];
            //Console.WriteLine($"IMPORT LABEL {label}");

            string guidIdAreaRequest = string.Empty;
            if (formRequest.ContainsKey("guidIdArea"))
                guidIdAreaRequest = formRequest["guidIdArea"];


            string errors = "";
            List<Tracciato> result = new List<Tracciato>();
            try
            {
                Area aItemSearch = null;
                if (guidIdAreaRequest != "")
                {
                    aItemSearch = areeDB.aree.FirstOrDefault(x => x.guidID == guidIdAreaRequest);
                }
                else if (label == "a" || label == "a_tdm")
                {

                    aItemSearch = areeDB.aree.FirstOrDefault(x => x.sigla == "A");
                    //Console.WriteLine($"TROVATO  a || a_tdm -> {aItemSearch != null}");


                    if (aItemSearch == null)
                        throw new Exception("Area A non trovata nel DB");


                }
                else if (label == "a-" || label == "a-_tdm")
                {

                    aItemSearch = areeDB.aree.FirstOrDefault(x => x.sigla == "A-");
                    //Console.WriteLine($"TROVATO  a- || a-_tdm -> {aItemSearch != null}");


                    if (aItemSearch == null)
                        throw new Exception("Area A- non trovata nel DB");
                }
                else if (label == "b" || label == "b_tdm")
                {
                    //Console.WriteLine($"TROVATO  b || b_tdm -> {aItemSearch != null}");

                    aItemSearch = areeDB.aree.FirstOrDefault(x => x.sigla == "B");


                    if (aItemSearch == null)
                        throw new Exception("Area B non trovata nel DB");
                }
                else if (label == "b1" || label == "b1_tdm")
                {


                    aItemSearch = areeDB.aree.FirstOrDefault(x => x.sigla == "B1");
                    //Console.WriteLine($"TROVATO  b1 || b1_tdm -> {aItemSearch!=null}");

                    if (aItemSearch == null)
                        throw new Exception("Area B1 non trovata nel DB");
                }





                List<Area> areaList = new List<Area>();
                List<Canale> canaliList = new List<Canale>();

                if (aItemSearch != null)
                {
                    areaList.Add(aItemSearch);
                }

                //Console.WriteLine($"AREE TROVATE: {areaList.Count}");


                //Prima colleziono i suggerimento interrogando ISTANTA BUSINESS
                List<string> _eans = tracciato.Where(w => w.ContainsKey(GLOBAL_VARIABLES_FICO.keyEanCodice)).Select(s => s[GLOBAL_VARIABLES_FICO.keyEanCodice].ToString()).ToList();
                ISTBusinessSuggerimentiRequest suggerimentiRequest = new ISTBusinessSuggerimentiRequest() { EANS = _eans };
                ISTBusinessSuggerimentiResponse archivioSuggerimenti = new ISTBusinessSuggerimentiResponse();
                if (suggerimentiRequest.EANS.Count > 0)
                {
                    //Faccio la richiesta POST con Bearer
                    HttpClient httpClient = new HttpClient();
                    httpClient.DefaultRequestHeaders.Add("X-API-KEY", "4c5547eac7f632890b1172c33e6c7e76");
                    httpClient.DefaultRequestHeaders.Add("X-API-SECRET", "9af32c4728db61583a18995b56ab646a9c296cbc417255c0");
                    //HttpClient hCli = new HttpClient();
                    //hCli.DefaultRequestHeaders.Add("Authorization", "Bearer " + pubKey);

                    var contentParam = new StringContent(JsonConvert.SerializeObject(suggerimentiRequest), Encoding.UTF8, "application/json");
                    string url = "https://istantabusiness.it/api/gdo/get_descrizioni_byArrayEan.php";
                    var response = httpClient.PostAsync(url, contentParam);
                    //var response = await hCli.PutAsync(url, content);

                    if (response.Result.IsSuccessStatusCode)
                    {

                        var contentResponse = response.Result.Content.ReadAsStringAsync().Result;
                        archivioSuggerimenti = JsonConvert.DeserializeObject<ISTBusinessSuggerimentiResponse>(contentResponse);
                    }
                }


                for (int i = 0; i < tracciato.Count; i++)
                {
                    var dictObj = tracciato[i];
                    string descrDepliant = dictObj["Descrizione_depliant"].ToString().ToLower();
                    string codiceArticolo = dictObj[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString();
                    string tema = dictObj["tema"].ToString();
                    string tipo_evento = dictObj["tipo_evento"].ToString();

                    string format1 = dictObj["format_1"].ToString().ToLower();
                    string format2 = dictObj["format_2"].ToString().ToLower();
                    string formatPdv = dictObj["Format_PdvRif"].ToString().ToLower();

                    if (codiceArticolo == "8162379")
                        "debug".ToString();

                    string descr1DaLista = dictObj[GLOBAL_VARIABLES_FICO.keyDescrizione1].ToString().ToLower();

                    string ean = "";
                    if (dictObj.ContainsKey(GLOBAL_VARIABLES_FICO.keyEanCodice))
                    {
                        ean = dictObj[GLOBAL_VARIABLES_FICO.keyEanCodice].ToString();
                        ISTBusinessSuggerimentiItem suggerimento = archivioSuggerimenti.items.FirstOrDefault(f => f.EAN == ean);
                        if (suggerimento != null)
                        {
                            dictObj[GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizione1] = suggerimento.DESCRIZIONE1;
                            dictObj[GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizione2] = suggerimento.DESCRIZIONE2;
                            dictObj[GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizione3] = suggerimento.DESCRIZIONE3;
                            dictObj[GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizione4] = suggerimento.DESCRIZIONE4;
                        }
                    }

                    if (codiceArticolo == "7509142")
                    {
                        "debug".ToString();
                    }

                    if (descr1DaLista.ContainsWord(new string[] { "expo", "espo", "box" }))
                    {
                        continue;
                    }


                    string codice_settore = dictObj["codice_settore"].ToString();
                    string codice_reparto = dictObj["codice_reparto"].ToString();
                    bool isNoFood = (settori_no_food.Contains(codice_settore) && reparti_no_food.Contains(codice_reparto));


                    //if (label == "soci")
                    if (label.StartsWith("soci"))
                    {
                        //In questo caso l'area viene decisa a un incrocio di informazioni format PDV format1 e format2
                        //Possono anche uscire più di un'area
                        areaList.Clear();

                        if (format1 == "a+" || format1 == "a" || format1 == "sa" || format1 == "sa+" || format1 == "d")
                        {
                            if (new string[] { "a+", "a", "sa", "sa+" }.Contains(formatPdv))
                            {
                                //Ok l'area è SOLO la A
                                aItemSearch = areeDB.aree.FirstOrDefault(x => x.sigla == "A");
                                if (aItemSearch != null)
                                {
                                    areaList.Add(aItemSearch);
                                }
                            }
                        }
                        else if (format1 == "se" || format1 == "b" || format1 == "d")
                        {
                            if (new string[] { "se", "b", "a+", "a", "sa", "sa+" }.Contains(formatPdv))
                            {
                                //Ok l'area è SOLO la A
                                areaList.AddRange(areeDB.aree.Where(x => x.sigla == "A" || x.sigla == "A-").ToList());
                            }

                            if (format2 == "mf" || format2 == "mg" || format2 == "mh" || format2 == "c")
                            {
                                //Ok l'area è SOLO la B
                                areaList.AddRange(areeDB.aree.Where(x => x.sigla == "B").ToList());
                            }

                            if (format2 == "mg" || format2 == "mh" || format2 == "d")
                            {

                                //Ok l'area è SOLO la B1
                                areaList.AddRange(areeDB.aree.Where(x => x.sigla == "B1").ToList());

                            }
                        }

                    }
                    else if (label == "a" || label == "a_tdm" || aItemSearch.sigla == "A")
                    {
                        if (codiceArticolo == "7914044")
                        {
                            "debug".ToString();
                        }

                        if (format1 != "a" && format1 != "a+" && format1 != "sa" && format1 != "sa+" && format1 != "se" && format1 != "b" && format1 != "d")
                        {
                            continue;
                        }
                        else if (format1 != "a" && format1 != "a+")
                        {
                            //if (tema.Contains("EXTRA"))
                            //{
                            //    //Non è un formato valido per 6A di tipo EXTRA
                            //    continue;
                            //}
                        }

                    }
                    else if (label == "a-" || label == "a-_tdm" || aItemSearch.sigla == "A-")
                    {
                        if (format1 != "se" && format1 != "b" && format1 != "d")
                        {
                            //Non è un formato valido per 6A-
                            continue;
                        }
                    }
                    else if (label == "b" || label == "b_tdm" || aItemSearch.sigla == "B")
                    {
                        if (format2 != "mf" && format2 != "mg" && format2 != "mh")// && format2!="c")
                        {
                            //Non è un formato valido per 6B
                            if (format1 != "b" && format1 != "c" && format1 != "d" && format1 != "e" && format1 != "f")
                            {
                                continue;
                            }
                        }

                    }
                    else if (label == "b1" || label == "b1_tdm" || aItemSearch.sigla == "B1")
                    {
                        if (format2 != "mg" && format2 != "mh")// && format2 != "d")
                        {
                            //Non è un formato valido per 6B1
                            if (format1 != "b" && (format1 != "c" && !isNoFood) && format1 != "d" && format1 != "e" && format1 != "f")
                            {
                                continue;
                            }

                        }

                    }



                    dictObj["is_linea"] = "";

                    Canale cItemSearch = null;

                    //if (label=="soci")
                    if (label.StartsWith("soci"))
                    {
                        canaliList.AddRange(areeDB.canali.Where(x => x.sigla == "TDM" || x.sigla == "UFI").ToList());
                    }
                    else if (descrDepliant.Contains("tdm"))
                    {
                        cItemSearch = areeDB.canali.FirstOrDefault(x => x.sigla == "TDM");
                    }
                    else if (descrDepliant.Contains("minicoopfi"))
                    {
                        cItemSearch = areeDB.canali.FirstOrDefault(x => x.sigla == "MiniCoopFi");
                    }
                    else if (descrDepliant.Contains("incoopmini"))
                    {
                        cItemSearch = areeDB.canali.FirstOrDefault(x => x.sigla == "InCoopMini");
                    }
                    else if (descrDepliant.Contains("ufi"))
                    {
                        cItemSearch = areeDB.canali.FirstOrDefault(x => x.sigla == "UFI");
                    }

                    if (cItemSearch != null)
                    {
                        if (!canaliList.Contains(cItemSearch))
                            canaliList.Add(cItemSearch);
                    }

                    foreach (Area aItem in areaList)
                    {
                        foreach (Canale cItem in canaliList)
                        {

                            //Posso elbarorare il record
                            string codice_area = cItem.sigla + aItem.sigla;
                            Tracciato tracciato_item = result.FirstOrDefault(l => (l.Canale + l.Area) == codice_area);
                            if (tracciato_item == null)
                            {
                                Tracciato t_item = new Tracciato();

                                t_item.NomeEsportazione = "";

                                t_item.Area = aItem.sigla;
                                t_item.Canale = cItem.sigla;
                                t_item.guidCanale = cItem.guidID;
                                t_item.guidArea = aItem.guidID;
                                t_item.DataDa = DateTime.Parse(dictObj["inizio_promo"].ToString());
                                t_item.DataA = DateTime.Parse(dictObj["fine_promo"].ToString());
                                t_item.DescrizioneIniziativa = descrDepliant;//Inutile
                                t_item.Iniziativa = "";//Inutile
                                t_item.Tipo = 0;//Inutile

                                result.Add(t_item);

                                tracciato_item = t_item;

                            }


                            if (tracciato_item == null)
                                throw new Exception("Nessun traccaito valido creato");//Non dovremmo mai entrarci



                            //Controllo duplicati
                            var dictExist = tracciato_item.Records.FirstOrDefault(r => r[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString() == codiceArticolo);


                            string upc = dictObj["codice_UPC"].ToString();
                            if (upc.Length == 13)
                            {
                                string uri = $"https://s7g10.scene7.com/is/image/unicoopfirenze/unicoop-dam/{upc.Substring(0, 6)}/{upc.Substring(6, 2)}/{upc.Substring(8, 5)}/principale.jpg?printres=300";
                                dictObj[GLOBAL_VARIABLES_FICO.keyFotoUri] = uri;
                            }

                            decimal txt_sconto = dictObj["txt_sconto"].ToDecimal();
                            decimal prezzo_continuo = dictObj["prezzo_continuo"].ToDecimal();
                            decimal prezzo_promo_kgl = dictObj["prezzo_promo_kgl"].ToDecimal();
                            decimal prezzo_promo = dictObj["prezzo_promo"].ToDecimal();

                            //if (txt_sconto==0)
                            //    Console.WriteLine($">> CASISTICA SCOTNO 0% - {prezzo_continuo} > {prezzo_continuo} meccanica:{meccanica}");
                            if (txt_sconto == 0 && prezzo_continuo > prezzo_promo) //&& meccanica=="prezzo netto % sc"
                            {
                                txt_sconto = ((prezzo_continuo - prezzo_promo) / prezzo_continuo) * 100;
                                dictObj["txt_sconto"] = txt_sconto;
                                //Console.WriteLine($"Applico nuovo sconto {txt_sconto}");
                            }

                            if (tema.Contains("PIU VALORE NEW CLIENTI") || tema.Contains("PIU VALORE CLIENTI"))
                            {
                                //Cacolo prezzo soci
                                decimal sconto_soci = txt_sconto;
                                if (txt_sconto == 20)
                                {
                                    sconto_soci = 40;
                                }
                                else if (txt_sconto == 30)
                                {
                                    sconto_soci = 50;
                                }

                                decimal prezzo_soci = prezzo_promo;
                                decimal prezzo_soci_kgl = prezzo_promo_kgl;

                                if (txt_sconto != sconto_soci)
                                {
                                    prezzo_soci = prezzo_continuo * (sconto_soci / 100);
                                    //Console.WriteLine($"Casistica di calcolo prezzo promo soci kgl derivato da prezzoPromo={prezzo_promo}");
                                    if (prezzo_promo == 0)
                                    {
                                        prezzo_soci_kgl = 0m;
                                    }
                                    else
                                    {
                                        prezzo_soci_kgl = (prezzo_soci * prezzo_promo_kgl) / prezzo_promo;
                                    }
                                }
                                else
                                {
                                    "debug".ToString();
                                }

                                if (codiceArticolo == "2061038")
                                {
                                    "debug".ToString();
                                }

                                //Compiled field
                                dictObj["txt_sconto_soci_doppia"] = sconto_soci;
                                dictObj["prezzo_promo_soci_doppia"] = prezzo_soci;
                                dictObj["prezzo_promo_kgl_soci_doppia"] = prezzo_soci_kgl;

                            }

                            if (dictExist == null)
                            {
                                if (dictObj["tipo_evento"].ToString().Contains("FIDELITY"))
                                {
                                    //Siccome sei un FIDELITY con un codice che vedo per la prima volta
                                    //Allora intanto non mi fido e aspetto che a confermarlo ci sia un PROMO con lo stesso codice
                                    dictObj["tipo_evento"] = "FID WAITING FOR";
                                }

                                //Aggiungo la ref al traccaito
                                tracciato_item.Records.Add(dictObj);
                            }
                            else
                            {
                                if (tema.Contains("PIU VALORE NEW CLIENTI"))
                                {
                                    dictExist["txt_sconto_soci_doppia"] = dictObj["txt_sconto_soci_doppia"];
                                    dictExist["prezzo_promo_soci_doppia"] = dictObj["prezzo_promo_soci_doppia"];
                                    dictExist["prezzo_promo_kgl_soci_doppia"] = dictObj["prezzo_promo_kgl_soci_doppia"];
                                    dictExist["txt_sconto"] = dictObj["txt_sconto"];
                                }
                                else if (tema.Contains("PIU VALORE NEW SOCI") || tema.Contains("PIU VALORE SOCI"))
                                {
                                    //Deve ereditare le brciature
                                    dictExist["N_pezzi_soci"] = dictObj["N_pezzi_soci"];
                                    dictExist["pezzi_soci"] = dictObj["pezzi_soci"];

                                    //Normalizzazione della colonna tema che prende SOCI
                                    dictExist["tema"] = tema;
                                }
                                else if (tipo_evento.Contains("PROMO"))
                                {
                                    ////Significa che l'esistente ha i prezzi socio
                                    string tipo_evento_esistente = dictExist["tipo_evento"].ToString();
                                    if (tipo_evento_esistente.Contains("FID WAITING FOR"))
                                    {
                                        //Perfetto, il FIDELITY ha il suo PROMO. Puo tornare ad essere il tipo_evento FIDELITY
                                        dictExist["tipo_evento"] = "FIDELITY";

                                        decimal prezzo_promo_curr = dictObj["prezzo_promo"].ToDecimal();
                                        decimal prezzo_promo_kgl_curr = dictObj["prezzo_promo_kgl"].ToDecimal();
                                        dictExist["prezzo_promo"] = prezzo_promo_curr;
                                        dictExist["prezzo_promo_kgl"] = prezzo_promo_kgl_curr;
                                        dictExist["prezzo_continuo"] = prezzo_continuo;
                                    }

                                }
                                else if (tipo_evento.Contains("FIDELITY"))
                                {
                                    string tipo_evento_esistente = dictExist["tipo_evento"].ToString();
                                    if (tipo_evento_esistente.Contains("PROMO"))
                                    {
                                        //Ereditiamo da MONOPRODOTTO il prezzo contnuo e il prezzo offerta
                                        dictExist["N_punti"] = dictObj["N_punti"].ToString();
                                    }

                                    if (tipo_evento_esistente.Contains("PROMO"))
                                    {
                                        //il record deve ereditare il tipo_evento fidelity, così si entrerà nel Box Spendi punti
                                        dictExist["tipo_evento"] = "FIDELITY";
                                    }
                                }
                                //else if (tipo_evento.Contains("SOCI MONOPRODOTT"))
                                else if (tipo_evento.StartsWith("SOCI"))
                                {
                                    ////Significa che l'esistente ha i prezzi socio
                                    string tipo_evento_esistente = dictExist["tipo_evento"].ToString();
                                    if (tipo_evento_esistente.Contains("FID WAITING FOR"))
                                    {
                                        //Perfetto, il FIDELITY ha il suo PROMO. Puo tornare ad essere il tipo_evento FIDELITY
                                        dictExist["tipo_evento"] = "FIDELITY";

                                        decimal prezzo_promo_curr = dictObj["prezzo_promo"].ToDecimal();
                                        decimal prezzo_promo_kgl_curr = dictObj["prezzo_promo_kgl"].ToDecimal();
                                        dictExist["prezzo_promo"] = prezzo_promo_curr;
                                        dictExist["prezzo_promo_kgl"] = prezzo_promo_kgl_curr;
                                        dictExist["prezzo_continuo"] = prezzo_continuo;
                                    }

                                }

                            }
                        }
                    }

                }

                //Console.WriteLine("IMPORT -> Analisi lista");

                for (int i = 0; i < result.Count; i++)
                {
                    Tracciato tItem = result[i];

                    //List<FicoContextField> context, List< FicoContextField > contextPromo
                    FicoRuntimeKit kit = new FicoRuntimeKit();
                    kit.context = contextPromo.Concat(context).GroupBy(x => x.nome_field).Select(g => g.Last()).ToList();
                    kit.guidArea = tItem.guidArea;
                    kit.guidCanale = tItem.guidCanale;
                    string siglaAreaKit = areeDB.aree.FirstOrDefault(a => a.guidID == kit.guidArea).sigla;
                    tItem.Records = elaboraTracciatiRecords_do(tItem.Records, kit, siglaAreaKit, true);

                    continue;

                    #region vecchio modo di raggruppare COMMENTATO


                    #endregion commentato

                    Func<Dictionary<string, object>, decimal> getPrezzoPromo =
                        r => r["prezzo_promo"].ToDecimal();

                    Func<List<Dictionary<string, object>>, bool> raggruppa = (sorgente) =>
                    {
                        var gCaratteristiche = sorgente.GroupBy(ecc => new {

                            Tema = ecc["tema"].ToString(),
                            TipoEvento = ecc["tipo_evento"].ToString(),

                        }).Select(s => s.Key).ToList();

                        Byte casistica = 0;

                        foreach (var gCar in gCaratteristiche)
                        {

                            if (gCar.Tema.Contains("PROMO SOCI ESCL") ||
                                gCar.Tema.Contains("NEW CLIENTI") ||
                                gCar.Tema.Contains("VALORE CLIENTI") ||
                                gCar.Tema.Contains("NEW SOCI") ||
                                gCar.Tema.Contains("VALORE SOCI") ||
                                gCar.TipoEvento.Contains("FIDELITY") ||
                                gCar.TipoEvento.Contains("SOCIMONOPRODOTT")
                                )
                            {
                                //Ci sono caratteristiche da soci in questo gruppo.
                                //Isoliamo i soci
                                casistica = 1;

                            }
                            else if (!gCar.Tema.Contains("JOLLY") && !gCar.Tema.Contains("SPRINT"))
                            {
                                //Si tratta di tutto il resto escluso JOLLY e SPRINT
                                casistica = 2;
                            }
                            else
                            {
                                //Jolly e sprint si adeguano al trattamento classico di default
                                casistica = 3;
                            }

                            var _sorgenteFiltrata = sorgente.Where(r => r["tema"].ToString() == gCar.Tema && r["tipo_evento"].ToString() == gCar.TipoEvento).ToList();

                            int groupcount = _sorgenteFiltrata.Count();
                            //Raggruppiamo questo gruppetto per i prezzi promo
                            var _group = _sorgenteFiltrata.GroupBy(g => new
                            {
                                PrezzoPromo = g["prezzo_promo"]
                            }).Select(s => new
                            {
                                PrezzoPromo = s.Key.PrezzoPromo,
                                Articoli = s.Select(ss => ss[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString()).ToList()
                            }
                            );
                            int countVariazionePrezziPromo = _group.Count();

                            bool hasEmpty = _group.Any(p => p.PrezzoPromo.ToDecimal() == 0m);
                            bool hasValued = _group.Any(p => p.PrezzoPromo.ToDecimal() != 0m);

                            bool isFreschissimi = _sorgenteFiltrata.FirstOrDefault()["codice_settore"].ToString() == "58";//"FRESCHISSIMI";
                            bool prestazionati = !(_sorgenteFiltrata.FirstOrDefault()["prestazione"].ToString() == "");

                            string codice_gruppo = String.Join(",", _sorgenteFiltrata.Select(s => s[GLOBAL_VARIABLES_FICO.keyRefCodice]).OrderBy(o => o).ToList());


                            //if (casistica == 3 || (_sorgenteFiltrata.Count >= 5 && casistica != 1))
                            if (!isFreschissimi || prestazionati)
                            {
                                if (casistica == 3 || casistica == 2 || (_sorgenteFiltrata.Count >= 5 && (casistica != 1 || countVariazionePrezziPromo >= 3)))
                                {
                                    //Quindi o siamo sprint jolly
                                    //il gurppo è maggiore o uaugale a 5 e NON è SOCI
                                    //Il gruppo è maggiore o uguale a 5 e non ha variazione sufficiente per essere LINEA
                                    _sorgenteFiltrata.ToList().ForEach(ff2 =>
                                    {
                                        ff2[GLOBAL_VARIABLES_FICO.keyCodiceGruppo] = codice_gruppo;
                                    });
                                    //Forma il gruppo com'è e basta

                                    continue;
                                }




                                if (casistica == 2)
                                {
                                    Console.WriteLine($"CASISTICA 2 {codice_gruppo} - {groupcount} - {countVariazionePrezziPromo} MIN ={_group.Min(m => m.Articoli.Count)}");
                                }

                                if (
                                (casistica == 2 && groupcount == 2 && countVariazionePrezziPromo == 2) ||
                                (casistica == 2 && groupcount == 3 && countVariazionePrezziPromo == 3) ||
                                (casistica == 2 && groupcount == 4 && countVariazionePrezziPromo == 4) ||
                                (casistica == 2 && groupcount == 4 && countVariazionePrezziPromo == 2 && _group.Min(m => m.Articoli.Count) >= 2)
                                )
                                {
                                    Console.WriteLine($"Raggruppo PROMO CLASSIC {codice_gruppo} - {groupcount} - {countVariazionePrezziPromo}");
                                    //ECCEZIONE PPP PER I NO SOCI
                                    //Facciamo uscire etichetta PIU PREZZI e quindi forziamo la formazione del gruppo
                                    _sorgenteFiltrata.ToList().ForEach(ff2 =>
                                    {
                                        ff2[GLOBAL_VARIABLES_FICO.keyCodiceGruppo] = codice_gruppo;
                                    });
                                }
                                else
                                {

                                    //_sorgenteFiltrata.ForEach(f =>
                                    //{

                                    //Solo se c'è almeno 1 prezzo diverso nel gruppo
                                    if (countVariazionePrezziPromo > 1)
                                    {
                                        //Casistiche

                                        //Siamo nella casistica che ci sono più gruppi di prezzo promo
                                        _group.ToList().ForEach(ff =>
                                        {
                                            //Il gurppo si forma se siamo nella casistica SOCI oppure
                                            //nell'altra casistica SOLO se il gruppo lascia fuori u singolo con prezzo diverso
                                            if (ff.Articoli.Count > 1)
                                            {
                                                string codice_gruppo_sub = String.Join(",", ff.Articoli.OrderBy(o => o).ToList());

                                                if (casistica == 2)
                                                {
                                                    Console.WriteLine($"{codice_gruppo_sub} - {groupcount} - {ff.Articoli.Count}");
                                                }
                                                if (casistica == 1 ||
                                                    (casistica == 2 && groupcount == 3 && ff.Articoli.Count == 2) ||
                                                    (casistica == 2 && (groupcount == 4 && ff.Articoli.Count == 3))
                                                )
                                                {
                                                    //Li raggruppo
                                                    if (casistica == 2)
                                                    {
                                                        Console.WriteLine($"Raggruppo -> {codice_gruppo_sub}");
                                                    }

                                                    _sorgenteFiltrata.Where(r => ff.Articoli.Contains(r[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString())).ToList().ForEach(ff2 =>
                                                    {
                                                        ff2[GLOBAL_VARIABLES_FICO.keyCodiceGruppo] = codice_gruppo_sub;
                                                    });
                                                }
                                            }

                                            if (ff.Articoli.Count == 1)
                                            {
                                                var itemSingolo = _sorgenteFiltrata.FirstOrDefault(r => r[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString() == ff.Articoli[0]);
                                                if (casistica == 2)
                                                {
                                                    //Solo nel caso NON SOCI
                                                    if ((groupcount == 3 || groupcount == 4) && countVariazionePrezziPromo == 2)
                                                    {
                                                        //Posso escludere solo SE
                                                        //1. siamo in un gruppo di tre ed essendo che almeno questo che sto analizzando è singolo, se esistono SOLO 2 gruppi di prezzo, l'altro gruppo è formato da 2 elementi
                                                        //2. siamo in un gruppo di 4 ed essendo che almeno questo che sto analizzando è singolo, se esistono SOLO 2 gruppi di prezzo, l'altro gruppo è formato da 3 elementi
                                                        //tItem.Records.Remove(itemSingolo);
                                                        itemSingolo["tema"] = "fuori depliant";
                                                    }
                                                    else
                                                    {
                                                        //Diventa singolo
                                                        itemSingolo[GLOBAL_VARIABLES_FICO.keyCodiceGruppo] = itemSingolo[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString();
                                                    }
                                                }
                                                else
                                                {
                                                    //In questo caso i singoli prezzi diventano singole ref
                                                    itemSingolo[GLOBAL_VARIABLES_FICO.keyCodiceGruppo] = itemSingolo[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString();
                                                }

                                            }

                                        });
                                    }
                                    else
                                    {
                                        //Non ci sono variazioni di prezzo, il gruppo si forma regolarmente
                                        _sorgenteFiltrata.ToList().ForEach(ff2 =>
                                        {
                                            ff2[GLOBAL_VARIABLES_FICO.keyCodiceGruppo] = codice_gruppo;
                                        });
                                    }



                                    //});
                                }
                            }
                            else
                            {
                                //Qui trattiamo i gruppi freschissimi NON prestazionati
                                if (groupcount == 2)
                                {
                                    if (countVariazionePrezziPromo <= 1)
                                    {
                                        // stesso prezzo → gruppo regolare
                                        string _codice_gruppo = String.Join(",",
                                            _sorgenteFiltrata
                                                .Select(s => s[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString())
                                                .OrderBy(o => o)
                                        );

                                        _sorgenteFiltrata.ForEach(f =>
                                        {
                                            f[GLOBAL_VARIABLES_FICO.keyCodiceGruppo] = _codice_gruppo;
                                        });
                                    }
                                    else
                                    {
                                        if (hasEmpty && hasValued)
                                        {
                                            // uno dei prezzi è vuoto → gruppo regolare
                                            string _codice_gruppo = String.Join(",",
                                                _sorgenteFiltrata
                                                    .Select(s => s[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString())
                                                    .OrderBy(o => o)
                                            );

                                            _sorgenteFiltrata.ForEach(f =>
                                            {
                                                f[GLOBAL_VARIABLES_FICO.keyCodiceGruppo] = _codice_gruppo;
                                            });
                                        }
                                        else
                                        {
                                            // prezzi diversi e tutti valorizzati → due singoli
                                            _sorgenteFiltrata.ForEach(f =>
                                            {
                                                f[GLOBAL_VARIABLES_FICO.keyCodiceGruppo] =
                                                    f[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString();
                                            });
                                        }
                                    }

                                    continue;
                                }

                                // 2) Gruppi da 3 o 4 referenze
                                if (groupcount == 3 || groupcount == 4)
                                {
                                    if (countVariazionePrezziPromo <= 1)
                                    {
                                        // tutti stesso prezzo → gruppo unico
                                        string _codice_gruppo = String.Join(",",
                                            _sorgenteFiltrata
                                                .Select(s => s[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString())
                                                .OrderBy(o => o)
                                        );

                                        _sorgenteFiltrata.ForEach(f =>
                                        {
                                            f[GLOBAL_VARIABLES_FICO.keyCodiceGruppo] = _codice_gruppo;
                                        });
                                    }
                                    else
                                    {

                                        // prezzi diversi → sottogruppi per codice_categoria


                                        var gruppiPerCategoria = _sorgenteFiltrata
                                            .GroupBy(r => r["codice_categoria"].ToString());//.Select(s=>s.Key).ToList();

                                        Console.WriteLine("HO APPENA FINITO DI SOTTO-GRUPPARE PER CODICE CATEGORIA");

                                        foreach (var cat in gruppiPerCategoria)
                                        {

                                            var listaCat = cat.ToList();
                                            Console.WriteLine(listaCat);
                                            if (listaCat.Count == 1)
                                            {
                                                // singolo → resta singolo
                                                var rec = listaCat[0];
                                                rec[GLOBAL_VARIABLES_FICO.keyCodiceGruppo] =
                                                    rec[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString();
                                                continue;
                                            }

                                            var prezziCat = listaCat.Select(getPrezzoPromo).ToList();
                                            bool diversiCat = prezziCat.Distinct().Count() > 1;
                                            bool hasEmptyCat = prezziCat.Any(p => p == 0m);
                                            bool hasValuedCat = prezziCat.Any(p => p != 0m);

                                            if (!diversiCat || (diversiCat && hasEmptyCat && hasValuedCat))
                                            {
                                                // ➜ gruppo di segmento si forma regolarmente
                                                string codice_gruppo_cat = String.Join(",",
                                                    listaCat
                                                        .Select(s => s[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString())
                                                        .OrderBy(o => o)
                                                );

                                                listaCat.ForEach(f =>
                                                {
                                                    f[GLOBAL_VARIABLES_FICO.keyCodiceGruppo] = codice_gruppo_cat;
                                                });
                                            }
                                            else
                                            {
                                                // ➜ prezzi diversi tutti valorizzati → sottogruppi per prezzo
                                                var gruppiPerPrezzo = listaCat
                                                    .GroupBy(r => getPrezzoPromo(r));

                                                foreach (var gPrezzo in gruppiPerPrezzo)
                                                {
                                                    var listaPrezzo = gPrezzo.ToList();

                                                    if (listaPrezzo.Count == 1)
                                                    {
                                                        var rec = listaPrezzo[0];
                                                        rec[GLOBAL_VARIABLES_FICO.keyCodiceGruppo] =
                                                            rec[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString();
                                                    }
                                                    else
                                                    {
                                                        string codice_gruppo_prezzo = String.Join(",",
                                                            listaPrezzo
                                                                .Select(s => s[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString())
                                                                .OrderBy(o => o)
                                                        );

                                                        listaPrezzo.ForEach(f =>
                                                        {
                                                            f[GLOBAL_VARIABLES_FICO.keyCodiceGruppo] = codice_gruppo_prezzo;
                                                        });
                                                    }
                                                }
                                            }
                                        }
                                    }

                                    continue;
                                }
                            }

                        }


                        return true;
                    };


                    List<Dictionary<string, object>> recCoinvoltiInUnGruppo = tItem.Records.Where(r => !r.ContainsKey(GLOBAL_VARIABLES_FICO.keyCodiceGruppo) && r["prestazione"].ToString() != "").ToList();

                    var raggruppamentoPrincipale = tItem.Records.Where(r => !r.ContainsKey(GLOBAL_VARIABLES_FICO.keyCodiceGruppo)).GroupBy(g => new
                    {
                        CodiceSettore = g["codice_settore"].ToString(),
                        Marchio = g[GLOBAL_VARIABLES_FICO.keyDescrizione2].ToString()//,
                        //Sottomarchio = g["sottomarchio"].ToString()
                    }).Select(s => s.Key).ToList();


                    //Trattiamo prima tutte le prestazioni
                    List<string> gruppo_prestazione = recCoinvoltiInUnGruppo.GroupBy(g => g["prestazione"].ToString()).Select(s => s.Key).ToList();

                    foreach (string prestazione in gruppo_prestazione)
                    {
                        List<Dictionary<string, object>> listaConStessaPrestazione = recCoinvoltiInUnGruppo.Where(gi => gi["prestazione"].ToString() == prestazione).ToList();
                        //Vediamo ora di raggrupparli per codice marketing, marchio e sottomarchio

                        if (prestazione == "1")
                        {
                            //Debug
                            "debug".ToString();
                        }

                        foreach (var gruppo in raggruppamentoPrincipale)
                        {

                            //Aggiungo le righe del gruppo
                            List<Dictionary<string, object>> gruppoFormato = listaConStessaPrestazione.Where(gi =>
                            gi["codice_settore"].ToString() == gruppo.CodiceSettore &&
                            gi[GLOBAL_VARIABLES_FICO.keyDescrizione2].ToString() == gruppo.Marchio// &&
                            //gi["sottomarchio"].ToString() == gruppo.Sottomarchio
                            ).ToList();

                            if (gruppoFormato.Count > 1)
                            {
                                raggruppa(gruppoFormato);

                                //Metodo classico
                                //string codice_gruppo = String.Join(",", gruppoFormato.Select(s => s[GLOBAL_VARIABLES_FICO.keyRefCodice]).OrderBy(o => o).ToList());
                                //gruppoFormato.ForEach(f => f[GLOBAL_VARIABLES_FICO.keyCodiceGruppo] = codice_gruppo);
                            }
                        }
                    }

                    //Trattiamo ora tutti i record che non hanno prestazione
                    //Approfondendo il raggruppamento e quindi integrando anche cod reparto, sottocategoria
                    List<Dictionary<string, object>> listaSenzaPrestazione = tItem.Records
                        .Where(g => !g.ContainsKey(GLOBAL_VARIABLES_FICO.keyCodiceGruppo) && g["prestazione"].ToString() == "")
                        .ToList();

                    foreach (var gruppo in raggruppamentoPrincipale)
                    {
                        //Aggiungo le righe del gruppo
                        var sottoClassificatore = listaSenzaPrestazione
                            .Where(gi =>
                                gi["codice_settore"].ToString() == gruppo.CodiceSettore &&
                                gi[GLOBAL_VARIABLES_FICO.keyDescrizione2].ToString() == gruppo.Marchio
                            )
                            .GroupBy(g => new
                            {
                                CodiceSettore = g["codice_settore"].ToString(),
                                Marchio = g[GLOBAL_VARIABLES_FICO.keyDescrizione2].ToString(),
                                Sottomarchio = g["sottomarchio"].ToString(),
                                CodiceReparto = g["codice_reparto"].ToString()
                            })
                            .Select(s => s.Key)
                            .ToList();

                        foreach (var sottogruppo in sottoClassificatore)
                        {

                            List<Dictionary<string, object>> gruppoFormato = listaSenzaPrestazione.Where(g =>
                                g["codice_settore"].ToString() == sottogruppo.CodiceSettore &&
                                g[GLOBAL_VARIABLES_FICO.keyDescrizione2].ToString() == sottogruppo.Marchio &&
                                g["sottomarchio"].ToString() == sottogruppo.Sottomarchio &&
                                g["codice_reparto"].ToString() == sottogruppo.CodiceReparto
                            ).ToList();

                            if (gruppoFormato.Count <= 1)
                                continue;



                            // regole speciali solo per settore FRESCHISSIMI
                            bool isFreschissimi = gruppo.CodiceSettore == "58";//"FRESCHISSIMI";

                            if (!isFreschissimi)
                            {
                                // settore diverso → mantieni logica standard
                                raggruppa(gruppoFormato);
                                continue;
                            }


                            //Console.WriteLine("=== FRESCHISSIMI gruppoFormato ===");
                            //foreach (var r in gruppoFormato)
                            //{
                            //    Console.WriteLine(
                            //        $"art {r[GLOBAL_VARIABLES_FICO.keyRefCodice]} | " +
                            //        $"settore {r["codice_settore"]} | " +
                            //        $"reparto {r["codice_reparto"]} | " +
                            //        $"categoria {r["codice_categoria"]} | " +
                            //        $"prezzo {r["prezzo_promo"]}"
                            //    );
                            //}


                            raggruppa(gruppoFormato);
                        }
                    }


                    //Analizzo ogni gruppo formato e decido se è una linea oppure no
                    List<string> gruppiFormati = tItem.Records.Where(g => g.ContainsKey(GLOBAL_VARIABLES_FICO.keyCodiceGruppo) && g[GLOBAL_VARIABLES_FICO.keyCodiceGruppo].ToString() != g[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString()).Select(s => s[GLOBAL_VARIABLES_FICO.keyCodiceGruppo].ToString()).ToList();
                    foreach (string codGruppo in gruppiFormati)
                    {

                        var elementiGruppo = tItem.Records.Where(g => g.ContainsKey(GLOBAL_VARIABLES_FICO.keyCodiceGruppo) && g[GLOBAL_VARIABLES_FICO.keyCodiceGruppo].ToString() == codGruppo).ToList();
                        if (elementiGruppo.Count >= 5)
                        {
                            //Conteggio raggruppamento prezzi
                            if (elementiGruppo.GroupBy(g => g["prezzo_promo"].ToDecimal()).Count() > 2)
                            {
                                //Controlliamo anche che nessuno degli elmenti abbia JOLLY o SPRINT nel tema
                                if (elementiGruppo.Where(w => w["tema"].ToString().ToUpper().Contains("JOLLY") || w["tema"].ToString().ToUpper().Contains("SPRINT")).Count() == 0)
                                {
                                    //E' un linea
                                    elementiGruppo.ForEach(f => f["is_linea"] = "x");
                                }
                            }
                        }
                    }

                }
            }
            catch (Exception ex)
            {
                errors += ex.Message + "\n";
            }

            impResult.liste = result;
            impResult.errors = errors;
            return JsonConvert.SerializeObject(impResult);
        }

        public List<Dictionary<string, object>> elaboraTracciatiRecords(List<Dictionary<string, object>> records, FicoRuntimeKit kit, string pathACPV)
        {
            JObject o1 = JObject.Parse(File.ReadAllText(pathACPV));
            DbACPV areeDB = o1.ToObject<DbACPV>();
            Area aItem = areeDB.aree.Where(a => a.guidID == kit.guidArea).FirstOrDefault();
            return elaboraTracciatiRecords_do(records, kit, aItem.sigla);
        }

        public List<Dictionary<string, object>> elaboraTracciatiRecords_do(List<Dictionary<string, object>> records, FicoRuntimeKit kit, string siglaAreaKit = "", bool suggerimentoAIPerDescrizioneGruppo=false)

        {
            bool testMode = false;
            Func<Dictionary<string, object>, decimal> getPrezzoPromo =
                        r => r["prezzo_promo"].ToDecimal();

            Func<List<Dictionary<string, object>>, bool> raggruppa = (sorgente) =>
            {
                var gCaratteristiche = sorgente.GroupBy(ecc => new {

                    Tema = ecc["tema"].ToString(),
                    TipoEvento = ecc["tipo_evento"].ToString(),

                }).Select(s => s.Key).ToList();

                Byte casistica = 0;

                foreach (var gCar in gCaratteristiche)
                {

                    if (gCar.Tema.Contains("PROMO SOCI ESCL") ||
                        gCar.Tema.Contains("NEW CLIENTI") ||
                        gCar.Tema.Contains("VALORE CLIENTI") ||
                        gCar.Tema.Contains("NEW SOCI") ||
                        gCar.Tema.Contains("VALORE SOCI") ||
                        gCar.TipoEvento.Contains("FIDELITY") ||
                        gCar.TipoEvento.Contains("SOCIMONOPRODOTT")
                        )
                    {
                        //Ci sono caratteristiche da soci in questo gruppo.
                        //Isoliamo i soci
                        casistica = 1;

                    }
                    else if (!gCar.Tema.Contains("JOLLY") && !gCar.Tema.Contains("SPRINT"))
                    {
                        //Si tratta di tutto il resto escluso JOLLY e SPRINT
                        casistica = 2;
                    }
                    else
                    {
                        //Jolly e sprint si adeguano al trattamento classico di default
                        casistica = 3;
                    }



                    var _sorgenteFiltrata = sorgente.Where(r => r["tema"].ToString() == gCar.Tema && r["tipo_evento"].ToString() == gCar.TipoEvento).ToList();

                    int groupcount = _sorgenteFiltrata.Count();
                    //Raggruppiamo questo gruppetto per i prezzi promo
                    var _group = _sorgenteFiltrata.GroupBy(g => new
                    {
                        PrezzoPromo = g["prezzo_promo"]
                    }).Select(s => new
                    {
                        PrezzoPromo = s.Key.PrezzoPromo,
                        Articoli = s.Select(ss => ss[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString()).ToList()
                    }
                    );


                    int countVariazionePrezziPromo = _group.Count();
                    if (testMode)
                    {
                        //Console.WriteLine(">>>>>>>>>>>>> GROUP COUNT " + groupcount);
                        //Console.WriteLine(">>>>>>>>>>>>> GROUP PREZZI COUNT " + countVariazionePrezziPromo);                        

                        //foreach (var item in _group)
                        //{
                        //    //Console.WriteLine(">>>>>>>>>>>>> PREZZO PROMO " + item.PrezzoPromo + " - ARTICOLI: " + String.Join(",", item.Articoli));
                        //}
                    }

                    bool hasEmpty = _group.Any(p => p.PrezzoPromo.ToDecimal() == 0m);
                    bool hasValued = _group.Any(p => p.PrezzoPromo.ToDecimal() != 0m);

                    bool isFreschissimi = _sorgenteFiltrata.FirstOrDefault()["codice_settore"].ToString() == "58";//"FRESCHISSIMI";
                    bool prestazionati = !(_sorgenteFiltrata.FirstOrDefault()["prestazione"].ToString() == "");

                    string codice_gruppo = String.Join(",", _sorgenteFiltrata.Select(s => s[GLOBAL_VARIABLES_FICO.keyRefCodice]).OrderBy(o => o).ToList());

                    if (testMode)
                    {
                        //Console.WriteLine("Finalizzazione: " + codice_gruppo);
                        //Console.WriteLine("is freschissimi? " + isFreschissimi + " prestazionato? " + prestazionati);
                    }
                    //if (casistica == 3 || (_sorgenteFiltrata.Count >= 5 && casistica != 1))


                    if (!isFreschissimi || prestazionati)
                    {
                        if (casistica == 3 || casistica == 2 || (_sorgenteFiltrata.Count >= 5 && (casistica != 1 || countVariazionePrezziPromo >= 3)))
                        {
                            //Quindi o siamo sprint jolly
                            //il gurppo è maggiore o uaugale a 5 e NON è SOCI
                            //Il gruppo è maggiore o uguale a 5 e non ha variazione sufficiente per essere LINEA
                            _sorgenteFiltrata.ToList().ForEach(ff2 =>
                            {
                                if (testMode)
                                    Console.WriteLine(">>>>>>>>>>>>> SI FORMA IL GRUPPO CON " + codice_gruppo);

                                ff2[GLOBAL_VARIABLES_FICO.keyCodiceGruppo] = codice_gruppo;
                                ff2[GLOBAL_VARIABLES_FICO.keySottoGruppo] = codice_gruppo;
                            });
                            //Forma il gruppo com'è e basta

                            continue;
                        }




                        if (testMode && casistica == 2)
                        {
                            //Console.WriteLine($"CASISTICA 2 {codice_gruppo} - {groupcount} - {countVariazionePrezziPromo} MIN ={_group.Min(m => m.Articoli.Count)}");
                        }

                        if (
                        (casistica == 2 && groupcount == 2 && countVariazionePrezziPromo == 2) ||
                        (casistica == 2 && groupcount == 3 && countVariazionePrezziPromo == 3) ||
                        (casistica == 2 && groupcount == 4 && countVariazionePrezziPromo == 4) ||
                        (casistica == 2 && groupcount == 4 && countVariazionePrezziPromo == 2 && _group.Min(m => m.Articoli.Count) >= 2)
                        )
                        {
                            //Console.WriteLine($"Raggruppo PROMO CLASSIC {codice_gruppo} - {groupcount} - {countVariazionePrezziPromo}");
                            //ECCEZIONE PPP PER I NO SOCI
                            //Facciamo uscire etichetta PIU PREZZI e quindi forziamo la formazione del gruppo
                            _sorgenteFiltrata.ToList().ForEach(ff2 =>
                            {
                                if (testMode)
                                    Console.WriteLine(">>>>>>>>>>>>> CASISTICA 2 SI FORMA IL GRUPPO CON " + codice_gruppo);

                                ff2[GLOBAL_VARIABLES_FICO.keyCodiceGruppo] = codice_gruppo;
                                ff2[GLOBAL_VARIABLES_FICO.keySottoGruppo] = codice_gruppo;
                            });
                        }
                        else
                        {

                            //_sorgenteFiltrata.ForEach(f =>
                            //{

                            //Solo se c'è almeno 1 prezzo diverso nel gruppo
                            if (countVariazionePrezziPromo > 1)
                            {
                                //Casistiche
                                if (testMode)
                                    Console.WriteLine(">>>>>>>>>>>>> PIU PREZZI PROMO");

                                //Siamo nella casistica che ci sono più gruppi di prezzo promo
                                _group.ToList().ForEach(ff =>
                                {
                                    //Il gurppo si forma se siamo nella casistica SOCI oppure
                                    //nell'altra casistica SOLO se il gruppo lascia fuori u singolo con prezzo diverso
                                    if (ff.Articoli.Count > 1)
                                    {
                                        string codice_gruppo_sub = String.Join(",", ff.Articoli.OrderBy(o => o).ToList());

                                        if (testMode && casistica == 2)
                                        {
                                            Console.WriteLine($"{codice_gruppo_sub} - {groupcount} - {ff.Articoli.Count}");
                                        }
                                        if (casistica == 1 ||
                                            (casistica == 2 && groupcount == 3 && ff.Articoli.Count == 2) ||
                                            (casistica == 2 && (groupcount == 4 && ff.Articoli.Count == 3))
                                        )
                                        {
                                            //Li raggruppo
                                            if (testMode && casistica == 2)
                                            {
                                                Console.WriteLine($"Raggruppo -> {codice_gruppo_sub}");
                                            }

                                            _sorgenteFiltrata.Where(r => ff.Articoli.Contains(r[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString())).ToList().ForEach(ff2 =>
                                            {
                                                ff2[GLOBAL_VARIABLES_FICO.keyCodiceGruppo] = codice_gruppo_sub;
                                                ff2[GLOBAL_VARIABLES_FICO.keySottoGruppo] = codice_gruppo_sub;
                                            });
                                        }
                                    }

                                    if (ff.Articoli.Count == 1)
                                    {
                                        if (testMode)
                                            Console.WriteLine(">>>>>>>>>>>>> SINGOLO ARTICOLO");

                                        var itemSingolo = _sorgenteFiltrata.FirstOrDefault(r => r[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString() == ff.Articoli[0]);
                                        if (casistica == 2)
                                        {
                                            //Solo nel caso NON SOCI
                                            if ((groupcount == 3 || groupcount == 4) && countVariazionePrezziPromo == 2)
                                            {
                                                //Posso escludere solo SE
                                                //1. siamo in un gruppo di tre ed essendo che almeno questo che sto analizzando è singolo, se esistono SOLO 2 gruppi di prezzo, l'altro gruppo è formato da 2 elementi
                                                //2. siamo in un gruppo di 4 ed essendo che almeno questo che sto analizzando è singolo, se esistono SOLO 2 gruppi di prezzo, l'altro gruppo è formato da 3 elementi
                                                //tItem.Records.Remove(itemSingolo);
                                                itemSingolo["tema"] = "fuori depliant";
                                                if (testMode)
                                                    Console.WriteLine(">>>>>>>>>>>>> FUORI DEPLIANT");
                                            }
                                            else
                                            {
                                                //Diventa singolo
                                                itemSingolo[GLOBAL_VARIABLES_FICO.keyCodiceGruppo] = itemSingolo[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString();
                                                if (testMode)
                                                    Console.WriteLine(">>>>>>>>>>>>> DIVENTA SINGOLO");
                                            }
                                        }
                                        else
                                        {
                                            //In questo caso i singoli prezzi diventano singole ref
                                            itemSingolo[GLOBAL_VARIABLES_FICO.keyCodiceGruppo] = itemSingolo[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString();
                                            if (testMode)
                                                Console.WriteLine(">>>>>>>>>>>>> DIVENTA SINGOLO--2");
                                        }

                                    }

                                });
                            }
                            else
                            {
                                //Non ci sono variazioni di prezzo, il gruppo si forma regolarmente
                                if (testMode)
                                    Console.WriteLine(">>>>>>>>>>>>> NESSUNA VARIAZIONE STRANA IL GRUPPO SI FORMA REGOLARE " + codice_gruppo);

                                _sorgenteFiltrata.ToList().ForEach(ff2 =>
                                {
                                    ff2[GLOBAL_VARIABLES_FICO.keyCodiceGruppo] = codice_gruppo;
                                    ff2[GLOBAL_VARIABLES_FICO.keySottoGruppo] = codice_gruppo;
                                });
                            }



                            //});
                        }
                    }
                    else
                    {
                        if (testMode)
                        {
                            Console.WriteLine("Siamo qui " + siglaAreaKit);
                        }
                        //Qui trattiamo i gruppi freschissimi NON prestazionati
                        if (groupcount == 2)
                        {
                            if (testMode)
                                Console.WriteLine(">>>>>>>>>>>>> FRESCHISSIMI COMPOSTI DA 2");

                            if (countVariazionePrezziPromo <= 1)
                            {
                                if (testMode)
                                    Console.WriteLine(">>>>>>>>>>>>> STESSO PREZZO FORMO IL GURPPO");
                                // stesso prezzo → gruppo regolare
                                string _codice_gruppo = String.Join(",",
                                    _sorgenteFiltrata
                                        .Select(s => s[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString())
                                        .OrderBy(o => o)
                                );

                                _sorgenteFiltrata.ForEach(f =>
                                {
                                    f[GLOBAL_VARIABLES_FICO.keyCodiceGruppo] = _codice_gruppo;
                                    f[GLOBAL_VARIABLES_FICO.keySottoGruppo] = _codice_gruppo;
                                });
                            }
                            else
                            {
                                if (hasEmpty && hasValued)
                                {
                                    if (testMode)
                                        Console.WriteLine(">>>>>>>>>>>>> ALMENO UNO HA UN PREZZO E ALMENO UNO HA UN VALORE");

                                    // uno dei prezzi è vuoto → gruppo regolare
                                    string _codice_gruppo = String.Join(",",
                                        _sorgenteFiltrata
                                            .Select(s => s[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString())
                                            .OrderBy(o => o)
                                    );

                                    _sorgenteFiltrata.ForEach(f =>
                                    {
                                        f[GLOBAL_VARIABLES_FICO.keyCodiceGruppo] = _codice_gruppo;
                                        f[GLOBAL_VARIABLES_FICO.keySottoGruppo] = _codice_gruppo;
                                    });
                                }
                                else
                                {
                                    if (testMode)
                                        Console.WriteLine(">>>>>>>>>>>>> HANNO PREZZI DIVERSI");

#warning DA CAPIRE COME TRATTARE QUESTA CASISTICA NEL PIANO A

                                    // prezzi diversi e tutti valorizzati → due singoli
                                    _sorgenteFiltrata.ForEach(f =>
                                    {
                                        f[GLOBAL_VARIABLES_FICO.keyCodiceGruppo] =
                                            f[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString();
                                    });
                                }
                            }

                            continue;
                        }

                        // 2) Gruppi da 3 o 4 referenze
                        if (groupcount == 3 || groupcount == 4)
                        {
                            if (countVariazionePrezziPromo <= 1)
                            {
                                if (testMode)
                                    Console.WriteLine(">>>>>>>>>>>>> (" + groupcount + ") TUTTI STESSO PREZZO, FORMO GRUPPO");

                                // tutti stesso prezzo → gruppo unico
                                string _codice_gruppo = String.Join(",",
                                    _sorgenteFiltrata
                                        .Select(s => s[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString())
                                        .OrderBy(o => o)
                                );

                                _sorgenteFiltrata.ForEach(f =>
                                {
                                    f[GLOBAL_VARIABLES_FICO.keyCodiceGruppo] = _codice_gruppo;
                                    f[GLOBAL_VARIABLES_FICO.keySottoGruppo] = _codice_gruppo;
                                });
                            }
                            else
                            {

                                // prezzi diversi → sottogruppi per codice_categoria
                                if (testMode)
                                    Console.WriteLine(">>>>>>>>>>>>> (" + groupcount + ") PREZZI DIVCERSI");

                                var gruppiPerCategoria = _sorgenteFiltrata
                                    .GroupBy(r => r["codice_categoria"].ToString());//.Select(s=>s.Key).ToList();


                                foreach (var cat in gruppiPerCategoria)
                                {

                                    var listaCat = cat.ToList();

                                    if (testMode)
                                        Console.WriteLine(">>>>>>>>>>>>> LISTA CAT COUNT=" + listaCat.Count);

                                    //Console.WriteLine(listaCat);

                                    if (listaCat.Count == 1)
                                    {
                                        // singolo → resta singolo
                                        var rec = listaCat[0];
                                        if (testMode)
                                            Console.WriteLine(">>>>>>>>>>>>> LISTA CAT REF=" + rec[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString());
                                        rec[GLOBAL_VARIABLES_FICO.keyCodiceGruppo] =
                                            rec[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString();
                                        continue;
                                    }

                                    var prezziCat = listaCat.Select(getPrezzoPromo).ToList();
                                    bool diversiCat = prezziCat.Distinct().Count() > 1;
                                    bool hasEmptyCat = prezziCat.Any(p => p == 0m);
                                    bool hasValuedCat = prezziCat.Any(p => p != 0m);

                                    if (!diversiCat || (diversiCat && hasEmptyCat && hasValuedCat))
                                    {
                                        // ➜ gruppo di segmento si forma regolarmente
                                        string codice_gruppo_cat = String.Join(",",
                                            listaCat
                                                .Select(s => s[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString())
                                                .OrderBy(o => o)
                                        );


                                        if (testMode)
                                            Console.WriteLine(">>>>>>>>>>>>> CODICE GRUPPO CAT=" + codice_gruppo_cat);

                                        listaCat.ForEach(f =>
                                        {
                                            f[GLOBAL_VARIABLES_FICO.keyCodiceGruppo] = codice_gruppo_cat;
                                            f[GLOBAL_VARIABLES_FICO.keySottoGruppo] = codice_gruppo_cat;
                                        });
                                    }
                                    else
                                    {
                                        // ➜ prezzi diversi tutti valorizzati → sottogruppi per prezzo
                                        var gruppiPerPrezzo = listaCat
                                            .GroupBy(r => getPrezzoPromo(r));

                                        foreach (var gPrezzo in gruppiPerPrezzo)
                                        {
                                            var listaPrezzo = gPrezzo.ToList();

                                            if (listaPrezzo.Count == 1)
                                            {
                                                var rec = listaPrezzo[0];

                                                if (testMode)
                                                    Console.WriteLine(">>>>>>>>>>>>> LISTA PREZZ COUNT 1=" + rec[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString());

                                                rec[GLOBAL_VARIABLES_FICO.keyCodiceGruppo] =
                                                    rec[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString();
                                            }
                                            else
                                            {
                                                string codice_gruppo_prezzo = String.Join(",",
                                                    listaPrezzo
                                                        .Select(s => s[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString())
                                                        .OrderBy(o => o)
                                                );

                                                if (testMode)
                                                    Console.WriteLine(">>>>>>>>>>>>> COD GRUPPO PREZZO " + codice_gruppo_prezzo);

                                                listaPrezzo.ForEach(f =>
                                                {
                                                    f[GLOBAL_VARIABLES_FICO.keyCodiceGruppo] = codice_gruppo_prezzo;
                                                    f[GLOBAL_VARIABLES_FICO.keySottoGruppo] = codice_gruppo_prezzo;
                                                });
                                            }
                                        }
                                    }
                                }
                            }

                            continue;
                        }
                        else
                        {
                            if (testMode)
                            {
                                Console.WriteLine("Siamo qui");
                            }

                            if (siglaAreaKit == "A")
                            {
                                foreach (var ggg in _group)
                                {
                                    string cod_ggg = String.Join(",", ggg.Articoli);
                                    if (testMode)
                                    {
                                        Console.WriteLine(">>>> " + cod_ggg);
                                    }

                                    if (ggg.Articoli.Count > 1)
                                    {
                                        //Formo il gruppo

                                        if (testMode)
                                            Console.WriteLine(">>>>>>>>>>>>> FORMO GRUPPO " + cod_ggg);

                                        ggg.Articoli.ForEach(art =>
                                        {
                                            var rec = _sorgenteFiltrata.FirstOrDefault(r => r[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString() == art);
                                            rec[GLOBAL_VARIABLES_FICO.keyCodiceGruppo] = cod_ggg;
                                            rec[GLOBAL_VARIABLES_FICO.keySottoGruppo] = cod_ggg;
                                        });

                                    }
                                }
                            }
                        }

                    }

                }


                return true;
            };

            //Mi assicuro che le linee vengono azzeerate prima di elaborare
            records.ForEach(f => f["is_linea"] = "");

            var recTest = records.FirstOrDefault(r => r[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString() == "8162379");

            List<Dictionary<string, object>> recCoinvoltiInUnGruppo = records.Where(r => !r.ContainsKey(GLOBAL_VARIABLES_FICO.keyCodiceGruppo) && r["prestazione"].ToString() != "").ToList();

            var raggruppamentoPrincipale = records.Where(r => !r.ContainsKey(GLOBAL_VARIABLES_FICO.keyCodiceGruppo)).GroupBy(g => new
            {
                CodiceSettore = g["codice_settore"].ToString(),
                Marchio = g[GLOBAL_VARIABLES_FICO.keyDescrizione2].ToString()//,
                                                                             //Sottomarchio = g["sottomarchio"].ToString()
            }).Select(s => s.Key).ToList();


            var recDictTester = records.Where(r => r[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString() == "2828540");

            //Trattiamo prima tutte le prestazioni
            List<string> gruppo_prestazione = recCoinvoltiInUnGruppo.GroupBy(g => g["prestazione"].ToString()).Select(s => s.Key).ToList();


            foreach (string prestazione in gruppo_prestazione)
            {
                List<Dictionary<string, object>> listaConStessaPrestazione = recCoinvoltiInUnGruppo.Where(gi => gi["prestazione"].ToString() == prestazione).ToList();
                //Vediamo ora di raggrupparli per codice marketing, marchio e sottomarchio

                //Se questa lista è NOFOOD vanno uleriormente scremati per settore, reparto
                List<Dictionary<string, object>> listaNofoodConStessaPrestazione = listaConStessaPrestazione.Where(gi =>
                settori_no_food.Contains(gi["codice_settore"].ToString()) &&
                reparti_no_food.Contains(gi["codice_reparto"].ToString())
                ).ToList();

                if (listaNofoodConStessaPrestazione.Count > 0)
                {
                    //Tolgo questi item da listaConStessaPrestazione
                    listaConStessaPrestazione = listaConStessaPrestazione.Except(listaNofoodConStessaPrestazione).ToList();

                    //e ora elaboro i nofood
                    var classificazioneNoFood = listaNofoodConStessaPrestazione.GroupBy(g => new
                    {
                        CodiceSettore = g["codice_settore"].ToString(),
                        CodiceReparto = g["codice_reparto"].ToString()
                    }).Select(s => s.Key).ToList();



                    foreach (var gruppoClass in classificazioneNoFood)
                    {

                        List<Dictionary<string, object>> gruppoFormato = listaNofoodConStessaPrestazione.Where(gi =>
                            gi["codice_settore"].ToString() == gruppoClass.CodiceSettore &&
                            gi["codice_reparto"].ToString() == gruppoClass.CodiceReparto
                            ).ToList();

                        if (gruppoFormato.Count > 1)
                        {
                            raggruppa(gruppoFormato);
                        }
                    }


                }

                if (prestazione == "1")
                {
                    //Debug
                    "debug".ToString();
                }

                foreach (var gruppo in raggruppamentoPrincipale)
                {

                    //Aggiungo le righe del gruppo
                    List<Dictionary<string, object>> gruppoFormato = listaConStessaPrestazione.Where(gi =>
                    gi["codice_settore"].ToString() == gruppo.CodiceSettore &&
                    gi[GLOBAL_VARIABLES_FICO.keyDescrizione2].ToString() == gruppo.Marchio
                    ).ToList();

                    testMode = gruppoFormato.Where(r => new string[] { "2828540" }.Contains(r[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString())).Count() > 0;
                    if (testMode)
                    {
                        "warning".ToString();
                    }

                    if (gruppoFormato.Count > 1)
                    {
                        raggruppa(gruppoFormato);
                    }
                }
            }

            //Trattiamo ora tutti i record che non hanno prestazione
            //Approfondendo il raggruppamento e quindi integrando anche cod reparto, sottocategoria
            List<Dictionary<string, object>> listaSenzaPrestazione = records
                .Where(g => !g.ContainsKey(GLOBAL_VARIABLES_FICO.keyCodiceGruppo) && g["prestazione"].ToString() == "")
                .ToList();

            foreach (var gruppo in raggruppamentoPrincipale)
            {
                //Aggiungo le righe del gruppo
                var sottoClassificatore = listaSenzaPrestazione
                    .Where(gi =>
                        gi["codice_settore"].ToString() == gruppo.CodiceSettore &&
                        gi[GLOBAL_VARIABLES_FICO.keyDescrizione2].ToString() == gruppo.Marchio
                    )
                    .GroupBy(g => new
                    {
                        CodiceSettore = g["codice_settore"].ToString(),
                        Marchio = g[GLOBAL_VARIABLES_FICO.keyDescrizione2].ToString(),
                        Sottomarchio = g["sottomarchio"].ToString(),
                        CodiceReparto = g["codice_reparto"].ToString()
                    })
                    .Select(s => s.Key)
                    .ToList();

                foreach (var sottogruppo in sottoClassificatore)
                {

                    List<Dictionary<string, object>> gruppoFormato = listaSenzaPrestazione.Where(g =>
                        g["codice_settore"].ToString() == sottogruppo.CodiceSettore &&
                        g[GLOBAL_VARIABLES_FICO.keyDescrizione2].ToString() == sottogruppo.Marchio &&
                        g["sottomarchio"].ToString() == sottogruppo.Sottomarchio &&
                        g["codice_reparto"].ToString() == sottogruppo.CodiceReparto
                    ).ToList();

                    testMode = gruppoFormato.Where(r => new string[] { "2828540" }.Contains(r[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString())).Count() > 0;

                    if (testMode)
                        "warning".ToString();

                    if (gruppoFormato.Count <= 1)
                        continue;





                    // regole speciali solo per settore FRESCHISSIMI
                    bool isFreschissimi = gruppo.CodiceSettore == "58";//"FRESCHISSIMI";

                    if (!isFreschissimi)
                    {
                        if (testMode)
                            Console.WriteLine(">>>>>>>>>>>>> DEBUG RAGGRUPPA NO FRESCHISSIMI " + String.Join(",", gruppoFormato.Select(s => s[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString()).ToArray()));
                        // settore diverso → mantieni logica standard
                        raggruppa(gruppoFormato);
                        continue;
                    }
                    if (testMode)
                        Console.WriteLine(">>>>>>>>>>>>> DEBUG RAGGRUPPA " + String.Join(",", gruppoFormato.Select(s => s[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString()).ToArray()));

                    raggruppa(gruppoFormato);
                }
            }


            //Analizzo ogni gruppo formato e decido se è una linea oppure no
            List<string> gruppiFormati = records.Where(g => g.ContainsKey(GLOBAL_VARIABLES_FICO.keyCodiceGruppo) && g[GLOBAL_VARIABLES_FICO.keyCodiceGruppo].ToString() != g[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString()).Select(s => s[GLOBAL_VARIABLES_FICO.keyCodiceGruppo].ToString()).ToList();
            foreach (string codGruppo in gruppiFormati)
            {

                var elementiGruppo = records.Where(g => g.ContainsKey(GLOBAL_VARIABLES_FICO.keyCodiceGruppo) && g[GLOBAL_VARIABLES_FICO.keyCodiceGruppo].ToString() == codGruppo).ToList();
                if (elementiGruppo.Count >= 5)
                {
                    //Conteggio raggruppamento prezzi
                    if (elementiGruppo.GroupBy(g => g["prezzo_promo"].ToDecimal()).Count() > 2)
                    {
                        //Controlliamo anche che nessuno degli elmenti abbia JOLLY o SPRINT nel tema
                        if (elementiGruppo.Where(w => w["tema"].ToString().ToUpper().Contains("JOLLY") || w["tema"].ToString().ToUpper().Contains("SPRINT")).Count() == 0)
                        {
                            //E' un linea
                            elementiGruppo.ForEach(f => f["is_linea"] = "x");
                        }
                    }
                }

                //Scarico suggerimento di descrizione gruppo e lo facio solo su un elemento della lista per non appesantire il dato
                if (false)//Per ora disabilitiamolo//suggerimentoAIPerDescrizioneGruppo)
                {
                    var unoDegiElementi = elementiGruppo.FirstOrDefault();

                    HttpClient httpClient = new HttpClient();
                    httpClient.DefaultRequestHeaders.Add("X-API-KEY", "4c5547eac7f632890b1172c33e6c7e76");
                    httpClient.DefaultRequestHeaders.Add("X-API-SECRET", "9af32c4728db61583a18995b56ab646a9c296cbc417255c0");

                    var lista_descrelementiGruppo = elementiGruppo.Select(s => new ISTBusinessSuggerimentiItemWithDetails()
                    {
                        EAN = s[GLOBAL_VARIABLES_FICO.keyEanCodice].ToString(),
                        DESCRIZIONE1 = s.ContainsKey(GLOBAL_VARIABLES_FICO.keyDescrizione1)?s[GLOBAL_VARIABLES_FICO.keyDescrizione1].ToString():"",
                        DESCRIZIONE2 = s.ContainsKey(GLOBAL_VARIABLES_FICO.keyDescrizione2)?s[GLOBAL_VARIABLES_FICO.keyDescrizione2].ToString():"",
                        DESCRIZIONE3 = s.ContainsKey(GLOBAL_VARIABLES_FICO.keyDescrizione3)?s[GLOBAL_VARIABLES_FICO.keyDescrizione3].ToString():"",
                        DESCRIZIONE4 = s.ContainsKey(GLOBAL_VARIABLES_FICO.keyDescrizione4)?s[GLOBAL_VARIABLES_FICO.keyDescrizione4].ToString():"",
                        PREZZO_PROMO = Convert.ToDecimal(s.ContainsKey("prezzo_promo")?s["prezzo_promo"]:0),
                        PREZZO_CONTINUO = Convert.ToDecimal(s.ContainsKey("prezzo_continuo")?s["prezzo_continuo"]:0),
                        PREZZO_KGL = Convert.ToDecimal(s.ContainsKey("prezzo_kgl")?s["prezzo_kgl"]:0),
                        UM = s.ContainsKey(GLOBAL_VARIABLES_FICO.keyDescrUm)?s[GLOBAL_VARIABLES_FICO.keyDescrUm].ToString():"",
                        PESO = Convert.ToDecimal(s.ContainsKey(GLOBAL_VARIABLES_FICO.keyDescrPeso)?s[GLOBAL_VARIABLES_FICO.keyDescrPeso]:0),
                    }).ToList();

                    string _params = JsonConvert.SerializeObject(lista_descrelementiGruppo);
                    var contentParam = new StringContent(_params, Encoding.UTF8, "application/json");
                    string url = "https://istantabusiness.it/api/gdo/get_descrizione_gruppo.php";
                    var response = httpClient.PostAsync(url, contentParam);
                    //var response = await hCli.PutAsync(url, content);

                    if (response.Result.IsSuccessStatusCode)
                    {

                        var contentResponse = response.Result.Content.ReadAsStringAsync().Result;
                        try
                        {
                            var suggerimento = JsonConvert.DeserializeObject<ISTBusinessSuggerimentiGruppoResult>(contentResponse);

                            unoDegiElementi[GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizioneGruppo1] = suggerimento.data.DESCRIZIONE1;
                            unoDegiElementi[GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizioneGruppo2] = suggerimento.data.DESCRIZIONE2;
                            unoDegiElementi[GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizioneGruppo3] = suggerimento.data.DESCRIZIONE3;
                            unoDegiElementi[GLOBAL_VARIABLES_FICO.keySuggerimentoDescrizioneGruppo4] = suggerimento.data.DESCRIZIONE4;

                        }
                        catch(Exception ex_sug_err)
                        {
                            Console.WriteLine(ex_sug_err.ToString());
                        }
                    }
                }

             }








            return records;
        }

        public string ordinaLista(List<Dictionary<string, object>> listRecs, string pathOrdinamentoLista)
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
            if (campo == "isGruppo")
            {
                string codSingolo = rec[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString();
                //string codGruppo = rec[GLOBAL_VARIABLES_FICO.keySottoGruppo].ToString();

                if (codSingolo.Split(',').Length > 1)
                {
                    //Il sottogruppo quando si clona imposta il proprio codice ref in quello di lui stesso, codice sottogruppo
                    return "G";
                }
                else
                {
                    return "A";
                }

            }
            else if (campo == "codiceRef")
            {
                string codSingolo = rec[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString();
                if (codSingolo.Split(',').Length > 1)
                {
                    //return rec[GLOBAL_VARIABLES_FICO.keyRefCodiceOrigin].ToString();
                    return rec[GLOBAL_VARIABLES.keyRefCodice].ToString();

                }
                else
                {
                    return codSingolo;
                }

            }

            return "";
        }

        public Dictionary<string, object> elaboraRecordDaClonare(Dictionary<string, object> origin, Dictionary<string, object> chiaviEliminate, SampleKitDiDestinazioneClone sample, string codiceBox, string pathOrdinamentoLista)
        {
            //sample.sampleData //Questo è il meta dato di un campione (il primo utile della lista) del kit a cui è destinato il clone
            //Al momento non edito niente e torno il record così come impacchettato nel record da clonare
            List<string> listaChiavi = new List<string>()
            {
                "anno_depliant",
                "numero_depliant",
                "descrizione_depliant",
                "inizio_promo",
                "fine_promo",
                "Codice_PdvRif",
                "Descrizione_PdvRif",
            };

            foreach (string chiave in listaChiavi)
            {
                if (origin.ContainsKey(chiave) && sample.sampleData.ContainsKey(chiave))
                {
                    origin[chiave] = sample.sampleData[chiave];
                }
            }
            return origin;
        }


        #region Cambio strutturale



        public List<CambioStrutturale> GetCambioStrutturalePath()
        {
            var result = new List<CambioStrutturale>();
            var id = 1;
            var blockId = 1;

            BloccoRegole Block(params RegolaCondizione[] regole)
            {
                return new BloccoRegole
                {
                    Id = blockId++,
                    Deepness = 0,
                    Regole = regole.ToList()
                };
            }

            RegolaCondizione Rec(string campo, OperatoreCondizione operatore, string value = "")
            {
                return new RegolaCondizione
                {
                    isBox = false,
                    Campo = campo,
                    Operatore = operatore,
                    Value = value ?? string.Empty
                };
            }

            RegolaCondizione Box(string campo, OperatoreCondizione operatore, string value = "")
            {
                return new RegolaCondizione
                {
                    isBox = true,
                    Campo = campo,
                    Operatore = operatore,
                    Value = value ?? string.Empty
                };
            }

            CampoInddCoinvolto Campo(string label)
            {
                return new CampoInddCoinvolto
                {
                    Label = label,
                    Item = null
                };
            }

            void Add(
                string titolo,
                List<IstruzioneCambio> istruzioni,
                List<BloccoRegole> condizione = null,
                string labelElementCorreggo = null,
                List<CampoInddCoinvolto> campiInddCoinvolti = null)
            {
                result.Add(new CambioStrutturale
                {
                    Id = id++,
                    Titolo = titolo,
                    Istruzioni = istruzioni,
                    Condizione = condizione ?? new List<BloccoRegole>(),
                    LabelElementCorreggo = labelElementCorreggo,
                    CampiInddCoinvolti = campiInddCoinvolti ?? new List<CampoInddCoinvolto>()
                });
            }

            Add(
                titolo: "Cambia prezzo promo",
                istruzioni: new List<IstruzioneCambio>
                {
                new IstruzioneCambio { Field = "prezzo_promo", Operazione = TipoOperazione.Set, Valore = null, Primary = true },
                new IstruzioneCambio { Field = "prezzo_promo_kgl", Operazione = TipoOperazione.Set, Valore = null, Primary = true },
                new IstruzioneCambio { Field = "prezzo_continuo", Operazione = TipoOperazione.Set, Valore = null, Primary = true }
                },
                condizione: new List<BloccoRegole>
                {
                Block(
                    Rec("codiceBox", OperatoreCondizione.NotEquals, "BOX_LINEA"),
                    Rec("codiceBox", OperatoreCondizione.NotEquals, "BOX_SPRINT"),
                    Rec("codiceBox", OperatoreCondizione.NotEquals, "BOX_JOLLY")
                )
                },
                labelElementCorreggo: "prezzo_promo",
                campiInddCoinvolti: new List<CampoInddCoinvolto>
                {
                Campo("prezzo_promo")
                });

            Add(
                titolo: "Cambia sconto",
                istruzioni: new List<IstruzioneCambio>
                {
                new IstruzioneCambio { Field = "txt_sconto", Operazione = TipoOperazione.Set, Valore = null, Primary = true }
                },
                labelElementCorreggo: "txt_sconto",
                campiInddCoinvolti: new List<CampoInddCoinvolto>
                {
                Campo("txt_sconto"),
                Campo("sconto_piccolo")
                });

            Add(
                titolo: "Cambia prezzo info pack",
                istruzioni: new List<IstruzioneCambio>
                {
                new IstruzioneCambio { Field = "force_infopack", Operazione = TipoOperazione.Set, Valore = null }
                },
                labelElementCorreggo: "prezzo_info_pack",
                campiInddCoinvolti: new List<CampoInddCoinvolto>
                {
                Campo("prezzo_info_pack")
                });

            Add(
                titolo: "Cambia prezzo continuo",
                istruzioni: new List<IstruzioneCambio>
                {
                new IstruzioneCambio { Field = "prezzo_continuo", Operazione = TipoOperazione.Set, Valore = null, Primary = true }
                },
                labelElementCorreggo: "prezzo_continuo",
                campiInddCoinvolti: new List<CampoInddCoinvolto>
                {
                Campo("prezzo_continuo")
                });

            Add(
                titolo: "Cambia prezzo promo soci",
                istruzioni: new List<IstruzioneCambio>
                {
                new IstruzioneCambio { Field = "prezzo_promo_soci_doppia", Operazione = TipoOperazione.Set, Valore = null, Primary = true },
                new IstruzioneCambio { Field = "prezzo_promo_kgl_soci_doppia", Operazione = TipoOperazione.Set, Valore = null, Primary = true }
                },
                labelElementCorreggo: "prezzo_promo_SOCI_DOPPIA",
                campiInddCoinvolti: new List<CampoInddCoinvolto>
                {
                Campo("prezzo_promo_SOCI_DOPPIA")
                });

            Add(
                titolo: "Cambia sconto soci",
                istruzioni: new List<IstruzioneCambio>
                {
                new IstruzioneCambio { Field = "txt_sconto_soci_doppia", Operazione = TipoOperazione.Set, Valore = null, Primary = true }
                },
                labelElementCorreggo: "txt_sconto_SOCI_DOPPIA",
                campiInddCoinvolti: new List<CampoInddCoinvolto>
                {
                Campo("txt_sconto_SOCI_DOPPIA")
                });

            Add(
                titolo: "Cambia Punti Jolly",
                istruzioni: new List<IstruzioneCambio>
                {
                new IstruzioneCambio { Field = "N_Punti", Operazione = TipoOperazione.Set, Valore = null, Primary = true },
                new IstruzioneCambio { Field = "tema", Operazione = TipoOperazione.Set, Valore = null }
                },
                labelElementCorreggo: "txt_punti_jolly",
                campiInddCoinvolti: new List<CampoInddCoinvolto>
                {
                Campo("txt_punti_jolly")
                });

            Add(
                titolo: "Cambia numero bruciature",
                istruzioni: new List<IstruzioneCambio>
                {
                new IstruzioneCambio { Field = "N_pezzi_soci", Operazione = TipoOperazione.Set, Valore = null, Primary = true },
                new IstruzioneCambio { Field = "pezzi_soci", Operazione = TipoOperazione.Set, Valore = "s" }
                },
                labelElementCorreggo: "n_bruciature",
                campiInddCoinvolti: new List<CampoInddCoinvolto>
                {
                Campo("descrizione")
                });

            Add(
                titolo: "Rimuovi bruciature",
                istruzioni: new List<IstruzioneCambio>
                {
                new IstruzioneCambio { Field = "pezzi_soci", Operazione = TipoOperazione.Set, Valore = "x" }
                });

            Add(
                titolo: "Cambia meccanica in SuperprezziOF",
                istruzioni: new List<IstruzioneCambio>
                {
                new IstruzioneCambio { Field = "tema", Operazione = TipoOperazione.Set, Valore = "SUPERPREZZI OF" }
                },
                condizione: new List<BloccoRegole>
                {
                Block(Rec("codiceBox", OperatoreCondizione.NotEquals, "BOX_SuperprezziOF"))
                });

            Add(
                titolo: "Cambia meccanica in SpendiPunti",
                istruzioni: new List<IstruzioneCambio>
                {
                new IstruzioneCambio { Field = "tipo_evento", Operazione = TipoOperazione.Set, Valore = "FIDELITY" },
                new IstruzioneCambio { Field = "N_Punti", Operazione = TipoOperazione.Set, Valore = null },
                new IstruzioneCambio { Field = "is_linea", Operazione = TipoOperazione.Set, Valore = "" }
                },
                condizione: new List<BloccoRegole>
                {
                Block(Rec("codiceBox", OperatoreCondizione.NotEquals, "BOX_SpendiPunti"))
                });

            Add(
                titolo: "Cambia meccanica in DoppioSconto",
                istruzioni: new List<IstruzioneCambio>
                {
                new IstruzioneCambio { Field = "tema", Operazione = TipoOperazione.Set, Valore = "VALORE SOCI" }
                },
                condizione: new List<BloccoRegole>
                {
                Block(Rec("codiceBox", OperatoreCondizione.NotEquals, "BOX_doppio_SCONTO"))
                });

            Add(
                titolo: "Cambia meccanica in STD",
                istruzioni: new List<IstruzioneCambio>
                {
                new IstruzioneCambio { Field = "tema", Operazione = TipoOperazione.Set, Valore = "" },
                new IstruzioneCambio { Field = "is_linea", Operazione = TipoOperazione.Set, Valore = "" },
                new IstruzioneCambio { Field = "tipo_evento", Operazione = TipoOperazione.Set, Valore = "" }
                },
                condizione: new List<BloccoRegole>
                {
                Block(Rec("codiceBox", OperatoreCondizione.NotEquals, "BOX_STD"))
                });

            Add(
                titolo: "Forza meccanica LINEA",
                istruzioni: new List<IstruzioneCambio>
                {
                new IstruzioneCambio { Field = "is_linea", Operazione = TipoOperazione.Set, Valore = "xForced" }
                },
                condizione: new List<BloccoRegole>
                {
                Block(Rec("codiceBox", OperatoreCondizione.NotEquals, "BOX_LINEA"))
                });

            Add(
                titolo: "Cambia punti sprint",
                istruzioni: new List<IstruzioneCambio>
                {
                new IstruzioneCambio { Field = "N_BonusCartacei", Operazione = TipoOperazione.Set, Valore = null }
                });

            Add(
                titolo: "Rimuovi forzatura meccanica LINEA",
                istruzioni: new List<IstruzioneCambio>
                {
                new IstruzioneCambio { Field = "is_linea", Operazione = TipoOperazione.Set, Valore = "" }
                },
                condizione: new List<BloccoRegole>
                {
                Block(Rec("is_linea", OperatoreCondizione.Equals, "xForced"))
                });

            Add(
                titolo: "Togli dicitura info pack",
                istruzioni: new List<IstruzioneCambio>
                {
                new IstruzioneCambio { Field = "force_infopack", Operazione = TipoOperazione.Set, Valore = "" }
                },
                condizione: new List<BloccoRegole>
                {
                Block(Box("prezzo_info_pack", OperatoreCondizione.Exist))
                });

            Add(
                titolo: "Aggiungi dicitura info pack",
                istruzioni: new List<IstruzioneCambio>
                {
                new IstruzioneCambio { Field = "force_infopack", Operazione = TipoOperazione.Set, Valore = null }
                },
                condizione: new List<BloccoRegole>
                {
                Block(Box("prezzo_info_pack", OperatoreCondizione.NotExist))
                });

            Add(
                titolo: "Cambia meccanica in JOLLY",
                istruzioni: new List<IstruzioneCambio>
                {
                new IstruzioneCambio { Field = "tema", Operazione = TipoOperazione.Set, Valore = "JOLLY" }
                },
                condizione: new List<BloccoRegole>
                {
                Block(Rec("codiceBox", OperatoreCondizione.NotEquals, "BOX_JOLLY"))
                });

            Add(
                titolo: "Cambia meccanica in JOLLY EVIDENZIATO",
                istruzioni: new List<IstruzioneCambio>
                {
                new IstruzioneCambio { Field = "tema", Operazione = TipoOperazione.Set, Valore = "VENDITE PROPOSITIVE" }
                },
                condizione: new List<BloccoRegole>
                {
                Block(Rec("codiceBox", OperatoreCondizione.NotEquals, "BOX_JOLLY_EVIDENZIATO"))
                });

            Add(
                titolo: "Cambia meccanica in SOCI ESCLUSIVA",
                istruzioni: new List<IstruzioneCambio>
                {
                new IstruzioneCambio { Field = "tema", Operazione = TipoOperazione.Set, Valore = "SOCI ESCLUSIVA" }
                },
                condizione: new List<BloccoRegole>
                {
                Block(Rec("codiceBox", OperatoreCondizione.NotEquals, "BOX_ESCLUSIVA_SOCI"))
                });

            Add(
                titolo: "Cambia meccanica in 1+1",
                istruzioni: new List<IstruzioneCambio>
                {
                new IstruzioneCambio { Field = "meccanica", Operazione = TipoOperazione.Set, Valore = "MXN" }
                },
                condizione: new List<BloccoRegole>
                {
                Block(Rec("codiceBox", OperatoreCondizione.NotEquals, "BOX_1+1"))
                });

            Add(
                titolo: "Cambia meccanica in SPRINT",
                istruzioni: new List<IstruzioneCambio>
                {
                new IstruzioneCambio { Field = "tema", Operazione = TipoOperazione.Set, Valore = "SPRINT" }
                },
                condizione: new List<BloccoRegole>
                {
                Block(Rec("codiceBox", OperatoreCondizione.NotEquals, "BOX_SPRINT"))
                });

            Add(
                titolo: "Aggiungi sconto",
                istruzioni: new List<IstruzioneCambio>
                {
                new IstruzioneCambio { Field = "txt_sconto", Operazione = TipoOperazione.Set, Valore = null },
                new IstruzioneCambio { Field = "prezzo_continuo", Operazione = TipoOperazione.Set, Valore = null }
                });

            Add(
                titolo: "Forza sconto piccolo",
                istruzioni: new List<IstruzioneCambio>
                {
                new IstruzioneCambio { Field = "force_scontopiccolo", Operazione = TipoOperazione.Set, Valore = "x" }
                },
                condizione: new List<BloccoRegole>
                {
                Block(Rec("force_scontopiccolo", OperatoreCondizione.NotExist)),
                Block(Rec("force_scontopiccolo", OperatoreCondizione.Equals, ""))
                });

            Add(
                titolo: "Rimuovi forzatura sconto piccolo",
                istruzioni: new List<IstruzioneCambio>
                {
                new IstruzioneCambio { Field = "force_scontopiccolo", Operazione = TipoOperazione.Set, Valore = "" }
                },
                condizione: new List<BloccoRegole>
                {
                Block(
                    Rec("force_scontopiccolo", OperatoreCondizione.Exist),
                    Rec("force_scontopiccolo", OperatoreCondizione.NotEquals, "")
                )
                });

            Add(
                titolo: "Metti fuori volantino",
                istruzioni: new List<IstruzioneCambio>
                {
                    new IstruzioneCambio { Field = "tema", Operazione = TipoOperazione.AppendText, Valore = " fuori depliant" }
                });

            return result;
        }

        #endregion


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

