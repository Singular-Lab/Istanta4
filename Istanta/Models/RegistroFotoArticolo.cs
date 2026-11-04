namespace Istanta.Models
{
    /// <summary>
    /// La regola di unicita' delle foto di un articolo: mai due righe di articoli_foto con lo
    /// stesso guid_id sullo stesso articolo e nello stesso ambito di area e canale.
    ///
    /// Lo stesso guid puo' invece comparire su articoli diversi (Olimpo deduplica per MD5 e
    /// restituisce lo stesso guid a file identici), come puntatore a un logo/bollo e su ambiti
    /// diversi dello stesso articolo. Le righe di articoli diversi restano indipendenti: se cambia
    /// la foto di A, quella di B non la segue.
    ///
    /// Prima SyncPacchettoFoto e gli upload inserivano una riga nuova con il guid restituito da
    /// Olimpo senza guardare se l'articolo l'aveva gia', e articoli_foto si riempiva di copie.
    /// Tutti i punti che registrano una foto passano da qui.
    /// </summary>
    public static class RegistroFotoArticolo
    {
        /// <summary>Area e canale come ambito: null e stringa vuota sono lo stesso ambito generale.</summary>
        public static bool StessoAmbito(string? area1, string? canale1, string? area2, string? canale2)
        {
            return string.Equals(Normalizza(area1), Normalizza(area2), StringComparison.OrdinalIgnoreCase)
                && string.Equals(Normalizza(canale1), Normalizza(canale2), StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>
        /// La foto dell'articolo gia' registrata con questo guid in questo ambito, oppure null.
        /// Una foto senza guid (il segnaposto dell'import, in attesa di sync) non e' mai un duplicato.
        /// </summary>
        public static ArticoliFoto? GiaRegistrata(IEnumerable<ArticoliFoto> fotoDellArticolo, string? guidId, string? area, string? canale, ArticoliFoto? esclusa = null)
        {
            if (string.IsNullOrWhiteSpace(guidId))
            {
                return null;
            }

            return fotoDellArticolo
                .Where(f => !ReferenceEquals(f, esclusa))
                .Where(f => esclusa == null || esclusa.Id == 0 || f.Id != esclusa.Id)
                .FirstOrDefault(f => string.Equals(f.GuidId, guidId, StringComparison.OrdinalIgnoreCase)
                                  && StessoAmbito(f.Area, f.Canale, area, canale));
        }

        /// <summary>
        /// Le altre foto dell'articolo con lo stesso guid e lo stesso ambito di quella tenuta:
        /// sono copie della stessa immagine nello stesso posto, e vanno tolte.
        /// </summary>
        public static List<ArticoliFoto> CopieDi(IEnumerable<ArticoliFoto> fotoDellArticolo, ArticoliFoto tenuta)
        {
            if (string.IsNullOrWhiteSpace(tenuta.GuidId))
            {
                return new List<ArticoliFoto>();
            }

            return fotoDellArticolo
                .Where(f => !ReferenceEquals(f, tenuta))
                .Where(f => tenuta.Id == 0 || f.Id != tenuta.Id)
                .Where(f => f.IdArticolo == tenuta.IdArticolo)
                .Where(f => string.Equals(f.GuidId, tenuta.GuidId, StringComparison.OrdinalIgnoreCase)
                         && StessoAmbito(f.Area, f.Canale, tenuta.Area, tenuta.Canale))
                .ToList();
        }

        /// <summary>
        /// Al posto di una riga nuova si aggiorna quella gia' registrata, con lo stato che la nuova
        /// avrebbe avuto. Nome e ambito restano quelli della riga esistente.
        /// </summary>
        /// <summary>
        /// TASK-60aaf10d: la foto caricata dal Plugin solo per una lavorazione. Prima si costruiva la
        /// riga e non la si aggiungeva all'articolo: non veniva salvata, il meta della lavorazione non
        /// la trovava alla lettura successiva e la scelta si perdeva. Ora si registra spenta e non
        /// selezionata, cosi' la scelta automatica delle altre lavorazioni non la prende e solo il meta
        /// la usa. Se l'articolo ha gia' la stessa immagine nello stesso ambito si usa quella riga
        /// cosi' com'e', senza cambiarne lo stato: e' una foto dell'archivio, non della lavorazione.
        /// </summary>
        public static ArticoliFoto PerLaSolaLavorazione(ICollection<ArticoliFoto> fotoDellArticolo, ArticoliFoto nuova)
        {
            var esistente = GiaRegistrata(fotoDellArticolo, nuova.GuidId, nuova.Area, nuova.Canale);
            if (esistente != null)
            {
                return esistente;
            }

            nuova.Attiva = false;
            nuova.StatoSelezione = (byte)StatoSelezioneFoto.NonSelezionata;
            fotoDellArticolo.Add(nuova);
            return nuova;
        }

        public static ArticoliFoto Riusa(ArticoliFoto esistente, ArticoliFoto nuova)
        {
            esistente.Attiva = nuova.Attiva;
            esistente.StatoSelezione = nuova.StatoSelezione;
            esistente.Hash = nuova.Hash ?? esistente.Hash;
            esistente.Tipo = nuova.Tipo ?? esistente.Tipo;
            esistente.DataModifica = DateTime.Now;
            return esistente;
        }

        /// <summary>
        /// La foto dell'articolo con questo MD5, per la scansione del sync. Si cerca solo fra le
        /// foto dell'articolo: cercarla in tutto l'archivio restituiva a caso la riga di un altro
        /// articolo con la stessa immagine, la foto risultava nuova e veniva registrata di nuovo.
        /// </summary>
        public static ArticoliFoto? ConMd5(IEnumerable<ArticoliFoto> fotoDellArticolo, string? md5)
        {
            if (string.IsNullOrWhiteSpace(md5))
            {
                return null;
            }

            return fotoDellArticolo
                .Where(f => string.Equals(f.Hash, md5, StringComparison.OrdinalIgnoreCase))
                .OrderByDescending(f => f.DataModifica)
                .FirstOrDefault();
        }

        private static string Normalizza(string? valore)
        {
            return string.IsNullOrWhiteSpace(valore) ? "" : valore.Trim();
        }
    }
}
