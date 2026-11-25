using System.Globalization;
using System.Text;
using ClosedXML.Excel;
using System.Text.RegularExpressions;
using ExcelDataReader;
using Newtonsoft.Json.Linq;

namespace Istanta.Utility
{
    /// I20-1269: lo schema di ordinamento della lista (SourceOrdinamentoLista) ricavato da un Excel.
    ///
    /// Prima lo schema si riscriveva a mano, convertendo in oggetti le righe dell'Excel del cliente. Ora
    /// la sezione Excel della pagina Ordinamento carica il file, l'operatore sceglie l'addestramento lista
    /// che ne descrive le colonne e associa ogni campo del primo elemento dello schema a una colonna o a un
    /// valore automatico (%PROG%, %NOW%) o a una formula in stile Excel (=SE([FOOD]="X";...), vedi Formula);
    /// qui si genera un elemento per riga, con i campi e i tipi del
    /// primo elemento. Lo schema non ha la stessa forma per tutti i clienti (Coopfi "lista", Edro21
    /// "source"): l'elenco e' il primo array di oggetti del source. Il resto del source resta com'e', e
    /// l'associazione si scrive sotto "mappaturaExcel" ("bindings" in Coopfi ha un altro significato).
    /// Niente database ne' file: il controller passa il source, le colonne dell'addestramento e l'Excel.
    public static class OrdinamentoDaExcel
    {
        public const string Progressivo = "%PROG%";
        public const string Adesso = "%NOW%";
        public const string ChiaveMappatura = "mappaturaExcel";
        public const string FormatoAdesso = "yyyy-MM-dd'T'HH:mm:ss";

        /// Un'associazione che comincia con "=" e' una formula in stile Excel, calcolata riga per riga
        /// (vedi la sezione "formule" in fondo).
        public const string PrefissoFormula = "=";

        /// L'addestramento tronca i nomi delle colonne a 70 caratteri (TracciatiController.CaricaAddestramento).
        public const int LunghezzaMassimaColonna = 70;

        /// Intestazione e righe di un foglio Excel. Ogni riga ha un valore per colonna dell'intestazione.
        public sealed class TabellaExcel
        {
            public List<string> Colonne { get; set; } = new();
            public List<List<object?>> Righe { get; set; } = new();
        }

        /// Cosa la sezione Excel mostra all'operatore per un addestramento.
        public sealed class Proposta
        {
            public string ChiaveElenco { get; set; } = "";
            public List<string> Campi { get; set; } = new();
            public List<string> Colonne { get; set; } = new();
            public Dictionary<string, string> Mappatura { get; set; } = new();
        }

        /// Una colonna dell'addestramento: il titolo nell'Excel e il nome che le si e' dato in Training
        /// (schema_campi_excel.nome_colonna, per esempio GRUPPO -> Gruppo). La sezione Excel mostra e salva
        /// il nome; le colonne senza nome non si offrono.
        public sealed record ColonnaAddestramento(string Excel, string Nome);

        /// Le colonne con un nome, nome -> titolo nell'Excel (il primo, se due colonne hanno lo stesso nome).
        private static Dictionary<string, string> ColonneConNome(IEnumerable<ColonnaAddestramento> colonne)
        {
            var esito = new Dictionary<string, string>();
            foreach (var c in colonne)
            {
                string nome = (c.Nome ?? "").Trim();
                if (nome != "") esito.TryAdd(nome, NomeColonna(c.Excel ?? ""));
            }
            return esito;
        }

        public sealed class Esito
        {
            public bool Ok { get; set; }
            public string? Errore { get; set; }
            public JObject? Source { get; set; }
            public int Elementi { get; set; }
        }

        // ------------------------------------------------------------------ lettura dell'Excel

        /// Il primo foglio, letto come fa l'addestramento: l'intestazione e' la prima riga che comincia con
        /// una cella piena, e arriva fino alla prima cella vuota. Le righe tutte vuote si saltano.
        public static TabellaExcel Leggi(Stream stream)
        {
            System.Text.Encoding.RegisterProvider(System.Text.CodePagesEncodingProvider.Instance);
            var tabella = new TabellaExcel();
            using var reader = ExcelReaderFactory.CreateReader(stream);
            bool intestazione = false;
            while (reader.Read())
            {
                if (!intestazione)
                {
                    if (reader.FieldCount == 0 || Vuota(reader.GetValue(0))) continue;
                    for (int c = 0; c < reader.FieldCount && !Vuota(reader.GetValue(c)); c++)
                        tabella.Colonne.Add(NomeColonna(reader.GetValue(c)!.ToString()!));
                    intestazione = true;
                    continue;
                }
                var riga = new List<object?>();
                for (int c = 0; c < tabella.Colonne.Count; c++)
                    riga.Add(c < reader.FieldCount ? reader.GetValue(c) : null);
                if (riga.Any(v => !Vuota(v))) tabella.Righe.Add(riga);
            }
            return tabella;
        }

        private static string NomeColonna(string nome)
        {
            nome = nome.Trim();
            return nome.Length > LunghezzaMassimaColonna ? nome.Substring(0, LunghezzaMassimaColonna) : nome;
        }

        private static bool Vuota(object? v) => v == null || v is DBNull || v.ToString()!.Trim() == "";

        // ------------------------------------------------------------------ proposta

        /// L'elenco dello schema: il primo array di oggetti del source che ha almeno un elemento
        /// ("lista" per Coopfi, "source" per Edro21). Null se non ce n'e' nessuno.
        public static string? ChiaveElenco(JObject source)
        {
            foreach (var p in source.Properties())
                if (p.Value is JArray a && a.Count > 0 && a[0] is JObject) return p.Name;
            return null;
        }

        /// I campi del primo elemento dell'elenco, nel loro ordine.
        public static List<string> CampiDelPrimoElemento(JObject source)
        {
            string? chiave = ChiaveElenco(source);
            return chiave == null ? new() : ((JObject)((JArray)source[chiave]!)[0]).Properties().Select(p => p.Name).ToList();
        }

        /// Per ogni campo: l'associazione salvata nel source, se e' ancora valida per queste colonne,
        /// altrimenti la colonna con lo stesso nome dato in Training (senza maiuscole, spazi e trattini bassi),
        /// altrimenti "".
        public static Proposta Proponi(JObject source, IEnumerable<ColonnaAddestramento> colonneAddestramento)
        {
            var colonne = ColonneConNome(colonneAddestramento).Keys.ToList();
            var proposta = new Proposta
            {
                ChiaveElenco = ChiaveElenco(source) ?? "",
                Campi = CampiDelPrimoElemento(source),
                Colonne = colonne
            };
            var salvata = MappaturaSalvata(source);
            foreach (string campo in proposta.Campi)
            {
                string valore = "";
                if (salvata.TryGetValue(campo, out string? s) && Valida(s, colonne)) valore = s;
                else valore = colonne.FirstOrDefault(c => Normalizza(c) == Normalizza(campo)) ?? "";
                proposta.Mappatura[campo] = valore;
            }
            return proposta;
        }

        private static Dictionary<string, string> MappaturaSalvata(JObject source)
        {
            var esito = new Dictionary<string, string>();
            if (source[ChiaveMappatura]?["campi"] is JObject campi)
                foreach (var p in campi.Properties())
                    if (p.Value.Type == JTokenType.String) esito[p.Name] = p.Value.ToString();
            return esito;
        }

        /// Le formule si controllano a parte (Formula.Compila), con un messaggio per campo.
        private static bool Valida(string valore, List<string> colonne) =>
            valore == Progressivo || valore == Adesso || EFormula(valore) || colonne.Contains(valore);

        public static bool EFormula(string? valore) =>
            valore != null && valore.TrimStart().StartsWith(PrefissoFormula, StringComparison.Ordinal);

        private static string Normalizza(string s) => Regex.Replace(s ?? "", @"[\s_]", "").ToLowerInvariant();

        // ------------------------------------------------------------------ generazione

        /// Lo schema con l'elenco rifatto dalle righe dell'Excel. Non salva niente: il source restituito e'
        /// una copia, con l'elenco nuovo e l'associazione sotto mappaturaExcel.
        public static Esito Genera(JObject source, TabellaExcel tabella, IDictionary<string, string>? mappatura,
                                   IEnumerable<ColonnaAddestramento> colonneAddestramento, int idAddestramento, DateTime adesso)
        {
            string? chiave = ChiaveElenco(source);
            if (chiave == null)
                return No("Lo schema attuale non ha un elenco di elementi da cui prendere i campi.");
            var primo = (JObject)((JArray)source[chiave]!)[0];
            // nella mappatura e nelle formule ci sono i nomi dati in Training; nel file, i titoli dell'Excel
            var excelDi = ColonneConNome(colonneAddestramento);
            var colonne = excelDi.Keys.ToList();
            string Titolo(string nome) => excelDi[nome] == nome ? nome : excelDi[nome] + " (" + nome + ")";
            mappatura ??= new Dictionary<string, string>();

            var senza = primo.Properties().Select(p => p.Name)
                .Where(c => !mappatura.TryGetValue(c, out string? v) || string.IsNullOrWhiteSpace(v)).ToList();
            if (senza.Count > 0)
                return No("Manca l'associazione per: " + string.Join(", ", senza) + ".");
            var fuori = mappatura.Where(m => !Valida(m.Value, colonne)).Select(m => m.Key + " → " + m.Value).ToList();
            if (fuori.Count > 0)
                return No("Colonne che l'addestramento non ha: " + string.Join(", ", fuori) + ".");
            var formule = new Dictionary<string, Formula>();
            foreach (var campo in primo.Properties().Where(p => EFormula(mappatura[p.Name])))
            {
                var (formula, errore) = Formula.Compila(mappatura[campo.Name]);
                if (errore != null)
                    return No($"Formula del campo {campo.Name}: {errore}");
                // nella formula il nome si riconosce anche con le maiuscole diverse: [food] e' Food
                var sconosciute = new List<string>();
                formula!.RinominaColonne(c =>
                {
                    string? nome = colonne.FirstOrDefault(n => string.Equals(n, c, StringComparison.OrdinalIgnoreCase));
                    if (nome == null) sconosciute.Add(c);
                    return nome ?? c;
                });
                if (sconosciute.Count > 0)
                    return No($"Formula del campo {campo.Name}: " + string.Join(", ", sconosciute.Distinct().Select(c => "[" + c + "]")) +
                              (sconosciute.Distinct().Count() > 1 ? " non sono colonne" : " non è una colonna") + " dell'addestramento.");
                formule[campo.Name] = formula;
            }

            var mancanti = primo.Properties().Select(p => mappatura[p.Name])
                .Where(v => v != Progressivo && v != Adesso && !EFormula(v))
                .Concat(formule.Values.SelectMany(f => f.Colonne))
                .Where(v => !tabella.Colonne.Contains(excelDi[v])).Distinct().Select(Titolo).ToList();
            if (mancanti.Count > 0)
                return No("Nel file manca" + (mancanti.Count > 1 ? "no le colonne " : " la colonna ") + string.Join(", ", mancanti) + ".");
            if (tabella.Righe.Count == 0)
                return No("Il file non ha righe sotto l'intestazione.");

            using var foglio = formule.Count > 0 ? new FoglioFormule(tabella, excelDi) : null;
            string ora = adesso.ToString(FormatoAdesso, CultureInfo.InvariantCulture);
            var elenco = new JArray();
            for (int r = 0; r < tabella.Righe.Count; r++)
            {
                var riga = tabella.Righe[r];
                var elemento = new JObject();
                foreach (var campo in primo.Properties())
                {
                    string m = mappatura[campo.Name];
                    if (m == Progressivo) elemento[campo.Name] = campo.Value.Type == JTokenType.String ? new JValue((r + 1).ToString(CultureInfo.InvariantCulture)) : new JValue(r + 1);
                    else if (m == Adesso) elemento[campo.Name] = ora;
                    else if (formule.TryGetValue(campo.Name, out var formula))
                    {
                        var (risultato, erroreCalcolo) = foglio!.Calcola(formula, r);
                        if (erroreCalcolo != null)
                            return No(erroreCalcolo.StartsWith(FoglioFormule.NonValida, StringComparison.Ordinal)
                                ? $"Formula del campo {campo.Name} non valida: {erroreCalcolo.Substring(FoglioFormule.NonValida.Length)}"
                                : $"Riga {r + 2}, campo {campo.Name}: la formula dà {erroreCalcolo}.");
                        var (valore, errore) = Converti(risultato, campo.Value.Type);
                        if (errore != null)
                            return No($"Riga {r + 2}, campo {campo.Name}: il risultato della formula «{risultato}» non è {errore} come il campo nello schema.");
                        elemento[campo.Name] = valore;
                    }
                    else
                    {
                        object? cella = riga[tabella.Colonne.IndexOf(excelDi[m])];
                        var (valore, errore) = Converti(cella, campo.Value.Type);
                        if (errore != null)
                            return No($"Riga {r + 2}, colonna {Titolo(m)}: «{cella}» non è {errore} come il campo {campo.Name} dello schema.");
                        elemento[campo.Name] = valore;
                    }
                }
                elenco.Add(elemento);
            }

            var nuovo = (JObject)source.DeepClone();
            nuovo[chiave] = elenco;
            nuovo[ChiaveMappatura] = new JObject
            {
                ["idAddestramento"] = idAddestramento,
                ["campi"] = new JObject(primo.Properties().Select(p => new JProperty(p.Name, mappatura[p.Name])))
            };
            return new Esito { Ok = true, Source = nuovo, Elementi = elenco.Count };
        }

        /// Il valore della cella con il tipo del campo nel primo elemento. Una cella vuota vale 0, falso o "".
        private static (JToken Valore, string? Errore) Converti(object? cella, JTokenType tipo)
        {
            string testo = Vuota(cella) ? "" : Convert.ToString(cella, CultureInfo.InvariantCulture)!.Trim();
            switch (tipo)
            {
                case JTokenType.Integer:
                case JTokenType.Float:
                    if (testo == "") return (new JValue(0), null);
                    if (!double.TryParse(testo.Replace(',', '.'), NumberStyles.Float, CultureInfo.InvariantCulture, out double n))
                        return (JValue.CreateNull(), "un numero");
                    return tipo == JTokenType.Integer && n == Math.Floor(n) && Math.Abs(n) < long.MaxValue
                        ? (new JValue((long)n), null) : (new JValue(n), null);
                case JTokenType.Boolean:
                    if (cella is bool b) return (new JValue(b), null);
                    string t = testo.ToLowerInvariant();
                    if (t is "" or "false" or "0" or "no" or "falso" or "n") return (new JValue(false), null);
                    if (t is "true" or "1" or "si" or "sì" or "vero" or "x" or "s" or "y" or "yes") return (new JValue(true), null);
                    return (JValue.CreateNull(), "vero/falso");
                default:
                    return (new JValue(testo), null);
            }
        }

        private static Esito No(string errore) => new() { Ok = false, Errore = errore };

        // ------------------------------------------------------------------ formule

        /// Una formula in stile Excel scritta dall'operatore per un campo. Le colonne si scrivono tra quadre col
        /// nome dato in Training ([NoFood]) e valgono per la riga che si calcola: le lettere di Excel (D2, A2:C9) no, perche'
        /// chi scrive la formula non ha il file aperto davanti e l'ordine delle colonne puo' cambiare.
        /// Valgono la sintassi italiana (SE, ";", virgola decimale) e quella inglese (IF, ",", punto decimale):
        /// la formula si traduce in inglese, che e' la lingua del motore di calcolo di ClosedXML.
        public sealed class Formula
        {
            /// Testo in inglese e, al posto di ogni [COLONNA], il nome della colonna.
            internal List<(string? Testo, string? Colonna)> Pezzi { get; } = new();

            public List<string> Colonne => Pezzi.Where(p => p.Colonna != null).Select(p => p.Colonna!).Distinct().ToList();

            internal void RinominaColonne(Func<string, string> nuovoNome)
            {
                for (int i = 0; i < Pezzi.Count; i++)
                    if (Pezzi[i].Colonna != null) Pezzi[i] = (null, nuovoNome(Pezzi[i].Colonna!));
            }

            /// La formula tradotta, con le colonne ancora tra quadre: serve ai test e ai messaggi.
            public string Tradotta => string.Concat(Pezzi.Select(p => p.Colonna == null ? p.Testo : "[" + p.Colonna + "]"));

            public static (Formula? Formula, string? Errore) Compila(string testo)
            {
                string s = (testo ?? "").Trim();
                if (s.StartsWith(PrefissoFormula, StringComparison.Ordinal)) s = s.Substring(PrefissoFormula.Length).Trim();
                if (s == "") return (null, "la formula è vuota.");

                bool italiano = ContieneFuoriDaiTesti(s, ';');
                var f = new Formula();
                var sb = new StringBuilder();
                void Chiudi() { if (sb.Length > 0) { f.Pezzi.Add((sb.ToString(), null)); sb.Clear(); } }

                int i = 0;
                while (i < s.Length)
                {
                    char c = s[i];
                    if (c == '"')
                    {
                        int j = i + 1;
                        while (true)
                        {
                            if (j >= s.Length) return (null, "manca la virgoletta che chiude un testo.");
                            if (s[j] == '"')
                            {
                                if (j + 1 < s.Length && s[j + 1] == '"') { j += 2; continue; }
                                break;
                            }
                            j++;
                        }
                        sb.Append(s, i, j - i + 1);
                        i = j + 1;
                    }
                    else if (c == '[')
                    {
                        int j = s.IndexOf(']', i + 1);
                        if (j < 0) return (null, "manca la ] che chiude il nome di una colonna.");
                        string nome = NomeColonna(s.Substring(i + 1, j - i - 1));
                        if (nome == "") return (null, "c'è una colonna senza nome: [].");
                        Chiudi();
                        f.Pezzi.Add((null, nome));
                        i = j + 1;
                    }
                    else if (c == ']')
                        return (null, "c'è una ] senza la [ che la apre.");
                    else if (char.IsDigit(c))
                    {
                        char decimale = italiano ? ',' : '.';
                        int j = i;
                        while (j < s.Length && (char.IsDigit(s[j]) || s[j] == decimale)) j++;
                        sb.Append(s.Substring(i, j - i).Replace(',', '.'));
                        i = j;
                    }
                    else if (char.IsLetter(c) || c == '_' || c == '$')
                    {
                        int j = i;
                        while (j < s.Length && (char.IsLetterOrDigit(s[j]) || s[j] == '_' || s[j] == '.' || s[j] == '$')) j++;
                        string nome = s.Substring(i, j - i);
                        int k = j;
                        while (k < s.Length && char.IsWhiteSpace(s[k])) k++;
                        if (k < s.Length && s[k] == '(')
                            sb.Append(FunzioniItaliane.TryGetValue(nome, out string? inglese) ? inglese : nome.ToUpperInvariant());
                        else if (nome.ToUpperInvariant() is "TRUE" or "VERO")
                            sb.Append("TRUE");
                        else if (nome.ToUpperInvariant() is "FALSE" or "FALSO")
                            sb.Append("FALSE");
                        else if (Regex.IsMatch(nome, @"^\$?[A-Za-z]{1,3}\$?\d+$"))
                            return (null, $"«{nome}» è un riferimento di Excel: le colonne si scrivono tra quadre col nome dato in Training, per esempio [Food].");
                        else
                            return (null, $"«{nome}» non è una colonna: scrivi il nome tra quadre, per esempio [{nome}].");
                        i = j;
                    }
                    else if (c == ';' && italiano)
                    {
                        sb.Append(',');
                        i++;
                    }
                    else
                    {
                        sb.Append(c);
                        i++;
                    }
                }
                Chiudi();
                return (f, null);
            }

            private static bool ContieneFuoriDaiTesti(string s, char cercato)
            {
                bool testo = false, colonna = false;
                foreach (char c in s)
                {
                    if (c == '"' && !colonna) testo = !testo;
                    else if (!testo && c == '[') colonna = true;
                    else if (!testo && c == ']') colonna = false;
                    else if (!testo && !colonna && c == cercato) return true;
                }
                return false;
            }
        }

        /// I nomi italiani delle funzioni di Excel piu' usate, con il loro nome inglese.
        private static readonly Dictionary<string, string> FunzioniItaliane = new(StringComparer.OrdinalIgnoreCase)
        {
            ["SE"] = "IF", ["E"] = "AND", ["O"] = "OR", ["NON"] = "NOT", ["XOR"] = "XOR",
            ["SE.ERRORE"] = "IFERROR", ["SE.NON.DISP."] = "IFNA", ["SE.NON.DISP"] = "IFNA", ["PIÙ.SE"] = "IFS", ["PIU.SE"] = "IFS",
            ["SCEGLI"] = "CHOOSE", ["VERO"] = "TRUE", ["FALSO"] = "FALSE",
            ["CONCATENA"] = "CONCATENATE", ["CONCAT"] = "CONCAT", ["TESTO.UNISCI"] = "TEXTJOIN",
            ["SINISTRA"] = "LEFT", ["DESTRA"] = "RIGHT", ["STRINGA.ESTRAI"] = "MID", ["LUNGHEZZA"] = "LEN",
            ["MAIUSC"] = "UPPER", ["MINUSC"] = "LOWER", ["MAIUSC.INIZ"] = "PROPER", ["ANNULLA.SPAZI"] = "TRIM",
            ["SOSTITUISCI"] = "SUBSTITUTE", ["RIMPIAZZA"] = "REPLACE", ["TROVA"] = "FIND", ["RICERCA"] = "SEARCH",
            ["TESTO"] = "TEXT", ["VALORE"] = "VALUE", ["NUMERO.VALORE"] = "NUMBERVALUE", ["RIPETI"] = "REPT",
            ["IDENTICO"] = "EXACT", ["CODICE.CARATT"] = "CHAR", ["CODICE"] = "CODE", ["T"] = "T", ["LIBERA"] = "CLEAN",
            ["ARROTONDA"] = "ROUND", ["ARROTONDA.PER.ECC"] = "ROUNDUP", ["ARROTONDA.PER.DIF"] = "ROUNDDOWN",
            ["TRONCA"] = "TRUNC", ["INT"] = "INT", ["RESTO"] = "MOD", ["ASS"] = "ABS", ["SEGNO"] = "SIGN",
            ["POTENZA"] = "POWER", ["RADQ"] = "SQRT", ["QUOZIENTE"] = "QUOTIENT",
            ["SOMMA"] = "SUM", ["MEDIA"] = "AVERAGE", ["MIN"] = "MIN", ["MAX"] = "MAX", ["CONTA.VALORI"] = "COUNTA",
            ["VAL.VUOTO"] = "ISBLANK", ["VAL.NUMERO"] = "ISNUMBER", ["VAL.TESTO"] = "ISTEXT", ["VAL.ERRORE"] = "ISERROR",
            ["VAL.ERR"] = "ISERR", ["VAL.NON.DISP"] = "ISNA", ["VAL.LOGICO"] = "ISLOGICAL", ["VAL.PARI"] = "ISEVEN", ["VAL.DISPARI"] = "ISODD",
            ["OGGI"] = "TODAY", ["ADESSO"] = "NOW", ["DATA"] = "DATE", ["ANNO"] = "YEAR", ["MESE"] = "MONTH", ["GIORNO"] = "DAY",
            ["GIORNO.SETTIMANA"] = "WEEKDAY", ["ORA"] = "HOUR", ["MINUTO"] = "MINUTE", ["SECONDO"] = "SECOND"
        };

        /// Le righe dell'Excel in un foglio in memoria, su cui ClosedXML calcola le formule: [Nome] diventa
        /// la cella della colonna che in Training ha quel nome, nella riga calcolata. Il file dell'operatore
        /// non si tocca.
        internal sealed class FoglioFormule : IDisposable
        {
            /// Davanti al messaggio quando la formula non si riesce a leggere (sintassi), per distinguerlo da un
            /// errore di calcolo (#DIV/0!, #VALUE!, #NAME?...).
            public const string NonValida = "\u0001";

            private readonly XLWorkbook libro = new();
            private readonly IXLWorksheet foglio;
            private readonly Dictionary<string, string> lettere = new();

            /// excelDi: nome dato in Training -> titolo della colonna nell'Excel.
            public FoglioFormule(TabellaExcel tabella, IReadOnlyDictionary<string, string> excelDi)
            {
                foglio = libro.AddWorksheet("Dati");
                for (int c = 0; c < tabella.Colonne.Count; c++)
                    foglio.Cell(1, c + 1).Value = tabella.Colonne[c];
                foreach (var (nome, excel) in excelDi)
                {
                    int indice = tabella.Colonne.IndexOf(excel);
                    if (indice >= 0) lettere[nome] = XLHelper.GetColumnLetterFromNumber(indice + 1);
                }
                for (int r = 0; r < tabella.Righe.Count; r++)
                    for (int c = 0; c < tabella.Colonne.Count; c++)
                        Imposta(foglio.Cell(r + 2, c + 1), tabella.Righe[r][c]);
            }

            private static void Imposta(IXLCell cella, object? v)
            {
                switch (v)
                {
                    case null: case DBNull: return;
                    case string s: if (s != "") cella.Value = s; return;
                    case bool b: cella.Value = b; return;
                    case DateTime d: cella.Value = d; return;
                    case TimeSpan t: cella.Value = t; return;
                    case double or float or decimal or int or long or short or byte:
                        cella.Value = Convert.ToDouble(v, CultureInfo.InvariantCulture); return;
                    default: cella.Value = Convert.ToString(v, CultureInfo.InvariantCulture); return;
                }
            }

            /// Il risultato della formula sulla riga (0 = la prima sotto l'intestazione): numero, testo, vero/falso
            /// o null se vuoto. In caso di errore il valore e' null e l'errore e' il codice di Excel.
            public (object? Valore, string? Errore) Calcola(Formula formula, int riga)
            {
                string espressione = string.Concat(formula.Pezzi.Select(p => p.Colonna == null ? p.Testo : lettere[p.Colonna] + (riga + 2)));
                XLCellValue v;
                try
                {
                    v = foglio.Evaluate(espressione);
                }
                catch (Exception ex)
                {
                    return (null, NonValida + ex.Message);
                }
                if (v.IsError) return (null, v.ToString());
                if (v.IsBlank) return (null, null);
                if (v.IsBoolean) return (v.GetBoolean(), null);
                if (v.IsNumber) return (v.GetNumber(), null);
                if (v.IsDateTime) return (v.GetDateTime().ToString(FormatoAdesso, CultureInfo.InvariantCulture), null);
                if (v.IsTimeSpan) return (v.GetTimeSpan().ToString(), null);
                return (v.GetText(), null);
            }

            public void Dispose() => libro.Dispose();
        }
    }
}
