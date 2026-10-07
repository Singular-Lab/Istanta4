using Correggo4.Models;
using Microsoft.EntityFrameworkCore;

namespace Correggo4.Servizi;

/// <summary>
/// Il salvataggio del piano (j256): la bozza e il SALVA.
///
/// COME FUNZIONA, ed e' il punto piu' importante di tutto il timone (specifica 10bis):
/// quello che il Marketing fa nel timone - cambiare griglia, spostare, raggruppare - resta
/// **nel browser**. Sul server non si scrive niente finche' non si preme SALVA. Il motivo e'
/// che il Marketing PROVA: sposta, guarda, rimette a posto. Se ogni gesto scrivesse in banca
/// dati, «annulla» diventerebbe una cronologia da gestire e due persone sullo stesso volantino
/// si pesterebbero i piedi a ogni mossa. La regola e' semplice: **quello che vedi e' tuo finche'
/// non premi SALVA**.
///
/// SALVA manda tutto in una volta e questo e' **l'unico punto in cui il server controlla le
/// regole**. Se una sola non torna, non si salva niente e la risposta dice quale voce e perche'.
///
/// La REVISIONE evita che due persone si sovrascrivano: il browser ha caricato la revisione 7 e
/// ha lavorato dieci minuti; se nel frattempo qualcun altro ha salvato la 8, il salvataggio viene
/// rifiutato con 409 timone_cambiato e non si perde il lavoro dell'altro.
/// </summary>
public sealed partial class ServizioTimone
{
    /// <summary>Una pagina come la manda il browser al salvataggio.</summary>
    public sealed record PaginaSalvata(long Id, string? Griglia, short? Ordine, bool? Attiva, bool? Bloccata);

    /// <summary>
    /// Una voce come la manda il browser al salvataggio. Colonne e Righe dicono quante caselle
    /// occupa (j274): se non arrivano, vale una sola casella, com'era prima.
    /// </summary>
    public sealed record VoceSalvata(long Id, long? IdPagina, short? Posizione, short Stato,
                                     long? IdGruppo, short? Colonne = null, short? Righe = null);

    /// <summary>
    /// Una casella bloccata come la manda il browser (j279): niente altro che la pagina e la
    /// casella. Il blocco prende una casella sola, per decisione di Michele (28/09).
    /// </summary>
    public sealed record BloccoSalvato(long IdPagina, short Posizione);

    /// <summary>
    /// Scrive tutto il piano in un colpo solo. Lo puo' fare chi in questo momento ha il timone:
    /// il Marketing a finestra aperta, l'Agenzia a finestra chiusa.
    ///
    /// LE CASELLE BLOCCATE (j279) seguono una regola diversa dalle voci: se <c>blocchi</c> arriva
    /// null, quelle gia' salvate restano dove sono (cosi' un browser vecchio che non le conosce
    /// non le cancella per sbaglio); se arriva una lista - anche vuota - quella lista SOSTITUISCE
    /// tutte le caselle bloccate del piano.
    /// </summary>
    public async Task<Esito> SalvaAsync(Chi chi, int idVolantino, int? revisione,
                                        List<PaginaSalvata>? pagine, List<VoceSalvata>? voci,
                                        List<BloccoSalvato>? blocchi = null)
    {
        var vol = await ctx.Volantinis.AsNoTracking().FirstOrDefaultAsync(v => v.Id == idVolantino);
        if (vol == null) return Esito.No(404, "volantino_non_trovato", "Questo volantino non esiste.");

        var no = await PuoScrivereAsync(chi, vol.Classificazione);
        if (no != null) return no;

        short versione = await ctx.VolantiniPagines.Where(p => p.IdVol == idVolantino)
            .MaxAsync(p => (short?)p.Versione) ?? 0;
        var piano = await ctx.Timoni.FirstOrDefaultAsync(t => t.IdVol == idVolantino && t.Versione == versione);
        if (piano == null)
            return Esito.No(404, "piano_non_trovato", "Il timone di questo volantino non e' ancora stato aperto.");

        if (revisione == null || revisione.Value != piano.Revisione)
            return Esito.No(409, "timone_cambiato",
                "Qualcun altro ha salvato il timone mentre stavi lavorando. Ricarica il piano e rifai le tue modifiche: " +
                "cosi' non si cancella il lavoro dell'altro.");

        var righePagine = await ctx.TimonePagine.Where(p => p.IdTimone == piano.Id).ToListAsync();
        var righeVoci = await ctx.TimoneVoci.Where(v => v.IdTimone == piano.Id).ToListAsync();
        var righeBlocchi = await ctx.TimoneBlocchi.Where(b => b.IdTimone == piano.Id).ToListAsync();
        var perIdPagina = righePagine.ToDictionary(p => p.Id);
        var perIdVoce = righeVoci.ToDictionary(v => v.Id);

        // ---------------------------------------------------------------- le pagine
        var grigliaDi = new Dictionary<long, Griglia?>();
        foreach (var p in righePagine) grigliaDi[p.Id] = GriglieFormato.Trova(p.Griglia);

        foreach (var p in pagine ?? new List<PaginaSalvata>())
        {
            if (!perIdPagina.TryGetValue(p.Id, out var riga))
                return Esito.No(404, "pagina_non_trovata", $"La pagina {p.Id} non e' in questo piano.");

            if (string.IsNullOrWhiteSpace(p.Griglia))
            {
                grigliaDi[p.Id] = null;
            }
            else
            {
                var g = GriglieFormato.Trova(p.Griglia);
                if (g == null)
                    return Esito.No(400, "griglia_non_ammessa",
                        $"«{p.Griglia}» non e' una delle griglie a sistema ({string.Join(", ", GriglieFormato.Ammesse().Select(x => x.Nome))}).");
                grigliaDi[p.Id] = g;
            }
        }

        // ---------------------------------------------------------------- le voci
        var nuovoStato = new Dictionary<long, VoceSalvata>();
        foreach (var v in voci ?? new List<VoceSalvata>())
        {
            if (!perIdVoce.ContainsKey(v.Id))
                return Esito.No(404, "voce_non_trovata", $"La referenza {v.Id} non e' in questo piano.");
            if (v.Stato is not (VoceInPagina or VoceFuoriVolantino or VoceEliminata or VoceInSospeso))
                return Esito.No(400, "stato_non_valido", $"Stato {v.Stato} sconosciuto per la referenza {v.Id}.");
            if (v.Stato == VoceInPagina)
            {
                if (v.IdPagina == null || !perIdPagina.ContainsKey(v.IdPagina.Value))
                    return Esito.No(400, "posizione_non_valida",
                        $"La referenza {v.Id} risulta in pagina ma senza una pagina valida.");
            }
            nuovoStato[v.Id] = v;
        }

        // lo stato finale di ogni voce: quelle che il browser non ha mandato restano come sono
        var finale = new List<(VolantiniTimoneVoci Riga, long? IdPagina, short? Posizione, short Stato,
                               long? IdGruppo, short Colonne, short Righe)>();
        foreach (var riga in righeVoci)
        {
            if (nuovoStato.TryGetValue(riga.Id, out var v))
            {
                short col = v.Colonne is > 0 ? v.Colonne.Value : (short)1;
                short rig = v.Righe is > 0 ? v.Righe.Value : (short)1;
                // fuori dalla pagina l'ingombro non vuol dire niente: torna a una casella sola
                if (v.Stato != VoceInPagina) { col = 1; rig = 1; }
                finale.Add((riga, v.Stato == VoceInPagina ? v.IdPagina : null,
                            v.Stato == VoceInPagina ? v.Posizione : null, v.Stato, v.IdGruppo, col, rig));
            }
            else
            {
                finale.Add((riga, riga.IdPaginaTimone, riga.Posizione, riga.Stato, riga.IdGruppo,
                            riga.Colonne < 1 ? (short)1 : riga.Colonne,
                            riga.Righe < 1 ? (short)1 : riga.Righe));
            }
        }

        // ------------------------------------------------------- le caselle bloccate (j279)
        // Se il browser non le manda, restano quelle salvate. Se le manda, la sua lista e' la
        // verita': si sostituiscono tutte.
        var bloccateFinali = new Dictionary<long, List<short>>();
        if (blocchi == null)
        {
            foreach (var b in righeBlocchi)
            {
                if (!bloccateFinali.TryGetValue(b.IdPaginaTimone, out var l) || l == null)
                {
                    l = new List<short>();
                    bloccateFinali[b.IdPaginaTimone] = l;
                }
                l.Add(b.Posizione);
            }
        }
        else
        {
            foreach (var b in blocchi)
            {
                if (!perIdPagina.TryGetValue(b.IdPagina, out var rigaPag))
                    return Esito.No(404, "pagina_non_trovata",
                        $"La pagina {b.IdPagina} della casella bloccata non e' in questo piano.");
                if (b.Posizione < 1)
                    return Esito.No(400, "blocco_non_valido",
                        $"In pagina {rigaPag.Numero} una casella bloccata non ha un numero valido.");
                if (!bloccateFinali.TryGetValue(b.IdPagina, out var l) || l == null)
                {
                    l = new List<short>();
                    bloccateFinali[b.IdPagina] = l;
                }
                if (l.Contains(b.Posizione))
                    return Esito.No(400, "blocco_doppio",
                        $"In pagina {rigaPag.Numero} la casella {b.Posizione} risulta bloccata due volte.");
                l.Add(b.Posizione);
            }
        }

        /* ------------------------------------------------------------ i GRUPPI (j290)
           Un gruppo occupa UNA casella: la tiene il capogruppo e gli altri gli stanno dietro con
           la Posizione a null. Qui si fa rispettare l'invariante, perche' tutto il conto delle
           caselle che viene dopo si fida di questo: chi non ha una casella non occupa niente.
           Michele, 29/09, sul perche' i gruppi esistono: «se volessero mettere un singolo e
           unirlo con altre referenze per prendere meno spazio in volantino». Meno spazio vuol
           dire esattamente una casella per tutto il gruppo. */
        foreach (var gr in finale.Where(f => f.Stato == VoceInPagina && f.IdGruppo != null)
                                 .GroupBy(f => f.IdGruppo!.Value))
        {
            var capi = gr.Where(f => f.Posizione != null && f.Posizione >= 1).ToList();
            var nomi = string.Join(", ", gr.Select(f => "«" + f.Riga.Codice + "»"));
            if (capi.Count == 0)
                return Esito.No(400, "gruppo_senza_capo",
                    $"Il gruppo di {nomi} non ha nessuna casella: una delle referenze del gruppo " +
                    "deve tenere la casella, le altre le stanno dietro.");
            if (capi.Count > 1)
                return Esito.No(400, "gruppo_con_due_capi",
                    $"Il gruppo di {nomi} occupa {capi.Count} caselle: un gruppo ne occupa una sola. " +
                    "Se le referenze devono stare in caselle diverse, prima va sciolto.");
        }

        // una referenza in pagina che NON e' in un gruppo la sua casella deve averla
        foreach (var f in finale.Where(f => f.Stato == VoceInPagina && f.IdGruppo == null))
            if (f.Posizione == null || f.Posizione < 1)
                return Esito.No(400, "posizione_non_valida",
                    $"La referenza «{f.Riga.Codice}» risulta in pagina ma senza una casella.");

        // ---------------------------------------------------------------- le regole
        // Da j274 una referenza non occupa piu' una casella ma un RETTANGOLO: la posizione e'
        // la casella in alto a sinistra, colonne e righe dicono quanto e' grande. Quindi non
        // basta piu' controllare che due referenze non abbiano la stessa posizione: bisogna
        // controllare che i rettangoli non si accavallino e che nessuno esca dalla griglia.
        // j279: si controllano anche le pagine che hanno SOLO caselle bloccate e nessuna referenza,
        // sennò (senza referenze) un blocco fuori griglia passerebbe liscio.
        var idPagineDaControllare = finale.Where(f => f.Stato == VoceInPagina && f.IdPagina != null)
            .Select(f => f.IdPagina!.Value).Concat(bloccateFinali.Keys).Distinct().ToList();

        foreach (var idPag in idPagineDaControllare)
        {
            var g = grigliaDi.TryGetValue(idPag, out var gg) ? gg : null;
            short numero = perIdPagina[idPag].Numero;
            /* j290: chi sta dietro a un capogruppo non ha una casella e non occupa niente, quindi
               nel conto delle caselle non entra. Il gruppo pesa per uno: quello del capogruppo. */
            var dentro = finale.Where(f => f.Stato == VoceInPagina && f.IdPagina == idPag
                                           && f.Posizione != null).ToList();
            var bloccate = bloccateFinali.TryGetValue(idPag, out var bb) ? bb : new List<short>();

            if (g == null)
            {
                // una casella bloccata e' una casella: senza griglia le caselle non esistono
                if (bloccate.Count > 0)
                    return Esito.No(400, "blocco_senza_griglia",
                        $"In pagina {numero} c'e' una casella bloccata, ma la pagina non ha una griglia.");

                // senza griglia non ci sono caselle da occupare: si accetta solo l'ingombro minimo
                var viste = new HashSet<short>();
                foreach (var f in dentro)
                {
                    if (f.Colonne != 1 || f.Righe != 1)
                        return Esito.No(400, "ingombro_senza_griglia",
                            $"In pagina {numero} la referenza «{f.Riga.Codice}» e' allargata, ma la pagina non ha una griglia.");
                    if (f.Posizione == null || f.Posizione < 1)
                        return Esito.No(400, "posizione_non_valida",
                            $"In pagina {numero} la referenza «{f.Riga.Codice}» non ha una casella.");
                    if (!viste.Add(f.Posizione.Value))
                        return Esito.No(400, "posizione_non_valida",
                            $"In pagina {numero} due referenze finirebbero nella stessa casella ({f.Posizione}).");
                }
                continue;
            }

            foreach (var pos in bloccate)
                if (pos > g.Posti)
                    return Esito.No(400, "blocco_fuori_griglia",
                        $"In pagina {numero} risulta bloccata la casella {pos}, ma la {g.Nome} ne ha {g.Posti}.");

            // j279: le caselle bloccate contano come occupate. Una 2x3 con una casella bloccata
            // tiene cinque referenze, non sei.
            int quanteCaselle = dentro.Sum(f => f.Colonne * f.Righe) + bloccate.Count;
            if (quanteCaselle > g.Posti)
                return Esito.No(409, "pagina_piena",
                    $"In pagina {numero} servono {quanteCaselle} caselle" +
                    (bloccate.Count > 0 ? $" (di cui {bloccate.Count} bloccate)" : "") +
                    $" e nella {g.Nome} ce ne sono {g.Posti}.");

            // la mappa delle caselle prese: 0 = libera, -1 = bloccata, altrimenti l'id di chi la occupa
            var prese = new long[g.Posti];
            foreach (var pos in bloccate) prese[pos - 1] = -1;

            foreach (var f in dentro)
            {
                if (f.Posizione == null || f.Posizione < 1)
                    return Esito.No(400, "posizione_non_valida",
                        $"In pagina {numero} la referenza «{f.Riga.Codice}» non ha una casella.");
                if (f.Posizione > g.Posti)
                    return Esito.No(400, "posizione_non_valida",
                        $"In pagina {numero} la referenza «{f.Riga.Codice}» finirebbe nella casella {f.Posizione}, " +
                        $"ma la {g.Nome} ne ha {g.Posti}.");

                int i = f.Posizione.Value - 1;
                int riga0 = i / g.Colonne, col0 = i % g.Colonne;

                if (col0 + f.Colonne > g.Colonne)
                    return Esito.No(400, "ingombro_fuori_griglia",
                        $"In pagina {numero} la referenza «{f.Riga.Codice}» e' larga {f.Colonne} caselle " +
                        $"ma dalla casella {f.Posizione} ne restano {g.Colonne - col0} fino al bordo.");
                if (riga0 + f.Righe > g.Righe)
                    return Esito.No(400, "ingombro_fuori_griglia",
                        $"In pagina {numero} la referenza «{f.Riga.Codice}» e' alta {f.Righe} caselle " +
                        $"ma dalla casella {f.Posizione} ne restano {g.Righe - riga0} fino in fondo.");

                for (int r = riga0; r < riga0 + f.Righe; r++)
                    for (int c = col0; c < col0 + f.Colonne; c++)
                    {
                        int k = r * g.Colonne + c;
                        if (prese[k] == -1)
                            return Esito.No(400, "blocco_occupato",
                                $"In pagina {numero} «{f.Riga.Codice}» finirebbe sulla casella {k + 1}, " +
                                "che e' bloccata.");
                        if (prese[k] != 0)
                            return Esito.No(400, "caselle_accavallate",
                                $"In pagina {numero} «{f.Riga.Codice}» si accavalla su un'altra referenza " +
                                $"nella casella {k + 1}.");
                        prese[k] = f.Riga.Id;
                    }
            }
        }

        // un gruppo non puo' stare a cavallo di due pagine
        foreach (var gr in finale.Where(f => f.IdGruppo != null && f.Stato == VoceInPagina)
                                 .GroupBy(f => f.IdGruppo!.Value))
        {
            if (gr.Select(f => f.IdPagina).Distinct().Count() > 1)
                return Esito.No(409, "gruppo_pagine_diverse",
                    "Un gruppo non puo' stare metà su una pagina e metà su un'altra: prima vanno rimesse insieme.");
        }

        // gli elementi in sospeso bloccano il salvataggio (specifica 6.7, voluto da Michele).
        // Gli eliminati e i fuori volantino no: quelli sono una scelta, non un problema aperto.
        int sospesi = finale.Count(f => f.Stato == VoceInSospeso);
        if (sospesi > 0)
            return Esito.No(409, "elementi_in_sospeso",
                $"Ci sono {sospesi} " + (sospesi == 1 ? "elemento in sospeso" : "elementi in sospeso") +
                ": inserire prima tutti gli elementi nel volantino prima di procedere con il salvataggio.");

        // ---------------------------------------------------------------- si scrive, tutto insieme
        var adesso = DateTime.UtcNow;
        using var trans = await ctx.Database.BeginTransactionAsync();
        try
        {
            foreach (var p in righePagine)
            {
                var g = grigliaDi.TryGetValue(p.Id, out var gg) ? gg : null;
                p.Griglia = g?.Nome;
                p.Capienza = (short)(g?.Posti ?? 0);
                var mandata = (pagine ?? new List<PaginaSalvata>()).FirstOrDefault(x => x.Id == p.Id);
                if (mandata != null)
                {
                    if (mandata.Ordine != null) p.Ordine = mandata.Ordine.Value;
                    if (mandata.Attiva != null) p.Attiva = mandata.Attiva.Value;
                    if (mandata.Bloccata != null) p.Bloccata = mandata.Bloccata.Value;
                }
            }

            foreach (var f in finale)
            {
                bool cambiata = f.Riga.IdPaginaTimone != f.IdPagina || f.Riga.Posizione != f.Posizione
                                || f.Riga.Stato != f.Stato || f.Riga.IdGruppo != f.IdGruppo
                                || f.Riga.Colonne != f.Colonne || f.Riga.Righe != f.Righe;
                f.Riga.IdPaginaTimone = f.IdPagina;
                f.Riga.Posizione = f.Posizione;
                f.Riga.Stato = f.Stato;
                f.Riga.IdGruppo = f.IdGruppo;
                f.Riga.Colonne = f.Colonne;
                f.Riga.Righe = f.Righe;
                if (cambiata) { f.Riga.DataModifica = adesso; f.Riga.IdAutore = chi.Id; }
            }

            // j279: le caselle bloccate si riscrivono tutte solo se il browser le ha mandate.
            // Si buttano e si rifanno: sono due numeri, non c'e' niente da conservare, e cosi'
            // non restano in giro blocchi di pagine che nel frattempo hanno cambiato griglia.
            if (blocchi != null)
            {
                ctx.TimoneBlocchi.RemoveRange(righeBlocchi);
                foreach (var coppia in bloccateFinali)
                    foreach (var pos in coppia.Value)
                        ctx.TimoneBlocchi.Add(new VolantiniTimoneBlocchi
                        {
                            IdTimone = piano.Id,
                            IdPaginaTimone = coppia.Key,
                            Posizione = pos,
                            DataModifica = adesso,
                            IdAutore = chi.Id
                        });
            }

            piano.Revisione += 1;
            piano.DataModifica = adesso;
            piano.DataSalvataggio = adesso;
            piano.IdUltimoSalvataggio = chi.Id;

            await ctx.SaveChangesAsync();
            await trans.CommitAsync();
        }
        catch
        {
            await trans.RollbackAsync();
            throw;
        }

        return await PianoAsync(chi, idVolantino);
    }

    /// <summary>
    /// Rimette il piano com'era all'inizio: butta via tutto e rifa' la fotografia dal volantino
    /// impaginato. E' il bottone «rimetti com'era all'inizio», quello nascosto, e chiede conferma
    /// nell'interfaccia perche' qui si perde davvero il lavoro fatto.
    ///
    /// Attenzione: questo tocca il server subito, non e' una modifica della bozza. La differenza
    /// con ANNULLA e' tutta qui - ANNULLA ricarica l'ultimo salvataggio e non scrive niente,
    /// questo cancella anche i salvataggi e riparte dall'impaginato.
    /// </summary>
    public async Task<Esito> RimettiComeEraAsync(Chi chi, int idVolantino)
    {
        var vol = await ctx.Volantinis.AsNoTracking().FirstOrDefaultAsync(v => v.Id == idVolantino);
        if (vol == null) return Esito.No(404, "volantino_non_trovato", "Questo volantino non esiste.");

        var no = await PuoScrivereAsync(chi, vol.Classificazione);
        if (no != null) return no;

        short versione = await ctx.VolantiniPagines.Where(p => p.IdVol == idVolantino)
            .MaxAsync(p => (short?)p.Versione) ?? 0;
        if (versione == 0) return Esito.No(409, "volantino_senza_pagine", "Questo volantino non ha ancora pagine.");

        var piano = await ctx.Timoni.FirstOrDefaultAsync(t => t.IdVol == idVolantino && t.Versione == versione);
        if (piano == null)
            return Esito.No(404, "piano_non_trovato", "Il timone di questo volantino non e' ancora stato aperto.");

        using var trans = await ctx.Database.BeginTransactionAsync();
        try
        {
            // j279: prima i blocchi, che pendono dalle pagine
            await ctx.TimoneBlocchi.Where(b => b.IdTimone == piano.Id).ExecuteDeleteAsync();
            await ctx.TimoneVoci.Where(v => v.IdTimone == piano.Id).ExecuteDeleteAsync();
            await ctx.TimonePagine.Where(p => p.IdTimone == piano.Id).ExecuteDeleteAsync();
            ctx.Timoni.Remove(piano);
            await ctx.SaveChangesAsync();

            await FotografaAsync(chi.Id, idVolantino, versione);
            await trans.CommitAsync();
        }
        catch
        {
            await trans.RollbackAsync();
            throw;
        }

        return await PianoAsync(chi, idVolantino);
    }
}
