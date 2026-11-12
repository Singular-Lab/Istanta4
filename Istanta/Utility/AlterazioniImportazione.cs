using Istanta.Models;
using IstantaLib;
using Newtonsoft.Json;

namespace Istanta.Utility
{
    /// Le alterazioni di una referenza reimportata e l'operazione di registro che le annuncia.
    ///
    /// Prima di confrontare, l'importazione mette nel dato i campi che Istanta aggiunge da se'
    /// (DateRecordTracciato.ChiaviDiIstanta): la versione del tracciato cambia a ogni reimportazione e non
    /// e' un cambio della referenza. Qui quei campi escono dalle alterazioni, cosi' report, dato salvato e
    /// registro contano solo i campi del tracciato.
    public static class AlterazioniImportazione
    {
        /// Le alterazioni senza i campi che Istanta aggiunge da se' al dato.
        public static Dictionary<string, object> SoloCampiDelTracciato(Dictionary<string, object> alterazioni)
        {
            return alterazioni
                .Where(a => !DateRecordTracciato.ChiaviDiIstanta.Contains(a.Key))
                .ToDictionary(a => a.Key, a => a.Value);
        }

        /// L'operazione di registro "Aggiornamento da importazione" di una referenza, con l'azione che dice
        /// quali campi sono cambiati e il valore di prima; null se non e' cambiato niente.
        public static RegistroOperazioni? OperazioneDiRegistro(int idTracciato, string? codice, string? codiceGruppo, Dictionary<string, object> alterazioni)
        {
            if (alterazioni.Count == 0)
            {
                return null;
            }

            var azione = new CambioMetaRecordTracciatoAzione
            {
                codice = codice!,
                attributi = new Dictionary<string, object>(alterazioni),
            };

            return new RegistroOperazioni
            {
                IdTracciato = idTracciato,
                TipoOperazione = (byte)tipoOperazione.aggiornamentoDaImportazione,
                FormData = JsonConvert.SerializeObject(new List<CambioMetaRecordTracciatoAzione> { azione }),
                //Portiamo sempre dietro il codice gruppo di provenienza: la propagazione cerca per quello.
                CodiceAssociato = codiceGruppo,
            };
        }
    }
}
