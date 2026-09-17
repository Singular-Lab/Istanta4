using Istanta.Models;

namespace Istanta.Utility
{
    /// Le regole con cui il conteggio delle revisioni in home (Revisore/getConteggio) deve
    /// leggere i dati nello stesso modo della pagina del revisore (getListaRevisione2).
    /// I due percorsi erano scritti due volte e divergevano su dettagli che, uno alla volta,
    /// spostano il conteggio di un elemento: qui stanno le parti pure, verificabili senza
    /// database. La pagina resta la definizione di riferimento: se cambia lei, cambia qui.
    public static class RevisioneConteggio
    {
        /// Ultima versione di ogni label, tracciato per tracciato. E' la deduplica che fa
        /// la pagina; deduplicare per sola label fa scartare a vicenda due tracciati che
        /// hanno la stessa label a versioni diverse.
        public static IEnumerable<T> UltimaVersionePerTracciato<T>(
            IEnumerable<T> records,
            Func<T, string?> label,
            Func<T, int> idTracciato,
            Func<T, int> versione)
        {
            if (records == null)
            {
                return Enumerable.Empty<T>();
            }

            return records
                .GroupBy(r => (Label: label(r) ?? "", Tracciato: idTracciato(r)))
                .SelectMany(g =>
                {
                    var massima = g.Max(versione);
                    return g.Where(r => versione(r) == massima);
                });
        }

        /// La descrizione nazionale con cui confrontare la firma di un articolo, scelta come
        /// fa la pagina: prima quella che porta gia' la firma del record (custom, poi
        /// standard), altrimenti la piu' recente (custom, poi standard). Prendere la prima
        /// che capita rende "da confermare" qui un articolo che la pagina mostra revisionato.
        public static ArticoliDescrizioni? ScegliDescrizioneNazionale(
            IEnumerable<ArticoliDescrizioni>? descrizioni,
            string? firma)
        {
            var nazionali = SoloNazionali(descrizioni);

            return nazionali.FirstOrDefault(f => f.Custom != null && f.FirmaTracciato == firma)
                ?? nazionali.FirstOrDefault(f => f.Custom == null && f.FirmaTracciato == firma)
                ?? nazionali.Where(f => f.Custom != null).OrderByDescending(o => o.DataUltimaRicezione).FirstOrDefault()
                ?? nazionali.Where(f => f.Custom == null).OrderByDescending(o => o.DataUltimaRicezione).FirstOrDefault();
        }

        /// Per i gruppi la pagina non guarda la firma: prende la custom se c'e', poi la standard.
        public static ArticoliDescrizioni? ScegliDescrizioneNazionaleGruppo(
            IEnumerable<ArticoliDescrizioni>? descrizioni)
        {
            var nazionali = SoloNazionali(descrizioni);

            return nazionali.FirstOrDefault(f => f.Custom != null)
                ?? nazionali.FirstOrDefault(f => f.Custom == null);
        }

        private static List<ArticoliDescrizioni> SoloNazionali(IEnumerable<ArticoliDescrizioni>? descrizioni)
        {
            return (descrizioni ?? Enumerable.Empty<ArticoliDescrizioni>())
                .Where(f => f != null && f.Area == null && f.Canale == null)
                .ToList();
        }
    }
}
