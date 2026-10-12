using Istanta.Models;

namespace Istanta.Utility
{
    /// I20-1084: cosa dice il log di Revisore/salvaRefFromIndd.
    ///
    /// Il salvataggio dalla scheda ref del Plugin non scriveva niente, nemmeno in caso di errore:
    /// quando una descrizione non arrivava non c'era modo di sapere se il Plugin l'avesse mandata
    /// come "non toccata", vuota o per niente. Qui si riassume la richiesta senza i testi - solo
    /// lo stato di ogni descrizione e la sua lunghezza - cosi' il log non si riempie di
    /// descrizioni e si prova senza database.
    public static class SalvataggioRefDaIndd
    {
        /// Lo stato di una descrizione nella richiesta: "null" (il Plugin non l'ha mandata),
        /// "<untouched>" (non toccata), "vuota" (svuotata: il server la cancella), "testo(N)".
        public static string StatoDescrizione(string? valore)
        {
            if (valore == null)
            {
                return "null";
            }

            if (valore == SpecificitaDescrizione.NonToccato)
            {
                return SpecificitaDescrizione.NonToccato;
            }

            if (valore == "")
            {
                return "vuota";
            }

            return "testo(" + valore.Length + ")";
        }

        /// "codice 123, gruppo 123, lavorazione 45, area -, canale -, descrizione1 testo(20),
        /// descrizione2 <untouched>, descrizione3 null, descrizione4 vuota, campi offerta 2".
        public static string Riassunto(RevisioneFromInddRequest? req)
        {
            if (req == null)
            {
                return "richiesta vuota";
            }

            var revisione = req.revisione;
            string descrizioni = revisione == null
                ? "nessuna revisione"
                : "descrizione1 " + StatoDescrizione(revisione.descrizione1)
                    + ", descrizione2 " + StatoDescrizione(revisione.descrizione2)
                    + ", descrizione3 " + StatoDescrizione(revisione.descrizione3)
                    + ", descrizione4 " + StatoDescrizione(revisione.descrizione4);

            return "codice " + (req.codice ?? "-")
                + ", gruppo " + (req.codice_gruppo ?? "-")
                + ", lavorazione " + req.idLavorazione
                + ", area " + (string.IsNullOrWhiteSpace(req.area) ? "-" : req.area)
                + ", canale " + (string.IsNullOrWhiteSpace(req.canale) ? "-" : req.canale)
                + ", " + descrizioni
                + ", campi offerta " + (req.campi_offerta?.Count ?? 0);
        }
    }
}
