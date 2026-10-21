using Istanta.Models;

namespace Istanta.Utility
{
    /// I20-1120: i sottogruppi delle righe del revisore. La pagina tiene una riga per referenza e
    /// gruppo (getListaRevisione2), e quella riga porta il sottogruppo di un solo record. Ma la stessa
    /// referenza, nello stesso gruppo, puo' stare in sottogruppi diversi a seconda del tracciato e
    /// dell'etichetta, ed e' voluto: la vista Sottogruppi ne vedeva uno solo, e i sottogruppi da
    /// revisionare che il conteggio della pagina Tracciati trova negli altri record non comparivano.
    /// Qui le parti pure: per ogni riga, gli altri sottogruppi con il record che li porta.
    public static class RevisioneSottogruppi
    {
        /// Un record caricato dal revisore, ridotto a cio' che serve: referenza e gruppo gia' nella forma
        /// della chiave della riga, il sottogruppo del record e il record stesso.
        public readonly record struct RecordSottogruppo(
            string Ref,
            string Gruppo,
            string? Sottogruppo,
            long IdRec,
            int IdTracciato,
            string? Label);

        /// Per ogni referenza e gruppo, i sottogruppi distinti dei suoi record, ciascuno con il primo
        /// record che lo porta, nell'ordine in cui arrivano. I sottogruppi vuoti non contano.
        public static Dictionary<(string Ref, string Gruppo), List<SottogruppoDellaRiga>> SottogruppiPerRiga(
            IEnumerable<RecordSottogruppo>? records)
        {
            var mappa = new Dictionary<(string Ref, string Gruppo), List<SottogruppoDellaRiga>>();
            foreach (var record in records ?? Enumerable.Empty<RecordSottogruppo>())
            {
                var sottogruppo = record.Sottogruppo?.Trim();
                if (string.IsNullOrEmpty(sottogruppo))
                {
                    continue;
                }

                var chiave = (record.Ref ?? "", record.Gruppo ?? "");
                if (!mappa.TryGetValue(chiave, out var elenco))
                {
                    elenco = new List<SottogruppoDellaRiga>();
                    mappa[chiave] = elenco;
                }

                if (elenco.Any(s => string.Equals(s.CodiceSottogruppo, sottogruppo, StringComparison.Ordinal)))
                {
                    continue;
                }

                elenco.Add(new SottogruppoDellaRiga
                {
                    CodiceSottogruppo = sottogruppo,
                    IdRec = record.IdRec,
                    IdTracciato = record.IdTracciato,
                    Label = record.Label
                });
            }

            return mappa;
        }

        /// Gli altri sottogruppi della riga: quelli della sua referenza e del suo gruppo, tolto quello
        /// che la riga porta gia'. Null se non ce ne sono, cosi' la risposta delle righe normali resta
        /// quella di prima.
        public static List<SottogruppoDellaRiga>? AltriSottogruppi(
            Dictionary<(string Ref, string Gruppo), List<SottogruppoDellaRiga>>? mappa,
            (string Ref, string Gruppo) chiave,
            string? sottogruppoDellaRiga)
        {
            if (mappa == null || !mappa.TryGetValue(chiave, out var elenco))
            {
                return null;
            }

            var proprio = sottogruppoDellaRiga?.Trim() ?? "";
            var altri = elenco
                .Where(s => !string.Equals(s.CodiceSottogruppo, proprio, StringComparison.Ordinal))
                .ToList();

            return altri.Count > 0 ? altri : null;
        }
    }
}
