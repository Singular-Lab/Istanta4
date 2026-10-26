namespace Correggo4.Models.Vista;

/// <summary>
/// Modello della home /Volantini (hub correzioni): promo a sinistra, con la tendina
/// dei PDF divisi per canale, e le card dei PDF della promo selezionata a destra.
/// La vista lo serializza in JSON e il disegno avviene lato client.
/// </summary>
public sealed class HubVolantini
{
    public string NomeUtente { get; set; } = "";
    public bool PuoCorreggere { get; set; }
    public int NotificheNonLette { get; set; }

    /// <summary>
    /// j243: stato dell'interruttore della colonna di sinistra. Governa le EMAIL di notifica
    /// (decisione di Michele del 16/9), non la campanella. Nessuna riga in
    /// utenti_impostazioni = attive.
    /// </summary>
    public bool EmailNotifiche { get; set; } = true;

    /// <summary>URL del logo del cliente (config "Cliente:LogoUrl"). Vuoto = segnaposto.</summary>
    public string LogoCliente { get; set; } = "";

    public bool MostraScadute { get; set; }
    public int PromoScadute { get; set; }

    public List<PromoHub> Promo { get; set; } = new();
}

/// <summary>Una promo = una classificazione.</summary>
public sealed class PromoHub
{
    public string Classificazione { get; set; } = "";
    public DateTime? ValiditaInizio { get; set; }
    public DateTime? ValiditaFine { get; set; }
    public DateTime? Aggiornata { get; set; }
    public List<PdfHub> Volantini { get; set; } = new();
}

/// <summary>Un PDF caricato = un volantino (classificazione, titolo) alla sua ultima versione.</summary>
public sealed class PdfHub
{
    public int Id { get; set; }
    public string Titolo { get; set; } = "";

    /// <summary>
    /// Ricavati dal titolo con la convenzione "&lt;promo&gt;_&lt;canale&gt;_&lt;area&gt;"
    /// (es. "AP142026 - Demo_FAM-FI_TOS"). Nel database non c'e' una colonna canale:
    /// se il titolo non segue la convenzione restano vuoti.
    /// </summary>
    public string Canale { get; set; } = "";
    public string Area { get; set; } = "";

    public short Versione { get; set; }
    public int Pagine { get; set; }
    public string Miniatura { get; set; } = "";

    /// <summary>"lavorazione" | "bloccato" | "approvato"</summary>
    public string Stato { get; set; } = "lavorazione";
    public int Aperte { get; set; }
    public int Commenti { get; set; }
    public int? BloccoMinuti { get; set; }
}
