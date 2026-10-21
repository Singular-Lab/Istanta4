using Istanta.Models_2;
using Microsoft.EntityFrameworkCore;

namespace Istanta.Utility
{
    /// I20-1088: quale riga di PromoLavorazioniRecord porta i meta di un'impaginazione.
    ///
    /// Una lavorazione ha una riga per ogni gruppo impaginato, legata al record del tracciato con cui
    /// e' stato impaginato (IdRecordTracciato); le referenze del gruppo non hanno righe proprie. Lo
    /// stesso codice gruppo impaginato due volte, con idRec diversi, ha due righe e meta distinti.
    /// Prima di I20-1088 la lettura dei meta e alcune scritture prendevano la prima riga del codice
    /// gruppo: con due impaginazioni i meta di una finivano sull'altra.
    public static class RecordDellaLavorazione
    {
        /// Il minimo di un record del tracciato che serve a riconoscere un fratello.
        public class RecordDelTracciato
        {
            public long Id { get; set; }
            public int IdTracciato { get; set; }
            public string? CodiceGruppo { get; set; }
            public string? Label { get; set; }
            public byte Versione { get; set; }
        }

        /// La riga dei meta di un gruppo letto dalla lista: quella legata a uno dei suoi record. Se il
        /// codice gruppo ha una sola riga nella lavorazione vale quella, anche se il record a cui e'
        /// legata non e' fra quelli letti (un record ricreato): c'e' una sola impaginazione. Null se le
        /// righe sono piu' d'una e nessuna e' di questo gruppo.
        public static PromoLavorazioniRecord? PerLaLettura(IEnumerable<PromoLavorazioniRecord>? righe, IEnumerable<long>? idRecDelGruppo)
        {
            var elenco = righe?.Where(r => r != null).ToList() ?? new List<PromoLavorazioniRecord>();
            if (elenco.Count == 0)
                return null;

            var ids = new HashSet<long>(idRecDelGruppo ?? Enumerable.Empty<long>());
            var legata = elenco.FirstOrDefault(r => ids.Contains(r.IdRecordTracciato));
            if (legata != null)
                return legata;

            return elenco.Count == 1 ? elenco[0] : null;
        }

        /// La riga su cui registrare una modifica dell'operatore fatta sul box del record idRec: il
        /// match esatto, poi il record fratello (stesso tracciato, versione, label e codice gruppo),
        /// poi la sola riga del codice gruppo. Senza idRec (client vecchi) la prima riga. Null se
        /// non ce n'e' una.
        public static PromoLavorazioniRecord? PerLaScrittura(IList<PromoLavorazioniRecord> candidati, long idRec,
            RecordDelTracciato? recordDelBox, IEnumerable<RecordDelTracciato>? recordsDeiCandidati)
        {
            if (candidati == null || candidati.Count == 0)
                return null;
            if (idRec <= 0)
                return candidati[0];

            var esatta = candidati.FirstOrDefault(c => c.IdRecordTracciato == idRec);
            if (esatta != null)
                return esatta;

            if (recordDelBox != null && recordsDeiCandidati != null)
            {
                var fratello = recordsDeiCandidati.FirstOrDefault(r =>
                    r.IdTracciato == recordDelBox.IdTracciato &&
                    r.Versione == recordDelBox.Versione &&
                    r.Label == recordDelBox.Label &&
                    string.Equals(r.CodiceGruppo, recordDelBox.CodiceGruppo, StringComparison.OrdinalIgnoreCase));
                if (fratello != null)
                {
                    var delFratello = candidati.FirstOrDefault(c => c.IdRecordTracciato == fratello.Id);
                    if (delFratello != null)
                        return delFratello;
                }
            }

            return candidati.Count == 1 ? candidati[0] : null;
        }

        /// PerLaScrittura sulle righe che la query trova. Eccezione se non ce n'e' una.
        public static PromoLavorazioniRecord Trova(Edro21_DbContext2 ctx2, IQueryable<PromoLavorazioniRecord> query, long idRec, string? codice)
        {
            var candidati = query.ToList();

            RecordDelTracciato? recordDelBox = null;
            List<RecordDelTracciato>? recordsDeiCandidati = null;
            if (idRec > 0 && candidati.Count > 0 && !candidati.Any(c => c.IdRecordTracciato == idRec))
            {
                var ids = candidati.Select(c => c.IdRecordTracciato).Append(idRec).Distinct().ToList();
                var letti = ctx2.PromoTracciatiRecords
                    .AsNoTracking()
                    .Where(r => ids.Contains(r.Id))
                    .Select(r => new RecordDelTracciato
                    {
                        Id = r.Id,
                        IdTracciato = r.IdTracciato,
                        CodiceGruppo = r.CodiceGruppo,
                        Label = r.Label,
                        Versione = r.Versione
                    })
                    .ToList();
                recordDelBox = letti.FirstOrDefault(r => r.Id == idRec);
                recordsDeiCandidati = letti.Where(r => r.Id != idRec).ToList();
            }

            return PerLaScrittura(candidati, idRec, recordDelBox, recordsDeiCandidati)
                ?? throw new Exception($"Nessun elemento trovato, Codice {codice} non disponibile");
        }

        /// La riga del codice gruppo nella lavorazione, per un box del record idRec.
        public static PromoLavorazioniRecord Trova(Edro21_DbContext2 ctx2, int idLavorazione, string? codiceGruppo, long idRec)
        {
            var query = ctx2.PromoLavorazioniRecords
                .Include(i1 => i1.IdPromoTracciatiRecordNavigation)
                .Where(plr => plr.IdLavorazione == idLavorazione && plr.CodiceGruppo == codiceGruppo);
            return Trova(ctx2, query, idRec, codiceGruppo);
        }

        /// La versione attuale del record del tracciato, o null se non si trova.
        public static byte? VersioneDelRecord(Edro21_DbContext2 ctx2, long idRec)
        {
            if (idRec <= 0)
                return null;
            var record = ctx2.PromoTracciatiRecords.AsNoTracking().Where(r => r.Id == idRec).Select(r => new { r.Versione }).FirstOrDefault();
            return record?.Versione;
        }
    }
}
