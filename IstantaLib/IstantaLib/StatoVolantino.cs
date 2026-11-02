using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Linq;

namespace IstantaLib
{
    /// Lo stato in volantino / fuori volantino di una referenza, campo core del record
    /// (GLOBAL_VARIABLES_FICO.keyInVolantino).
    ///
    /// Lo decide l'importazione dell'agenzia; se non lo decide, la referenza e' in volantino.
    /// Le liste importate prima del campo non lo hanno: per quelle vale la regola che l'agenzia
    /// usava prima (tipo_volantino per Edro21, il tema per Coop...), che l'agenzia passa come
    /// regolaPrecedente. Quando il campo c'e' vale il campo, anche contro la regola precedente:
    /// e' cosi' che l'azione "Metti fuori volantino", che scrive solo il campo, ha effetto.
    public static class StatoVolantino
    {
        /// Il campo core del record: null se manca o non si capisce. Accetta un bool, un JValue
        /// e il testo "true"/"false" in qualunque maiuscola, perche' le azioni sul box del Plugin
        /// scrivono i valori come testo.
        public static bool? Leggi(IDictionary<string, object> record)
        {
            if (record == null || !record.TryGetValue(GLOBAL_VARIABLES_FICO.keyInVolantino, out object valore))
            {
                return null;
            }
            return Interpreta(valore);
        }

        public static bool? Interpreta(object valore)
        {
            switch (valore)
            {
                case bool b:
                    return b;
                case JValue jv:
                    return Interpreta(jv.Value);
                case string s:
                    return bool.TryParse(s.Trim(), out bool letto) ? letto : (bool?)null;
                default:
                    return null;
            }
        }

        /// Se la referenza e' in volantino: il campo core se c'e', altrimenti la regola
        /// precedente dell'agenzia, altrimenti si'.
        public static bool InVolantino(IDictionary<string, object> record, Func<IDictionary<string, object>, bool> regolaPrecedente = null)
        {
            bool? campo = Leggi(record);
            if (campo.HasValue)
            {
                return campo.Value;
            }
            if (record != null && regolaPrecedente != null)
            {
                return regolaPrecedente(record);
            }
            return true;
        }

        /// All'importazione: la referenza per cui l'agenzia non ha deciso niente e' in volantino.
        /// Un valore che l'agenzia ha scritto, anche se non si capisce, resta com'e': in lettura
        /// varra' la regola precedente.
        public static void ApplicaPredefinito(IDictionary<string, object> record)
        {
            if (record == null)
            {
                return;
            }
            if (!record.TryGetValue(GLOBAL_VARIABLES_FICO.keyInVolantino, out object valore)
                || valore == null
                || (valore is string s && s.Trim() == "")
                || (valore is JValue jv && (jv.Value == null || (jv.Value is string js && js.Trim() == ""))))
            {
                record[GLOBAL_VARIABLES_FICO.keyInVolantino] = true;
            }
        }

        /// Il revisore: InVol di ogni area e canale (ACComuni) dei record in revisione.
        ///
        /// Un singolo e' in volantino in un'area e canale se lo e' il suo record della lista
        /// d'origine con stessa area, canale, codice e label; se quel record non c'e' vale
        /// inVolSeManca, che decide l'agenzia. Un gruppo e' in volantino in un'area e canale
        /// solo se lo sono tutti i suoi membri.
        public static List<q_records_per_getListaRevisione> CalcolaInVolRevisione(
            List<q_records_per_getListaRevisione> tracciatoRevisione,
            List<q_records_per_getListaRevisione> listaOrigine,
            Func<IDictionary<string, object>, bool> inVolantino,
            bool inVolSeManca)
        {
            if (tracciatoRevisione == null)
            {
                return new List<q_records_per_getListaRevisione>();
            }

            string keyCodice = GLOBAL_VARIABLES_FICO.keyRefCodice;
            string keyAC = GLOBAL_VARIABLES_FICO.keyACComuni;

            //Ora gira per ogni agenzia: un record senza codice non deve fermare il revisore.
            string Codice(IDictionary<string, object> dato) =>
                dato != null && dato.TryGetValue(keyCodice, out object codice) ? codice?.ToString() ?? "" : "";

            var lookupOrigine = (listaOrigine ?? new List<q_records_per_getListaRevisione>())
                .Where(f => f.Dato != null)
                .GroupBy(f => $"{f.Area}_{f.Canale}_{Codice(f.Dato)}_{f.Label}")
                .ToDictionary(g => g.Key, g => g.First());

            //1. I singoli.
            var singoli = tracciatoRevisione
                .Where(x => x.Dato != null && !x.isGruppo)
                .ToList();

            foreach (var item in singoli)
            {
                if (!(item.Dato.TryGetValue(keyAC, out object acObj) && acObj is List<ACcomuni> acComuni))
                {
                    continue;
                }

                foreach (var ac in acComuni)
                {
                    var key = $"{ac.area}_{ac.canale}_{Codice(item.Dato)}_{ac.label}";

                    if (!lookupOrigine.TryGetValue(key, out var origine))
                    {
                        ac.InVol = inVolSeManca;
                        continue;
                    }

                    ac.InVol = inVolantino(origine.Dato);
                }
            }

            //2. I singoli per codice, per i gruppi.
            var singoliPerCodice = singoli
                .Where(x => x.Dato.ContainsKey(keyCodice))
                .GroupBy(x => Codice(x.Dato))
                .ToDictionary(g => g.Key, g => g.ToList());

            //3. I gruppi.
            var gruppi = tracciatoRevisione
                .Where(x => x.Dato != null && x.isGruppo)
                .ToList();

            foreach (var gruppo in gruppi)
            {
                if (!gruppo.Dato.ContainsKey(GLOBAL_VARIABLES_FICO.keyCodiceGruppo))
                {
                    continue;
                }

                var codiceGruppo = gruppo.Dato[GLOBAL_VARIABLES_FICO.keyCodiceGruppo]?.ToString() ?? "";

                if (string.IsNullOrWhiteSpace(codiceGruppo))
                {
                    continue;
                }

                var codiciMembri = codiceGruppo
                    .Split(',')
                    .Where(x => !string.IsNullOrWhiteSpace(x))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();

                if (!(gruppo.Dato.TryGetValue(keyAC, out object acGruppoObj) && acGruppoObj is List<ACcomuni> acComuniGruppo))
                {
                    continue;
                }

                foreach (var acGruppo in acComuniGruppo)
                {
                    bool gruppoInVol = true;

                    foreach (var codiceMembro in codiciMembri)
                    {
                        if (!singoliPerCodice.TryGetValue(codiceMembro, out var recordsMembro))
                        {
                            gruppoInVol = false;
                            break;
                        }

                        var acMembro = recordsMembro
                            .Select(x => x.Dato.TryGetValue(keyAC, out object l) ? l as List<ACcomuni> : null)
                            .Where(l => l != null)
                            .Select(l => l.FirstOrDefault(ac =>
                                string.Equals(ac.area, acGruppo.area, StringComparison.OrdinalIgnoreCase) &&
                                string.Equals(ac.canale, acGruppo.canale, StringComparison.OrdinalIgnoreCase)))
                            .FirstOrDefault(ac => ac != null);

                        if (acMembro == null || !acMembro.InVol)
                        {
                            gruppoInVol = false;
                            break;
                        }
                    }

                    acGruppo.InVol = gruppoInVol;
                }
            }

            return tracciatoRevisione;
        }
    }
}
