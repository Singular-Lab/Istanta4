using System;
using System.Collections.Concurrent;
using System.IO;
using System.Threading;

namespace IstantaLib
{
    /// Cache di un valore ricavato da un file, invalidata quando il file cambia.
    ///
    /// Serve ai source dei clienti e alla dll di agenzia: sono file che cambiano di rado ma
    /// venivano riletti e ricostruiti a ogni chiamata. L'invalidazione guarda data di
    /// modifica e dimensione, cosi' ricopiare un file a mano continua a produrre effetto
    /// senza riavviare l'applicazione.
    ///
    /// Contratto: i valori in cache sono condivisi fra le chiamate e vanno trattati come
    /// di sola lettura. Chi ne modificasse uno si porterebbe la modifica anche nelle
    /// chiamate successive, che e' un guaio ben peggiore del tempo risparmiato.
    public sealed class CacheFilePerPercorso<T> where T : class
    {
        private sealed class Voce
        {
            public T Valore = default!;
            public DateTime ScrittoUtc;
            public long Dimensione;
        }

        private readonly ConcurrentDictionary<string, Voce> voci = new();
        private readonly ConcurrentDictionary<string, object> lucchetti = new();

        private int caricamenti;

        /// Quante volte il caricatore e' stato eseguito davvero. Serve a verificare la cache.
        public int Caricamenti => Volatile.Read(ref this.caricamenti);

        /// <param name="percorso">File da cui il valore dipende.</param>
        /// <param name="carica">Come costruire il valore quando il file e' cambiato.</param>
        /// <param name="chiave">Voce di cache, se dallo stesso file si ricavano valori diversi.</param>
        /// <param name="statoFile">Data di modifica e dimensione: iniettabile per i test.</param>
        public T Ottieni(
            string percorso,
            Func<string, T> carica,
            string? chiave = null,
            Func<string, (DateTime scrittoUtc, long dimensione)>? statoFile = null)
        {
            ArgumentNullException.ThrowIfNull(carica);

            if (string.IsNullOrWhiteSpace(percorso))
            {
                return Esegui(percorso, carica);
            }

            var lettura = statoFile ?? StatoDalDisco;
            DateTime scrittoUtc;
            long dimensione;

            try
            {
                (scrittoUtc, dimensione) = lettura(percorso);
            }
            catch
            {
                // Se non si riesce nemmeno a guardare il file, non si mette nulla in cache e
                // si lascia parlare il caricatore vero: i suoi messaggi d'errore sono quelli
                // che l'operatore conosce.
                return Esegui(percorso, carica);
            }

            var chiaveVoce = chiave ?? percorso;

            if (this.voci.TryGetValue(chiaveVoce, out var esistente)
                && esistente.ScrittoUtc == scrittoUtc
                && esistente.Dimensione == dimensione)
            {
                return esistente.Valore;
            }

            // Un solo caricamento per chiave anche con piu' richieste insieme: questi file
            // arrivano a diversi megabyte e parsarli in parallelo non aiuta nessuno.
            lock (this.lucchetti.GetOrAdd(chiaveVoce, _ => new object()))
            {
                if (this.voci.TryGetValue(chiaveVoce, out var giaFatto)
                    && giaFatto.ScrittoUtc == scrittoUtc
                    && giaFatto.Dimensione == dimensione)
                {
                    return giaFatto.Valore;
                }

                var valore = Esegui(percorso, carica);

                this.voci[chiaveVoce] = new Voce
                {
                    Valore = valore,
                    ScrittoUtc = scrittoUtc,
                    Dimensione = dimensione
                };

                return valore;
            }
        }

        private T Esegui(string percorso, Func<string, T> carica)
        {
            Interlocked.Increment(ref this.caricamenti);
            return carica(percorso);
        }

        private static (DateTime, long) StatoDalDisco(string percorso)
        {
            var info = new FileInfo(percorso);

            if (!info.Exists)
            {
                throw new FileNotFoundException("File non trovato: " + percorso, percorso);
            }

            return (info.LastWriteTimeUtc, info.Length);
        }
    }
}
