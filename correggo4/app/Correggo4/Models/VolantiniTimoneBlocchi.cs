using System;

namespace Correggo4.Models;

/// <summary>
/// Una casella BLOCCATA di una pagina del timone (j279).
///
/// Michele, 28/09: «l'utente può decidere se bloccare una posizione perché magari non ci vuole
/// niente in quel punto, perché ci vorrà un qualcosa di grafico». Il blocco è una scelta
/// dell'utente, non un problema: un bollo, un logo, una foto ambientata prenderanno quel posto
/// quando il volantino verrà impaginato davvero.
///
/// Sta in una tabella sua e NON è una voce: non ha un codice, non ha un box di partenza, non ha
/// uno stato. Ma OCCUPA UNA CASELLA come una referenza, e questa è la cosa da ricordare: una 2x3
/// con una casella bloccata tiene cinque referenze, non sei. Chi controlla la pagina al
/// salvataggio deve contare anche i blocchi, sennò due cose finirebbero nello stesso posto.
///
/// Per decisione di Michele (28/09) il blocco prende UNA casella sola: niente Colonne e Righe come
/// le voci. Per riservare quattro caselle se ne bloccano quattro.
/// </summary>
public partial class VolantiniTimoneBlocchi
{
    public long Id { get; set; }

    public long IdTimone { get; set; }

    /// <summary>La pagina del piano in cui sta la casella bloccata.</summary>
    public long IdPaginaTimone { get; set; }

    /// <summary>La casella nella griglia, da 1 a capienza. Sempre valorizzata.</summary>
    public short Posizione { get; set; }

    public DateTime? DataModifica { get; set; }

    /// <summary>Chi l'ha bloccata per ultimo.</summary>
    public short? IdAutore { get; set; }
}
