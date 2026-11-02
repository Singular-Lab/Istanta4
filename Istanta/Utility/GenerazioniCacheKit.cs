using System.Collections.Concurrent;

namespace Istanta.Utility
{
    /// La generazione dei dati di ogni tracciato, nella chiave della cache delle liste dei kit.
    ///
    /// processaKit tiene la lista del kit in cache per un'ora, con una chiave fatta dei tracciati:
    /// dopo un'azione sul box, un Raggruppa o una reimportazione la lista in cache era quella di
    /// prima, e l'impaginazione poteva usare dati vecchi. Chi cambia i record di un tracciato ne
    /// alza la generazione: la chiave cambia, la voce vecchia non si trova piu' e scade da sola.
    ///
    /// Vale per il processo, come la cache che accompagna.
    public static class GenerazioniCacheKit
    {
        private static readonly ConcurrentDictionary<int, long> generazioni = new();

        public static long Generazione(int idTracciato) =>
            generazioni.TryGetValue(idTracciato, out long generazione) ? generazione : 0;

        /// La parte della chiave di cache che dipende dai dati: la generazione di ogni tracciato.
        public static string Chiave(IEnumerable<int> idsTracciati) =>
            string.Join("-", idsTracciati.OrderBy(id => id).Select(id => $"{id}g{Generazione(id)}"));

        /// I record del tracciato sono cambiati: le liste in cache che lo usano non valgono piu'.
        public static void Invalida(int idTracciato) =>
            generazioni.AddOrUpdate(idTracciato, 1, (_, generazione) => generazione + 1);

        public static void Invalida(IEnumerable<int> idsTracciati)
        {
            foreach (int idTracciato in idsTracciati.Distinct())
            {
                Invalida(idTracciato);
            }
        }
    }
}
