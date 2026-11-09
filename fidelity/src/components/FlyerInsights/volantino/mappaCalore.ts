import type { RigaTooltip } from "@/components/Grafici";
import {
  densitaVolantino,
  elementiPerPagina,
  formattaValore,
  MISURE_CALORE,
  SCALA_CALORE_STANDARD,
  unitaMisura,
  valoriPerBox,
  type DatiMisure,
  type DensitaPagina,
  type MisuraCalore,
  type UnitaMisura,
} from "../../../../lib/insightVolantino/calore";
import type { BoxInsight } from "../../../../lib/insightVolantino/tipi";

/**
 * La mappa di calore continua del visualizzatore (contratto in lib/insightVolantino/calore.ts):
 * scelta della misura, densità di tutte le pagine memorizzate per misura, testi e gradiente della
 * legenda. Funzioni pure, salvo la cache del calcolatore.
 *
 * UX: il visualizzatore ha due viste, una alla volta. "Colori dei box" colora i riquadri per reparto,
 * meccanica, sconto o visibilità ("Colora per"); "Mappa di calore" spegne i colori dei box, che
 * restano contorni sottili cliccabili, e dipinge sotto di loro il calore della misura scelta, con la
 * legenda continua nell'unità della misura.
 */

export type VistaVolantino = "box" | "calore";

export const OPZIONI_VISTA: Array<{ valore: VistaVolantino; etichetta: string }> = [
  { valore: "box", etichetta: "Colori dei box" },
  { valore: "calore", etichetta: "Mappa di calore" },
];

/** Colonne della griglia della densità: abbastanza per una resa morbida, poche per calcolarla al volo. */
export const COLONNE_CALORE = 96;

/** Il canvas visibile ingrandisce la griglia di questo fattore, sfumando, prima che il browser lo porti alla pagina. */
export const FATTORE_DISEGNO = 4;

/** La misura proposta accendendo la mappa: le vendite quando ci sono, altrimenti la prima disponibile. */
export const misuraPredefinita = (disponibili: readonly MisuraCalore[]): MisuraCalore | null =>
  disponibili.includes("vendite") ? "vendite" : (disponibili[0] ?? null);

/** La misura da mostrare: quella scelta se è ancora disponibile (i dati possono cambiare), altrimenti la predefinita. */
export const misuraEffettiva = (scelta: MisuraCalore | null, disponibili: readonly MisuraCalore[]): MisuraCalore | null =>
  scelta !== null && disponibili.includes(scelta) ? scelta : misuraPredefinita(disponibili);

export interface MappaCalore {
  misura: MisuraCalore;
  unita: UnitaMisura;
  /** Valore di ogni box con il dato, nell'unità della misura. */
  valori: Map<string, number>;
  /** Densità 0-1 delle pagine con almeno un box, rispetto al punto più caldo del volantino. */
  densita: Map<number, DensitaPagina>;
  /** Valore più alto fra i box: l'estremo caldo della legenda. */
  massimo: number;
}

/** Valori, densità di tutte le pagine e massimo di una misura. */
export function calcolaMappaCalore(
  misura: MisuraCalore,
  box: readonly BoxInsight[],
  dati: DatiMisure,
  proporzione: number
): MappaCalore {
  const valori = valoriPerBox(misura, box, dati);
  const densita = densitaVolantino(elementiPerPagina(box, valori), { colonne: COLONNE_CALORE, proporzione });
  let massimo = 0;
  for (const valore of valori.values()) if (valore > massimo) massimo = valore;
  return { misura, unita: unitaMisura(misura, dati), valori, densita, massimo };
}

/**
 * Un calcolatore con la sua cache: ogni misura si calcola una volta sola per gli stessi box e dati,
 * cosi' tornare a una misura già vista non rifà la sfocatura di tutte le pagine.
 */
export function creaCalcolatoreMappe(
  box: readonly BoxInsight[],
  dati: DatiMisure,
  proporzione: number
): (misura: MisuraCalore) => MappaCalore {
  const cache = new Map<MisuraCalore, MappaCalore>();
  return misura => {
    const presente = cache.get(misura);
    if (presente) return presente;
    const mappa = calcolaMappaCalore(misura, box, dati, proporzione);
    cache.set(misura, mappa);
    return mappa;
  };
}

/** Gradiente CSS della scala, da sinistra (freddo) a destra (caldo), per la legenda continua. */
export const gradienteScala = (tappe: readonly string[] = SCALA_CALORE_STANDARD): string => {
  if (tappe.length === 0) return "none";
  if (tappe.length === 1) return tappe[0];
  const passi = tappe.map((colore, i) => `${colore} ${Number(((i / (tappe.length - 1)) * 100).toFixed(2))}%`);
  return `linear-gradient(to right, ${passi.join(", ")})`;
};

export const NOMI_UNITA: Readonly<Record<UnitaMisura, string>> = {
  percentuale: "in percentuale",
  euro: "in euro",
  pezzi: "in pezzi",
  indice: "indice",
};

/** Il valore del box nella misura, come si scrive ("1.234 €", "32%"); "Nessun dato" se manca. */
export const testoValoreMisura = (mappa: Pick<MappaCalore, "valori" | "unita">, idBox: string): string => {
  const valore = mappa.valori.get(idBox);
  return valore === undefined ? "Nessun dato" : formattaValore(valore, mappa.unita);
};

/** La riga del tooltip con il valore della misura accesa. */
export const rigaMisura = (mappa: MappaCalore, idBox: string): RigaTooltip => ({
  etichetta: MISURE_CALORE[mappa.misura].etichetta,
  valore: testoValoreMisura(mappa, idBox),
});
