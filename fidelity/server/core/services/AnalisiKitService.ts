import { log } from '../logger';
import type { IAnalisiPuntiVenditaRepository, RiepilogoDaSalvare, RigaReferenzaKit } from '../repositories/AnalisiPuntiVenditaRepository';
import { aggregatiDi, type AggregatiKit, riassumiKit, VERSIONE_ANALISI_KIT } from '../utils/analisiKit';
import { leggiReferenza, type ReferenzaStampata } from '../utils/referenzaStampata';

/**
 * I riepiloghi dei kit in analisi_kit, calcolati quando servono: li usano le pagine del punto vendita
 * (scheda, volantino, referenza) e il viaggio di un prodotto negli insight del volantino, con la
 * stessa cache e la stessa formula (VERSIONE_ANALISI_KIT). Sta qui e non in uno dei due servizi
 * perche' un riepilogo calcolato da uno vale per l'altro: due copie della logica finirebbero per
 * salvare riepiloghi diversi dello stesso kit.
 *
 * Quelli che mancano o non valgono piu' si calcolano dalle referenze, a blocchi, e si salvano prima
 * di rispondere. Un salvataggio che non riesce fa fallire la richiesta: senza, le statistiche dei
 * prodotti lette in SQL sui riepiloghi sarebbero incomplete.
 */

/** Kit le cui referenze si leggono in una volta quando i riepiloghi mancano. */
export const KIT_PER_LETTURA = 25;

/** Le chiavi dei prodotti (referenzaStampata.chiaveProdotto): 'c-<codice>' o 'd-<base64url>'. */
export const CHIAVE_PRODOTTO = /^[cd]-[A-Za-z0-9_.~-]{1,1000}$/;

/** Quello che serve del repository: leggere e salvare i riepiloghi, leggere le referenze. */
export type RepositoryRiepiloghiKit = Pick<IAnalisiPuntiVenditaRepository, 'aggregatiKit' | 'referenzeDeiKit' | 'salvaRiepiloghi'>;

/** Le referenze lette com'e' stampate, ognuna secondo l'origine del suo kit (Istanta o storico). */
export const leggiReferenzeKit = (righe: readonly RigaReferenzaKit[]): ReferenzaStampata[] =>
  righe.map(riga => leggiReferenza(riga, { storico: riga.storico === true }));

/** L'ultima modifica fra le referenze lette, null se non ce ne sono. */
export function ultimaModifica(righe: readonly RigaReferenzaKit[]): Date | null {
  let ultima: number | null = null;
  for (const riga of righe) {
    const istante = riga.aggiornata_il ? new Date(riga.aggiornata_il).getTime() : Number.NaN;
    if (Number.isFinite(istante) && (ultima === null || istante > ultima)) ultima = istante;
  }
  return ultima === null ? null : new Date(ultima);
}

export class AnalisiKitService {
  /**
   * @param contesto prefisso del messaggio di log, per sapere quale pagina ha fatto calcolare i
   * riepiloghi (la prima apertura e' quella lenta).
   */
  constructor(
    private readonly repository: RepositoryRiepiloghiKit,
    private readonly contesto = 'Analisi PV',
  ) {}

  /**
   * Gli aggregati dei kit: quelli dei riepiloghi salvati e validi, gli altri da riepiloghi calcolati
   * ora e salvati. All'uscita ogni kit indicato ha il suo riepilogo valido in analisi_kit.
   */
  async aggregati(idKit: readonly string[]): Promise<Map<string, AggregatiKit>> {
    const unici = [...new Set(idKit)];
    if (unici.length === 0) return new Map();
    const aggregati = await this.repository.aggregatiKit(unici, VERSIONE_ANALISI_KIT);
    const mancanti = unici.filter(id => !aggregati.has(id));
    if (mancanti.length > 0) log.info(`${this.contesto}: riepiloghi dei kit da calcolare`, { kit: mancanti.length });
    for (let inizio = 0; inizio < mancanti.length; inizio += KIT_PER_LETTURA) {
      const blocco = mancanti.slice(inizio, inizio + KIT_PER_LETTURA);
      const perKit = new Map<string, RigaReferenzaKit[]>();
      for (const riga of await this.repository.referenzeDeiKit(blocco)) {
        const delKit = perKit.get(riga.id_runtime_kit);
        if (delKit) delKit.push(riga);
        else perKit.set(riga.id_runtime_kit, [riga]);
      }
      const nuovi: RiepilogoDaSalvare[] = blocco.map((id) => {
        const righe = perKit.get(id) ?? [];
        const riepilogo = riassumiKit(leggiReferenzeKit(righe));
        aggregati.set(id, aggregatiDi(riepilogo.dati));
        return { idKit: id, versione: VERSIONE_ANALISI_KIT, riepilogo, referenzeAl: ultimaModifica(righe) };
      });
      await this.repository.salvaRiepiloghi(nuovi);
    }
    return aggregati;
  }
}
