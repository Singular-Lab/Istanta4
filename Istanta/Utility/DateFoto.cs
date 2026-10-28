namespace Istanta.Utility
{
    /// Le date di una foto dell'archivio come le mostra la pagina Archivio: quando e' stata
    /// inserita e quando e' stata modificata l'ultima volta, al minuto. Le usano la pagina, per la
    /// foto di ogni ambito, e Archivio/caricaFotoManuale, che le rimanda alla pagina dopo un
    /// caricamento: cosi' il formato e' lo stesso.
    ///
    /// Una data mancante, o prima del 2000, non e' un caricamento vero ma un valore lasciato in
    /// archivio (01/01/0001): non si mostra, come fa il Plugin nella schermata Cambia foto (I20-971).
    public static class DateFoto
    {
        private const int AnnoMinimoPlausibile = 2000;

        /// La data come gg/mm/aaaa hh:mm, o "" se manca o non e' plausibile.
        public static string Data(DateTime? valore)
        {
            if (!valore.HasValue || valore.Value.Year < AnnoMinimoPlausibile)
            {
                return "";
            }
            return valore.Value.ToString("dd/MM/yyyy HH:mm", System.Globalization.CultureInfo.InvariantCulture);
        }

        /// "Inserita il ... · Modificata il ...": ciascuna parte solo se la sua data c'e', e la
        /// modifica solo se e' diversa dall'inserimento. "" se non c'e' nessuna delle due.
        public static string Testo(DateTime? inserimento, DateTime? modifica)
        {
            string inserita = Data(inserimento);
            string modificata = Data(modifica);
            var parti = new List<string>();
            if (inserita != "")
            {
                parti.Add("Inserita il " + inserita);
            }
            if (modificata != "" && modificata != inserita)
            {
                parti.Add("Modificata il " + modificata);
            }
            return string.Join(" \u00B7 ", parti);
        }

        /// Il suggerimento della miniatura nella lista: il nome della foto e, a capo, le sue date.
        public static string Suggerimento(string? nome, DateTime? inserimento, DateTime? modifica)
        {
            string date = Testo(inserimento, modifica);
            string testo = nome ?? "";
            return date == "" ? testo : testo + "\n" + date;
        }
    }
}
