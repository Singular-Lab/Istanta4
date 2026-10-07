using System;

namespace Correggo4.Models;

/// <summary>
/// Le impostazioni di un utente (j243). Oggi ce n'e' una sola: se vuole le email di notifica.
/// L'interruttore «Notifiche» della home scrive qui (decisione di Michele del 16/9: governa le
/// email, non la campanella). Nessuna riga = email attive.
/// Non si usa `utenti_preferenze`: quella tiene solo l'ultima cartella usata.
/// </summary>
public partial class UtentiImpostazioni
{
    public short IdUtente { get; set; }

    public bool EmailNotifiche { get; set; } = true;

    public DateTime DataModifica { get; set; }

    public virtual Utenti IdUtenteNavigation { get; set; } = null!;
}
