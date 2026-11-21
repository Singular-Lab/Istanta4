using Correggo4.Auth;
using Microsoft.EntityFrameworkCore;

namespace Correggo4.Servizi;

/// <summary>
/// I20-1233: uno scambio del menabo' avanzato come lo legge il Report Correggo del Plugin. La referenza
/// (il box Basecode) va al posto del box che nell'impaginato occupava la casella dove il Marketing l'ha
/// messa (BasecodeDestinazione), nella stessa pagina. DaSistemareAMano dice perche' il Plugin non lo puo'
/// applicare da solo (una griglia nuova, una casella che nell'impaginato era vuota): allora e' solo da
/// leggere.
///
/// BoundsDestinazione e' il rettangolo [y1, x1, y2, x2] che quella casella aveva nell'impaginato
/// fotografato, relativo alla pagina come lo manda l'export: il Plugin mette il box li', qualunque cosa
/// ci sia adesso, e se il box c'e' gia' lo lascia stare. Cosi' i giri del Marketing sullo stesso export
/// si possono applicare uno dopo l'altro: una referenza rimessa nella sua casella (Basecode uguale a
/// BasecodeDestinazione) torna al suo posto anche se un giro precedente l'aveva spostata.
///
/// Un RAGGRUPPAMENTO (Unisci non null) e' lo scambio del capogruppo di un gruppo del timone: il box del
/// capogruppo (Basecode) e i box di Unisci diventano un box solo con le referenze di Codici, nel
/// rettangolo BoundsDestinazione. Si applica con il Raggruppa di Istanta.
///
/// Codici sono le referenze che nel menabo' stanno insieme a questa (il suo gruppo, o lei sola),
/// CodiciDelBox quelle del suo box nell'export, CodiciTimone quelle del menabo' sulla pagina. Al Plugin
/// servono per lo SGRUPPA: se nel documento il box ha referenze in piu' e vengono tutte da altri box del
/// menabo', e' un gruppo formato in Correggo e unito da un giro precedente, e si divide con lo Sgruppa di
/// Istanta. Una linea nata in Istanta divisa nel menabo' invece e' a mano (decisione dell'operatore, 13/11).
/// </summary>
public sealed record ScambioTimone(
    long IdVoce, short Pagina, string Codice,
    long? IdBox, string Basecode, string LabelBox,
    long? IdBoxDestinazione, string BasecodeDestinazione, string LabelBoxDestinazione,
    string? DaSistemareAMano, decimal[]? BoundsDestinazione = null,
    short Casella = 0, short Colonne = 1, short Righe = 1,
    IReadOnlyList<BoxDaUnire>? Unisci = null, IReadOnlyList<string>? Codici = null,
    IReadOnlyList<string>? CodiciDelBox = null, IReadOnlyList<string>? CodiciTimone = null);

/// <summary>I20-1233: un box dell'export che un raggruppamento del timone unisce al box del capogruppo,
/// con la pagina dove sta nell'impaginato (un'unione puo' prendere una referenza da un'altra pagina).</summary>
public sealed record BoxDaUnire(long IdBox, string Basecode, string LabelBox, short Pagina,
    IReadOnlyList<string>? Codici = null);

/// <summary>I20-1233: gli scambi del piano che aspettano l'Agenzia, e quante altre modifiche ha il piano.</summary>
public sealed record ScambiTimone(
    long IdPiano, DateTime DataSalvataggio, string Autore, string TipoAutore,
    List<ScambioTimone> Scambi, int AltreModifiche);

public sealed partial class ServizioTimone
{
    /// <summary>
    /// I20-1233: gli scambi di posto che il Marketing ha fatto nel menabo' avanzato, per il Report Correggo
    /// del Plugin. Ci sono solo quando c'e' davvero lavoro per l'Agenzia, con la stessa regola dell'avviso
    /// TIMONE lampeggiante (VolantiniDaSistemareAsync): piano della versione di adesso, salvato con delle
    /// modifiche, finestra del Marketing chiusa, nessun FATTO dopo l'ultimo salvataggio. Altrimenti null.
    ///
    /// Il timone sposta le referenze solo dentro la stessa pagina (timone.js, «per adesso solo dentro la
    /// stessa pagina»), e finche' la pagina non ha una griglia la casella N e' il box N dell'impaginato in
    /// ordine di lettura (FotografaAsync): quindi una referenza nella casella N va al posto del box che
    /// aveva PosizioneOrigine N.
    ///
    /// La griglia: il timone ne mette da solo una DI PARTENZA a ogni pagina che mostra, ricavata
    /// dall'impaginato, e al primo SALVA la scrive (grigliaDiPartenza in timone.js). Con quella le
    /// caselle sono ancora numerate in ordine di lettura e lo scambio e' automatico. Diventa a mano se
    /// la griglia e' un'altra (l'ha cambiata il Marketing, o il timone allargando una referenza: in
    /// tutti e due i casi rinumera le caselle).
    ///
    /// Una pagina COME IMPAGINATA (GriglieFormato.Impaginata, il ricalco delle pagine che nessuna griglia
    /// a sistema disegna) ha la casella N sul box N dell'impaginato: non e' mai ridisegnata, e ogni
    /// referenza cambiata va nel rettangolo del box vero.
    ///
    /// Una referenza allargata (Colonne o Righe oltre 1) prende il box che nell'impaginato stava nella sua
    /// casella in alto a sinistra, allargato ai box delle altre caselle che copre se stanno sulla stessa
    /// riga (per le colonne) o sulla stessa colonna (per le righe): RettangoloAllargato.
    ///
    /// Un GRUPPO DEL TIMONE (referenze in pagina con lo stesso IdGruppo che vengono da almeno due box
    /// dell'export, come lo intende la specifica) cambiato dopo l'ultimo FATTO diventa un raggruppamento:
    /// lo scambio del suo capogruppo, con i box da unire. Resta a mano se un box ci entra solo in parte
    /// (servirebbe prima uno sgruppa) o se una referenza non ha il box dell'export.
    ///
    /// AltreModifiche conta quello che non e' uno scambio (fuori volantino, sospese, referenze staccate,
    /// caselle bloccate, pagine riordinate o spente, correzioni del gruppo): con almeno una, il FATTO lo
    /// preme l'Agenzia a mano.
    /// </summary>
    public async Task<ScambiTimone?> ScambiPerPluginAsync(int idVolantino)
    {
        var vol = await ctx.Volantinis.AsNoTracking().FirstOrDefaultAsync(v => v.Id == idVolantino);
        if (vol == null) return null;

        short versione = await ctx.VolantiniPagines.Where(p => p.IdVol == idVolantino)
            .MaxAsync(p => (short?)p.Versione) ?? 0;
        var piano = await ctx.Timoni.AsNoTracking()
            .FirstOrDefaultAsync(t => t.IdVol == idVolantino && t.Versione == versione);
        if (piano == null || piano.DataSalvataggio == null) return null;
        if (piano.DataSistemato != null && piano.DataSistemato >= piano.DataSalvataggio) return null;

        var (aperta, _, _) = await FinestraAsync(vol.Classificazione);
        if (aperta) return null;

        var voci = await ctx.TimoneVoci.AsNoTracking().Where(v => v.IdTimone == piano.Id).ToListAsync();
        // Conta solo quello che il Marketing ha cambiato dopo l'ultimo FATTO: il resto l'Agenzia l'ha gia'
        // riportato (con il Plugin o a mano) e non si rivede. Prova del 13/11: le pagine 6 e 15, sistemate
        // con il FATTO delle 12:32, tornavano a ogni giro.
        var soglia = piano.DataSistemato;
        bool Recente(DateTime? d) => d != null && (soglia == null || d > soglia);
        if (!voci.Any(v => Recente(v.DataModifica))) return null;

        var pagine = await ctx.TimonePagine.AsNoTracking().Where(p => p.IdTimone == piano.Id).ToListAsync();
        var paginaPerId = pagine.ToDictionary(p => p.Id);
        var dateBlocchi = await ctx.TimoneBlocchi.Where(b => b.IdTimone == piano.Id).Select(b => b.DataModifica).ToListAsync();
        int blocchi = dateBlocchi.Count(d => d == null || Recente(d));

        var idElementi = voci.Where(v => v.IdElemento != null).Select(v => v.IdElemento!.Value).Distinct().ToList();
        var boxPerId = await ctx.VolantiniPagineElementis.AsNoTracking()
            .Where(e => idElementi.Contains(e.Id))
            .Select(e => new { e.Id, e.LabelInd, e.Basecode, e.PosizioneX, e.PosizioneY, e.Larghezza, e.Altezza })
            .ToDictionaryAsync(e => e.Id);
        (string Basecode, string Label) Box(long? id, string ripiego) =>
            id != null && boxPerId.TryGetValue(id.Value, out var b) ? (b.Basecode ?? ripiego, b.LabelInd ?? "") : (ripiego, "");
        Rettangolo? RettangoloDi(long? idElemento) =>
            idElemento != null && boxPerId.TryGetValue(idElemento.Value, out var b)
                ? new Rettangolo(b.PosizioneX, b.PosizioneY, b.PosizioneX + b.Larghezza, b.PosizioneY + b.Altezza)
                : null;

        // Il box che nell'impaginato stava nella casella N di una pagina: la voce con PosizioneOrigine N.
        var origine = voci.Where(v => v.PaginaOrigine != null && v.PosizioneOrigine != null && v.IdElemento != null)
            .GroupBy(v => (Pagina: v.PaginaOrigine!.Value, Posizione: v.PosizioneOrigine!.Value))
            .ToDictionary(g => g.Key, g => g.OrderBy(v => v.Id).First());
        Rettangolo? BoxDellaCasella(short pagina, short casella) =>
            origine.TryGetValue((pagina, casella), out var o) ? RettangoloDi(o.IdElemento) : null;

        // Le referenze di una pagina che il timone disegna nelle caselle: in pagina, con una casella, nate li'.
        List<Models.VolantiniTimoneVoci> InCasella(Models.VolantiniTimonePagine pagina) =>
            voci.Where(x => x.IdPaginaTimone == pagina.Id && x.Stato == VoceInPagina && x.Posizione != null).ToList();

        // I gruppi del timone cambiati dopo l'ultimo FATTO, per IdGruppo: si applicano come raggruppamenti.
        var gruppiDaUnire = voci.Where(v => v.Stato == VoceInPagina && v.IdGruppo != null)
            .GroupBy(v => v.IdGruppo!.Value)
            .Where(g => g.Where(x => x.IdElemento != null).Select(x => x.IdElemento).Distinct().Count() >= 2
                        && g.Any(x => Recente(x.DataModifica)))
            .ToDictionary(g => g.Key, g => g.ToList());
        // Le referenze di ogni box dell'export, e quelle che nel menabo' stanno insieme a una voce.
        var codiciDelBox = voci.Where(v => v.IdElemento != null).GroupBy(v => v.IdElemento!.Value)
            .ToDictionary(g => g.Key, g => g.OrderBy(x => x.Id).Select(x => x.Codice).Distinct().ToList());
        List<string> CodiciInsieme(Models.VolantiniTimoneVoci v) => v.IdGruppo == null
            ? new List<string> { v.Codice }
            : voci.Where(x => x.IdGruppo == v.IdGruppo && x.Stato == VoceInPagina)
                  .OrderBy(x => x.Posizione == null ? 1 : 0).ThenBy(x => x.Id).Select(x => x.Codice).Distinct().ToList();
        bool CapoDaUnire(Models.VolantiniTimoneVoci v) =>
            v.IdGruppo != null && v.Posizione != null && gruppiDaUnire.ContainsKey(v.IdGruppo.Value);
        ScambioTimone ComeRaggruppamento(ScambioTimone s, Models.VolantiniTimoneVoci capo)
        {
            var gruppo = gruppiDaUnire[capo.IdGruppo!.Value];
            var codici = gruppo.OrderBy(x => x.Posizione == null ? 1 : 0).ThenBy(x => x.Id)
                               .Select(x => x.Codice).Distinct().ToList();
            var unisci = gruppo.Where(x => x.IdElemento != null && x.IdElemento != capo.IdElemento)
                .GroupBy(x => x.IdElemento!.Value).OrderBy(g => g.Min(x => x.Id))
                .Select(g =>
                {
                    var (b, l) = Box(g.Key, g.First().Basecode);
                    return new BoxDaUnire(g.Key, b, l, g.First().PaginaOrigine ?? s.Pagina,
                        codiciDelBox.TryGetValue(g.Key, out var cb) ? cb : null);
                }).ToList();
            string? aMano = s.DaSistemareAMano;
            var senzaBox = gruppo.FirstOrDefault(x => x.IdElemento == null);
            if (aMano == null && (capo.IdElemento == null || senzaBox != null))
                aMano = $"{(senzaBox ?? capo).Codice} non ha un box nell'impaginato esportato: il gruppo della casella {capo.Posizione} di pagina {s.Pagina} va sistemato a mano";
            if (aMano == null)
            {
                // Un box entra nel gruppo intero o niente: una referenza presa da una linea lascerebbe le altre senza box.
                var fuori = gruppo.Select(x => x.IdElemento).Distinct()
                    .SelectMany(id => voci.Where(x => x.IdElemento == id && x.IdGruppo != capo.IdGruppo))
                    .FirstOrDefault();
                if (fuori != null)
                {
                    var (b, _) = Box(fuori.IdElemento, fuori.Basecode);
                    aMano = $"il gruppo della casella {capo.Posizione} di pagina {s.Pagina} prende solo una parte del box {b} ({fuori.Codice} resta fuori): da sistemare a mano";
                }
            }
            return s with { DaSistemareAMano = aMano, BoundsDestinazione = aMano == null ? s.BoundsDestinazione : null,
                            Unisci = unisci, Codici = codici };
        }

        // Le referenze per lo sgruppa del Plugin; e una linea nata in Istanta divisa nel menabo' resta a mano.
        ScambioTimone Completa(ScambioTimone s, Models.VolantiniTimoneVoci v, Models.VolantiniTimonePagine pagina)
        {
            var insieme = CodiciInsieme(v);
            var delBox = v.IdElemento != null && codiciDelBox.TryGetValue(v.IdElemento.Value, out var c) ? c : new List<string> { v.Codice };
            var timone = voci.Where(x => x.Stato == VoceInPagina && x.IdPaginaTimone == pagina.Id)
                             .Select(x => x.Codice).Distinct().ToList();
            s = s with { Codici = insieme, CodiciDelBox = delBox, CodiciTimone = timone };
            if (CapoDaUnire(v)) return ComeRaggruppamento(s, v);
            var staccate = delBox.Where(k => !insieme.Contains(k)).ToList();
            if (s.DaSistemareAMano == null && staccate.Count > 0)
                s = s with
                {
                    DaSistemareAMano = $"{v.Codice} nel menabò è separata da {string.Join(", ", staccate)}, con cui sta nella linea {s.Basecode} di Istanta: da sistemare a mano",
                    BoundsDestinazione = null
                };
            return s;
        }

        var scambi = new List<ScambioTimone>();
        var pagineToccate = voci.Where(v => Recente(v.DataModifica) && v.IdPaginaTimone != null
                                            && paginaPerId.ContainsKey(v.IdPaginaTimone.Value))
                                .Select(v => paginaPerId[v.IdPaginaTimone!.Value])
                                .Distinct().OrderBy(p => p.Numero).ToList();
        var boxPerPagina = BoxPerPagina(voci);
        foreach (var pagina in pagineToccate)
        {
            var griglia = GriglieFormato.DellaPagina(pagina.Griglia, boxPerPagina.GetValueOrDefault(pagina.Numero));
            var caselle = InCasella(pagina);
            var originiPagina = origine.Where(o => o.Key.Pagina == pagina.Numero)
                .Select(o => (o.Key.Posizione, R: RettangoloDi(o.Value.IdElemento)))
                .Where(x => x.R != null).Select(x => (x.Posizione, x.R!)).ToList();
            var partenza = GrigliaDiPartenza(originiPagina.OrderBy(x => x.Posizione)
                .Select(x => (x.Item2.X1, x.Item2.Y1, x.Item2.Larghezza, x.Item2.Altezza)).ToList());
            // Come impaginata la casella N e' il box N dell'impaginato: la pagina non e' ridisegnata,
            // e ogni referenza cambiata va nel rettangolo del box vero.
            bool ridisegnata = griglia != null
                && !GriglieFormato.EImpaginata(griglia.Nome)
                && (!string.Equals(griglia.Nome, partenza?.Nome, StringComparison.OrdinalIgnoreCase)
                    || !PaginaDisegnataComeImpaginato(griglia, originiPagina));

            if (ridisegnata)
            {
                // La pagina si rifa' come la disegna il timone: tutte le referenze nelle loro caselle.
                var nativi = caselle.Where(x => x.PaginaOrigine == pagina.Numero).Select(x => RettangoloDi(x.IdElemento))
                                    .Where(r => r != null).Select(r => r!).ToList();
                foreach (var v in caselle.OrderBy(x => x.Posizione))
                {
                    var (basecode, label) = Box(v.IdElemento, v.Basecode);
                    string? aMano = null;
                    Rettangolo? r = null;
                    if (v.PaginaOrigine != pagina.Numero)
                        aMano = $"{v.Codice} arriva da pagina {v.PaginaOrigine}: da sistemare a mano";
                    else
                    {
                        r = CasellaNellaPagina(griglia!, v.Posizione!.Value, v.Colonne, v.Righe, nativi, SpazioFraBox(originiPagina.Select(x => x.Item2).ToList()));
                        if (r == null)
                            aMano = $"{v.Codice} nella casella {v.Posizione} di pagina {pagina.Numero} esce dalla griglia {griglia!.Nome}: da sistemare a mano";
                    }
                    var scambio = new ScambioTimone(v.Id, pagina.Numero, v.Codice, v.IdElemento, basecode, label,
                        null, "", "", aMano, r == null ? null : new[] { r.Y1, r.X1, r.Y2, r.X2 },
                        v.Posizione!.Value, v.Colonne < 1 ? (short)1 : v.Colonne, v.Righe < 1 ? (short)1 : v.Righe);
                    scambi.Add(Completa(scambio, v, pagina));
                }
                continue;
            }

            // Pagina come nell'impaginato: le referenze cambiate vanno al posto dei box veri.
            foreach (var v in caselle.Where(x => Recente(x.DataModifica) || CapoDaUnire(x)).OrderBy(x => x.Posizione))
            {
                var (basecode, label) = Box(v.IdElemento, v.Basecode);
                string? aMano = null;
                long? idDestinazione = null;
                string basecodeDestinazione = "", labelDestinazione = "";
                Rettangolo? r = null;
                if (v.PaginaOrigine != pagina.Numero)
                {
                    aMano = $"{v.Codice} arriva da pagina {v.PaginaOrigine}: da sistemare a mano";
                }
                else if (v.Colonne > 1 || v.Righe > 1)
                {
                    var nativi = caselle.Where(x => x.PaginaOrigine == pagina.Numero).Select(x => RettangoloDi(x.IdElemento))
                                        .Where(x => x != null).Select(x => x!).ToList();
                    var (allargato, motivo) = RettangoloAllargato(griglia, v.Posizione!.Value, v.Colonne, v.Righe, nativi,
                                                                  k => BoxDellaCasella(pagina.Numero, k));
                    if (allargato == null)
                        aMano = $"{v.Codice} allargata su {v.Colonne}×{v.Righe} caselle dalla casella {v.Posizione} di pagina {pagina.Numero}: {motivo}, da sistemare a mano";
                    r = allargato;
                }
                else if (BoxDellaCasella(pagina.Numero, v.Posizione!.Value) is { } occupato)
                {
                    r = occupato;
                }
                else
                {
                    aMano = $"casella {v.Posizione} di pagina {pagina.Numero}, che nell'impaginato non aveva un box: da sistemare a mano";
                }
                if (aMano == null && origine.TryGetValue((pagina.Numero, v.Posizione!.Value), out var occ))
                {
                    idDestinazione = occ.IdElemento;
                    (basecodeDestinazione, labelDestinazione) = Box(occ.IdElemento, occ.Basecode);
                }
                var scambio = new ScambioTimone(v.Id, pagina.Numero, v.Codice, v.IdElemento, basecode, label,
                    idDestinazione, basecodeDestinazione, labelDestinazione, aMano,
                    aMano == null && r != null ? new[] { r.Y1, r.X1, r.Y2, r.X2 } : null,
                    v.Posizione!.Value, v.Colonne < 1 ? (short)1 : v.Colonne, v.Righe < 1 ? (short)1 : v.Righe);
                scambi.Add(Completa(scambio, v, pagina));
            }
        }

        var idScambi = scambi.Select(s => s.IdVoce).ToHashSet();
        // Le voci dietro un capogruppo (senza casella) lo seguono: non sono un'altra modifica.
        var gruppiScambiati = voci.Where(v => idScambi.Contains(v.Id) && v.IdGruppo != null)
                                  .Select(v => v.IdGruppo!.Value).ToHashSet();
        // Quelle di un raggruppamento lo seguono anche se vengono da un'altra pagina: l'unione le porta via.
        var gruppiUniti = scambi.Where(s => s.Unisci != null)
                                .Select(s => voci.First(v => v.Id == s.IdVoce).IdGruppo!.Value).ToHashSet();
        int altre = voci.Count(v => Recente(v.DataModifica) && !idScambi.Contains(v.Id)
                                    && !(v.Posizione == null && v.Stato == VoceInPagina && v.IdGruppo != null
                                         && (gruppiUniti.Contains(v.IdGruppo.Value)
                                             || (gruppiScambiati.Contains(v.IdGruppo.Value)
                                                 && v.PaginaOrigine == PaginaDi(v, paginaPerId)))))
                    + voci.Count(v => !string.IsNullOrEmpty(v.ModificaGruppo) && Recente(v.DataModifica))
                    + blocchi
                    + pagine.Count(p => !p.Attiva || p.Bloccata || p.Ordine != p.Numero);

        if (scambi.Count == 0 && altre == 0) return null;

        string autore = "", tipoAutore = "";
        if (piano.IdUltimoSalvataggio != null)
        {
            var u = await ctx.Utentis.AsNoTracking().Where(x => x.Id == piano.IdUltimoSalvataggio.Value)
                .Select(x => new { x.Nome, x.Cognome, x.Ruolo, x.TipoUtenteFico }).FirstOrDefaultAsync();
            if (u != null)
            {
                autore = $"{u.Nome} {u.Cognome}".Trim();
                tipoAutore = u.Ruolo == Ruoli.CodiceAgenzia ? "Agenzia" : ServizioCorrezioni.TipoTesto(u.TipoUtenteFico);
            }
        }

        return new ScambiTimone(piano.Id, piano.DataSalvataggio.Value, autore, tipoAutore, scambi, altre);
    }

    /// <summary>
    /// I20-1233: se il timone disegna la pagina come e' nell'impaginato. Il timone mette i box nella griglia
    /// in ordine di lettura (casella N = box N), e su un impaginato irregolare il disegno non torna: pagina
    /// 13 della prova del 13/11, con un box largo tutta la pagina in cima, diventava una 2x3 con il box
    /// della riga sotto disegnato accanto a quello in cima. Allora la casella dove il Marketing mette una
    /// referenza non e' un posto della pagina vera, e lo scambio si sistema a mano.
    ///
    /// Si confrontano le posizioni relative, a due a due: due box disegnati nella stessa riga devono stare
    /// nella stessa riga anche nell'impaginato, nello stesso ordine da sinistra; due box di righe diverse in
    /// righe diverse, nello stesso ordine dall'alto; due box della stessa colonna nella stessa colonna. Le
    /// misure non contano: una pagina 2x2 disegnata in una 2x3 (le griglie sono sette) torna, perche' i box
    /// stanno uno accanto all'altro e uno sopra l'altro come nel disegno.
    /// </summary>
    public static bool PaginaDisegnataComeImpaginato(Griglia griglia, IReadOnlyList<(short Casella, Rettangolo Box)> caselle)
    {
        int col = griglia.Colonne;
        for (int i = 0; i < caselle.Count; i++)
            for (int j = i + 1; j < caselle.Count; j++)
            {
                var (ca, a) = caselle[i];
                var (cb, b) = caselle[j];
                if (ca < 1 || cb < 1) return false;
                int ra = (ca - 1) / col, rb = (cb - 1) / col, xa = (ca - 1) % col, xb = (cb - 1) % col;
                decimal cxa = (a.X1 + a.X2) / 2m, cxb = (b.X1 + b.X2) / 2m, cya = (a.Y1 + a.Y2) / 2m, cyb = (b.Y1 + b.Y2) / 2m;
                if (ra == rb)
                {
                    if (!a.StessaRiga(b)) return false;
                    if (xa != xb && (xa < xb) != (cxa < cxb)) return false;
                }
                else
                {
                    if (a.StessaRiga(b)) return false;
                    if ((ra < rb) != (cya < cyb)) return false;
                    if (xa == xb && !a.StessaColonna(b)) return false;
                }
            }
        return true;
    }

    /// <summary>
    /// I20-1233: il rettangolo delle caselle di una referenza su una pagina ridisegnata dal Marketing, con
    /// gli stessi conti del timone (riquadro e rettangoloDi in timone.js): il riquadro che contiene i box
    /// della pagina, diviso per la griglia. Fra una casella e l'altra si lascia lo spazio che c'era fra i
    /// box dell'impaginato; sul bordo del riquadro no. Null se le caselle escono dalla griglia.
    /// </summary>
    public static Rettangolo? CasellaNellaPagina(Griglia griglia, short posizione, short colonne, short righe,
                                                 IReadOnlyList<Rettangolo> boxDellaPagina, decimal spazio)
    {
        if (boxDellaPagina.Count == 0) return null;
        colonne = colonne < 1 ? (short)1 : colonne;
        righe = righe < 1 ? (short)1 : righe;
        int i = posizione - 1;
        if (i < 0 || i >= griglia.Posti) return null;
        int c0 = i % griglia.Colonne, r0 = i / griglia.Colonne;
        if (c0 + colonne > griglia.Colonne || r0 + righe > griglia.Righe) return null;

        var q = boxDellaPagina.Aggregate((a, b) => a.Unione(b));
        decimal cw = q.Larghezza / griglia.Colonne, ch = q.Altezza / griglia.Righe, m = spazio / 2m;
        decimal x1 = q.X1 + c0 * cw, y1 = q.Y1 + r0 * ch;
        decimal x2 = x1 + colonne * cw, y2 = y1 + righe * ch;
        return new Rettangolo(
            c0 == 0 ? x1 : x1 + m,
            r0 == 0 ? y1 : y1 + m,
            c0 + colonne == griglia.Colonne ? x2 : x2 - m,
            r0 + righe == griglia.Righe ? y2 : y2 - m);
    }

    /// <summary>
    /// I20-1233: lo spazio fra i box dell'impaginato, il piu' piccolo fra due box vicini della stessa riga
    /// o della stessa colonna. Senza due box vicini, un millimetro.
    /// </summary>
    public static decimal SpazioFraBox(IReadOnlyList<Rettangolo> box)
    {
        decimal? minimo = null;
        for (int i = 0; i < box.Count; i++)
            for (int j = 0; j < box.Count; j++)
            {
                if (i == j) continue;
                var a = box[i]; var b = box[j];
                decimal d = a.StessaRiga(b) && b.X1 >= a.X2 ? b.X1 - a.X2
                          : a.StessaColonna(b) && b.Y1 >= a.Y2 ? b.Y1 - a.Y2
                          : -1m;
                if (d > 0m && (minimo == null || d < minimo)) minimo = d;
            }
        return minimo ?? 2.83m;
    }

    /// <summary>Un rettangolo della pagina, X1 Y1 in alto a sinistra, X2 Y2 in basso a destra.</summary>
    public sealed record Rettangolo(decimal X1, decimal Y1, decimal X2, decimal Y2)
    {
        public decimal Larghezza => X2 - X1;
        public decimal Altezza => Y2 - Y1;
        public Rettangolo Unione(Rettangolo r) =>
            new(Math.Min(X1, r.X1), Math.Min(Y1, r.Y1), Math.Max(X2, r.X2), Math.Max(Y2, r.Y2));
        /// <summary>Stessa riga: si sovrappongono in altezza per almeno meta' del piu' basso.</summary>
        public bool StessaRiga(Rettangolo r) =>
            Math.Min(Y2, r.Y2) - Math.Max(Y1, r.Y1) >= Math.Min(Altezza, r.Altezza) / 2m;
        /// <summary>Stessa colonna: si sovrappongono in larghezza per almeno meta' del piu' stretto.</summary>
        public bool StessaColonna(Rettangolo r) =>
            Math.Min(X2, r.X2) - Math.Max(X1, r.X1) >= Math.Min(Larghezza, r.Larghezza) / 2m;
    }

    /// <summary>
    /// I20-1233: dove va nell'impaginato una referenza allargata nel menabo' avanzato su colonne x righe
    /// caselle, a partire dalla casella in alto a sinistra. Si parte dal box che nell'impaginato stava in
    /// quella casella e lo si allarga ai box delle altre caselle coperte: verso destra quelli sulla stessa
    /// riga, verso il basso quelli sulla stessa colonna. Un box di un'altra riga non conta: su un
    /// impaginato irregolare (pagina 13 della prova del 13/11, un box largo tutta la pagina in cima) la
    /// casella accanto puo' essere un box della riga sotto.
    ///
    /// Il risultato deve essere largo almeno (colonne - 1/2) caselle e alto (righe - 1/2), misurate sul
    /// riquadro dei box della pagina diviso per la griglia, come le disegna il timone: se no, non si sa
    /// quanto allargarlo e il motivo torna indietro.
    /// </summary>
    public static (Rettangolo? Rettangolo, string Motivo) RettangoloAllargato(
        Griglia? griglia, short posizione, short colonne, short righe,
        IReadOnlyList<Rettangolo> boxDellaPagina, Func<short, Rettangolo?> boxDellaCasella)
    {
        if (griglia == null) return (null, "la pagina non ha una griglia");
        int c0 = (posizione - 1) % griglia.Colonne, r0 = (posizione - 1) / griglia.Colonne;
        if (posizione < 1 || c0 + colonne > griglia.Colonne || r0 + righe > griglia.Righe)
            return (null, "esce dalla griglia " + griglia.Nome);

        var partenza = boxDellaCasella(posizione);
        if (partenza == null) return (null, "nella sua casella l'impaginato non aveva un box");

        var unione = partenza;
        for (int r = 0; r < righe; r++)
            for (int c = 0; c < colonne; c++)
            {
                if (r == 0 && c == 0) continue;
                var altro = boxDellaCasella((short)(posizione + c + r * griglia.Colonne));
                if (altro == null) continue;
                // sulla prima riga conta la riga del box di partenza, sulla prima colonna la sua colonna;
                // dentro (allargata in tutte e due le direzioni) quelle di quanto si e' gia' unito
                bool allineato = r == 0 ? partenza.StessaRiga(altro)
                               : c == 0 ? partenza.StessaColonna(altro)
                               : unione.StessaRiga(altro) && unione.StessaColonna(altro);
                if (allineato) unione = unione.Unione(altro);
            }

        if (boxDellaPagina.Count > 0)
        {
            var riquadro = boxDellaPagina.Aggregate((a, b) => a.Unione(b));
            decimal cella = riquadro.Larghezza / griglia.Colonne, fila = riquadro.Altezza / griglia.Righe;
            if (unione.Larghezza < (colonne - 0.5m) * cella || unione.Altezza < (righe - 0.5m) * fila)
                return (null, "nell'impaginato non ci sono box da unire per farle posto");
        }
        return (unione, "");
    }

    /// <summary>
    /// I20-1233: la griglia che il timone mette da solo a una pagina la prima volta che la mostra, dai box
    /// dell'impaginato (X, Y, larghezza, altezza, in ordine di lettura). Null se la pagina non ha box.
    ///
    /// E' LA STESSA REGOLA di indovinaGriglia in wwwroot/js/timone.js, riscritta qui: se cambia la', va
    /// cambiata anche qui, altrimenti gli scambi del Report Correggo diventano tutti «a mano». Colonne e
    /// righe sono quante file di box si contano in orizzontale e in verticale; poi la prima griglia ammessa
    /// che combacia, altrimenti la piu' piccola con quelle colonne che li contiene tutti, altrimenti la piu'
    /// piccola che li contiene tutti.
    ///
    /// Se quella griglia non disegna la pagina come nell'impaginato (PaginaDisegnataComeImpaginato:
    /// una riga di tre box sopra due righe di due), la pagina e' come impaginata, con una casella per
    /// box: e' il ricalco della pagina, che nessuna griglia a sistema sa fare.
    /// </summary>
    public static Griglia? GrigliaDiPartenza(IReadOnlyList<(decimal X, decimal Y, decimal W, decimal H)> box)
    {
        if (box.Count == 0) return null;
        int quante = box.Count;
        int colonne = QuanteFile(box.Select(b => (b.X, b.W)));
        int righe = QuanteFile(box.Select(b => (b.Y, b.H)));

        var amm = GriglieFormato.Ammesse();
        var g = amm.FirstOrDefault(x => x.Colonne == colonne && x.Righe == righe)
             ?? amm.FirstOrDefault(x => x.Colonne == colonne && x.Posti >= quante)
             ?? amm.FirstOrDefault(x => x.Posti >= quante);
        if (g != null && g.Posti < quante) g = amm.FirstOrDefault(x => x.Posti >= quante);

        var caselle = box.Select((b, i) => ((short)(i + 1), new Rettangolo(b.X, b.Y, b.X + b.W, b.Y + b.H))).ToList();
        if (g == null || !PaginaDisegnataComeImpaginato(g, caselle)) return GriglieFormato.ComeImpaginata(quante);
        return g;
    }

    /// <summary>quantiGruppi di timone.js: due box che si sfiorano appena (35% della misura) sono nella stessa fila.</summary>
    private static int QuanteFile(IEnumerable<(decimal Inizio, decimal Misura)> box)
    {
        int file = 0;
        decimal? limite = null;
        foreach (var (a, b) in box.Select(x => (A: x.Inizio, B: x.Inizio + x.Misura)).OrderBy(x => x.A))
        {
            if (limite == null || a >= limite.Value - (b - a) * 0.35m) { file++; limite = b; }
            else if (b > limite.Value) limite = b;
        }
        return file;
    }

    private static short? PaginaDi(Models.VolantiniTimoneVoci v, Dictionary<long, Models.VolantiniTimonePagine> paginaPerId) =>
        v.IdPaginaTimone != null && paginaPerId.TryGetValue(v.IdPaginaTimone.Value, out var p) ? p.Numero : null;

    /// <summary>
    /// I20-1233: il FATTO del menabo' avanzato premuto dalla conferma del Plugin, come SistematoAsync:
    /// scrive solo la data e chi. Il controllo che sia tutto applicato lo fa chi chiama.
    /// </summary>
    public async Task SistematoDalPluginAsync(long idPiano, short idUtente)
    {
        var piano = await ctx.Timoni.FirstAsync(t => t.Id == idPiano);
        piano.DataSistemato = DateTime.UtcNow;
        piano.IdSistemato = idUtente;
        await ctx.SaveChangesAsync();
    }
}
