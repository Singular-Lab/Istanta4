using Istanta.Models_2;
using IstantaLib;
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

        /// TASK-bb04f9aa: come PerLaLettura, ma fra le righe ci sono anche quelle disattivate (box usciti
        /// dalla lavorazione, con i meta conservati). Vale la riga attiva legata al gruppo; se non
        /// c'e', la riga disattivata legata al gruppo, cosi' il box reimpaginato nasce con i suoi meta;
        /// poi la sola riga attiva del codice gruppo, come prima. Due righe disattivate legate allo
        /// stesso gruppo non dicono quale vale: nessuna delle due.
        public static PromoLavorazioniRecord? PerLaLetturaConDisattivate(IEnumerable<PromoLavorazioniRecord>? righe, IEnumerable<long>? idRecDelGruppo)
        {
            var elenco = righe?.Where(r => r != null).ToList() ?? new List<PromoLavorazioniRecord>();
            var attive = elenco.Where(r => r.Attivo).ToList();
            var ids = new HashSet<long>(idRecDelGruppo ?? Enumerable.Empty<long>());

            var legata = attive.FirstOrDefault(r => ids.Contains(r.IdRecordTracciato));
            if (legata != null)
                return legata;

            var disattivate = elenco.Where(r => !r.Attivo && ids.Contains(r.IdRecordTracciato)).ToList();
            if (disattivate.Count == 1)
                return disattivate[0];

            return attive.Count == 1 ? attive[0] : null;
        }

        /// TASK-bb04f9aa: il box esce dalla lavorazione. La riga resta, con i suoi meta, ma non e' piu'
        /// un'impaginazione: nessuna lettura la vede finche' lo stesso record non viene reimpaginato.
        public static void Disattiva(PromoLavorazioniRecord? riga)
        {
            if (riga != null)
                riga.Attivo = false;
        }

        public static void Disattiva(IEnumerable<PromoLavorazioniRecord>? righe)
        {
            foreach (var riga in righe ?? Enumerable.Empty<PromoLavorazioniRecord>())
                Disattiva(riga);
        }

        /// TASK-bb04f9aa: fra le righe disattivate di una lavorazione, quella da riattivare per il box
        /// che si sta impaginando: stesso codice gruppo e stesso record, altrimenti un record fratello
        /// (stesso tracciato, versione e label: dopo un cambio di primaria il gruppo arriva con
        /// l'idRec della nuova primaria). Se i fratelli candidati sono piu' d'uno non se ne riattiva
        /// nessuno: meglio un box senza meta che un box con i meta di un altro.
        public static PromoLavorazioniRecord? DaRiattivare(IEnumerable<PromoLavorazioniRecord>? righe, string? codiceGruppo, long idRec, IEnumerable<long>? idRecDeiFratelli)
        {
            var disattivate = (righe ?? Enumerable.Empty<PromoLavorazioniRecord>())
                .Where(r => r != null && !r.Attivo && string.Equals(r.CodiceGruppo, codiceGruppo, StringComparison.OrdinalIgnoreCase))
                .ToList();
            if (disattivate.Count == 0 || idRec <= 0)
                return null;

            var esatte = disattivate.Where(r => r.IdRecordTracciato == idRec).ToList();
            if (esatte.Count > 0)
                return esatte.OrderByDescending(r => r.RegisterDate).First();

            var fratelli = new HashSet<long>(idRecDeiFratelli ?? Enumerable.Empty<long>());
            var deiFratelli = disattivate.Where(r => fratelli.Contains(r.IdRecordTracciato)).ToList();
            return deiFratelli.Count == 1 ? deiFratelli[0] : null;
        }

        /// TASK-bb04f9aa: la riga torna (o nasce) impaginata: prende il record, la pagina e l'autore di
        /// questa impaginazione e tiene Id e meta. L'idRec e' quello con cui il box nasce ora, lo
        /// stesso del suo DNA nel documento: da qui in poi il box trova la riga per match esatto.
        public static void Compila(PromoLavorazioniRecord riga, int idLavorazione, string? codice, string? codiceGruppo, long idRec, byte pagina, short idAutore, DateTime adesso)
        {
            riga.IdLavorazione = idLavorazione;
            riga.Codice = codice;
            riga.CodiceGruppo = codiceGruppo;
            riga.IdRecordTracciato = idRec;
            riga.Pagina = pagina;
            riga.Indice = (byte)0;
            riga.IdAutore = idAutore;
            riga.RegisterDate = adesso;
            riga.Attivo = true;
        }

        /// TASK-bb04f9aa: registra l'impaginazione di un box. Se il record (o un suo fratello) ha una
        /// riga disattivata in questa lavorazione la riattiva, con i meta che aveva; altrimenti crea
        /// la riga. Unico punto in cui nasce una riga di promo_lavorazioni_records. Non salva.
        public static PromoLavorazioniRecord Impagina(Edro21_DbContext2 ctx2, int idLavorazione, string? codice, string? codiceGruppo, long idRec, byte pagina, short idAutore)
        {
            //Il filtro !Attivo si ripete in memoria: una riga riattivata o disattivata in questa stessa
            //richiesta, non ancora salvata, torna dal database con il valore vecchio ma l'istanza e'
            //quella tracciata, con il valore nuovo.
            var disattivate = ctx2.PromoLavorazioniRecords
                .IgnoreQueryFilters()
                .Where(r => r.IdLavorazione == idLavorazione && !r.Attivo && r.DerivatoDi == null && r.CodiceGruppo == codiceGruppo)
                .ToList()
                .Where(r => !r.Attivo)
                .ToList();

            PromoLavorazioniRecord? riga = null;
            if (disattivate.Count > 0)
            {
                var fratelli = disattivate.Any(r => r.IdRecordTracciato == idRec)
                    ? new List<long>()
                    : IdDeiFratelli(ctx2, idRec, codiceGruppo);
                riga = DaRiattivare(disattivate, codiceGruppo, idRec, fratelli);
            }

            if (riga == null)
            {
                riga = new PromoLavorazioniRecord();
                ctx2.PromoLavorazioniRecords.Add(riga);
            }

            Compila(riga, idLavorazione, codice, codiceGruppo, idRec, pagina, idAutore, DateTime.Now);
            return riga;
        }

        /// I record fratelli di idRec: stesso tracciato, versione, label e codice gruppo. Vuoto se il
        /// record non c'e'.
        public static List<long> IdDeiFratelli(Edro21_DbContext2 ctx2, long idRec, string? codiceGruppo)
        {
            var record = ctx2.PromoTracciatiRecords.AsNoTracking()
                .Where(r => r.Id == idRec)
                .Select(r => new { r.IdTracciato, r.Versione, r.Label })
                .FirstOrDefault();
            if (record == null)
                return new List<long>();

            return ctx2.PromoTracciatiRecords.AsNoTracking()
                .Where(r => r.Id != idRec && r.IdTracciato == record.IdTracciato && r.Versione == record.Versione
                    && r.Label == record.Label && r.CodiceGruppo == codiceGruppo)
                .Select(r => r.Id)
                .ToList();
        }

        /// TASK-bb04f9aa: prima di eliminare dei record dal tracciato, cancella davvero le righe
        /// disattivate che li riferiscono: non sono impaginazioni e non devono bloccare l'eliminazione
        /// (la chiave esterna la rifiuterebbe). Le righe attive restano, e bloccano come prima.
        public static void EliminaLeDisattivateDei(Edro21_DbContext2 ctx2, IEnumerable<long>? idRecord)
        {
            var ids = (idRecord ?? Enumerable.Empty<long>()).Distinct().ToList();
            if (ids.Count == 0)
                return;

            var disattivate = ctx2.PromoLavorazioniRecords
                .IgnoreQueryFilters()
                .Where(r => ids.Contains(r.IdRecordTracciato))
                .ToList()
                .Where(r => !r.Attivo)
                .ToList();
            ctx2.PromoLavorazioniRecords.RemoveRange(disattivate);
        }

        /* ---- TASK-22d7fad2: box derivati ---- */

        /// Perche' non si puo' creare un derivato del box, o null se si puo'. originale e' la riga del
        /// box di partenza come la trovano le letture normali: null se il box non e' impaginato, o se
        /// e' a sua volta un derivato (che quelle letture non vedono).
        public static string? MotivoDelDerivatoRifiutato(PromoLavorazioniRecord? originale, int pagina, TipoLavorazione? tipoLavorazione, string? codiceGruppo)
        {
            if (tipoLavorazione != TipoLavorazione.Volantino)
                return "i box derivati esistono solo nelle lavorazioni Volantino.";
            if (pagina <= 0 || pagina > byte.MaxValue)
                return $"la pagina {pagina} non e' valida.";
            if (originale == null)
                return $"il box {codiceGruppo} non e' impaginato in questa lavorazione: un derivato nasce da un box impaginato.";
            if (originale.DerivatoDi != null)
                return $"il box {codiceGruppo} e' un derivato: un derivato non puo' essere derivato a sua volta.";
            return null;
        }

        /// La riga di un derivato nuovo: stesso record e stesso gruppo dell'originale, alla pagina
        /// chiesta, con una copia dei suoi meta, che da qui in poi sono indipendenti.
        public static PromoLavorazioniRecord NuovoDerivato(PromoLavorazioniRecord originale, byte pagina, short idAutore, DateTime adesso)
        {
            return new PromoLavorazioniRecord
            {
                IdLavorazione = originale.IdLavorazione,
                IdRecordTracciato = originale.IdRecordTracciato,
                Codice = originale.Codice,
                CodiceGruppo = originale.CodiceGruppo,
                Pagina = pagina,
                Indice = (byte)0,
                IdAutore = idAutore,
                RegisterDate = adesso,
                Meta = originale.Meta,
                Attivo = true,
                DerivatoDi = originale.Id
            };
        }

        /// Aggiunge al contesto la riga di un derivato nuovo. Non salva.
        public static PromoLavorazioniRecord RegistraDerivato(Edro21_DbContext2 ctx2, PromoLavorazioniRecord originale, byte pagina, short idAutore)
        {
            var nuovo = NuovoDerivato(originale, pagina, idAutore, DateTime.Now);
            ctx2.PromoLavorazioniRecords.Add(nuovo);
            return nuovo;
        }

        /// Cancella i derivati della query, con i loro meta: e' cosi' che un derivato esce. Non salva.
        public static void EliminaDerivati(Edro21_DbContext2 ctx2, IQueryable<PromoLavorazioniRecord> derivati)
        {
            ctx2.PromoLavorazioniRecords.RemoveRange(derivati.ToList().Where(r => r.DerivatoDi != null));
        }

        /// I derivati impaginati: le sole righe che il filtro del contesto nasconde pur essendo attive.
        public static IQueryable<PromoLavorazioniRecord> Derivati(Edro21_DbContext2 ctx2)
        {
            return ctx2.PromoLavorazioniRecords.IgnoreQueryFilters().Where(r => r.Attivo && r.DerivatoDi != null);
        }

        /// Tutte le impaginazioni in corso, derivati compresi: per chi deve sapere se un record e'
        /// impaginato (prima di eliminarlo) o quali box stanno su una pagina.
        public static IQueryable<PromoLavorazioniRecord> ImpaginatiConDerivati(Edro21_DbContext2 ctx2)
        {
            return ctx2.PromoLavorazioniRecords.IgnoreQueryFilters().Where(r => r.Attivo);
        }

        /// Il derivato con quell'Id nella lavorazione. Eccezione se non c'e': e' stato rimosso (un
        /// derivato rimosso si cancella), o l'Id non e' di un derivato di questa lavorazione.
        public static PromoLavorazioniRecord IlDerivato(Edro21_DbContext2 ctx2, int idLavorazione, long idLavRec)
        {
            return Derivati(ctx2)
                .Include(r => r.IdPromoTracciatiRecordNavigation)
                .FirstOrDefault(r => r.Id == idLavRec && r.IdLavorazione == idLavorazione)
                ?? throw new ErroreIstanta("lettura del derivato", $"il box derivato {idLavRec} non esiste nella lavorazione {idLavorazione}: e' stato rimosso.");
        }

        /// Il derivato con quell'Id nella lavorazione, o null se non c'e' piu': per chi confronta il
        /// documento col server, dove un derivato rimosso e' un caso da riferire e non un errore.
        public static PromoLavorazioniRecord? DerivatoSeEsiste(Edro21_DbContext2 ctx2, int idLavorazione, long idLavRec)
        {
            return Derivati(ctx2)
                .Include(r => r.IdPromoTracciatiRecordNavigation)
                .FirstOrDefault(r => r.Id == idLavRec && r.IdLavorazione == idLavorazione);
        }

        /// L'idLavRec con cui il box della riga si presenta nel documento: l'Id della riga per un
        /// derivato, 0 per un originale (il suo DNA non lo porta).
        public static long IdLavRecDelBox(PromoLavorazioniRecord riga)
        {
            return riga.DerivatoDi != null ? riga.Id : 0;
        }

        /// Se una voce della mappa del documento (codice, idRec, idLavRec del DNA) e' il box della
        /// riga. Un derivato si riconosce solo dal suo idLavRec; un originale dal codice gruppo e,
        /// quando la voce lo porta, dall'idRec, e mai dalla voce di un derivato: il derivato di un
        /// box sta su un'altra pagina e non dice dov'e' l'originale.
        public static bool EVoceDelBox(PromoLavorazioniRecord riga, string? codice, long idRec, long idLavRec)
        {
            if (riga.DerivatoDi != null)
                return idLavRec == riga.Id;
            if (idLavRec > 0)
                return false;
            if (!string.Equals(codice, riga.CodiceGruppo, StringComparison.OrdinalIgnoreCase))
                return false;
            return idRec <= 0 || idRec == riga.IdRecordTracciato;
        }

        /// La riga di un'impaginazione in corso per Id, derivato o no: per chi ha gia' l'Id della riga
        /// (il registro delle operazioni) e deve scriverne i meta.
        public static PromoLavorazioniRecord? PerId(Edro21_DbContext2 ctx2, long id)
        {
            return ImpaginatiConDerivati(ctx2).FirstOrDefault(r => r.Id == id);
        }

        /// La riga del box: con idLavRec quella del derivato, altrimenti quella del codice gruppo come prima.
        public static PromoLavorazioniRecord Trova(Edro21_DbContext2 ctx2, int idLavorazione, string? codiceGruppo, long idRec, long idLavRec)
        {
            return idLavRec > 0
                ? IlDerivato(ctx2, idLavorazione, idLavRec)
                : Trova(ctx2, idLavorazione, codiceGruppo, idRec);
        }

        /// Come Trova sulla query, ma con idLavRec la riga e' quella del derivato.
        public static PromoLavorazioniRecord Trova(Edro21_DbContext2 ctx2, IQueryable<PromoLavorazioniRecord> query, long idRec, string? codice, int idLavorazione, long idLavRec)
        {
            return idLavRec > 0
                ? IlDerivato(ctx2, idLavorazione, idLavRec)
                : Trova(ctx2, query, idRec, codice);
        }

        /// Le operazioni che cambiano dati fuori dalla riga della lavorazione (revisione, azioni sul
        /// box, struttura, sgruppa e raggruppa) non si fanno da un derivato: cambierebbero anche
        /// l'originale e gli altri derivati senza che l'operatore li veda.
        public static void RifiutaSulDerivato(long idLavRec, string operazione)
        {
            if (idLavRec > 0)
                throw new ErroreIstanta("controllo del derivato", $"{operazione} non si fa da un box derivato: va fatta dal box originale.");
        }

        /// Da un derivato si cambia solo cio' che sta nei suoi meta: una scelta che vale anche per le
        /// altre lavorazioni (la foto dell'articolo, per area o canale) cambierebbe l'originale.
        public static void RifiutaSulDerivatoFuoriDaiMeta(long idLavRec, bool soloPerLaLavorazione, string operazione)
        {
            if (idLavRec > 0 && !soloPerLaLavorazione)
                throw new ErroreIstanta("controllo del derivato", $"{operazione} non si fa da un box derivato: da un derivato vale solo per questa lavorazione.");
        }

        /// Il box esce dalla lavorazione: un derivato si cancella con i suoi meta, gli altri si
        /// disattivano e li conservano (TASK-bb04f9aa).
        public static void Esce(Edro21_DbContext2 ctx2, PromoLavorazioniRecord? riga)
        {
            if (riga == null)
                return;
            if (riga.DerivatoDi != null)
                ctx2.PromoLavorazioniRecords.Remove(riga);
            else
                Disattiva(riga);
        }

        /// Gli Id dei record, fra quelli dati, che hanno un derivato impaginato.
        public static List<long> ConDerivati(Edro21_DbContext2 ctx2, IEnumerable<long>? idRecord)
        {
            var ids = (idRecord ?? Enumerable.Empty<long>()).Distinct().ToList();
            if (ids.Count == 0)
                return new List<long>();
            return Derivati(ctx2).Where(r => ids.Contains(r.IdRecordTracciato)).Select(r => r.IdRecordTracciato).Distinct().ToList();
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
