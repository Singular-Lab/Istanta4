import type { ParteDescrizione, TestiDescrizioneBox } from './tipi';

/**
 * La descrizione completa del box nella scheda del volantino (spec insight-volantino, "Scheda del
 * box del volantino" e "Scheda del volantino adattata al cliente e alla GDO"): i testi stampati del
 * box in un'unica riga accanto al prezzo, come sul cartellino. La libreria agenzia del cliente puo'
 * comporla a modo suo (InsightVolantinoAgenzia.descrizioneBox); senza, vale quella standard.
 * Funzioni pure, condivise fra server e client (che la usa con i server non aggiornati).
 */

/** Oltre queste varianti la descrizione dice quante altre ce ne sono. */
export const MASSIMO_VARIANTI = 3;

const pulito = (testo: string | null | undefined): string => testo?.trim().replace(/\s+/g, ' ') ?? '';

/** Le varianti diverse dei prodotti del box, nell'ordine dei prodotti: "Light" e "LIGHT" sono la stessa. */
export function variantiDei(prodotti: ReadonlyArray<{ gusto: string | null }>): string[] {
  const viste = new Map<string, string>();
  for (const prodotto of prodotti) {
    const variante = pulito(prodotto.gusto);
    if (!variante) continue;
    const chiave = variante.toLocaleLowerCase('it-IT');
    if (!viste.has(chiave)) viste.set(chiave, variante);
  }
  return [...viste.values()];
}

/** "Light, Classica e altre 2": le varianti in un testo solo; null senza varianti. */
export function testoVarianti(varianti: readonly string[]): string | null {
  const elenco = varianti.map(pulito).filter(Boolean);
  if (elenco.length === 0) return null;
  if (elenco.length <= MASSIMO_VARIANTI) return elenco.join(', ');
  const altre = elenco.length - MASSIMO_VARIANTI;
  return `${elenco.slice(0, MASSIMO_VARIANTI).join(', ')} e ${altre === 1 ? 'un\'altra' : `altre ${altre}`}`;
}

/**
 * La descrizione standard: nome, marca in evidenza, formato e varianti, come si leggono sul
 * volantino ("Gelato Nutella 230 g"). Le parti vuote non ci sono.
 */
export function descrizioneStandard({ nome, marca, formato, varianti }: TestiDescrizioneBox): ParteDescrizione[] {
  const parti: ParteDescrizione[] = [];
  const aggiungi = (testo: string | null | undefined, evidenza = false) => {
    const valore = pulito(testo);
    if (valore) parti.push(evidenza ? { testo: valore, evidenza: true } : { testo: valore });
  };
  aggiungi(nome);
  aggiungi(marca, true);
  aggiungi(formato);
  aggiungi(testoVarianti(varianti));
  return parti;
}

/** La descrizione completa come testo semplice, per il lettore di schermo e per i confronti. */
export const testoDescrizione = (parti: readonly ParteDescrizione[]): string => parti.map(parte => parte.testo).join(' ');
