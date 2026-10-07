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
}

public sealed class FotoReport
{
    public string GuidId { get; set; } = "";
    public string Testo { get; set; } = "";
}
