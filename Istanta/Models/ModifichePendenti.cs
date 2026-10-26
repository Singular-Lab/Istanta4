using Microsoft.EntityFrameworkCore;

namespace Istanta.Models
{
    /// <summary>
    /// Quando un SaveChanges fallisce, EF lascia nel contesto le entita' che non e' riuscito a
    /// scrivere, ancora Added/Modified/Deleted. Ogni SaveChanges successivo sullo stesso contesto
    /// le riprova per prime e fallisce allo stesso modo: anche il salvataggio del log d'errore.
    /// </summary>
    public static class ModifichePendenti
    {
        /// <summary>
        /// Stacca dal contesto tutte le modifiche non ancora salvate, tranne quelle dell'entita'
        /// indicata (tipicamente l'attivita' di cui si vuole registrare l'esito).
        /// Cio' che era gia' stato salvato resta com'e': non e' un rollback.
        /// </summary>
        /// <returns>Il numero di entita' scartate.</returns>
        public static int Scarta(DbContext ctx, object? daConservare)
        {
            var pendenti = ctx.ChangeTracker.Entries()
                .Where(e => e.State == EntityState.Added || e.State == EntityState.Modified || e.State == EntityState.Deleted)
                .Where(e => !ReferenceEquals(e.Entity, daConservare))
                .ToList();

            foreach (var entry in pendenti)
            {
                entry.State = EntityState.Detached;
            }

            return pendenti.Count;
        }
    }
}
