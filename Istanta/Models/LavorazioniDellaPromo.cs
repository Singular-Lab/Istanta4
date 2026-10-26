using System;
using System.Collections.Generic;
using System.Linq;
using Istanta.Models_2;
using Newtonsoft.Json.Linq;

namespace Istanta.Models
{
    /// <summary>
    /// I20-981 (Lotto 4b): le lavorazioni sorelle di una lavorazione, cioe' quelle della stessa
    /// promo. Servono al plugin per scegliere da quale lavorazione scaricare la lista con cui
    /// confrontare la propria: fra promo diverse il confronto non ha senso, e cosi' l'elenco
    /// offre solo quello che si puo' confrontare. Qui c'e' la forma dell'elenco, senza database:
    /// il controller passa cio' che legge, e questa classe decide cosa diventa.
    /// </summary>
    public class LavorazioneSorella
    {
        public int id { get; set; }
        public string titolo { get; set; } = string.Empty;
        public string guidFormato { get; set; } = string.Empty;
        public string guidArea { get; set; } = string.Empty;
        public string guidCanale { get; set; } = string.Empty;
        public DateTime registerDate { get; set; }
        public byte stato { get; set; }
        /// <summary>Vero per la lavorazione da cui si e' partiti: sta nell'elenco per dire chi e', non per essere scelta.</summary>
        public bool corrente { get; set; }
    }

    public class LavorazioniDellaPromoResponse
    {
        public List<LavorazioneSorella> lavorazioni { get; set; } = new List<LavorazioneSorella>();
        public string guidPromo { get; set; } = string.Empty;
        public bool esito { get; set; } = false;
        public string error { get; set; } = string.Empty;
    }

    public static class LavorazioniDellaPromo
    {
        public const string ERRORE_LAVORAZIONE_NON_TROVATA = "lavorazione_non_trovata";
        public const string ERRORE_PROMO_ASSENTE = "lavorazione_senza_promo";

        /// <summary>
        /// Il titolo che l'operatore ha dato alla lavorazione, letto dal Meta. Un Meta assente
        /// o malformato non e' un errore: si ripiega su un nome che dica almeno l'id.
        /// </summary>
        public static string TitoloDalMeta(string? meta, int id)
        {
            string ripiego = "Lavorazione " + id;

            if (string.IsNullOrWhiteSpace(meta))
            {
                return ripiego;
            }

            try
            {
                JObject oggetto = JObject.Parse(meta);
                string? titolo = oggetto["titolo"]?.ToString();
                return string.IsNullOrWhiteSpace(titolo) ? ripiego : titolo!.Trim();
            }
            catch
            {
                return ripiego;
            }
        }

        /// <summary>
        /// L'elenco delle sorelle: la stessa promo della lavorazione corrente, dalla piu'
        /// recente, con la corrente segnata. Le lavorazioni di altre promo non entrano.
        /// </summary>
        public static LavorazioniDellaPromoResponse Componi(PromoLavorazioni? corrente, IEnumerable<PromoLavorazioni>? tutte)
        {
            var risposta = new LavorazioniDellaPromoResponse();

            if (corrente == null)
            {
                risposta.error = ERRORE_LAVORAZIONE_NON_TROVATA;
                return risposta;
            }

            if (string.IsNullOrWhiteSpace(corrente.GuidPromo))
            {
                risposta.error = ERRORE_PROMO_ASSENTE;
                return risposta;
            }

            risposta.guidPromo = corrente.GuidPromo!;

            risposta.lavorazioni = (tutte ?? Enumerable.Empty<PromoLavorazioni>())
                .Where(l => l != null && l.GuidPromo == corrente.GuidPromo)
                .OrderByDescending(l => l.RegisterDate)
                .Select(l => new LavorazioneSorella
                {
                    id = l.Id,
                    titolo = TitoloDalMeta(l.Meta, l.Id),
                    guidFormato = l.GuidFormato ?? string.Empty,
                    guidArea = l.GuidArea ?? string.Empty,
                    guidCanale = l.GuidCanale ?? string.Empty,
                    registerDate = l.RegisterDate,
                    stato = l.Stato,
                    corrente = l.Id == corrente.Id
                })
                .ToList();

            risposta.esito = true;
            return risposta;
        }
    }
}
