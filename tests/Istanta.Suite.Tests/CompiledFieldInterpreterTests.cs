using AgenziaLib;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-990: l'interprete dei campi compilati marcava soltanto i campi cancellati, lasciandoli
/// in lista, e li filtrava alla lettura con getFields(). La produzione chiama finalizeFields()
/// prima di leggere, in esportaVolantino e in esportaPoP, cosi' la cancellazione diventa
/// effettiva e chi guarda la lista dopo non ritrova i campi tolti. Qui si fissa quel
/// comportamento, insieme alle due interrogazioni che decidono se togliere prezzo_offerta.
/// </summary>
public class CompiledFieldInterpreterTests
{
    private static CompiledFieldInterpreter ConDueCampi()
    {
        var interprete = new CompiledFieldInterpreter();
        interprete.assignCompiledField("prezzo_offerta", "stile_prezzo", "1,99");
        interprete.assignCompiledField("descrizione", "stile_desc", "Pasta 500g");
        return interprete;
    }

    [Fact]
    public void Dopo_finalizeFields_il_campo_cancellato_sparisce_davvero_dalla_lista()
    {
        var interprete = ConDueCampi();
        interprete.removeCompiledField("prezzo_offerta");

        // Prima: il campo e' solo marcato, resta nella lista interna.
        Assert.True(interprete.compiledContainsKey("prezzo_offerta"));

        interprete.finalizeFields();

        Assert.False(interprete.compiledContainsKey("prezzo_offerta"));
        Assert.True(interprete.compiledContainsKey("descrizione"));
    }

    [Fact]
    public void finalizeFields_non_tocca_i_campi_non_cancellati()
    {
        // Caso limite: senza cancellazioni la chiamata deve essere ininfluente, perche' in
        // esportaVolantino viene eseguita sempre, anche quando non c'e' nulla da togliere.
        var interprete = ConDueCampi();

        interprete.finalizeFields();

        var campi = interprete.getFields().compiledFields;
        Assert.Equal(2, campi.Count);
        Assert.Equal("1,99", interprete.getFieldsValue("prezzo_offerta").content);
    }

    [Fact]
    public void compiledContainsKey_distingue_il_campo_assegnato_da_uno_mai_visto()
    {
        var interprete = ConDueCampi();

        Assert.True(interprete.compiledContainsKey("descrizione"));
        Assert.False(interprete.compiledContainsKey("prezzo_offerta_EURprima"));
    }

    [Fact]
    public void deletedContainsKey_riconosce_solo_i_campi_marcati_cancellati()
    {
        // E' la coppia di controlli con cui esportaVolantino decide se togliere prezzo_offerta:
        // il campo EURprima dev'essere presente e non gia' cancellato.
        var interprete = ConDueCampi();
        interprete.assignCompiledField("prezzo_offerta_EURprima", "stile_prezzo", "2,49");

        Assert.False(interprete.deletedContainsKey("prezzo_offerta_EURprima"));

        interprete.removeCompiledField("prezzo_offerta_EURprima");

        Assert.True(interprete.deletedContainsKey("prezzo_offerta_EURprima"));
        Assert.False(interprete.deletedContainsKey("descrizione"));
    }

    [Fact]
    public void Un_campo_cancellato_e_poi_ripristinato_sopravvive_a_finalizeFields()
    {
        // restoreCompiledField toglie la marcatura: se finalizeFields guardasse la lista
        // sbagliata, il ripristino verrebbe vanificato proprio al momento dell'export.
        var interprete = ConDueCampi();
        interprete.removeCompiledField("descrizione");
        interprete.restoreCompiledField("descrizione");

        interprete.finalizeFields();

        Assert.True(interprete.compiledContainsKey("descrizione"));
        Assert.Equal("Pasta 500g", interprete.getFieldsValue("descrizione").content);
    }
}
