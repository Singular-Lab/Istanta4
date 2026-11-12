using System.Net;
using Istanta.Models;
using Istanta.Utility;
using IstantaLib;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1221: il Report Correggo del Plugin. Istanta fa da tramite verso Correggo4 (ClienteCorreggo4) con il
/// Bearer di Olimpo dell'operatore, e il plugin di agenzia dichiara cosa fa ogni timbro approvato
/// (correzioniCorreggo). Qui Correggo4 e' finto: niente rete, niente database.
/// </summary>
public class CorrezioniCorreggoTests
{
    private const string Indirizzo = "http://correggo4.test:8080/";
    private const string Bearer = "chiave-pubblica-di-prova";

    // ------------------------------------------------------------------ tramite verso Correggo4

    private sealed class Correggo4Finto(Func<HttpRequestMessage, HttpResponseMessage> risposta) : HttpMessageHandler
    {
        public List<(HttpRequestMessage Richiesta, string? Corpo)> Chiamate { get; } = new();

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            string? corpo = request.Content == null ? null : await request.Content.ReadAsStringAsync(cancellationToken);
            Chiamate.Add((request, corpo));
            return risposta(request);
        }
    }

    private static HttpResponseMessage Json(HttpStatusCode stato, object corpo) =>
        new(stato) { Content = new StringContent(JsonConvert.SerializeObject(corpo)) };

    private static (ClienteCorreggo4 Cliente, Correggo4Finto Finto) Cliente(Func<HttpRequestMessage, HttpResponseMessage> risposta,
                                                                            string? indirizzo = Indirizzo)
    {
        var finto = new Correggo4Finto(risposta);
        return (new ClienteCorreggo4(new HttpClient(finto), indirizzo), finto);
    }

    [Fact]
    public async Task Le_correzioni_si_chiedono_a_Correggo4_con_il_Bearer_dell_operatore()
    {
        var (cliente, finto) = Cliente(_ => Json(HttpStatusCode.OK, new
        {
            ok = true,
            dati = new { idVolantino = 7, correzioni = new[] { new { id = "nota:12", tipo = "nota" } } }
        }));

        var r = await cliente.CorrezioniAsync(3242, Bearer);

        Assert.True(r.esito, r.error);
        Assert.Equal("nota:12", r.dati!["correzioni"]![0]!["id"]!.Value<string>());
        var (richiesta, _) = Assert.Single(finto.Chiamate);
        Assert.Equal(HttpMethod.Get, richiesta.Method);
        Assert.Equal("http://correggo4.test:8080/Plugin/Correzioni/3242", richiesta.RequestUri!.ToString());
        Assert.Equal("Bearer", richiesta.Headers.Authorization!.Scheme);
        Assert.Equal(Bearer, richiesta.Headers.Authorization.Parameter);
    }

    [Fact]
    public async Task La_chiusura_manda_le_sole_approvate()
    {
        var (cliente, finto) = Cliente(_ => Json(HttpStatusCode.OK, new
        {
            ok = true,
            dati = new[] { new { id = "nota:12", ok = true }, new { id = "edit:31:offerta", ok = true } }
        }));

        var r = await cliente.ChiudiAsync(3242, new[] { "nota:12", "edit:31:offerta" }, Bearer);

        Assert.True(r.esito, r.error);
        Assert.Equal(2, ((JArray)r.dati!).Count);
        var (richiesta, corpo) = Assert.Single(finto.Chiamate);
        Assert.Equal(HttpMethod.Post, richiesta.Method);
        Assert.Equal("/Plugin/Correzioni/3242/Chiudi", richiesta.RequestUri!.AbsolutePath);
        Assert.Equal(new[] { "nota:12", "edit:31:offerta" }, JObject.Parse(corpo!)["approvate"]!.ToObject<string[]>());
    }

    [Fact]
    public async Task Un_rifiuto_di_Correggo4_arriva_al_Plugin_con_il_suo_motivo()
    {
        var (cliente, _) = Cliente(_ => Json(HttpStatusCode.NotFound, new
        {
            ok = false, codice = "volantino_non_trovato",
            messaggio = "La lavorazione 3242 non ha un volantino in Correggo4: va prima esportata per Correggo."
        }));

        var r = await cliente.CorrezioniAsync(3242, Bearer);

        Assert.False(r.esito);
        Assert.Equal("volantino_non_trovato", r.codice);
        Assert.Equal("Correggo4: La lavorazione 3242 non ha un volantino in Correggo4: va prima esportata per Correggo.", r.error);
    }

    [Fact]
    public async Task Senza_indirizzo_di_Correggo4_non_si_chiama_niente_e_lo_si_dice()
    {
        var (cliente, finto) = Cliente(_ => throw new InvalidOperationException("non doveva chiamare"), indirizzo: "  ");

        var r = await cliente.CorrezioniAsync(3242, Bearer);

        Assert.False(r.esito);
        Assert.Equal("correggo4_non_configurato", r.codice);
        Assert.Contains("fico:correggoServerUrl", r.error);
        Assert.Empty(finto.Chiamate);
    }

    [Fact]
    public async Task Correggo4_spento_o_una_risposta_che_non_e_sua_danno_un_errore_leggibile()
    {
        var (spento, _) = Cliente(_ => throw new HttpRequestException("Connection refused"));
        var (estraneo, _) = Cliente(_ => new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("<html>login</html>") });

        var r1 = await spento.CorrezioniAsync(3242, Bearer);
        var r2 = await estraneo.CorrezioniAsync(3242, Bearer);

        Assert.False(r1.esito);
        Assert.Equal("correggo4_non_risponde", r1.codice);
        Assert.Contains("Connection refused", r1.error);
        Assert.False(r2.esito);
        Assert.Equal("risposta_inattesa", r2.codice);
    }

    [Fact]
    public void Le_rotte_del_Plugin_chiedono_il_passaporto_e_usano_l_indirizzo_di_Correggo4()
    {
        var sorgente = File.ReadAllText(DllAgenziaLibTests.TrovaFile("Istanta/Controllers/FicoProcessController.cs"));
        int inizio = sorgente.IndexOf("#region I20-1221 Report Correggo del Plugin", StringComparison.Ordinal);
        int fine = sorgente.IndexOf("#endregion", inizio, StringComparison.Ordinal);
        Assert.True(inizio > 0 && fine > inizio);
        var regione = sorgente.Substring(inizio, fine - inizio);

        Assert.Contains("[Route(\"FicoProcess/correzioniCorreggo/{idLavorazione}\")]", regione);
        Assert.Contains("[Route(\"FicoProcess/correzioniCorreggo/{idLavorazione}/chiudi\")]", regione);
        Assert.Contains("FICOMiddleware.login(", regione);
        Assert.Contains("passaporto.publicKey", regione);
        Assert.Contains("ficoConf.Value.correggoServerUrl", regione);
    }

    // ------------------------------------------------------------------ configurazione del cliente

    private static AgenziaCustomPlugin ConfigurazioneDi(string nome)
    {
        string file = DllAgenziaLibTests.TrovaFile("Istanta/wwwroot/external_source/" + nome + "/" + DbCustomPlugin.dbSourceName);
        return DbCustomPlugin.Load(Path.GetDirectoryName(file)!).DB;
    }

    [Fact]
    public void Senza_la_chiave_il_Report_Correggo_e_spento()
    {
        var agenzia = JsonConvert.DeserializeObject<AgenziaCustomPlugin>("{\"nomeFotoPrimaria\":\"immagine\"}")!;

        Assert.False(agenzia.correzioniCorreggo.abilitato);
        Assert.Empty(agenzia.correzioniCorreggo.timbri);
    }

    [Fact]
    public void La_chiave_si_legge_e_sopravvive_al_salvataggio()
    {
        var agenzia = JsonConvert.DeserializeObject<AgenziaCustomPlugin>(
            "{\"correzioniCorreggo\":{\"abilitato\":true,\"timbri\":[{\"simbolo\":\"_4_2_alkg\",\"idAzione\":3,\"valori\":{\"force_infopack\":\"al kg\"}}]}}");
        var riletto = JsonConvert.DeserializeObject<AgenziaCustomPlugin>(JsonConvert.SerializeObject(agenzia))!;

        Assert.True(riletto.correzioniCorreggo.abilitato);
        var timbro = Assert.Single(riletto.correzioniCorreggo.timbri);
        Assert.Equal("_4_2_alkg", timbro.simbolo);
        Assert.Equal(3, timbro.idAzione);
        Assert.Equal("al kg", timbro.valori["force_infopack"]);
        Assert.False(timbro.eliminaRef);
    }

    [Theory]
    [InlineData("_4_1_aconf", "a conf.")]
    [InlineData("_4_2_alkg", "al kg")]
    [InlineData("_4_3_cad", "cad.")]
    [InlineData("_4_4_pz", "al pz.")]
    public void Coop_porta_i_timbri_del_prezzo_sull_azione_del_prezzo_info_pack(string simbolo, string dicitura)
    {
        var coop = ConfigurazioneDi("Coopfi");
        var timbro = coop.correzioniCorreggo.timbri.Single(t => t.simbolo == simbolo);
        var azione = coop.cambiStrutturali.Single(a => a.Id == timbro.idAzione);

        Assert.True(coop.correzioniCorreggo.abilitato);
        Assert.Equal("Cambia prezzo info pack", azione.Titolo);
        Assert.Equal(dicitura, timbro.valori["force_infopack"]);
        //Il valore lo scrive l'operatore: il timbro lo mette al suo posto.
        Assert.Contains(azione.Istruzioni, i => i.Field == "force_infopack" && i.Valore == null);
        Assert.False(timbro.eliminaRef);
    }

    [Fact]
    public void Coop_porta_Fuori_volantino_sull_azione_Metti_fuori_volantino_e_Elimina_sull_eliminazione()
    {
        var coop = ConfigurazioneDi("Coopfi");
        var fvol = coop.correzioniCorreggo.timbri.Single(t => t.simbolo == "_1_1_fvol");
        var elimina = coop.correzioniCorreggo.timbri.Single(t => t.simbolo == "_1_2_elimina");

        Assert.Equal("Metti fuori volantino", coop.cambiStrutturali.Single(a => a.Id == fvol.idAzione).Titolo);
        Assert.False(fvol.eliminaRef);
        Assert.True(elimina.eliminaRef);
        Assert.Equal(0, elimina.idAzione);
        //Gli altri timbri (Star, Gruppo, Cambia foto...) non hanno regola: si decidono a mano.
        Assert.Equal(6, coop.correzioniCorreggo.timbri.Count);
    }

    [Fact]
    public void Edro21_non_ha_il_Report_Correggo()
    {
        Assert.False(ConfigurazioneDi("Edro21").correzioniCorreggo.abilitato);
    }
}
