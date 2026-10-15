using System;

namespace Istanta.Models_2
{
    /// <summary>
    /// I20-1106 (Lotto 1): un backup dei record di una promo, fatto dall'operatore dalla pagina
    /// Backup promo o da un'operazione che sta per cancellare (la pulizia delle liste). Il tipo
    /// dice di quali record: 1 i record dei tracciati (promo_tracciati_records), 2 i record delle
    /// lavorazioni (promo_lavorazioni_records). Il contenuto e' il json delle righe, tutte le
    /// colonne e niente navigazioni: e' cio' che il ripristino riscrive. La forma delle righe e'
    /// in Models/BackupPromo.cs.
    /// </summary>
    public partial class PromoBackup
    {
        public int Id { get; set; }
        public int IdPromo { get; set; }
        /// <summary>
        /// 1-record dei tracciati 2-record delle lavorazioni
        /// </summary>
        public byte Tipo { get; set; }
        public DateTime DataBackup { get; set; }
        /// <summary>Chi o cosa lo ha creato: la richiesta dell'operatore, il pre-ripristino, la pulizia di una lista.</summary>
        public string? Origine { get; set; }
        /// <summary>Quante righe contiene, per l'elenco, senza leggere il contenuto.</summary>
        public int Conteggio { get; set; }
        public string Contenuto { get; set; } = null!;

        public virtual Promo IdPromoNavigation { get; set; } = null!;
    }
}
