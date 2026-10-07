namespace Correggo4.Models.Vista;

/// <summary>
/// Le correzioni di un volantino come le vede l'editor: note, timbri e OK visto.
/// Le coordinate X/Y sono nelle unita' della pagina (le stesse di posizione_x/y dei box),
/// cosi' la vista le converte in percentuale come fa gia' per le zone dei box.
/// </summary>
public sealed class StatoCorrezioni
{
    public short IdUtente { get; set; }

    /// <summary>"Category" | "Marketing" | "Agenzia" | "" (utente GDO senza tipo)</summary>
    public string TipoUtente { get; set; } = "";
    public bool PuoScrivere { get; set; }
    public bool PuoAccettare { get; set; }

    /// <summary>Ora del server, per il conto alla rovescia dei 5 minuti lato client.</summary>
    public DateTime Adesso { get; set; }
    public int SecondiBattitura { get; set; }

    public bool Bloccato { get; set; }
    public bool Scaduto { get; set; }

    /// <summary>Finestra dei Category della promo (j209): aperta adesso, e quando chiude.</summary>
    public bool FinestraAperta { get; set; }
    public DateTime? FinestraFine { get; set; }

    /// <summary>L'utente e' un Category e la finestra non e' aperta: niente scritture.</summary>
    public bool FinestraChiusaPerTe { get; set; }

    /// <summary>Versione caricata; SolaLettura = aperta da "Consulta tutti i volantini" (j213).</summary>
    public short Versione { get; set; }
    public bool SolaLettura { get; set; }

    /// <summary>
    /// j307: i NUMERI DELLE PAGINE che il timone ha cambiato e che aspettano che l'Agenzia rifaccia
    /// l'impaginato. Su queste pagine non si corregge piu' niente - tranne l'Agenzia, che e' quella
    /// che deve sistemarle - e l'editor le oscura con la scritta che ha dettato Michele (29/09):
    /// «In attesa che l'Agenzia sistemi l'impaginato.».
    /// L'elenco si manda a TUTTI, Agenzia compresa: a lei serve per sapere dove mettere le mani.
    /// Chi si blocca lo decide TipoUtente, non la presenza in questa lista.
    /// </summary>
    public List<short> PagineDaSistemare { get; set; } = new();

    public List<NotaVista> Note { get; set; } = new();
    public List<TimbroVista> Timbri { get; set; } = new();
    public List<OkVista> Ok { get; set; } = new();

    /// <summary>Correzioni di Edit avanzato registrate (0) o confermate (2), una per box e parte.</summary>
    public List<EditVista> Edit { get; set; } = new();

    /// <summary>
    /// Propagazioni ricevute da questo volantino (j225): le correzioni nate su un volantino gemello
    /// e riportate qui. Si disegnano sul prodotto, sbiadite finche' sono solo proposte.
    /// </summary>
    public List<PropagataVista> Propagate { get; set; } = new();

    /// <summary>
    /// Basecode dei prodotti con correzioni in altre versioni (j214): icona dello storico sul box.
    /// Quelli con correzioni nella versione aperta li aggiunge l'editor dalle liste qui sopra.
    /// </summary>
    public List<string> BasecodeStorico { get; set; } = new();
}

/// <summary>
/// Una correzione di Edit avanzato su un box: parte "offerta" (prezzi e altre azioni) o "descrizione".
/// Campi usa le chiavi del tracciato (col punto). Le evidenze sono le zone da colorare sulla pagina,
/// nelle unita' della pagina: rettangoli sugli elementi figli, cerchio al centro per le azioni sul box.
/// </summary>
public sealed class EditVista
{
    public long IdBox { get; set; }
    public int IdPagina { get; set; }
    public short Pagina { get; set; }
    public string Parte { get; set; } = "";
    public short Stato { get; set; }
    public short IdAutore { get; set; }
    public string Autore { get; set; } = "";
    public string TipoAutore { get; set; } = "";
    public DateTime Data { get; set; }
    public Dictionary<string, string> Campi { get; set; } = new();
    public List<AzioneEditVista> Azioni { get; set; } = new();
    public List<EvidenzaVista> Evidenze { get; set; } = new();

    /// <summary>Parte descrizione (passo 2): foto P/S (stato 1-3) e loghi (4 aggiungi, 5 togli).</summary>
    public List<FotoEditVista> Foto { get; set; } = new();

    /// <summary>
    /// j227: la correzione arriva da un altro volantino (Edit avanzato propagato). I campi, le azioni
    /// e le foto sono quelli del pilota; le evidenze sono sui campi di **questo** prodotto.
    /// </summary>
    public bool Propagata { get; set; }
    /// <summary>Il box pilota, per aprire la correzione di partenza.</summary>
    public long IdBoxMaster { get; set; }
    /// <summary>Promo e volantino di provenienza ("vol_di_provenienza" dell'originale).</summary>
    public string DaPromo { get; set; } = "";
    public string DaVolantino { get; set; } = "";
    public short DaPagina { get; set; }
}

/// <summary>
/// j227: un prodotto gemello nell'elenco "Propagazioni" della finestra dell'Edit avanzato.
/// </summary>
public sealed class GemelloEditVista
{
    public long IdBox { get; set; }
    public int IdVolantino { get; set; }
    public string Promo { get; set; } = "";
    public string Volantino { get; set; } = "";
    public short Pagina { get; set; }
    public short Versione { get; set; }
    public string Etichetta { get; set; } = "";
    /// <summary>La propagazione e' gia' attiva su questo gemello.</summary>
    public bool Propagato { get; set; }
    /// <summary>L'Agenzia l'ha gia' confermata: non si tocca piu'.</summary>
    public bool Fatto { get; set; }
    /// <summary>Su questo gemello c'e' una correzione sua, diversa: non si propaga sopra.</summary>
    public bool Proprio { get; set; }
    public bool Bloccato { get; set; }
    public bool Scaduto { get; set; }
    /// <summary>In parole, per la riga dell'elenco.</summary>
    public string StatoTesto { get; set; } = "";
}

public sealed class FotoEditVista
{
    /// <summary>Codice della referenza per le foto, sigla per i loghi.</summary>
    public string Codice { get; set; } = "";
    public string GuidId { get; set; } = "";
    public string NomeFile { get; set; } = "";
    public int Stato { get; set; }
}

public sealed class AzioneEditVista
{
    public int Id { get; set; }
    public string Titolo { get; set; } = "";
    public Dictionary<string, string> Campi { get; set; } = new();
}

public sealed class EvidenzaVista
{
    public string Label { get; set; } = "";
    public double X { get; set; }
    public double Y { get; set; }
    public double W { get; set; }
    public double H { get; set; }
    public bool Cerchio { get; set; }
}

public sealed class NotaVista
{
    public long Id { get; set; }
    public long? IdBox { get; set; }
    public int IdPagina { get; set; }
    public short Pagina { get; set; }
    public string Testo { get; set; } = "";
    public double X { get; set; }
    public double Y { get; set; }
    public short Stato { get; set; }
    public short? IdAutore { get; set; }
    public string Autore { get; set; } = "";
    public string TipoAutore { get; set; } = "";
    public DateTime DataInserimento { get; set; }
    public DateTime? DataModifica { get; set; }
    public string Correttore { get; set; } = "";
    public DateTime? DataCorrezione { get; set; }

    /// <summary>Catena dei gemelli, se c'e' (j223): serve al megafono.</summary>
    public PropagazioneVista? Propagazione { get; set; }
}

public sealed class TimbroVista
{
    public long Id { get; set; }
    public long? IdBox { get; set; }
    public int IdPagina { get; set; }
    public short Pagina { get; set; }
    public string Simbolo { get; set; } = "";
    public string Nome { get; set; } = "";
    public double X { get; set; }
    public double Y { get; set; }
    public short Stato { get; set; }
    public short IdAutore { get; set; }
    public string Autore { get; set; } = "";
    public string TipoAutore { get; set; } = "";
    public DateTime DataInserimento { get; set; }
    public string Correttore { get; set; } = "";
    public DateTime? DataCorrezione { get; set; }

    /// <summary>Catena dei gemelli, se c'e' (j223): serve al megafono.</summary>
    public PropagazioneVista? Propagazione { get; set; }
}

public sealed class OkVista
{
    public long IdBox { get; set; }
    public int IdPagina { get; set; }
    public short? IdAutore { get; set; }
    public string Autore { get; set; } = "";
    public DateTime? Data { get; set; }
}
