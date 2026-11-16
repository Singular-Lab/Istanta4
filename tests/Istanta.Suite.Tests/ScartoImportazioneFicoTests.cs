using System;
using System.IO;
using System.Linq;
using Istanta.Models;
using Istanta.Utility;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// Fidelity scarta l'importazione di un tracciato prima che il Superadmin lo elimini (spec
/// ciclo-promozione-importazione, "Eliminazione di un tracciato non importato"). Si scarta solo
/// un'importazione che non ha salvato niente: in attesa di conferma o soltanto esaminata.
/// </summary>
public class ScartoImportazioneFicoTests
{
    [Theory]
    [InlineData(OperationStauts.InAttesaDiConfermaUtente)]
    [InlineData(OperationStauts.Esaminata)]
    public void Si_scarta_un_importazione_in_attesa_di_conferma_o_soltanto_esaminata(OperationStauts stato)
    {
        Assert.True(ScartoImportazioneFico.Scartabile((byte)stato));
    }

    [Theory]
    [InlineData(OperationStauts.InAttesaDiAssegnazione)]
    [InlineData(OperationStauts.InCoda)]
    [InlineData(OperationStauts.ElaborazioneDati)]
    [InlineData(OperationStauts.AttesaI_O)]
    [InlineData(OperationStauts.I_O)]
    [InlineData(OperationStauts.Cancellata)]
    [InlineData(OperationStauts.Terminata)]
    [InlineData(OperationStauts.TerminataConErrori)]
    [InlineData(OperationStauts.Scartata)]
    public void Non_si_scarta_un_importazione_avviata_terminata_o_gia_scartata(OperationStauts stato)
    {
        Assert.False(ScartoImportazioneFico.Scartabile((byte)stato));
    }

    [Fact]
    public void Ogni_stato_e_deciso()
    {
        // Uno stato nuovo dell'attivita' va deciso qui: scartabile oppure no
        var decisi = new[]
        {
            OperationStauts.InAttesaDiConfermaUtente, OperationStauts.Esaminata,
            OperationStauts.InAttesaDiAssegnazione, OperationStauts.InCoda, OperationStauts.ElaborazioneDati,
            OperationStauts.AttesaI_O, OperationStauts.I_O, OperationStauts.Cancellata, OperationStauts.Terminata,
            OperationStauts.TerminataConErrori, OperationStauts.Scartata,
        };
        Assert.Equal(Enum.GetValues<OperationStauts>().OrderBy(s => s), decisi.OrderBy(s => s));
    }

    [Fact]
    public void L_esito_dice_scartata_solo_per_lo_stato_scartata()
    {
        Assert.True(ScartoImportazioneFico.Scartata((byte)OperationStauts.Scartata));
        Assert.False(ScartoImportazioneFico.Scartata((byte)OperationStauts.InAttesaDiConfermaUtente));
        Assert.False(ScartoImportazioneFico.Scartata((byte)OperationStauts.InCoda));
    }

    [Fact]
    public void L_endpoint_scarta_con_un_solo_update_condizionato_sugli_stati_scartabili()
    {
        string sorgente = File.ReadAllText(DllAgenziaLibTests.TrovaFile("Istanta/Controllers/FicoProcessController.cs")).Replace("\r", "");
        int inizio = sorgente.IndexOf("[Route(\"FicoProcess/scartaImportazione/{guidID}\")]", StringComparison.Ordinal);
        Assert.True(inizio >= 0, "manca la rotta FicoProcess/scartaImportazione/{guidID}");
        int fine = sorgente.IndexOf("#endregion", inizio, StringComparison.Ordinal);
        string metodo = sorgente.Substring(inizio, fine - inizio);

        Assert.Contains("[HttpPost]", sorgente.Substring(Math.Max(0, inizio - 40), 40));
        Assert.Contains("getAccesslevel()", metodo);
        Assert.Contains("ScartoImportazioneFico.StatiScartabili", metodo);
        Assert.Contains("scartabili.Contains(a.Stato)", metodo);
        Assert.Contains("ExecuteUpdateAsync", metodo);
        Assert.Contains("ScartoImportazioneFico.Scartata(stato)", metodo);
    }
}
