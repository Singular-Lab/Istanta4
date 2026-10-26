using Istanta.Controllers;
using Istanta.Models_2;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// TASK-19c18841: chi cambia la pagina di un box impaginato ne diventa l'autore, sempre; se a
/// spostarlo e' la sincronizzazione del Report Integrita', l'autore e' il report, scritto come l'id
/// dell'utente che lo ha avviato col segno meno (non c'e' una colonna per dirlo). La lista degli
/// impaginati porta il nome dell'autore, che il Plugin mostra prima di svuotare una pagina.
///
/// Prima la sincronizzazione, impaginaSingolo con il bypass e ricollegaBox cambiavano solo la
/// pagina, e l'autore restava chi aveva impaginato il box all'inizio.
/// </summary>
public class SpostamentoPaginaAutoreTests
{
    private static PromoLavorazioniRecord Riga(byte pagina, short autore, string codiceGruppo = "6593680", long idRec = 456) =>
        new() { Id = 1, IdLavorazione = 1193, CodiceGruppo = codiceGruppo, IdRecordTracciato = idRec, Pagina = pagina, IdAutore = autore };

    [Fact]
    public void Un_box_portato_a_un_altra_pagina_cambia_pagina_e_autore()
    {
        var riga = Riga(pagina: 3, autore: 4);

        Assert.True(MenaboController.PortaAPagina(riga, 5, () => 9));

        Assert.Equal((byte)5, riga.Pagina);
        Assert.Equal((short)9, riga.IdAutore);
    }

    [Fact]
    public void Un_box_gia_su_quella_pagina_non_cambia_e_l_autore_non_si_chiede()
    {
        var riga = Riga(pagina: 5, autore: 4);
        var chiesto = false;

        Assert.False(MenaboController.PortaAPagina(riga, 5, () => { chiesto = true; return 9; }));

        Assert.Equal((byte)5, riga.Pagina);
        Assert.Equal((short)4, riga.IdAutore);
        //L'autore puo' voler dire leggere la sessione: senza spostamento non serve.
        Assert.False(chiesto);
    }

    [Fact]
    public void L_autore_del_report_e_l_utente_che_lo_ha_avviato_col_segno_meno()
    {
        Assert.Equal((short)-12, MenaboController.AutoreDelReport(12));
        Assert.Equal((short)-12, MenaboController.AutoreDelReport(-12));

        var riga = Riga(pagina: 3, autore: 4);
        MenaboController.PortaAPagina(riga, 5, () => MenaboController.AutoreDelReport(12));
        Assert.Equal((short)-12, riga.IdAutore);
    }

    [Fact]
    public void La_lista_degli_impaginati_porta_il_nome_dell_autore_e_dice_quando_e_il_report()
    {
        var nomi = new Dictionary<int, string> { [4] = "mrossi", [12] = "lbianchi" };
        var righe = new List<PromoLavorazioniRecord>
        {
            Riga(pagina: 3, autore: 4),
            Riga(pagina: 5, autore: -12, codiceGruppo: "2617525", idRec: 321),
            Riga(pagina: 7, autore: 99, codiceGruppo: "777", idRec: 70)
        };

        var lista = MenaboController.ElementiImpaginati(righe, nomi);

        Assert.Equal(3, lista.Count);
        Assert.Equal("6593680", lista[0].codiceGruppo);
        Assert.Equal(456, lista[0].idRec);
        Assert.Equal("3", lista[0].nomePagina);
        Assert.Equal((short)4, lista[0].idAutore);
        Assert.Equal("mrossi", lista[0].nomeAutore);
        Assert.False(lista[0].autoreReport);

        //Spostato dal report avviato da lbianchi.
        Assert.Equal("lbianchi", lista[1].nomeAutore);
        Assert.True(lista[1].autoreReport);

        //Un utente che non c'e' lascia il nome vuoto, e la riga c'e' lo stesso.
        Assert.Equal("", lista[2].nomeAutore);
        Assert.Equal("7", lista[2].nomePagina);
    }
}
