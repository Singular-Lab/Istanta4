import { TIPO_UTENTI } from '../../../lib/enums';

/**
 * Room del canale Socket.IO. Ogni client UI autenticato entra in quella degli
 * autenticati, nella propria e in quella della propria GDO; le notifiche vanno
 * solo alla room interessata, mai a tutte le connessioni.
 */
export const ROOM_AUTENTICATI = 'auth';

/** Room dei Superadmin: ricevono gli avvisi dei cambi dati di chi non ha una GDO. */
export const ROOM_SUPERADMIN = 'superadmin';

export const roomUtente = (idUtente: string) => `user:${idUtente}`;

export const roomGdo = (idGdo: string) => `gdo:${idGdo}`;

/** Room di un client UI; null se la sessione non e' valida e la connessione va chiusa. */
export function stanzeClient(session?: { id_utente?: string; id_gdo?: string; tipo_utente?: string } | null): string[] | null {
  if (!session?.id_utente) {
    return null;
  }
  const stanze = [ROOM_AUTENTICATI, roomUtente(session.id_utente)];
  if (session.id_gdo) {
    stanze.push(roomGdo(session.id_gdo));
  }
  if (session.tipo_utente === TIPO_UTENTI.SUPERADMIN) {
    stanze.push(ROOM_SUPERADMIN);
  }
  return stanze;
}
