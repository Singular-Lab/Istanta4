namespace Correggo4.Models.Vista;

/// <summary>
/// LA LETTURA AFFIANCATA (j322): il volantino visto come si sfoglia, due pagine per riga.
///
/// Michele, 01/10: «ci sono due icone.. una sembra un libro e uno un lucchetto.. al momento non
/// stanno facendo» e, dopo aver saputo cos'erano, «fallo funzionare».
///
/// Il libro c'era anche nel Correggo vecchio: apriva LetturaAffiancata.aspx in una finestra nuova
/// e mostrava tutto il volantino a coppie di pagine, come un giornale aperto - la copertina da
/// sola a destra, poi 2|3, 4|5, con una riga nera di separazione fra una coppia e l'altra. Niente
/// strumenti, niente correzioni: serve a guardare, non a lavorare.
///
/// DIFETTO DEL VECCHIO, da non ripetere: il suo ciclo partiva dall'indice 2 e si fermava a
/// «i &lt; Count», e con un numero PARI di pagine - cioe' praticamente sempre - l'ultima pagina non
/// veniva mai mostrata (con 4 pagine si vedevano copertina, 2 e 3: la 4 spariva). Qui le coppie si
/// fanno fino in fondo e l'ultima, se resta spaiata, sta da sola a sinistra.
/// </summary>
public sealed class PaginaAffiancata
{
    public short Numero { get; set; }

    /// <summary>L'immagine grande della pagina, la stessa che apre l'editor.</summary>
    public string Url { get; set; } = "";
}

/// <summary>Una riga della lettura affiancata: due pagine, come il volantino aperto in mano.</summary>
public sealed class CoppiaAffiancata
{
    /// <summary>Vuota nella prima riga: li' c'e' il titolo, e la copertina sta a destra.</summary>
    public PaginaAffiancata? Sinistra { get; set; }

    /// <summary>Vuota nell'ultima riga, se il volantino ha un numero dispari di pagine.</summary>
    public PaginaAffiancata? Destra { get; set; }
}

public sealed class VistaAffiancata
{
    public int IdVolantino { get; set; }
    public string Titolo { get; set; } = "";
    public string Promo { get; set; } = "";
    public short Versione { get; set; }
    public List<CoppiaAffiancata> Coppie { get; set; } = new();
}
