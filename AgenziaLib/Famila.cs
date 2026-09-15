using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using AgenziaLib.Tipi;
using IstantaLib;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace AgenziaLib
{
    public class Famila : IAgenzia
    {
        // ================================================================
        // Codici settori/reparti "no food" — TODO FAMILA: verificare i valori
        // (in Coopfi: settori 62,64,66,68 ; reparti 01..12 esclusi alcuni)
        // ================================================================
        private readonly string[] settori_no_food = new string[] { /* TODO FAMILA */ };
        private readonly string[] reparti_no_food = new string[] { /* TODO FAMILA */ };

        // ================================================================
        // Box "commerciali" di competenza dello script: sono gli unici valori
        // che GetCodiceBoxFamila sa produrre e quindi gli unici che lo script
        // è autorizzato a sovrascrivere sul record.
        // Qualunque altro valore già presente (separatori, box strutturali o
        // di servizio impostati a monte) viene lasciato intatto: non lo
        // decide la meccanica commerciale.
        // ================================================================
        private static readonly HashSet<string> _boxGestiti = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "BOX_STD",
            "BOX_FID",
            "BOX_ETRURIA",
            "BOX_SOTTOCOSTO"
        };

        // Canali Famila: mappa NOME esteso -> SIGLA (come da ACPV).
        // Serve per normalizzare il valore della colonna "canale" (che può
        // arrivare come nome esteso o già come sigla) verso la sigla del Canale.
        // private static readonly Dictionary<string, string> _canaleNomeToSigla =
        //     new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        // {
        //     { "A&O Urbano",            "AeOU" },
        //     { "A&O Firenze",           "AeOF" },
        //     { "Bottega Firenze Selex", "BFS"  },
        //     { "Famila Firenze",        "FAMS" },
        //     { "Famila Market Firenze", "FAMM" },
        // };

        public string importaTracciato(List<Dictionary<string, object>> tracciato, Dictionary<string, string> formRequest, List<FicoContextField> context, List<FicoContextField> contextPromo, string pathACPV, string pathOrdinamentoLista, string pathMeccaniche, string pathTraduttoreAC)
        {
            ImportResult impResult = new ImportResult();
            string errors = "";
            List<Tracciato> result = new List<Tracciato>();

            try
            {
                // ============================================================
                // BLOCCO 1 — Caricamento configurazione ACPV (aree/canali)
                // (strutturale, comune a tutti i clienti)
                // ============================================================
                DbACPV areeDB = JObject.Parse(File.ReadAllText(pathACPV)).ToObject<DbACPV>();
                string label = formRequest.ContainsKey("idLabel") ? formRequest["idLabel"] : "";
                //string guidIdAreaRequest = formRequest.ContainsKey("guidIdArea") ? formRequest["guidIdArea"] : "";

                // ============================================================
                // BLOCCO 2 — Area (Famila: UNICA area)
                //   Nessun mapping label->area: si usa l'area indicata da
                //   guidIdArea se presente, altrimenti l'unica area del DB.
                // ============================================================
                Area areaFamila = areeDB.aree.FirstOrDefault();//!string.IsNullOrEmpty(guidIdAreaRequest)
                    // ? areeDB.aree.FirstOrDefault(a => a.guidID == guidIdAreaRequest)
                    // : areeDB.aree.FirstOrDefault();
                if (areaFamila == null)
                    throw new Exception("Area Famila non trovata nel DB ACPV");

                // ============================================================
                // BLOCCO 3 — Arricchimento descrizioni da EAN (API ISTANTA BUSINESS)
                //   OMESSO per Famila (scelta esplicita).
                // ============================================================

                // ============================================================
                // BLOCCO 4 — Ciclo sui record: filtri e canale
                // ============================================================
                for (int i = 0; i < tracciato.Count; i++)
                {
                    Dictionary<string, object> dictObj = tracciato[i];

                    // (Blocco 4a: nessun filtro di esclusione per Famila.)

                    // ----- 4c: canale del record, letto dalla colonna "canale" -----
                    //   Il valore può arrivare come NOME esteso o già come SIGLA:
                    //   lo normalizzo sempre a sigla prima di cercare il Canale.
                    //   Canali (5): A&O Urbano=AeOU, A&O Firenze=AeOF,
                    //   Bottega Firenze Selex=BFS, Famila Firenze=FAMS, Famila Market Firenze=FAMM.
                    //   (Area unica: sigla "TO")
                    string valCanale = dictObj.ContainsKey("canale") ? dictObj["canale"].ToString().Trim() : "";
                    //string siglaCanale = _canaleNomeToSigla.ContainsKey(valCanale) ? _canaleNomeToSigla[valCanale] : valCanale;
                    Canale cItem = areeDB.canali.FirstOrDefault(c => c.nome == valCanale);// siglaCanale);
                    if (cItem == null)
                        continue; // canale non riconosciuto -> record saltato

                    dictObj["is_linea"] = "";
                    //Compongo il codice ref unendo la colonna gia vlaorizzata + diff
                    dictObj[GLOBAL_VARIABLES_FICO.keyRefCodice] = dictObj[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString() + "-" + dictObj["diff"].ToString();

                    // ============================================================
                    // BLOCCO 5 — Costruzione del Tracciato (area unica x canale)
                    //   Famila: ogni record è a sé -> nessuna dedup, nessun merge,
                    //   niente foto, niente normalizzazione sconto.
                    // ============================================================
                    string codice_area = cItem.sigla + areaFamila.sigla;
                    Tracciato tracciato_item = result.FirstOrDefault(t => t.Canale == cItem.sigla && t.Area == areaFamila.sigla);
                    if (tracciato_item == null)
                    {
                        tracciato_item = new Tracciato();
                        tracciato_item.Area = areaFamila.sigla;
                        tracciato_item.Canale = cItem.sigla;
                        tracciato_item.guidArea = areaFamila.guidID;
                        tracciato_item.guidCanale = cItem.guidID;

                        // NomeEsportazione: in COOP è "". Qui default siglaCanale+"TO"
                        // (modificabile se serve un nome diverso).
                        tracciato_item.NomeEsportazione = codice_area;

                        // Date della promo dalle colonne inizio_promo / fine_promo.
                        if (dictObj.ContainsKey("inizio_promo") && !string.IsNullOrEmpty(dictObj["inizio_promo"].ToString()))
                            tracciato_item.DataDa = DateTime.Parse(dictObj["inizio_promo"].ToString());
                        if (dictObj.ContainsKey("fine_promo") && !string.IsNullOrEmpty(dictObj["fine_promo"].ToString()))
                            tracciato_item.DataA = DateTime.Parse(dictObj["fine_promo"].ToString());

                        // DescrizioneIniziativa / Iniziativa / Tipo: in COOP marcati "Inutile" -> omessi.

                        result.Add(tracciato_item);
                    }

                    // Ogni record viene semplicemente accodato alla lista del suo canale.
                    tracciato_item.Records.Add(dictObj);
                }

                // ============================================================
                // BLOCCO 6 — Elaborazione per singola lista (raggruppamento)
                // ============================================================
                for (int i = 0; i < result.Count; i++)
                {
                    Tracciato tItem = result[i];

                    FicoRuntimeKit kit = new FicoRuntimeKit();
                    kit.context = contextPromo.Concat(context)
                                              .GroupBy(g => g.nome_field)
                                              .Select(g => g.Last())
                                              .ToList();
                    kit.guidArea = tItem.guidArea;
                    kit.guidCanale = tItem.guidCanale;

                    string siglaAreaKit = areeDB.aree.FirstOrDefault(a => a.guidID == tItem.guidArea)?.sigla ?? "";

                    // suggerimentoAIPerDescrizioneGruppo = false (Famila non usa l'API)
                    tItem.Records = elaboraTracciatiRecords_do(tItem.Records, kit, siglaAreaKit, false);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("Import Famila error (liv1): " + ex.ToString());
                errors += ex.Message;
            }

            impResult.liste = result;
            impResult.errors = errors;
            return JsonConvert.SerializeObject(impResult);
        }

        // ================================================================
        // Helper (NON parte di IAgenzia) richiamato da importaTracciato.
        // Raggruppa i record in gruppi/linee secondo le regole di business.
        // TODO FAMILA: da declinare in una fase successiva.
        // ================================================================
        private List<Dictionary<string, object>> elaboraTracciatiRecords_do(List<Dictionary<string, object>> records, FicoRuntimeKit kit, string siglaAreaKit = "", bool suggerimentoAIPerDescrizioneGruppo = false)
        {
            // ============================================================
            // Raggruppamento Famila.
            //   Vanno nello stesso gruppo tutte le righe che hanno,
            //   contemporaneamente, gli stessi:
            //     - tipo_offerta   (col Z)
            //     - codice_reparto (col K) - reparto
            //     - codice_settore (col M) - settore
            //     - prezzo_promo   (col T)
            //   (Il raggruppamento è già ristretto al singolo canale, perché
            //    questo metodo viene chiamato per ogni lista/canale.)
            // ============================================================

            var gruppi = records.GroupBy(r => new
            {
                tipoOfferta   = r.ContainsKey("tipo_offerta")   ? r["tipo_offerta"].ToString()   : "",
                codiceReparto = r.ContainsKey("reparto") ? r["reparto"].ToString() : "",
                codiceSettore = r.ContainsKey("settore") ? r["settore"].ToString() : "",
                prezzoPromo   = r.ContainsKey("prezzo_promo")   ? r["prezzo_promo"].ToDecimal()  : 0m
            });

            foreach (var g in gruppi)
            {
                List<Dictionary<string, object>> membri = g.ToList();

                // codice_gruppo = concatenazione ordinata dei codici referenza del gruppo
                // (confermato). Un gruppo con una sola riga ottiene quindi il proprio
                // singolo codice referenza.
                string codiceGruppo = string.Join(",", membri
                    .Select(m => m[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString())
                    .OrderBy(c => c));

                foreach (var m in membri)
                {
                    if (!m.ContainsKey(GLOBAL_VARIABLES_FICO.keyCodiceGruppo))
                    {
                        m[GLOBAL_VARIABLES_FICO.keyCodiceGruppo] = codiceGruppo;
                        m[GLOBAL_VARIABLES_FICO.keySottoGruppo] = codiceGruppo;
                    }
                    else
                    {
                        //Se invece il codice gruppo è definito significa che è gia stato deciso e quindi qui va fatta la sovrascrittura del sotto gruppo che per Famila eredita sempre preciso da gruppo
                        m[GLOBAL_VARIABLES_FICO.keySottoGruppo] = m[GLOBAL_VARIABLES_FICO.keyCodiceGruppo];
                    }
                }
            }

            // TODO FAMILA (linea): da esaminare. Eventuale marcatura is_linea = "x"
            //   sui gruppi che soddisfano un criterio ancora da definire.
            //   Per ora nessuna linea: tutti i record restano con is_linea = ""
            //   (già impostato in importaTracciato).

            return records;
        }

        // ================================================================
        // Determina il "box" (meccanica di impaginazione) di una referenza.
        //   PN                         -> BOX_STD
        //   FN                         -> BOX_FID
        //   note contiene "etruria"    -> BOX_ETRURIA
        //   nome_evento contiene "sottocosto" -> BOX_SOTTOCOSTO
        // Precedenza (confermata): gli eventi speciali (sottocosto, etruria)
        //   hanno priorità sul tipo_offerta. Fallback: BOX_STD.
        // ================================================================
        private string GetCodiceBoxFamila(Dictionary<string, object> recItem)
        {
            string tipoOfferta = recItem.ContainsKey("tipo_offerta") ? recItem["tipo_offerta"].ToString() : "";
            string note        = recItem.ContainsKey("note") && recItem["note"] != null ? recItem["note"].ToString().ToLower() : "";
            string nomeEvento  = recItem.ContainsKey("nome_evento") && recItem["nome_evento"] != null ? recItem["nome_evento"].ToString().ToLower() : "";

            if (nomeEvento.Contains("sottocosto")) return "BOX_SOTTOCOSTO";
            if (note.Contains("etruria"))          return "BOX_ETRURIA";
            if (tipoOfferta == "FN")               return "BOX_FID";

            // "PN" o qualsiasi altro caso non riconosciuto -> standard.
            return "BOX_STD";
        }

        // ================================================================
        // Helper — lettura difensiva di un campo del record.
        // Restituisce "" se la chiave manca o il valore è null.
        // ================================================================
        private static string Campo(Dictionary<string, object> recItem, string chiave)
        {
            return (recItem.ContainsKey(chiave) && recItem[chiave] != null)
                ? recItem[chiave].ToString().Trim()
                : "";
        }

        // ================================================================
        // Helper — aggiunta di un logo/bollo alla lista del record.
        //   - cerca la sigla nel DB; se non c'è, non fa nulla (nessuna eccezione)
        //   - aggiunge sempre un Clone(), mai l'istanza del DB, altrimenti
        //     record diversi condividerebbero lo stesso oggetto
        //   - evita i doppioni (in COOP logo_ecologico usciva due volte perché
        //     era ripetuto nell'array dei flag e non c'era deduplica)
        // Restituisce true se il logo è stato effettivamente aggiunto.
        // ================================================================
        private static bool AggiungiLogo(List<LogoBollo> lista, DbLoghiBolli db, string sigla)
        {
            if (lista == null || db == null || string.IsNullOrWhiteSpace(sigla))
                return false;

            if (lista.Any(l => string.Equals(l.sigla, sigla, StringComparison.OrdinalIgnoreCase)))
                return false;

            LogoBollo lb = db.source.FirstOrDefault(x => string.Equals(x.sigla, sigla, StringComparison.OrdinalIgnoreCase));
            if (lb == null)
                return false;

            lista.Add((LogoBollo)lb.Clone());
            return true;
        }

        // ================================================================
        // Helper — lettura di una descrizione (1..4).
        //   Le descrizioni arrivano in DUE forme: annidate in
        //   "descrizione_gruppo" per i record di gruppo, piatte su recItem
        //   altrimenti. Va usato questo helper OVUNQUE servano le descrizioni
        //   (composizione testi e regole loghi), altrimenti sui gruppi si
        //   legge vuoto.
        //   NB: non fa Trim() — il blocco descrizioni si basa sugli spazi
        //   iniziali per la separazione.
        // ================================================================
        private static string LeggiDescrizione(Dictionary<string, object> recItem, int n)
        {
            string chiave = $"Descrizioni.Descrizione{n}";

            if (recItem.ContainsKey("descrizione_gruppo") && recItem["descrizione_gruppo"] is Dictionary<string, object> dg)
                return (dg.ContainsKey(chiave) && dg[chiave] != null) ? dg[chiave].ToString() : "";

            return (recItem.ContainsKey(chiave) && recItem[chiave] != null) ? recItem[chiave].ToString() : "";
        }

        // ================================================================
        // Helper — normalizzazione di un testo per la ricerca di parole chiave.
        //   - minuscolo (ricerche sempre case-insensitive)
        //   - marcatori di a capo (<br>, $br, newline) -> spazio, altrimenti
        //     "PROSCIUTTO<br>DOP" non risulterebbe circondato da spazi
        //   - imbottitura con uno spazio davanti e dietro, così cercando
        //     " dop " si intercetta anche una parola a inizio o fine stringa
        // ================================================================
        private static string NormalizzaPerRicerca(string s)
        {
            if (string.IsNullOrEmpty(s)) return " ";

            string t = s.ToLower()
                        .Replace("<br>", " ")
                        .Replace("$br", " ")
                        .Replace("\r", " ")
                        .Replace("\n", " ")
                        .Replace("\t", " ");

            // Spazi multipli -> uno solo, così "30  mesi" equivale a "30 mesi".
            while (t.Contains("  "))
                t = t.Replace("  ", " ");

            return " " + t + " ";
        }

        public TracciatoResultKit esportaVolantino(List<FicoContextField> promoContext, List<FicoContextField> tracciatoContext, List<ArticoloInKit> tracciato, FicoRuntimeKit kit, string pathNamingConvention, string pathACPV, string pathTipiDiExport, string pathOrdinamentoLista, string pathMeccaniche, string pathLoghiBolli, string pathMappaStili, FicoCombinazioneKitReadMode readMode)
        {
            // Cultura it-IT (formattazione decimale di prezzi/sconti).
            CultureInfo culture = new CultureInfo("it-IT");
            CultureInfo.CurrentCulture = culture;

            // Risultato: un'unica lista di export (struttura come COOP).
            TracciatoResultKit result = new TracciatoResultKit();
            TracciatoKit tracciato_da_esportare = new TracciatoKit();
            result.liste = new List<TracciatoKit>() { tracciato_da_esportare };
            result.liste[0].Records = new List<ArticoloInKit>();
            result.liste[0].errors = "";

            int counter = 0;

            try
            {
                // ========================================================
                // BLOCCO 1 — Caricamento configurazioni
                //   TODO FAMILA: decidere quali file servono davvero.
                //   In COOP: ordinamento, ACPV, loghi/bolli, tipi export,
                //   naming convention.
                // ========================================================
                DbACPV areeDB = JObject.Parse(File.ReadAllText(pathACPV)).ToObject<DbACPV>();

                // DB loghi/bolli: la ricerca avviene sempre per campo "sigla".
                DbLoghiBolli loghibolliDB = JObject.Parse(File.ReadAllText(pathLoghiBolli)).ToObject<DbLoghiBolli>();

                // Tipi di export e naming convention: servono al BLOCCO 2 per comporre
                // i nomi file che il plug-in si aspetta di trovare sul record.
                // pathOrdinamentoLista non serve in esportazione.
                DbTipoDiExport tipiExportDB = JObject.Parse(File.ReadAllText(pathTipiDiExport)).ToObject<DbTipoDiExport>();
                FicoNamingConvention ncDB = JObject.Parse(File.ReadAllText(pathNamingConvention)).ToObject<FicoNamingConvention>();

                // NIENTE prefisso di cartella sugli stili di paragrafo.
                // Qui c'era la convenzione di Coop, arrivata copiando Coopfi.cs: per le aree
                // diverse da "A" anteponeva "<sigla>." al nome dello stile, perche' nei
                // documenti di Coop ogni area ha un suo gruppo di stili di paragrafo.
                // Famila non funziona cosi': ha una sola area, "TOS" (Toscana), e nei suoi
                // documenti gli stili stanno tutti nella radice. Il plugin (utility.js,
                // parseStile) interpreta il punto come "gruppo.stile", quindi il nome
                // "TOS.SCONTO" veniva cercato in un gruppo TOS inesistente: parseStile
                // restituiva null e la preanalisi segnalava un mismatch di stile su ogni box
                // con txt_sconto. Il prefisso per giunta era applicato a uno solo dei dieci
                // campi compilati, quindi gli stili sarebbero finiti meta' nel gruppo e meta'
                // nella radice. Se un domani Famila avesse piu' aree con i rispettivi gruppi,
                // il prefisso va rimesso su TUTTI gli stili di paragrafo, non su uno.

                // Chiave del campo "codice box" sul record: è il valore che l'impaginazione
                // usa per scegliere il box. NON basta calcolare la meccanica in una locale:
                // va riscritta qui sopra, altrimenti stili e box divergono.
                string key_codiceBox = Edro21Context.Meta.keyCodiceBox;

                // ========================================================
                // BLOCCO 2 — Nomi file di export (naming convention)
                //   Si incrociano i tipi di export richiesti dal kit con quelli
                //   configurati per il cliente. Il nome vero NON si compone qui:
                //   la combinazione di Famila include il codice referenza, quindi
                //   cambia record per record e si decodifica nel BLOCCO 4c.
                // ========================================================
                List<TipoDiExport> tipiExportDelKit = new List<TipoDiExport>();
                foreach (TipoDiExportInKit tItemInKit in kit.tipiDiExportInKit)
                {
                    TipoDiExport tItem = tipiExportDB.source.FirstOrDefault(w => w.guidID == tItemInKit.tipoDiExportGuidID);
                    if (tItem != null)
                        tipiExportDelKit.Add(tItem);
                }

                // Interprete che accumula i "compiled field" (testi con tag di
                // stile per InDesign) di ciascun record.
                CompiledFieldInterpreter interprete = new CompiledFieldInterpreter();

                // Cache delle foto secondarie per gruppo: lo stesso codice_gruppo
                // ricorre su più record, quindi si ricalcola solo quando cambia.
                string curr_group_processed = null;
                List<FotoElementoGruppo> _cacheFotoSecondarie = new List<FotoElementoGruppo>();

                // ========================================================
                // BLOCCO 3 — Ciclo sui record
                // ========================================================
                for (int i = 0; i < tracciato.Count; i++)
                {
                    ArticoloInKit artInKit = tracciato[i];
                    Dictionary<string, object> recItem = artInKit.recordInTracciato;

                    // ----- Blocco 3a: esclusione record con tipo_offerta = "SS" -----
                    string tipoOfferta = recItem.ContainsKey("tipo_offerta") ? recItem["tipo_offerta"].ToString() : "";
                    if (tipoOfferta == "SS")
                        continue;

                    // Blocco 3b: nessun gate -> tutti i record vengono impaginati.

                    // ====================================================
                    // BLOCCO 4 — Regole di impaginazione (compiled fields)
                    //   Si costruiscono i campi formattati (prezzo_promo, sconto,
                    //   descrizione, prezzo al kg, loghi, punti...) tramite
                    //   interprete.assignCompiledField(nome, stile, valore),
                    //   RAMIFICANDO per meccanica (Famila ha meccaniche diverse).
                    //   TODO FAMILA: definire l'elenco delle meccaniche e, per
                    //   ciascuna, i campi da comporre. Da fare insieme.
                    // ====================================================
                    // Determinazione del box (meccanica) di impaginazione:
                    string codiceBox = GetCodiceBoxFamila(recItem);

                    // Riscrittura sul record: è QUESTO il valore letto dall'impaginazione.
                    // Senza di essa il box resta quello impostato a monte (tipicamente
                    // BOX_STD) mentre gli stili qui sotto seguono la meccanica calcolata,
                    // producendo box STD con grafica FID/ETRURIA/SOTTOCOSTO.
                    //
                    // Guardia: si sovrascrive solo se il record non ha ancora un box
                    // oppure ne ha uno di competenza dello script (_boxGestiti). Un box
                    // strutturale/di servizio impostato a monte non lo decide la meccanica
                    // commerciale, quindi resta com'è; in quel caso si riallinea la locale
                    // così anche gli stili seguono il box realmente impaginato.
                    string boxPreesistente = (recItem.ContainsKey(key_codiceBox) && recItem[key_codiceBox] != null)
                        ? recItem[key_codiceBox].ToString().Trim()
                        : "";

                    if (boxPreesistente == "" || _boxGestiti.Contains(boxPreesistente))
                    {
                        recItem[key_codiceBox] = codiceBox;
                    }
                    else
                    {
                        codiceBox = boxPreesistente;
                    }

                    // ====================================================
                    // BLOCCO 4b — Loghi e bolli
                    //   I loghi NON sono compiled field: non hanno stili né tag.
                    //   Si accumulano in una lista e finiscono in un unico campo
                    //   del record, da cui l'impaginazione li piazza come immagini.
                    //   Usare sempre AggiungiLogo(...): gestisce sigla assente,
                    //   Clone() e deduplica.
                    //
                    //   Regole Famila, tutte nuove (nessuna ereditata da COOP).
                    //   NB: a differenza di COOP, Famila NON ha colonne-flag sul
                    //   tracciato (il classico logo_xxx = "x"): tutti i loghi sono
                    //   dedotti da altri campi o dal testo delle descrizioni.
                    // ====================================================
                    List<LogoBollo> _bolliloghi = new List<LogoBollo>();

                    // ----- 4b.1 Regole su campi del record -----

                    // LOGO SURGELATI -> codice_reparto uguale a "50".
                    //   Confronto su stringa, come già fa il resto del file per
                    //   i reparti 44/46/48/52/54.
                    if (Campo(recItem, "codice_reparto") == "50")
                        AggiungiLogo(_bolliloghi, loghibolliDB, "Logo_Surgelati");

                    // ----- 4b.2 Regole derivate dal testo delle descrizioni -----

                    // Descrizioni normalizzate per la ricerca (minuscolo, a capo ->
                    // spazio, imbottite di spazi). Lette con l'helper: gestisce i gruppi.
                    string descr1Ric = NormalizzaPerRicerca(LeggiDescrizione(recItem, 1));
                    string descr2Ric = NormalizzaPerRicerca(LeggiDescrizione(recItem, 2));
                    string descr3Ric = NormalizzaPerRicerca(LeggiDescrizione(recItem, 3));

                    // LOGO DOP -> Descrizione1 contiene " dop " (isolata da spazi,
                    //   per non pescare "doppia"/"doppio"/"dopo") oppure la variante
                    //   puntata "d.o.p.", che invece si cerca libera perché i punti
                    //   la rendono già inequivocabile.
                    if (descr1Ric.Contains(" dop ") || descr1Ric.Contains("d.o.p."))
                        AggiungiLogo(_bolliloghi, loghibolliDB, "Logo_Dop");

                    // LOGO SELEX -> Descrizione1 contiene "selex".
                    //   Ricerca libera: è un marchio, non ha parole che lo contengono.
                    if (descr1Ric.Contains("selex"))
                        AggiungiLogo(_bolliloghi, loghibolliDB, "Logo_Selex");

                    // BOLLO 30 MESI PARMIGIANO -> Descrizione1 contiene
                    //   "30 mesi" (anche con più spazi, già compressi) o "30mesi".
                    if (descr1Ric.Contains("30 mesi") || descr1Ric.Contains("30mesi"))
                        AggiungiLogo(_bolliloghi, loghibolliDB, "Bollo_30mesi_parmigiano");

                    // BOLLO ZERO ALCOL -> Descrizione1 contiene "alcohol free".
                    if (descr1Ric.Contains("alcohol free"))
                        AggiungiLogo(_bolliloghi, loghibolliDB, "Bollo_0Alcol_verde");

                    // LOGO SENZA GLUTINE -> Descrizione1 contiene una delle tre
                    //   varianti: "s/g", "senza glutine", "s.glutine".
                    if (descr1Ric.Contains("s/g") ||
                        descr1Ric.Contains("senza glutine") ||
                        descr1Ric.Contains("s.glutine"))
                        AggiungiLogo(_bolliloghi, loghibolliDB, "Logo_SenzaGlutine");

                    // TODO FAMILA: regole successive.

                    // Consegna della lista al record (campo letto dall'impaginazione).
                    recItem[GLOBAL_VARIABLES.keyFotoExtraAuto] = _bolliloghi;

                    // ====================================================
                    // BLOCCO 4c — Foto secondarie di gruppo
                    //   Stessa architettura dei loghi: una lista in un campo del
                    //   record, che l'impaginazione consuma.
                    //
                    //   REGOLA FAMILA: se il gruppo è composto da DUE elementi
                    //   escono entrambe le foto (primaria + secondaria); in tutti
                    //   gli altri casi esce solo la primaria, quindi la lista
                    //   delle secondarie resta vuota.
                    //   La condizione è verificata qui esplicitamente e non
                    //   delegata a getFotoSecondarieDelGruppo, così la regola
                    //   resta leggibile e indipendente da cosa fa l'helper.
                    // ====================================================
                    string codiceGruppoRec = Campo(recItem, GLOBAL_VARIABLES_FICO.keyCodiceGruppo);

                    if (codiceGruppoRec != curr_group_processed)
                    {
                        List<Dictionary<string, object>> membriGruppo = tracciato
                            .Where(t => Campo(t.recordInTracciato, GLOBAL_VARIABLES_FICO.keyCodiceGruppo) == codiceGruppoRec)
                            .Select(t => t.recordInTracciato)
                            .ToList();

                        _cacheFotoSecondarie = (membriGruppo.Count == 2)
                            ? RefsHelper.getFotoSecondarieDelGruppo(membriGruppo)
                            : new List<FotoElementoGruppo>();

                        curr_group_processed = codiceGruppoRec;
                    }

                    // Copia della lista (non l'istanza in cache): i record del gruppo
                    // non devono condividere lo stesso oggetto.
                    recItem[GLOBAL_VARIABLES_FICO.keyMembriGruppoFoto] = new List<FotoElementoGruppo>(_cacheFotoSecondarie);

                    // ====================================================
                    // BLOCCO 4a — Stili per meccanica (box)
                    //   Convenzione: il 2° parametro di assignCompiledField è lo
                    //   stile di PARAGRAFO; i tag <STILE>…</STILE> dentro il valore
                    //   sono stili di CARATTERE.
                    //   I nomi base (senza suffisso) valgono per BOX_STD e per
                    //   qualsiasi box non riconosciuto.
                    // ====================================================
                    string stileParagPrezzoPromo  = "PREZZO_PROMO";      // paragrafo
                    string stileCarPrezzoContinuo = "PREZZO_CONTINUO";   // carattere
                    string stileCarPrezzoKgl      = "PREZZO_PROMO_KGL";  // carattere
                    string stileParagSconto       = "SCONTO";            // paragrafo
                    string suffissoDescr          = "";                  // suffisso stili di carattere delle descrizioni

                    switch (codiceBox)
                    {
                        case "BOX_FID":
                            stileParagPrezzoPromo  = "PREZZO_PROMO_FID";
                            stileCarPrezzoContinuo = "PREZZO_CONTINUO_FID";
                            // prezzo_promo_kgl, txt_sconto e descrizioni: stili base.
                            break;

                        case "BOX_ETRURIA":
                            stileParagPrezzoPromo  = "PREZZO_PROMO_ETRURIA";
                            stileCarPrezzoContinuo = "PREZZO_CONTINUO_ETRURIA";
                            stileCarPrezzoKgl      = "PREZZO_PROMO_KGL_ETRURIA";
                            suffissoDescr          = "_ETRURIA";
                            // txt_sconto: stile base.
                            break;

                        case "BOX_SOTTOCOSTO":
                            stileParagPrezzoPromo  = "PREZZO_PROMO_SC";
                            stileCarPrezzoContinuo = "PREZZO_CONTINUO_SC";
                            stileCarPrezzoKgl      = "PREZZO_PROMO_KGL_SC";
                            stileParagSconto       = "SCONTO_SC";
                            suffissoDescr          = "_SC";
                            break;
                    }

                    switch (codiceBox)
                    {
                        case "BOX_STD":
                        case "BOX_FID":        // FID: stessa gestione di STD, cambia solo la grafica
                        case "BOX_ETRURIA":    // ETRURIA: come STD, ma prezzo_promo è "<val> €"
                        case "BOX_SOTTOCOSTO": // SOTTOCOSTO: come STD, ma txt_sconto è "-<val>%"
                        default:
                            {
                                // ----- prezzo_promo (stile di paragrafo: stileParagPrezzoPromo) -----
                                //   BOX_STD / BOX_FID: "€ <val>"   |   BOX_ETRURIA: "<val> €"
                                decimal prezzoPromo = recItem.ContainsKey("prezzo_promo") ? recItem["prezzo_promo"].ToDecimal() : 0m;
                                string prezzoPromoStr = (codiceBox == "BOX_ETRURIA")
                                    ? $"{MathExt.DecimalRoundToString(prezzoPromo)} €"
                                    : $"€ {MathExt.DecimalRoundToString(prezzoPromo)}";
                                interprete.assignCompiledField("prezzo_promo", stileParagPrezzoPromo, prezzoPromoStr);

                                // ----- prezzo_promo_kgl (stile di carattere: stileCarPrezzoKgl) -----
                                //   NON esce se um == "PZ" oppure codice_reparto ∈ {44, 46, 48}.
                                string um = recItem.ContainsKey(GLOBAL_VARIABLES.keyDescrUm) && recItem[GLOBAL_VARIABLES.keyDescrUm] != null
                                    ? recItem[GLOBAL_VARIABLES.keyDescrUm].ToString() : "";
                                string codiceReparto = recItem.ContainsKey("codice_reparto") && recItem["codice_reparto"] != null
                                    ? recItem["codice_reparto"].ToString() : "";
                                string umRp = recItem.ContainsKey("um_rp") && recItem["um_rp"] != null
                                    ? recItem["um_rp"].ToString() : "";

                                bool kglNonEsce = (um == "PZ") || codiceReparto == "44" || codiceReparto == "46" || codiceReparto == "48";
                                if (!kglNonEsce)
                                {
                                    if (umRp != "PZ")
                                    {
                                        if (codiceReparto == "52" || codiceReparto == "54")
                                        {
                                            // Reparto 52/54: prezzo espresso ALL'ETTO.
                                            //   - prezzo_promo = prezzo_promo / 10 (ri-assegno, formato per box)
                                            //   - prezzo_promo_kgl = "al kg € <prezzo_promo_kgl>"
                                            decimal prezzoPromoEtto = prezzoPromo / 10m;
                                            string prezzoPromoEttoStr = (codiceBox == "BOX_ETRURIA")
                                                ? $"{MathExt.DecimalRoundToString(prezzoPromoEtto)} €"
                                                : $"€ {MathExt.DecimalRoundToString(prezzoPromoEtto)}";
                                            interprete.assignCompiledField("prezzo_promo", stileParagPrezzoPromo, prezzoPromoEttoStr);

                                            decimal prezzoKglEtto = recItem.ContainsKey("prezzo_promo_kgl") ? recItem["prezzo_promo_kgl"].ToDecimal() : 0m;
                                            interprete.assignCompiledField("prezzo_promo_kgl", "", $"<{stileCarPrezzoKgl}>al kg € {MathExt.DecimalRoundToString(prezzoKglEtto)}</{stileCarPrezzoKgl}>");
                                        }
                                        else
                                        {
                                            // Prodotto sfuso: solo "al <um>" (minuscolo), senza prezzo.
                                            interprete.assignCompiledField("prezzo_promo_kgl", "", $"<{stileCarPrezzoKgl}>al {um.ToLower()}</{stileCarPrezzoKgl}>");
                                        }
                                    }
                                    else
                                    {
                                        // "al <um> € <valore>" (minuscolo), valore dalla colonna prezzo_promo_kgl.
                                        decimal prezzoKgl = recItem.ContainsKey("prezzo_promo_kgl") ? recItem["prezzo_promo_kgl"].ToDecimal() : 0m;
                                        interprete.assignCompiledField("prezzo_promo_kgl", "", $"<{stileCarPrezzoKgl}>al {um.ToLower()} € {MathExt.DecimalRoundToString(prezzoKgl)}</{stileCarPrezzoKgl}>");
                                    }
                                }
                                // else: il campo non viene mostrato.

                                // ----- box_sconto / txt_sconto / prezzo_continuo -----
                                //   La % di sconto sta nel testo di azione_pubblico.
                                //   - Se azione_pubblico contiene una "%": box_sconto è visibile,
                                //     txt_sconto (label interna al box_sconto) prende la % estratta
                                //     (intero arrotondato per difetto, senza "-"), e prezzo_continuo esce.
                                //   - Altrimenti: box_sconto (con dentro txt_sconto) e prezzo_continuo
                                //     non si vedono.
                                string azionePubblico = recItem.ContainsKey("azione_pubblico") && recItem["azione_pubblico"] != null
                                    ? recItem["azione_pubblico"].ToString() : "";
                                bool scontoInAzionePubblico = azionePubblico.Contains("%");

                                if (scontoInAzionePubblico)
                                {
                                    // txt_sconto: % estratta da azione_pubblico, intero floor, senza "-".
                                    var mSconto = System.Text.RegularExpressions.Regex.Match(azionePubblico, @"(\d+(?:[.,]\d+)?)\s*%");
                                    if (mSconto.Success)
                                    {
                                        decimal scontoDec = decimal.Parse(mSconto.Groups[1].Value.Replace(',', '.'), CultureInfo.InvariantCulture);
                                        int scontoInt = (int)Math.Floor(scontoDec);
                                        // BOX_SOTTOCOSTO: sconto con "-" davanti; altrimenti senza segno.
                                        string segnoSconto = (codiceBox == "BOX_SOTTOCOSTO") ? "-" : "";
                                        interprete.assignCompiledField("txt_sconto", stileParagSconto, $"{segnoSconto}{scontoInt}%");
                                    }

                                    // prezzo_continuo: "invece di € X".
                                    decimal prezzoContinuo = recItem.ContainsKey("prezzo_continuo") ? recItem["prezzo_continuo"].ToDecimal() : 0m;
                                    if (prezzoContinuo >= 0 && prezzoContinuo != prezzoPromo)
                                    {
                                        interprete.assignCompiledField("prezzo_continuo", "", $"<{stileCarPrezzoContinuo}>invece di € {MathExt.DecimalRoundToString(prezzoContinuo)}</{stileCarPrezzoContinuo}>");
                                    }
                                    else
                                    {
                                        interprete.removeCompiledField("prezzo_continuo");
                                    }
                                    // box_sconto resta visibile (non viene rimosso).
                                }
                                else
                                {
                                    // Nessuna "%" in azione_pubblico: box_sconto (con txt_sconto) e
                                    // prezzo_continuo non si vedono.
                                    interprete.removeCompiledField("box_sconto");
                                    interprete.removeCompiledField("prezzo_continuo");
                                }

                                // ----- descrizione (Descrizione1..4 con i rispettivi stili) -----
                                //   FAMILA: ordine di uscita 1,2,3,4 (in COOP è 1,2,4,3:
                                //   Descrizione3 e Descrizione4 risultano invertite rispetto a COOP).
                                //   <br>/$br -> a capo; spazio di separazione;
                                //   ciascuna avvolta nel proprio stile DI CARATTERE.
                                //   (Rimosse le diciture dei box non presenti in Famila:
                                //    MAX_PEZZI, DESCRIZIONE_PREZZO_SP, prefisso LINEA.)
                                //   suffissoDescr: "" per STD/FID, "_ETRURIA" o "_SC".
                                string stileDescr1 = "DESCRIZIONE_TITOLO" + suffissoDescr;
                                string stileDescr2 = "DESCRIZIONE_BRAND" + suffissoDescr;
                                string stileDescr3 = "DESCRIZIONE_TIPO" + suffissoDescr;
                                string stileDescr4 = "DESCRIZIONE_GRAMMATURA" + suffissoDescr;
                                string stileParagDescr = "";

                                string Descrizione1 = LeggiDescrizione(recItem, 1);
                                string Descrizione2 = LeggiDescrizione(recItem, 2);
                                string Descrizione3 = LeggiDescrizione(recItem, 3);
                                string Descrizione4 = LeggiDescrizione(recItem, 4);

                                // <br> e $br -> a capo
                                Descrizione1 = Descrizione1.Replace("<br>", "\n").Replace("$br", "\n");
                                Descrizione2 = Descrizione2.Replace("<br>", "\n");
                                Descrizione3 = Descrizione3.Replace("<br>", "\n");
                                Descrizione4 = Descrizione4.Replace("<br>", "\n");

                                // Spazio di separazione (come COOP)
                                if (Descrizione2 != "")
                                {
                                    Descrizione2 = Descrizione2.Replace("$br", "\n");
                                    Descrizione2 = ((!Descrizione2.StartsWith(" ") && !Descrizione2.StartsWith("\n") && !Descrizione2.StartsWith(Environment.NewLine)) ? " " : "") + Descrizione2;
                                }
                                if (Descrizione3 != "")
                                {
                                    Descrizione3 = Descrizione3.Replace("$br", "\n");
                                    Descrizione3 = ((!Descrizione3.StartsWith(" ") && !Descrizione3.StartsWith("\n") && !Descrizione3.StartsWith(Environment.NewLine)) ? " " : "") + Descrizione3;
                                }
                                if (Descrizione4 != "")
                                {
                                    Descrizione4 = Descrizione4.Replace("$br", "\n");
                                    Descrizione4 = ((!Descrizione4.StartsWith(" ") && !Descrizione4.StartsWith("\n") && !Descrizione4.StartsWith(Environment.NewLine)) ? " " : "") + Descrizione4;
                                }

                                // Composizione con gli stili di carattere (ordine 1, 2, 3, 4)
                                //   NB: rispetto a COOP (1,2,4,3) le posizioni 3 e 4 sono invertite.
                                //   Il contenuto resta legato al proprio stile: Descrizione3 esce
                                //   sempre con DESCRIZIONE_TIPO e Descrizione4 con DESCRIZIONE_GRAMMATURA.
                                string descrizione = "";
                                if (Descrizione1 != "") descrizione  = $"<{stileDescr1}>{Descrizione1}</{stileDescr1}>";
                                if (Descrizione2 != "") descrizione += $"<{stileDescr2}>{Descrizione2}</{stileDescr2}>";
                                if (Descrizione3 != "") descrizione += $"<{stileDescr3}>{Descrizione3}</{stileDescr3}>";
                                if (Descrizione4 != "") descrizione += $"<{stileDescr4}>{Descrizione4}</{stileDescr4}>";

                                // stileParagDescr = stile di PARAGRAFO del campo "descrizione"
                                //   ("" = nessuno stile di paragrafo forzato; contano solo
                                //    gli stili di carattere dei tag qui sopra).
                                interprete.assignCompiledField("descrizione", stileParagDescr, descrizione);
                            }
                            break;
                    }

                    // Estrazione e salvataggio dei compiled field sul record,
                    // poi reset dell'interprete per il record successivo.
                    var fields = interprete.getFields();
                    recItem["compiledFields"] = fields.compiledFields;
                    recItem["deletedFields"] = fields.deletedFields;
                    interprete.clearInterpreter();


                    // ====================================================
                    // BLOCCO 4c — Nomi file di export per questo record
                    //   Il plug-in legge recordInTracciato["Kit.Names"] per sapere
                    //   come chiamare il PDF di ciascun tipo di export. Se manca,
                    //   l'esportazione muore su names.find(...) senza spiegazioni:
                    //   il controllo di sicurezza nel plug-in e' commentato.
                    // ====================================================
                    List<IstantaLib.ArticoloInKitExportName> _names = new List<IstantaLib.ArticoloInKitExportName>();
                    foreach (TipoDiExport tItem in tipiExportDelKit)
                    {
                        IstantaLib.ArticoloInKitExportName codifica = new IstantaLib.ArticoloInKitExportName();
                        codifica.guidIdTipoExport = tItem.guidID;
                        codifica.nomeFile = NamingConventionUtility.Decode(tItem, promoContext, tracciatoContext,
                                                kit, areeDB, ncDB, null, recItem, this, null);
                        _names.Add(codifica);
                    }
                    recItem[GLOBAL_VARIABLES_FICO.keyFicoNames] = _names;

                    counter++;
                    result.liste[0].Records.Add(tracciato[i]);
                }

                // ========================================================
                // BLOCCO 5 — Chiusura
                // ========================================================
                if (counter <= 0)
                {
                    result.errors += "Nessun articolo della lista corrisponde ai requisiti di esportazione.";
                    result.errorCode = ErrorCodesFico.ListaAzzerataInEsportazione;
                }
            }
            catch (Exception ex)
            {
                result.errors = ex.ToString();
                Console.WriteLine("Export Famila error (liv1): " + ex.ToString());
            }

            return result;
        }

        public TracciatoResultKit esportaPoP(List<FicoContextField> promoContext, List<FicoContextField> tracciatoContext, List<ArticoloInKit> tracciato, FicoRuntimeKit kit, string pathNamingConvention, string pathACPV, string pathTipiDiExport, string pathOrdinamentoLista, string pathMeccaniche, string pathLoghiBolli, string pathFormati, string pathMappaStili, FicoCombinazioneKitReadMode readMode)
        {
            throw new NotImplementedException();
        }

        public string getAlterazioniTracciatoFromIndd(List<Dictionary<string, object>> gruppo, Dictionary<string, object> articoloIndd)
        {
            throw new NotImplementedException();
        }

        public string eseguiAutoSelezioneGruppo(List<Dictionary<string, object>> gruppo, List<Dictionary<string, object>> ghost)
        {
            // ============================================================
            // Selezione primaria/secondaria del gruppo per il menabò.
            //   REGOLA FAMILA: la PRIMARIA è il PRIMO articolo del gruppo che
            //   ha una FOTO ESISTENTE (dato vero già presente sul record,
            //   letto da keyHasFoto). Così non si elegge come rappresentante
            //   una referenza senza foto, che a valle farebbe scattare il
            //   fallback "no_imag.png" dell'impaginazione.
            //   Fallback: se NESSUN articolo del gruppo ha foto, la primaria
            //   resta il primo elemento (il gruppo deve comunque avere un
            //   rappresentante).
            // ============================================================
            var pilota = gruppo.FirstOrDefault(HaFoto) ?? gruppo.FirstOrDefault();

            if (pilota != null)
            {
                if (gruppo.Count == 2)
                {
                    // La secondaria è l'ALTRO elemento del gruppo: ora che il
                    // pilota può non essere gruppo[0], va individuato per differenza
                    // così non si marca due volte lo stesso record.
                    var secondario = ReferenceEquals(gruppo[0], pilota) ? gruppo[1] : gruppo[0];
                    secondario[GLOBAL_VARIABLES.keyXMLSelezione] = (Byte)TipoSelezioneMenabo.Secondaria;
                }

                pilota[GLOBAL_VARIABLES.keyXMLSelezione] = (Byte)TipoSelezioneMenabo.Primaria;
            }


            string result = JsonConvert.SerializeObject(gruppo);

            return result;
        }

        // ================================================================
        // Helper — la referenza ha una foto esistente?
        //   Il dato vero (foto presente sì/no) arriva già sul record da
        //   importaTracciato ed è veicolato da GLOBAL_VARIABLES.keyHasFoto.
        //   Lettura difensiva: chiave assente / null / non booleana -> false.
        // ================================================================
        private static bool HaFoto(Dictionary<string, object> rec)
        {
            string val = (rec.ContainsKey(GLOBAL_VARIABLES.keyHasFoto) && rec[GLOBAL_VARIABLES.keyHasFoto] != null)
                ? rec[GLOBAL_VARIABLES.keyHasFoto].ToString()
                : "false";
            return Boolean.TryParse(val, out bool b) && b;
        }

        public List<List<Dictionary<string, object>>> eseguiAutoSelezioneGruppoMassiva(List<List<Dictionary<string, object>>> gruppo, List<Dictionary<string, object>> ghost)
        {
            //Console.WriteLine(".eseguiAutoSelezioneGruppoMassiva 2 " + gruppo.Count);
            int inx = 0;
            foreach (var gruppoSingolo in gruppo)
            {
                try
                {
                    string resGruppo = eseguiAutoSelezioneGruppo(gruppoSingolo, ghost);
                    List<Dictionary<string, object>> resultExtDict = JsonConvert.DeserializeObject<List<Dictionary<string, object>>>(resGruppo);
                    foreach (var el in resultExtDict)
                    {
                        var refSingola = gruppoSingolo.FirstOrDefault(g => g[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString() == el[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString());
                        if (el.ContainsKey(GLOBAL_VARIABLES.keyXMLSelezione))
                        {
                            refSingola[GLOBAL_VARIABLES.keyXMLSelezione] = Byte.Parse(el[GLOBAL_VARIABLES.keyXMLSelezione].ToString());
                        }
                        else
                        {
                            refSingola[GLOBAL_VARIABLES.keyXMLSelezione] = (Byte)TipoSelezioneMenabo.None;
                        }
                    }
                }
                    catch (Exception ex)
                    {
                    Console.WriteLine("AgLib eseguiAutoSelezioneGruppoMassiva # INDEX " + inx + " -> " + ex.ToString());
                }

            inx++;

            }

            return gruppo;
        }

        public AnalisiConfrontoResponse confrontaListe(AnalisiConfrontoTracciatoDetails primario, AnalisiConfrontoTracciatoDetails secondario, bool controlloVersione, Dictionary<string, string> reqParams)
        {
            throw new NotImplementedException();
        }

        public string confrontaListatoVolantino(List<Dictionary<string, object>> primario, Dictionary<string, string> reqParams)
        {
            throw new NotImplementedException();
        }

        public string ordinaLista(List<Dictionary<string, object>> listRecs, string pathOrdinamentoLista)
        {
            return JsonConvert.SerializeObject(listRecs);
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
            throw new NotImplementedException();
        }

        public string callbackNamingConventionDynamicField(string campo, Dictionary<string, object> rec, List<FicoCombinazioniKitDeclinazioneProprieta> propsDeclinazione)
        {
           return "";
        }

        public List<Dictionary<string, object>> elaboraTracciatiRecords(List<Dictionary<string, object>> records, FicoRuntimeKit kit, string pathACPV)
        {
            // Wrapper pubblico (punto d'ingresso dall'esterno, con solo il path ACPV):
            // carica l'ACPV, ricava la sigla dell'area del kit (per guidID) e delega
            // il raggruppamento a elaboraTracciatiRecords_do.
            DbACPV areeDB = JObject.Parse(File.ReadAllText(pathACPV)).ToObject<DbACPV>();
            Area aItem = areeDB.aree.FirstOrDefault(a => a.guidID == kit.guidArea);
            string siglaAreaKit = aItem?.sigla ?? "";
            return elaboraTracciatiRecords_do(records, kit, siglaAreaKit);
        }

        public Dictionary<string, object> elaboraRecordDaClonare(Dictionary<string, object> origin, Dictionary<string, object> chiaviEliminate, SampleKitDiDestinazioneClone sample, string codiceBox, string pathOrdinamentoLista)
        {
            throw new NotImplementedException();
        }

        public List<CambioStrutturale> GetCambioStrutturalePath()
        {
            // Coopfi ha un catalogo di 379 righe di regole SUE. Per Famila non esistono ancora:
            // restituisco una lista vuota invece di lanciare, cosi il plugin riceve "nessuna regola"
            // invece di un errore silenzioso.
            return new List<CambioStrutturale>();
        }

        public string MetaPerRevisione(List<Dictionary<string, object>> recordsGruppo, int idPromo, int idTracciato, string siglaTracciato)
        {
            return null;   // come Coopfi: Famila non usa il meta di revisione
        }

        public EsitoFirmaGarantita CheckFirmaGarantita(List<Dictionary<string, object>> recordsGruppo, string meta)
        {
            throw new NotImplementedException();
        }

        public string GetMetaPerRevisioneDaGruppiMultipli(WrapperPerGetGarante wrap)
        {
            return null;   // come Coopfi
        }

        public string GetMetaPerRevisioneDaGruppiMultipliBatch(WrapperBatchPerGetGarante batch)
        {
            return null;   // come Coopfi
        }

        public List<Dictionary<string, object>> FiltraRecordsPerConteggioRevisione(List<Dictionary<string, object>> records)
        {
            return records;   // come Coopfi: nessun filtro specifico per Famila
        }

        public string CheckFirmaPluginGarantitaBatch(WrapperBatchCheckFirmaPlugin batch)
        {
            return null;   // come Coopfi
        }
    }
}