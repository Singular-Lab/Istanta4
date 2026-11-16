using Istanta.Models;

namespace Istanta.Utility
{
    /// Lo scarto dell'importazione di un tracciato chiesto da Fidelity quando il Superadmin elimina un
    /// tracciato arrivato in Istanta ma non importato (spec ciclo-promozione-importazione, "Eliminazione
    /// di un tracciato non importato").
    ///
    /// Si scarta soltanto un'importazione che non ha salvato niente e non e' partita: in attesa della
    /// conferma dell'operatore, oppure soltanto esaminata (l'esame gira senza persistenza). Una in coda,
    /// in elaborazione o terminata, anche con errori, resta com'e'. Una gia' scartata resta scartata,
    /// cosi' Fidelity puo' ripetere la richiesta se la prima volta non ha potuto eliminare il tracciato.
    public static class ScartoImportazioneFico
    {
        /// Gli stati dell'attivita' di importazione da cui lo scarto e' permesso.
        public static readonly byte[] StatiScartabili =
        {
            (byte)OperationStauts.InAttesaDiConfermaUtente,
            (byte)OperationStauts.Esaminata,
        };

        public static bool Scartabile(byte stato) => Array.IndexOf(StatiScartabili, stato) >= 0;

        /// Dopo il tentativo di scarto: l'importazione risulta scartata, adesso o da prima.
        public static bool Scartata(byte stato) => stato == (byte)OperationStauts.Scartata;
    }
}
