namespace Istanta.Utility
{
    /// La pulizia notturna della cartella delle estrazioni di SyncFoto (sync_options.extractPath).
    ///
    /// Li' finiscono gli zip caricati, le cartelle in cui vengono estratti, i json delle scansioni
    /// e le cartelle dei pacchetti creati dalle foto del tracciato: senza pulizia il volume cresce
    /// fino a esaurire lo spazio. Ogni notte si eliminano le voci piu' vecchie del periodo di
    /// conservazione (un mese, se non configurato).
    ///
    /// L'eta' e' la data di creazione della voce di primo livello, mai quella dei file contenuti:
    /// l'estrazione conserva nelle foto la data originale, che puo' essere di anni prima, e un
    /// pacchetto caricato ieri sembrerebbe gia' scaduto. Su Linux, dove il file system non
    /// registra la nascita, .NET restituisce la piu' vecchia fra modifica e cambio di stato: nel
    /// caso peggiore la voce si elimina piu' tardi, mai prima.
    public static class PuliziaEstrazioni
    {
        public const int MesiDefault = 1;
        public const int OraDefault = 3;
        public const string FusoOrario = "Europe/Rome";

        /// I mesi di conservazione: quelli configurati se validi, altrimenti uno.
        public static int Mesi(int? configurati)
        {
            return configurati is > 0 ? configurati.Value : MesiDefault;
        }

        /// L'ora della pulizia, 0-23 nel fuso di Roma: quella configurata se valida, altrimenti le 3.
        public static int Ora(int? configurata)
        {
            return configurata is >= 0 and <= 23 ? configurata.Value : OraDefault;
        }

        /// Le voci create prima di questo istante vanno eliminate.
        public static DateTime Scadenza(DateTime adessoUtc, int mesi)
        {
            return adessoUtc.AddMonths(-mesi);
        }

        /// La prossima volta che scocca l'ora indicata, a partire da adesso (stesso fuso).
        public static DateTime ProssimaEsecuzione(DateTime adesso, int ora)
        {
            DateTime oggi = adesso.Date.AddHours(ora);
            return oggi > adesso ? oggi : oggi.AddDays(1);
        }

        /// Il fuso di Roma; se il sistema non lo conosce, quello della macchina.
        public static TimeZoneInfo Fuso()
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById(FusoOrario);
            }
            catch (Exception ex) when (ex is TimeZoneNotFoundException || ex is InvalidTimeZoneException)
            {
                return TimeZoneInfo.Local;
            }
        }

        /// Elimina dalla cartella le voci di primo livello create prima della scadenza. Le cartelle
        /// si eliminano con tutto il contenuto, i collegamenti simbolici non si toccano. Un errore
        /// su una voce non ferma le altre: lo riceve chi chiama, per scriverlo nel log.
        public static EsitoPuliziaEstrazioni Elimina(string? cartella, DateTime scadenzaUtc, Action<string, Exception>? errore = null)
        {
            var esito = new EsitoPuliziaEstrazioni();

            if (string.IsNullOrWhiteSpace(cartella) || !Directory.Exists(cartella))
            {
                return esito;
            }

            foreach (FileSystemInfo voce in new DirectoryInfo(cartella).EnumerateFileSystemInfos())
            {
                try
                {
                    if (voce.LinkTarget != null || voce.CreationTimeUtc >= scadenzaUtc)
                    {
                        continue;
                    }

                    if (voce is DirectoryInfo dir)
                    {
                        dir.Delete(true);
                    }
                    else
                    {
                        voce.Delete();
                    }

                    esito.Eliminate++;
                }
                catch (Exception ex) when (ex is IOException || ex is UnauthorizedAccessException)
                {
                    esito.Errori++;
                    errore?.Invoke(voce.FullName, ex);
                }
            }

            return esito;
        }
    }

    public class EsitoPuliziaEstrazioni
    {
        public int Eliminate { get; set; }
        public int Errori { get; set; }
    }
}
