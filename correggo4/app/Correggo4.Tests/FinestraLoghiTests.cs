using Xunit;

namespace Correggo4.Tests;

/// <summary>
/// I20-1163: nella finestra del prodotto l'elenco Loghi/Bolli (e quello di Aggiungi/rimuovi) era alto
/// al massimo 280px e sotto restava mezza colonna vuota. Ora si prende la prima colonna fino al fondo
/// della finestra, e non scende sotto i 280px. L'altezza la decide il CSS della pagina: qui si
/// controlla il codice della pagina, come in BottoneSalvaTests.
/// </summary>
public class FinestraLoghiTests
{
    private static string Editor() =>
        File.ReadAllText(Path.Combine(RadiceApplicazione(), "Views", "Volantini", "Dettaglio.cshtml"));

    [Fact]
    public void L_elenco_dei_loghi_arriva_in_fondo_alla_colonna()
    {
        string html = Editor();

        // la prima colonna e' una pila: ritaglio, linguette, elenco che prende il resto e scorre dentro
        Assert.Contains(".modale .colonna.c1 { display: flex; flex-direction: column; }", html);
        Assert.Contains("#mLoghi { flex: 1 0 280px; overflow-y: auto; }", html);
        Assert.Contains("<div class=\"riquadro_vuoto\" id=\"mLoghi\">", html);
    }

    [Fact]
    public void Niente_tetto_di_280px_e_il_ritaglio_non_si_schiaccia()
    {
        string html = Editor();

        Assert.DoesNotContain("#mLoghi { max-height: 280px;", html);
        // ritaglio 4:3 (I20-1150) e linguette restano della loro misura
        Assert.Contains(".c1 .ritaglio, .c1 .linguette { flex: 0 0 auto; }", html);
    }

    /// <summary>
    /// I20-1164: i loghi si salvano e si annullano da soli, con SALVA e ANNULLA CORREZIONE in fondo alla
    /// linguetta Loghi/Bolli; descrizione e foto con i bottoni sotto la descrizione.
    /// </summary>
    [Fact]
    public void In_fondo_alla_linguetta_Loghi_Bolli_SALVA_e_ANNULLA_dei_soli_loghi()
    {
        string html = Editor().Replace("\r\n", "\n");

        // solo nella linguetta del prodotto (il ramo prima del catalogo)
        int prodotto = html.IndexOf("if (tabLoghi === 'prodotto') {", StringComparison.Ordinal);
        int catalogo = html.IndexOf("if (catalogoLoghi === null) {", prodotto, StringComparison.Ordinal);
        int bottoni = html.IndexOf("if (abil && (loghiInAttesa || improntaParte('loghi') !== improntaSalvata.loghi)) {", StringComparison.Ordinal);
        Assert.True(prodotto >= 0 && bottoni > prodotto && bottoni < catalogo);
        // ANNULLA solo con loghi in attesa, col secondo clic; tutti e due lavorano sulla parte "loghi"
        Assert.Contains("(loghiInAttesa ? '<button class=\"bottone pericolo\" type=\"button\" data-ea=\"annulla\">ANNULLA CORREZIONE</button>' : '')", html);
        Assert.Contains("eseguiEdit(id, 'loghi', bt.dataset.ea, bt, erroreLoghi);", html);
        Assert.DoesNotContain("data-ea=\"salva-loghi\"", html);
    }

    [Fact]
    public void SALVA_dei_loghi_e_della_descrizione_mandano_ognuno_la_sua_sezione()
    {
        string html = Editor();

        Assert.Contains("return parte === 'loghi' ? { sezione: 'loghi', loghi: s.loghi } : { sezione: 'descrizione', testo: s.testo, foto: s.foto };", html);
        Assert.Contains("url += 'Descrizione'; corpo = corpoParte(parte);", html);
        // SALVA dei loghi solo quando i loghi differiscono da quelli salvati
        Assert.Contains("var PIEDE_SALVA = { offerta: '#eaOffertaPiede', descrizione: '#eaDescrPiede', loghi: '#mLoghi' };", html);
        Assert.Contains("improntaSalvata.loghi = improntaParte('loghi');", html);
    }

    [Fact]
    public void ANNULLA_sotto_la_descrizione_solo_con_testo_o_foto_in_attesa()
    {
        string html = Editor();

        Assert.Contains("descrizione: !!(ed && ed.stato === 0) && (ed.campi.descrizione !== undefined || voci.some(function (v) { return v.stato <= 3; })),", html);
        Assert.Contains("loghi: voci.some(function (v) { return v.stato >= 4; })", html);
    }

    /// <summary>
    /// I20-1164, quarto giro: salvando i loghi spariva la descrizione in modifica, perche' si ridisegnava
    /// tutta la parte. Ora dopo un'operazione si ridisegna solo la sezione toccata.
    /// </summary>
    [Fact]
    public void Salvare_i_loghi_non_cancella_la_descrizione_in_modifica_e_viceversa()
    {
        string html = Editor().Replace("\r\n", "\n");

        Assert.Contains("riempiEdit(id, parte);", html);
        // dopo i loghi: solo loghi e bottoni sotto la descrizione, con la sua impronta di prima
        Assert.Contains("var primaDescrizione = improntaSalvata.descrizione;\n            inizializzaLoghi(id);\n            disegnaLoghi(id);\n" +
                        "            piedeEdit(id, 'descrizione');   // ANNULLA CORREZIONE sotto la descrizione\n" +
                        "            improntaSalvata.descrizione = primaDescrizione;", html);
        // dopo la descrizione: le foto si reinizializzano, i loghi in modifica no
        Assert.Contains("} else if (soloParte === 'descrizione') {\n            disegnaDescrizione(id);\n            inizializzaFoto(id);", html);
        Assert.DoesNotContain("riempiEdit(id, parte === 'loghi' ? 'descrizione' : parte);", html);
    }

    [Fact]
    public void Annulla_questa_modifica_ha_l_icona_undo()
    {
        string html = Editor();

        Assert.Contains("data-azione=\"ripristina\" title=\"Annulla questa modifica\"><img class=\"undo\" src=\"' + escA(IMG + 'undo_icon.png') + '\"", html);
        Assert.DoesNotContain("&#8630;", html);
        Assert.True(File.Exists(Path.Combine(RadiceApplicazione(), "wwwroot", "immagini-correggo", "undo_icon.png")));
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
