using Istanta.Models_2;
using Microsoft.EntityFrameworkCore;

namespace Istanta.Utility
{
    /// TASK-35c2c68d: i record di lista da cui il salvataggio del revisore calcola firma e meta della
    /// revisione di una scheda singola, quando il revisore e' aperto su tutti i tracciati della promo.
    ///
    /// Prima Revisore/salva caricava la promo intera, tutti i tracciati e tutti i loro record con il dato,
    /// per ogni revisione, e poi in memoria prendeva l'ultimo record del codice in ogni tracciato: con
    /// "tutti i tracciati" il salvataggio cresceva con la promo, fino a circa un secondo. Ora al database
    /// si chiedono solo i record del codice, e la scelta in memoria e' la stessa di prima.
    public static class RecordsRevisioneArticolo
    {
        /// I record del codice nei tracciati della promo, col loro tracciato: solo quelli.
        public static IQueryable<PromoTracciatiRecord> DellArticoloNellaPromo(Edro21_DbContext2 ctx2, int idPromo, string codice) =>
            ctx2.PromoTracciatiRecords
                .Include(r => r.IdTracciatoNavigation)
                .Where(r => r.IdTracciatoNavigation.IdPromo == idPromo && r.Codice == codice);

        /// Per ogni tracciato l'ultimo record per data di registrazione, a pari data quello con l'id piu'
        /// basso; i tracciati in ordine di id. E' la scelta di prima, che scorreva i tracciati della promo
        /// e i loro record nell'ordine delle chiavi: chi usa il primo della lista lo ritrova uguale. Pura.
        public static List<PromoTracciatiRecord> UltimoPerTracciato(IEnumerable<PromoTracciatiRecord> records) =>
            records
                .GroupBy(r => r.IdTracciato)
                .OrderBy(g => g.Key)
                .Select(g => g.OrderBy(r => r.Id).OrderByDescending(r => r.DataRegistrazione).First())
                .ToList();
    }
}
