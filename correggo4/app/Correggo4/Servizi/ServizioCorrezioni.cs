using System.Text.Json;
using Correggo4.Auth;
using Correggo4.Data;
using Correggo4.Models;
using Correggo4.Models.Vista;
using Microsoft.EntityFrameworkCore;

namespace Correggo4.Servizi;

/// <summary>
/// Esito di un'operazione sulle correzioni. Codice e' stabile (lo legge il client),
/// Messaggio e' in italiano per l'utente.
/// </summary>
public sealed record EsitoCorrezione(bool Ok, int Http, string? Codice = null, string? Messaggio = null, object? Dati = null)
{
    public static EsitoCorrezione Fatto(object? dati = null) => new(true, 200, null, null, dati);
    public static EsitoCorrezione No(int http, string codice, string messaggio) => new(false, http, codice, messaggio);
}

/// <summary>
/// Il giro base delle correzioni: note, timbri, OK visto. Regole prese dal Correggo originale
/// (Service.cs: salvaNota, eliminaNota, confermaNota, salvaDisegno, eliminaDisegno,
/// confermaDisegno, setRefOk) con le decisioni dell'11/9/2026 (vedi correggo4-correzioni.md):
///
///  - scrivono Category e Marketing (utenti.ruolo = 1), accetta l'Agenzia (ruolo = 2), una per una;
///  - si modifica ed elimina solo cio' che si e' scritto, e solo finche' non e' accettato;
///  - volantino bloccato o scaduto: niente scritture (l'Agenzia accetta anche dopo la scadenza,
///    e' proprio il momento in cui lo fa);
///  - una nota si accetta 5 minuti dopo l'ultimo salvataggio.
///
/// A differenza dell'originale, TUTTI i controlli di ruolo e di autore stanno qui, sul server:
/// l'originale li lasciava al JavaScript.
/// </summary>
// partial dal j200: l'Edit avanzato sta in ServizioCorrezioni.EditAvanzato.cs
public sealed partial class ServizioCorrezioni
{
    public const short StatoNonVerificata = 0;
    public const short StatoAccettata = 1;      // "Corretta" nell'originale
    public const short StatoEliminata = 2;
    public const short StatoArchiviato = 5;

    public const short TipoNotaTestuale = 1;
    public const short TipoNotaPromemoria = 4;

    public const short TipoFicoCategory = 6;
    public const short TipoFicoMarketing = 7;

    /// <summary>Service.cs:38 TEMPO_DI_BATTITURA_NOTA = 300 (il commento dice "10 minuti": sono 5).</summary>
    public const int SecondiBattitura = 300;

    public const int LunghezzaMassimaNota = 2000;

    /// <summary>
    /// I timbri del pannello, con i nomi-file dell'originale (Scripts/agenzia.js:44-77).
    /// Mancano i quattro di dimensione (_3_1_x2, _3_2_x4, _3_3_meta, _3_4_un_quarto): nell'originale
    /// la policy dei Category li escludeva, e il pannello di Correggo4 non li ha mai mostrati.
    /// </summary>
    public static readonly IReadOnlyDictionary<string, string> Timbri = new Dictionary<string, string>
    {
        ["_1_1_fvol"] = "Fuori volantino",
        ["_1_2_elimina"] = "Elimina",
        ["_2_1_artwork"] = "ArtWork",
        ["_2_2_star"] = "Star",
        ["_2_3_g1"] = "Gruppo 1",
        ["_2_4_g2"] = "Gruppo 2",
        ["_2_5_g3"] = "Gruppo 3",
        ["_2_6_g4"] = "Gruppo 4",
        ["_4_1_aconf"] = "A confezione",
        ["_4_2_alkg"] = "Al kg",
        ["_4_3_cad"] = "Cadauno",
        ["_4_4_pz"] = "Al pezzo",
        ["_6_1_cambia_foto"] = "Cambia foto",
        ["_6_2_foto_email"] = "Foto via e-mail",
    };

    private readonly Correggo4Context ctx;
    private readonly ClienteFico fico;   // Olimpo e Istanta, per foto e loghi (passo 2, j206)
    private readonly ServizioPropagazione propagazione;   // catene dei gemelli (j222)

    public ServizioCorrezioni(Correggo4Context ctx, ClienteFico fico, ServizioPropagazione propagazione)
    {
        this.ctx = ctx;
        this.fico = fico;
        this.propagazione = propagazione;
    }

    // ------------------------------------------------------------------ utente

    public sealed record Utente(short Id, short Ruolo, short? TipoFico, string Nome)
    {
        public bool Scrive => Ruolo == Ruoli.CodiceGdo;
        public bool Accetta => Ruolo == Ruoli.CodiceAgenzia;
        public string Tipo => Ruolo == Ruoli.CodiceAgenzia ? "Agenzia" : TipoTesto(TipoFico);
    }

    public static string TipoTesto(short? tipoFico) => tipoFico switch
    {
        TipoFicoCategory => "Category",
        TipoFicoMarketing => "Marketing",
        _ => ""
    };

    public async Task<Utente?> UtenteAsync(short idUtente)
    {
        var u = await ctx.Utentis.AsNoTracking().FirstOrDefaultAsync(x => x.Id == idUtente && x.Attivo);
        return u == null ? null : new Utente(u.Id, u.Ruolo, u.TipoUtenteFico, $"{u.Nome} {u.Cognome}");
    }

    // ------------------------------------------------------------------ lettura

    /// <summary>Tutte le correzioni visibili delle pagine dell'ultima versione di un volantino.</summary>
    public async Task<StatoCorrezioni> CaricaAsync(int idVolantino, Utente utente, short? versioneRichiesta = null)
    {
        var vol = await ctx.Volantinis.AsNoTracking().FirstAsync(v => v.Id == idVolantino);
        // Senza versione: l'ultima (quella che si corregge). Con versione: lo storico (j213).
        short versione = versioneRichiesta ?? await ctx.VolantiniPagines.Where(p => p.IdVol == idVolantino)
                                  .MaxAsync(p => (short?)p.Versione) ?? 0;
        var pagine = await ctx.VolantiniPagines.AsNoTracking()
            .Where(p => p.IdVol == idVolantino && p.Versione == versione)
            .Select(p => new { p.Id, p.Numero }).ToListAsync();
        var idPagine = pagine.Select(p => p.Id).ToList();
        var numero = pagine.ToDictionary(p => p.Id, p => p.Numero);

        var finestra = await FinestreCategory.LeggiAsync(ctx, vol.Classificazione);
        bool finestraAperta = FinestreCategory.Aperta(finestra, DateTime.UtcNow);

        var utenti = await ctx.Utentis.AsNoTracking()
            .Select(u => new { u.Id, Nome = u.Nome + " " + u.Cognome, u.TipoUtenteFico, u.Ruolo })
            .ToDictionaryAsync(u => u.Id);
        string nome(short? id) => id != null && utenti.TryGetValue(id.Value, out var u) ? u.Nome : "";
        string tipo(short? id) => id != null && utenti.TryGetValue(id.Value, out var u)
            ? (u.Ruolo == Ruoli.CodiceAgenzia ? "Agenzia" : TipoTesto(u.TipoUtenteFico)) : "";

        var note = await ctx.VolantiniPagineNotes.AsNoTracking()
            .Where(n => idPagine.Contains(n.IdPagina) && n.Stato != StatoEliminata && n.Stato != StatoArchiviato)
            .OrderBy(n => n.Id).ToListAsync();

        var comp = await ctx.VolantiniPagineDisegniComposizionis.AsNoTracking()
            .Where(c => idPagine.Contains(c.IdPagina) && c.Simbolo != "penna"
                        && c.Stato != StatoEliminata && c.Stato != StatoArchiviato)
            .OrderBy(c => c.Id).ToListAsync();
        var idComp = comp.Select(c => c.Id).ToList();
        var punti = await ctx.VolantiniPagineDisegnis.AsNoTracking()
            .Where(d => idComp.Contains(d.IdGruppo))
            .Select(d => new { d.IdGruppo, d.Vectors }).ToListAsync();

        var ok = await ctx.VolantiniPagineElementis.AsNoTracking()
            .Where(e => idPagine.Contains(e.IdPagina) && e.IdParent == null && e.Stato == 1)
            .Select(e => new { e.Id, e.IdPagina, e.IdAutoreOk, e.DataOk }).ToListAsync();

        var adesso = DateTime.UtcNow;
        var statoCorrezioni = new StatoCorrezioni
        {
            IdUtente = utente.Id,
            TipoUtente = utente.Tipo,
            PuoScrivere = utente.Scrive,
            PuoAccettare = utente.Accetta,
            Adesso = adesso,
            SecondiBattitura = SecondiBattitura,
            Bloccato = Bloccato(vol, adesso),
            Scaduto = Scaduto(vol, adesso),
            FinestraAperta = finestraAperta,
            FinestraFine = finestra?.DataFine,
            FinestraChiusaPerTe = utente.TipoFico == TipoFicoCategory && !finestraAperta,
            Versione = versione,
            // j307: le pagine che il timone ha cambiato. Si mandano a tutti: all'Agenzia servono
            // per sapere dove mettere le mani, agli altri per vedere il velo con la scritta.
            PagineDaSistemare = (await PagineDaSistemareAsync(idVolantino, versione)).OrderBy(n => n).ToList(),
            Note = note.Select(n => new NotaVista
            {
                Id = n.Id, IdBox = n.IdElemento, IdPagina = n.IdPagina, Pagina = numero[n.IdPagina],
                Testo = n.Descrizione, X = n.Posx, Y = n.Posy, Stato = n.Stato,
                IdAutore = n.IdAutore, Autore = nome(n.IdAutore), TipoAutore = tipo(n.IdAutore),
                DataInserimento = n.DataInserimento, DataModifica = n.DataModifica,
                Correttore = nome(n.IdCorrettore), DataCorrezione = n.DataCorrezione
            }).ToList(),
            Timbri = comp.Select(c =>
            {
                var (x, y) = Punto(punti.FirstOrDefault(p => p.IdGruppo == c.Id)?.Vectors);
                return new TimbroVista
                {
                    Id = c.Id, IdBox = c.IdElemento, IdPagina = c.IdPagina, Pagina = numero[c.IdPagina],
                    Simbolo = c.Simbolo, Nome = ServizioCorrezioni.Timbri.TryGetValue(c.Simbolo, out var nm) ? nm : c.Simbolo,
                    X = x, Y = y, Stato = c.Stato,
                    IdAutore = c.IdAutore, Autore = nome(c.IdAutore), TipoAutore = tipo(c.IdAutore),
                    DataInserimento = c.DataInserimento,
                    Correttore = nome(c.IdCorrettore), DataCorrezione = c.DataCorrezione
                };
            }).ToList(),
            Ok = ok.Select(o => new OkVista
            {
                IdBox = o.Id, IdPagina = o.IdPagina, IdAutore = o.IdAutoreOk,
                Autore = nome(o.IdAutoreOk), Data = o.DataOk
            }).ToList(),
            Edit = await CaricaEditAsync(idPagine, numero, nome, tipo)
        };

        // Catene dei gemelli (j223): quel tanto che serve al megafono su ogni correzione.
        var (perNota, perTimbro) = await propagazione.StatiAsync(idPagine);
        foreach (var n in statoCorrezioni.Note)
            if (perNota.TryGetValue(n.Id, out var pn)) n.Propagazione = pn;
        foreach (var t in statoCorrezioni.Timbri)
            if (perTimbro.TryGetValue(t.Id, out var pt)) t.Propagazione = pt;

        // j225: le propagazioni arrivate da altri volantini, come l'originale le mostra sul gemello.
        statoCorrezioni.Propagate = await propagazione.RicevuteAsync(utente, idPagine, numero,
            statoCorrezioni.Bloccato || statoCorrezioni.Scaduto || statoCorrezioni.SolaLettura);
        return statoCorrezioni;
    }

    // ------------------------------------------------------------------ note

    public async Task<EsitoCorrezione> NuovaNotaAsync(Utente u, long idBox, string? testo, double x, double y)
    {
        if (!u.Scrive) return NonAutorizzato();
        var (box, vol, errore) = await BoxScrivibileAsync(u, idBox);
        if (errore != null) return errore;

        string? t = PulisciTesto(testo, out var erroreTesto);
        if (t == null) return erroreTesto!;

        var adesso = DateTime.UtcNow;
        var nota = new VolantiniPagineNote
        {
            IdPagina = box!.IdPagina,
            IdElemento = box.Id,
            Tipo = TipoNotaTestuale,
            Descrizione = t,
            Posx = x,
            Posy = y,
            Stato = StatoNonVerificata,
            IdAutore = u.Id,
            DataInserimento = adesso,
            DataModifica = adesso
        };
        ctx.VolantiniPagineNotes.Add(nota);
        await ctx.SaveChangesAsync();
        // La catena la costruisce il demone: qui si registra solo il lavoro (j222, come l'originale).
        await propagazione.GeneraPerNotaAsync(nota.Id, box!.Id, vol!.Id);
        return Fatto(await CaricaAsync(vol!.Id, u), nota.Id);
    }

    public async Task<EsitoCorrezione> ModificaNotaAsync(Utente u, long idNota, string? testo)
    {
        if (!u.Scrive) return NonAutorizzato();
        var nota = await ctx.VolantiniPagineNotes.FirstOrDefaultAsync(n => n.Id == idNota);
        if (nota == null || nota.Stato == StatoEliminata) return NonTrovata("La nota non esiste più.");
        if (nota.IdAutore != u.Id) return NonAutore();
        if (nota.Stato != StatoNonVerificata) return GiaAccettata();

        var (vol, errore) = await VolantinoScrivibileAsync(u, nota.IdPagina);
        if (errore != null) return errore;

        string? t = PulisciTesto(testo, out var erroreTesto);
        if (t == null) return erroreTesto!;

        // A differenza dell'originale (S:3114) l'autore NON si sovrascrive: resta chi l'ha scritta.
        nota.Descrizione = t;
        nota.DataModifica = DateTime.UtcNow;
        await ctx.SaveChangesAsync();
        return Fatto(await CaricaAsync(vol!.Id, u), nota.Id);
    }

    public async Task<EsitoCorrezione> EliminaNotaAsync(Utente u, long idNota)
    {
        if (!u.Scrive) return NonAutorizzato();
        var nota = await ctx.VolantiniPagineNotes.FirstOrDefaultAsync(n => n.Id == idNota);
        if (nota == null || nota.Stato == StatoEliminata) return NonTrovata("La nota è già stata eliminata.");
        if (nota.IdAutore != u.Id) return NonAutore();
        if (nota.Stato != StatoNonVerificata) return GiaAccettata();

        var (vol, errore) = await VolantinoScrivibileAsync(u, nota.IdPagina);
        if (errore != null) return errore;

        // Cancellazione logica, come l'originale (S:4467).
        nota.Stato = StatoEliminata;
        nota.DataModifica = DateTime.UtcNow;
        await ctx.SaveChangesAsync();
        await propagazione.ChiudiPerNotaAsync(nota.Id);
        return Fatto(await CaricaAsync(vol!.Id, u), nota.Id);
    }

    public async Task<EsitoCorrezione> AccettaNotaAsync(Utente u, long idNota)
    {
        if (!u.Accetta) return NonAutorizzato("Solo l'Agenzia accetta le correzioni.");
        var nota = await ctx.VolantiniPagineNotes.FirstOrDefaultAsync(n => n.Id == idNota);
        if (nota == null || nota.Stato == StatoEliminata) return NonTrovata("La nota è stata eliminata.");
        if (nota.Stato == StatoAccettata) return GiaAccettata();
        if (nota.Stato != StatoNonVerificata) return EsitoCorrezione.No(409, "stato_non_accettabile", "Questa correzione non si può accettare.");
        if (nota.Tipo == TipoNotaPromemoria) return EsitoCorrezione.No(409, "promemoria", "Un promemoria non si accetta.");

        var adesso = DateTime.UtcNow;
        var ultima = nota.DataModifica ?? nota.DataInserimento;
        int mancano = SecondiBattitura - (int)Math.Floor((adesso - ultima).TotalSeconds);
        if (mancano > 0)
            return new EsitoCorrezione(false, 409, "in_battitura",
                $"La nota è stata modificata da poco: si potrà accettare tra {TempoLeggibile(mancano)}.",
                new { secondi = mancano });

        var finestraAperta = await FinestraApertaAsync(nota.IdPagina);   // j209, decisione dell'11/9
        if (finestraAperta != null) return finestraAperta;
        nota.Stato = StatoAccettata;
        nota.IdCorrettore = u.Id;
        nota.DataCorrezione = adesso;
        await ctx.SaveChangesAsync();
        return Fatto(await CaricaAsync(await IdVolantinoAsync(nota.IdPagina), u), nota.Id);
    }

    // ------------------------------------------------------------------ timbri

    public async Task<EsitoCorrezione> NuovoTimbroAsync(Utente u, long idBox, string? simbolo, double x, double y)
    {
        if (!u.Scrive) return NonAutorizzato();
        if (string.IsNullOrWhiteSpace(simbolo) || !Timbri.ContainsKey(simbolo))
            return EsitoCorrezione.No(400, "timbro_sconosciuto", "Timbro non riconosciuto.");

        var (box, vol, errore) = await BoxScrivibileAsync(u, idBox);
        if (errore != null) return errore;

        // j237: la policy puo' escludere dei timbri (nell'originale ai Category venivano tolti i
        // quattro di dimensione `_3_*`, PolicyManager.cs:405-440). Il pannello non li mostra, e qui
        // il server rifiuta comunque.
        var policy = await PolicyAsync(u.Id);
        if (policy != null && !policy.StrumentoPermesso("timbro", simbolo))
            return EsitoCorrezione.No(403, "timbro_fuori_policy",
                $"Il timbro «{Timbri[simbolo]}» non e' fra quelli che puoi usare.");

        // Un simbolo per box (S:3408-3453).
        bool esiste = await ctx.VolantiniPagineDisegniComposizionis.AnyAsync(c =>
            c.IdElemento == box!.Id && c.Simbolo == simbolo && c.Stato != StatoEliminata);
        if (esiste)
            return EsitoCorrezione.No(409, "gia_presente", $"Il timbro «{Timbri[simbolo]}» è già su questo prodotto.");

        var comp = new VolantiniPagineDisegniComposizioni
        {
            IdPagina = box!.IdPagina,
            IdElemento = box.Id,
            Simbolo = simbolo,
            Color = "yellow",   // valori fissi dell'originale (S:3472-3490)
            Border = 5,
            Stato = StatoNonVerificata,
            IdAutore = u.Id,
            DataInserimento = DateTime.UtcNow
        };
        ctx.VolantiniPagineDisegniComposizionis.Add(comp);
        await ctx.SaveChangesAsync();

        // L'originale salva un solo punto in pixel della pagina (margine compreso); qui nelle
        // unita' della pagina, le stesse delle note e dei box.
        ctx.VolantiniPagineDisegnis.Add(new VolantiniPagineDisegni
        {
            IdGruppo = comp.Id,
            Vectors = JsonSerializer.Serialize(new[] { new { x, y } })
        });
        await ctx.SaveChangesAsync();
        await propagazione.GeneraPerTimbroAsync(comp.Id, box!.Id, vol!.Id, simbolo);
        return Fatto(await CaricaAsync(vol!.Id, u), comp.Id);
    }

    public async Task<EsitoCorrezione> EliminaTimbroAsync(Utente u, long idTimbro)
    {
        if (!u.Scrive) return NonAutorizzato();
        var comp = await ctx.VolantiniPagineDisegniComposizionis.FirstOrDefaultAsync(c => c.Id == idTimbro);
        if (comp == null || comp.Stato == StatoEliminata) return NonTrovata("Il timbro è già stato eliminato.");
        if (comp.IdAutore != u.Id) return NonAutore();
        if (comp.Stato != StatoNonVerificata) return GiaAccettata();

        var (vol, errore) = await VolantinoScrivibileAsync(u, comp.IdPagina);
        if (errore != null) return errore;

        comp.Stato = StatoEliminata;
        await ctx.SaveChangesAsync();
        await propagazione.ChiudiPerTimbroAsync(comp.Id);
        return Fatto(await CaricaAsync(vol!.Id, u), comp.Id);
    }

    public async Task<EsitoCorrezione> AccettaTimbroAsync(Utente u, long idTimbro)
    {
        if (!u.Accetta) return NonAutorizzato("Solo l'Agenzia accetta le correzioni.");
        var comp = await ctx.VolantiniPagineDisegniComposizionis.FirstOrDefaultAsync(c => c.Id == idTimbro);
        if (comp == null || comp.Stato == StatoEliminata) return NonTrovata("Il timbro è stato eliminato.");
        if (comp.Stato == StatoAccettata) return GiaAccettata();
        if (comp.Stato != StatoNonVerificata) return EsitoCorrezione.No(409, "stato_non_accettabile", "Questa correzione non si può accettare.");

        var finestraAperta = await FinestraApertaAsync(comp.IdPagina);   // j209
        if (finestraAperta != null) return finestraAperta;
        // Per i timbri l'originale non ha il tempo di battitura (S:6834-6846).
        comp.Stato = StatoAccettata;
        comp.IdCorrettore = u.Id;
        comp.DataCorrezione = DateTime.UtcNow;
        await ctx.SaveChangesAsync();
        return Fatto(await CaricaAsync(await IdVolantinoAsync(comp.IdPagina), u), comp.Id);
    }

    // ------------------------------------------------------------------ OK visto

    public async Task<EsitoCorrezione> ImpostaOkAsync(Utente u, long idBox, bool attivo)
    {
        if (!u.Scrive) return NonAutorizzato();
        var (box, vol, errore) = await BoxScrivibileAsync(u, idBox, traccia: true);
        if (errore != null) return errore;

        if (attivo)
        {
            if (box!.Stato != 1)
            {
                box.Stato = 1;
                box.DataOk = DateTime.UtcNow;
                box.IdAutoreOk = u.Id;
            }
        }
        else if (box!.Stato == 1)
        {
            // Lo toglie solo chi l'ha messo, come per le correzioni.
            if (box.IdAutoreOk != null && box.IdAutoreOk != u.Id)
                return EsitoCorrezione.No(403, "non_autore", "L'OK è stato messo da un altro utente: può toglierlo solo lui.");
            box.Stato = 0;
            box.DataOk = null;
            box.IdAutoreOk = null;
        }
        await ctx.SaveChangesAsync();
        return Fatto(await CaricaAsync(vol!.Id, u), box.Id);
    }

    // ------------------------------------------------------------------ regole comuni

    public static bool Bloccato(Volantini v, DateTime adesso) =>
        v.IdAutoreBlocco != null && v.DataScadenzaBlocco != null && v.DataScadenzaBlocco > adesso;

    /// <summary>S:3046: data_scadenza passata = correzioni chiuse.</summary>
    public static bool Scaduto(Volantini v, DateTime adesso) => v.DataScadenza < adesso;

    private async Task<(VolantiniPagineElementi? Box, Volantini? Vol, EsitoCorrezione? Errore)>
        BoxScrivibileAsync(Utente u, long idBox, bool traccia = false)
    {
        var q = ctx.VolantiniPagineElementis.Where(e => e.Id == idBox && e.IdParent == null);
        var box = traccia ? await q.FirstOrDefaultAsync() : await q.AsNoTracking().FirstOrDefaultAsync();
        if (box == null) return (null, null, NonTrovata("Prodotto non trovato."));
        var (vol, errore) = await VolantinoScrivibileAsync(u, box.IdPagina);
        if (errore != null) return (box, vol, errore);
        // j236: la policy di correzione. Questo e' l'imbuto di tutte le scritture su un prodotto
        // (nota, timbro, OK visto, Edit avanzato, carica foto, propagazione dell'Edit avanzato):
        // il controllo sta qui una volta sola. L'originale non lo faceva affatto lato server.
        return (box, vol, await FuoriPolicyAsync(u, box));
    }

    /* ================= LE PAGINE IN ATTESA CHE L'AGENZIA SISTEMI L'IMPAGINATO (j307) =========

       Michele, 29/09: «se viene salvata la pagina con delle modifiche, l'utente (quindi il
       marketing) non puo' in nessun modo fare nessuna modifica sul volantino di correggo normale
       (non sul timone). Dovra' essere tutto oscurato con la scritta "In attesa che l'Agenzia
       sistemi l'impaginato.". Il marketing quindi a quel punto potra' solo ed esclusivamente
       utilizzare il timone (ovviamente SOLO sulle pagine che hanno modificato, se non c'e' alcuna
       modifica lasciamoli correggere in santa pace)».
       Deciso con lui: si bloccano tutti tranne l'Agenzia; si sblocca quando arriva una versione
       nuova del volantino; su quelle pagine non resta niente, solo il timone.

       QUALE PAGINA E' «CAMBIATA», e perche' si guarda la data invece di confrontare le posizioni.
       Ogni voce del timone porta una data_modifica che il salvataggio mette SOLO quando quella voce
       e' cambiata davvero (ServizioTimone.Salva.cs), e che all'apertura del piano vale null. Quindi
       «cambiata» e' scritto nei dati, e non si deve dedurre.
       Confrontare posizione con posizione_origine sembrava piu' diretto ed e' sbagliato: le
       referenze di un gruppo nascono con posizione null e posizione_origine valorizzata (j290), e
       ogni pagina con un gruppo risulterebbe cambiata senza che nessuno l'abbia toccata - cioe' si
       bloccherebbe una pagina per niente, che qui vuol dire fermare il lavoro di qualcuno.

       Una pagina e' in attesa se, nel piano di QUESTA versione e con almeno un salvataggio fatto:
         - una voce cambiata sta adesso in quella pagina, oppure
         - una voce cambiata VENIVA da quella pagina (se una referenza e' andata via, l'impaginato
           di dove stava prima va rifatto tanto quanto quello di dove e' arrivata), oppure
         - su quella pagina c'e' una casella bloccata (il divieto e' una richiesta all'Agenzia:
           «qui lasciami lo spazio»).
       Se il piano non e' mai stato salvato (revisione 0) non si blocca niente: Michele ha detto
       «se viene SALVATA la pagina con delle modifiche». */
    private async Task<HashSet<short>> PagineDaSistemareAsync(int idVolantino, short versione)
    {
        var vuoto = new HashSet<short>();
        var piano = await ctx.Timoni.AsNoTracking()
            .FirstOrDefaultAsync(t => t.IdVol == idVolantino && t.Versione == versione);
        if (piano == null || piano.Revisione < 1) return vuoto;

        var pagine = await ctx.TimonePagine.AsNoTracking()
            .Where(p => p.IdTimone == piano.Id)
            .Select(p => new { p.Id, p.Numero }).ToListAsync();
        var numeroDi = pagine.ToDictionary(p => p.Id, p => p.Numero);

        var voci = await ctx.TimoneVoci.AsNoTracking()
            .Where(v => v.IdTimone == piano.Id && v.DataModifica != null)
            .Select(v => new { v.IdPaginaTimone, v.PaginaOrigine }).ToListAsync();
        foreach (var v in voci)
        {
            if (v.IdPaginaTimone != null && numeroDi.TryGetValue(v.IdPaginaTimone.Value, out var n))
                vuoto.Add(n);
            if (v.PaginaOrigine != null) vuoto.Add(v.PaginaOrigine.Value);
        }

        var blocchi = await ctx.TimoneBlocchi.AsNoTracking()
            .Where(b => b.IdTimone == piano.Id)
            .Select(b => b.IdPaginaTimone).Distinct().ToListAsync();
        foreach (var idp in blocchi)
            if (numeroDi.TryGetValue(idp, out var n2)) vuoto.Add(n2);

        return vuoto;
    }

    private async Task<(Volantini? Vol, EsitoCorrezione? Errore)> VolantinoScrivibileAsync(Utente u, int idPagina)
    {
        var pagina = await ctx.VolantiniPagines.AsNoTracking().FirstOrDefaultAsync(p => p.Id == idPagina);
        if (pagina == null) return (null, NonTrovata("Pagina non trovata."));
        var vol = await ctx.Volantinis.AsNoTracking().FirstAsync(v => v.Id == pagina.IdVol);

        short ultima = await ctx.VolantiniPagines.Where(p => p.IdVol == vol.Id).MaxAsync(p => p.Versione);
        if (pagina.Versione != ultima)
            return (vol, EsitoCorrezione.No(409, "versione_superata",
                "È uscita una nuova versione del volantino: ricarica la pagina."));

        var adesso = DateTime.UtcNow;
        if (Bloccato(vol, adesso))
            return (vol, EsitoCorrezione.No(423, "vol_bloccato", "Il volantino è bloccato: per ora non si possono salvare correzioni."));
        if (Scaduto(vol, adesso))
            return (vol, EsitoCorrezione.No(423, "vol_scaduto", "Il volantino è scaduto: le correzioni sono chiuse."));

        // Finestra dei Category (j209): l'originale la guardava solo all'ingresso, qui a ogni salvataggio.
        if (u.TipoFico == TipoFicoCategory
            && !FinestreCategory.Aperta(await FinestreCategory.LeggiAsync(ctx, vol.Classificazione), adesso))
            return (vol, EsitoCorrezione.No(423, "finestra_chiusa",
                "La finestra dei Category per questa promo è chiusa: le correzioni non si possono salvare."));

        /* j307: la pagina aspetta che l'Agenzia rifaccia l'impaginato. Il controllo sta QUI perche'
           questo e' l'imbuto di tutte le scritture su un prodotto: nota, timbro, OK visto, Edit
           avanzato, carica foto, propagazione. Un blocco scritto solo nell'editor non e' un blocco.
           L'Agenzia passa: e' lei che deve sistemare, e per sistemare deve poter lavorare. */
        if (!u.Accetta && (await PagineDaSistemareAsync(vol.Id, pagina.Versione)).Contains(pagina.Numero))
            return (vol, EsitoCorrezione.No(423, "attesa_impaginato",
                "In attesa che l'Agenzia sistemi l'impaginato."));

        return (vol, null);
    }

    /// <summary>
    /// L'Agenzia accetta solo a finestra dei Category chiusa (decisione dell'11/9, j209). Senza finestra
    /// impostata si accetta: i Category non entrano, le correzioni sono di altri.
    /// </summary>
    /// <summary>
    /// DEPRECATO (15/09/2026). Bloccava l'accettazione dell'Agenzia finche' la finestra dei Category
    /// era aperta (decisione dell'11/9, j209). Michele ha chiarito che la regola "l'Agenzia non corregge
    /// prima della chiusura della finestra" è **organizzativa, non tecnica**: l'Agenzia la conosce, e un
    /// blocco nell'applicazione le impedisce di portarsi avanti quando serve. Restano l'avviso in cima
    /// all'editor e i campi FinestraAperta / FinestraFine dello stato, che lo scrivono a chiare lettere.
    /// Riattivandolo tornerebbero i 409 "finestra_aperta" su AccettaNotaAsync, AccettaTimbroAsync e
    /// sulla conferma delle propagazioni (ServizioCorrezioni.Propagazioni.cs).
    /// </summary>
    private Task<EsitoCorrezione?> FinestraApertaAsync(int idPagina) =>
        Task.FromResult<EsitoCorrezione?>(null);

    private async Task<int> IdVolantinoAsync(int idPagina) =>
        await ctx.VolantiniPagines.Where(p => p.Id == idPagina).Select(p => p.IdVol).FirstAsync();

    private static string? PulisciTesto(string? testo, out EsitoCorrezione? errore)
    {
        errore = null;
        string t = (testo ?? "").Trim();
        if (t.Length == 0)
        {
            errore = EsitoCorrezione.No(400, "nota_vuota", "La nota è vuota.");
            return null;
        }
        if (t.Length > LunghezzaMassimaNota)
        {
            errore = EsitoCorrezione.No(400, "nota_lunga", $"La nota supera i {LunghezzaMassimaNota} caratteri.");
            return null;
        }
        return t;
    }

    private static (double X, double Y) Punto(string? vectors)
    {
        if (string.IsNullOrWhiteSpace(vectors)) return (0, 0);
        try
        {
            using var d = JsonDocument.Parse(vectors);
            if (d.RootElement.ValueKind == JsonValueKind.Array && d.RootElement.GetArrayLength() > 0)
            {
                var p = d.RootElement[0];
                return (p.GetProperty("x").GetDouble(), p.GetProperty("y").GetDouble());
            }
        }
        catch (Exception ex) when (ex is JsonException or KeyNotFoundException or InvalidOperationException) { }
        return (0, 0);
    }

    private static string TempoLeggibile(int secondi) =>
        secondi >= 60 ? $"{(int)Math.Ceiling(secondi / 60.0)} min" : $"{secondi} s";

    private static EsitoCorrezione Fatto(StatoCorrezioni stato, long id) =>
        EsitoCorrezione.Fatto(new { id, stato });

    private static EsitoCorrezione NonAutorizzato(string? msg = null) =>
        EsitoCorrezione.No(403, "non_autorizzato", msg ?? "Le correzioni le scrivono Category e Marketing.");

    private static EsitoCorrezione NonAutore() =>
        EsitoCorrezione.No(403, "non_autore", "Puoi modificare o eliminare solo le correzioni che hai scritto tu.");

    private static EsitoCorrezione GiaAccettata() =>
        EsitoCorrezione.No(409, "gia_accettata", "La correzione è già stata accettata dall'Agenzia.");

    private static EsitoCorrezione NonTrovata(string msg) =>
        EsitoCorrezione.No(404, "non_trovata", msg);
}
