using Xunit;

namespace Correggo4.Tests;

/// <summary>
/// Ritocchi di layout di home, menabò avanzato ed editor:
/// - nella colonna Promo attive della home il nome della promo (camp-name) a 13px invece di 17;
/// - la campanella delle notifiche in testata nascosta per ora, non tolta: si riaccende con un interruttore;
/// - nel menabò avanzato i loghi del box della referenza (bolli) a 30x30 invece di 17x17;
/// - nell'editor tolta la freccia «Cambia volantino» accanto al titolo, che non faceva niente.
/// Le pagine si disegnano nel browser: qui se ne controlla il codice, come in PuliziaHomeTests.
/// </summary>
public class LayoutHomeEditorTests
{
    private static string Leggi(params string[] percorso) =>
        File.ReadAllText(Path.Combine([RadiceApplicazione(), .. percorso])).Replace("\r\n", "\n");

    private static string Home() => Leggi("Views", "Volantini", "Index.cshtml");
    private static string Editor() => Leggi("Views", "Volantini", "Dettaglio.cshtml");
    private static string Timone() => Leggi("wwwroot", "js", "timone.js");

    [Fact]
    public void Il_nome_della_promo_nella_colonna_e_a_13px()
    {
        string html = Home();

        Assert.Contains(".camp-name{font-size:13px;", html);
        Assert.DoesNotContain(".camp-name{font-size:17px;", html);
    }

    [Fact]
    public void Canale_e_area_della_card_sono_piu_grandi_delle_altre_etichette()
    {
        // I20-1283: l'etichetta "TDM · B" / "UFI · B" delle card dei volantini si leggeva a fatica.
        string html = Home();

        Assert.Contains(".p-area{background:var(--slate);color:#fff;font-size:15px;padding:6px 12px;border-radius:7px}", html);
        // le altre etichette (Bloccato, In revisione, Approvato) restano come prima
        Assert.Contains("font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;\n  padding:4px 9px;border-radius:6px;line-height:1;", html);
        // ed e' l'etichetta della card: canale e area
        Assert.Contains("<span class=\"pill p-area${classeArea(v.area)}\">${esc(v.canale)}${v.area ? \" · \" + esc(v.area) : \"\"}</span>", html);
    }

    [Fact]
    public void Canale_e_area_della_card_hanno_il_colore_della_loro_area()
    {
        // I20-1283, secondo giro: B1 col verde di Correggo4, B col bordeaux del logo Coop, le altre grigie.
        string html = Home();

        Assert.Contains(".p-area-b1{background:var(--teal-700)}", html);
        Assert.Contains(".p-area-b{background:#7b0f30}", html);
        // l'area intera, senza badare a maiuscole e spazi; il canale non conta
        Assert.Contains("const a = String(area || \"\").trim().toUpperCase();", html);
        Assert.Contains("if(a === \"B1\") return \" p-area-b1\";", html);
        Assert.Contains("if(a === \"B\") return \" p-area-b\";", html);
        // nessuna classe di colore per le altre aree: resta il grigio di .p-area
        string funzione = html.Substring(html.IndexOf("function classeArea(area){"));
        funzione = funzione.Substring(0, funzione.IndexOf("\n}\n") + 3);
        Assert.EndsWith("  return \"\";\n}\n", funzione);
    }

    [Fact]
    public void La_campanella_e_nascosta_ma_resta_nella_pagina()
    {
        string html = Home();

        Assert.Contains("bool campanellaVisibile = false;", html);
        Assert.Contains("<button class=\"bell\" type=\"button\" id=\"bell\" title=\"Notifiche\" hidden=\"@(!campanellaVisibile)\"", html);
        // .bell ha display:grid: senza questa regola l'attributo hidden non la nasconderebbe
        Assert.Contains(".bell[hidden]{display:none}", html);
        // lo script della tendina e il contatore ci sono ancora, per quando si riaccende
        Assert.Contains("const bell = document.getElementById(\"bell\");", html);
        Assert.Contains("id=\"bellN\"", html);
    }

    [Fact]
    public void Nel_menabo_avanzato_i_loghi_del_box_sono_30x30()
    {
        string js = Timone();

        Assert.Contains(".tim_casella .sk .bolli img { width: 30px; height: 30px; object-fit: contain; }", js);
        Assert.DoesNotContain(".bolli img { width: 17px;", js);
    }

    [Fact]
    public void Nell_editor_non_c_e_piu_la_freccia_Cambia_volantino()
    {
        string html = Editor();

        Assert.DoesNotContain("dropdown_titvol.png", html);
        Assert.DoesNotContain("title=\"Cambia volantino\"", html);
        Assert.DoesNotContain(".titolo_zona .dropdown", html);
        // il titolo con la versione resta, con gli APPUNTI accanto
        Assert.Contains("<span class=\"titolo_testo\"", html);
        Assert.Contains("<img class=\"postit\"", html);
    }

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
