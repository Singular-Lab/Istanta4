using Istanta.Controllers;
using Istanta.Models;
using IstantaLib;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// TASK-10858197: il report della scansione del sync foto ha una colonna "Dopo il sync" con l'esito che
/// il sync avra' su ogni foto, con le scelte correnti della pagina. Lo calcola EsitiDopoSync con la stessa
/// regola di ConsolidaSelezione (FotoCheDevonoPrevalere). E una scansione morta senza risultato non lascia
/// piu' la pagina in attesa: il registro delle scansioni non riuscite da' il messaggio.
/// </summary>
public class SyncFotoReportTests
{
    private static FotoInAnteprima Foto(string nome, StatoSyncFile stato, bool sincronizza, long id = 0, long idArticolo = 1633, TipoFoto tipo = TipoFoto.Foto) =>
        new FotoInAnteprima { filename = nome, stato = stato, sincronizza = sincronizza, id = id, idArticolo = idArticolo, tipo = tipo };

    private static List<string> Esiti(params FotoInAnteprima[] foto) =>
        SyncFotoController.EsitiDopoSync(foto, new[] { ".psd" });

    [Fact]
    public void Pacchetto_risincronizzato_con_sovrascrittura()
    {
        //Il caso del collaudo di I20-1212: png in uscita, jpeg e psd non piu' selezionati, tutti nel pacchetto.
        var esiti = Esiti(
            Foto("1001297_1_AD.jpeg", StatoSyncFile.AlreadyExistButNotSelected, true, id: 6),
            Foto("1001297_1_T5.png", StatoSyncFile.AlreadyExist, false, id: 7),
            Foto("1001297_1_T5.psd", StatoSyncFile.AlreadyExistButNotSelected, true, id: 8));

        Assert.Equal(new[] { "Non selezionata", "Non più selezionata", "Diverrà selezionata" }, esiti);
    }

    [Fact]
    public void Lo_stesso_pacchetto_senza_sovrascrittura_non_cambia_niente()
    {
        var esiti = Esiti(
            Foto("1001297_1_AD.jpeg", StatoSyncFile.AlreadyExistButNotSelected, false, id: 6),
            Foto("1001297_1_T5.png", StatoSyncFile.AlreadyExist, false, id: 7),
            Foto("1001297_1_T5.psd", StatoSyncFile.AlreadyExistButNotSelected, false, id: 8));

        Assert.Equal(new[] { "Nessuna modifica", "Nessuna modifica", "Nessuna modifica" }, esiti);
    }

    [Fact]
    public void Psd_gia_selezionato_e_jpg_nuovo()
    {
        var esiti = Esiti(
            Foto("6149843_1_T5.psd", StatoSyncFile.AlreadyExist, false, id: 8),
            Foto("6149843_1_T5.jpg", StatoSyncFile.SyncableAsNew, true));

        Assert.Equal(new[] { "Resta selezionata", "Nuova, non selezionata" }, esiti);
    }

    [Fact]
    public void Psd_nuovo_che_prende_il_posto_del_jpg_selezionato()
    {
        var esiti = Esiti(
            Foto("6149843_1_T5.jpg", StatoSyncFile.AlreadyExist, false, id: 3),
            Foto("6149843_1_T5.psd", StatoSyncFile.SyncableAsNew, true));

        Assert.Equal(new[] { "Non più selezionata", "Diverrà selezionata" }, esiti);
    }

    [Fact]
    public void Una_riga_deselezionata_non_si_sincronizza_e_non_conta()
    {
        //L'operatore toglie la spunta al psd nuovo: resta il jpg aggiornato, che diventa la foto in uscita.
        var esiti = Esiti(
            Foto("6149843_1_T5.jpg", StatoSyncFile.SyncableAsOverwrite, true, id: 3),
            Foto("6149843_1_T5.psd", StatoSyncFile.SyncableAsNew, false));

        Assert.Equal(new[] { "Diverrà selezionata", "Non sincronizzata" }, esiti);
    }

    [Fact]
    public void Una_foto_cambiata_che_non_prevale_e_aggiornata_ma_non_selezionata()
    {
        var esiti = Esiti(
            Foto("6149843_1_T5.jpg", StatoSyncFile.SyncableAsOverwrite, true, id: 3),
            Foto("6149843_1_T5.psd", StatoSyncFile.AlreadyExist, false, id: 8));

        Assert.Equal(new[] { "Aggiornata, non selezionata", "Resta selezionata" }, esiti);
    }

    [Fact]
    public void Foto_senza_articolo_e_loghi()
    {
        var esiti = Esiti(
            Foto("sconosciuta.jpg", StatoSyncFile.NoMatch, false, idArticolo: 0),
            Foto("fuori.jpg", StatoSyncFile.NotInTracciato, false, idArticolo: 77),
            Foto("1633_logo.ai", StatoSyncFile.SyncableAsNew, true, tipo: TipoFoto.Logo),
            Foto("1633_1.psd", StatoSyncFile.AlreadyExist, false, id: 8));

        //Il logo si registra ma non e' una foto in uscita; il psd resta com'e', perche' nessuna foto
        //prodotto dell'articolo si registra.
        Assert.Equal(new[] { "Non sincronizzata", "Non sincronizzata", "Nuova, non selezionata", "Nessuna modifica" }, esiti);
    }

    [Fact]
    public void L_anteprima_segue_la_regola_del_sync_anche_con_due_jpg()
    {
        //Senza post prodotte prevale l'ultima dello zip.
        var esiti = Esiti(
            Foto("6149843_2_T5.jpg", StatoSyncFile.SyncableAsNew, true),
            Foto("6149843_1_T5.jpg", StatoSyncFile.SyncableAsNew, true));

        Assert.Equal(new[] { "Nuova, non selezionata", "Diverrà selezionata" }, esiti);
    }

    [Fact]
    public void Elenco_vuoto()
    {
        Assert.Empty(SyncFotoController.EsitiDopoSync(new List<FotoInAnteprima>(), new[] { ".psd" }));
    }

    [Fact]
    public void Una_scansione_non_riuscita_resta_nel_registro_con_il_suo_messaggio()
    {
        string guid = Guid.NewGuid().ToString();

        Assert.Null(SyncFotoController.ScansioneNonRiuscita(guid));
        SyncFotoController.RegistraScansioneNonRiuscita(guid, "Non è stato possibile salvare il risultato della scansione");

        Assert.Equal("Non è stato possibile salvare il risultato della scansione", SyncFotoController.ScansioneNonRiuscita(guid));
        Assert.Null(SyncFotoController.ScansioneNonRiuscita(Guid.NewGuid().ToString()));
    }

    [Fact]
    public void Prima_del_sync_una_foto_che_non_e_in_uscita_e_non_selezionata_non_non_piu_selezionata()
    {
        //"Non piu' selezionata" diceva di una foto che forse non era mai stata in uscita; ora che c'e' la colonna
        //"Dopo il sync" resta solo li', dove e' vero. Nei testi della scansione: "non selezionata".
        string sorgente = File.ReadAllText(DllAgenziaLibTests.TrovaFile("Istanta/Controllers/SyncFotoController.cs"));
        int inizio = sorgente.IndexOf("private async Task ScanPacchettoFoto_do(");
        int fine = sorgente.IndexOf("public async Task<IActionResult> ScanPacchettoFotoCheck(");
        string scansione = sorgente.Substring(inizio, fine - inizio);

        Assert.DoesNotContain("non più selezionat", scansione);
        Assert.Contains("file.details = $\"Foto {file.filename} non selezionata. Articolo: \" + artArchivio.Codice;", scansione);
        Assert.Contains("non ancora post prodotta) {file.filename} non selezionata.", scansione);
    }
    /// <summary>
    /// TASK-c0dd1af9: l'elenco della scansione arriva in JSON, come lo manda syncfoto.js (campiDellaFoto). Come
    /// form, oltre le 1024 foto il binder delle liste falliva prima dell'azione: colonna "Dopo il sync" vuota e
    /// foto in uscita non scelta. In JSON arriva intero, e la regola vale anche in fondo al pacchetto.
    /// </summary>
    private static string PacchettoInJson(int quante, bool sincronizza)
    {
        var foto = new List<object>();
        for (int i = 0; i < quante; i++)
        {
            foto.Add(new { filename = $"{7000000 + i}_1_T1.psd", stato = sincronizza ? 6 : 1, id = sincronizza ? 0 : 100 + i, idArticolo = 15000 + i, tipo = 1, sincronizza });
        }
        //L'ultimo articolo ha anche un jpg, dopo il psd: deve prevalere il psd.
        int ultimo = 15000 + quante - 1;
        foto.Add(new { filename = $"{7000000 + quante - 1}_1_T1.jpg", stato = sincronizza ? 6 : 1, id = sincronizza ? 0 : 100 + quante, idArticolo = ultimo, tipo = 1, sincronizza });
        return Newtonsoft.Json.JsonConvert.SerializeObject(new { files = foto });
    }

    [Fact]
    public void Un_pacchetto_di_1500_foto_in_JSON_arriva_intero_al_consolidamento()
    {
        var op = Newtonsoft.Json.JsonConvert.DeserializeObject<SyncFileOperation>(PacchettoInJson(1500, false))!;

        Assert.Equal(1501, op.files!.Count);
        var prevalenti = SyncFotoController.FotoCheDevonoPrevalere(op.files, new[] { ".psd" });
        Assert.Equal(1500, prevalenti.Count);
        Assert.Equal("7001499_1_T1.psd", prevalenti.Single(p => p.idArticolo == 16499).filename);
    }

    [Fact]
    public void Un_pacchetto_di_1500_foto_nuove_in_JSON_ha_un_esito_per_ogni_foto()
    {
        var req = Newtonsoft.Json.JsonConvert.DeserializeObject<AnteprimaSyncRequest>(PacchettoInJson(1500, true))!;

        var esiti = SyncFotoController.EsitiDopoSync(req.files!, new[] { ".psd" });

        Assert.Equal(1501, esiti.Count);
        Assert.All(esiti.Take(1500), e => Assert.Equal("Diverrà selezionata", e));
        Assert.Equal("Nuova, non selezionata", esiti[1500]);
    }

    [Fact]
    public void Anteprima_e_consolidamento_leggono_l_elenco_dal_corpo_JSON()
    {
        string sorgente = File.ReadAllText(DllAgenziaLibTests.TrovaFile("Istanta/Controllers/SyncFotoController.cs"));

        Assert.Contains("public IActionResult AnteprimaSync([FromBody] AnteprimaSyncRequest req)", sorgente);
        Assert.Contains("public async Task<IActionResult> ConsolidaSelezione([FromBody] SyncFileOperation op)", sorgente);
    }
}
