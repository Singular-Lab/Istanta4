using System.Buffers.Binary;
using System.Text;
using System.Text.Json;

namespace Correggo4.Ingestione;

/// <summary>
/// Decodifica il formato .pack, ricostruito da CorreggoWebPublisher/Service1.cs:268-429.
///
///   [ 4 byte  : Int32 big-endian = lunghezza del JSON ]
///   [ N byte  : JSON UTF-8 di PacchettoCorreggoPerFP  ]
///   [ 4 byte  : Int32 big-endian = "success"          ]  <- l'originale lo legge e non lo usa
///   [ resto   : bytes del PDF                          ]
///
/// L'originale fa Array.Reverse sui 4 byte quando la macchina e' little-endian:
/// significa che sul file gli interi sono big-endian (network byte order).
/// </summary>
public static class LettorePack
{
    private static readonly JsonSerializerOptions Opzioni = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public static ContenutoPack Leggi(byte[] contenuto, string nomeFile)
    {
        if (contenuto.Length < 8)
            throw new InvalidDataException("Il file e' troppo corto per essere un .pack");

        int lunghezzaJson = BinaryPrimitives.ReadInt32BigEndian(contenuto.AsSpan(0, 4));
        if (lunghezzaJson <= 0 || 8 + lunghezzaJson > contenuto.Length)
            throw new InvalidDataException(
                $"Lunghezza JSON incoerente ({lunghezzaJson}) per un file di {contenuto.Length} byte");

        string json = Encoding.UTF8.GetString(contenuto, 4, lunghezzaJson);
        var pacchetto = JsonSerializer.Deserialize<PacchettoCorreggoPerFP>(json, Opzioni)
                        ?? throw new InvalidDataException("JSON del pacchetto illeggibile");

        if (pacchetto.promo == null)
            throw new InvalidDataException("Il pacchetto non contiene la sezione 'promo'");

        // I 4 byte di "success" si saltano: l'originale li legge e non li usa mai.
        int inizioPdf = 4 + lunghezzaJson + 4;
        byte[] pdf = new byte[contenuto.Length - inizioPdf];
        Array.Copy(contenuto, inizioPdf, pdf, 0, pdf.Length);

        return new ContenutoPack(pacchetto, pdf, IdUtenteDaNomeFile(nomeFile));
    }

    /// <summary>
    /// Nome atteso: "&lt;id_utente&gt;_qualsiasi.pack", con un '$' iniziale opzionale.
    /// L'originale fa Substring(0, IndexOf("_")) senza guardie: un nome senza '_'
    /// gli lancia un'eccezione che blocca l'intera coda. Qui restituiamo 0.
    /// </summary>
    public static short IdUtenteDaNomeFile(string nomeFile)
    {
        string nome = Path.GetFileName(nomeFile);
        int taglio = nome.IndexOf('_');
        if (taglio <= 0) return 0;
        return short.TryParse(nome[..taglio].Replace("$", ""), out short id) ? id : (short)0;
    }
}
