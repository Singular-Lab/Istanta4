namespace Correggo4.Models.Vista;

/// <summary>Pagina "Gestisci promo" dell'Agenzia (j209). Date e ore gia' in ora italiana.</summary>
public sealed class GestionePromo
{
    public List<string> Promo { get; set; } = new();
    public string? Scelta { get; set; }

    public DateTime? FinestraInizio { get; set; }
    public DateTime? FinestraFine { get; set; }
    /// <summary>"" non impostata | "da_aprire" | "aperta" | "chiusa"</summary>
    public string FinestraStato { get; set; } = "";

    public List<VolantinoGestito> Volantini { get; set; } = new();
}

public sealed class VolantinoGestito
{
    public int Id { get; set; }
    public string Titolo { get; set; } = "";
    public short Versione { get; set; }
    public bool Revocabile { get; set; }
    public DateTime ValiditaInizio { get; set; }
    public DateTime ValiditaFine { get; set; }
    /// <summary>"Invio previsto": data_scadenza, chiusura delle correzioni.</summary>
    public DateTime Scadenza { get; set; }
    public bool Bloccato { get; set; }
    public int? BloccoMinuti { get; set; }
    public string BloccatoDa { get; set; } = "";
}

public sealed class RevocaVersione
{
    public int IdVolantino { get; set; }
    public string Titolo { get; set; } = "";
    public string Classificazione { get; set; } = "";
    public short Versione { get; set; }
    public short Precedente { get; set; }
    public StatoCorrezioni Correzioni { get; set; } = new();
}
