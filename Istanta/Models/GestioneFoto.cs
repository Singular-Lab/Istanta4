using IstantaLib;

namespace Istanta.Models
{
    /// La sezione delle foto della Scheda articolo (Views/Shared/_GestioneFoto.cshtml), che il revisore
    /// apre anche in una finestra. Per una referenza singola porta le foto del prodotto e le foto extra
    /// dell'articolo; per un gruppo solo le foto extra comuni a tutte le referenze.
    public class GestioneFoto
    {
        /// Il codice della referenza, o il codice gruppo ("123,456"): e' quello che le azioni mandano al server.
        public string Codice { get; set; } = "";
        public bool Gruppo { get; set; }
        /// Nel revisore la sezione sta in una finestra: dopo una modifica si ricarica la finestra, non la pagina.
        public bool InFinestra { get; set; }
        public string OlimpoIp { get; set; } = "";
        public string[] ExtPostProduzione { get; set; } = Array.Empty<string>();

        public List<Area> Aree { get; set; } = new List<Area>();
        public List<Canale> Canali { get; set; } = new List<Canale>();
        public List<CombinazioneAreaCanale> Combinazioni { get; set; } = new List<CombinazioneAreaCanale>();

        /// Tutte le foto dell'articolo (solo per una referenza singola).
        public List<ArticoliFoto> Foto { get; set; } = new List<ArticoliFoto>();
        /// Le foto extra da mostrare.
        public List<ArticoliFoto> Extra { get; set; } = new List<ArticoliFoto>();
        /// Le referenze del gruppo che non sono in archivio.
        public List<string> CodiciSenzaArticolo { get; set; } = new List<string>();
        /// Quante referenze ha il gruppo.
        public int Referenze { get; set; }
        /// Perche' la sezione non si puo' mostrare, se non si puo'.
        public string? Errore { get; set; }
    }
}
