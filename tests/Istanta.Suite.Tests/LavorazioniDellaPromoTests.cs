using System;
using System.Collections.Generic;
using System.Linq;
using Istanta.Models;
using Istanta.Models_2;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-981 (Lotto 4b): le lavorazioni sorelle di una lavorazione, cioe' quelle della stessa
/// promo. Il plugin le offre per scegliere da dove scaricare la lista di confronto: un elenco
/// che lasciasse passare un'altra promo proporrebbe un confronto senza senso.
/// </summary>
public class LavorazioniDellaPromoTests
{
    private static PromoLavorazioni Lavorazione(int id, string? guidPromo, string? meta, DateTime? data = null)
    {
        return new PromoLavorazioni
        {
            Id = id,
            GuidPromo = guidPromo,
            Meta = meta,
            RegisterDate = data ?? new DateTime(2026, 5, 25),
            Stato = 1,
            GuidFormato = "F",
            GuidArea = "A",
            GuidCanale = "C"
        };
    }

    [Fact]
    public void Entrano_solo_le_lavorazioni_della_stessa_promo_dalla_piu_recente()
    {
        var corrente = Lavorazione(3227, "promo-1", "{\"titolo\":\"P2611 SS/SA\"}", new DateTime(2026, 5, 25));
        var tutte = new List<PromoLavorazioni>
        {
            corrente,
            Lavorazione(3231, "promo-1", "{\"titolo\":\"P2611 TO\"}", new DateTime(2026, 6, 1)),
            Lavorazione(3100, "promo-2", "{\"titolo\":\"Altra promo\"}", new DateTime(2026, 7, 1)),
            Lavorazione(3050, "promo-1", "{\"titolo\":\"P2611 vecchia\"}", new DateTime(2026, 4, 1))
        };

        var risposta = LavorazioniDellaPromo.Componi(corrente, tutte);

        Assert.True(risposta.esito);
        Assert.Equal("promo-1", risposta.guidPromo);
        Assert.Equal(new[] { 3231, 3227, 3050 }, risposta.lavorazioni.Select(l => l.id).ToArray());
        Assert.Equal("P2611 TO", risposta.lavorazioni[0].titolo);
        // La corrente sta nell'elenco per dire chi e', segnata.
        Assert.Equal(new[] { false, true, false }, risposta.lavorazioni.Select(l => l.corrente).ToArray());
    }

    [Fact]
    public void Il_titolo_viene_dal_meta_e_un_meta_rotto_non_ferma_l_elenco()
    {
        Assert.Equal("P2611 SS/SA", LavorazioniDellaPromo.TitoloDalMeta("{\"titolo\":\" P2611 SS/SA \"}", 1));
        // Senza titolo, o senza Meta, o con un Meta che non e' json: un nome che dica almeno l'id.
        Assert.Equal("Lavorazione 7", LavorazioniDellaPromo.TitoloDalMeta("{\"altro\":1}", 7));
        Assert.Equal("Lavorazione 7", LavorazioniDellaPromo.TitoloDalMeta(null, 7));
        Assert.Equal("Lavorazione 7", LavorazioniDellaPromo.TitoloDalMeta("non json", 7));
    }

    [Fact]
    public void Senza_lavorazione_o_senza_promo_la_risposta_dice_perche()
    {
        var assente = LavorazioniDellaPromo.Componi(null, new List<PromoLavorazioni>());
        Assert.False(assente.esito);
        Assert.Equal(LavorazioniDellaPromo.ERRORE_LAVORAZIONE_NON_TROVATA, assente.error);
        Assert.Empty(assente.lavorazioni);

        var senzaPromo = LavorazioniDellaPromo.Componi(Lavorazione(1, null, null), new List<PromoLavorazioni>());
        Assert.False(senzaPromo.esito);
        Assert.Equal(LavorazioniDellaPromo.ERRORE_PROMO_ASSENTE, senzaPromo.error);
    }
}
