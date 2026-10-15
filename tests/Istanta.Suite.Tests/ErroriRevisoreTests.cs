using Istanta.Controllers;
using Istanta.Utility;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1069, gruppo 3: il revisore dice dove e perche' si e' fermato.
///
/// Prima getListaRevisione2, con un errore, restituiva la lista parziale e l'intera traccia; salva, dopo
/// un errore, continuava e salvava le revisioni successive (con loro anche le modifiche lasciate a meta'
/// dalla revisione fallita) e diceva solo l'ultimo errore; e un metodo di AgenziaLib mancante faceva
/// restituire "" a execLibFunction, che i chiamanti trasformavano in "Value cannot be null" o in
/// "elemento non trovato durante l'estrazione del garante".
///
/// Le parti nuove si chiamano direttamente; i controller vogliono il database e la dll del cliente, che
/// i test non usano: per loro si controlla il sorgente, come in ErroriIstantaTests.
/// </summary>
public class ErroriRevisoreTests
{
    /* ---- i testi ---- */

    [Fact]
    public void Il_salvataggio_interrotto_dice_per_primo_quante_revisioni_sono_salvate_e_dove_si_e_fermato()
    {
        var errore = new ErroreIstanta("estrazione del garante", "la libreria del cliente non ha restituito il garante della ref 6322946.");

        string testo = RevisoreController.TestoSalvataggioInterrotto(1, 3, "6322946", errore);

        Assert.Equal("Salvate 1 revisioni su 3, ferma su 6322946. salva, estrazione del garante: la libreria del cliente non ha restituito il garante della ref 6322946.", testo);
    }

    [Fact]
    public void Il_metodo_mancante_in_AgenziaLib_dice_quale_di_quale_cliente_e_cosa_fare()
    {
        string testo = IstantaController.ErroreDiMetodoMancante("specificaInOutVol", "Trea");

        Assert.Contains("il metodo specificaInOutVol non c'e' in AgenziaLib.dll per il cliente Trea", testo);
        Assert.Contains("ricompilata e ricopiata", testo);
    }

    /* ---- la libreria del cliente ---- */

    [Fact]
    public void Una_chiamata_richiesta_ad_AgenziaLib_lancia_se_il_metodo_manca_e_le_altre_restano_come_prima()
    {
        string sorgente = Sorgente("Istanta/Controllers/IstantaController.cs");

        Assert.Contains("return execLibFunction(algoritmo, dataset, true);", Tratto(sorgente, "public object execLibFunctionRichiesta(", "public object execLibFunction("));
        Assert.Contains("return execLibFunction(algoritmo, dataset, false);", Tratto(sorgente, "public object execLibFunction(string algoritmo, Dictionary<string,object> dataset)", "private object execLibFunction("));

        string esecuzione = Tratto(sorgente, "private object execLibFunction(", "public static string ErroreDiMetodoMancante(");
        int richiesto = esecuzione.IndexOf("if (mth == null && richiesto)", StringComparison.Ordinal);
        int storico = esecuzione.IndexOf("return \"\";", StringComparison.Ordinal);
        Assert.True(richiesto > 0 && storico > richiesto, "il metodo richiesto lancia prima del ritorno storico di stringa vuota");
        Assert.Contains("throw new ErroreIstanta(\"libreria del cliente\", ErroreDiMetodoMancante(_dllMth, _dllTipo));", esecuzione);
        Assert.Contains("if (!dataset.TryGetValue(pi.Name, out object? valore))", esecuzione);
        Assert.DoesNotContain("dataset[pi.Name]", esecuzione);
    }

    [Fact]
    public void Ordinamento_e_selezione_automatica_vogliono_i_loro_metodi_e_dicono_il_motivo()
    {
        string utility = Sorgente("Istanta/Utility/Utility.cs");

        Assert.Contains("icCtrl.execLibFunctionRichiesta($\"AgenziaLib.{nomeCliente}.ordinaLista\", _pass)", utility);
        //Le tre chiamate attive della selezione automatica (una quarta e' commentata).
        Assert.Equal(3, Conta(utility, "icCtrl.execLibFunctionRichiesta(funcAutoSelezione, _pass)"));
        Assert.Equal(0, Conta(utility, "\n                List<List<Dictionary<string, object>>> resultExtDict = icCtrl.execLibFunction(funcAutoSelezione"));
        Assert.Equal(2, Conta(utility, "result.error = DescrizioneErrori.Motivo(er);"));
        Assert.Equal(2, Conta(utility, "result.dettaglio = DescrizioneErrori.Dettaglio(er);"));
        Assert.DoesNotContain("result.error = er.Message;", utility);
    }

    /* ---- la lista del revisore ---- */

    [Fact]
    public void La_lista_del_revisore_con_un_errore_e_vuota_con_il_motivo_breve_e_la_traccia_a_parte()
    {
        string metodo = Tratto(Sorgente(Revisore), "public async Task<IActionResult> getListaRevisione2(", "public List<RevisioneRegionale> convertiDaArticoliDescrizioniARevisioneRegionale(");

        int catchDelMetodo = metodo.LastIndexOf("catch (Exception ex)", StringComparison.Ordinal);
        string catchFinale = metodo.Substring(catchDelMetodo);
        Assert.Contains("result.Data = new List<ArticoloInRevisione>();", catchFinale);
        Assert.Contains("result.Error = DescrizioneErrori.Breve(\"getListaRevisione2\", ex);", catchFinale);
        Assert.Contains("result.Dettaglio = dettaglioInterno ?? DescrizioneErrori.Dettaglio(ex);", catchFinale);
        Assert.DoesNotContain("result.Error = ex.ToString();", metodo);

        Assert.Contains("throw new ErroreIstanta(\"lettura della promo\", $\"la promo {idPromo} non esiste.\");", metodo);
        Assert.DoesNotContain("imp!.PromoTracciatis", metodo);
        Assert.Contains("RecordTracciato.Richiesto(s.Dato, key_codice_ref, \"lettura del tracciato\", $\"il record {s.Id}\")", metodo);
        Assert.Contains("throw new ErroreIstanta(\"selezione automatica di primarie e secondarie\", selezioneResult.error);", metodo);
        Assert.Contains("icItem.execLibFunctionRichiesta($\"AgenziaLib.{this._fico_conf.Value.nomeCliente}.specificaInOutVol\", objParams)", metodo);
        //Il garante in blocco resta facoltativo: Trea non ce l'ha.
        Assert.Contains("icCtrl.execLibFunction(\n                        $\"AgenziaLib.{this._fico_conf.Value.nomeCliente}.GetMetaPerRevisioneDaGruppiMultipliBatch\"", metodo);
    }

    /* ---- il salvataggio del revisore ---- */

    [Fact]
    public void Il_salvataggio_si_ferma_al_primo_errore_scarta_le_modifiche_a_meta_e_dice_quante_sono_salvate()
    {
        string metodo = Tratto(Sorgente(Revisore), "public async Task<IActionResult> salva(", "public static string TestoSalvataggioInterrotto(");

        int ciclo = metodo.IndexOf("foreach (RevisioneAction act in acts.coda)", StringComparison.Ordinal);
        int catchDelCiclo = metodo.IndexOf("catch (Exception ex)", ciclo, StringComparison.Ordinal);
        string catchCorpo = Tratto(metodo.Substring(catchDelCiclo), "catch (Exception ex)", "if (erroreDuranteIlSalvataggio != null)");
        Assert.Contains("this.ctx.ChangeTracker.Clear();", catchCorpo);
        Assert.Contains("this.ctx2.ChangeTracker.Clear();", catchCorpo);
        Assert.Contains("break;", catchCorpo);
        Assert.Contains("fermaSu = !string.IsNullOrEmpty(act.Codice) ? act.Codice : act.CodiceGruppo;", catchCorpo);
        Assert.DoesNotContain("result.error = ex.ToString();", catchCorpo);

        //Una revisione si conta salvata dopo il suo SaveChanges, nei due rami (ref e gruppo).
        Assert.Equal(2, Conta(metodo, "this.ctx.SaveChanges();\n                        revisioniSalvate++;"));
        Assert.Contains("error = TestoSalvataggioInterrotto(revisioniSalvate, acts.coda.Count, fermaSu, erroreDuranteIlSalvataggio),", metodo);
        Assert.Contains("dettaglio = DescrizioneErrori.Dettaglio(erroreDuranteIlSalvataggio),", metodo);

        //La promo che manca passa dal catch, con il conteggio, invece di uscire con un 200.
        Assert.Contains("throw new ErroreIstanta(\"lettura della promo\", $\"la promo {acts.idPromo} non esiste.\");", metodo);
        Assert.DoesNotContain("Nessuna promo con trovata", metodo);

        Assert.Contains("if (register.Errore != null)\n                            throw new ErroreIstanta(\"registrazione della revisione\", register.Errore);", metodo);
        Assert.DoesNotContain("int.Parse(session)", metodo);
        Assert.Contains("result.error = ErroreIstanta.SessioneScaduta().Message;", metodo);
    }

    [Fact]
    public void Il_garante_che_manca_in_AgenziaLib_non_si_spaccia_piu_per_elemento_non_trovato()
    {
        string metodo = Tratto(Sorgente(Revisore), "public async Task<IActionResult> salva(", "public static string TestoSalvataggioInterrotto(");

        Assert.Equal(2, Conta(metodo, "icCtrl.execLibFunctionRichiesta(\n                                $\"AgenziaLib.{this._fico_conf.Value.nomeCliente}.GetMetaPerRevisioneDaGruppiMultipli\","));
        Assert.DoesNotContain("non trovato durante l'estrazione del garante", metodo);
        Assert.Contains("throw new ErroreIstanta(\"estrazione del garante\", $\"la libreria del cliente non ha restituito il garante della ref {act.Codice}.\");", metodo);
        Assert.Contains("throw new ErroreIstanta(\"estrazione del garante\", $\"la libreria del cliente non ha restituito il garante del gruppo {act.CodiceGruppo}.\");", metodo);
    }

    /* ---- strumenti ---- */

    private const string Revisore = "Istanta/Controllers/RevisoreController.cs";

    private static int Conta(string testo, string cercato)
    {
        int volte = 0;
        for (int i = testo.IndexOf(cercato, StringComparison.Ordinal); i >= 0; i = testo.IndexOf(cercato, i + cercato.Length, StringComparison.Ordinal))
        {
            volte++;
        }
        return volte;
    }

    /// Il testo fra inizio e fine, senza le righe commentate: i controller tengono anche il codice
    /// vecchio, commentato, e i commenti di I20-1069 citano quello che e' stato tolto.
    private static string Tratto(string sorgente, string inizio, string fine)
    {
        int da = sorgente.IndexOf(inizio, StringComparison.Ordinal);
        Assert.True(da >= 0, "manca " + inizio);
        int a = sorgente.IndexOf(fine, da + inizio.Length, StringComparison.Ordinal);
        Assert.True(a > da, "manca " + fine + " dopo " + inizio);
        string corpo = sorgente.Substring(da, a - da);
        return string.Join("\n", corpo.Split('\n').Where(riga => !riga.TrimStart().StartsWith("//")));
    }

    private static string Sorgente(string relativo)
    {
        var cartella = new DirectoryInfo(AppContext.BaseDirectory);
        while (cartella != null)
        {
            var candidato = Path.Combine(cartella.FullName, relativo.Replace('/', Path.DirectorySeparatorChar));
            if (File.Exists(candidato))
            {
                return File.ReadAllText(candidato).Replace("\r", "");
            }
            cartella = cartella.Parent;
        }

        throw new FileNotFoundException($"Sorgente non trovata risalendo da {AppContext.BaseDirectory}: {relativo}");
    }
}
