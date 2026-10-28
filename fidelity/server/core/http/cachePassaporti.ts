import { createHash } from 'node:crypto';

/**
 * Passaporti Olimpo gia' ottenuti, per worker. Olimpo restituisce sempre la stessa chiave
 * pubblica e non ne indica la scadenza: chiederla a ogni chiamata verso Istanta costava due
 * letture dell'utente e un PUT. La voce dura DURATA_PASSAPORTO_MS e si scarta prima quando
 * Istanta non riconosce piu' l'utente, quando Olimpo rifiuta, al login/logout e quando l'utente
 * viene modificato. Gli errori non si memorizzano: la chiamata successiva riprova.
 */

export const DURATA_PASSAPORTO_MS = 10 * 60_000;
/** Oltre questo numero di utenti si scarta la voce meno recente. */
export const MASSIMO_PASSAPORTI = 2_000;

/** outsider: l'utente entra con i cookie di Istanta e non manda il passaporto. */
export type Passaporto = { outsider: boolean; publicKey: string | null };

type Voce = Passaporto & { impronta: string; scade: number };
type RichiestaInCorso = { promessa: Promise<Passaporto | null>; valida: boolean };

const voci = new Map<string, Voce>();
const inCorso = new Map<string, RichiestaInCorso>();

// La chiave privata della sessione distingue un login fatto dopo un cambio di chiave;
// in memoria ne resta solo l'impronta
function improntaChiave(chiavePrivata: string | undefined | null): string {
  return createHash('sha256').update(chiavePrivata ?? '').digest('hex').slice(0, 16);
}

function memorizza(idUtente: string, voce: Voce): void {
  // Reinserita in fondo: la prima della Map e' sempre la meno recente
  voci.delete(idUtente);
  voci.set(idUtente, voce);
  if (voci.size > MASSIMO_PASSAPORTI) {
    const piuVecchia = voci.keys().next().value;
    if (piuVecchia !== undefined) voci.delete(piuVecchia);
  }
}

/**
 * Passaporto dell'utente dalla cache, oppure ottenuto con `richiedi`. Le richieste
 * contemporanee dello stesso utente ne fanno partire una sola. Un errore o un null
 * (utente inesistente) non si memorizzano. Con `serveChiave` non basta una voce senza
 * chiave pubblica (utente outsider per cui il passaporto non era stato chiesto).
 */
export function passaportoInCache(
  idUtente: string,
  chiavePrivata: string | undefined | null,
  richiedi: () => Promise<Passaporto | null>,
  serveChiave = false,
): Promise<Passaporto | null> {
  const impronta = improntaChiave(chiavePrivata);
  const voce = voci.get(idUtente);
  if (voce && voce.impronta === impronta && voce.scade > Date.now() && (!serveChiave || voce.publicKey)) {
    return Promise.resolve({ outsider: voce.outsider, publicKey: voce.publicKey });
  }

  const chiave = `${idUtente}:${impronta}:${serveChiave ? 'chiave' : 'tipo'}`;
  const esistente = inCorso.get(chiave);
  if (esistente) return esistente.promessa;

  const richiesta: RichiestaInCorso = { valida: true, promessa: Promise.resolve(null) };
  richiesta.promessa = Promise.resolve()
    .then(richiedi)
    .then((passaporto) => {
      // Invalidata mentre era in corso (es. utente modificato): il risultato vale solo per chi lo aspettava
      if (passaporto && richiesta.valida) {
        memorizza(idUtente, { ...passaporto, impronta, scade: Date.now() + DURATA_PASSAPORTO_MS });
      }
      return passaporto;
    })
    .finally(() => {
      if (inCorso.get(chiave) === richiesta) inCorso.delete(chiave);
    });
  inCorso.set(chiave, richiesta);
  return richiesta.promessa;
}

/** Scarta il passaporto dell'utente: la prossima chiamata lo chiede di nuovo a Olimpo. */
export function invalidaPassaporto(idUtente: string | undefined | null): void {
  if (!idUtente) return;
  voci.delete(idUtente);
  // Una richiesta gia' partita non deve rimettere in cache il passaporto appena scartato
  for (const [chiave, richiesta] of inCorso) {
    if (chiave.startsWith(`${idUtente}:`)) {
      richiesta.valida = false;
      inCorso.delete(chiave);
    }
  }
}

/** Solo per i test. */
export function svuotaCachePassaporti(): void {
  voci.clear();
  inCorso.clear();
}
