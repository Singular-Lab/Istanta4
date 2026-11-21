namespace Correggo4.Servizi;

/// <summary>Una griglia: il nome com'e' scritto a sistema, e quanto e' grande.</summary>
public sealed record Griglia(string Nome, int Righe, int Colonne)
{
    /// <summary>Quante referenze ci stanno dentro.</summary>
    public int Posti => Righe * Colonne;
}

/// <summary>
/// Le griglie ammesse per una pagina del TIMONE (j254).
///
/// IL VERSO, che e' la cosa da non sbagliare: nel nome il PRIMO numero sono le COLONNE e il
/// secondo le RIGHE. Quindi "2x3" e' 2 colonne e 3 righe, e "1x3" e' una striscia verticale -
/// una colonna sola alta tre - non una banda orizzontale.
///
/// GIRATO IL 28/09 (j261). Prima era il contrario, righe per colonne: lo avevo capito male io.
/// Michele l'ha visto a schermo e l'ha detto chiaro: "nella 2x3 mi stai facendo 3 colonne e 2
/// righe, io voglio 3 righe e 2 colonne". Quindi comanda quello che si vede sulla pagina: primo
/// numero = colonne. Il numero dei posti non cambia (e' sempre il prodotto dei due), quindi non
/// c'e' niente da sistemare nei piani gia' salvati: cambia solo come si dispongono le caselle.
///
/// Le caselle si contano da 1, per righe, da sinistra a destra: in una 3x4 (3 colonne, 4 righe)
/// la casella 4 e' la prima della seconda riga.
///
/// CORREZIONE DEL 28/09, importante per chi legge la specifica: nel documento
/// claude/timone-specifica.md (paragrafi 6.3 e 11) c'e' scritto che le griglie ammesse si
/// leggono dal SourceFormati.json del cliente (campo dettagliGriglie) e che Correggo4 le chiede
/// a Istanta con GET /FicoProcess/getFormati. NON E' COSI': Michele ha chiarito che si era
/// sbagliato lui a dare quell'informazione, le griglie non stanno su Istanta. Di conseguenza non
/// serve nemmeno sapere che formato ha un volantino (il giro volantini.guid_kit_runtime ->
/// kit.guidFormato, la tabella formati vuota): la lista non dipende dal formato. Il documento va
/// corretto, il dettaglio sta in claude/timone-griglie.md.
/// </summary>
public static class GriglieFormato
{
    /// <summary>Le sette griglie che ci sono a sistema, dalla piu' piccola alla piu' grande.</summary>
    /// (nome, righe, colonne): nel NOME il primo numero sono le colonne, qui dentro le righe
    /// vengono prima perche' e' l'ordine naturale per disegnare. Da qui la sensazione di
    /// "numeri girati": e' voluta, e questa tabella e' l'unico posto dove succede.
    public static readonly IReadOnlyList<Griglia> Tutte = new List<Griglia>
    {
        new("1x3", 3, 1),   //  1 colonna  x 3 righe =  3 posti
        new("2x3", 3, 2),   //  2 colonne  x 3 righe =  6
        new("2x4", 4, 2),   //  2 colonne  x 4 righe =  8
        new("3x3", 3, 3),   //  3 colonne  x 3 righe =  9
        new("3x4", 4, 3),   //  3 colonne  x 4 righe = 12
        new("4x4", 4, 4),   //  4 colonne  x 4 righe = 16
        new("5x4", 4, 5)    //  5 colonne  x 4 righe = 20
    };

    /// <summary>
    /// La griglia «come impaginata» (ricalco della pagina): una casella per ogni box dell'impaginato
    /// della pagina, nella posizione e con la misura di quel box, numerate in ordine di lettura.
    /// Serve alle pagine che nessuna griglia a sistema disegna come nell'impaginato (una riga di tre
    /// box sopra due righe di due). Non sta fra le sette: quante caselle ha dipende dalla pagina.
    /// </summary>
    public const string Impaginata = "impaginata";

    /// <summary>Se il nome e' quello della griglia come impaginata.</summary>
    public static bool EImpaginata(string? nome) =>
        string.Equals(nome?.Trim(), Impaginata, StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// La griglia come impaginata di una pagina con «posti» box. E' una riga sola di «posti» caselle:
    /// cosi' i conti sulle posizioni (caselle occupate, scambi, blocchi) restano quelli di ogni
    /// griglia. Dove sta ogni casella lo dice il box, non la riga: il disegno sta in timone.js.
    /// </summary>
    public static Griglia ComeImpaginata(int posti) => new(Impaginata, 1, Math.Max(1, posti));

    /// <summary>
    /// La griglia di una pagina dal nome salvato: una delle sette, oppure quella come impaginata con
    /// tante caselle quanti box ha la pagina nell'impaginato. Null se il nome e' vuoto o sconosciuto,
    /// o se la pagina come impaginata non ha box suoi.
    /// </summary>
    public static Griglia? DellaPagina(string? nome, int boxDellaPagina) =>
        EImpaginata(nome) ? (boxDellaPagina > 0 ? ComeImpaginata(boxDellaPagina) : null) : Trova(nome);

    /// <summary>
    /// Le griglie che si possono scegliere. Oggi sono sempre tutte e sette, per qualsiasi
    /// volantino di qualsiasi cliente.
    ///
    /// ================= QUI SI INTERVIENE QUANDO SI GESTIRANNO I CLIENTI =================
    /// Michele (28/09): un domani la lista andra' ristretta per AREA e CANALE del cliente, due
    /// informazioni che "devono essere sempre compilate quando gestiamo i clienti". Quando
    /// arrivera' quel momento, il posto da toccare e' QUESTO METODO e nessun altro: si passano
    /// area e canale (i due parametri ci sono gia', oggi non vengono guardati) e si restituisce
    /// il sottoinsieme giusto. Tutto il resto del timone - la scelta della griglia, il disegno
    /// delle caselle, la regola della pagina piena che cerca "la piu' piccola che basti" - chiama
    /// solo di qui e non va rifatto.
    /// Dove prendere area e canale non e' ancora deciso: in Correggo4 non c'e' anagrafica cliente,
    /// quindi o arrivano da una tabella nuova, o dal profilo dell'utente, o dal volantino.
    /// =====================================================================================
    /// </summary>
    public static IReadOnlyList<Griglia> Ammesse(string? area = null, string? canale = null) => Tutte;

    /// <summary>La griglia con quel nome, se e' una di quelle ammesse.</summary>
    public static Griglia? Trova(string? nome) =>
        string.IsNullOrWhiteSpace(nome) ? null
        : Ammesse().FirstOrDefault(g => string.Equals(g.Nome, nome.Trim(), StringComparison.OrdinalIgnoreCase));

    /// <summary>
    /// La piu' piccola griglia in cui ci stanno "quante" referenze. Serve alla regola della
    /// pagina piena (specifica 6.2): si sceglie la piu' piccola che basta, non la piu' grande.
    /// Null se non ne basta nessuna: allora la referenza va in sospeso.
    /// </summary>
    public static Griglia? PiuPiccolaCheBasta(int quante) =>
        Ammesse().Where(g => g.Posti >= quante).OrderBy(g => g.Posti).FirstOrDefault();

    /// <summary>
    /// Riga e colonna (da 1) della casella numero "posizione" in una griglia. Le caselle si
    /// contano per righe, da sinistra a destra.
    /// </summary>
    public static (int Riga, int Colonna) Casella(Griglia g, int posizione)
    {
        int i = posizione - 1;
        return (i / g.Colonne + 1, i % g.Colonne + 1);
    }
}
