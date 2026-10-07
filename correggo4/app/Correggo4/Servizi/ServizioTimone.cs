using System.Text.Json;
using Correggo4.Auth;
using Correggo4.Data;
using Correggo4.Models;
using Microsoft.EntityFrameworkCore;

namespace Correggo4.Servizi;

/// <summary>
/// Il TIMONE (j251): il piano con cui il Marketing rimette mano alla disposizione delle referenze
/// di un volantino già impaginato. La specifica completa sta in claude/timone-specifica.md.
///
/// IL PALETTO, che vale per tutto questo servizio: qui dentro **non si scrive mai** su
/// volantini_pagine_elementi, volantini_pagine_note, volantini_pagine_note_timbri,
/// volantini_propagazioni, volantini_propagazioni_elementi, volantini_pagine_elementi_versioni.
/// A quelle righe puntano le correzioni, i timbri, l'OK visto, l'Edit avanzato e le catene:
/// spostare davvero un box le romperebbe tutte. Il piano è uno strato sopra, e basta.
///
/// Questo primo pezzo fa due cose sole: **fotografa** il piano da un volantino impaginato e lo
/// **rilegge**. Gli spostamenti, i gruppi, le griglie e l'esportazione vengono dopo.
/// </summary>
public sealed partial class ServizioTimone
{
    /// <summary>Il tipo utente del Marketing (utenti.tipo_utente_fico), come in ServizioCorrezioni.</summary>
    public const short TipoFicoMarketing = 7;

    /// <summary>Stati del piano.</summary>
    public const short PianoInLavorazione = 0;
    public const short PianoChiuso = 1;
    public const short PianoEsportato = 2;

    /// <summary>Stati di una voce.</summary>
    public const short VoceInPagina = 0;
    public const short VoceFuoriVolantino = 1;
    public const short VoceEliminata = 2;
    public const short VoceInSospeso = 3;

    private readonly Correggo4Context ctx;

    public ServizioTimone(Correggo4Context ctx) => this.ctx = ctx;

    // ------------------------------------------------------------------ chi sta guardando

    public sealed record Chi(short Id, short Ruolo, short? TipoFico, string Nome)
    {
        public bool Agenzia => Ruolo == Ruoli.CodiceAgenzia;
        public bool Marketing => Ruolo == Ruoli.CodiceGdo && TipoFico == TipoFicoMarketing;
    }

    public async Task<Chi?> ChiAsync(short idUtente)
    {
        var u = await ctx.Utentis.AsNoTracking().FirstOrDefaultAsync(x => x.Id == idUtente && x.Attivo);
        return u == null ? null : new Chi(u.Id, u.Ruolo, u.TipoUtenteFico, $"{u.Nome} {u.Cognome}");
    }

    // ------------------------------------------------------------------ l'esito

    public sealed record Esito(int Http, bool Ok, string? Codice, string? Messaggio, object? Dati)
    {
        public static Esito Fatto(object? dati = null) => new(200, true, null, null, dati);
        public static Esito No(int http, string codice, string messaggio) => new(http, false, codice, messaggio, null);
    }

    // ------------------------------------------------------------------ la finestra

    /// <summary>
    /// Com'è messa la finestra del Marketing su una promo, adesso. La finestra è per
    /// classificazione, come quella dei Category (j209).
    /// </summary>
    public async Task<(bool Aperta, DateTime? Inizio, DateTime? Fine)> FinestraAsync(string classificazione)
    {
        var f = await ctx.TimoneFinestre.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Classificazione == classificazione);
        if (f == null) return (false, null, null);
        var adesso = DateTime.UtcNow;
        return (f.DataInizio <= adesso && adesso <= f.DataFine, f.DataInizio, f.DataFine);
    }

    /// <summary>
    /// Chi può scrivere sul piano adesso: il Marketing a finestra aperta, l'Agenzia a finestra
    /// chiusa. Il controllo sta sul server, non solo nei bottoni.
    /// </summary>
    public async Task<Esito?> PuoScrivereAsync(Chi chi, string classificazione)
    {
        var (aperta, _, _) = await FinestraAsync(classificazione);
        if (chi.Marketing)
            return aperta ? null : Esito.No(423, "finestra_timone_chiusa",
                "La finestra del timone e' chiusa: adesso il timone lo sistema l'Agenzia.");
        if (chi.Agenzia)
            return aperta ? Esito.No(423, "finestra_timone_aperta",
                "La finestra del Marketing e' aperta: si aspetta che finisca.") : null;
        return Esito.No(403, "non_autorizzato", "Il timone lo usano il Marketing e l'Agenzia.");
    }

    // ------------------------------------------------------------------ aprire il piano

    /// <summary>
    /// Fotografa il piano dal volantino impaginato. La fa l'Agenzia, una volta sola: se il piano
    /// c'è già lo restituisce e basta, senza rifarlo (rifarlo butterebbe via il lavoro fatto).
    /// </summary>
    public async Task<Esito> ApriAsync(Chi chi, int idVolantino)
    {
        if (!chi.Agenzia)
            return Esito.No(403, "non_autorizzato", "Il timone lo apre l'Agenzia.");

        var vol = await ctx.Volantinis.AsNoTracking().FirstOrDefaultAsync(v => v.Id == idVolantino);
        if (vol == null) return Esito.No(404, "volantino_non_trovato", "Questo volantino non esiste.");

        short versione = await ctx.VolantiniPagines.Where(p => p.IdVol == idVolantino)
            .MaxAsync(p => (short?)p.Versione) ?? 0;
        if (versione == 0) return Esito.No(409, "volantino_senza_pagine", "Questo volantino non ha ancora pagine.");

        var gia = await ctx.Timoni.AsNoTracking()
            .FirstOrDefaultAsync(t => t.IdVol == idVolantino && t.Versione == versione);
        if (gia != null) return await PianoAsync(chi, idVolantino);

        await FotografaAsync(chi.Id, idVolantino, versione);
        return await PianoAsync(chi, idVolantino);
    }

    /// <summary>
    /// La fotografia vera e propria: crea il piano, una pagina per ogni pagina del volantino e una
    /// voce per ogni box radice. Sta in un metodo suo (j256) perche' la usano in due: ApriAsync,
    /// la prima volta, e RimettiComeEraAsync, quando si vuole ributtare via tutto e ripartire
    /// dall'impaginato. Non controlla i permessi: li controlla chi la chiama.
    /// </summary>
    private async Task FotografaAsync(short idAutore, int idVolantino, short versione)
    {
        // --- la fotografia
        var pagine = await ctx.VolantiniPagines.AsNoTracking()
            .Where(p => p.IdVol == idVolantino && p.Versione == versione)
            .OrderBy(p => p.Numero)
            .Select(p => new { p.Id, p.Numero })
            .ToListAsync();

        var idPagine = pagine.Select(p => p.Id).ToList();
        var box = await ctx.VolantiniPagineElementis.AsNoTracking()
            .Where(e => idPagine.Contains(e.IdPagina) && e.IdParent == null)
            .Select(e => new { e.Id, e.IdPagina, e.Basecode, e.Dna, e.PosizioneX, e.PosizioneY, e.Altezza })
            .ToListAsync();

        var piano = new VolantiniTimone
        {
            IdVol = idVolantino,
            Versione = versione,
            Stato = PianoInLavorazione,
            Revisione = 0,
            DataCreazione = DateTime.UtcNow,
            IdAutore = idAutore
        };
        ctx.Timoni.Add(piano);
        await ctx.SaveChangesAsync();

        var righePagine = new List<VolantiniTimonePagine>();
        foreach (var p in pagine)
        {
            righePagine.Add(new VolantiniTimonePagine
            {
                IdTimone = piano.Id,
                Numero = p.Numero,
                Griglia = null,
                Capienza = 0,          // finche' non si sceglie una griglia, la pagina non ha limite
                Ordine = p.Numero,     // si parte dall'ordine naturale
                Attiva = true,
                Bloccata = false
            });
        }
        ctx.TimonePagine.AddRange(righePagine);
        await ctx.SaveChangesAsync();

        var perNumero = righePagine.ToDictionary(r => r.Numero, r => r.Id);
        var numeroDiPagina = pagine.ToDictionary(p => p.Id, p => p.Numero);

        var voci = new List<VolantiniTimoneVoci>();
        // j290: il numero di gruppo. Basta che sia uguale dentro un gruppo e diverso fra gruppi
        // dello stesso piano, quindi un contatore va benissimo e non serve aspettare gli id veri.
        long gruppoProgressivo = 0;
        foreach (var gruppoPagina in box.GroupBy(b => b.IdPagina))
        {
            short numero = numeroDiPagina[gruppoPagina.Key];

            // ORDINE DI LETTURA: prima si raggruppa in RIGHE, poi dentro ogni riga si va da
            // sinistra a destra. E' l'ordine con cui un umano legge la pagina, quindi e' quello
            // che si aspetta di trovare nelle caselle.
            //
            // Non basta ordinare per Y e poi per X, che e' quello che si faceva fino a j264:
            // due prodotti affiancati non hanno quasi mai la stessa Y precisa. Sulla pagina 3 del
            // volantino 6 (Michele, 28/09) il caffe' sta a Y 75,2 e le crostatine a Y 75,4: sono
            // fianco a fianco, ma ordinando per Y il caffe' - che sta a DESTRA - finiva prima
            // delle crostatine, e nel timone i due prodotti risultavano scambiati di posto.
            //
            // Due box stanno nella stessa riga se il secondo comincia prima della meta' del
            // primo: mezza altezza di tolleranza e' abbastanza per gli scarti di impaginazione e
            // troppo poco per confondere due righe vere.
            var perRighe = new List<(long Id, decimal X, decimal Y, decimal H, string? Dna, string? Basecode)>();
            {
                var riga = new List<(long Id, decimal X, decimal Y, decimal H, string? Dna, string? Basecode)>();
                decimal limite = 0m;
                foreach (var b in gruppoPagina
                                    .Select(x => (Id: x.Id, X: x.PosizioneX, Y: x.PosizioneY,
                                                  H: x.Altezza, Dna: x.Dna, Basecode: x.Basecode))
                                    .OrderBy(x => x.Y))
                {
                    if (riga.Count > 0 && b.Y > limite)
                    {
                        perRighe.AddRange(riga.OrderBy(x => x.X));
                        riga.Clear();
                    }
                    if (riga.Count == 0) limite = b.Y + b.H / 2m;
                    riga.Add(b);
                }
                if (riga.Count > 0) perRighe.AddRange(riga.OrderBy(x => x.X));
            }

            short posizione = 0;
            foreach (var b in perRighe)
            {
                posizione++;
                var (codice, etichetta) = LeggiDna(b.Dna, b.Basecode);

                /* UNA VOCE PER REFERENZA, NON PER BOX (j290).
                   Michele, 29/09: «mi chiedono di poter sgruppare o raggruppare referenze... se
                   loro volessero vedere direttamente il prodotto eliminato dal gruppo e decidere
                   se metterlo in pagina?»
                   Fino a qui si faceva una voce per box, e un box che sul volantino tiene piu'
                   referenze aveva il codice scritto con le virgole: su Demo sono 10 box su 26, e
                   uno ne tiene NOVE (96566-1..10, i gusti assortiti). Cosi' non c'era niente da
                   sciogliere - non c'erano tre referenze, c'era una casella che ne conteneva tre.
                   Adesso il codice si spacca sulle virgole e si fa una voce per referenza, con lo
                   stesso IdGruppo per quelle che venivano dallo stesso box. E' quello che la
                   specifica diceva dal principio («una riga per referenza del volantino»): la
                   scorciatoia era qui.
                   LA REGOLA DEL GRUPPO: la casella e' UNA. La tiene la prima referenza - il
                   capogruppo - e le altre hanno Posizione null e le stanno dietro. Il salvataggio
                   la fa rispettare (vedi ServizioTimone.Salva.cs). */
                var codici = SpezzaCodici(codice);
                long? idGruppo = codici.Count > 1 ? ++gruppoProgressivo : (long?)null;

                for (int k = 0; k < codici.Count; k++)
                {
                    voci.Add(new VolantiniTimoneVoci
                    {
                        IdTimone = piano.Id,
                        IdElemento = b.Id,
                        Codice = codici[k],
                        Basecode = b.Basecode ?? "",
                        Etichetta = etichetta,
                        IdPaginaTimone = perNumero[numero],
                        // la casella la tiene il capogruppo; gli altri gli stanno dietro
                        Posizione = k == 0 ? posizione : (short?)null,
                        IdGruppo = idGruppo,
                        Ruolo = "",
                        Stato = VoceInPagina,
                        PaginaOrigine = numero,
                        PosizioneOrigine = posizione,
                        DataModifica = null,
                        IdAutore = null
                    });
                }
            }
        }
        ctx.TimoneVoci.AddRange(voci);
        await ctx.SaveChangesAsync();

    }

    /// <summary>
    /// Dal dna del box tira fuori il codice della referenza e una descrizione leggibile.
    /// Il dna è un jsonb con le chiavi codice, codici, gruppo, descrizione (verificato sui dati
    /// veri il 28/09). Se manca o è rotto non si butta via il box: si usa il basecode.
    /// </summary>
    /// <summary>
    /// La meccanica del box: il campo "boxName" del json in contenuto (j300). Stringa vuota se il
    /// json non c'e', non si legge o non ha quel campo - non e' un errore, certi box non ce l'hanno.
    /// </summary>
    private static string BoxName(string? contenuto)
    {
        if (string.IsNullOrWhiteSpace(contenuto)) return "";
        string t = contenuto.TrimStart();
        if (!t.StartsWith('{')) return "";
        try
        {
            using var doc = JsonDocument.Parse(t);
            var r = doc.RootElement;
            if (r.ValueKind == JsonValueKind.Object
                && r.TryGetProperty("boxName", out var b) && b.ValueKind == JsonValueKind.String)
                return Taglia(b.GetString() ?? "", 40);
        }
        catch (JsonException) { /* contenuto illeggibile: si fa senza meccanica */ }
        return "";
    }

    private static (string Codice, string Etichetta) LeggiDna(string? dna, string? basecode)
    {
        string codice = "", etichetta = "";
        if (!string.IsNullOrWhiteSpace(dna))
        {
            try
            {
                using var doc = JsonDocument.Parse(dna);
                var r = doc.RootElement;
                if (r.ValueKind == JsonValueKind.Object)
                {
                    if (r.TryGetProperty("codice", out var c) && c.ValueKind == JsonValueKind.String)
                        codice = c.GetString() ?? "";
                    if (codice.Length == 0 && r.TryGetProperty("gruppo", out var g) && g.ValueKind == JsonValueKind.String)
                        codice = g.GetString() ?? "";
                    if (codice.Length == 0 && r.TryGetProperty("codici", out var cs) && cs.ValueKind == JsonValueKind.Array
                        && cs.GetArrayLength() > 0 && cs[0].ValueKind == JsonValueKind.String)
                        codice = cs[0].GetString() ?? "";
                    if (r.TryGetProperty("descrizione", out var d) && d.ValueKind == JsonValueKind.String)
                        etichetta = d.GetString() ?? "";
                }
            }
            catch (JsonException) { /* dna illeggibile: si tiene il basecode */ }
        }
        if (codice.Length == 0) codice = basecode ?? "";
        if (etichetta.Length == 0) etichetta = codice;
        return (Taglia(codice, 120), Taglia(etichetta, 400));
    }

    /// <summary>
    /// Spezza il codice di un box nei codici delle sue referenze (j290).
    ///
    /// Si spezza SOLO sulla virgola. Il trattino NON si tocca, e non e' un dettaglio: il codice
    /// di una referenza il trattino ce l'ha dentro come separatore suo (<c>96807-1</c> = referenza
    /// 96807, variante 1), e a settembre si e' scoperto che da qualche parte nella filiera
    /// qualcuno faceva uno split sul trattino: da <c>96807-1,96807-2</c> uscivano frammenti come
    /// <c>1,96807</c> e Istanta rispondeva «gruppo non trovato» quattordici volte per
    /// impaginazione (vedi claude/getschedaref-trattino.md). Qui non si ripete quell'errore.
    ///
    /// Se non ci sono virgole torna una lista di uno: un box con una referenza sola.
    /// </summary>
    private static List<string> SpezzaCodici(string codice)
    {
        var fuori = new List<string>();
        foreach (var pezzo in (codice ?? "").Split(','))
        {
            var c = pezzo.Trim();
            if (c.Length > 0 && !fuori.Contains(c)) fuori.Add(Taglia(c, 80));
        }
        if (fuori.Count == 0) fuori.Add(Taglia(codice ?? "", 80));
        return fuori;
    }

    private static string Taglia(string s, int max) => s.Length <= max ? s : s[..max];

    // ------------------------------------------------------------------ leggere il piano

    /// <summary>Il piano salvato, con le sue pagine e le sue voci. Lo leggono Marketing e Agenzia.</summary>
    public async Task<Esito> PianoAsync(Chi chi, int idVolantino)
    {
        if (!chi.Agenzia && !chi.Marketing)
            return Esito.No(403, "non_autorizzato", "Il timone lo usano il Marketing e l'Agenzia.");

        var vol = await ctx.Volantinis.AsNoTracking().FirstOrDefaultAsync(v => v.Id == idVolantino);
        if (vol == null) return Esito.No(404, "volantino_non_trovato", "Questo volantino non esiste.");

        short versione = await ctx.VolantiniPagines.Where(p => p.IdVol == idVolantino)
            .MaxAsync(p => (short?)p.Versione) ?? 0;

        var piano = await ctx.Timoni.AsNoTracking()
            .FirstOrDefaultAsync(t => t.IdVol == idVolantino && t.Versione == versione);

        var (aperta, inizio, fine) = await FinestraAsync(vol.Classificazione);

        if (piano == null)
            return Esito.Fatto(new
            {
                esiste = false,
                idVolantino,
                versione,
                promo = vol.Classificazione,
                titolo = vol.Titolo,
                finestraAperta = aperta,
                finestraInizio = inizio,
                finestraFine = fine,
                puoScrivere = false,
                puoAprire = chi.Agenzia,
                puoGestireFinestra = chi.Agenzia
            });

        var pagine = await ctx.TimonePagine.AsNoTracking()
            .Where(p => p.IdTimone == piano.Id)
            .OrderBy(p => p.Numero)
            .ToListAsync();

        var voci = await ctx.TimoneVoci.AsNoTracking()
            .Where(v => v.IdTimone == piano.Id)
            .ToListAsync();

        // j279: le caselle bloccate. Michele (28/09): «l'utente puo' decidere di bloccare una
        // posizione perche' li' ci vorra' un qualcosa di grafico». Occupano una casella come una
        // referenza, quindi il browser le deve sapere per non metterci niente sopra.
        var blocchi = await ctx.TimoneBlocchi.AsNoTracking()
            .Where(b => b.IdTimone == piano.Id)
            .OrderBy(b => b.IdPaginaTimone).ThenBy(b => b.Posizione)
            .ToListAsync();

        // la geometria dei box di partenza, per il ritaglio dell'immagine nel browser
        var idElementi = voci.Where(v => v.IdElemento != null).Select(v => v.IdElemento!.Value).ToList();
        var geo = await ctx.VolantiniPagineElementis.AsNoTracking()
            .Where(e => idElementi.Contains(e.Id))
            .Select(e => new { e.Id, e.PosizioneX, e.PosizioneY, e.Larghezza, e.Altezza, e.IdPagina,
                               e.Contenuto })
            .ToListAsync();
        var geoPerId = geo.ToDictionary(g => g.Id);

        /* LA MECCANICA DEL BOX (j300). Michele, 29/09: «tra le info mettiamo anche la meccanica
           applicata per quella referenza (ad esempio BOX_STD o BOX_FID....)».
           Sta in casa, non in Istanta: e' il campo "boxName" dentro il json della colonna
           contenuto del box (tipo 1). Sui dati veri i valori sono BOX_STD, BOX_FID, BOX_ETRURIA,
           BOX_1, BOX_2, BOX_3 e LOGO.
           Come l'ho trovata, perche' la strada sbagliata non si rifaccia: prima ho cercato fra i
           75 campi di Istanta (combinazioneAssegnata e' vuoto, combinazioneMeccanica e' il formato
           «4x4», tipo_offerta e' «PN»: nessuno dei quattro), poi ho cercato la parola in tutte le
           colonne di testo del database, ed era qui. */
        var meccanicaPerId = new Dictionary<long, string>();
        foreach (var g in geo)
        {
            string m = BoxName(g.Contenuto);
            if (m.Length > 0) meccanicaPerId[g.Id] = m;
        }

        // Il PREZZO PROMO non sta nel dna (li' ci sono solo codice, gruppo e descrizione): sta in
        // un FIGLIO del box, con label_ind 'prezzo_promo' e il prezzo gia' scritto per esteso in
        // contenuto ("€ 1,88"). E' lo stesso posto da cui lo legge l'Edit avanzato. Su qualche
        // tracciato il figlio si chiama solo 'prezzo': si prende quello come ripiego.
        // Serve ai pannelli del timone: tolta una referenza dalla pagina, il codice da solo non
        // basta a riconoscerla (Michele, 28/09).
        var prezzi = await ctx.VolantiniPagineElementis.AsNoTracking()
            .Where(f => f.IdParent != null && idElementi.Contains(f.IdParent.Value)
                        && (f.LabelInd == "prezzo_promo" || f.LabelInd == "prezzo")
                        && f.Contenuto != "")
            .Select(f => new { Padre = f.IdParent!.Value, f.LabelInd, f.Contenuto })
            .ToListAsync();
        var prezzoPerId = new Dictionary<long, string>();
        foreach (var pz in prezzi.OrderBy(x => x.LabelInd == "prezzo_promo" ? 0 : 1))
            if (!prezzoPerId.ContainsKey(pz.Padre)) prezzoPerId[pz.Padre] = pz.Contenuto;

        var pagineVere = await ctx.VolantiniPagines.AsNoTracking()
            .Where(p => p.IdVol == idVolantino && p.Versione == versione)
            .Select(p => new { p.Numero, p.Larghezza, p.Altezza })
            .ToListAsync();
        var dimPagina = pagineVere.ToDictionary(p => p.Numero);

        var scrivibile = await PuoScrivereAsync(chi, vol.Classificazione);

        /* CHI HA SALVATO PER ULTIMO, E QUANDO (j312).
           Serve al REPORT DELL'AGENZIA: un foglio che si stampa e si passa in giro deve dire di
           quando parla. Michele, 29/09: «farei un tasto visibile solo per l'agenzia dove c'e' un
           report con tutti gli spostamenti... un Visual che uno puo' esportare poi anche in PDF».
           Il nome si prende come lo prende ChiAsync (nome e cognome): la colonna username non e'
           mappata sull'entita', e non vale la pena toccare il modello per una riga di
           intestazione. Se nome e cognome sono vuoti si manda null e il report stampa solo la
           data - meglio niente che la parola «null» sotto il naso dell'utente. */
        string? chiHaSalvato = null;
        if (piano.IdUltimoSalvataggio != null)
        {
            var ult = await ctx.Utentis.AsNoTracking()
                .Where(x => x.Id == piano.IdUltimoSalvataggio.Value)
                .Select(x => new { x.Nome, x.Cognome })
                .FirstOrDefaultAsync();
            if (ult != null)
            {
                string n = $"{ult.Nome} {ult.Cognome}".Trim();
                if (n.Length > 0) chiHaSalvato = n;
            }
        }

        // Si costruiscono le due liste con cicli normali invece che dentro le Select: il codice e'
        // piu' lungo ma si legge, e non si finisce a chiamare tre volte lo stesso dizionario.
        var pagineFuori = new List<object>();
        foreach (var p in pagine)
        {
            decimal larghezza = 0m, altezza = 0m;
            if (dimPagina.TryGetValue(p.Numero, out var dim)) { larghezza = dim.Larghezza; altezza = dim.Altezza; }
            // j254: righe e colonne servono al browser per disegnare le caselle. Il primo numero
            // del nome sono le righe (3x4 = 3 righe, 4 colonne).
            var gr = GriglieFormato.Trova(p.Griglia);
            pagineFuori.Add(new
            {
                id = p.Id,
                numero = p.Numero,
                griglia = p.Griglia,
                capienza = p.Capienza,
                righe = gr?.Righe ?? 0,
                colonne = gr?.Colonne ?? 0,
                ordine = p.Ordine,
                attiva = p.Attiva,
                bloccata = p.Bloccata,
                larghezza,
                altezza,
                quante = voci.Count(v => v.IdPaginaTimone == p.Id && v.Stato == VoceInPagina),
                // j279: quante caselle sono bloccate qui. Il posto libero vero e'
                // capienza - bloccate, non capienza.
                bloccate = blocchi.Count(b => b.IdPaginaTimone == p.Id)
            });
        }

        var vociFuori = new List<object>();
        foreach (var v in voci.OrderBy(v => v.PaginaOrigine).ThenBy(v => v.Posizione ?? short.MaxValue))
        {
            decimal x = 0m, y = 0m, w = 0m, h = 0m;
            if (v.IdElemento != null && geoPerId.TryGetValue(v.IdElemento.Value, out var g))
            {
                x = g.PosizioneX; y = g.PosizioneY; w = g.Larghezza; h = g.Altezza;
            }
            string prezzo = "";
            if (v.IdElemento != null && prezzoPerId.TryGetValue(v.IdElemento.Value, out var pz2)) prezzo = pz2;
            string meccanica = "";
            if (v.IdElemento != null && meccanicaPerId.TryGetValue(v.IdElemento.Value, out var mc2)) meccanica = mc2;

            vociFuori.Add(new
            {
                id = v.Id,
                idElemento = v.IdElemento,
                codice = v.Codice,
                etichetta = v.Etichetta,
                prezzo,
                // j300: BOX_STD, BOX_FID e compagnia: la scheda della casella la fa vedere
                meccanica,
                // j274: quante caselle occupa. La "posizione" e' quella in alto a sinistra.
                colonne = v.Colonne < 1 ? (short)1 : v.Colonne,
                righe = v.Righe < 1 ? (short)1 : v.Righe,
                idPagina = v.IdPaginaTimone,
                posizione = v.Posizione,
                idGruppo = v.IdGruppo,
                stato = v.Stato,
                paginaOrigine = v.PaginaOrigine,
                posizioneOrigine = v.PosizioneOrigine,
                // geometria del box vero: serve al browser per ritagliare il prodotto dalla pagina
                x, y, w, h
            });
        }

        return Esito.Fatto(new
        {
            esiste = true,
            id = piano.Id,
            idVolantino,
            versione,
            promo = vol.Classificazione,
            titolo = vol.Titolo,
            stato = piano.Stato,
            revisione = piano.Revisione,
            // j312: le due righe dell'intestazione del report dell'Agenzia
            dataSalvataggio = piano.DataSalvataggio,
            chiHaSalvato,
            // j317: il lavoro che aspetta l'Agenzia. daSistemare accende il pulsante FATTO nella
            // barra del timone ed e' la STESSA regola che accende la casella lampeggiante nella
            // home: una sola, calcolata in un posto solo (VolantiniDaSistemareAsync).
            daSistemare = (await VolantiniDaSistemareAsync(chi, idVolantino)).Count > 0,
            dataSistemato = piano.DataSistemato,
            finestraAperta = aperta,
            finestraInizio = inizio,
            finestraFine = fine,
            puoScrivere = scrivibile == null,
            motivoSolaLettura = scrivibile?.Messaggio,
            puoGestireFinestra = chi.Agenzia,
            quanteSospese = voci.Count(v => v.Stato == VoceInSospeso),
            // j254: le griglie fra cui si puo' scegliere. Sono fisse, non arrivano da Istanta:
            // vedi il commento in GriglieFormato.Ammesse().
            griglieAmmesse = GriglieFormato.Ammesse()
                .Select(x => new { nome = x.Nome, righe = x.Righe, colonne = x.Colonne, posti = x.Posti }),
            pagine = pagineFuori,
            voci = vociFuori,
            // j279: una riga per casella bloccata. Il browser le disegna col divieto d'accesso e
            // le conta come occupate quando cerca un posto libero.
            blocchi = blocchi.Select(b => new { id = b.Id, idPagina = b.IdPaginaTimone, posizione = b.Posizione })
        });
    }

    // ------------------------------------------------- il lavoro di timone che aspetta l'Agenzia

    /// <summary>
    /// I volantini su cui l'AGENZIA ha del lavoro di timone da fare adesso (j317).
    ///
    /// Michele, 01/10: «una volta che il marketing ha chiuso la finestra farei apparire una casella
    /// con scritto TIMONE che lampeggia. cosi' che l'agenzia possa capire subito che deve entrare
    /// nel volantino e fare prima le modifiche del marketing».
    ///
    /// LA REGOLA, tutte e quattro le condizioni insieme:
    ///   1. chi guarda e' l'Agenzia. Al Marketing non serve: il lavoro e' suo e lo sa.
    ///   2. il piano e' stato salvato almeno una volta E almeno una voce risulta cambiata. E' la
    ///      differenza fra «la finestra e' finita» e «c'e' davvero qualcosa da rifare»: se il
    ///      Marketing non ha spostato niente, l'Agenzia non va chiamata per nulla (lo ha chiesto
    ///      Michele scegliendo, fra le tre strade, «solo se il Marketing ha davvero salvato
    ///      qualcosa»).
    ///   3. la finestra del Marketing su quella promo e' CHIUSA. A finestra aperta il Marketing
    ///      puo' ancora cambiare idea, e chiamare l'Agenzia sarebbe chiamarla troppo presto.
    ///   4. l'Agenzia non ha gia' premuto FATTO dopo l'ultimo salvataggio. Si confrontano le due
    ///      date, non un si'/no: se il Marketing salva di nuovo dopo il «fatto», l'avviso torna da
    ///      se'.
    /// In piu' il piano deve essere della VERSIONE DI ADESSO del volantino: se e' arrivata una
    /// versione nuova, quel piano parla di un volantino che non esiste piu'.
    ///
    /// Si passa <c>soloVolantino</c> quando interessa un volantino solo (lo fa PianoAsync, che gira
    /// a ogni apertura dell'editor): cosi' le query restano piccole invece di leggere tutti i piani.
    /// </summary>
    public async Task<List<int>> VolantiniDaSistemareAsync(Chi chi, int? soloVolantino = null)
    {
        var vuoto = new List<int>();
        if (!chi.Agenzia) return vuoto;

        var q = ctx.Timoni.AsNoTracking().Where(t => t.DataSalvataggio != null);
        if (soloVolantino != null) q = q.Where(t => t.IdVol == soloVolantino.Value);
        var piani = await q
            .Select(t => new { t.Id, t.IdVol, Versione = (int)t.Versione, t.DataSalvataggio, t.DataSistemato })
            .ToListAsync();
        if (piani.Count == 0) return vuoto;

        var idPiani = piani.Select(p => p.Id).ToList();
        var conModifiche = (await ctx.TimoneVoci.AsNoTracking()
            .Where(v => idPiani.Contains(v.IdTimone) && v.DataModifica != null)
            .Select(v => v.IdTimone)
            .Distinct()
            .ToListAsync()).ToHashSet();
        if (conModifiche.Count == 0) return vuoto;

        var idVol = piani.Select(p => p.IdVol).Distinct().ToList();
        var versioneDiAdesso = await ctx.VolantiniPagines.AsNoTracking()
            .Where(p => idVol.Contains(p.IdVol))
            .GroupBy(p => p.IdVol)
            .Select(g => new { IdVol = g.Key, Versione = g.Max(x => (int)x.Versione) })
            .ToDictionaryAsync(x => x.IdVol, x => x.Versione);
        var promoDi = await ctx.Volantinis.AsNoTracking()
            .Where(v => idVol.Contains(v.Id))
            .Select(v => new { v.Id, v.Classificazione })
            .ToDictionaryAsync(x => x.Id, x => x.Classificazione);
        var finestre = await ctx.TimoneFinestre.AsNoTracking()
            .Select(f => new { f.Classificazione, f.DataInizio, f.DataFine })
            .ToListAsync();

        var adesso = DateTime.UtcNow;
        var fuori = new List<int>();
        foreach (var p in piani)
        {
            if (!conModifiche.Contains(p.Id)) continue;
            if (!versioneDiAdesso.TryGetValue(p.IdVol, out int vers) || vers != p.Versione) continue;

            string? classificazione = promoDi.TryGetValue(p.IdVol, out var c) ? c : null;
            var f = finestre.FirstOrDefault(x => x.Classificazione == classificazione);
            bool aperta = f != null && f.DataInizio <= adesso && adesso <= f.DataFine;
            if (aperta) continue;

            if (p.DataSistemato != null && p.DataSalvataggio != null
                && p.DataSistemato >= p.DataSalvataggio) continue;

            if (!fuori.Contains(p.IdVol)) fuori.Add(p.IdVol);
        }
        return fuori;
    }

    /// <summary>
    /// L'Agenzia dice «FATTO»: ho riportato sull'impaginato quello che il Marketing ha chiesto
    /// (j317). Spegne la casella lampeggiante nella home e il pulsante nella barra del timone.
    ///
    /// Non cambia NIENTE del piano - non sposta, non chiude, non esporta: scrive solo la data e
    /// chi e' stato. E' un segnalibro fra due persone, non uno stato del lavoro. Se il Marketing
    /// salva di nuovo, la data resta ma diventa piu' vecchia dell'ultimo salvataggio e l'avviso
    /// torna da se' (vedi VolantiniDaSistemareAsync).
    /// </summary>
    public async Task<Esito> SistematoAsync(Chi chi, int idVolantino)
    {
        if (!chi.Agenzia)
            return Esito.No(403, "non_autorizzato", "Il «fatto» del timone lo preme l'Agenzia.");

        var vol = await ctx.Volantinis.AsNoTracking().FirstOrDefaultAsync(v => v.Id == idVolantino);
        if (vol == null) return Esito.No(404, "volantino_non_trovato", "Questo volantino non esiste.");

        short versione = await ctx.VolantiniPagines.Where(p => p.IdVol == idVolantino)
            .MaxAsync(p => (short?)p.Versione) ?? 0;
        var piano = await ctx.Timoni.FirstOrDefaultAsync(t => t.IdVol == idVolantino && t.Versione == versione);
        if (piano == null)
            return Esito.No(404, "piano_non_trovato", "Il timone di questo volantino non e' stato aperto.");

        piano.DataSistemato = DateTime.UtcNow;
        piano.IdSistemato = chi.Id;
        await ctx.SaveChangesAsync();

        return await PianoAsync(chi, idVolantino);
    }
}
