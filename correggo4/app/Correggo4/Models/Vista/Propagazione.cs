namespace Correggo4.Models.Vista;

/// <summary>
/// Lo stato della catena di una correzione, quel tanto che serve al megafono nell'editor
/// (nell'originale erano i campi propagazione_attiva, propagazione_in_costruzione,
/// propagazioni_attivate e propagazioni_corrette_anche_obsolete di Correzione).
/// </summary>
public sealed class PropagazioneVista
{
    public long Id { get; set; }
    /// <summary>Il demone non ha ancora costruito la catena: megafono "in costruzione".</summary>
    public bool InCostruzione { get; set; }
    public int Gemelli { get; set; }
    public int Attivati { get; set; }
    public int Fatti { get; set; }
    /// <summary>Tutta la catena e' stata corretta (percentuale "anche obsolete" = 1): alone verde.</summary>
    public bool TuttiFatti { get; set; }
    /// <summary>Nessun gemello attivato e meno di un'ora dalla creazione: megafono lampeggiante.</summary>
    public bool DaConsultare { get; set; }
}

/// <summary>La finestra del megafono: il pilota e i gemelli trovati.</summary>
public sealed class CatenaVista
{
    public long Id { get; set; }
    /// <summary>0 spenta, 1 attiva, 2 rettificata, 3 in costruzione.</summary>
    public short Stato { get; set; }
    public bool InCostruzione { get; set; }
    /// <summary>"nota" | "timbro"</summary>
    public string Tipo { get; set; } = "";
    public long IdCorrezione { get; set; }
    public string Testo { get; set; } = "";
    public string Simbolo { get; set; } = "";
    public string Autore { get; set; } = "";
    public string TipoAutore { get; set; } = "";
    public DateTime Data { get; set; }
    public VocePropagata? Pilota { get; set; }
    public List<VocePropagata> Propagati { get; set; } = new();
    public int PercentualeAttivati { get; set; }
    public int PercentualeFatti { get; set; }
    /// <summary>Chi guarda puo' attivare i gemelli (Category e Marketing).</summary>
    public bool PuoAttivare { get; set; }
    /// <summary>Chi guarda puo' confermare l'attuazione (Agenzia, j224).</summary>
    public bool PuoConfermare { get; set; }
    /// <summary>Ci sono gemelli in promo diverse: l'azione su tutti chiede conferma, come l'originale.</summary>
    public bool PromoDiverse { get; set; }
    /// <summary>
    /// Si puo' spegnere l'intera propagazione (j230, «ELIMINA DEFINITIVAMENTE» dell'originale):
    /// solo chi scrive, a catena costruita e finche' nessuno ha eseguito niente
    /// (correzioni.js:4573-4577, 4751, 4801).
    /// </summary>
    public bool PuoEliminare { get; set; }
}

/// <summary>Una riga della finestra: il pilota (Id = 0) o un gemello.</summary>
public sealed class VocePropagata
{
    public long Id { get; set; }
    public long IdBox { get; set; }
    public int IdVolantino { get; set; }
    public string Volantino { get; set; } = "";
    public string Promo { get; set; } = "";
    public short Pagina { get; set; }
    public short Versione { get; set; }
    /// <summary>La versione del gemello e' stata chiusa da una pubblicazione piu' nuova.</summary>
    public bool VersioneSuperata { get; set; }
    public string Etichetta { get; set; } = "";
    public string Codici { get; set; } = "";
    public short Stato { get; set; }
    public bool Attivo { get; set; }
    public bool Bloccato { get; set; }
    public int GiorniAllaScadenza { get; set; }
    /// <summary>Come le etichette dell'originale: Da fare, Fatta, Non propagato, Irrisolta...</summary>
    public string StatoTesto { get; set; } = "";
    /// <summary>Chi ha confermato l'attuazione e quando (j224).</summary>
    public string Correttore { get; set; } = "";
    public DateTime? DataCorrezione { get; set; }
    /// <summary>La riga si puo' confermare adesso: attivata, non ancora fatta, volantino libero.</summary>
    public bool PuoConfermare { get; set; }
    /// <summary>
    /// Il ritaglio del prodotto nella finestra (j232, come il `thumbnailbox.aspx` del vecchio):
    /// l'indirizzo dell'immagine di pagina piu' la geometria del box e della pagina. Il taglio lo
    /// fa il browser, come fa gia' il ritaglio della scheda nell'editor.
    /// </summary>
    public string UrlPagina { get; set; } = "";
    public double Px { get; set; }
    public double Py { get; set; }
    public double Pw { get; set; }
    public double Ph { get; set; }
    public double PagW { get; set; }
    public double PagH { get; set; }
}

/// <summary>
/// Una propagazione **ricevuta** da questo volantino: quello che l'originale disegna sul gemello
/// (getCorrezioni, ramo "//PROPAGAZIONI"). Non ha coordinate proprie — nell'originale arrivavano a
/// -1 e il client la appoggiava sul prodotto, impilando le successive.
/// </summary>
public sealed class PropagataVista
{
    /// <summary>volantini_propagazioni_elementi.id: e' l'id da confermare.</summary>
    public long Id { get; set; }
    public long IdCatena { get; set; }
    public long IdBox { get; set; }
    public int IdPagina { get; set; }
    public short Pagina { get; set; }
    /// <summary>"nota" | "timbro"</summary>
    public string Tipo { get; set; } = "";
    /// <summary>La correzione di partenza, sull'altro volantino.</summary>
    public long IdCorrezione { get; set; }
    public string Testo { get; set; } = "";
    public string Simbolo { get; set; } = "";
    public string Nome { get; set; } = "";
    public string Autore { get; set; } = "";
    public string TipoAutore { get; set; } = "";
    public DateTime? Data { get; set; }
    public short Stato { get; set; }
    public bool Attivo { get; set; }
    /// <summary>Proposta non ancora attivata: nell'originale si vede sbiadita.</summary>
    public bool Suggerimento { get; set; }
    public string StatoTesto { get; set; } = "";
    public string Correttore { get; set; } = "";
    public DateTime? DataCorrezione { get; set; }
    public bool PuoConfermare { get; set; }
    public PropagazioneVista? Propagazione { get; set; }
}
