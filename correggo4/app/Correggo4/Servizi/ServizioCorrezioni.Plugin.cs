using Correggo4.Models;
using Correggo4.Models.Vista;
using Microsoft.EntityFrameworkCore;

namespace Correggo4.Servizi;

/// <summary>
/// I20-1221: una correzione aperta del volantino, come la legge il Report Correggo del Plugin.
/// Id e' quello che il Plugin rimanda alla conferma: "nota:{id}", "timbro:{id}", "edit:{idBox}:{parte}".
/// Per l'Edit avanzato la parte "offerta" porta Campi (prezzi, chiave del tracciato -> valore) e Azioni;
/// la parte "descrizione" porta Descrizione (con i tag delle fasce), Foto (P/S, stati 1-3) e Loghi
/// (4 aggiungi, 5 togli).
/// </summary>
public sealed class CorrezionePlugin
{
    public string Id { get; set; } = "";
    public string Tipo { get; set; } = "";
    public long? IdBox { get; set; }
    public string LabelBox { get; set; } = "";
    public string Basecode { get; set; } = "";
    public short Pagina { get; set; }
    public string Autore { get; set; } = "";
    public string TipoAutore { get; set; } = "";
    public DateTime Data { get; set; }

    public string? Testo { get; set; }
    public string? Simbolo { get; set; }
    public string? NomeTimbro { get; set; }

    public string? Parte { get; set; }
    public Dictionary<string, string> Campi { get; set; } = new();
    public List<AzioneEditVista> Azioni { get; set; } = new();
    public string? Descrizione { get; set; }
    public List<FotoEditVista> Foto { get; set; } = new();
    public List<FotoEditVista> Loghi { get; set; } = new();
    public bool Propagata { get; set; }
    public string DaVolantino { get; set; } = "";
}

public sealed class CorrezioniPerPlugin
{
    public int IdVolantino { get; set; }
    public string Volantino { get; set; } = "";
    public string Promo { get; set; } = "";
    public short Versione { get; set; }
    public List<CorrezionePlugin> Correzioni { get; set; } = new();
}

/// <summary>I20-1221: l'esito della chiusura di una correzione approvata dal Plugin.</summary>
public sealed record ChiusuraPlugin(string Id, bool Ok, string? Codice, string? Messaggio);

/// <summary>
/// I20-1221, il Report Correggo del Plugin. L'Agenzia importa nel Plugin le correzioni ancora aperte del
/// volantino della sua lavorazione (volantini.id_lavorazione_istanta), le approva o le rifiuta, applica
/// all'impaginato quelle approvate e le rimanda qui: Correggo4 le chiude come se l'Agenzia le avesse
/// accettate dall'editor, con le stesse regole. Le rifiutate e quelle lasciate senza scelta il Plugin non
/// le manda, e restano come sono: le tolgono a mano Marketing e Category (decisione dell'operatore del 12/11).
/// </summary>
public sealed partial class ServizioCorrezioni
{
    public const string CorrezioneNota = "nota";
    public const string CorrezioneTimbro = "timbro";
    public const string CorrezioneEdit = "edit";

    /// <summary>Le correzioni aperte dell'ultima versione del volantino agganciato alla lavorazione.</summary>
    public async Task<EsitoCorrezione> CorrezioniPerPluginAsync(Utente u, int idLavorazione)
    {
        if (!u.Accetta) return NonAutorizzato("Le correzioni le importa nel Plugin solo l'Agenzia.");
        var vol = await VolantinoDellaLavorazioneAsync(idLavorazione);
        if (vol == null) return VolantinoNonTrovato(idLavorazione);
        return EsitoCorrezione.Fatto(await ApertePerPluginAsync(vol, u));
    }

    /// <summary>
    /// Chiude le correzioni approvate e applicate dal Plugin. Si chiudono solo quelle ancora aperte di quel
    /// volantino; una che non si chiude non ferma le altre e torna con il suo motivo.
    /// </summary>
    public async Task<EsitoCorrezione> ChiudiDalPluginAsync(Utente u, int idLavorazione, IEnumerable<string>? approvate)
    {
        if (!u.Accetta) return NonAutorizzato("Le correzioni del Plugin le conferma solo l'Agenzia.");
        var vol = await VolantinoDellaLavorazioneAsync(idLavorazione);
        if (vol == null) return VolantinoNonTrovato(idLavorazione);

        var aperte = (await ApertePerPluginAsync(vol, u)).Correzioni.Select(c => c.Id).ToHashSet();
        var esiti = new List<ChiusuraPlugin>();
        foreach (string id in (approvate ?? Enumerable.Empty<string>()).Where(s => !string.IsNullOrWhiteSpace(s)).Distinct())
        {
            if (!aperte.Contains(id))
            {
                esiti.Add(new ChiusuraPlugin(id, false, "non_aperta",
                    "La correzione non è più aperta in Correggo4 o non è di questo volantino."));
                continue;
            }
            var errore = await ChiudiUnaAsync(u, id);
            esiti.Add(errore == null
                ? new ChiusuraPlugin(id, true, null, null)
                : new ChiusuraPlugin(id, false, errore.Codice, errore.Messaggio));
        }
        return EsitoCorrezione.Fatto(esiti);
    }

    private async Task<EsitoCorrezione?> ChiudiUnaAsync(Utente u, string id)
    {
        var pezzi = id.Split(':');
        switch (pezzi[0])
        {
            case CorrezioneNota when pezzi.Length == 2 && long.TryParse(pezzi[1], out long idNota):
                return (await ChiudiNotaAsync(u, idNota)).Errore;
            case CorrezioneTimbro when pezzi.Length == 2 && long.TryParse(pezzi[1], out long idTimbro):
                return (await ChiudiTimbroAsync(u, idTimbro)).Errore;
            case CorrezioneEdit when pezzi.Length == 3 && long.TryParse(pezzi[1], out long idBox):
                return (await ChiudiEditAsync(u, idBox, pezzi[2], fotoAIstanta: false)).Errore;
            default:
                return EsitoCorrezione.No(400, "id_non_valido", $"Correzione sconosciuta: «{id}».");
        }
    }

    /// <summary>
    /// Il volantino della lavorazione di Istanta. Se piu' volantini portano la stessa lavorazione vale
    /// l'ultimo pubblicato.
    /// </summary>
    private async Task<Volantini?> VolantinoDellaLavorazioneAsync(int idLavorazione) =>
        await ctx.Volantinis.AsNoTracking()
            .Where(v => v.IdLavorazioneIstanta == idLavorazione)
            .OrderByDescending(v => v.UltimaPubblicazione ?? v.DataPubblicazione)
            .ThenByDescending(v => v.Id)
            .FirstOrDefaultAsync();

    private static EsitoCorrezione VolantinoNonTrovato(int idLavorazione) =>
        EsitoCorrezione.No(404, "volantino_non_trovato",
            $"La lavorazione {idLavorazione} non ha un volantino in Correggo4: va prima esportata per Correggo.");

    /// <summary>
    /// Le correzioni ancora da accettare, lette come le legge l'editor (CaricaAsync): note e timbri non
    /// verificati, parti dell'Edit avanzato registrate. I promemoria non si accettano e restano fuori.
    /// </summary>
    private async Task<CorrezioniPerPlugin> ApertePerPluginAsync(Volantini vol, Utente u)
    {
        var stato = await CaricaAsync(vol.Id, u);
        var risultato = new CorrezioniPerPlugin
        {
            IdVolantino = vol.Id, Volantino = vol.Titolo, Promo = vol.Classificazione, Versione = stato.Versione
        };

        var idNote = stato.Note.Where(n => n.Stato == StatoNonVerificata).Select(n => n.Id).ToList();
        var promemoria = (await ctx.VolantiniPagineNotes.AsNoTracking()
            .Where(n => idNote.Contains(n.Id) && n.Tipo == TipoNotaPromemoria)
            .Select(n => n.Id).ToListAsync()).ToHashSet();

        var idBox = stato.Note.Select(n => n.IdBox).Concat(stato.Timbri.Select(t => t.IdBox))
            .Concat(stato.Edit.Select(e => (long?)e.IdBox))
            .Where(i => i != null).Select(i => i!.Value).Distinct().ToList();
        var boxes = await ctx.VolantiniPagineElementis.AsNoTracking()
            .Where(e => idBox.Contains(e.Id))
            .Select(e => new { e.Id, e.LabelInd, e.Basecode }).ToDictionaryAsync(e => e.Id);

        CorrezionePlugin Nuova(string id, string tipo, long? box, short pagina, string autore, string tipoAutore, DateTime data)
        {
            var c = new CorrezionePlugin
            {
                Id = id, Tipo = tipo, IdBox = box, Pagina = pagina, Autore = autore, TipoAutore = tipoAutore, Data = data
            };
            if (box != null && boxes.TryGetValue(box.Value, out var b))
            {
                c.LabelBox = b.LabelInd;
                c.Basecode = b.Basecode;
            }
            return c;
        }

        foreach (var n in stato.Note.Where(n => n.Stato == StatoNonVerificata && !promemoria.Contains(n.Id)))
        {
            var c = Nuova($"{CorrezioneNota}:{n.Id}", CorrezioneNota, n.IdBox, n.Pagina, n.Autore, n.TipoAutore,
                          n.DataModifica ?? n.DataInserimento);
            c.Testo = n.Testo;
            risultato.Correzioni.Add(c);
        }

        foreach (var t in stato.Timbri.Where(t => t.Stato == StatoNonVerificata))
        {
            var c = Nuova($"{CorrezioneTimbro}:{t.Id}", CorrezioneTimbro, t.IdBox, t.Pagina, t.Autore, t.TipoAutore,
                          t.DataInserimento);
            c.Simbolo = t.Simbolo;
            c.NomeTimbro = t.Nome;
            risultato.Correzioni.Add(c);
        }

        foreach (var e in stato.Edit.Where(e => e.Stato == EaRegistrato))
        {
            var c = Nuova($"{CorrezioneEdit}:{e.IdBox}:{e.Parte}", CorrezioneEdit, e.IdBox, e.Pagina, e.Autore, e.TipoAutore,
                          e.Data);
            c.Parte = e.Parte;
            c.Azioni = e.Azioni;
            c.Propagata = e.Propagata;
            c.DaVolantino = e.DaVolantino;
            foreach (var (campo, valore) in e.Campi)
            {
                if (e.Parte == ParteDescrizione && campo == SchemaReferenza.LabelDescrizione) c.Descrizione = valore;
                else c.Campi[campo] = valore;
            }
            c.Foto = e.Foto.Where(f => f.Stato < 4).ToList();
            c.Loghi = e.Foto.Where(f => f.Stato >= 4).ToList();
            risultato.Correzioni.Add(c);
        }

        risultato.Correzioni = risultato.Correzioni
            .OrderBy(c => c.Pagina).ThenBy(c => c.IdBox ?? 0).ThenBy(c => c.Tipo).ThenBy(c => c.Id, StringComparer.Ordinal)
            .ToList();
        return risultato;
    }
}
