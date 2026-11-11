import type { BoxInsight } from "../../../../lib/insightVolantino/tipi";
import type { GruppoBox } from "./colori";
import { riquadroBox } from "./geometria";

/**
 * L'analisi delle pagine aperte nel lettore e la ricerca dei box nel volantino, calcolate dai box
 * che l'API restituisce già. Funzioni pure. Niente calore, visibilità o vendite (spec insight-volantino).
 */

export interface SintesiPagina {
  box: number;
  /** Spazio della pagina occupato dai box, in % (0-100). */
  spazio: number;
  /** Media degli sconti dei box che ne hanno uno, in %; null se nessuno ce l'ha. */
  scontoMedio: number | null;
  /** Box con meccanica Prezzo Fidelity. */
  fidelity: number;
  sottocosto: number;
}

const valido = (valore: number | null | undefined): valore is number => typeof valore === "number" && Number.isFinite(valore);

/** Lo spazio di un box in % della pagina, 0 se non si sa. */
const spazioDi = (box: Pick<BoxInsight, "spazio">): number => (valido(box.spazio) && box.spazio > 0 ? box.spazio : 0);

/** Quante pagine si analizzano insieme: lo spazio dei box si divide fra tutte. */
const pagineValide = (pagine: number): number => (Number.isFinite(pagine) && pagine >= 1 ? Math.floor(pagine) : 1);

/**
 * I numeri delle pagine aperte: box, spazio occupato (al più 100%, anche se i riquadri si
 * sovrappongono; con due pagine, sullo spazio delle due), sconto medio, box fidelity e sottocosto,
 * contati come nella sintesi del volantino.
 */
export const sintesiPagina = (box: readonly Pick<BoxInsight, "spazio" | "sconto" | "meccanica" | "sottocosto">[], pagine = 1): SintesiPagina => {
  const sconti = box.map(voce => voce.sconto).filter(valido);
  return {
    box: box.length,
    spazio: Math.min(100, box.reduce((somma, voce) => somma + spazioDi(voce), 0) / pagineValide(pagine)),
    scontoMedio: sconti.length > 0 ? sconti.reduce((somma, sconto) => somma + sconto, 0) / sconti.length : null,
    fidelity: box.filter(voce => voce.meccanica === "fidelity").length,
    sottocosto: box.filter(voce => voce.sottocosto).length,
  };
};

export interface GruppoPagina extends GruppoBox {
  box: number;
  /** Spazio della pagina occupato dai box del gruppo, in %. */
  spazio: number;
}

/**
 * I box delle pagine raggruppati secondo la colorazione scelta (reparto, meccanica o fascia di
 * sconto): dal gruppo con più spazio, a parità con più box; i box senza il dato per ultimi. Lo
 * spazio è sulla superficie di tutte le `pagine` analizzate insieme.
 */
export const ripartizionePagina = <T extends Pick<BoxInsight, "spazio">>(box: readonly T[], gruppo: (box: T) => GruppoBox, pagine = 1): GruppoPagina[] => {
  const gruppi = new Map<string, GruppoPagina>();
  const diviso = pagineValide(pagine);
  for (const voce of box) {
    const suo = gruppo(voce);
    const attuale = gruppi.get(suo.id);
    if (attuale) {
      attuale.box += 1;
      attuale.spazio += spazioDi(voce) / diviso;
    } else {
      gruppi.set(suo.id, { ...suo, box: 1, spazio: spazioDi(voce) / diviso });
    }
  }
  return [...gruppi.values()].sort(
    (a, b) =>
      Number(a.id === "senza") - Number(b.id === "senza") ||
      b.spazio - a.spazio ||
      b.box - a.box ||
      a.etichetta.localeCompare(b.etichetta, "it")
  );
};

/** I box dal più grande al più piccolo; a parità di spazio, per nome. */
export const perSpazio = <T extends Pick<BoxInsight, "spazio" | "nome">>(box: readonly T[]): T[] =>
  [...box].sort((a, b) => spazioDi(b) - spazioDi(a) || a.nome.localeCompare(b.nome, "it"));

/* ---------- Ricerca ---------- */

/** Sotto questa lunghezza non si cerca: una lettera sola troverebbe quasi tutti i box. */
export const LUNGHEZZA_MINIMA_RICERCA = 2;

/** Testo confrontabile: minuscolo, senza accenti e con gli spazi compattati. */
export const normalizzaRicerca = (testo: string): string =>
  testo.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("it").replace(/\s+/g, " ").trim();

type BoxCercabile = Pick<BoxInsight, "nome" | "marca" | "formato" | "pagina" | "geometria">;

/** Ordine di lettura: per pagina, poi dall'alto in basso e da sinistra a destra; i box senza posizione in fondo alla loro pagina. */
export const ordineLettura = (a: BoxCercabile, b: BoxCercabile): number => {
  if (a.pagina !== b.pagina) {
    if (a.pagina === null) return 1;
    if (b.pagina === null) return -1;
    return a.pagina - b.pagina;
  }
  const ra = riquadroBox(a.geometria);
  const rb = riquadroBox(b.geometria);
  if (!ra || !rb) return Number(!ra) - Number(!rb);
  return ra.y - rb.y || ra.x - rb.x;
};

type BoxDaCercare = BoxCercabile & Partial<Pick<BoxInsight, "codiceBox" | "dettaglioProdotti">>;

/**
 * Tutto il testo in cui si cerca un box, normalizzato: nome, marca e formato del box e, per ogni suo
 * prodotto, nome, marca, formato, gusto, codice referenza ed EAN, più il codice box.
 */
export const testoCercabile = (voce: BoxDaCercare): string =>
  normalizzaRicerca(
    [
      voce.nome,
      voce.marca,
      voce.formato,
      voce.codiceBox,
      ...(voce.dettaglioProdotti ?? []).flatMap(prodotto => [prodotto.nome, prodotto.marca, prodotto.formato, prodotto.gusto, prodotto.codice, ...prodotto.ean]),
    ]
      .filter(Boolean)
      .join(" ")
  );

/**
 * I box che contengono tutte le parole cercate nel loro testo (testoCercabile: nomi, marche, formati,
 * gusti, codici ed EAN di tutti i prodotti del box, anche una parte delle cifre), senza badare a
 * maiuscole e accenti, in ordine di lettura. Solo i box con una pagina: gli altri non si possono
 * mostrare. Null se il testo è troppo corto per cercare.
 */
export const cercaBox = <T extends BoxDaCercare>(box: readonly T[], testo: string): T[] | null => {
  const cercato = normalizzaRicerca(testo);
  if (cercato.length < LUNGHEZZA_MINIMA_RICERCA) return null;
  const parole = cercato.split(" ");
  return box
    .filter(voce => {
      if (voce.pagina === null) return false;
      const testoBox = testoCercabile(voce);
      return parole.every(parola => testoBox.includes(parola));
    })
    .sort(ordineLettura);
};

/**
 * Il risultato a cui andare con "successivo" (passo 1) o "precedente" (passo -1). Dal risultato
 * attuale si gira in tondo; senza un risultato attuale si parte dalla pagina che si sta guardando:
 * il primo box da lì in avanti, o l'ultimo da lì indietro. -1 se non ci sono risultati.
 */
export const risultatoVicino = (
  risultati: readonly Pick<BoxInsight, "pagina">[],
  attuale: number,
  passo: 1 | -1,
  paginaCorrente: number
): number => {
  const quanti = risultati.length;
  if (quanti === 0) return -1;
  if (attuale >= 0 && attuale < quanti) return (attuale + passo + quanti) % quanti;
  if (passo === 1) {
    const avanti = risultati.findIndex(voce => (voce.pagina ?? 0) >= paginaCorrente);
    return avanti >= 0 ? avanti : 0;
  }
  for (let indice = quanti - 1; indice >= 0; indice -= 1) {
    if ((risultati[indice].pagina ?? 0) <= paginaCorrente) return indice;
  }
  return quanti - 1;
};
