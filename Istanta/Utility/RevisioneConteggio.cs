using Istanta.Models;
using Istanta.Models_2;

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

        /// I20-1120: la firma del tracciato di ogni sottogruppo, per la vista Sottogruppi del revisore
        /// (Revisore/getArticoliDescrizioniSottogruppi). A ogni sottogruppo si passano solo i record dei
        /// suoi codici, nell'ordine in cui arrivano: per un sottogruppo getFirmaTracciatoGruppoDaRecords
        /// scarta comunque gli altri, quindi la firma e' la stessa. Prima riceveva tutti i record della
        /// promo e ne leggeva il dato per ogni sottogruppo: sottogruppi per record, 43 s su una promo
        /// vera, con la pagina che sembrava vuota.
        public static Dictionary<string, string> FirmeDeiSottogruppi(
            IEnumerable<PromoTracciatiRecord>? records,
            IEnumerable<string>? sottogruppi)
        {
            var elenco = (records ?? Enumerable.Empty<PromoTracciatiRecord>()).ToList();

            //Per codice, senza leggere il dato: le posizioni servono a tenere l'ordine originale.
            var posizioniPerCodice = new Dictionary<string, List<int>>(StringComparer.OrdinalIgnoreCase);
            for (int i = 0; i < elenco.Count; i++)
            {
                var codice = elenco[i]?.Codice;
                if (string.IsNullOrWhiteSpace(codice))
                {
                    continue;
                }
                if (!posizioniPerCodice.TryGetValue(codice, out var posizioni))
                {
                    posizioni = new List<int>();
                    posizioniPerCodice[codice] = posizioni;
                }
                posizioni.Add(i);
            }

            var firme = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var sottogruppo in sottogruppi ?? Enumerable.Empty<string>())
            {
                if (string.IsNullOrWhiteSpace(sottogruppo) || firme.ContainsKey(sottogruppo))
                {
                    continue;
                }

                var codici = sottogruppo
                    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                    .Distinct(StringComparer.OrdinalIgnoreCase);

                var recordsDelSottogruppo = codici
                    .SelectMany(c => posizioniPerCodice.TryGetValue(c, out var posizioni) ? posizioni : Enumerable.Empty<int>())
                    .Distinct()
                    .OrderBy(i => i)
                    .Select(i => elenco[i])
                    .ToList();

                firme[sottogruppo] = Main.getFirmaTracciatoGruppoDaRecords(recordsDelSottogruppo, sottogruppo, true);
            }

            return firme;
        }

        private static List<ArticoliDescrizioni> SoloNazionali(IEnumerable<ArticoliDescrizioni>? descrizioni)
        {
            return (descrizioni ?? Enumerable.Empty<ArticoliDescrizioni>())
                .Where(f => f != null && f.Area == null && f.Canale == null)
                .ToList();
        }
    }
}
