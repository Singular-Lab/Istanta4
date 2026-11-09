import { log } from '../logger';
import type { IVenditeRepository } from '../repositories/VenditeRepository';
import type { VenditaDaScrivere } from '../vendite/preparaImportVendite';

/** Vendite scritte con una sola istruzione; fra un blocco e l'altro si salvano avanzamento e battito. */
export const DIMENSIONE_BLOCCO_VENDITE = 1000;

/**
 * Battito anche durante un blocco lento: ben sotto MINUTI_IMPORT_INTERROTTO, cosi' un import vivo
 * non sembra mai interrotto.
 */
export const INTERVALLO_BATTITO_VENDITE_MS = 30 * 1000;

/** Un import gia' creato in importazioni_vendite, con le vendite preparate da scrivere. */
export interface LavoroImportVendite {
  id: string;
  idGdo: string;
  /** Una per prodotto, punto vendita e periodo. */
  vendite: VenditaDaScrivere[];
  /** Righe scartate prima di scrivere: contano gia' come elaborate. */
  scartate: number;
}

export interface OpzioniLavoroImportVendite {
  dimensioneBlocco?: number;
  intervalloBattitoMs?: number;
}

/** 'perso': l'import non era piu' in corso (dichiarato interrotto altrove), il lavoro si e' fermato senza toccarlo. */
export interface EsitoLavoroImportVendite {
  stato: 'completato' | 'annullato' | 'fallito' | 'perso';
  elaborate: number;
  scritte: number;
  errore: string | null;
}

const messaggio = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Scrive le vendite dell'import a blocchi, nel processo che ha ricevuto il file. Prima di ogni blocco
 * salva l'avanzamento e il battito e legge l'annullamento, che puo' essere stato chiesto a un altro
 * processo: le righe gia' scritte restano. Un errore ferma l'import ('fallito', con il motivo).
 * L'esito finale si scrive solo se l'import e' ancora in corso. Non lancia mai.
 */
export async function eseguiImportVendite(
  repository: IVenditeRepository,
  lavoro: LavoroImportVendite,
  opzioni: OpzioniLavoroImportVendite = {},
): Promise<EsitoLavoroImportVendite> {
  const dimensione = Math.max(1, Math.floor(opzioni.dimensioneBlocco ?? DIMENSIONE_BLOCCO_VENDITE));
  const timer = setInterval(() => {
    repository.battito(lavoro.id).catch(e => log.warn('importVendite - battito non registrato', { id: lavoro.id, error: messaggio(e) }));
  }, opzioni.intervalloBattitoMs ?? INTERVALLO_BATTITO_VENDITE_MS);
  timer.unref?.();

  let stato: 'completato' | 'annullato' | 'fallito' = 'completato';
  let elaborate = lavoro.scartate;
  let scritte = 0;
  let errore: string | null = null;
  try {
    for (let inizio = 0; inizio < lavoro.vendite.length; inizio += dimensione) {
      const controllo = await repository.avanzamento(lavoro.id, { elaborate, scritte });
      if (controllo === 'perso') {
        log.warn("importVendite - l'import non e' piu' in corso, lavoro fermato", { id: lavoro.id, idGdo: lavoro.idGdo });
        return { stato: 'perso', elaborate, scritte, errore: null };
      }
      if (controllo === 'annullato') {
        stato = 'annullato';
        break;
      }
      const blocco = lavoro.vendite.slice(inizio, inizio + dimensione);
      scritte += await repository.scriviVendite(lavoro.idGdo, lavoro.id, blocco);
      elaborate += blocco.length;
    }
  } catch (e) {
    log.error('importVendite - scrittura non riuscita', { id: lavoro.id, idGdo: lavoro.idGdo, error: messaggio(e) });
    stato = 'fallito';
    errore = `Scrittura delle vendite non riuscita: ${messaggio(e)}`;
  } finally {
    clearInterval(timer);
  }

  const esito = { stato, elaborate, scritte, errore };
  try {
    await repository.concludiImport(lavoro.id, esito);
  } catch (e) {
    // Senza battito l'import risultera' interrotto fra MINUTI_IMPORT_INTERROTTO minuti: la GDO non resta bloccata
    log.error('importVendite - esito non salvato', { id: lavoro.id, error: messaggio(e) });
  }
  log.info('importVendite - terminato', { id: lavoro.id, idGdo: lavoro.idGdo, ...esito });
  return esito;
}
