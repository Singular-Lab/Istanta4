using Correggo4.Servizi;
using Microsoft.AspNetCore.Http;
using Xunit;

namespace Correggo4.Tests;

/// <summary>Indirizzi.Con: la cartella di pubblicazione davanti ai percorsi costruiti in C#.</summary>
public class IndirizziTests
{
    [Theory]
    [InlineData("", "/volantini/P1/T1/pag1_v1.jpg", "/volantini/P1/T1/pag1_v1.jpg")]
    [InlineData("/cartella", "/volantini/P1/T1/pag1_v1.jpg", "/cartella/volantini/P1/T1/pag1_v1.jpg")]
    [InlineData("/cartella", "/Volantini/Dettaglio/3", "/cartella/Volantini/Dettaglio/3")]
    [InlineData("/a/b", "/Foto/Miniatura", "/a/b/Foto/Miniatura")]
    public void Mette_la_cartella_davanti_ai_percorsi_dell_applicazione(string cartella, string percorso, string atteso)
    {
        Assert.Equal(atteso, Indirizzi.Con(new PathString(cartella == "" ? null : cartella), percorso));
    }

    [Theory]
    [InlineData("https://olimpo.example/thumb")]
    [InlineData("//cdn.example/x.png")]
    [InlineData("relativo/x.png")]
    [InlineData("")]
    public void Non_tocca_gli_indirizzi_completi_ne_quelli_relativi(string percorso)
    {
        Assert.Equal(percorso, Indirizzi.Con(new PathString("/cartella"), percorso));
    }

    [Fact]
    public void Senza_richiesta_la_base_e_vuota()
    {
        Assert.Equal("/Volantini", Indirizzi.Con((HttpContext?)null, "/Volantini"));
        Assert.Null(Indirizzi.ConOpzionale(null, null));
    }

    [Fact]
    public void Con_la_richiesta_usa_il_suo_PathBase()
    {
        var http = new DefaultHttpContext();
        http.Request.PathBase = "/cartella";

        Assert.Equal("/cartella/Volantini", Indirizzi.ConOpzionale(http, "/Volantini"));
    }
}
