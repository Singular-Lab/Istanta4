namespace Correggo4.Models.Vista;

/// <summary>Un pezzo di descrizione con la sua fascia colorata.</summary>
public sealed record PezzoDescrizione(string Tag, string Testo);

public sealed class CampoReferenza
{
    public string Etichetta { get; set; } = "";
    public string Valore { get; set; } = "";
}

public sealed class NotaSuBox
{
    public long Id { get; set; }
    public string Descrizione { get; set; } = "";
    public string Autore { get; set; } = "";
    public DateTime Data { get; set; }
    public short Stato { get; set; }
    public double Posx { get; set; }
    public double Posy { get; set; }
}

public sealed class BoxReferenza
{
    public long Id { get; set; }
    public string NomeBox { get; set; } = "";      // BOX_STD
    public string Basecode { get; set; } = "";
    public string? Gruppo { get; set; }

    // Geometria nelle unita' della pagina
    public decimal X { get; set; }
    public decimal Y { get; set; }
    public decimal Larghezza { get; set; }
    public decimal Altezza { get; set; }

    public List<PezzoDescrizione> Descrizione { get; set; } = new();
    public string? GuidFoto { get; set; }
    public List<CampoReferenza> Campi { get; set; } = new();     // dai figli
    public List<CampoReferenza> Tracciato { get; set; } = new(); // da itemRefStringfied
    public List<string> Azioni { get; set; } = new();
    public List<NotaSuBox> Note { get; set; } = new();
}

public sealed class PaginaCorrezione
{
    public int Id { get; set; }
    public short Numero { get; set; }
    public string UrlImmagine { get; set; } = "";
    public string UrlMiniatura { get; set; } = "";
    public decimal Larghezza { get; set; }
    public decimal Altezza { get; set; }
    public List<BoxReferenza> Box { get; set; } = new();
    public int Correzioni => Box.Sum(b => b.Note.Count);
}

public sealed class VolantinoInCorrezione
{
    public int Id { get; set; }
    public string Titolo { get; set; } = "";
    public string Classificazione { get; set; } = "";
    public short Versione { get; set; }
    public DateTime ValiditaInizio { get; set; }
    public DateTime ValiditaFine { get; set; }
    public DateTime Scadenza { get; set; }
    public List<PaginaCorrezione> Pagine { get; set; } = new();
    public int TotaleCorrezioni => Pagine.Sum(p => p.Correzioni);
    public string UrlFoto { get; set; } = "";
}
