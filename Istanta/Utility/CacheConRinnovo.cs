namespace Istanta.Utility
{
    /// TASK-a77bd7b2: un valore costoso da calcolare, tenuto in memoria e rinnovato senza far aspettare
    /// chi lo chiede.
    ///
    /// Nato per la merceologia della pagina Archivio, che legge i record di tutti i tracciati: prima si
    /// teneva cinque minuti e poi la prima richiesta che la trovava scaduta aspettava il ricalcolo intero.
    /// Ora solo la prima lettura aspetta; dopo, a valore scaduto, si risponde con quello vecchio e il
    /// rinnovo parte da solo in background, uno alla volta.
    ///
    /// Se il primo caricamento fallisce vale seGuasto, tenuto per la durata come un valore buono: un
    /// caricamento che fallisce non deve ripartire a ogni richiesta. Se fallisce un rinnovo resta il
    /// valore che c'era, e si riprova alla scadenza successiva.
    public sealed class CacheConRinnovo<T> where T : class
    {
        private readonly Func<T> carica;
        private readonly Func<T> seGuasto;
        private readonly TimeSpan durata;
        private readonly Func<DateTime> adesso;
        private readonly Action<Action> avviaInBackground;
        private readonly Action<Exception>? registraErrore;

        private readonly object blocco = new object();
        private readonly object primoCaricamento = new object();
        private T? valore;
        private DateTime scadenza;
        private bool rinnovoInCorso;

        /// adesso e avviaInBackground si passano solo nei test: di norma l'ora del sistema e Task.Run.
        public CacheConRinnovo(Func<T> carica, Func<T> seGuasto, TimeSpan durata,
            Action<Exception>? registraErrore = null, Func<DateTime>? adesso = null, Action<Action>? avviaInBackground = null)
        {
            this.carica = carica;
            this.seGuasto = seGuasto;
            this.durata = durata;
            this.registraErrore = registraErrore;
            this.adesso = adesso ?? (() => DateTime.UtcNow);
            this.avviaInBackground = avviaInBackground ?? (azione => Task.Run(azione));
        }

        /// Il valore: alla prima lettura lo carica e aspetta; poi lo restituisce subito, e se e' scaduto
        /// avvia il rinnovo (uno solo alla volta) senza aspettarlo.
        public T Leggi()
        {
            lock (blocco)
            {
                if (valore != null)
                {
                    if (adesso() >= scadenza && !rinnovoInCorso)
                    {
                        rinnovoInCorso = true;
                        avviaInBackground(Rinnova);
                    }
                    return valore;
                }
            }

            // Due richieste alla prima apertura: carica una, l'altra aspetta il suo risultato.
            lock (primoCaricamento)
            {
                lock (blocco)
                {
                    if (valore != null)
                    {
                        return valore;
                    }
                }

                T nuovo;
                try
                {
                    nuovo = carica();
                }
                catch (Exception e)
                {
                    registraErrore?.Invoke(e);
                    nuovo = seGuasto();
                }

                lock (blocco)
                {
                    valore = nuovo;
                    scadenza = adesso() + durata;
                }
                return nuovo;
            }
        }

        private void Rinnova()
        {
            T? nuovo = null;
            try
            {
                nuovo = carica();
            }
            catch (Exception e)
            {
                registraErrore?.Invoke(e);
            }
            finally
            {
                lock (blocco)
                {
                    if (nuovo != null)
                    {
                        valore = nuovo;
                    }
                    scadenza = adesso() + durata;
                    rinnovoInCorso = false;
                }
            }
        }
    }
}
