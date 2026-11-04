using Istanta.Models;
using IstantaLib;

namespace Istanta.Utility
{
    /// I20-999: la foto indicata dal tracciato, e cosa fare quando non si trova.
    ///
    /// Quando il tracciato dichiara Foto.SelezioneDaTracciato il server si fida e cerca in
    /// archivio la foto con quel nome. Se non la trovava, prima azzerava nome, guid e id: la ref
    /// usciva senza immagine anche quando in archivio ce n'era una buona. Un nome sbagliato nel
    /// tracciato non deve spegnere la scelta della foto, deve solo smettere di comandarla.
    public static class FotoDaTracciato
    {
        /// Il pezzo di nome con cui si cerca in archivio: il nome del file senza estensione, con
        /// il punto in coda perche' il confronto e' un "contiene" e senza punto "foto1" pescherebbe
        /// anche "foto10".
        ///
        /// Restituisce null quando dal tracciato non arriva un nome utilizzabile. Serve: prima si
        /// costruiva un FileInfo direttamente sul valore ricevuto, e su una stringa vuota quello
        /// solleva un'eccezione invece di comportarsi come "foto non trovata".
        public static string? NomeDaCercare(string? nomeDalTracciato)
        {
            if (string.IsNullOrWhiteSpace(nomeDalTracciato))
            {
                return null;
            }

            string nome;

            try
            {
                nome = new FileInfo(nomeDalTracciato).Name;
            }
            catch
            {
                //Un valore che non e' un percorso valido non e' un motivo per fermare
                //l'elaborazione: e' una foto che non si trova.
                return null;
            }

            if (string.IsNullOrWhiteSpace(nome))
            {
                return null;
            }

            string estensione = Path.GetExtension(nome);

            if (!string.IsNullOrEmpty(estensione))
            {
                nome = nome.Substring(0, nome.Length - estensione.Length);
            }

            if (string.IsNullOrWhiteSpace(nome))
            {
                return null;
            }

            return nome + ".";
        }

        /// Se la selezione da tracciato e' stata messa da parte per questo record.
        ///
        /// Vale true solo quando il tracciato l'aveva chiesta e la foto non si e' trovata: in quel
        /// caso si torna alla scelta normale. Senza la chiave non c'e' niente da disattivare, e
        /// con la foto trovata comanda il tracciato, come deve.
        public static bool SelezioneDisattivata(bool chiaveDichiarata, bool fotoTrovata)
        {
            return chiaveDichiarata && !fotoTrovata;
        }

        /// TASK-60aaf10d: da dove viene la foto mandata al Plugin (Foto.Origine). Il Plugin la usa
        /// per dire all'operatore se la foto e' della lista e per limitare il cambio alla lavorazione.
        public const string OrigineTracciato = "tracciato";
        public const string OrigineLavorazione = "lavorazione";
        public const string OrigineArchivio = "archivio";
        public const string ChiaveOrigine = "Foto.Origine";
        /// Il nome della foto che il tracciato indica, senza estensione; vuoto se non ne indica.
        public const string ChiaveNomeDaTracciato = "Foto.NomeDaTracciato";

        /// TASK-60aaf10d: il nome della foto che il tracciato indica per il record.
        ///
        /// Senza configurazione dell'agenzia vale solo Foto.SelezioneDaTracciato, ed e' dichiarata
        /// appena la chiave c'e', anche vuota: e' la regola di I20-999. Con la configurazione si
        /// leggono i campi dell'agenzia in ordine e vale il primo che porta un nome; un nome vuoto
        /// non dichiara niente, perche' le liste Edro21 hanno la colonna anche quando non c'e' foto.
        public static bool LeggiNome(IDictionary<string, object>? record, AgenziaCustomPlugin_FotoDaTracciato? config, out string? nome)
        {
            nome = null;

            if (record == null)
            {
                return false;
            }

            if (config == null || config.campi == null || config.campi.Count == 0)
            {
                if (!record.TryGetValue(GLOBAL_VARIABLES_FICO.keyFotoSelezioneDaTracciato, out var valore))
                {
                    return false;
                }

                nome = valore?.ToString();
                return true;
            }

            foreach (string campo in config.campi)
            {
                if (string.IsNullOrWhiteSpace(campo) || !record.TryGetValue(campo, out var valore) || valore == null)
                {
                    continue;
                }

                string testo = valore.ToString()!.Trim();

                if (testo.Length > 0)
                {
                    nome = testo;
                    return true;
                }
            }

            return false;
        }

        /// TASK-60aaf10d: il nome del tracciato senza estensione, per confrontarlo con un altro.
        /// Null quando non c'e' un nome utilizzabile.
        public static string? NomeBase(string? nome)
        {
            string? daCercare = NomeDaCercare(nome);
            return daCercare == null ? null : daCercare.Substring(0, daCercare.Length - 1);
        }

        /// TASK-60aaf10d: fra le foto dell'articolo, quella che il tracciato indica, per l'agenzia
        /// che lo configura. Il nome deve essere lo stesso, estensione esclusa e senza distinguere
        /// le maiuscole: il "contiene" di I20-999 pescava anche un nome piu' lungo. Fra le foto con
        /// quel nome vale la prima estensione preferita dall'agenzia (Edro21: psd), altrimenti la
        /// modificata per ultima. Le foto extra non contano. Null se nessuna foto ha quel nome.
        public static ArticoliFoto? Scegli(IEnumerable<ArticoliFoto>? fotoArticolo, string? nomeDalTracciato, IList<string>? estensioniPreferite)
        {
            string? nomeBase = NomeBase(nomeDalTracciato);

            if (nomeBase == null || fotoArticolo == null)
            {
                return null;
            }

            List<ArticoliFoto> conQuelNome = fotoArticolo
                .Where(f => f != null && !string.IsNullOrEmpty(f.NomeReale))
                .Where(f => !f.Tipo.HasValue || f.Tipo == (byte)TipoFoto.Foto)
                .Where(f => string.Equals(Path.GetFileNameWithoutExtension(f.NomeReale), nomeBase, StringComparison.OrdinalIgnoreCase))
                .OrderByDescending(f => f.DataModifica.HasValue)
                .ThenByDescending(f => f.DataModifica)
                .ThenByDescending(f => f.Id)
                .ToList();

            foreach (string estensione in estensioniPreferite ?? new List<string>())
            {
                string cercata = "." + (estensione ?? "").Trim().TrimStart('.');

                ArticoliFoto? preferita = conQuelNome.FirstOrDefault(f =>
                    string.Equals(Path.GetExtension(f.NomeReale), cercata, StringComparison.OrdinalIgnoreCase));

                if (preferita != null)
                {
                    return preferita;
                }
            }

            return conQuelNome.FirstOrDefault();
        }

        /// TASK-60aaf10d: se applicare una scelta della foto fatta per la lavorazione, con la lista di oggi.
        public static bool SceltaDaApplicare(AgenziaCustomPlugin_FotoDaTracciato? config, string? fotoDelTracciatoAllaScelta, string? fotoDelTracciatoOggi)
        {
            //Senza configurazione la lista non comanda sulle scelte, come prima.
            return config == null || SceltaAncoraValida(fotoDelTracciatoAllaScelta, fotoDelTracciatoOggi);
        }

        /// TASK-60aaf10d: se una lavorazione senza meta propri eredita la foto scelta in una passata.
        /// Si', salvo l'agenzia che lo esclude (Edro21: comanda il tracciato).
        public static bool FotoEreditabile(AgenziaCustomPlugin_FotoDaTracciato? config)
        {
            return config == null || config.ereditaFotoDalPassato;
        }

        /// TASK-60aaf10d: se una foto scelta solo per la lavorazione vale ancora con la lista di oggi.
        /// L'ultima lista comanda: la scelta decade quando il tracciato indica ora una foto diversa da
        /// quella che indicava quando l'operatore l'ha fatta. Resta quando la scelta non lo sa (fatta
        /// prima di questa regola) e quando la lista di oggi non indica nessuna foto.
        public static bool SceltaAncoraValida(string? fotoDelTracciatoAllaScelta, string? fotoDelTracciatoOggi)
        {
            string? allaScelta = NomeBase(fotoDelTracciatoAllaScelta);
            string? oggi = NomeBase(fotoDelTracciatoOggi);

            if (allaScelta == null || oggi == null)
            {
                return true;
            }

            return string.Equals(allaScelta, oggi, StringComparison.OrdinalIgnoreCase);
        }
    }
}
