using ImageMagick;

namespace Correggo4.Ingestione;

public sealed record PaginaEstratta(byte Numero, string NomeFile, int LarghezzaPx, int AltezzaPx);

/// <summary>
/// Rasterizzazione del PDF, con i parametri dell'originale (Worker.cs:439-517):
/// 150 DPI, JPEG qualita' 75, miniature a larghezza fissa 120 px, e la prima
/// pagina salvata anche come "cover".
///
/// UNICA DEVIAZIONE VOLUTA: l'originale legge e scrive in CMYK
/// (settings.ColorSpace = ColorSpace.CMYK). I JPEG CMYK sono resi male o non
/// resi affatto dalla maggior parte dei browser. Qui rasterizziamo con gli
/// stessi parametri ma consegniamo sRGB, perche' queste immagini devono
/// comparire in una pagina web.
/// </summary>
public sealed class EstrattorePagine
{
    private readonly string radice;
    private readonly ILogger<EstrattorePagine> log;

    public EstrattorePagine(IConfiguration cfg, ILogger<EstrattorePagine> log)
    {
        this.radice = cfg["Storage:VolantiniPath"] ?? "/srv/istanta4/correggo4/storage/volantini";
        this.log = log;
    }

    public string CartellaDi(string classificazione, string titolo)
        => Path.Combine(radice, Pulisci(classificazione), Pulisci(titolo));

    private static string Pulisci(string s) => s.Replace("/", "_").Replace("..", "_");

    public List<PaginaEstratta> Estrai(byte[] pdf, string classificazione, string titolo,
                                       short versione, IReadOnlyList<byte> numeriPagina)
    {
        string cartella = CartellaDi(classificazione, titolo);
        Directory.CreateDirectory(Path.Combine(cartella, "thumbs"));

        var impostazioni = new MagickReadSettings
        {
            Density = new Density(150, 150),
            ColorSpace = ColorSpace.CMYK,
            ColorType = ColorType.Optimize
        };

        var risultato = new List<PaginaEstratta>();

        using var immagini = new MagickImageCollection();
        immagini.Read(pdf, impostazioni);

        for (int i = 0; i < immagini.Count; i++)
        {
            // L'originale mappa la i-esima immagine del PDF sull'i-esimo numero
            // di pagina dell'elenco ordinato, senza controllo di indice
            // (Worker.cs:496). Qui, se l'elenco e' piu' corto, ripieghiamo su i+1.
            byte numero = i < numeriPagina.Count ? numeriPagina[i] : (byte)(i + 1);

            var img = immagini[i];
            img.ColorSpace = ColorSpace.sRGB;
            img.Quality = 75;

            string nomeFile = $"pag{numero}_v{versione}.jpg";
            img.Write(Path.Combine(cartella, nomeFile));

            // Niente cast esplicito: il pacchetto e' Q8, quindi il tipo quantum e'
            // byte e non ushort. Clone() restituisce gia' il tipo giusto.
            using var miniatura = img.Clone();
            miniatura.Resize(120, 0);
            miniatura.Quality = 75;
            // Attenzione: le miniature NON hanno la "v" nel nome, le pagine si'.
            // Incoerenza dell'originale, riprodotta perche' il front-end potrebbe
            // costruire i percorsi a mano.
            miniatura.Write(Path.Combine(cartella, "thumbs", $"pag{numero}_{versione}.jpg"));
            if (i == 0)
                miniatura.Write(Path.Combine(cartella, "thumbs", $"cover_{versione}.jpg"));

            risultato.Add(new PaginaEstratta(numero, nomeFile, (int)img.Width, (int)img.Height));
        }

        log.LogInformation("Estratte {N} pagine in {Cartella}", risultato.Count, cartella);
        return risultato;
    }
}
