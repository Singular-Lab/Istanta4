using System;
using System.Collections.Generic;
using System.Linq;
using AgenziaLib.Tipi;

namespace AgenziaLib
{
    /// La regola con cui la pagina del revisore (applyFilterToList in agenzia.js) decide
    /// cosa mostrare, riscritta qui perche' il conteggio in home la applichi identica.
    /// Le due versioni divergevano: il conteggio toglieva solo i record EX, la pagina toglie
    /// l'intero gruppo se anche un solo membro e' EX. Il gruppo restava nel conteggio e
    /// spariva dalla pagina, e l'utente apriva il revisore senza trovare nulla (I20-972).
    ///
    /// Regola, uguale alla pagina:
    ///  - l'utente "gg" vede tutto, EX compresi, e non filtra;
    ///  - si raccolgono i codici gruppo dei record con sigla_reparto EX (un singolo ha come
    ///    codice gruppo il proprio codice, quindi si esclude da solo);
    ///  - si scartano tutti i record il cui codice gruppo e' fra quelli raccolti.
    ///    Un record EX senza codice gruppo non entra nell'insieme e resta, come in pagina.
    ///
    /// La pagina resta la definizione di riferimento: se cambia lei, deve cambiare qui.
    public static class FiltroRevisioneReparto
    {
        public const string UtenteCheVedeTutto = "gg";
        public const string RepartoEscluso = "EX";

        public static List<Dictionary<string, object>> Filtra(
            List<Dictionary<string, object>> records,
            string utente)
        {
            if (records == null || records.Count == 0)
            {
                return new List<Dictionary<string, object>>();
            }

            var validi = records.Where(r => r != null).ToList();

            if (utente == UtenteCheVedeTutto)
            {
                return validi;
            }

            var gruppiEsclusi = validi
                .Where(EReparto_EX)
                .Select(CodiceGruppoDelRecord)
                .Where(codice => !string.IsNullOrEmpty(codice))
                .ToHashSet();

            if (gruppiEsclusi.Count == 0)
            {
                return validi;
            }

            return validi
                .Where(r => !gruppiEsclusi.Contains(CodiceGruppoDelRecord(r) ?? ""))
                .ToList();
        }

        private static bool EReparto_EX(Dictionary<string, object> record)
        {
            if (!record.TryGetValue(GLOBAL_VARIABLES.keySiglaReparto, out var sigla) || sigla == null)
            {
                return false;
            }

            return string.Equals(sigla.ToString(), RepartoEscluso, StringComparison.OrdinalIgnoreCase);
        }

        private static string CodiceGruppoDelRecord(Dictionary<string, object> record)
        {
            return record.TryGetValue(GLOBAL_VARIABLES.keyScattoCodiceGruppo, out var codice) && codice != null
                ? codice.ToString()
                : null;
        }
    }
}
