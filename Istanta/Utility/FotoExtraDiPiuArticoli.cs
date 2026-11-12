using Istanta.Models;
using IstantaLib;

namespace Istanta.Utility
{
    /// Le foto extra di una referenza singola o di un gruppo, come le gestiscono la Scheda articolo e
    /// il revisore.
    ///
    /// Un gruppo non ha un articolo suo: le sue foto extra sono le stesse righe ripetute su ogni
    /// articolo del gruppo, con lo stesso GUID (caricarle o collegarle le scrive su tutti). Del gruppo
    /// si mostrano solo quelle che stanno su tutte le referenze: una che manca su qualcuna non e' del
    /// gruppo, e trattarla come tale farebbe credere che il box la porti.
    public static class FotoExtraDiPiuArticoli
    {
        /// I codici di un codice singolo o di gruppo ("123,456"), senza spazi, vuoti e doppioni.
        public static List<string> Codici(string? codice)
        {
            return (codice ?? "").Split(',')
                .Select(c => c.Trim())
                .Where(c => c != "")
                .Distinct()
                .ToList();
        }

        /// Un gruppo e' un codice con piu' referenze.
        public static bool EGruppo(string? codice)
        {
            return Codici(codice).Count > 1;
        }

        /// Una foto extra: ha un tipo e non e' la foto del prodotto.
        public static bool EExtra(ArticoliFoto foto)
        {
            return foto.Tipo.HasValue && foto.Tipo != (byte)TipoFoto.Foto && !string.IsNullOrEmpty(foto.GuidId);
        }

        /// Le foto extra di un articolo, una per nome: dello stesso file possono esistere piu'
        /// versioni, e in elenco ne va una. E' la regola che la Scheda articolo usava gia'.
        public static List<ArticoliFoto> DiUnArticolo(IEnumerable<ArticoliFoto>? foto)
        {
            return (foto ?? Enumerable.Empty<ArticoliFoto>())
                .Where(f => f.Tipo.HasValue && f.Tipo != (byte)TipoFoto.Foto)
                .GroupBy(f => f.NomeReale)
                .Select(g => g.First())
                .ToList();
        }

        /// Le foto extra presenti su tutti gli articoli del gruppo, una per GUID, nell'ordine del primo
        /// articolo. Attiva vale solo se lo e' su tutti: una casella spuntata deve voler dire che il
        /// logo esce con ogni referenza. Le righe restituite sono copie: le entita' lette dal database
        /// non si toccano.
        public static List<ArticoliFoto> ComuniAlGruppo(IReadOnlyList<IEnumerable<ArticoliFoto>?> fotoPerArticolo)
        {
            if (fotoPerArticolo.Count == 0)
            {
                return new List<ArticoliFoto>();
            }

            var extraPerArticolo = fotoPerArticolo
                .Select(foto => (foto ?? Enumerable.Empty<ArticoliFoto>()).Where(EExtra).ToList())
                .ToList();

            var risultato = new List<ArticoliFoto>();
            foreach (var guid in extraPerArticolo[0].Select(f => f.GuidId).Distinct())
            {
                var righe = extraPerArticolo.Select(extra => extra.Where(f => f.GuidId == guid).ToList()).ToList();
                if (righe.Any(r => r.Count == 0))
                {
                    continue;
                }

                var prima = righe[0][0];
                risultato.Add(new ArticoliFoto
                {
                    Id = prima.Id,
                    IdArticolo = prima.IdArticolo,
                    Area = prima.Area,
                    Canale = prima.Canale,
                    PathFoto = prima.PathFoto,
                    NomeReale = prima.NomeReale,
                    GuidId = prima.GuidId,
                    Puntatore = prima.Puntatore,
                    DataInserimento = prima.DataInserimento,
                    StatoSelezione = prima.StatoSelezione,
                    Attiva = righe.All(r => r.Any(f => f.Attiva == true)),
                    Hash = prima.Hash,
                    DataModifica = prima.DataModifica,
                    Tipo = prima.Tipo,
                });
            }

            return risultato;
        }

        /// Le righe di una foto extra da attivare o disattivare. Con i codici, solo quelle degli
        /// articoli indicati: lo stesso logo collegato a piu' articoli ha lo stesso GUID, e cercando
        /// per GUID soltanto si cambiava la prima riga trovata, che poteva essere di un altro articolo.
        /// Senza codici resta il comportamento di prima, per i Plugin non ancora aggiornati.
        public static List<ArticoliFoto> DaAttivare(IEnumerable<ArticoliFoto> righeDelGuid, Func<ArticoliFoto, string?> codiceDellArticolo, string? codice)
        {
            var codici = Codici(codice);
            if (codici.Count == 0)
            {
                var prima = righeDelGuid.FirstOrDefault();
                return prima == null ? new List<ArticoliFoto>() : new List<ArticoliFoto> { prima };
            }

            return righeDelGuid.Where(f => codici.Contains(codiceDellArticolo(f) ?? "")).ToList();
        }
    }
}
