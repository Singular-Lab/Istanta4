import type { RichiestaSimulazione } from "../../../../lib/insightVolantino/rendimento";
import type { BoxInsight, GeometriaPagina } from "../../../../lib/insightVolantino/tipi";
import { riquadroBox } from "../volantino/geometria";

/**
 * Supporto del simulatore di un prodotto: prodotti del volantino, zone della pagina, campi del
 * modulo, validazione e richiesta (contratto RichiestaSimulazione in lib/insightVolantino/rendimento.ts).
 * Funzioni pure.
 *
 * La zona si sceglie su una griglia 3×3 disegnata sopra l'anteprima della pagina: ogni cella è un
 * pulsante (tastiera e lettori di schermo compresi) e il suo centro è il centro del box simulato.
 * In più c'è la posizione attuale del prodotto, quando sta nella pagina scelta.
 */

export interface Zona {
  /** Centro del box, 0-1 dall'alto a sinistra della pagina. */
  x: number;
  y: number;
}

export interface ZonaGriglia extends Zona {
  id: string;
  nome: string;
}

const NOMI_ZONE: readonly (readonly string[])[] = [
  ["In alto a sinistra", "In alto al centro", "In alto a destra"],
  ["A metà a sinistra", "Al centro", "A metà a destra"],
  ["In basso a sinistra", "In basso al centro", "In basso a destra"],
];

/** Le nove zone della pagina, per righe: il centro di ogni cella della griglia 3×3. */
export const ZONE_PAGINA: readonly ZonaGriglia[] = NOMI_ZONE.flatMap((riga, r) =>
  riga.map((nome, c) => ({ id: `${r}-${c}`, nome, x: arrotonda4((c + 0.5) / 3), y: arrotonda4((r + 0.5) / 3) }))
);

export const CENTRO_PAGINA: Zona = { x: 0.5, y: 0.5 };

export const NOME_POSIZIONE_ATTUALE = "Posizione attuale";

function arrotonda4(valore: number): number {
  return Math.round(valore * 10000) / 10000;
}

const limita01 = (valore: number): number => Math.min(1, Math.max(0, valore));

export const stessaZona = (a: Zona, b: Zona): boolean => Math.abs(a.x - b.x) < 1e-4 && Math.abs(a.y - b.y) < 1e-4;

/** Centro del riquadro del box nella pagina (tagliato al bordo); null senza posizione. */
export const centroBox = (box: Pick<BoxInsight, "geometria">): Zona | null => {
  const riquadro = riquadroBox(box.geometria);
  return riquadro ? { x: arrotonda4(riquadro.x + riquadro.w / 2), y: arrotonda4(riquadro.y + riquadro.h / 2) } : null;
};

/* ---------- Prodotti ---------- */

export interface ProdottoSimulabile {
  chiave: string;
  nome: string;
  marca: string | null;
  /** Il box del prodotto nel volantino: il primo per pagina, se il prodotto compare più volte. */
  box: BoxInsight;
}

const confrontaPagina = (a: BoxInsight, b: BoxInsight): number => (a.pagina ?? Number.MAX_SAFE_INTEGER) - (b.pagina ?? Number.MAX_SAFE_INTEGER);

/** I prodotti dei box del volantino (per chiave, una volta sola), in ordine di nome. */
export const prodottiSimulabili = (box: readonly BoxInsight[]): ProdottoSimulabile[] => {
  const perChiave = new Map<string, BoxInsight>();
  for (const voce of [...box].sort(confrontaPagina)) {
    if (!voce.chiave || perChiave.has(voce.chiave)) continue;
    perChiave.set(voce.chiave, voce);
  }
  return [...perChiave.values()]
    .map(voce => ({ chiave: voce.chiave, nome: voce.nome || "Prodotto senza nome", marca: voce.marca, box: voce }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "it") || a.chiave.localeCompare(b.chiave));
};

/** "Mozzarella · Granarolo · pagina 4". */
export const etichettaProdotto = (prodotto: ProdottoSimulabile): string =>
  [prodotto.nome, prodotto.marca, prodotto.box.pagina !== null ? `pagina ${prodotto.box.pagina}` : null].filter(Boolean).join(" · ");

const normalizza = (testo: string): string => testo.trim().replace(/\s+/g, " ").toLocaleLowerCase("it");

/** I prodotti il cui nome o marca contiene il testo cercato; quello scelto resta sempre. */
export const filtraProdotti = (prodotti: readonly ProdottoSimulabile[], cerca: string, scelto: string): ProdottoSimulabile[] => {
  const testo = normalizza(cerca);
  if (!testo) return [...prodotti];
  return prodotti.filter(voce => voce.chiave === scelto || normalizza(`${voce.nome} ${voce.marca ?? ""}`).includes(testo));
};

/* ---------- Campi del modulo ---------- */

/** I campi come li scrive l'utente: testo, perché un campo vuoto o a metà resti tale. */
export interface CampiSimulazione {
  chiave: string;
  pagina: string;
  zona: Zona;
  spazio: string;
  sconto: string;
}

export const CAMPI_VUOTI: CampiSimulazione = { chiave: "", pagina: "1", zona: CENTRO_PAGINA, spazio: "", sconto: "" };

const testoNumero = (valore: number, decimali: number): string => String(Math.round(valore * 10 ** decimali) / 10 ** decimali);

/** I campi di partenza per un prodotto: la sua pagina, la sua posizione, il suo spazio e il suo sconto. */
export const campiDelProdotto = (prodotto: ProdottoSimulabile): CampiSimulazione => {
  const { box } = prodotto;
  return {
    chiave: prodotto.chiave,
    pagina: String(box.pagina ?? 1),
    zona: centroBox(box) ?? CENTRO_PAGINA,
    spazio: box.spazio > 0 ? testoNumero(box.spazio, 1) : "",
    sconto: box.sconto !== null && Number.isFinite(box.sconto) ? testoNumero(box.sconto, 0) : "",
  };
};

export type ErroriSimulazione = Partial<Record<"chiave" | "pagina" | "spazio" | "sconto", string>>;

/** Numero scritto all'italiana o all'inglese ("12,5" o "12.5"); null se vuoto o non è un numero. */
export const leggiNumero = (testo: string): number | null => {
  const pulito = testo.trim().replace(",", ".");
  if (!pulito) return null;
  const numero = Number(pulito);
  return Number.isFinite(numero) ? numero : null;
};

/** Valida i campi: la richiesta quando sono tutti validi, altrimenti gli errori da mostrare accanto ai campi. */
export function validaSimulazione(
  campi: CampiSimulazione,
  totalePagine: number
): { richiesta: RichiestaSimulazione | null; errori: ErroriSimulazione } {
  const errori: ErroriSimulazione = {};
  if (!campi.chiave) errori.chiave = "Scegli il prodotto da simulare.";

  const pagina = leggiNumero(campi.pagina);
  const ultima = Math.max(1, Math.floor(totalePagine));
  if (pagina === null || !Number.isInteger(pagina) || pagina < 1 || pagina > ultima) errori.pagina = `La pagina va da 1 a ${ultima}.`;

  const spazio = leggiNumero(campi.spazio);
  if (spazio === null || spazio <= 0 || spazio > 100) errori.spazio = "Lo spazio è la percentuale della pagina occupata dal box: più di 0, al massimo 100.";

  const sconto = leggiNumero(campi.sconto);
  if (campi.sconto.trim() && (sconto === null || sconto < 0 || sconto >= 100)) errori.sconto = "Lo sconto va da 0 a 99%; lascialo vuoto per un prodotto senza sconto.";

  if (Object.keys(errori).length > 0) return { richiesta: null, errori };
  return {
    richiesta: {
      chiave: campi.chiave,
      pagina: pagina!,
      x: arrotonda4(limita01(campi.zona.x)),
      y: arrotonda4(limita01(campi.zona.y)),
      spazio: spazio!,
      sconto: campi.sconto.trim() ? sconto : null,
    },
    errori,
  };
}

export const stessaRichiesta = (a: RichiestaSimulazione | null, b: RichiestaSimulazione | null): boolean =>
  a === b ||
  (a !== null &&
    b !== null &&
    a.chiave === b.chiave &&
    a.pagina === b.pagina &&
    a.x === b.x &&
    a.y === b.y &&
    a.spazio === b.spazio &&
    a.sconto === b.sconto);

/* ---------- Anteprima ---------- */

/**
 * Il riquadro del box simulato nella pagina, per l'anteprima: quadrato sulla carta (w × larghezza =
 * h × altezza), con l'area dello spazio indicato, centrato sulla zona e tenuto dentro la pagina.
 */
export const riquadroSimulato = (zona: Zona, spazio: number | null, proporzione: number): GeometriaPagina | null => {
  if (spazio === null || !(spazio > 0) || !(proporzione > 0)) return null;
  const area = Math.min(100, spazio) / 100;
  let w = Math.sqrt(area / proporzione);
  let h = w * proporzione;
  // Oltre un lato della pagina il box si allunga sull'altro, a parità di area
  if (w > 1) {
    w = 1;
    h = Math.min(1, area);
  } else if (h > 1) {
    h = 1;
    w = Math.min(1, area);
  }
  const x = Math.min(1 - w, Math.max(0, zona.x - w / 2));
  const y = Math.min(1 - h, Math.max(0, zona.y - h / 2));
  return { x, y, w, h };
};

/** Il nome della zona scelta: la posizione attuale del prodotto, una cella della griglia o un punto. */
export const nomeZona = (zona: Zona, attuale: Zona | null): string => {
  if (attuale && stessaZona(zona, attuale)) return NOME_POSIZIONE_ATTUALE;
  return ZONE_PAGINA.find(voce => stessaZona(voce, zona))?.nome ?? "Punto scelto";
};
