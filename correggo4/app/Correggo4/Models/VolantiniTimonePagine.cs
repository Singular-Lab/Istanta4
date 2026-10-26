namespace Correggo4.Models;

/// <summary>Una pagina dentro il piano del TIMONE (j251).</summary>
public partial class VolantiniTimonePagine
{
    public long Id { get; set; }

    public long IdTimone { get; set; }

    public short Numero { get; set; }

    /// <summary>
    /// La griglia scelta, per esempio "4x4". Null = come era impaginata.
    ///
    /// Nel nome il PRIMO numero sono le COLONNE e il secondo le RIGHE: "3x4" e' 3 colonne e 4
    /// righe, 12 posti (girato il 28/09 in j261: prima era il contrario, l'avevo capito male io).
    ///
    /// CORRETTO IL 28/09: qui c'era scritto che le griglie ammesse arrivano da Istanta
    /// (FicoProcess/getFormati, campo dettagliGriglie). Non e' vero - era un'informazione
    /// sbagliata, chiarita da Michele lo stesso giorno. Le griglie sono sette e fisse, e stanno
    /// in Servizi/GriglieFormato.cs, dove c'e' anche il punto segnato per restringerle un domani
    /// per area e canale del cliente.
    /// </summary>
    public string? Griglia { get; set; }

    /// <summary>Quante referenze ci stanno (4x4 = 16). 0 = nessuna griglia, quindi nessun limite.</summary>
    public short Capienza { get; set; }

    /// <summary>Ordine di impaginazione: diventa "ordine" nel file dei filtri. 999 = in fondo.</summary>
    public short Ordine { get; set; }

    public bool Attiva { get; set; }

    public bool Bloccata { get; set; }
}
