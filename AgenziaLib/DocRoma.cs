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


namespace AgenziaLib
{

    internal class DocRoma
    {



        public string importaVolantino(Dictionary<string, string> formRequest, List<Dictionary<string, object>> tracciato, string pathAree)
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

                List<AreaItem> aList = aree.Where(a => a.Canale == "ORO" || a.Canale == "MARKET" || a.Canale == "PROSSIMITA").ToList();
                if (aList.Count <= 0)
                    throw new Exception("area not found");

                foreach (AreaItem aItem in aList)
                {

                    string area = aItem.Area;
                    string canale = aItem.Canale;

                    Tracciato tItem = new Tracciato();
                    tItem.Area = area;
                    tItem.Canale = canale;
                    if (formRequest.ContainsKey("nomePromo"))
                    {
                        tItem.NomeEsportazione = formRequest["nomePromo"].ToString() + " " + area + "_" + canale;
                    }
                    else
                    {
                        tItem.NomeEsportazione = area+"_"+canale;
                    }

                    for (int i = 0; i < tracciato.Count; i++)
                    {
                        DateTime inizio_processo_item = DateTime.Now;

                        try
                        {

                            Dictionary<string, object> item = new Dictionary<string, object>();
                            foreach (string key in tracciato[i].Keys)
                            {
                                item[key] = tracciato[i][key];
                            }

                            List<string> aree_coinvolte = checkArea(item["rm"].ToString(), item["rv"].ToString(), item["rp"].ToString());

                            bool check_area = aree_coinvolte.Where(ac => ac == canale).Count() > 0;

                            if (check_area)
                            {
                                //Il record è valido per i parametri di importazione richiesti
                                string cod_scatto = getCodiceScatto(item);
                                if (cod_scatto == "offerte per tutti_YOGURT_LIBERO SERVIZIO_FRESCHI_MOLKEREI ALOIS MULLER GMBH & CO._76")
                                {
                                    "break".ToString();
                                }
                                item[Tipi.GLOBAL_VARIABLES.keyScattoCodice] = cod_scatto;

                                string _bollini = getBollini(item);

                                item["isInArea"] = check_area;
                                item["bollini"] = _bollini;


                                tItem.Records.Add(item);

                            }
                        }
                        catch (Exception ex)
                        {
                            errors += ex.ToString() + "\n";
                        }

                    }

                    List<string> cod_scatti = tItem.Records.Select(s => s[GLOBAL_VARIABLES.keyScattoCodice].ToString()).ToList();

                    //Adesso devo ciclare tutto per stabilire i codici gruppi secondo assegnazione scatto
                    cod_scatti.ForEach(x =>
                    {
                        try
                        {
                            if (x == "offerte per tutti_YOGURT_LIBERO SERVIZIO_FRESCHI_MOLKEREI ALOIS MULLER GMBH & CO._76")
                            {
                                "break".ToString();
                            }

                            var _gruppo = tItem.Records.Where(s => s[GLOBAL_VARIABLES.keyScattoCodice].ToString() == x).ToList();
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

        public string importaVolantinoParafarmacia(Dictionary<string, string> formRequest, List<Dictionary<string, object>> tracciato, string pathAree)
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

                List<AreaItem> aList = aree.Where(a => a.Canale == "ORO" || a.Canale == "MARKET" || a.Canale == "PROSSIMITA").ToList();
                if (aList.Count <= 0)
                    throw new Exception("area not found");

                foreach (AreaItem aItem in aList)
                {

                    string area = aItem.Area;
                    string canale = aItem.Canale;

                    Tracciato tItem = new Tracciato();
                    tItem.Area = area;
                    tItem.Canale = canale;
                    if (formRequest.ContainsKey("nomePromo"))
                    {
                        tItem.NomeEsportazione = formRequest["nomePromo"].ToString() + " " + area;
                    }
                    else
                    {
                        tItem.NomeEsportazione = area;
                    }


                    for (int i = 0; i < tracciato.Count; i++)
                    {
                        DateTime inizio_processo_item = DateTime.Now;

                        try
                        {

                            Dictionary<string, object> item = new Dictionary<string, object>();
                            foreach (string key in tracciato[i].Keys)
                            {
                                item[key] = tracciato[i][key];
                            }

                            item.Add("categoria", "parafarmacia");
                            //Metto il codice ref alla prestazione per rendere univoco il cod. scatto e far si che tutte le ref risultino SINGOLE
                            item.Add("prestazione", item[GLOBAL_VARIABLES.keyRefCodice]);

                            if (!item.ContainsKey("speciale"))
                            {
                                item["speciale"] = "parafarmacia";
                            }

                            //Il record è valido per i parametri di importazione richiesti
                            string cod_scatto = getCodiceScatto(item);
                            item[Tipi.GLOBAL_VARIABLES.keyScattoCodice] = cod_scatto;

                            //string _bollini = getBollini(item);
                            //item["bollini"] = _bollini;


                            tItem.Records.Add(item);


                        }
                        catch (Exception ex)
                        {
                            errors += ex.ToString() + "\n";
                        }

                    }

                    List<string> cod_scatti = tItem.Records.Select(s => s[GLOBAL_VARIABLES.keyScattoCodice].ToString()).ToList();

                    //Adesso devo ciclare tutto per stabilire i codici gruppi secondo assegnazione scatto
                    cod_scatti.ForEach(x =>
                    {
                        try
                        {
                            if (x == "offerte per tutti_YOGURT_LIBERO SERVIZIO_FRESCHI_MOLKEREI ALOIS MULLER GMBH & CO._76")
                            {
                                "break".ToString();
                            }

                            var _gruppo = tItem.Records.Where(s => s[GLOBAL_VARIABLES.keyScattoCodice].ToString() == x).ToList();
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

        public string importaVolantinoOrtofrutta(Dictionary<string, string> formRequest, List<Dictionary<string, object>> tracciato, string pathAree)
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

                List<AreaItem> aList = aree.Where(a => a.Canale == "ORO" || a.Canale == "MARKET" || a.Canale == "PROSSIMITA").ToList();
                if (aList.Count <= 0)
                    throw new Exception("area not found");

                foreach (AreaItem aItem in aList)
                {

                    string area = aItem.Area;
                    string canale = aItem.Canale;

                    Tracciato tItem = new Tracciato();
                    tItem.Area = area;
                    tItem.Canale = canale;
                    tItem.NomeEsportazione = formRequest["nomePromo"].ToString();


                    for (int i = 0; i < tracciato.Count; i++)
                    {
                        DateTime inizio_processo_item = DateTime.Now;

                        try
                        {
                            /*if (aItem.Codice == "MARKET" && tracciato[i]["prezzo_promo"].ToString() == "")
                            {
                                continue;
                            }
                            else if (aItem.Codice == "ORO" && tracciato[i]["prezzo_oro"].ToString() == "")
                            {
                                continue;
                            }
                            else if (aItem.Codice == "PROSSIMITA" && tracciato[i]["prezzo_prossimita"].ToString() == "")
                            {
                                continue;
                            }*/

                            Dictionary<string, object> item = new Dictionary<string, object>();
                            foreach (string key in tracciato[i].Keys)
                            {
                                item[key] = tracciato[i][key];
                            }

                            /*if (item["superprezzi"].ToString() != "")
                            {
                                item["speciale"] = "superprezzi";
                            }*/

                            if (!item.ContainsKey("prestazione"))
                            {
                                //Singifica che devo trattarlo come singolo
                                item["prestazione"] = item[GLOBAL_VARIABLES.keyRefCodice];
                            }

                            if (!item.ContainsKey("speciale"))
                            {
                                item["speciale"] = "ortofrutta";
                            }
                            else if (item["speciale"].ToString() == "")
                            {
                                item["speciale"] = "ortofrutta";
                            }

                            if (aItem.Canale == "ORO" && item["speciale"].ToString().ToLower().Contains("superprezzi"))
                            {
                                item["speciale"] = "ortofrutta";
                            }

                            //Mettere a punto algoritmo per ricavare grammatura dal campo Descrizione1

                            if (!item.ContainsKey("reparto"))
                            {
                                item["reparto"] = "ortofrutta";
                            }
                            if (!item.ContainsKey("settore"))
                            {
                                item["settore"] = "freschissimi";
                            }


                            //Il record è valido per i parametri di importazione richiesti
                            string cod_scatto = getCodiceScatto(item);
                            item[Tipi.GLOBAL_VARIABLES.keyScattoCodice] = cod_scatto;


                            //string _bollini = getBollini(item);
                            //item["bollini"] = _bollini;


                            tItem.Records.Add(item);


                        }
                        catch (Exception ex)
                        {
                            errors += ex.ToString() + "\n";
                        }

                    }

                    List<string> cod_scatti = tItem.Records.Select(s => s[GLOBAL_VARIABLES.keyScattoCodice].ToString()).ToList();

                    //Adesso devo ciclare tutto per stabilire i codici gruppi secondo assegnazione scatto
                    cod_scatti.ForEach(x =>
                    {
                        try
                        {
                            if (x == "offerte per tutti_YOGURT_LIBERO SERVIZIO_FRESCHI_MOLKEREI ALOIS MULLER GMBH & CO._76")
                            {
                                "break".ToString();
                            }


                            var _gruppo = tItem.Records.Where(s => s[GLOBAL_VARIABLES.keyScattoCodice].ToString() == x).ToList();
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

        public string importaVolantinoPescheria(Dictionary<string, string> formRequest, List<Dictionary<string, object>> tracciato, string pathAree)
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

                List<AreaItem> aList = aree.Where(a => a.Canale == "ORO" || a.Canale == "MARKET" || a.Canale == "PROSSIMITA").ToList();
                if (aList.Count <= 0)
                    throw new Exception("area not found");

                foreach (AreaItem aItem in aList)
                {

                    string area = aItem.Area;
                    string canale = aItem.Canale;

                    Tracciato tItem = new Tracciato();
                    tItem.Area = area;
                    tItem.Canale = canale;
                    tItem.NomeEsportazione = formRequest["nomePromo"].ToString();


                    for (int i = 0; i < tracciato.Count; i++)
                    {
                        DateTime inizio_processo_item = DateTime.Now;

                        try
                        {

                            Dictionary<string, object> item = new Dictionary<string, object>();
                            foreach (string key in tracciato[i].Keys)
                            {
                                item[key] = tracciato[i][key];
                            }


                            //Tutti singoli
                            item["prestazione"] = item[GLOBAL_VARIABLES.keyRefCodice];
                            if (!item.ContainsKey("speciale"))
                            {
                                item["speciale"] = "pescheria";
                            }

                            //Mettere a punto algoritmo per ricavare grammatura dal campo Descrizione1
                            if (!item.ContainsKey("reparto"))
                            {
                                item["reparto"] = "pescheria";
                            }
                            if (!item.ContainsKey("settore"))
                            {
                                item["settore"] = "freschissimi";
                            }

                            //Il record è valido per i parametri di importazione richiesti
                            string cod_scatto = getCodiceScatto(item);
                            item[Tipi.GLOBAL_VARIABLES.keyScattoCodice] = cod_scatto;


                            //string _bollini = getBollini(item);
                            //item["bollini"] = _bollini;


                            tItem.Records.Add(item);


                        }
                        catch (Exception ex)
                        {
                            errors += ex.ToString() + "\n";
                        }

                    }

                    List<string> cod_scatti = tItem.Records.Select(s => s[GLOBAL_VARIABLES.keyScattoCodice].ToString()).ToList();

                    //Adesso devo ciclare tutto per stabilire i codici gruppi secondo assegnazione scatto
                    cod_scatti.ForEach(x =>
                    {
                        try
                        {

                            var _gruppo = tItem.Records.Where(s => s[GLOBAL_VARIABLES.keyScattoCodice].ToString() == x).ToList();
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

        public string importaVolantinoMacelleria(Dictionary<string, string> formRequest, List<Dictionary<string, object>> tracciato, string pathAree)
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

                List<AreaItem> aList = aree.Where(a => a.Canale == "ORO" || a.Canale == "MARKET" || a.Canale == "PROSSIMITA").ToList();
                if (aList.Count <= 0)
                    throw new Exception("area not found");

                foreach (AreaItem aItem in aList)
                {

                    string area = aItem.Area;
                    string canale = aItem.Canale;

                    Tracciato tItem = new Tracciato();
                    tItem.Area = area;
                    tItem.Canale = canale;
                    tItem.NomeEsportazione = formRequest["nomePromo"].ToString();

                    string label = formRequest["cmbLabels"].ToString();

                    for (int i = 0; i < tracciato.Count; i++)
                    {
                        DateTime inizio_processo_item = DateTime.Now;


                        try
                        {

                            /*if (aItem.Codice == "MARKET"  && (!tracciato[i].ContainsKey("prezzo_promo") || tracciato[i]["prezzo_promo"].ToString() == ""))
                            {
                                continue;
                            }
                            else if (aItem.Codice == "ORO" && (!tracciato[i].ContainsKey("prezzo_promo_oro") || tracciato[i]["prezzo_promo_oro"].ToString() == ""))
                            {
                                continue;
                            }
                            else if (aItem.Codice == "PROSSIMITA" && (!tracciato[i].ContainsKey("prezzo_promo_prossimita") || tracciato[i]["prezzo_promo_prossimita"].ToString() == ""))
                            {
                                continue;
                            }*/

                            /*
                            decimal prezzo;
                            if (aItem.Codice == "MARKET")
                            {
                                
                                if (Decimal.TryParse()
                            }
                            */


                            Dictionary<string, object> item = new Dictionary<string, object>();
                            foreach (string key in tracciato[i].Keys)
                            {
                                item[key] = tracciato[i][key];
                            }


                            //Tutti singoli
                            item["prestazione"] = item[GLOBAL_VARIABLES.keyRefCodice];

                            if (label == "mcll")
                            {
                                if (!item.ContainsKey("speciale"))
                                {
                                    item["speciale"] = "macelleria";
                                }

                                if (!item.ContainsKey("reparto"))
                                {
                                    item["reparto"] = "macelleria";
                                }
                            }
                            else
                            {
                                if (!item.ContainsKey("speciale"))
                                {
                                    item["speciale"] = "pescheria";
                                }

                                if (!item.ContainsKey("reparto"))
                                {
                                    item["reparto"] = "pescheria";
                                }
                            }

                            if (!item.ContainsKey("settore"))
                            {
                                item["settore"] = "freschissimi";
                            }
                            //Mettere a punto algoritmo per ricavare grammatura dal campo Descrizione1


                            //Il record è valido per i parametri di importazione richiesti
                            string cod_scatto = getCodiceScatto(item);
                            item[Tipi.GLOBAL_VARIABLES.keyScattoCodice] = cod_scatto;


                            //string _bollini = getBollini(item);
                            //item["bollini"] = _bollini;


                            tItem.Records.Add(item);


                        }
                        catch (Exception ex)
                        {
                            errors += ex.ToString() + "\n";
                        }

                    }

                    List<string> cod_scatti = tItem.Records.Select(s => s[GLOBAL_VARIABLES.keyScattoCodice].ToString()).ToList();

                    //Adesso devo ciclare tutto per stabilire i codici gruppi secondo assegnazione scatto
                    cod_scatti.ForEach(x =>
                    {
                        try
                        {

                            var _gruppo = tItem.Records.Where(s => s[GLOBAL_VARIABLES.keyScattoCodice].ToString() == x).ToList();
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

        public string importaVolantinoFreschissimi(Dictionary<string, string> formRequest, List<Dictionary<string, object>> tracciato, string pathAree)
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

                List<AreaItem> aList = aree.Where(a => a.Canale == "ORO" || a.Canale == "MARKET" || a.Canale == "PROSSIMITA").ToList();
                if (aList.Count <= 0)
                    throw new Exception("area not found");

                foreach (AreaItem aItem in aList)
                {

                    string area = aItem.Area;
                    string canale = aItem.Canale;

                    Tracciato tItem = new Tracciato();
                    tItem.Area = area;
                    tItem.Canale = canale;
                    if (formRequest.ContainsKey("nomePromo"))
                    {
                        tItem.NomeEsportazione = formRequest["nomePromo"].ToString() + " " + area;
                    }
                    else
                    {
                        tItem.NomeEsportazione = area;
                    }

                    string label = formRequest["cmbLabels"].ToString();

                    for (int i = 0; i < tracciato.Count; i++)
                    {
                        DateTime inizio_processo_item = DateTime.Now;


                        try
                        {


                            Dictionary<string, object> item = new Dictionary<string, object>();
                            foreach (string key in tracciato[i].Keys)
                            {
                                item[key] = tracciato[i][key];
                            }


                            //Tutti singoli
                            //item["prestazione"] = item[GLOBAL_VARIABLES.keyRefCodice];

                            if (label == "mcll")
                            {
                                if (!item.ContainsKey("speciale") || item["speciale"].ToString() == "")
                                {
                                    item["speciale"] = "macelleria";
                                }

                                if (!item.ContainsKey("reparto"))
                                {
                                    item["reparto"] = "macelleria";
                                }

                                if (!item.ContainsKey("categoria"))
                                {
                                    item["categoria"] = "da_lista";
                                }

                            }
                            else if (label == "pshr")
                            {
                                if (!item.ContainsKey("speciale") || item["speciale"].ToString() == "")
                                {
                                    item["speciale"] = "pescheria";
                                }

                                if (!item.ContainsKey("reparto"))
                                {
                                    item["reparto"] = "pescheria";
                                }

                                if (!item.ContainsKey("categoria"))
                                {
                                    item["categoria"] = "da_lista";
                                }
                            }
                            else if (label == "orft")
                            {
                                if (!item.ContainsKey("speciale"))
                                {
                                    item["speciale"] = "ortofrutta";
                                }
                                else if (item["speciale"].ToString() == "")
                                {
                                    item["speciale"] = "ortofrutta";
                                }

                                if (aItem.Canale == "ORO" && item["speciale"].ToString().ToLower().Contains("superprezzi"))
                                {
                                    item["speciale"] = "ortofrutta";
                                }

                                //Mettere a punto algoritmo per ricavare grammatura dal campo Descrizione1

                                if (!item.ContainsKey("reparto"))
                                {
                                    item["reparto"] = "ortofrutta";
                                }
                                if (!item.ContainsKey("settore"))
                                {
                                    item["settore"] = "freschissimi";
                                }
                                if (!item.ContainsKey("categoria"))
                                {
                                    item["categoria"] = "da_lista";
                                }

                            }

                            if (!item.ContainsKey("prestazione") || item["prestazione"].ToString() == "")
                            {
                                //Se la prestazione non è indicata o è vuota, metto il codice ref al suo posto così da essere certo di ottenere uno scatto singolo
                                item["prestazione"] = item[GLOBAL_VARIABLES.keyRefCodice];
                            }

                            if (!item.ContainsKey("settore"))
                            {
                                item["settore"] = "freschissimi";
                            }
                            //Mettere a punto algoritmo per ricavare grammatura dal campo Descrizione1


                            //Il record è valido per i parametri di importazione richiesti
                            string cod_scatto = getCodiceScatto(item);
                            item[Tipi.GLOBAL_VARIABLES.keyScattoCodice] = cod_scatto;


                            //string _bollini = getBollini(item);
                            //item["bollini"] = _bollini;


                            tItem.Records.Add(item);


                        }
                        catch (Exception ex)
                        {
                            errors += ex.ToString() + "\n";
                        }

                    }

                    List<string> cod_scatti = tItem.Records.Select(s => s[GLOBAL_VARIABLES.keyScattoCodice].ToString()).ToList();

                    //Adesso devo ciclare tutto per stabilire i codici gruppi secondo assegnazione scatto
                    cod_scatti.ForEach(x =>
                    {
                        try
                        {

                            var _gruppo = tItem.Records.Where(s => s[GLOBAL_VARIABLES.keyScattoCodice].ToString() == x).ToList();
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

        public string getBollini(Dictionary<string, object> rec)
        {
            string boll = "";

            string cod = rec[Tipi.GLOBAL_VARIABLES.keyRefCodice].ToString().ToLower();


            /*if (rec.ContainsKey("bollini"))
            {
                return rec["bollini"].ToString();

            }*/

            string cs = rec[Tipi.GLOBAL_VARIABLES.keyScattoCodice].ToString().ToLower();
            string descrizione = rec.ContainsKey(Tipi.GLOBAL_VARIABLES.keyDescr1) ? rec[Tipi.GLOBAL_VARIABLES.keyDescr1].ToString().ToLower() : "";
            string descrizioneIndd = rec.ContainsKey(Tipi.GLOBAL_VARIABLES.keyDescrIndd) ? rec[Tipi.GLOBAL_VARIABLES.keyDescrIndd].ToString().ToLower() : "";
            string speciale = rec.ContainsKey("speciale") ? rec["speciale"].ToString().ToLower() : "";
            string reparto = rec.ContainsKey("reparto") ? rec["reparto"].ToString().ToLower() : "";

            //if (descrizione.Contains("sg-") || descrizione.Contains("s/g"))
            //    boll += "Bollino_senza glutine logo.ai,";
            //if (descrizione.Contains("igp"))
            //    boll += "Bollino_IGP.ai,";
            //if (descrizione.Contains(" dop "))
            //    boll += "Bollino_DOP.psd,";
            //if (cs.Contains("surgelati"))
            //    boll += "Bollino_SURGELATI.ai,";
            //if (speciale.Contains("bio") || descrizione.Contains("bio"))
            //{
            //    //Approfondisco
            //    if (descrizione.IndexOf("bio ") == 0 || descrizione.IndexOf(" bio ") > 0 || speciale.IndexOf("-bio-") > 0)
            //        boll += "Bollino_BIO.ai,";
            //}

            if (reparto == "surgelati")
            {
                boll += "Bollino_SURGELATI.ai,";
            }
            if (descrizione.Contains("sg-") || descrizione.Contains("s/g") || descrizioneIndd.Contains("sg-") || descrizioneIndd.Contains("s/g") || descrizione.Contains("senza glutine") || descrizioneIndd.Contains("senza glutine"))
                boll += "Bollino_senza glutine logo.ai,";
            if (descrizione.Contains("igp") || descrizioneIndd.Contains("igp") || descrizione.Contains("i.g.p.") || descrizioneIndd.Contains("i.g.p."))
                boll += "Bollino_IGP.ai,";
            if (descrizione.EndsWith(" dop\r\n") || descrizioneIndd.EndsWith(" dop\r\n") || descrizione.EndsWith(" dop\n\r") || descrizioneIndd.EndsWith(" dop\n\r") || descrizione.EndsWith(" dop\r") || descrizioneIndd.EndsWith(" dop\r") || descrizione.EndsWith(" dop\n") || descrizioneIndd.EndsWith(" dop\n") || descrizione.EndsWith(" dop") || descrizioneIndd.EndsWith(" dop") || descrizione.Contains(" dop ") || descrizioneIndd.Contains(" dop ") || descrizione.Contains("d.o.p.") || descrizioneIndd.Contains("d.o.p."))
                boll += "Bollino_DOP.psd,";
            if (speciale.Contains("bio") || descrizione.Contains("bio") || descrizioneIndd.Contains("bio"))
            {
                //Approfondisco
                if (descrizione.IndexOf("bio ") == 0 || descrizione.IndexOf(" bio ") > 0 || speciale.IndexOf("-bio-") > 0 || descrizioneIndd.IndexOf("bio ") == 0 || descrizioneIndd.IndexOf(" bio ") > 0)
                    boll += "Bollino_BIO.ai,";
            }


            if (boll != "")
                boll = boll.Substring(0, boll.LastIndexOf(","));

            return boll;
        }

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
                            if (objDb.ContainsKey("prezzo"))
                            {
                                decimal prezzo;
                                if (Decimal.TryParse(objDb["prezzo"].ToString(), out prezzo))
                                    objDb["prezzo"] = MathExt.DecimalRoundMidpoint(prezzo).ToString();
                            }

                            if (objDb.ContainsKey("prezzo_oro"))
                            {
                                decimal prezzo_oro;
                                if (Decimal.TryParse(objDb["prezzo_oro"].ToString(), out prezzo_oro))
                                    objDb["prezzo_oro"] = MathExt.DecimalRoundMidpoint(prezzo_oro).ToString();
                            }


                            if (objDb.ContainsKey("prezzo_prossimita"))
                            {
                                decimal prezzo_oro;
                                if (Decimal.TryParse(objDb["prezzo_prossimita"].ToString(), out prezzo_oro))
                                    objDb["prezzo_prossimita"] = MathExt.DecimalRoundMidpoint(prezzo_oro).ToString();
                            }

                            decimal promo = 0;
                            if (objDb.ContainsKey("prezzo_promo"))
                            {

                                if (Decimal.TryParse(objDb["prezzo_promo"].ToString(), out promo))
                                {
                                    string spec = "";
                                    if (objDb.ContainsKey("speciale"))
                                        spec = objDb["speciale"].ToString().ToLower();

                                    string peso = "";
                                    if (objDb.ContainsKey(GLOBAL_VARIABLES.keyDescrPeso))
                                        peso = objDb[GLOBAL_VARIABLES.keyDescrPeso].ToString();

                                    decimal val = promo;
                                    if (Decimal.TryParse(peso, out decimal pesoNum))
                                    {
                                        if (pesoNum == 1 && spec.Contains("gastronomia"))
                                        {
                                            /*
                                            val = val / 10;
                                            string valstr = val.ToString();
                                            if (valstr.IndexOf(",") > 0)
                                            {
                                                string[] valstrP = valstr.Split(',');
                                                string decstr = valstrP[1];
                                                if (decstr.Length > 2)
                                                {
                                                    valstr = valstrP[0] + "," + decstr.Substring(0, 2);
                                                }
                                                else if (decstr.Length == 1)
                                                {
                                                    valstr = valstrP[0] + "," + decstr + "0";
                                                }
                                                else
                                                {
                                                    valstr = valstrP[0] + "," + decstr;
                                                }
                                            }
                                            else
                                            {
                                                valstr += ",00";
                                            }

                                            val = Decimal.Parse(valstr);
                                            */
                                        }
                                    }

                                    objDb["prezzo_promo"] = MathExt.DecimalRoundMidpoint(val).ToString();
                                }
                            }

                            if (objDb.ContainsKey("prezzo_promo_oro"))
                            {
                                decimal promo_oro;
                                if (Decimal.TryParse(objDb["prezzo_promo_oro"].ToString(), out promo_oro))
                                {
                                    objDb["prezzo_promo_oro"] = MathExt.DecimalRoundMidpoint(promo_oro).ToString();
                                }
                            }


                            if (objDb.ContainsKey("prezzo_promo_prossimita"))
                            {
                                decimal promo_oro;
                                if (Decimal.TryParse(objDb["prezzo_promo_prossimita"].ToString(), out promo_oro))
                                {
                                    objDb["prezzo_promo_prossimita"] = MathExt.DecimalRoundMidpoint(promo_oro).ToString();
                                }
                            }

                            decimal prezzo_kgl = 0;
                            if (objDb.ContainsKey("prezzo_kgl"))
                            {

                                if (Decimal.TryParse(objDb["prezzo_kgl"].ToString(), out prezzo_kgl))
                                    objDb["prezzo_kgl"] = MathExt.DecimalRoundMidpoint(prezzo_kgl).ToString();
                            }

                            if (objDb.ContainsKey("prezzo_kgl_oro"))
                            {
                                decimal prezzo_kgl_oro;
                                try
                                {
                                    if (Decimal.TryParse(objDb["prezzo_kgl_oro"].ToString(), out prezzo_kgl_oro))
                                        objDb["prezzo_kgl_oro"] = MathExt.DecimalRoundMidpoint(prezzo_kgl_oro).ToString();
                                }
                                catch { }
                            }

                            if (objDb.ContainsKey("meccanica_market"))
                            {
                                if (objDb["meccanica_market"].ToString() == "1+1")
                                {
                                    string um = "";
                                    if (objDb.ContainsKey("Descrizioni.Um"))
                                        um = objDb["Descrizioni.Um"].ToString();

                                    string dettagli_1_1 = String.Format("1 pezzo {0} € - al {1} {2} €", promo, um, prezzo_kgl);
                                    objDb["dettagli_1_1"] = dettagli_1_1;
                                }


                                if (objDb["meccanica_market"].ToString().ToLower().Contains("alla cassa"))
                                {
                                    string mecc = objDb["meccanica_market"].ToString();
                                    objDb["meccanica_market"] = mecc.Substring(0, mecc.IndexOf("%") + 1);
                                    objDb["alla_cassa"] = "True";
                                }
                            }


                            if (objDb.ContainsKey("prima_di_prezzo2"))
                            {
                                objDb["prima_di_prezzo2"] = getPrimaDiPrezzo2(objDb);
                            }

                            objDb["FotoExtraAuto"] = getBollini(objDb).Split(new char[] { ',' }, StringSplitOptions.RemoveEmptyEntries).Select(s=>new { 
                                NomeFoto = s,
                                Escluso = false
                            }).ToList();
                            


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

        public string esportaPOPold(Dictionary<string, string> formRequest, List<Dictionary<string, object>> tracciato, string pathOrdinamentoLista)
        {
            ExportResult expResult = new ExportResult();

            string result = "";
            int tmpI = 0;
            try
            {

                JObject o2 = JObject.Parse(File.ReadAllText(pathOrdinamentoLista));
                DbOrdinamentoDocRoma ordDB = o2.ToObject<DbOrdinamentoDocRoma>();
                List<OrdinamentoDocRoma> schemaOrd = ordDB.source;

                expResult.liste = new List<Tracciato>();
                expResult.liste.Add(new Tracciato());
                expResult.liste[0].NomeEsportazione = formRequest["Titolo"];
                expResult.liste[0].Records = new List<Dictionary<string, object>>();

                _db = tracciato;// new List<Dictionary<string, object>>();


                List<Dictionary<string, object>> lista_con_categoria = _db.Where(f => f.ContainsKey("settore") && f.ContainsKey("reparto") && f.ContainsKey("categoria")).ToList();
                List<Dictionary<string, object>> ordered_db = lista_con_categoria.OrderBy(ord1 => ord1["settore"].ToString()).ThenBy(ord2 => ord2["reparto"].ToString()).ThenBy(ord3 => ord3["categoria"]).ToList();
                List<Dictionary<string, object>> glialtri = _db.Where(f => !f.ContainsKey("settore") || !f.ContainsKey("reparto") || !f.ContainsKey("categoria")).ToList();
                //List<Dictionary<string, object>> ordered_altri = glialtri.OrderBy(ord1 => ord1["speciale"].ToString()).ToList();

                ordered_db.AddRange(glialtri);


                //List<string> _ids = ordered_db.Select(s => s["id"].ToString()).ToList();
                //List<Dictionary<string, object>> diff = _db.Where(s => !_ids.Contains(s["id"].ToString())).ToList();


                for (int i = 0; i < ordered_db.Count; i++)
                {
                    tmpI = i;
                    //promo_tracciati_records rec = _pop_list[i];

                    Dictionary<string, object> objDb = ordered_db[i];//Helpers.getJsonObject(rec.dato);

                    
                    string scatto = objDb[GLOBAL_VARIABLES.keyScattoCodice].ToString();

                    //if (scatto.IndexOf("nospecial_") != 0)
                    //continue;


                    /*
                    if (objDb.ContainsKey("files_foto"))
                    {
                        //Se arrivaa da record tracciato
                        string foto = objDb["files_foto"].ToString();
                        string[] foto_list = foto.Split(',');
                        for (int f = 0; f < foto_list.Length; i++)
                        {
                            foto_list[f] = foto_list[f].Substring(foto_list[i].LastIndexOf("\\") + 1);
                        }

                        objDb["files_foto"] = string.Join(",", foto_list);
                    }
                    else if (objDb.ContainsKey("foto"))
                    {
                        //Se arriva da record storico
                        objDb["files_foto"] = objDb["foto"];
                    }
                    else
                    {
                        objDb["files_foto"] = objDb[GLOBAL_VARIABLES.keyRefCodice].ToString() + ".psd";
                    }*/

                    if (!objDb.ContainsKey("prima_di_prezzo2"))
                    {
                        objDb["prima_di_prezzo2"] = getPrimaDiPrezzo2(objDb);
                    }


                    if (objDb.ContainsKey("meccanica_market") && objDb["meccanica_market"].ToString() != "")
                        objDb["prezzo"] = getPrezzo(objDb, "");
                    else
                    {
                        decimal d;
                        if (Decimal.TryParse(objDb["prezzo"].ToString(), out d))
                        {
                            objDb["prezzo"] = MathExt.DecimalRoundMidpoint(d).ToString();
                        }
                    }

                    if (objDb.ContainsKey("prezzo_oro"))
                        objDb["prezzo_oro"] = getPrezzo(objDb, "_oro");
                    else
                        objDb["prezzo_oro"] = "deprecato";//Perchè la ref arriva da un volantino diretto epr cui il valore è senza suffissi, esce già giusto da esportazione INDD


                    decimal promo;
                    if (Decimal.TryParse(objDb["prezzo_promo"].ToString(), out promo))
                    {
                        string spec = objDb["speciale"].ToString().ToLower();
                        string peso = objDb["Descrizioni.Peso"].ToString();

                        decimal val = promo;
                        if (Decimal.TryParse(peso, out decimal pesoNum))
                        {
                            if (pesoNum == 1 && spec.Contains("gastronomia"))
                            {
                                val = val / 10;
                                string valstr = val.ToString();
                                if (valstr.IndexOf(",") > 0)
                                {
                                    string[] valstrP = valstr.Split(',');
                                    string decstr = valstrP[1];
                                    if (decstr.Length > 2)
                                    {
                                        valstr = valstrP[0] + "," + decstr.Substring(0, 2);
                                    }
                                    else if (decstr.Length == 1)
                                    {
                                        valstr = valstrP[0] + "," + decstr + "0";
                                    }
                                    else
                                    {
                                        valstr = valstrP[0] + "," + decstr;
                                    }
                                }
                                else
                                {
                                    valstr += ",00";
                                }

                                val = Decimal.Parse(valstr);
                            }
                        }

                        objDb["prezzo_promo"] = MathExt.DecimalRoundMidpoint(val).ToString();
                    }

                    decimal promo_oro;
                    if (objDb.ContainsKey("prezzo_promo_oro") && Decimal.TryParse(objDb["prezzo_promo_oro"].ToString(), out promo_oro))
                    {
                        objDb["prezzo_promo_oro"] = MathExt.DecimalRoundMidpoint(promo_oro).ToString();
                    }

                    if (!objDb.ContainsKey("prezzo_promo_kgl"))
                    {
                        objDb["prezzo_promo_kgl"] = getPrezzoPromoKgl(objDb, "");
                        objDb["prezzo_promo_kgl_oro"] = getPrezzoPromoKgl(objDb, "_oro");
                    }
                    else
                        objDb["prezzo_promo_kgl_oro"] = "deprecato";//Perchè la ref arriva da un volantino diretto epr cui il valore è senza suffissi, esce già giusto da esportazione INDD

                    /*if (objDb.ContainsKey("descrizione_1"))
                    {
                        objDb["descrizione"] = objDb["descrizione_1"];
                        objDb["tipo"] = objDb["descrizione_3"];
                        objDb["grammatura"] = objDb["descrizione_4"];
                    }*/


                }

                expResult.liste[0].Records = ordered_db;

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

        public string esportaPOP(Dictionary<string, string> formRequest, List<Dictionary<string, object>> tracciato, string pathOrdinamentoLista)
        {
            ExportResult expResult = new ExportResult();
            string keyScattoCodiceSottogruppo = "Scatto.CodiceSottogruppo";
            string result = "";
            try
            {

                JObject o2 = JObject.Parse(File.ReadAllText(pathOrdinamentoLista));
                DbOrdinamentoDocRoma ordDB = o2.ToObject<DbOrdinamentoDocRoma>();
                List<OrdinamentoDocRoma> schemaOrd = ordDB.source;

                expResult.liste = new List<Tracciato>();
                expResult.liste.Add(new Tracciato());
                expResult.liste[0].NomeEsportazione = formRequest["Titolo"];
                expResult.liste[0].Records = new List<Dictionary<string, object>>();
                _db = new List<Dictionary<string, object>>();
                foreach (var item in tracciato)
                {
                    foreach (var refs in item)
                    {
                        Dictionary<string, object> tracc = (refs.Value as List<Dictionary<string, object>>)[0];
                        tracc["FotoExtraAuto"] = getBollini(tracc).Split(new char[] { ',' }, StringSplitOptions.RemoveEmptyEntries).Select(s => new {
                            NomeFoto = s,
                            Escluso = false
                        }).ToList();
                        _db.Add(tracc);
                    }
                }

                //_db = tracciato;



                List<Dictionary<string, object>> lista_con_categoria = _db.Where(f => f.ContainsKey("settore") && f.ContainsKey("reparto") && f.ContainsKey("categoria")).ToList();
                List<Dictionary<string, object>> ordered_db = lista_con_categoria.OrderBy(ord1 => ord1["settore"].ToString()).ThenBy(ord2 => ord2["reparto"].ToString()).ThenBy(ord3 => ord3["categoria"]).ToList();
                List<Dictionary<string, object>> glialtri = _db.Where(f => !f.ContainsKey("settore") || !f.ContainsKey("reparto") || !f.ContainsKey("categoria")).ToList();
                List<Dictionary<string, object>> ordered_altri = glialtri.OrderBy(ord1 => ord1["speciale"].ToString()).ToList();

                ordered_db.AddRange(ordered_altri);

                for (int i = 0; i < ordered_db.Count; i++)
                {

                    Dictionary<string, object> objDb = ordered_db[i];


                    string scatto = objDb[GLOBAL_VARIABLES.keyScattoCodice].ToString();

                    if (!objDb.ContainsKey("prima_di_prezzo2"))
                    {
                        objDb["prima_di_prezzo2"] = getPrimaDiPrezzo2(objDb);
                    }


                    if (objDb.ContainsKey("meccanica_market") && objDb["meccanica_market"].ToString() != "")
                        objDb["prezzo"] = getPrezzo(objDb, "");
                    else
                    {
                        decimal d;
                        if (Decimal.TryParse(objDb["prezzo"].ToString(), out d))
                        {
                            objDb["prezzo"] = MathExt.DecimalRoundMidpoint(d).ToString();
                        }
                    }

                    if (objDb.ContainsKey("prezzo_oro"))
                        objDb["prezzo_oro"] = getPrezzo(objDb, "_oro");
                    else
                        objDb["prezzo_oro"] = "deprecato";//Perchè la ref arriva da un volantino diretto epr cui il valore è senza suffissi, esce già giusto da esportazione INDD


                    decimal promo;
                    if (Decimal.TryParse(objDb["prezzo_promo"].ToString(), out promo))
                    {
                        string spec = objDb["speciale"].ToString().ToLower();
                        string peso = objDb["Descrizioni.Peso"].ToString();

                        decimal val = promo;
                        if (Decimal.TryParse(peso, out decimal pesoNum))
                        {
                            if (pesoNum == 1 && spec.Contains("gastronomia"))
                            {
                                val = val / 10;
                                string valstr = val.ToString();
                                if (valstr.IndexOf(",") > 0)
                                {
                                    string[] valstrP = valstr.Split(',');
                                    string decstr = valstrP[1];
                                    if (decstr.Length > 2)
                                    {
                                        valstr = valstrP[0] + "," + decstr.Substring(0, 2);
                                    }
                                    else if (decstr.Length == 1)
                                    {
                                        valstr = valstrP[0] + "," + decstr + "0";
                                    }
                                    else
                                    {
                                        valstr = valstrP[0] + "," + decstr;
                                    }
                                }
                                else
                                {
                                    valstr += ",00";
                                }

                                val = Decimal.Parse(valstr);
                            }
                        }

                        objDb["prezzo_promo"] = MathExt.DecimalRoundMidpoint(val).ToString();
                    }

                    decimal promo_oro;
                    if (objDb.ContainsKey("prezzo_promo_oro") && Decimal.TryParse(objDb["prezzo_promo_oro"].ToString(), out promo_oro))
                    {
                        objDb["prezzo_promo_oro"] = MathExt.DecimalRoundMidpoint(promo_oro).ToString();
                    }

                    //if (!objDb.ContainsKey("prezzo_kgl"))
                    //{
                        objDb["prezzo_kgl"] = getPrezzoPromoKgl(objDb, "");
                        objDb["prezzo_kgl_oro"] = getPrezzoPromoKgl(objDb, "_oro");
                    //}
                    //else
                    //    objDb["prezzo_promo_kgl_oro"] = "deprecato";

                }

                List<List<Dictionary<string, object>>> listaSottogruppi = new List<List<Dictionary<string, object>>>();
                string lastCodiceGruppo = "";
                //creo i sottogruppi
                for (int i = 0; i < ordered_db.Count; i++)
                {
                    if (ordered_db[i].ContainsKey("descrizione_gruppo"))
                    {
                        string descrizione3 = (ordered_db[i]["descrizione_gruppo"] as Dictionary<string, object>)["Descrizioni.Descrizione3"].ToString().ToLower();
                        if (!(descrizione3.StartsWith("vari ") || descrizione3.StartsWith("varie ") || descrizione3.Contains(" vari ") || descrizione3.Contains(" varie ")))
                        {
                            ordered_db[i]["Scatto.CodiceSottogruppo"] = ordered_db[i]["Scatto.CodiceGruppo"];
                        }
                        else
                        {
                            ordered_db[i]["Scatto.CodiceSottogruppo"] = "";
                        }
                    }
                    else
                    {
                        ordered_db[i]["Scatto.CodiceSottogruppo"] = "";
                    }
                }
                    


                expResult.liste[0].Records = ordered_db;

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

        private void ordinamentoRecursive(OrdinamentoDocRoma action, List<Dictionary<string, object>> _temp, ref List<Dictionary<string, object>> result)
        {
            if (action.sottochiavi != null && action.sottochiavi.Count > 0)
            {
                List<Dictionary<string, object>> new_temp = new List<Dictionary<string, object>>();
                if (action.valore.Contains("!="))
                {
                    string param = action.valore.Split(new string[] { "!=" }, StringSplitOptions.None)[1];
                    new_temp = _temp.Where(t => t.ContainsKey(action.chiave) && t[action.chiave].ToString() != param).ToList();
                }
                else
                {
                    if (action.valore.IndexOf("CONTAINS$") == 0)
                    {
                        new_temp = _temp.Where(t => t.ContainsKey(action.chiave) && t[action.chiave].ToString().Contains(action.valore.Replace("CONTAINS$", ""))).ToList();
                    }
                    else
                    {
                        new_temp = _temp.Where(t => t.ContainsKey(action.chiave) && t[action.chiave].ToString() == action.valore).ToList();
                    }
                }
                for (int a = 0; a < action.sottochiavi.Count; a++)
                {
                    ordinamentoRecursive(action.sottochiavi[a], new_temp, ref result);
                }
            }
            else
            {
                List<Dictionary<string, object>> _l = new List<Dictionary<string, object>>();

                if (action.valore.IndexOf("CONTAINS$") == 0)
                {
                    _l = _temp.Where(t => t[action.chiave].ToString().Contains(action.valore.Replace("CONTAINS$", ""))).ToList();
                }
                else
                {
                    _l = _temp.Where(t => t[action.chiave].ToString() == action.valore).ToList();
                }

                if (_l.Count == 0)
                    action.valore.ToString();
                result.AddRange(_l);

                //Li tolgo dalla temporanea
                foreach (Dictionary<string, object> eltodel in _l)
                    _db.Remove(eltodel);
            }
        }

        private string getPrezzo(Dictionary<string, object> objDb, string quale)
        {

            string mecc = "";
            if (objDb.ContainsKey("meccanica_market"))
            {
                mecc = objDb["meccanica_market"].ToString();
            }
            else if (objDb.ContainsKey("sconto"+quale))
            {
                double scontoValore = (double)objDb["sconto" + quale];
                if(scontoValore>0)
                {
                    mecc = "SCONTO " + scontoValore + " %";
                }
            }
            
            string prezzo = objDb["prezzo" + quale].ToString();

            if (Decimal.TryParse(prezzo, out decimal num))
            {
                if (mecc.IndexOf("SCONTO") >= 0)
                {
                    return "invece di " + MathExt.DecimalRoundMidpoint(num) + " €";

                }
                else
                {
                    return "";
                }
            }
            else
                return prezzo;
        }

        private string getPrezzoPromoKgl(Dictionary<string, object> objDb, string quale)
        {
            decimal prezzo_kgl = 0;
            if (quale == "")
            {
                if (objDb.ContainsKey("prezzo_kgl"))
                {

                    if (Decimal.TryParse(objDb["prezzo_kgl"].ToString(), out prezzo_kgl))
                        return MathExt.DecimalRoundMidpoint(prezzo_kgl).ToString();
                }
            }
            else
            {
                if (objDb.ContainsKey("prezzo_kgl_oro"))
                {
                    decimal prezzo_kgl_oro;
                    try
                    {
                        if (Decimal.TryParse(objDb["prezzo_kgl_oro"].ToString(), out prezzo_kgl_oro))
                            return MathExt.DecimalRoundMidpoint(prezzo_kgl_oro).ToString();
                    }
                    catch {
                        return "";
                    }
                }
            }

            return "";



        }

        private string getPrimaDiPrezzo2(Dictionary<string, object> objDb)
        {
            string mecc = "";
            if (objDb.ContainsKey("meccanica_market"))
            {
                mecc = objDb["meccanica_market"].ToString();
            }
            else if (objDb.ContainsKey("sconto"))
            {
                double  scontoValore = (double)objDb["sconto"];
                if (scontoValore > 0)
                {
                    mecc = "SCONTO " + scontoValore + " %";
                }
            }

            //string mecc = objDb["meccanica_market"].ToString();

            //string rep = objDb["reparto"].ToString();
            string sett = objDb.ContainsKey("settore")?objDb["settore"].ToString():"";
            string gramm = "";
            if (objDb.ContainsKey("Descrizioni.Descrizione4"))
                gramm = objDb["Descrizioni.Descrizione4"].ToString();

            if (gramm == "")
            {
                if (objDb.ContainsKey("Descrizioni.DescrizioneIndd") && objDb["Descrizioni.DescrizioneIndd"].ToString() != "")
                {
                    List<Tag> _tags = getDescrizioneHtmlTags(objDb["Descrizioni.DescrizioneIndd"].ToString());
                    for (int t = 0; t < _tags.Count; t++)
                    {
                        Tag tagItem = _tags[t];
                        if (tagItem.stile == "DESCRIZIONE GRAMMATURA")
                        {
                            gramm += tagItem.content;
                        }
                    }
                }
            }

            if (mecc.IndexOf("1+1") >= 0)
            {
                return "2 pezzi";
            }
            else if (gramm.IndexOf("circa") >= 0 ||
                ((sett.ToLower() == "freschi" || sett.ToLower() == "freschissimi") && gramm == ""))
            {
                string um = "";
                if (objDb.ContainsKey("Descrizioni.Um"))
                    um = objDb["Descrizioni.Um"].ToString();

                return "al " + um;
            }
            else
            {
                return "";
            }
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
                    //Si tratta di un gruppo
                    JObject dna = JsonConvert.DeserializeObject<JObject>(articoloIndd["dna"].ToString());
                    Dictionary<string, object> objDna = dna.ToObject<Dictionary<string, object>>();

                    string meccanica = objDna["meccanica"].ToString();


                    if (objDna["codice_gruppo"].ToString().IndexOf("3151049,3151053") >= 0)
                    {
                        "debug".ToString();
                    }

                    //Controllo se si trata di standard o linea
                    if (isLinea/*meccanica.ToLower().IndexOf("linea") >= 0*/)
                    {
                        //Si tratta di una linea
                        //Controllo i campi (ANCORA DA definire) per capire che tipo di casistica di prezzo c'è
                        List<Tag> tagLineaPrezzi = descrTags.Where(t => t.tag_apertura == DESCRIZIONE_LINEAPREZZI).ToList();
                        int euroCount = tagLineaPrezzi.Sum(t => t.content.Count(tc => tc == '€'));
                        string dettaglio_prezzo_linea = "";
                        tagLineaPrezzi.ForEach(f =>
                        {
                            dettaglio_prezzo_linea += f.content;
                        });

                        if (euroCount > 1 || dettaglio_prezzo_linea.Contains("a partire da")/*prezzo_promo.ToLower().Contains("a partire da")*/)
                        {
                            //Il gruppo contiene prezzi diversi
                            foreach (Dictionary<string, object> _ref in gruppo)
                            {
                                AlterazioniRecFromIndd altRec = new AlterazioniRecFromIndd();
                                altRec.codice = _ref[GLOBAL_VARIABLES.keyRefCodice].ToString();
                                altRec.codiceGruppo = _ref[GLOBAL_VARIABLES.keyScattoCodiceGruppo].ToString();
                                altRec.requisiti = new Dictionary<string, object>();
                                altRec.requisiti["descrizione"] = descrizione;
                                //altRec.requisiti["mastro"] = mastro;
                                altRec.requisiti[GLOBAL_VARIABLES.keyRequisitoPrezziDiversi] = true;
                                altRec.requisiti[GLOBAL_VARIABLES.keyRequisitoDescrizioneSingola] = true;
                                altRec.IdRec = (Int64)_ref["IdRec"];

                                altRec.indd = articoloIndd;

                                if (altRec.requisiti.ContainsKey(GLOBAL_VARIABLES.keyScattoCodiceSottogruppo))
                                    altRec.requisiti.Remove(GLOBAL_VARIABLES.keyScattoCodiceSottogruppo);

                                result.alterazioniInIndd.Add(altRec);
                            }
                        }
                        else
                        {
                            //Tuti i prezzi sono uguali
                            foreach (Dictionary<string, object> _ref in gruppo)
                            {
                                AlterazioniRecFromIndd altRec = new AlterazioniRecFromIndd();
                                altRec.codice = _ref[GLOBAL_VARIABLES.keyRefCodice].ToString();
                                altRec.codiceGruppo = _ref[GLOBAL_VARIABLES.keyScattoCodiceGruppo].ToString();
                                altRec.requisiti = new Dictionary<string, object>();
                                altRec.requisiti["descrizione"] = descrizione;//Mantengo al descrizione che arriva da INDD e che rappresenta il gruppo                                
                                //altRec.requisiti["mastro"] = mastro;
                                altRec.requisiti[GLOBAL_VARIABLES.keyRequisitoPrezziDiversi] = false;
                                altRec.requisiti[GLOBAL_VARIABLES.keyRequisitoDescrizioneSingola] = false;
                                altRec.IdRec = (Int64)_ref["IdRec"];

                                altRec.indd = articoloIndd;

                                //Imposto il sottogruppo prendendolo direttamente dal codice gruppo
                                //Potrebbe non aver senso dato che la natura del sottogruppo è quella di raggruppare parte del gruppo intero
                                //ma nel caso di DOC, serve a specificare che quel gruppo rappresenta allo stesso tempro anche un sottogruppo PoP
                                altRec.requisiti[GLOBAL_VARIABLES.keyScattoCodiceSottogruppo] = _ref[GLOBAL_VARIABLES.keyScattoCodiceGruppo].ToString();

                                result.alterazioniInIndd.Add(altRec);
                            }
                        }
                    }
                    else
                    {
                        //Si tratta di uno standard
                        //Leggo la descrizione tipo per vedere se intercetto, "vari tipi" "vari gusti" "vari formati" ... e altro?

                        int paracadute = 0;
                        string tipo_gusto = descrizione;
                        string grammatura = descrizione;

                        while (tipo_gusto.IndexOf("<DESCRIZIONE TIPO>") >= 0 && paracadute < 100)
                        {
                            try
                            {
                                int startInx = tipo_gusto.IndexOf("<DESCRIZIONE TIPO>");
                                int endIndex = tipo_gusto.IndexOf("</DESCRIZIONE TIPO>", startInx);

                                int start_substr = startInx + "<DESCRIZIONE TIPO>".Length;
                                string _temp = tipo_gusto.Substring(start_substr, endIndex - start_substr);

                                string _temp_after = tipo_gusto.Substring(endIndex + "</DESCRIZIONE TIPO>".Length);
                                if (_temp_after.IndexOf("<DESCRIZIONE TIPO>") < 0)
                                {
                                    _temp_after = "";
                                }

                                tipo_gusto = _temp.ToLower() + _temp_after;

                                paracadute++;
                            }
                            catch
                            {
                                break;
                            }
                        }

                        paracadute = 0;

                        while (grammatura.IndexOf("<DESCRIZIONE GRAMMATURA>") >= 0 && paracadute < 100)
                        {
                            try
                            {
                                int startInx = grammatura.IndexOf("<DESCRIZIONE GRAMMATURA>");
                                int endIndex = grammatura.IndexOf("</DESCRIZIONE GRAMMATURA>", startInx);

                                int start_substr = startInx + "<DESCRIZIONE GRAMMATURA>".Length;
                                string _temp = grammatura.Substring(start_substr, endIndex - start_substr);

                                string _temp_after = grammatura.Substring(endIndex + "</DESCRIZIONE GRAMMATURA>".Length);
                                if (_temp_after.IndexOf("<DESCRIZIONE GRAMMATURA>") < 0)
                                {
                                    _temp_after = "";
                                }

                                grammatura = _temp.ToLower() + _temp_after;

                                paracadute++;
                            }
                            catch
                            {
                                break;
                            }
                        }


                        string scritta_sconto = objDna.ContainsKey("scritta_sconto") ? objDna["scritta_sconto"].ToString().ToLower() : "";

                        if (tipo_gusto.Contains("vari tipi") || tipo_gusto.Contains("vari gusti") || tipo_gusto.Contains("vari formati")
                            || tipo_gusto.Contains("varie profumazioni") || tipo_gusto.Contains("varie colorazioni") ||
                            grammatura.Contains("vari tipi") || grammatura.Contains("vari gusti") || grammatura.Contains("vari formati")
                            || grammatura.Contains("varie profumazioni") || grammatura.Contains("varie colorazioni") || scritta_sconto.Contains("3x2") || (grammatura.Contains("variet") && grammatura.Contains("assortit")))
                        {
                            //Ogni ref esce allo stesso modo
                            //Quindi creo un sottogruppo per uscita PoP
                            foreach (Dictionary<string, object> _ref in gruppo)
                            {
                                AlterazioniRecFromIndd altRec = new AlterazioniRecFromIndd();
                                altRec.codice = _ref[GLOBAL_VARIABLES.keyRefCodice].ToString();
                                altRec.codiceGruppo = _ref[GLOBAL_VARIABLES.keyScattoCodiceGruppo].ToString();
                                altRec.requisiti = new Dictionary<string, object>();
                                altRec.requisiti["descrizione"] = descrizione;//Mantengo al descrizione che arriva da INDD e che rappresenta il gruppo
                                //altRec.requisiti["mastro"] = mastro;
                                altRec.requisiti[GLOBAL_VARIABLES.keyRequisitoPrezziDiversi] = false;
                                altRec.requisiti[GLOBAL_VARIABLES.keyRequisitoDescrizioneSingola] = false;
                                altRec.IdRec = (Int64)_ref["IdRec"];

                                altRec.indd = articoloIndd;

                                //Imposto il sottogruppo prendendolo direttamente dal codice gruppo
                                //Potrebbe non aver senso dato che la natura del sottogruppo è quella di raggruppare parte del gruppo intero
                                //ma nel caso di DOC, serve a specificare che quel gruppo rappresenta allo stesso tempro anche un sottogruppo PoP
                                altRec.requisiti[GLOBAL_VARIABLES.keyScattoCodiceSottogruppo] = _ref[GLOBAL_VARIABLES.keyScattoCodiceGruppo].ToString();

                                result.alterazioniInIndd.Add(altRec);
                            }
                        }
                        else
                        {
                            //Devo verificare se i prezzi (prezzo_promo, prezzo_kgl) di alcuni membri del gruppo differsicono da altri per poter dire se anche i prezzi son diversi!
                            List<double> _prezzi_gruppo = gruppo.Where(g => g.ContainsKey("prezzo_promo")).Select(s => (double)s["prezzo_promo"]).ToList();
                            List<double> _prezzi_kgl_gruppo = gruppo.Where(g => g.ContainsKey("prezzo_promo_kgl")).Select(s => (double)s["prezzo_promo_kgl"]).ToList();
                            //Da capire come gestire i prezzi ORO

                            bool prezzi_diversi = (_prezzi_gruppo.Distinct().Count() > 1 || _prezzi_kgl_gruppo.Distinct().Count() > 1);


                            //Ogni ref esce con il proprio gusto
                            foreach (Dictionary<string, object> _ref in gruppo)
                            {
                                AlterazioniRecFromIndd altRec = new AlterazioniRecFromIndd();
                                altRec.codice = _ref[GLOBAL_VARIABLES.keyRefCodice].ToString();
                                altRec.codiceGruppo = _ref[GLOBAL_VARIABLES.keyScattoCodiceGruppo].ToString();
                                altRec.requisiti = new Dictionary<string, object>();
                                altRec.requisiti["descrizione"] = descrizione;
                                //altRec.requisiti["mastro"] = mastro;
                                altRec.requisiti[GLOBAL_VARIABLES.keyRequisitoPrezziDiversi] = prezzi_diversi;
                                altRec.requisiti[GLOBAL_VARIABLES.keyRequisitoDescrizioneSingola] = true;

                                altRec.IdRec = (Int64)_ref["IdRec"];

                                altRec.indd = articoloIndd;

                                if (altRec.requisiti.ContainsKey(GLOBAL_VARIABLES.keyScattoCodiceSottogruppo))
                                    altRec.requisiti.Remove(GLOBAL_VARIABLES.keyScattoCodiceSottogruppo);

                                result.alterazioniInIndd.Add(altRec);
                            }
                        }
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
                    altRec.requisiti[GLOBAL_VARIABLES.keyRequisitoPrezziDiversi] = false;
                    altRec.requisiti[GLOBAL_VARIABLES.keyRequisitoDescrizioneSingola] = true;
                    altRec.IdRec = (Int64)gruppo[0]["IdRec"];

                    altRec.indd = articoloIndd;

                    if (altRec.requisiti.ContainsKey(GLOBAL_VARIABLES.keyScattoCodiceSottogruppo))
                        altRec.requisiti.Remove(GLOBAL_VARIABLES.keyScattoCodiceSottogruppo);

                    result.alterazioniInIndd.Add(altRec);
                }
            }
            catch (Exception ex)
            {
                ex.ToString();
            }

            return JsonConvert.SerializeObject(result);
        }

        public string eseguiAutoSelezioneGruppo(List<Dictionary<string, object>> gruppo, List<Dictionary<string, object>> ghost)
        {
            string keyRefCodice = GLOBAL_VARIABLES.keyRefCodice;
            string keyXMLSelezione = GLOBAL_VARIABLES.keyXMLSelezione;

            if (ghost != null && ghost.Count > 0)
            {
                foreach (var item in gruppo)
                {
                    var ghostItem = ghost.Find(f => f[keyRefCodice].ToString() == item[keyRefCodice].ToString());
                    if (ghostItem != null)
                    {
                        item[keyXMLSelezione] = ghostItem[keyXMLSelezione];
                    }
                }
            }

            return JsonConvert.SerializeObject(gruppo);
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
