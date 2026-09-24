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

        /// Le varianti che esistono per una referenza, dalla meno alla piu' specifica.
        ///
        /// Si scartano quelle con Custom valorizzato, e i doppioni: la stessa coppia area e
        /// canale puo' comparire piu' volte nell'archivio, con date di ricezione diverse, ma
        /// per il Plugin e' una schermata sola. L'ordine non e' un vezzo: e' la scala su cui
        /// si scende quando si chiude una schermata.
        public static List<Dictionary<string, object?>> Elenco(IEnumerable<ArticoliDescrizioni>? descrizioni)
        {
            var elenco = new List<Dictionary<string, object?>>();

            if (descrizioni == null)
            {
                return elenco;
            }

            var viste = new HashSet<string>();

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
                if (!viste.Add(chiave))
                {
                    continue;
                }

                elenco.Add(new Dictionary<string, object?>
                {
                    ["area"] = area,
                    ["canale"] = canale,
                    ["specificita"] = Rango(area, canale)
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
