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
