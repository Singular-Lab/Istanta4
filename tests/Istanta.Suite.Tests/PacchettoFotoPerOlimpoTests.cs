using System.Net.Http.Headers;
using Istanta.Controllers;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// SYNC FOTO: lo zip va a {Olimpo}/foto/uploadPacchettoFoto in streaming dal disco. La richiesta
/// deve restare quella che Olimpo riceve da sempre: zip nel campo "file" col suo nome, metadati
/// JSON nel campo "json_meta_foto".
/// </summary>
public class PacchettoFotoPerOlimpoTests : IDisposable
{
    private readonly string cartella = Path.Combine(Path.GetTempPath(), "istanta-olimpo-" + Guid.NewGuid().ToString("N"));

    public PacchettoFotoPerOlimpoTests() => Directory.CreateDirectory(cartella);

    public void Dispose()
    {
        try { Directory.Delete(cartella, true); } catch (IOException) { }
    }

    private string Zip(byte[] contenuto)
    {
        string percorso = Path.Combine(cartella, "upload_prova.zip");
        System.IO.File.WriteAllBytes(percorso, contenuto);
        return percorso;
    }

    [Fact]
    public async Task Lo_zip_va_nel_campo_file_col_suo_nome_e_tutti_i_suoi_byte()
    {
        var contenuto = new byte[200_000];
        new Random(7).NextBytes(contenuto);
        string zip = Zip(contenuto);

        using var form = SyncFotoController.PacchettoFotoPerOlimpo(
            new FileStream(zip, FileMode.Open, FileAccess.Read, FileShare.Read), "upload_prova.zip", "[]");

        var file = Assert.Single(form, p => p.Headers.ContentDisposition?.Name?.Trim('"') == "file");
        Assert.Equal("upload_prova.zip", file.Headers.ContentDisposition!.FileName!.Trim('"'));
        Assert.Equal("multipart/form-data", file.Headers.ContentType!.MediaType);
        Assert.Equal(contenuto, await file.ReadAsByteArrayAsync());
    }

    [Fact]
    public async Task I_metadati_vanno_nel_campo_json_meta_foto()
    {
        string zip = Zip(new byte[] { 1, 2, 3 });
        const string meta = "[{\"Id\":\"0\",\"FileHash\":\"ABC\",\"FileName\":\"1234.jpg\",\"IdRef\":\"5\",\"Size\":0}]";

        using var form = SyncFotoController.PacchettoFotoPerOlimpo(
            new FileStream(zip, FileMode.Open, FileAccess.Read, FileShare.Read), "upload_prova.zip", meta);

        var json = Assert.Single(form, p => p.Headers.ContentDisposition?.Name?.Trim('"') == "json_meta_foto");
        Assert.Equal(new MediaTypeHeaderValue("application/json") { CharSet = "utf-8" }, json.Headers.ContentType);
        Assert.Equal(meta, await json.ReadAsStringAsync());
    }

    [Fact]
    public void Chiuso_il_form_lo_zip_temporaneo_si_puo_cancellare()
    {
        string zip = Zip(new byte[] { 1, 2, 3 });

        using (SyncFotoController.PacchettoFotoPerOlimpo(
                   new FileStream(zip, FileMode.Open, FileAccess.Read, FileShare.Read), "upload_prova.zip", "[]"))
        {
        }
        System.IO.File.Delete(zip);

        Assert.False(System.IO.File.Exists(zip));
    }
}
