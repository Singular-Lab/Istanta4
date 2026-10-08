using System.Diagnostics;
using System.Reflection;
using IstantaLib;

namespace Istanta.Utility
{
    /// I20-1062: un errore che Istanta sa spiegare. Prima ogni chiamata del Plugin finiva in un
    /// catch che restituiva ex.ToString(): nel caso della issue getSchedaRef non trovava il formato
    /// in DBFORMATI e l'operatore vedeva solo "Object reference not set to an instance of an
    /// object", senza riga ne' dati. Chi lancia un ErroreIstanta dice in quale passo si e' fermato
    /// e perche', con i dati che servono a ritrovare il caso (lavorazione, gruppo, formato, idRec).
    public class ErroreIstanta : Exception
    {
        /// Il passo della chiamata in cui il codice si e' fermato: "lettura del formato",
        /// "esportazione di agenzia". Null per un errore gia' descritto da un'altra chiamata.
        public string? Passo { get; }

        public ErroreIstanta(string? passo, string messaggio, Exception? causa = null) : base(messaggio, causa)
        {
            Passo = passo;
        }

        /// L'errore di un'altra chiamata, gia' descritto da DescrizioneErrori.Breve, da passare al
        /// client cosi' com'e': chi chiama getSchedaRef prima lo buttava e diceva solo "Gruppo X
        /// non trovato". Se l'altra chiamata non ha detto niente si usa il messaggio di riserva.
        public static ErroreIstanta Inoltrato(string? giaDescritto, string riserva)
        {
            return new ErroreIstanta(null, string.IsNullOrWhiteSpace(giaDescritto) ? riserva : giaDescritto);
        }
    }

    /// I20-1062: come si racconta un errore al client. Nel campo error va un messaggio breve, che
    /// il Plugin mostra per intero; la traccia completa va nel log del server e nel campo
    /// dettaglio, che il Plugin scrive in console senza mostrarla.
    public static class DescrizioneErrori
    {
        /// messaggioUtente del Plugin mostra 200 caratteri, e davanti mette il suo codice
        /// ("Code SRF-04 Errore sul server durante la richiesta: "): 160 lasciano visibile la coda.
        public const int LunghezzaMassima = 160;

        /// Il messaggio per l'operatore. Un ErroreIstanta dice passo e motivo; un errore imprevisto
        /// dice tipo, punto del codice (file e riga, se ci sono i simboli) e messaggio.
        public static string Breve(string chiamata, Exception ex)
        {
            Exception radice = Radice(ex);
            string testo;

            if (radice is ErroreIstanta inoltrato && inoltrato.Passo == null)
            {
                testo = inoltrato.Message;
            }
            else if (radice is ErroreIstanta errore)
            {
                testo = $"{chiamata}, {errore.Passo}: {errore.Message}";
            }
            else
            {
                string? punto = PuntoNelCodice(radice);
                testo = $"{chiamata}: {radice.GetType().Name}" + (punto != null ? $" in {punto}" : "") + $" - {radice.Message}";
            }

            return Accorcia(testo);
        }

        /// La traccia completa, per i log e per il campo dettaglio.
        public static string Dettaglio(Exception ex)
        {
            return ex.ToString();
        }

        /// L'eccezione che conta. Quelle di AgenziaLib arrivano dentro una
        /// TargetInvocationException (la dll si chiama per riflessione), quelle dei Task dentro
        /// una AggregateException: il messaggio utile e' in quella interna.
        public static Exception Radice(Exception ex)
        {
            Exception corrente = ex;
            while ((corrente is TargetInvocationException || corrente is AggregateException) && corrente.InnerException != null)
            {
                corrente = corrente.InnerException;
            }
            return corrente;
        }

        /// Il primo punto della traccia in cui c'e' un file: "MenaboController.cs:9784". Senza
        /// simboli (AgenziaLib si carica senza pdb) si ripiega sul nome del metodo.
        public static string? PuntoNelCodice(Exception ex)
        {
            StackFrame[] frames = new StackTrace(ex, true).GetFrames();
            if (frames.Length == 0)
            {
                return null;
            }

            foreach (StackFrame frame in frames)
            {
                string? file = frame.GetFileName();
                if (!string.IsNullOrEmpty(file) && frame.GetFileLineNumber() > 0)
                {
                    return $"{Path.GetFileName(file)}:{frame.GetFileLineNumber()}";
                }
            }

            MethodBase? metodo = frames[0].GetMethod();
            return metodo != null ? NomeDelMetodo(metodo) : null;
        }

        /// Il nome leggibile di un metodo: per gli async e le lambda il compilatore genera classi
        /// come "<getSchedaRef>d__12.MoveNext", da cui si ricava "getSchedaRef".
        private static string NomeDelMetodo(MethodBase metodo)
        {
            string tipo = metodo.DeclaringType?.Name ?? "";
            string nome = metodo.Name;
            int inizio = tipo.IndexOf('<');
            int fine = tipo.IndexOf('>');
            if (inizio >= 0 && fine > inizio)
            {
                nome = tipo.Substring(inizio + 1, fine - inizio - 1);
                tipo = metodo.DeclaringType?.DeclaringType?.Name ?? "";
            }
            return tipo != "" ? $"{tipo}.{nome}" : nome;
        }

        /// La prima riga di un testo d'errore: di un ex.ToString() salvato da un altro metodo
        /// resta il tipo con il messaggio, senza la traccia.
        public static string PrimaRiga(string? testo)
        {
            if (string.IsNullOrWhiteSpace(testo))
            {
                return "nessun dettaglio";
            }
            string riga = testo.Replace("\r", "").Split('\n')[0].Trim();
            return riga;
        }

        private static string Accorcia(string testo)
        {
            testo = testo.Replace("\r", " ").Replace("\n", " ");
            return testo.Length <= LunghezzaMassima ? testo : testo.Substring(0, LunghezzaMassima - 3) + "...";
        }
    }

    /// I20-1062: la ricerca del formato di una lavorazione in DBFORMATI, in un solo punto. Prima la
    /// facevano sette punti diversi con FirstOrDefault e un "!" subito dopo: un formato assente da
    /// SourceFormati.json diventava un NullReferenceException senza dati.
    public static class Formati
    {
        /// Il formato con quel guid. Se non c'e' lancia un ErroreIstanta che dice quale formato,
        /// per cosa lo si cercava, e che SourceFormati.json si legge solo all'avvio.
        public static Formato Trova(string? guidFormato, string perChi)
        {
            return Trova(SingletonConfiguration.DBFORMATI?.source, guidFormato, perChi);
        }

        public static Formato Trova(IEnumerable<Formato>? formati, string? guidFormato, string perChi)
        {
            if (formati == null)
            {
                throw new ErroreIstanta("lettura del formato", "l'elenco dei formati (SourceFormati.json) non e' stato caricato all'avvio di Istanta.");
            }
            if (string.IsNullOrWhiteSpace(guidFormato))
            {
                throw new ErroreIstanta("lettura del formato", $"{perChi} non indica nessun formato.");
            }

            Formato? formato = formati.FirstOrDefault(f => f.guidID == guidFormato);
            if (formato == null)
            {
                throw new ErroreIstanta("lettura del formato",
                    $"il formato {guidFormato} di {perChi} non e' in SourceFormati.json (se e' stato aggiunto da poco, riavviare Istanta).");
            }
            return formato;
        }

        /// Il tipo del formato, o null se il formato non si conosce: per chi deve solo scegliere
        /// fra i formati noti e puo' saltare gli altri, come le lavorazioni passate.
        public static TipoLavorazione? CercaTipo(string? guidFormato)
        {
            return SingletonConfiguration.DBFORMATI?.source.FirstOrDefault(f => f.guidID == guidFormato)?.tipo;
        }
    }

    /// I20-1062: i valori che un record del tracciato deve avere. L'indicizzatore del dizionario
    /// lanciava KeyNotFoundException con la sola chiave, senza dire di quale record.
    public static class RecordTracciato
    {
        public static object Richiesto(Dictionary<string, object>? record, string chiave, string passo, string diChi)
        {
            if (record == null)
            {
                throw new ErroreIstanta(passo, $"il dato di {diChi} non si legge (Dato vuoto o non valido).");
            }
            if (!record.TryGetValue(chiave, out object? valore) || valore == null)
            {
                throw new ErroreIstanta(passo, $"{diChi} non ha il campo {chiave}.");
            }
            return valore;
        }
    }
}
