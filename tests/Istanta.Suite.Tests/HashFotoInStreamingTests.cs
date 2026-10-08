using Istanta.Models;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// SYNC FOTO: l'MD5 delle foto si calcola leggendo il file in streaming invece di caricarlo intero.
/// La stringa deve restare identica a quella di prima, perche' si confronta con articoli_foto.hash
/// e con la deduplicazione di Olimpo.
/// </summary>
public class HashFotoInStreamingTests : IDisposable
{
    private readonly string cartella = Path.Combine(Path.GetTempPath(), "istanta-md5-" + Guid.NewGuid().ToString("N"));

    public HashFotoInStreamingTests() => Directory.CreateDirectory(cartella);

    public void Dispose()
    {
        try { Directory.Delete(cartella, true); } catch (IOException) { }
    }

    private string File(string nome, byte[] contenuto)
    {
        string percorso = Path.Combine(cartella, nome);
        System.IO.File.WriteAllBytes(percorso, contenuto);
        return percorso;
    }

    [Fact]
    public void Il_vettore_noto_da_l_MD5_atteso_in_maiuscolo_senza_trattini()
    {
        string percorso = File("abc.txt", "abc"u8.ToArray());

        Assert.Equal("900150983CD24FB0D6963F7D28E17F72", Crypto.GetMD5HashFromPath(percorso));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(1)]
    [InlineData(85_000)]          // sotto la soglia del Large Object Heap
    [InlineData(3 * 1024 * 1024 + 17)] // piu' blocchi di lettura
    public void In_streaming_si_ottiene_la_stessa_stringa_del_calcolo_in_memoria(int dimensione)
    {
        var contenuto = new byte[dimensione];
        new Random(dimensione).NextBytes(contenuto);
        string percorso = File($"foto_{dimensione}.jpg", contenuto);

        Assert.Equal(Crypto.GetMD5HashFromFile(contenuto), Crypto.GetMD5HashFromPath(percorso));
    }

    [Fact]
    public void Dopo_il_calcolo_il_file_si_puo_cancellare()
    {
        string percorso = File("da_cancellare.jpg", new byte[] { 1, 2, 3 });

        Crypto.GetMD5HashFromPath(percorso);
        System.IO.File.Delete(percorso);

        Assert.False(System.IO.File.Exists(percorso));
    }
}
