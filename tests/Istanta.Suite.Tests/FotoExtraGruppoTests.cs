using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Istanta.Controllers;
using Istanta.Models;
using Istanta.Utility;
using IstantaLib;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// Le foto extra dei gruppi fra Istanta e Plugin. Un gruppo ha una foto extra solo se tutte le sue
/// referenze la hanno: Istanta scrive sul dato del box di un gruppo le comuni (Foto.ExtraGruppo), che il
/// box impagina, e le parziali (Foto.ExtraParziali), da estendere o eliminare. Foto.Extra di ogni
/// referenza resta la sua: impaginata da sola, una referenza tiene anche le foto extra che il gruppo non
/// ha. Nel PoP le foto extra del gruppo stanno solo sul cartello di gruppo; i singoli che lo ripetono
/// per intero (Coop) prendono quelle del gruppo.
/// </summary>
public class FotoExtraGruppoTests
{
    private static string Sorgente(string relativo) =>
        File.ReadAllText(DllAgenziaLibTests.TrovaFile(relativo)).Replace("\r", "");

    private static LogoBollo_ExtraNoAuto Extra(string guid, bool attiva = true, byte tipo = 3) =>
        new LogoBollo_ExtraNoAuto { guidId = guid, nome = guid + ".ai", sigla = guid, tipo = tipo, attiva = attiva };

    private static Dictionary<string, object> Record(string codice, params LogoBollo_ExtraNoAuto[] extra) => new Dictionary<string, object>
    {
        ["Referenza.Codice"] = codice,
        ["Scatto.CodiceGruppo"] = "A,B,C",
        ["Foto.Extra"] = extra.ToList(),
    };

    private static List<LogoBollo_ExtraNoAuto> Lista(Dictionary<string, object> record, string chiave) =>
        (List<LogoBollo_ExtraNoAuto>)record[chiave];

    /* ---- comuni e parziali ---- */

    [Fact]
    public void Il_gruppo_ha_le_foto_extra_comuni_e_le_parziali_con_il_conteggio()
    {
        var a = Record("A", Extra("LOGO"), Extra("BIO"));
        var b = Record("B", Extra("LOGO"), Extra("BIO"));
        var c = Record("C", Extra("LOGO"));

        FotoExtraDiPiuArticoli.AssegnaExtraDelGruppo(new List<IDictionary<string, object>> { a, b, c });

        foreach (var record in new[] { a, b, c })
        {
            Assert.Equal(new[] { "LOGO" }, Lista(record, FotoExtraDiPiuArticoli.ChiaveExtraGruppo).Select(e => e.guidId).ToArray());
            var parziale = Assert.Single((List<FotoExtraParziale>)record[FotoExtraDiPiuArticoli.ChiaveExtraParziali]);
            Assert.Equal("BIO", parziale.guidId);
            Assert.Equal(2, parziale.presenti);
            Assert.Equal(3, parziale.totale);
            Assert.Equal(new[] { "A", "B" }, parziale.codiciCon.ToArray());
            Assert.Equal(new[] { "C" }, parziale.codiciSenza.ToArray());
        }
    }

    [Fact]
    public void La_referenza_tiene_le_sue_foto_extra_anche_quelle_che_il_gruppo_non_ha()
    {
        var a = Record("A", Extra("LOGO"), Extra("BIO"));
        var b = Record("B", Extra("LOGO"));

        FotoExtraDiPiuArticoli.AssegnaExtraDelGruppo(new List<IDictionary<string, object>> { a, b });

        Assert.Equal(new[] { "LOGO", "BIO" }, Lista(a, "Foto.Extra").Select(e => e.guidId).ToArray());
    }

    [Fact]
    public void Del_gruppo_una_foto_extra_e_attiva_solo_se_lo_e_su_tutte()
    {
        var a = Record("A", Extra("LOGO"));
        var b = Record("B", Extra("LOGO", attiva: false));

        FotoExtraDiPiuArticoli.AssegnaExtraDelGruppo(new List<IDictionary<string, object>> { a, b });

        Assert.False(Assert.Single(Lista(a, FotoExtraDiPiuArticoli.ChiaveExtraGruppo)).attiva);
        Assert.True(Assert.Single(Lista(a, "Foto.Extra")).attiva);
    }

    [Fact]
    public void Una_referenza_sola_non_e_un_gruppo()
    {
        var a = Record("A", Extra("LOGO"));
        var copia = Record("A", Extra("LOGO"));

        FotoExtraDiPiuArticoli.AssegnaExtraDelGruppo(new List<IDictionary<string, object>> { a, copia });

        Assert.False(a.ContainsKey(FotoExtraDiPiuArticoli.ChiaveExtraGruppo));
        Assert.False(a.ContainsKey(FotoExtraDiPiuArticoli.ChiaveExtraParziali));
    }

    [Fact]
    public void Le_foto_extra_si_leggono_anche_dal_json()
    {
        var record = new Dictionary<string, object> { ["Foto.Extra"] = Newtonsoft.Json.Linq.JArray.FromObject(new[] { Extra("LOGO") }) };

        Assert.Equal("LOGO", Assert.Single(FotoExtraDiPiuArticoli.ExtraDelRecord(record)).guidId);
        Assert.Empty(FotoExtraDiPiuArticoli.ExtraDelRecord(new Dictionary<string, object>()));
    }

    [Fact]
    public void Nel_PoP_le_foto_extra_del_gruppo_stanno_solo_sul_cartello_di_gruppo()
    {
        var a = Record("A", Extra("LOGO"));
        var b = Record("B", Extra("LOGO"));
        FotoExtraDiPiuArticoli.AssegnaExtraDelGruppo(new List<IDictionary<string, object>> { a, b });
        var cartelloDiGruppo = new Dictionary<string, object>(a);

        FotoExtraDiPiuArticoli.SoloSulCartelloDiGruppo(new List<IDictionary<string, object>?> { a, b });

        Assert.False(a.ContainsKey(FotoExtraDiPiuArticoli.ChiaveExtraGruppo));
        Assert.False(b.ContainsKey(FotoExtraDiPiuArticoli.ChiaveExtraParziali));
        Assert.Equal("LOGO", Assert.Single(Lista(cartelloDiGruppo, FotoExtraDiPiuArticoli.ChiaveExtraGruppo)).guidId);
    }

    /* ---- le decisioni della lavorazione ---- */

    [Fact]
    public void Escludi_solo_qui_vale_anche_per_le_foto_extra_del_gruppo()
    {
        var a = Record("A", Extra("LOGO"));
        var b = Record("B", Extra("LOGO"));
        FotoExtraDiPiuArticoli.AssegnaExtraDelGruppo(new List<IDictionary<string, object>> { a, b });
        var records = new List<ArticoloInKit> { new ArticoloInKit { IdRec = 7, recordInTracciato = a } };
        var decisioni = new Dictionary<string, List<RevisioneExtraLavorazioneFromIndd>>
        {
            [FicoProcessController.chiaveDellImpaginazione("A,B,C", 7)] = new List<RevisioneExtraLavorazioneFromIndd>
            {
                new RevisioneExtraLavorazioneFromIndd { sigla = "LOGO", azione = AzioneExtraLavorazione.Escludi }
            }
        };

        FicoProcessController.applicaExtraDellaLavorazione(records, decisioni);

        Assert.False(Assert.Single(Lista(a, FotoExtraDiPiuArticoli.ChiaveExtraGruppo)).attiva);
        Assert.False(Assert.Single(Lista(a, "Foto.Extra")).attiva);
    }

    /* ---- web: le parziali nella sezione del gruppo ---- */

    [Fact]
    public void Nella_sezione_del_gruppo_le_parziali_dicono_su_quante_referenze_stanno_e_dove_mancano()
    {
        ArticoliFoto Foto(long art, string guid) => new ArticoliFoto { IdArticolo = art, GuidId = guid, NomeReale = guid, PathFoto = guid, Tipo = 3, Attiva = true };

        var parziali = FotoExtraDiPiuArticoli.ParzialiAlGruppo(new List<(string, IEnumerable<ArticoliFoto>?)>
        {
            ("A", new[] { Foto(1, "LOGO"), Foto(1, "BIO") }),
            ("B", new[] { Foto(2, "LOGO") }),
            ("C", null),
        });

        Assert.Equal(new[] { "LOGO", "BIO" }, parziali.Select(p => p.Foto.GuidId).ToArray());
        var bio = parziali.Single(p => p.Foto.GuidId == "BIO");
        Assert.Equal(1, bio.Presenti);
        Assert.Equal(3, bio.Totale);
        Assert.Equal(new[] { "B", "C" }, bio.CodiciSenza.ToArray());
    }

    /* ---- Estendi ---- */

    [Fact]
    public void Estendi_copia_la_riga_di_una_referenza_che_la_ha()
    {
        var ora = new DateTime(2026, 11, 16, 10, 0, 0);
        var righe = new[]
        {
            new ArticoliFoto { IdArticolo = 1, GuidId = "LOGO", Tipo = (byte)TipoFoto.Foto, NomeReale = "prodotto.psd", PathFoto = "" },
            new ArticoliFoto { IdArticolo = 1, GuidId = "LOGO", Tipo = 3, NomeReale = "logo.ai", PathFoto = "LOGO", Puntatore = true, Attiva = true, Hash = "h" },
        };

        var sorgente = FotoExtraDiPiuArticoli.RigaDaEstendere(righe, "LOGO")!;
        var copia = FotoExtraDiPiuArticoli.CopiaPerEstendere(sorgente, 2, ora);

        Assert.Equal((byte)3, sorgente.Tipo);
        Assert.Equal(2, copia.IdArticolo);
        Assert.Equal(("LOGO", "logo.ai", "LOGO", true, true, "h"), (copia.GuidId, copia.NomeReale, copia.PathFoto, copia.Puntatore, copia.Attiva == true, copia.Hash));
        Assert.Equal(ora, copia.DataInserimento);
        Assert.Null(FotoExtraDiPiuArticoli.RigaDaEstendere(righe, "ALTRO"));
    }

    /* ---- chi le usa ---- */

    [Fact]
    public void Lista_del_kit_e_scheda_ref_calcolano_le_foto_extra_del_gruppo()
    {
        var fico = Sorgente("Istanta/Controllers/FicoProcessController.cs");
        var menabo = Sorgente("Istanta/Controllers/MenaboController.cs");

        //Prima dell'esportazione dell'agenzia, che copia le comuni sui cartelli singoli uguali al gruppo.
        int assegna = fico.IndexOf("FotoExtraDiPiuArticoli.AssegnaExtraDelGruppo(", StringComparison.Ordinal);
        Assert.True(assegna > 0 && assegna < fico.IndexOf("result = new PreparazioneListaResult()", assegna, StringComparison.Ordinal));
        Assert.Contains("FotoExtraDiPiuArticoli.AssegnaExtraDelGruppo(gruppo.Where(g => !g.isObsoleto)", menabo);

        //Nel PoP restano solo sul cartello di gruppo, dopo le decisioni della lavorazione.
        Assert.Contains("if (resultGlobale.tipoLavorazione == TipoLavorazione.PoP)\n                                FotoExtraDiPiuArticoli.SoloSulCartelloDiGruppo(", fico);
        Assert.Contains("if (agenziaFunc == \"esportaPoP\")\n                            FotoExtraDiPiuArticoli.SoloSulCartelloDiGruppo(", menabo);
    }

    [Fact]
    public void Le_operazioni_sulle_foto_extra_invalidano_la_lista_del_kit()
    {
        var sync = Sorgente("Istanta/Controllers/SyncFotoController.cs");

        Assert.Contains("[Route(\"SyncFoto/EstendiFotoExtra/{id_operazione}\")]", sync);
        Assert.Contains("GenerazioniCacheKit.Invalida(tracciati);", sync);
        foreach (var chiamata in new[] { "InvalidaKitDeiCodici(codiciList);", "InvalidaKitDeiCodici(codici);", "InvalidaKitDeiCodici(cods);",
            "InvalidaKitDeiCodici(daCambiare.Select(f => f.IdArticoloNavigation?.Codice ?? \"\"));", "InvalidaKitDeiCodici(FotoExtraDiPiuArticoli.Codici(codiceGruppo));" })
        {
            Assert.Contains(chiamata, sync);
        }
    }

    /* ---- Coop: i singoli uguali al cartello di gruppo ---- */

    [Fact]
    public void I_singoli_uguali_al_gruppo_prendono_le_foto_extra_del_gruppo()
    {
        var singolo = new Dictionary<string, object> { ["Foto.Extra"] = new List<LogoBollo_ExtraNoAuto> { Extra("BIO") } };
        var cartello = new Dictionary<string, object>
        {
            ["Foto.Extra"] = new List<LogoBollo_ExtraNoAuto> { Extra("LOGO"), Extra("SOLO_PRIMARIA") },
            ["Foto.ExtraGruppo"] = new List<LogoBollo_ExtraNoAuto> { Extra("LOGO") },
        };

        AgenziaLib.Coopfi.ripetiIlCartelloDiGruppo(singolo, cartello);

        Assert.Equal("LOGO", Assert.Single((List<LogoBollo_ExtraNoAuto>)singolo["Foto.Extra"]).guidId);
    }

    [Fact]
    public void Senza_foto_extra_del_gruppo_il_singolo_prende_quelle_del_cartello_come_prima()
    {
        var singolo = new Dictionary<string, object>();
        var cartello = new Dictionary<string, object> { ["Foto.Extra"] = new List<LogoBollo_ExtraNoAuto> { Extra("LOGO") } };

        AgenziaLib.Coopfi.ripetiIlCartelloDiGruppo(singolo, cartello);

        Assert.Equal("LOGO", Assert.Single((List<LogoBollo_ExtraNoAuto>)singolo["Foto.Extra"]).guidId);
    }
    /* ---- il caricamento di una foto extra non spegne le foto del prodotto ---- */

    private static ArticoliFoto Riga(byte? tipo, string? area, string? canale, bool attiva = true, string guid = "G") =>
        new ArticoliFoto { Tipo = tipo, Area = area!, Canale = canale!, Attiva = attiva, GuidId = guid, NomeReale = guid + ".psd" };

    [Fact]
    public void Caricare_una_foto_extra_non_spegne_le_foto_del_prodotto_regionali()
    {
        var regionale = Riga((byte)TipoFoto.Foto, "TOS", "IPER", guid: "REG");
        var foto = new List<ArticoliFoto> { regionale, Riga((byte)TipoFoto.Logo, null, null, guid: "LOGO") };

        Assert.Empty(SyncFotoController.FotoDaSpegnereAlCaricamento(foto, TipoFoto.Logo, null, null, "TOS", "IPER"));
        Assert.Empty(SyncFotoController.FotoDaSpegnereAlCaricamento(foto, TipoFoto.Bollino, null, null, "TOS", "IPER"));
    }

    [Fact]
    public void Caricare_una_foto_del_prodotto_spegne_solo_le_foto_del_prodotto_piu_specifiche()
    {
        var canale = Riga((byte)TipoFoto.Foto, null, "IPER", guid: "CAN");
        var senzaTipo = Riga(null, "TOS", null, guid: "VECCHIA");
        var altraArea = Riga((byte)TipoFoto.Foto, "LAZ", null, guid: "LAZ");
        var logoDiCanale = Riga((byte)TipoFoto.Logo, null, "IPER", guid: "LOGO");
        var foto = new List<ArticoliFoto> { canale, senzaTipo, altraArea, logoDiCanale };

        var spente = SyncFotoController.FotoDaSpegnereAlCaricamento(foto, TipoFoto.Foto, null, null, "TOS", "IPER");

        Assert.Equal(new[] { "CAN", "VECCHIA" }, spente.Select(f => f.GuidId).ToArray());
    }

    [Fact]
    public void Il_caricamento_senza_foto_attive_non_va_in_errore()
    {
        var sorgente = Sorgente("Istanta/Controllers/SyncFotoController.cs");

        Assert.Contains("foreach (var item in FotoDaSpegnereAlCaricamento(articolo.ArticoliFotos, _file.tipo, _file.area, _file.canale, _file.tracciatoArea, _file.tracciatoCanale))", sorgente);
        Assert.Contains("OrderByDescending(ord => ord.DataModifica).FirstOrDefault()?.Id == artFoto.Id", sorgente);
        Assert.DoesNotContain("OrderByDescending(ord => ord.DataModifica).FirstOrDefault()!.Id == artFoto.Id", sorgente);
    }

    /* ---- i collegamenti a un logo non piu' nell'archivio Loghi/Bolli ---- */

    [Fact]
    public void Un_collegamento_al_logo_sparito_dal_catalogo_e_non_piu_a_sistema()
    {
        var sparito = new ArticoliFoto { Tipo = (byte)TipoFoto.Logo, GuidId = "SPARITO", Puntatore = true };
        var presente = new ArticoliFoto { Tipo = (byte)TipoFoto.Logo, GuidId = "PRESENTE", Puntatore = true };
        var fileProprio = new ArticoliFoto { Tipo = (byte)TipoFoto.Logo, GuidId = "FILE", Puntatore = false };

        var nonASistema = CollegamentiNonASistema.Guid(new[] { sparito, presente, fileProprio, null }, guid => guid == "PRESENTE");

        Assert.Equal(new[] { "SPARITO" }, nonASistema.ToArray());
    }

    [Fact]
    public void Il_Plugin_riceve_i_collegamenti_non_piu_a_sistema_fuori_dal_box_e_il_web_li_segna()
    {
        var fico = Sorgente("Istanta/Controllers/FicoProcessController.cs");
        Assert.Contains("nonASistema.Add(foto);\n                        return true; // rimuovi", fico);
        Assert.Contains("rec.recordInTracciato[FotoExtraDiPiuArticoli.ChiaveExtraNonASistema] = nonASistema;", fico);

        var scheda = Sorgente("Istanta/Controllers/SchedaArticoloController.cs");
        Assert.Equal(3, scheda.Split("ConNonASistema(sezione);").Length - 1);
    }

    /* ---- i file aggiunti solo per una lavorazione ---- */

    private static RevisioneExtraLavorazioneFromIndd Aggiungi(string nome, string? guid, int tipoFoto = 2) =>
        new RevisioneExtraLavorazioneFromIndd { tipo = TipoElementoBox.FotoExtra, sigla = nome, nome = nome, azione = AzioneExtraLavorazione.Aggiungi, tipoFoto = tipoFoto, guidId = guid };

    [Fact]
    public void La_sync_loghi_porta_i_file_aggiunti_solo_per_la_lavorazione()
    {
        var decisioni = new List<RevisioneExtraLavorazioneFromIndd>
        {
            Aggiungi("bollino.png", "G1"),
            Aggiungi("logo_archivio.ai", null, 3),
            new RevisioneExtraLavorazioneFromIndd { sigla = "BIO", azione = AzioneExtraLavorazione.Escludi, guidId = "G2" },
        };

        var file = Assert.Single(SyncFotoController.FileAggiuntiSoloPerLaLavorazione(decisioni));
        Assert.Equal("G1", file.Id);
        Assert.Equal("bollino.png", file.FileName);
        Assert.Equal(TipoFoto.Bollino, file.Tipo);

        //Come arrivano dalla cache del kit: JSON.
        var json = Newtonsoft.Json.Linq.JArray.FromObject(decisioni);
        Assert.Equal("G1", Assert.Single(SyncFotoController.FileAggiuntiSoloPerLaLavorazione(json)).Id);
        Assert.Empty(SyncFotoController.FileAggiuntiSoloPerLaLavorazione(null));
    }

    [Fact]
    public void Il_file_della_decisione_si_chiede_una_volta_per_box()
    {
        var decisioni = new List<RevisioneExtraLavorazioneFromIndd> { Aggiungi("bollino.png", "G1") };
        var records = new List<ArticoloInKit>
        {
            new ArticoloInKit { IdRec = 1, recordInTracciato = new Dictionary<string, object> { ["extraLavorazione"] = decisioni } },
            new ArticoloInKit { IdRec = 2, recordInTracciato = new Dictionary<string, object> { ["extraLavorazione"] = decisioni } },
        };

        Assert.Equal("G1", Assert.Single(SyncFotoController.FotoExtraDeiRecord(records)).Id);
    }

    [Fact]
    public void Aggiungi_solo_qui_porta_il_GUID_fra_le_extra_automatiche()
    {
        var a = Record("A");
        var records = new List<ArticoloInKit> { new ArticoloInKit { IdRec = 7, recordInTracciato = a } };
        var decisioni = new Dictionary<string, List<RevisioneExtraLavorazioneFromIndd>>
        {
            [FicoProcessController.chiaveDellImpaginazione("A,B,C", 7)] = new List<RevisioneExtraLavorazioneFromIndd> { Aggiungi("bollino.png", "G1") }
        };

        FicoProcessController.applicaExtraDellaLavorazione(records, decisioni);

        var auto = Assert.Single((List<LogoBollo>)a["Foto.ExtraAuto"]);
        Assert.Equal("G1", auto.guidId);
        Assert.Equal("bollino.png", auto.nome);
    }

    [Fact]
    public void Il_file_solo_per_la_lavorazione_va_su_Olimpo_senza_toccare_l_archivio()
    {
        var sorgente = Sorgente("Istanta/Controllers/SyncFotoController.cs");
        var inizio = sorgente.IndexOf("[Route(\"SyncFoto/CaricaExtraSoloLavorazione\")]");
        Assert.True(inizio > 0);
        var corpo = sorgente.Substring(inizio, sorgente.IndexOf("/// Estendi:", inizio) - inizio);

        Assert.Contains("olympusServerUrl + \"/foto/uploadFoto\"", corpo);
        Assert.DoesNotContain("SaveChanges", corpo);
        Assert.DoesNotContain("ArticoliFoto", corpo);
    }

    /* ---- Escludi/Includi con una referenza non in archivio ---- */

    [Fact]
    public void Escludi_salta_le_referenze_non_in_archivio_e_lo_dice()
    {
        Assert.Null(SyncFotoController.ReferenzeSaltate(new List<string>()));
        Assert.Equal("referenze non in archivio, saltate: 123, 456", SyncFotoController.ReferenzeSaltate(new List<string> { "123", "456" }));

        var sorgente = Sorgente("Istanta/Controllers/SyncFotoController.cs");
        var inizio = sorgente.IndexOf("public async Task<IActionResult> escludiIncludiFotoExtraAuto(");
        var corpo = sorgente.Substring(inizio, sorgente.IndexOf("public static string? ReferenzeSaltate(", inizio) - inizio);
        Assert.Equal(2, corpo.Split("saltate.Add(codice);\n                            continue;").Length - 1);
        Assert.DoesNotContain("articolo!.FotoEscluses", corpo);
        Assert.Contains("result.error = ReferenzeSaltate(saltate);", corpo);
    }
}
