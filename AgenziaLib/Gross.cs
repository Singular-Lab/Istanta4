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

namespace AgenziaLib
{
    class Classificazione
    {
        public string nome_reparto;
        public string nome_categoria;
    }

    internal class Gross
    {

        public static Dictionary<string, Classificazione> ClassificazioneCategorie = new Dictionary<string, Classificazione> {

            { "0100000", new Classificazione(){ nome_reparto="BEVANDE", nome_categoria="BIBITE" } },
            { "0100010", new Classificazione(){ nome_reparto="BEVANDE", nome_categoria="BIRRE" } },
            { "0100020", new Classificazione(){ nome_reparto="BEVANDE", nome_categoria="ACQUA" } },
            { "0100030", new Classificazione(){ nome_reparto="BEVANDE", nome_categoria="VINO" } },
            { "0100040", new Classificazione(){ nome_reparto="BEVANDE", nome_categoria="" } },
            { "0100050", new Classificazione(){ nome_reparto="BEVANDE", nome_categoria="" } },
            { "0100060", new Classificazione(){ nome_reparto="BEVANDE", nome_categoria="" } },

            { "01010", new Classificazione(){ nome_reparto="IGIENE CASA", nome_categoria="" } },

            { "01020", new Classificazione(){ nome_reparto="IGIENE PERSONA", nome_categoria="" } },

            { "01030", new Classificazione(){ nome_reparto="???", nome_categoria="" } },

            { "0104000", new Classificazione(){ nome_reparto="GROCERY", nome_categoria="COLAZIONE" } },
            { "0104010", new Classificazione(){ nome_reparto="GROCERY", nome_categoria="" } },
            { "0104020", new Classificazione(){ nome_reparto="GROCERY", nome_categoria="SNACK" } },
            { "0104030", new Classificazione(){ nome_reparto="GROCERY", nome_categoria="CONFEZIONATI" } },
            { "0104040", new Classificazione(){ nome_reparto="GROCERY", nome_categoria="INFANZIA" } },
            { "0104050", new Classificazione(){ nome_reparto="GROCERY", nome_categoria="ALIMENTARI" } },
            { "0104060", new Classificazione(){ nome_reparto="GROCERY", nome_categoria="SALSE E CONDIMENTI" } },
            { "0104070", new Classificazione(){ nome_reparto="GROCERY", nome_categoria="PANIFICATI" } },
            { "0104080", new Classificazione(){ nome_reparto="GROCERY", nome_categoria="" } },
            { "0104090", new Classificazione(){ nome_reparto="GROCERY", nome_categoria="PER FOOD" } },

            { "0105000", new Classificazione(){ nome_reparto="FRESCHI", nome_categoria="GASTRONOMIA" } },
            { "0105010", new Classificazione(){ nome_reparto="FRESCHI", nome_categoria="LATTE E LATTICINI" } },
            { "0105020", new Classificazione(){ nome_reparto="FRESCHI", nome_categoria="" } },
            { "0105030", new Classificazione(){ nome_reparto="FRESCHI", nome_categoria="SURGELATI" } },
            { "0105040", new Classificazione(){ nome_reparto="FRESCHI", nome_categoria="" } },
            { "0105050", new Classificazione(){ nome_reparto="FRESCHI", nome_categoria="SALUMI CONFEZIONATI" } },
            { "0105060", new Classificazione(){ nome_reparto="FRESCHI", nome_categoria="FRESCHI CONFEZIONATI" } },
            { "0105070", new Classificazione(){ nome_reparto="FRESCHI", nome_categoria="" } },
            { "0105080", new Classificazione(){ nome_reparto="FRESCHI", nome_categoria="" } },
            { "0105090", new Classificazione(){ nome_reparto="FRESCHI", nome_categoria="" } },

            { "02010", new Classificazione(){ nome_reparto="PESCHERIA", nome_categoria="" } },

            { "02020", new Classificazione(){ nome_reparto="ORTOFRUTTA", nome_categoria="" } },

            { "02040", new Classificazione(){ nome_reparto="MACELLERIA", nome_categoria="" } },

            { "03010", new Classificazione(){ nome_reparto="NO FOOD CASA", nome_categoria="" } },

            { "03020", new Classificazione(){ nome_reparto="NO FOOD ACCESSORI", nome_categoria="" } },

        };

        public string importaVolantino(Dictionary<string, string> formRequest, List<Dictionary<string, object>> tracciato, string pathAree)
        {

            ImportResult impResult = new ImportResult();

            string errors = "";

            try
            {
                JObject o1 = JObject.Parse(File.ReadAllText(pathAree));
                DbAree areeDB = o1.ToObject<DbAree>();
                List<AreaItem> aree = areeDB.source;

                int id_addestramento = Int32.Parse(formRequest["cmbAddestramenti"]);
                bool isFid = (id_addestramento == 3 || id_addestramento == 4 || id_addestramento == 6);
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

                            string canale = "";
                            if (item.ContainsKey("canale"))
                                canale = item["canale"].ToString();
                            else if (isFid)
                                canale = "GI";//I fidelity sono indirizzati solo a GROSS
                            else
                                canale = "PZ";

                            bool check_area = true;

                            if (area!=canale)
                            {
                                check_area = false;
                            }
                            
                            if (check_area)
                            {

                                //Estrapolazione nome reparto e categoria
                                if (item.ContainsKey("categoria"))
                                {
                                    string codiceCat = item["categoria"].ToString();
                                    KeyValuePair<string, Classificazione> catClass = Gross.ClassificazioneCategorie.Where(c => codiceCat.IndexOf(c.Key)==0).FirstOrDefault();
                                    if (catClass.Value!=null)
                                    {
                                        item["nome_reparto"] = catClass.Value.nome_reparto;
                                        item["nome_categoria"] = catClass.Value.nome_categoria;
                                    }

                                }

                                if (area=="PZ")
                                {
                                    item["nome_reparto"] = "Pizzeria";
                                    item["nome_categoria"] = "";
                                }

                                if (isFid)
                                {
                                    item["note"] = "FID";
                                    item["nome_reparto"] = "ClubFidelity";
                                    item["nome_categoria"] = "";
                                }

                                //Elaborazione della descrizione prezzo in funzione di vari parametri e regole
                                if (item.ContainsKey("prestazione"))
                                {

                                    int prestazione = (int)item["prestazione"];
                                    if (prestazione > 0)
                                    {
                                        curr_prestazione = prestazione;
                                    }
                                    else
                                    {
                                        item["prestazione"] = curr_prestazione;
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

                    if (isFid)
                    {
                        //Solo il canale pizzeria ha la colonna prestazione e puo quindi raggruppare
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
                    }

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

        public string esportaVolantino(Dictionary<string, string> formRequest, List<Dictionary<string, object>> tracciato)
        {

            ExportResult expResult = new ExportResult();

            string errors = "";

            try
            {

                Tracciato tracciato_da_esportare = new Tracciato();
                expResult.liste = new List<Tracciato>() { tracciato_da_esportare };
                expResult.liste[0].NomeEsportazione = formRequest["Titolo"];
                expResult.liste[0].Records = new List<Dictionary<string, object>>();

                var tItemMeta = JsonConvert.DeserializeObject<Dictionary<string, object>>(formRequest["tracciatoFieldsStringfy"]);
                string areaInEsportazione = tItemMeta["Area"].ToString();

                for (int x = 0; x < tracciato.Count; x++)
                {

                    Dictionary<string, object> recItemGroup = tracciato[x];

                    if (!recItemGroup.ContainsKey("refs"))
                        continue;


                    List<Dictionary<string, object>> myGroup = recItemGroup["refs"] as List<Dictionary<string, object>>;
                    List<Dictionary<string, object>> myGroupNew = new List<Dictionary<string, object>>();

                    foreach (Dictionary<string, object> objDb in myGroup)
                    {

                        try
                        {

                            //Aggiunta degli 0 decimali a fine per tutti i prezzi

                            if (objDb.ContainsKey(GLOBAL_VARIABLES.keyDescr4) &&
                                objDb[GLOBAL_VARIABLES.keyDescr4].ToString().ToLower()=="all'etto")
                            {
                                //I prezzi vanno ricalcolati all'etto
                                double prezzo_promo = (double)objDb["prezzo_promo"];
                                double prezzo_promo_etto = prezzo_promo / 10d;
                                objDb["prezzo_promo_etto"] = MathExt.DecimalRoundMidpoint((decimal)prezzo_promo_etto).ToString();
                                objDb["prezzo_promo_kgl"] = MathExt.DecimalRoundMidpoint((decimal)prezzo_promo).ToString();
                            }
                            else
                            {
                                if (objDb.ContainsKey(GLOBAL_VARIABLES.keyDescrPeso) || objDb.ContainsKey(GLOBAL_VARIABLES.keyDescrPesoGruppo))
                                {
                                    string um = "";
                                    double peso = 0;

                                    
                                    if (objDb.ContainsKey(GLOBAL_VARIABLES.keyDescrUmGruppo))
                                    {
                                        um = objDb[GLOBAL_VARIABLES.keyDescrUmGruppo].ToString().ToLower();
                                    }
                                    else
                                    {
                                        um = objDb[GLOBAL_VARIABLES.keyDescrUm].ToString().ToLower();
                                    }

                                    if (objDb.ContainsKey(GLOBAL_VARIABLES.keyDescrPesoGruppo))
                                    {
                                        if (objDb[GLOBAL_VARIABLES.keyDescrPesoGruppo] is decimal)
                                        {
                                            peso = (double)((decimal)objDb[GLOBAL_VARIABLES.keyDescrPesoGruppo]);
                                        }
                                        else
                                        {
                                            peso = (double)objDb[GLOBAL_VARIABLES.keyDescrPesoGruppo];
                                        }
                                    }
                                    else
                                    {
                                        if (objDb[GLOBAL_VARIABLES.keyDescrPeso] is decimal)
                                        {
                                            peso = (double)((decimal)objDb[GLOBAL_VARIABLES.keyDescrPeso]);
                                        }
                                        else
                                        {
                                            peso = (double)objDb[GLOBAL_VARIABLES.keyDescrPeso];
                                        }
                                    }


                                    double prezzo_promo = (double)objDb["prezzo_promo"];
                                    decimal prezzo_kgl = 0m;
                                    if (um=="ml" || um=="gr")
                                    {
                                        //1000
                                        prezzo_kgl = (decimal)prezzo_promo / ((decimal)peso/1000m);
                                    }
                                    else if (um=="cl")
                                    {
                                        //100
                                        prezzo_kgl = (decimal)prezzo_promo / ((decimal)peso / 100m);
                                    }
                                    else if (um == "dl")
                                    {
                                        //10
                                        prezzo_kgl = (decimal)prezzo_promo / ((decimal)peso / 10m);
                                    }
                                    else if (um == "kg" || um=="lt")
                                    {
                                        //10
                                        prezzo_kgl = (decimal)prezzo_promo / (decimal)peso;
                                    }

                                    prezzo_kgl = MathExt.Round((decimal)prezzo_kgl, 2, MidpointRounding.ToEven);
                                    prezzo_kgl = Decimal.Round(prezzo_kgl, 2);

                                    objDb["prezzo_promo_kgl"] = MathExt.DecimalRoundMidpoint(prezzo_kgl).ToString();
                                }
                            }

                            if (objDb.ContainsKey("prezzo_imponibile"))
                            {
                                decimal prezzo;
                                if (Decimal.TryParse(objDb["prezzo_imponibile"].ToString(), out prezzo))
                                    objDb["prezzo_imponibile"] = MathExt.DecimalRoundMidpoint(prezzo).ToString();
                            }

                            if (objDb.ContainsKey("prezzo_continuo"))
                            {
                                decimal prezzo;
                                if (Decimal.TryParse(objDb["prezzo_continuo"].ToString(), out prezzo))
                                    objDb["prezzo_continuo"] = MathExt.DecimalRoundMidpoint(prezzo).ToString();
                            }

                            if (objDb.ContainsKey("prezzo_promo"))
                            {
                                decimal prezzo_offerta;
                                if (Decimal.TryParse(objDb["prezzo_promo"].ToString(), out prezzo_offerta))
                                    objDb["prezzo_promo"] = MathExt.DecimalRoundMidpoint(prezzo_offerta).ToString();
                            }


                            

                            

                            myGroupNew.Add(objDb);
                        }
                        catch (Exception ex)
                        {
                            expResult.errors += ex.ToString() + "\n";
                        }
                    }

                    if (myGroupNew.Count > 0)
                    {
                        recItemGroup["refs"] = myGroupNew;
                        expResult.liste[0].Records.Add(recItemGroup);
                    }
                }

            }
            catch (Exception exMaster)
            {
                errors += exMaster.ToString();
            }

            expResult.errors = errors;

            return JsonConvert.SerializeObject(expResult);


        }

        private static List<Dictionary<string, object>> _db;

        public string esportaPOP(Dictionary<string, string> formRequest, List<Dictionary<string, object>> tracciato, string pathOrdinamentoLista)
        {
            ExportResult expResult = new ExportResult();

            string result = "";

            try
            {

                JObject o2 = JObject.Parse(File.ReadAllText(pathOrdinamentoLista));
                DbOrdinamentoDocRoma ordDB = o2.ToObject<DbOrdinamentoDocRoma>();
                List<OrdinamentoDocRoma> schemaOrd = ordDB.source;


                string formato = "";
                if (formRequest.ContainsKey("cmbFormato"))
                    formato = formRequest["cmbFormato"];

                expResult.liste = new List<Tracciato>();
                expResult.liste.Add(new Tracciato());
                expResult.liste[0].NomeEsportazione = formRequest["Titolo"] + "_" + formato;
                expResult.liste[0].Records = new List<Dictionary<string, object>>();

                var tItemMeta = JsonConvert.DeserializeObject<Dictionary<string, object>>(formRequest["tracciatoFieldsStringfy"]);
                string areaInEsportazione = tItemMeta["Area"].ToString();

                _db = tracciato;// new List<Dictionary<string, object>>();


                /*List<Dictionary<string, object>> lista_con_categoria = _db.Where(f => f.ContainsKey("settore") && f.ContainsKey("reparto") && f.ContainsKey("categoria")).ToList();
                List<Dictionary<string, object>> glialtri = _db.Where(f => !f.ContainsKey("settore") || !f.ContainsKey("reparto") || !f.ContainsKey("categoria")).ToList();
                List<Dictionary<string, object>> ordered_db = lista_con_categoria.OrderBy(ord1 => ord1["settore"].ToString()).ThenBy(ord2 => ord2["reparto"].ToString()).ThenBy(ord3 => ord3["categoria"]).ToList();
                List<Dictionary<string, object>> ordered_altri = glialtri.OrderBy(ord1 => ord1["speciale"].ToString()).ToList();

                ordered_db.AddRange(ordered_altri);*/


                //List<string> _ids = ordered_db.Select(s => s["id"].ToString()).ToList();
                //List<Dictionary<string, object>> diff = _db.Where(s => !_ids.Contains(s["id"].ToString())).ToList();

                List<string> codGruppoAnalizzati = new List<string>();
                for (int i = 0; i < tracciato.Count; i++)
                {
                    Dictionary<string, object> objDb = tracciato[i];//Helpers.getJsonObject(rec.dato);

                    //promo_tracciati_records rec = _pop_list[i];

                    //Trea non ha una definizione stabile di sottogruppo
                    //In base al formato e ad alcune caratteristiche del gruppo, l'assegnazione del sottogruppo potrebbe essere ritrattata
                    string codGruppo = objDb[GLOBAL_VARIABLES.keyScattoCodiceGruppo].ToString();
                    if (codGruppo.Split(',').Length > 1)
                    {
                        //Controllo se il gruppo in questione è già stato trattato
                        if (!codGruppoAnalizzati.Contains(codGruppo))
                        {

                            List<Dictionary<string, object>> refsGruppo = tracciato.Where(t => t[GLOBAL_VARIABLES.keyScattoCodiceGruppo].ToString() == codGruppo).ToList();

                            if (formato == "locandina")
                            {
                                //Per le locandine si segue la regola dei prezzi

                                List<double> prezzi_promo_del_gruppo = refsGruppo.Select(s => (double)s["prezzo_promo"]).ToList();
                                //Controllo se i prezzi de componenti sono tutti uguali
                                if (prezzi_promo_del_gruppo.Distinct().Count() > 1)
                                {
                                    //C'è almeno un prezzo diverso, per cui esce ogni singola prestazione nel PoP
                                    refsGruppo.ForEach(f =>
                                        f.Remove(GLOBAL_VARIABLES.keyScattoCodiceSottogruppo)
                                    );
                                }
                                else
                                {
                                    refsGruppo.ForEach(f =>
                                        f[GLOBAL_VARIABLES.keyScattoCodiceSottogruppo] = codGruppo
                                    );
                                }
                            }
                            else if (formato == "stopper")
                            {
                                //Per gli stopper si segue la regola degli sconti
                                List<double> sconti_promo_del_gruppo = refsGruppo.Select(s => (double)s["sconto"]).ToList();
                                if (sconti_promo_del_gruppo.Distinct().Count() > 1)
                                {
                                    //C'è almeno un prezzo diverso, per cui esce ogni singola prestazione nel POP
                                    refsGruppo.ForEach(f =>
                                        f.Remove(GLOBAL_VARIABLES.keyScattoCodiceSottogruppo)
                                    );
                                }
                                else
                                {
                                    //Tutti gli sconti sono uguali. Se non c'è, metto tutto il sottogruppo
                                    refsGruppo.ForEach(f =>
                                        f[GLOBAL_VARIABLES.keyScattoCodiceSottogruppo] = codGruppo
                                    );
                                }
                            }

                            //A prescindere dal formato, controlliamo le differenze di prezzo grammatura.
                            ////Se diverse viene creato il nuovo prezzo_kgl_gruppo
                            List<double> prezziKgl_promo_del_gruppo = refsGruppo.Select(s => (double)s["prezzo_kgl"]).ToList();
                            if (prezziKgl_promo_del_gruppo.Distinct().Count() > 1)
                            {
                                string um = objDb[GLOBAL_VARIABLES.keyDescrUm].ToString().ToLower();
                                string umScelta = "kg";
                                if (um == "lt" || um == "cl" || um == "ml")
                                    umScelta = "lt";

                                //Le grammature sono diverse
                                double prezzoMin = prezziKgl_promo_del_gruppo.Min();
                                double prezzoMax = prezziKgl_promo_del_gruppo.Max();

                                if (refsGruppo.Count==2)
                                {
                                    objDb["prezzo_kgl_gruppo"] = String.Format("€ {0}/{1} al {2}", prezzoMax, prezzoMin, umScelta);
                                }
                                else
                                {
                                    objDb["prezzo_kgl_gruppo"] = String.Format("da € {0} a € {1} al {2}", prezzoMax, prezzoMin, umScelta);
                                }
                            }

                            codGruppoAnalizzati.Add(codGruppo);
                        }
                    }

                    

                    if (areaInEsportazione == "FANTINATO_SMMD")
                    {
                        if (objDb.ContainsKey(GLOBAL_VARIABLES.keyDescr1))
                        {
                            string d1 = objDb[GLOBAL_VARIABLES.keyDescr1].ToString().ToLower();
                            if (d1.Contains("despar"))
                            {
                                if (d1 != "despar")
                                {
                                    //Mi assicuro che non sia parte di una parola più lunga
                                    if (StringExtension.laParolaSiTrovaDaSola("despar", d1))
                                    {
                                        continue;
                                    }

                                }
                                else
                                    continue;
                            }
                        }
                        if (objDb.ContainsKey(GLOBAL_VARIABLES.keyDescr2))
                        {
                            string d2 = objDb[GLOBAL_VARIABLES.keyDescr2].ToString().ToLower();
                            if (d2.Contains("despar"))
                            {
                                if (d2 != "despar")
                                {
                                    //Mi assicuro che non sia parte di una parola più lunga
                                    if (StringExtension.laParolaSiTrovaDaSola("despar", d2))
                                    {
                                        continue;
                                    }

                                }
                                else
                                    continue;
                            }
                        }
                        if (objDb.ContainsKey(GLOBAL_VARIABLES.keyDescr3))
                        {
                            string d3 = objDb[GLOBAL_VARIABLES.keyDescr3].ToString().ToLower();
                            if (d3.Contains("despar"))
                            {
                                if (d3 != "despar")
                                {
                                    //Mi assicuro che non sia parte di una parola più lunga
                                    if (StringExtension.laParolaSiTrovaDaSola("despar", d3))
                                    {
                                        continue;
                                    }

                                }
                                else
                                    continue;
                            }
                        }
                        if (objDb.ContainsKey(GLOBAL_VARIABLES.keyDescr4))
                        {
                            string d4 = objDb[GLOBAL_VARIABLES.keyDescr4].ToString().ToLower();
                            if (d4.Contains("despar"))
                            {
                                if (d4 != "despar")
                                {
                                    //Mi assicuro che non sia parte di una parola più lunga
                                    if (StringExtension.laParolaSiTrovaDaSola("despar", d4))
                                    {
                                        continue;
                                    }

                                }
                                else
                                    continue;
                            }
                        }
                    }

                    if (objDb.ContainsKey("categoria") && 
                        (objDb["categoria"].ToString().ToLower() == "gastronomia" ||
                               objDb["categoria"].ToString().ToLower() == "pescheria"))
                    {
                        //I prezzi vanno ricalcolati all'etto
                        double prezzo = (double)objDb["prezzo_continuo"];
                        double prezzo_etto = prezzo / 10d;
                        objDb["prezzo_etto"] = MathExt.DecimalRoundMidpoint((decimal)prezzo_etto).ToString();


                        double prezzo_promo = (double)objDb["prezzo_promo"];
                        double prezzo_promo_etto = prezzo_promo / 10d;
                        objDb["prezzo_promo_etto"] = MathExt.DecimalRoundMidpoint((decimal)prezzo_promo_etto).ToString();
                    }

                    if (objDb.ContainsKey("prezzo_continuo"))
                    {
                        decimal prezzo;
                        if (Decimal.TryParse(objDb["prezzo_continuo"].ToString(), out prezzo))
                            objDb["prezzo_continuo"] = MathExt.DecimalRoundMidpoint(prezzo).ToString();
                    }

                    if (objDb.ContainsKey("prezzo_promo"))
                    {
                        decimal prezzo_offerta;
                        if (Decimal.TryParse(objDb["prezzo_promo"].ToString(), out prezzo_offerta))
                            objDb["prezzo_promo"] = MathExt.DecimalRoundMidpoint(prezzo_offerta).ToString();
                    }

                    if (objDb.ContainsKey("prezzo_kgl"))
                    {
                        decimal prezzo_offerta;
                        if (Decimal.TryParse(objDb["prezzo_kgl"].ToString(), out prezzo_offerta))
                            objDb["prezzo_kgl"] = MathExt.DecimalRoundMidpoint(prezzo_offerta).ToString();
                    }


                }

                expResult.liste[0].Records = tracciato;//  ordered_db;

            }
            catch (Exception ex)
            {
                expResult.errors = ex.ToString();
            }
            finally
            {

            }



            return JsonConvert.SerializeObject(expResult);

        }

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
            throw new NotImplementedException();
        }

        public string eseguiAutoSelezioneGruppo(List<Dictionary<string, object>> gruppo, List<Dictionary<string, object>> ghost)
        {
            if (ghost.Count > 0)
            {
                foreach (var item in gruppo)
                {
                    var elementoCorrispondente = ghost.Find(f => f[GLOBAL_VARIABLES.keyRefCodice].ToString() == item[GLOBAL_VARIABLES.keyRefCodice].ToString());
                    if (elementoCorrispondente != null)
                    {
                        item[GLOBAL_VARIABLES.keyXMLSelezione] = elementoCorrispondente[GLOBAL_VARIABLES.keyXMLSelezione];
                    }
                }
                return JsonConvert.SerializeObject(gruppo);
            }
            else
            {
                return JsonConvert.SerializeObject(gruppo);
            }
        }


        public string confrontaListe(List<Dictionary<string, object>> primario, List<Dictionary<string, object>> secondario, bool controlloVersione, Dictionary<string, string> reqParams)
        {
            throw new NotImplementedException();
        }

        public string confrontaListatoVolantino(List<Dictionary<string, object>> primario, Dictionary<string, string> reqParams)
        {
            throw new NotImplementedException();
        }

    }
}
