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
    }
}
