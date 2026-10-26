using System.IO.Compression;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using Correggo4.Data;
using Microsoft.EntityFrameworkCore;

namespace Correggo4.Servizi;

/// <summary>
/// L'ESPORTAZIONE DEL TIMONE VERSO IL PLUG-IN — «strada A» (j324).
///
/// Michele, 01/10: «dobbiamo esportare un json (lo puo' vedere solo l'agenzia non il marketing)
/// dove riportiamo tutte le info del timone sui filtri del plug-in… correggo e plug-in devono per
/// forza comunicare sennò perdiamo tutte le info su gruppo e sgruppa non e' solo una questione di
/// posizioni».
///
/// COSA FA: l'Agenzia, a finestra chiusa, scarica un .zip; l'operatore lo copia nella cartella di
/// lavorazione del plug-in. Dentro ci sono quattro file:
///
///   Filtri.json                  il file che il plug-in legge davvero (struttura in
///                                claude/timone-specifica.md §4.1)
///   listaRefEscluse.json         le referenze mandate fuori volantino
///   timone.json                  il piano in chiaro, leggibile da un umano: serve a capire cosa
///                                e' successo quando qualcosa andra' storto. Il plug-in lo ignora.
///   LEGGIMI.txt                  dove va copiato ogni file e cosa NON viene portato
///
/// COSA NON PORTA, e va detto subito perche' e' il limite della strada A (verificato nei sorgenti
/// del plug-in il 01/10, vedi claude/timone-export-plugin.md):
///
///   · I GRUPPI. Nel plug-in il gruppo non sta nel file dei filtri: sta nel TRACCIATO, nei campi
///     Scatto.CodiceGruppo (i codici separati da virgola) e StatoSelezione (quale referenza del
///     gruppo si impagina). La regola e' in chiaro in filtri.js:2170-2171. Quindi raggruppare e
///     sciogliere, per il plug-in, vuol dire CAMBIARE IL LISTATO: nessun file di filtri lo puo'
///     dire. Qui i gruppi finiscono in timone.json, nella forma giusta per il tracciato (campo
///     codiceGruppo), pronti per il giorno in cui si fara' la strada B o C.
///   · LA CASELLA. Dentro la pagina, la posizione si fa con l'etichetta codiceForzato$&lt;codice&gt; su
///     un box del documento InDesign (griglia.js:769-791, 917-933), che il plug-in SCRIVE e non
///     legge mai da un file. Quindi si esporta COSA sta su una pagina e QUANTE referenze, non in
///     che casella. Le posizioni ci sono comunque in timone.json, per l'occhio umano.
///
/// NON SCRIVE NIENTE. L'esportazione e' una lettura: si puo' rifare dieci volte di seguito e il
/// piano non cambia. La specifica prevedeva di portare il piano a stato 2 («esportato») e di
/// rifiutare la seconda esportazione con 409 timone_gia_esportato: non si fa, perche' l'operatore
/// che perde il file o sbaglia cartella deve poterlo riscaricare senza chiamare nessuno. Se un
/// giorno servira' sapere quando e' stato esportato, il posto giusto e' una colonna data nuova,
/// non un divieto.
/// </summary>
public sealed partial class ServizioTimone
{
    /* ====================================================================================
       LA PARTE DA TARARE SUL CAMPIONE VERO — SI CAMBIA SOLO QUI DENTRO

       Il file dei filtri e' il contratto con il plug-in: se la forma non e' quella che si
       aspetta, non serve a niente. Tre cose non si possono LEGGERE nei sorgenti e vanno prese
       da un Filtri*.json vero, uscito da una lavorazione vera (sul server, al 01/10, non ce
       n'e' nessuno: cercato due volte):

         1. la CHIAVE del criterio per selezionare una referenza per codice;
         2. come si scrive l'OPERATORE di uguaglianza dentro il file. Nel codice si vede che al
            momento dell'invio il plug-in lo converte da testo a numero con
            getOperatoreEnumValue() (indexNew.js:2319), e che l'uguaglianza vale 0
            (custom.js:1232): quindi nel FILE c'e' la forma testuale dell'interfaccia, che va
            letta;
         3. il NOME DELLA PAGINA, che per InDesign e' pages[i].name, una stringa: «1», «2», o
            un nome tutto suo.

       Finche' il campione non arriva, qui ci sono le tre ipotesi piu' probabili, e sono
       dichiarate come ipotesi: il LEGGIMI.txt dello zip lo dice all'operatore a chiare lettere.
       Quando il campione arriva si cambiano queste cinque righe e NIENTE ALTRO.
       ==================================================================================== */

    /// <summary>IPOTESI (da campione): la chiave del criterio che seleziona una referenza.</summary>
    private const string ChiaveCriterioCodice = "Referenza.Codice";

    /// <summary>IPOTESI (da campione): l'operatore di uguaglianza, in forma testuale.</summary>
    private const string OperatoreUguale = "Uguale";

    /// <summary>Il limite di una pagina senza limite. Questo e' certo (specifica §4.1).</summary>
    private const string LimiteIllimitato = "Ill.";

    /// <summary>IPOTESI (da campione): il nome InDesign di una pagina e' il suo numero.</summary>
    private static string NomePaginaInDesign(short numero) => numero.ToString();

    /* IL NOME DEL FILE DEI FILTRI: «Filtri.json», secco (j325, 01/10).
       Michele, provando il pacchetto: «i filtri che poi mettero' nella cartella di lavorazione
       devono per forza chiamarsi Filtri.json perche' sennò il plug-in non riesce a leggerli».

       In j324 il file si chiamava «Filtri<titolo del volantino>.json». Non era un'invenzione: nei
       sorgenti del plug-in c'e' una funzione getNomeFileFiltriJson (filtri.js, ~1998) che compone
       il nome mettendo davanti «Filtri» il nome del documento InDesign, e la specifica (§4.1) e'
       stata scritta su quella lettura. Ma chi lo usa ogni giorno dice che in cartella il file si
       chiama «Filtri.json» e basta, e chi lo usa ha ragione su chi lo legge: probabilmente quella
       funzione serve a un altro giro (un salvataggio con nome, o una versione piu' nuova del
       plug-in), oppure il documento di lavoro si chiama sempre allo stesso modo.
       Quando arrivera' il campione vero si sapra' con certezza; fino ad allora il nome e' quello
       che funziona in mano all'operatore, e nel LEGGIMI c'e' scritto di copiarlo COSI' COM'E',
       senza rinominarlo. */
    private const string NomeFileFiltri = "Filtri.json";

    // ------------------------------------------------------------------------- il pacchetto

    /// <summary>Lo zip pronto da mandare al browser.</summary>
    public sealed record Pacchetto(string NomeFile, byte[] Contenuto);

    /* L'ORA DI ROMA. In banca dati le date stanno in UTC (timestamptz) e il browser le converte
       da se': il report di j312 non ha mai avuto questo problema perche' la data la scrive il
       browser. Qui invece il testo lo scrive il SERVER, e una data scritta cosi' com'e' sarebbe
       sbagliata di un'ora (due d'estate). Chi legge il LEGGIMI deve ritrovare l'ora dell'orologio
       che ha davanti. Se il fuso non si trovasse - su un server configurato male - si usa l'ora
       locale della macchina: meglio approssimata che esplosa. */
    private static readonly TimeZoneInfo? FusoRoma = TrovaFusoRoma();

    private static TimeZoneInfo? TrovaFusoRoma()
    {
        foreach (string nome in new[] { "Europe/Rome", "W. Europe Standard Time" })
        {
            try { return TimeZoneInfo.FindSystemTimeZoneById(nome); }
            catch (TimeZoneNotFoundException) { }
            catch (InvalidTimeZoneException) { }
        }
        return null;
    }

    private static DateTime Roma(DateTime utc)
    {
        var u = DateTime.SpecifyKind(utc, DateTimeKind.Utc);
        return FusoRoma == null ? u.ToLocalTime() : TimeZoneInfo.ConvertTimeFromUtc(u, FusoRoma);
    }

    private static DateTime? Roma(DateTime? utc) => utc == null ? null : Roma(utc.Value);

    /// <summary>Adesso, nell'ora di Roma.</summary>
    private static DateTime Adesso => Roma(DateTime.UtcNow);

    private static readonly JsonSerializerOptions ScritturaJson = new()
    {
        WriteIndented = true,
        // senza questo le lettere accentate delle descrizioni escono come è e il file
        // diventa illeggibile per chi lo apre a mano
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };

    /// <summary>
    /// Costruisce il pacchetto dei filtri. Restituisce O l'errore O il pacchetto, mai entrambi:
    /// e' una rotta che scarica un file, quindi non puo' usare la busta { ok, codice, … } come
    /// tutte le altre.
    /// </summary>
    public async Task<(Esito? Errore, Pacchetto? Pacchetto)> EsportaAsync(Chi chi, int idVolantino)
    {
        // 1. chi: solo l'Agenzia. Michele l'ha chiesto esplicitamente («lo puo' vedere solo
        //    l'agenzia non il marketing»), e non e' solo un bottone nascosto: il controllo e' qui.
        if (!chi.Agenzia)
            return (Esito.No(403, "non_autorizzato",
                "I filtri li esporta l'Agenzia."), null);

        var vol = await ctx.Volantinis.AsNoTracking().FirstOrDefaultAsync(v => v.Id == idVolantino);
        if (vol == null)
            return (Esito.No(404, "volantino_non_trovato", "Questo volantino non esiste."), null);

        // 2. quando: a finestra chiusa. A finestra aperta il Marketing sta ancora lavorando e si
        //    esporterebbe un piano che fra cinque minuti e' un altro.
        var (aperta, _, fine) = await FinestraAsync(vol.Classificazione);
        if (aperta)
            return (Esito.No(423, "finestra_timone_aperta",
                "La finestra del Marketing e' aperta: i filtri si esportano quando ha finito."), null);

        short versione = await ctx.VolantiniPagines.Where(p => p.IdVol == idVolantino)
            .MaxAsync(p => (short?)p.Versione) ?? 0;

        var piano = await ctx.Timoni.AsNoTracking()
            .FirstOrDefaultAsync(t => t.IdVol == idVolantino && t.Versione == versione);
        if (piano == null)
            return (Esito.No(404, "timone_non_trovato",
                "Su questo volantino il timone non e' mai stato aperto: non c'e' niente da esportare."), null);

        var pagine = await ctx.TimonePagine.AsNoTracking()
            .Where(p => p.IdTimone == piano.Id)
            .OrderBy(p => p.Ordine).ThenBy(p => p.Numero)
            .ToListAsync();

        var voci = await ctx.TimoneVoci.AsNoTracking()
            .Where(v => v.IdTimone == piano.Id)
            .ToListAsync();

        var blocchi = await ctx.TimoneBlocchi.AsNoTracking()
            .Where(b => b.IdTimone == piano.Id)
            .ToListAsync();

        string? chiHaSalvato = null;
        if (piano.IdUltimoSalvataggio != null)
        {
            var u = await ctx.Utentis.AsNoTracking()
                .Where(x => x.Id == piano.IdUltimoSalvataggio.Value)
                .Select(x => new { x.Nome, x.Cognome }).FirstOrDefaultAsync();
            if (u != null)
            {
                string n = $"{u.Nome} {u.Cognome}".Trim();
                if (n.Length > 0) chiHaSalvato = n;
            }
        }

        string filtri = CostruisciFiltri(pagine, voci, blocchi);
        string escluse = CostruisciEscluse(voci);
        string chiaro = CostruisciTimoneInChiaro(vol.Titolo, vol.Classificazione, versione, piano,
                                                 chiHaSalvato, pagine, voci, blocchi);
        string leggimi = CostruisciLeggimi(vol.Titolo, versione, piano,
                                           chiHaSalvato, voci, fine);

        byte[] zip;
        using (var mem = new MemoryStream())
        {
            using (var archivio = new ZipArchive(mem, ZipArchiveMode.Create, leaveOpen: true))
            {
                Aggiungi(archivio, NomeFileFiltri, filtri);
                Aggiungi(archivio, "listaRefEscluse.json", escluse);
                Aggiungi(archivio, "timone.json", chiaro);
                Aggiungi(archivio, "LEGGIMI.txt", leggimi);
            }
            zip = mem.ToArray();
        }

        // il nome dello zip: si legge a occhio in cartella Download anche fra venti file
        string nomeZip = $"timone-{PulisciNomeFile(vol.Titolo)}-v{versione}-" +
                         $"{Adesso:dd-MM-yyyy}.zip";

        return (null, new Pacchetto(nomeZip, zip));
    }

    private static void Aggiungi(ZipArchive archivio, string nome, string testo)
    {
        var voce = archivio.CreateEntry(nome, CompressionLevel.Optimal);
        using var s = voce.Open();
        // UTF-8 senza BOM: il plug-in gira in ExtendScript e il BOM gli fa indigestione sul
        // primo JSON.parse
        var byt = new UTF8Encoding(false).GetBytes(testo);
        s.Write(byt, 0, byt.Length);
    }

    /// <summary>Via i caratteri che Windows non vuole dentro un nome di file.</summary>
    private static string PulisciNomeFile(string s)
    {
        var b = new StringBuilder(s.Length);
        foreach (char c in s)
            b.Append(c is '\\' or '/' or ':' or '*' or '?' or '"' or '<' or '>' or '|' ? '-' : c);
        return b.ToString().Trim();
    }

    // ------------------------------------------------------------------- il file dei filtri

    /// <summary>
    /// La mappatura della specifica §8.3, riga per riga:
    ///   pagina attiva    → active
    ///   pagina bloccata  → blocco
    ///   pagina ordine    → ordine, rinumerato contiguo da 1; 999 alle pagine senza referenze
    ///   pagina capienza  → limite (0 → "Ill."), MENO le caselle bloccate
    ///   voci stato 0     → un filtro che elenca esattamente quei codici
    ///   voci stato 1     → fuori dai filtri, dentro listaRefEscluse.json
    ///   voci stato 2     → fuori da tutto
    ///
    /// SULLE CASELLE BLOCCATE: una casella bloccata (j279) e' una casella in cui il Marketing ha
    /// detto «qui ci va un qualcosa di grafico, non una referenza». Occupa un posto, quindi il
    /// limite che si manda al plug-in e' capienza - bloccate: se in una 4x4 sono bloccate tre
    /// caselle, su quella pagina entrano tredici referenze, non sedici. E' una sottrazione, non
    /// un'invenzione, ma va detta: sta scritta anche nel LEGGIMI.
    ///
    /// SULLE PAGINE SENZA REFERENZE: la specifica dice «ordine 999 = in fondo». Una pagina senza
    /// referenze non ha niente da impaginare, quindi va in fondo e resta senza filtri. Attenzione:
    /// nel plug-in una pagina SENZA filtri che segue una pagina CON filtri e' una «pagina libera»
    /// e continua il filtro precedente (indexNew.js:2049-2065). Per questo le pagine vuote vanno
    /// in fondo e non in mezzo: in mezzo si riempirebbero da sole con quello che trabocca.
    /// </summary>
    private static string CostruisciFiltri(
        List<Models.VolantiniTimonePagine> pagine,
        List<Models.VolantiniTimoneVoci> voci,
        List<Models.VolantiniTimoneBlocchi> blocchi)
    {
        // le pagine che hanno davvero qualcosa da impaginare, nell'ordine del piano
        var conReferenze = pagine
            .Where(p => voci.Any(v => v.IdPaginaTimone == p.Id && v.Stato == VoceInPagina))
            .ToList();

        var source = new List<object>();
        short n = 1;
        foreach (var p in conReferenze)
        {
            var codici = voci
                .Where(v => v.IdPaginaTimone == p.Id && v.Stato == VoceInPagina)
                .OrderBy(v => v.Posizione ?? short.MaxValue).ThenBy(v => v.Id)
                .SelectMany(v => SpezzaCodici(v.Codice))
                .Where(c => c.Length > 0)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            int bloccate = blocchi.Count(b => b.IdPaginaTimone == p.Id);
            int posti = p.Capienza > 0 ? Math.Max(0, p.Capienza - bloccate) : 0;

            source.Add(new
            {
                pagina = NomePaginaInDesign(p.Numero),
                filtri = new object[]
                {
                    new
                    {
                        criteri = codici.Select(c => new
                        {
                            chiave = ChiaveCriterioCodice,
                            operatore = OperatoreUguale,
                            valore = c
                        }).ToArray(),
                        limite = posti
                    }
                },
                active = p.Attiva,
                blocco = p.Bloccata,
                limite = posti == 0 ? (object)LimiteIllimitato : posti,
                ordine = n
            });
            n++;
        }

        // le pagine vuote: in fondo, senza filtri
        foreach (var p in pagine.Where(x => !conReferenze.Contains(x)))
        {
            int bloccate = blocchi.Count(b => b.IdPaginaTimone == p.Id);
            int posti = p.Capienza > 0 ? Math.Max(0, p.Capienza - bloccate) : 0;
            source.Add(new
            {
                pagina = NomePaginaInDesign(p.Numero),
                filtri = Array.Empty<object>(),
                active = p.Attiva,
                blocco = p.Bloccata,
                limite = posti == 0 ? (object)LimiteIllimitato : posti,
                ordine = 999
            });
        }

        return JsonSerializer.Serialize(new { source }, ScritturaJson);
    }

    /// <summary>
    /// Le referenze mandate FUORI VOLANTINO, nella forma che il plug-in legge
    /// (indexNew.js:2074-2086): [{ Pag, listaEscluse: [...] }].
    ///
    /// Vanno sulla loro PAGINA DI ORIGINE, non su quella di adesso: una referenza fuori volantino
    /// non sta su nessuna pagina del piano, e al plug-in serve sapere da quale pagina va tolta.
    ///
    /// Le ELIMINATE (stato 2) non entrano qui: fuori volantino vuol dire «esiste ma non la
    /// impaginiamo», eliminata vuol dire «il Category ha detto di togliterla del tutto». Sono due
    /// decisioni diverse e si tengono distinte (specifica §6.6); le eliminate stanno in
    /// timone.json, perche' qualcuno le deve pur togliere dal listato.
    /// </summary>
    private static string CostruisciEscluse(List<Models.VolantiniTimoneVoci> voci)
    {
        var fuori = voci.Where(v => v.Stato == VoceFuoriVolantino).ToList();
        var lista = fuori
            .GroupBy(v => v.PaginaOrigine)
            .OrderBy(g => g.Key)
            .Select(g => new
            {
                Pag = g.Key,
                listaEscluse = g.SelectMany(v => SpezzaCodici(v.Codice))
                                .Where(c => c.Length > 0)
                                .Distinct(StringComparer.OrdinalIgnoreCase)
                                .ToArray()
            })
            .ToList();
        return JsonSerializer.Serialize(lista, ScritturaJson);
    }

    /// <summary>
    /// Il piano in chiaro. Non serve al plug-in: serve a chi, fra sei mesi, deve capire perche'
    /// una referenza e' finita dove e' finita. Qui dentro c'e' TUTTO, anche quello che il file dei
    /// filtri non sa dire: i gruppi (nella forma giusta per Scatto.CodiceGruppo) e le posizioni.
    /// </summary>
    private static string CostruisciTimoneInChiaro(
        string titolo, string promo, short versione,
        Models.VolantiniTimone piano, string? chiHaSalvato,
        List<Models.VolantiniTimonePagine> pagine,
        List<Models.VolantiniTimoneVoci> voci,
        List<Models.VolantiniTimoneBlocchi> blocchi)
    {
        // i gruppi, nella forma del tracciato: i codici separati da virgola, e per primo quello
        // della voce che tiene la casella (nel plug-in e' quella con StatoSelezione = 1)
        var gruppi = voci
            .Where(v => v.IdGruppo != null && v.Stato == VoceInPagina)
            .GroupBy(v => v.IdGruppo!.Value)
            .Select(g =>
            {
                var ordinate = g.OrderBy(v => v.Posizione == null ? 1 : 0)
                                .ThenBy(v => v.Posizione ?? short.MaxValue)
                                .ThenBy(v => v.Id).ToList();
                var codici = ordinate.SelectMany(v => SpezzaCodici(v.Codice))
                                     .Where(c => c.Length > 0)
                                     .Distinct(StringComparer.OrdinalIgnoreCase).ToList();
                return new
                {
                    idGruppo = g.Key,
                    // questo e' il valore da mettere in Scatto.CodiceGruppo su TUTTE le referenze
                    // del gruppo, se un giorno si fara' l'aggiornamento del listato (strada B)
                    codiceGruppo = string.Join(",", codici),
                    // e questa e' la referenza da impaginare: StatoSelezione = 1
                    primaria = codici.Count > 0 ? codici[0] : "",
                    pagina = pagine.FirstOrDefault(p => p.Id == ordinate[0].IdPaginaTimone)?.Numero,
                    componenti = ordinate.Select(v => new
                    {
                        codice = v.Codice, etichetta = v.Etichetta, posizione = v.Posizione
                    })
                };
            })
            .ToList();

        var fuoriPagine = pagine.Select(p => new
        {
            numero = p.Numero,
            griglia = p.Griglia,
            capienza = p.Capienza,
            caselleBloccate = blocchi.Where(b => b.IdPaginaTimone == p.Id)
                                     .Select(b => b.Posizione).OrderBy(x => x).ToArray(),
            ordine = p.Ordine,
            attiva = p.Attiva,
            bloccata = p.Bloccata,
            referenze = voci.Count(v => v.IdPaginaTimone == p.Id && v.Stato == VoceInPagina)
        });

        var fuoriVoci = voci
            .OrderBy(v => v.Stato)
            .ThenBy(v => pagine.FirstOrDefault(p => p.Id == v.IdPaginaTimone)?.Numero ?? short.MaxValue)
            .ThenBy(v => v.Posizione ?? short.MaxValue)
            .Select(v => new
            {
                codice = v.Codice,
                etichetta = v.Etichetta,
                stato = NomeStato(v.Stato),
                pagina = pagine.FirstOrDefault(p => p.Id == v.IdPaginaTimone)?.Numero,
                posizione = v.Posizione,
                righe = v.Righe < 1 ? (short)1 : v.Righe,
                colonne = v.Colonne < 1 ? (short)1 : v.Colonne,
                idGruppo = v.IdGruppo,
                paginaOrigine = v.PaginaOrigine,
                // ATTENZIONE a come si legge: posizioneOrigine NON e' una casella della griglia.
                // E' l'ordine di lettura dell'impaginato di partenza, che griglie non le aveva.
                ordineLetturaOrigine = v.PosizioneOrigine,
                spostata = v.PaginaOrigine != (pagine.FirstOrDefault(p => p.Id == v.IdPaginaTimone)?.Numero ?? (short)0),
                dataModifica = Roma(v.DataModifica)
            });

        return JsonSerializer.Serialize(new
        {
            attenzione = "Questo file NON lo legge il plug-in: e' il piano in chiaro, per capire " +
                         "cosa ha deciso il Marketing. Il plug-in legge Filtri*.json e " +
                         "listaRefEscluse.json.",
            volantino = new { titolo, promo, versione },
            piano = new
            {
                revisione = piano.Revisione,
                dataSalvataggio = Roma(piano.DataSalvataggio),
                chiHaSalvato,
                dataEsportazione = Adesso
            },
            cosaNonVieneEsportato = new[]
            {
                "I GRUPPI: nel plug-in stanno nel tracciato (Scatto.CodiceGruppo e " +
                "StatoSelezione), non nel file dei filtri. Qui sotto, nella sezione «gruppi», " +
                "c'e' il valore gia' pronto per il tracciato.",
                "LA CASELLA dentro la pagina: si fa con l'etichetta codiceForzato$<codice> dentro " +
                "il documento InDesign, che il plug-in scrive e non legge mai da un file. Le " +
                "posizioni sono qui sotto solo per l'occhio umano."
            },
            pagine = fuoriPagine,
            gruppi,
            voci = fuoriVoci
        }, ScritturaJson);
    }

    private static string NomeStato(short stato) => stato switch
    {
        VoceInPagina => "in pagina",
        VoceFuoriVolantino => "fuori volantino",
        VoceEliminata => "eliminata",
        VoceInSospeso => "in sospeso",
        _ => "stato " + stato
    };

    /// <summary>
    /// Due facciate di testo per l'operatore. Si scrive come si parla: chi apre questo file sta
    /// in piedi davanti a un computer con una lavorazione aperta, non sta leggendo una specifica.
    /// </summary>
    private static string CostruisciLeggimi(
        string titolo, short versione,
        Models.VolantiniTimone piano, string? chiHaSalvato,
        List<Models.VolantiniTimoneVoci> voci, DateTime? fineFinestra)
    {
        int inPagina = voci.Count(v => v.Stato == VoceInPagina);
        int fuori = voci.Count(v => v.Stato == VoceFuoriVolantino);
        int eliminate = voci.Count(v => v.Stato == VoceEliminata);
        int sospese = voci.Count(v => v.Stato == VoceInSospeso);
        int gruppi = voci.Where(v => v.IdGruppo != null).Select(v => v.IdGruppo!.Value).Distinct().Count();

        var t = new StringBuilder();
        t.AppendLine("TIMONE - FILTRI PER IL PLUG-IN");
        t.AppendLine("==============================");
        t.AppendLine();
        t.AppendLine($"Volantino:    {titolo}  (versione {versione})");
        t.AppendLine($"Piano:        revisione {piano.Revisione}" +
                     (piano.DataSalvataggio != null
                        ? $", salvato il {Roma(piano.DataSalvataggio):dd/MM/yyyy} alle {Roma(piano.DataSalvataggio):HH:mm}"
                        : ", MAI SALVATO"));
        if (chiHaSalvato != null) t.AppendLine($"Salvato da:   {chiHaSalvato}");
        t.AppendLine($"Esportato:    {Adesso:dd/MM/yyyy} alle {Adesso:HH:mm}");
        t.AppendLine();
        t.AppendLine($"Referenze in pagina: {inPagina}   fuori volantino: {fuori}   " +
                     $"eliminate: {eliminate}   gruppi: {gruppi}");
        if (sospese > 0)
            t.AppendLine($"ATTENZIONE: ci sono {sospese} referenze IN SOSPESO, cioe' che nessuno ha " +
                         "ancora messo da nessuna parte. Non sono in nessun filtro.");
        t.AppendLine();
        t.AppendLine("DOVE VA COPIATO OGNI FILE");
        t.AppendLine("-------------------------");
        t.AppendLine($"  {NomeFileFiltri}");
        t.AppendLine("      nella cartella di lavorazione del plug-in, accanto al documento");
        t.AppendLine("      InDesign. COPIALO COSI' COM'E', senza rinominarlo: il plug-in cerca");
        t.AppendLine("      un file che si chiama esattamente «Filtri.json».");
        t.AppendLine("      Se nella cartella ce n'e' gia' uno, mettilo da parte prima di");
        t.AppendLine("      sovrascriverlo: e' il lavoro del giro precedente.");
        t.AppendLine();
        t.AppendLine("  listaRefEscluse.json");
        t.AppendLine("      stessa cartella. Sono le referenze mandate fuori volantino.");
        t.AppendLine();
        t.AppendLine("  timone.json");
        t.AppendLine("      NON va copiato da nessuna parte: il plug-in non lo legge. Serve a");
        t.AppendLine("      capire cosa ha deciso il Marketing, e a ritrovare le informazioni che");
        t.AppendLine("      i filtri non sanno portare (vedi sotto). Tienilo con il volantino.");
        t.AppendLine();
        t.AppendLine("  LEGGIMI.txt");
        t.AppendLine("      questo foglio.");
        t.AppendLine();
        t.AppendLine("COSA QUESTI FILE NON PORTANO");
        t.AppendLine("----------------------------");
        t.AppendLine("1. I GRUPPI (raggruppa e sciogli). Il plug-in il gruppo non lo legge nei");
        t.AppendLine("   filtri: lo legge nel LISTATO, nei campi Scatto.CodiceGruppo e");
        t.AppendLine("   StatoSelezione. Quindi i gruppi decisi nel timone vanno riportati a mano,");
        t.AppendLine("   oppure sul listato. In timone.json, sezione «gruppi», c'e' per ognuno il");
        t.AppendLine("   valore gia' pronto (codiceGruppo) e quale referenza impaginare (primaria).");
        t.AppendLine();
        t.AppendLine("2. LA CASELLA dentro la pagina. Il plug-in inchioda una referenza a una");
        t.AppendLine("   casella con un'etichetta dentro il documento InDesign, non con un file:");
        t.AppendLine("   quindi questi filtri dicono QUALI referenze vanno su una pagina e QUANTE,");
        t.AppendLine("   non in che casella. Le posizioni del timone sono in timone.json.");
        t.AppendLine();
        t.AppendLine("3. Le referenze ELIMINATE non stanno in nessuno dei due file del plug-in:");
        t.AppendLine("   eliminata vuol dire «togliere del tutto», ed e' una cosa da fare sul");
        t.AppendLine("   listato. L'elenco e' in timone.json.");
        t.AppendLine();
        t.AppendLine("DA VERIFICARE ALLA PRIMA PROVA  <-- IMPORTANTE");
        t.AppendLine("---------------------------------------------");
        t.AppendLine("Tre cose di questo file dei filtri sono una IPOTESI, perche' sono state");
        t.AppendLine("ricostruite dai sorgenti del plug-in e non da un file vero:");
        t.AppendLine($"  · la chiave del criterio      «{ChiaveCriterioCodice}»");
        t.AppendLine($"  · l'operatore di uguaglianza  «{OperatoreUguale}»");
        t.AppendLine("  · il nome della pagina         il numero di pagina («1», «2», ...)");
        t.AppendLine("Alla prima prova vera: apri una lavorazione, guarda il Filtri*.json che il");
        t.AppendLine("plug-in scrive da solo, e confronta queste tre cose. Se sono diverse,");
        t.AppendLine("segnalalo: si cambiano in un punto solo e l'esportazione torna giusta.");
        t.AppendLine();
        t.AppendLine("UN'ULTIMA COSA SUL LIMITE DELLE PAGINE");
        t.AppendLine("--------------------------------------");
        t.AppendLine("Il «limite» di una pagina e' il numero di caselle della sua griglia MENO le");
        t.AppendLine("caselle che il Marketing ha bloccato (quelle col divieto d'accesso, dove ci");
        t.AppendLine("andra' un qualcosa di grafico). «Ill.» vuol dire senza limite: e' una pagina");
        t.AppendLine("a cui nel timone non e' stata data nessuna griglia.");
        if (fineFinestra != null)
        {
            t.AppendLine();
            t.AppendLine($"(La finestra del Marketing si e' chiusa il {Roma(fineFinestra):dd/MM/yyyy} " +
                         $"alle {Roma(fineFinestra):HH:mm}.)");
        }
        return t.ToString();
    }
}
