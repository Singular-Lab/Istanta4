using System.Diagnostics;
using System.Text;

namespace Correggo4.Servizi;

/// <summary>
/// DA HTML A PDF, sul server (j315).
///
/// Michele, 29/09: «quando faccio esporta pdf deve andare direttamente nei download.. fine non
/// devi fare nient'altro». Per far scendere un file nei Download senza nessuna finestra il PDF lo
/// deve fare il server e mandarlo come allegato: il browser allora lo scarica e basta.
///
/// COME: si scrive l'HTML in un file temporaneo e si chiama il motore di stampa di Chrome
/// (chrome-headless-shell, installato in /opt/chrome-pdf con j314b - Chrome senza interfaccia,
/// solo il motore). Il PDF che esce e' fatto dallo stesso motore che stamperebbe la pagina dal
/// browser, quindi viene identico a quello che l'utente vede.
///
/// PERCHE' NON UNA LIBRERIA .NET DI PDF: perche' vorrebbe dire riscrivere il report in C#, e da
/// quel giorno ci sarebbero due report - quello a schermo e quello stampato - che si allontanano a
/// ogni ritocco. LibreOffice, che sul server c'e', dell'HTML moderno non capisce niente (niente
/// flex, niente colori di sfondo): il foglio uscirebbe irriconoscibile.
///
/// SICUREZZA, due punti che contano:
///   1. l'HTML arriva dal browser di un utente autenticato, ma il motore gira comunque SENZA RETE
///      (--host-resolver-rules=MAP * ~NOTFOUND): cosi' nemmeno un indirizzo messo dentro per
///      sbaglio - o di proposito - puo' far chiamare al server qualcosa in giro per la rete o
///      dentro la rete dell'ufficio. Le foto viaggiano dentro l'HTML come data:, non come
///      indirizzi.
///   2. tutto sta in una cartella temporanea sua, che si butta sempre - anche quando qualcosa va
///      storto (il finally).
///
/// Il motore si trova con l'indirizzo di serie qui sotto; se un domani si sposta, basta la
/// variabile d'ambiente ISTANTA4_CHROME_PDF nel file del servizio, senza toccare il codice.
/// </summary>
public static class ServizioPdf
{
    private const string MotoreDiSerie = "/usr/local/bin/chrome-pdf";

    private static string Motore
    {
        get
        {
            string? v = Environment.GetEnvironmentVariable("ISTANTA4_CHROME_PDF");
            return string.IsNullOrWhiteSpace(v) ? MotoreDiSerie : v;
        }
    }

    /// <summary>Quanto HTML si accetta. Le foto viaggiano dentro, percio' non e' poco.</summary>
    public const int MassimoHtml = 24 * 1024 * 1024;

    /// <summary>Oltre questo tempo si ammazza il motore: meglio un errore che una pagina appesa.</summary>
    private const int SecondiMassimi = 75;

    public sealed record Esito(bool Ok, string Codice, string Messaggio, byte[] Dati);

    private static Esito No(string codice, string messaggio) =>
        new(false, codice, messaggio, Array.Empty<byte>());

    public static bool MotoreCe() => File.Exists(Motore);

    public static async Task<Esito> DaHtmlAsync(string? html, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(html))
            return No("html_vuoto", "Non e' arrivato niente da mettere nel PDF.");
        if (html.Length > MassimoHtml)
            return No("html_troppo_grande",
                "Il report e' troppo grande per essere spedito al server. Usa STAMPA e scegli " +
                "«Salva come PDF».");
        if (!MotoreCe())
            return No("motore_mancante",
                "Su questo server non c'e' il motore per fare i PDF. Usa STAMPA e scegli " +
                "«Salva come PDF».");

        string cartella = Path.Combine(Path.GetTempPath(), "correggo4-pdf",
                                       Guid.NewGuid().ToString("N"));
        string entrata = Path.Combine(cartella, "report.html");
        string uscita = Path.Combine(cartella, "report.pdf");
        try
        {
            Directory.CreateDirectory(cartella);
            await File.WriteAllTextAsync(entrata, html, new UTF8Encoding(false), ct);

            var avvio = new ProcessStartInfo(Motore)
            {
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                WorkingDirectory = cartella
            };
            foreach (string a in new[]
            {
                "--headless",
                "--disable-gpu",
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--user-data-dir=" + Path.Combine(cartella, "profilo"),
                // niente rete dentro il motore: vedi il punto 1 del commento in cima
                "--host-resolver-rules=MAP * ~NOTFOUND",
                // senza questo Chrome ci scrive in cima l'indirizzo del file e la data
                "--no-pdf-header-footer",
                "--print-to-pdf=" + uscita,
                entrata
            })
                avvio.ArgumentList.Add(a);

            using var p = Process.Start(avvio);
            if (p == null) return No("motore_non_parte", "Il motore dei PDF non e' partito.");

            // si leggono le due uscite mentre gira, sennò con molto testo il processo si blocca
            // sul suo stesso buffer e resta li' per sempre
            var erroriLetti = p.StandardError.ReadToEndAsync(ct);
            var uscitaLetta = p.StandardOutput.ReadToEndAsync(ct);
            using var tempo = new CancellationTokenSource(TimeSpan.FromSeconds(SecondiMassimi));
            using var insieme = CancellationTokenSource.CreateLinkedTokenSource(ct, tempo.Token);
            try
            {
                await p.WaitForExitAsync(insieme.Token);
            }
            catch (OperationCanceledException)
            {
                try { p.Kill(true); } catch { /* era gia' morto */ }
                return No("motore_lento",
                    $"Il PDF non e' stato pronto entro {SecondiMassimi} secondi. Usa STAMPA e " +
                    "scegli «Salva come PDF».");
            }

            if (!File.Exists(uscita))
            {
                string err = "";
                try { err = (await erroriLetti) ?? ""; } catch { }
                // le righe di Chrome cominciano tutte con [1234:5678:...]: si tiene solo l'ultima
                // riga utile, che e' quella che dice cosa non e' andato
                string ultima = err.Split('\n', StringSplitOptions.RemoveEmptyEntries)
                                   .LastOrDefault()?.Trim() ?? "";
                return No("pdf_non_fatto",
                    "Il motore non ha prodotto il PDF." + (ultima.Length > 0 ? " (" + ultima + ")" : ""));
            }

            byte[] dati = await File.ReadAllBytesAsync(uscita, ct);
            if (dati.Length < 5 || dati[0] != (byte)'%' || dati[1] != (byte)'P')
                return No("pdf_rotto", "Il file prodotto non e' un PDF valido.");

            return new Esito(true, "", "", dati);
        }
        catch (OperationCanceledException)
        {
            return No("annullato", "La richiesta e' stata interrotta.");
        }
        finally
        {
            try { Directory.Delete(cartella, true); } catch { /* pazienza: e' in /tmp */ }
        }
    }
}
