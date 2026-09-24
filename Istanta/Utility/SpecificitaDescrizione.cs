using Istanta.Models;

namespace Istanta.Utility
{
    /// I20-993: la scala di specificita' delle varianti di descrizione, e l'elenco che il
    /// Plugin riceve per costruirne una schermata ciascuna.
    ///
    /// La scala e' quella che il revisore usa gia': nazionale, canale, area, area con canale.
    /// Era scritta dentro SyncFotoController come GetSpecificity, privata e non verificabile;
    /// qui e' un punto solo, e si prova senza database. Custom resta fuori di proposito: e' una
    /// quarta dimensione che il server continua a gestire altrove ma che non entra nella scala,
    /// perche' non e' ordinabile insieme ad area e canale.
    public static class SpecificitaDescrizione
    {
        /// Quanto e' specifica una variante: 0 nazionale, 1 canale, 2 area, 3 area con canale.
        /// Stessi valori di SyncFotoController.GetSpecificity, che resta la definizione di
        /// riferimento per le foto.
        public static int Rango(string? area, string? canale)
        {
            bool haArea = !string.IsNullOrWhiteSpace(area);
            bool haCanale = !string.IsNullOrWhiteSpace(canale);

            if (haArea && haCanale) return 3;
            if (haArea) return 2;
            if (haCanale) return 1;
            return 0;
        }

        /// Se una variante si puo' chiudere, cioe' cancellare, dal Plugin.
        ///
        /// La nazionale no, mai: e' il fondo della scala, e senza di lei il gruppo resterebbe
        /// senza nessuna descrizione su cui ricadere. Le altre si', ed e' una cancellazione
        /// vera - la stessa dell'elimina del revisore - quindi a monte ci vuole una conferma.
        public static bool SiPuoChiudere(string? area, string? canale)
        {
            return Rango(area, canale) > 0;
        }

        /// La riga su cui scrivere quando si salva una variante dal Plugin.
        ///
        /// Senza area ne' canale si torna al comportamento di prima - la prima riga che capita -
        /// perche' i client che non li mandano non devono cambiare comportamento. Quando invece
        /// la variante e' indicata si scrive solo sulla riga che le corrisponde, e fra i doppioni
        /// vale il piu' recente, come per l'elenco. Se quella variante non esiste si restituisce
        /// null e non si scrive niente: meglio non salvare che salvare sulla riga sbagliata, che
        /// e' il difetto per cui le modifiche finivano sulla nazionale.
        public static ArticoliDescrizioni? ScegliPerVariante(
            IEnumerable<ArticoliDescrizioni>? descrizioni,
            string? area,
            string? canale)
        {
            if (descrizioni == null)
            {
                return null;
            }

            bool varianteIndicata = !string.IsNullOrWhiteSpace(area) || !string.IsNullOrWhiteSpace(canale);

            if (!varianteIndicata)
            {
                return descrizioni.FirstOrDefault();
            }

            return descrizioni
                .Where(d => d != null && d.Custom == null && Corrisponde(d.Area, area) && Corrisponde(d.Canale, canale))
                .OrderByDescending(d => d.DataUltimaRicezione)
                .FirstOrDefault();
        }

        /// Due valori dicono la stessa cosa, trattando il vuoto e il nullo come sinonimi:
        /// nell'archivio la nazionale arriva ora con null ora con la stringa vuota.
        private static bool Corrisponde(string? uno, string? altro)
        {
            if (string.IsNullOrWhiteSpace(uno) && string.IsNullOrWhiteSpace(altro))
            {
                return true;
            }

            return string.Equals(uno, altro, StringComparison.Ordinal);
        }

        /// Le varianti che esistono per una referenza, dalla meno alla piu' specifica, ognuna
        /// con i suoi testi.
        ///
        /// I testi servono perche' il Plugin mostra una schermata per variante: senza, le
        /// schermate sarebbero vuote e servirebbe una chiamata per ognuna. Si scartano le
        /// varianti con Custom valorizzato, e per ogni coppia area e canale si tiene la piu'
        /// recente: l'archivio ne conserva piu' d'una, con date di ricezione diverse, ma per il
        /// Plugin e' una schermata sola. Stesso criterio del resto del server, che ordina per
        /// DataUltimaRicezione. L'ordine finale non e' un vezzo: e' la scala su cui si scende
        /// quando si chiude una schermata.
        public static List<Dictionary<string, object?>> Elenco(IEnumerable<ArticoliDescrizioni>? descrizioni)
        {
            var elenco = new List<Dictionary<string, object?>>();

            if (descrizioni == null)
            {
                return elenco;
            }

            var piuRecentePerCoppia = new Dictionary<string, ArticoliDescrizioni>();

            foreach (var d in descrizioni)
            {
                if (d == null || d.Custom != null)
                {
                    continue;
                }

                string? area = string.IsNullOrWhiteSpace(d.Area) ? null : d.Area;
                string? canale = string.IsNullOrWhiteSpace(d.Canale) ? null : d.Canale;

                //La chiave tiene distinti "area vuota" e "area che si chiama come il canale".
                string chiave = (area ?? "") + "\u0000" + (canale ?? "");

                if (!piuRecentePerCoppia.TryGetValue(chiave, out var gia) ||
                    d.DataUltimaRicezione > gia.DataUltimaRicezione)
                {
                    piuRecentePerCoppia[chiave] = d;
                }
            }

            foreach (var d in piuRecentePerCoppia.Values)
            {
                string? area = string.IsNullOrWhiteSpace(d.Area) ? null : d.Area;
                string? canale = string.IsNullOrWhiteSpace(d.Canale) ? null : d.Canale;

                elenco.Add(new Dictionary<string, object?>
                {
                    ["area"] = area,
                    ["canale"] = canale,
                    ["specificita"] = Rango(area, canale),
                    ["descrizione1"] = d.Descrizione1,
                    ["descrizione2"] = d.Descrizione2,
                    ["descrizione3"] = d.Descrizione3,
                    ["descrizione4"] = d.Descrizione4,
                    ["descrizioneIndd"] = d.DescrizioneIndd
                });
            }

            return elenco
                .OrderBy(v => (int)v["specificita"]!)
                .ThenBy(v => (string?)v["canale"] ?? "")
                .ThenBy(v => (string?)v["area"] ?? "")
                .ToList();
        }
    }
}
