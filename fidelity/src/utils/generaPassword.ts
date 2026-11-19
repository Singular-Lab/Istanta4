import { SIMBOLI_PASSWORD } from "../../lib/accessi/tipiUtenteCreabili";

/** Lettere e cifre senza i caratteri che si confondono quando la password si detta o si ricopia (l/I/1, O/0). */
const MINUSCOLE = "abcdefghijkmnopqrstuvwxyz";
const MAIUSCOLE = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const CIFRE = "23456789";
const TUTTI = MINUSCOLE + MAIUSCOLE + CIFRE + SIMBOLI_PASSWORD;

/** Intero casuale in [0, massimo) dal generatore crittografico, senza lo sbilanciamento del modulo. */
function casuale(massimo: number): number {
  const limite = Math.floor(0x100000000 / massimo) * massimo;
  const buffer = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buffer);
    if (buffer[0] < limite) return buffer[0] % massimo;
  }
}

const caratteriDa = (insieme: string) => insieme.charAt(casuale(insieme.length));

/**
 * Genera la password casuale di un nuovo utente secondo REGOLA_PASSWORD (almeno una minuscola, una
 * maiuscola, una cifra e un simbolo ammesso), con i caratteri in posizioni mescolate.
 */
export function generaPassword(lunghezza = 14): string {
  const caratteri = [caratteriDa(MINUSCOLE), caratteriDa(MAIUSCOLE), caratteriDa(CIFRE), caratteriDa(SIMBOLI_PASSWORD)];
  while (caratteri.length < Math.max(lunghezza, 8)) caratteri.push(caratteriDa(TUTTI));
  // Fisher-Yates: le quattro classi obbligatorie non restano sempre in testa
  for (let i = caratteri.length - 1; i > 0; i--) {
    const j = casuale(i + 1);
    [caratteri[i], caratteri[j]] = [caratteri[j], caratteri[i]];
  }
  return caratteri.join("");
}
