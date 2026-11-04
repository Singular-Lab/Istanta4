using System.Text.Json;
using Correggo4.Auth;
using Correggo4.Data;
using Correggo4.Models;
using Correggo4.Servizi;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Xunit;

namespace Correggo4.Tests;

/// <summary>
/// I20-1197: la finestra del gruppo del menabò avanzato, rifatta come il mockup del cliente: la
/// fascia verde, le referenze affiancate con «SGRUPPA E SOSPENDI» (in italiano, senza forbici e senza
/// l'intestazione «GESTIONE GRUPPO» del mockup, tolte dall'operatore in revisione), e «Unisci» con la
/// ricerca per nome, codice, reparto e tema su tutte le pagine. Reparto e tema li manda il server
/// nelle voci del piano, letti dal dato della ref salvato col box; la finestra sta nel browser e si
/// controlla il sorgente, come per gli altri test del timone.
/// </summary>
public class TimoneGestioneGruppoTests
{
    /* ---- il server: reparto e tema ---- */

    private static string ContenutoBox(string itemRef) =>
        JsonSerializer.Serialize(new { boxName = "BOX_STD", itemRefStringfied = itemRef });

    [Fact]
    public void Reparto_e_tema_si_leggono_dal_dato_della_ref_del_box()
    {
        var (reparto, tema) = ServizioTimone.RepartoETema(ContenutoBox(
            "{\"reparto\":\"EX\",\"descrizione_reparto\":\"Extra alimentare\",\"tema\":\"Casa e tessile\"}"));
        Assert.Equal("EX · Extra alimentare", reparto);
        Assert.Equal("Casa e tessile", tema);
    }

    [Fact]
    public void Un_reparto_numerico_o_ripetuto_si_scrive_una_volta()
    {
        Assert.Equal("31", ServizioTimone.RepartoETema(ContenutoBox("{\"reparto\":31}")).Reparto);
        Assert.Equal("Freschi", ServizioTimone.RepartoETema(
            ContenutoBox("{\"reparto\":\"Freschi\",\"descrizione_reparto\":\"freschi\"}")).Reparto);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("non e' json")]
    [InlineData("{\"boxName\":\"BOX_STD\"}")]
    [InlineData("{\"itemRefStringfied\":\"rotto {\"}")]
    [InlineData("{\"itemRefStringfied\":\"{\\\"settore\\\":\\\"56\\\"}\"}")]
    public void Senza_il_dato_reparto_e_tema_restano_vuoti(string? contenuto)
    {
        Assert.Equal(("", ""), ServizioTimone.RepartoETema(contenuto));
    }

    private static Correggo4Context Contesto(string nomeDb) =>
        new(new DbContextOptionsBuilder<Correggo4Context>()
            .UseInMemoryDatabase(nomeDb)
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options);

    [Fact]
    public async Task Il_piano_porta_reparto_e_tema_di_ogni_voce()
    {
        string db = "correggo4-gestione-gruppo-" + Guid.NewGuid().ToString("N");
        using var ctx = Contesto(db);
        var agenzia = new Utenti
        {
            Nome = "Agenzia", Cognome = "Prova", Email = "agenzia@prova.local", Username = "agenzia-prova",
            Ruolo = Ruoli.CodiceAgenzia, Attivo = true, DataInserimento = DateTime.UtcNow
        };
        ctx.Utentis.Add(agenzia);
        var oggi = DateTime.UtcNow.Date;
        var vol = new Volantini
        {
            Titolo = "0524_26_B_TDM_B", Classificazione = "0524_26_B", Status = 1, Margini = "0,0,0,0",
            DataValiditaInizio = oggi.AddDays(-2), DataValiditaFine = oggi.AddDays(12), DataScadenza = oggi.AddDays(6)
        };
        ctx.Volantinis.Add(vol);
        await ctx.SaveChangesAsync();
        var versione = new VolantiniVersioni { IdVol = vol.Id, Versione = 1, DataPubblicazione = DateTime.UtcNow };
        ctx.VolantiniVersionis.Add(versione);
        await ctx.SaveChangesAsync();
        var pagina = new VolantiniPagine
        {
            IdVol = vol.Id, IdVersione = versione.Id, Numero = 1, Versione = 1,
            Path = "pag1_v1", PathFisico = "0524_26_B/pag1_v1", DataVersione = DateTime.UtcNow
        };
        ctx.VolantiniPagines.Add(pagina);
        await ctx.SaveChangesAsync();
        var conDato = new VolantiniPagineElementi
        {
            IdPagina = pagina.Id, LabelInd = "box", Basecode = "1078545", Larghezza = 100, Altezza = 100,
            Contenuto = ContenutoBox("{\"reparto\":\"EX\",\"tema\":\"Casa e tessile\"}")
        };
        var senzaDato = new VolantiniPagineElementi
        {
            IdPagina = pagina.Id, LabelInd = "box", Basecode = "6562233", Larghezza = 100, Altezza = 100, Contenuto = ""
        };
        ctx.VolantiniPagineElementis.AddRange(conDato, senzaDato);
        await ctx.SaveChangesAsync();
        var piano = new VolantiniTimone
        {
            IdVol = vol.Id, Versione = 1, Stato = ServizioTimone.PianoInLavorazione, Revisione = 1,
            DataCreazione = DateTime.UtcNow, IdAutore = agenzia.Id
        };
        ctx.Timoni.Add(piano);
        await ctx.SaveChangesAsync();
        var tp = new VolantiniTimonePagine { IdTimone = piano.Id, Numero = 1, Ordine = 1, Attiva = true };
        ctx.TimonePagine.Add(tp);
        await ctx.SaveChangesAsync();
        ctx.TimoneVoci.AddRange(
            new VolantiniTimoneVoci
            {
                IdTimone = piano.Id, IdElemento = conDato.Id, Codice = "1078545", Basecode = "1078545",
                Etichetta = "mele golden", IdPaginaTimone = tp.Id, Posizione = 1, PaginaOrigine = 1,
                Stato = ServizioTimone.VoceInPagina
            },
            new VolantiniTimoneVoci
            {
                IdTimone = piano.Id, IdElemento = senzaDato.Id, Codice = "6562233", Basecode = "6562233",
                Etichetta = "lenticchie", IdPaginaTimone = tp.Id, Posizione = 2, PaginaOrigine = 1,
                Stato = ServizioTimone.VoceInPagina
            });
        await ctx.SaveChangesAsync();

        using var ctx2 = Contesto(db);
        var esito = await new ServizioTimone(ctx2).PianoAsync(
            new ServizioTimone.Chi(agenzia.Id, agenzia.Ruolo, null, "Agenzia Prova"), vol.Id);
        Assert.True(esito.Ok, esito.Messaggio);
        using var doc = JsonDocument.Parse(JsonSerializer.Serialize(esito.Dati));
        var voci = doc.RootElement.GetProperty("voci").EnumerateArray()
            .ToDictionary(v => v.GetProperty("codice").GetString()!);
        Assert.Equal("EX", voci["1078545"].GetProperty("reparto").GetString());
        Assert.Equal("Casa e tessile", voci["1078545"].GetProperty("tema").GetString());
        Assert.Equal("", voci["6562233"].GetProperty("reparto").GetString());
        Assert.Equal("", voci["6562233"].GetProperty("tema").GetString());
    }

    /* ---- il browser: la finestra ---- */

    private static string Timone() =>
        File.ReadAllText(Path.Combine(RadiceApplicazione(), "wwwroot", "js", "timone.js")).Replace("\r\n", "\n");

    private static string Funzione(string sorgente, string firma)
    {
        int inizio = sorgente.IndexOf(firma, StringComparison.Ordinal);
        Assert.True(inizio >= 0, $"«{firma}» non trovata in timone.js: il test va aggiornato");
        int fine = sorgente.IndexOf("\n    }\n", inizio, StringComparison.Ordinal);
        return sorgente.Substring(inizio, fine - inizio);
    }

    [Fact]
    public void La_finestra_ha_le_parti_del_mockup()
    {
        string disegna = Funzione(Timone(), "function disegnaGruppo(v, chiCapo)");
        //niente intestazione «GESTIONE GRUPPO (ID)»: la finestra comincia dalla fascia verde
        Assert.DoesNotContain("Gestione gruppo", disegna);
        Assert.DoesNotContain("tg_testa", Timone());
        Assert.Contains("'Gruppo di ' + g.length + ' referenze' + (capo.posizione ? ' in casella ' + capo.posizione : '')", disegna);
        Assert.Contains("is.innerHTML = ICO_MANO;", disegna);
        Assert.Contains("'Stacca una referenza per metterla in sospeso. Puoi poi trascinarla in una casella vuota.'", disegna);
        Assert.Contains("griglia.className = 'tg_refs';", disegna);
        Assert.Contains("'Referenza ' + (i + 1) + ':'", disegna);
        //staccare e' lo stesso comando di prima, col testo del mockup
        Assert.Contains("bv.dataset.stacca = x.id;", disegna);
        Assert.Contains("bv.textContent = 'SGRUPPA E SOSPENDI';", disegna);
        //in italiano e senza forbici
        Assert.DoesNotContain("UNGROUP", disegna);
        Assert.DoesNotContain("ICO_SGRUPPA +", Timone());
        Assert.Contains("inp.placeholder = 'Cerca per nome, codice, reparto o tema';", disegna);
        //il peso resta: e' quello che distingue le referenze di un gruppo
        Assert.Contains("pezzi.push('peso ' + f.peso", disegna);
        //ogni referenza del gruppo prende foto, peso e prezzo dalla scheda del SUO box, anche quando
        //il gruppo mette insieme box diversi
        Assert.Contains("var f = fotoDellaScheda(x);", disegna);
        Assert.Contains("if (x.idElemento && !schedePerBox[String(x.idElemento)]) chiediSchedaBox(x.idElemento, gruppoFraPoco);", disegna);
        Assert.Contains("if (!q || q.querySelector('.chi')) return;", Funzione(Timone(), "function gruppoFraPoco()"));

        string elenco = Funzione(Timone(), "function disegnaElencoUnisci(v, el)");
        Assert.Contains("b.dataset.unisci = x.id;", elenco);
        Assert.Contains("b.innerHTML = ICO_UNISCI + '<span>UNISCI AL GRUPPO</span>';", elenco);
        Assert.Contains("'nelle altre pagine'", elenco);
    }

    [Fact]
    public void Le_referenze_da_unire_vengono_da_tutte_le_pagine_e_dai_sospesi()
    {
        string candidati = Funzione(Timone(), "function candidatiPer(v)");
        Assert.Contains("if (x.stato === 3) return true;", candidati);
        Assert.Contains("return x.stato === 0 && !!x.posizione;", candidati);
        Assert.DoesNotContain("x.idPagina === v.idPagina && !!x.posizione", candidati);
        //fuori volantino ed eliminate no: si rimettono in pagina dal loro pannello
        Assert.DoesNotContain("x.stato === 1", candidati);
        Assert.DoesNotContain("x.stato === 2", candidati);
    }

    [Fact]
    public void La_ricerca_guarda_nome_codice_reparto_e_tema_di_tutto_il_gruppo()
    {
        string cerca = Funzione(Timone(), "function corrispondeAllaRicerca(x, testo)");
        Assert.Contains("gruppoDi(x).map(function (y) {", cerca);
        Assert.Contains("[y.codice, y.etichetta, nomeDi(y), y.reparto, y.tema]", cerca);
        Assert.Contains("parole.every(", cerca);
        Assert.Contains("normalize('NFD')", Timone());
    }

    [Fact]
    public void Unendo_da_un_altra_pagina_quella_pagina_si_ricompatta()
    {
        string unisci = Funzione(Timone(), "function unisciDavvero(v, c)");
        Assert.Contains("var paginaDiProvenienza = (c.stato === 0 && c.idPagina !== v.idPagina) ? paginaDi(c.idPagina) : null;", unisci);
        Assert.Contains("x.idPagina = v.idPagina;", unisci);
        Assert.Contains("chiudiIBuchi(paginaDiProvenienza);", unisci);
        Assert.Contains("riadattaGiu(paginaDiProvenienza);", unisci);
        //la provenienza si prende prima di spostare: dopo, c.idPagina e' gia' questa pagina
        Assert.True(unisci.IndexOf("var paginaDiProvenienza", StringComparison.Ordinal) <
                    unisci.IndexOf("x.idPagina = v.idPagina;", StringComparison.Ordinal));
    }

    [Fact]
    public void L_Escape_chiude_la_finestra_del_gruppo_e_non_il_timone()
    {
        string js = Timone();
        int gruppo = js.IndexOf("if (document.getElementById('tim_gruppo')) { chiudiGruppo(); return; }", StringComparison.Ordinal);
        int timone = js.IndexOf("if (aperto) chiudi();", StringComparison.Ordinal);
        Assert.True(gruppo > 0 && timone > gruppo);
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
