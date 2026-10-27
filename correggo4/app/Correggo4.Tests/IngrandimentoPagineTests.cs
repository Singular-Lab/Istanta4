using Xunit;

namespace Correggo4.Tests;

/// <summary>
/// I20-1147: sugli schermi piu' larghi di un MacBook le pagine di Correggo4 si ingrandiscono in
/// proporzione (wwwroot/js/ingrandimento.js) invece di restare piccole in mezzo. Lo script deve stare
/// nella &lt;head&gt; di tutte le pagine tranne l'editor del volantino e la lettura affiancata, che
/// calcolano dove cadono i clic. Il calcolo gira nel browser: qui si controlla chi lo carica e dove.
/// </summary>
public class IngrandimentoPagineTests
{
    private const string Script = "~/js/ingrandimento.js";

    public static TheoryData<string> PagineIngrandite => new()
    {
        "Views/Volantini/Index.cshtml",
        "Views/Storico/Index.cshtml",
        "Views/Storico/Report.cshtml",
        "Views/Promo/Gestisci.cshtml",
        "Views/Promo/Revoca.cshtml",
        "Views/Account/Login.cshtml",
        "Views/Account/NonAutorizzato.cshtml",
        "Views/Shared/_Layout.cshtml"
    };

    public static TheoryData<string> PagineEscluse => new()
    {
        "Views/Volantini/Dettaglio.cshtml",
        "Views/Volantini/Affiancata.cshtml"
    };

    private static string Leggi(string relativo) =>
        File.ReadAllText(Path.Combine(RadiceApplicazione(), relativo.Replace('/', Path.DirectorySeparatorChar)));

    [Theory]
    [MemberData(nameof(PagineIngrandite))]
    public void La_pagina_carica_lo_script_nella_head(string vista)
    {
        string html = Leggi(vista);

        int script = html.IndexOf(Script, StringComparison.Ordinal);
        int fineHead = html.IndexOf("</head>", StringComparison.Ordinal);
        Assert.True(script >= 0, $"{vista} non carica {Script}");
        Assert.True(fineHead > script, $"{vista}: {Script} deve stare nella <head>, prima che la pagina venga disegnata");
    }

    [Theory]
    [MemberData(nameof(PagineEscluse))]
    public void L_editor_e_la_lettura_affiancata_non_si_ingrandiscono(string vista)
    {
        Assert.DoesNotContain("ingrandimento.js", Leggi(vista));
    }

    [Fact]
    public void Lo_script_ingrandisce_quanto_basta_perche_la_pagina_stia_come_sul_MacBook()
    {
        string js = Leggi("wwwroot/js/ingrandimento.js");

        // La finestra dello screenshot del MacBook 13" scelto dall'operatore.
        Assert.Contains("var LARGHEZZA_MACBOOK = 1372;", js);
        Assert.Contains("var ALTEZZA_MACBOOK = 783;", js);
        // Decide l'altezza, la larghezza fa da tetto, e sotto il MacBook non si rimpicciolisce.
        Assert.Contains("Math.max(1, Math.min(larghezza / LARGHEZZA_MACBOOK, altezza / ALTEZZA_MACBOOK))", js);
        // innerWidth/innerHeight: clientWidth cambia con lo zoom e la pagina oscillerebbe.
        Assert.Contains("fattore(window.innerWidth, window.innerHeight)", js);
        Assert.Contains("addEventListener(\"resize\", applica)", js);
    }

    [Fact]
    public void La_home_riempie_la_larghezza_con_al_massimo_due_card_per_riga()
    {
        string html = Leggi("Views/Volantini/Index.cshtml");

        // Due colonne al massimo: ogni colonna e' larga almeno meta' riga.
        Assert.Contains(".grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(max(min(330px,100%),calc((100% - 18px) / 2)),1fr));gap:18px}", html);
        // Niente tetto di larghezza sul corpo della home: ingrandita, non lascia margini vuoti ai lati.
        int inizio = html.IndexOf(".main{", StringComparison.Ordinal);
        Assert.True(inizio >= 0, "regola .main non trovata");
        string regolaMain = html.Substring(inizio, html.IndexOf('}', inizio) - inizio);
        Assert.DoesNotMatch(@"(?m)^\s*[^/\s*][^\n]*max-width", regolaMain);
        Assert.Contains("grid-template-columns:300px 1fr", regolaMain);
    }

    [Fact]
    public async Task La_pagina_di_login_servita_da_Correggo4_carica_lo_script()
    {
        using var app = new FabbricaCorreggo();
        using var client = app.Client();

        string html = await client.GetStringAsync("/Account/Login");

        int script = html.IndexOf("src=\"/js/ingrandimento.js?v=", StringComparison.Ordinal);
        Assert.True(script >= 0, "la pagina di login non carica lo script con la versione");
        Assert.True(html.IndexOf("</head>", StringComparison.Ordinal) > script);

        var r = await client.GetAsync("/js/ingrandimento.js");
        Assert.True(r.IsSuccessStatusCode, $"lo script non e' servito: {(int)r.StatusCode}");
    }

    // Come IndirizziNelleVisteTests: la cartella del progetto risalendo da quella dei test.
    private static string RadiceApplicazione()
    {
        for (var d = new DirectoryInfo(AppContext.BaseDirectory); d != null; d = d.Parent)
        {
            string candidata = Path.Combine(d.FullName, "Correggo4");
            if (File.Exists(Path.Combine(candidata, "Correggo4.csproj")))
                return candidata;
        }
        throw new DirectoryNotFoundException("Cartella del progetto Correggo4 non trovata sopra " + AppContext.BaseDirectory);
    }
}
