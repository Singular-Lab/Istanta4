using Istanta.Utility;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// TASK-a77bd7b2: la merceologia della pagina Archivio legge i record di tutti i tracciati. Prima si teneva
/// cinque minuti e poi la prima richiesta che la trovava scaduta aspettava il ricalcolo intero. Con
/// CacheConRinnovo aspetta solo la prima lettura; dopo, a valore scaduto, si risponde con quello vecchio e
/// il rinnovo parte in background, uno alla volta.
///
/// L'ora e il "background" sono finti: il rinnovo si raccoglie in una lista e lo si fa partire a mano.
/// </summary>
public class CacheConRinnovoTests
{
    private sealed class Prova
    {
        public DateTime Adesso = new DateTime(2026, 10, 27, 12, 0, 0, DateTimeKind.Utc);
        public readonly List<Action> InBackground = new();
        public readonly List<Exception> Errori = new();
        public int Caricamenti;
        public readonly CacheConRinnovo<string> Cache;

        public Prova(Func<int, string>? carica = null)
        {
            var calcola = carica ?? (n => "valore " + n);
            Cache = new CacheConRinnovo<string>(
                () => { Caricamenti++; return calcola(Caricamenti); },
                () => "vuoto",
                TimeSpan.FromMinutes(5),
                e => Errori.Add(e),
                () => Adesso,
                azione => InBackground.Add(azione));
        }
    }

    [Fact]
    public void La_prima_lettura_carica_e_le_successive_no()
    {
        var prova = new Prova();

        Assert.Equal("valore 1", prova.Cache.Leggi());
        prova.Adesso = prova.Adesso.AddMinutes(4);
        Assert.Equal("valore 1", prova.Cache.Leggi());

        Assert.Equal(1, prova.Caricamenti);
        Assert.Empty(prova.InBackground);
    }

    [Fact]
    public void Scaduto_si_risponde_col_vecchio_e_il_rinnovo_parte_in_background()
    {
        var prova = new Prova();
        prova.Cache.Leggi();

        prova.Adesso = prova.Adesso.AddMinutes(6);
        //La richiesta non aspetta: ha subito il valore di prima.
        Assert.Equal("valore 1", prova.Cache.Leggi());
        Assert.Equal(1, prova.Caricamenti);
        Assert.Single(prova.InBackground);

        prova.InBackground[0]();
        Assert.Equal(2, prova.Caricamenti);
        Assert.Equal("valore 2", prova.Cache.Leggi());
        //Rinnovato, vale altri cinque minuti.
        Assert.Single(prova.InBackground);
    }

    [Fact]
    public void Un_solo_rinnovo_alla_volta()
    {
        var prova = new Prova();
        prova.Cache.Leggi();
        prova.Adesso = prova.Adesso.AddMinutes(6);

        prova.Cache.Leggi();
        prova.Cache.Leggi();
        prova.Cache.Leggi();
        Assert.Single(prova.InBackground);

        prova.InBackground[0]();
        prova.Adesso = prova.Adesso.AddMinutes(6);
        prova.Cache.Leggi();
        Assert.Equal(2, prova.InBackground.Count);
    }

    [Fact]
    public void Un_rinnovo_fallito_lascia_il_valore_di_prima_e_riprova_alla_scadenza_dopo()
    {
        var prova = new Prova(n => n == 2 ? throw new InvalidOperationException("database occupato") : "valore " + n);
        prova.Cache.Leggi();
        prova.Adesso = prova.Adesso.AddMinutes(6);
        prova.Cache.Leggi();

        prova.InBackground[0]();
        Assert.Single(prova.Errori);
        Assert.Equal("valore 1", prova.Cache.Leggi());
        //Non riprova a ogni richiesta.
        Assert.Single(prova.InBackground);

        prova.Adesso = prova.Adesso.AddMinutes(6);
        prova.Cache.Leggi();
        prova.InBackground[1]();
        Assert.Equal("valore 3", prova.Cache.Leggi());
    }

    [Fact]
    public void Il_primo_caricamento_fallito_vale_il_valore_di_riserva_fino_alla_scadenza()
    {
        var prova = new Prova(n => n == 1 ? throw new InvalidOperationException("database non raggiungibile") : "valore " + n);

        Assert.Equal("vuoto", prova.Cache.Leggi());
        Assert.Single(prova.Errori);
        Assert.Equal("vuoto", prova.Cache.Leggi());
        Assert.Equal(1, prova.Caricamenti);

        prova.Adesso = prova.Adesso.AddMinutes(6);
        Assert.Equal("vuoto", prova.Cache.Leggi());
        prova.InBackground[0]();
        Assert.Equal("valore 2", prova.Cache.Leggi());
    }

    [Fact]
    public async Task Due_prime_letture_insieme_caricano_una_volta_sola()
    {
        int caricamenti = 0;
        var cache = new CacheConRinnovo<string>(
            () => { Interlocked.Increment(ref caricamenti); Thread.Sleep(100); return "merceologia"; },
            () => "vuoto",
            TimeSpan.FromMinutes(5));

        var letture = await Task.WhenAll(Task.Run(cache.Leggi), Task.Run(cache.Leggi), Task.Run(cache.Leggi));

        Assert.All(letture, valore => Assert.Equal("merceologia", valore));
        Assert.Equal(1, caricamenti);
    }
}
