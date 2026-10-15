using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using Istanta.Models_2;
using IstantaLib;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Istanta.Models
{
    /// <summary>I20-1106 (Lotto 2): un record del report della pulizia, come lo vede la pagina.</summary>
    public class RigaReportPulizia
    {
        public long id { get; set; }
        public string codice { get; set; } = string.Empty;
        public string codiceGruppo { get; set; } = string.Empty;
        public string descrizione { get; set; } = string.Empty;
        public string label { get; set; } = string.Empty;
        public byte versione { get; set; }
        public string tracciato { get; set; } = string.Empty;
        public byte modalitaInserimento { get; set; }
        /// <summary>Importato a mano (modalita_inserimento 2): nel report viene prima degli altri.</summary>
        public bool manuale { get; set; }
        /// <summary>Impaginato, nel menabo' o in un gruppo impaginato: si vede, non si elimina.</summary>
        public bool impaginato { get; set; }
        public string motivoImpaginato { get; set; } = string.Empty;
        /// <summary>Il tipo di record delle regole del cliente che lo ha riconosciuto.</summary>
        public string tipo { get; set; } = string.Empty;
        /// <summary>I valori dei campi che le regole guardano, per far vedere perche' il record e' qui.</summary>
        public Dictionary<string, string> valoriRegole { get; set; } = new Dictionary<string, string>();
    }

    public class ContatoriPulizia
    {
        public int manuali { get; set; }
        public int daLista { get; set; }
        public int impaginati { get; set; }
        public int tutti { get; set; }
    }

    public class ReportPulizia
    {
        public bool esito { get; set; }
        public string error { get; set; } = string.Empty;
        public string nomeLista { get; set; } = string.Empty;
        public string label { get; set; } = string.Empty;
        public List<string> tipi { get; set; } = new List<string>();
        /// <summary>Quanti codici distinti ha la lista scelta: il confronto si fa contro questi.</summary>
        public int codiciInLista { get; set; }
        public List<RigaReportPulizia> righe { get; set; } = new List<RigaReportPulizia>();
        public ContatoriPulizia contatori { get; set; } = new ContatoriPulizia();
    }

    /// <summary>Un record della promo con cio' che serve a valutarlo: il Dato gia' letto, le etichette che Istanta gli assegna, il tracciato.</summary>
    public class RecordDaValutare
    {
        public PromoTracciatiRecord record { get; set; } = null!;
        public Dictionary<string, object>? dato { get; set; }
        public List<string> etichette { get; set; } = new List<string>();
        public string tracciato { get; set; } = string.Empty;
    }

    public class PianoEliminazione
    {
        public List<long> daEliminare { get; } = new List<long>();
        public List<SegnalazioneRipristino> saltati { get; } = new List<SegnalazioneRipristino>();
    }

    public class EliminazionePuliziaRisposta
    {
        public bool esito { get; set; }
        public string error { get; set; } = string.Empty;
        public int eliminati { get; set; }
        public List<SegnalazioneRipristino> saltati { get; set; } = new List<SegnalazioneRipristino>();
        public int idBackup { get; set; }
    }

    /// <summary>
    /// I20-1106 (Lotto 2): la pulizia delle liste, senza database. Il controller legge record,
    /// lista, lavorazioni e regole e li passa qui; qui si decide quali record vanno nel report,
    /// come si ordinano e quali si possono eliminare. Le regole dei tipi di record usano il formato
    /// e gli operatori delle etichette (MenaboController.Etichettatura), riportati qui per i soli
    /// campi del record: un campo mancante vale "", come la'.
    /// </summary>
    public static class PuliziaListe
    {
        public const string ORIGINE_BACKUP = "Pulizia liste";

        public const string MOTIVO_IMPAGINATO = "impaginato in una lavorazione";
        public const string MOTIVO_SECONDARIA_IMPAGINATA = "in un gruppo impaginato";
        public const string MOTIVO_NEL_MENABO = "presente nel menabo'";
        public const string MOTIVO_NON_TROVATO = "non e' fra i record della promo";

        public const string PREFISSO_RECORD = "recordInTracciato.";

        /// <summary>L'origine del backup fatto prima di eliminare: dice che e' una pulizia e di quale lista.</summary>
        public static string OrigineBackup(string? nomeLista, string? label)
        {
            string lista = string.IsNullOrWhiteSpace(nomeLista) ? "lista" : nomeLista.Trim();
            return string.IsNullOrWhiteSpace(label)
                ? ORIGINE_BACKUP + ": " + lista
                : ORIGINE_BACKUP + ": " + lista + " (" + label.Trim() + ")";
        }

        /* ===== il Dato del record ===== */

        /// <summary>Il Dato del record letto come dizionario; niente se non e' json.</summary>
        public static Dictionary<string, object>? LeggiDato(string? dato)
        {
            if (string.IsNullOrWhiteSpace(dato))
            {
                return null;
            }
            try
            {
                return JsonConvert.DeserializeObject<Dictionary<string, object>>(dato);
            }
            catch
            {
                return null;
            }
        }

        /// <summary>
        /// Una copia del Dato senza le chiavi che Etichettatura aggiunge con Add: se ci fossero
        /// gia', l'etichettatura si fermerebbe su un'eccezione.
        /// </summary>
        public static Dictionary<string, object> DatoPerEtichettatura(Dictionary<string, object>? dato)
        {
            var copia = dato == null ? new Dictionary<string, object>() : new Dictionary<string, object>(dato);
            copia.Remove(GLOBAL_VARIABLES.allEtichette);
            copia.Remove(GLOBAL_VARIABLES.etichetteVisual);
            return copia;
        }

        /// <summary>
        /// Il valore di un campo del record come testo. Il campo puo' avere il prefisso
        /// "recordInTracciato." delle etichette; "Context.Promo" e "Context.Tracciato" seguiti dal
        /// nome del field leggono il contesto, in qualunque forma sia stato salvato. Un campo che
        /// non c'e' vale "".
        /// </summary>
        public static string ValoreDelCampo(Dictionary<string, object>? dato, string? campo)
        {
            if (dato == null || string.IsNullOrWhiteSpace(campo))
            {
                return string.Empty;
            }

            string chiave = NomeCampo(campo);

            foreach (string contesto in new[] { GLOBAL_VARIABLES_FICO.keyContextPromo, GLOBAL_VARIABLES_FICO.keyContextTracciato })
            {
                if (chiave.StartsWith(contesto, StringComparison.Ordinal) && chiave.Length > contesto.Length)
                {
                    string nomeField = chiave.Substring(contesto.Length).TrimStart('.');
                    return dato.TryGetValue(contesto, out var voci) ? ValoreDelContesto(voci, nomeField) : string.Empty;
                }
            }

            return dato.TryGetValue(chiave, out var valore) ? Testo(valore) : string.Empty;
        }

        /// <summary>Il campo senza il prefisso delle etichette: e' il nome con cui si mostra.</summary>
        public static string NomeCampo(string campo)
        {
            string chiave = campo.Trim();
            if (chiave.StartsWith(PREFISSO_RECORD, StringComparison.OrdinalIgnoreCase))
            {
                chiave = chiave.Substring(PREFISSO_RECORD.Length);
            }
            return chiave;
        }

        private static string ValoreDelContesto(object? voci, string nomeField)
        {
            if (voci is not IEnumerable<object> elenco)
            {
                return string.Empty;
            }

            foreach (var voce in elenco)
            {
                string? nome = null;
                string? valore = null;
                switch (voce)
                {
                    case FicoContextField f:
                        nome = f.nome_field;
                        valore = f.user_value;
                        break;
                    case IDictionary<string, object> d:
                        nome = d.TryGetValue("nome_field", out var n) ? Testo(n) : null;
                        valore = d.TryGetValue("user_value", out var u) ? Testo(u) : null;
                        break;
                    case JObject jo:
                        nome = jo["nome_field"]?.ToString();
                        valore = jo["user_value"]?.ToString();
                        break;
                }
                if (nome != null && string.Equals(nome, nomeField, StringComparison.OrdinalIgnoreCase))
                {
                    return valore ?? string.Empty;
                }
            }
            return string.Empty;
        }

        private static string Testo(object? valore)
        {
            switch (valore)
            {
                case null: return string.Empty;
                case JValue jv: return Testo(jv.Value);
                case JToken jt: return jt.ToString(Formatting.None);
                case IFormattable f: return f.ToString(null, CultureInfo.InvariantCulture);
                default: return valore.ToString() ?? string.Empty;
            }
        }

        /* ===== le regole ===== */

        /// <summary>
        /// Una regola delle etichette su un valore. Gli operatori sono quelli di Etichettatura:
        /// IN, !IN, ==, !=, &gt;, &lt;, &gt;=, &lt;=, con il prefisso S (senza spazi) e/o C
        /// (maiuscole contano). Senza C il confronto ignora le maiuscole; == e != confrontano come
        /// numeri quando entrambi i lati lo sono; i confronti d'ordine valgono solo fra numeri.
        /// Un operatore sconosciuto non e' mai soddisfatto.
        /// </summary>
        public static bool RegolaSoddisfatta(string? valore, RegolaComparazioneEtichetta regola)
        {
            string v = (valore ?? string.Empty).Replace(",", ".");
            string atteso = (regola.Value ?? string.Empty).Replace(",", ".");
            string op = (regola.Operatore ?? string.Empty).Trim();

            bool senzaSpazi = op.StartsWith("S", StringComparison.Ordinal);
            if (senzaSpazi)
            {
                op = op.Substring(1);
            }
            bool conMaiuscole = op.StartsWith("C", StringComparison.Ordinal);
            if (conMaiuscole)
            {
                op = op.Substring(1);
            }

            if (senzaSpazi)
            {
                v = v.Replace(" ", string.Empty);
                atteso = atteso.Replace(" ", string.Empty);
            }
            if (!conMaiuscole)
            {
                v = v.ToLowerInvariant();
                atteso = atteso.ToLowerInvariant();
            }

            switch (op)
            {
                case "IN": return v.Contains(atteso, StringComparison.Ordinal);
                case "!IN": return !v.Contains(atteso, StringComparison.Ordinal);
                case "==": return Uguali(v, atteso);
                case "!=": return !Uguali(v, atteso);
                case ">": return Numeri(v, atteso, out var a1, out var b1) && a1 > b1;
                case "<": return Numeri(v, atteso, out var a2, out var b2) && a2 < b2;
                case ">=": return Numeri(v, atteso, out var a3, out var b3) && a3 >= b3;
                case "<=": return Numeri(v, atteso, out var a4, out var b4) && a4 <= b4;
                default: return false;
            }
        }

        private static bool Uguali(string v, string atteso)
        {
            return Numeri(v, atteso, out var a, out var b) ? a == b : v == atteso;
        }

        private static bool Numeri(string v, string atteso, out double a, out double b)
        {
            bool primo = double.TryParse(v, NumberStyles.Any, CultureInfo.InvariantCulture, out a);
            bool secondo = double.TryParse(atteso, NumberStyles.Any, CultureInfo.InvariantCulture, out b);
            return primo && secondo;
        }

        /// <summary>
        /// Un record corrisponde a un tipo se almeno un set di regole sui campi e' tutto vero e,
        /// se il tipo ha regole sulle etichette, anche almeno un loro set. Un tipo senza regole non
        /// riconosce nessun record: con un tipo vuoto il report prenderebbe tutto.
        /// </summary>
        public static bool TipoCorrisponde(TipoRecordPulizia tipo, Dictionary<string, object>? dato, ICollection<string>? etichette)
        {
            var setCampi = (tipo.Regole ?? new List<List<RegolaComparazioneEtichetta>>()).Where(s => s != null && s.Count > 0).ToList();
            var setEtichette = (tipo.RegoleEtichette ?? new List<List<RegolaComparazionePerEtichetta>>()).Where(s => s != null && s.Count > 0).ToList();

            if (setCampi.Count == 0 && setEtichette.Count == 0)
            {
                return false;
            }

            if (setCampi.Count > 0 && !setCampi.Any(set => set.All(r => RegolaSoddisfatta(ValoreDelCampo(dato, r.campo), r))))
            {
                return false;
            }

            if (setEtichette.Count > 0 && !setEtichette.Any(set => set.All(r => HaEtichetta(etichette, r.nomeEtichetta) == r.presente)))
            {
                return false;
            }

            return true;
        }

        private static bool HaEtichetta(ICollection<string>? etichette, string? nome)
        {
            return etichette != null && nome != null && etichette.Any(e => string.Equals(e, nome, StringComparison.OrdinalIgnoreCase));
        }

        public static TipoRecordPulizia? PrimoTipoCorrispondente(IEnumerable<TipoRecordPulizia> tipi, Dictionary<string, object>? dato, ICollection<string>? etichette)
        {
            return tipi.FirstOrDefault(t => TipoCorrisponde(t, dato, etichette));
        }

        /// <summary>I campi che le regole guardano, nell'ordine in cui compaiono, una volta sola.</summary>
        public static List<string> CampiDelleRegole(IEnumerable<TipoRecordPulizia> tipi)
        {
            var campi = new List<string>();
            foreach (var tipo in tipi)
            {
                foreach (var set in tipo.Regole ?? new List<List<RegolaComparazioneEtichetta>>())
                {
                    foreach (var regola in set ?? new List<RegolaComparazioneEtichetta>())
                    {
                        if (string.IsNullOrWhiteSpace(regola.campo))
                        {
                            continue;
                        }
                        string nome = NomeCampo(regola.campo);
                        if (!campi.Contains(nome))
                        {
                            campi.Add(nome);
                        }
                    }
                }
            }
            return campi;
        }

        /* ===== la lista e i record ===== */

        public static string NormalizzaCodice(string? codice)
        {
            return (codice ?? string.Empty).Trim();
        }

        /// <summary>I codici della lista scelta, confrontabili senza badare a spazi e maiuscole.</summary>
        public static HashSet<string> InsiemeCodici(IEnumerable<string?> codici)
        {
            var insieme = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var codice in codici)
            {
                string pulito = NormalizzaCodice(codice);
                if (pulito.Length > 0)
                {
                    insieme.Add(pulito);
                }
            }
            return insieme;
        }

        /// <summary>I codici Referenza.Codice dei record di cio' che leggiDatoExcel restituisce (una voce per lista, con Records).</summary>
        public static HashSet<string> CodiciDellaLista(IEnumerable<Dictionary<string, object>>? liste)
        {
            var codici = new List<string?>();
            foreach (var lista in liste ?? Enumerable.Empty<Dictionary<string, object>>())
            {
                if (!lista.TryGetValue("Records", out var records) || records == null)
                {
                    continue;
                }
                IEnumerable<object>? elenco = records as IEnumerable<object>;
                foreach (var record in elenco ?? Enumerable.Empty<object>())
                {
                    switch (record)
                    {
                        case JObject jo:
                            codici.Add(jo[GLOBAL_VARIABLES_FICO.keyRefCodice]?.ToString());
                            break;
                        case IDictionary<string, object> d:
                            codici.Add(d.TryGetValue(GLOBAL_VARIABLES_FICO.keyRefCodice, out var c) ? Testo(c) : null);
                            break;
                    }
                }
            }
            return InsiemeCodici(codici);
        }

        public static bool Manuale(PromoTracciatiRecord r)
        {
            return r.ModalitaInserimento == (byte)ModalitaInserimento.Manuale;
        }

        /// <summary>
        /// Quali record non si possono eliminare, con il motivo: quelli a cui una riga di
        /// lavorazione della promo e' legata, quelli il cui codice sta nel codice gruppo di una riga
        /// di lavorazione con la stessa label del suo primario (le secondarie non hanno una riga
        /// propria), e quelli riferiti dal menabo'. Il database rifiuterebbe comunque i primi e gli
        /// ultimi; le secondarie le rifiuta la lavorazione, che resterebbe con un gruppo a meta'.
        /// </summary>
        public static Dictionary<long, string> Impaginati(
            IEnumerable<PromoTracciatiRecord> records,
            IEnumerable<PromoLavorazioniRecord> righeLavorazioni,
            IDictionary<long, string?> labelDeiPrimari,
            IEnumerable<long> idNelMenabo)
        {
            var elenco = records.ToList();
            var perId = elenco.ToDictionary(r => r.Id);
            var perCodice = elenco
                .Where(r => !string.IsNullOrWhiteSpace(r.Codice))
                .GroupBy(r => NormalizzaCodice(r.Codice), StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.ToList(), StringComparer.OrdinalIgnoreCase);
            var motivi = new Dictionary<long, string>();

            foreach (var riga in righeLavorazioni)
            {
                if (perId.ContainsKey(riga.IdRecordTracciato))
                {
                    motivi[riga.IdRecordTracciato] = MOTIVO_IMPAGINATO;
                }

                labelDeiPrimari.TryGetValue(riga.IdRecordTracciato, out var labelPrimario);
                foreach (string codice in (riga.CodiceGruppo ?? string.Empty).Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
                {
                    if (!perCodice.TryGetValue(codice, out var stessoCodice))
                    {
                        continue;
                    }
                    foreach (var r in stessoCodice)
                    {
                        if (r.Id == riga.IdRecordTracciato)
                        {
                            continue;
                        }
                        if (labelPrimario != null && !string.Equals(r.Label, labelPrimario, StringComparison.OrdinalIgnoreCase))
                        {
                            continue;
                        }
                        motivi.TryAdd(r.Id, MOTIVO_SECONDARIA_IMPAGINATA);
                    }
                }
            }

            foreach (long id in idNelMenabo)
            {
                if (perId.ContainsKey(id))
                {
                    motivi.TryAdd(id, MOTIVO_NEL_MENABO);
                }
            }

            return motivi;
        }

        /* ===== il report ===== */

        /// <summary>
        /// Entrano i record che un tipo riconosce e il cui codice non sta nella lista scelta.
        /// Manuali prima, poi per codice, poi dalla versione piu' alta.
        /// </summary>
        public static ReportPulizia ComponiReport(
            string? nomeLista,
            string? label,
            IList<TipoRecordPulizia> tipi,
            IEnumerable<RecordDaValutare> records,
            ISet<string> codiciInLista,
            IDictionary<long, string> impaginati)
        {
            var report = new ReportPulizia
            {
                nomeLista = nomeLista ?? string.Empty,
                label = label ?? string.Empty,
                tipi = tipi.Select(t => t.Nome ?? string.Empty).ToList(),
                codiciInLista = codiciInLista.Count
            };
            var campi = CampiDelleRegole(tipi);

            foreach (var r in records)
            {
                var tipo = PrimoTipoCorrispondente(tipi, r.dato, r.etichette);
                if (tipo == null)
                {
                    continue;
                }
                if (codiciInLista.Contains(NormalizzaCodice(r.record.Codice)))
                {
                    continue;
                }

                bool bloccato = impaginati.TryGetValue(r.record.Id, out var motivo);
                report.righe.Add(new RigaReportPulizia
                {
                    id = r.record.Id,
                    codice = r.record.Codice ?? string.Empty,
                    codiceGruppo = r.record.CodiceGruppo ?? string.Empty,
                    descrizione = Descrizione(r.dato),
                    label = r.record.Label ?? string.Empty,
                    versione = r.record.Versione,
                    tracciato = r.tracciato ?? string.Empty,
                    modalitaInserimento = r.record.ModalitaInserimento,
                    manuale = Manuale(r.record),
                    impaginato = bloccato,
                    motivoImpaginato = bloccato ? motivo! : string.Empty,
                    tipo = tipo.Nome ?? string.Empty,
                    valoriRegole = campi.ToDictionary(c => c, c => ValoreDelCampo(r.dato, c))
                });
            }

            report.righe = report.righe
                .OrderByDescending(x => x.manuale)
                .ThenBy(x => x.codice, StringComparer.Ordinal)
                .ThenByDescending(x => x.versione)
                .ToList();
            report.contatori = Conta(report.righe);
            report.esito = true;
            return report;
        }

        private static string Descrizione(Dictionary<string, object>? dato)
        {
            foreach (string chiave in new[] { GLOBAL_VARIABLES_FICO.keyDescrizione1, "descrizione", "Descrizione" })
            {
                string valore = ValoreDelCampo(dato, chiave);
                if (valore.Length > 0)
                {
                    return valore;
                }
            }
            return string.Empty;
        }

        public static ContatoriPulizia Conta(IEnumerable<RigaReportPulizia> righe)
        {
            var elenco = righe.ToList();
            return new ContatoriPulizia
            {
                manuali = elenco.Count(r => r.manuale),
                daLista = elenco.Count(r => !r.manuale),
                impaginati = elenco.Count(r => r.impaginato),
                tutti = elenco.Count
            };
        }

        /* ===== l'eliminazione ===== */

        /// <summary>
        /// Degli id chiesti, quali si eliminano e quali no: gli impaginati restano con il motivo,
        /// e un id che non e' della promo non si tocca. Ricalcolato sul server al momento
        /// dell'eliminazione, non sul report che l'operatore ha davanti.
        /// </summary>
        public static PianoEliminazione PianificaEliminazione(IEnumerable<long> idRichiesti, IEnumerable<PromoTracciatiRecord> recordDellaPromo, IDictionary<long, string> impaginati)
        {
            var piano = new PianoEliminazione();
            var perId = recordDellaPromo.ToDictionary(r => r.Id);

            foreach (long id in idRichiesti.Distinct())
            {
                if (!perId.TryGetValue(id, out var record))
                {
                    piano.saltati.Add(new SegnalazioneRipristino { id = id, codice = string.Empty, motivo = MOTIVO_NON_TROVATO });
                    continue;
                }
                if (impaginati.TryGetValue(id, out var motivo))
                {
                    piano.saltati.Add(new SegnalazioneRipristino { id = id, codice = record.Codice ?? string.Empty, motivo = motivo });
                    continue;
                }
                piano.daEliminare.Add(id);
            }

            return piano;
        }
    }
}
