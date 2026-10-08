using Istanta.MiddleWare;
using Istanta.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// La sessione su Redis va caricata in asincrono all'ingresso di LoginMiddleWare: letta in modo
/// sincrono dal primo GetString, con il pool di thread occupato dal SYNC FOTO, teneva ferme le
/// richieste di tutti gli utenti. Qui una sessione finta registra l'ordine delle chiamate.
/// </summary>
public class CaricamentoSessioneTests
{
    [Fact]
    public async Task La_sessione_si_carica_in_asincrono_prima_di_essere_letta()
    {
        var sessione = new SessioneFinta(new Dictionary<string, string> { ["id"] = "42" });
        var context = ContestoCon(sessione);

        await LoginMiddleWare.CaricaSessioneAsync(context);
        string id = SessionIstantaObject.GetSession(context);

        Assert.Equal(["LoadAsync", "TryGetValue"], sessione.Chiamate);
        Assert.True(sessione.CaricataPrimaDellaLettura);
        Assert.Equal("42", id);
    }

    [Fact]
    public async Task Senza_sessione_configurata_non_fa_nulla()
    {
        var context = new DefaultHttpContext();

        await LoginMiddleWare.CaricaSessioneAsync(context);

        Assert.Null(context.Features.Get<ISessionFeature>());
    }

    [Fact]
    public async Task Se_lo_store_non_risponde_l_utente_resta_senza_sessione_come_prima()
    {
        var sessione = new SessioneFinta(new Dictionary<string, string> { ["id"] = "42" }) { CaricamentoFallisce = true };
        var context = ContestoCon(sessione);

        await LoginMiddleWare.CaricaSessioneAsync(context);

        Assert.Equal("no session", SessionIstantaObject.GetSession(context));
    }

    private static DefaultHttpContext ContestoCon(ISession sessione)
    {
        var context = new DefaultHttpContext();
        context.Features.Set<ISessionFeature>(new FunzioneSessione { Session = sessione });
        return context;
    }

    private sealed class FunzioneSessione : ISessionFeature
    {
        public ISession Session { get; set; } = null!;
    }

    /// <summary>
    /// Come la sessione distribuita: se nessuno l'ha caricata, la prima lettura la carica da sola
    /// (in modo sincrono). Se il caricamento fallisce, la sessione non e' disponibile e leggerla lancia.
    /// </summary>
    private sealed class SessioneFinta(Dictionary<string, string> valori) : ISession
    {
        private bool caricata;
        private bool disponibile = true;

        public List<string> Chiamate { get; } = [];
        public bool CaricamentoFallisce { get; init; }
        public bool CaricataPrimaDellaLettura { get; private set; }

        public bool IsAvailable => disponibile;
        public string Id => "sessione-di-prova";
        public IEnumerable<string> Keys => valori.Keys;

        public Task LoadAsync(CancellationToken cancellationToken = default)
        {
            Chiamate.Add("LoadAsync");
            caricata = true;
            if (CaricamentoFallisce)
            {
                disponibile = false;
                throw new InvalidOperationException("store della sessione non raggiungibile");
            }
            return Task.CompletedTask;
        }

        public bool TryGetValue(string key, out byte[] value)
        {
            Chiamate.Add("TryGetValue");
            CaricataPrimaDellaLettura = caricata;
            if (!disponibile)
                throw new InvalidOperationException("sessione non disponibile");
            caricata = true;
            if (valori.TryGetValue(key, out var testo))
            {
                value = System.Text.Encoding.UTF8.GetBytes(testo);
                return true;
            }
            value = [];
            return false;
        }

        public Task CommitAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
        public void Set(string key, byte[] value) => valori[key] = System.Text.Encoding.UTF8.GetString(value);
        public void Remove(string key) => valori.Remove(key);
        public void Clear() => valori.Clear();
    }
}
