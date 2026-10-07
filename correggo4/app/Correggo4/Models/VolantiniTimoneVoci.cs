using System;

namespace Correggo4.Models;

/// <summary>
/// Una referenza dentro il piano del TIMONE (j251). È la tabella che conta: qui si registra dove
/// il Marketing vuole che vada ogni prodotto.
///
/// <c>IdElemento</c> punta al box di partenza SOLO per risalire ai suoi dati e al ritaglio
/// dell'immagine: su quella riga non si scrive mai.
/// </summary>
public partial class VolantiniTimoneVoci
{
    public long Id { get; set; }

    public long IdTimone { get; set; }

    /// <summary>Il box impaginato di partenza. Sola lettura, sempre.</summary>
    public long? IdElemento { get; set; }

    /// <summary>Il codice della referenza: è l'identità che sopravvive agli spostamenti.</summary>
    public string Codice { get; set; } = "";

    public string Basecode { get; set; } = "";

    /// <summary>Descrizione leggibile, per l'interfaccia.</summary>
    public string Etichetta { get; set; } = "";

    /// <summary>Dove sta adesso nel piano. Null quando non è in nessuna pagina.</summary>
    public long? IdPaginaTimone { get; set; }

    /// <summary>
    /// La casella nella griglia, da 1 a capienza. Null = in pagina ma senza casella.
    /// E' la casella IN ALTO A SINISTRA: se la referenza e' allargata occupa un rettangolo che
    /// parte da qui (vedi Colonne e Righe).
    /// </summary>
    public short? Posizione { get; set; }

    /// <summary>
    /// Quante caselle occupa in LARGHEZZA. 1 = una sola, com'e' sempre stato (j274).
    /// Michele (28/09): una referenza deve poter prendere piu' di un posto - per esempio una
    /// vedette che occupa due caselle affiancate - sempre restando dentro la griglia.
    /// </summary>
    public short Colonne { get; set; } = 1;

    /// <summary>Quante caselle occupa in ALTEZZA. 1 = una sola.</summary>
    public short Righe { get; set; } = 1;

    /// <summary>Referenze raggruppate hanno lo stesso valore; null = sciolta.</summary>
    public long? IdGruppo { get; set; }

    /// <summary>vedette, star, artwork, oppure vuoto (da requiresIngombro del plug-in).</summary>
    public string Ruolo { get; set; } = "";

    /// <summary>
    /// 0 = in pagina · 1 = fuori volantino · 2 = eliminata ·
    /// 3 = in sospeso (non ci sta da nessuna parte: blocca il salvataggio, vedi specifica §6.7).
    /// </summary>
    public short Stato { get; set; }

    public short? PaginaOrigine { get; set; }

    public short? PosizioneOrigine { get; set; }

    public DateTime? DataModifica { get; set; }

    public short? IdAutore { get; set; }
}
