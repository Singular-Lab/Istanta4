using System.Text.Encodings.Web;
using System.Text.Json;
using Correggo4.Data;
using Correggo4.Models;
using Microsoft.EntityFrameworkCore;

namespace Correggo4.Servizi;

/// <summary>
/// I20-1186: LA MODIFICA DEL GRUPPO DAL TIMONE.
///
/// Un gruppo fatto nel timone mette nella stessa casella referenze che sull'impaginato stanno in
/// box diversi. L'Edit avanzato lavora su un box alla volta, e correggere il gruppo da li'
/// voleva dire correggere un box e dimenticare gli altri. Decisione dell'operatore (03/11): il
/// gruppo del timone si corregge SOLO dalla «Modifica referenza» del timone, e la correzione
/// viaggia con tutte le altre modifiche del timone - col SALVA, nel report, nel pacchetto - fino
/// all'Agenzia, che la riporta a mano. Il Marketing dall'Edit avanzato dell'editor su quei box e'
/// fermato (ServizioCorrezioni, «gruppo_timone»).
///
/// IL PALETTO non cambia: la correzione sta nel piano, sulla voce del capogruppo
/// (volantini_timone_voci.modifica_gruppo), e non tocca i box.
///
/// GRUPPO DEL TIMONE vuol dire: referenze in pagina con lo stesso IdGruppo che vengono da almeno
/// DUE box diversi. Un gruppo nato da Istanta (piu' codici nello stesso box) si corregge come
/// sempre dall'Edit avanzato, che quei codici li conosce gia'.
/// </summary>
public sealed partial class ServizioTimone
{
    /// <summary>I limiti della correzione di un gruppo: dieci volte il caso normale (1-2 KB).</summary>
    public const int ModificaGruppoMaxByte = 16 * 1024;
    public const int ModificaGruppoMaxTesto = 2000;
    public const int ModificaGruppoMaxVoci = 50;

    // la forma salvata nella colonna: le due parti dell'Edit avanzato, come le manda la scheda
    public sealed class ModificaGruppo
    {
        public OffertaGruppo? Offerta { get; set; }
        public DescrizioneGruppo? Descrizione { get; set; }
    }

    public sealed class OffertaGruppo
    {
        public List<CampoEdit>? Campi { get; set; }
        public List<AzioneGruppo>? Azioni { get; set; }
    }

    /// <summary>L'azione con il suo titolo: il report lo scrive in chiaro, senza rileggere lo schema del box.</summary>
    public sealed class AzioneGruppo
    {
        public int Id { get; set; }
        public string? Titolo { get; set; }
        public List<CampoEdit>? Campi { get; set; }
    }

    public sealed class DescrizioneGruppo
    {
        /// <summary>La descrizione nuova, con i tag delle fasce. Null = non cambiata.</summary>
        public string? Testo { get; set; }
        public List<FotoEdit>? Foto { get; set; }
        public List<LogoGruppo>? Loghi { get; set; }
    }

    /// <summary>Un logo aggiunto (4) o tolto (5), con sigla e nome per il report.</summary>
    public sealed class LogoGruppo
    {
        public string? GuidId { get; set; }
        public int Stato { get; set; }
        public string? Sigla { get; set; }
        public string? Nome { get; set; }
    }

    private static readonly JsonSerializerOptions JsonModifica = new(JsonSerializerDefaults.Web)
    {
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
    };

    /// <summary>
    /// Legge la correzione di un gruppo come la manda il browser, la controlla e la riscrive nella
    /// forma salvata. Restituisce null in <paramref name="json"/> quando non c'e' niente da tenere.
    /// </summary>
    internal static Esito? LeggiModificaGruppo(JsonElement arrivata, string codice, out string? json)
    {
        json = null;
        if (arrivata.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined) return null;

        string grezza = arrivata.GetRawText();
        if (System.Text.Encoding.UTF8.GetByteCount(grezza) > ModificaGruppoMaxByte)
            return Esito.No(400, "modifica_gruppo_troppo_grande",
                $"La modifica del gruppo di «{codice}» e' troppo grande (oltre {ModificaGruppoMaxByte / 1024} KB): " +
                "non si salva. Controlla la descrizione e le foto.");

        ModificaGruppo? m;
        try { m = arrivata.Deserialize<ModificaGruppo>(JsonModifica); }
        catch (JsonException) { m = null; }
        if (m == null)
            return Esito.No(400, "modifica_gruppo_non_valida", $"La modifica del gruppo di «{codice}» non si legge.");

        var o = m.Offerta;
        if (o != null)
        {
            o.Campi = (o.Campi ?? new()).Where(c => !string.IsNullOrWhiteSpace(c.Field)).ToList();
            o.Azioni = (o.Azioni ?? new()).Where(a => a.Id > 0).ToList();
            if (o.Campi.Count > ModificaGruppoMaxVoci || o.Azioni.Count > ModificaGruppoMaxVoci)
                return Esito.No(400, "modifica_gruppo_troppo_grande",
                    $"La modifica del gruppo di «{codice}» ha piu' di {ModificaGruppoMaxVoci} prezzi o azioni: non si salva.");
            if (o.Campi.Count == 0 && o.Azioni.Count == 0) m.Offerta = null;
            else
            {
                if (o.Campi.Count == 0) o.Campi = null;
                if (o.Azioni.Count == 0) o.Azioni = null;
            }
        }

        var d = m.Descrizione;
        if (d != null)
        {
            if (d.Testo != null && d.Testo.Length > ModificaGruppoMaxTesto)
                return Esito.No(400, "modifica_gruppo_troppo_grande",
                    $"La descrizione del gruppo di «{codice}» supera i {ModificaGruppoMaxTesto} caratteri: non si salva.");
            if (string.IsNullOrWhiteSpace(d.Testo)) d.Testo = null;
            d.Foto = (d.Foto ?? new()).Where(f => !string.IsNullOrWhiteSpace(f.Codice) && f.Stato is >= 1 and <= 3).ToList();
            d.Loghi = (d.Loghi ?? new()).Where(l => !string.IsNullOrWhiteSpace(l.GuidId) && l.Stato is 4 or 5).ToList();
            if (d.Foto.Count > ModificaGruppoMaxVoci || d.Loghi.Count > ModificaGruppoMaxVoci)
                return Esito.No(400, "modifica_gruppo_troppo_grande",
                    $"La modifica del gruppo di «{codice}» ha piu' di {ModificaGruppoMaxVoci} foto o loghi: non si salva.");
            // «una sola P» la controlla la scheda, che vede tutte le foto del gruppo: qui arrivano
            // solo quelle cambiate
            if (d.Testo == null && d.Foto.Count == 0 && d.Loghi.Count == 0) m.Descrizione = null;
            else
            {
                if (d.Foto.Count == 0) d.Foto = null;
                if (d.Loghi.Count == 0) d.Loghi = null;
            }
        }

        if (m.Offerta == null && m.Descrizione == null) return null;
        json = JsonSerializer.Serialize(m, JsonModifica);
        return null;
    }

    /// <summary>La correzione salvata, pronta da rimandare al browser o da scrivere nel pacchetto.</summary>
    internal static JsonElement? ModificaInUscita(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try { return JsonSerializer.Deserialize<JsonElement>(json); }
        catch (JsonException) { return null; }
    }

    /// <summary>
    /// I gruppi del timone fra le voci di un piano: per ognuno chi tiene la casella (il capogruppo)
    /// e le altre voci. Solo referenze in pagina, e solo gruppi che vengono da almeno due box.
    /// </summary>
    internal static List<(VolantiniTimoneVoci Capo, List<VolantiniTimoneVoci> Tutte)> GruppiDelTimone(
        IEnumerable<VolantiniTimoneVoci> voci)
    {
        return voci.Where(v => v.IdGruppo != null && v.Stato == VoceInPagina)
            .GroupBy(v => v.IdGruppo!.Value)
            .Select(g => g.OrderBy(v => v.Posizione == null ? 1 : 0).ThenBy(v => v.Id).ToList())
            .Where(g => g.Where(v => v.IdElemento != null).Select(v => v.IdElemento).Distinct().Count() >= 2)
            .Select(g => (g[0], g))
            .ToList();
    }

    /// <summary>
    /// I box che, nel piano della loro versione, stanno in un gruppo del timone. Il Marketing su
    /// questi non usa l'Edit avanzato dell'editor (ServizioCorrezioni, «gruppo_timone»).
    /// </summary>
    public static async Task<HashSet<long>> BoxNeiGruppiAsync(Correggo4Context ctx, int idVolantino, short versione)
    {
        var piano = await ctx.Timoni.AsNoTracking()
            .Where(t => t.IdVol == idVolantino && t.Versione == versione)
            .Select(t => (long?)t.Id).FirstOrDefaultAsync();
        if (piano == null) return new HashSet<long>();
        var voci = await ctx.TimoneVoci.AsNoTracking()
            .Where(v => v.IdTimone == piano.Value && v.IdGruppo != null && v.Stato == VoceInPagina)
            .ToListAsync();
        return GruppiDelTimone(voci)
            .SelectMany(g => g.Tutte)
            .Where(v => v.IdElemento != null)
            .Select(v => v.IdElemento!.Value)
            .ToHashSet();
    }
}
