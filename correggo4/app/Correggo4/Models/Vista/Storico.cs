namespace Correggo4.Models.Vista;

/// <summary>Consulta tutti i volantini (j213): una riga per versione, dalla piu' recente. Date in ora italiana.</summary>
public sealed class StoricoPubblicazioni
{
    public string Cerca { get; set; } = "";
    public int Pagina { get; set; } = 1;
    public int Pagine { get; set; } = 1;
    public int Totale { get; set; }
    public List<VoceStorico> Voci { get; set; } = new();
}

public sealed class VoceStorico
{
    public int IdVolantino { get; set; }
    public string Titolo { get; set; } = "";
    public string Classificazione { get; set; } = "";
    public short Versione { get; set; }
    public DateTime Pubblicata { get; set; }
    public bool Ultima { get; set; }
}

/// <summary>Report delle correzioni di una versione (report.html dell'originale).</summary>
public sealed class ReportCorrezioni
{
    public int IdVolantino { get; set; }
    public string Titolo { get; set; } = "";
    public string Classificazione { get; set; } = "";
    public short Versione { get; set; }
    public List<short> Versioni { get; set; } = new();
    /// <summary>"TOTALE": tutte le versioni (getReportGlobale).</summary>
    public bool Tutte { get; set; }
    /// <summary>"OK/VISTO": solo gli OK (getReportOkVisto).</summary>
    public bool OkVisto { get; set; }

    /// <summary>"Storico correzioni sulla referenza" (j214): un solo prodotto, tutte le versioni.</summary>
    public bool Prodotto { get; set; }
    public long? IdBox { get; set; }
    public string EtichettaProdotto { get; set; } = "";

    public List<VoceReport> Voci { get; set; } = new();
}

public sealed class VoceReport
{
    public short Versione { get; set; }
    public short Pagina { get; set; }
    public string Etichetta { get; set; } = "";
    /// <summary>
    /// I20-1189: il box della correzione (null = nota o timbro sulla pagina, non su un prodotto). Nel
    /// report dell'editor non si vede: serve al report del timone per la miniatura del prodotto.
    /// </summary>
    public long? IdBox { get; set; }
    /// <summary>nota | timbro | edit | ok</summary>
    public string Tipo { get; set; } = "";
    public string Dettagli { get; set; } = "";
    public string Testo { get; set; } = "";
    public string Simbolo { get; set; } = "";
    /// <summary>attesa | accettata | irrisolta | ok</summary>
    public string Esito { get; set; } = "";
    public string Chiusura { get; set; } = "";

    /// <summary>Edit avanzato: foto e loghi da mostrare come miniature (j214).</summary>
    public List<FotoReport> Foto { get; set; } = new();

    /// <summary>
    /// I20-1189: cosa e' stato fatto, a pezzi con la loro intestazione («Nota:», «Timbro:», «Prezzo
    /// cambiato in:», «Azione:», «Descrizione modificata in:», «Foto cambiata in:», «Logo inserito:»,
    /// «Logo rimosso:»). Quando c'e', la vista disegna questi al posto di Testo e Foto.
    /// </summary>
    public List<BloccoReport> Blocchi { get; set; } = new();
}

public sealed class BloccoReport
{
    public string Titolo { get; set; } = "";
    /// <summary>Le righe di testo; una sola sta accanto all'intestazione, piu' di una vanno sotto.</summary>
    public List<string> Righe { get; set; } = new();
    public List<FotoReport> Foto { get; set; } = new();
    /// <summary>Il simbolo del timbro (nome del file senza estensione) e il suo nome, per il suggerimento.</summary>
    public string Simbolo { get; set; } = "";
    public string NomeSimbolo { get; set; } = "";
}

public sealed class FotoReport
{
    public string GuidId { get; set; } = "";
    public string Testo { get; set; } = "";
}
