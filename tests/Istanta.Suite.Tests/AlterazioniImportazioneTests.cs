using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Istanta.Models;
using Istanta.Utility;
using IstantaLib;
using Newtonsoft.Json;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// Una referenza reimportata: nel dato la versione della lista appena importata, fra le alterazioni solo i
/// campi del tracciato (la versione cambia a ogni reimportazione e non e' un cambio della referenza), e nel
/// registro un "Aggiornamento da importazione" con i campi cambiati, distinto dal "Cambio strutturale" delle
/// azioni sul box.
/// </summary>
public class AlterazioniImportazioneTests
{
    private static string Sorgente(string relativo) =>
        File.ReadAllText(DllAgenziaLibTests.TrovaFile(relativo)).Replace("\r", "");

    /* ---- le alterazioni ---- */

    [Fact]
    public void La_sola_versione_del_tracciato_cambiata_non_e_un_alterazione()
    {
        var alterazioni = new Dictionary<string, object> { [GLOBAL_VARIABLES_FICO.keyVersioneTracciato] = (byte)2 };

        Assert.Empty(AlterazioniImportazione.SoloCampiDelTracciato(alterazioni));
    }

    [Fact]
    public void Un_prezzo_cambiato_resta_l_unica_alterazione()
    {
        var alterazioni = new Dictionary<string, object>
        {
            [GLOBAL_VARIABLES_FICO.keyVersioneTracciato] = (byte)2,
            ["prezzo_promo"] = "1,99",
        };

        var risultato = AlterazioniImportazione.SoloCampiDelTracciato(alterazioni);

        Assert.Equal(new[] { "prezzo_promo" }, risultato.Keys.ToArray());
        Assert.Equal("1,99", risultato["prezzo_promo"]);
    }

    /* ---- il registro ---- */

    [Fact]
    public void L_aggiornamento_da_importazione_porta_i_campi_cambiati_e_il_valore_di_prima()
    {
        var alterazioni = new Dictionary<string, object> { ["prezzo_promo"] = "1,99", ["tema"] = "SPRINT" };

        var operazione = AlterazioniImportazione.OperazioneDiRegistro(12, "3191029", "3191029,3191030", alterazioni)!;

        Assert.Equal((byte)tipoOperazione.aggiornamentoDaImportazione, operazione.TipoOperazione);
        Assert.NotEqual((byte)tipoOperazione.cambioMeta, operazione.TipoOperazione);
        Assert.Equal(12, operazione.IdTracciato);
        Assert.Equal("3191029,3191030", operazione.CodiceAssociato);

        //Lo stesso formato che il Propagatore legge per i cambi della lista.
        var azioni = JsonConvert.DeserializeObject<List<CambioMetaRecordTracciatoAzione>>(operazione.FormData!)!;
        var azione = Assert.Single(azioni);
        Assert.Equal("3191029", azione.codice);
        Assert.Equal("1,99", azione.attributi["prezzo_promo"]);
        Assert.Equal("SPRINT", azione.attributi["tema"]);
    }

    [Fact]
    public void Senza_cambi_non_c_e_operazione_di_registro()
    {
        Assert.Null(AlterazioniImportazione.OperazioneDiRegistro(12, "3191029", "3191029", new Dictionary<string, object>()));
    }

    [Fact]
    public void Il_nuovo_tipo_non_cambia_il_valore_degli_altri()
    {
        //Il tipo si salva come numero nel registro: i valori gia' scritti devono restare quelli.
        Assert.Equal(10, (int)tipoOperazione.cambioMeta);
        Assert.Equal(16, (int)tipoOperazione.updateTestiDalBox);
        Assert.Equal(17, (int)tipoOperazione.aggiornamentoDaImportazione);
    }

    /* ---- chi le usa ---- */

    [Fact]
    public void L_importazione_scrive_la_versione_nuova_e_registra_l_aggiornamento_da_importazione()
    {
        var operazioni = Sorgente("Istanta/Controllers/OperationsController.cs");

        //Nella reimportazione: alla nascita del record _rec.Versione e' gia' quella nuova.
        Assert.Contains("item[GLOBAL_VARIABLES_FICO.keyVersioneTracciato] = versioneLab;", operazioni);
        Assert.Contains("alterazioni = AlterazioniImportazione.SoloCampiDelTracciato(alterazioni);", operazioni);
        Assert.Contains("RegistroOperazioni? regOp = AlterazioniImportazione.OperazioneDiRegistro(_rec.IdTracciato, _rec.Codice, _rec.CodiceGruppo, alterazioni);", operazioni);
        Assert.DoesNotContain("regOp.TipoOperazione = (byte)tipoOperazione.cambioMeta;", operazioni);

        //Le alterazioni si filtrano prima del registro e prima di finire nel dato e nel report.
        int filtro = operazioni.IndexOf("alterazioni = AlterazioniImportazione.SoloCampiDelTracciato(alterazioni);", StringComparison.Ordinal);
        Assert.True(filtro < operazioni.IndexOf("AlterazioniImportazione.OperazioneDiRegistro(", StringComparison.Ordinal));
        Assert.True(filtro < operazioni.IndexOf("item[GLOBAL_VARIABLES.keyAlterazioni] = alterazioni;", StringComparison.Ordinal));
    }

    [Fact]
    public void Il_propagatore_tratta_l_aggiornamento_da_importazione_come_i_cambi_della_lista()
    {
        var propagatore = Sorgente("Istanta/Utility/Propagatore.cs");

        Assert.Contains("azione.TipoOperazione == (Byte)tipoOperazione.cambioMeta ||\n                            azione.TipoOperazione == (Byte)tipoOperazione.aggiornamentoDaImportazione ||", propagatore);
        Assert.Contains("if (azione.TipoOperazione == (Byte)tipoOperazione.cambioMeta ||\n                                azione.TipoOperazione == (Byte)tipoOperazione.aggiornamentoDaImportazione)", propagatore);
    }

    [Fact]
    public void Il_registro_la_chiama_aggiornamento_da_importazione()
    {
        var registro = Sorgente("Istanta/Controllers/RegisterController.cs");

        Assert.Contains("case \"aggiornamentoDaImportazione\":\n                        return \"Aggiornamento da importazione\";", registro);
        Assert.Contains("case \"cambioMeta\":\n                        return \"Cambio strutturale\";", registro);
    }
}
