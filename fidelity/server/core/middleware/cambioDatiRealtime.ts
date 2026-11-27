import type { NextFunction, Request, Response } from 'express';
import { TIPO_UTENTI } from '../../../lib/enums';
import { emitToClients } from '../../ws-server';
import { azioneDi, cambiaDati, idDi, risorsaDi, type AzioneDati } from '../realtime/classificazione';
import { gdoDichiarataDelCambio, segnalaGdoDelCambio } from '../realtime/gdoDelCambio';
import { ROOM_SUPERADMIN, roomGdo } from '../utils/socketRooms';

// Riesportata per chi la cerca accanto al middleware
export { segnalaGdoDelCambio };

/**
 * Dopo una richiesta riuscita che cambia dei dati, avvisa le pagine aperte della stessa GDO
 * (spec interfaccia-operatore, "Dati aggiornati in tempo reale"). L'avviso dice solo che tipo di dato
 * e' cambiato, con quale azione e quale identificativo: la pagina rilegge con i permessi dell'utente.
 * Gli avvisi di un utente senza GDO (il Superadmin) vanno ai soli Superadmin.
 */

export const EVENTO_DATI_CAMBIATI = 'dati:cambiato';

/**
 * Per ogni GDO e tipo di dato un avviso al massimo ogni FINESTRA_AVVISI_MS: il primo parte subito, quelli
 * che seguono nella finestra si fondono in uno solo che parte alla fine. Un'importazione che scrive
 * mille dati manda cosi' un avviso al secondo, non mille: ogni avviso fa rileggere le pagine di tutta la GDO.
 */
export const FINESTRA_AVVISI_MS = 1000;

export interface AvvisoDati {
  risorsa: string;
  azione: AzioneDati;
  id: string | null;
  /** L'identificativo che il client ha mandato (X-Client-Id): chi ha agito ignora il proprio avviso. */
  origine: string | null;
}

export type Emetti = (evento: string, dati: unknown, room: string) => void;

const MASSIMO_VOCI_RECENTI = 500;

const CODICE_ORIGINE = /^[A-Za-z0-9_-]{8,64}$/;

/** La room degli interessati: la GDO della sessione, o i Superadmin se la sessione non ha una GDO. */
export function roomDegliInteressati(session?: { id_gdo?: string; tipo_utente?: string } | null): string | null {
  if (session?.id_gdo) return roomGdo(session.id_gdo);
  if (session?.tipo_utente === TIPO_UTENTI.SUPERADMIN) return ROOM_SUPERADMIN;
  return null;
}

interface StatoAvviso {
  ultimo: number;
  pendente: AvvisoDati | null;
  timer: ReturnType<typeof setTimeout> | null;
}

/** Due avvisi fusi dicono solo cio' che hanno in comune: l'identificativo, l'azione e l'origine che differiscono si tolgono o si prendono dall'ultimo. */
function fondi(precedente: AvvisoDati | null, nuovo: AvvisoDati): AvvisoDati {
  if (!precedente) return nuovo;
  return {
    risorsa: nuovo.risorsa,
    azione: nuovo.azione,
    id: precedente.id === nuovo.id ? nuovo.id : null,
    origine: precedente.origine === nuovo.origine ? nuovo.origine : null,
  };
}

export function cambioDatiRealtime(emetti: Emetti = emitToClients, adesso: () => number = Date.now) {
  const stati = new Map<string, StatoAvviso>();

  const emettiConFinestra = (room: string, avviso: AvvisoDati): void => {
    const chiave = `${room}|${avviso.risorsa}`;
    const ora = adesso();
    let stato = stati.get(chiave);
    if (!stato) {
      if (stati.size >= MASSIMO_VOCI_RECENTI) {
        for (const [voce, valore] of stati) {
          if (!valore.timer && ora - valore.ultimo >= FINESTRA_AVVISI_MS) stati.delete(voce);
        }
      }
      stato = { ultimo: 0, pendente: null, timer: null };
      stati.set(chiave, stato);
    }

    if (!stato.timer && (stato.ultimo === 0 || ora - stato.ultimo >= FINESTRA_AVVISI_MS)) {
      stato.ultimo = ora;
      emetti(EVENTO_DATI_CAMBIATI, avviso, room);
      return;
    }

    // Dentro la finestra: si tiene l'avviso, e ne parte uno solo alla fine
    stato.pendente = fondi(stato.pendente, avviso);
    if (!stato.timer) {
      const attesa = Math.max(0, stato.ultimo + FINESTRA_AVVISI_MS - ora);
      stato.timer = setTimeout(() => {
        const corrente = stati.get(chiave);
        if (!corrente) return;
        const daInviare = corrente.pendente;
        corrente.timer = null;
        corrente.pendente = null;
        corrente.ultimo = adesso();
        if (daInviare) {
          try {
            emetti(EVENTO_DATI_CAMBIATI, daInviare, room);
          } catch {
            // Un avviso non emesso non deve mai fermare il processo
          }
        }
      }, attesa);
      stato.timer.unref?.();
    }
  };

  return (req: Request, res: Response, next: NextFunction): void => {
    const percorso = req.originalUrl ?? req.url;
    if (!cambiaDati(req.method, percorso)) {
      next();
      return;
    }

    res.on('finish', () => {
      try {
        if (res.statusCode < 200 || res.statusCode >= 300) return;
        const gdoDichiarata = gdoDichiarataDelCambio(res);
        const room = gdoDichiarata
          ? roomGdo(gdoDichiarata)
          : roomDegliInteressati(req.session as { id_gdo?: string; tipo_utente?: string } | undefined);
        if (!room) return;

        const origine = req.get('x-client-id');
        emettiConFinestra(room, {
          risorsa: risorsaDi(percorso),
          azione: azioneDi(req.method),
          id: idDi(percorso),
          origine: origine && CODICE_ORIGINE.test(origine) ? origine : null,
        });
      } catch {
        // Un avviso non emesso non deve mai toccare la risposta gia' inviata
      }
    });

    next();
  };
}
