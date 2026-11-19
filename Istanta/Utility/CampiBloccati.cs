using Istanta.Models;
using IstantaLib;
using Newtonsoft.Json.Linq;

namespace Istanta.Utility
{
    /// I20-1247: i campi che un cambio strutturale blocca, perche' la reimportazione della lista li conservi.
    ///
    /// Il blocco sta nelle Alterazioni del record, accanto al valore originale di ogni campo cambiato:
    /// Alterazioni.Locked e' la mappa campo -> bloccato. Lo scrivono i cambi strutturali:
    /// - un'azione sul box blocca i campi che scrive, salvo che la sua configurazione nell'external source
    ///   la dichiari non bloccante (CambioStrutturale.Locked = false): si decide solo li', il Plugin
    ///   manda gli Id delle azioni e non il blocco;
    /// - un cambio che non viene da un'azione sul box (senza Id) blocca sempre;
    /// - la rimessa in volantino sblocca sempre: la lista torna a decidere.
    /// Alla reimportazione un campo bloccato resta com'e', uno sbloccato che la lista porta prende il valore
    /// della lista, e uno che la lista non porta (art_qual di Edro21) resta sempre, bloccato o no.
    /// Un record senza mappa (cambiato prima di I20-1247) si reimporta come prima.
    public static class CampiBloccati
    {
        /// La chiave della mappa dei blocchi dentro le Alterazioni. Non e' un campo cambiato.
        public const string ChiaveLocked = "Locked";

        /// Le Alterazioni del dato di un record, vuote se non ci sono.
        public static Dictionary<string, object> Alterazioni(IDictionary<string, object> dato)
        {
            if (dato == null || !dato.TryGetValue(GLOBAL_VARIABLES.keyAlterazioni, out object? valore) || valore == null)
            {
                return new Dictionary<string, object>();
            }
            return valore switch
            {
                Dictionary<string, object> d => d,
                JObject o => o.ToObject<Dictionary<string, object>>() ?? new Dictionary<string, object>(),
                IDictionary<string, object> d => new Dictionary<string, object>(d),
                _ => new Dictionary<string, object>(),
            };
        }

        /// La mappa campo -> bloccato delle Alterazioni, vuota se non c'e'.
        public static Dictionary<string, bool> Mappa(IDictionary<string, object> alterazioni)
        {
            var mappa = new Dictionary<string, bool>();
            if (alterazioni == null || !alterazioni.TryGetValue(ChiaveLocked, out object? valore) || valore == null)
            {
                return mappa;
            }
            IEnumerable<KeyValuePair<string, object?>> voci = valore switch
            {
                JObject o => o.Properties().Select(p => new KeyValuePair<string, object?>(p.Name, p.Value)),
                IDictionary<string, bool> d => d.Select(v => new KeyValuePair<string, object?>(v.Key, v.Value)),
                IDictionary<string, object> d => d.Select(v => new KeyValuePair<string, object?>(v.Key, v.Value)),
                _ => Enumerable.Empty<KeyValuePair<string, object?>>(),
            };
            foreach (var voce in voci)
            {
                mappa[voce.Key] = Bloccato(voce.Value);
            }
            return mappa;
        }

        /// I campi del Dato (col punto) che le azioni sul box indicate dagli Id lasciano sbloccati: quelli
        /// scritti da un'azione dichiarata non bloccante e da nessuna bloccante. Un Id che la configurazione
        /// non conosce non sblocca niente; senza Id non si sblocca niente.
        public static HashSet<string> CampiSbloccati(string? idAzioni, IEnumerable<CambioStrutturale>? configurazione)
        {
            var sbloccati = new HashSet<string>();
            if (string.IsNullOrWhiteSpace(idAzioni) || configurazione == null)
            {
                return sbloccati;
            }

            var ids = idAzioni.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(i => int.TryParse(i, out int n) ? (int?)n : null)
                .Where(i => i != null)
                .ToHashSet();
            var azioni = configurazione.Where(c => c != null && ids.Contains(c.Id)).ToList();

            var bloccati = new HashSet<string>();
            foreach (var azione in azioni)
            {
                foreach (var istruzione in azione.Istruzioni ?? new List<IstruzioneCambio>())
                {
                    string campo = (istruzione.Field ?? "").Replace("$", ".");
                    (azione.Locked ? bloccati : sbloccati).Add(campo);
                }
            }
            //Due azioni insieme sullo stesso campo: vince il blocco.
            sbloccati.ExceptWith(bloccati);
            return sbloccati;
        }

        /// Segna un campo cambiato da un cambio strutturale come bloccato o no, nella mappa delle Alterazioni.
        public static void Registra(Dictionary<string, object> alterazioni, string campo, bool bloccato)
        {
            var mappa = Mappa(alterazioni);
            mappa[campo] = bloccato;
            alterazioni[ChiaveLocked] = mappa;
        }

        /// Quello che la reimportazione tiene dei cambi strutturali di un record.
        public class Esito
        {
            /// Le Alterazioni dei cambi strutturali ancora in vigore, con la loro mappa: vanno nel Dato
            /// salvato insieme alle alterazioni dell'importazione. Vuote se il record non ha blocchi.
            public Dictionary<string, object> Alterazioni { get; } = new Dictionary<string, object>();

            /// I campi bloccati per cui la lista porta un valore diverso: campo -> valore della lista.
            /// Il dato non cambia, ma il report li segnala.
            public Dictionary<string, object> Forzature { get; } = new Dictionary<string, object>();
        }

        /// Applica i blocchi del dato vecchio al dato nuovo della lista, prima di confrontarli: un campo
        /// bloccato riprende il valore vecchio, uno che la lista non porta torna nel dato, uno sbloccato
        /// portato dalla lista resta quello della lista ed esce dalla mappa.
        public static Esito ApplicaAllaReimportazione(IDictionary<string, object> datoVecchio, IDictionary<string, object> itemNuovo)
        {
            var esito = new Esito();
            var alterazioniVecchie = Alterazioni(datoVecchio);
            var mappa = Mappa(alterazioniVecchie);
            if (mappa.Count == 0)
            {
                return esito;
            }

            var mappaTenuta = new Dictionary<string, bool>();
            foreach (var (campo, bloccato) in mappa)
            {
                if (!datoVecchio.TryGetValue(campo, out object? valoreVecchio))
                {
                    continue;
                }

                if (!itemNuovo.TryGetValue(campo, out object? valoreLista))
                {
                    //La lista non porta il campo: resta sempre, bloccato o no.
                    itemNuovo[campo] = valoreVecchio;
                    esito.Alterazioni[campo] = alterazioniVecchie.TryGetValue(campo, out object? originale) && originale != null ? originale : "";
                }
                else if (bloccato)
                {
                    if (!Uguali(valoreLista, valoreVecchio))
                    {
                        esito.Forzature[campo] = valoreLista;
                    }
                    itemNuovo[campo] = valoreVecchio;
                    //Il valore originale del campo e' ora quello che porta la lista.
                    esito.Alterazioni[campo] = valoreLista ?? "";
                }
                else
                {
                    //Sbloccato e portato dalla lista: decide la lista.
                    continue;
                }
                mappaTenuta[campo] = bloccato;
            }

            if (mappaTenuta.Count > 0)
            {
                esito.Alterazioni[ChiaveLocked] = mappaTenuta;
            }
            return esito;
        }

        /// Le alterazioni da salvare nel Dato reimportato: quelle dell'importazione e quelle dei cambi
        /// strutturali ancora in vigore. Un campo e' nelle une o nelle altre, mai in tutte e due.
        public static Dictionary<string, object> AlterazioniDaSalvare(Dictionary<string, object> dellImportazione, Esito esito)
        {
            var tutte = new Dictionary<string, object>(dellImportazione);
            foreach (var voce in esito.Alterazioni)
            {
                if (!tutte.ContainsKey(voce.Key))
                {
                    tutte[voce.Key] = voce.Value;
                }
            }
            return tutte;
        }

        static bool Bloccato(object? valore)
        {
            return valore switch
            {
                bool b => b,
                JValue jv when jv.Type == JTokenType.Boolean => (bool)jv,
                _ => !string.Equals(Convert.ToString(valore is JValue j ? j.Value : valore), "false", StringComparison.OrdinalIgnoreCase),
            };
        }

        static bool Uguali(object? a, object? b)
        {
            var tokenA = a != null ? JToken.FromObject(a) : JValue.CreateNull();
            var tokenB = b != null ? JToken.FromObject(b) : JValue.CreateNull();
            return JToken.DeepEquals(tokenA, tokenB);
        }
    }
}
