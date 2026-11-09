/**
 * Quando due righe delle liste dei punti vendita stampate nei volantini sono lo stesso punto vendita
 * (spec volantini-pop): stessa località e stesso indirizzo, senza distinguere maiuscole e spazi.
 * Quando manca la località o l'indirizzo vale la riga intera, con la stessa regola: due negozi della
 * stessa città con l'indirizzo non letto non diventano uno.
 *
 * L'abbinamento all'anagrafica non conta: due righe diverse abbinate per errore allo stesso punto
 * vendita restano due punti vendita, e due righe uguali sono lo stesso punto vendita anche quando una
 * sola delle due è abbinata. Così un punto vendita stampato nelle liste di più kit della promozione
 * conta una volta sola, e ciascun kit lo conta fra i suoi.
 *
 * La stessa regola in SQL è chiavePuntoVenditaStampatoSql in
 * server/core/repositories/MaterialiRepository.ts: chi cambia l'una cambia l'altra.
 * ConsultazioneService.integrazione.test.ts controlla che diano gli stessi conteggi.
 */

export interface RigaPuntoVenditaStampata {
  localita: string | null | undefined;
  indirizzo: string | null | undefined;
  /** La riga come era stampata. */
  riga: string | null | undefined;
}

/** Spazi ridotti a uno, senza spazi ai lati, minuscolo. */
const compatto = (testo: string): string => testo.replace(/\s+/g, ' ').trim().toLowerCase();

const presente = (testo: string | null | undefined): testo is string => /\S/.test(testo ?? '');

/** La chiave del punto vendita di una riga stampata: righe con la stessa chiave sono lo stesso punto vendita. */
export function chiavePuntoVenditaStampato({ localita, indirizzo, riga }: RigaPuntoVenditaStampata): string {
  if (presente(localita) && presente(indirizzo)) return compatto(`${localita} | ${indirizzo}`);
  // Il prefisso tiene le righe intere lontane dalle chiavi dei luoghi
  return `riga:${compatto(riga ?? '')}`;
}
