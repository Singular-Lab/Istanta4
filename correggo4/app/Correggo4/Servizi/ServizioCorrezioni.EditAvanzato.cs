using System.Globalization;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.RegularExpressions;
using Correggo4.Models;
using Correggo4.Models.Vista;
using Microsoft.EntityFrameworkCore;

namespace Correggo4.Servizi;

/// <summary>Richiesta di salvataggio della parte "prezzi e meccaniche" della scheda.</summary>
public sealed class RichiestaEditOfferta
{
    /// <summary>Solo i campi cambiati rispetto all'originale (il server scarta comunque gli uguali).</summary>
    public List<CampoEdit>? Campi { get; set; }

    /// <summary>Le "Altre azioni" scelte, con i valori che l'utente deve scrivere.</summary>
    public List<AzioneEdit>? Azioni { get; set; }
}

public sealed class CampoEdit
{
    public string? Field { get; set; }
    public string? Valore { get; set; }
}

public sealed class AzioneEdit
{
    public int Id { get; set; }
    public List<CampoEdit>? Campi { get; set; }
}

/// <summary>
/// Salvataggio della colonna "descrizione prodotto" (passo 2, j206): descrizione, foto P/S e loghi, come il
/// SALVA core dell'originale. Foto e Loghi null = il client non ha potuto leggere Istanta: si tengono
/// quelli gia' registrati. Testo null = prodotto senza descrizione.
/// </summary>
public sealed class RichiestaEditScheda
{
    public string? Testo { get; set; }
    public List<FotoEdit>? Foto { get; set; }
    public List<LogoEdit>? Loghi { get; set; }
}

public sealed class FotoEdit
{
    public string? Codice { get; set; }
    public string? GuidId { get; set; }
    public int Stato { get; set; }
}

public sealed class LogoEdit
{
    public string? GuidId { get; set; }
    public int Stato { get; set; }
}

/// <summary>
/// Il file scelto con "Carica nuova foto" (j217). Apri() si puo' chiamare due volte: una per l'md5,
/// una per mandarlo a Olimpo, senza tenere il file in memoria.
/// </summary>
public sealed record FotoDaCaricare(string NomeFile, string Tipo, long Lunghezza, Func<Stream> Apri);

/// <summary>
/// Edit avanzato, passo 1 (11/9/2026, correggo4-edit-avanzato.md): campi dell'offerta, altre azioni
/// e descrizione. Niente invio a Istanta: l'Agenzia applica a mano, come per le note.
///
/// Dati come l'originale (Service.cs correggiFieldsDellaRef 1801, annullaCorrezioneFieldsDellaRef 2336,
/// confermaCorrezioneFieldsDellaRef 2615): una riga di volantini_pagine_elementi_versioni per elemento,
/// nuova_versione nel formato EditAvanzato_ModificaRegistrata.
///   - box radice: lista delle azioni base (+ eventuali campi senza elemento figlio);
///   - ogni figlio della colonna prezzi (prezzo_promo, txt_sconto...): i campi cambiati che lo toccano;
///   - figlio "descrizione": la descrizione nuova, con i tag delle fasce;
///   - figlio "immagine" (passo 2, j206): lista VoceFoto con foto/P-S (stato 1-3) e loghi (4 aggiungi, 5 togli).
///
/// Due parti indipendenti, come i due SALVA dell'originale (core 0 / core 1): "offerta" e
/// "descrizione". Ognuna ha un autore e uno stato: 0 registrata, 2 confermata dall'Agenzia,
/// 4 annullata. Differenze volute dall'originale:
///   - regole di ruolo e di autore sul server (l'originale non ne aveva);
///   - una registrata la modifica o annulla solo chi l'ha fatta (decisione dell'11/9); una confermata
///     si puo' correggere di nuovo, e torna registrata;
///   - l'annullamento dell'offerta funziona (nell'originale non riusciva mai: S:2371 rifiuta lo
///     stato 0, l'unico che il GDO vede prima del demone);
///   - salvare riscrive tutta la parte: le righe vecchie si tolgono, cosi' un campo riportato
///     all'originale non resta registrato.
/// </summary>
public sealed partial class ServizioCorrezioni
{
    public const short EaRegistrato = 0;   // StatoEditAvanzato.Registrato
    public const short EaCorretto = 2;     // StatoEditAvanzato.Corretto: confermata dall'Agenzia
    public const short EaAnnullato = 4;    // StatoEditAvanzato.Annullato

    public const string ParteOfferta = "offerta";
    public const string ParteDescrizione = "descrizione";

    private const int LunghezzaMassimaValore = 200;
    private const int LunghezzaMassimaDescrizione = 2000;

    private static readonly JsonSerializerOptions JsonRegistro = new()
    {
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };

    /// <summary>Le etichette della scheda (Views/Volantini/Dettaglio.cshtml), per i messaggi.</summary>
    private static readonly Dictionary<string, string> EtichetteCampi = new()
    {
        ["prezzo_promo"] = "Prezzo Promo",
        ["prezzo_promo_kgl"] = "Prezzo al Kg/Lt",
        ["prezzo_continuo"] = "Prezzo Continuo",
        ["azione_pubblico"] = "Sconto",
        ["tipo_offerta"] = "Tipo offerta",
        ["nome_evento"] = "Evento",
        ["note"] = "Note"
    };

    // Formato di nuova_versione dell'originale (IService.cs EditAvanzato_ModificaRegistrata).
    private sealed class ModificaRegistrata
    {
        public short id_utente { get; set; }
        public string register_date { get; set; } = "";
        public int id_azione { get; set; }
        public List<ChiaveValore> keyvalues { get; set; } = new();
    }

    private sealed class ChiaveValore
    {
        public string field { get; set; } = "";
        public string valore { get; set; } = "";
    }

    [GeneratedRegex(@"<(?<tag>[A-Z0-9_]+)>[^<>]*</\k<tag>>")]
    private static partial Regex FasciaDescrizione();

    [GeneratedRegex(@"</?[A-Z0-9_]+>")]
    private static partial Regex Tag();

    [GeneratedRegex(@"\s+")]
    private static partial Regex Spazi();

    // ------------------------------------------------------------------ lettura

    private async Task<List<EditVista>> CaricaEditAsync(List<int> idPagine, Dictionary<int, short> numero,
                                                       Func<short?, string> nome, Func<short?, string> tipo)
    {
        var righe = await (from v in ctx.VolantiniPagineElementiVersionis.AsNoTracking()
                           join e in ctx.VolantiniPagineElementis.AsNoTracking() on v.IdElemento equals e.Id
                           where idPagine.Contains(e.IdPagina)
                                 && (v.Stato == EaRegistrato || v.Stato == EaCorretto)
                                 // j227: le propagate le legge CaricaEditPropagateAsync, che va a
                                 // prendere i valori sulla correzione del pilota
                                 && v.IdElementoMaster == null
                           orderby v.Id
                           select new
                           {
                               v.IdElemento, v.NuovaVersione, v.Stato, v.IdAutore, v.DataModifica,
                               e.IdParent, e.IdPagina, e.LabelInd, e.PosizioneX, e.PosizioneY, e.Larghezza, e.Altezza
                           }).ToListAsync();
        // j227: anche senza correzioni proprie ci possono essere quelle propagate
        if (righe.Count == 0) return await CaricaEditPropagateAsync(idPagine, numero, nome, tipo);

        var idRadici = righe.Select(r => r.IdParent ?? r.IdElemento).Distinct().ToList();
        var radici = await ctx.VolantiniPagineElementis.AsNoTracking()
            .Where(e => idRadici.Contains(e.Id))
            .Select(e => new { e.Id, e.IdPagina, e.Contenuto, e.PosizioneX, e.PosizioneY, e.Larghezza, e.Altezza })
            .ToDictionaryAsync(e => e.Id);

        var lista = new List<EditVista>();
        foreach (var g in righe.GroupBy(r => (
                     Radice: r.IdParent ?? r.IdElemento,
                     Parte: r.IdParent != null && (r.LabelInd == SchemaReferenza.LabelDescrizione
                                                   || r.LabelInd == SchemaReferenza.LabelImmagine)
                            ? ParteDescrizione : ParteOfferta)))
        {
            if (!radici.TryGetValue(g.Key.Radice, out var rad)) continue;
            var capo = g.Key.Parte == ParteOfferta
                ? g.FirstOrDefault(r => r.IdParent == null) ?? g.First()
                : g.First();
            var schema = SchemaReferenza.Leggi(rad.Contenuto);

            var vista = new EditVista
            {
                IdBox = rad.Id,
                IdPagina = rad.IdPagina,
                Pagina = numero.TryGetValue(rad.IdPagina, out short np) ? np : (short)0,
                Parte = g.Key.Parte,
                Stato = capo.Stato,
                IdAutore = capo.IdAutore,
                Autore = nome(capo.IdAutore),
                TipoAutore = tipo(capo.IdAutore),
                Data = capo.DataModifica
            };

            foreach (var r in g)
            {
                if (r.IdParent == null)
                {
                    bool sulBox = false;
                    foreach (var m in LeggiRegistro(r.NuovaVersione))
                    {
                        if (m.id_azione > 0)
                        {
                            var az = schema?.Azioni.FirstOrDefault(a => a.Id == m.id_azione);
                            var ae = new AzioneEditVista { Id = m.id_azione, Titolo = az?.Titolo ?? $"Azione {m.id_azione}" };
                            foreach (var kv in m.keyvalues) ae.Campi[kv.field] = kv.valore;
                            vista.Azioni.Add(ae);
                        }
                        else
                        {
                            foreach (var kv in m.keyvalues) vista.Campi[kv.field] = kv.valore;
                        }
                        sulBox = true;
                    }
                    // Correzioni sul box intero: cerchio al centro (l'originale lo disegna 60x60).
                    if (sulBox)
                        vista.Evidenze.Add(new EvidenzaVista
                        {
                            Label = SchemaReferenza.LabelBase, Cerchio = true,
                            X = (double)(rad.PosizioneX + rad.Larghezza / 2),
                            Y = (double)(rad.PosizioneY + rad.Altezza / 2)
                        });
                }
                else if (r.LabelInd == SchemaReferenza.LabelImmagine)
                {
                    // foto P/S e loghi (passo 2): lista di VoceFoto, formato dell'originale
                    foreach (var vf in LeggiVociFoto(r.NuovaVersione))
                        vista.Foto.Add(new FotoEditVista { Codice = vf.codice, GuidId = vf.guidid, NomeFile = vf.nomeFile, Stato = vf.stato });
                    vista.Evidenze.Add(new EvidenzaVista
                    {
                        Label = r.LabelInd,
                        X = (double)r.PosizioneX, Y = (double)r.PosizioneY,
                        W = (double)r.Larghezza, H = (double)r.Altezza
                    });
                }
                else
                {
                    foreach (var m in LeggiRegistro(r.NuovaVersione))
                        foreach (var kv in m.keyvalues) vista.Campi[kv.field] = kv.valore;
                    vista.Evidenze.Add(new EvidenzaVista
                    {
                        Label = r.LabelInd,
                        X = (double)r.PosizioneX, Y = (double)r.PosizioneY,
                        W = (double)r.Larghezza, H = (double)r.Altezza
                    });
                }
            }
            lista.Add(vista);
        }
        // j227: le correzioni di Edit avanzato arrivate da un altro volantino
        lista.AddRange(await CaricaEditPropagateAsync(idPagine, numero, nome, tipo));
        return lista.OrderBy(v => v.IdBox).ThenBy(v => v.Parte).ToList();
    }

    private static List<VoceFoto> LeggiVociFoto(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new();
        try { return JsonSerializer.Deserialize<List<VoceFoto>>(json) ?? new(); }
        catch (JsonException) { return new(); }
    }

    /// <summary>nuova_versione e' una lista sul box radice e un oggetto sui figli.</summary>
    private static List<ModificaRegistrata> LeggiRegistro(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new();
        try
        {
            string t = json.TrimStart();
            if (t.StartsWith('['))
                return JsonSerializer.Deserialize<List<ModificaRegistrata>>(t) ?? new();
            var una = JsonSerializer.Deserialize<ModificaRegistrata>(t);
            return una == null ? new List<ModificaRegistrata>() : new List<ModificaRegistrata> { una };
        }
        catch (JsonException)
        {
            return new();
        }
    }

    // ------------------------------------------------------------------ offerta

    public async Task<EsitoCorrezione> SalvaEditOffertaAsync(Utente u, long idBox, RichiestaEditOfferta r)
    {
        if (!u.Scrive) return NonAutorizzato();
        var (box, vol, errore) = await BoxScrivibileAsync(u, idBox);
        if (errore != null) return errore;

        var schema = SchemaReferenza.Leggi(box!.Contenuto);
        if (schema == null || schema.Azioni.Count == 0) return SenzaSchema();

        string registrata = DateTime.UtcNow.ToString("o", CultureInfo.InvariantCulture);

        // 1. i campi della colonna prezzi: solo quelli che l'utente puo' scrivere
        var campi = new List<(string Field, string Valore)>();
        foreach (var c in r.Campi ?? new())
        {
            string field = SchemaReferenza.ChiaveIstruzione((c.Field ?? "").Trim());
            var istr = schema.AzioniCampo.SelectMany(a => a.Istruzioni)
                             .FirstOrDefault(i => i.Field == field && !i.Fisso);
            if (istr == null)
                return EsitoCorrezione.No(400, "campo_non_modificabile",
                    $"Il campo «{Etichetta(field)}» non si può correggere su questo prodotto.");
            if (campi.Any(x => x.Field == field)) continue;

            var (ok, valore, messaggio) = NormalizzaValore(istr, c.Valore);
            if (!ok) return EsitoCorrezione.No(400, "valore_non_valido", messaggio!);
            if (StessoValore(istr, valore, schema.Originale(field))) continue;   // uguale all'originale
            campi.Add((field, valore));
        }

        // 2. le altre azioni (sul box intero)
        var azioni = new List<ModificaRegistrata>();
        foreach (var a in r.Azioni ?? new())
        {
            var az = schema.AzioniBase.FirstOrDefault(x => x.Id == a.Id && x.Id > 0);
            if (az == null)
                return EsitoCorrezione.No(400, "azione_sconosciuta", "Questa azione non è disponibile per il prodotto.");
            if (azioni.Any(x => x.id_azione == az.Id))
                return EsitoCorrezione.No(400, "azione_doppia", $"L'azione «{az.Titolo}» è già stata scelta.");

            var reg = new ModificaRegistrata { id_utente = u.Id, register_date = registrata, id_azione = az.Id };
            foreach (var istr in az.Istruzioni)
            {
                string chiave = SchemaReferenza.ChiaveTracciato(istr.Field);
                if (reg.keyvalues.Any(k => k.field == chiave)) continue;

                string valore;
                if (istr.Fisso)
                {
                    valore = istr.Valore[0];
                }
                else
                {
                    var dato = a.Campi?.FirstOrDefault(x =>
                        SchemaReferenza.ChiaveIstruzione((x.Field ?? "").Trim()) == istr.Field);
                    var (ok, v, messaggio) = NormalizzaValore(istr, dato?.Valore);
                    if (!ok) return EsitoCorrezione.No(400, "valore_non_valido", $"{az.Titolo}: {messaggio}");
                    valore = v;
                }
                reg.keyvalues.Add(new ChiaveValore { field = chiave, valore = valore });
            }
            azioni.Add(reg);
        }

        if (campi.Count == 0 && azioni.Count == 0)
            return EsitoCorrezione.No(400, "nessuna_modifica",
                "Non c'è niente da salvare: i valori sono quelli originali e non hai scelto altre azioni.");

        // 3. una correzione registrata la tocca solo chi l'ha fatta
        var figli = await ctx.VolantiniPagineElementis.AsNoTracking()
            .Where(e => e.IdParent == box.Id).ToListAsync();
        var idParte = IdElementiParte(box.Id, figli, ParteOfferta);
        var esistenti = await ctx.VolantiniPagineElementiVersionis
            .Where(v => idParte.Contains(v.IdElemento)).ToListAsync();
        var altrui = esistenti.FirstOrDefault(v => v.Stato == EaRegistrato && v.IdAutore != u.Id);
        if (altrui != null) return CorrezioneAltrui(await NomeUtenteAsync(altrui.IdAutore));

        // 4. i campi vanno sugli elementi figli che li mostrano; senza figlio restano sul box
        var perFiglio = new Dictionary<long, ModificaRegistrata>();
        var sulBox = new ModificaRegistrata { id_utente = u.Id, register_date = registrata, id_azione = -1 };
        foreach (var (field, valore) in campi)
        {
            string chiave = SchemaReferenza.ChiaveTracciato(field);
            bool messo = false;
            foreach (var az in schema.AzioniCampo.Where(a => a.Istruzioni.Any(i => i.Field == field)))
            {
                var figlio = figli.FirstOrDefault(f => f.LabelInd == az.LabelIndd);
                if (figlio == null) continue;
                if (!perFiglio.TryGetValue(figlio.Id, out var reg))
                    perFiglio[figlio.Id] = reg = new ModificaRegistrata { id_utente = u.Id, register_date = registrata, id_azione = -1 };
                if (!reg.keyvalues.Any(k => k.field == chiave))
                    reg.keyvalues.Add(new ChiaveValore { field = chiave, valore = valore });
                messo = true;
            }
            if (!messo) sulBox.keyvalues.Add(new ChiaveValore { field = chiave, valore = valore });
        }
        var registroBox = new List<ModificaRegistrata>(azioni);
        if (sulBox.keyvalues.Count > 0) registroBox.Add(sulBox);

        var adesso = DateTime.UtcNow;
        ctx.VolantiniPagineElementiVersionis.RemoveRange(esistenti);
        ctx.VolantiniPagineElementiVersionis.Add(NuovaRiga(box.Id, box.IdPagina, u.Id, adesso,
            JsonSerializer.Serialize(registroBox, JsonRegistro)));
        foreach (var (idFiglio, reg) in perFiglio)
            ctx.VolantiniPagineElementiVersionis.Add(NuovaRiga(idFiglio, box.IdPagina, u.Id, adesso,
                JsonSerializer.Serialize(reg, JsonRegistro)));
        await ctx.SaveChangesAsync();   // una sola SaveChanges: tutto o niente
        return Fatto(await CaricaAsync(vol!.Id, u), box.Id);
    }

    // ------------------------------------------------------------------ descrizione

    public async Task<EsitoCorrezione> SalvaEditDescrizioneAsync(Utente u, long idBox, RichiestaEditScheda r)
    {
        if (!u.Scrive) return NonAutorizzato();
        var (box, vol, errore) = await BoxScrivibileAsync(u, idBox);
        if (errore != null) return errore;

        var figli = await ctx.VolantiniPagineElementis.AsNoTracking().Where(e => e.IdParent == box!.Id).ToListAsync();
        var figlioDescr = figli.FirstOrDefault(e => e.LabelInd == SchemaReferenza.LabelDescrizione);
        var figlioImm = figli.FirstOrDefault(e => e.LabelInd == SchemaReferenza.LabelImmagine);
        if (figlioDescr == null && figlioImm == null)
            return EsitoCorrezione.No(409, "senza_descrizione", "Questo prodotto non ha né descrizione né foto da correggere.");

        var idParte = IdElementiParte(box!.Id, figli, ParteDescrizione);
        var esistenti = await ctx.VolantiniPagineElementiVersionis.Where(v => idParte.Contains(v.IdElemento)).ToListAsync();
        var altrui = esistenti.FirstOrDefault(v => v.Stato == EaRegistrato && v.IdAutore != u.Id);
        if (altrui != null) return CorrezioneAltrui(await NomeUtenteAsync(altrui.IdAutore));

        // 1. descrizione
        string? testoNuovo = null;
        if (r.Testo != null && figlioDescr != null)
        {
            string t = r.Testo.Replace("\r\n", "\n").Trim();
            if (Tag().Replace(t, "").Trim().Length == 0)
                return EsitoCorrezione.No(400, "descrizione_vuota", "La descrizione non può essere vuota.");
            if (t.Length > LunghezzaMassimaDescrizione)
                return EsitoCorrezione.No(400, "descrizione_lunga", $"La descrizione supera i {LunghezzaMassimaDescrizione} caratteri.");
            string fuori = FasciaDescrizione().Replace(t, "");
            if (fuori.Contains('<') || fuori.Contains('>'))
                return EsitoCorrezione.No(400, "descrizione_non_valida",
                    "Nella descrizione ci sono i caratteri < o >: toglili e salva di nuovo.");
            if (Compatta(t) != Compatta(figlioDescr.Contenuto)) testoNuovo = t;
        }

        // 2. foto e loghi: si controllano su Istanta, che e' la fonte vera
        List<VoceFoto> voci;
        if (r.Foto == null && r.Loghi == null)
        {
            var rigaImm = figlioImm == null ? null : esistenti.FirstOrDefault(v => v.IdElemento == figlioImm.Id);
            voci = rigaImm == null || rigaImm.Stato == EaAnnullato ? new() : LeggiVociFoto(rigaImm.NuovaVersione);
        }
        else
        {
            if (figlioImm == null)
                return EsitoCorrezione.No(409, "senza_immagine", "Questo prodotto non ha una foto nel volantino.");
            var (vociNuove, erroreFoto) = await VociFotoAsync(u, vol!, box, r);
            if (erroreFoto != null) return erroreFoto;
            voci = vociNuove!;
        }

        if (testoNuovo == null && voci.Count == 0)
            return EsitoCorrezione.No(400, "nessuna_modifica",
                "Non c'è niente da salvare: descrizione, foto e loghi sono quelli originali.");

        string registrata = DateTime.UtcNow.ToString("o", CultureInfo.InvariantCulture);
        var adesso = DateTime.UtcNow;
        ctx.VolantiniPagineElementiVersionis.RemoveRange(esistenti);
        if (testoNuovo != null)
        {
            var reg = new ModificaRegistrata
            {
                id_utente = u.Id, register_date = registrata, id_azione = -1,
                keyvalues = { new ChiaveValore { field = SchemaReferenza.LabelDescrizione, valore = testoNuovo } }
            };
            ctx.VolantiniPagineElementiVersionis.Add(NuovaRiga(figlioDescr!.Id, box.IdPagina, u.Id, adesso,
                JsonSerializer.Serialize(reg, JsonRegistro)));
        }
        if (voci.Count > 0)
            ctx.VolantiniPagineElementiVersionis.Add(NuovaRiga(figlioImm!.Id, box.IdPagina, u.Id, adesso,
                JsonSerializer.Serialize(voci, JsonRegistro)));
        await ctx.SaveChangesAsync();
        return Fatto(await CaricaAsync(vol!.Id, u), box.Id);
    }

    // ------------------------------------------------------------------ carica nuova foto (passo 3, j217)

    /// <summary>Formati accettati: solo immagini (decisione di Michele del 14/9).</summary>
    public static readonly string[] EstensioniFoto = { ".jpg", ".jpeg", ".png", ".tif", ".tiff", ".webp", ".psd" };

    /// <summary>
    /// "Carica nuova foto" dell'originale (correzioni.js editAvanzato_SceltaFotoNuova + UploadFotoByCodice.ashx):
    /// il file va in archivio su Olimpo e torna il suo guid. Qui non si registra ancora nessuna correzione:
    /// la foto entra nella scheda e il SALVA descrizione la registra come le altre. Nessun limite di
    /// dimensione (decisione di Michele del 14/9); il caricamento resta a nome di chi l'ha fatto.
    /// </summary>
    public async Task<EsitoCorrezione> CaricaFotoNuovaAsync(Utente u, long idBox, string? codice, FotoDaCaricare? file)
    {
        if (!u.Scrive) return NonAutorizzato();
        var (box, vol, errore) = await BoxScrivibileAsync(u, idBox);
        if (errore != null) return errore;
        if (file == null || file.Lunghezza <= 0)
            return EsitoCorrezione.No(400, "file_mancante", "Non è arrivato nessun file: riprova a sceglierlo.");

        string nome = Path.GetFileName(file.NomeFile ?? "").Trim();
        if (nome == "") return EsitoCorrezione.No(400, "nome_file", "Il file non ha un nome valido.");
        if (!EstensioniFoto.Contains(Path.GetExtension(nome).ToLowerInvariant()))
            return EsitoCorrezione.No(400, "formato_foto",
                "Si possono caricare solo immagini (" + string.Join(", ", EstensioniFoto).Replace(".", "") + ").");

        string cod = (codice ?? "").Trim();
        var scheda = await fico.SchedaAsync(u.Id, vol!.GuidKitRuntime, box!.Basecode);
        if (!scheda.Ok) return IstantaNonDisponibile(scheda.Errore);
        if (scheda.Dati!.All(f => f.Codice != cod))
            return EsitoCorrezione.No(400, "codice_sconosciuto", $"Il codice «{cod}» non è in questo prodotto.");

        string md5;
        await using (var s = file.Apri())
            md5 = Convert.ToHexString(await System.Security.Cryptography.MD5.HashDataAsync(s)).ToLowerInvariant();

        EsitoFico<(string GuidId, string Md5)> caricata;
        await using (var s = file.Apri())
            caricata = await fico.CaricaFotoAsync(nome, md5, s, file.Tipo);
        if (!caricata.Ok)
            return EsitoCorrezione.No(502, "istanta", caricata.Errore ?? "La foto non è stata caricata.");

        ctx.VolantiniFotoCaricates.Add(new VolantiniFotoCaricate
        {
            IdElemento = box.Id, Codice = cod, GuidId = caricata.Dati.GuidId, NomeFile = nome,
            Md5 = caricata.Dati.Md5, IdAutore = u.Id, DataCaricamento = DateTime.UtcNow
        });
        await ctx.SaveChangesAsync();
        return EsitoCorrezione.Fatto(new { guidId = caricata.Dati.GuidId, md5 = caricata.Dati.Md5, nomeFile = nome, codice = cod });
    }

    /// <summary>
    /// Dalle scelte del client alle voci da registrare, controllate sulla scheda di Istanta. Solo cio' che
    /// differisce da Istanta si registra. Regola dell'originale (correzioni.js:4085-4091): una sola foto
    /// primaria, qui chiesta solo se l'utente ha toccato le foto.
    /// </summary>
    private async Task<(List<VoceFoto>? Voci, EsitoCorrezione? Errore)> VociFotoAsync(
        Utente u, Volantini vol, VolantiniPagineElementi box, RichiestaEditScheda r)
    {
        var scheda = await fico.SchedaAsync(u.Id, vol.GuidKitRuntime, box.Basecode);
        if (!scheda.Ok) return (null, IstantaNonDisponibile(scheda.Errore));
        var refs = scheda.Dati!;
        var voci = new List<VoceFoto>();

        var finale = refs.GroupBy(f => f.Codice).ToDictionary(g => g.Key, g => StatoIstanta(g.First()));
        foreach (var fe in r.Foto ?? new())
        {
            var rec = refs.FirstOrDefault(f => f.Codice == (fe.Codice ?? "").Trim());
            if (rec == null)
                return (null, EsitoCorrezione.No(400, "codice_sconosciuto", $"Il codice «{fe.Codice}» non è in questo prodotto."));
            if (fe.Stato is < 1 or > 3)
                return (null, EsitoCorrezione.No(400, "stato_foto", "Stato della foto non valido."));
            string guid = string.IsNullOrWhiteSpace(fe.GuidId) ? rec.GuidFoto : fe.GuidId.Trim();
            string nome = rec.NomeFoto;
            string md5 = "";
            if (guid != rec.GuidFoto)
            {
                // Puo' essere una foto caricata da qui (j217): Istanta non la conosce ancora, e alla conferma
                // la crea sull'articolo con questi nome e md5. Altrimenti dev'essere una foto sua.
                var caricata = await ctx.VolantiniFotoCaricates.AsNoTracking()
                    .Where(f => f.IdElemento == box.Id && f.Codice == rec.Codice && f.GuidId == guid)
                    .OrderByDescending(f => f.Id).FirstOrDefaultAsync();
                if (caricata != null)
                {
                    nome = caricata.NomeFile;
                    md5 = caricata.Md5;
                }
                else
                {
                    var elenco = await fico.FotoDelCodiceAsync(u.Id, rec.Codice);
                    if (!elenco.Ok) return (null, IstantaNonDisponibile(elenco.Errore));
                    var scelta = elenco.Dati!.FirstOrDefault(x => x.GuidId == guid);
                    if (scelta == null)
                        return (null, EsitoCorrezione.No(400, "foto_sconosciuta", $"La foto scelta per {rec.Codice} non è fra quelle di Istanta."));
                    nome = scelta.Nome;
                }
            }
            finale[rec.Codice] = fe.Stato;
            if (guid != rec.GuidFoto || fe.Stato != StatoIstanta(rec))
                voci.Add(new VoceFoto { guidid = guid, codice = rec.Codice, nomeFile = nome, md5 = md5, stato = fe.Stato });
        }
        if (voci.Count > 0)
        {
            int primarie = finale.Values.Count(x => x == 1);
            if (primarie != 1)
                return (null, EsitoCorrezione.No(400, "una_primaria", primarie == 0
                    ? "Deve esserci una foto primaria (P)."
                    : "Ci può essere una sola foto primaria (P): togli la P dalle altre."));
        }

        var presenti = refs.SelectMany(f => f.Loghi).GroupBy(l => l.GuidId).ToDictionary(g => g.Key, g => g.First());
        List<LogoIstanta>? catalogoLoghi = null;
        foreach (var le in r.Loghi ?? new())
        {
            string guid = (le.GuidId ?? "").Trim();
            if (guid == "" || voci.Any(v => v.guidid == guid && v.stato >= 4)) continue;
            if (le.Stato == 4)
            {
                if (presenti.ContainsKey(guid)) continue;   // c'e' gia'
                if (catalogoLoghi == null)
                {
                    var c = await fico.CatalogoLoghiAsync(u.Id);
                    if (!c.Ok) return (null, IstantaNonDisponibile(c.Errore));
                    catalogoLoghi = c.Dati!;
                }
                var logo = catalogoLoghi.FirstOrDefault(l => l.GuidId == guid);
                if (logo == null)
                    return (null, EsitoCorrezione.No(400, "logo_sconosciuto", "Il logo scelto non è nel catalogo di Istanta."));
                voci.Add(new VoceFoto { guidid = guid, codice = logo.Sigla, nomeFile = logo.Nome, md5 = "", stato = 4 });
            }
            else if (le.Stato == 5)
            {
                if (!presenti.TryGetValue(guid, out var logo)) continue;   // non c'e' piu'
                voci.Add(new VoceFoto { guidid = guid, codice = logo.Sigla, nomeFile = logo.Nome, md5 = "", stato = 5 });
            }
            else return (null, EsitoCorrezione.No(400, "stato_logo", "Operazione sul logo non valida."));
        }
        return (voci, null);
    }

    private static int StatoIstanta(FotoIstanta f) => f.StatoSelezione is 1 or 2 ? f.StatoSelezione : 3;

    private static EsitoCorrezione IstantaNonDisponibile(string? motivo) =>
        EsitoCorrezione.No(502, "istanta", (motivo ?? "Istanta non risponde.") + " Foto e loghi non si possono salvare adesso.");

    // ------------------------------------------------------------------ letture da Istanta per la scheda

    public async Task<EsitoCorrezione> SchedaFotoAsync(Utente u, long idBox)
    {
        var box = await ctx.VolantiniPagineElementis.AsNoTracking().FirstOrDefaultAsync(e => e.Id == idBox && e.IdParent == null);
        if (box == null) return NonTrovata("Prodotto non trovato.");
        int idVol = await IdVolantinoAsync(box.IdPagina);
        var vol = await ctx.Volantinis.AsNoTracking().FirstAsync(v => v.Id == idVol);
        var s = await fico.SchedaAsync(u.Id, vol.GuidKitRuntime, box.Basecode);
        return s.Ok ? EsitoCorrezione.Fatto(new { foto = s.Dati }) : EsitoCorrezione.No(502, "istanta", s.Errore!);
    }

    public async Task<EsitoCorrezione> FotoDelCodiceAsync(Utente u, string? codice)
    {
        if (string.IsNullOrWhiteSpace(codice)) return NonTrovata("Codice mancante.");
        var s = await fico.FotoDelCodiceAsync(u.Id, codice.Trim());
        return s.Ok ? EsitoCorrezione.Fatto(s.Dati) : EsitoCorrezione.No(502, "istanta", s.Errore!);
    }

    public async Task<EsitoCorrezione> CatalogoLoghiAsync(Utente u)
    {
        var s = await fico.CatalogoLoghiAsync(u.Id);
        return s.Ok ? EsitoCorrezione.Fatto(s.Dati) : EsitoCorrezione.No(502, "istanta", s.Errore!);
    }

    // ------------------------------------------------------------------ annulla e conferma

    public async Task<EsitoCorrezione> AnnullaEditAsync(Utente u, long idBox, string? parte)
    {
        if (!u.Scrive) return NonAutorizzato();
        if (parte is not (ParteOfferta or ParteDescrizione)) return NonTrovata("Parte della scheda sconosciuta.");
        var (box, vol, errore) = await BoxScrivibileAsync(u, idBox);
        if (errore != null) return errore;

        var (righe, capo) = await RigheParteAsync(box!.Id, parte);
        if (capo == null || capo.Stato == EaAnnullato)
            return NonTrovata("Non c'è nessuna correzione da annullare.");
        if (capo.Stato == EaCorretto)
            return EsitoCorrezione.No(409, "gia_confermata",
                "L'Agenzia ha già confermato questa correzione: non si può più annullare.");
        if (capo.IdAutore != u.Id)
            return EsitoCorrezione.No(403, "non_autore",
                $"La correzione è di {await NomeUtenteAsync(capo.IdAutore)}: può annullarla solo chi l'ha fatta.");

        foreach (var riga in righe.Where(x => x.Stato == EaRegistrato)) riga.Stato = EaAnnullato;
        await ctx.SaveChangesAsync();
        return Fatto(await CaricaAsync(vol!.Id, u), box.Id);
    }

    public async Task<EsitoCorrezione> ConfermaEditAsync(Utente u, long idBox, string? parte)
    {
        if (!u.Accetta) return NonAutorizzato("Solo l'Agenzia conferma le correzioni.");
        if (parte is not (ParteOfferta or ParteDescrizione)) return NonTrovata("Parte della scheda sconosciuta.");
        var box = await ctx.VolantiniPagineElementis.AsNoTracking()
            .FirstOrDefaultAsync(e => e.Id == idBox && e.IdParent == null);
        if (box == null) return NonTrovata("Prodotto non trovato.");

        var (righe, capo) = await RigheParteAsync(box.Id, parte);
        if (capo == null || capo.Stato == EaAnnullato)
            return NonTrovata("Non c'è nessuna correzione da confermare: forse è stata annullata.");
        if (capo.Stato == EaCorretto)
            return EsitoCorrezione.No(409, "gia_confermata", "La correzione è già stata confermata.");
        var finestraAperta = await FinestraApertaAsync(box.IdPagina);   // j209
        if (finestraAperta != null) return finestraAperta;

        // Passo 2 (decisione dell'11/9): il cambio foto va a Istanta; se Istanta rifiuta la conferma non
        // passa e la correzione resta in attesa. L'originale (Service.cs:2720) confermava comunque.
        if (parte == ParteDescrizione)
        {
            var figlioImm = await ctx.VolantiniPagineElementis.AsNoTracking()
                .FirstOrDefaultAsync(e => e.IdParent == box.Id && e.LabelInd == SchemaReferenza.LabelImmagine);
            var rigaImm = figlioImm == null ? null
                : righe.FirstOrDefault(v => v.IdElemento == figlioImm.Id && v.Stato == EaRegistrato);
            var voci = rigaImm == null ? new List<VoceFoto>() : LeggiVociFoto(rigaImm.NuovaVersione);
            if (voci.Count > 0)
            {
                int idVol = await IdVolantinoAsync(box.IdPagina);
                var vol = await ctx.Volantinis.AsNoTracking().FirstAsync(v => v.Id == idVol);
                var esito = await fico.CorreggiFotoAsync(u.Id, vol.GuidKitRuntime, box.Basecode, voci);
                if (!esito.Ok)
                    return EsitoCorrezione.No(502, "istanta_rifiuta",
                        $"Istanta non ha accettato il cambio foto ({esito.Errore}). La correzione resta in attesa: riprova più tardi.");
            }
        }

        // TODO finestra Category: come AccettaNotaAsync, quando esistera' si rifiuta a finestra aperta.
        foreach (var riga in righe.Where(x => x.Stato == EaRegistrato)) riga.Stato = EaCorretto;
        await ctx.SaveChangesAsync();
        return Fatto(await CaricaAsync(await IdVolantinoAsync(box.IdPagina), u), box.Id);
    }

    // ------------------------------------------------------------------ appoggio

    private static List<long> IdElementiParte(long idBox, IEnumerable<VolantiniPagineElementi> figli, string parte) =>
        parte == ParteDescrizione
            ? figli.Where(f => f.LabelInd == SchemaReferenza.LabelDescrizione || f.LabelInd == SchemaReferenza.LabelImmagine)
                   .Select(f => f.Id).ToList()
            : figli.Where(f => f.LabelInd != SchemaReferenza.LabelDescrizione && f.LabelInd != SchemaReferenza.LabelImmagine)
                   .Select(f => f.Id).Append(idBox).ToList();

    private async Task<(List<VolantiniPagineElementiVersioni> Righe, VolantiniPagineElementiVersioni? Capo)>
        RigheParteAsync(long idBox, string parte)
    {
        var figli = await ctx.VolantiniPagineElementis.AsNoTracking().Where(e => e.IdParent == idBox).ToListAsync();
        var ids = IdElementiParte(idBox, figli, parte);
        var righe = await ctx.VolantiniPagineElementiVersionis.Where(v => ids.Contains(v.IdElemento)).ToListAsync();
        var capo = parte == ParteOfferta
            ? righe.FirstOrDefault(v => v.IdElemento == idBox) ?? righe.FirstOrDefault()
            : righe.FirstOrDefault();
        return (righe, capo);
    }

    private static VolantiniPagineElementiVersioni NuovaRiga(long idElemento, int idPagina, short idAutore,
                                                            DateTime adesso, string registro) => new()
    {
        IdElemento = idElemento,
        IdPagina = idPagina,
        NewPosx = 0,
        NewPosy = 0,
        NuovaVersione = registro,
        DataModifica = adesso,
        IdAutore = idAutore,
        Stato = EaRegistrato
    };

    private static (bool Ok, string Valore, string? Messaggio) NormalizzaValore(IstruzioneReferenza istr, string? grezzo)
    {
        string s = (grezzo ?? "").Trim();
        string nome = Etichetta(istr.Field);
        if (istr.Scelta)
            return istr.Valore.Contains(s) ? (true, s, null) : (false, "", $"«{s}» non è un valore ammesso per {nome}.");
        if (s.Length == 0)
            return (false, "", $"manca il valore di «{nome}».");
        if (istr.Numero)
        {
            if (!IstruzioneReferenza.ProvaNumero(s, out decimal n) || n < 0 || n >= 1_000_000)
                return (false, "", $"«{s}» non è un numero valido per {nome}.");
            return (true, n.ToString("0.00", CultureInfo.InvariantCulture), null);
        }
        if (s.Length > LunghezzaMassimaValore)
            return (false, "", $"il valore di {nome} è troppo lungo.");
        return (true, s, null);
    }

    private static bool StessoValore(IstruzioneReferenza istr, string valore, string originale)
    {
        if (istr.Numero && IstruzioneReferenza.ProvaNumero(valore, out decimal a)
                        && IstruzioneReferenza.ProvaNumero(originale, out decimal b))
            return Math.Round(a, 2) == Math.Round(b, 2);
        return string.Equals(valore.Trim(), (originale ?? "").Trim(), StringComparison.Ordinal);
    }

    private static string Compatta(string? s) => Spazi().Replace(s ?? "", " ").Trim();

    private static string Etichetta(string field) =>
        EtichetteCampi.TryGetValue(SchemaReferenza.ChiaveTracciato(field), out var e) ? e : field;

    private async Task<string> NomeUtenteAsync(short idUtente) =>
        await ctx.Utentis.AsNoTracking().Where(x => x.Id == idUtente)
                 .Select(x => x.Nome + " " + x.Cognome).FirstOrDefaultAsync() ?? "un altro utente";

    private static EsitoCorrezione SenzaSchema() =>
        EsitoCorrezione.No(409, "senza_schema",
            "Questo prodotto non ha le istruzioni dell'Edit avanzato: il volantino va riesportato da InDesign.");

    private static EsitoCorrezione CorrezioneAltrui(string autore) =>
        EsitoCorrezione.No(403, "non_autore",
            $"C'è già una correzione di {autore} in attesa dell'Agenzia: finché non è confermata può modificarla solo chi l'ha fatta.");
}
